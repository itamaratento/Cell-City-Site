/* ============================================
   PORTAL-GARANTIAS.JS — Tela de Garantias do Portal do Cliente
   P2.2 (2026-07-16): extraído de portal.js (split por responsabilidade).
   Estende window.Portal — carregar DEPOIS de portal.js no index.html.
   ============================================ */
Object.assign(window.Portal, {
  // ===== GARANTIAS =====
  // garantiaId é escolhido na CRIAÇÃO da OS (os.js::startOS, campo
  // f-garantia-modelo) — toda OS aberta com um modelo de garantia selecionado
  // já nasce com garantiaId preenchido, mesmo que o orçamento seja recusado
  // depois. Sem checar o status aqui, o fallback "não entregue mas tem
  // garantiaId" tratava recusa/cancelamento como "garantia pendente de
  // entrega" — falso positivo achado na homologação de 2026-07-11 (ex.:
  // Samsung J2 Core com orçamento recusado aparecendo em Minhas Garantias).
  _STATUS_SEM_GARANTIA: ['orcamento_recusado', 'devolvido_orcamento'],
  _emGarantia(os) {
    if (this._STATUS_SEM_GARANTIA.includes(os.status)) return false;
    // Se tem garantiaId, considera em garantia mesmo sem entrega (prazo conta da criação).
    // Se foi entregue, o prazo conta da data de entrega (comportamento original).
    const dd = this._getDeliveryDate(os);
    const prazo = os.prazoGarantia || PRAZO_GARANTIA_DIAS;

    let startDate;
    if (dd) {
      startDate = dd;
    } else if (os.garantiaId) {
      // Não entregue mas tem garantia vinculada — conta da criação da OS
      if (os.createdAt) {
        startDate = typeof os.createdAt === 'object' && os.createdAt.toDate
          ? os.createdAt.toDate()
          : new Date(os.createdAt);
      } else {
        return false;
      }
    } else {
      return false;
    }

    const limite = new Date(startDate);
    limite.setDate(limite.getDate() + prazo);
    return new Date() <= limite;
  },

  _diasRestantesGarantia(os) {
    const dd = this._getDeliveryDate(os);
    const prazo = os.prazoGarantia || PRAZO_GARANTIA_DIAS;

    let startDate;
    if (dd) {
      startDate = dd;
    } else if (os.garantiaId) {
      if (os.createdAt) {
        startDate = typeof os.createdAt === 'object' && os.createdAt.toDate
          ? os.createdAt.toDate()
          : new Date(os.createdAt);
      } else {
        return 0;
      }
    } else {
      return 0;
    }

    const limite = new Date(startDate);
    limite.setDate(limite.getDate() + prazo);
    return Math.ceil((limite - new Date()) / 86400000);
  },

  _getDeliveryDate(os) {
    // A garantia só existe para serviços EFETIVAMENTE entregues. A data de entrega vem
    // da timeline ("Entregue"); só caímos no fallback updatedAt quando o status confirma
    // a entrega. Sem isso, OS como "devolvido_orcamento" (orçamento recusado, aparelho
    // devolvido sem reparo) eram contadas como em garantia — falso positivo (ex.: Maria Cuba).
    if (Array.isArray(os.timeline)) {
      const entry = [...os.timeline].reverse().find(t => t.text && t.text.includes('Entregue'));
      if (entry?.date) return new Date(entry.date);
    }
    // Fallback: apenas para OS marcadas como entregues (sem registro de timeline).
    if (os.status === 'entregue' && os.updatedAt) {
      const ua = os.updatedAt;
      if (typeof ua === 'string') return new Date(ua);
      if (ua.toDate) return ua.toDate();
    }
    return null;
  },

  renderGarantias() {
    try {
      const el = document.getElementById('app-content');

      false && console.log('[AUDIT:GARANTIAS] this.currentOS.length:', this.currentOS?.length);
      if (this.currentOS?.length > 0) {
        this.currentOS.forEach(o => {
          const emGar = this._emGarantia(o);
          const dd = this._getDeliveryDate(o);
          false && console.log('[AUDIT:GARANTIAS:OS] ID:', o.firestoreId || o.id, '| status:', o.status, '| garantiaId:', o.garantiaId, '| emGarantia:', emGar, '| deliveryDate:', dd?.toISOString?.() || dd);
        });
      } else {
        console.warn('[AUDIT:GARANTIAS] *** ALERTA: currentOS VAZIO! Garantias serão exibidas como 0.');
      }

      // Garante that this.garantias está carregado
      if (!this.garantias) this.garantias = [];

      // Helper para obter o nome do modelo de garantia
      const getGarantiaNome = (os) => {
        const g = this.garantias.find(gg => String(gg.id) === String(os.garantiaId));
        return g ? g.nome : null;
      };

      // Classifica OS em 3 grupos mutuamente exclusivos. garantiaId sozinho
      // não basta — é escolhido na criação da OS, então uma OS recusada
      // também teria garantiaId e nenhuma data de entrega, caindo aqui por
      // engano (mesma causa raiz do fix em _emGarantia, ver comentário lá).
      const pendentes = this.currentOS.filter(o =>
        o.garantiaId && !this._getDeliveryDate(o) && !this._STATUS_SEM_GARANTIA.includes(o.status)
      );
      const ativas = this.currentOS.filter(o => this._emGarantia(o));
      const expiradas = this.currentOS.filter(o =>
        !this._emGarantia(o) && this._getDeliveryDate(o)
      );

      false && console.log('[AUDIT:GARANTIAS] pendentes:', pendentes.length, '| ativas:', ativas.length, '| expiradas:', expiradas.length);

      let html = `<div class="garantias-container"><h2 class="screen-title">🛡️ Minhas Garantias</h2>`;

      // Garantias expiradas não são exibidas ao cliente (Sprint 2026-07-11) —
      // não contam pra decidir se a tela deve mostrar o estado vazio. Um
      // cliente com só garantias expiradas vê "nenhum serviço encontrado",
      // já que nenhuma delas seria mostrada de qualquer forma.
      if (pendentes.length === 0 && ativas.length === 0) {
        html += `<div class="empty-state"><div class="empty-icon">🛡️</div><p>Nenhum serviço com garantia encontrado.</p><button class="login-btn" onclick="Portal.navegar('painel')">Voltar</button></div></div>`;
        el.innerHTML = html;
        return;
      }

      // ===== RESUMO SUPERIOR (aproveita o espaço no topo da tela) =====
      const totalOS = this.currentOS.length;
      const totalAgendamentos = (this.currentAgendamentos || []).length;
      html += `
        <div class="painel-resumo garantias-resumo">
          <div class="resumo-card ${ativas.length > 0 ? 'resumo-destaque' : ''}">
            <div class="resumo-icon">🛡️</div>
            <div class="resumo-info">
              <span class="resumo-value">${ativas.length}</span>
              <span class="resumo-label">Garantias Ativas</span>
            </div>
          </div>
          <div class="resumo-card" onclick="Portal.navegar('os')" style="cursor:pointer;">
            <div class="resumo-icon">📄</div>
            <div class="resumo-info">
              <span class="resumo-value">${totalOS}</span>
              <span class="resumo-label">Ordens de Serviço</span>
            </div>
          </div>
          <div class="resumo-card" onclick="Portal.navegar('agendar')" style="cursor:pointer;">
            <div class="resumo-icon">📅</div>
            <div class="resumo-info">
              <span class="resumo-value">${totalAgendamentos}</span>
              <span class="resumo-label">Agendamentos</span>
            </div>
          </div>
        </div>
      `;

      // Helper para link da garantia
      const osLink = (o) => `/CRM/garantia.html?id=${this._esc(o.id || o.firestoreId || '')}`;
      const relLink = (o) => `/CRM/garantia.html?id=${this._esc(o.id || o.firestoreId || '')}&doc=relatorio`;
      const temRelatorio = (o) => {
        const r = o.relatorioTecnico;
        return !!(r && r.exibirPortal && (r.defeitoInformado || r.diagnostico || r.solucaoAplicada || r.observacoes));
      };
      // Estilos de botão reutilizáveis
      const BTN_GAR = 'display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;font-weight:600;font-size:13px;text-decoration:none;background:linear-gradient(135deg,#00C853,#00A040);color:#fff;';
      const BTN_REL = 'display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;font-weight:600;font-size:13px;text-decoration:none;background:linear-gradient(135deg,#2196F3,#1976D2);color:#fff;';
      const BTN_SEC = 'display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;font-weight:600;font-size:13px;text-decoration:none;background:var(--bg-surface,#1a1d23);color:var(--text-primary,#f5f7fa);border:1px solid var(--border,rgba(255,255,255,0.10));';
      const BTN_NF = 'display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;font-weight:600;font-size:13px;text-decoration:none;background:linear-gradient(135deg,#1976D2,#1565C0);color:#fff;';
      const LBL = 'font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px;';
      // Bloco de ações: Garantia + (se houver) Relatório Técnico + (se houver) Nota Fiscal
      const acoesDoc = (o) => {
        const g = osLink(o), r = relLink(o);
        let h = `<div style="margin-top:12px;">`;
        h += `<div style="${LBL}margin-bottom:6px;">🛡️ Garantia</div>`;
        h += `<div style="display:flex;flex-wrap:wrap;gap:8px;">`
           + `<a href="${g}" target="_blank" style="${BTN_GAR}">👁️ Visualizar Garantia</a>`
           + `<a href="${g}" download style="${BTN_SEC}">📥 Baixar Garantia</a>`
           + `</div>`;
        if (temRelatorio(o)) {
          h += `<div style="${LBL}margin:14px 0 6px;">📋 Relatório Técnico</div>`;
          h += `<div style="display:flex;flex-wrap:wrap;gap:8px;">`
             + `<a href="${r}" target="_blank" style="${BTN_REL}">👁️ Visualizar Relatório</a>`
             + `<a href="${r}" download style="${BTN_SEC}">📥 Baixar Relatório</a>`
             + `</div>`;
        }
        // Link colado manualmente pela equipe (Google Drive) — restaurado
        // 2026-07-11, existia antes do rollback do SaaS. Em Minhas Garantias
        // só aparece com garantia REALMENTE válida (não em pendente nem
        // expirada) — homologação de 2026-07-11 pediu essa regra explícita;
        // na tela de detalhe da OS (renderOSDetalhe) continua sempre visível.
        if (o.nfLink && this._emGarantia(o)) {
          h += `<div style="${LBL}margin:14px 0 6px;">📄 Nota Fiscal</div>`;
          h += `<div style="display:flex;flex-wrap:wrap;gap:8px;">`
             + `<a href="${this._esc(o.nfLink)}" target="_blank" rel="noopener" style="${BTN_NF}">👁️ Visualizar Nota Fiscal</a>`
             + `</div>`;
        }
        h += `</div>`;
        return h;
      };

      // ===== 1. Garantias Vinculadas (pendentes de entrega) =====
      if (pendentes.length > 0) {
        html += `<h3 class="garantias-subtitle" style="color:#42A5F5;">🔗 Garantias Vinculadas (${pendentes.length})</h3>`;
        pendentes.forEach(o => {
          try {
            const nomeGarantia = getGarantiaNome(o);
            html += `
              <div class="garantia-card" style="border-left: 4px solid #42A5F5;">
                <div class="garantia-card-top">
                  <span class="garantia-card-model">📱 ${this._esc(o.model || '')}</span>
                  <span class="garantia-card-status-badge" style="background:#42A5F520;color:#42A5F5;border:1px solid #42A5F540;">
                    🔗 Vinculada
                  </span>
                </div>
                ${nomeGarantia ? `<div class="garantia-card-info"><span>🛡️ Garantia: <strong>${this._esc(nomeGarantia)}</strong></span></div>` : ''}
                <div class="garantia-card-info">
                  <span>🔄 Aguardando conclusão do serviço</span>
                  <span class="garantia-card-id">OS #${this._esc(o.firestoreId || o.id || '')}</span>
                </div>
                ${acoesDoc(o)}
              </div>
            `;
          } catch (err) {
            console.warn('[Portal] Erro ao renderizar garantia pendente:', err, o);
          }
        });
      }

      // ===== 2. Garantias Ativas (já entregues, dentro do prazo) =====
      if (ativas.length > 0) {
        html += `<h3 class="garantias-subtitle">🟢 Garantias Válidas (${ativas.length})</h3>`;
        ativas.forEach(o => {
          try {
            const dias = this._diasRestantesGarantia(o);
            const dd = this._getDeliveryDate(o);
            const prazo = o.prazoGarantia || PRAZO_GARANTIA_DIAS;
            const dataFim = new Date(dd);
            dataFim.setDate(dataFim.getDate() + prazo);
            const dataFimStr = dataFim.toLocaleDateString('pt-BR');
            const nomeGarantia = getGarantiaNome(o);

            let cor = '#00C853';
            let icon = '🟢';
            let status = 'Garantia válida';
            if (dias <= 7) { cor = '#EF5350'; icon = '🔴'; status = 'Expirando'; }
            else if (dias <= 15) { cor = '#FFA726'; icon = '⏳'; status = 'Vencendo em breve'; }

            html += `
              <div class="garantia-card" style="border-left: 4px solid ${cor};">
                <div class="garantia-card-top">
                  <span class="garantia-card-model">📱 ${this._esc(o.model || '')}</span>
                  <span class="garantia-card-status-badge" style="background:${cor}20;color:${cor};border:1px solid ${cor}40;">
                    ${icon} ${status}
                  </span>
                </div>
                <div class="garantia-card-dias" style="color:${cor};">
                  ⏳ ${dias} dia(s) restante(s)
                </div>
                <div class="garantia-card-info">
                  ${nomeGarantia ? `<span>🛡️ Garantia: <strong>${this._esc(nomeGarantia)}</strong></span>` : ''}
                  <span>📅 Garantia até: <strong>${dataFimStr}</strong></span>
                  <span class="garantia-card-id">OS #${this._esc(o.firestoreId || o.id || '')}</span>
                </div>
                ${acoesDoc(o)}
              </div>
            `;
          } catch (err) {
            console.warn('[Portal] Erro ao renderizar garantia individual:', err, o);
          }
        });
      }

      // ===== 3. Garantias Expiradas =====
      // Sprint 2026-07-11: não gera benefício operacional pro cliente e passa
      // impressão negativa — removida da exibição. Os dados continuam
      // armazenados/computados normalmente (variável `expiradas` acima,
      // Firestore e regras intocados); só a renderização foi retirada.
      // Não remover o cálculo de `expiradas` — outras telas podem vir a
      // precisar dele, e o custo de mantê-lo é zero (não é mais lido aqui).

      html += `</div>`;
      el.innerHTML = html;
    } catch (err) {
      console.error('[Portal] Erro ao renderizar garantias:', err);
      const el = document.getElementById('app-content');
      if (el) {
        el.innerHTML = `<div class="garantias-container"><div class="empty-state"><div class="empty-icon">🛡️</div><p>Erro ao carregar garantias.</p><button class="login-btn" onclick="Portal.navegar('painel')">Voltar</button></div></div>`;
      }
    }
  },
});
