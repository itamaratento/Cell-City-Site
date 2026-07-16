import { URLS } from '../../shared/app-config.js';
import { initModulo } from '../../scripts/kernel.js';
import { carregarPermissoes, podeVisualizar } from '../../shared/permissoes.js';
import {
  db, collection, getDocs, query, orderBy, limit, onSnapshot
} from '../../scripts/firebase.js';
import { injectTenantFilter } from '../../shared/tenant-query.js';
import { escHtml as esc } from '../../shared/sanitize.js';

const $ = id => document.getElementById(id);

// ── Coleções de auditoria ──────────────────────────────────────────
const COL_AUDITORIA = 'auditoria_usuarios_permissoes';
const COL_CONFIG = 'config';
const DOC_CONFIG = 'auditoria';

let logs = [];
let perfis = [];
let usuarios = [];

// ── Estado ─────────────────────────────────────────────────────────
let filtroBusca = '';
let filtroAcao = '';
let filtroUsuario = '';
let filtroDataInicio = '';
let filtroDataFim = '';
let paginaAtual = 1;
const ITENS_POR_PAGINA = 50;

// ── Mapa de ações para badges ────────────────────────────────────────
const ACAO_META = {
  usuario_criado:       { icon: '➕', label: 'Usuário criado',       badge: 'success' },
  usuario_editado:      { icon: '✏️', label: 'Usuário editado',      badge: 'info' },
  usuario_desativado:   { icon: '🔴', label: 'Usuário desativado',   badge: 'warning' },
  usuario_reativado:    { icon: '🟢', label: 'Usuário reativado',    badge: 'success' },
  usuario_excluido:     { icon: '🗑️', label: 'Usuário excluído',     badge: 'danger' },
  perfil_alterado:      { icon: '🔄', label: 'Perfil alterado',      badge: 'info' },
  permissoes_alteradas: { icon: '🛡️', label: 'Permissões alteradas', badge: 'warning' },
  senha_redefinida:     { icon: '🔑', label: 'Senha redefinida',     badge: 'info' },
  perfil_criado:        { icon: '➕', label: 'Perfil criado',         badge: 'success' },
  perfil_editado:       { icon: '✏️', label: 'Perfil editado',        badge: 'info' },
};

function metaAcao(acao) { return ACAO_META[acao] || { icon: '📌', label: acao, badge: 'info' }; }
window.metaAcao = metaAcao;

// ── Boot ───────────────────────────────────────────────────────────
(async function boot() {
  const ctx = await initModulo();
  if (!ctx) return;
  // Revisão 2026-07-10: o commit da Sprint 12 declarava RBAC mas o gate
  // não existia — qualquer usuário aprovado via logs de auditoria e a
  // lista completa de usuários. Mesmo padrão dos demais módulos.
  await carregarPermissoes(ctx);
  if (!podeVisualizar('auditoria')) { window.location.href = URLS.dashboard(); return; }

  try {
    const snap = await getDocs(query(collection(db, 'perfis_operacionais'), ...injectTenantFilter([])));
    perfis = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {}
  try {
    const snap = await getDocs(query(collection(db, 'usuarios'), ...injectTenantFilter([])));
    usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {}

  setupUI();
  carregarLogs();

  // Listener em tempo real
  onSnapshot(
    query(collection(db, COL_AUDITORIA), ...injectTenantFilter([]), orderBy('timestamp', 'desc'), limit(500)),
    (snap) => {
      logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderDashboard();
      renderTabela();
    },
    () => {}
  );
})();

function setupUI() {
  $('au-busca')?.addEventListener('input', e => { filtroBusca = e.target.value; paginaAtual = 1; renderTabela(); });
  $('au-filtro-acao')?.addEventListener('change', e => { filtroAcao = e.target.value; paginaAtual = 1; renderTabela(); });
  $('au-filtro-usuario')?.addEventListener('change', e => { filtroUsuario = e.target.value; paginaAtual = 1; renderTabela(); });
  $('au-data-inicio')?.addEventListener('change', e => { filtroDataInicio = e.target.value; paginaAtual = 1; renderTabela(); });
  $('au-data-fim')?.addEventListener('change', e => { filtroDataFim = e.target.value; paginaAtual = 1; renderTabela(); });
  $('au-prox')?.addEventListener('click', () => { paginaAtual++; renderTabela(); });
  $('au-ant')?.addEventListener('click', () => { paginaAtual = Math.max(1, paginaAtual - 1); renderTabela(); });

  // Popula selects de filtro
  const selAcao = $('au-filtro-acao');
  if (selAcao) {
    selAcao.innerHTML = '<option value="">Todas as ações</option>' +
      Object.entries(ACAO_META).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('');
  }

  const selUsuario = $('au-filtro-usuario');
  if (selUsuario) {
    // Será populado com os nomes dos admins que aparecem nos logs
    selUsuario.innerHTML = '<option value="">Todos os usuários</option>';
  }
}

// ── Carregar dados iniciais ────────────────────────────────────────
async function carregarLogs() {
  try {
    const snap = await getDocs(query(collection(db, COL_AUDITORIA), ...injectTenantFilter([]), orderBy('timestamp', 'desc'), limit(500)));
    logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { logs = []; }
  renderDashboard();
  renderTabela();
}

// ── Dashboard ──────────────────────────────────────────────────────
function renderDashboard() {
  const total = logs.length;
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const hojeCount = logs.filter(l => l.timestamp?.toDate?.() >= inicioHoje).length;
  const acoesUnicas = new Set(logs.map(l => l.acao)).size;
  const adminsUnicos = new Set(logs.filter(l => l.admin_nome).map(l => l.admin_nome)).size;

  const cards = [
    { valor: total, label: 'Total de registros' },
    { valor: hojeCount, label: 'Hoje' },
    { valor: acoesUnicas, label: 'Tipos de ação' },
    { valor: adminsUnicos, label: 'Administradores' },
  ];
  $('au-cards').innerHTML = cards.map(c =>
    `<div class="au-card"><div class="au-card-valor">${c.valor}</div><div class="au-card-label">${c.label}</div></div>`
  ).join('');
}

// ── Render tabela ──────────────────────────────────────────────────
function renderTabela() {
  const tbody = $('au-tbody');
  const empty = $('au-empty');

  let filtrados = [...logs];

  // Filtro de texto
  if (filtroBusca) {
    const q = filtroBusca.toLowerCase();
    filtrados = filtrados.filter(l =>
      (l.admin_nome || '').toLowerCase().includes(q) ||
      (l.alvo_nome || '').toLowerCase().includes(q) ||
      (l.detalhes || '').toLowerCase().includes(q) ||
      (l.acao || '').toLowerCase().includes(q)
    );
  }

  // Filtro de ação
  if (filtroAcao) filtrados = filtrados.filter(l => l.acao === filtroAcao);

  // Filtro de usuário
  if (filtroUsuario) filtrados = filtrados.filter(l =>
    l.admin_uid === filtroUsuario || (l.admin_nome || '').includes(filtroUsuario)
  );

  // Filtro de data
  if (filtroDataInicio) {
    const inicio = new Date(filtroDataInicio + 'T00:00:00');
    filtrados = filtrados.filter(l => !l.timestamp || l.timestamp.toDate() >= inicio);
  }
  if (filtroDataFim) {
    const fim = new Date(filtroDataFim + 'T23:59:59');
    filtrados = filtrados.filter(l => !l.timestamp || l.timestamp.toDate() <= fim);
  }

  // Paginação
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITENS_POR_PAGINA));
  paginaAtual = Math.min(paginaAtual, totalPaginas);
  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const pagina = filtrados.slice(inicio, inicio + ITENS_POR_PAGINA);

  $('au-info').textContent = `${filtrados.length} registro(s)`;
  $('au-pag-info').textContent = `Página ${paginaAtual} de ${totalPaginas}`;
  $('au-ant').style.display = paginaAtual <= 1 ? 'none' : '';
  $('au-prox').style.display = paginaAtual >= totalPaginas ? 'none' : '';

  if (!pagina.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = pagina.map(l => {
    const m = metaAcao(l.acao);
    const ts = l.timestamp?.toDate ? l.timestamp.toDate() : new Date(l.timestamp);
    const dataStr = ts.toLocaleDateString('pt-BR');
    const horaStr = ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const detalhes = typeof l.detalhes === 'object' ? JSON.stringify(l.detalhes).slice(0, 100) : (l.detalhes || '—');

    return `<tr>
      <td style="white-space:nowrap"><span class="au-badge au-badge-${m.badge}">${m.icon}</span> ${m.label}</td>
      <td>${esc(l.admin_nome || '—')}</td>
      <td>${esc(l.alvo_nome || '—')}</td>
      <td style="white-space:nowrap">${dataStr} ${horaStr}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-tertiary);font-size:12px">${esc(detalhes)}</td>
    </tr>`;
  }).join('');
}

