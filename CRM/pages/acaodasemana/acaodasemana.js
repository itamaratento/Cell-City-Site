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
let docIds = {};                // data -> [ idsReaisNoFirestore ] (corrige órfãos)
let corPorDia = {};             // data -> cor (do calendário / bloco)
let corDiaSel = COR_PADRAO;     // cor escolhida para o dia aberto no editor
let viewAno, viewMes;
let diaSelecionado = isoHoje();
let editando = false;
let saveTimer = null;
let buscaTermo = '';            // termo atual da busca (minúsculo)

// Cores disponíveis para alternar rapidamente (4, na ordem pedida)
const CORES_EDITOR = ['verde', 'amarelo', 'azul', 'vermelho'];
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
    if (buscaTermo && arr.some(n => (n.texto || '').toLowerCase().includes(buscaTermo))) {
      cel.classList.add('ag-cel-match');
    }

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
  corDiaSel = corValida(corPorDia[diaSelecionado] || COR_PADRAO);
  pintarArea();
  aplicarFonteLinhas();   // já chama autoGrow()
}

// Pinta o bloco com a cor do dia e marca o botão ativo
function pintarArea() {
  const c = CORES[corDiaSel];
  areaEl.style.background = c.bg;
  areaEl.style.color = c.fg;
  document.querySelectorAll('.ag-cor-btn').forEach(b => {
    b.classList.toggle('ativa', b.dataset.cor === corDiaSel);
  });
}

// Troca a cor do dia (aplica e salva)
function escolherCor(cor) {
  corDiaSel = corValida(cor);
  corPorDia[diaSelecionado] = corDiaSel;
  pintarArea();
  agendarSave();
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
    .map(t => ({ texto: t, cor: corDiaSel }));
}
function agendarSave() {
  statusEl.textContent = 'Salvando…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(salvar, 600);
}
function flushSave() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; salvar(); } }

// Remove TODOS os documentos que representam esse dia, inclusive órfãos com
// ID aleatório (formato antigo) cujo campo `data` aponta para o mesmo dia.
async function apagarDocsDoDia(data) {
  const ids = new Set([data, ...(docIds[data] || [])]);
  await Promise.all([...ids].map(id => deleteDoc(doc(db, 'agenda', id)).catch(() => {})));
}

async function salvar() {
  clearTimeout(saveTimer); saveTimer = null;
  const data = diaSelecionado;
  const arr = lerLinhas();
  try {
    if (arr.length === 0) {
      // Apaga o doc canônico E quaisquer órfãos/duplicados desse dia.
      await apagarDocsDoDia(data);
      delete notas[data];
      delete docIds[data];
      delete corPorDia[data];
    } else {
      // Grava sempre no ID canônico (= a data) e remove órfãos com outro ID.
      await setDoc(doc(db, 'agenda', data), { data, notas: arr, cor: corDiaSel, atualizadoEm: serverTimestamp() });
      const orfaos = (docIds[data] || []).filter(id => id !== data);
      await Promise.all(orfaos.map(id => deleteDoc(doc(db, 'agenda', id)).catch(() => {})));
      notas[data] = arr;
      docIds[data] = [data];
      corPorDia[data] = corDiaSel;
    }
    statusEl.textContent = '✓ Salvo';
  } catch (e) { console.error(e); statusEl.textContent = '❌ Erro ao salvar'; }
}

// ── busca ──────────────────────────────────────────────────────────
// Procura o termo em qualquer anotação; vai ao 1º dia encontrado,
// abre o mês correspondente e destaca os dias com correspondência.
function buscar(termo) {
  buscaTermo = (termo || '').trim().toLowerCase();
  const info = $('ag-busca-info');

  if (!buscaTermo) {
    if (info) info.textContent = '';
    renderCalendario();
    return;
  }

  const dias = Object.keys(notas)
    .filter(d => (notas[d] || []).some(n => (n.texto || '').toLowerCase().includes(buscaTermo)))
    .sort();

  if (info) info.textContent = dias.length
    ? `${dias.length} dia(s) encontrado(s)`
    : 'Nada encontrado';

  if (dias.length) {
    const alvo = dias[0];
    const [y, m] = alvo.split('-').map(Number);
    viewAno = y; viewMes = m - 1;
    diaSelecionado = alvo;
    carregarEditor();
    renderCalendario();
    // Rola suavemente até o calendário, centralizando o dia encontrado
    requestAnimationFrame(() => {
      const cel = gradeEl.querySelector('.ag-cel-match') || document.querySelector('.ag-cal');
      cel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return;
  }
  renderCalendario();
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
      docIds = {};
      corPorDia = {};
      snap.forEach(d => {
        const dados = d.data();
        const data = dados.data || d.id;
        let arr = [];
        let corDoc = corValida(dados.cor);
        if (Array.isArray(dados.notas)) {
          arr = dados.notas.filter(n => n && (n.texto || '').trim())
                           .map(n => ({ texto: n.texto, cor: corValida(dados.cor || n.cor) }));
          if (!dados.cor && dados.notas[0]) corDoc = corValida(dados.notas[0].cor);
        } else if (typeof dados.texto === 'string') {           // formato anterior (1 nota multiline)
          arr = dados.texto.split(/\r?\n+/).map(t => t.trim()).filter(Boolean).map(t => ({ texto: t, cor: corDoc }));
        } else if (dados.titulo) {                              // formato bem antigo
          arr = [{ texto: `${dados.hora ? dados.hora + ' ' : ''}${dados.titulo}`, cor: corDoc }];
        }
        // Rastreia o ID real (corrige delete de órfãos/duplicados)
        (docIds[data] = docIds[data] || []).push(d.id);
        if (arr.length) { notas[data] = arr; corPorDia[data] = corDoc; }
      });
      $('ag-loading')?.remove();
      renderCalendario();
      if (!editando) carregarEditor();
    },
    (err) => { console.warn('⚠️ Agenda offline', err); statusEl.textContent = '⚠️ Sem conexão'; }
  );

  // Atualiza o destaque de "hoje" à meia-noite (re-render leve)
  setInterval(() => renderCalendario(), 60000);
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

// Seletor de cores do dia (4 cores)
document.querySelectorAll('.ag-cor-btn').forEach(b => {
  b.addEventListener('click', () => escolherCor(b.dataset.cor));
});

// ── eventos de UI ──────────────────────────────────────────────────
$('ag-prev').addEventListener('click', () => navegar(-1));
$('ag-next').addEventListener('click', () => navegar(1));
// Ir ao mês atual, selecionar hoje e focar a anotação (1 clique)
function irHojeFoco() {
  const h = new Date(); viewAno = h.getFullYear(); viewMes = h.getMonth();
  selecionarDia(isoHoje());
  areaEl.focus();
}
$('ag-hoje').addEventListener('click', irHojeFoco);
$('ag-fonte-menos').addEventListener('click', () => mudarFonte(-2));
$('ag-fonte-mais').addEventListener('click', () => mudarFonte(2));

// Clicar no título "Agenda Inteligente" → mês atual + hoje + foco na anotação
const tituloPagina = document.querySelector('.ag-header-titulo');
if (tituloPagina) {
  tituloPagina.style.cursor = 'pointer';
  tituloPagina.title = 'Ir para hoje';
  tituloPagina.addEventListener('click', irHojeFoco);
}

// Busca (com debounce); Enter aplica na hora
let buscaTimer;
const buscaInput = $('ag-busca');
if (buscaInput) {
  buscaInput.addEventListener('input', () => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => buscar(buscaInput.value), 250);
  });
  buscaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { clearTimeout(buscaTimer); buscar(buscaInput.value); }
  });
}

let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(ajustarQuadrados, 150); });

iniciar();
