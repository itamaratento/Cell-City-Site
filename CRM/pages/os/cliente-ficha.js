/**
 * Ficha do cliente — matching por telefone canônico + filtros de OS/garantias/caixa.
 * Puro (sem DOM), testável.
 */

/**
 * @param {string} phoneOrDigits
 * @param {(s: string) => string} normalizeDigits
 */
export function digitsOf(phoneOrDigits, normalizeDigits) {
  const raw = String(phoneOrDigits || '');
  const via = typeof normalizeDigits === 'function' ? normalizeDigits(raw) : raw.replace(/\D/g, '');
  return via || raw.replace(/\D/g, '');
}

/**
 * Cliente cujo phone/phoneDigits bate com o telefone informado.
 * @param {object[]} clients
 * @param {string} phoneOrDigits
 * @param {(s: string) => string} normalizeDigits
 */
export function findClientePorTelefone(clients, phoneOrDigits, normalizeDigits) {
  const dig = digitsOf(phoneOrDigits, normalizeDigits);
  if (!dig) return null;
  return (clients || []).find(c => {
    const cd = c.phoneDigits || digitsOf(c.phone, normalizeDigits);
    return cd === dig || c.phone === phoneOrDigits;
  }) || null;
}

/**
 * OS do cliente (phoneDigits preferencial; fallback phone).
 */
export function filtrarOSDoCliente(orders, phoneOrDigits, normalizeDigits) {
  const dig = digitsOf(phoneOrDigits, normalizeDigits);
  return (orders || [])
    .filter(o => {
      const od = o.phoneDigits || digitsOf(o.phone, normalizeDigits);
      return (dig && od === dig) || o.phone === phoneOrDigits;
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

/**
 * Garantias ativas: entregue há ≤ prazo (default 90 dias).
 */
export function filtrarGarantiasAtivas(orders, agoraMs = Date.now(), prazoDiasPadrao = 90) {
  return (orders || []).filter(o => {
    if (o.status !== 'entregue') return false;
    const base = o.updatedAt || o.createdAt;
    if (!base) return false;
    const prazo = Number(o.prazoGarantia);
    const dias = Number.isFinite(prazo) && prazo > 0 ? prazo : prazoDiasPadrao;
    const diff = (agoraMs - new Date(base).getTime()) / 86400000;
    return diff >= 0 && diff <= dias;
  });
}

/**
 * Lançamentos do Caixa ligados às OS do cliente (por osId ou texto da descrição).
 * @param {object[]} lancamentos
 * @param {string[]} osIds
 */
export function filtrarComprasCaixaDoCliente(lancamentos, osIds) {
  const ids = new Set((osIds || []).map(String).filter(Boolean));
  if (!ids.size) return [];
  return (lancamentos || []).filter(l => {
    if (l.osId && ids.has(String(l.osId))) return true;
    const desc = String(l.descricao || '');
    for (const id of ids) {
      if (desc.includes(id)) return true;
    }
    return false;
  }).sort((a, b) => String(b.data || b.dia || '').localeCompare(String(a.data || a.dia || '')));
}

/**
 * Índice em memória para upsert sem duplicar telefone.
 * @returns {number} índice ou -1
 */
export function indiceClienteSemDuplicar(clients, phone, phoneDigits, normalizeDigits) {
  const dig = phoneDigits || digitsOf(phone, normalizeDigits);
  return (clients || []).findIndex(c => {
    const cd = c.phoneDigits || digitsOf(c.phone, normalizeDigits);
    return (dig && cd === dig) || c.phone === phone;
  });
}
