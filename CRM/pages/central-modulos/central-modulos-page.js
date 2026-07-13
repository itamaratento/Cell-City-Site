/* ============================================================
   CENTRAL DE MÓDULOS — página (V2, Sprint MOD-V2-001)
   Renderiza o catálogo gerado (shared/modulos.catalogo.json):
   métricas, busca global, filtros, status 🟢🟡🔴, health check
   por módulo e log local de eventos.

   Sem nenhuma leitura extra de Firestore: todo o diagnóstico é
   calculado em dev-time pelo gerador; aqui só se renderiza.
   Única escrita remota: favoritos (mesmo caminho já homologado,
   usuarios/{uid}/preferencias/modulos).
   ============================================================ */
import {
  init, carregarCatalogo, getCatalogo, TODOS_MODULOS,
  isFavorito, toggleFavorito, getLogs, registrarLog,
} from '../../shared/central-modulos.js';

const $ = (id) => document.getElementById(id);

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STATUS_INFO = {
  ok:      { emoji: '🟢', rotulo: 'OK' },
  atencao: { emoji: '🟡', rotulo: 'Atenção' },
  erro:    { emoji: '🔴', rotulo: 'Erro' },
};

// ── estado dos filtros ────────────────────────────────────────
const filtro = {
  busca: '',
  grupo: '',
  status: '',
  soFavoritos: false,
  soSemRbac: false,
  soRecentes: false,     // atualizados nos últimos 7 dias
  soSemDependencias: false,
};

// ── texto pesquisável por módulo (Etapa 9: nome, descrição,
// grupo, arquivo, coleção, permissão, dependência, categoria) ──
function textoDeBusca(m) {
  return [
    m.id, m.pasta, m.nome, m.descricao, m.grupo, m.categoria,
    (m.arquivosPrincipais || []).map((a) => a.arquivo).join(' '),
    m.colecoesFirestore ? [...m.colecoesFirestore.diretas, ...m.colecoesFirestore.viaRepositorio].join(' ') : '',
    m.rbac ? m.rbac.mecanismos.join(' ') : '',
    m.dependencias ? [...m.dependencias.shared, ...m.dependencias.scripts, ...m.dependencias.repositorios].join(' ') : '',
  ].join(' ').toLowerCase();
}

function ehRecente(m) {
  if (!m.atualizadoEm) return false;
  return (Date.now() - new Date(m.atualizadoEm).getTime()) < 7 * 24 * 3600 * 1000;
}
function semDependencias(m) {
  const d = m.dependencias || { shared: [], scripts: [], repositorios: [] };
  return d.shared.length + d.scripts.length + d.repositorios.length === 0;
}

function aplicarFiltros(lista) {
  return lista.filter((m) => {
    if (filtro.busca && !textoDeBusca(m).includes(filtro.busca)) return false;
    if (filtro.grupo && m.grupo !== filtro.grupo) return false;
    if (filtro.status && m.status !== filtro.status) return false;
    if (filtro.soFavoritos && !isFavorito(m.id)) return false;
    if (filtro.soSemRbac && (m.rbac ? m.rbac.protegido : true)) return false;
    if (filtro.soRecentes && !ehRecente(m)) return false;
    if (filtro.soSemDependencias && !semDependencias(m)) return false;
    return true;
  });
}

// ── métricas (Etapa 11) ───────────────────────────────────────
function renderMetricas() {
  const c = getCatalogo();
  if (!c) return;
  const r = c.resumo;
  $('cm-metricas').innerHTML = [
    ['🧩', r.visiveis, 'módulos'],
    ['🟢', r.porStatus.ok, 'OK'],
    ['🟡', r.porStatus.atencao, 'atenção'],
    ['🔴', r.porStatus.erro, 'erro'],
    ['🔐', r.semRbac, 'sem RBAC'],
    ['🗄️', r.colecoesDistintas, 'coleções'],
    ['📈', r.scoreMedio + '%', 'score médio'],
  ].map(([ico, n, rot]) =>
    `<div class="cm-metrica"><span class="cm-metrica-n">${ico} ${escHtml(n)}</span><span class="cm-metrica-r">${escHtml(rot)}</span></div>`
  ).join('');
  $('cm-rodape-info').textContent =
    `Catálogo gerado automaticamente em ${new Date(c.geradoEm).toLocaleString('pt-BR')} · commit ${c.commitBase} · gerador v${c.versaoGerador}`;
}

// ── grid de cards ─────────────────────────────────────────────
function renderModulos() {
  const grid = $('cm-grid');
  const vazio = $('cm-vazio');
  const lista = aplicarFiltros(TODOS_MODULOS);

  grid.innerHTML = lista.map((m) => {
    const on = isFavorito(m.id);
    const st = STATUS_INFO[m.status] || STATUS_INFO.ok;
    return `<a class="cm-card" href="${escHtml(m.url)}" data-mid="${escHtml(m.id)}">
      <button type="button" class="cm-star${on ? ' on' : ''}" data-id="${escHtml(m.id)}"
        title="${on ? 'Remover do menu principal' : 'Adicionar ao menu principal'}">${on ? '⭐' : '☆'}</button>
      <button type="button" class="cm-info" data-id="${escHtml(m.id)}" title="Detalhes e health check">ⓘ</button>
      <div class="cm-icon">${escHtml(m.icone)}</div>
      <div class="cm-name">${escHtml(m.nome)}</div>
      <div class="cm-sub"><span title="${escHtml(st.rotulo)} · score ${m.score}%">${st.emoji}</span> <span class="cm-grupo">${escHtml(m.grupo)}</span></div>
    </a>`;
  }).join('');
  vazio.style.display = lista.length ? 'none' : 'block';

  grid.querySelectorAll('.cm-star').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      toggleFavorito(btn.dataset.id); // re-render vem pelo evento cc-modulos-changed
    });
  });
  grid.querySelectorAll('.cm-info').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      abrirDetalhes(btn.dataset.id);
    });
  });
}

// ── detalhes + health check (Etapa 12) ───────────────────────
function abrirDetalhes(id) {
  const c = getCatalogo();
  const m = c && c.modulos.find((x) => x.id === id);
  if (!m) return;
  registrarLog('detalhes', id);
  const st = STATUS_INFO[m.status] || STATUS_INFO.ok;
  const li = (rot, val) => (val || val === 0) ? `<div class="cm-det-linha"><span>${rot}</span><b>${escHtml(val)}</b></div>` : '';
  const lista = (arr) => arr && arr.length ? escHtml(arr.join(', ')) : '—';

  $('cm-det-corpo').innerHTML = `
    <div class="cm-det-titulo">${escHtml(m.icone)} ${escHtml(m.nome)} <span class="cm-det-status">${st.emoji} ${st.rotulo} · ${m.score}%</span></div>
    <p class="cm-det-desc">${escHtml(m.descricao)}</p>
    ${li('Grupo', m.grupo)}${li('Categoria', m.categoria)}${li('Versão', m.versao + ' (' + m.commits + ' commits)')}
    ${li('Autor (último commit)', m.autor)}${li('Atualizado em', m.atualizadoEm)}${li('Caminho', 'CRM/pages/' + m.pasta + '/')}
    ${li('RBAC', m.rbac.protegido ? m.rbac.mecanismos.join(' + ') : 'SEM GATE DE PERMISSÃO')}
    <div class="cm-det-linha"><span>Coleções (diretas)</span><b>${lista(m.colecoesFirestore.diretas)}</b></div>
    <div class="cm-det-linha"><span>Coleções (via repositório)</span><b>${lista(m.colecoesFirestore.viaRepositorio)}</b></div>
    <div class="cm-det-linha"><span>Dependências</span><b>${lista([...m.dependencias.shared, ...m.dependencias.scripts, ...m.dependencias.repositorios])}</b></div>
    <div class="cm-det-linha"><span>Arquivos principais</span><b>${lista((m.arquivosPrincipais || []).map((a) => a.arquivo + ' (' + a.linhas + 'L)'))}</b></div>
    <h4>Health check</h4>
    <ul class="cm-check">${m.checklist.map((ck) => `<li>${ck.ok ? '✅' : '❌'} ${escHtml(ck.item)}</li>`).join('')}</ul>
    ${m.diagnosticos.length ? `<h4>Diagnósticos</h4><ul class="cm-check">${m.diagnosticos.map((d) => `<li>⚠️ <b>${escHtml(d.tipo)}</b>: ${escHtml(d.detalhe)}</li>`).join('')}</ul>` : ''}
    <div class="cm-det-rodape">Última auditoria: geração do catálogo em ${new Date(c.geradoEm).toLocaleString('pt-BR')}</div>`;
  $('cm-det').showModal();
}

// ── logs (Etapa 13) ───────────────────────────────────────────
function abrirLogs() {
  const logs = getLogs().slice().reverse();
  $('cm-det-corpo').innerHTML = `
    <div class="cm-det-titulo">📜 Log local da Central de Módulos</div>
    <p class="cm-det-desc">Eventos deste navegador (máx. 200). O log de gerações do catálogo fica em scripts/central-modulos/logs/ no ambiente de desenvolvimento.</p>
    ${logs.length
      ? `<ul class="cm-check">${logs.map((l) => `<li><b>${escHtml(new Date(l.em).toLocaleString('pt-BR'))}</b> · ${escHtml(l.evento)} — ${escHtml(l.detalhe)}</li>`).join('')}</ul>`
      : '<p class="cm-det-desc">Nenhum evento registrado ainda.</p>'}`;
  $('cm-det').showModal();
}

// ── filtros (Etapa 10) ────────────────────────────────────────
function montarFiltros() {
  const grupos = [...new Set(TODOS_MODULOS.map((m) => m.grupo))].sort();
  $('cm-f-grupo').innerHTML = '<option value="">Todos os grupos</option>' +
    grupos.map((g) => `<option value="${escHtml(g)}">${escHtml(g)}</option>`).join('');
}

function ligarControles() {
  $('cm-busca').addEventListener('input', () => { filtro.busca = $('cm-busca').value.trim().toLowerCase(); renderModulos(); });
  $('cm-f-grupo').addEventListener('change', () => { filtro.grupo = $('cm-f-grupo').value; renderModulos(); });
  $('cm-f-status').addEventListener('change', () => { filtro.status = $('cm-f-status').value; renderModulos(); });
  const chips = [
    ['cm-f-fav', 'soFavoritos'], ['cm-f-semrbac', 'soSemRbac'],
    ['cm-f-recentes', 'soRecentes'], ['cm-f-semdeps', 'soSemDependencias'],
  ];
  for (const [id, chave] of chips) {
    $(id).addEventListener('click', () => {
      filtro[chave] = !filtro[chave];
      $(id).classList.toggle('on', filtro[chave]);
      renderModulos();
    });
  }
  $('cm-logs-btn').addEventListener('click', abrirLogs);
  $('cm-det-fechar').addEventListener('click', () => $('cm-det').close());
}

// ── boot ──────────────────────────────────────────────────────
window.addEventListener('cc-modulos-changed', renderModulos);

init();
carregarCatalogo().then((c) => {
  if (!c) {
    $('cm-vazio').textContent = 'Não foi possível carregar o catálogo de módulos (sem rede e sem cache local). Recarregue a página quando estiver online.';
    $('cm-vazio').style.display = 'block';
    return;
  }
  montarFiltros();
  renderMetricas();
  renderModulos();
});
ligarControles();
