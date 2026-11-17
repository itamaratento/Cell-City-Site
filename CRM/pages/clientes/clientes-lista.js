/**
 * Lista de clientes — filtros puros (busca nome/telefone).
 */

/**
 * @param {object[]} clientes
 * @param {string} termo
 * @param {(s: string) => string} [normalizeDigits]
 */
export function filtrarClientesPorBusca(clientes, termo, normalizeDigits) {
  const t = String(termo || '').trim().toLowerCase();
  if (!t) return Array.isArray(clientes) ? [...clientes] : [];
  const digTermo = typeof normalizeDigits === 'function'
    ? normalizeDigits(t)
    : t.replace(/\D/g, '');
  return (clientes || []).filter(c => {
    const nome = String(c.name || c.nome || '').toLowerCase();
    const phone = String(c.phone || '');
    const digits = c.phoneDigits
      || (typeof normalizeDigits === 'function' ? normalizeDigits(phone) : phone.replace(/\D/g, ''));
    if (nome.includes(t)) return true;
    if (phone.toLowerCase().includes(t)) return true;
    if (digTermo && digits && String(digits).includes(digTermo)) return true;
    return false;
  });
}

/**
 * Ordena por nome (pt-BR), fallback telefone.
 * @param {object[]} clientes
 */
export function ordenarClientesPorNome(clientes) {
  return [...(clientes || [])].sort((a, b) => {
    const na = String(a.name || a.nome || '').localeCompare(String(b.name || b.nome || ''), 'pt-BR', { sensitivity: 'base' });
    if (na !== 0) return na;
    return String(a.phone || '').localeCompare(String(b.phone || ''));
  });
}

/**
 * URL da ficha unificada no módulo OS (#cliente-{digits}).
 * @param {string} phoneOrDigits
 * @param {(s: string) => string} [normalizeDigits]
 */
export function urlFichaCliente(phoneOrDigits, normalizeDigits) {
  const raw = String(phoneOrDigits || '');
  const dig = typeof normalizeDigits === 'function'
    ? normalizeDigits(raw)
    : raw.replace(/\D/g, '');
  if (!dig || dig.length < 10) return '../os/index.html#fav-clientes';
  return `../os/index.html#cliente-${dig}`;
}
