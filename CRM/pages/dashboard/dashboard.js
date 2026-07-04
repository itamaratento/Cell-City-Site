/* ============================================
CELL CITY CRM — DASHBOARD CONTROLLER v4.3 FINAL
✅ ETAPA 1: Data completa + Relógio + Logo + Alertas em modo seguro
✅ ETAPA 2: Meta Semanal conectada ao resumo_live do Firestore
============================================ */
import { initModulo } from '../../scripts/kernel.js';
import { carregarPermissoes } from '../../shared/permissoes.js';
import { dashboardUtilsMixin } from './dashboard-utils.js';
import { dashboardShared, criarEstadoInicial } from './dashboard-state.js';
import { dashboardEventsMixin } from './dashboard-events.js';
import { dashboardUiMixin } from './dashboard-ui.js';
import { dashboardCaixaMixin } from './dashboard-caixa.js';
import { dashboardBuscaMixin } from './dashboard-busca.js';
import { dashboardAlertasMixin } from './dashboard-alertas.js';
import { dashboardAlarmeOsMixin } from './dashboard-alarme-os.js';
import { dashboardInitMixin } from './dashboard-init.js';

class Dashboard {
  constructor() {
    this.state = criarEstadoInicial();
    this.init();
  }
}

Object.assign(Dashboard.prototype, dashboardUtilsMixin, dashboardEventsMixin, dashboardUiMixin, dashboardCaixaMixin, dashboardBuscaMixin, dashboardAlertasMixin, dashboardAlarmeOsMixin, dashboardInitMixin);

// ===== INICIALIZAÇÃO =====
async function _bootDashboard() {
  const ctx = await initModulo();
  if (!ctx) return;
  dashboardShared.uid = ctx.uid;
  await carregarPermissoes(ctx);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Dashboard());
  } else {
    new Dashboard();
  }
}
_bootDashboard();