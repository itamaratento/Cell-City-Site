/* ============================================
CELL CITY CRM — DASHBOARD — CAIXA
Etapa 7 da refatoração modular: fechamento automático do Caixa e Meta Semanal
(lê caixa_lancamentos).
Mixin aplicado em Dashboard.prototype (ver dashboard.js) — mesmo `this` de sempre.
============================================ */
import { db, collection, getDocs } from "../../scripts/firebase.js";

export const dashboardCaixaMixin = {
  // ===== FECHAMENTO AUTOMÁTICO DO CAIXA =====
  _verificarFechamentoCaixa() {
    const CACHE_KEY = 'caixa_ultimo_fechamento';
    const ultimoExec = localStorage.getItem(CACHE_KEY);
    const hojeKey   = new Date().toISOString().slice(0, 10);

    // Já rodou hoje — não precisa fazer nada
    if (ultimoExec && ultimoExec.startsWith(hojeKey)) {
      console.log('✅ [Dashboard] Fechamento do Caixa já executado hoje.');
      return;
    }

    // Carrega o Caixa em iframe invisível para disparar o orquestrador
    console.log('🔄 [Dashboard] Disparando fechamento automático do Caixa em background...');
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'display:none;width:0;height:0;position:absolute;';
    iframe.src = '/CRM/pages/caixa/index.html';
    document.body.appendChild(iframe);

    // Remove após 40s (tempo suficiente para o orquestrador concluir)
    setTimeout(() => {
      iframe.remove();
      console.log('✅ [Dashboard] Iframe do Caixa removido.');
    }, 40000);
  },

  // ===== META SEMANAL =====
  setupMetaSemanal() {
    this.updateMeta(this.state.meta.current, this.state.meta.goal);
    this._carregarMetaFirestore();
  },

  async _carregarMetaFirestore() {
    try {
      const CRESCIMENTO = 1.15;

      // Número da semana ISO (1-53)
      const _weekNum = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const jan1 = new Date(d.getFullYear(), 0, 1);
        return Math.ceil((((d - jan1) / 86400000) + 1) / 7);
      };

      const now      = new Date();
      const anoAtual = now.getFullYear();
      const numSem   = _weekNum(now);

      // Lê todos os lançamentos via SDK (autenticado)
      const snap = await getDocs(collection(db, 'caixa_lancamentos'));

      let lucroAtual = 0;
      // Acumula lucro da mesma semana por ano: { 2024: 1200, 2025: 1500 }
      const lucroPorAno = {};

      snap.forEach(d => {
        const l = d.data();
        const iso = l.dataISO || l.createdAtISO || '';
        if (!iso) return;

        const lucro = Number(l.lucro || 0);
        const dt = new Date(iso);
        const ano = dt.getFullYear();
        const sem = _weekNum(dt);

        if (ano === anoAtual && sem === numSem) lucroAtual += lucro;
        if (ano !== anoAtual && sem === numSem) {
          lucroPorAno[ano] = (lucroPorAno[ano] || 0) + lucro;
        }
      });

      // Meta base: lucro do ano anterior na mesma semana, ou média dos anos disponíveis
      const anosHistorico = Object.keys(lucroPorAno).map(Number).sort((a, b) => b - a);
      let lucroBase = 0;
      if (lucroPorAno[anoAtual - 1] > 0) {
        lucroBase = lucroPorAno[anoAtual - 1]; // prefere ano anterior
      } else if (anosHistorico.length > 0) {
        const soma = anosHistorico.reduce((s, a) => s + lucroPorAno[a], 0);
        lucroBase = soma / anosHistorico.length; // média dos anos disponíveis
      }

      const metaCalculada = lucroBase > 0
        ? Math.round(lucroBase * CRESCIMENTO)
        : this.state.meta.goal;

      this.updateMeta(lucroAtual, metaCalculada);

      const footer = document.querySelector('.meta-footer');
      if (footer) {
        const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR')}`;
        const baseLabel = lucroPorAno[anoAtual - 1] > 0
          ? `base ${anoAtual - 1}: ${fmt(Math.round(lucroBase))}`
          : anosHistorico.length > 0
            ? `média histórica: ${fmt(Math.round(lucroBase))}`
            : '';
        footer.innerHTML = `⚠ Faltam <span class="meta-remaining" id="meta-remaining">${fmt(Math.max(metaCalculada - lucroAtual, 0))}</span>${baseLabel ? ` <span class="meta-ref"> · ${baseLabel}</span>` : ''}`;
      }
    } catch (e) {
      console.warn('Meta Semanal:', e);
    }
  },

  updateMeta(current, goal) {
    this.state.meta = { current, goal };
    const percent = Math.min((current / goal) * 100, 100);
    const remaining = Math.max(goal - current, 0);
    const formatBRL = (v) => `R$ ${v.toLocaleString('pt-BR')}`;
    const elCurrent = document.getElementById('meta-current');
    const elGoal = document.getElementById('meta-goal');
    const elPercent = document.getElementById('meta-percent');
    const elRemaining = document.getElementById('meta-remaining');
    const fill = document.getElementById('meta-progress');

    if (elCurrent) elCurrent.textContent = formatBRL(current);
    if (elGoal) elGoal.textContent = formatBRL(goal);
    if (elPercent) elPercent.textContent = `${percent.toFixed(0)}%`;
    if (elRemaining) elRemaining.textContent = formatBRL(remaining);
    if (fill) {
      requestAnimationFrame(() => { fill.style.width = `${percent}%`; });
    }
  }
};
