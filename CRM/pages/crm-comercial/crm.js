import {
  db, collection, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc,
  query, orderBy, where, getDocs, onSnapshot, serverTimestamp, runTransaction
} from '../../scripts/firebase.js';

// ── Status do funil ──────────────────────────────────────────
const STATUS = [
  { key: 'novo_contato',        label: 'Novo Contato',        icon: '🆕', dotColor: '#60a5fa',  badgeClass: 'crm-badge-novo' },
  { key: 'orcamento_enviado',   label: 'Orçamento Enviado',   icon: '📤', dotColor: '#fbbf24',  badgeClass: 'crm-badge-enviado' },
  { key: 'aguardando_resposta', label: 'Aguardando Resposta', icon: '⏳', dotColor: '#a78bfa',  badgeClass: 'crm-badge-aguardando' },
  { key: 'negociacao',          label: 'Negociação',          icon: '🤝', dotColor: '#fb923c',  badgeClass: 'crm-badge-negociacao' },
  { key: 'fechado',             label: 'Fechado',             icon: '✅', dotColor: '#00c853',  badgeClass: 'crm-badge-fechado' },
  { key: 'pre_os',              label: 'Pré-OS',              icon: '📋', dotColor: '#f59e0b',  badgeClass: 'crm-badge-preos' },
  { key: 'perdido',             label: 'Perdido',             icon: '❌', dotColor: '#f87171',  badgeClass: 'crm-badge-perdido' }
];

function getStatus(key) { return STATUS.find(s => s.key === key) || STATUS[0]; }

const MOTIVOS_PERDA = [
  { key: 'achou_caro',       label: 'Achou caro' },
  { key: 'fara_depois',      label: 'Vai fazer depois' },
  { key: 'sem_dinheiro',     label: 'Sem dinheiro no momento' },
  { key: 'concorrente',      label: 'Comprou em concorrente' },
  { key: 'sem_resposta',     label: 'Não respondeu' },
  { key: 'desistiu',         label: 'Desistiu do serviço' },
  { key: 'outro',            label: 'Outro' }
];

function getMotivo(key) { return MOTIVOS_PERDA.find(m => m.key === key)?.label || key || '—'; }

// ── PRE-OS: numeração sequencial ──────────────────────────────
async function gerarPreOsId() {
  const counterRef = doc(db, 'config', 'crm_pre_os_counter');
  let num = 1;
  try {
    await runTransaction(db, async tx => {
      const snap = await tx.get(counterRef);
      num = (snap.exists() ? (snap.data().ultimo || 0) : 0) + 1;
      tx.set(counterRef, { ultimo: num }, { merge: true });
    });
  } catch(e) {
    console.warn('Erro ao gerar PRE-OS:', e);
    num = Date.now() % 10000;
  }
  return `PRE-OS-${String(num).padStart(3, '0')}`;
}

// ── Estado ────────────────────────────────────────────────────
let leads              = [];
let currentView        = '__home__';
let currentLead        = null;
let editingId          = null;
let searchQuery        = '';
let unsub              = null;
let alertasChecados    = false;
let _clienteEncontrado = null;
let filtroBanco        = { motivo: '', marca: '', servico: '' };

// ── Utilitários ──────────────────────────────────────────────
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtValor(v) {
  if (!v && v !== 0) return '';
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

// ── Base de Clientes (compartilhada com O.S.) ─────────────────
async function lookupClientePorTelefone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  try {
    let snap = await getDoc(doc(db, 'clientes', phone.trim()));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    snap = await getDoc(doc(db, 'clientes', digits));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    return null;
  } catch(e) {
    console.warn('Lookup cliente:', e);
    return null;
  }
}

async function linkOuCriarCliente(phone, nome, leadId) {
  const existente = _clienteEncontrado || await lookupClientePorTelefone(phone);

  if (existente) {
    const crmLeads = existente.crmLeads || [];
    if (!crmLeads.includes(leadId)) crmLeads.push(leadId);
    const updates = { crmLeads, atualizadoEm: serverTimestamp() };
    if (!existente.name && nome)  updates.name       = nome;
    if (!('cpf'        in existente)) updates.cpf        = '';
    if (!('email'      in existente)) updates.email      = '';
    if (!('endereco'   in existente)) updates.endereco   = '';
    if (!('obsCliente' in existente)) updates.obsCliente = '';
    await updateDoc(doc(db, 'clientes', existente.id), updates);
    return existente.id;
  } else {
    const chave = phone.trim();
    await setDoc(doc(db, 'clientes', chave), {
      name:       nome,
      phone:      chave,
      history:    [],
      crmLeads:   [leadId],
      cpf:        '',
      email:      '',
      endereco:   '',
      obsCliente: '',
      createdAt:  new Date().toISOString(),
      origem:     'crm'
    });
    return chave;
  }
}

// ── Alertas automáticos (leads sem retorno) ──────────────────
const ALERTAS_COL = 'alertas_usuario';
const STATUS_WATCH_ALERTAS = new Set(['orcamento_enviado', 'aguardando_resposta', 'negociacao']);

async function checkAlertasSemResposta() {
  const agora = Date.now();
  const THRESHOLDS = [
    { dias: 2,  prio: 'baixa', flag: '2d' },
    { dias: 5,  prio: 'media', flag: '5d' },
    { dias: 10, prio: 'alta',  flag: '10d' }
  ];

  for (const lead of leads) {
    if (!STATUS_WATCH_ALERTAS.has(lead.status) || lead.osConvertido) continue;

    const base = lead.atualizadoEm?.toDate?.()
      ?? lead.criadoEm?.toDate?.()
      ?? new Date(lead.criadoEm || Date.now());
    const diasPassados = (agora - base.getTime()) / 86400000;

    for (const { dias, prio, flag } of THRESHOLDS) {
      if (diasPassados < dias) continue;
      const alertId = `crm_${lead.id}_${flag}`;
      try {
        const snap = await getDoc(doc(db, ALERTAS_COL, alertId));
        if (snap.exists()) continue;
        const hoje = new Date().toISOString().substring(0, 10);
        await setDoc(doc(db, ALERTAS_COL, alertId), {
          id:              alertId,
          titulo:          `🔔 CRM — ${lead.nome} sem retorno (${dias} dias)`,
          descricao:       `Lead em "${getStatus(lead.status).label}" há ${Math.floor(diasPassados)} dia(s). Aparelho: ${lead.aparelho || '—'}.`,
          tipo:            'lembrete',
          prioridade:      prio,
          data:            hoje,
          hora:            '08:00',
          status:          'pendente',
          repeticao:       'nenhuma',
          link:            '/CRM/pages/crm-comercial/index.html',
          origem:          'crm',
          leadId:          lead.id,
          criadoEmISO:     new Date().toISOString(),
          atualizadoEmISO: new Date().toISOString()
        });
      } catch(e) { console.warn('Erro ao criar alerta CRM:', e); }
    }
  }
}

// ── Firestore ────────────────────────────────────────────────
function startListener() {
  if (unsub) unsub();
  const q = query(collection(db, 'crm_leads'), orderBy('criadoEm', 'desc'));
  unsub = onSnapshot(q, snap => {
    leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
    if (!alertasChecados) {
      alertasChecados = true;
      checkAlertasSemResposta();
    }
  }, err => console.warn('CRM snapshot:', err));
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
  if (key === '__banco__') return leads.filter(l => l.status === 'perdido' || (!l.osConvertido && l.status === 'aguardando_resposta')).length;
  return leads.filter(l => l.status === key).length;
}

// ── Filtro / busca ───────────────────────────────────────────
function getFiltered() {
  let list = leads;

  if (currentView === '__hist__')
    list = list.filter(l => l.osConvertido);
  else if (currentView === '__banco__')
    list = list.filter(l => l.status === 'perdido' || (!l.osConvertido && l.status === 'aguardando_resposta'));
  else if (currentView !== '__todos__' && currentView !== '__home__')
    list = list.filter(l => l.status === currentView);

  // Filtros do banco de leads
  if (currentView === '__banco__') {
    const { motivo, marca, servico } = filtroBanco;
    if (motivo)  list = list.filter(l => l.motivoPerda === motivo);
    if (marca)   list = list.filter(l => (l.aparelho || '').toLowerCase().includes(marca.toLowerCase()));
    if (servico) list = list.filter(l => (l.servico  || '').toLowerCase().includes(servico.toLowerCase()));
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

// ── Render geral ─────────────────────────────────────────────
function renderAll() {
  renderSidebar();
  renderMainArea();
}

// ── Sidebar interna ──────────────────────────────────────────
function renderSidebar() {
  const sb = document.getElementById('crm-sb-cats');
  if (!sb) return;

  const el = id => document.getElementById(id);
  if (el('crm-sb-count-all'))   el('crm-sb-count-all').textContent   = leads.length;
  if (el('crm-sb-count-hist'))  el('crm-sb-count-hist').textContent  = count('__hist__');
  if (el('crm-sb-count-banco')) el('crm-sb-count-banco').textContent = count('__banco__');

  document.querySelectorAll('.crm-sb-item[data-view]').forEach(item =>
    item.classList.toggle('active', item.dataset.view === currentView)
  );

  sb.innerHTML = STATUS.map(s => {
    const n = count(s.key);
    return `<div class="crm-sb-item ${currentView === s.key ? 'active' : ''}" data-view="${s.key}" onclick="navTo('${s.key}')">
      <span class="crm-sb-icon">${s.icon}</span>
      <span class="crm-sb-label">${s.label}</span>
      <span class="crm-sb-count">${n}</span>
    </div>`;
  }).join('');
}

// ── Área principal ───────────────────────────────────────────
function renderMainArea() {
  const titulo    = document.getElementById('crm-main-titulo');
  const homeGrid  = document.getElementById('crm-home-grid');
  const listaArea = document.getElementById('crm-lista-area');
  const formEl    = document.getElementById('crm-form');
  const detalheEl = document.getElementById('crm-detalhe');

  if (formEl    && !formEl.classList.contains('ativo'))    formEl.style.display    = '';
  if (detalheEl && !detalheEl.classList.contains('ativo')) detalheEl.style.display = '';

  if (currentView === '__home__') {
    if (titulo)    titulo.textContent      = '🎯 CRM Comercial';
    if (homeGrid)  homeGrid.style.display  = '';
    if (listaArea) listaArea.style.display = 'none';
    renderHomeGrid();
    renderPainelStats();
  } else {
    const st    = STATUS.find(s => s.key === currentView);
    const label = currentView === '__todos__'  ? '📂 Todos os leads'
                : currentView === '__hist__'   ? '📋 Histórico — convertidos em O.S.'
                : currentView === '__banco__'  ? '🔄 Banco de Leads — Remarketing'
                : `${st?.icon || ''} ${st?.label || currentView}`;
    if (titulo)    titulo.textContent      = label;
    if (homeGrid)  homeGrid.style.display  = 'none';
    if (listaArea) listaArea.style.display = '';
    if (currentView === '__banco__') renderFiltrosBanco();
    renderLista();
  }
}

// ── Home Grid ────────────────────────────────────────────────
function renderHomeGrid() {
  const grid = document.getElementById('crm-home-grid');
  if (!grid) return;

  // Card destacado: Novo Cliente
  const novoCard = `<div class="crm-home-block crm-novo-cliente-block" onclick="window.location.href='/CRM/pages/crm-comercial/entrada.html'" title="Cadastro rápido de cliente">
    <span class="crm-home-icon">👤</span>
    <span class="crm-home-nome">Novo Cliente</span>
    <span class="crm-home-count" style="color:var(--cell-green);background:rgba(0,200,83,0.15);font-size:20px;font-weight:900">＋</span>
  </div>`;

  const cards = STATUS.map(s => {
    const n   = count(s.key);
    const cls = n === 0 ? 'crm-home-count crm-home-count-zero' : 'crm-home-count';
    return `<div class="crm-home-block" data-status="${s.key}" onclick="navTo('${s.key}')">
      <span class="crm-home-icon">${s.icon}</span>
      <span class="crm-home-nome">${s.label}</span>
      <span class="${cls}">${n}</span>
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

  cards.push(`<div class="crm-home-block" onclick="window.location.href='chips.html'" style="border-color:rgba(99,102,241,0.22)">
    <span class="crm-home-icon">📱</span>
    <span class="crm-home-nome">Cadastro de Chip</span>
    <span class="crm-home-count" style="color:#a5b4fc;background:rgba(99,102,241,0.12);font-size:11px;padding:3px 9px">Ativar</span>
  </div>`);

  grid.innerHTML = novoCard + cards.join('');
}

// ── Painel de estatísticas ───────────────────────────────────
function renderPainelStats() {
  const grid = document.getElementById('crm-stats-grid-inner');
  if (!grid) return;

  const agora     = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

  const total    = leads.length;
  const doMes    = leads.filter(l => {
    const d = l.criadoEm?.toDate?.() ?? new Date(l.criadoEm || 0);
    return d >= inicioMes;
  }).length;
  const ativos   = leads.filter(l => !['fechado','perdido'].includes(l.status));
  const fechados = leads.filter(l => l.status === 'fechado');
  const perdidos = leads.filter(l => l.status === 'perdido');
  const histN    = count('__hist__');

  const baseConv = fechados.length + perdidos.length;
  const taxa     = baseConv > 0 ? Math.round(fechados.length / baseConv * 100) : 0;

  const somaValor = arr => arr.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);
  const vNegoc    = somaValor(ativos);
  const vFechado  = somaValor(fechados);
  const vPerdido  = somaValor(perdidos);

  const fBR = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  grid.innerHTML = `
    <div class="crm-stat-item" onclick="navTo('__todos__')">
      <span class="crm-stat-num">${total}</span>
      <span class="crm-stat-label">Total</span>
    </div>
    <div class="crm-stat-item" onclick="navTo('__todos__')">
      <span class="crm-stat-num crm-stat-azul">${doMes}</span>
      <span class="crm-stat-label">Este mês</span>
    </div>
    <div class="crm-stat-item" onclick="navTo('fechado')">
      <span class="crm-stat-num crm-stat-verde">${fechados.length}</span>
      <span class="crm-stat-label">Fechados</span>
    </div>
    <div class="crm-stat-item" onclick="navTo('perdido')">
      <span class="crm-stat-num crm-stat-vermelho">${perdidos.length}</span>
      <span class="crm-stat-label">Perdidos</span>
    </div>
    <div class="crm-stat-item" onclick="navTo('__hist__')">
      <span class="crm-stat-num crm-stat-amarelo">${histN}</span>
      <span class="crm-stat-label">Em O.S.</span>
    </div>
    <div class="crm-stat-item">
      <span class="crm-stat-num crm-stat-verde">${taxa}%</span>
      <span class="crm-stat-label">Conversão</span>
    </div>
    <div class="crm-stat-item crm-stat-wide" onclick="navTo('__todos__')">
      <span class="crm-stat-num crm-stat-azul" style="font-size:15px">${fBR(vNegoc)}</span>
      <span class="crm-stat-label">Em negociação</span>
    </div>
    <div class="crm-stat-item crm-stat-wide" onclick="navTo('fechado')">
      <span class="crm-stat-num crm-stat-verde" style="font-size:15px">${fBR(vFechado)}</span>
      <span class="crm-stat-label">Valor fechado</span>
    </div>
    <div class="crm-stat-item crm-stat-wide" onclick="navTo('perdido')">
      <span class="crm-stat-num crm-stat-vermelho" style="font-size:15px">${fBR(vPerdido)}</span>
      <span class="crm-stat-label">Valor perdido</span>
    </div>
  `;
}

// ── Filtros do Banco de Leads ────────────────────────────────
function renderFiltrosBanco() {
  let bar = document.getElementById('crm-filtros-banco');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'crm-filtros-banco';
    bar.className = 'crm-filtros-bar';
    const lista = document.getElementById('crm-lista-area');
    if (lista) lista.insertBefore(bar, lista.firstChild);
  }

  const motivoOpts = MOTIVOS_PERDA.map(m =>
    `<option value="${m.key}" ${filtroBanco.motivo === m.key ? 'selected' : ''}>${m.label}</option>`
  ).join('');

  bar.innerHTML = `
    <div class="crm-filtros-titulo">🔍 Filtrar banco de leads</div>
    <div class="crm-filtros-grid">
      <select class="crm-filtro-sel" onchange="setBancoFiltro('motivo',this.value)">
        <option value="">Motivo da perda (todos)</option>
        ${motivoOpts}
      </select>
      <input type="text" class="crm-filtro-sel" placeholder="Aparelho / marca..."
             value="${esc(filtroBanco.marca)}" oninput="setBancoFiltro('marca',this.value)">
      <input type="text" class="crm-filtro-sel" placeholder="Serviço / defeito..."
             value="${esc(filtroBanco.servico)}" oninput="setBancoFiltro('servico',this.value)">
      <button class="crm-filtro-clear" onclick="limparFiltrosBanco()">✕ Limpar</button>
    </div>
  `;
}

function esconeerFiltrosBanco() {
  document.getElementById('crm-filtros-banco')?.remove();
}

window.setBancoFiltro = function(campo, valor) {
  filtroBanco[campo] = valor;
  renderLista();
};

window.limparFiltrosBanco = function() {
  filtroBanco = { motivo: '', marca: '', servico: '' };
  renderFiltrosBanco();
  renderLista();
};

// ── Programar recontato ──────────────────────────────────────
window.programarRecontato = async function(id, dias) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;

  const dataRecontato = new Date();
  dataRecontato.setDate(dataRecontato.getDate() + dias);
  const dataISO = dataRecontato.toISOString().substring(0, 10);
  const alertId = `crm_recontato_${id}_${dias}d_${dataISO}`;

  try {
    await setDoc(doc(db, ALERTAS_COL, alertId), {
      id:              alertId,
      titulo:          `🔄 Remarketing — ${lead.nome} (${dias} dias)`,
      descricao:       `Reativar contato. Aparelho: ${lead.aparelho || '—'} | Serviço: ${lead.servico || '—'} | Motivo da perda: ${getMotivo(lead.motivoPerda)}`,
      tipo:            'lembrete',
      prioridade:      dias <= 30 ? 'media' : 'baixa',
      data:            dataISO,
      hora:            '09:00',
      status:          'pendente',
      repeticao:       'nenhuma',
      link:            '/CRM/pages/crm-comercial/index.html',
      origem:          'crm_remarketing',
      leadId:          id,
      criadoEmISO:     new Date().toISOString(),
      atualizadoEmISO: new Date().toISOString()
    });
    showToast(`⏰ Recontato agendado para ${dataRecontato.toLocaleDateString('pt-BR')}`);
  } catch(e) {
    console.error(e);
    showToast('❌ Erro ao agendar recontato');
  }
};

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
    const st    = getStatus(lead.status);
    const valor = lead.valor ? fmtValor(lead.valor) : '';
    const info  = [lead.aparelho, lead.servico].filter(Boolean).join(' — ');
    const hist  = lead.osConvertido
      ? `<span class="crm-badge crm-badge-fechado" style="margin-left:4px">🔧 O.S.</span>` : '';
    return `<div class="crm-card" data-status="${lead.status}" onclick="abrirDetalhe('${lead.id}')">
      <div class="crm-card-top">
        <span class="crm-card-icon">${st.icon}</span>
        <div class="crm-card-main">
          <div class="crm-card-nome">${esc(lead.nome || '—')}${lead.preOsId ? `<span class="crm-preos-badge">${esc(lead.preOsId)}</span>` : ''}</div>
          <div class="crm-card-meta">
            <span class="crm-badge ${st.badgeClass}">${st.label}</span>
            ${hist}
            <span class="crm-card-date">${fmtDate(lead.criadoEm)}</span>
            ${valor ? `<span class="crm-card-valor">💰 ${valor}</span>` : ''}
          </div>
          ${info      ? `<div class="crm-card-info">${esc(info)}</div>` : ''}
          ${lead.telefone ? `<div class="crm-card-info" style="color:var(--text-tertiary)">📞 ${esc(lead.telefone)}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Lock label helper ────────────────────────────────────────
function getLockLabel(t) {
  return { Numerica: 'PIN / Numérica', Padrao: 'Padrão (desenho)', Biometria: 'Biometria / Face ID' }[t] || t;
}

// ── Detalhe do lead ──────────────────────────────────────────
function buildDetalheHtml(lead) {
  const st       = getStatus(lead.status);
  const valor    = lead.valor ? fmtValor(lead.valor) : '—';
  const isFechado = lead.status === 'fechado';
  const isPreOS   = lead.status === 'pre_os';

  const statusOpts = STATUS.map(s => `
    <div class="crm-status-opt ${lead.status === s.key ? 'selected' : ''}"
         onclick="alterarStatus('${lead.id}','${s.key}')">
      <span class="dot" style="background:${s.dotColor}"></span>
      ${s.icon} ${s.label}
    </div>`).join('');

  return `
    <div class="crm-detalhe-topo">
      <div>
        <div class="crm-detalhe-nome">${esc(lead.nome || '—')}</div>
        <div class="crm-detalhe-phone">📞 ${esc(lead.telefone || '—')}</div>
        ${lead.preOsId ? `<div class="crm-preos-detalhe">${esc(lead.preOsId)}</div>` : ''}
      </div>
      <span class="crm-badge ${st.badgeClass}" style="font-size:12px;padding:4px 10px">${st.label}</span>
    </div>

    <div id="crm-det-cliente-${lead.id}" class="crm-det-cliente-wrap crm-det-loading-wrap">
      <span class="crm-det-loading-txt">⏳ Verificando cadastro...</span>
    </div>

    <div class="crm-detalhe-grid">
      ${lead.aparelho ? `<div class="crm-det-field">
        <span class="crm-det-label">Aparelho / Produto</span>
        <span class="crm-det-value">📱 ${esc(lead.aparelho)}</span>
      </div>` : ''}
      ${lead.servico ? `<div class="crm-det-field">
        <span class="crm-det-label">Serviço solicitado</span>
        <span class="crm-det-value">🔧 ${esc(lead.servico)}</span>
      </div>` : ''}
      <div class="crm-det-field">
        <span class="crm-det-label">Valor informado</span>
        <span class="crm-det-value valor">💰 ${valor}</span>
      </div>
      <div class="crm-det-field">
        <span class="crm-det-label">Criado em</span>
        <span class="crm-det-value" style="color:var(--text-tertiary)">${fmtDate(lead.criadoEm)}</span>
      </div>
      ${lead.lockType ? `<div class="crm-det-field">
        <span class="crm-det-label">Tipo de bloqueio</span>
        <span class="crm-det-value">🔒 ${getLockLabel(lead.lockType)}</span>
      </div>` : ''}
      ${lead.senha ? `<div class="crm-det-field">
        <span class="crm-det-label">Senha</span>
        <span class="crm-det-value" style="color:#fbbf24;font-weight:700;font-size:16px">🔑 ${esc(lead.senha)}</span>
      </div>` : ''}
      ${lead.patternSequence?.length ? `<div class="crm-det-field">
        <span class="crm-det-label">Padrão Android</span>
        <span class="crm-det-value" style="color:#a78bfa">✅ ${lead.patternSequence.length} pontos registrados</span>
      </div>` : ''}
    </div>

    ${lead.obs ? `<div class="crm-det-field" style="margin-bottom:14px">
      <span class="crm-det-label">Observações</span>
      <span class="crm-det-obs">💬 ${esc(lead.obs)}</span>
    </div>` : ''}

    <div class="crm-section-label">Alterar status</div>
    <div class="crm-status-sel">${statusOpts}</div>

    ${lead.motivoPerda ? `<div class="crm-det-field" style="margin-bottom:14px">
      <span class="crm-det-label">Motivo da perda</span>
      <span class="crm-det-value" style="color:var(--accent-red)">❌ ${getMotivo(lead.motivoPerda)}</span>
    </div>` : ''}

    <div class="crm-detalhe-acoes">
      ${(isPreOS || isFechado) && !lead.osConvertido ? `<button class="crm-btn-os" onclick="converterEmOS('${lead.id}')">🔧 ${isPreOS ? 'Abrir OS' : 'Converter em O.S.'}</button>` : ''}
      <button class="crm-btn-wpp"    onclick="abrirWhatsApp('${lead.id}')">💬 WhatsApp</button>
      <button class="crm-btn-editar" onclick="abrirForm('${lead.id}')">✏️ Editar Lead</button>
      <button class="crm-btn-excluir" onclick="confirmarExclusao('${lead.id}')">🗑️ Excluir</button>
    </div>

    ${lead.status === 'perdido' ? `<div class="crm-reativar-wrap">
      <div class="crm-section-label">🔄 Programar Recontato</div>
      <div class="crm-reativar-btns">
        <button class="crm-btn-reativar" onclick="programarRecontato('${lead.id}', 30)">⏰ 30 dias</button>
        <button class="crm-btn-reativar" onclick="programarRecontato('${lead.id}', 60)">⏰ 60 dias</button>
        <button class="crm-btn-reativar" onclick="programarRecontato('${lead.id}', 90)">⏰ 90 dias</button>
      </div>
    </div>` : ''}

    <div id="crm-det-hist-${lead.id}" class="crm-det-hist-wrap crm-det-loading-wrap">
      <div class="crm-section-label">🔧 Histórico de O.S.</div>
      <span class="crm-det-loading-txt">⏳ Carregando...</span>
    </div>
  `;
}

window.abrirDetalhe = async function(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  currentLead = lead;
  fecharForm();

  const el = document.getElementById('crm-detalhe');
  if (!el) return;

  el.innerHTML = buildDetalheHtml(lead);
  el.classList.add('ativo');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  if (!lead.telefone) return;

  try {
    const cliente   = await lookupClientePorTelefone(lead.telefone);
    const clienteEl = document.getElementById(`crm-det-cliente-${id}`);
    const histEl    = document.getElementById(`crm-det-hist-${id}`);

    if (cliente) {
      const nOs  = (cliente.history  || []).length;
      const nCrm = (cliente.crmLeads || []).length;
      const metaParts = [
        cliente.cpf      ? `🆔 ${esc(cliente.cpf)}`      : '',
        cliente.email    ? `✉️ ${esc(cliente.email)}`    : '',
        cliente.endereco ? `📍 ${esc(cliente.endereco)}` : ''
      ].filter(Boolean);

      if (clienteEl) {
        clienteEl.className = 'crm-det-cliente-wrap crm-det-cliente-ok';
        clienteEl.innerHTML = `
          <div class="crm-det-cli-titulo">✅ Cliente cadastrado</div>
          ${metaParts.length ? `<div class="crm-det-cli-meta">${metaParts.join(' &nbsp;·&nbsp; ')}</div>` : ''}
          <div class="crm-det-cli-stats">
            <span>🔧 ${nOs} O.S. registrada${nOs !== 1 ? 's' : ''}</span>
            <span>🎯 ${nCrm} lead${nCrm !== 1 ? 's' : ''} no CRM</span>
          </div>`;
      }

      if (histEl) {
        const osIds = (cliente.history || []).slice(-5).reverse();
        histEl.innerHTML = `<div class="crm-section-label">🔧 Histórico de O.S.</div>` +
          (osIds.length
            ? osIds.map(osId => `<div class="crm-hist-item">
                <span class="crm-hist-dot"></span>
                <a class="crm-hist-link" href="/CRM/pages/os/index.html" target="_self">${esc(osId)}</a>
              </div>`).join('')
            : `<span class="crm-det-loading-txt">Nenhuma O.S. encontrada para este cliente.</span>`);
      }
    } else {
      if (clienteEl) {
        clienteEl.className = 'crm-det-cliente-wrap crm-det-cliente-novo';
        clienteEl.innerHTML = `<span class="crm-det-loading-txt">🆕 Novo cliente — cadastro será criado ao salvar.</span>`;
      }
      if (histEl) {
        histEl.innerHTML = `<div class="crm-section-label">🔧 Histórico de O.S.</div>
          <span class="crm-det-loading-txt">Cliente ainda não registrado em O.S.</span>`;
      }
    }
  } catch(e) {
    console.warn('Erro ao carregar cliente no detalhe:', e);
  }
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
  editingId          = id;
  _clienteEncontrado = null;

  const lead   = id ? leads.find(l => l.id === id) : null;
  const el     = document.getElementById('crm-form');
  const titulo = document.getElementById('crm-form-titulo');
  if (!el) return;

  if (titulo) titulo.textContent = id ? '✏️ Editar Lead' : '🆕 Novo Lead';

  const setV = (fid, v) => { const e = document.getElementById(fid); if (e) e.value = v ?? ''; };
  setV('f-nome',     lead?.nome);
  setV('f-telefone', lead?.telefone);
  setV('f-aparelho', lead?.aparelho);
  setV('f-servico',  lead?.servico);
  setV('f-valor',    lead?.valor ?? '');
  setV('f-obs',      lead?.obs);
  const sel = document.getElementById('f-status');
  if (sel) sel.value = lead?.status || 'novo_contato';
  const motivoSel = document.getElementById('f-motivo-perda');
  if (motivoSel) motivoSel.value = lead?.motivoPerda || '';
  toggleMotivoPerda(lead?.status || 'novo_contato');

  ocultarLookupBanner();
  el.classList.add('ativo');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('f-nome')?.focus();

  if (lead?.telefone) setTimeout(() => window.onPhoneLookup(lead.telefone), 150);
};

window.fecharForm = function() {
  const el = document.getElementById('crm-form');
  if (el) el.classList.remove('ativo');
  editingId          = null;
  _clienteEncontrado = null;
  ocultarLookupBanner();
};

window.submitForm = async function(e) {
  e.preventDefault();
  const nome     = (document.getElementById('f-nome')?.value     || '').trim();
  const telefone = (document.getElementById('f-telefone')?.value || '').trim();
  if (!nome || !telefone) { showToast('⚠️ Nome e telefone são obrigatórios'); return; }

  const v = parseFloat((document.getElementById('f-valor')?.value || '').replace(',', '.')) || 0;
  const status = document.getElementById('f-status')?.value || 'novo_contato';
  const data = {
    nome,
    telefone,
    aparelho:    (document.getElementById('f-aparelho')?.value    || '').trim(),
    servico:     (document.getElementById('f-servico')?.value     || '').trim(),
    valor:       v || null,
    obs:         (document.getElementById('f-obs')?.value         || '').trim(),
    motivoPerda: status === 'perdido'
      ? (document.getElementById('f-motivo-perda')?.value || null)
      : null,
    status
  };

  const btn = document.querySelector('#crm-form button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }

  try {
    let leadId = editingId;
    if (editingId) {
      await updateDoc(doc(db, 'crm_leads', editingId), { ...data, atualizadoEm: serverTimestamp() });
    } else {
      const preOsId = await gerarPreOsId();
      const ref = await addDoc(collection(db, 'crm_leads'), {
        ...data,
        preOsId,
        criadoEm:     serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
      leadId = ref.id;
    }

    try { await linkOuCriarCliente(telefone, nome, leadId); }
    catch(err) { console.warn('Erro ao vincular cliente:', err); }

    fecharForm();
    showToast(editingId ? '✅ Lead atualizado e cliente vinculado' : '✅ Lead criado — cliente vinculado');
  } catch(err) {
    console.error(err);
    showToast('❌ Erro ao salvar');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar Lead'; }
  }
};

// ── Toggle motivo perda no form ──────────────────────────────
window.toggleMotivoPerda = function(statusVal) {
  const wrap = document.getElementById('crm-motivo-wrap');
  if (wrap) wrap.style.display = statusVal === 'perdido' ? '' : 'none';
};

// ── Phone lookup UX ──────────────────────────────────────────
let _phoneLookupTimer = null;

window.onPhoneLookup = function(val) {
  clearTimeout(_phoneLookupTimer);
  _clienteEncontrado = null;

  const banner = document.getElementById('crm-cliente-banner');
  if (!banner) return;

  if (val.replace(/\D/g, '').length < 8) {
    ocultarLookupBanner();
    return;
  }

  banner.style.display = '';
  banner.innerHTML     = `<span class="crm-lookup-loading">⏳ Verificando cadastro...</span>`;

  _phoneLookupTimer = setTimeout(async () => {
    const cliente = await lookupClientePorTelefone(val);
    const b       = document.getElementById('crm-cliente-banner');
    if (!b) return;

    if (cliente) {
      _clienteEncontrado = cliente;
      const nOs  = (cliente.history  || []).length;
      const nCrm = (cliente.crmLeads || []).length;
      b.innerHTML = `<div class="crm-lookup-ok">
        <span class="crm-lookup-titulo">✅ Cliente encontrado: <strong>${esc(cliente.name || '')}</strong></span>
        <span class="crm-lookup-meta">${nOs} O.S. &nbsp;·&nbsp; ${nCrm} lead(s) CRM</span>
      </div>`;
      const fNome = document.getElementById('f-nome');
      if (fNome && !fNome.value.trim() && cliente.name) fNome.value = cliente.name;
    } else {
      b.innerHTML = `<div class="crm-lookup-new">🆕 Novo cliente — cadastro criado automaticamente ao salvar</div>`;
    }
  }, 500);
};

function ocultarLookupBanner() {
  const b = document.getElementById('crm-cliente-banner');
  if (b) b.style.display = 'none';
}

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
    nome:            lead.nome     || '',
    telefone:        lead.telefone || '',
    modelo:          lead.aparelho || '',
    defeito:         lead.servico  || '',
    valor:           lead.valor    ? String(lead.valor) : '',
    obs:             lead.obs      || '',
    senha:           lead.lockType === 'Padrao' ? '' : (lead.senha || ''),
    lockType:        lead.lockType || '',
    patternSequence: lead.lockType === 'Padrao' ? (lead.patternSequence || null) : null,
    crmLeadId:       id,
    preOsId:         lead.preOsId || ''
  }));

  try {
    await updateDoc(doc(db, 'crm_leads', id), {
      osConvertido:   true,
      osConvertidoEm: serverTimestamp(),
      atualizadoEm:   serverTimestamp()
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
  body.textContent        = 'Este lead será excluído permanentemente. Confirmar?';
  modal.dataset.pendingId = id;
  modal.classList.add('open');
};

window.confirmarModal = async function() {
  const modal = document.getElementById('crm-modal');
  const id    = modal?.dataset.pendingId;
  if (!id) return;
  try {
    await removeLead(id);
    fecharDetalhe();
    showToast('🗑️ Lead excluído');
  } catch { showToast('❌ Erro ao excluir'); }
  fecharModal();
};

window.fecharModal = function() {
  document.getElementById('crm-modal')?.classList.remove('open');
};

// ── Navegação ────────────────────────────────────────────────
window.navTo = function(view) {
  currentView = view;
  fecharForm();
  fecharDetalhe();
  renderAll();
  document.getElementById('crm-sb')?.classList.remove('open');
  document.getElementById('crm-sb-overlay')?.classList.remove('open');
};

window.toggleSb = function() {
  document.getElementById('crm-sb')?.classList.toggle('open');
  document.getElementById('crm-sb-overlay')?.classList.toggle('open');
};

window.togglePanel = function(id) {
  document.getElementById(id)?.classList.toggle('aberto');
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
  document.getElementById('crm-sb-overlay')?.addEventListener('click', () => {
    document.getElementById('crm-sb')?.classList.remove('open');
    document.getElementById('crm-sb-overlay')?.classList.remove('open');
  });
  // Toast de retorno da tela de entrada
  const msg = sessionStorage.getItem('cc_crm_msg');
  if (msg) { sessionStorage.removeItem('cc_crm_msg'); setTimeout(() => showToast(msg), 600); }
});
