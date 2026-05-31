import { db, doc, getDoc, setDoc, serverTimestamp } from '../../scripts/firebase.js';

const PRIO_ICON = { alta: '🔴', media: '🟡', baixa: '🟢' };
const CAT_LABEL = { vendas: '📈 Vendas', operacional: '⚙️ Operacional', marketing: '📣 Marketing', financeiro: '💰 Financeiro', outro: '📌 Outro' };
const DIAS_LABEL = { segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sabado: 'Sáb', domingo: 'Dom' };

const userId = localStorage.getItem('cc_nota_uid') || 'user_default';
const ref    = doc(db, 'acoes_semana', userId);

let acoes = [];
let editandoId = null; // id da ação em edição, null = nova ação

// ── elementos ──────────────────────────────────────────────────────
const listaEl   = document.getElementById('as-lista');
const formEl    = document.getElementById('as-form');
const btnNova   = document.getElementById('as-btn-nova');
const btnSalvar = document.getElementById('as-btn-salvar');
const btnCancel = document.getElementById('as-btn-cancelar');
const tituloInp = document.getElementById('as-titulo-input');
const descInp   = document.getElementById('as-desc-input');
const prioInp   = document.getElementById('as-prio-input');
const catInp    = document.getElementById('as-categoria-input');
const toastEl   = document.getElementById('as-toast');
const formTitulo = formEl.querySelector('.as-form-titulo');

// ── toast ──────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('visivel');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), 2200);
}

// ── dias marcados ──────────────────────────────────────────────────
function getDiasMarcados() {
  return [...formEl.querySelectorAll('input[name="dia"]:checked')].map(cb => cb.value);
}

function setDiasMarcados(dias = []) {
  formEl.querySelectorAll('input[name="dia"]').forEach(cb => {
    cb.checked = dias.includes(cb.value);
  });
}

// ── abrir/fechar form ──────────────────────────────────────────────
function abrirForm(acao = null) {
  editandoId = acao ? acao.id : null;
  formTitulo.textContent = acao ? 'Editar Ação' : 'Nova Ação da Semana';
  tituloInp.value = acao ? acao.titulo    : '';
  descInp.value   = acao ? acao.descricao : '';
  prioInp.value   = acao ? acao.prioridade : 'media';
  catInp.value    = acao ? acao.categoria  : 'vendas';
  setDiasMarcados(acao ? (acao.diasSemana || []) : []);
  formEl.style.display = 'flex';
  btnNova.style.display = 'none';
  tituloInp.focus();
}

function fecharForm() {
  formEl.style.display = 'none';
  btnNova.style.display = '';
  editandoId = null;
}

// ── resumo ─────────────────────────────────────────────────────────
function atualizarResumo() {
  const total      = acoes.length;
  const concluidas = acoes.filter(a => a.concluida).length;
  document.getElementById('as-total').textContent      = total;
  document.getElementById('as-concluidas').textContent = concluidas;
  document.getElementById('as-pendentes').textContent  = total - concluidas;
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

  const ordenadas = [...acoes].sort((a, b) => {
    if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
    const p = { alta: 0, media: 1, baixa: 2 };
    return (p[a.prioridade] ?? 1) - (p[b.prioridade] ?? 1);
  });

  ordenadas.forEach(a => {
    const card = document.createElement('div');
    card.className = 'as-card' + (a.concluida ? ' concluida' : '');

    const data = a.criadoEm ? new Date(a.criadoEm).toLocaleDateString('pt-BR') : '';
    const diasHtml = (a.diasSemana && a.diasSemana.length)
      ? `<div class="as-card-dias">${a.diasSemana.map(d => `<span class="as-dia-tag">${DIAS_LABEL[d] || d}</span>`).join('')}</div>`
      : '';

    card.innerHTML = `
      <div class="as-card-topo">
        <div class="as-card-esq">
          <input type="checkbox" class="as-card-check" ${a.concluida ? 'checked' : ''}>
          <span class="as-card-titulo">${escHtml(a.titulo)}</span>
        </div>
        <div class="as-card-dir">
          <span class="as-card-prio">${PRIO_ICON[a.prioridade] || '🟡'}</span>
          <button class="as-card-edit" title="Editar">✏️</button>
          <button class="as-card-del" title="Excluir">✕</button>
        </div>
      </div>
      ${a.descricao ? `<div class="as-card-desc">${escHtml(a.descricao)}</div>` : ''}
      ${diasHtml}
      <div class="as-card-rodape">
        <span class="as-card-cat">${CAT_LABEL[a.categoria] || a.categoria}</span>
        ${data ? `<span class="as-card-data">${data}</span>` : ''}
      </div>`;

    card.querySelector('.as-card-check').addEventListener('change', e => {
      acoes.find(x => x.id === a.id).concluida = e.target.checked;
      salvar(); render();
      toast(e.target.checked ? '✅ Ação concluída!' : 'Ação reaberta.');
    });

    card.querySelector('.as-card-edit').addEventListener('click', () => {
      abrirForm(acoes.find(x => x.id === a.id));
    });

    card.querySelector('.as-card-del').addEventListener('click', () => {
      acoes = acoes.filter(x => x.id !== a.id);
      salvar(); render();
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

// ── adicionar / editar ─────────────────────────────────────────────
function salvarAcao() {
  const titulo = tituloInp.value.trim();
  if (!titulo) { tituloInp.focus(); return; }

  if (editandoId) {
    // Edição
    const idx = acoes.findIndex(x => x.id === editandoId);
    if (idx !== -1) {
      acoes[idx] = {
        ...acoes[idx],
        titulo,
        descricao:   descInp.value.trim(),
        prioridade:  prioInp.value,
        categoria:   catInp.value,
        diasSemana:  getDiasMarcados(),
        editadoEm:   new Date().toISOString()
      };
    }
    toast('✏️ Ação atualizada!');
  } else {
    // Nova
    acoes.push({
      id:          Date.now().toString(),
      titulo,
      descricao:   descInp.value.trim(),
      prioridade:  prioInp.value,
      categoria:   catInp.value,
      diasSemana:  getDiasMarcados(),
      concluida:   false,
      criadoEm:    new Date().toISOString()
    });
    toast('✅ Ação adicionada!');
  }

  fecharForm();
  salvar();
  render();
}

// ── escape html ────────────────────────────────────────────────────
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── eventos ────────────────────────────────────────────────────────
btnNova.addEventListener('click', () => abrirForm());
btnCancel.addEventListener('click', fecharForm);
btnSalvar.addEventListener('click', salvarAcao);
tituloInp.addEventListener('keypress', e => { if (e.key === 'Enter') salvarAcao(); });

document.getElementById('as-busca')?.addEventListener('input', e => {
  const termo = e.target.value.trim().toLowerCase();
  document.querySelectorAll('.as-card').forEach(card => {
    const texto = card.querySelector('.as-card-titulo')?.textContent.toLowerCase() || '';
    card.style.display = (!termo || texto.includes(termo)) ? '' : 'none';
  });
});

carregar();
