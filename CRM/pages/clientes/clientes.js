import {
  db, collection, doc, updateDoc, setDoc,
  deleteDoc, getDocs, query, where, orderBy,
  onSnapshot, serverTimestamp, increment, arrayUnion
} from '../../scripts/firebase.js';

// ── Constantes ─────────────────────────────────────────────────────────
const PREDEFINED_TAGS = ['VIP', 'Prioritário', 'Samsung', 'iPhone', 'Motorola', 'Xiaomi', 'Corporativo', 'Recorrente', 'Inativo', 'Inadimplente', 'Promoção'];

// ── Estado ─────────────────────────────────────────────────────────────
let clientes     = [];
let currentView  = '__home__';
let searchQuery  = '';
let clienteAtual = null;
let editingId    = null;
let unsub           = null;
let equipamentosCache = {};
let equipOSCache      = {};

// ── Utilitários ─────────────────────────────────────────────────────────
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function fmtDate(v) {
  if (!v) return '';
  try {
    const d = v?.toDate ? v.toDate() : new Date(v);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return ''; }
}

function fmtMes(v) {
  try {
    const d = v?.toDate ? v.toDate() : new Date(v);
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  } catch { return ''; }
}

function fmtValor(v) {
  if (!v && v !== 0) return '';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fone(s) { return (s || '').replace(/\D/g, ''); }

function statusLabel(s) {
  return { novo_contato: '🔵 Novo', orcamento_enviado: '📤 Orçamento', aguardando_resposta: '⏳ Aguardando', negociacao: '🤝 Negociação', fechado: '✅ Fechado', perdido: '❌ Perdido' }[s] || s || '';
}

function calcNivel(osCount, totalGasto) {
  if (osCount > 10 || totalGasto > 5000) return { nivel: 'VIP',    emoji: '👑', cls: 'cli-nivel-vip'    };
  if (osCount > 5  || totalGasto > 2000) return { nivel: 'Ouro',   emoji: '🥇', cls: 'cli-nivel-ouro'   };
  if (osCount > 2  || totalGasto > 500)  return { nivel: 'Prata',  emoji: '🥈', cls: 'cli-nivel-prata'  };
  return                                         { nivel: 'Bronze', emoji: '🥉', cls: 'cli-nivel-bronze' };
}

function isInativo(c) {
  const SEIS_MESES = 180 * 24 * 60 * 60 * 1000;
  const ts = c.atualizadoEm?.seconds
    ? c.atualizadoEm.seconds * 1000
    : new Date(c.createdAt || 0).getTime();
  return (Date.now() - ts) > SEIS_MESES;
}

function isRecorrente(c) {
  return (c.totalOs || (c.history || []).length) > 1;
}

// ── Listener Firestore ─────────────────────────────────────────────────
function startListener() {
  if (unsub) unsub();
  unsub = onSnapshot(
    query(collection(db, 'clientes'), orderBy('name')),
    snap => { clientes = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); },
    err  => console.warn('Clientes snapshot:', err)
  );
}

function lazyEnrichCliente(id, orders, crmLeads, totalGasto, nivel) {
  const ultimoAtendimento = [...orders.map(o => o.createdAt || ''), ...crmLeads.map(l => l.criadoEm?.toDate?.()?.toISOString() || '')].filter(Boolean).sort().pop() || null;
  updateDoc(doc(db, 'clientes', id), {
    totalGasto:        totalGasto || 0,
    totalOs:           orders.length,
    totalLeads:        crmLeads.length,
    ultimoAtendimento: ultimoAtendimento,
    nivel:             nivel
  }).catch(() => {});
}

// ── Contagens sidebar ──────────────────────────────────────────────────
function updateCounts() {
  const g = id => document.getElementById(id);
  if (g('cli-count-all'))  g('cli-count-all').textContent  = clientes.length;
  if (g('cli-count-crm'))  g('cli-count-crm').textContent  = clientes.filter(c => (c.crmLeads || []).length > 0 || c.origem === 'crm').length;
  if (g('cli-count-os'))   g('cli-count-os').textContent   = clientes.filter(c => (c.history  || []).length > 0 || (c.totalOs || 0) > 0).length;
  if (g('cli-count-rec'))  g('cli-count-rec').textContent  = clientes.filter(isRecorrente).length;
  if (g('cli-count-inat')) g('cli-count-inat').textContent = clientes.filter(isInativo).length;
  renderTagsSidebar();
}

function renderTagsSidebar() {
  const el = document.getElementById('cli-sb-tags');
  if (!el) return;
  const allTags = new Set();
  clientes.forEach(c => (c.tags || []).forEach(t => allTags.add(t)));
  if (!allTags.size) { el.innerHTML = '<div class="cli-sb-no-tags">Nenhuma etiqueta</div>'; return; }
  el.innerHTML = [...allTags].sort().map(tag => {
    const cnt = clientes.filter(c => (c.tags || []).includes(tag)).length;
    const active = currentView === `__tag__:${tag}`;
    return `<div class="cli-sb-item cli-sb-tag-item${active ? ' active' : ''}" onclick="navTo('__tag__:${esc(tag)}')">
      <span class="cli-tag-dot"></span>
      <span class="cli-sb-label">${esc(tag)}</span>
      <span class="cli-sb-count">${cnt}</span>
    </div>`;
  }).join('');
}

// ── Filtrar lista ──────────────────────────────────────────────────────
function getFiltered() {
  let list = [...clientes];
  if      (currentView === '__recentes__')    list = [...list].sort((a, b) => (b.atualizadoEm?.seconds || 0) - (a.atualizadoEm?.seconds || 0)).slice(0, 30);
  else if (currentView === '__crm__')         list = list.filter(c => (c.crmLeads || []).length > 0 || c.origem === 'crm');
  else if (currentView === '__os__')          list = list.filter(c => (c.history  || []).length > 0 || (c.totalOs || 0) > 0);
  else if (currentView === '__recorrentes__') list = list.filter(isRecorrente);
  else if (currentView === '__inativos__')    list = list.filter(isInativo);
  else if (currentView.startsWith('__tag__:')) {
    const tag = currentView.slice(7);
    list = list.filter(c => (c.tags || []).includes(tag));
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    list = list.filter(c =>
      (c.name  || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.cpf   || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.tags  || []).some(t => t.toLowerCase().includes(q))
    );
  }
  return list;
}

// ── Render geral ───────────────────────────────────────────────────────
function renderAll() {
  updateCounts();
  document.querySelectorAll('.cli-sb-item[data-view]').forEach(el =>
    el.classList.toggle('active', el.dataset.view === currentView)
  );
  // Highlight tag items
  document.querySelectorAll('.cli-sb-tag-item').forEach(el =>
    el.classList.toggle('active', el.getAttribute('onclick')?.includes(currentView))
  );
  renderMainArea();
}

function renderMainArea() {
  const homeGrid  = document.getElementById('cli-home-grid');
  const workspace = document.getElementById('cli-workspace');
  const formEl    = document.getElementById('cli-form');
  const titulo    = document.getElementById('cli-main-titulo');
  if (formEl && formEl.style.display !== 'none') return;

  const FULL_VIEWS = ['__home__', '__dashboard__', '__ranking__'];
  if (FULL_VIEWS.includes(currentView)) {
    if (titulo)    titulo.textContent      = { '__home__': '🏠 Home', '__dashboard__': '📊 Dashboard', '__ranking__': '🏆 Ranking de Clientes' }[currentView];
    if (homeGrid)  homeGrid.style.display  = '';
    if (workspace) workspace.style.display = 'none';
    if      (currentView === '__home__')      renderHomeGrid();
    else if (currentView === '__dashboard__') renderDashboard();
    else if (currentView === '__ranking__')   renderRanking();
  } else {
    const labels = { '__lista__': '👥 Todos os Clientes', '__recentes__': '🔄 Recentes', '__crm__': '🎯 Via CRM', '__os__': '🔧 Com O.S.', '__inativos__': '💤 Inativos', '__recorrentes__': '🔁 Recorrentes' };
    const tagLabel = currentView.startsWith('__tag__:') ? `🏷️ ${currentView.slice(7)}` : null;
    if (titulo)    titulo.textContent      = tagLabel || labels[currentView] || '👥 Clientes';
    if (homeGrid)  homeGrid.style.display  = 'none';
    if (workspace) workspace.style.display = '';
    renderLista();
  }
}

// ── Home grid ──────────────────────────────────────────────────────────
function renderHomeGrid() {
  const grid = document.getElementById('cli-home-grid');
  if (!grid) return;
  const total  = clientes.length;
  const comOS  = clientes.filter(c => (c.history  || []).length > 0 || (c.totalOs || 0) > 0).length;
  const comCRM = clientes.filter(c => (c.crmLeads || []).length > 0).length;
  const iniMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const novos  = clientes.filter(c => (c.createdAt || '') >= iniMes).length;
  const rec    = clientes.filter(isRecorrente).length;
  const inat   = clientes.filter(isInativo).length;
  grid.innerHTML = `
    <div class="cli-home-block" onclick="navTo('__lista__')">
      <span class="cli-home-icon">👥</span><span class="cli-home-nome">Total cadastrado</span><span class="cli-home-num">${total}</span>
    </div>
    <div class="cli-home-block" onclick="navTo('__lista__')">
      <span class="cli-home-icon">🆕</span><span class="cli-home-nome">Novos este mês</span><span class="cli-home-num">${novos}</span>
    </div>
    <div class="cli-home-block" onclick="navTo('__os__')">
      <span class="cli-home-icon">🔧</span><span class="cli-home-nome">Com O.S.</span><span class="cli-home-num cli-num-green">${comOS}</span>
    </div>
    <div class="cli-home-block" onclick="navTo('__crm__')">
      <span class="cli-home-icon">🎯</span><span class="cli-home-nome">Via CRM</span><span class="cli-home-num cli-num-blue">${comCRM}</span>
    </div>
    <div class="cli-home-block" onclick="navTo('__recorrentes__')">
      <span class="cli-home-icon">🔁</span><span class="cli-home-nome">Recorrentes</span><span class="cli-home-num cli-num-green">${rec}</span>
    </div>
    <div class="cli-home-block" onclick="navTo('__inativos__')">
      <span class="cli-home-icon">💤</span><span class="cli-home-nome">Inativos</span><span class="cli-home-num cli-num-amber">${inat}</span>
    </div>
    <div class="cli-home-block cli-home-novo" onclick="abrirNovoCliente()">
      <span class="cli-home-icon">➕</span><span class="cli-home-nome">Novo cliente</span>
    </div>
    <div class="cli-home-block" onclick="navTo('__ranking__')">
      <span class="cli-home-icon">🏆</span><span class="cli-home-nome">Ver Ranking</span>
    </div>`;
}

// ── Dashboard ──────────────────────────────────────────────────────────
function renderDashboard() {
  const grid = document.getElementById('cli-home-grid');
  if (!grid) return;

  const total  = clientes.length;
  const novos  = clientes.filter(c => (c.createdAt || '') >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()).length;
  const rec    = clientes.filter(isRecorrente).length;
  const inat   = clientes.filter(isInativo).length;
  const comOS  = clientes.filter(c => (c.history || []).length > 0 || (c.totalOs || 0) > 0).length;
  const comCRM = clientes.filter(c => (c.crmLeads || []).length > 0).length;

  // Crescimento mensal (últimos 6 meses)
  const months = {};
  clientes.forEach(c => {
    if (!c.createdAt) return;
    try {
      const d = new Date(c.createdAt?.toDate ? c.createdAt.toDate() : c.createdAt);
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months[k] = (months[k] || 0) + 1;
    } catch {}
  });
  const mLabels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    mLabels.push({ label: d.toLocaleDateString('pt-BR', { month: 'short' }), count: months[k] || 0 });
  }
  const maxM = Math.max(...mLabels.map(m => m.count), 1);
  const chartHtml = `
    <div class="cli-chart">
      ${mLabels.map(m => `
        <div class="cli-chart-col">
          <div class="cli-chart-num">${m.count || ''}</div>
          <div class="cli-chart-bar-wrap">
            <div class="cli-chart-bar" style="height:${Math.max(m.count > 0 ? 4 : 0, Math.round(m.count/maxM*100))}%"></div>
          </div>
          <div class="cli-chart-label">${m.label}</div>
        </div>`).join('')}
    </div>`;

  // Top 5 por O.S.
  const top5 = [...clientes]
    .sort((a, b) => ((b.totalOs || (b.history||[]).length) - (a.totalOs || (a.history||[]).length)))
    .slice(0, 5);
  const top5Html = top5.map((c, i) => {
    const cnt = c.totalOs || (c.history || []).length;
    const w   = Math.round(cnt / (top5[0] ? (top5[0].totalOs || (top5[0].history||[]).length) : 1) * 100);
    return `<div class="cli-rank-row" onclick="abrirCliente('${esc(c.id)}'); navTo('__lista__')">
      <span class="cli-rank-pos">${i+1}</span>
      <span class="cli-rank-nome">${esc(c.name||'—')}</span>
      <div class="cli-rank-bar-wrap"><div class="cli-rank-bar" style="width:${w}%"></div></div>
      <span class="cli-rank-val">${cnt} O.S.</span>
    </div>`;
  }).join('');

  grid.innerHTML = `
    <div class="cli-dashboard">
      <div class="cli-dash-stats">
        <div class="cli-dash-stat"><span class="cli-dash-num">${total}</span><span class="cli-dash-label">👥 Total</span></div>
        <div class="cli-dash-stat"><span class="cli-dash-num cli-num-green">${novos}</span><span class="cli-dash-label">🆕 Este mês</span></div>
        <div class="cli-dash-stat"><span class="cli-dash-num cli-num-blue">${rec}</span><span class="cli-dash-label">🔁 Recorrentes</span></div>
        <div class="cli-dash-stat"><span class="cli-dash-num cli-num-amber">${inat}</span><span class="cli-dash-label">💤 Inativos</span></div>
        <div class="cli-dash-stat"><span class="cli-dash-num">${comOS}</span><span class="cli-dash-label">🔧 Com O.S.</span></div>
        <div class="cli-dash-stat"><span class="cli-dash-num">${comCRM}</span><span class="cli-dash-label">🎯 Via CRM</span></div>
      </div>

      <div class="cli-dash-section">
        <div class="cli-dash-titulo">📈 Novos clientes — últimos 6 meses</div>
        ${chartHtml}
      </div>

      <div class="cli-dash-section">
        <div class="cli-dash-titulo">🏆 Top 5 clientes por O.S. <button class="cli-dash-link" onclick="navTo('__ranking__')">Ver ranking completo →</button></div>
        <div class="cli-rank-list">${top5Html || '<div class="cli-hist-vazio">Nenhum dado disponível</div>'}</div>
      </div>
    </div>`;
}

// ── Ranking ────────────────────────────────────────────────────────────
function renderRanking() {
  const grid = document.getElementById('cli-home-grid');
  if (!grid) return;

  const sorted = [...clientes].sort((a, b) => {
    const aOs = a.totalOs || (a.history || []).length;
    const bOs = b.totalOs || (b.history || []).length;
    if (bOs !== aOs) return bOs - aOs;
    return (b.totalGasto || 0) - (a.totalGasto || 0);
  }).slice(0, 20);

  const max = sorted[0] ? (sorted[0].totalOs || (sorted[0].history || []).length) : 1;

  const rows = sorted.map((c, i) => {
    const osCount = c.totalOs || (c.history || []).length;
    const gasto   = c.totalGasto ? fmtValor(c.totalGasto) : '—';
    const ultimo  = c.ultimoAtendimento ? fmtDate(c.ultimoAtendimento) : (c.atualizadoEm ? fmtDate(c.atualizadoEm) : '—');
    const nivel   = calcNivel(osCount, c.totalGasto || 0);
    const w       = Math.round(osCount / max * 100);
    return `
      <div class="cli-rank-full-row" onclick="abrirCliente('${esc(c.id)}'); navTo('__lista__')">
        <span class="cli-rank-num ${i < 3 ? 'cli-rank-top' : ''}">${i+1}</span>
        <div class="cli-rank-info">
          <div class="cli-rank-full-nome">${esc(c.name || '—')} <span class="cli-nivel-sm ${nivel.cls}">${nivel.emoji}</span></div>
          <div class="cli-rank-full-sub">📞 ${esc(c.phone || '—')} ${(c.tags||[]).slice(0,2).map(t => `<span class="cli-tag-sm">${esc(t)}</span>`).join('')}</div>
        </div>
        <div class="cli-rank-bars">
          <div class="cli-rank-bar-bg"><div class="cli-rank-bar" style="width:${w}%"></div></div>
        </div>
        <div class="cli-rank-nums">
          <span class="cli-rank-os">${osCount} O.S.</span>
          <span class="cli-rank-gasto">${gasto}</span>
          <span class="cli-rank-ult">${ultimo}</span>
        </div>
      </div>`;
  }).join('');

  grid.innerHTML = `
    <div class="cli-dashboard">
      <div class="cli-dash-section">
        <div class="cli-dash-titulo">🏆 Ranking — Top 20 por O.S. <span class="cli-dash-hint">(valor total disponível após abrir o perfil)</span></div>
        <div class="cli-rank-full-header">
          <span>#</span><span>Cliente</span><span>Volume</span><span>O.S. · Valor · Último</span>
        </div>
        <div class="cli-rank-full-list">${rows || '<div class="cli-hist-vazio">Nenhum cliente com O.S. registrada.</div>'}</div>
      </div>
    </div>`;
}

// ── Lista de clientes ──────────────────────────────────────────────────
function renderLista() {
  const container = document.getElementById('cli-lista');
  const empty     = document.getElementById('cli-empty');
  if (!container) return;
  const list = getFiltered();
  if (!list.length) { container.innerHTML = ''; if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';
  container.innerHTML = list.map(c => {
    const nOs   = c.totalOs || (c.history  || []).length;
    const nCRM  = (c.crmLeads || []).length;
    const nivel = calcNivel(nOs, c.totalGasto || 0);
    const tags  = (c.tags || []).slice(0, 2);
    return `
      <div class="cli-card${c.id === clienteAtual ? ' active' : ''}" onclick="abrirCliente('${esc(c.id)}')">
        <div class="cli-card-top">
          <span class="cli-card-nome">${esc(c.name || '—')}</span>
          <span class="cli-nivel-sm ${nivel.cls}" title="${nivel.nivel}">${nivel.emoji}</span>
        </div>
        <div class="cli-card-fone">📞 ${esc(c.phone || '—')}</div>
        ${c.cpf ? `<div class="cli-card-meta">🆔 ${esc(c.cpf)}</div>` : ''}
        <div class="cli-card-badges">
          ${nOs  > 0 ? `<span class="cli-badge-os">🔧 ${nOs} O.S.</span>`                              : ''}
          ${nCRM > 0 ? `<span class="cli-badge-crm">🎯 ${nCRM} lead${nCRM > 1 ? 's' : ''}</span>` : ''}
          ${tags.map(t => `<span class="cli-badge-tag">🏷️ ${esc(t)}</span>`).join('')}
        </div>
      </div>`;
  }).join('');
}

// ── Perfil do cliente ──────────────────────────────────────────────────
window.abrirCliente = async function(id) {
  clienteAtual = id;
  renderLista();
  const ph      = document.getElementById('cli-detalhe-placeholder');
  const detalhe = document.getElementById('cli-detalhe');
  if (!detalhe) return;
  if (ph) ph.style.display = 'none';
  detalhe.style.display = '';
  detalhe.innerHTML = '<div class="cli-loading">⏳ Carregando perfil...</div>';

  const cliente = clientes.find(c => c.id === id);
  if (!cliente) { detalhe.innerHTML = '<div class="cli-loading">Cliente não encontrado.</div>'; return; }

  let crmLeads = [], orders = [], equipamentos = [];
  try {
    const digits = fone(cliente.phone);
    const [crmSnap, osSnap, equipSnap] = await Promise.all([
      getDocs(query(collection(db, 'crm_leads'), where('telefone', '==', cliente.phone))),
      digits ? getDocs(query(collection(db, 'os'), where('phone', '==', cliente.phone))) : Promise.resolve({ docs: [] }),
      getDocs(collection(db, 'clientes', id, 'equipamentos'))
    ]);
    crmLeads     = crmSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    orders       = osSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    equipamentos = equipSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.dataCadastro?.seconds || 0) - (a.dataCadastro?.seconds || 0));
    if (!orders.length && digits && digits !== cliente.phone) {
      const fb = await getDocs(query(collection(db, 'os'), where('phone', '==', digits)));
      orders = fb.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
  } catch(e) { console.warn('Histórico:', e); }
  equipamentosCache[id] = equipamentos;

  const totalGasto = orders.reduce((s, o) => s + (Number(o.valor) || 0), 0);
  const nivel      = calcNivel(orders.length, totalGasto);
  detalhe.innerHTML = buildPerfilHtml(cliente, crmLeads, orders, totalGasto, nivel, equipamentos);

  // Enriquece o documento Firestore com dados computados
  if (orders.length || crmLeads.length) lazyEnrichCliente(id, orders, crmLeads, totalGasto, nivel.nivel);
};

// ── Construção do perfil ───────────────────────────────────────────────
function buildPerfilHtml(c, crmLeads, orders, totalGasto, nivel, equipamentos = []) {
  const ticketMedio = orders.length > 0 ? totalGasto / orders.length : 0;
  const datas = [
    ...orders.map(o => o.createdAt || ''),
    ...crmLeads.map(l => l.criadoEm?.toDate?.()?.toISOString() || l.criadoEm || '')
  ].filter(Boolean).sort();
  const ultimoAtend = datas.length ? fmtDate(datas[datas.length - 1]) : '—';
  const clienteDesde = c.createdAt ? fmtMes(c.createdAt) : '—';
  const tags = c.tags || [];

  // ── Indicadores header ────────────────────────────────────────────
  const indHtml = `
    <div class="cli-indicadores">
      <div class="cli-ind"><span class="cli-ind-num cli-ind-green">${orders.length}</span><span class="cli-ind-label">O.S.</span></div>
      <div class="cli-ind"><span class="cli-ind-num cli-ind-blue">${crmLeads.length}</span><span class="cli-ind-label">Leads</span></div>
      <div class="cli-ind"><span class="cli-ind-num">${fmtValor(totalGasto) || '—'}</span><span class="cli-ind-label">Total gasto</span></div>
      <div class="cli-ind"><span class="cli-ind-num">${orders.length > 0 ? fmtValor(ticketMedio) : '—'}</span><span class="cli-ind-label">Ticket médio</span></div>
      <div class="cli-ind"><span class="cli-ind-num">${ultimoAtend}</span><span class="cli-ind-label">Último atend.</span></div>
      <div class="cli-ind"><span class="cli-ind-num">${clienteDesde}</span><span class="cli-ind-label">Cliente desde</span></div>
    </div>`;

  // ── Aba Dados ────────────────────────────────────────────────────
  const dadosHtml = `
    <form onsubmit="salvarEdicao(event,'${esc(c.id)}')" class="cli-edit-form">
      <div class="cli-edit-grid">
        <div class="cli-edit-field cli-span2"><label>Nome completo</label><input type="text" name="name" value="${esc(c.name||'')}" required></div>
        <div class="cli-edit-field"><label>Telefone</label><input type="tel" name="phone" value="${esc(c.phone||'')}"></div>
        <div class="cli-edit-field"><label>WhatsApp</label><input type="tel" name="whatsapp" value="${esc(c.whatsapp||'')}"></div>
        <div class="cli-edit-field"><label>CPF</label><input type="text" name="cpf" value="${esc(c.cpf||'')}"></div>
        <div class="cli-edit-field"><label>RG</label><input type="text" name="rg" value="${esc(c.rg||'')}"></div>
        <div class="cli-edit-field"><label>E-mail</label><input type="email" name="email" value="${esc(c.email||'')}"></div>
        <div class="cli-edit-field"><label>Data de Nascimento</label><input type="date" name="dataNascimento" value="${esc(c.dataNascimento||'')}"></div>
        <div class="cli-edit-field cli-span2"><label>Endereço</label><input type="text" name="endereco" value="${esc(c.endereco||'')}"></div>
        <div class="cli-edit-field cli-span2"><label>Observações</label><textarea name="obsCliente" rows="3">${esc(c.obsCliente||'')}</textarea></div>
      </div>
      <div class="cli-edit-btns">
        <button type="submit" class="cli-btn-salvar">💾 Salvar</button>
        <button type="button" class="cli-btn-wpp" onclick="abrirWhatsApp('${esc(c.id)}')">💬 WhatsApp</button>
        <button type="button" class="cli-btn-excluir" onclick="confirmarExclusao('${esc(c.id)}')" title="Excluir">🗑️</button>
      </div>
    </form>
    <div class="cli-tags-editor">
      <div class="cli-tags-titulo">🏷️ Etiquetas</div>
      <div class="cli-tags-pills" id="cli-tags-pills-${esc(c.id)}">
        ${tags.map(t => `<span class="cli-tag-pill">${esc(t)}<button class="cli-tag-rm" onclick="removerTag('${esc(c.id)}','${esc(t)}')">×</button></span>`).join('')}
        ${!tags.length ? '<span class="cli-tags-vazio">Nenhuma etiqueta</span>' : ''}
      </div>
      <div class="cli-tags-quick">
        ${PREDEFINED_TAGS.filter(t => !tags.includes(t)).map(t =>
          `<button class="cli-tag-add-btn" onclick="adicionarTag('${esc(c.id)}','${esc(t)}')">${esc(t)}</button>`
        ).join('')}
        <button class="cli-tag-custom-btn" onclick="addCustomTag('${esc(c.id)}')">✏️ Personalizada</button>
      </div>
    </div>`;

  // ── Aba Timeline 360° ────────────────────────────────────────────
  const timelineHtml = buildTimelineHtml(c, crmLeads, orders);

  // ── Aba CRM ──────────────────────────────────────────────────────
  const crmHtml = crmLeads.length
    ? crmLeads.map(l => `
      <div class="cli-hist-item cli-hist-crm">
        <div class="cli-hist-icone">🎯</div>
        <div class="cli-hist-body">
          <div class="cli-hist-titulo">${esc(l.aparelho||l.servico||'Lead CRM')} ${l.preOsId ? `<span class="cli-preos">${esc(l.preOsId)}</span>` : ''}</div>
          <div class="cli-hist-meta">${fmtDate(l.criadoEm)} · ${statusLabel(l.status)}${l.valor ? ' · '+fmtValor(l.valor) : ''}</div>
          ${l.obs ? `<div class="cli-hist-obs">${esc(l.obs)}</div>` : ''}
          ${l.motivoPerda ? `<div class="cli-hist-obs" style="color:var(--red)">Motivo: ${esc(l.motivoPerda)}</div>` : ''}
        </div>
      </div>`).join('')
    : '<div class="cli-hist-vazio">Nenhum lead no CRM Comercial.</div>';

  // ── Aba O.S. ─────────────────────────────────────────────────────
  const osHtml = orders.length
    ? orders.map(o => `
      <div class="cli-hist-item cli-hist-os">
        <div class="cli-hist-icone">🔧</div>
        <div class="cli-hist-body">
          <div class="cli-hist-titulo">${esc(o.id)} — ${esc(o.model||'')}</div>
          <div class="cli-hist-meta">${fmtDate(o.createdAt)} · ${esc(o.status||'')}${o.valor ? ' · '+fmtValor(o.valor) : ''}</div>
          ${o.defect ? `<div class="cli-hist-obs">${esc(o.defect)}</div>` : ''}
        </div>
      </div>`).join('')
    : '<div class="cli-hist-vazio">Nenhuma O.S. encontrada.</div>';

  // ── Aba Oportunidades ────────────────────────────────────────────
  const opHtml    = buildOportunidadesHtml(c, crmLeads, orders);
  const equipHtml = buildEquipamentosHtml(c.id, equipamentos, orders, c.phone);

  return `
    <div class="cli-perfil-header">
      <div class="cli-perfil-top">
        <div class="cli-perfil-avatar">${(c.name||'?')[0].toUpperCase()}</div>
        <div class="cli-perfil-info">
          <div class="cli-perfil-nome-row">
            <span class="cli-perfil-nome">${esc(c.name||'—')}</span>
            <span class="cli-nivel-badge ${nivel.cls}">${nivel.emoji} ${nivel.nivel}</span>
          </div>
          <div class="cli-perfil-fone">📞 ${esc(c.phone||'—')}</div>
          ${c.email          ? `<div class="cli-perfil-meta">✉️ ${esc(c.email)}</div>`              : ''}
          ${c.dataNascimento ? `<div class="cli-perfil-meta">🎂 ${fmtDate(c.dataNascimento)}</div>` : ''}
          ${tags.length ? `<div class="cli-perfil-tags-row">${tags.map(t => `<span class="cli-tag-pill-sm">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
      </div>
      ${indHtml}
    </div>

    <div class="cli-tabs">
      <button class="cli-tab active" data-tab="dados"       onclick="switchTab('dados')">📋 Dados</button>
      <button class="cli-tab"        data-tab="timeline"    onclick="switchTab('timeline')">⏱️ Timeline</button>
      <button class="cli-tab"        data-tab="op"          onclick="switchTab('op')">💡 Oportunidades</button>
      <button class="cli-tab"        data-tab="crm"         onclick="switchTab('crm')">🎯 CRM (${crmLeads.length})</button>
      <button class="cli-tab"        data-tab="os"          onclick="switchTab('os')">🔧 O.S. (${orders.length})</button>
      <button class="cli-tab"        data-tab="equip"       onclick="switchTab('equip')">📱 Equipamentos${equipamentos.length ? ` (${equipamentos.length})` : ''}</button>
    </div>
    <div class="cli-tab-content" id="cli-tab-dados">${dadosHtml}</div>
    <div class="cli-tab-content" id="cli-tab-timeline" style="display:none">${timelineHtml}</div>
    <div class="cli-tab-content" id="cli-tab-op"       style="display:none">${opHtml}</div>
    <div class="cli-tab-content" id="cli-tab-crm"      style="display:none">${crmHtml}</div>
    <div class="cli-tab-content" id="cli-tab-os"       style="display:none">${osHtml}</div>
    <div class="cli-tab-content" id="cli-tab-equip"    style="display:none">${equipHtml}</div>`;
}

// ── Timeline 360° ──────────────────────────────────────────────────────
function buildTimelineHtml(c, crmLeads, orders) {
  const eventos = [];

  // Cadastro
  if (c.createdAt) eventos.push({ data: new Date(c.createdAt?.toDate ? c.createdAt.toDate() : c.createdAt), icone: '👤', cls: 'tl-cadastro', titulo: 'Cliente cadastrado', desc: `Origem: ${c.origem === 'crm' ? 'CRM Comercial' : c.origem === 'os' ? 'Ordem de Serviço' : 'Cadastro manual'}` });

  // CRM leads
  crmLeads.forEach(l => {
    const dt = l.criadoEm?.toDate?.() || new Date(l.criadoEm || 0);
    eventos.push({ data: dt, icone: '🎯', cls: 'tl-crm', titulo: `Lead CRM criado — ${l.aparelho || l.servico || 'Contato'}`, desc: `${statusLabel('novo_contato')}${l.preOsId ? ' · ' + l.preOsId : ''}` });
    if (l.status === 'orcamento_enviado' || l.status === 'negociacao' || l.status === 'fechado' || l.status === 'perdido') {
      eventos.push({ data: new Date(dt.getTime() + 1), icone: '📊', cls: 'tl-crm', titulo: `Status atualizado: ${statusLabel(l.status)}`, desc: `${l.aparelho || l.servico || ''}${l.valor ? ' · ' + fmtValor(l.valor) : ''}` });
    }
    if (l.osConvertido && l.osConvertidoEm) {
      eventos.push({ data: new Date(l.osConvertidoEm), icone: '🔄', cls: 'tl-conversao', titulo: 'Lead convertido em O.S.', desc: `${l.osId || ''} ${l.preOsId ? '· ' + l.preOsId : ''}` });
    }
  });

  // Ordens de serviço
  orders.forEach(o => {
    eventos.push({ data: new Date(o.createdAt || 0), icone: '🔧', cls: 'tl-os', titulo: `O.S. aberta — ${o.id}`, desc: `${o.model || ''} · ${o.defect || ''}${o.valor ? ' · ' + fmtValor(o.valor) : ''}` });
    if (o.status === 'entregue' || o.status === 'concluido' || o.status === 'Entregue' || o.status === 'Concluído') {
      eventos.push({ data: new Date((o.updatedAt || o.createdAt || 0)), icone: '✅', cls: 'tl-concluido', titulo: `O.S. concluída — ${o.id}`, desc: `${o.model || ''}${o.valor ? ' · Pago: ' + fmtValor(o.valor) : ''}` });
    }
    if (o.crmLeadId) {
      // OS veio do CRM
    }
  });

  if (!eventos.length) return '<div class="cli-hist-vazio">Sem movimentações registradas.</div>';

  eventos.sort((a, b) => b.data - a.data);

  // Agrupamento por data
  const grupos = {};
  eventos.forEach(ev => {
    const d = ev.data.toLocaleDateString('pt-BR');
    if (!grupos[d]) grupos[d] = [];
    grupos[d].push(ev);
  });

  return Object.entries(grupos).map(([data, evs]) => `
    <div class="cli-tl-grupo">
      <div class="cli-tl-data">${data}</div>
      ${evs.map(ev => `
        <div class="cli-tl-item">
          <div class="cli-tl-dot cli-tl-dot-${ev.cls}"></div>
          <div class="cli-tl-body">
            <div class="cli-tl-titulo">${ev.icone} ${esc(ev.titulo)}</div>
            ${ev.desc ? `<div class="cli-tl-meta">${esc(ev.desc)}</div>` : ''}
          </div>
        </div>`).join('')}
    </div>`).join('');
}

// ── Central de Oportunidades ───────────────────────────────────────────
function buildOportunidadesHtml(c, crmLeads, orders) {
  const ops = [];

  const textoOS = orders.map(o => `${o.defect || ''} ${o.service || ''} ${o.model || ''}`).join(' ').toLowerCase();

  // Regra 1: trocou tela → película/capinha
  if (/tela|display|lcd/.test(textoOS)) {
    ops.push({ icone: '📱', titulo: 'Troca de tela detectada no histórico', sugestoes: ['Oferecer película protetora', 'Oferecer capinha personalizada', 'Explicar cuidados com a tela'] });
  }

  // Regra 2: bateria velha (>12 meses)
  const bateriaOs = orders.find(o => /bateria|battery/.test((o.defect||o.service||'').toLowerCase()));
  if (bateriaOs) {
    const meses = (Date.now() - new Date(bateriaOs.createdAt || 0)) / (30 * 24 * 60 * 60 * 1000);
    if (meses > 12) {
      ops.push({ icone: '🔋', titulo: `Bateria trocada há ${Math.round(meses)} meses`, sugestoes: ['Revisão preventiva gratuita', 'Verificar saúde da bateria', 'Troca proativa antes de falha'] });
    }
  }

  // Regra 3: cliente fiel (≥ 3 O.S.)
  if (orders.length >= 3 && !c.tags?.includes('VIP')) {
    ops.push({ icone: '⭐', titulo: `Cliente fiel com ${orders.length} atendimentos`, sugestoes: ['Oferecer desconto de fidelidade', 'Convidar para programa VIP', 'Enviar mensagem de agradecimento'] });
  }

  // Regra 4: inativo
  if (isInativo(c) && orders.length > 0) {
    ops.push({ icone: '📩', titulo: 'Sem atendimento há mais de 6 meses', sugestoes: ['Enviar mensagem de reativação', 'Oferecer promoção exclusiva', 'Perguntar sobre estado do aparelho'] });
  }

  // Regra 5: lead CRM não convertido
  const leadPendente = crmLeads.find(l => !l.osConvertido && l.status !== 'perdido' && l.status !== 'fechado');
  if (leadPendente) {
    ops.push({ icone: '🎯', titulo: 'Lead CRM sem conversão em O.S.', sugestoes: ['Fazer follow-up do orçamento', 'Verificar objeções do cliente', 'Oferecer alternativa de preço'] });
  }

  // Regra 6: aniversário próximo
  if (c.dataNascimento) {
    const hoje = new Date();
    const aniv = new Date(c.dataNascimento);
    aniv.setFullYear(hoje.getFullYear());
    const diasAteAniv = Math.round((aniv - hoje) / (1000 * 60 * 60 * 24));
    if (diasAteAniv >= 0 && diasAteAniv <= 30) {
      ops.push({ icone: '🎂', titulo: `Aniversário em ${diasAteAniv === 0 ? 'hoje' : diasAteAniv + ' dias'}`, sugestoes: ['Enviar mensagem de parabéns', 'Oferecer desconto de aniversário', 'Criar alerta para contato'] });
    }
  }

  // Regra 7: múltiplos aparelhos diferentes
  const modelos = [...new Set(orders.map(o => (o.model || '').split(' ')[0]).filter(Boolean))];
  if (modelos.length >= 2) {
    ops.push({ icone: '📲', titulo: `${modelos.length} aparelhos diferentes atendidos`, sugestoes: ['Cross-sell: acessórios para cada modelo', 'Pacote família ou empresa', 'Manutenção preventiva em todos'] });
  }

  if (!ops.length) {
    return `<div class="cli-op-empty">
      <span class="cli-op-icon">💡</span>
      <div>Nenhuma oportunidade identificada no momento.</div>
      <div class="cli-op-sub">Continue registrando atendimentos para análise automática.</div>
    </div>`;
  }

  return ops.map(op => `
    <div class="cli-op-card">
      <div class="cli-op-header">
        <span class="cli-op-icone">${op.icone}</span>
        <span class="cli-op-titulo">${esc(op.titulo)}</span>
      </div>
      <div class="cli-op-sugs">
        ${op.sugestoes.map(s => `<div class="cli-op-sug">💬 ${esc(s)}</div>`).join('')}
      </div>
    </div>`).join('');
}

// ── Tabs ───────────────────────────────────────────────────────────────
window.switchTab = function(tab) {
  document.querySelectorAll('.cli-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  ['dados','timeline','op','crm','os','equip'].forEach(t => {
    const el = document.getElementById(`cli-tab-${t}`);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
};

// ── Salvar edição ──────────────────────────────────────────────────────
window.salvarEdicao = async function(e, id) {
  e.preventDefault();
  const data = {};
  new FormData(e.target).forEach((v, k) => { data[k] = v.toString().trim(); });
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }
  try {
    await updateDoc(doc(db, 'clientes', id), { ...data, atualizadoEm: serverTimestamp() });
    showToast('✅ Cliente atualizado');
  } catch(err) { console.error(err); showToast('❌ Erro ao salvar'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar'; } }
};

// ── WhatsApp ───────────────────────────────────────────────────────────
window.abrirWhatsApp = function(id) {
  const c = clientes.find(x => x.id === id);
  if (!c) return;
  const tel = fone(c.whatsapp || c.phone);
  window.open(`https://wa.me/55${tel}?text=${encodeURIComponent('Olá, ' + c.name + '! 👋\n\nEntrando em contato da Cell City Informática.')}`, '_blank');
};

// ── Excluir ────────────────────────────────────────────────────────────
window.confirmarExclusao = function(id) {
  const c = clientes.find(x => x.id === id);
  if (!confirm(`Excluir o cadastro de ${c?.name || id}?\nEsta ação não pode ser desfeita.`)) return;
  deleteDoc(doc(db, 'clientes', id)).then(() => {
    clienteAtual = null;
    document.getElementById('cli-detalhe').style.display = 'none';
    document.getElementById('cli-detalhe-placeholder').style.display = '';
    showToast('🗑️ Cliente excluído');
  }).catch(() => showToast('❌ Erro ao excluir'));
};

// ── Tags ───────────────────────────────────────────────────────────────
window.adicionarTag = async function(id, tag) {
  const c = clientes.find(x => x.id === id);
  if (!c) return;
  const tags = [...new Set([...(c.tags || []), tag])];
  try {
    await updateDoc(doc(db, 'clientes', id), { tags, atualizadoEm: serverTimestamp() });
    showToast(`🏷️ "${tag}" adicionada`);
  } catch { showToast('❌ Erro ao adicionar tag'); }
};

window.removerTag = async function(id, tag) {
  const c = clientes.find(x => x.id === id);
  if (!c) return;
  const tags = (c.tags || []).filter(t => t !== tag);
  try {
    await updateDoc(doc(db, 'clientes', id), { tags, atualizadoEm: serverTimestamp() });
    showToast(`🏷️ "${tag}" removida`);
  } catch { showToast('❌ Erro ao remover tag'); }
};

window.addCustomTag = async function(id) {
  const tag = prompt('Digite a etiqueta personalizada:')?.trim();
  if (!tag) return;
  await adicionarTag(id, tag);
};

// ── Novo cliente ───────────────────────────────────────────────────────
window.abrirNovoCliente = function() {
  editingId = null;
  const form = document.getElementById('cli-form');
  if (!form) return;
  document.getElementById('cli-form-titulo').textContent = '🆕 Novo Cliente';
  ['cf-nome','cf-telefone','cf-whatsapp','cf-cpf','cf-rg','cf-email','cf-nascimento','cf-endereco','cf-obs']
    .forEach(fid => { const el = document.getElementById(fid); if (el) el.value = ''; });
  document.getElementById('cli-home-grid').style.display = 'none';
  document.getElementById('cli-workspace').style.display = 'none';
  form.style.display = '';
  document.getElementById('cf-nome')?.focus();
};

window.fecharForm = function() {
  const form = document.getElementById('cli-form');
  if (form) form.style.display = 'none';
  editingId = null;
  renderMainArea();
};

window.submitCliente = async function(e) {
  e.preventDefault();
  const nome = document.getElementById('cf-nome')?.value.trim();
  const tel  = document.getElementById('cf-telefone')?.value.trim();
  if (!nome || !tel) { showToast('⚠️ Nome e telefone são obrigatórios'); return; }

  const chave = fone(tel) || tel;
  const data  = {
    name:          nome,
    phone:         tel,
    whatsapp:      document.getElementById('cf-whatsapp')?.value.trim()   || '',
    cpf:           document.getElementById('cf-cpf')?.value.trim()        || '',
    rg:            document.getElementById('cf-rg')?.value.trim()         || '',
    email:         document.getElementById('cf-email')?.value.trim()      || '',
    dataNascimento:document.getElementById('cf-nascimento')?.value.trim() || '',
    endereco:      document.getElementById('cf-endereco')?.value.trim()   || '',
    obsCliente:    document.getElementById('cf-obs')?.value.trim()        || '',
    origem:        'clientes',
    history:       [],
    crmLeads:      [],
    tags:          [],
    createdAt:     new Date().toISOString(),
    atualizadoEm:  serverTimestamp()
  };

  const btn = document.querySelector('#cli-form button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }
  try {
    await setDoc(doc(db, 'clientes', chave), data);
    fecharForm();
    showToast('✅ Cliente cadastrado');
  } catch(err) { console.error(err); showToast('❌ Erro ao salvar'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar Cliente'; } }
};

// ── Navegação ──────────────────────────────────────────────────────────
window.navTo = function(view) {
  currentView  = view;
  clienteAtual = null;
  const detalhe = document.getElementById('cli-detalhe');
  const ph      = document.getElementById('cli-detalhe-placeholder');
  if (detalhe) detalhe.style.display = 'none';
  if (ph)      ph.style.display      = '';
  renderAll();
  document.getElementById('cli-sb')?.classList.remove('open');
  document.getElementById('cli-sb-overlay')?.classList.remove('open');
};

window.toggleSb = function() {
  document.getElementById('cli-sb')?.classList.toggle('open');
  document.getElementById('cli-sb-overlay')?.classList.toggle('open');
};

window.onSearch = function(val) {
  searchQuery = val;
  if (['__home__', '__dashboard__', '__ranking__'].includes(currentView)) navTo('__lista__');
  else renderLista();
};

// ── Toast ──────────────────────────────────────────────────────────────
let _tt = null;
function showToast(msg) {
  const el = document.getElementById('cli-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove('show'), 2600);
}

// ── Equipamentos ──────────────────────────────────────────────────────
function calcScore(osVinc) {
  if (!osVinc.length) return null;
  const count    = osVinc.length;
  const defects  = osVinc.map(o => (o.defect || '').toLowerCase().substring(0, 30).trim()).filter(Boolean);
  const reincide = defects.length > 1 && new Set(defects).size < defects.length;
  if (count > 5 || reincide) return { label: '🔴 Crítico',   cls: 'score-critico'   };
  if (count >= 3)             return { label: '🟡 Atenção',   cls: 'score-atencao'   };
  return                             { label: '🟢 Excelente', cls: 'score-excelente' };
}

function calcInteligencia(osVinc, eq) {
  const hasVendas = (eq.vendasCount || 0) > 0;
  if (!osVinc.length && !hasVendas) return null;

  // Retornos: OS consecutivas com intervalo < 30 dias (lista sorted desc)
  let retornos = 0;
  for (let i = 1; i < osVinc.length; i++) {
    const gap = (new Date(osVinc[i - 1].createdAt) - new Date(osVinc[i].createdAt)) / 864e5;
    if (gap >= 0 && gap < 30) retornos++;
  }
  const taxaRetorno = osVinc.length > 0 ? Math.round(retornos / osVinc.length * 100) : 0;

  // Ticket acumulado (OS + acessórios)
  const totalOS    = osVinc.reduce((s, o) => s + (parseFloat(o.valor) || 0) + (parseFloat(o.valorCartao) || 0), 0);
  const ticket     = totalOS + (eq.vendasTotal || 0);

  // Sugestões baseadas em defeitos e histórico de compras
  const cats    = (eq.vendasCategorias || []).map(c => c.toLowerCase());
  const defects = osVinc.map(o => (o.defect || '').toLowerCase());
  const diasSem = osVinc[0]?.createdAt ? Math.round((Date.now() - new Date(osVinc[0].createdAt)) / 864e5) : 999;
  const sugs = [];
  if (!cats.some(c => c.includes('película') || c.includes('pelicula'))) sugs.push('Oferecer película');
  if (!cats.some(c => c.includes('capinha') || c.includes('capa')))      sugs.push('Oferecer capinha');
  if (defects.some(d => d.includes('bateria') || d.includes('carregamento')))          sugs.push('Verificar bateria');
  else if (diasSem > 180)                                                               sugs.push('Revisão preventiva');
  if (defects.some(d => d.includes('carregad') || d.includes('cabo')) &&
      !cats.some(c => c.includes('carregad') || c.includes('cabo')))                   sugs.push('Oferecer carregador');

  return {
    retornos,
    taxaRetorno,
    ticket,
    vip:       ticket >= 2000,
    sugestoes: sugs.slice(0, 3)
  };
}

function buildEquipamentosHtml(clienteId, equipamentos, orders = [], clientePhone = '') {
  const catIcon   = c => ({ Celular:'📱', Notebook:'💻', Tablet:'📟', Smartwatch:'⌚', TV:'📺' }[c] || '📦');
  const statusCls = s => ({ 'Ativo':'equip-s-ativo', 'Em manutenção':'equip-s-manut', 'Vendido':'equip-s-vendido', 'Inativo':'equip-s-inativo' }[s] || 'equip-s-ativo');
  const foneNum   = (clientePhone || '').replace(/\D/g, '');

  function matchOS(eq) {
    return orders.filter(o => {
      if (o.equipamentoId && o.equipamentoId === eq.id) return true;
      if (!eq.modelo) return false;
      const phoneOk = (o.phone || '').replace(/\D/g, '') === foneNum;
      const modelOk = (o.model || '').toLowerCase().trim() === (eq.modelo || '').toLowerCase().trim();
      return phoneOk && modelOk;
    }).sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);
  }

  const cardsHtml = equipamentos.map(eq => {
    const nomeRaw  = ((eq.marca || '') + ' ' + (eq.modelo || '')).trim();
    const nome     = esc(nomeRaw) || 'Equipamento';
    const osVinc   = matchOS(eq);
    const ultimaOS = osVinc[0];
    const score    = calcScore(osVinc);
    const intel    = calcInteligencia(osVinc, eq);
    equipOSCache[eq.id] = osVinc;

    // totais financeiros
    const totalOS = osVinc.reduce((s, o) => s + (parseFloat(o.valor) || 0) + (parseFloat(o.valorCartao) || 0), 0);

    // garantia
    let garantiaHtml = '';
    if (ultimaOS && ultimaOS.createdAt) {
      const prazo  = parseInt(ultimaOS.prazoGarantia) || 90;
      const dataOS = new Date(ultimaOS.createdAt);
      const expiry = new Date(dataOS.getTime() + prazo * 864e5);
      const dias   = Math.round((expiry - Date.now()) / 864e5);
      if (dias > 0) {
        garantiaHtml = `<div class="cli-equip-detail"><span class="cli-equip-dlabel">Garantia</span><span class="cli-equip-garantia-ok">✅ Em garantia · ${dias}d</span></div>`;
      } else {
        garantiaHtml = `<div class="cli-equip-detail"><span class="cli-equip-dlabel">Garantia</span><span class="cli-equip-garantia-exp">⚠️ Expirada</span></div>`;
      }
    }

    // OS expandível
    const osListHtml = osVinc.map(o => `
      <div class="cli-equip-os-item">
        <div class="cli-equip-os-id">${esc(o.id)}</div>
        <div class="cli-equip-os-body">
          <div class="cli-equip-os-servico">${esc((o.defect || '').substring(0, 55))}</div>
          <div class="cli-equip-os-meta">${fmtDate(o.createdAt)}${o.valor ? ` · ${fmtValor(o.valor)}` : ''} · ${esc(o.status || '')}</div>
        </div>
      </div>`).join('');

    return `
    <div class="cli-equip-card">
      <div class="cli-equip-card-header">
        <span class="cli-equip-cat-icon">${catIcon(eq.categoria)}</span>
        <div class="cli-equip-card-title">
          <span class="cli-equip-card-name">${nome}</span>
          <span class="cli-equip-status ${statusCls(eq.status)}">${esc(eq.status || 'Ativo')}</span>
        </div>
        ${score ? `<span class="cli-equip-score cli-equip-${score.cls}">${score.label}</span>` : ''}
      </div>
      <div class="cli-equip-card-body">
        ${eq.categoria  ? `<div class="cli-equip-detail"><span class="cli-equip-dlabel">Categoria</span><span>${esc(eq.categoria)}</span></div>` : ''}
        ${eq.cor        ? `<div class="cli-equip-detail"><span class="cli-equip-dlabel">Cor</span><span>${esc(eq.cor)}</span></div>` : ''}
        ${eq.imei       ? `<div class="cli-equip-detail"><span class="cli-equip-dlabel">IMEI</span><span class="cli-equip-imei">${esc(eq.imei)}</span></div>` : ''}
        ${eq.serial     ? `<div class="cli-equip-detail"><span class="cli-equip-dlabel">Serial</span><span>${esc(eq.serial)}</span></div>` : ''}
        <div class="cli-equip-detail">
          <span class="cli-equip-dlabel">Serviços</span>
          <span class="${osVinc.length ? 'cli-equip-os-badge' : ''}">${osVinc.length > 0 ? `🔧 ${osVinc.length}` : '—'}</span>
        </div>
        ${ultimaOS ? `<div class="cli-equip-detail"><span class="cli-equip-dlabel">Último</span><span>${fmtDate(ultimaOS.createdAt)}</span></div>` : ''}
        ${ultimaOS ? `<div class="cli-equip-detail"><span class="cli-equip-dlabel">Última OS</span><span class="cli-equip-os-ref">${esc(ultimaOS.id)}</span></div>` : ''}
        ${totalOS > 0 ? `<div class="cli-equip-detail"><span class="cli-equip-dlabel">Investido</span><span class="cli-equip-total">${fmtValor(totalOS)}</span></div>` : ''}
        ${garantiaHtml}
        ${eq.vendasCount > 0 ? `
        <div class="cli-equip-detail"><span class="cli-equip-dlabel">📦 Produtos</span><span>${eq.vendasCount} compra${eq.vendasCount !== 1 ? 's' : ''}</span></div>
        <div class="cli-equip-detail"><span class="cli-equip-dlabel">Em acessórios</span><span class="cli-equip-total">${fmtValor(eq.vendasTotal || 0)}</span></div>` : ''}
        ${eq.observacoes ? `<div class="cli-equip-obs">${esc(eq.observacoes)}</div>` : ''}
      </div>
      ${intel ? `
      <div class="cli-equip-intel">
        <div class="cli-equip-intel-hd">📊 Inteligência</div>
        <div class="cli-equip-intel-grid">
          <span class="cli-equip-intel-lbl">💰 Ticket Total</span>
          <span class="cli-equip-intel-val">${fmtValor(intel.ticket)}</span>
          ${intel.retornos > 0 ? `<span class="cli-equip-intel-lbl">🔁 Taxa Retorno</span><span class="cli-equip-intel-val${intel.taxaRetorno >= 40 ? ' cli-equip-intel-alerta' : ''}">${intel.retornos} retorno${intel.retornos > 1 ? 's' : ''} · ${intel.taxaRetorno}%</span>` : ''}
        </div>
        ${intel.vip ? `<div class="cli-equip-vip">⭐ Cliente VIP neste equipamento</div>` : ''}
        ${intel.sugestoes.length ? `<div class="cli-equip-sugestoes">${intel.sugestoes.map(s => `<span class="cli-equip-sug">💡 ${s}</span>`).join('')}</div>` : ''}
      </div>` : ''}
      ${osVinc.length ? `
      <div class="cli-equip-os-section" id="cli-equip-os-${esc(eq.id)}" style="display:none">
        <div class="cli-equip-os-list">${osListHtml}</div>
      </div>` : ''}
      <div class="cli-equip-card-actions">
        ${osVinc.length ? `<button class="cli-equip-btn-os" onclick="toggleEquipOS('${esc(eq.id)}')">🔧 ${osVinc.length} OS</button>` : ''}
        <button class="cli-equip-btn-nova-os" onclick="novaOSParaEquip('${esc(clienteId)}','${esc(eq.id)}','${esc(nomeRaw)}')">➕ OS</button>
        <button class="cli-equip-btn-hist" onclick="abrirHistoricoEquip('${esc(clienteId)}','${esc(eq.id)}','${esc(nomeRaw)}')">⏱️ Timeline</button>
        <button class="cli-equip-btn-edit" onclick="abrirModalEquipamento('${esc(clienteId)}','${esc(eq.id)}')">✏️</button>
        <button class="cli-equip-btn-del"  onclick="excluirEquipamento('${esc(clienteId)}','${esc(eq.id)}')">🗑️</button>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="cli-equip-wrap">
      <div class="cli-equip-topbar">
        <span class="cli-equip-count">${equipamentos.length} equipamento${equipamentos.length !== 1 ? 's' : ''}</span>
        <button class="cli-equip-btn-add" onclick="abrirModalEquipamento('${esc(clienteId)}')">➕ Adicionar</button>
      </div>
      ${equipamentos.length
        ? `<div class="cli-equip-cards">${cardsHtml}</div>`
        : `<div class="cli-hist-vazio">Nenhum equipamento cadastrado.<br><small style="color:var(--text3)">Clique em "Adicionar" para começar.</small></div>`}
    </div>`;
}

function openEquipModal(html) {
  let overlay = document.getElementById('cli-equip-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'cli-equip-overlay';
    overlay.className = 'cli-equip-overlay';
    overlay.onclick = e => { if (e.target === overlay) closeEquipModal(); };
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div class="cli-equip-modal-box">${html}</div>`;
  overlay.classList.add('active');
  setTimeout(() => overlay.querySelector('input:not([type="date"]), select, textarea')?.focus(), 80);
}

window.toggleEquipOS = function(equipId) {
  const el = document.getElementById(`cli-equip-os-${equipId}`);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
};

window.novaOSParaEquip = function(clienteId, equipId, equipNome) {
  const c = clientes.find(x => x.id === clienteId);
  const eq = (equipamentosCache[clienteId] || []).find(e => e.id === equipId);
  sessionStorage.setItem('cc_equip_prefill', JSON.stringify({
    clienteId,
    equipamentoId: equipId,
    nome:     c?.name     || '',
    telefone: c?.phone    || '',
    marca:    eq?.marca   || '',
    modelo:   eq?.modelo  || equipNome || '',
    imei:     eq?.imei    || ''
  }));
  window.location.href = '../../pages/os/index.html';
};

window.closeEquipModal = function() {
  document.getElementById('cli-equip-overlay')?.classList.remove('active');
};

window.abrirModalEquipamento = function(clienteId, equipId) {
  const eq       = equipId ? (equipamentosCache[clienteId] || []).find(e => e.id === equipId) : null;
  const cats     = ['Celular', 'Notebook', 'Tablet', 'Smartwatch', 'TV', 'Outro'];
  const statuses = ['Ativo', 'Em manutenção', 'Vendido', 'Inativo'];
  const catOpts  = cats.map(c => `<option value="${c}"${eq?.categoria === c ? ' selected' : ''}>${c}</option>`).join('');
  const stOpts   = statuses.map(s => `<option value="${s}"${(eq?.status || 'Ativo') === s ? ' selected' : ''}>${s}</option>`).join('');

  openEquipModal(`
    <div class="cli-equip-modal-header">
      <span>${equipId ? '✏️ Editar' : '➕ Novo'} Equipamento</span>
      <button class="cli-equip-modal-close" onclick="closeEquipModal()">✕</button>
    </div>
    <form onsubmit="salvarEquipamento(event,'${esc(clienteId)}','${esc(equipId||'')}')" class="cli-equip-form">
      <div class="cli-equip-form-grid">
        <div class="cli-edit-field">
          <label>Categoria</label>
          <select name="categoria">${catOpts}</select>
        </div>
        <div class="cli-edit-field">
          <label>Status</label>
          <select name="status">${stOpts}</select>
        </div>
        <div class="cli-edit-field">
          <label>Marca</label>
          <input type="text" name="marca" value="${esc(eq?.marca||'')}" placeholder="Samsung, Apple, Dell...">
        </div>
        <div class="cli-edit-field">
          <label>Modelo</label>
          <input type="text" name="modelo" value="${esc(eq?.modelo||'')}" placeholder="Galaxy A54, iPhone 13...">
        </div>
        <div class="cli-edit-field">
          <label>IMEI</label>
          <input type="text" name="imei" value="${esc(eq?.imei||'')}" placeholder="000000000000000" inputmode="numeric">
        </div>
        <div class="cli-edit-field">
          <label>Serial Number</label>
          <input type="text" name="serial" value="${esc(eq?.serial||'')}" placeholder="SN-XXXX">
        </div>
        <div class="cli-edit-field">
          <label>Cor</label>
          <input type="text" name="cor" value="${esc(eq?.cor||'')}" placeholder="Preto, Branco, Dourado...">
        </div>
        <div class="cli-edit-field cli-span2">
          <label>Observações</label>
          <textarea name="observacoes" rows="3" placeholder="Defeitos recorrentes, senha de tela, acessórios entregues...">${esc(eq?.observacoes||'')}</textarea>
        </div>
      </div>
      <div class="cli-edit-btns">
        <button type="submit" class="cli-btn-salvar">💾 Salvar</button>
        <button type="button" class="cli-btn-cancelar" onclick="closeEquipModal()">Cancelar</button>
      </div>
    </form>`);
};

window.salvarEquipamento = async function(e, clienteId, equipId) {
  e.preventDefault();
  const data = {};
  new FormData(e.target).forEach((v, k) => { data[k] = v.toString().trim(); });
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }
  try {
    if (equipId) {
      await updateDoc(doc(db, 'clientes', clienteId, 'equipamentos', equipId), { ...data, atualizadoEm: serverTimestamp() });
    } else {
      const ref = doc(collection(db, 'clientes', clienteId, 'equipamentos'));
      await setDoc(ref, { ...data, dataCadastro: serverTimestamp() });
    }
    closeEquipModal();
    showToast(equipId ? '✅ Equipamento atualizado' : '✅ Equipamento cadastrado');
    await window.abrirCliente(clienteId);
    window.switchTab('equip');
  } catch(err) {
    console.error(err);
    showToast('❌ Erro ao salvar equipamento');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar'; }
  }
};

window.excluirEquipamento = async function(clienteId, equipId) {
  if (!confirm('Excluir este equipamento? Esta ação não pode ser desfeita.')) return;
  try {
    await deleteDoc(doc(db, 'clientes', clienteId, 'equipamentos', equipId));
    showToast('🗑️ Equipamento excluído');
    await window.abrirCliente(clienteId);
    window.switchTab('equip');
  } catch(err) {
    console.error(err);
    showToast('❌ Erro ao excluir');
  }
};

async function recarregarListaHistorico(clienteId, equipId) {
  const listEl = document.getElementById('equip-hist-list');
  const loadEl = document.getElementById('equip-hist-loading');
  const totEl  = document.getElementById('equip-hist-total');
  if (!listEl) return;
  if (loadEl) { loadEl.style.display = ''; loadEl.textContent = '⏳ Carregando...'; }
  listEl.style.display = 'none';
  try {
    // busca historico manual + vendas em paralelo
    const [histSnap, vendasSnap] = await Promise.all([
      getDocs(collection(db, 'clientes', clienteId, 'equipamentos', equipId, 'historico')),
      getDocs(collection(db, 'clientes', clienteId, 'equipamentos', equipId, 'vendas'))
    ]);
    const histItems   = histSnap.docs.map(d => ({ id: d.id, ...d.data(), _src: 'manual' }));
    const vendasItems = vendasSnap.docs.map(d => ({
      id: d.id, ...d.data(),
      tipo:      d.data().produto,
      descricao: d.data().categoria || '',
      _src:      'venda'
    }));

    // converte OS do cache para formato unificado
    const osItems = (equipOSCache[equipId] || []).map(o => ({
      tipo:      o.defect || 'Serviço realizado',
      descricao: `${o.id}${o.model ? ' — ' + o.model : ''}`,
      valor:     (parseFloat(o.valor) || 0) + (parseFloat(o.valorCartao) || 0),
      data:      o.createdAt ? new Date(o.createdAt) : null,
      origemOS:  o.id,
      _src:      'os'
    })).filter(o => o.data);

    // merge e ordena por data desc
    function toDate(d) {
      if (!d) return new Date(0);
      if (d.toDate) return d.toDate();
      if (d instanceof Date) return d;
      return new Date(d);
    }
    const all = [...histItems, ...vendasItems, ...osItems]
      .map(h => ({ ...h, _d: toDate(h.data) }))
      .sort((a, b) => b._d - a._d);

    // total consolidado (OS + histórico + vendas)
    const totalGeral = all.reduce((s, h) => s + (parseFloat(h.valor) || 0), 0);

    if (loadEl) loadEl.style.display = 'none';
    listEl.style.display = '';
    if (totEl && totalGeral > 0) {
      totEl.textContent = `Total registrado: ${fmtValor(totalGeral)}`;
      totEl.style.display = '';
    }

    listEl.innerHTML = all.length
      ? all.map(h => `
          <div class="cli-equip-hist-item cli-equip-hist-${h._src}">
            <div class="cli-equip-hist-left">
              <div class="cli-equip-hist-data">${fmtDate(h._d)}</div>
              <div class="cli-equip-hist-badge-${h._src}">${h._src === 'os' ? '🔧 OS' : h._src === 'venda' ? '📦' : '📝'}</div>
            </div>
            <div class="cli-equip-hist-body">
              <div class="cli-equip-hist-tipo">${esc(h.tipo || '')}</div>
              ${h.descricao ? `<div class="cli-equip-hist-desc">${esc(h.descricao)}</div>` : ''}
              ${h.valor > 0 ? `<div class="cli-equip-hist-valor">${fmtValor(Number(h.valor))}</div>` : ''}
            </div>
          </div>`).join('')
      : '<div class="cli-hist-vazio" style="padding:12px 0">Nenhum evento registrado ainda.</div>';
  } catch(err) {
    console.error(err);
    if (loadEl) { loadEl.style.display = ''; loadEl.textContent = 'Erro ao carregar histórico.'; }
  }
}

window.abrirHistoricoEquip = async function(clienteId, equipId, equipNome) {
  openEquipModal(`
    <div class="cli-equip-modal-header">
      <span>⏱️ Timeline — ${esc(equipNome || 'Equipamento')}</span>
      <button class="cli-equip-modal-close" onclick="closeEquipModal()">✕</button>
    </div>
    <div id="equip-hist-total" class="cli-equip-hist-total" style="display:none"></div>
    <div id="equip-hist-loading" style="padding:20px;text-align:center;color:var(--text3)">⏳ Carregando...</div>
    <div id="equip-hist-list" class="cli-equip-hist-list" style="display:none"></div>
    <div class="cli-equip-form-tabs">
      <button class="cli-equip-form-tab active" onclick="switchHistTab('evento',this)">📝 Evento Manual</button>
      <button class="cli-equip-form-tab"        onclick="switchHistTab('venda',this)">📦 Produto / Venda</button>
    </div>
    <div id="hist-tab-evento" class="cli-equip-hist-form">
      <form onsubmit="addHistoricoEquip(event,'${esc(clienteId)}','${esc(equipId)}')">
        <div class="cli-equip-form-grid">
          <div class="cli-edit-field cli-span2">
            <label>Tipo / Serviço</label>
            <input type="text" name="tipo" placeholder="Troca de Tela, Bateria, Diagnóstico..." required>
          </div>
          <div class="cli-edit-field cli-span2">
            <label>Descrição</label>
            <input type="text" name="descricao" placeholder="Detalhes do serviço realizado">
          </div>
          <div class="cli-edit-field">
            <label>Valor (R$)</label>
            <input type="number" name="valor" step="0.01" min="0" placeholder="0,00">
          </div>
          <div class="cli-edit-field">
            <label>Data</label>
            <input type="date" name="data" value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        <div class="cli-edit-btns">
          <button type="submit" class="cli-btn-salvar">📝 Registrar</button>
        </div>
      </form>
    </div>
    <div id="hist-tab-venda" class="cli-equip-hist-form" style="display:none">
      <form onsubmit="adicionarVendaEquip(event,'${esc(clienteId)}','${esc(equipId)}')">
        <div class="cli-equip-form-grid">
          <div class="cli-edit-field cli-span2">
            <label>Produto</label>
            <input type="text" name="produto" placeholder="Película 3D, Capinha, Carregador..." required>
          </div>
          <div class="cli-edit-field">
            <label>Categoria</label>
            <select name="categoria">
              <option>Película</option><option>Capinha</option><option>Carregador</option>
              <option>Cabo</option><option>Fone</option><option>Suporte</option><option>Outro Acessório</option>
            </select>
          </div>
          <div class="cli-edit-field">
            <label>Valor (R$)</label>
            <input type="number" name="valor" step="0.01" min="0" placeholder="0,00">
          </div>
          <div class="cli-edit-field cli-span2">
            <label>Data</label>
            <input type="date" name="data" value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        <div class="cli-edit-btns">
          <button type="submit" class="cli-btn-salvar">📦 Registrar Produto</button>
        </div>
      </form>
    </div>`);
  await recarregarListaHistorico(clienteId, equipId);
};

window.switchHistTab = function(tab, btn) {
  ['evento', 'venda'].forEach(t => {
    const el = document.getElementById(`hist-tab-${t}`);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
  document.querySelectorAll('.cli-equip-form-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

window.adicionarVendaEquip = async function(e, clienteId, equipId) {
  e.preventDefault();
  const data = {};
  new FormData(e.target).forEach((v, k) => { data[k] = v.toString().trim(); });
  if (!data.produto) return;
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
  try {
    const ref = doc(collection(db, 'clientes', clienteId, 'equipamentos', equipId, 'vendas'));
    const valor = data.valor ? Number(data.valor) : 0;
    await setDoc(ref, {
      produto:   data.produto,
      categoria: data.categoria || 'Outro Acessório',
      valor,
      data:      data.data ? new Date(data.data + 'T12:00:00') : new Date(),
      criadoEm:  serverTimestamp()
    });
    await updateDoc(doc(db, 'clientes', clienteId, 'equipamentos', equipId), {
      vendasCount:       increment(1),
      vendasTotal:       increment(valor),
      vendasCategorias:  arrayUnion(data.categoria || 'Outro Acessório')
    });
    showToast('✅ Produto registrado');
    e.target.reset();
    e.target.querySelector('[name="data"]').value = new Date().toISOString().split('T')[0];
    await recarregarListaHistorico(clienteId, equipId);
  } catch(err) {
    console.error(err);
    showToast('❌ Erro ao registrar produto');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📦 Registrar Produto'; }
  }
};

window.addHistoricoEquip = async function(e, clienteId, equipId) {
  e.preventDefault();
  const data = {};
  new FormData(e.target).forEach((v, k) => { data[k] = v.toString().trim(); });
  if (!data.tipo) return;
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
  try {
    const ref = doc(collection(db, 'clientes', clienteId, 'equipamentos', equipId, 'historico'));
    await setDoc(ref, {
      tipo:      data.tipo,
      descricao: data.descricao || '',
      valor:     data.valor ? Number(data.valor) : null,
      data:      data.data ? new Date(data.data + 'T12:00:00') : new Date(),
      criadoEm:  serverTimestamp()
    });
    showToast('✅ Evento registrado');
    e.target.reset();
    e.target.querySelector('[name="data"]').value = new Date().toISOString().split('T')[0];
    await recarregarListaHistorico(clienteId, equipId);
  } catch(err) {
    console.error(err);
    showToast('❌ Erro ao registrar');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📝 Registrar'; }
  }
};

// ── Init ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  navTo('__home__');
  startListener();
  document.getElementById('cli-sb-overlay')?.addEventListener('click', () => {
    document.getElementById('cli-sb')?.classList.remove('open');
    document.getElementById('cli-sb-overlay')?.classList.remove('open');
  });
});
