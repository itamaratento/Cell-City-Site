// ===== AGENDA INTELIGENTE — Cell City (calendário com Sticky Notes) =====
// 1 documento por DIA: { data, notas: [ {texto, cor}, ... ], atualizadoEm }
// Cada anotação tem o horário no início do texto (ex.: "09:00 Buscar películas").
import { URLS } from '../../shared/app-config.js';
import { serverTimestamp } from '../../firebase/client.js';
import { AgendaRepository as Agenda } from '../../repositories/diario.repository.js';
import { initModulo } from '../../scripts/kernel.js';
import { carregarPermissoes, podeVisualizar, podeCriar, podeEditar } from '../../shared/permissoes.js';
import { escHtml } from '../../shared/sanitize.js';
import { formatDateOnly as fmtData } from '../../shared/date-utils.js';
import {
  gerarIdTarefa,
  lerLinkInteligente,
  parseDataParam,
  parseHorarioParam,
  parseLembreteParam,
  criarRegistroTarefa,
  normalizarRegistroTarefa,
  ordenarTarefasCronologicamente,
  deduplicarListaTarefas,
  interpretarTextoColado,
  tarefaJaExisteNoDia,
  adicionarOuAtualizarTarefaNoDia,
  formatarLinhasEvento,
  eventoJaPresenteNasNotas,
  mesclarNotasComEvento,
  montarResumoEvento,
} from './link-inteligente.js?v=20261125-4';

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
const TEXT_CORES = {
  preto:    '#1a1a1a',
  branco:   '#ffffff',
  verde:    '#22C55E',
  vermelho: '#EF4444',
  azul:     '#3B82F6',
  amarelo:  '#EAB308',
  roxo:     '#A855F7',
};

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ── estado ─────────────────────────────────────────────────────────
let notas = {};                 // data -> [ {texto, cor} ]
let docIds = {};                // data -> [ idsReaisNoFirestore ] (corrige órfãos)
let corPorDia = {};             // data -> cor (do calendário / bloco)
let corDiaSel = COR_PADRAO;     // cor escolhida para o dia aberto no editor
let alertaPorDia = {};          // data -> { hora, dashboard }
let recorrenciaPorDia = {};     // data -> 'semanal' | 'mensal' | 'anual'
let recorrenciaExcluir = {};    // data origem -> [datasISO] (ocorrências a pular)
let recorrenciaPararEm = {};    // data origem -> dataISO (para futuras a partir daqui)
let textoCorDia = {};           // data -> nome da cor do texto (ex.: 'branco', 'preto')
let textCorSel = 'preto';       // cor atual selecionada para o texto
let viewAno, viewMes;
let diaSelecionado = isoHoje();
let editando = false;
let saveTimer = null;
let formSaveTimer = null;
let retryTimer = null;
let retryTentativas = 0;
let buscaTermo = '';            // termo atual da busca (minúsculo)
let usuarioDigitouNoEditor = false;
let dataVindaDaUrl = '';        // ISO da data recebida na URL (ex.: ?date=2026-12-07)
let tarefaEditandoId = '';      // ID da tarefa existente aberta para edição
let sessaoTarefaId = '';        // ID estável da tarefa sendo digitada no formulário (impede duplicar durante digitação)
let avisosLinkAtual = [];
let agendaCarregada = false;
let resolverCargaInicial = null;
const promessaCargaInicial = new Promise((r) => { resolverCargaInicial = r; });
const lembretesDispensados = new Set();
const salvandoEmVoo = {};       // data -> boolean (serializa gravações concorrentes)
const regravarPendente = {};    // data -> lista mais recente aguardando término do voo atual
const PENDENCIAS_OFFLINE_KEY = 'ag_autosave_pendente';
let pendenciasOffline = carregarPendenciasOfflineStorage();

function carregarPendenciasOfflineStorage() {
  try {
    const raw = localStorage.getItem(PENDENCIAS_OFFLINE_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch {
    return {};
  }
}
function gravarPendenciasOfflineStorage() {
  try {
    if (Object.keys(pendenciasOffline).length === 0) {
      localStorage.removeItem(PENDENCIAS_OFFLINE_KEY);
    } else {
      localStorage.setItem(PENDENCIAS_OFFLINE_KEY, JSON.stringify(pendenciasOffline));
    }
  } catch { /* storage indisponível */ }
}

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
const miniEl     = $('ag-mini');
const miniTitulo = $('ag-mini-titulo');
const miniGrade  = $('ag-mini-grade');
let miniAno, miniMes;
const modalOverlay = $('ag-modal-overlay');
const modalTit   = $('ag-modal-tit');
const modalBody  = $('ag-modal-body');
let modalDia = null;
const statusEl   = $('ag-nota-status');
const painelEl   = document.querySelector('.ag-nota-painel');
const toastEl    = $('ag-toast');
const evFormEl        = $('ag-evento-form');
const evOrigemBadgeEl = $('ag-ev-origem-badge');
const evPendentePillEl = $('ag-ev-pendente-pill');
const evAvisoEl       = $('ag-ev-aviso');
const evTituloEl      = $('ag-ev-titulo');
const evDataEl        = $('ag-ev-data');
const evHoraEl        = $('ag-ev-hora');
const evDescEl        = $('ag-ev-descricao');
const evLembEl        = $('ag-ev-lembrete');
const evLembInfoEl    = $('ag-ev-lembrete-info');
const evNovaOutraBtn  = $('ag-nova-outra-tarefa');
const evCopiarBtn     = $('ag-copiar-evento');
const evDescartarBtn  = $('ag-descartar-evento');
const abrirNovoEvBtn  = $('ag-abrir-novo-evento');
const copiarDiaBtn    = $('ag-copiar-dia');
const tarefasListaEl  = $('ag-tarefas-lista');
const tarefasCountEl  = $('ag-tarefas-count');
const alertaVivoEl    = $('ag-alerta-vivo');
const vivoHoraEl      = $('ag-vivo-hora');
const vivoTituloEl    = $('ag-vivo-titulo');
const vivoSubEl       = $('ag-vivo-sub');
const vivoFecharBtn   = $('ag-vivo-fechar');

// ── util ───────────────────────────────────────────────────────────
function isoHoje() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function pad(n) { return String(n).padStart(2, '0'); }
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
// Lembretes recorrentes que "caem" no dia iso
// Retorna array de { texto, origem }
function recorrentesNoDia(iso) {
  const out = [];
  for (const origem of Object.keys(recorrenciaPorDia)) {
    if (!_dataLanda(iso, origem, recorrenciaPorDia[origem])) continue;
    // Pula ocorrência específica excluída
    if (recorrenciaExcluir[origem] && recorrenciaExcluir[origem].includes(iso)) continue;
    // Pula se a recorrência foi encerrada antes deste dia
    if (recorrenciaPararEm[origem] && iso >= recorrenciaPararEm[origem]) continue;
    (notas[origem] || []).forEach(n => out.push({ texto: n.texto, origem }));
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
    const arr = ordenarTarefasCronologicamente(notas[iso] || []);
    const cel = document.createElement('div');
    cel.className = 'ag-cel';
    if (iso === hoje) cel.classList.add('ag-cel-hoje');
    if (iso === diaSelecionado) cel.classList.add('ag-cel-sel');
    if (buscaTermo) {
      const temMatch = arr.some(n => `${n.texto || ''} ${n.descricao || ''}`.toLowerCase().includes(buscaTermo));
      cel.classList.add(temMatch ? 'ag-cel-match' : 'ag-cel-dim');
    }

    // Dias recorrentes NÃO enchem o quadrado: viram só um badge no canto.
    const ehRecorrente = !!recorrenciaPorDia[iso];
    const chipsArr = ehRecorrente ? [] : arr;
    const chips = chipsArr.map(n => {
      const c = CORES[corValida(n.cor)];
      const horaChip = n.hora || (String(n.texto || '').match(/^\s*\[?(\d{1,2}:\d{2})\]?\s+/)?.[1] || '');
      const rotuloCurto = n.titulo || String(n.texto || '').replace(/^\s*\[?\d{1,2}:\d{2}\]?\s+/, '');
      const inner = horaChip ? `<b>${escHtml(horaChip)}</b> ${escHtml(rotuloCurto)}` : escHtml(rotuloCurto);
      const estiloConcluido = n.concluido ? ';opacity:.55;text-decoration:line-through' : '';
      return `<div class="ag-chip" style="--bg:${c.bg};--fg:${c.fg}${estiloConcluido}" title="${escHtml(n.texto)}"><span class="ag-chip-t">${inner}</span></div>`;
    }).join('');

    const rec = recorrentesNoDia(iso);
    const badge = rec.length
      ? `<div class="ag-recorr-badge" data-dia="${iso}" title="${rec.length} lembrete(s) recorrente(s)">🔔 ${rec.length}</div>`
      : '';

    cel.dataset.iso = iso;
    cel.innerHTML = `<span class="ag-cel-num">${dia}</span>${badge}<div class="ag-cel-notas">${chips}</div>`;
    cel.addEventListener('click', () => selecionarDia(iso));
    const badgeEl = cel.querySelector('.ag-recorr-badge');
    if (badgeEl) badgeEl.addEventListener('click', (e) => { e.stopPropagation(); abrirRecorrPop(iso, badgeEl); });
    gradeEl.appendChild(cel);
  }

  requestAnimationFrame(ajustarQuadrados);
}

// Quadrados têm tamanho FIXO. Quando o conteúdo não cabe, adiciona um
// botão "⛶ expandir" no canto — o quadrado nunca cresce nem encolhe a fonte.
function ajustarQuadrados() {
  gradeEl.querySelectorAll('.ag-cel').forEach(cel => {
    const antigo = cel.querySelector('.ag-expand'); if (antigo) antigo.remove();
    const wrap = cel.querySelector('.ag-cel-notas');
    if (!wrap) return;
    if (wrap.scrollHeight > wrap.clientHeight + 1) {
      const iso = cel.dataset.iso;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ag-expand';
      btn.textContent = '⛶';
      btn.title = 'Ver dia completo';
      btn.addEventListener('click', (e) => { e.stopPropagation(); abrirDiaModal(iso); });
      cel.appendChild(btn);
    }
  });
}

function selecionarDia(iso) {
  flushSave();
  if (evFormEl && !evFormEl.hidden && iso !== diaSelecionado) {
    fecharFormularioEvento({ restaurarEditor: false });
  }
  diaSelecionado = iso;
  editando = false;
  usuarioDigitouNoEditor = false;
  if (dataVindaDaUrl) {
    dataVindaDaUrl = iso;
    sincronizarDataNaUrl(iso);
  }
  carregarEditor();
  renderCalendario();
  painelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (areaEl && !areaEl.value && (!evFormEl || evFormEl.hidden)) areaEl.focus();
}

// ── renderização da lista cronológica de tarefas independentes do dia ──
function renderTarefasLista() {
  const ordenadas = ordenarTarefasCronologicamente(notas[diaSelecionado] || []);
  if (tarefasCountEl) {
    if (ordenadas.length > 0) {
      tarefasCountEl.textContent = `${ordenadas.length} ${ordenadas.length === 1 ? 'tarefa' : 'tarefas'}`;
      tarefasCountEl.hidden = false;
    } else {
      tarefasCountEl.hidden = true;
    }
  }
  if (!tarefasListaEl) return;
  if (ordenadas.length === 0) {
    tarefasListaEl.innerHTML = '';
    tarefasListaEl.hidden = true;
    return;
  }

  const podeAlterar = podeCriar('agenda') && podeEditar('agenda');
  tarefasListaEl.hidden = false;
  tarefasListaEl.innerHTML = ordenadas.map((t) => {
    const corInfo = CORES[corValida(t.cor || corDiaSel)];
    const horaHtml = t.hora ? `<span class="ag-tarefa-hora">${escHtml(t.hora)}</span>` : '';
    const descHtml = t.descricao ? `<div class="ag-tarefa-desc">${escHtml(t.descricao)}</div>` : '';
    let metaTxt = '';
    if (t.lembrete) {
      const suf = t.horaAlerta && t.horaAlerta !== t.hora ? ` · alerta às ${t.horaAlerta}` : '';
      metaTxt = `⏰ Lembrete: ${t.lembrete}${suf}`;
    } else if (t.alertaAtivo && t.hora) {
      metaTxt = `🔔 Alerta ativo (${t.hora})`;
    }
    const metaHtml = metaTxt ? `<div class="ag-tarefa-meta">${escHtml(metaTxt)}</div>` : '';
    const attrDis = podeAlterar ? '' : ' disabled';

    return `<div class="ag-tarefa-card${t.concluido ? ' concluida' : ''}" data-task-id="${escHtml(t.id)}" style="--t-cor:${corInfo.hex}">
      <input type="checkbox" class="ag-tarefa-chk" data-acao="concluir" title="Marcar tarefa como concluída"${t.concluido ? ' checked' : ''}${attrDis}>
      <div class="ag-tarefa-corpo">
        <div class="ag-tarefa-linha1">${horaHtml}<span class="ag-tarefa-tit">${escHtml(t.titulo || t.texto)}</span></div>
        ${descHtml}
        ${metaHtml}
      </div>
      <div class="ag-tarefa-acoes">
        <button type="button" class="ag-tarefa-acao" data-acao="copiar" title="Copiar esta tarefa">📋</button>
        <button type="button" class="ag-tarefa-acao" data-acao="editar" title="Editar esta tarefa"${attrDis}>✏️</button>
        <button type="button" class="ag-tarefa-acao excluir" data-acao="excluir" title="Excluir esta tarefa"${attrDis}>✕</button>
      </div>
    </div>`;
  }).join('');

  tarefasListaEl.querySelectorAll('.ag-tarefa-card').forEach((card) => {
    const taskId = card.dataset.taskId;
    card.querySelector('[data-acao="concluir"]')?.addEventListener('change', (e) => {
      alternarConcluidoTarefa(taskId, e.target.checked);
    });
    card.querySelector('[data-acao="copiar"]')?.addEventListener('click', (e) => {
      copiarTarefaIndividual(taskId, e.currentTarget);
    });
    card.querySelector('[data-acao="editar"]')?.addEventListener('click', () => {
      editarTarefaIndividual(taskId);
    });
    card.querySelector('[data-acao="excluir"]')?.addEventListener('click', () => {
      removerTarefaIndividual(taskId);
    });
  });
}

// ── editor: tarefas independentes + área de texto contínua compatível ──
function carregarEditor() {
  diaTitulo.textContent = fmtDiaLongo(diaSelecionado);
  const arr = ordenarTarefasCronologicamente(notas[diaSelecionado] || []);
  areaEl.value = arr.map(n => n.texto).join('\n');
  atualizarContador();
  corDiaSel = corValida(corPorDia[diaSelecionado] || COR_PADRAO);
  pintarArea();
  renderTarefasLista();
  // Alerta opcional do dia
  const al = alertaPorDia[diaSelecionado] || {};
  const temAlertaTarefa = arr.some(t => t.alertaAtivo && (t.hora || t.horaAlerta));
  if (alertaHoraEl) alertaHoraEl.value = al.hora || '';
  if (alertaDashEl) alertaDashEl.checked = Boolean(al.dashboard || temAlertaTarefa);
  if (recorrEl) recorrEl.value = recorrenciaPorDia[diaSelecionado] || '';
  aplicarFonteLinhas();   // já chama autoGrow()
  // Restaura a cor do texto salva sem disparar gravação automática ao abrir o dia
  const tCor = textoCorDia[diaSelecionado] || 'preto';
  escolherTextoCor(tCor, true);
}

// Popup com a lista de lembretes recorrentes do dia
function abrirRecorrPop(iso, anchor) {
  const itens = recorrentesNoDia(iso);
  if (!itens.length || !recorrPop) return;
  // Toggle: se já está aberto para este dia, fecha
  if (!recorrPop.hidden && recorrPop.dataset.iso === iso) {
    fecharRecorrPop();
    return;
  }
  recorrPop.dataset.iso = iso;
  recorrPopTit.textContent = fmtData(iso);
  // Agrupa textos por origem (cada origem vira um bloco)
  const origens = [...new Set(itens.map(i => i.origem))];
  let html = '';
  for (const o of origens) {
    const textos = itens.filter(i => i.origem === o).map(i => i.texto);
    html += textos.map(t => `<li>${escHtml(t)}</li>`).join('');
  }
  recorrPopLista.innerHTML = html;
  recorrPop.hidden = false;
  // Salva as origens no dataset para usar nos botões de ação
  recorrPop.dataset.origens = origens.join(',');
  // Mostra/esconde actions
  const actions = $('ag-recorr-actions');
  if (actions) actions.hidden = false;
  const r = anchor.getBoundingClientRect();
  const pw = recorrPop.offsetWidth, ph = recorrPop.offsetHeight;
  let left = Math.min(r.right - pw, window.innerWidth - pw - 8);
  if (left < 8) left = 8;
  let top = r.bottom + 6;
  if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
  recorrPop.style.left = left + 'px';
  recorrPop.style.top = top + 'px';
}
function fecharRecorrPop() { if (recorrPop) { recorrPop.hidden = true; recorrPop.dataset.iso = ''; } }

// Interrompe a recorrência apenas para esta ocorrência
async function pararEstaOcorrencia() {
  const iso = recorrPop?.dataset.iso;
  const origens = (recorrPop?.dataset.origens || '').split(',').filter(Boolean);
  if (!iso || !origens.length) return;
  try {
    for (const origem of origens) {
      const excluir = [...(recorrenciaExcluir[origem] || []), iso];
      await Agenda.set(origem, { recorrenciaExcluir: excluir }, { merge: true });
    }
    toast('Ocorrência removida');
    fecharRecorrPop();
  } catch (e) { console.error(e); toast('Erro ao remover ocorrência'); }
}

// Interrompe a recorrência a partir desta data (inclusive)
async function pararFuturas() {
  const iso = recorrPop?.dataset.iso;
  const origens = (recorrPop?.dataset.origens || '').split(',').filter(Boolean);
  if (!iso || !origens.length) return;
  try {
    for (const origem of origens) {
      await Agenda.set(origem, { recorrenciaPararEm: iso }, { merge: true });
    }
    toast('Recorrência futura encerrada');
    fecharRecorrPop();
  } catch (e) { console.error(e); toast('Erro ao encerrar recorrência'); }
}

// ── MINI CALENDÁRIO (atalho do título) ─────────────────────────────
function renderMini() {
  if (!miniGrade) return;
  miniTitulo.textContent = `${MESES[miniMes]} ${miniAno}`;
  miniGrade.innerHTML = '';
  const hoje = isoHoje();
  const primeiro = new Date(miniAno, miniMes, 1).getDay();
  const dias = new Date(miniAno, miniMes + 1, 0).getDate();
  for (let i = 0; i < primeiro; i++) {
    const v = document.createElement('div'); v.className = 'ag-mini-day vazia'; miniGrade.appendChild(v);
  }
  for (let d = 1; d <= dias; d++) {
    const iso = `${miniAno}-${pad(miniMes + 1)}-${pad(d)}`;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ag-mini-day';
    if (iso === hoje) b.classList.add('hoje');
    if ((notas[iso] && notas[iso].length) || recorrenciaPorDia[iso]) b.classList.add('com-nota');
    b.textContent = d;
    b.addEventListener('click', () => escolherMiniDia(iso));
    miniGrade.appendChild(b);
  }
}
function abrirMini() {
  if (!miniEl) return;
  miniAno = viewAno; miniMes = viewMes;
  renderMini();
  miniEl.hidden = false;
  // posiciona centralizado horizontalmente, logo abaixo da barra superior
  const pw = miniEl.offsetWidth || 290;
  miniEl.style.left = Math.max(12, Math.round((window.innerWidth - pw) / 2)) + 'px';
  miniEl.style.top = '64px';
}
function fecharMini() { if (miniEl) miniEl.hidden = true; }
function navMini(delta) {
  miniMes += delta;
  if (miniMes < 0) { miniMes = 11; miniAno--; }
  if (miniMes > 11) { miniMes = 0; miniAno++; }
  renderMini();
}
function escolherMiniDia(iso) {
  const [y, m] = iso.split('-').map(Number);
  viewAno = y; viewMes = m - 1;
  fecharMini();
  selecionarDia(iso);   // navega, seleciona e abre a edição do dia
}

// ── MODAL: conteúdo completo de um dia (sem alterar o calendário) ──
function abrirDiaModal(iso) {
  if (!modalOverlay || !iso) return;
  modalDia = iso;
  modalTit.textContent = fmtDiaLongo(iso);
  const linhas = ordenarTarefasCronologicamente(notas[iso] || []).map(n => n.texto);
  const rec = recorrentesNoDia(iso).map(r => r.texto).filter(t => !linhas.includes(t));
  let html = linhas.map(t => `<div class="ag-modal-linha">${escHtml(t)}</div>`).join('');
  if (rec.length) html += rec.map(t => `<div class="ag-modal-linha">🔄 ${escHtml(t)}</div>`).join('');
  modalBody.innerHTML = html || '<div class="ag-modal-linha" style="opacity:.6">Sem anotações.</div>';
  modalOverlay.hidden = false;
}
function fecharDiaModal() { if (modalOverlay) modalOverlay.hidden = true; modalDia = null; }

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
  // Reaplica a cor do texto após pintar o fundo do dia
  const tCor = textoCorDia[diaSelecionado] || 'preto';
  const hex = TEXT_CORES[tCor];
  if (hex) areaEl.style.color = hex;
  agendarSave();
}

// ── SELETOR DE COR DO TEXTO ────────────────────────────────────────
function escolherTextoCor(cor, silencioso = false) {
  const hex = TEXT_CORES[cor];
  if (!hex) return;
  textCorSel = cor;
  areaEl.style.color = hex;
  document.querySelectorAll('.ag-tcor-btn').forEach(b => {
    b.classList.toggle('ativa', b.dataset.cor === cor);
  });
  if (!silencioso) {
    textoCorDia[diaSelecionado] = cor;
    agendarSave();
  }
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

// ── CONTADOR DE CARACTERES ─────────────────────────────────────────
const CHAR_LIMITE = 88;
const charCountEl = $('ag-charcount');
function atualizarContador() {
  if (!charCountEl) return;
  const total = areaEl ? areaEl.value.length : 0;
  charCountEl.textContent = `${total} / ${CHAR_LIMITE} caracteres`;
  charCountEl.classList.remove('ideal', 'excedido');
  if (total > CHAR_LIMITE) {
    charCountEl.classList.add('excedido');
    charCountEl.textContent += ' (limite excedido)';
  } else if (total === CHAR_LIMITE) {
    charCountEl.classList.add('ideal');
    charCountEl.textContent += ' ✓';
  }
}

// ── salvamento automático (AUTOSAVE) com deduplicação e retry offline ──
function atualizarIndicadoresSave(estado, texto) {
  if (statusEl) {
    statusEl.textContent = texto;
    statusEl.classList.toggle('salvo', estado === 'salvo');
    statusEl.classList.toggle('erro', estado === 'erro');
  }
  if (evPendentePillEl && evFormEl && !evFormEl.hidden) {
    evPendentePillEl.textContent = texto;
    evPendentePillEl.classList.toggle('salvando', estado === 'salvando');
    evPendentePillEl.classList.toggle('salvo', estado === 'salvo');
    evPendentePillEl.classList.toggle('erro', estado === 'erro');
  }
}

function lerLinhas() {
  const poolExistentes = [...(notas[diaSelecionado] || [])];
  const lidas = areaEl.value
    .split(/\r?\n/)
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => {
      const idx = poolExistentes.findIndex(n => n.texto === t);
      if (idx !== -1) {
        const existente = poolExistentes.splice(idx, 1)[0];
        return { ...existente, cor: existente.cor || corDiaSel };
      }
      return normalizarRegistroTarefa({ texto: t, cor: corDiaSel, concluido: false }, corDiaSel);
    })
    .filter(Boolean);
  return deduplicarListaTarefas(lidas);
}

function agendarSave(delayMs = 450) {
  if (!(podeCriar('agenda') && podeEditar('agenda'))) return;
  atualizarIndicadoresSave('salvando', 'Salvando…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(salvar, delayMs);
}

function flushSave() {
  if (formSaveTimer) {
    clearTimeout(formSaveTimer);
    formSaveTimer = null;
    executarAutosaveFormulario();
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    salvar();
  }
}

async function apagarDocsDoDia(data) {
  const ids = new Set([data, ...(docIds[data] || [])]);
  await Promise.all([...ids].map(id => Agenda.remove(id)));
}

function agendarRetryOffline() {
  clearTimeout(retryTimer);
  if (Object.keys(pendenciasOffline).length === 0) {
    retryTentativas = 0;
    return;
  }
  const atraso = Math.min(12000, 1500 * Math.pow(2, Math.min(3, retryTentativas)));
  retryTentativas++;
  retryTimer = setTimeout(() => { processarPendenciasOffline(); }, atraso);
}

async function processarPendenciasOffline() {
  const datas = Object.keys(pendenciasOffline);
  if (datas.length === 0) return;
  for (const data of datas) {
    const item = pendenciasOffline[data];
    if (!item) continue;
    await persistirTarefasDoDia(data, item.notas, {
      forcarAlertaDash: item.alertaDashboard,
      corForcada: item.cor,
      origemRetry: true,
    });
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    retryTentativas = 0;
    processarPendenciasOffline();
  });
}

async function persistirTarefasDoDia(data, listaTarefas, {
  forcarAlertaDash = false,
  corForcada = '',
  atualizarTextarea = true,
  origemRetry = false,
} = {}) {
  if (!(podeCriar('agenda') && podeEditar('agenda'))) return false;
  clearTimeout(saveTimer); saveTimer = null;

  const corUsada = corValida(corForcada || corPorDia[data] || (data === diaSelecionado ? corDiaSel : COR_PADRAO));
  const arr = deduplicarListaTarefas((listaTarefas || []).filter(Boolean));
  const alertaHoraManual = data === diaSelecionado ? ((alertaHoraEl && alertaHoraEl.value) || '') : (alertaPorDia[data]?.hora || '');
  const temAlertaIndividual = arr.some(t => t.alertaAtivo && (t.hora || t.horaAlerta));
  const alertaDashboard = Boolean(
    (data === diaSelecionado && alertaDashEl && alertaDashEl.checked)
    || forcarAlertaDash
    || temAlertaIndividual
    || alertaPorDia[data]?.dashboard
  );
  const alertaHora = alertaHoraManual;
  const recorrencia = data === diaSelecionado ? ((recorrEl && recorrEl.value) || '') : (recorrenciaPorDia[data] || '');

  // 1. Atualização otimista imediata na Agenda (sem esperar round-trip de rede)
  if (arr.length === 0) {
    delete notas[data];
  } else {
    notas[data] = arr;
    corPorDia[data] = corUsada;
    alertaPorDia[data] = { hora: alertaHora, dashboard: alertaDashboard };
  }
  if (data === diaSelecionado) {
    renderTarefasLista();
    if (atualizarTextarea && areaEl && document.activeElement !== areaEl) {
      areaEl.value = arr.map(n => n.texto).join('\n');
      atualizarContador();
      aplicarFonteLinhas();
    }
    if (alertaDashEl && arr.length > 0) alertaDashEl.checked = alertaDashboard;
  }
  renderCalendario();
  verificarLembretesVivos();

  // 2. Serialização por dia para impedir gravações concorrentes ou duplicadas
  if (salvandoEmVoo[data]) {
    regravarPendente[data] = { arr, forcarAlertaDash: alertaDashboard, corForcada: corUsada, atualizarTextarea };
    return true;
  }

  salvandoEmVoo[data] = true;
  if (!origemRetry) atualizarIndicadoresSave('salvando', 'Salvando…');

  try {
    if (!agendaCarregada && !origemRetry) {
      await Promise.race([
        promessaCargaInicial,
        new Promise((r) => setTimeout(r, 1200)),
      ]);
    }

    if (arr.length === 0) {
      await apagarDocsDoDia(data);
      delete docIds[data];
      delete corPorDia[data];
      delete alertaPorDia[data];
      delete recorrenciaPorDia[data];
      delete recorrenciaExcluir[data];
      delete recorrenciaPararEm[data];
      delete textoCorDia[data];
    } else {
      const excluir = recorrenciaExcluir[data] || [];
      const pararEm = recorrenciaPararEm[data] || '';
      await Agenda.set(data, {
        data, notas: arr, cor: corUsada,
        alertaHora, alertaDashboard, recorrencia,
        recorrenciaExcluir: excluir.length ? excluir : [],
        recorrenciaPararEm: pararEm || '',
        textoCor: textoCorDia[data] || 'preto',
        atualizadoEm: serverTimestamp()
      });
      const orfaos = (docIds[data] || []).filter(id => id !== data);
      await Promise.all(orfaos.map(id => Agenda.remove(id).catch(() => {})));
      docIds[data] = [data];
      if (recorrencia) recorrenciaPorDia[data] = recorrencia; else delete recorrenciaPorDia[data];
    }

    // Sucesso: limpa pendência offline deste dia e confirma discretamente "Salvo ✓"
    if (pendenciasOffline[data]) {
      delete pendenciasOffline[data];
      gravarPendenciasOfflineStorage();
    }
    if (Object.keys(pendenciasOffline).length === 0) retryTentativas = 0;
    atualizarIndicadoresSave('salvo', 'Salvo ✓');
    return true;
  } catch (e) {
    console.warn('[Agenda Autosave] Falha de conexão — preservando conteúdo e agendando nova tentativa:', e);
    // Preserva integralmente o conteúdo na memória + localStorage e agenda retry automático
    pendenciasOffline[data] = {
      data,
      notas: arr,
      cor: corUsada,
      alertaHora,
      alertaDashboard,
      recorrencia,
      textoCor: textoCorDia[data] || 'preto',
    };
    gravarPendenciasOfflineStorage();
    atualizarIndicadoresSave('erro', '⚠️ Sem conexão — salvo localmente, tentando reconectar…');
    agendarRetryOffline();
    return false;
  } finally {
    salvandoEmVoo[data] = false;
    if (regravarPendente[data]) {
      const prox = regravarPendente[data];
      delete regravarPendente[data];
      persistirTarefasDoDia(data, prox.arr, {
        forcarAlertaDash: prox.forcarAlertaDash,
        corForcada: prox.corForcada,
        atualizarTextarea: prox.atualizarTextarea,
      });
    }
  }
}

async function salvar() {
  const data = diaSelecionado;
  const arr = lerLinhas();
  await persistirTarefasDoDia(data, arr, { atualizarTextarea: false });
}

// ── Ações independentes por tarefa (concluir, editar, excluir, copiar) ──
async function alternarConcluidoTarefa(taskId, concluido) {
  if (!(podeCriar('agenda') && podeEditar('agenda'))) return;
  const atuais = (notas[diaSelecionado] || []).map(t =>
    t.id === taskId ? { ...t, concluido: Boolean(concluido) } : t
  );
  await persistirTarefasDoDia(diaSelecionado, atuais);
  toast(concluido ? '✓ Tarefa concluída' : '↩️ Tarefa reaberta');
}

function editarTarefaIndividual(taskId) {
  if (!(podeCriar('agenda') && podeEditar('agenda'))) return;
  const alvo = (notas[diaSelecionado] || []).find(t => t.id === taskId);
  if (!alvo) return;
  abrirFormularioEvento({
    editarId: alvo.id,
    dataIso: diaSelecionado,
    horario: alvo.hora || '',
    titulo: alvo.titulo || '',
    descricao: alvo.descricao || '',
    lembrete: alvo.lembrete || '',
  }, { origemLink: false });
  evTituloEl?.focus();
}

async function removerTarefaIndividual(taskId) {
  if (!(podeCriar('agenda') && podeEditar('agenda'))) return;
  const restantes = (notas[diaSelecionado] || []).filter(t => t.id !== taskId);
  if (tarefaEditandoId === taskId) {
    fecharFormularioEvento({ restaurarEditor: false, limparUrl: false });
  }
  await persistirTarefasDoDia(diaSelecionado, restantes);
  toast('🗑️ Tarefa removida');
}

async function copiarTarefaIndividual(taskId, btnAlvo) {
  const alvo = (notas[diaSelecionado] || []).find(t => t.id === taskId);
  if (!alvo) return;
  const resumo = montarResumoEvento({
    titulo: alvo.titulo,
    dataIso: diaSelecionado,
    horario: alvo.hora,
    descricao: alvo.descricao,
    lembrete: alvo.lembrete,
    horaAlerta: alvo.horaAlerta,
  });
  const ok = await copiarTextoAreaTransferencia(resumo);
  if (ok) {
    if (btnAlvo) {
      const orig = btnAlvo.textContent;
      btnAlvo.textContent = '✓';
      setTimeout(() => { btnAlvo.textContent = orig; }, 1400);
    }
    toast('📋 Tarefa copiada!');
  }
}

// ── Verificador de lembretes individuais em tempo real na Agenda ────
function verificarLembretesVivos() {
  if (!alertaVivoEl) return;
  const hoje = isoHoje();
  const tarefasHoje = ordenarTarefasCronologicamente(notas[hoje] || []);
  const agora = new Date();
  const minsAgora = agora.getHours() * 60 + agora.getMinutes();

  const disparando = tarefasHoje.find((t) => {
    if (t.concluido || !t.alertaAtivo) return false;
    const chaveDisp = `${hoje}::${t.id}`;
    if (lembretesDispensados.has(chaveDisp)) return false;
    const hAlvo = parseHorarioParam(t.horaAlerta || t.hora || '');
    if (!hAlvo.valido) return false;
    const [hh, mm] = hAlvo.hora.split(':').map(Number);
    const diff = minsAgora - (hh * 60 + mm);
    // Dispara a partir do horário do lembrete até 60 minutos após (ou até o horário do evento)
    return diff >= 0 && diff <= 60;
  });

  if (!disparando) {
    alertaVivoEl.hidden = true;
    alertaVivoEl.dataset.taskKey = '';
    return;
  }

  alertaVivoEl.dataset.taskKey = `${hoje}::${disparando.id}`;
  if (vivoHoraEl) vivoHoraEl.textContent = disparando.hora || disparando.horaAlerta || '--:--';
  if (vivoTituloEl) vivoTituloEl.textContent = disparando.titulo || disparando.texto;
  if (vivoSubEl) {
    const partes = [];
    if (disparando.lembrete) partes.push(`Lembrete: ${disparando.lembrete}`);
    if (disparando.descricao) partes.push(disparando.descricao);
    vivoSubEl.textContent = partes.join(' · ') || 'Compromisso agendado para hoje';
  }
  alertaVivoEl.hidden = false;
}
vivoFecharBtn?.addEventListener('click', () => {
  const k = alertaVivoEl?.dataset.taskKey;
  if (k) lembretesDispensados.add(k);
  if (alertaVivoEl) alertaVivoEl.hidden = true;
});

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

// ── LINK INTELIGENTE & FORMULÁRIO DE NOVO EVENTO ──────────────────
function obterSearchAtual() {
  if (typeof window === 'undefined' || !window.location) return '';
  if (typeof window.location.search === 'string' && window.location.search) {
    return window.location.search;
  }
  try {
    return new URL(window.location.href, 'http://localhost').search;
  } catch {
    return '';
  }
}

function obterHashAtual() {
  if (typeof window === 'undefined' || !window.location) return '';
  if (typeof window.location.hash === 'string' && window.location.hash) {
    return window.location.hash;
  }
  try {
    return new URL(window.location.href, 'http://localhost').hash;
  } catch {
    return '';
  }
}

// Mantém apenas ?date=AAAA-MM-DD na URL (preserva a data ao recarregar a página
// e remove parâmetros de rascunho já salvos/descartados para nunca duplicar).
function sincronizarDataNaUrl(iso) {
  try {
    if (window.history && typeof window.history.replaceState === 'function') {
      const sufixo = iso ? `?date=${encodeURIComponent(iso)}` : '';
      const novaUrl = window.location.pathname + sufixo;
      window.history.replaceState({}, document.title, novaUrl);
    }
  } catch { /* ambiente restrito / testes */ }
}

function limparQueryStringUrl() {
  sincronizarDataNaUrl(dataVindaDaUrl || '');
}

function lerCamposFormularioEvento() {
  const titulo = evTituloEl ? evTituloEl.value : '';
  const dataRaw = evDataEl ? evDataEl.value : diaSelecionado;
  const horarioRaw = evHoraEl ? evHoraEl.value : '';
  const descricao = evDescEl ? evDescEl.value : '';
  const lembreteRaw = evLembEl ? evLembEl.value : '';
  const hRes = parseHorarioParam(horarioRaw);
  const horario = hRes.valido ? hRes.hora : '';
  const lRes = parseLembreteParam(lembreteRaw, horario);
  const dRes = parseDataParam(dataRaw);
  const dataIso = dRes.valido ? dRes.iso : diaSelecionado;
  const idAtivo = tarefaEditandoId || sessaoTarefaId || gerarIdTarefa();
  if (!sessaoTarefaId) sessaoTarefaId = idAtivo;

  const tituloValido = titulo.trim().length > 0;
  const registro = tituloValido
    ? criarRegistroTarefa({
        id: idAtivo,
        horario,
        titulo,
        descricao,
        lembrete: lRes.valido ? lRes.texto : lembreteRaw,
        cor: corDiaSel,
      })
    : null;

  return {
    idAtivo,
    titulo,
    tituloValido,
    dataIso,
    horario,
    descricao,
    lembrete: lRes.valido ? lRes.texto : lembreteRaw,
    lRes,
    hRes,
    registro,
    linhas: registro && registro.texto ? [registro.texto] : [],
  };
}

function atualizarInfoLembreteFormulario(estado) {
  if (!evLembInfoEl) return;
  if (estado.lRes.valido && estado.lRes.ativarDashboard && estado.lRes.horaAlerta) {
    evLembInfoEl.textContent = `(alerta às ${estado.lRes.horaAlerta})`;
  } else if (estado.lRes.texto === 'Sem lembrete') {
    evLembInfoEl.textContent = '(desativado)';
  } else if (estado.horario) {
    evLembInfoEl.textContent = `(alerta às ${estado.horario})`;
  } else {
    evLembInfoEl.textContent = '';
  }
}

// Aplica a tarefa válida imediatamente na Agenda (memória + UI) e grava com debounce no Firestore
function agendarAutosaveFormulario({ imediato = false } = {}) {
  if (!(podeCriar('agenda') && podeEditar('agenda'))) return;
  const estado = lerCamposFormularioEvento();
  atualizarInfoLembreteFormulario(estado);

  if (!estado.tituloValido || !estado.registro) {
    clearTimeout(formSaveTimer);
    formSaveTimer = null;
    if (evPendentePillEl) {
      evPendentePillEl.textContent = 'Autosave ativo';
      evPendentePillEl.classList.remove('salvando', 'salvo', 'erro');
    }
    return;
  }

  const dataAlvo = estado.dataIso || diaSelecionado;
  const atuais = notas[dataAlvo] || [];
  const jaTemMesmoId = atuais.some((t) => t.id === estado.idAtivo);

  // Impede duplicar tarefa já existente no mesmo dia ao colar/repetir
  if (!jaTemMesmoId && tarefaJaExisteNoDia(atuais, estado.registro, estado.idAtivo)) {
    const existente = atuais.find((t) => tarefaJaExisteNoDia([t], estado.registro));
    if (existente) {
      sessaoTarefaId = existente.id;
      atualizarIndicadoresSave('salvo', 'Salvo ✓');
      return;
    }
  }

  // Preserva cor/conclusão caso já exista na lista
  const anterior = atuais.find((t) => t.id === estado.idAtivo);
  const regFinal = {
    ...estado.registro,
    id: estado.idAtivo,
    cor: anterior ? anterior.cor : corDiaSel,
    concluido: anterior ? Boolean(anterior.concluido) : false,
  };

  // Aparece imediatamente na lista do dia e no calendário
  const novaLista = adicionarOuAtualizarTarefaNoDia(atuais, regFinal, { editarId: estado.idAtivo });
  notas[dataAlvo] = novaLista;
  if (dataAlvo === diaSelecionado) {
    renderTarefasLista();
    if (areaEl && document.activeElement !== areaEl) {
      areaEl.value = novaLista.map((t) => t.texto).join('\n');
      atualizarContador();
      aplicarFonteLinhas();
    }
  }
  renderCalendario();
  atualizarIndicadoresSave('salvando', 'Salvando…');

  clearTimeout(formSaveTimer);
  formSaveTimer = setTimeout(
    () => executarAutosaveFormulario(dataAlvo),
    imediato ? 40 : 380
  );
}

async function executarAutosaveFormulario(dataForcada = '') {
  clearTimeout(formSaveTimer);
  formSaveTimer = null;
  if (!(podeCriar('agenda') && podeEditar('agenda'))) return;

  const dataAlvo = dataForcada || diaSelecionado;
  const listaAtual = notas[dataAlvo] || [];
  if (listaAtual.length === 0) return;

  await persistirTarefasDoDia(dataAlvo, listaAtual, {
    forcarAlertaDash: listaAtual.some((t) => t.alertaAtivo),
  });
  limparQueryStringUrl();
}

function prepararOutraTarefaNoFormulario() {
  flushSave();
  tarefaEditandoId = '';
  sessaoTarefaId = gerarIdTarefa();
  if (evHoraEl) evHoraEl.value = '';
  if (evTituloEl) evTituloEl.value = '';
  if (evDescEl) evDescEl.value = '';
  if (evLembEl) evLembEl.value = '';
  if (evLembInfoEl) evLembInfoEl.textContent = '';
  if (evOrigemBadgeEl) evOrigemBadgeEl.textContent = '➕ Nova tarefa — salvamento automático';
  if (evPendentePillEl) {
    evPendentePillEl.textContent = 'Autosave ativo';
    evPendentePillEl.classList.remove('salvando', 'salvo', 'erro');
  }
  evTituloEl?.focus();
}

function abrirFormularioEvento(dados = {}, { origemLink = false } = {}) {
  if (!evFormEl) return;
  flushSave();
  tarefaEditandoId = dados.editarId || '';
  sessaoTarefaId = dados.editarId || gerarIdTarefa();
  avisosLinkAtual = Array.isArray(dados.avisos) ? [...dados.avisos] : [];

  const alvoIso = dados.dataIso || diaSelecionado || isoHoje();
  const [y, m] = alvoIso.split('-').map(Number);
  if (y && m) {
    viewAno = y;
    viewMes = m - 1;
    diaSelecionado = alvoIso;
  }

  if (evTituloEl) evTituloEl.value = dados.titulo || '';
  if (evDataEl) evDataEl.value = diaSelecionado;
  if (evHoraEl) evHoraEl.value = dados.horario || '';
  if (evDescEl) evDescEl.value = dados.descricao || '';
  if (evLembEl) evLembEl.value = dados.lembrete || '';
  if (evOrigemBadgeEl) {
    if (tarefaEditandoId) {
      evOrigemBadgeEl.textContent = '✏️ Editando tarefa — alterações salvas automaticamente';
    } else if (origemLink && dados.temDadosEvento) {
      evOrigemBadgeEl.textContent = '🔗 Compromisso recebido por link — salvamento automático';
    } else {
      evOrigemBadgeEl.textContent = '➕ Nova tarefa — digite ou cole para salvar automaticamente';
    }
  }

  if (evAvisoEl) {
    if (avisosLinkAtual.length > 0) {
      evAvisoEl.textContent = 'ℹ️ ' + avisosLinkAtual.join(' ');
      evAvisoEl.hidden = false;
    } else {
      evAvisoEl.textContent = '';
      evAvisoEl.hidden = true;
    }
  }

  evFormEl.hidden = false;
  carregarEditor();
  atualizarInfoLembreteFormulario(lerCamposFormularioEvento());
  if (evPendentePillEl) {
    evPendentePillEl.textContent = 'Autosave ativo';
    evPendentePillEl.classList.remove('salvando', 'salvo', 'erro');
  }
  renderCalendario();

  if (origemLink) {
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch { /* jsdom */ }
  } else {
    requestAnimationFrame(() => {
      painelEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
}

function fecharFormularioEvento({ restaurarEditor = true, limparUrl = false } = {}) {
  flushSave();
  tarefaEditandoId = '';
  sessaoTarefaId = '';
  avisosLinkAtual = [];
  if (evFormEl) evFormEl.hidden = true;
  if (evAvisoEl) { evAvisoEl.hidden = true; evAvisoEl.textContent = ''; }
  if (limparUrl) limparQueryStringUrl();
  if (restaurarEditor) {
    carregarEditor();
  }
}

async function tratarColagemInteligenteNoTitulo(e) {
  if (!(podeCriar('agenda') && podeEditar('agenda'))) return;
  const colado = (e.clipboardData || window.clipboardData)?.getData('text') || '';
  if (!colado.trim()) return;

  const interpretado = interpretarTextoColado(colado);
  if (!interpretado) return;

  // Caso 1: Lista de múltiplas tarefas colada de uma só vez
  if (interpretado.tipo === 'multiplas') {
    e.preventDefault();
    const atuais = notas[diaSelecionado] || [];
    let combinadas = [...atuais];
    for (const item of interpretado.tarefas) {
      const reg = criarRegistroTarefa({
        horario: item.horario,
        titulo: item.titulo,
        cor: corDiaSel,
      });
      if (reg.texto && !tarefaJaExisteNoDia(combinadas, reg)) {
        combinadas = adicionarOuAtualizarTarefaNoDia(combinadas, reg);
      }
    }
    prepararOutraTarefaNoFormulario();
    await persistirTarefasDoDia(diaSelecionado, combinadas, { forcarAlertaDash: true });
    return;
  }

  // Caso 2: Bloco estruturado (ex.: Título / Data / Horário / Descrição / Lembrete)
  if (interpretado.tipo === 'estruturada') {
    e.preventDefault();
    if (interpretado.dataIso) {
      const [y, m] = interpretado.dataIso.split('-').map(Number);
      if (y && m) {
        viewAno = y;
        viewMes = m - 1;
        diaSelecionado = interpretado.dataIso;
        if (evDataEl) evDataEl.value = diaSelecionado;
      }
    }
    if (interpretado.horario && evHoraEl) evHoraEl.value = interpretado.horario;
    if (interpretado.titulo && evTituloEl) evTituloEl.value = interpretado.titulo;
    if (interpretado.descricao && evDescEl) evDescEl.value = interpretado.descricao;
    if (interpretado.lembrete && evLembEl) evLembEl.value = interpretado.lembrete;
    agendarAutosaveFormulario({ imediato: true });
    return;
  }

  // Caso 3: Linha única com horário embutido (ex.: "08:00 — Jogo do Grêmio.")
  if (interpretado.tipo === 'unica' && interpretado.horario && (!evTituloEl.value || !evHoraEl?.value)) {
    e.preventDefault();
    if (evHoraEl && !evHoraEl.value) evHoraEl.value = interpretado.horario;
    if (evTituloEl) evTituloEl.value = interpretado.titulo;
    agendarAutosaveFormulario({ imediato: true });
  }
}

async function copiarTextoAreaTransferencia(texto) {
  if (typeof window !== 'undefined') window.__agUltimoResumoCopiado = texto;
  const nav = (typeof window !== 'undefined' && window.navigator) || (typeof navigator !== 'undefined' ? navigator : null);
  if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
    try {
      await nav.clipboard.writeText(texto);
      return true;
    } catch { /* fallback abaixo */ }
  }
  try {
    const temp = document.createElement('textarea');
    temp.value = texto;
    temp.setAttribute('readonly', 'true');
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    temp.style.pointerEvents = 'none';
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : true;
    temp.remove();
    return ok !== false;
  } catch {
    return false;
  }
}

async function acaoCopiarEvento(botaoAlvo) {
  let resumo = '';
  if (evFormEl && !evFormEl.hidden) {
    const estado = lerCamposFormularioEvento();
    resumo = montarResumoEvento({
      titulo: estado.titulo,
      dataIso: estado.dataIso,
      horario: estado.horario,
      descricao: estado.descricao,
      lembrete: estado.lembrete,
      horaAlerta: estado.lRes.horaAlerta || alertaHoraEl?.value || '',
      tarefasDia: notas[diaSelecionado] || [],
      textoLivreDia: areaEl?.value || '',
    });
  } else {
    resumo = montarResumoEvento({
      dataIso: diaSelecionado,
      horaAlerta: alertaHoraEl?.value || '',
      tarefasDia: notas[diaSelecionado] || [],
      textoLivreDia: areaEl?.value || '',
    });
  }

  if (!resumo) {
    toast('⚠️ Nenhum evento ou anotação neste dia para copiar');
    return;
  }

  const copiou = await copiarTextoAreaTransferencia(resumo);
  if (!copiou) {
    toast('❌ Não foi possível copiar automaticamente');
    return;
  }

  if (botaoAlvo) {
    const original = botaoAlvo.dataset.rotuloOriginal || botaoAlvo.textContent;
    botaoAlvo.dataset.rotuloOriginal = original;
    botaoAlvo.textContent = '✓ Evento copiado!';
    setTimeout(() => { botaoAlvo.textContent = original; }, 1800);
  }
  toast('📋 Evento copiado!');
}

// ── snapshot em tempo real ─────────────────────────────────────────
function iniciar() {
  const hoje = new Date();
  viewAno = hoje.getFullYear();
  viewMes = hoje.getMonth();

  // Hidrata imediatamente eventuais tarefas salvas localmente durante falha de conexão anterior (garante F5 offline)
  for (const [dataPend, objPend] of Object.entries(pendenciasOffline)) {
    if (objPend && Array.isArray(objPend.notas) && objPend.notas.length > 0) {
      notas[dataPend] = deduplicarListaTarefas(objPend.notas);
      corPorDia[dataPend] = corValida(objPend.cor || COR_PADRAO);
      alertaPorDia[dataPend] = { hora: objPend.alertaHora || '', dashboard: Boolean(objPend.alertaDashboard) };
    }
  }

  const dadosLink = lerLinkInteligente(obterSearchAtual(), isoHoje(), obterHashAtual());
  let autoGravarLinkPendente = false;

  if (dadosLink.ativo) {
    if (dadosLink.dataIso) {
      const [y, m] = dadosLink.dataIso.split('-').map(Number);
      if (y && m) {
        viewAno = y;
        viewMes = m - 1;
        diaSelecionado = dadosLink.dataIso;
      }
      if (dadosLink.dataValidaNoLink) {
        dataVindaDaUrl = dadosLink.dataIso;
      }
    }

    const wrapConteudo = document.querySelector('.ag-content');
    const btnColapso = $('ag-colapse-btn');
    if (wrapConteudo && wrapConteudo.classList.contains('ag-recolhido')) {
      wrapConteudo.classList.remove('ag-recolhido');
      if (btnColapso) {
        btnColapso.textContent = '▲';
        btnColapso.title = 'Recolher navegação e busca';
      }
    }

    abrirFormularioEvento(dadosLink, { origemLink: true });
    if (dadosLink.temDadosEvento && (dadosLink.titulo || dadosLink.descricao)) {
      autoGravarLinkPendente = true;
    }

    if (dadosLink.avisos.length) {
      toast('⚠️ ' + dadosLink.avisos[0]);
    }
  } else {
    carregarEditor();
    renderCalendario();
    if (dadosLink.avisos && dadosLink.avisos.length) {
      toast('⚠️ ' + dadosLink.avisos[0]);
    }
  }

  Agenda.onChange((lista) => {
      const primeiraCarga = !agendaCarregada;
      const novasNotas = {};
      docIds = {};
      corPorDia = {};
      alertaPorDia = {};
      recorrenciaPorDia = {};
      recorrenciaExcluir = {};
      recorrenciaPararEm = {};
      textoCorDia = {};
      lista.forEach(dados => {
        const data = dados.data || dados.id;
        let arr = [];
        let corDoc = corValida(dados.cor);
        if (dados.alertaHora || dados.alertaDashboard) {
          alertaPorDia[data] = { hora: dados.alertaHora || '', dashboard: !!dados.alertaDashboard };
        }
        if (dados.recorrencia) recorrenciaPorDia[data] = dados.recorrencia;
        if (Array.isArray(dados.recorrenciaExcluir) && dados.recorrenciaExcluir.length) {
          recorrenciaExcluir[data] = dados.recorrenciaExcluir;
        }
        if (dados.recorrenciaPararEm) {
          recorrenciaPararEm[data] = dados.recorrenciaPararEm;
        }
        if (dados.textoCor) {
          textoCorDia[data] = dados.textoCor;
        }
        if (Array.isArray(dados.notas)) {
          arr = dados.notas
            .map(n => normalizarRegistroTarefa(n, corDoc))
            .filter(Boolean);
          if (!dados.cor && dados.notas[0]) corDoc = corValida(dados.notas[0].cor);
        } else if (typeof dados.texto === 'string') {           // formato anterior (1 nota multiline)
          arr = dados.texto.split(/\r?\n+/).map(t => normalizarRegistroTarefa({ texto: t, cor: corDoc }, corDoc)).filter(Boolean);
        } else if (dados.titulo) {                              // formato bem antigo
          arr = [normalizarRegistroTarefa({ texto: `${dados.hora ? dados.hora + ' ' : ''}${dados.titulo}`, cor: corDoc }, corDoc)].filter(Boolean);
        }
        (docIds[data] = docIds[data] || []).push(dados.id);
        if (arr.length) { novasNotas[data] = ordenarTarefasCronologicamente(arr); corPorDia[data] = corDoc; }
      });

      // Preserva conteúdo local caso algum dia ainda esteja aguardando reconexão para sincronizar
      for (const [dataPend, objPend] of Object.entries(pendenciasOffline)) {
        if (objPend && Array.isArray(objPend.notas)) {
          novasNotas[dataPend] = deduplicarListaTarefas([
            ...(novasNotas[dataPend] || []),
            ...objPend.notas,
          ]);
          corPorDia[dataPend] = corValida(objPend.cor || corPorDia[dataPend] || COR_PADRAO);
        }
      }
      notas = novasNotas;

      agendaCarregada = true;
      if (resolverCargaInicial) { resolverCargaInicial(); resolverCargaInicial = null; }
      $('ag-loading')?.remove();
      renderCalendario();
      verificarLembretesVivos();

      if (autoGravarLinkPendente) {
        autoGravarLinkPendente = false;
        if (podeCriar('agenda') && podeEditar('agenda')) {
          agendarAutosaveFormulario({ imediato: true });
        }
      } else if (!editando || (primeiraCarga && !usuarioDigitouNoEditor)) {
        carregarEditor();
        if (primeiraCarga && dadosLink.ativo && dadosLink.somenteData && evTituloEl && !evTituloEl.hasAttribute('readonly')) {
          try { evTituloEl.focus({ preventScroll: true }); } catch { evTituloEl.focus(); }
        }
      }

      if (Object.keys(pendenciasOffline).length > 0) {
        processarPendenciasOffline();
      }
    }, { onError: (err) => {
      agendaCarregada = true;
      if (resolverCargaInicial) { resolverCargaInicial(); resolverCargaInicial = null; }
      console.warn('⚠️ Agenda offline', err);
      atualizarIndicadoresSave('erro', '⚠️ Sem conexão — alterações serão salvas ao reconectar');
    } });

  // Atualiza o destaque de "hoje" e verifica lembretes individuais a cada 30s
  setInterval(() => { renderCalendario(); verificarLembretesVivos(); }, 30000);
}

// trava/destrava re-render do editor conforme o foco.
// NÃO recarrega o editor no blur (evita apagar texto ainda não salvo);
// mudanças vindas de outro dispositivo chegam pelo onSnapshot.
painelEl.addEventListener('focusin', () => { editando = true; });
painelEl.addEventListener('focusout', () => {
  setTimeout(() => { if (!painelEl.contains(document.activeElement)) editando = false; }, 150);
});

// Área de texto única: salva automaticamente ao digitar ou colar, cresce e atualiza contador
areaEl.addEventListener('input', () => {
  usuarioDigitouNoEditor = true;
  const atuais = lerLinhas();
  notas[diaSelecionado] = atuais;
  renderTarefasLista();
  renderCalendario();
  agendarSave(420);
  autoGrow();
  atualizarContador();
});
areaEl.addEventListener('paste', () => {
  setTimeout(() => { agendarSave(80); }, 10);
});
areaEl.addEventListener('blur', () => { flushSave(); });

// Eventos de AUTOSAVE do formulário de tarefa (sem botão Salvar)
evTituloEl?.addEventListener('paste', tratarColagemInteligenteNoTitulo);
[evTituloEl, evDescEl, evLembEl].forEach((el) => {
  el?.addEventListener('input', () => agendarAutosaveFormulario({ imediato: false }));
  el?.addEventListener('blur', () => flushSave());
});
evHoraEl?.addEventListener('input', () => agendarAutosaveFormulario({ imediato: true }));
evHoraEl?.addEventListener('change', () => agendarAutosaveFormulario({ imediato: true }));
[evTituloEl, evLembEl].forEach((el) => {
  el?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (evTituloEl?.value.trim()) {
        executarAutosaveFormulario().then(() => prepararOutraTarefaNoFormulario());
      }
    }
  });
});

evDataEl?.addEventListener('change', () => {
  const d = parseDataParam(evDataEl.value);
  if (!d.valido) {
    toast('⚠️ Data inválida');
    evDataEl.value = diaSelecionado;
    return;
  }
  flushSave();
  diaSelecionado = d.iso;
  viewAno = d.ano;
  viewMes = d.mesIndex;
  tarefaEditandoId = '';
  sessaoTarefaId = gerarIdTarefa();
  carregarEditor();
  renderCalendario();
  if (evTituloEl && evTituloEl.value.trim()) {
    agendarAutosaveFormulario({ imediato: true });
  }
});

evNovaOutraBtn?.addEventListener('click', prepararOutraTarefaNoFormulario);
evCopiarBtn?.addEventListener('click', () => acaoCopiarEvento(evCopiarBtn));
copiarDiaBtn?.addEventListener('click', () => acaoCopiarEvento(copiarDiaBtn));
evDescartarBtn?.addEventListener('click', () => fecharFormularioEvento({ restaurarEditor: true, limparUrl: true }));
abrirNovoEvBtn?.addEventListener('click', () => {
  if (!(podeCriar('agenda') && podeEditar('agenda'))) {
    toast('⚠️ Sem permissão para criar tarefas na agenda');
    return;
  }
  if (evFormEl && !evFormEl.hidden && !tarefaEditandoId) {
    fecharFormularioEvento({ restaurarEditor: true, limparUrl: false });
  } else {
    abrirFormularioEvento({ dataIso: diaSelecionado }, { origemLink: false });
    evTituloEl?.focus();
  }
});

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

// Botões de ação do popup de recorrência
$('ag-recorr-esta')?.addEventListener('click', pararEstaOcorrencia);
$('ag-recorr-futuras')?.addEventListener('click', pararFuturas);

// Seletor de cor do texto (paleta de 7 cores)
document.querySelectorAll('.ag-tcor-btn').forEach(b => {
  b.addEventListener('click', () => escolherTextoCor(b.dataset.cor));
});

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
// Rola até o topo mostrando o calendário inteiro (cabeçalho + semana + 1ª linha),
// sem ficar cortado atrás da barra superior fixa.
function rolarParaCalendario() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
// Botão HOJE: volta ao mês atual e seleciona/destaca o dia de hoje.
function irHoje() {
  flushSave();
  if (evFormEl && !evFormEl.hidden) {
    fecharFormularioEvento({ restaurarEditor: false });
  }
  if (dataVindaDaUrl) {
    dataVindaDaUrl = '';
    sincronizarDataNaUrl('');
  }
  const h = new Date(); viewAno = h.getFullYear(); viewMes = h.getMonth();
  diaSelecionado = isoHoje();
  editando = false;
  usuarioDigitouNoEditor = false;
  carregarEditor();
  renderCalendario();
  rolarParaCalendario();
}
$('ag-hoje').addEventListener('click', irHoje);
$('ag-fonte-menos').addEventListener('click', () => mudarFonte(-2));
$('ag-fonte-mais').addEventListener('click', () => mudarFonte(2));

// Título dividido em duas funções:
//   "📅 Agenda"   → apenas rola para o calendário principal (não abre mini)
//   "Inteligente" → abre/fecha o mini calendário (toggle)
const tituloPagina = document.querySelector('.ag-header-titulo');
const navAgenda = $('ag-nav-agenda');
const navInteligente = $('ag-nav-inteligente');
if (navAgenda) navAgenda.addEventListener('click', (e) => { e.stopPropagation(); fecharMini(); expandirBusca(); irHoje(); });
if (navInteligente) navInteligente.addEventListener('click', (e) => {
  e.stopPropagation();
  if (miniEl && !miniEl.hidden) fecharMini(); else abrirMini();
});

// Mini calendário: navegação e fechamento
$('ag-mini-prev')?.addEventListener('click', (e) => { e.stopPropagation(); navMini(-1); });
$('ag-mini-next')?.addEventListener('click', (e) => { e.stopPropagation(); navMini(1); });

// Modal do dia: fechar e editar
$('ag-modal-x')?.addEventListener('click', fecharDiaModal);
modalOverlay?.addEventListener('click', (e) => { if (e.target === modalOverlay) fecharDiaModal(); });
$('ag-modal-editar')?.addEventListener('click', () => {
  const iso = modalDia;
  fecharDiaModal();
  if (iso) selecionarDia(iso);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { fecharDiaModal(); fecharMini(); } });
document.addEventListener('click', (e) => {
  if (miniEl && !miniEl.hidden && !miniEl.contains(e.target) && !tituloPagina?.contains(e.target)) {
    fecharMini();
  }
});

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

// Busca recolhível: "Agenda" recolhe; lupa expande
const buscaArea = $('ag-busca-area');
function recolherBusca() {
  if (!buscaArea) return;
  if (buscaInput) buscaInput.value = '';
  buscar('');                       // limpa destaque/resultados
  buscaArea.classList.add('recolhida');
}
function expandirBusca() {
  if (!buscaArea) return;
  buscaArea.classList.remove('recolhida');
  buscaInput?.focus();
}
$('ag-lupa')?.addEventListener('click', expandirBusca);

// Densidade do calendário (compacto / expandido) — preferência salva
const DENSIDADE_KEY = 'ag_densidade';
function aplicarDensidade(modo) {
  const exp = modo === 'expandido';
  document.body.classList.toggle('ag-den-expandido', exp);
  const btn = $('ag-densidade');
  if (btn) { btn.textContent = exp ? '⊟' : '⊞'; btn.title = exp ? 'Mudar para compacto' : 'Mudar para expandido'; }
  requestAnimationFrame(ajustarQuadrados);
}
$('ag-densidade')?.addEventListener('click', () => {
  const novo = document.body.classList.contains('ag-den-expandido') ? 'compacto' : 'expandido';
  localStorage.setItem(DENSIDADE_KEY, novo);
  aplicarDensidade(novo);
});
aplicarDensidade(localStorage.getItem(DENSIDADE_KEY) || 'compacto');

// ── EXPANDIR / RECOLHER navegação e busca ───────────────────────────
const COLAPSE_KEY = 'ag_colapse';
const colapseBtn = $('ag-colapse-btn');
const agContent = document.querySelector('.ag-content');

function aplicarColapso(recolhido) {
  if (!agContent) return;
  agContent.classList.toggle('ag-recolhido', recolhido);
  if (colapseBtn) {
    colapseBtn.textContent = recolhido ? '▼' : '▲';
    colapseBtn.title = recolhido ? 'Expandir navegação e busca' : 'Recolher navegação e busca';
  }
  localStorage.setItem(COLAPSE_KEY, recolhido ? '1' : '');
}

if (colapseBtn && agContent) {
  colapseBtn.addEventListener('click', () => {
    aplicarColapso(!agContent.classList.contains('ag-recolhido'));
  });
  // Restaura estado salvo
  const salvo = localStorage.getItem(COLAPSE_KEY) === '1';
  aplicarColapso(salvo);
}

// ── RECOLHER OPÇÕES INFERIORES (fonte, cores, alerta, repetição) ──
const OPTS_COLAPSE_KEY = 'ag_opts_colapse';
const optsColapseBtn = $('ag-colapse-opts');
const optsWrap = $('ag-opts-wrap');

function aplicarOptsColapso(recolhido) {
  if (!optsWrap || !optsColapseBtn) return;
  optsWrap.classList.toggle('ag-recolhido', recolhido);
  optsColapseBtn.textContent = recolhido ? '▼ Mostrar opções' : '▲ Ocultar opções';
  optsColapseBtn.title = recolhido ? 'Mostrar opções de formatação' : 'Ocultar opções de formatação';
  localStorage.setItem(OPTS_COLAPSE_KEY, recolhido ? '1' : '');
}

if (optsColapseBtn && optsWrap) {
  optsColapseBtn.addEventListener('click', () => {
    aplicarOptsColapso(!optsWrap.classList.contains('ag-recolhido'));
  });
  // Restaura estado salvo
  const salvo = localStorage.getItem(OPTS_COLAPSE_KEY) === '1';
  aplicarOptsColapso(salvo);
}

let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(ajustarQuadrados, 150); });

// ── RBAC (Fase 2, Sprint 2) — moduloId 'agenda'. A UI não distingue
// criar/editar por nota (autosave reescreve o dia inteiro), então a
// textarea só fica editável se AMBAS as permissões estiverem liberadas.
async function _boot() {
  const ctx = await initModulo();
  if (!ctx) return; // kernel.js já redirecionou para login
  await carregarPermissoes(ctx);
  if (!podeVisualizar('agenda')) { window.location.href = URLS.dashboard(); return; }

  iniciar();

  if (!(podeCriar('agenda') && podeEditar('agenda'))) {
    areaEl?.setAttribute('readonly', 'true');
    $('ag-recorr-esta')?.setAttribute('disabled', 'true');
    $('ag-recorr-futuras')?.setAttribute('disabled', 'true');
    evNovaOutraBtn?.setAttribute('disabled', 'true');
    abrirNovoEvBtn?.setAttribute('disabled', 'true');
    alertaHoraEl?.setAttribute('disabled', 'true');
    alertaDashEl?.setAttribute('disabled', 'true');
    recorrEl?.setAttribute('disabled', 'true');
    [evTituloEl, evDataEl, evHoraEl, evDescEl, evLembEl].forEach((el) => el?.setAttribute('readonly', 'true'));
  }
}
_boot();
