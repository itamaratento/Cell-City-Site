/* ============================================================
   META & EVOLUÇÃO — Cell City CRM
   ============================================================ */

import { db } from '../../scripts/firebase.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ===== PALETA =====
const PALETA = [
  { solid: 'rgba(0,230,118,0.80)',  hex: '#00e676' },
  { solid: 'rgba(88,166,255,0.80)', hex: '#58a6ff' },
  { solid: 'rgba(240,180,41,0.80)', hex: '#f0b429' },
  { solid: 'rgba(188,128,240,0.80)',hex: '#bc80f0' },
];

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_NOME  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Índice do mês atual dentro da janela de 6 meses (posição 3 = índice 2)
const CURRENT_IDX = 2;

// ===== ESTADO =====
let _os    = [];
let _caixa = [];
let anosDisponiveis  = [];
let anosSelecionados = [];
let chartFat = null;
let chartOs  = null;

// ===== UTILITÁRIOS =====
const R$ = v => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function extrairAnoMes(valor) {
  if (!valor) return null;
  let d;
  if (valor?.seconds) d = new Date(valor.seconds * 1000);
  else if (typeof valor === 'string') d = new Date(valor.includes('T') ? valor : valor + 'T12:00:00');
  else d = new Date(valor);
  if (isNaN(d)) return null;
  return { ano: d.getFullYear(), mes: d.getMonth() };
}

function somaCaixaMes(ano, mes) {
  return _caixa
    .filter(l => { const am = extrairAnoMes(l.dataISO); return am && am.ano === ano && am.mes === mes; })
    .reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);
}

function contaOSMes(ano, mes) {
  return _os.filter(o => {
    const am = extrairAnoMes(o.createdAt);
    return am && am.ano === ano && am.mes === mes;
  }).length;
}

// ===== JANELA DESLIZANTE 6 MESES =====
// Layout: [mes-2] [mes-1] [ATUAL] [mes+1] [mes+2] [mes+3]
// Mês atual fica fixo no índice CURRENT_IDX (2), visualmente centralizado.
function janela6Meses() {
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const result = [];
  // offsets: -2, -1, 0 (atual), +1, +2, +3
  for (let offset = -2; offset <= 3; offset++) {
    let m = mesAtual + offset;
    let a = anoAtual;
    while (m < 0)  { m += 12; a -= 1; }
    while (m > 11) { m -= 12; a += 1; }
    result.push({
      mes: m,
      ano: a,
      label: MESES_ABREV[m],
      isCurrent: offset === 0,
      isFuture: offset > 0,
    });
  }
  return result;
}

// ===== META AUTOMÁTICA =====
// Prioridade 1: mesmo mês do ano anterior × 1,20 (+20%)
// Prioridade 2: média dos últimos 6 meses × 1,10 (+10%)
// Arredondado para cima em múltiplos de R$ 500
function calcularMetaInteligente(anoAtual, mesAtual) {
  const anoAnt   = anoAtual - 1;
  const refAnoAnt = somaCaixaMes(anoAnt, mesAtual);

  let soma6 = 0, n6 = 0;
  for (let i = 1; i <= 6; i++) {
    let m = mesAtual - i, a = anoAtual;
    if (m < 0) { m += 12; a -= 1; }
    const v = somaCaixaMes(a, m);
    if (v > 0) { soma6 += v; n6++; }
  }
  const media6 = n6 > 0 ? soma6 / n6 : 0;

  if (refAnoAnt > 0) {
    const v1 = refAnoAnt * 1.20;
    const v2 = media6 > 0 ? media6 * 1.10 : 0;
    const valor = Math.ceil(Math.max(v1, v2) / 500) * 500;
    const base  = v1 >= v2
      ? `+20% sobre ${MESES_ABREV[mesAtual]}/${anoAnt}`
      : '+10% sobre média 6 meses';
    return { valor, base, ok: true };
  }

  if (media6 > 0) {
    return {
      valor: Math.ceil(media6 * 1.10 / 500) * 500,
      base: '+10% sobre média 6 meses',
      ok: true,
    };
  }

  return { valor: 0, base: '', ok: false };
}

// ===== PAINEL GERENCIAL =====
function renderPainel() {
  const hoje     = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const anoAnt   = anoAtual - 1;

  const realizado = somaCaixaMes(anoAtual, mesAtual);
  const antAno    = somaCaixaMes(anoAnt, mesAtual);

  // Título
  document.getElementById('painel-mes-header').innerHTML =
    `<strong>${MESES_NOME[mesAtual].toUpperCase()} ${anoAtual}</strong>`;

  // --- Crescimento (número herói) ---
  const crescEl = document.getElementById('painel-cresc-num');
  if (antAno > 0) {
    const diff = (realizado - antAno) / antAno * 100;
    const pos  = diff >= 0;
    crescEl.textContent = (pos ? '+' : '') + diff.toFixed(1) + '%';
    crescEl.className = 'painel-cresc-num' + (pos ? '' : ' neg');
  } else if (realizado > 0) {
    crescEl.textContent = 'Novo mês';
    crescEl.className = 'painel-cresc-num neutro';
  } else {
    crescEl.textContent = '—';
    crescEl.className = 'painel-cresc-num neutro';
  }

  // --- Comparação ---
  document.getElementById('vs-ant-label').textContent  = `${MESES_ABREV[mesAtual]}/${anoAnt}`;
  document.getElementById('vs-ant-valor').textContent  = antAno > 0 ? R$(antAno) : 'Sem dados';
  document.getElementById('vs-atual-label').textContent = `${MESES_ABREV[mesAtual]}/${anoAtual}`;
  document.getElementById('vs-atual-valor').textContent = R$(realizado);

  // --- Meta automática ---
  const { valor: meta, base, ok } = calcularMetaInteligente(anoAtual, mesAtual);

  if (!ok) {
    document.getElementById('painel-meta').style.display  = 'none';
    document.getElementById('painel-sem-dados').style.display = 'block';
    return;
  }

  document.getElementById('painel-meta').style.display     = 'flex';
  document.getElementById('painel-sem-dados').style.display = 'none';
  document.getElementById('meta-num').textContent  = R$(meta);
  document.getElementById('meta-base').textContent = base;

  const pctMeta = meta > 0 ? (realizado / meta * 100) : 0;
  const falta   = Math.max(0, meta - realizado);
  const diasRest = (() => {
    const h = new Date();
    return new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate() - h.getDate() + 1;
  })();

  const barra = document.getElementById('meta-barra-fill');
  barra.style.width = Math.min(pctMeta, 100).toFixed(1) + '%';
  barra.className = 'meta-barra-fill' +
    (pctMeta >= 100 ? '' : pctMeta >= 65 ? ' amarelo' : ' vermelho');
  document.getElementById('meta-barra-pct').textContent = pctMeta.toFixed(0) + '%';

  const statusEl = document.getElementById('meta-status');
  const pdiaEl   = document.getElementById('meta-pdia');

  if (pctMeta >= 100) {
    statusEl.textContent = `✅ Meta superada! +${R$(realizado - meta)}`;
    statusEl.className   = 'meta-status';
    pdiaEl.textContent   = '';
  } else if (falta > 0 && diasRest > 0) {
    statusEl.textContent = `Faltam ${R$(falta)}`;
    statusEl.className   = 'meta-status warn';
    pdiaEl.textContent   = `${R$(falta / diasRest)}/dia — ${diasRest} dias restantes`;
  } else {
    statusEl.textContent = `Faltam ${R$(falta)}`;
    statusEl.className   = 'meta-status neg';
    pdiaEl.textContent   = '';
  }
}

// ===== CHIPS DE ANOS =====
function detectarAnos() {
  const set = new Set();
  _os.forEach(o => { const am = extrairAnoMes(o.createdAt); if (am) set.add(am.ano); });
  _caixa.forEach(l => { const am = extrairAnoMes(l.dataISO); if (am) set.add(am.ano); });
  anosDisponiveis  = Array.from(set).sort((a, b) => b - a);
  anosSelecionados = anosDisponiveis.slice(0, 2);
}

function renderChips() {
  const container = document.getElementById('anos-lista');
  container.innerHTML = '';
  if (!anosDisponiveis.length) {
    container.innerHTML = '<span class="anos-loading">Sem dados</span>';
    return;
  }
  anosDisponiveis.forEach((ano, idx) => {
    const chip = document.createElement('button');
    chip.className  = 'ano-chip' + (anosSelecionados.includes(ano) ? ' ativo' : '');
    chip.dataset.cor = idx % 4;
    chip.textContent = ano;
    chip.addEventListener('click', () => {
      if (anosSelecionados.includes(ano)) {
        if (anosSelecionados.length <= 1) return;
        anosSelecionados = anosSelecionados.filter(a => a !== ano);
        chip.classList.remove('ativo');
      } else {
        anosSelecionados.push(ano);
        chip.classList.add('ativo');
      }
      renderGraficos();
    });
    container.appendChild(chip);
  });
}

// ===== PLUGIN: DESTAQUE VISUAL NO MÊS ATUAL =====
// O mês atual está SEMPRE no índice CURRENT_IDX (2) da janela de 6 meses.
const pluginDestaqueAtual = {
  id: 'destaqueAtual',
  beforeDraw(chart) {
    const { ctx, chartArea: ca, data } = chart;
    if (!ca || !data.labels?.length) return;
    const n = data.labels.length;
    if (n === 0) return;
    const w = (ca.right - ca.left) / n;
    const x = ca.left + w * CURRENT_IDX;
    ctx.save();
    ctx.fillStyle = 'rgba(0,230,118,0.06)';
    ctx.fillRect(x, ca.top, w, ca.bottom - ca.top);
    // Linha superior destacada
    ctx.fillStyle = 'rgba(0,230,118,0.35)';
    ctx.fillRect(x, ca.top, w, 2);
    ctx.restore();
  }
};

// ===== GRÁFICOS =====
function buildDatasets(tipo, janela) {
  const anos = [...anosSelecionados].sort((a, b) => a - b);
  return anos.map(ano => {
    const idx = anosDisponiveis.indexOf(ano) % 4;
    const cor  = PALETA[idx];
    const data = janela.map(({ mes }) =>
      tipo === 'fat' ? somaCaixaMes(ano, mes) : contaOSMes(ano, mes)
    );
    return {
      label: String(ano),
      data,
      backgroundColor: cor.solid,
      hoverBackgroundColor: cor.hex,
      borderRadius: 5,
      borderSkipped: false,
      minBarLength: 6,
      _hex: cor.hex,
    };
  });
}

function renderLegenda(id, datasets) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  datasets.forEach(ds => {
    const item = document.createElement('div');
    item.className = 'leg-item';
    item.innerHTML = `<span class="leg-dot" style="background:${ds._hex}"></span><span>${ds.label}</span>`;
    el.appendChild(item);
  });
}

// Linha de resumo do mês atual exibida acima das barras
function renderDestaque(containerId, janela, datasets, tipo) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (datasets.length < 2) { el.innerHTML = ''; return; }

  const { mes } = janela[CURRENT_IDX];
  const mesNome  = MESES_NOME[mes];
  const vals     = datasets.map(ds => ({ label: ds.label, val: ds.data[CURRENT_IDX] || 0, hex: ds._hex }));
  const [ant, atu] = [vals[0], vals[vals.length - 1]];
  const fmt = tipo === 'fat' ? v => R$(v) : v => `${v} OS`;

  let crescTxt = '';
  if (ant.val > 0) {
    const d   = (atu.val - ant.val) / ant.val * 100;
    const pos = d >= 0;
    crescTxt = ` — <span class="${pos ? 'g-verde' : 'g-neg'}">${pos ? '+' : ''}${d.toFixed(1)}%</span>`;
  }

  el.innerHTML =
    `<strong>${mesNome}:</strong>` +
    ` <span class="g-azul">${ant.label}: ${fmt(ant.val)}</span>` +
    ` <span class="g-dim">→</span>` +
    ` <span class="g-verde">${atu.label}: ${fmt(atu.val)}</span>` +
    crescTxt;
}

// Cores do eixo X: mês atual em branco, futuro em cinza escuro, passado em cinza médio
function xTickColor(janela) {
  return janela.map(j =>
    j.isCurrent ? '#e8e8e8' : j.isFuture ? '#3a3a3a' : '#555'
  );
}

const BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 350 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e1e1e',
      borderColor: '#383838',
      borderWidth: 1,
      titleColor: '#e8e8e8',
      bodyColor: '#909090',
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        color: '#555',
        font: { size: 12, family: 'Inter', weight: '600' },
      },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#505050', font: { size: 11, family: 'Inter' } },
      beginAtZero: true,
    },
  },
};

function renderGraficos() {
  const janela = janela6Meses();
  const labels  = janela.map(j => j.label);
  const tickColors = xTickColor(janela);

  // Opções de escala X com cores por posição
  const xScaleOpts = {
    grid: { display: false },
    ticks: {
      color: ctx => tickColors[ctx.index] || '#555',
      font: ctx => ({
        size: 12,
        family: 'Inter',
        weight: janela[ctx.index]?.isCurrent ? '800' : '500',
      }),
    },
  };

  // ---- FATURAMENTO ----
  const dsFat = buildDatasets('fat', janela);
  renderLegenda('legenda-fat', dsFat);
  renderDestaque('grafico-destaque-fat', janela, dsFat, 'fat');

  if (chartFat) chartFat.destroy();
  chartFat = new Chart(document.getElementById('chart-fat'), {
    type: 'bar',
    data: { labels, datasets: dsFat },
    options: {
      ...BASE_OPTIONS,
      plugins: {
        ...BASE_OPTIONS.plugins,
        tooltip: {
          ...BASE_OPTIONS.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${R$(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: xScaleOpts,
        y: {
          ...BASE_OPTIONS.scales.y,
          ticks: {
            ...BASE_OPTIONS.scales.y.ticks,
            callback: v => v >= 1000 ? 'R$' + (v / 1000).toFixed(0) + 'k' : v === 0 ? '' : 'R$' + v,
          },
        },
      },
    },
    plugins: [pluginDestaqueAtual],
  });

  // ---- OS ----
  const dsOS = buildDatasets('os', janela);
  renderLegenda('legenda-os', dsOS);
  renderDestaque('grafico-destaque-os', janela, dsOS, 'os');

  if (chartOs) chartOs.destroy();
  chartOs = new Chart(document.getElementById('chart-os'), {
    type: 'bar',
    data: { labels, datasets: dsOS },
    options: {
      ...BASE_OPTIONS,
      plugins: {
        ...BASE_OPTIONS.plugins,
        tooltip: {
          ...BASE_OPTIONS.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} OS` },
        },
      },
      scales: {
        x: xScaleOpts,
        y: { ...BASE_OPTIONS.scales.y },
      },
    },
    plugins: [pluginDestaqueAtual],
  });
}

// ===== INICIALIZAÇÃO =====
async function init() {
  try {
    const [snapOS, snapCaixa] = await Promise.all([
      getDocs(collection(db, 'os')),
      getDocs(collection(db, 'caixa_lancamentos')),
    ]);
    _os    = snapOS.docs.map(d => d.data());
    _caixa = snapCaixa.docs.map(d => d.data());
    detectarAnos();
    renderPainel();
    renderChips();
    renderGraficos();
  } catch (err) {
    console.error('Erro ao carregar dados:', err);
  } finally {
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

init();
