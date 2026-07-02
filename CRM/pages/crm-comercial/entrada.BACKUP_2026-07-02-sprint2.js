import {
  db, collection, addDoc, doc, updateDoc, getDoc, setDoc,
  serverTimestamp, runTransaction
} from '../../scripts/firebase.js';
import { normalizePhoneDigits, canonicalizePhone } from '../../shared/phone-utils.js';
import { initModulo } from '../../scripts/kernel.js';

// ── Status / Destino ──────────────────────────────────────────
const STATUSES = [
  { key: 'novo_contato',        label: 'Novo\nContato',   icon: '🆕', color: '#60a5fa', rgb: '96,165,250' },
  { key: 'orcamento_enviado',   label: 'Orçamento',       icon: '📤', color: '#fbbf24', rgb: '251,191,36' },
  { key: 'aguardando_resposta', label: 'Aguardando',      icon: '⏳', color: '#a78bfa', rgb: '167,139,250' },
  { key: 'negociacao',          label: 'Negociação',      icon: '🤝', color: '#fb923c', rgb: '251,146,60' },
  { key: 'fechado',             label: 'Fechado',         icon: '✅', color: '#00c853', rgb: '0,200,83' },
  { key: 'pre_os',              label: 'Pré-OS',          icon: '📋', color: '#f59e0b', rgb: '245,158,11' },
];

// ── Estado ────────────────────────────────────────────────────
let selectedStatus    = 'novo_contato';
let clienteEncontrado = null;
let tempPattern       = null;

// ── Pattern lock ──────────────────────────────────────────────
let _patCanvas = null, _patCtx = null, _patPoints = [];
let _patSeq = [], _patPath = [], _patDrawing = false;

// ── Utilidades ────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

let _toastTimer = null;
function showToast(msg) {
  const el = $('ent-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ── Status chips ──────────────────────────────────────────────
function renderChips() {
  const grid = $('ent-chips');
  if (!grid) return;
  grid.innerHTML = STATUSES.map(s => {
    const lines = s.label.split('\n');
    const labelHtml = lines.length > 1
      ? `${lines[0]}<br>${lines[1]}`
      : s.label;
    return `<div class="ent-chip${selectedStatus === s.key ? ' selected' : ''}"
         style="--chip-color:${s.color};--chip-rgb:${s.rgb}"
         onclick="selectStatus('${s.key}')">
      <span class="ent-chip-icon">${s.icon}</span>
      <span>${labelHtml}</span>
    </div>`;
  }).join('');
}

window.selectStatus = function(key) {
  selectedStatus = key;
  renderChips();
  updateBtn();
};

function updateBtn() {
  const btn = $('ent-btn-submit');
  if (!btn) return;
  if (selectedStatus === 'pre_os') {
    btn.textContent = '🔧 Abrir OS';
    btn.classList.add('btn-os');
  } else {
    btn.textContent = 'Salvar Lead';
    btn.classList.remove('btn-os');
  }
}

// ── Tipo de bloqueio ──────────────────────────────────────────
window.onLockChange = function() {
  const lt      = $('ent-lock')?.value || '';
  const senhaW  = $('ent-senha-wrap');
  const padW    = $('ent-padrao-wrap');
  const senhaEl = $('ent-senha');

  if (lt === 'Padrao') {
    if (senhaW)  senhaW.style.display  = 'none';
    if (padW)    padW.style.display    = '';
    if (senhaEl) senhaEl.value         = '';
  } else if (lt === 'Numerica') {
    if (senhaW)  senhaW.style.display  = '';
    if (padW)    padW.style.display    = 'none';
  } else {
    if (senhaW)  senhaW.style.display  = 'none';
    if (padW)    padW.style.display    = 'none';
  }
};

// ── Mais informações ──────────────────────────────────────────
window.toggleMais = function() {
  const c   = $('ent-mais-content');
  const btn = $('ent-mais-btn');
  if (!c) return;
  const open = c.style.display === 'none';
  c.style.display = open ? '' : 'none';
  if (btn) {
    btn.textContent = open ? '− Menos informações' : '＋ Mais informações';
    btn.classList.toggle('open', open);
  }
};

// ── Lookup de telefone ────────────────────────────────────────
// Doc-ID = phoneDigits (canônico, ver shared/phone-utils.js).
async function lookupCliente(phone) {
  const digits = normalizePhoneDigits(phone);
  if (digits.length < 10) return null;
  try {
    const snap = await getDoc(doc(db, 'clientes', digits));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
  } catch(e) { console.warn('Lookup:', e); }
  return null;
}

let _telTimer = null;
window.onTelInput = function(val) {
  clearTimeout(_telTimer);
  clienteEncontrado = null;
  const banner = $('ent-lookup-banner');
  if (!banner) return;

  if (val.replace(/\D/g, '').length < 8) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = '';
  banner.innerHTML = '<div class="ent-lookup-loading">⏳ Verificando...</div>';

  _telTimer = setTimeout(async () => {
    const cliente = await lookupCliente(val);
    const b = $('ent-lookup-banner');
    if (!b) return;

    if (cliente) {
      clienteEncontrado = cliente;
      const nOs  = (cliente.history  || []).length;
      const nCrm = (cliente.crmLeads || []).length;

      const nomeEl = $('ent-nome');
      if (nomeEl && !nomeEl.value.trim() && cliente.name) nomeEl.value = cliente.name;

      const meta = [
        nOs  ? `🔧 ${nOs} O.S.`                     : '',
        nCrm ? `🎯 ${nCrm} lead${nCrm > 1 ? 's' : ''}` : '',
        !nOs && !nCrm ? 'Sem histórico de serviços'  : '',
      ].filter(Boolean).map(t => `<span>${t}</span>`).join('');

      b.innerHTML = `<div class="ent-lookup-found">
        <div class="ent-lookup-found-badge">✅ Cliente encontrado</div>
        <div class="ent-lookup-found-name">${esc(cliente.name || '—')}</div>
        <div class="ent-lookup-found-meta">${meta}</div>
      </div>`;
    } else {
      b.innerHTML = '<div class="ent-lookup-new">🆕 Novo cliente — será cadastrado automaticamente</div>';
    }
  }, 500);
};

// ── Pattern lock functions ────────────────────────────────────
function initPatCanvas() {
  _patCanvas = $('ent-pattern-canvas');
  if (!_patCanvas) return;
  _patCtx = _patCanvas.getContext('2d');
  const sz = 300, pd = 50, sp = (sz - 2 * pd) / 2;
  _patPoints = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      _patPoints.push({ x: pd + c * sp, y: pd + r * sp, index: r * 3 + c });
  _patSeq = []; _patPath = [];
  drawDots();
  _patCanvas.addEventListener('mousedown', patStart);
  _patCanvas.addEventListener('mousemove', patMove);
  _patCanvas.addEventListener('mouseup',   patStop);
  _patCanvas.addEventListener('mouseout',  patStop);
  _patCanvas.addEventListener('touchstart', e => { e.preventDefault(); patStart(touchEv(e)); }, { passive: false });
  _patCanvas.addEventListener('touchmove',  e => { e.preventDefault(); patMove(touchEv(e)); },  { passive: false });
  _patCanvas.addEventListener('touchend',   e => { e.preventDefault(); patStop(); },             { passive: false });
}

function touchEv(e) {
  const r = _patCanvas.getBoundingClientRect();
  return { offsetX: e.touches[0].clientX - r.left, offsetY: e.touches[0].clientY - r.top };
}

function nearestPt(x, y) {
  let c = null, m = Infinity;
  for (const p of _patPoints) {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < 28 && d < m) { m = d; c = p; }
  }
  return c;
}

function patStart(e) {
  _patDrawing = true; _patPath = []; _patSeq = [];
  const p = nearestPt(e.offsetX, e.offsetY);
  if (p) { _patPath.push(p); _patSeq.push(p.index); drawDots(); }
}

function patMove(e) {
  if (!_patDrawing) return;
  const p = nearestPt(e.offsetX, e.offsetY);
  if (p && !_patPath.includes(p)) { _patPath.push(p); _patSeq.push(p.index); drawDots(); }
}

function patStop() {
  if (!_patDrawing) return;
  _patDrawing = false;
  if (_patSeq.length < 2) {
    showToast('⚠️ Conecte pelo menos 2 pontos');
    _patSeq = []; _patPath = []; drawDots();
  }
}

function drawDots() {
  if (!_patCtx || !_patCanvas) return;
  _patCtx.clearRect(0, 0, _patCanvas.width, _patCanvas.height);
  if (_patPath.length > 1) {
    _patCtx.strokeStyle = '#00C853'; _patCtx.lineWidth = 3;
    _patCtx.lineCap = 'round'; _patCtx.lineJoin = 'round';
    _patCtx.shadowBlur = 10; _patCtx.shadowColor = 'rgba(0,200,83,0.5)';
    _patCtx.beginPath();
    _patCtx.moveTo(_patPath[0].x, _patPath[0].y);
    for (let i = 1; i < _patPath.length; i++) _patCtx.lineTo(_patPath[i].x, _patPath[i].y);
    _patCtx.stroke(); _patCtx.shadowBlur = 0;
  }
  for (const p of _patPoints) {
    const conn = _patPath.includes(p);
    const last = p === _patPath[_patPath.length - 1];
    _patCtx.beginPath();
    _patCtx.arc(p.x, p.y, conn ? 14 : 10, 0, Math.PI * 2);
    if      (last) { _patCtx.fillStyle = '#00E676'; _patCtx.shadowBlur = 15; _patCtx.shadowColor = 'rgba(0,200,83,0.6)'; }
    else if (conn) { _patCtx.fillStyle = '#00C853'; _patCtx.shadowBlur = 8;  _patCtx.shadowColor = 'rgba(0,200,83,0.4)'; }
    else           { _patCtx.fillStyle = '#6b7280'; _patCtx.shadowBlur = 0; }
    _patCtx.fill(); _patCtx.shadowBlur = 0;
  }
}

window.openEntradaPattern = function() {
  $('ent-pattern-overlay')?.classList.add('open');
  setTimeout(() => { initPatCanvas(); }, 80);
};

window.closeEntradaPattern = function(e) {
  if (e && e.target?.id !== 'ent-pattern-overlay') return;
  $('ent-pattern-overlay')?.classList.remove('open');
};

window.clearEntradaPattern = function() { _patSeq = []; _patPath = []; drawDots(); };

window.saveEntradaPattern = function() {
  if (_patSeq.length < 4) { showToast('⚠️ O padrão precisa de pelo menos 4 pontos'); return; }
  tempPattern = [..._patSeq];
  $('ent-pattern-overlay')?.classList.remove('open');
  refreshPadraoSummary();
  showToast('✅ Padrão registrado!');
};

function refreshPadraoSummary() {
  const el = $('ent-padrao-summary');
  if (!el) return;
  if (tempPattern?.length) {
    el.style.display = '';
    el.innerHTML = `
      <div class="ent-padrao-ok-title">✅ Padrão registrado (${tempPattern.length} pontos)</div>
      <div class="ent-padrao-ok-btns">
        <button type="button" onclick="openEntradaPattern()">✏️ Editar</button>
        <button type="button" onclick="limparPadrao()">🗑️ Limpar</button>
      </div>`;
  } else {
    el.style.display = 'none';
    el.innerHTML = '';
  }
}

window.limparPadrao = function() {
  tempPattern = null;
  refreshPadraoSummary();
  showToast('🗑️ Padrão removido');
};

// ── Firebase helpers ──────────────────────────────────────────
async function gerarPreOsId() {
  const ref = doc(db, 'config', 'crm_pre_os_counter');
  let num = 1;
  try {
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      num = (snap.exists() ? (snap.data().ultimo || 0) : 0) + 1;
      tx.set(ref, { ultimo: num }, { merge: true });
    });
  } catch(e) { num = Date.now() % 10000; }
  return `PRE-OS-${String(num).padStart(3, '0')}`;
}

async function linkOuCriarCliente(phone, nome, leadId) {
  const existente = clienteEncontrado || await lookupCliente(phone);
  if (existente) {
    const crmLeads = existente.crmLeads || [];
    if (!crmLeads.includes(leadId)) crmLeads.push(leadId);
    const upd = { crmLeads, atualizadoEm: serverTimestamp() };
    if (!existente.name && nome) upd.name = nome;
    if (!existente.phoneDigits) upd.phoneDigits = normalizePhoneDigits(existente.phone || phone);
    await updateDoc(doc(db, 'clientes', existente.id), upd);
    return existente.id;
  }
  const { phone: telCanon, phoneDigits: chave } = canonicalizePhone(phone);
  await setDoc(doc(db, 'clientes', chave), {
    name: nome, phone: telCanon, phoneDigits: chave, history: [], crmLeads: [leadId],
    cpf: '', email: '', endereco: '', obsCliente: '',
    createdAt: new Date().toISOString(), origem: 'crm'
  });
  return chave;
}

// ── Submit ────────────────────────────────────────────────────
window.submitEntrada = async function(e) {
  e.preventDefault();

  const telefone = ($('ent-tel')?.value      || '').trim();
  const nome     = ($('ent-nome')?.value     || '').trim();

  if (!telefone) { showToast('⚠️ Informe o telefone'); $('ent-tel')?.focus(); return; }
  if (!nome)     { showToast('⚠️ Informe o nome do cliente'); $('ent-nome')?.focus(); return; }

  const aparelho = ($('ent-aparelho')?.value || '').trim();
  const servico  = ($('ent-servico')?.value  || '').trim();
  const lockType = $('ent-lock')?.value      || '';
  const senha    = lockType === 'Numerica'
    ? ($('ent-senha')?.value || '').trim()
    : '';
  const obs   = ($('ent-obs')?.value   || '').trim();
  const valor = parseFloat(($('ent-valor')?.value || '').replace(',', '.')) || 0;

  const btn = $('ent-btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }

  try {
    const preOsId = await gerarPreOsId();

    const data = {
      nome, telefone, aparelho, servico,
      lockType:        lockType        || null,
      senha:           senha           || null,
      patternSequence: (lockType === 'Padrao' && tempPattern?.length) ? tempPattern : null,
      obs:             obs             || null,
      valor:           valor           || null,
      status:          selectedStatus,
      motivoPerda:     null,
      preOsId,
      criadoEm:     serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    };

    if (selectedStatus === 'pre_os') {
      data.osConvertido   = true;
      data.osConvertidoEm = serverTimestamp();
    }

    const ref    = await addDoc(collection(db, 'crm_leads'), data);
    const leadId = ref.id;

    try { await linkOuCriarCliente(telefone, nome, leadId); }
    catch(err) { console.warn('Erro ao vincular cliente:', err); }

    if (selectedStatus === 'pre_os') {
      sessionStorage.setItem('cc_crm_prefill', JSON.stringify({
        nome, telefone,
        modelo:          aparelho,
        defeito:         servico,
        valor:           valor ? String(valor) : '',
        obs:             obs || '',
        senha:           senha || '',
        lockType:        lockType || '',
        patternSequence: (lockType === 'Padrao' && tempPattern?.length) ? tempPattern : null,
        crmLeadId:       leadId,
        preOsId
      }));
      showToast('🔧 Abrindo O.S...');
      setTimeout(() => { window.location.href = '/CRM/pages/os/index.html'; }, 600);
      return;
    }

    sessionStorage.setItem('cc_crm_msg', `✅ Cliente cadastrado — ${nome}`);
    window.location.href = '/CRM/pages/crm-comercial/index.html';

  } catch(err) {
    console.error('Erro ao salvar:', err);
    showToast('❌ Erro ao salvar. Tente novamente.');
    if (btn) { btn.disabled = false; updateBtn(); }
  }
};

// ── Voltar ────────────────────────────────────────────────────
window.voltarCRM = function() {
  window.location.href = '/CRM/pages/crm-comercial/index.html';
};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Garante sessão real (não só a flag de UX) antes de permitir salvar.
  // Sem isso, uma sessão expirada (persistência de aba) passava pelo
  // gate do HTML e só falhava na hora do addDoc, com "insufficient permissions".
  const ctx = await initModulo();
  if (!ctx) return; // kernel.js já redirecionou para login

  renderChips();
  // Foco automático no telefone ao abrir
  setTimeout(() => $('ent-tel')?.focus(), 250);
});
