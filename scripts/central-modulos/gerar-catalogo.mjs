#!/usr/bin/env node
/* ============================================================
   GERADOR DO CATÁLOGO DE MÓDULOS — Cell City CRM (Sprint MOD-V2-001)

   Varre CRM/pages/* e produz CRM/shared/modulos.catalogo.json:
   descoberta automática (pasta nova = módulo novo no catálogo,
   sem editar lista nenhuma), validação, diagnóstico e status
   🟢/🟡/🔴 por módulo — tudo calculado em dev-time, para o
   navegador só renderizar (zero custo de Firestore em runtime).

   Enriquecimento opcional por módulo (nome, ícone, grupo, id
   legado, ocultação): CRM/pages/central-modulos/modulos.meta.json.

   Uso:
     node scripts/central-modulos/gerar-catalogo.mjs           # gera/atualiza o JSON
     node scripts/central-modulos/gerar-catalogo.mjs --check   # não escreve; sai 1 se o
                                                               # JSON commitado estiver
                                                               # desatualizado (uso em teste)

   Roda fora do deploy (workflow exclui /scripts/); o JSON gerado
   em CRM/shared/ é publicado normalmente pelo GitHub Pages.
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGES_DIR = path.join(ROOT, 'CRM', 'pages');
const META_PATH = path.join(ROOT, 'CRM', 'pages', 'central-modulos', 'modulos.meta.json');
const SAIDA_PATH = path.join(ROOT, 'CRM', 'shared', 'modulos.catalogo.json');
const LOG_DIR = path.join(ROOT, 'scripts', 'central-modulos', 'logs');
const VERSAO_GERADOR = '1.0.0';
const MODO_CHECK = process.argv.includes('--check');

// ── util ──────────────────────────────────────────────────────
function git(args, fallback = '') {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
  catch { return fallback; }
}
function lerTexto(p) { try { return readFileSync(p, 'utf8'); } catch { return null; } }
function contarLinhas(txt) { return txt ? txt.split('\n').length : 0; }
function unico(arr) { return [...new Set(arr)].sort(); }

function listarArquivos(dir, base = dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listarArquivos(p, base));
    else out.push({ rel: path.relative(base, p), abs: p, bytes: statSync(p).size });
  }
  return out;
}

// ── contexto global varrido uma vez ──────────────────────────
// Sidebar fixa do Dashboard: ids reais em data-sid.
const dashboardHtml = lerTexto(path.join(PAGES_DIR, 'dashboard', 'index.html')) || '';
const sidebarSids = [...dashboardHtml.matchAll(/data-sid="([\w-]+)"/g)].map(m => m[1]);
const sidebarDuplicados = unico(sidebarSids.filter((s, i) => sidebarSids.indexOf(s) !== i));

// Dock flutuante: pastas referenciadas por href="../<pasta>/...".
const dockJs = lerTexto(path.join(ROOT, 'CRM', 'shared', 'dock.js')) || '';
const dockPastas = new Set([...dockJs.matchAll(/href="\.\.\/([\w-]+)\//g)].map(m => m[1]));

// Pastas excluídas do artefato de deploy (GitHub Pages).
const workflow = lerTexto(path.join(ROOT, '.github', 'workflows', 'deploy-pages.yml')) || '';
const deployExcluidos = new Set([...workflow.matchAll(/--exclude='CRM\/pages\/([\w-]+)\/'/g)].map(m => m[1]));

// Repositórios: arquivo → coleções Firestore que ele encapsula.
const REPOS_DIR = path.join(ROOT, 'CRM', 'repositories');
const RE_COLECAO = /(?:collection|collectionGroup|doc)\(\s*db\s*,\s*['"]([\w-]+)['"]/g;
const RE_CREATE_REPO = /createRepository\(\s*['"]([\w-]+)['"]/g;
const RE_COL_CONST = /\bCOL(?:ECAO)?_\w+\s*=\s*['"]([\w-]+)['"]/g;
const colecoesPorRepo = {};
if (existsSync(REPOS_DIR)) {
  for (const f of readdirSync(REPOS_DIR).filter(f => f.endsWith('.js'))) {
    const src = lerTexto(path.join(REPOS_DIR, f)) || '';
    const cols = [
      ...[...src.matchAll(RE_COLECAO)].map(m => m[1]),
      ...[...src.matchAll(RE_CREATE_REPO)].map(m => m[1]),
      ...[...src.matchAll(RE_COL_CONST)].map(m => m[1]),
    ].filter(c => c !== 'x'); // exemplo genérico do base.repository.js
    colecoesPorRepo[f] = unico(cols);
  }
}

// Metadados de enriquecimento (apresentação; a descoberta não depende dele).
const meta = JSON.parse(lerTexto(META_PATH) || '{"modulos":{}}').modulos || {};

// ── análise de um módulo ──────────────────────────────────────
const RE_IMPORT = /(?:import\s+[^'"()]*from\s*|import\s*\(\s*|export\s+[^'"()]*from\s*|import\s*)['"]([^'"]+)['"]/g;
const RE_SRC_HREF = /(?:src|href)=["']([^"'#?]+\.(?:js|css|html))(?:[?#][^"']*)?["']/g;
const RE_ARTEFATO_DEV = /(\.code-workspace$|-test\.html$|\.md$)/i;

function resolverRef(spec, arquivoAbs) {
  if (/^(https?:|mailto:|tel:|javascript:|data:)/.test(spec)) return null; // externo
  const limpo = spec.replace(/[?#].*$/, ''); // cache-buster (?v=...) não faz parte do caminho
  if (limpo.startsWith('/')) return path.join(ROOT, limpo);
  if (limpo.startsWith('.')) return path.resolve(path.dirname(arquivoAbs), limpo);
  return null; // bare specifier — não usado no projeto (sem bundler)
}

function analisarModulo(pasta) {
  const dir = path.join(PAGES_DIR, pasta);
  const m = meta[pasta] || {};
  const arquivos = listarArquivos(dir);
  const temIndex = existsSync(path.join(dir, 'index.html'));
  const arquivoEntrada = m.arquivoEntrada || 'index.html';
  const htmlPrincipal = lerTexto(path.join(dir, arquivoEntrada)) || lerTexto(path.join(dir, 'index.html'));

  // nome derivado: <title> sem prefixos da marca; fallback: nome da pasta
  let nomeDerivado = pasta;
  const t = htmlPrincipal && htmlPrincipal.match(/<title>([^<]*)<\/title>/i);
  if (t && t[1].trim()) nomeDerivado = t[1].replace(/^\s*Cell\s*City\s*[-–—]?\s*/i, '').replace(/\s*[-–—]\s*Cell\s*City.*$/i, '').trim() || pasta;

  // conteúdo JS+HTML top-level para detecções
  const topo = arquivos.filter(a => !a.rel.includes(path.sep));
  const fontes = arquivos.filter(a => /\.(js|html)$/.test(a.rel)).map(a => ({ ...a, txt: lerTexto(a.abs) || '' }));
  const tudo = fontes.map(f => f.txt).join('\n');

  // imports/refs quebrados
  const importsQuebrados = [];
  for (const f of fontes) {
    const specs = new Set();
    if (f.rel.endsWith('.js')) for (const mm of f.txt.matchAll(RE_IMPORT)) specs.add(mm[1]);
    if (f.rel.endsWith('.html')) for (const mm of f.txt.matchAll(RE_SRC_HREF)) specs.add(mm[1]);
    for (const spec of specs) {
      const alvo = resolverRef(spec, f.abs);
      if (alvo && !existsSync(alvo)) importsQuebrados.push(`${f.rel} → ${spec}`);
    }
  }

  // dependências compartilhadas
  const deps = { shared: [], scripts: [], repositorios: [] };
  for (const mm of tudo.matchAll(/['"][^'"]*\/(shared|scripts|repositories)\/([\w.-]+\.(?:js|css))['"]/g)) {
    const balde = mm[1] === 'repositories' ? 'repositorios' : mm[1];
    deps[balde].push(mm[2]);
  }
  deps.shared = unico(deps.shared); deps.scripts = unico(deps.scripts); deps.repositorios = unico(deps.repositorios);

  // Firestore: coleções diretas + herdadas dos repositórios usados
  const diretas = unico([...[...tudo.matchAll(RE_COLECAO)].map(x => x[1]), ...[...tudo.matchAll(RE_COL_CONST)].map(x => x[1])]);
  const viaRepositorio = unico(deps.repositorios.flatMap(r => colecoesPorRepo[r] || []));

  // RBAC
  const permissoes = [];
  if (/shared\/permissoes(\.js)?/.test(tudo)) permissoes.push('shared/permissoes.js');
  if (/\btemPermissao\s*\(/.test(tudo)) permissoes.push('kernel.temPermissao');

  // git
  const relPasta = `CRM/pages/${pasta}`;
  const commits = parseInt(git(['rev-list', '--count', 'HEAD', '--', relPasta], '0'), 10) || 0;
  const autor = git(['log', '-1', '--format=%an', '--', relPasta], 'desconhecido');
  const atualizadoEm = git(['log', '-1', '--format=%ad', '--date=format:%Y-%m-%d', '--', relPasta], '');

  // identidade no catálogo
  const id = m.id || pasta;
  const oculto = !!m.oculto;
  const url = `/CRM/pages/${pasta}/${arquivoEntrada}`;

  // presença em menus
  const menu = {
    sidebarDashboard: sidebarSids.includes(id),
    dock: dockPastas.has(pasta),
    catalogoVisivel: !oculto,
  };

  // diagnósticos (Etapa 6)
  const diagnosticos = [];
  const ocultoDeliberado = oculto && !!m.motivoOculto;
  const publicado = !deployExcluidos.has(pasta);
  const vazios = arquivos.filter(a => a.bytes === 0).map(a => a.rel);
  const artefatosDev = topo.filter(a => RE_ARTEFATO_DEV.test(a.rel) && a.rel !== 'modulos.meta.json').map(a => a.rel);
  if (!temIndex) diagnosticos.push({ tipo: 'arquivo-ausente', detalhe: 'index.html não existe' });
  if (vazios.length) diagnosticos.push({ tipo: 'arquivo-vazio', detalhe: `arquivos com 0 bytes: ${vazios.join(', ')}` });
  for (const i of importsQuebrados) diagnosticos.push({ tipo: 'import-quebrado', detalhe: i });
  if (!permissoes.length && !oculto && pasta !== 'config') diagnosticos.push({ tipo: 'sem-rbac', detalhe: 'nenhum gate de permissão detectado (shared/permissoes.js ou kernel.temPermissao)' });
  if (!menu.sidebarDashboard && !menu.dock && !menu.catalogoVisivel && !ocultoDeliberado) diagnosticos.push({ tipo: 'inalcancavel', detalhe: 'não aparece em nenhuma navegação (sidebar, dock ou catálogo)' });
  if (artefatosDev.length && publicado) diagnosticos.push({ tipo: 'artefato-dev', detalhe: `arquivos de desenvolvimento na pasta publicada: ${artefatosDev.join(', ')}` });
  if (diretas.length && deps.repositorios.length === 0 && !oculto) diagnosticos.push({ tipo: 'sem-repository', detalhe: `acessa Firestore direto (${diretas.length} coleções) sem usar a camada CRM/repositories/` });
  if (m.id && m.id !== pasta) diagnosticos.push({ tipo: 'id-legado', detalhe: `id '${m.id}' difere da pasta '${pasta}' (alias documentado no modulos.meta.json, preservado por compatibilidade de favoritos)` });
  if (m.observacao) diagnosticos.push({ tipo: 'observacao', detalhe: m.observacao }); // informativa — não muda o status
  if (m.alerta) diagnosticos.push({ tipo: 'alerta', detalhe: m.alerta });             // aviso real — vira 🟡

  // checklist + score (Etapa 12)
  const recente = atualizadoEm && (Date.now() - new Date(atualizadoEm).getTime()) < 90 * 24 * 3600 * 1000;
  const checklist = [
    { item: 'index.html presente', ok: temIndex },
    { item: 'sem arquivos vazios (0 bytes)', ok: vazios.length === 0 },
    { item: 'imports e referências resolvem', ok: importsQuebrados.length === 0 },
    { item: 'gate de RBAC presente', ok: permissoes.length > 0 || oculto || pasta === 'config' },
    { item: 'usa camada Repository (ou não acessa Firestore direto)', ok: diretas.length === 0 || deps.repositorios.length > 0 },
    { item: 'alcançável por alguma navegação (ou oculto por decisão documentada)', ok: menu.sidebarDashboard || menu.dock || menu.catalogoVisivel || ocultoDeliberado },
    { item: 'sem artefatos de dev na pasta publicada', ok: artefatosDev.length === 0 || !publicado },
    { item: 'atualizado nos últimos 90 dias', ok: !!recente },
    { item: 'grupo funcional definido', ok: !!(m.grupo && m.grupo !== 'Sem grupo') },
    { item: 'id do catálogo igual à pasta (ou alias documentado)', ok: !m.id || m.id === pasta || !!m.observacao },
  ];
  const score = Math.round(100 * checklist.filter(c => c.ok).length / checklist.length);

  // status (Etapa 5)
  const arquivosUteis = arquivos.filter(a => !RE_ARTEFATO_DEV.test(a.rel));
  const tudoVazio = arquivosUteis.length > 0 && arquivosUteis.every(a => a.bytes === 0);
  let status;
  if (!temIndex || tudoVazio || importsQuebrados.length) status = 'erro';
  else if (diagnosticos.some(d => ['sem-rbac', 'inalcancavel', 'artefato-dev', 'alerta'].includes(d.tipo)) || score < 70) status = 'atencao';
  else status = 'ok';

  return {
    id,
    pasta,
    nome: m.nome || nomeDerivado,
    icone: m.icone || '📄',
    url,
    grupo: m.grupo || 'Sem grupo',
    categoria: m.categoria || 'Sistema Web (CRM)',
    descricao: m.descricao || (htmlPrincipal ? `Módulo ${nomeDerivado}.` : 'Sem página principal.'),
    oculto,
    ...(m.motivoOculto ? { motivoOculto: m.motivoOculto } : {}),
    versao: `1.0.${commits}`,
    autor,
    atualizadoEm,
    commits,
    status,
    score,
    rbac: { protegido: permissoes.length > 0, mecanismos: permissoes },
    colecoesFirestore: { diretas, viaRepositorio },
    dependencias: deps,
    arquivosPrincipais: topo
      .filter(a => /\.(html|js|css)$/.test(a.rel) && !RE_ARTEFATO_DEV.test(a.rel))
      .map(a => ({ arquivo: a.rel, linhas: contarLinhas(lerTexto(a.abs)) }))
      .sort((a, b) => b.linhas - a.linhas),
    totalArquivos: arquivos.length,
    menu,
    deployExcluido: deployExcluidos.has(pasta),
    checklist,
    diagnosticos,
  };
}

// ── varredura ─────────────────────────────────────────────────
const inicio = Date.now();
const pastas = readdirSync(PAGES_DIR, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
const modulos = pastas.map(analisarModulo);

// anomalias globais (não pertencem a um módulo só)
const anomalias = [];
for (const s of sidebarDuplicados) anomalias.push({ tipo: 'sidebar-duplicada', detalhe: `data-sid="${s}" aparece ${sidebarSids.filter(x => x === s).length}x na sidebar do Dashboard (CRM/pages/dashboard/index.html)` });
const idsVistos = new Map();
for (const mod of modulos) {
  if (idsVistos.has(mod.id)) anomalias.push({ tipo: 'id-duplicado', detalhe: `id '${mod.id}' usado por '${idsVistos.get(mod.id)}' e '${mod.pasta}'` });
  idsVistos.set(mod.id, mod.pasta);
}
for (const s of sidebarSids) {
  if (s !== 'notas' && !modulos.some(mod => mod.id === s)) anomalias.push({ tipo: 'sidebar-sem-modulo', detalhe: `sidebar do Dashboard tem data-sid="${s}" sem módulo correspondente` });
}

// resumo (Etapa 11)
const visiveis = modulos.filter(m => !m.oculto);
const porStatus = { ok: 0, atencao: 0, erro: 0 };
const porGrupo = {};
for (const m of modulos) {
  porStatus[m.status === 'ok' ? 'ok' : m.status === 'erro' ? 'erro' : 'atencao']++;
  porGrupo[m.grupo] = (porGrupo[m.grupo] || 0) + 1;
}
const resumo = {
  totalPastas: pastas.length,
  visiveis: visiveis.length,
  ocultos: modulos.length - visiveis.length,
  porStatus,
  porGrupo,
  semRbac: modulos.filter(m => !m.rbac.protegido && !m.oculto).length,
  semFirestore: modulos.filter(m => !m.colecoesFirestore.diretas.length && !m.colecoesFirestore.viaRepositorio.length).length,
  incompletos: modulos.filter(m => m.status === 'erro').length,
  colecoesDistintas: unico(modulos.flatMap(m => [...m.colecoesFirestore.diretas, ...m.colecoesFirestore.viaRepositorio])).length,
  scoreMedio: Math.round(modulos.reduce((s, m) => s + m.score, 0) / modulos.length),
  anomaliasGlobais: anomalias.length,
};

const catalogo = {
  gerador: 'scripts/central-modulos/gerar-catalogo.mjs',
  versaoGerador: VERSAO_GERADOR,
  geradoEm: new Date().toISOString(),
  commitBase: git(['rev-parse', '--short', 'HEAD'], ''),
  resumo,
  anomalias,
  modulos,
};

// ── saída ─────────────────────────────────────────────────────
const json = JSON.stringify(catalogo, null, 2) + '\n';

if (MODO_CHECK) {
  const atual = lerTexto(SAIDA_PATH);
  const normalizar = (s) => s && s.replace(/"geradoEm": "[^"]*"/, '"geradoEm": "-"').replace(/"commitBase": "[^"]*"/, '"commitBase": "-"');
  if (normalizar(atual) === normalizar(json)) {
    console.log(`✅ --check: ${path.relative(ROOT, SAIDA_PATH)} está em dia com o código (${modulos.length} módulos).`);
    process.exit(0);
  }
  console.error(`❌ --check: ${path.relative(ROOT, SAIDA_PATH)} está DESATUALIZADO — rode: node scripts/central-modulos/gerar-catalogo.mjs`);
  process.exit(1);
}

writeFileSync(SAIDA_PATH, json);

// log de execução (Etapa 13, lado dev) — JSONL local, fora do git
mkdirSync(LOG_DIR, { recursive: true });
appendFileSync(path.join(LOG_DIR, 'geracoes.log'), JSON.stringify({
  em: catalogo.geradoEm,
  commit: catalogo.commitBase,
  usuario: git(['config', 'user.name'], 'desconhecido'),
  duracaoMs: Date.now() - inicio,
  modulos: modulos.length,
  porStatus,
  anomalias: anomalias.length,
}) + '\n');

console.log(`✅ Catálogo gerado: ${path.relative(ROOT, SAIDA_PATH)}`);
console.log(`   ${modulos.length} módulos (${visiveis.length} visíveis) · 🟢 ${porStatus.ok} · 🟡 ${porStatus.atencao} · 🔴 ${porStatus.erro} · score médio ${resumo.scoreMedio}`);
for (const a of anomalias) console.log(`   ⚠️  ${a.tipo}: ${a.detalhe}`);
