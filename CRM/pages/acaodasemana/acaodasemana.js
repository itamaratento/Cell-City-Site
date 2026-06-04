// ===== AGENDA INTELIGENTE — Cell City (calendário com Sticky Notes) =====
// 1 documento por DIA: { data, notas: [ {texto, cor}, ... ], atualizadoEm }
// Cada anotação tem o horário no início do texto (ex.: "09:00 Buscar películas").
import {
  db, collection, doc, setDoc, deleteDoc,
  onSnapshot, serverTimestamp
} from '../../scripts/firebase.js';

// ── 5 cores estilo lembretes do Windows ────────────────────────────
const CORES = {
  verde:    { hex: '#22C55E', bg: '#b9f6ca', fg: '#0b3d1f', emoji: '🟢', nome: 'Rotina' },
  amarelo:  { hex: '#EAB308', bg: '#fff59d', fg: '#4a3b00', emoji: '🟡', nome: 'Atenção' },
  vermelho: { hex: '#EF4444', bg: '#ffcdd2', fg: '#7a0012', emoji: '🔴', nome: 'Urgente' },
  azul:     { hex: '#3B82F6', bg: '#bbdefb', fg: '#0d2a4a', emoji: '🔵', nome: 'Lembrete' },
  branco:   { hex: '#E5E7EB', bg: '#f6f6f6', fg: '#1a1a1a', emoji: '⚪', nome: 'Informação' },
};
const ORDEM = ['verde', 'amarelo', 'vermelho', 'azul', 'branco'];
const COR_PADRAO = 'verde';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ── estado ─────────────────────────────────────────────────────────
let notas = {};                 // data -> [ {texto, cor} ]
let viewAno, viewMes;
let diaSelecionado = isoHoje();
let editando = false;
let saveTimer = null;
let notaFonte = Math.min(22, Math.max(12, parseInt(localStorage.getItem('ag_nota_fonte') || '15', 10)));

// ── elementos ──────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const gradeEl   = $('ag-cal-grade');
const tituloCal = $('ag-cal-titulo');
const diaTitulo = $('ag-dia-titulo');
const areaEl    = $('ag-nota-area');
const statusEl  = $('ag-nota-status');
const painelEl  = document.querySelector('.ag-nota-painel');
const toastEl   = $('ag-toast');

// ── util ───────────────────────────────────────────────────────────
function isoHoje() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function pad(n) { return String(n).padStart(2, '0'); }
function escHtml(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function fmtData(iso) { if (!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; }
function fmtDiaLongo(iso) {
  const [y,m,d] = iso.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  const sem = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][dt.getDay()];
  return `${sem}, ${d} de ${MESES[m-1]}`;
}
function corValida(c) { return CORES[c] ? c : COR_PADRAO; }

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('visivel');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), 1500);
}

// linhas "HH:MM texto" → compromissos com horário (para resumo/alertas)
function itensComHorario() {
  const out = [];
  for (const [data, arr] of Object.entries(notas)) {
    (arr || []).forEach(n => {
      const m = (n.texto || '').match(/^\s*(\d{1,2}):(\d{2})\s+(.*\S)/);
      if (m) { const hh = String(Math.min(23, +m[1])).padStart(2, '0'); out.push({ data, hora: `${hh}:${m[2]}`, titulo: m[3].trim(), concluido: !!n.concluido }); }
    });
  }
  return out;
}

// ── calendário: cada dia mostra suas anotações empilhadas ──────────
function renderCalendario() {
  tituloCal.textContent = `${MESES[viewMes]} ${viewAno}`;
  gradeEl.innerHTML = '';

  const primeiroDiaSemana = new Date(viewAno, viewMes, 1).getDay();
  const diasNoMes = new Date(viewAno, viewMes + 1, 0).getDate();
  const hoje = isoHoje();

  for (let i = 0; i < primeiroDiaSemana; i++) {
    const v = document.createElement('div'); v.className = 'ag-cel ag-cel-vazia'; gradeEl.appendChild(v);
  }

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const iso = `${viewAno}-${pad(viewMes+1)}-${pad(dia)}`;
    const arr = notas[iso] || [];
    const cel = document.createElement('div');
    cel.className = 'ag-cel';
    if (iso === hoje) cel.classList.add('ag-cel-hoje');
    if (iso === diaSelecionado) cel.classList.add('ag-cel-sel');

    const chips = arr.map(n => {
      const c = CORES[corValida(n.cor)];
      const m = (n.texto || '').match(/^\s*(\d{1,2}:\d{2})\s+([\s\S]*)$/);
      const inner = m ? `<b>${m[1]}</b> ${escHtml(m[2])}` : escHtml(n.texto);
      return `<div class="ag-chip" style="--bg:${c.bg};--fg:${c.fg}" title="${escHtml(n.texto)}"><span class="ag-chip-t">${inner}</span></div>`;
    }).join('');

    cel.innerHTML = `<span class="ag-cel-num">${dia}</span><div class="ag-cel-notas">${chips}</div>`;
    cel.addEventListener('click', () => selecionarDia(iso));
    gradeEl.appendChild(cel);
  }

  requestAnimationFrame(ajustarQuadrados);
}

// Cada card cresce com as anotações até uma altura máxima; o que passar vira "+N".
// O texto quebra linha e aparece inteiro (sem "…"), com fonte confortável fixa.
function ajustarQuadrados() {
  const mobile = window.matchMedia('(max-width: 600px)').matches;
  const MAXH = mobile ? 150 : 176;            // altura máx. da área de anotações
  const GAP = 3;

  gradeEl.querySelectorAll('.ag-cel-notas').forEach(wrap => {
    const antigo = wrap.querySelector('.ag-mais'); if (antigo) antigo.remove();
    const chips = [...wrap.querySelectorAll('.ag-chip')];
    chips.forEach(c => c.style.display = '');
    wrap.style.maxHeight = '';
    const total = chips.length;
    if (total === 0) return;

    // tudo cabe na altura máxima → deixa o card crescer naturalmente (sem "+N")
    if (wrap.scrollHeight <= MAXH) return;

    // senão: limita a altura e mostra só as anotações que couberem + "+N"
    const badge = document.createElement('div');
    badge.className = 'ag-mais';
    badge.textContent = '+0';
    wrap.appendChild(badge);
    const badgeH = badge.offsetHeight + GAP;

    let usado = 0, visiveis = 0;
    for (let i = 0; i < total; i++) {
      const h = chips[i].offsetHeight + GAP;
      if (usado + h <= MAXH - badgeH) { usado += h; visiveis++; } else break;
    }
    if (visiveis < 1) visiveis = 1;            // mostra ao menos 1 anotação

    chips.forEach((c, i) => { c.style.display = i < visiveis ? '' : 'none'; });
    badge.textContent = `+${total - visiveis}`;
    wrap.appendChild(badge);
    wrap.style.maxHeight = MAXH + 'px';
  });
}

function selecionarDia(iso) {
  flushSave();
  diaSelecionado = iso;
  editando = false;
  carregarEditor();
  renderCalendario();
  painelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (areaEl && !areaEl.value) areaEl.focus();
}

// ── editor: UMA única área de texto contínua por dia (estilo bloco de notas) ──
function carregarEditor() {
  diaTitulo.textContent = fmtDiaLongo(diaSelecionado);
  const arr = notas[diaSelecionado] || [];
  areaEl.value = arr.map(n => n.texto).join('\n');
  aplicarFonteLinhas();   // já chama autoGrow()
}

// Aplica a fonte escolhida (A− / A+) e reajusta a altura
function aplicarFonteLinhas() {
  areaEl.style.fontSize = notaFonte + 'px';
  autoGrow();
}

// Cresce a altura conforme o conteúdo (texto nunca sai do quadro;
// rola internamente se passar do máximo da tela).
function autoGrow() {
  areaEl.style.height = 'auto';
  const max = Math.max(180, Math.round(window.innerHeight * 0.5));
  areaEl.style.height = Math.min(areaEl.scrollHeight, max) + 'px';
  areaEl.style.overflowY = areaEl.scrollHeight > max ? 'auto' : 'hidden';
}

// ── salvamento automático ──────────────────────────────────────────
// Cada linha não-vazia vira uma anotação no mesmo formato de dados de
// sempre ({texto, cor}), preservando calendário, resumo e alertas.
function lerLinhas() {
  return areaEl.value
    .split(/\r?\n/)
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => ({ texto: t, cor: COR_PADRAO }));
}
function agendarSave() {
  statusEl.textContent = 'Salvando…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(salvar, 600);
}
function flushSave() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; salvar(); } }

async function salvar() {
  clearTimeout(saveTimer); saveTimer = null;
  const data = diaSelecionado;
  const arr = lerLinhas();
  const ref = doc(db, 'agenda', data);
  try {
    if (arr.length === 0) {
      if (notas[data]) await deleteDoc(ref);
      delete notas[data];
    } else {
      await setDoc(ref, { data, notas: arr, atualizadoEm: serverTimestamp() });
      notas[data] = arr;
    }
    statusEl.textContent = '✓ Salvo';
  } catch (e) { console.error(e); statusEl.textContent = '❌ Erro ao salvar'; }
}

// ── resumo ─────────────────────────────────────────────────────────
function renderResumo() {
  const hoje = isoHoje();
  const agora = Date.now();
  const todos = itensComHorario();
  const naoConcluidos = todos.filter(i => !i.concluido);
  const doHoje = naoConcluidos.filter(i => i.data === hoje);
  const passou = doHoje.filter(i => new Date(`${i.data}T${i.hora}:00`).getTime() < agora);
  $('ag-res-hoje').textContent      = doHoje.length;
  $('ag-res-avencer').textContent   = doHoje.length - passou.length;
  $('ag-res-atrasados').textContent = passou.length;
  const prox = naoConcluidos
    .map(i => ({ ...i, ts: new Date(`${i.data}T${i.hora}:00`).getTime() }))
    .filter(i => i.ts >= agora)
    .sort((a, b) => a.ts - b.ts)[0];
  $('ag-res-proximo').textContent = prox ? `${fmtData(prox.data)} ${prox.hora} — ${prox.titulo}` : 'Nenhum';
}

// ── alerta quando chega o horário (inclui atrasados de dias anteriores) ──
const alertasDisparados = new Set();
const _fmtAtraso = (min) => {
  const abs = Math.abs(min);
  if (abs >= 1440) return `${Math.floor(abs/1440)}d ${Math.floor((abs%1440)/60)}h`;
  if (abs >= 60)   return `${Math.floor(abs/60)}h${abs%60 ? ' '+(abs%60)+'min' : ''}`;
  return `${abs} min`;
};
function verificarAlertas() {
  const agora = new Date();
  const agoraTs = Date.now();
  const hoje = isoHoje();

  // Filtra APENAS itens NÃO concluídos
  const todos = itensComHorario().filter(i => !i.concluido);

  // 1. PRIORIDADE: atrasados de QUALQUER dia (não só hoje)
  const atrasados = todos.filter(i => {
    return new Date(`${i.data}T${i.hora}:00`).getTime() < agoraTs;
  }).sort((a, b) => new Date(`${a.data}T${a.hora}:00`) - new Date(`${b.data}T${b.hora}:00`));

  if (atrasados.length > 0) {
    const pior = atrasados[0];
    const diffMin = Math.round((agoraTs - new Date(`${pior.data}T${pior.hora}:00`).getTime()) / 60000);
    const chave = `atrasado_${pior.data}_${pior.hora}_${pior.titulo}`;
    if (!alertasDisparados.has(chave)) {
      alertasDisparados.add(chave);
      $('ag-alerta-hora').textContent = pior.hora;
      $('ag-alerta-titulo').textContent = `${pior.titulo} (${pior.data})`;
      $('ag-alerta-status').textContent = `Atrasado há ${_fmtAtraso(diffMin)}`;
      $('ag-alerta-vivo').hidden = false;
      tocarSom();
    }
    return; // prioridade total ao atrasado
  }

  // 2. Horário atual (hoje, 0-60 min) — apenas não concluídos
  todos.filter(i => i.data === hoje).forEach(i => {
    const [h, m] = i.hora.split(':').map(Number);
    const alvo = new Date(agora); alvo.setHours(h, m, 0, 0);
    const diffMin = Math.round((agoraTs - alvo.getTime()) / 60000);
    const chave = `${i.data}_${i.hora}_${i.titulo}`;
    if (diffMin >= 0 && diffMin <= 60 && !alertasDisparados.has(chave)) {
      alertasDisparados.add(chave);
      $('ag-alerta-hora').textContent = i.hora;
      $('ag-alerta-titulo').textContent = i.titulo;
      $('ag-alerta-status').textContent = diffMin <= 0 ? 'Agora!' : `Atrasado há ${_fmtAtraso(diffMin)}`;
      $('ag-alerta-vivo').hidden = false;
      tocarSom();
    }
  });
}
function tocarSom() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
  } catch {}
}

// ── fonte (A- / A+) ────────────────────────────────────────────────
function mudarFonte(delta) {
  notaFonte = Math.min(22, Math.max(12, notaFonte + delta));
  localStorage.setItem('ag_nota_fonte', String(notaFonte));
  aplicarFonteLinhas();
}

// ── navegação ──────────────────────────────────────────────────────
function navegar(delta) {
  viewMes += delta;
  if (viewMes < 0)  { viewMes = 11; viewAno--; }
  if (viewMes > 11) { viewMes = 0;  viewAno++; }
  renderCalendario();
}

// ── snapshot em tempo real ─────────────────────────────────────────
function iniciar() {
  const hoje = new Date();
  viewAno = hoje.getFullYear();
  viewMes = hoje.getMonth();
  carregarEditor();

  onSnapshot(collection(db, 'agenda'),
    (snap) => {
      notas = {};
      snap.forEach(d => {
        const dados = d.data();
        const data = dados.data || d.id;
        let arr = [];
        if (Array.isArray(dados.notas)) {
          arr = dados.notas.filter(n => n && (n.texto || '').trim())
                           .map(n => ({ texto: n.texto, cor: corValida(n.cor) }));
        } else if (typeof dados.texto === 'string') {           // formato anterior (1 nota multiline)
          const cor = corValida(dados.cor);
          arr = dados.texto.split(/\r?\n+/).map(t => t.trim()).filter(Boolean).map(t => ({ texto: t, cor }));
        } else if (dados.titulo) {                              // formato bem antigo
          arr = [{ texto: `${dados.hora ? dados.hora + ' ' : ''}${dados.titulo}`, cor: COR_PADRAO }];
        }
        if (arr.length) notas[data] = arr;
      });
      $('ag-loading')?.remove();
      renderCalendario();
      renderResumo();
      verificarAlertas();
      if (!editando) carregarEditor();
    },
    (err) => { console.warn('⚠️ Agenda offline', err); statusEl.textContent = '⚠️ Sem conexão'; }
  );

  setInterval(() => { renderResumo(); verificarAlertas(); renderCalendario(); }, 60000);
}

// trava/destrava re-render do editor conforme o foco.
// NÃO recarrega o editor no blur (evita apagar texto ainda não salvo);
// mudanças vindas de outro dispositivo chegam pelo onSnapshot.
painelEl.addEventListener('focusin', () => { editando = true; });
painelEl.addEventListener('focusout', () => {
  setTimeout(() => { if (!painelEl.contains(document.activeElement)) editando = false; }, 150);
});

// Área de texto única: salva sozinho e cresce com o conteúdo
areaEl.addEventListener('input', () => { agendarSave(); autoGrow(); });
areaEl.addEventListener('blur', () => { flushSave(); });

// ── eventos de UI ──────────────────────────────────────────────────
$('ag-prev').addEventListener('click', () => navegar(-1));
$('ag-next').addEventListener('click', () => navegar(1));
$('ag-hoje').addEventListener('click', () => {
  const h = new Date(); viewAno = h.getFullYear(); viewMes = h.getMonth();
  selecionarDia(isoHoje());
});
$('ag-alerta-fechar').addEventListener('click', () => { $('ag-alerta-vivo').hidden = true; });
$('ag-fonte-menos').addEventListener('click', () => mudarFonte(-2));
$('ag-fonte-mais').addEventListener('click', () => mudarFonte(2));

let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(ajustarQuadrados, 150); });

iniciar();
