/* ============================================================
   RELATÓRIOS — Cell City CRM
   ============================================================ */

import { db } from '../../scripts/firebase.js';
import {
  collection, getDocs, doc, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ─── Paleta ───────────────────────────────────────────────────
const C = {
  green:       'rgba(0, 230, 118, 0.85)',
  greenFill:   'rgba(0, 230, 118, 0.15)',
  greenGhost:  'rgba(0, 230, 118, 0.25)',
  blue:        'rgba(88, 166, 255, 0.85)',
  blueFill:    'rgba(88, 166, 255, 0.15)',
  blueGhost:   'rgba(88, 166, 255, 0.25)',
  red:         'rgba(248, 81, 73, 0.85)',
  redFill:     'rgba(248, 81, 73, 0.15)',
  yellow:      'rgba(210, 153, 34, 0.85)',
  yellowFill:  'rgba(210, 153, 34, 0.15)',
  purple:      'rgba(188, 128, 240, 0.85)',
  gray:        'rgba(139, 148, 158, 0.85)',
  metaFat:     'rgba(88, 166, 255, 1)',
  metaOS:      'rgba(0, 230, 118, 1)',
  grid:        'rgba(255,255,255,0.05)',
};

Chart.defaults.color = '#8b949e';
Chart.defaults.borderColor = C.grid;
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 11;

// ─── Estado ───────────────────────────────────────────────────
let periodoMeses = 3;
let comparar     = false;
let metas        = { faturamento: 0, os: 0 };
let chartOsMes, chartCaixaMes, chartOsStatus, chartTicket;
let _os = [], _caixa = [];

const STATUS_TERMINAIS = ['concluido', 'entregue', 'devolvido_orcamento', 'orcamento_recusado'];

const STATUS_LABEL = {
  recebido: 'Recebido', orcamento: 'Orçamento',
  orcamento_enviado: 'Orç. Enviado', orcamento_aprovado: 'Orç. Aprovado',
  orcamento_recusado: 'Recusado', concluido: 'Concluído',
  entregue: 'Entregue', devolvido_orcamento: 'Devolvido',
};

const STATUS_CORES = [C.blue, C.yellow, C.yellow, C.green, C.red, C.green, 'rgba(0,230,118,0.5)', C.gray];

// ─── Utilitários de data ──────────────────────────────────────
function mesKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesLabel(key) {
  const [ano, mes] = key.split('-');
  const n = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${n[parseInt(mes,10)-1]}/${ano.slice(2)}`;
}

function gerarMeses(qtd, anosAtras = 0) {
  const hoje = new Date();
  const meses = [];
  for (let i = qtd - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear() - anosAtras, hoje.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  return meses;
}

function dataCorte(meses, anosAtras = 0) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - anosAtras);
  d.setMonth(d.getMonth() - meses);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dataFimCorte(anosAtras = 0) {
  const d = new Date();
  if (anosAtras > 0) {
    d.setFullYear(d.getFullYear() - anosAtras);
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function fmtBRL(v) {
  return 'R$ ' + Number(v||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mesAtualKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ─── Fetch ────────────────────────────────────────────────────
async function fetchOS() {
  const snap = await getDocs(collection(db, 'os'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fetchCaixa() {
  const snap = await getDocs(collection(db, 'caixa_lancamentos'));
  return snap.docs.map(d => d.data())
    .filter(l => l.dataISO && ['entrada','saida','servico'].includes(l.tipo));
}

async function fetchMetas() {
  try {
    const snap = await getDoc(doc(db, 'config', 'relatorios_metas'));
    if (snap.exists()) metas = { faturamento: snap.data().faturamento || 0, os: snap.data().os || 0 };
  } catch (e) { console.warn('[Relatórios] Sem metas salvas'); }
}

async function salvarMetas(fat, os) {
  await setDoc(doc(db, 'config', 'relatorios_metas'), { faturamento: fat, os });
  metas = { faturamento: fat, os };
}

// ─── Cards de metas (mês atual) ───────────────────────────────
function atualizarCardsMetas() {
  const secao = document.getElementById('metas-section');
  if (!metas.faturamento && !metas.os) { secao.classList.remove('visivel'); return; }
  secao.classList.add('visivel');

  const mesKey_ = mesAtualKey();

  // Faturamento do mês atual
  const fatAtual = _caixa
    .filter(l => mesKey(l.dataISO) === mesKey_ && (l.tipo === 'entrada' || l.tipo === 'servico'))
    .reduce((s, l) => s + (l.valor || 0), 0);

  // OS concluídas no mês atual
  const osAtual = _os.filter(o => mesKey(o.createdAt) === mesKey_ &&
    (o.status === 'concluido' || o.status === 'entregue')).length;

  _renderMetaCard('fat', fatAtual, metas.faturamento, fmtBRL(fatAtual), fmtBRL(metas.faturamento),
    v => `Faltam ${fmtBRL(v)}`);
  _renderMetaCard('os', osAtual, metas.os, String(osAtual), String(metas.os),
    v => `Faltam ${v} OS`);
}

function _renderMetaCard(id, realizado, meta, labelReal, labelMeta, labelFaltando) {
  if (!meta) return;
  const pct = Math.min(Math.round((realizado / meta) * 100), 100);
  const estado = pct >= 80 ? 'verde' : pct >= 50 ? 'amarelo' : 'vermelho';

  const card   = document.getElementById(`meta-${id}-card`);
  const badge  = document.getElementById(`meta-${id}-pct`);
  const barra  = document.getElementById(`meta-${id}-barra`);
  const falt   = document.getElementById(`meta-${id}-faltando`);

  card.className  = `meta-card ${estado}`;
  badge.className = `meta-pct-badge ${estado}`;
  barra.className = `meta-barra-fill ${estado}`;

  badge.textContent = `${pct}%`;
  document.getElementById(`meta-${id}-realizado`).textContent = labelReal;
  document.getElementById(`meta-${id}-alvo`).textContent = labelMeta;
  barra.style.width = `${pct}%`;

  const faltaQtd = meta - realizado;
  falt.textContent = pct >= 100 ? '✅ Meta atingida!' : (faltaQtd > 0 ? labelFaltando(
    id === 'fat' ? faltaQtd : Math.ceil(faltaQtd)
  ) : '');
}

// ─── Gráfico 1: OS por mês ────────────────────────────────────
function renderOsMes(meses, mesesAnt) {
  const abertas = {}, concluidas = {};
  meses.forEach(m => { abertas[m] = 0; concluidas[m] = 0; });
  _os.forEach(o => {
    const m = mesKey(o.createdAt); if (!m || !(m in abertas)) return;
    abertas[m]++;
    if (STATUS_TERMINAIS.includes(o.status)) concluidas[m]++;
  });

  const labels = meses.map(mesLabel);
  const datasets = [
    { label: 'Total abertas', data: meses.map(m => abertas[m]),
      backgroundColor: C.blueFill, borderColor: C.blue, borderWidth: 2, borderRadius: 6 },
    { label: 'Concluídas/Entregues', data: meses.map(m => concluidas[m]),
      backgroundColor: C.greenFill, borderColor: C.green, borderWidth: 2, borderRadius: 6 },
  ];

  if (comparar && mesesAnt) {
    const abAnt = {}, concAnt = {};
    mesesAnt.forEach(m => { abAnt[m] = 0; concAnt[m] = 0; });
    _os.forEach(o => {
      const m = mesKey(o.createdAt); if (!m || !(m in abAnt)) return;
      abAnt[m]++;
      if (STATUS_TERMINAIS.includes(o.status)) concAnt[m]++;
    });
    const anoAnt = new Date().getFullYear() - 1;
    datasets.push(
      { label: `Total abertas ${anoAnt}`, data: mesesAnt.map(m => abAnt[m]),
        backgroundColor: 'rgba(88,166,255,0.05)', borderColor: 'rgba(88,166,255,0.4)',
        borderWidth: 1.5, borderRadius: 6, borderDash: [4,4] },
      { label: `Concluídas ${anoAnt}`, data: mesesAnt.map(m => concAnt[m]),
        backgroundColor: 'rgba(0,230,118,0.05)', borderColor: 'rgba(0,230,118,0.35)',
        borderWidth: 1.5, borderRadius: 6, borderDash: [4,4] }
    );
  }

  if (metas.os > 0) {
    datasets.push({ label: `Meta (${metas.os} OS)`, data: meses.map(() => metas.os),
      type: 'line', borderColor: C.metaOS, borderWidth: 2, borderDash: [6, 4],
      pointRadius: 0, fill: false, tension: 0 });
  }

  const ctx = document.getElementById('chart-os-mes').getContext('2d');
  if (chartOsMes) chartOsMes.destroy();
  chartOsMes = new Chart(ctx, {
    type: 'bar', data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } } },
      scales: {
        x: { grid: { color: C.grid } },
        y: { grid: { color: C.grid }, beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

// ─── Gráfico 2: Caixa por mês ─────────────────────────────────
function renderCaixaMes(meses, mesesAnt) {
  const entradas = {}, saidas = {};
  meses.forEach(m => { entradas[m] = 0; saidas[m] = 0; });
  _caixa.forEach(l => {
    const m = mesKey(l.dataISO); if (!m || !(m in entradas)) return;
    if (l.tipo === 'entrada' || l.tipo === 'servico') entradas[m] += l.valor || 0;
    else if (l.tipo === 'saida') saidas[m] += l.valor || 0;
  });

  const labels = meses.map(mesLabel);
  const datasets = [
    { label: 'Entradas', data: meses.map(m => Math.round(entradas[m]*100)/100),
      borderColor: C.green, backgroundColor: C.greenFill,
      borderWidth: 2.5, fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: C.green },
    { label: 'Saídas', data: meses.map(m => Math.round(saidas[m]*100)/100),
      borderColor: C.red, backgroundColor: C.redFill,
      borderWidth: 2.5, fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: C.red },
  ];

  if (comparar && mesesAnt) {
    const entAnt = {}, saiAnt = {};
    mesesAnt.forEach(m => { entAnt[m] = 0; saiAnt[m] = 0; });
    _caixa.forEach(l => {
      const m = mesKey(l.dataISO); if (!m || !(m in entAnt)) return;
      if (l.tipo === 'entrada' || l.tipo === 'servico') entAnt[m] += l.valor || 0;
      else if (l.tipo === 'saida') saiAnt[m] += l.valor || 0;
    });
    const anoAnt = new Date().getFullYear() - 1;
    datasets.push(
      { label: `Entradas ${anoAnt}`, data: mesesAnt.map(m => Math.round(entAnt[m]*100)/100),
        borderColor: 'rgba(0,230,118,0.4)', backgroundColor: 'transparent',
        borderWidth: 1.5, borderDash: [6,4], fill: false, tension: 0.35,
        pointRadius: 3, pointBackgroundColor: 'rgba(0,230,118,0.4)' },
      { label: `Saídas ${anoAnt}`, data: mesesAnt.map(m => Math.round(saiAnt[m]*100)/100),
        borderColor: 'rgba(248,81,73,0.4)', backgroundColor: 'transparent',
        borderWidth: 1.5, borderDash: [6,4], fill: false, tension: 0.35,
        pointRadius: 3, pointBackgroundColor: 'rgba(248,81,73,0.4)' },
    );
  }

  if (metas.faturamento > 0) {
    datasets.push({ label: `Meta R$ ${Number(metas.faturamento).toLocaleString('pt-BR')}`,
      data: meses.map(() => metas.faturamento), type: 'line',
      borderColor: C.metaFat, borderWidth: 2, borderDash: [6, 4],
      pointRadius: 0, fill: false, tension: 0 });
  }

  const ctx = document.getElementById('chart-caixa-mes').getContext('2d');
  if (chartCaixaMes) chartCaixaMes.destroy();
  chartCaixaMes = new Chart(ctx, {
    type: 'line', data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } } },
      scales: {
        x: { grid: { color: C.grid } },
        y: { grid: { color: C.grid }, beginAtZero: true,
          ticks: { callback: v => 'R$ ' + v.toLocaleString('pt-BR') } },
      },
    },
  });
}

// ─── Gráfico 3: OS por status ─────────────────────────────────
function renderOsStatus(meses) {
  const corte = new Date(meses[0] + '-01');
  const filtradas = _os.filter(o => { const d = new Date(o.createdAt); return !isNaN(d) && d >= corte; });
  const contagem = {};
  filtradas.forEach(o => { const s = o.status||'recebido'; contagem[s] = (contagem[s]||0)+1; });
  const chaves = Object.keys(contagem).sort((a,b) => contagem[b]-contagem[a]);

  const ctx = document.getElementById('chart-os-status').getContext('2d');
  if (chartOsStatus) chartOsStatus.destroy();
  chartOsStatus = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: chaves.map(k => STATUS_LABEL[k]||k),
      datasets: [{ data: chaves.map(k => contagem[k]),
        backgroundColor: chaves.map((_,i) => STATUS_CORES[i%STATUS_CORES.length]),
        borderColor: 'rgba(13,17,23,0.8)', borderWidth: 3, hoverOffset: 6 }],
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 11 } } } } },
  });
}

// ─── Gráfico 4: Ticket médio ──────────────────────────────────
function renderTicketMedio(meses) {
  const corte = new Date(meses[0] + '-01');
  const soma = {}, qtd = {};
  meses.forEach(m => { soma[m] = 0; qtd[m] = 0; });
  _os.filter(o => { const d = new Date(o.createdAt); return !isNaN(d) && d >= corte && STATUS_TERMINAIS.includes(o.status); })
    .forEach(o => {
      const m = mesKey(o.createdAt); if (!m || !(m in soma)) return;
      const v = (o.valor||0) + (o.valorCartao||0);
      if (v > 0) { soma[m] += v; qtd[m]++; }
    });

  const ctx = document.getElementById('chart-ticket-medio').getContext('2d');
  if (chartTicket) chartTicket.destroy();
  chartTicket = new Chart(ctx, {
    type: 'line',
    data: {
      labels: meses.map(mesLabel),
      datasets: [{ label: 'Ticket médio', data: meses.map(m => qtd[m] > 0 ? Math.round(soma[m]/qtd[m]*100)/100 : null),
        borderColor: C.yellow, backgroundColor: C.yellowFill,
        borderWidth: 2.5, fill: true, tension: 0.35, pointRadius: 5,
        pointBackgroundColor: C.yellow, spanGaps: true }],
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: C.grid } },
        y: { grid: { color: C.grid }, beginAtZero: true,
          ticks: { callback: v => 'R$ ' + v.toLocaleString('pt-BR') } },
      },
    },
  });
}

// ─── Cards de resumo ──────────────────────────────────────────
function atualizarResumo(meses) {
  const corte = new Date(meses[0] + '-01');

  const osPeriodo = _os.filter(o => { const d = new Date(o.createdAt); return !isNaN(d) && d >= corte; });
  const concluidas = osPeriodo.filter(o => o.status === 'concluido' || o.status === 'entregue');
  const entradas = _caixa
    .filter(l => { const d = new Date(l.dataISO); return !isNaN(d) && d >= corte && (l.tipo==='entrada'||l.tipo==='servico'); })
    .reduce((s, l) => s + (l.valor||0), 0);
  const comValor = concluidas.filter(o => (o.valor||0)+(o.valorCartao||0) > 0);
  const ticket = comValor.length > 0 ? comValor.reduce((s,o) => s+(o.valor||0)+(o.valorCartao||0), 0) / comValor.length : 0;

  document.getElementById('res-val-os').textContent = osPeriodo.length;
  document.getElementById('res-val-concluidas').textContent = concluidas.length;
  document.getElementById('res-val-fat').textContent = fmtBRL(entradas);
  document.getElementById('res-val-ticket').textContent = ticket > 0 ? fmtBRL(ticket) : '—';
}

// ─── Render principal ─────────────────────────────────────────
function renderTodos() {
  const meses    = gerarMeses(periodoMeses, 0);
  const mesesAnt = gerarMeses(periodoMeses, 1);
  atualizarResumo(meses);
  atualizarCardsMetas();
  renderOsMes(meses, mesesAnt);
  renderCaixaMes(meses, mesesAnt);
  renderOsStatus(meses);
  renderTicketMedio(meses);
}

// ─── Modal metas ──────────────────────────────────────────────
function abrirModal() {
  document.getElementById('input-meta-fat').value = metas.faturamento || '';
  document.getElementById('input-meta-os').value  = metas.os || '';
  document.getElementById('modal-metas').classList.remove('oculto');
}

function fecharModal() {
  document.getElementById('modal-metas').classList.add('oculto');
}

// ─── Init ─────────────────────────────────────────────────────
async function init() {
  document.getElementById('loading-overlay').classList.remove('oculto');
  document.getElementById('modal-metas').classList.add('oculto');

  try {
    [_os, _caixa] = await Promise.all([fetchOS(), fetchCaixa(), fetchMetas()]);
    await fetchMetas();
    renderTodos();
  } catch (e) {
    console.error('[Relatórios] Erro:', e);
  } finally {
    document.getElementById('loading-overlay').classList.add('oculto');
  }
}

// Período
document.querySelectorAll('.periodo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.periodo-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    periodoMeses = parseInt(btn.dataset.meses, 10);
    renderTodos();
  });
});

// Comparar
document.getElementById('btn-comparar').addEventListener('click', () => {
  comparar = !comparar;
  document.getElementById('btn-comparar').classList.toggle('ativo', comparar);
  const meses    = gerarMeses(periodoMeses, 0);
  const mesesAnt = gerarMeses(periodoMeses, 1);
  renderOsMes(meses, mesesAnt);
  renderCaixaMes(meses, mesesAnt);
});

// Abrir modal
document.getElementById('btn-abrir-metas').addEventListener('click', abrirModal);
document.getElementById('btn-editar-metas').addEventListener('click', abrirModal);
document.getElementById('btn-modal-cancelar').addEventListener('click', fecharModal);
document.getElementById('modal-metas').addEventListener('click', e => { if (e.target === e.currentTarget) fecharModal(); });

// Salvar metas
document.getElementById('btn-modal-salvar').addEventListener('click', async () => {
  const fat = parseFloat(document.getElementById('input-meta-fat').value) || 0;
  const os  = parseInt(document.getElementById('input-meta-os').value, 10) || 0;
  document.getElementById('btn-modal-salvar').textContent = '⏳ Salvando...';
  try {
    await salvarMetas(fat, os);
    fecharModal();
    renderTodos();
  } catch (e) {
    console.error('[Metas] Erro ao salvar:', e);
  } finally {
    document.getElementById('btn-modal-salvar').textContent = '💾 Salvar';
  }
});

init();
