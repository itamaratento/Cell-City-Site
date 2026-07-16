/* ============================================================
   BASE.REPOSITORY.PADRAO.JS — API padronizada (P2.3.2, 2026-07-16)

   Camada ADITIVA aplicada por comApiPadrao() ao objeto retornado
   pelas duas factories (base.repository.js e base.repository.tenant.js).
   Os métodos originais em inglês (list/getById/create/set/update/
   remove/onChange/...) continuam existindo com o mesmo contrato —
   nenhum dos ~20 consumidores atuais quebra. Os métodos novos em
   português formam a API padronizada da P2.3 e SEMPRE devolvem o
   envelope { ok, dados, erro, ...extras }:

     ok:true  → { ok, dados, total?, cursor?, temMais?, origem? }
     ok:false → { ok, dados:null, erro:{ operacao, codigo, mensagem } }

   Tenant/empresa_id: garantidos por delegação — nas factories tenant,
   create/set injetam empresa_id e list/onChange aplicam o filtro
   quando areTenantFiltersEnabled() (mesmo gate do tenant-query.js).

   Logging: o logger do CCC (scripts/logger.sh, shared-log.sh) é
   shell-side e não existe no browser; aqui o equivalente é o _log
   interno com tag [Repo:<colecao>] — erros sempre no console.error,
   diagnóstico opt-in via localStorage cc_repo_debug = '1'.

   Cache: opt-in POR CHAMADA ({ cacheTtlMs: <ms> } em listar/buscar*),
   em memória, por repositório, invalidado por criar/editar/remover
   do próprio repositório. Escritas feitas pelos métodos legados (set/
   update/remove em inglês) NÃO invalidam — usar TTL curto (CLAUDE.md
   §9: cache existe para economizar leituras, não para dado crítico).

   Paginação: keyset por VALOR do campo de ordenação (where >/< +
   orderBy + limit — únicas primitivas exportadas pelo firebase.js
   protegido; startAfter/getCountFromServer não estão disponíveis sem
   alterá-lo). Usar campo de valores únicos/monótonos (ex.: criadoEmISO);
   valores empatados no corte podem pular/repetir itens entre páginas.

   contar(): sem getCountFromServer, conta via leitura dos documentos
   filtrados — custa 1 leitura por doc (§9); usar só em volumes pequenos
   ou com cacheTtlMs.
   ============================================================ */

import { PAGINACAO, STORAGE_KEYS } from '../shared/app-config.js';

export function comApiPadrao(repo) {
  const cache = new Map(); // chaveConsulta → { ts, dados }
  const tag = `[Repo:${repo.collectionName}]`;

  const debugAtivo = () => {
    try { return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEYS.DEBUG_REPO) === '1'; }
    catch { return false; }
  };
  const log = (nivel, msg, extra) => {
    if (nivel === 'erro') console.error(tag, msg, extra ?? '');
    else if (debugAtivo()) console.log(tag, msg, extra ?? '');
  };

  const ok = (dados, extras = {}) => ({ ok: true, dados, erro: null, ...extras });
  const falha = (operacao, codigo, mensagem) => ({ ok: false, dados: null, erro: { operacao, codigo, mensagem } });
  const excecao = (e, operacao) => {
    log('erro', `${operacao} falhou:`, e);
    return falha(operacao, e?.code || 'erro-interno', e?.message || String(e));
  };

  const chaveDe = (consulta) => { try { return JSON.stringify(consulta ?? {}); } catch { return String(Date.now()); } };
  const invalidarCache = () => cache.clear();

  async function listar(opts = {}) {
    const { cacheTtlMs = 0, ...consulta } = opts;
    const chave = chaveDe(consulta);
    if (cacheTtlMs > 0) {
      const hit = cache.get(chave);
      if (hit && (Date.now() - hit.ts) < cacheTtlMs) {
        log('info', 'cache hit', chave);
        return ok(hit.dados, { total: hit.dados.length, origem: 'cache' });
      }
    }
    try {
      const dados = await repo.list(consulta);
      if (cacheTtlMs > 0) cache.set(chave, { ts: Date.now(), dados });
      log('info', `listar → ${dados.length} docs`);
      return ok(dados, { total: dados.length, origem: 'firestore' });
    } catch (e) { return excecao(e, 'listar'); }
  }

  function validar(data, validador = null) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return falha('validar', 'payload-invalido', 'Payload deve ser um objeto simples.');
    }
    if (typeof validador === 'function') {
      const r = validador(data);
      if (r !== true) return falha('validar', 'validacao', typeof r === 'string' ? r : 'Dados inválidos.');
    }
    return ok(data);
  }

  return Object.assign(repo, {
    listar,
    validar,
    limparCache: invalidarCache,

    async listarPaginado({ orderByField, direction = 'asc', pageSize = PAGINACAO.PAGE_SIZE_PADRAO, cursor = null, where: whereClauses = [], ...resto } = {}) {
      if (!orderByField) return falha('listarPaginado', 'parametro-obrigatorio', 'listarPaginado exige orderByField.');
      const clausulas = [...whereClauses];
      if (cursor !== null && cursor !== undefined) {
        clausulas.push([orderByField, direction === 'desc' ? '<' : '>', cursor]);
      }
      try {
        const dados = await repo.list({ ...resto, where: clausulas, orderByField, direction, limitTo: pageSize + 1 });
        const temMais = dados.length > pageSize;
        const itens = temMais ? dados.slice(0, pageSize) : dados;
        const ultimo = itens[itens.length - 1];
        return ok(itens, { total: itens.length, temMais, cursor: ultimo ? (ultimo[orderByField] ?? null) : null });
      } catch (e) { return excecao(e, 'listarPaginado'); }
    },

    async buscarPorId(id) {
      try {
        const d = await repo.getById(id);
        return d ? ok(d) : falha('buscarPorId', 'nao-encontrado', `Documento "${id}" não existe em ${repo.collectionName}.`);
      } catch (e) { return excecao(e, 'buscarPorId'); }
    },

    async buscar(campo, op, valor, opts = {}) {
      return listar({ ...opts, where: [...(opts.where || []), [campo, op, valor]] });
    },

    async buscarPorFiltro(filtros = [], opts = {}) {
      return listar({ ...opts, where: filtros });
    },

    async buscarPorEmpresa(empresaId, opts = {}) {
      if (!empresaId) return falha('buscarPorEmpresa', 'parametro-obrigatorio', 'Informe o empresaId.');
      return listar({ ...opts, where: [...(opts.where || []), ['empresa_id', '==', empresaId]] });
    },

    // Firestore não tem operador "contains" — filtra em memória sobre o
    // resultado (aceita os mesmos opts de listar, incluindo cacheTtlMs).
    async pesquisar(campo, termo, opts = {}) {
      const r = await listar(opts);
      if (!r.ok) return { ...r, erro: { ...r.erro, operacao: 'pesquisar' } };
      const t = String(termo ?? '').toLowerCase();
      const dados = r.dados.filter(d => String(d?.[campo] ?? '').toLowerCase().includes(t));
      return ok(dados, { total: dados.length });
    },

    async contar(opts = {}) {
      const r = await listar(opts);
      if (!r.ok) return { ...r, erro: { ...r.erro, operacao: 'contar' } };
      return ok(r.dados.length);
    },

    async criar(data, { validador = null } = {}) {
      const v = validar(data, validador);
      if (!v.ok) return { ...v, erro: { ...v.erro, operacao: 'criar' } };
      try {
        const ref = await repo.create(data);
        invalidarCache();
        return ok({ id: ref?.id ?? null });
      } catch (e) { return excecao(e, 'criar'); }
    },

    async editar(id, data, { validador = null } = {}) {
      if (!id) return falha('editar', 'parametro-obrigatorio', 'Informe o id do documento.');
      const v = validar(data, validador);
      if (!v.ok) return { ...v, erro: { ...v.erro, operacao: 'editar' } };
      try {
        await repo.update(id, data);
        invalidarCache();
        return ok({ id });
      } catch (e) { return excecao(e, 'editar'); }
    },

    async remover(id) {
      if (!id) return falha('remover', 'parametro-obrigatorio', 'Informe o id do documento.');
      try {
        await repo.remove(id);
        invalidarCache();
        return ok({ id });
      } catch (e) { return excecao(e, 'remover'); }
    },
  });
}
