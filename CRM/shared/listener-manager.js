/* ============================================================
   LISTENER MANAGER — Gerenciador Global de Listeners Firestore
   Cell City Gestão Empresarial

   Responsabilidades:
     • Registrar e rastrear todos os listeners onSnapshot
     • Impedir listeners duplicados (mesmo key → cancela o anterior)
     • Cancelar listeners ao sair do módulo (beforeunload / pagehide)
     • Logar criação, substituição e remoção de listeners
     • Facilitar debug via listListeners() no console

   Uso básico (em qualquer módulo):
     import { registerListener, unregisterAll } from '../../shared/listener-manager.js';

     const unsub = onSnapshot(q, handler);
     registerListener('caixa:lancamentos', unsub);

     // No beforeunload ou quando o módulo é destruído:
     window.addEventListener('beforeunload', () => unregisterAll('caixa'));
   ============================================================ */

// Registro global: key → função de cancelamento (unsubscribe)
const _listeners = new Map();

/**
 * Registra um listener com uma chave única.
 * Se já existir um listener com a mesma chave, ele é cancelado antes de registrar o novo.
 *
 * @param {string} key   - Identificador único (ex: 'caixa:lancamentos', 'dashboard:os')
 * @param {Function} unsub - Função retornada pelo onSnapshot (cancela o listener)
 */
export function registerListener(key, unsub) {
  if (typeof unsub !== 'function') {
    console.error(`[LISTENER] registerListener('${key}'): unsub não é uma função.`);
    return;
  }
  if (_listeners.has(key)) {
    console.warn(`[LISTENER] Substituindo listener duplicado: ${key}`);
    try { _listeners.get(key)(); } catch {}
  }
  _listeners.set(key, unsub);
  console.log(`[LISTENER] Registrado: ${key} | total ativo: ${_listeners.size}`);
}

/**
 * Cancela e remove um listener específico.
 *
 * @param {string} key - Chave do listener a cancelar
 */
export function unregisterListener(key) {
  if (!_listeners.has(key)) return;
  try { _listeners.get(key)(); } catch (e) {
    console.warn(`[LISTENER] Erro ao cancelar ${key}:`, e);
  }
  _listeners.delete(key);
  console.log(`[LISTENER] Removido: ${key} | total ativo: ${_listeners.size}`);
}

/**
 * Cancela todos os listeners, com filtro opcional por prefixo.
 *
 * @param {string} [prefix] - Prefixo de chave (ex: 'caixa' cancela 'caixa:*')
 */
export function unregisterAll(prefix = '') {
  let count = 0;
  for (const [key, unsub] of _listeners) {
    if (!prefix || key.startsWith(prefix)) {
      try { unsub(); } catch {}
      _listeners.delete(key);
      count++;
    }
  }
  if (count > 0) {
    console.log(`[LISTENER] ${count} listener(s) cancelado(s)${prefix ? ` (prefixo: ${prefix})` : ''} | restantes: ${_listeners.size}`);
  }
}

/**
 * Retorna a lista de chaves de listeners ativos (para debug).
 * Use no console do navegador: listListeners()
 */
export function listListeners() {
  const keys = [..._listeners.keys()];
  console.table(keys.map((k, i) => ({ '#': i + 1, key: k })));
  return keys;
}

// Cancela todos os listeners ao sair da página para evitar memory leaks
// e conexões WebSocket órfãs com o Firestore.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => unregisterAll());
  window.addEventListener('beforeunload', () => unregisterAll());

  // Expõe no window para debug rápido no console do navegador
  window.listListeners = listListeners;
}
