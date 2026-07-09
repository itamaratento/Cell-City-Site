import { db, collection, getDocs, addDoc, query, orderBy, where, onSnapshot, serverTimestamp, limit } from '../../scripts/firebase.js';
import { initModulo, getUid, getNome } from '../../scripts/kernel.js';
import { carregarPermissoes, podeVisualizar } from '../../shared/permissoes.js';

const COL_MSGS = 'chat_mensagens';
const $ = id => document.getElementById(id);

let usuarios = [];
let conversas = {}; // {uid: {nome, ultimaMsg, naoLidas, msgs: []}}
let conversaAtiva = null; // uid do destinatário
let meuUid = '';
let meuNome = '';

// Listener ativo para a conversa atual
let unsubscribeMsgs = null;

// ── Boot ───────────────────────────────────────────────────────────
(async function boot() {
  const ctx = await initModulo();
  if (!ctx) return;
  await carregarPermissoes(ctx);
  if (!podeVisualizar('chat')) { window.location.href = '/CRM/pages/dashboard/index.html'; return; }
  meuUid = getUid();
  meuNome = getNome() || 'Você';

  try {
    const snap = await getDocs(collection(db, 'usuarios'));
    usuarios = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.id !== meuUid && u.status !== 'inativo');
  } catch { usuarios = []; }

  setupUI();
  carregarConversas();
})();

function setupUI() {
  $('ch-input')?.addEventListener('keypress', e => { if (e.key === 'Enter') enviarMsg(); });
  $('ch-send')?.addEventListener('click', enviarMsg);
}

async function carregarConversas() {
  try {
    const q = query(
      collection(db, COL_MSGS),
      where('participantes', 'array-contains', meuUid),
      orderBy('criadoEm', 'desc'),
      limit(200)
    );
    const snap = await getDocs(q);
    const mapa = {};
    snap.forEach(d => {
      const data = d.data();
      const outro = (data.de || '') === meuUid ? data.para : data.de;
      if (!outro) return;
      if (!mapa[outro]) mapa[outro] = { msgs: [], ultimaMsg: data, naoLidas: 0 };
      mapa[outro].msgs.push({ id: d.id, ...data });
    });

    conversas = {};
    Object.entries(mapa).forEach(([uid, conv]) => {
      const user = usuarios.find(u => u.id === uid);
      conversas[uid] = {
        nome: user?.nome_exibicao || user?.email || uid,
        msgs: conv.msgs.sort((a, b) => (a.criadoEm?.toDate?.() || 0) - (b.criadoEm?.toDate?.() || 0)),
        ultimaMsg: conv.ultimaMsg,
        naoLidas: conv.msgs.filter(m => m.para === meuUid && !m.lida).length
      };
    });

    renderSidebar();
  } catch { conversas = {}; }
}

function renderSidebar() {
  const el = $('ch-sidebar');
  const entries = Object.entries(conversas).sort((a, b) => {
    const ta = a[1].ultimaMsg?.criadoEm?.toDate?.() || 0;
    const tb = b[1].ultimaMsg?.criadoEm?.toDate?.() || 0;
    return tb - ta;
  });

  el.innerHTML = entries.map(([uid, conv]) => {
    const inicial = (conv.nome || '?')[0].toUpperCase();
    const ativo = uid === conversaAtiva ? 'active' : '';
    const ultTxt = conv.ultimaMsg?.texto?.slice(0, 40) || '—';
    return `<div class="ch-sidebar-item ${ativo}" data-uid="${uid}">
      <div class="ch-sidebar-avatar">${inicial}</div>
      <div class="ch-sidebar-info">
        <div class="ch-sidebar-nome">${esc(conv.nome)}</div>
        <div class="ch-sidebar-preview">${esc(ultTxt)}</div>
      </div>
    </div>`;
  }).join('');

  if (!entries.length) {
    el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">Nenhuma conversa ainda.</div>';
  }

  el.querySelectorAll('.ch-sidebar-item').forEach(item => {
    item.addEventListener('click', () => abrirConversa(item.dataset.uid));
  });
}

function abrirConversa(uid) {
  if (unsubscribeMsgs) { unsubscribeMsgs(); unsubscribeMsgs = null; }
  conversaAtiva = uid;
  renderSidebar();

  const conv = conversas[uid];
  $('ch-placeholder').style.display = 'none';
  $('ch-main-header').style.display = 'block';
  $('ch-messages').style.display = 'flex';
  $('ch-input-bar').style.display = 'flex';
  $('ch-main-header').textContent = `💬 ${conv?.nome || 'Conversa'}`;

  renderMsg(uid);

  // Listener em tempo real
  const q = query(
    collection(db, COL_MSGS),
    where('participantes', 'array-contains', meuUid),
    orderBy('criadoEm', 'desc'),
    limit(1)
  );
  unsubscribeMsgs = onSnapshot(q, () => {
    carregarConversas();
    if (conversaAtiva === uid) renderMsg(uid);
  });
}

function renderMsg(uid) {
  const el = $('ch-messages');
  const conv = conversas[uid];
  if (!conv || !conv.msgs.length) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3)">Nenhuma mensagem ainda. Envie algo!</div>';
    return;
  }
  el.innerHTML = conv.msgs.map(m => {
    const souEu = m.de === meuUid;
    return `<div class="ch-msg ${souEu ? 'ch-msg-self' : 'ch-msg-other'}">
      ${!souEu ? '<div class="ch-msg-sender">' + esc(conv.nome) + '</div>' : ''}
      ${esc(m.texto || '')}
      <div class="ch-msg-time">${fmtTs(m.criadoEm)}</div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

async function enviarMsg() {
  const input = $('ch-input');
  const texto = input?.value?.trim();
  if (!texto || !conversaAtiva) return;
  input.value = '';

  try {
    await addDoc(collection(db, COL_MSGS), {
      de: meuUid,
      para: conversaAtiva,
      participantes: [meuUid, conversaAtiva],
      texto,
      lida: false,
      criadoEm: serverTimestamp()
    });
  } catch { toast('❌ Erro ao enviar mensagem.'); }
}

function fmtTs(ts) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

function toast(msg) {
  const t = $('ch-toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(() => t.classList.remove('show'), 2500);
}
