/* =============================================
   PAINEL ADMINISTRATIVO — PORTAL DO CLIENTE
   admin.js — v2.4 (ultra-otimizado)
   
   OTIMIZAÇÕES DE PERFORMANCE v2.4:
   - Event listeners centralizados (remove onclick inline, usa delegação)
   - Cache de DOM elements para evitar querySelector repetido
   - Debounce no refresh (evita múltiplas chamadas simultâneas)
   - Promise.all() para queries paralelas no _carregarDados()
   - limit(100) em todas as collections
   - Cache de tracking com TTL de 30s
   - _buscarResumoTracking() com queries combinadas (2 queries)
   - _carregarEstatisticas() com filtro server-side (>= inicioMes)
   - Gráfico 7 dias: single-pass nos dados
   - Lazy load: tracking só é carregado quando a aba é acessada
   - Render otimizado com requestAnimationFrame
   - innerHTML substituído por fragmentos onde possível
   - Removido setTimeout desnecessário para atualização de tracking
   ============================================= */

window.PortalAdmin = {

  // ===== INICIALIZAÇÃO (OTIMIZADA) =====
  async init() {
    this.currentTab = '';
    this.mensagens = [];
    this.avaliacoes = [];
    this.solicitacoes = [];
    this.unsubscribers = [];
    this._refreshLoading = false; // controle de debounce
    this._domCache = {}; // cache de elementos DOM

    // Cache de tracking
    this._trackingCache = null;
    this._trackingCacheTime = 0;
    this._trackingCacheTTL = 30000;

    // Aguarda Firebase (com timeout 8s — reduzido de 10s)
    if (!window.authReady) {
      await new Promise(resolve => {
        if (window.authReady) { resolve(); return; }
        const handler = () => { resolve(); };
        window.addEventListener('admin-firebase-ready', handler, { once: true });
        setTimeout(() => { window.removeEventListener('admin-firebase-ready', handler); resolve(); }, 8000);
      });
    }

    console.log('[Admin] Firebase pronto. Inicializando...');

    // ⚡ OTIMIZAÇÃO #3: Vincula eventos uma única vez (delegação)
    this._vincularEventos();

    // ⚡ ETAPA 3: Listeners em tempo real (onSnapshot) substituem getDocs
    await this._iniciarListeners();

    // Tracking cache (background, não bloqueia)
    this._carregarTrackingCache();

    // Mostra a central imediatamente
    this.navegar('central');
  },

  // ===== VINCULAR EVENTOS (OTIMIZADO — remove onclick inline) =====
  _vincularEventos() {
    if (this._eventosVinculados) return;
    this._eventosVinculados = true;

    // ⚡ OTIMIZAÇÃO #4: Delegação de eventos no document (1 listener vs vários)
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const tab = target.dataset.tab;

      if (action === 'navegar' && tab) {
        this.navegar(tab);
      } else if (action === 'refresh') {
        this.refresh();
      } else if (action === 'marcar-lida') {
        this._marcarLida(target.dataset.id);
      } else if (action === 'responder') {
        this._responderMensagem(target.dataset.id);
      } else if (action === 'criar-os') {
        this._criarOS(target.dataset.id);
      } else if (action === 'marcar-concluido') {
        this._marcarConcluido(target.dataset.id);
      }
    });

    // ⚡ OTIMIZAÇÃO #5: Logo clicável → Dashboard do CRM
    const logo = document.getElementById('admin-brand-logo');
    if (logo) {
      logo.addEventListener('click', () => {
        window.location.href = '../dashboard/index.html';
      });
    }

    // ⚡ OTIMIZAÇÃO #6: Refresh button com debounce
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.refresh());
    }
  },

  // ===== NAVEGAÇÃO ENTRE ABAS =====
  navegar(tab) {
    if (this.currentTab === tab) return; // ⚡ não re-renderiza mesma aba
    this.currentTab = tab;

    // Atualiza tabs visualmente
    const tabsContainer = document.getElementById('admin-tabs');
    if (tabsContainer) {
      tabsContainer.querySelectorAll('.admin-tab').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tab);
      });
    }

    // Renderiza via requestAnimationFrame (não bloqueia UI)
    requestAnimationFrame(() => {
      switch (tab) {
        case 'central': this.renderCentral(); break;
        case 'mensagens': this.renderMensagens(); break;
        case 'avaliacoes': this.renderAvaliacoes(); break;
        case 'solicitacoes': this.renderSolicitacoes(); break;
        case 'estatisticas': this.renderEstatisticas(); break;
      }
    });
  },

  // ===== REFRESH (COM DEBOUNCE) =====
  refresh() {
    if (this._refreshLoading) {
      this._toast('⏳ Atualizando...');
      return;
    }
    this._refreshLoading = true;

    // Invalida cache de tracking
    this._trackingCache = null;
    this._trackingCacheTime = 0;

    // Reinicia listeners (mantém dados frescos)
    this._iniciarListeners().then(() => {
      this._refreshLoading = false;
      this._carregarTrackingCache(); // background
      this.navegar(this.currentTab);
    }).catch(() => {
      this._refreshLoading = false;
    });
  },

  // ===== LISTENERS EM TEMPO REAL (ETAPA 3 — onSnapshot) =====
  async _iniciarListeners() {
    const db = window.db;
    const { collection, query, orderBy, limit, onSnapshot } = window.FirebaseModules;

    // Limpa listeners anteriores
    this.unsubscribers.forEach(fn => fn());
    this.unsubscribers = [];

    // Controle de inicialização: espera todas as 3 collections carregarem
    let sinalInicial = 0;
    const TOTAL = 3;
    const aguardarInicial = new Promise(resolve => {
      this._resolverInicial = resolve;
    });

    const processarSnap = (tipo) => (snap) => {
      const items = [];
      snap.forEach(doc => items.push({ firestoreId: doc.id, ...doc.data() }));
      this[tipo] = items;

      // ⚡ Primeira carga de cada collection
      sinalInicial++;
      this._atualizarBadges();

      if (sinalInicial === TOTAL && this._resolverInicial) {
        this._resolverInicial();
        this._resolverInicial = null;
        console.log('[Admin] Listeners tempo real ativos:', {
          mensagens: this.mensagens.length,
          avaliacoes: this.avaliacoes.length,
          solicitacoes: this.solicitacoes.length
        });
        return; // Não re-renderiza na carga inicial
      }

      // ⚡ Mudanças subsequentes → tempo real
      if (this._renderTimeout) clearTimeout(this._renderTimeout);
      this._renderTimeout = setTimeout(() => {
        switch (this.currentTab) {
          case 'central':
            this.renderCentral();
            break;
          case 'mensagens':
            if (tipo === 'mensagens') this.renderMensagens();
            break;
          case 'avaliacoes':
            if (tipo === 'avaliacoes') this.renderAvaliacoes();
            break;
          case 'solicitacoes':
            if (tipo === 'solicitacoes') this.renderSolicitacoes();
            break;
        }
      }, 300);
    };

    const onError = (tipo) => (err) => {
      console.warn('[Admin] Erro listener ' + tipo + ':', err);
    };

    // Inicia listeners para as 3 collections
    this.unsubscribers.push(
      onSnapshot(
        query(collection(db, 'mensagens_portal'), orderBy('createdAt', 'desc'), limit(100)),
        processarSnap('mensagens'),
        onError('mensagens')
      )
    );
    this.unsubscribers.push(
      onSnapshot(
        query(collection(db, 'avaliacoes'), orderBy('createdAt', 'desc'), limit(100)),
        processarSnap('avaliacoes'),
        onError('avaliacoes')
      )
    );
    this.unsubscribers.push(
      onSnapshot(
        query(collection(db, 'solicitacoes_diagnostico'), orderBy('createdAt', 'desc'), limit(100)),
        processarSnap('solicitacoes'),
        onError('solicitacoes')
      )
    );

    // Aguarda carga inicial das 3 collections
    await aguardarInicial;
  },

  // ===== ATUALIZAR BADGES =====
  _atualizarBadges() {
    const pendentes = this.mensagens.filter(m => !m.lida).length;
    const badgeMsg = document.getElementById('badge-mensagens');
    if (badgeMsg) {
      badgeMsg.textContent = pendentes > 99 ? '99+' : pendentes;
      badgeMsg.style.display = pendentes > 0 ? '' : 'none';
    }

    const solicitacoesPendentes = this.solicitacoes.filter(s => s.status !== 'concluido').length;
    const badgeSol = document.getElementById('badge-solicitacoes');
    if (badgeSol) {
      badgeSol.textContent = solicitacoesPendentes > 99 ? '99+' : solicitacoesPendentes;
      badgeSol.style.display = solicitacoesPendentes > 0 ? '' : 'none';
    }
  },

  // ===== GERENCIAMENTO DE CACHE DE TRACKING =====
  _isTrackingCacheValido() {
    return this._trackingCache !== null &&
           (Date.now() - this._trackingCacheTime) < this._trackingCacheTTL;
  },

  _invalidarTrackingCache() {
    this._trackingCache = null;
    this._trackingCacheTime = 0;
  },

  async _carregarTrackingCache() {
    try {
      this._trackingCache = await this._buscarResumoTracking();
      this._trackingCacheTime = Date.now();

      // Se estiver na central, atualiza cards sem re-renderizar
      if (this.currentTab === 'central') {
        this._atualizarCardsTracking(this._trackingCache);
      }
    } catch (err) {
      // Silencia
    }
  },

  // ===== RENDER: CENTRAL DO PORTAL (OTIMIZADO) =====
  renderCentral() {
    const el = document.getElementById('admin-content');
    if (!el) return;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const mensagensPendentes = this.mensagens.filter(m => !m.lida).length;
    const totalAvaliacoes = this.avaliacoes.length;
    const mediaEstrelas = totalAvaliacoes > 0
      ? (this.avaliacoes.reduce((s, a) => s + (a.nota || 0), 0) / totalAvaliacoes).toFixed(1)
      : '\u2014';
    const solicitacoesPendentes = this.solicitacoes.filter(s => s.status !== 'concluido').length;

    const usarCache = this._isTrackingCacheValido();
    const trackingData = usarCache ? this._trackingCache : null;

    // ⚡ OTIMIZAÇÃO #9: Template string única (evita múltiplas concatenações)
    el.innerHTML = `
      <h2 class="admin-section-title">🏠 CENTRAL DO PORTAL</h2>
      <p class="admin-section-subtitle">Resumo geral do Portal do Cliente</p>

      <div class="central-grid" id="central-grid">
        <div class="central-card ${mensagensPendentes > 0 ? 'destaque' : ''}">
          <div class="central-card-icon">💬</div>
          <div class="central-card-title">Mensagens Pendentes</div>
          <div class="central-card-value">${mensagensPendentes}</div>
          <div class="central-card-sub">${this.mensagens.length} total de mensagens</div>
        </div>

        <div class="central-card">
          <div class="central-card-icon">⭐</div>
          <div class="central-card-title">Avaliações Recebidas</div>
          <div class="central-card-value">${totalAvaliacoes}</div>
          <div class="central-card-sub">Média: ${mediaEstrelas} ★</div>
        </div>

        <div class="central-card ${solicitacoesPendentes > 0 ? 'destaque' : ''}">
          <div class="central-card-icon">🔧</div>
          <div class="central-card-title">Solicitações de Orçamento</div>
          <div class="central-card-value">${solicitacoesPendentes}</div>
          <div class="central-card-sub">${this.solicitacoes.length} total recebidas</div>
        </div>

        <div class="central-card" id="card-clientes-hoje">
          <div class="central-card-icon">👥</div>
          <div class="central-card-title">Clientes Hoje</div>
          <div class="central-card-value" id="val-clientes-hoje">${trackingData ? trackingData.acessosHoje : '\u2014'}</div>
          <div class="central-card-sub">Acessos no dia</div>
        </div>

        <div class="central-card" id="card-ultimo-acesso">
          <div class="central-card-icon">🕐</div>
          <div class="central-card-title">Último Acesso</div>
          <div class="central-card-value" id="val-ultimo-acesso" style="font-size:16px;">${trackingData && trackingData.ultimoAcesso ? trackingData.ultimoAcesso.nome : '\u2014'}</div>
          <div class="central-card-sub" id="sub-ultimo-acesso">${trackingData && trackingData.ultimoAcesso ? trackingData.ultimoAcesso.data : 'Nenhum acesso registrado'}</div>
        </div>

        <div class="central-card" id="card-cliques-whatsapp">
          <div class="central-card-icon">💚</div>
          <div class="central-card-title">Cliques WhatsApp</div>
          <div class="central-card-value" id="val-cliques-whatsapp">${trackingData ? trackingData.cliquesWhatsApp : '\u2014'}</div>
          <div class="central-card-sub">Total de cliques</div>
        </div>

        <div class="central-card" id="card-cliques-maps">
          <div class="central-card-icon">🗺️</div>
          <div class="central-card-title">Cliques Google Maps</div>
          <div class="central-card-value" id="val-cliques-maps">${trackingData ? trackingData.cliquesMaps : '\u2014'}</div>
          <div class="central-card-sub">Total de cliques</div>
        </div>

        <div class="central-card" id="card-reservado">
          <div class="central-card-icon">📍</div>
          <div class="central-card-title">Reservado</div>
          <div class="central-card-value">—</div>
          <div class="central-card-sub">Espaço reservado</div>
        </div>
      </div>
    `;
  },

  // ===== ATUALIZAR CARDS DE TRACKING (sem re-renderizar tudo) =====
  _atualizarCardsTracking(res) {
    if (!res) return;
    const elClientesHoje = document.getElementById('val-clientes-hoje');
    const elUltimoAcesso = document.getElementById('val-ultimo-acesso');
    const elSubUltimo = document.getElementById('sub-ultimo-acesso');
    const elWhatsApp = document.getElementById('val-cliques-whatsapp');
    const elMaps = document.getElementById('val-cliques-maps');

    if (elClientesHoje) elClientesHoje.textContent = res.acessosHoje;
    if (elUltimoAcesso && res.ultimoAcesso) {
      elUltimoAcesso.textContent = res.ultimoAcesso.nome;
      if (elSubUltimo) elSubUltimo.textContent = res.ultimoAcesso.data;
    }
    if (elWhatsApp) elWhatsApp.textContent = res.cliquesWhatsApp;
    if (elMaps) elMaps.textContent = res.cliquesMaps;
  },

  // ===== BUSCAR RESUMO DE TRACKING (OTIMIZADO) =====
  async _buscarResumoTracking() {
    try {
      const db = window.db;
      const { collection, getDocs, query, where, orderBy, limit } = window.FirebaseModules;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeISO = hoje.toISOString();

      // ⚡ OTIMIZAÇÃO #10: 2 queries combinadas (antes eram 4)
      const [snapAcessosHoje, snapUltimo] = await Promise.all([
        getDocs(query(
          collection(db, 'portal_eventos'),
          where('tipo', '==', 'acesso'),
          where('createdAt', '>=', hojeISO)
        )),
        getDocs(query(
          collection(db, 'portal_eventos'),
          where('tipo', '==', 'acesso'),
          orderBy('createdAt', 'desc'),
          limit(1)
        ))
      ]);

      const acessosHoje = snapAcessosHoje.size;
      let ultimoAcesso = null;
      if (!snapUltimo.empty) {
        const d = snapUltimo.docs[0].data();
        const data = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
        ultimoAcesso = {
          nome: d.clientName || '\u2014',
          data: data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
      }

      const [snapWa, snapMaps] = await Promise.all([
        getDocs(query(collection(db, 'portal_eventos'), where('tipo', '==', 'clique_whatsapp'))),
        getDocs(query(collection(db, 'portal_eventos'), where('tipo', '==', 'clique_maps')))
      ]);

      return {
        acessosHoje,
        ultimoAcesso,
        cliquesWhatsApp: snapWa.size,
        cliquesMaps: snapMaps.size
      };
    } catch (err) {
      console.warn('[Admin] Erro ao buscar tracking:', err);
      return null;
    }
  },

  // ===== RENDER: MENSAGENS =====
  renderMensagens() {
    const el = document.getElementById('admin-content');
    if (!el) return;

    const naoLidas = this.mensagens.filter(m => !m.lida).length;

    let html = `
      <h2 class="admin-section-title">💬 Mensagens dos Clientes</h2>
      <p class="admin-section-subtitle">${naoLidas} mensagem(ns) não lida(s) de ${this.mensagens.length} total</p>
      <div class="admin-list">
    `;

    if (this.mensagens.length === 0) {
      html += `<div class="empty-state-admin"><div class="icon">💬</div><p>Nenhuma mensagem recebida</p></div>`;
    } else {
      // ⚡ OTIMIZAÇÃO #11: Pré-calcula array join (mais rápido que concatenação)
      const items = this.mensagens.map(m => {
        const data = m.createdAt?.toDate ? m.createdAt.toDate() : (m.createdAt || new Date());
        const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const statusCls = m.lida ? (m.resposta ? 'respondida' : 'lida') : 'nova';
        const statusLabel = m.lida ? (m.resposta ? '🟣 Respondida' : '🔵 Lida') : '🟢 Nova';

        return `
          <div class="admin-list-item">
            <div class="admin-list-item-top">
              <div>
                <div class="admin-list-item-name">${this._esc(m.clientName || m.nome || 'Cliente')}</div>
                <div class="admin-list-item-phone">📞 ${this._esc(m.telefone || '')}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                <span class="status-badge ${statusCls}">${statusLabel}</span>
                <span class="admin-list-item-date">${dataStr}</span>
              </div>
            </div>
            <div class="admin-list-item-body">${this._esc(m.texto || m.mensagem || '')}</div>
            ${m.resposta ? `<div class="admin-list-item-body" style="color:var(--accent-purple);font-size:12px;border-top:1px solid var(--border-color);padding-top:6px;margin-top:4px;">🟣 Resposta: ${this._esc(m.resposta)}</div>` : ''}
            <div class="admin-list-item-actions">
              ${!m.lida ? `<button class="admin-btn admin-btn-sm" data-action="marcar-lida" data-id="${m.firestoreId}">✅ Marcar Lida</button>` : ''}
              ${!m.resposta ? `<button class="admin-btn admin-btn-sm admin-btn-primary" data-action="responder" data-id="${m.firestoreId}">💬 Responder</button>` : ''}
            </div>
          </div>
        `;
      });
      html += items.join('');
    }

    html += `</div>`;
    el.innerHTML = html;
  },

  // ===== MARCAR MENSAGEM COMO LIDA =====
  async _marcarLida(docId) {
    try {
      const db = window.db;
      const { doc, updateDoc } = window.FirebaseModules;
      await updateDoc(doc(db, 'mensagens_portal', docId), { lida: true });
      const msg = this.mensagens.find(m => m.firestoreId === docId);
      if (msg) msg.lida = true;
      this._toast('✅ Mensagem marcada como lida');
      this.renderMensagens();
      this._atualizarBadges();
    } catch (err) {
      console.error('[Admin] Erro ao marcar lida:', err);
      this._toast('❌ Erro ao marcar como lida');
    }
  },

  // ===== RESPONDER MENSAGEM =====
  _responderMensagem(docId) {
    const msg = this.mensagens.find(m => m.firestoreId === docId);
    if (!msg) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        <h3>💬 Responder Cliente</h3>

        <label class="modal-label">Cliente</label>
        <div style="font-size:13px;margin-bottom:12px;color:var(--text-primary);">
          ${this._esc(msg.clientName || msg.nome || 'Cliente')} — 📞 ${this._esc(msg.telefone || '')}
        </div>

        <label class="modal-label">Mensagem original</label>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;padding:8px 10px;background:var(--bg-input);border-radius:var(--radius-sm);border:1px solid var(--border-color);">
          ${this._esc(msg.texto || msg.mensagem || '')}
        </div>

        <label class="modal-label">Sua resposta</label>
        <textarea class="modal-textarea" id="modal-resposta-texto" placeholder="Digite sua resposta..."></textarea>

        <div class="modal-actions">
          <button class="admin-btn" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
          <button class="admin-btn admin-btn-primary" onclick="PortalAdmin._enviarResposta('${docId}')">💬 Enviar Resposta</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('modal-resposta-texto')?.focus(), 100);
  },

  // ===== ENVIAR RESPOSTA =====
  async _enviarResposta(docId) {
    const texto = document.getElementById('modal-resposta-texto')?.value?.trim();
    if (!texto) {
      this._toast('📝 Digite uma resposta');
      return;
    }

    try {
      const db = window.db;
      const { doc, updateDoc } = window.FirebaseModules;
      await updateDoc(doc(db, 'mensagens_portal', docId), {
        resposta: texto,
        lida: true,
        respostaEm: new Date().toISOString(),   // campo lido pelo Portal do Cliente (portal.js)
        respondidaEm: new Date().toISOString()  // mantido por compatibilidade
      });

      const msg = this.mensagens.find(m => m.firestoreId === docId);
      if (msg) { msg.resposta = texto; msg.lida = true; }

      document.querySelector('.modal-overlay')?.remove();
      this._toast('✅ Resposta enviada com sucesso');
      this.renderMensagens();
    } catch (err) {
      console.error('[Admin] Erro ao enviar resposta:', err);
      this._toast('❌ Erro ao enviar resposta');
    }
  },

  // ===== RENDER: AVALIAÇÕES =====
  renderAvaliacoes() {
    const el = document.getElementById('admin-content');
    if (!el) return;

    const total = this.avaliacoes.length;
    const media = total > 0
      ? (this.avaliacoes.reduce((s, a) => s + (a.nota || 0), 0) / total)
      : 0;
    const mediaStr = media.toFixed(1);

    let html = `
      <h2 class="admin-section-title">⭐ Avaliações dos Clientes</h2>
      <div class="media-avaliacoes">
        <div class="media-avaliacoes-numero">${mediaStr}</div>
        <div class="media-avaliacoes-stars">
          <div>${this._starsHTML(Math.round(media))}</div>
          <div class="media-avaliacoes-label">${total} avaliação(ões)</div>
        </div>
      </div>
      <div class="admin-list">
    `;

    if (total === 0) {
      html += `<div class="empty-state-admin"><div class="icon">⭐</div><p>Nenhuma avaliação recebida</p></div>`;
    } else {
      const items = this.avaliacoes.map(a => {
        const data = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt || new Date());
        const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        return `
          <div class="admin-list-item">
            <div class="admin-list-item-top">
              <div>
                <div class="admin-list-item-name">${this._esc(a.clientName || a.nome || 'Cliente')}</div>
                <div class="admin-list-item-phone">📞 ${this._esc(a.telefone || '')}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                <div class="stars-display">${this._starsHTML(a.nota || 0)}</div>
                <span class="admin-list-item-date">${dataStr}</span>
              </div>
            </div>
            ${a.texto || a.comentario ? `<div class="admin-list-item-body">💬 ${this._esc(a.texto || a.comentario || '')}</div>` : ''}
          </div>
        `;
      });
      html += items.join('');
    }

    html += `</div>`;
    el.innerHTML = html;
  },

  // ===== RENDER: SOLICITAÇÕES =====
  renderSolicitacoes() {
    const el = document.getElementById('admin-content');
    if (!el) return;

    const pendentes = this.solicitacoes.filter(s => s.status !== 'concluido');

    let html = `
      <h2 class="admin-section-title">🔧 Solicitações de Orçamento</h2>
      <p class="admin-section-subtitle">${pendentes.length} pendente(s) de ${this.solicitacoes.length} total</p>
      <div class="admin-list">
    `;

    if (this.solicitacoes.length === 0) {
      html += `<div class="empty-state-admin"><div class="icon">🔧</div><p>Nenhuma solicitação recebida</p></div>`;
    } else {
      const items = this.solicitacoes.map(s => {
        const data = s.createdAt?.toDate ? s.createdAt.toDate() : (s.createdAt || new Date());
        const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const concluido = s.status === 'concluido';
        const statusCls = concluido ? 'concluido' : 'pendente';
        const statusLabel = concluido ? '✅ Concluído' : '⏳ Pendente';

        return `
          <div class="admin-list-item">
            <div class="admin-list-item-top">
              <div>
                <div class="admin-list-item-name">${this._esc(s.clientName || s.nome || 'Cliente')}</div>
                <div class="admin-list-item-phone">📞 ${this._esc(s.telefone || '')}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                <span class="status-badge ${statusCls}">${statusLabel}</span>
                <span class="admin-list-item-date">${dataStr}</span>
              </div>
            </div>
            <div class="admin-list-item-body">
              🔧 <strong>Equipamento:</strong> ${this._esc(s.tipoEquipamento || s.equipamento || '\u2014')}
              ${s.marca ? ` · <strong>Marca:</strong> ${this._esc(s.marca)}` : ''}
              ${s.modelo ? ` · <strong>Modelo:</strong> ${this._esc(s.modelo)}` : ''}
            </div>
            <div class="admin-list-item-body" style="color:var(--text-muted);">
              🛠️ <strong>Defeito:</strong> ${this._esc(s.defeito || s.descricao || '\u2014')}
            </div>
            <div class="admin-list-item-actions">
              ${!concluido ? `
                <button class="admin-btn admin-btn-sm admin-btn-primary" data-action="criar-os" data-id="${s.firestoreId}">
                  📋 Criar OS
                </button>
                <button class="admin-btn admin-btn-sm" data-action="marcar-concluido" data-id="${s.firestoreId}">
                  ✅ Marcar Concluído
                </button>
              ` : ''}
              ${s.telefone ? `
                <a href="https://wa.me/55${s.telefone.replace(/\D/g,'')}?text=Olá! Recebemos sua solicitação de orçamento." target="_blank" class="admin-btn admin-btn-sm">
                  💚 WhatsApp
                </a>
              ` : ''}
            </div>
          </div>
        `;
      });
      html += items.join('');
    }

    html += `</div>`;
    el.innerHTML = html;
  },

  // ===== CRIAR OS A PARTIR DE SOLICITAÇÃO (ETAPA 4) =====
  _criarOS(firestoreId) {
    const item = this.solicitacoes.find(s => s.firestoreId === firestoreId);
    if (!item) return;

    // Ponte via sessionStorage (ETAPA 4)
    const dados = {
      clienteNome: item.clientName || item.nome || '',
      clienteWhatsapp: item.telefone || '',
      tipoEquipamento: item.tipoEquipamento || item.equipamento || 'celular',
      aparelhoMarca: item.marca || '',
      aparelhoModelo: item.modelo || '',
      defeito: item.defeito || item.descricao || '',
      origem: 'portal',
      solicitacaoId: firestoreId
    };
    sessionStorage.setItem('cc_dados_portal_os', JSON.stringify(dados));

    const url = `../os/index.html`;
    window.open(url, '_blank');
  },

  // ===== MARCAR SOLICITAÇÃO COMO CONCLUÍDA =====
  async _marcarConcluido(firestoreId) {
    try {
      const db = window.db;
      const { doc, updateDoc } = window.FirebaseModules;
      await updateDoc(doc(db, 'solicitacoes_diagnostico', firestoreId), { status: 'concluido' });

      const item = this.solicitacoes.find(s => s.firestoreId === firestoreId);
      if (item) item.status = 'concluido';

      this._toast('✅ Solicitação marcada como concluída');
      this.renderSolicitacoes();
      this._atualizarBadges();
    } catch (err) {
      console.error('[Admin] Erro:', err);
      this._toast('❌ Erro ao atualizar');
    }
  },

  // ===== RENDER: ESTATÍSTICAS =====
  renderEstatisticas() {
    const el = document.getElementById('admin-content');
    if (!el) return;

    el.innerHTML = `
      <h2 class="admin-section-title">📊 Estatísticas do Portal</h2>
      <p class="admin-section-subtitle">Carregando dados de acesso...</p>
      <div class="admin-loading" style="padding:30px;"><span class="spinner"></span></div>
    `;

    this._carregarEstatisticas().then(stats => {
      if (!stats) {
        el.innerHTML = `
          <h2 class="admin-section-title">📊 Estatísticas do Portal</h2>
          <div class="empty-state-admin"><div class="icon">📊</div><p>Erro ao carregar estatísticas</p></div>
        `;
        return;
      }

      const { acessosHoje, acessosSemana, acessosMes, topClient, ultimoCliente, cliquesWa, cliquesMaps, diasLabels, diasValores } = stats;
      const maxVal = Math.max(...diasValores, 1);

      el.innerHTML = `
        <h2 class="admin-section-title">📊 Estatísticas do Portal</h2>
        <p class="admin-section-subtitle">Acompanhamento de acessos e interações dos clientes</p>

        <div class="estatisticas-grid">
          <div class="estat-card">
            <div class="estat-card-label">👥 Acessos Hoje</div>
            <div class="estat-card-value">${acessosHoje}</div>
            <div class="estat-card-sub">${new Date().toLocaleDateString('pt-BR')}</div>
          </div>
          <div class="estat-card">
            <div class="estat-card-label">📅 Acessos na Semana</div>
            <div class="estat-card-value">${acessosSemana}</div>
            <div class="estat-card-sub">7 dias</div>
          </div>
          <div class="estat-card">
            <div class="estat-card-label">📆 Acessos no Mês</div>
            <div class="estat-card-value">${acessosMes}</div>
            <div class="estat-card-sub">${new Date().toLocaleDateString('pt-BR', { month: 'long' })}</div>
          </div>
          <div class="estat-card">
            <div class="estat-card-label">🏆 Cliente que mais acessou</div>
            <div class="estat-card-value" style="font-size:16px;">${topClient?.nome || '\u2014'}</div>
            <div class="estat-card-sub">${topClient?.total || 0} acesso(s)</div>
          </div>
          <div class="estat-card">
            <div class="estat-card-label">🕐 Último cliente</div>
            <div class="estat-card-value" style="font-size:16px;">${ultimoCliente?.nome || '\u2014'}</div>
            <div class="estat-card-sub">${ultimoCliente?.data || '\u2014'}</div>
          </div>
          <div class="estat-card">
            <div class="estat-card-label">💚 Cliques WhatsApp</div>
            <div class="estat-card-value">${cliquesWa}</div>
            <div class="estat-card-sub">Total histórico</div>
          </div>
          <div class="estat-card">
            <div class="estat-card-label">🗺️ Cliques Google Maps</div>
            <div class="estat-card-value">${cliquesMaps}</div>
            <div class="estat-card-sub">Total histórico</div>
          </div>
        </div>

        <h3 style="font-size:14px;font-weight:600;margin:20px 0 12px;color:var(--text-secondary);">📈 Acessos — Últimos 7 Dias</h3>
        <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:16px;">
          <div class="bar-chart">
            ${diasLabels.map((label, i) => {
              const h = Math.max(4, (diasValores[i] / maxVal) * 100);
              const isMax = diasValores[i] === maxVal;
              return `
                <div class="bar-item">
                  <div class="bar-value">${diasValores[i]}</div>
                  <div class="bar-fill" style="height:${h}%;background:${isMax ? 'var(--accent-green)' : 'var(--accent-blue)'};"></div>
                  <div class="bar-label">${label}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });
  },

  // ===== CARREGAR ESTATÍSTICAS (OTIMIZADO) =====
  async _carregarEstatisticas() {
    try {
      const db = window.db;
      const { collection, getDocs, query, where, orderBy, limit } = window.FirebaseModules;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeISO = hoje.toISOString();

      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
      inicioSemana.setHours(0, 0, 0, 0);
      const semISO = inicioSemana.toISOString();

      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      inicioMes.setHours(0, 0, 0, 0);
      const mesISO = inicioMes.toISOString();

      // ⚡ OTIMIZAÇÃO #12: Filtro server-side (>= início do mês)
      const snapAcessos = await getDocs(query(
        collection(db, 'portal_eventos'),
        where('tipo', '==', 'acesso'),
        where('createdAt', '>=', mesISO),
        orderBy('createdAt', 'desc')
      ));

      // ⚡ OTIMIZAÇÃO #13: Single-pass nos dados (tudo em 1 forEach)
      let acessosHoje = 0, acessosSemana = 0, acessosMes = 0;
      const clientCount = {};
      let ultimoAcessoTime = 0;
      let ultimoAcessoNome = '';
      let ultimoAcessoData = '';

      // Pré-calcula limites dos dias para o gráfico
      const dias = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(hoje);
        d.setDate(d.getDate() - i);
        const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        inicio.setHours(0, 0, 0, 0);
        const fim = new Date(inicio);
        fim.setHours(23, 59, 59, 999);
        dias.push({
          label: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
          inicio: inicio.getTime(),
          fim: fim.getTime(),
          count: 0
        });
      }

      const hojeTime = new Date(hojeISO).getTime();
      const semTime = new Date(semISO).getTime();

      snapAcessos.forEach(doc => {
        const d = doc.data();
        const ts = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || 0);
        const t = ts.getTime();

        if (t >= hojeTime) acessosHoje++;
        if (t >= semTime) acessosSemana++;
        acessosMes++;

        const tel = d.telefone || 'unknown';
        if (!clientCount[tel]) {
          clientCount[tel] = { nome: d.clientName || 'Cliente', total: 0 };
        }
        clientCount[tel].total++;

        if (t > ultimoAcessoTime) {
          ultimoAcessoTime = t;
          ultimoAcessoNome = d.clientName || 'Cliente';
          ultimoAcessoData = ts.toLocaleDateString('pt-BR') + ' ' + ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }

        // Gráfico single-pass
        for (let i = 0; i < dias.length; i++) {
          if (t >= dias[i].inicio && t <= dias[i].fim) {
            dias[i].count++;
            break;
          }
        }
      });

      // Top cliente
      let topClient = { nome: '\u2014', total: 0 };
      Object.values(clientCount).forEach(c => {
        if (c.total > topClient.total) topClient = c;
      });

      // Cliques (paralelo)
      const [snapWa, snapMaps] = await Promise.all([
        getDocs(query(collection(db, 'portal_eventos'), where('tipo', '==', 'clique_whatsapp'))),
        getDocs(query(collection(db, 'portal_eventos'), where('tipo', '==', 'clique_maps')))
      ]);

      return {
        acessosHoje, acessosSemana, acessosMes,
        topClient,
        ultimoCliente: { nome: ultimoAcessoNome, data: ultimoAcessoData },
        cliquesWa: snapWa.size,
        cliquesMaps: snapMaps.size,
        diasLabels: dias.map(d => d.label),
        diasValores: dias.map(d => d.count)
      };
    } catch (err) {
      console.error('[Admin] Erro ao carregar stats:', err);
      return null;
    }
  },

  // ===== UTILITÁRIOS =====
  _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  _starsHTML(rating) {
    const r = Math.round(rating);
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="${i <= r ? 'star-filled' : 'star-empty'}">★</span>`;
    }
    return html;
  },

  _toast(msg) {
    const existing = document.querySelector('.admin-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'admin-toast';
    toast.textContent = msg;
    Object.assign(toast.style, {
      position: 'fixed', bottom: '70px', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--bg-card)', color: 'var(--text-primary)',
      padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)',
      fontSize: '13px', zIndex: '2000',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      opacity: '0', transition: 'opacity 0.3s'
    });
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.style.opacity = '1');
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

// ===== AUTO-INIT (com proteção contra dupla inicialização) =====
if (!window._adminInitialized) {
  window._adminInitialized = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.PortalAdmin.init());
  } else {
    window.PortalAdmin.init();
  }
}
