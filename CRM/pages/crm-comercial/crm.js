import {
  db, collection, addDoc, doc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp
} from '../../scripts/firebase.js';

// ── Config de status ───────────────────────────────────────────
const STATUS = [
  { key: 'novo_contato',        label: 'Novo Contato',        icon: '🆕', dotColor: '#60a5fa',  badgeClass: 'crm-badge-novo' },
  { key: 'orcamento_enviado',   label: 'Orçamento Enviado',   icon: '📤', dotColor: '#fbbf24',  badgeClass: 'crm-badge-enviado' },
  { key: 'aguardando_resposta', label: 'Aguardando Resposta', icon: '⏳', dotColor: '#a78bfa',  badgeClass: 'crm-badge-aguardando' },
  { key: 'negociacao',          label: 'Negociação',          icon: '🤝', dotColor: '#fb923c',  badgeClass: 'crm-badge-negociacao' },
  { key: 'fechado',             label: 'Fechado',             icon: '✅', dotColor: '#00c853',  badgeClass: 'crm-badge-fechado' },
  { key: 'perdido',             label: 'Perdido',             icon: '❌', dotColor: '#f87171',  badgeClass: 'crm-badge-perdido' }
];

function getStatus(key) { return STATUS.find(s => s.key === key) || STATUS[0]; }

// ── Estado ────────────────────────────────────────────────────
let leads       = [];
let currentView = '__home__'; // '__home__' | status.key | '__hist__' | '__todos__'
let currentLead = null;
let editingId   = null;
let searchQuery = '';
let unsub       = null;

// ── Firestore ────────────────────────────────────────────────
function startListener() {
  if (unsub) unsub();
  const q = query(collection(db, 'crm_leads'), orderBy('criadoEm', 'desc'));
  unsub = onSnapshot(q, snap => {
    leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  }, err => console.warn('CRM snapshot:', err));
}

async function persistLead(data) {
  if (editingId) {
    await updateDoc(doc(db, 'crm_leads', editingId), { ...data, atualizadoEm: serverTimestamp() });
  } else {
    await addDoc(collection(db, 'crm_leads'), {
      ...data,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
  }
}

async function setStatus(id, key) {
  await updateDoc(doc(db, 'crm_leads', id), { status: key, atualizadoEm: serverTimestamp() });
}

async function removeLead(id) {
  await deleteDoc(doc(db, 'crm_leads', id));
}

// ── Contagens ────────────────────────────────────────────────
function count(key) {
  if (key === '__todos__') return leads.length;
  if (key === '__hist__')  return leads.filter(l => l.osConvertido).length;
  return leads.filter(l => l.status === key).length;
}

// ── Filtro / busca ───────────────────────────────────────────
function getFiltered() {
  let list = leads;

  if (currentView === '__hist__') {
    list = list.filter(l => l.osConvertido);
  } else if (currentView !== '__todos__' && currentView !== '__home__') {
    list = list.filter(l => l.status === currentView);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    list = list.filter(l =>
      (l.nome     || '').toLowerCase().includes(q) ||
      (l.telefone || '').includes(q) ||
      (l.aparelho || '').toLowerCase().includes(q) ||
      (l.servico  || '').toLowerCase().includes(q)
    );
  }

  return list;
}

// ── Formatação ───────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtValor(v) {
  if (!v && v !== 0) return '';
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

// ── Render geral ─────────────────────────────────────────────
function renderAll() {
  renderSidebar();
  renderMainArea();
}

// ── Sidebar interna ──────────────────────────────────────────
function renderSidebar() {
  const sb = document.getElementById('crm-sb-cats');
  if (!sb) return;

  // Atualiza contadores especiais
  const el = (id) => document.getElementById(id);
  if (el('crm-sb-count-all'))  el('crm-sb-count-all').textContent  = leads.length;
  if (el('crm-sb-count-hist')) el('crm-sb-count-hist').textContent = count('__hist__');

  // Itens fixos: atualizar estado active
  document.querySelectorAll('.crm-sb-item[data-view]').forEach(item => {
    item.classList.toggle('active', item.dataset.view === currentView);
  });

  // Itens de status com contadores
  sb.innerHTML = STATUS.map(s => {
    const n = count(s.key);
    const active = currentView === s.key ? 'active' : '';
    return `<div class="crm-sb-item ${active}" data-view="${s.key}" onclick="navTo('${s.key}')">
      <span class="crm-sb-icon">${s.icon}</span>
      <span class="crm-sb-label">${s.label}</span>
      <span class="crm-sb-count">${n}</span>
    </div>`;
  }).join('');
}

// ── Área principal ───────────────────────────────────────────
function renderMainArea() {
  const titulo = document.getElementById('crm-main-titulo');
  const homeGrid = document.getElementById('crm-home-grid');
  const listaArea = document.getElementById('crm-lista-area');
  const formEl = document.getElementById('crm-form');
  const detalheEl = document.getElementById('crm-detalhe');

  // Esconde form e detalhe se não estão ativos
  if (formEl && !formEl.classList.contains('ativo')) formEl.style.display = '';
  if (detalheEl && !detalheEl.classList.contains('ativo')) detalheEl.style.display = '';

  if (currentView === '__home__') {
    if (titulo) titulo.textContent = '🎯 CRM Comercial';
    if (homeGrid)  homeGrid.style.display = '';
    if (listaArea) listaArea.style.display = 'none';
    renderHomeGrid();
    renderPainelStats();
  } else {
    const st = STATUS.find(s => s.key === currentView);
    const viewLabel = currentView === '__todos__' ? '📂 Todos os leads'
                    : currentView === '__hist__'  ? '📋 Histórico — convertidos em O.S.'
                    : `${st?.icon || ''} ${st?.label || currentView}`;
    if (titulo) titulo.textContent = viewLabel;
    if (homeGrid)  homeGrid.style.display = 'none';
    if (listaArea) listaArea.style.display = '';
    renderLista();
  }
}

// ── Home Grid ────────────────────────────────────────────────
function renderHomeGrid() {
  const grid = document.getElementById('crm-home-grid');
  if (!grid) return;

  const cards = STATUS.map(s => {
    const n = count(s.key);
    const countClass = n === 0 ? 'crm-home-count crm-home-count-zero' : 'crm-home-count';
    return `<div class="crm-home-block" data-status="${s.key}" onclick="navTo('${s.key}')">
      <span class="crm-home-icon">${s.icon}</span>
      <span class="crm-home-nome">${s.label}</span>
      <span class="${countClass}">${n}</span>
    </div>`;
  });

  const nHist = count('__hist__');
  cards.push(`<div class="crm-home-block crm-hist-block" onclick="navTo('__hist__')">
    <span class="crm-home-icon">📋</span>
    <span class="crm-home-nome">Histórico</span>
    <span class="crm-home-count" style="color:var(--cell-gold);background:rgba(255,204,0,0.12)">${nHist}</span>
  </div>`);

  cards.push(`<div class="crm-home-block" onclick="togglePanel('crm-panel-stats')">
    <span class="crm-home-icon">📊</span>
    <span class="crm-home-nome">Estatísticas</span>
    <span class="crm-home-count">${leads.length}</span>
  </div>`);

  grid.innerHTML = cards.join('');
}

// ── Painel de stats ──────────────────────────────────────────
function renderPainelStats() {
  const grid = document.getElementById('crm-stats-grid-inner');
  if (!grid) return;

  const total    = leads.length;
  const abertos  = leads.filter(l => !['fechado','perdido'].includes(l.status)).length;
  const fechados = leads.filter(l => l.status === 'fechado').length;
  const perdidos = leads.filter(l => l.status === 'perdido').length;
  const histN    = count('__hist__');

  grid.innerHTML = `
    <div class="crm-stat-item" onclick="navTo('__todos__')">
      <span class="crm-stat-num">${total}</span>
      <span class="crm-stat-label">Total</span>
    </div>
    <div class="crm-stat-item" onclick="navTo('__todos__')">
      <span class="crm-stat-num crm-stat-azul">${abertos}</span>
      <span class="crm-stat-label">Em andamento</span>
    </div>
    <div class="crm-stat-item" onclick="navTo('fechado')">
      <span class="crm-stat-num crm-stat-verde">${fechados}</span>
      <span class="crm-stat-label">Fechados</span>
    </div>
    <div class="crm-stat-item" onclick="navTo('perdido')">
      <span class="crm-stat-num crm-stat-vermelho">${perdidos}</span>
      <span class="crm-stat-label">Perdidos</span>
    </div>
    <div class="crm-stat-item" onclick="navTo('__hist__')">
      <span class="crm-stat-num crm-stat-amarelo">${histN}</span>
      <span class="crm-stat-label">Em O.S.</span>
    </div>
  `;
}

// ── Lista de leads ───────────────────────────────────────────
function renderLista() {
  const container = document.getElementById('crm-lista');
  const empty     = document.getElementById('crm-empty');
  if (!container) return;

  const list = getFiltered();

  if (!list.length) {
    container.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  container.innerHTML = list.map(lead => {
    const st = getStatus(lead.status);
    const valor = lead.valor ? fmtValor(lead.valor) : '';
    const info  = [lead.aparelho, lead.servico].filter(Boolean).join(' — ');
    const hist  = lead.osConvertido ? '<span class="crm-badge crm-badge-fechado" style="margin-left:4px">🔧 O.S.</span>' : '';
    return `<div class="crm-card" data-status="${lead.status}" onclick="abrirDetalhe('${lead.id}')">
      <div class="crm-card-top">
        <span class="crm-card-icon">${st.icon}</span>
        <div class="crm-card-main">
          <div class="crm-card-nome">${lead.nome || '—'}</div>
          <div class="crm-card-meta">
            <span class="crm-badge ${st.badgeClass}">${st.label}</span>
            ${hist}
            <span class="crm-card-date">${fmtDate(lead.criadoEm)}</span>
            ${valor ? `<span class="crm-card-valor">💰 ${valor}</span>` : ''}
          </div>
          ${info ? `<div class="crm-card-info">${info}</div>` : ''}
          ${lead.telefone ? `<div class="crm-card-info" style="color:var(--text-tertiary)">📞 ${lead.telefone}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Detalhe do lead ──────────────────────────────────────────
window.abrirDetalhe = function(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  currentLead = lead;
  fecharForm();

  const el = document.getElementById('crm-detalhe');
  if (!el) return;

  const st = getStatus(lead.status);
  const valor = lead.valor ? fmtValor(lead.valor) : '—';
  const isFechado = lead.status === 'fechado';

  const statusOpts = STATUS.map(s => `
    <div class="crm-status-opt ${lead.status === s.key ? 'selected' : ''}"
         onclick="alterarStatus('${lead.id}','${s.key}')">
      <span class="dot" style="background:${s.dotColor}"></span>
      ${s.icon} ${s.label}
    </div>`).join('');

  el.innerHTML = `
    <div class="crm-detalhe-topo">
      <div>
        <div class="crm-detalhe-nome">${lead.nome || '—'}</div>
        <div class="crm-detalhe-phone">📞 ${lead.telefone || '—'}</div>
      </div>
      <span class="crm-badge ${st.badgeClass}" style="font-size:12px;padding:4px 10px">${st.label}</span>
    </div>

    <div class="crm-detalhe-grid">
      ${lead.aparelho ? `<div class="crm-det-field">
        <span class="crm-det-label">Aparelho / Produto</span>
        <span class="crm-det-value">📱 ${lead.aparelho}</span>
      </div>` : ''}
      ${lead.servico ? `<div class="crm-det-field">
        <span class="crm-det-label">Serviço solicitado</span>
        <span class="crm-det-value">🔧 ${lead.servico}</span>
      </div>` : ''}
      <div class="crm-det-field">
        <span class="crm-det-label">Valor informado</span>
        <span class="crm-det-value valor">💰 ${valor}</span>
      </div>
      <div class="crm-det-field">
        <span class="crm-det-label">Criado em</span>
        <span class="crm-det-value" style="color:var(--text-tertiary)">${fmtDate(lead.criadoEm)}</span>
      </div>
    </div>

    ${lead.obs ? `<div class="crm-det-field" style="margin-bottom:14px">
      <span class="crm-det-label">Observações</span>
      <span class="crm-det-obs">💬 ${lead.obs}</span>
    </div>` : ''}

    <div class="crm-section-label">Alterar status</div>
    <div class="crm-status-sel">${statusOpts}</div>

    <div class="crm-detalhe-acoes">
      ${isFechado ? `<button class="crm-btn-os" onclick="converterEmOS('${lead.id}')">🔧 Converter Lead em O.S.</button>` : ''}
      <button class="crm-btn-wpp" onclick="abrirWhatsApp('${lead.id}')">💬 WhatsApp</button>
      <button class="crm-btn-editar" onclick="abrirForm('${lead.id}')">✏️ Editar Lead</button>
      <button class="crm-btn-excluir" onclick="confirmarExclusao('${lead.id}')">🗑️ Excluir lead</button>
    </div>
  `;

  el.classList.add('ativo');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.fecharDetalhe = function() {
  const el = document.getElementById('crm-detalhe');
  if (el) el.classList.remove('ativo');
  currentLead = null;
};

// ── Alterar status ───────────────────────────────────────────
window.alterarStatus = async function(id, key) {
  try {
    await setStatus(id, key);
    showToast('✅ Status atualizado');
    const lead = leads.find(l => l.id === id);
    if (lead) { lead.status = key; abrirDetalhe(id); }
  } catch { showToast('❌ Erro ao atualizar'); }
};

// ── Formulário ───────────────────────────────────────────────
window.abrirForm = function(id = null) {
  fecharDetalhe();
  editingId = id;
  const lead = id ? leads.find(l => l.id === id) : null;

  const el = document.getElementById('crm-form');
  const titulo = document.getElementById('crm-form-titulo');
  if (!el) return;

  if (titulo) titulo.textContent = id ? '✏️ Editar Lead' : '🆕 Novo Lead';

  const setV = (fid, v) => { const e = document.getElementById(fid); if (e) e.value = v || ''; };
  setV('f-nome',     lead?.nome);
  setV('f-telefone', lead?.telefone);
  setV('f-aparelho', lead?.aparelho);
  setV('f-servico',  lead?.servico);
  setV('f-valor',    lead?.valor ?? '');
  setV('f-obs',      lead?.obs);
  const sel = document.getElementById('f-status');
  if (sel) sel.value = lead?.status || 'novo_contato';

  el.classList.add('ativo');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('f-nome')?.focus();
};

window.fecharForm = function() {
  const el = document.getElementById('crm-form');
  if (el) el.classList.remove('ativo');
  editingId = null;
};

window.submitForm = async function(e) {
  e.preventDefault();
  const nome     = (document.getElementById('f-nome')?.value     || '').trim();
  const telefone = (document.getElementById('f-telefone')?.value || '').trim();
  if (!nome || !telefone) { showToast('⚠️ Nome e telefone são obrigatórios'); return; }

  const v = parseFloat((document.getElementById('f-valor')?.value || '').replace(',','.')) || 0;
  const data = {
    nome,
    telefone,
    aparelho: (document.getElementById('f-aparelho')?.value || '').trim(),
    servico:  (document.getElementById('f-servico')?.value  || '').trim(),
    valor:    v || null,
    obs:      (document.getElementById('f-obs')?.value      || '').trim(),
    status:   document.getElementById('f-status')?.value    || 'novo_contato'
  };

  try {
    await persistLead(data);
    fecharForm();
    showToast(editingId ? '✅ Lead atualizado' : '✅ Lead criado');
  } catch (err) {
    console.error(err);
    showToast('❌ Erro ao salvar');
  }
};

// ── WhatsApp ─────────────────────────────────────────────────
window.abrirWhatsApp = function(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead?.telefone) { showToast('Telefone não cadastrado'); return; }
  const tel = lead.telefone.replace(/\D/g, '');
  const ap  = lead.aparelho ? ` do ${lead.aparelho}` : '';
  const sv  = lead.servico  ? ` — ${lead.servico}`   : '';
  const vl  = lead.valor    ? `\n💰 Valor informado: ${fmtValor(lead.valor)}` : '';
  const msg = `Olá, ${lead.nome}! 👋\n\nEntrando em contato sobre o serviço${ap}${sv}.${vl}\n\nCell City Informática`;
  window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank');
};

// ── Converter em O.S. ────────────────────────────────────────
window.converterEmOS = async function(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;

  sessionStorage.setItem('cc_crm_prefill', JSON.stringify({
    nome:      lead.nome     || '',
    telefone:  lead.telefone || '',
    modelo:    lead.aparelho || '',
    defeito:   lead.servico  || '',
    valor:     lead.valor    ? String(lead.valor) : '',
    obs:       lead.obs      || '',
    crmLeadId: id
  }));

  try {
    await updateDoc(doc(db, 'crm_leads', id), {
      osConvertido: true,
      osConvertidoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
  } catch(e) { console.warn('Não foi possível marcar lead:', e); }

  showToast('🔧 Abrindo O.S...');
  setTimeout(() => { window.location.href = '/CRM/pages/os/index.html'; }, 600);
};

// ── Excluir ──────────────────────────────────────────────────
window.confirmarExclusao = function(id) {
  const modal = document.getElementById('crm-modal');
  const body  = document.getElementById('crm-modal-body');
  if (!modal || !body) return;
  body.textContent = 'Este lead será excluído permanentemente. Confirmar?';
  modal.dataset.pendingId = id;
  modal.classList.add('open');
};

window.confirmarModal = async function() {
  const modal = document.getElementById('crm-modal');
  const id = modal?.dataset.pendingId;
  if (!id) return;
  try {
    await removeLead(id);
    fecharDetalhe();
    showToast('🗑️ Lead excluído');
  } catch { showToast('❌ Erro ao excluir'); }
  fecharModal();
};

window.fecharModal = function() {
  const modal = document.getElementById('crm-modal');
  if (modal) modal.classList.remove('open');
};

// ── Navegação ────────────────────────────────────────────────
window.navTo = function(view) {
  currentView = view;
  fecharForm();
  fecharDetalhe();
  renderAll();
  // fecha sidebar mobile
  const sb = document.getElementById('crm-sb');
  const ov = document.getElementById('crm-sb-overlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('open');
};

window.toggleSb = function() {
  const sb = document.getElementById('crm-sb');
  const ov = document.getElementById('crm-sb-overlay');
  if (sb) sb.classList.toggle('open');
  if (ov) ov.classList.toggle('open');
};

// ── Toggle painel recolhível ──────────────────────────────────
window.togglePanel = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('aberto');
};

// ── Busca ────────────────────────────────────────────────────
window.onSearchInput = function(val) {
  searchQuery = val;
  if (currentView === '__home__') {
    if (val.trim()) navTo('__todos__');
  } else {
    renderLista();
  }
};

// ── Toast ────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('crm-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}
window.showToast = showToast;

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  startListener();

  // Overlay mobile fecha sidebar
  const ov = document.getElementById('crm-sb-overlay');
  if (ov) ov.addEventListener('click', () => {
    document.getElementById('crm-sb')?.classList.remove('open');
    ov.classList.remove('open');
  });
});
