import { db, doc, getDoc, setDoc, serverTimestamp } from '../../scripts/firebase.js';

const PRIO_ICON = { alta: '🔴', media: '🟡', baixa: '🟢' };
const CAT_LABEL = { vendas: '📈 Vendas', operacional: '⚙️ Operacional', marketing: '📣 Marketing', financeiro: '💰 Financeiro', outro: '📌 Outro' };

const userId = localStorage.getItem('cc_nota_uid') || 'user_default';
const ref    = doc(db, 'acoes_semana', userId);

let acoes = [];

// ── elementos ──────────────────────────────────────────────────────
const listaEl    = document.getElementById('as-lista');
const formEl     = document.getElementById('as-form');
const btnNova    = document.getElementById('as-btn-nova');
const btnSalvar  = document.getElementById('as-btn-salvar');
const btnCancel  = document.getElementById('as-btn-cancelar');
const tituloInp  = document.getElementById('as-titulo-input');
const descInp    = document.getElementById('as-desc-input');
const prioInp    = document.getElementById('as-prio-input');
const catInp     = document.getElementById('as-categoria-input');
const toastEl    = document.getElementById('as-toast');

// ── toast ──────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('visivel');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), 2200);
}

// ── resumo ─────────────────────────────────────────────────────────
function atualizarResumo() {
  const total     = acoes.length;
  const concluidas = acoes.filter(a => a.concluida).length;
  const pendentes = total - concluidas;
  document.getElementById('as-total').textContent      = total;
  document.getElementById('as-concluidas').textContent = concluidas;
  document.getElementById('as-pendentes').textContent  = pendentes;
}

// ── render ─────────────────────────────────────────────────────────
function render() {
  atualizarResumo();
  listaEl.innerHTML = '';

  if (acoes.length === 0) {
    listaEl.innerHTML = `<div class="as-vazio">
      <div class="as-vazio-icon">🎯</div>
      Nenhuma ação ainda.<br>Clique em <strong>＋ Nova Ação</strong> para começar.
    </div>`;
    return;
  }

  // Pendentes primeiro, depois concluídas
  const ordenadas = [...acoes].sort((a, b) => {
    if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
    const p = { alta: 0, media: 1, baixa: 2 };
    return (p[a.prioridade] ?? 1) - (p[b.prioridade] ?? 1);
  });

  ordenadas.forEach(a => {
    const card = document.createElement('div');
    card.className = 'as-card' + (a.concluida ? ' concluida' : '');

    const data = a.criadoEm ? new Date(a.criadoEm).toLocaleDateString('pt-BR') : '';

    card.innerHTML = `
      <div class="as-card-topo">
        <div class="as-card-esq">
          <input type="checkbox" class="as-card-check" ${a.concluida ? 'checked' : ''}>
          <span class="as-card-titulo">${escHtml(a.titulo)}</span>
        </div>
        <div class="as-card-dir">
          <span class="as-card-prio">${PRIO_ICON[a.prioridade] || '🟡'}</span>
          <button class="as-card-del" title="Excluir">✕</button>
        </div>
      </div>
      ${a.descricao ? `<div class="as-card-desc">${escHtml(a.descricao)}</div>` : ''}
      <div class="as-card-rodape">
        <span class="as-card-cat">${CAT_LABEL[a.categoria] || a.categoria}</span>
        ${data ? `<span class="as-card-data">${data}</span>` : ''}
      </div>`;

    card.querySelector('.as-card-check').addEventListener('change', e => {
      acoes.find(x => x.id === a.id).concluida = e.target.checked;
      salvar();
      render();
      toast(e.target.checked ? '✅ Ação concluída!' : 'Ação reaberta.');
    });

    card.querySelector('.as-card-del').addEventListener('click', () => {
      acoes = acoes.filter(x => x.id !== a.id);
      salvar();
      render();
      toast('🗑️ Ação removida.');
    });

    listaEl.appendChild(card);
  });
}

// ── salvar ─────────────────────────────────────────────────────────
async function salvar() {
  try { await setDoc(ref, { acoes, atualizadoEm: serverTimestamp() }); } catch {}
}

// ── carregar ───────────────────────────────────────────────────────
async function carregar() {
  try {
    const snap = await getDoc(ref);
    acoes = snap.exists() ? (snap.data().acoes || []) : [];
  } catch { acoes = []; }
  render();
}

// ── adicionar ──────────────────────────────────────────────────────
function adicionar() {
  const titulo = tituloInp.value.trim();
  if (!titulo) { tituloInp.focus(); return; }
  acoes.push({
    id:         Date.now().toString(),
    titulo,
    descricao:  descInp.value.trim(),
    prioridade: prioInp.value,
    categoria:  catInp.value,
    concluida:  false,
    criadoEm:   new Date().toISOString()
  });
  tituloInp.value = '';
  descInp.value   = '';
  formEl.style.display = 'none';
  salvar();
  render();
  toast('✅ Ação adicionada!');
}

// ── escape html ────────────────────────────────────────────────────
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── eventos ────────────────────────────────────────────────────────
btnNova.addEventListener('click', () => {
  formEl.style.display = 'flex';
  tituloInp.focus();
  btnNova.style.display = 'none';
});
btnCancel.addEventListener('click', () => {
  formEl.style.display = 'none';
  btnNova.style.display = '';
});
btnSalvar.addEventListener('click', adicionar);
tituloInp.addEventListener('keypress', e => { if (e.key === 'Enter') adicionar(); });

carregar();
