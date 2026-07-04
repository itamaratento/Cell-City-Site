/* ============================================
CELL CITY CRM — DASHBOARD — INICIALIZAÇÃO
Etapa 11 da refatoração modular: sequência de chamadas setupX() do método init().
Mixin aplicado em Dashboard.prototype (ver dashboard.js) — mesmo `this` de sempre.
============================================ */

export const dashboardInitMixin = {
  init() {
    this._verificarFechamentoCaixa();
    this.setupNotas();
    this.setupClock();
    this.setupMetaSemanal();
    this.setupAutoatendimento();
    this.setupDiarioBadge();
    this.setupAlerts();
    this.setupGlobalSearch();
    this.setupReloadBtn();
    this.setupCalendar();
    this.setupModules();
    this.setupDockTools();
    this.setupSidebar();
    this.setupKeyboardShortcuts();
    this.setupOutsideClicks();
    this.setupConfigAlertas();
    this.atualizarCardAcaoSemana();
    this.setupAlarmeOS();
    console.log('✅ Dashboard Cell City v4.3 — ETAPA 1 concluída. Aguardando ETAPA 2 (os.js + caixa.js).');
  }
};
