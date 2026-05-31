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

// ══════════════════════════════════════════════════════════════════
// MINHA SEMANA — ACORDEÃO
// ══════════════════════════════════════════════════════════════════
(function iniciarSemana() {
  const DIAS = [
    { key: 'segunda', label: 'Segunda' },
    { key: 'terca',   label: 'Terça'   },
    { key: 'quarta',  label: 'Quarta'  },
    { key: 'quinta',  label: 'Quinta'  },
    { key: 'sexta',   label: 'Sexta'   },
    { key: 'sabado',  label: 'Sábado'  },
    { key: 'domingo', label: 'Domingo' },
  ];
  const PRIO = { alta: '🔴', media: '🟡', baixa: '🟢' };
  const JS_DIA = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
  const diaHoje = JS_DIA[new Date().getDay()];

  const semanaRef = doc(db, 'tarefas_semana', userId);
  let tarefas = {};
  const container = document.getElementById('as-semana-acordeao');
  if (!container) return;

  const renderSemana = () => {
    container.innerHTML = '';
    DIAS.forEach(({ key, label }) => {
      const lista  = tarefas[key] || [];
      const aberto = key === diaHoje;

      const bloco  = document.createElement('div');
      bloco.className = 'as-dia';

      const titulo = document.createElement('div');
      titulo.className = 'as-dia-titulo' + (aberto ? ' aberto' : '');
      const pendentes = lista.filter(t => !t.concluido).length;
      titulo.innerHTML = `<span>${label}</span>
        <div class="as-dia-meta">
          ${pendentes > 0 ? `<span class="as-dia-count">${pendentes}</span>` : ''}
          <span class="as-dia-arrow">▶</span>
        </div>`;

      const corpo = document.createElement('div');
      corpo.className = 'as-dia-corpo' + (aberto ? ' aberto' : '');

      const listaEl = document.createElement('div');
      listaEl.className = 'as-dia-lista';

      lista.forEach((t, idx) => {
        const item = document.createElement('div');
        item.className = 'as-tarefa' + (t.concluido ? ' concluida' : '');

        const chk = document.createElement('input');
        chk.type = 'checkbox'; chk.className = 'as-tarefa-check'; chk.checked = !!t.concluido;
        chk.addEventListener('change', () => {
          tarefas[key][idx].concluido = chk.checked;
          salvarSemana(); renderSemana();
        });

        const prio = document.createElement('span');
        prio.className = 'as-tarefa-prio';
        prio.textContent = PRIO[t.prioridade] || '🟡';

        const desc = document.createElement('span');
        desc.className = 'as-tarefa-desc';
        desc.textContent = t.descricao;

        const del = document.createElement('button');
        del.className = 'as-tarefa-del'; del.textContent = '✕';
        del.addEventListener('click', () => {
          tarefas[key].splice(idx, 1);
          salvarSemana(); renderSemana();
        });

        item.append(chk, prio, desc, del);
        listaEl.appendChild(item);
      });

      // formulário
      const form = document.createElement('div');
      form.className = 'as-add-form';
      form.innerHTML = `
        <input type="text" placeholder="Nova tarefa..." maxlength="80">
        <select>
          <option value="media">🟡</option>
          <option value="alta">🔴</option>
          <option value="baixa">🟢</option>
        </select>
        <button class="as-add-btn">＋</button>`;

      const addFn = () => {
        const inp  = form.querySelector('input');
        const sel  = form.querySelector('select');
        const desc = inp.value.trim();
        if (!desc) return;
        if (!tarefas[key]) tarefas[key] = [];
        tarefas[key].push({ descricao: desc, prioridade: sel.value, concluido: false, criadoEm: new Date().toISOString() });
        inp.value = '';
        salvarSemana(); renderSemana();
        toast('✅ Tarefa adicionada!');
      };
      form.querySelector('.as-add-btn').addEventListener('click', addFn);
      form.querySelector('input').addEventListener('keypress', e => { if (e.key === 'Enter') addFn(); });

      corpo.appendChild(listaEl);
      corpo.appendChild(form);

      titulo.addEventListener('click', () => {
        const esta = corpo.classList.contains('aberto');
        corpo.classList.toggle('aberto', !esta);
        titulo.classList.toggle('aberto', !esta);
      });

      bloco.appendChild(titulo);
      bloco.appendChild(corpo);
      container.appendChild(bloco);
    });
  };

  const salvarSemana = async () => {
    try { await setDoc(semanaRef, { tarefas, atualizadoEm: serverTimestamp() }); } catch {}
  };

  getDoc(semanaRef).then(snap => {
    tarefas = snap.exists() ? (snap.data().tarefas || {}) : {};
    renderSemana();
  }).catch(() => renderSemana());
})();

// ══════════════════════════════════════════════════════════════════
// ANOTAÇÕES RÁPIDAS
// ══════════════════════════════════════════════════════════════════
(function iniciarNotas() {
  const area     = document.getElementById('as-notas-area');
  const statusEl = document.getElementById('as-notas-status');
  if (!area) return;

  const notasRef = doc(db, 'notas_usuarios', userId);
  let saveTimer;

  const setStatus = msg => { if (statusEl) statusEl.textContent = msg; };

  getDoc(notasRef).then(snap => {
    if (snap.exists()) area.value = snap.data().conteudo || '';
    setStatus('✓ sincronizado');
  }).catch(() => setStatus(''));

  area.addEventListener('input', () => {
    clearTimeout(saveTimer);
    setStatus('digitando...');
    saveTimer = setTimeout(async () => {
      setStatus('salvando...');
      try {
        await setDoc(notasRef, { conteudo: area.value, atualizadoEm: serverTimestamp(), userId });
        setStatus('✓ salvo');
      } catch { setStatus('⚠ erro'); }
    }, 1000);
  });
})();
