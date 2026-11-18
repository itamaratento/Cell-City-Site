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
