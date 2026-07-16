/* ============================================
   PORTAL-PAINEL.JS — Tela inicial (resumo) do Portal do Cliente
   P2.2 (2026-07-16): extraído de portal.js (split por responsabilidade).
   Estende window.Portal — carregar DEPOIS de portal.js no index.html.
   ============================================ */
Object.assign(window.Portal, {
  // ===== PAINEL PRINCIPAL =====
  renderPainel() {
    const el = document.getElementById('app-content');
    // Marca o link ativo no menu inferior
    this._setActiveNav('painel');

    const s = this.session;
    const os = this.currentOS;
    false && console.log('[AUDIT:PAINEL] this.currentOS.length:', os?.length);
    false && console.log('[AUDIT:PAINEL] this.session?.telefone:', JSON.stringify(s?.telefone));
    false && console.log('[AUDIT:PAINEL] osCount do login:', s?.osCount);
    if (os?.length > 0) {
      false && console.log('[AUDIT:PAINEL] OS encontradas no currentOS:');
      os.forEach(o => false && console.log('  - ID:', o.firestoreId || o.id, '| phone:', JSON.stringify(o.phone), '| status:', o.status));
    } else {
      console.warn('[AUDIT:PAINEL] *** ALERTA: currentOS VAZIO! OS serão exibidas como 0.');
    }
    const activeOS = os.filter(o => o.status !== 'entregue' && o.status !== 'devolvido_orcamento' && o.status !== 'orcamento_recusado');
    const warranties = os.filter(o => this._emGarantia(o));
    const msgsNaoLidas = (this.currentMsgs || []).filter(m => !m.lida);
    false && console.log('[AUDIT:PAINEL] activeOS:', activeOS.length, '| warranties:', warranties.length, '| msgsNaoLidas:', msgsNaoLidas.length);

    // Busca última avaliação do Firestore (assíncrona, exibe depois)
    this._buscarUltimaAvaliacao().then(ultimaAval => {
      const ratingStar = ultimaAval ? '★'.repeat(ultimaAval.nota) + '☆'.repeat(5 - ultimaAval.nota) : '—';
      const ratingText = ultimaAval ? `${ultimaAval.nota}/5` : 'Nenhuma';

      const avaliacaoEl = document.getElementById('resumo-avaliacao');
      const avaliacaoValor = document.getElementById('resumo-avaliacao-valor');
      if (avaliacaoEl && avaliacaoValor) {
        avaliacaoEl.textContent = ratingStar;
        avaliacaoValor.textContent = ratingText;
      }
    });

    el.innerHTML = `
      <div class="painel-container">
        <!-- GREETING -->
        <div class="painel-greeting">
          <div class="greeting-avatar">${this._getInitial(s.clientName)}</div>
          <div class="greeting-text">
            <span class="greeting-hello">Olá, <strong>${this._esc(s.clientName)}</strong></span>
            <span class="greeting-sub">📱 ${s.telefone}</span>
          </div>
        </div>

        <!-- RESUMO EM CARDS -->
        <div class="painel-resumo">
          <div class="resumo-card">
            <div class="resumo-icon">📱</div>
            <div class="resumo-info">
              <span class="resumo-value">${activeOS.length}</span>
              <span class="resumo-label">Ordens de Serviço Ativas</span>
            </div>
          </div>
          <div class="resumo-card">
            <div class="resumo-icon">🛡️</div>
            <div class="resumo-info">
              <span class="resumo-value">${warranties.length}</span>
              <span class="resumo-label">Garantias Ativas</span>
            </div>
          </div>
          <div class="resumo-card ${msgsNaoLidas.length > 0 ? 'resumo-destaque' : ''}">
            <div class="resumo-icon">📩</div>
            <div class="resumo-info">
              <span class="resumo-value">${msgsNaoLidas.length}</span>
              <span class="resumo-label">Mensagens Pendentes</span>
            </div>
            ${msgsNaoLidas.length > 0 ? '<span class="resumo-badge">!</span>' : ''}
          </div>
          <div class="resumo-card">
            <div class="resumo-icon">⭐</div>
            <div class="resumo-info">
              <span class="resumo-value" id="resumo-avaliacao-valor">...</span>
              <span class="resumo-label" id="resumo-avaliacao">Última Avaliação</span>
            </div>
          </div>
        </div>

        <!-- AVISO DE SERVIÇOS ATIVOS -->
        ${activeOS.length > 0 ? `
          <div class="painel-aviso painel-aviso-clickable" onclick="Portal.navegar('os')">
            ⚡ Você tem <strong>${activeOS.length}</strong> serviço(s) em andamento — clique para ver
          </div>
        ` : `
          <div class="painel-aviso" style="background:rgba(0,200,83,0.08);border-color:rgba(0,200,83,0.2);">
            ✅ Nenhum serviço em andamento no momento
          </div>
        `}

        <!-- GRID DE NAVEGAÇÃO (hierarquia: destaque → médios → secundários) -->
        <div class="painel-grid">
          <!-- DESTAQUE PRINCIPAL -->
          <div class="painel-card painel-card-hero" onclick="Portal.navegar('agendar')">
            <div class="painel-card-icon">📅</div>
            <div class="painel-card-textwrap">
              <div class="painel-card-title">Agendar Atendimento</div>
              <div class="painel-card-sub">Reserve um horário com a nossa equipe</div>
            </div>
          </div>

          <!-- SEGUNDA PRIORIDADE -->
          <div class="painel-card painel-card-md" onclick="Portal.navegar('os')">
            <div class="painel-card-icon">📋</div>
            <div class="painel-card-title">Minhas OS</div>
            <div class="painel-card-sub">${os.length} registro(s)</div>
          </div>
          <div class="painel-card painel-card-md" onclick="Portal.navegar('garantias')">
            <div class="painel-card-icon">🛡️</div>
            <div class="painel-card-title">Garantias</div>
            <div class="painel-card-sub">${warranties.length} ativa(s)</div>
          </div>

          <!-- TERCEIRA PRIORIDADE -->
          <div class="painel-card painel-card-solicitar" onclick="Portal.navegar('contato')">
            <div class="painel-card-icon">🔧</div>
            <div class="painel-card-title">Solicitar Reparo</div>
            <div class="painel-card-sub">Solicite um orçamento</div>
          </div>
          <div class="painel-card" onclick="Portal.navegar('mensagens')">
            <div class="painel-card-icon">💬</div>
            <div class="painel-card-title">Mensagens</div>
            <div class="painel-card-sub">${msgsNaoLidas.length > 0 ? `${msgsNaoLidas.length} pendente(s)` : 'Fale conosco'}</div>
          </div>
          <div class="painel-card" onclick="Portal.navegar('contato')">
            <div class="painel-card-icon">📞</div>
            <div class="painel-card-title">Contato</div>
            <div class="painel-card-sub">WhatsApp &amp; Telefone</div>
          </div>
          <div class="painel-card" onclick="Portal.navegar('como-chegar')">
            <div class="painel-card-icon">📍</div>
            <div class="painel-card-title">Como Chegar</div>
            <div class="painel-card-sub">Veja como nos encontrar</div>
          </div>
        </div>
      </div>
    `;
  },

  // ===== BUSCAR ÚLTIMA AVALIAÇÃO =====
  async _buscarUltimaAvaliacao() {
    try {
      const resp = await window.PortalFunctions.listarAvaliacoes({ phoneDigits: this.session.telefoneDigits });
      const lista = resp.data.lista || [];
      return lista.length ? lista[0] : null;
    } catch (e) {
      return null;
    }
  },
});
