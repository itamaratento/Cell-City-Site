import {
  db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp
} from '../../scripts/firebase.js';

// ── Constantes ────────────────────────────────────────────────
const COL = 'crm_leads';

const STATUS_FLOW = [
  { key: 'novo_contato',        label: 'Novo Contato',        color: '#60a5fa' },
  { key: 'orcamento_enviado',   label: 'Orçamento Enviado',   color: '#fbbf24' },
  { key: 'aguardando_resposta', label: 'Aguardando Resposta', color: '#a78bfa' },
  { key: 'negociacao',          label: 'Negociação',          color: '#fb923c' },
  { key: 'fechado',             label: 'Fechado',             color: '#00c853' },
  { key: 'perdido',             label: 'Perdido',             color: '#f87171' }
];

function getStatus(key) {
  return STATUS_FLOW.find(s => s.key === key) || STATUS_FLOW[0];
}

// ── Estado ────────────────────────────────────────────────────
let leads = [];
let currentLead = null;
let filterStatus = 'todos';
let searchQuery = '';
let editingId = null;
let unsub = null;

// ── Firestore: escuta em tempo real ──────────────────────────
function startListener() {
  if (unsub) unsub();
  const q = query(collection(db, COL), orderBy('criadoEm', 'desc'));
  unsub = onSnapshot(q, snap => {
    leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  }, err => {
    console.warn('CRM snapshot erro:', err);
  });
}

// ── Firestore: salvar lead ───────────────────────────────────
async function saveLead(data) {
  if (editingId) {
    await updateDoc(doc(db, COL, editingId), { ...data, atualizadoEm: serverTimestamp() });
  } else {
    await addDoc(collection(db, COL), {
      ...data,
      status: data.status || 'novo_contato',
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
  }
}

async function updateStatus(id, newStatus) {
  await updateDoc(doc(db, COL, id), {
    status: newStatus,
    atualizadoEm: serverTimestamp()
  });
}

async function deleteLead(id) {
  await deleteDoc(doc(db, COL, id));
}

// ── Filtro + busca ───────────────────────────────────────────
function getFiltered() {
  let list = leads;

  if (filterStatus !== 'todos') {
    list = list.filter(l => l.status === filterStatus);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    list = list.filter(l =>
      (l.nome || '').toLowerCase().includes(q) ||
      (l.telefone || '').includes(q) ||
      (l.aparelho || '').toLowerCase().includes(q) ||
      (l.servico || '').toLowerCase().includes(q)
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

// ── Render principal ─────────────────────────────────────────
function renderAll() {
  renderStats();
  renderFilterBadges();
  renderLeads();
}

function renderStats() {
  const total = leads.length;
  const abertos = leads.filter(l => !['fechado','perdido'].includes(l.status)).length;
  const fechados = leads.filter(l => l.status === 'fechado').length;
  const perdidos = leads.filter(l => l.status === 'perdido').length;

  const bar = document.getElementById('stats-bar');
  if (!bar) return;
  bar.innerHTML = `
    <div class="stat-chip"><span class="num">${total}</span> Total</div>
    <div class="stat-chip"><span class="num">${abertos}</span> Em andamento</div>
    <div class="stat-chip"><span class="num">${fechados}</span> Fechados</div>
    <div class="stat-chip"><span class="num">${perdidos}</span> Perdidos</div>
  `;
}

function renderFilterBadges() {
  const container = document.getElementById('filter-tabs');
  if (!container) return;

  const items = [
    { key: 'todos', label: 'Todos' },
    ...STATUS_FLOW
  ];

  container.innerHTML = items.map(s => {
    const count = s.key === 'todos' ? leads.length : leads.filter(l => l.status === s.key).length;
    const active = filterStatus === s.key ? 'active' : '';
    return `<button class="filter-tab ${active}" onclick="setFilter('${s.key}')">${s.label} (${count})</button>`;
  }).join('');
}

function renderLeads() {
  const container = document.getElementById('leads-list');
  if (!container) return;

  const list = getFiltered();

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🎯</span>
        <h3>${filterStatus === 'todos' ? 'Nenhum lead cadastrado' : 'Nenhum lead neste status'}</h3>
        <p>${filterStatus === 'todos' ? 'Clique em + para registrar o primeiro contato comercial.' : 'Tente outro filtro ou adicione um lead.'}</p>
      </div>`;
    return;
  }

  container.innerHTML = list.map(lead => {
    const st = getStatus(lead.status);
    const valor = lead.valor ? fmtValor(lead.valor) : '';
    const obsPreview = lead.obs ? lead.obs.substring(0, 50) + (lead.obs.length > 50 ? '…' : '') : '';
    return `
      <div class="lead-card" onclick="openDetail('${lead.id}')">
        <div class="lead-card-top">
          <div>
            <div class="lead-name">${lead.nome || '—'}</div>
            <div class="lead-phone">📞 ${lead.telefone || '—'}</div>
          </div>
          <span class="status-badge status-${lead.status}">${st.label}</span>
        </div>
        ${lead.aparelho ? `<div class="lead-aparelho">📱 ${lead.aparelho}</div>` : ''}
        ${lead.servico  ? `<div class="lead-servico">🔧 ${lead.servico}</div>` : ''}
        ${valor         ? `<div class="lead-valor">💰 ${valor}</div>` : ''}
        <div class="lead-footer">
          <span class="lead-date">${fmtDate(lead.criadoEm)}</span>
          ${obsPreview ? `<span class="lead-obs-preview">💬 ${obsPreview}</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── Filtros e busca (handlers globais) ───────────────────────
window.setFilter = function(key) {
  filterStatus = key;
  renderAll();
};

window.onSearchInput = function(val) {
  searchQuery = val;
  renderLeads();
};

// ── Modal de criação/edição ───────────────────────────────────
window.openModal = function(lead = null) {
  editingId = lead ? lead.id : null;
  currentLead = lead;

  const title = document.getElementById('modal-title');
  if (title) title.textContent = lead ? '✏️ Editar Lead' : '➕ Novo Lead';

  // Preenche campos
  setField('f-nome',     lead?.nome      || '');
  setField('f-telefone', lead?.telefone  || '');
  setField('f-aparelho', lead?.aparelho  || '');
  setField('f-servico',  lead?.servico   || '');
  setField('f-valor',    lead?.valor     || '');
  setField('f-obs',      lead?.obs       || '');

  const sel = document.getElementById('f-status');
  if (sel) sel.value = lead?.status || 'novo_contato';

  document.getElementById('modal-overlay').classList.add('open');
};

window.closeModal = function() {
  document.getElementById('modal-overlay').classList.remove('open');
  editingId = null;
  currentLead = null;
};

window.submitForm = async function(e) {
  e.preventDefault();

  const nome     = getField('f-nome').trim();
  const telefone = getField('f-telefone').trim();
  const aparelho = getField('f-aparelho').trim();

  if (!nome || !telefone) {
    showToast('⚠️ Nome e telefone são obrigatórios');
    return;
  }

  const valorRaw = getField('f-valor').replace(',', '.');
  const valor = parseFloat(valorRaw) || 0;

  const data = {
    nome,
    telefone,
    aparelho,
    servico:  getField('f-servico').trim(),
    valor:    valor || null,
    obs:      getField('f-obs').trim(),
    status:   getField('f-status') || 'novo_contato'
  };

  try {
    await saveLead(data);
    closeModal();
    showToast(editingId ? '✅ Lead atualizado' : '✅ Lead criado');
  } catch (err) {
    console.error('Erro ao salvar lead:', err);
    showToast('❌ Erro ao salvar');
  }
};

// ── Painel de detalhe ────────────────────────────────────────
window.openDetail = function(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  currentLead = lead;
  renderDetail(lead);
  document.getElementById('detail-panel').classList.add('open');
  document.getElementById('detail-overlay').classList.add('open');
};

window.closeDetail = function() {
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('detail-overlay').classList.remove('open');
  currentLead = null;
};

function renderDetail(lead) {
  const panel = document.getElementById('detail-panel');
  if (!panel) return;

  const st = getStatus(lead.status);
  const valor = lead.valor ? fmtValor(lead.valor) : 'Não informado';
  const isFechado = lead.status === 'fechado';

  const statusOpts = STATUS_FLOW.map(s => `
    <div class="status-option ${lead.status === s.key ? 'selected' : ''}"
         onclick="changeLeadStatus('${lead.id}', '${s.key}')">
      <span class="dot" style="background:${s.color}"></span>${s.label}
    </div>`).join('');

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-field">
      <div class="detail-field-label">Nome</div>
      <div class="detail-field-value big">${lead.nome || '—'}</div>
    </div>
    <div class="detail-field">
      <div class="detail-field-label">Telefone</div>
      <div class="detail-field-value">${lead.telefone || '—'}</div>
    </div>
    ${lead.aparelho ? `<div class="detail-field">
      <div class="detail-field-label">Aparelho / Produto</div>
      <div class="detail-field-value">${lead.aparelho}</div>
    </div>` : ''}
    ${lead.servico ? `<div class="detail-field">
      <div class="detail-field-label">Serviço solicitado</div>
      <div class="detail-field-value">${lead.servico}</div>
    </div>` : ''}
    <div class="detail-field">
      <div class="detail-field-label">Valor informado</div>
      <div class="detail-field-value" style="color:#4ade80;font-weight:700">${valor}</div>
    </div>
    ${lead.obs ? `<div class="detail-field">
      <div class="detail-field-label">Observações</div>
      <div class="detail-field-value" style="color:var(--text2)">${lead.obs}</div>
    </div>` : ''}
    <div class="detail-field">
      <div class="detail-field-label">Criado em</div>
      <div class="detail-field-value" style="color:var(--text2)">${fmtDate(lead.criadoEm)}</div>
    </div>

    <div class="section-label">Alterar status</div>
    <div class="status-selector">${statusOpts}</div>
  `;

  const footer = document.getElementById('detail-footer');
  footer.innerHTML = `
    ${isFechado ? `
      <button class="btn-converter" onclick="converterEmOS('${lead.id}')">
        🔧 Converter Lead em O.S.
      </button>` : ''}
    <button class="btn-wpp" onclick="abrirWhatsApp('${lead.id}')">
      💬 Abrir no WhatsApp
    </button>
    <button class="btn-edit-lead" onclick="editLead('${lead.id}')">
      ✏️ Editar Lead
    </button>
    <button class="btn-danger" onclick="confirmDelete('${lead.id}')">
      🗑️ Excluir lead
    </button>
  `;
}

// ── Alterar status diretamente no painel ─────────────────────
window.changeLeadStatus = async function(id, newStatus) {
  try {
    await updateStatus(id, newStatus);
    const lead = leads.find(l => l.id === id);
    if (lead) {
      lead.status = newStatus;
      renderDetail(lead);
    }
    showToast('✅ Status atualizado');
  } catch (err) {
    showToast('❌ Erro ao atualizar status');
  }
};

// ── Editar lead ───────────────────────────────────────────────
window.editLead = function(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  closeDetail();
  openModal(lead);
};

// ── Excluir lead ──────────────────────────────────────────────
window.confirmDelete = async function(id) {
  if (!confirm('Excluir este lead permanentemente?')) return;
  try {
    await deleteLead(id);
    closeDetail();
    showToast('🗑️ Lead excluído');
  } catch (err) {
    showToast('❌ Erro ao excluir');
  }
};

// ── WhatsApp ──────────────────────────────────────────────────
window.abrirWhatsApp = function(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead || !lead.telefone) { showToast('Sem telefone cadastrado'); return; }
  const tel = lead.telefone.replace(/\D/g, '');
  const aparelho = lead.aparelho ? ` do ${lead.aparelho}` : '';
  const servico  = lead.servico  ? ` — ${lead.servico}`  : '';
  const valor    = lead.valor    ? `\n💰 Valor informado: ${fmtValor(lead.valor)}` : '';
  const msg = `Olá, ${lead.nome}! 👋\n\nEntrando em contato sobre o serviço${aparelho}${servico}.${valor}\n\nCell City Informática`;
  window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank');
};

// ── Converter Lead em O.S. ───────────────────────────────────
window.converterEmOS = async function(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;

  const prefill = {
    nome:     lead.nome     || '',
    telefone: lead.telefone || '',
    modelo:   lead.aparelho || '',
    defeito:  lead.servico  || '',
    valor:    lead.valor    ? String(lead.valor) : '',
    obs:      lead.obs      || '',
    crmLeadId: id
  };

  sessionStorage.setItem('cc_crm_prefill', JSON.stringify(prefill));

  // Marca o lead como convertido em OS (mantém status fechado mas registra linkagem)
  try {
    await updateDoc(doc(db, COL, id), {
      osConvertido: true,
      osConvertidoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });
  } catch(e) { console.warn('Não foi possível marcar lead como convertido:', e); }

  showToast('🔧 Abrindo O.S...');
  setTimeout(() => {
    window.location.href = '/CRM/pages/os/index.html';
  }, 600);
};

// ── Utilitários DOM ───────────────────────────────────────────
function setField(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function getField(id) {
  return (document.getElementById(id)?.value || '');
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('crm-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

window.showToast = showToast;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  startListener();
});
