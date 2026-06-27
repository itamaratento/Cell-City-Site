/* ============================================================
   META & EVOLUÇÃO — Cell City Gestão Empresarial
   Painel ao vivo via onSnapshot — modo Mês / Semana
   ============================================================ */

import { db, collection, onSnapshot, authReady } from '../../scripts/firebase.js';

// ===== PALETA DE CORES POR ANO =====
const PALETA = [
  { solid: 'rgba(0,230,118,0.80)',  hex: '#00e676' },
  { solid: 'rgba(88,166,255,0.80)', hex: '#58a6ff' },
  { solid: 'rgba(240,180,41,0.80)', hex: '#f0b429' },
  { solid: 'rgba(188,128,240,0.80)',hex: '#bc80f0' },
];
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_NOME  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                     'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// Índice do período atual na janela de gráfico (atualizado antes de cada render)
let currentHighlightIdx = 5; // mês atual é o último na janela de 6 meses passados

// ===== ESTADO =====
let _os      = [];
let _caixa   = [];
let anosDisponiveis  = [];
let anosSelecionados = [];
let modoAtual = 'mes'; // 'mes' | 'semana'
let chartFat  = null;
let chartOs   = null;
let _osOk     = false;
let _caixaOk  = false;
let _initialized = false;
let _lastRefresh  = null;

// ===== FORMATAÇÃO =====
const R$ = v => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;

// ===== EXTRAÇÃO DE DATAS =====
function extrairData(valor) {
  if (!valor) return null;
  let d;
  if (valor?.seconds) d = new Date(valor.seconds * 1000);
  else if (typeof valor === 'string') d = new Date(valor.includes('T') ? valor : valor + 'T12:00:00');
  else d = new Date(valor);
  return isNaN(d) ? null : d;
}

// ===== AGREGAÇÕES MENSAIS =====
// ateDia = 0 → mês completo; ateDia > 0 → filtra pelo dia (01 até ateDia)
// Usa campos l.mes ("YYYY-MM") e l.dia ("YYYY-MM-DD") gravados pelo Caixa em timezone SP.
// Soma l.lucro (entrada − custo); saídas já chegam com lucro negativo — não excluir.
function somaCaixaMes(ano, mes, ateDia = 0) {
  const mesKey = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  return _caixa
    .filter(l => {
      if (l.mes !== mesKey) return false;
      if (ateDia === 0) return true;
      const diaNum = l.dia ? parseInt(l.dia.split('-')[2], 10) : null;
      return diaNum !== null && diaNum <= ateDia;
    })
    .reduce((s, l) => s + (parseFloat(l.lucro) || 0), 0);
}

function contaOSMes(ano, mes, ateDia = 0) {
  return _os.filter(o => {
    const d = extrairData(o.createdAt);
    if (!d) return false;
    if (d.getFullYear() !== ano || d.getMonth() !== mes) return false;
    return ateDia === 0 || d.getDate() <= ateDia;
  }).length;
}

// ===== AGREGAÇÕES SEMANAIS =====
// Compara o mesmo recorte da semana (seg a dia-da-semana-atual) entre esta semana e a anterior
function getJanelaSemana() {
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0=Dom
  // Semana começa na segunda (offset: Dom=6, Seg=0, ..., Sáb=5)
  const diasDesdeSegunda = (diaSemana + 6) % 7;

  const inicioAtual = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - diasDesdeSegunda);
  const fimAtual    = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const inicioAnt   = new Date(inicioAtual); inicioAnt.setDate(inicioAtual.getDate() - 7);
  const fimAnt      = new Date(fimAtual);    fimAnt.setDate(fimAtual.getDate() - 7);

  return { atual: { inicio: inicioAtual, fim: fimAtual },
           anterior: { inicio: inicioAnt, fim: fimAnt },
           diasPassados: diasDesdeSegunda + 1 }; // dias decorridos desta semana (incluindo hoje)
}

function somaCaixaSemana(janela) {
  return _caixa
    .filter(l => {
      if (!l.dia) return false;
      const d   = new Date(l.dia + 'T12:00:00'); // noon evita edge de meia-noite
      const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return dia >= janela.inicio && dia <= janela.fim;
    })
    .reduce((s, l) => s + (parseFloat(l.lucro) || 0), 0);
}

// ===== HELPERS =====
function diasRestantesNoMes() {
  const h = new Date();
  return new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate() - h.getDate() + 1;
}

function diasRestantesNaSemana() {
  const h = new Date();
  const diaSemana = h.getDay(); // 0=Dom
  // Até o fim da semana (próximo domingo) mas sem ultrapassar o último dia do mês
  const diasAteSab = (6 - diaSemana + 7) % 7; // dias até Sábado
  return diasAteSab + 1; // inclui hoje (conservador: assume dia ainda não acabou)
}

// ===== META AUTOMÁTICA MENSAL =====
// Busca o Resultado Líquido do mesmo mês nos anos anteriores (até 5 anos).
// Calcula a média histórica e gera 3 níveis: Mínima (0%), Alvo (+20%), Superação (+40%).
// Arredondado para cima em múltiplos de R$ 100.
function calcularMetaMensal(anoAtual, mesAtual) {
  const historico = [];
  for (let a = anoAtual - 1; a >= anoAtual - 5; a--) {
    const v = somaCaixaMes(a, mesAtual);
    if (v > 0) historico.push({ ano: a, valor: v });
  }
  if (!historico.length) {
    return { ok: false, valor: 0, metaMin: 0, metaAlvo: 0, metaSup: 0, base: '', historico: [], anos: [] };
  }

  const media    = historico.reduce((s, h) => s + h.valor, 0) / historico.length;
  const anos     = historico.map(h => h.ano);
  const ceil100  = v => Math.ceil(v / 100) * 100;
  const metaMin  = ceil100(media);
  const metaAlvo = ceil100(media * 1.20);
  const metaSup  = ceil100(media * 1.40);

  return {
    ok: true, media, historico, anos,
    metaMin, metaAlvo, metaSup,
    valor: metaAlvo, // meta principal (barra e barra semanal)
    base: `Média ${MESES_ABREV[mesAtual]}/${anos.join('+')} + 20%`,
  };
}

// ===== META SEMANAL =====
// Meta mensal ÷ (dias no mês / 7) — propaga os três níveis → arredondado em R$100
function calcularMetaSemanal(anoAtual, mesAtual) {
  const mensal = calcularMetaMensal(anoAtual, mesAtual);
  if (!mensal.ok) return { ok: false, valor: 0, metaMin: 0, metaAlvo: 0, metaSup: 0, base: '', historico: [], anos: [] };
  const diasMes    = new Date(anoAtual, mesAtual + 1, 0).getDate();
  const semanasMes = diasMes / 7;
  const ceil100    = v => Math.ceil(v / 100) * 100;
  return {
    ok: true,
    valor:     ceil100(mensal.metaAlvo / semanasMes),
    metaMin:   ceil100(mensal.metaMin  / semanasMes),
    metaAlvo:  ceil100(mensal.metaAlvo / semanasMes),
    metaSup:   ceil100(mensal.metaSup  / semanasMes),
    media:     mensal.media / semanasMes,
    historico: mensal.historico,
    anos:      mensal.anos,
    base:      `Meta mensal ÷ ${semanasMes.toFixed(1)} sem.`,
  };
}

// ===== PREENCHIMENTO DO PAINEL (elementos comuns) =====
function preencherProgressoMeta(realizado, meta) {
  const pct      = meta > 0 ? realizado / meta * 100 : 0;
  const falta    = Math.max(0, meta - realizado);
  const barra    = document.getElementById('meta-barra-fill');

  barra.style.width = Math.min(pct, 100).toFixed(1) + '%';
  barra.className   = 'meta-barra-fill' + (pct >= 100 ? '' : pct >= 65 ? ' amarelo' : ' vermelho');
  document.getElementById('meta-barra-pct').textContent = pct.toFixed(0) + '%';
  document.getElementById('ind-realizado').textContent  = R$(realizado);

  return { pct, falta };
}

function preencherStatusMeta(pct, realizado, meta, falta, diasRest, labelDias) {
  document.getElementById('ind-dias-label').textContent = labelDias;
  document.getElementById('ind-dias').textContent       = `${diasRest} dias`;

  if (pct >= 100) {
    document.getElementById('ind-falta').textContent  = '✅ Meta batida!';
    document.getElementById('ind-falta').className    = 'ind-valor ind-verde';
    document.getElementById('ind-pdia').textContent   = '—';
    document.getElementById('ind-pdia').className     = 'ind-valor ind-sec';
    document.getElementById('meta-status').textContent = `✅ Meta superada em ${R$(realizado - meta)}`;
    document.getElementById('meta-status').className  = 'meta-status';
  } else {
    document.getElementById('ind-falta').textContent  = R$(falta);
    document.getElementById('ind-falta').className    = 'ind-valor';
    document.getElementById('meta-status').textContent = `Faltam ${R$(falta)} para a meta`;
    document.getElementById('meta-status').className  = falta / (meta || 1) < 0.3 ? 'meta-status warn' : 'meta-status neg';

    const porDia = diasRest > 1 ? R$(falta / (diasRest - 1)) : '—';
    document.getElementById('ind-pdia').textContent = porDia;
    document.getElementById('ind-pdia').className   = diasRest > 1 ? 'ind-valor ind-amarelo' : 'ind-valor ind-sec';
  }
}

function preencherCrescimento(realizado, comparacao, labelCompar) {
  const crescEl = document.getElementById('painel-cresc-num');
  const diffEl  = document.getElementById('painel-cresc-diff');

  if (comparacao > 0) {
    const diff   = (realizado - comparacao) / comparacao * 100;
    const difAbs = realizado - comparacao;
    const pos    = diff >= 0;
    // Herói: valor financeiro
    crescEl.textContent = (pos ? '+' : '-') + 'R$ ' +
      Math.abs(Math.round(difAbs)).toLocaleString('pt-BR');
    crescEl.className   = 'painel-cresc-num' + (pos ? '' : ' neg');
    // Secundário: percentual
    diffEl.textContent  = (pos ? '+' : '') + diff.toFixed(1) + '%';
    diffEl.className    = 'painel-cresc-diff' + (pos ? ' pos' : ' neg');
  } else if (realizado > 0) {
    crescEl.textContent = R$(realizado);
    crescEl.className   = 'painel-cresc-num neutro';
    diffEl.textContent  = 'Novo período';
    diffEl.className    = 'painel-cresc-diff neutro';
  } else {
    crescEl.textContent = '—';
    crescEl.className   = 'painel-cresc-num neutro';
    diffEl.textContent  = '';
    diffEl.className    = 'painel-cresc-diff';
  }
  document.getElementById('painel-cresc-label').textContent = labelCompar;
}

// ===== TRÊS NÍVEIS DE META =====
function renderNiveisMeta(realizado, meta) {
  const el = document.getElementById('meta-niveis');
  if (!el) return;
  if (!meta.ok) { el.innerHTML = ''; return; }

  const niveis = [
    { icon: '🟢', label: 'Meta Mínima',   valor: meta.metaMin,  pct: '+0%'  },
    { icon: '🔵', label: 'Meta Alvo',      valor: meta.metaAlvo, pct: '+20%' },
    { icon: '🏆', label: 'Meta Superação', valor: meta.metaSup,  pct: '+40%' },
  ];

  el.innerHTML = niveis.map(n => {
    const progPct  = n.valor > 0 ? Math.min(realizado / n.valor * 100, 999) : 0;
    const atingido = progPct >= 100;
    const pctTxt   = `${progPct.toFixed(0)}%${atingido ? ' ✅' : ''}`;
    return `<div class="meta-nivel${atingido ? ' atingido' : ''}">` +
      `<span class="nivel-icon">${n.icon}</span>` +
      `<span class="nivel-label">${n.label} <small class="nivel-pct-label">(${n.pct})</small></span>` +
      `<span class="nivel-valor">${R$(n.valor)}</span>` +
      `<span class="nivel-pct${atingido ? ' verde' : ''}">${pctTxt}</span>` +
      `</div>`;
  }).join('');
}

function renderStatusMeta3(realizado, meta) {
  if (!meta.ok) return;
  const el = document.getElementById('meta-status');
  if (realizado >= meta.metaSup) {
    el.textContent = `🏆 Meta Superação atingida! +${R$(realizado - meta.metaSup)} acima`;
    el.className   = 'meta-status';
  } else if (realizado >= meta.metaAlvo) {
    el.textContent = `✅ Meta Alvo atingida! Faltam ${R$(meta.metaSup - realizado)} para Superação`;
    el.className   = 'meta-status';
  } else if (realizado >= meta.metaMin) {
    el.textContent = `🟢 Meta Mínima atingida! Faltam ${R$(meta.metaAlvo - realizado)} para o Alvo`;
    el.className   = 'meta-status warn';
  } else {
    el.textContent = `Faltam ${R$(meta.metaAlvo - realizado)} para a Meta Alvo`;
    el.className   = realizado / (meta.metaAlvo || 1) > 0.7 ? 'meta-status warn' : 'meta-status neg';
  }
}

// ===== PAINEL MODO MÊS =====
function renderPainelMes() {
  const hoje     = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const diaAtual = hoje.getDate();
  const anoAnt   = anoAtual - 1;
  const mesNome  = MESES_NOME[mesAtual];

  // Valores do mesmo período (01 até hoje) nos dois anos
  const realizadoAtual = somaCaixaMes(anoAtual, mesAtual, diaAtual);
  const antPeriodo     = somaCaixaMes(anoAnt,   mesAtual, diaAtual);

  // Cabeçalho
  document.getElementById('painel-periodo-nome').textContent = `${mesNome.toUpperCase()} ${anoAtual}`;
  document.getElementById('badge-andamento').style.display = 'inline-flex';
  document.getElementById('painel-periodo-detalhe').innerHTML =
    `Resultado Líquido — <strong>01 a ${diaAtual} de ${mesNome}</strong> — mesmo período nos dois anos`;

  // Crescimento + diferença em valor
  preencherCrescimento(realizadoAtual, antPeriodo, `vs. mesmo período de ${anoAnt}`);

  // Comparação lado a lado
  document.getElementById('vs-ant-label').textContent   = `${mesNome} ${anoAnt}`;
  document.getElementById('vs-ant-valor').textContent   = antPeriodo > 0 ? R$(antPeriodo) : 'Sem dados';
  document.getElementById('vs-ant-sub').textContent     = `01 a ${diaAtual}/${MESES_ABREV[mesAtual]}/${anoAnt}`;
  document.getElementById('vs-atual-label').textContent = `${mesNome} ${anoAtual} (acumulado)`;
  document.getElementById('vs-atual-valor').textContent = R$(realizadoAtual);
  document.getElementById('vs-atual-sub').textContent   = `01 a ${diaAtual}/${MESES_ABREV[mesAtual]}/${anoAtual}`;

  // Meta mensal
  const meta = calcularMetaMensal(anoAtual, mesAtual);

  if (!meta.ok) {
    document.getElementById('painel-meta').style.display      = 'none';
    document.getElementById('painel-sem-dados').style.display = 'block';
    return;
  }
  document.getElementById('painel-meta').style.display      = 'flex';
  document.getElementById('painel-sem-dados').style.display = 'none';
  document.getElementById('meta-badge-txt').textContent     = '🤖 Meta mensal automática';
  document.getElementById('meta-num').textContent           = R$(meta.metaAlvo);
  document.getElementById('meta-base').textContent          = meta.base;

  const { pct, falta } = preencherProgressoMeta(realizadoAtual, meta.metaAlvo);
  preencherStatusMeta(pct, realizadoAtual, meta.metaAlvo, falta, diasRestantesNoMes(), 'Dias no mês');
  renderNiveisMeta(realizadoAtual, meta);
  renderStatusMeta3(realizadoAtual, meta);
}

// ===== PAINEL MODO SEMANA =====
function renderPainelSemana() {
  const hoje      = new Date();
  const anoAtual  = hoje.getFullYear();
  const mesAtual  = hoje.getMonth();
  const diaAtual  = hoje.getDate();
  const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();

  // Semana do mês pelo número do dia (Sem 1=1-7, Sem 2=8-14, Sem 3=15-21, Sem 4=22-28, Sem 5=29-fim)
  const maxSem    = diasNoMes > 28 ? 5 : 4;
  const semAtual  = Math.min(Math.ceil(diaAtual / 7), maxSem);
  const inicioSem = (semAtual - 1) * 7 + 1;
  const fimSem    = semAtual === maxSem ? diasNoMes : Math.min(semAtual * 7, diasNoMes);

  // Resultado líquido desta semana (só até hoje — semana em andamento)
  const realizadoSemana = somaCaixaSemanaNum(anoAtual, mesAtual, inicioSem, diaAtual);

  // Mesma semana do ano anterior (semana completa)
  const anoAnt     = anoAtual - 1;
  const diasMesAnt = new Date(anoAnt, mesAtual + 1, 0).getDate();
  const fimSemAnt  = Math.min(fimSem, diasMesAnt);
  const realizadoAnoAnt = somaCaixaSemanaNum(anoAnt, mesAtual, inicioSem, fimSemAnt);

  const nomeAtual = `${semAtual}ª SEMANA DE ${MESES_ABREV[mesAtual].toUpperCase()}/${anoAtual}`;
  const diasDecor = diaAtual - inicioSem + 1;

  // Cabeçalho
  document.getElementById('painel-periodo-nome').textContent = nomeAtual;
  document.getElementById('badge-andamento').style.display = 'inline-flex';
  document.getElementById('painel-periodo-detalhe').innerHTML =
    `Resultado Líquido — dias <strong>${inicioSem}</strong> a <strong>${diaAtual}</strong> de ${MESES_NOME[mesAtual]}` +
    ` (${diasDecor} dia${diasDecor > 1 ? 's' : ''})`;

  // Crescimento vs mesma semana do ano anterior
  preencherCrescimento(realizadoSemana, realizadoAnoAnt, `vs. mesma semana de ${anoAnt}`);

  // Comparação: mesma semana ano anterior × semana atual
  document.getElementById('vs-ant-label').textContent   = `Sem. ${semAtual} — ${MESES_ABREV[mesAtual]}/${anoAnt}`;
  document.getElementById('vs-ant-valor').textContent   = realizadoAnoAnt > 0 ? R$(realizadoAnoAnt) : 'Sem dados';
  document.getElementById('vs-ant-sub').textContent     = `dias ${inicioSem} a ${fimSemAnt}`;
  document.getElementById('vs-atual-label').textContent = `Sem. ${semAtual} — ${MESES_ABREV[mesAtual]}/${anoAtual}`;
  document.getElementById('vs-atual-valor').textContent = R$(realizadoSemana);
  document.getElementById('vs-atual-sub').textContent   = `dias ${inicioSem} a ${diaAtual} (em andamento)`;

  // Meta semanal (três níveis — proporcional à mensal)
  const meta = calcularMetaSemanal(anoAtual, mesAtual);

  if (!meta.ok) {
    document.getElementById('painel-meta').style.display      = 'none';
    document.getElementById('painel-sem-dados').style.display = 'block';
    return;
  }
  document.getElementById('painel-meta').style.display      = 'flex';
  document.getElementById('painel-sem-dados').style.display = 'none';
  document.getElementById('meta-badge-txt').textContent     = '🤖 Meta semanal automática';
  document.getElementById('meta-num').textContent           = R$(meta.metaAlvo);
  document.getElementById('meta-base').textContent          = meta.base;

  const { pct, falta } = preencherProgressoMeta(realizadoSemana, meta.metaAlvo);
  preencherStatusMeta(pct, realizadoSemana, meta.metaAlvo, falta, diasRestantesNaSemana(), 'Dias na semana');
  renderNiveisMeta(realizadoSemana, meta);
  renderStatusMeta3(realizadoSemana, meta);
}

// ===== DISPATCHER DO PAINEL =====
function renderPainel() {
  if (modoAtual === 'semana') renderPainelSemana();
  else                         renderPainelMes();
}

// ===== CHIPS DE ANOS =====
function detectarAnos() {
  const set = new Set();
  _os.forEach(o => { const d = extrairData(o.createdAt); if (d) set.add(d.getFullYear()); });
  _caixa.forEach(l => {
    const ano = l.mes ? parseInt(l.mes.split('-')[0], 10)
                      : (extrairData(l.dataISO)?.getFullYear() || null);
    if (ano) set.add(ano);
  });
  anosDisponiveis = Array.from(set).sort((a, b) => b - a);
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
    chip.className   = 'ano-chip' + (anosSelecionados.includes(ano) ? ' ativo' : '');
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

// ===== JANELA 6 MESES (gráficos) =====
// Mês atual sempre no centro: [mes-2][mes-1][ATUAL][mes+1][mes+2][mes+3]
// Meses futuros aparecem com barra zero (ainda não aconteceram)
function janela6Meses() {
  const hoje = new Date();
  const result = [];
  for (let offset = -2; offset <= 3; offset++) {
    let m = hoje.getMonth() + offset, a = hoje.getFullYear();
    while (m < 0)  { m += 12; a--; }
    while (m > 11) { m -= 12; a++; }
    result.push({ mes: m, ano: a, label: MESES_ABREV[m], isCurrent: offset === 0, isFuture: offset > 0 });
  }
  return result;
}

// ===== JANELA SEMANAL (gráficos modo semana) =====
// Sem 1 (1-7), Sem 2 (8-14), Sem 3 (15-21), Sem 4 (22-28), Sem 5 (29-fim) quando existir
function janelaSemanas() {
  const hoje = new Date();
  const anoAtual  = hoje.getFullYear();
  const mesAtual  = hoje.getMonth();
  const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
  const maxSem    = diasNoMes > 28 ? 5 : 4;
  const semAtual  = Math.min(Math.ceil(hoje.getDate() / 7), maxSem);
  const result = [];
  for (let sem = 1; sem <= maxSem; sem++) {
    const inicio = (sem - 1) * 7 + 1;
    const fim    = sem === maxSem ? diasNoMes : Math.min(sem * 7, diasNoMes);
    result.push({
      sem, inicio, fim, mes: mesAtual, ano: anoAtual,
      label: `Sem ${sem}`,
      isCurrent: sem === semAtual,
      isFuture:  sem > semAtual,
    });
  }
  return result;
}

// ===== AGREGAÇÕES POR SEMANA DO MÊS =====
function somaCaixaSemanaNum(ano, mes, inicio, fim) {
  const mesKey = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  return _caixa.filter(l => {
    if (l.mes !== mesKey) return false;
    const diaNum = l.dia ? parseInt(l.dia.split('-')[2], 10) : null;
    return diaNum !== null && diaNum >= inicio && diaNum <= fim;
  }).reduce((s, l) => s + (parseFloat(l.lucro) || 0), 0);
}

function contaOSSemanaNum(ano, mes, inicio, fim) {
  return _os.filter(o => {
    const d = extrairData(o.createdAt);
    if (!d) return false;
    if (d.getFullYear() !== ano || d.getMonth() !== mes) return false;
    return d.getDate() >= inicio && d.getDate() <= fim;
  }).length;
}

// ===== PLUGIN: DESTAQUE VISUAL NO MÊS ATUAL =====
const pluginDestaqueAtual = {
  id: 'destaqueAtual',
  beforeDraw(chart) {
    const { ctx, chartArea: ca, data } = chart;
    if (!ca || !data.labels?.length) return;
    const n = data.labels.length;
    const w = (ca.right - ca.left) / n;
    const x = ca.left + w * currentHighlightIdx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,230,118,0.055)';
    ctx.fillRect(x, ca.top, w, ca.bottom - ca.top);
    ctx.fillStyle = 'rgba(0,230,118,0.4)';
    ctx.fillRect(x, ca.top, w, 2);
    ctx.restore();
  }
};

// ===== GRÁFICOS =====
// Para meses: mês atual = acumulado até hoje; meses futuros do ano atual = 0
function buildDatasets(tipo, janela) {
  const hoje = new Date();
  const anoHoje = hoje.getFullYear(), mesHoje = hoje.getMonth(), diaHoje = hoje.getDate();
  return [...anosSelecionados].sort((a, b) => a - b).map(ano => {
    const idx = anosDisponiveis.indexOf(ano) % 4;
    const cor  = PALETA[idx];
    const data = janela.map(({ mes, isFuture }) => {
      if (isFuture && ano === anoHoje) return 0; // ainda não aconteceu
      const ateDia = (ano === anoHoje && mes === mesHoje) ? diaHoje : 0;
      return tipo === 'fat' ? somaCaixaMes(ano, mes, ateDia) : contaOSMes(ano, mes, ateDia);
    });
    return { label: String(ano), data, backgroundColor: cor.solid, hoverBackgroundColor: cor.hex,
             borderRadius: 5, borderSkipped: false, minBarLength: 6, _hex: cor.hex };
  });
}

// Para semanas: semana atual do ano corrente usa ateDia; semanas futuras = 0
function buildDatasetsSemanais(tipo, janela) {
  const hoje = new Date();
  const anoHoje = hoje.getFullYear(), mesHoje = hoje.getMonth(), diaHoje = hoje.getDate();
  return [...anosSelecionados].sort((a, b) => a - b).map(ano => {
    const idx = anosDisponiveis.indexOf(ano) % 4;
    const cor  = PALETA[idx];
    const data = janela.map(({ inicio, fim, isCurrent, isFuture }) => {
      if (isFuture && ano === anoHoje) return 0;
      const fimReal = (isCurrent && ano === anoHoje) ? Math.min(fim, diaHoje) : fim;
      return tipo === 'fat'
        ? somaCaixaSemanaNum(ano, mesHoje, inicio, fimReal)
        : contaOSSemanaNum(ano, mesHoje, inicio, fimReal);
    });
    return { label: String(ano), data, backgroundColor: cor.solid, hoverBackgroundColor: cor.hex,
             borderRadius: 5, borderSkipped: false, minBarLength: 6, _hex: cor.hex };
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

function renderDestaqueMensal(containerId, janela, datasets, tipo) {
  const el = document.getElementById(containerId);
  const idx = currentHighlightIdx;
  if (!el || datasets.length < 2) { if (el) el.innerHTML = ''; return; }
  const { mes } = janela[idx];
  const vals = datasets.map(ds => ({ label: ds.label, val: ds.data[idx] || 0, hex: ds._hex }));
  const [ant, atu] = [vals[0], vals[vals.length - 1]];
  const fmt = tipo === 'fat' ? v => R$(v) : v => `${v} OS`;
  let crescTxt = '';
  if (ant.val > 0) {
    const d = (atu.val - ant.val) / ant.val * 100;
    crescTxt = ` — <span class="${d >= 0 ? 'g-verde' : 'g-neg'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}%</span>`;
  }
  el.innerHTML =
    `<strong>${MESES_NOME[mes]}:</strong>` +
    ` <span class="g-azul">${ant.label}: ${fmt(ant.val)}</span>` +
    ` <span class="g-dim">→</span>` +
    ` <span class="g-verde">${atu.label}: ${fmt(atu.val)}</span>` + crescTxt;
}

function renderDestaqueSemanais(containerId, janela, datasets, tipo) {
  const el = document.getElementById(containerId);
  const idx = currentHighlightIdx;
  if (!el || datasets.length < 2) { if (el) el.innerHTML = ''; return; }
  const { sem } = janela[idx] || {};
  const vals = datasets.map(ds => ({ label: ds.label, val: ds.data[idx] || 0, hex: ds._hex }));
  const [ant, atu] = [vals[0], vals[vals.length - 1]];
  const fmt = tipo === 'fat' ? v => R$(v) : v => `${v} OS`;
  let crescTxt = '';
  if (ant.val > 0) {
    const d = (atu.val - ant.val) / ant.val * 100;
    crescTxt = ` — <span class="${d >= 0 ? 'g-verde' : 'g-neg'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}%</span>`;
  }
  el.innerHTML =
    `<strong>Semana ${sem || idx + 1}:</strong>` +
    ` <span class="g-azul">${ant.label}: ${fmt(ant.val)}</span>` +
    ` <span class="g-dim">→</span>` +
    ` <span class="g-verde">${atu.label}: ${fmt(atu.val)}</span>` + crescTxt;
}

const BASE_OPT = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: '#1e1e1e', borderColor: '#383838', borderWidth: 1,
               titleColor: '#e8e8e8', bodyColor: '#909090', padding: 10, cornerRadius: 8 },
  },
  scales: {
    x: { grid: { display: false } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' },
         ticks: { color: '#505050', font: { size: 11, family: 'Inter' } }, beginAtZero: true },
  },
};

function _buildXScale(janela) {
  const cores = janela.map(j => j.isCurrent ? '#00e676' : j.isFuture ? '#333' : '#555');
  return {
    grid: { display: false },
    ticks: {
      color: ctx => cores[ctx.index] || '#555',
      font: ctx => ({
        size: janela[ctx.index]?.isCurrent ? 13 : 11,
        family: 'Inter',
        weight: janela[ctx.index]?.isCurrent ? '800' : '500',
      }),
    },
  };
}

function renderGraficosMensais() {
  currentHighlightIdx = 2; // mês atual sempre no centro (índice 2 de 6)
  const janela = janela6Meses();
  const labels  = janela.map(j => j.label);
  const xScale  = _buildXScale(janela);
  const mesNome = MESES_NOME[new Date().getMonth()];

  document.getElementById('titulo-fat').textContent = `Resultado Líquido — foco em ${mesNome}`;
  document.getElementById('titulo-os').textContent  = `OS abertas — foco em ${mesNome}`;

  const dsFat = buildDatasets('fat', janela);
  renderLegenda('legenda-fat', dsFat);
  renderDestaqueMensal('grafico-destaque-fat', janela, dsFat, 'fat');

  if (chartFat) chartFat.destroy();
  chartFat = new Chart(document.getElementById('chart-fat'), {
    type: 'bar',
    data: { labels, datasets: dsFat },
    options: {
      ...BASE_OPT,
      plugins: { ...BASE_OPT.plugins,
        tooltip: { ...BASE_OPT.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${R$(ctx.parsed.y)}` } } },
      scales: { x: xScale, y: { ...BASE_OPT.scales.y,
        ticks: { ...BASE_OPT.scales.y.ticks,
          callback: v => v === 0 ? '' : v >= 1000 ? 'R$' + (v / 1000).toFixed(0) + 'k' : 'R$' + v } } },
    },
    plugins: [pluginDestaqueAtual],
  });

  const dsOS = buildDatasets('os', janela);
  renderLegenda('legenda-os', dsOS);
  renderDestaqueMensal('grafico-destaque-os', janela, dsOS, 'os');

  if (chartOs) chartOs.destroy();
  chartOs = new Chart(document.getElementById('chart-os'), {
    type: 'bar',
    data: { labels, datasets: dsOS },
    options: {
      ...BASE_OPT,
      plugins: { ...BASE_OPT.plugins,
        tooltip: { ...BASE_OPT.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} OS` } } },
      scales: { x: xScale, y: { ...BASE_OPT.scales.y } },
    },
    plugins: [pluginDestaqueAtual],
  });
}

function renderGraficosSemanais() {
  const hoje      = new Date();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const maxSem    = diasNoMes > 28 ? 5 : 4;
  const semAtual  = Math.min(Math.ceil(hoje.getDate() / 7), maxSem);
  currentHighlightIdx = semAtual - 1; // 0-based
  const janela  = janelaSemanas();
  const labels  = janela.map(j => j.label);
  const xScale  = _buildXScale(janela);
  const mesNome = MESES_NOME[hoje.getMonth()];

  document.getElementById('titulo-fat').textContent = `Resultado Líquido — semanas de ${mesNome}`;
  document.getElementById('titulo-os').textContent  = `OS abertas — semanas de ${mesNome}`;

  const dsFat = buildDatasetsSemanais('fat', janela);
  renderLegenda('legenda-fat', dsFat);
  renderDestaqueSemanais('grafico-destaque-fat', janela, dsFat, 'fat');

  if (chartFat) chartFat.destroy();
  chartFat = new Chart(document.getElementById('chart-fat'), {
    type: 'bar',
    data: { labels, datasets: dsFat },
    options: {
      ...BASE_OPT,
      plugins: { ...BASE_OPT.plugins,
        tooltip: { ...BASE_OPT.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${R$(ctx.parsed.y)}` } } },
      scales: { x: xScale, y: { ...BASE_OPT.scales.y,
        ticks: { ...BASE_OPT.scales.y.ticks,
          callback: v => v === 0 ? '' : v >= 1000 ? 'R$' + (v / 1000).toFixed(0) + 'k' : 'R$' + v } } },
    },
    plugins: [pluginDestaqueAtual],
  });

  const dsOS = buildDatasetsSemanais('os', janela);
  renderLegenda('legenda-os', dsOS);
  renderDestaqueSemanais('grafico-destaque-os', janela, dsOS, 'os');

  if (chartOs) chartOs.destroy();
  chartOs = new Chart(document.getElementById('chart-os'), {
    type: 'bar',
    data: { labels, datasets: dsOS },
    options: {
      ...BASE_OPT,
      plugins: { ...BASE_OPT.plugins,
        tooltip: { ...BASE_OPT.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} OS` } } },
      scales: { x: xScale, y: { ...BASE_OPT.scales.y } },
    },
    plugins: [pluginDestaqueAtual],
  });
}

function renderGraficos() {
  if (modoAtual === 'semana') renderGraficosSemanais();
  else                        renderGraficosMensais();
}

// ===== AUDITORIA DE DADOS =====
function renderAuditoria() {
  const el = document.getElementById('auditoria-corpo');
  if (!el) return;

  const hoje     = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const diaAtual = hoje.getDate();
  const mesNome  = MESES_NOME[mesAtual];

  const mesKey = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;
  const caixaMes = _caixa.filter(l => {
    if (l.mes !== mesKey) return false;
    const diaNum = l.dia ? parseInt(l.dia.split('-')[2], 10) : null;
    return diaNum !== null && diaNum <= diaAtual;
  });
  const totalLucro = caixaMes.reduce((s, l) => s + (parseFloat(l.lucro) || 0), 0);

  const osMes = _os.filter(o => {
    const d = extrairData(o.createdAt);
    return d && d.getFullYear() === anoAtual && d.getMonth() === mesAtual;
  });

  const p   = n => String(n).padStart(2, '0');
  const fmtTs = d => `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} às ${p(d.getHours())}h${p(d.getMinutes())}`;
  const ultimaAt = _lastRefresh ? fmtTs(_lastRefresh) : '—';

  const meta = calcularMetaMensal(anoAtual, mesAtual);

  let metaHtml = '';
  if (meta.ok) {
    const histRows = meta.historico.map(h =>
      `<div class="audit-row audit-info">` +
      `<span>${MESES_NOME[mesAtual]}/${h.ano} (Resultado Líquido)</span>` +
      `<span>${R$(h.valor)}</span></div>`
    ).join('');

    metaHtml = `
      <div class="audit-section">Regra da meta automática</div>
      ${histRows}
      <div class="audit-row">
        <span>Média histórica (${meta.historico.length} ano${meta.historico.length > 1 ? 's' : ''})</span>
        <span>${R$(meta.media)}</span>
      </div>
      <div class="audit-meta-calc">
        <div class="audit-meta-row">
          <span>🟢 Meta Mínima (média histórica)</span>
          <span>${R$(meta.metaMin)}</span>
        </div>
        <div class="audit-meta-row audit-winner">
          <span>🔵 Meta Alvo (média + 20%)</span>
          <span>${R$(meta.metaAlvo)}</span>
        </div>
        <div class="audit-meta-row">
          <span>🏆 Meta Superação (média + 40%)</span>
          <span>${R$(meta.metaSup)}</span>
        </div>
      </div>`;
  } else {
    metaHtml = `
      <div class="audit-section">Regra da meta automática</div>
      <div class="audit-row audit-info">
        <span>Status</span>
        <span>⚠️ Sem histórico do mesmo mês para calcular meta</span>
      </div>`;
  }

  el.innerHTML = `
    <div class="audit-titulo">Auditoria — ${mesNome.toUpperCase()}/${anoAtual} (01 a ${diaAtual})</div>

    <div class="audit-section audit-section-first">Fontes de dados</div>
    <div class="audit-row">
      <span>💰 Caixa <code>caixa_lancamentos</code></span>
      <span>${caixaMes.length} registros este mês</span>
    </div>
    <div class="audit-row">
      <span>Fonte do cálculo</span>
      <span>campo <code>lucro</code> (entrada − custo; despesas = lucro negativo)</span>
    </div>
    <div class="audit-row audit-total">
      <span>Resultado Líquido — ${mesNome}/${anoAtual}</span>
      <span>${R$(totalLucro)}</span>
    </div>
    <div class="audit-row">
      <span>📋 OS <code>os</code></span>
      <span>${osMes.length} OS este mês</span>
    </div>
    <div class="audit-row audit-info">
      <span>💳 Financeiro</span>
      <span>Não separado — incluso no Caixa</span>
    </div>
    <div class="audit-row audit-info">
      <span>📥 Recebimentos</span>
      <span>Não separado — incluso no Caixa</span>
    </div>
    <div class="audit-row audit-info">
      <span>⏱ Última atualização</span>
      <span>${ultimaAt}</span>
    </div>
    ${metaHtml}
  `;
}

document.getElementById('auditoria-toggle').addEventListener('click', () => {
  const corpo = document.getElementById('auditoria-corpo');
  corpo.style.display = corpo.style.display === 'none' ? 'block' : 'none';
});

// ===== RENDER COMPLETO =====
function renderAll() {
  _lastRefresh = new Date();
  const prevAnos = anosDisponiveis.join(',');
  detectarAnos();

  if (!_initialized) {
    _initialized = true;
    anosSelecionados = anosDisponiveis.slice(0, 2);
    renderChips();
    document.getElementById('live-badge').style.display = 'inline-flex';
    document.getElementById('loading-overlay').style.display = 'none';
  } else if (anosDisponiveis.join(',') !== prevAnos) {
    renderChips();
  }

  renderPainel();
  renderGraficos();
  renderAuditoria();
}

// ===== TOGGLE DE MODO =====
function setModo(modo) {
  modoAtual = modo;
  document.querySelectorAll('.modo-btn').forEach(b => {
    b.classList.toggle('ativo', b.dataset.modo === modo);
  });
  renderPainel();
  renderGraficos(); // gráficos também mudam com o toggle
}

document.getElementById('btn-modo-mes').addEventListener('click',    () => setModo('mes'));
document.getElementById('btn-modo-semana').addEventListener('click', () => setModo('semana'));

// ===== HELPERS DE ERRO VISÍVEL =====
function mostrarErroLoading(msg) {
  const el  = document.getElementById('loading-overlay');
  const sp  = el?.querySelector('.loading-spinner');
  const txt = el?.querySelector('.loading-txt');
  if (sp)  sp.style.display = 'none';
  if (txt) { txt.textContent = '❌ ' + msg; txt.style.color = '#ff5252'; }
}

// ===== LISTENERS EM TEMPO REAL (onSnapshot) =====
async function init() {
  try {
    await authReady; // aguarda autenticação anônima antes de abrir listeners
  } catch (e) {
    mostrarErroLoading('Falha na autenticação: ' + e.message);
    return;
  }

  onSnapshot(collection(db, 'os'), snap => {
    _os = snap.docs.map(d => d.data());
    _osOk = true;
    if (_caixaOk) renderAll();
  }, err => {
    console.error('OS snapshot:', err);
    mostrarErroLoading('Erro OS: ' + err.message);
  });

  onSnapshot(collection(db, 'caixa_lancamentos'), snap => {
    _caixa = snap.docs.map(d => d.data());
    _caixaOk = true;
    if (_osOk) renderAll();
  }, err => {
    console.error('Caixa snapshot:', err);
    mostrarErroLoading('Erro Caixa: ' + err.message);
  });
}

// Timeout de segurança: se em 12s nada carregou, mostra mensagem
setTimeout(() => {
  if (!_initialized) mostrarErroLoading('Tempo esgotado — verifique a conexão ou o console.');
}, 12000);

init();
