import {
  db, collection, addDoc, doc, updateDoc, deleteDoc, getDoc,
  query, orderBy, onSnapshot, serverTimestamp
} from '../../scripts/firebase.js';

// ── Status do processo ────────────────────────────────────────
const CHIP_STATUS = [
  { key: 'novo_cadastro',          label: 'Novo Cadastro',          icon: '🆕', dotColor: '#60a5fa',  badgeClass: 'chip-badge-novo' },
  { key: 'dados_coletados',        label: 'Dados Coletados',        icon: '📋', dotColor: '#a78bfa',  badgeClass: 'chip-badge-dados' },
  { key: 'aguardando_ativacao',    label: 'Aguardando Ativação',    icon: '⏳', dotColor: '#fbbf24',  badgeClass: 'chip-badge-aguardando' },
  { key: 'ativado',                label: 'Ativado',                icon: '✅', dotColor: '#00c853',  badgeClass: 'chip-badge-ativado' },
  { key: 'erro_cadastro',          label: 'Erro no Cadastro',       icon: '❌', dotColor: '#f87171',  badgeClass: 'chip-badge-erro' },
  { key: 'cliente_nao_retornou',   label: 'Cliente não retornou',   icon: '🔕', dotColor: '#fb923c',  badgeClass: 'chip-badge-naoretornou' },
  { key: 'finalizado',             label: 'Finalizado',             icon: '🏁', dotColor: '#6b7280',  badgeClass: 'chip-badge-finalizado' }
];

function getStatus(key) { return CHIP_STATUS.find(s => s.key === key) || CHIP_STATUS[0]; }

const MOTIVOS_ERRO = [
  { key: 'cpf_divergente',         label: 'CPF divergente' },
  { key: 'nascimento_incorreto',   label: 'Data de nascimento incorreta' },
  { key: 'estado_incorreto',       label: 'Estado incorreto' },
  { key: 'dados_inconsistentes',   label: 'Dados inconsistentes' },
  { key: 'documento_bloqueado',    label: 'Documento bloqueado' },
  { key: 'outro',                  label: 'Outro' }
];

function getMotivoErro(key) { return MOTIVOS_ERRO.find(m => m.key === key)?.label || key || '—'; }

// ── Estado ────────────────────────────────────────────────────
let chips             = [];
let currentView       = '__home__';
let editingId         = null;
let searchQuery       = '';
let unsub             = null;
let _clienteVinculado = null;

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

function fmtDateStr(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function fmtValor(v) {
  if (!v && v !== 0) return '';
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

function fmtDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function mascaraCPF(cpf) {
  if (!cpf) return '';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.substring(0,3)}.***.**${d.substring(9)}-${d.substring(9,11)}`;
}

// ── Validação de CPF ─────────────────────────────────────────
function validarCPF(digits) {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(digits[10]);
}

window.formatarCPF = function(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 11);
  if (v.length > 9)      v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  input.value = v;

  const el = document.getElementById('chip-cpf-status');
  if (!el) return;
  const digits = v.replace(/\D/g, '');
  if (digits.length === 11) {
    const ok = validarCPF(digits);
    el.textContent = ok ? '✅ CPF válido' : '❌ CPF inválido — verifique antes de salvar';
    el.className   = 'chip-cpf-status ' + (ok ? 'chip-cpf-ok' : 'chip-cpf-erro');
  } else {
    el.textContent = '';
    el.className   = 'chip-cpf-status';
  }
};

// ── Lookup de cliente (base compartilhada) ────────────────────
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
  } catch { return null; }
}

// ── Firestore ─────────────────────────────────────────────────
function startListener() {
  if (unsub) unsub();
  const q = query(collection(db, 'chips_cadastros'), orderBy('criadoEm', 'desc'));
  unsub = onSnapshot(q, snap => {
    chips = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  }, err => console.warn('Chips snapshot:', err));
}

async function removeCadastro(id) {
  await deleteDoc(doc(db, 'chips_cadastros', id));
}

// ── Contagens ─────────────────────────────────────────────────
function count(key) {
  if (key === '__todos__') return chips.length;
  return chips.filter(c => c.status === key).length;
}

// ── Filtro / busca ────────────────────────────────────────────
function getFiltered() {
  let list = chips;
  if (currentView !== '__todos__' && currentView !== '__home__')
    list = list.filter(c => c.status === currentView);

  const q = searchQuery.trim();
  if (q) {
    const ql = q.toLowerCase();
    const qd = q.replace(/\D/g, '');
    list = list.filter(c => {
      if ((c.nome      || '').toLowerCase().includes(ql)) return true;
      if ((c.operadora || '').toLowerCase().includes(ql)) return true;
      if ((c.responsavel || '').toLowerCase().includes(ql)) return true;
      if (qd) {
        if ((c.cpf          || '').replace(/\D/g, '').includes(qd)) return true;
        if ((c.iccid        || '').replace(/\D/g, '').includes(qd)) return true;
        if ((c.numeroGerado || '').replace(/\D/g, '').includes(qd)) return true;
      }
      return false;
    });
  }
  return list;
}

// ── Render geral ──────────────────────────────────────────────
function renderAll() {
  renderSidebar();
  renderMainArea();
}

// ── Sidebar ───────────────────────────────────────────────────
function renderSidebar() {
  const sb = document.getElementById('chip-sb-cats');
  if (!sb) return;
  const allEl = document.getElementById('chip-sb-count-all');
  if (allEl) allEl.textContent = chips.length;

  document.querySelectorAll('.crm-sb-item[data-view]').forEach(item =>
    item.classList.toggle('active', item.dataset.view === currentView)
  );

  sb.innerHTML = CHIP_STATUS.map(s => {
    const n = count(s.key);
    return `<div class="crm-sb-item ${currentView === s.key ? 'active' : ''}" data-view="${s.key}" onclick="navTo('${s.key}')">
      <span class="crm-sb-icon">${s.icon}</span>
      <span class="crm-sb-label">${s.label}</span>
      <span class="crm-sb-count">${n}</span>
    </div>`;
  }).join('');
}

// ── Área principal ────────────────────────────────────────────
function renderMainArea() {
  const titulo    = document.getElementById('chip-main-titulo');
  const homeGrid  = document.getElementById('chip-home-grid');
  const listaArea = document.getElementById('chip-lista-area');
  const dashboard = document.getElementById('chip-dashboard');

  if (currentView === '__home__') {
    if (titulo)    titulo.textContent      = '📱 Cadastro de Chip';
    if (homeGrid)  homeGrid.style.display  = '';
    if (listaArea) listaArea.style.display = 'none';
    if (dashboard) dashboard.style.display = '';
    renderDashboard();
    renderHomeGrid();
  } else {
    const st    = CHIP_STATUS.find(s => s.key === currentView);
    const label = currentView === '__todos__'
      ? '📂 Todos os cadastros'
      : `${st?.icon || ''} ${st?.label || currentView}`;
    if (titulo)    titulo.textContent      = label;
    if (homeGrid)  homeGrid.style.display  = 'none';
    if (listaArea) listaArea.style.display = '';
    if (dashboard) dashboard.style.display = 'none';
    renderLista();
  }
}

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard() {
  const el = document.getElementById('chip-dashboard');
  if (!el) return;

  const hoje       = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const cadastrosHoje = chips.filter(c => {
    const d = c.criadoEm?.toDate?.() ?? new Date(c.criadoEm || 0);
    return d >= inicioHoje;
  }).length;

  const ativadosHoje = chips.filter(c => {
    if (!c.dataAtivacao) return false;
    const [y, m, d] = c.dataAtivacao.split('-').map(Number);
    return new Date(y, m - 1, d) >= inicioHoje;
  }).length;

  const pendentes = chips.filter(c =>
    ['novo_cadastro', 'dados_coletados', 'aguardando_ativacao'].includes(c.status)
  ).length;

  const erros = chips.filter(c => c.status === 'erro_cadastro').length;

  const totalAtivados = chips.filter(c =>
    c.status === 'ativado' || c.status === 'finalizado'
  ).length;

  // Stats por operadora
  const operadoras = ['TIM', 'Vivo', 'Claro', 'Oi', 'Nextel', 'Outra'];
  const operStats  = operadoras
    .map(op => ({ op, n: chips.filter(c => c.operadora === op).length }))
    .filter(x => x.n > 0);

  const operHtml = operStats.length ? `
    <div class="chip-oper-row">
      ${operStats.map(x => `
        <div class="chip-oper-pill chip-oper-${x.op.toLowerCase()}" onclick="onSearchInput('${x.op}')">
          ${esc(x.op)} <strong>${x.n}</strong>
        </div>`).join('')}
    </div>` : '';

  el.innerHTML = `
    <div class="chip-dash-grid">
      <div class="chip-dash-card chip-dash-azul" onclick="navTo('__todos__')">
        <span class="chip-dash-num">${cadastrosHoje}</span>
        <span class="chip-dash-label">Cadastros hoje</span>
      </div>
      <div class="chip-dash-card chip-dash-verde" onclick="navTo('ativado')">
        <span class="chip-dash-num">${ativadosHoje}</span>
        <span class="chip-dash-label">Ativados hoje</span>
      </div>
      <div class="chip-dash-card chip-dash-amarelo" onclick="navTo('aguardando_ativacao')">
        <span class="chip-dash-num">${pendentes}</span>
        <span class="chip-dash-label">Pendentes</span>
      </div>
      <div class="chip-dash-card chip-dash-vermelho" onclick="navTo('erro_cadastro')">
        <span class="chip-dash-num">${erros}</span>
        <span class="chip-dash-label">Erros</span>
      </div>
      <div class="chip-dash-card chip-dash-cinza" onclick="navTo('__todos__')">
        <span class="chip-dash-num">${totalAtivados}</span>
        <span class="chip-dash-label">Total ativados</span>
      </div>
    </div>
    ${operHtml}
  `;
}

// ── Home Grid ─────────────────────────────────────────────────
function renderHomeGrid() {
  const grid = document.getElementById('chip-home-grid');
  if (!grid) return;

  const novoCard = `<div class="crm-home-block crm-novo-cliente-block" onclick="abrirForm(null)">
    <span class="crm-home-icon">📱</span>
    <span class="crm-home-nome">Novo Chip</span>
    <span class="crm-home-count" style="color:var(--cell-green);background:rgba(0,200,83,0.15);font-size:20px;font-weight:900">＋</span>
  </div>`;

  const cards = CHIP_STATUS.map(s => {
    const n   = count(s.key);
    const cls = n === 0 ? 'crm-home-count crm-home-count-zero' : 'crm-home-count';
    return `<div class="crm-home-block" data-chipstatus="${s.key}" onclick="navTo('${s.key}')">
      <span class="crm-home-icon">${s.icon}</span>
      <span class="crm-home-nome">${s.label}</span>
      <span class="${cls}" style="color:${s.dotColor};background:${s.dotColor}1f">${n}</span>
    </div>`;
  });

  grid.innerHTML = novoCard + cards.join('');
}

// ── Lista de cadastros ────────────────────────────────────────
function renderLista() {
  const container = document.getElementById('chip-lista');
  const empty     = document.getElementById('chip-empty');
  if (!container) return;

  const list = getFiltered();
  if (!list.length) {
    container.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  container.innerHTML = list.map(chip => {
    const st      = getStatus(chip.status);
    const operCls = `chip-oper-${(chip.operadora || 'outra').toLowerCase()}`;
    const cpfMask = mascaraCPF(chip.cpf);
    return `<div class="crm-card chip-card" data-chipstatus="${chip.status}" onclick="abrirDetalhe('${chip.id}')">
      <div class="crm-card-top">
        <span class="crm-card-icon">${st.icon}</span>
        <div class="crm-card-main">
          <div class="crm-card-nome">${esc(chip.nome || '—')}</div>
          <div class="crm-card-meta">
            <span class="crm-badge ${st.badgeClass}">${st.label}</span>
            ${chip.operadora ? `<span class="crm-badge ${operCls}">${esc(chip.operadora)}</span>` : ''}
            <span class="crm-card-date">${fmtDate(chip.criadoEm)}</span>
            ${chip.valorVenda ? `<span class="crm-card-valor">💰 ${fmtValor(chip.valorVenda)}</span>` : ''}
          </div>
          ${cpfMask ? `<div class="crm-card-info">🆔 ${esc(cpfMask)}</div>` : ''}
          ${chip.iccid ? `<div class="crm-card-info" style="color:var(--text-tertiary);font-family:monospace;font-size:11.5px">ICCID: ${esc(chip.iccid)}</div>` : ''}
          ${chip.numeroGerado ? `<div class="crm-card-info">📞 ${esc(chip.numeroGerado)}</div>` : ''}
          ${chip.responsavel ? `<div class="crm-card-info" style="color:var(--text-tertiary)">👤 ${esc(chip.responsavel)}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Detalhe ───────────────────────────────────────────────────
function buildDetalheHtml(chip) {
  const st      = getStatus(chip.status);
  const operCls = `chip-oper-${(chip.operadora || 'outra').toLowerCase()}`;

  const statusOpts = CHIP_STATUS.map(s => `
    <div class="crm-status-opt ${chip.status === s.key ? 'selected' : ''}"
         onclick="alterarStatus('${chip.id}','${s.key}')">
      <span class="dot" style="background:${s.dotColor}"></span>
      ${s.icon} ${s.label}
    </div>`).join('');

  const historico = [...(chip.historico || [])].reverse();
  const historicoHtml = historico.length
    ? historico.map(h => `
        <div class="chip-hist-item">
          <span class="chip-hist-dot"></span>
          <div class="chip-hist-content">
            <span class="chip-hist-acao">${esc(h.acao)}</span>
            ${h.responsavel ? `<span class="chip-hist-resp">por ${esc(h.responsavel)}</span>` : ''}
            <span class="chip-hist-data">${fmtDateTime(h.data)}</span>
          </div>
        </div>`).join('')
    : '<span style="color:var(--text-tertiary);font-size:12px">Nenhum registro de alteração ainda.</span>';

  const temValorFinanceiro = chip.valorVenda || chip.comissao;

  return `
    <div class="crm-detalhe-topo">
      <div>
        <div class="crm-detalhe-nome">${esc(chip.nome || '—')}</div>
        <div class="crm-detalhe-phone" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          ${chip.operadora ? `<span class="crm-badge ${operCls}">${esc(chip.operadora)}</span>` : ''}
          <span class="crm-badge ${st.badgeClass}">${st.label}</span>
        </div>
      </div>
    </div>

    <!-- BOTÃO COPIAR DADOS — destaque principal -->
    <button class="chip-btn-copiar-grande" onclick="copiarDados('${chip.id}')">
      📋 Copiar Dados para o Portal da Operadora
    </button>

    <div class="crm-detalhe-grid" style="margin-top:14px">
      ${chip.cpf ? `<div class="crm-det-field">
        <span class="crm-det-label">CPF</span>
        <span class="crm-det-value" style="font-family:monospace;letter-spacing:0.04em">🆔 ${esc(chip.cpf)}</span>
      </div>` : ''}
      ${chip.dataNascimento ? `<div class="crm-det-field">
        <span class="crm-det-label">Data de Nascimento</span>
        <span class="crm-det-value">🎂 ${fmtDateStr(chip.dataNascimento)}</span>
      </div>` : ''}
      ${chip.estadoCpf ? `<div class="crm-det-field">
        <span class="crm-det-label">Estado do CPF</span>
        <span class="crm-det-value">📍 ${esc(chip.estadoCpf)}</span>
      </div>` : ''}
      ${chip.iccid ? `<div class="crm-det-field">
        <span class="crm-det-label">ICCID</span>
        <span class="crm-det-value" style="font-family:monospace;font-size:13px;word-break:break-all">${esc(chip.iccid)}</span>
      </div>` : ''}
      ${chip.numeroGerado ? `<div class="crm-det-field">
        <span class="crm-det-label">Número Gerado</span>
        <span class="crm-det-value">📞 ${esc(chip.numeroGerado)}</span>
      </div>` : ''}
      <div class="crm-det-field">
        <span class="crm-det-label">Data do Cadastro</span>
        <span class="crm-det-value" style="color:var(--text-tertiary)">${fmtDate(chip.criadoEm)}</span>
      </div>
      ${chip.dataAtivacao ? `<div class="crm-det-field">
        <span class="crm-det-label">Data da Ativação</span>
        <span class="crm-det-value" style="color:var(--cell-green)">✅ ${fmtDateStr(chip.dataAtivacao)}</span>
      </div>` : ''}
      ${chip.responsavel ? `<div class="crm-det-field">
        <span class="crm-det-label">Responsável</span>
        <span class="crm-det-value">👤 ${esc(chip.responsavel)}</span>
      </div>` : ''}
      ${temValorFinanceiro ? `<div class="crm-det-field">
        <span class="crm-det-label">Valor da Venda</span>
        <span class="crm-det-value valor">💰 ${chip.valorVenda ? fmtValor(chip.valorVenda) : '—'}</span>
      </div>` : ''}
      ${chip.comissao ? `<div class="crm-det-field">
        <span class="crm-det-label">Comissão</span>
        <span class="crm-det-value" style="color:#fbbf24">💵 ${fmtValor(chip.comissao)}</span>
      </div>` : ''}
    </div>

    ${chip.motivoErro ? `<div class="crm-det-field" style="margin-bottom:14px">
      <span class="crm-det-label">Motivo do Erro</span>
      <span class="crm-det-value" style="color:var(--accent-red)">❌ ${getMotivoErro(chip.motivoErro)}</span>
    </div>` : ''}

    ${chip.obs ? `<div class="crm-det-field" style="margin-bottom:14px">
      <span class="crm-det-label">Observações</span>
      <span class="crm-det-obs">💬 ${esc(chip.obs)}</span>
    </div>` : ''}

    <div class="crm-section-label">Alterar status</div>
    <div class="crm-status-sel" style="grid-template-columns:repeat(2,1fr)">${statusOpts}</div>

    <div class="crm-detalhe-acoes">
      <button class="crm-btn-editar" onclick="abrirForm('${chip.id}')">✏️ Editar Cadastro</button>
      <button class="crm-btn-excluir" onclick="confirmarExclusao('${chip.id}')">🗑️ Excluir</button>
    </div>

    <div class="chip-historico-wrap">
      <div class="crm-section-label">📅 Histórico de Alterações</div>
      ${historicoHtml}
    </div>
  `;
}

window.abrirDetalhe = function(id) {
  const chip = chips.find(c => c.id === id);
  if (!chip) return;
  fecharForm();

  const el = document.getElementById('chip-detalhe');
  if (!el) return;
  el.innerHTML = buildDetalheHtml(chip);
  el.classList.add('ativo');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.fecharDetalhe = function() {
  document.getElementById('chip-detalhe')?.classList.remove('ativo');
};

// ── Alterar status ────────────────────────────────────────────
window.alterarStatus = async function(id, key) {
  const chip = chips.find(c => c.id === id);
  if (!chip) return;
  try {
    const historico = [...(chip.historico || []), {
      acao:        `Status alterado para: ${getStatus(key).label}`,
      responsavel: chip.responsavel || '',
      data:        new Date().toISOString()
    }];
    await updateDoc(doc(db, 'chips_cadastros', id), {
      status:       key,
      historico,
      atualizadoEm: serverTimestamp()
    });
    showToast('✅ Status atualizado');
    chip.status    = key;
    chip.historico = historico;
    abrirDetalhe(id);
  } catch { showToast('❌ Erro ao atualizar status'); }
};

// ── Copiar dados para portal da operadora ─────────────────────
window.copiarDados = async function(id) {
  const chip = chips.find(c => c.id === id);
  if (!chip) return;

  const linhas = [
    chip.nome           ? `Nome: ${chip.nome}`                          : '',
    chip.cpf            ? `CPF: ${chip.cpf}`                            : '',
    chip.dataNascimento ? `Nascimento: ${fmtDateStr(chip.dataNascimento)}` : '',
    chip.estadoCpf      ? `Estado: ${chip.estadoCpf}`                   : '',
    chip.iccid          ? `ICCID: ${chip.iccid}`                        : '',
    chip.numeroGerado   ? `Número: ${chip.numeroGerado}`                 : ''
  ].filter(Boolean);

  try {
    await navigator.clipboard.writeText(linhas.join('\n'));
    showToast('📋 Dados copiados para a área de transferência');
  } catch {
    showToast('❌ Erro ao copiar — verifique permissões do navegador');
  }
};

// ── Formulário ────────────────────────────────────────────────
window.abrirForm = function(id = null) {
  fecharDetalhe();
  editingId         = id;
  _clienteVinculado = null;

  const chip   = id ? chips.find(c => c.id === id) : null;
  const el     = document.getElementById('chip-form');
  const titulo = document.getElementById('chip-form-titulo');
  if (!el) return;

  if (titulo) titulo.textContent = id ? '✏️ Editar Cadastro' : '📱 Novo Cadastro de Chip';

  const setV = (fid, v) => { const e = document.getElementById(fid); if (e) e.value = v ?? ''; };
  setV('f-operadora',     chip?.operadora);
  setV('f-status',        chip?.status || 'novo_cadastro');
  setV('f-nome',          chip?.nome);
  setV('f-cpf',           chip?.cpf);
  setV('f-nascimento',    chip?.dataNascimento);
  setV('f-estado-cpf',    chip?.estadoCpf);
  setV('f-iccid',         chip?.iccid);
  setV('f-numero-gerado', chip?.numeroGerado);
  setV('f-valor',         chip?.valorVenda ?? '');
  setV('f-comissao',      chip?.comissao   ?? '');
  setV('f-responsavel',   chip?.responsavel);
  setV('f-data-ativacao', chip?.dataAtivacao);
  setV('f-motivo-erro',   chip?.motivoErro);
  setV('f-obs',           chip?.obs);

  const cpfInput = document.getElementById('f-cpf');
  if (cpfInput && cpfInput.value) window.formatarCPF(cpfInput);

  toggleStatusDependentes(chip?.status || 'novo_cadastro');

  const buscaTel   = document.getElementById('chip-busca-telefone');
  if (buscaTel)     buscaTel.value = '';
  const vincBanner = document.getElementById('chip-vincular-banner');
  if (vincBanner)   vincBanner.style.display = 'none';

  el.classList.add('ativo');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('f-nome')?.focus();
};

window.fecharForm = function() {
  document.getElementById('chip-form')?.classList.remove('ativo');
  editingId         = null;
  _clienteVinculado = null;
};

window.toggleStatusDependentes = function(statusVal) {
  const wrapAtivacao = document.getElementById('wrap-data-ativacao');
  const wrapErro     = document.getElementById('wrap-motivo-erro');
  if (wrapAtivacao) wrapAtivacao.style.display = ['ativado','finalizado'].includes(statusVal) ? '' : 'none';
  if (wrapErro)     wrapErro.style.display     = statusVal === 'erro_cadastro' ? '' : 'none';
};

window.submitForm = async function(e) {
  e.preventDefault();

  const nome = (document.getElementById('f-nome')?.value || '').trim();
  if (!nome) { showToast('⚠️ Nome é obrigatório'); return; }

  const operadora = document.getElementById('f-operadora')?.value || '';
  if (!operadora) { showToast('⚠️ Selecione a operadora'); return; }

  const cpfInput = document.getElementById('f-cpf');
  const cpfRaw   = (cpfInput?.value || '').replace(/\D/g, '');
  if (cpfRaw && cpfRaw.length === 11 && !validarCPF(cpfRaw)) {
    showToast('❌ CPF inválido — corrija antes de salvar');
    cpfInput?.focus();
    return;
  }

  const status     = document.getElementById('f-status')?.value     || 'novo_cadastro';
  const responsavel = (document.getElementById('f-responsavel')?.value || '').trim();

  const data = {
    operadora,
    nome,
    cpf:           cpfInput?.value || '',
    dataNascimento: document.getElementById('f-nascimento')?.value    || '',
    estadoCpf:     document.getElementById('f-estado-cpf')?.value    || '',
    iccid:         (document.getElementById('f-iccid')?.value         || '').trim(),
    numeroGerado:  (document.getElementById('f-numero-gerado')?.value || '').trim(),
    status,
    motivoErro:    status === 'erro_cadastro'
      ? (document.getElementById('f-motivo-erro')?.value || '') : '',
    valorVenda:    parseFloat((document.getElementById('f-valor')?.value    || '').replace(',','.')) || null,
    comissao:      parseFloat((document.getElementById('f-comissao')?.value || '').replace(',','.')) || null,
    dataAtivacao:  ['ativado','finalizado'].includes(status)
      ? (document.getElementById('f-data-ativacao')?.value || '') : '',
    responsavel,
    obs:           (document.getElementById('f-obs')?.value           || '').trim(),
    clienteId:     _clienteVinculado?.id || (editingId ? chips.find(c => c.id === editingId)?.clienteId : '') || ''
  };

  const btn = document.querySelector('#chip-form button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }

  try {
    if (editingId) {
      const existing  = chips.find(c => c.id === editingId);
      const historico = [...(existing?.historico || []), {
        acao:        'Cadastro editado',
        responsavel: responsavel || 'Sistema',
        data:        new Date().toISOString()
      }];
      await updateDoc(doc(db, 'chips_cadastros', editingId), {
        ...data, historico, atualizadoEm: serverTimestamp()
      });
      showToast('✅ Cadastro atualizado');
    } else {
      await addDoc(collection(db, 'chips_cadastros'), {
        ...data,
        historico: [{
          acao:        'Cadastro criado',
          responsavel: responsavel || 'Sistema',
          data:        new Date().toISOString()
        }],
        criadoEm:    serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
      showToast('✅ Chip cadastrado com sucesso');
    }
    fecharForm();
  } catch(err) {
    console.error(err);
    showToast('❌ Erro ao salvar cadastro');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar Cadastro'; }
  }
};

// ── Vincular cliente existente ────────────────────────────────
let _vincularTimer = null;

window.onVincularLookup = function(val) {
  clearTimeout(_vincularTimer);
  _clienteVinculado = null;
  const banner = document.getElementById('chip-vincular-banner');
  if (!banner) return;
  if (val.replace(/\D/g, '').length < 8) { banner.style.display = 'none'; return; }

  banner.style.display = '';
  banner.innerHTML     = '<span class="crm-lookup-loading">⏳ Buscando cliente...</span>';

  _vincularTimer = setTimeout(async () => {
    const cliente = await lookupClientePorTelefone(val);
    const b       = document.getElementById('chip-vincular-banner');
    if (!b) return;
    if (cliente) {
      _clienteVinculado = cliente;
      b.innerHTML = `<div class="crm-lookup-ok">
        <span class="crm-lookup-titulo">✅ <strong>${esc(cliente.name || '')}</strong></span>
        ${cliente.cpf ? `<span class="crm-lookup-meta">CPF: ${esc(cliente.cpf)}</span>` : ''}
        <button type="button" class="chip-btn-vincular" onclick="preencherDoCliente()">Preencher dados →</button>
      </div>`;
    } else {
      b.innerHTML = '<div class="crm-lookup-new">Nenhum cliente encontrado com este número</div>';
    }
  }, 500);
};

window.preencherDoCliente = function() {
  if (!_clienteVinculado) return;
  const c   = _clienteVinculado;
  const setV = (id, v) => { const e = document.getElementById(id); if (e && v) e.value = v; };
  setV('f-nome', c.name);
  if (c.cpf) {
    const cpfInput = document.getElementById('f-cpf');
    if (cpfInput) { cpfInput.value = c.cpf; window.formatarCPF(cpfInput); }
  }
  showToast('✅ Dados do cliente preenchidos');
};

// ── Excluir ───────────────────────────────────────────────────
window.confirmarExclusao = function(id) {
  const modal = document.getElementById('crm-modal');
  const body  = document.getElementById('crm-modal-body');
  if (!modal || !body) return;
  body.textContent        = 'Este cadastro de chip será excluído permanentemente. Confirmar?';
  modal.dataset.pendingId = id;
  modal.classList.add('open');
};

window.confirmarModal = async function() {
  const modal = document.getElementById('crm-modal');
  const id    = modal?.dataset.pendingId;
  if (!id) return;
  try {
    await removeCadastro(id);
    fecharDetalhe();
    showToast('🗑️ Cadastro excluído');
  } catch { showToast('❌ Erro ao excluir'); }
  fecharModal();
};

window.fecharModal = function() {
  document.getElementById('crm-modal')?.classList.remove('open');
};

// ── Navegação ─────────────────────────────────────────────────
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

// ── Busca ─────────────────────────────────────────────────────
window.onSearchInput = function(val) {
  searchQuery = val;
  const input = document.getElementById('chip-search');
  if (input && input.value !== val) input.value = val;
  if (currentView === '__home__') {
    if (val.trim()) navTo('__todos__');
  } else {
    renderLista();
  }
};

// ── Toast ─────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('crm-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
window.showToast = showToast;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  startListener();
  document.getElementById('crm-sb-overlay')?.addEventListener('click', () => {
    document.getElementById('crm-sb')?.classList.remove('open');
    document.getElementById('crm-sb-overlay')?.classList.remove('open');
  });
});
