import { db, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from '../../scripts/firebase.js';
import { initModulo } from '/CRM/scripts/kernel.js';

const DIAS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const PRIO = { alta: '🔴', media: '🟡', baixa: '🟢' };

let _uid = null;
let tarefas = [];
let diaSelecionado = null;
let docRef = null;

const diasEl  = document.getElementById('ms-dias');
const formEl  = document.getElementById('ms-form');
const listaEl = document.getElementById('ms-lista');
const descEl  = document.getElementById('ms-descricao');
const prioEl  = document.getElementById('ms-prioridade');
const tituloFormEl = document.getElementById('ms-form-titulo');

// ── renderiza botões dos dias ──────────────────────────────────────
function renderDias() {
  diasEl.innerHTML = '';
  DIAS.forEach(dia => {
    const btn = document.createElement('button');
    btn.className = 'ms-dia-btn' + (diaSelecionado === dia ? ' ativo' : '');
    btn.dataset.dia = dia;

    const count = tarefas.filter(t => t.dia === dia && !t.concluida).length;
    btn.innerHTML = dia + (count > 0 ? `<span class="ms-dia-badge">${count}</span>` : '');

    btn.addEventListener('click', () => {
      diaSelecionado = dia;
      formEl.style.display = 'flex';
      tituloFormEl.textContent = `Nova tarefa — ${dia}`;
      descEl.focus();
      renderDias();
      renderLista();
    });
    diasEl.appendChild(btn);
  });
}

// ── renderiza lista de tarefas ─────────────────────────────────────
function renderLista() {
  listaEl.innerHTML = '';

  // Agrupa por dia, mantendo a ordem da semana
  const diasComTarefa = DIAS.filter(d => tarefas.some(t => t.dia === d));

  if (diasComTarefa.length === 0) {
    listaEl.innerHTML = `<div class="ms-vazio">
      <div class="ms-vazio-icon">📋</div>
      Nenhuma tarefa ainda.<br>Selecione um dia para começar.
    </div>`;
    return;
  }

  diasComTarefa.forEach(dia => {
    const grupo = tarefas.filter(t => t.dia === dia);
    if (!grupo.length) return;

    const section = document.createElement('div');
    section.className = 'ms-grupo';

    const titulo = document.createElement('div');
    titulo.className = 'ms-grupo-titulo';
    titulo.textContent = dia;
    section.appendChild(titulo);

    grupo.forEach(t => {
      const item = document.createElement('div');
      item.className = 'ms-tarefa' + (t.concluida ? ' concluida' : '');

      const chk = document.createElement('input');
      chk.type = 'checkbox'; chk.className = 'ms-tarefa-check'; chk.checked = !!t.concluida;
      chk.addEventListener('change', () => {
        t.concluida = chk.checked;
        salvar();
        renderDias();
        renderLista();
      });

      const prio = document.createElement('span');
      prio.className = 'ms-tarefa-prio';
      prio.textContent = PRIO[t.prioridade] || '🟡';

      const txt = document.createElement('span');
      txt.className = 'ms-tarefa-texto';
      txt.textContent = t.descricao;

      const del = document.createElement('button');
      del.className = 'ms-tarefa-del'; del.textContent = '✕';
      del.addEventListener('click', () => {
        tarefas = tarefas.filter(x => x.id !== t.id);
        salvar();
        renderDias();
        renderLista();
      });

      item.append(chk, prio, txt, del);
      section.appendChild(item);
    });

    listaEl.appendChild(section);
  });
}

// ── adicionar tarefa ───────────────────────────────────────────────
function adicionar() {
  const desc = descEl.value.trim();
  if (!desc || !diaSelecionado) return;
  tarefas.push({
    id:        Date.now().toString(),
    dia:       diaSelecionado,
    prioridade: prioEl.value,
    descricao: desc,
    concluida: false
  });
  descEl.value = '';
  salvar();
  renderDias();
  renderLista();
  descEl.focus();
}

// ── salvar no Firestore ────────────────────────────────────────────
async function salvar() {
  if (!docRef) return;
  try {
    await setDoc(docRef, { tarefas, atualizadoEm: serverTimestamp() });
  } catch {}
}

// ── carregar do Firestore (tempo real) ─────────────────────────────
let unsub = null;
function carregar() {
  if (unsub) { unsub(); unsub = null; }
  docRef = doc(db, 'tarefas_semana', _uid);
  unsub = onSnapshot(docRef, (snap) => {
    tarefas = snap.exists() ? (snap.data().tarefas || []) : [];
    renderDias();
    renderLista();
  }, () => { tarefas = []; renderDias(); renderLista(); });
}

// ── eventos ────────────────────────────────────────────────────────
document.getElementById('ms-adicionar').addEventListener('click', adicionar);
descEl.addEventListener('keypress', e => { if (e.key === 'Enter') adicionar(); });
document.getElementById('ms-cancelar').addEventListener('click', () => {
  formEl.style.display = 'none';
  diaSelecionado = null;
  renderDias();
});

initModulo().then(ctx => {
  if (!ctx) return;
  _uid = ctx.uid;
  carregar();
});
