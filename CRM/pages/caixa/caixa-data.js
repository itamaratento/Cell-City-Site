/**
 * Campos de data do lançamento de Caixa — alinhados ao Relatório
 * (relatorios.js soma por l.mes / l.dia). Calendário em America/Sao_Paulo.
 *
 * O input `<input type="date">` e `hoje()` do caixa já entregam YYYY-MM-DD
 * no calendário de SP; daí projetamos mes/dia/mesNumero/diaMes/ano/dataISO.
 *
 * Também: normalização visual de categorias duplicadas (maiúsc./minúsc./plural)
 * — só UI/totais; não regrava lançamentos antigos.
 */

const TZ = 'America/Sao_Paulo';
const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Canônicos preferidos (Title Case + plural). Chave = slug sem acento. */
const CATEGORIA_CANON = {
  despesa: 'Despesas',
  despesas: 'Despesas',
  venda: 'Vendas',
  vendas: 'Vendas',
  servico: 'Serviços',
  servicos: 'Serviços',
  fornecedor: 'Fornecedores',
  fornecedores: 'Fornecedores',
  marketing: 'Marketing',
};

function _slugCat(nome) {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Normaliza rótulo de categoria para exibição/select (não altera o banco). */
export function normalizarCategoriaCaixa(nome) {
  const raw = String(nome || '').trim();
  if (!raw) return '';
  const hit = CATEGORIA_CANON[_slugCat(raw)];
  return hit || raw;
}

/** Chave de agrupamento (totais/relatórios) — mesma lógica do rótulo canônico. */
export function chaveCategoriaCaixa(nome) {
  return _slugCat(normalizarCategoriaCaixa(nome));
}

/**
 * Deduplica lista de categorias do select (DESPESAS/Despesas → uma).
 * Preferência: nome canônico; mantém tipo/status do primeiro ativo encontrado.
 */
export function dedupeCategoriasCaixa(cats) {
  const map = new Map();
  for (const c of cats || []) {
    const canon = normalizarCategoriaCaixa(c.nome || c.id || '');
    if (!canon) continue;
    const key = chaveCategoriaCaixa(canon);
    if (!map.has(key)) {
      map.set(key, { ...c, nome: canon });
    }
  }
  return [...map.values()];
}

/** YYYY-MM-DD de "agora" em São Paulo (mesmo critério do caixa.hoje()). */
export function hojeSP() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Ano mínimo do histórico de caixa (relatório / importação Beepstart). */
export const META_ANO_MIN = 2019;

/** Número da semana ISO (1–53). */
export function weekNumISO(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - jan1) / 86400000) + 1) / 7);
}

/** Segunda e domingo (YYYY-MM-DD, UTC) da semana ISO `weekNum` no ano `year`. */
export function isoWeekYMDRange(year, weekNum) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (weekNum - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { monday: fmt(monday), sunday: fmt(sunday) };
}

/**
 * Range de `dataISO` (string ISO UTC) para a semana ISO:
 * segunda 00:00 −03:00 → domingo 23:59:59.999 −03:00.
 * Campo universal: caixa (camposDataLancamento), OS markDelivered e Beepstart.
 */
export function isoWeekDataISORange(year, weekNum) {
  const { monday, sunday } = isoWeekYMDRange(year, weekNum);
  const startISO = new Date(`${monday}T00:00:00-03:00`).toISOString();
  const endISO = new Date(`${sunday}T23:59:59.999-03:00`).toISOString();
  return { startISO, endISO, monday, sunday };
}

/**
 * Data de calendário (YYYY-MM-DD) do lançamento.
 * Aceita Beepstart (só dia + dataISO, sem campo `data`).
 */
export function dataRefLancamento(l) {
  const dia = String(l?.dia || l?.data || '').trim();
  if (RE_DIA.test(dia)) return dia;
  const iso = String(l?.dataISO || l?.createdAtISO || '').trim();
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Soma lucro da semana ISO atual + histórico por ano (mesma semana).
 * Inclui lançamentos só com dataISO+dia (formato Beepstart / beep_venda_*).
 */
export function somarLucroMetaSemanal(lancamentos, anoAtual, numSem) {
  let lucroAtual = 0;
  const lucroPorAno = {};
  for (const l of lancamentos || []) {
    const lucro = Number(l.lucro || 0);
    const ref = dataRefLancamento(l);
    if (!ref) continue;
    const dt = new Date(ref + 'T12:00:00');
    if (isNaN(dt.getTime())) continue;
    const ano = dt.getFullYear();
    const sem = weekNumISO(dt);
    if (sem !== numSem) continue;
    if (ano === anoAtual) lucroAtual += lucro;
    else lucroPorAno[ano] = (lucroPorAno[ano] || 0) + lucro;
  }
  return { lucroAtual, lucroPorAno };
}

/**
 * @param {string} dataYYYYMMDD - data do lançamento (calendário SP)
 * @returns {{ dia: string, mes: string, ano: number, mesNumero: number, diaMes: number, dataISO: string }}
 */
export function camposDataLancamento(dataYYYYMMDD) {
  const raw = String(dataYYYYMMDD || '').trim();
  const m = RE_DIA.exec(raw);
  if (!m) {
    throw new Error(`Data inválida para lançamento: "${dataYYYYMMDD}"`);
  }
  const ano = Number(m[1]);
  const mesNumero = Number(m[2]);
  const diaMes = Number(m[3]);
  if (mesNumero < 1 || mesNumero > 12 || diaMes < 1 || diaMes > 31) {
    throw new Error(`Data fora do intervalo: "${dataYYYYMMDD}"`);
  }
  // Brasil sem horário de verão desde 2019 → SP = UTC−3 o ano todo.
  const dataISO = new Date(`${raw}T12:00:00-03:00`).toISOString();
  return {
    dia: raw,
    mes: `${m[1]}-${m[2]}`,
    ano,
    mesNumero,
    diaMes,
    dataISO,
  };
}
