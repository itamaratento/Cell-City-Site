/**
 * Home enxuta do Dashboard — 8 módulos em destaque; demais em "Mais módulos".
 * Ordem: OS, Caixa, Estoque, Compras / Central de Alertas, Clientes, Pós-venda, Relatórios.
 * Preferência de aberto/fechado em config/painel.
 */

export const HOME_MODULOS_PRIMARIOS = [
  'os',
  'caixa',
  'estoque',
  'compras',
  'central-alertas',
  'clientes',
  'pos-venda',
  'relatorios',
];

/** data-sid da sidebar equivalentes aos 8 primários. */
export const SIDEBAR_SIDS_PRIMARIOS = [
  'os',
  'caixa',
  'estoque',
  'compras',
  'central-alertas',
  'clientes',
  'pos-venda',
  'relatorios',
];

export const LS_MAIS_MODULOS = 'cc_home_mais_modulos_aberto';
export const PAINEL_CAMPO_MAIS = 'homeMaisModulosAberto';

export function isModuloPrimario(id) {
  return HOME_MODULOS_PRIMARIOS.includes(String(id || ''));
}

/**
 * Reordena lista de ids: os 8 primeiro (ordem canônica), depois o restante
 * na ordem relativa original.
 * @param {string[]} ids
 * @param {string[]} [primarios]
 */
export function ordenarComPrimariosPrimeiro(ids, primarios = HOME_MODULOS_PRIMARIOS) {
  const seen = new Set();
  const out = [];
  for (const p of primarios) {
    if (ids.includes(p) && !seen.has(p)) {
      out.push(p);
      seen.add(p);
    }
  }
  for (const id of ids) {
    if (!seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  return out;
}

/** Lê preferência local (padrão: fechado). */
export function lerMaisModulosAbertoLocal() {
  try {
    const v = localStorage.getItem(LS_MAIS_MODULOS);
    if (v === null || v === undefined || v === '') return false;
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

export function gravarMaisModulosAbertoLocal(aberto) {
  try {
    localStorage.setItem(LS_MAIS_MODULOS, aberto ? '1' : '0');
  } catch { /* ignore */ }
}

/**
 * Extrai booleano do doc config/painel.
 * @param {object|null|undefined} data
 */
export function maisModulosAbertoFromPainel(data) {
  if (!data || typeof data[PAINEL_CAMPO_MAIS] !== 'boolean') return null;
  return data[PAINEL_CAMPO_MAIS];
}
