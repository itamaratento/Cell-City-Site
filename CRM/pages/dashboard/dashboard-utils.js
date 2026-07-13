/* ============================================
CELL CITY CRM — DASHBOARD — UTILITÁRIOS
Etapa 3 da refatoração modular: formatações, helpers e funções puras reutilizáveis.
Mixin aplicado em Dashboard.prototype (ver dashboard.js) — mesmo `this` de sempre.
============================================ */

import { escHtml } from '../../shared/sanitize.js';

export const dashboardUtilsMixin = {
  // ===== BUSCA GLOBAL INTELIGENTE =====
  // Mantido como método do mixin (call sites usam this.escapeHtml);
  // a implementação é a fonte única em shared/sanitize.js.
  escapeHtml(s) {
    return escHtml(s);
  },

  _setChecked(id, value) { const el = document.getElementById(id); if (el) el.checked = !!value; },
  _getChecked(id) { const el = document.getElementById(id); return el ? el.checked : false; },
  _setValue(id, value) { const el = document.getElementById(id); if (el) el.value = value; },
  _getValue(id, fallback) { const el = document.getElementById(id); return el ? el.value : fallback; }
};
