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
let alertaPorDia = {};          // data -> { hora, dashboard }
let recorrenciaPorDia = {};     // data -> 'semanal' | 'mensal' | 'anual'
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
const gradeEl    = $('ag-cal-grade');
const mesBtn     = $('ag-mes-btn');
const anoBtn     = $('ag-ano-btn');
const dropdownEl = $('ag-dropdown');
const diaTitulo  = $('ag-dia-titulo');
const areaEl     = $('ag-nota-area');
const alertaHoraEl = $('ag-alerta-hora');
const alertaDashEl = $('ag-alerta-dash');
const recorrEl   = $('ag-recorr');
const recorrPop  = $('ag-recorr-pop');
const recorrPopTit = $('ag-recorr-pop-tit');
const recorrPopLista = $('ag-recorr-pop-lista');
const statusEl   = $('ag-nota-status');
const painelEl   = document.querySelector('.ag-nota-painel');
const toastEl    = $('ag-toast');

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

// Recorrência: a data `iso` recebe a tarefa criada em `origem`?
function _dataLanda(iso, origem, pattern) {
  if (iso < origem) return false;                 // só a partir da data de origem
  const a = new Date(iso + 'T00:00:00'), b = new Date(origem + 'T00:00:00');
  if (pattern === 'semanal') return a.getDay() === b.getDay();
  if (pattern === 'mensal')  return a.getDate() === b.getDate();
  if (pattern === 'anual')   return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  return false;
}
// Lembretes recorrentes que "caem" no dia iso (textos)
function recorrentesNoDia(iso) {
  const out = [];
  for (const origem of Object.keys(recorrenciaPorDia)) {
    if (_dataLanda(iso, origem, recorrenciaPorDia[origem])) {
      (notas[origem] || []).forEach(n => out.push(n.texto));
    }
  }
  return out;
}

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
  if (mesBtn) mesBtn.textContent = `${MESES[viewMes]} ▾`;
  if (anoBtn) anoBtn.textContent = `${viewAno} ▾`;
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
    if (buscaTermo) {
      const temMatch = arr.some(n => (n.texto || '').toLowerCase().includes(buscaTermo));
      cel.classList.add(temMatch ? 'ag-cel-match' : 'ag-cel-dim');
    }

    // Dias recorrentes NÃO enchem o quadrado: viram só um badge no canto.
    const ehRecorrente = !!recorrenciaPorDia[iso];
    const chipsArr = ehRecorrente ? [] : arr;
    const chips = chipsArr.map(n => {
      const c = CORES[corValida(n.cor)];
      const m = (n.texto || '').match(/^\s*(\d{1,2}:\d{2})\s+([\s\S]*)$/);
      const inner = m ? `<b>${m[1]}</b> ${escHtml(m[2])}` : escHtml(n.texto);
      return `<div class="ag-chip" style="--bg:${c.bg};--fg:${c.fg}" title="${escHtml(n.texto)}"><span class="ag-chip-t">${inner}</span></div>`;
    }).join('');

    const rec = recorrentesNoDia(iso);
    const badge = rec.length
      ? `<div class="ag-recorr-badge" data-dia="${iso}" title="${rec.length} lembrete(s) recorrente(s)">🔔 ${rec.length}</div>`
      : '';

    cel.innerHTML = `<span class="ag-cel-num">${dia}</span>${badge}<div class="ag-cel-notas">${chips}</div>`;
    cel.addEventListener('click', () => selecionarDia(iso));
    const badgeEl = cel.querySelector('.ag-recorr-badge');
    if (badgeEl) badgeEl.addEventListener('click', (e) => { e.stopPropagation(); abrirRecorrPop(iso, badgeEl); });
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
  // Alerta opcional do dia
  const al = alertaPorDia[diaSelecionado] || {};
  if (alertaHoraEl) alertaHoraEl.value = al.hora || '';
  if (alertaDashEl) alertaDashEl.checked = !!al.dashboard;
  if (recorrEl) recorrEl.value = recorrenciaPorDia[diaSelecionado] || '';
  aplicarFonteLinhas();   // já chama autoGrow()
}

// Popup com a lista de lembretes recorrentes do dia
function abrirRecorrPop(iso, anchor) {
  const itens = recorrentesNoDia(iso);
  if (!itens.length || !recorrPop) return;
  recorrPopTit.textContent = `Recorrentes · ${fmtData(iso)}`;
  recorrPopLista.innerHTML = itens.map(t => `<li>${escHtml(t)}</li>`).join('');
  recorrPop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const pw = recorrPop.offsetWidth, ph = recorrPop.offsetHeight;
  let left = Math.min(r.right - pw, window.innerWidth - pw - 8);
  if (left < 8) left = 8;
  let top = r.bottom + 6;
  if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
  recorrPop.style.left = left + 'px';
  recorrPop.style.top = top + 'px';
}
function fecharRecorrPop() { if (recorrPop) recorrPop.hidden = true; }

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
    const alertaHora = (alertaHoraEl && alertaHoraEl.value) || '';
    const alertaDashboard = !!(alertaDashEl && alertaDashEl.checked);
    const recorrencia = (recorrEl && recorrEl.value) || '';
    if (arr.length === 0) {
      // Apaga o doc canônico E quaisquer órfãos/duplicados desse dia.
      await apagarDocsDoDia(data);
      delete notas[data];
      delete docIds[data];
      delete corPorDia[data];
      delete alertaPorDia[data];
      delete recorrenciaPorDia[data];
    } else {
      // Grava sempre no ID canônico (= a data) e remove órfãos com outro ID.
      await setDoc(doc(db, 'agenda', data), {
        data, notas: arr, cor: corDiaSel,
        alertaHora, alertaDashboard, recorrencia,
        atualizadoEm: serverTimestamp()
      });
      const orfaos = (docIds[data] || []).filter(id => id !== data);
      await Promise.all(orfaos.map(id => deleteDoc(doc(db, 'agenda', id)).catch(() => {})));
      notas[data] = arr;
      docIds[data] = [data];
      corPorDia[data] = corDiaSel;
      alertaPorDia[data] = { hora: alertaHora, dashboard: alertaDashboard };
      if (recorrencia) recorrenciaPorDia[data] = recorrencia; else delete recorrenciaPorDia[data];
    }
    statusEl.textContent = '✓ Salvo';
  } catch (e) { console.error(e); statusEl.textContent = '❌ Erro ao salvar'; }
}

// ── busca inteligente ──────────────────────────────────────────────
// Procura o termo em cada LINHA de anotação. Destaca os dias com
// resultado, escurece os demais, lista os resultados e, ao clicar,
// vai ao dia, destaca o quadrado e seleciona a anotação.
function buscar(termo) {
  buscaTermo = (termo || '').trim().toLowerCase();
  const info = $('ag-busca-info');
  const resultEl = $('ag-busca-result');

  if (!buscaTermo) {
    if (info) info.textContent = '';
    if (resultEl) { resultEl.hidden = true; resultEl.innerHTML = ''; }
    renderCalendario();
    return;
  }

  // Resultados por linha: { data, texto }
  const resultados = [];
  Object.keys(notas).sort().forEach(d => {
    (notas[d] || []).forEach(n => {
      if ((n.texto || '').toLowerCase().includes(buscaTermo)) resultados.push({ data: d, texto: n.texto });
    });
  });

  if (info) info.textContent = resultados.length
    ? `${resultados.length} resultado(s)`
    : 'Nada encontrado';

  // Lista rápida de resultados
  if (resultEl) {
    if (!resultados.length) {
      resultEl.hidden = false;
      resultEl.innerHTML = '<div class="ag-busca-vazio">Nenhuma anotação encontrada.</div>';
    } else {
      resultEl.hidden = false;
      resultEl.innerHTML = resultados.map(r =>
        `<button class="ag-busca-item" data-dia="${r.data}">` +
          `<span class="ag-busca-data">📅 ${fmtData(r.data)}</span>` +
          `<span class="ag-busca-txt">${escHtml(r.texto)}</span>` +
        `</button>`
      ).join('');
      resultEl.querySelectorAll('.ag-busca-item').forEach(b => {
        b.addEventListener('click', () => irParaResultado(b.dataset.dia));
      });
    }
  }

  // Vai ao 1º resultado e rola até o calendário (sem abrir a edição)
  if (resultados.length) {
    const alvo = resultados[0].data;
    const [y, m] = alvo.split('-').map(Number);
    viewAno = y; viewMes = m - 1;
    diaSelecionado = alvo;
    carregarEditor();
    renderCalendario();
    requestAnimationFrame(() => {
      const cel = gradeEl.querySelector('.ag-cel-match') || document.querySelector('.ag-cal');
      cel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return;
  }
  renderCalendario();
}

// Clicar num resultado da busca → vai ao dia, destaca e seleciona a anotação
function irParaResultado(data) {
  const [y, m] = data.split('-').map(Number);
  viewAno = y; viewMes = m - 1;
  selecionarDia(data);   // carrega a anotação e rola até a edição
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
      alertaPorDia = {};
      recorrenciaPorDia = {};
      snap.forEach(d => {
        const dados = d.data();
        const data = dados.data || d.id;
        let arr = [];
        let corDoc = corValida(dados.cor);
        if (dados.alertaHora || dados.alertaDashboard) {
          alertaPorDia[data] = { hora: dados.alertaHora || '', dashboard: !!dados.alertaDashboard };
        }
        if (dados.recorrencia) recorrenciaPorDia[data] = dados.recorrencia;
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

// Alerta opcional (salva sozinho)
if (alertaHoraEl) alertaHoraEl.addEventListener('input', agendarSave);
if (alertaDashEl) alertaDashEl.addEventListener('change', agendarSave);

// Recorrência (atualiza o badge na hora e salva)
if (recorrEl) recorrEl.addEventListener('change', () => {
  if (recorrEl.value) recorrenciaPorDia[diaSelecionado] = recorrEl.value;
  else delete recorrenciaPorDia[diaSelecionado];
  renderCalendario();
  agendarSave();
});

// Fecha o popup de recorrentes ao clicar fora / rolar
document.addEventListener('click', (e) => {
  if (recorrPop && !recorrPop.hidden && !recorrPop.contains(e.target) && !e.target.classList.contains('ag-recorr-badge')) {
    fecharRecorrPop();
  }
});
window.addEventListener('scroll', () => fecharRecorrPop(), true);

// ── seletor de mês / ano (dropdown) ────────────────────────────────
function abrirDropdown(tipo, btn) {
  if (!dropdownEl) return;
  // fecha se já estava aberto no mesmo tipo
  if (!dropdownEl.hidden && dropdownEl.dataset.tipo === tipo) { fecharDropdown(); return; }

  dropdownEl.dataset.tipo = tipo;
  dropdownEl.className = 'ag-dropdown' + (tipo === 'mes' ? ' meses' : '');
  dropdownEl.innerHTML = '';

  let itens;
  if (tipo === 'mes') {
    itens = MESES.map((nome, i) => ({ rotulo: nome, valor: i, ativo: i === viewMes }));
  } else {
    const base = new Date().getFullYear();
    itens = [];
    for (let y = base - 3; y <= base + 6; y++) itens.push({ rotulo: String(y), valor: y, ativo: y === viewAno });
  }

  itens.forEach(it => {
    const b = document.createElement('button');
    b.className = 'ag-dd-item' + (it.ativo ? ' atual' : '');
    b.textContent = it.rotulo;
    b.addEventListener('click', () => {
      if (tipo === 'mes') viewMes = it.valor; else viewAno = it.valor;
      fecharDropdown();
      renderCalendario();
    });
    dropdownEl.appendChild(b);
  });

  // posiciona sob o botão
  const header = btn.closest('.ag-cal-header');
  const hr = header.getBoundingClientRect();
  const br = btn.getBoundingClientRect();
  dropdownEl.style.left = (br.left - hr.left) + 'px';
  dropdownEl.style.top = (br.bottom - hr.top + 6) + 'px';
  dropdownEl.hidden = false;
}
function fecharDropdown() { if (dropdownEl) dropdownEl.hidden = true; }

if (mesBtn) mesBtn.addEventListener('click', (e) => { e.stopPropagation(); abrirDropdown('mes', mesBtn); });
if (anoBtn) anoBtn.addEventListener('click', (e) => { e.stopPropagation(); abrirDropdown('ano', anoBtn); });
document.addEventListener('click', (e) => {
  if (dropdownEl && !dropdownEl.hidden && !dropdownEl.contains(e.target) && e.target !== mesBtn && e.target !== anoBtn) {
    fecharDropdown();
  }
});

// ── eventos de UI ──────────────────────────────────────────────────
$('ag-prev').addEventListener('click', () => navegar(-1));
$('ag-next').addEventListener('click', () => navegar(1));
// Título: ir ao mês atual, selecionar hoje e focar a anotação (1 clique)
function irHojeFoco() {
  const h = new Date(); viewAno = h.getFullYear(); viewMes = h.getMonth();
  selecionarDia(isoHoje());
  areaEl.focus();
}
// Botão HOJE: atalho rápido — volta ao mês atual e seleciona/destaca o
// dia de hoje, SEM rolar para a área de edição e sem focar o teclado.
function irHoje() {
  flushSave();
  const h = new Date(); viewAno = h.getFullYear(); viewMes = h.getMonth();
  diaSelecionado = isoHoje();
  editando = false;
  carregarEditor();
  renderCalendario();
  document.querySelector('.ag-cal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('ag-hoje').addEventListener('click', irHoje);
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
