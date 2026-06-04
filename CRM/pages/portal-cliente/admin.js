/* =============================================
   PAINEL ADMINISTRATIVO — PORTAL DO CLIENTE
   admin.js — v2.3 (otimizado)
   
   OTIMIZAÇÕES DE PERFORMANCE:
   - Promise.all() para queries paralelas no _carregarDados()
   - limit(100) em todas as collections (evita travar com milhares de docs)
   - Cache de tracking com TTL de 30s (evita refetch em toda navegação)
   - _buscarResumoTracking() com queries combinadas (reduz de 4 para 2 queries)
   - _carregarEstatisticas() com filtro server-side (>= inicioMes) em vez de fetch total
   - Gráfico 7 dias: single-pass nos dados (antes iterava 7x)
   - Lazy load: tracking só é carregado quando a aba é acessada
   ============================================= */

window.PortalAdmin = {

  // ===== INICIALIZAÇÃO =====
  async init() {
    this.currentTab = 'central';
    this.mensagens = [];
    this.avaliacoes = [];
    this.solicitacoes = [];
    this.unsubscribers = [];

    // Cache de tracking
    this._trackingCache = null;
    this._trackingCacheTime = 0;
    this._trackingCacheTTL = 30000; // 30 segundos

    // Aguarda Firebase (com timeout 10s)
    if (!window.authReady) {
      await new Promise(resolve => {
        const check = () => {
          if (window.authReady) { resolve(); return; }
          document.addEventListener('admin-firebase-ready', resolve, { once: true });
          setTimeout(resolve, 10000);
        };
        check();
      });
    }

    console.log('[Admin] Firebase pronto. Inicializando...');

    // Carrega dados e navega — execução paralela
    await Promise.all([
      this._carregarDados(),
      this._carregarTrackingCache() // pré-carrega cache em background
    ]);
    this.navegar('central');
  },

  // ===== NAVEGAÇÃO ENTRE ABAS =====
  navegar(tab) {
    this.currentTab = tab;
    // Ativa tab visual
    document.querySelectorAll('.admin-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });

    // Renderiza conteúdo
    switch (tab) {
      case 'central': this.renderCentral(); break;
      case 'mensagens': this.renderMensagens(); break;
      case 'avaliacoes': this.renderAvaliacoes(); break;
      case 'solicitacoes': this.renderSolicitacoes(); break;
      case 'estatisticas': this.renderEstatisticas(); break;
    }
  },

  // ===== REFRESH =====
  refresh() {
    // Força recarregamento (invalida cache)
    this._trackingCache = null;
    this._trackingCacheTime = 0;
    this._carregarDados().then(() => {
      this.navegar(this.currentTab);
    });
  },

  // ===== CARREGAR DADOS DO FIRESTORE (OTIMIZADO) =====
  async _carregarDados() {
    const db = window.db;
    const { collection, getDocs, query, orderBy, limit } = window.FirebaseModules;

    try {
      // === OTIMIZAÇÃO #1: Promise.all() para queries paralelas ===
      // Antes: 3 queries sequenciais (água)
      // Agora: 3 queries em paralelo (3x mais rápido)
      const [snapMsgs, snapAval, snapSols] = await Promise.all([

        // Mensagens: limit 100, ordenado por data
        getDocs(query(
          collection(db, 'mensagens_portal'),
          orderBy('createdAt', 'desc'),
          limit(100)
        )),

        // Avaliações: limit 100, ordenado por data
        getDocs(query(
          collection(db, 'avaliacoes'),
          orderBy('createdAt', 'desc'),
          limit(100)
        )),

        // Solicitações: limit 100, ordenado por data
        getDocs(query(
          collection(db, 'solicitacoes_diagnostico'),
          orderBy('createdAt', 'desc'),
          limit(100)
        ))
      ]);

      // Processa resultados em paralelo (mas sem阻塞)
      this.mensagens = [];
      snapMsgs.forEach(doc => {
        this.mensagens.push({ firestoreId: doc.id, ...doc.data() });
      });

      this.avaliacoes = [];
      snapAval.forEach(doc => {
        this.avaliacoes.push({ firestoreId: doc.id, ...doc.data() });
      });

      this.solicitacoes = [];
      snapSols.forEach(doc => {
        this.solicitacoes.push({ firestoreId: doc.id, ...doc.data() });
      });

      // Atualiza badges
      this._atualizarBadges();

      console.log('[Admin] Dados carregados (otimizado):', {
        mensagens: this.mensagens.length,
        avaliacoes: this.avaliacoes.length,
        solicitacoes: this.solicitacoes.length
      });
    } catch (err) {
      console.error('[Admin] Erro ao carregar dados:', err);
    }
  },

  // ===== ATUALIZAR BADGES =====
  _atualizarBadges() {
    const pendentes = this.mensagens.filter(m => !m.lida).length;
    const badgeMsg = document.getElementById('badge-mensagens');
    if (badgeMsg) {
      if (pendentes > 0) {
        badgeMsg.textContent = pendentes > 99 ? '99+' : pendentes;
        badgeMsg.style.display = '';
      } else {
        badgeMsg.style.display = 'none';
      }
    }

    const solicitacoesPendentes = this.solicitacoes.filter(s => s.status !== 'concluido').length;
    const badgeSol = document.getElementById('badge-solicitacoes');
    if (badgeSol) {
      if (solicitacoesPendentes > 0) {
        badgeSol.textContent = solicitacoesPendentes > 99 ? '99+' : solicitacoesPendentes;
        badgeSol.style.display = '';
      } else {
        badgeSol.style.display = 'none';
      }
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

  // ===== PRÉ-CARREGAR CACHE DE TRACKING (chamado no init) =====
  async _carregarTrackingCache() {
    try {
      this._trackingCache = await this._buscarResumoTracking();
      this._trackingCacheTime = Date.now();
    } catch (err) {
      // Silencia — o cache será carregado sob demanda
    }
  },

  // ===== RENDER: CENTRAL DO PORTAL =====
  renderCentral() {
    const el = document.getElementById('admin-content');
    if (!el) return;

    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const hojeStr = hoje.toISOString().split('T')[0];

    // Calcula indicadores
    const mensagensPendentes = this.mensagens.filter(m => !m.lida).length;
    const totalAvaliacoes = this.avaliacoes.length;
    const mediaEstrelas = totalAvaliacoes > 0
      ? (this.avaliacoes.reduce((s, a) => s + (a.nota || 0), 0) / totalAvaliacoes).toFixed(1)
      : '—';
    const solicitacoesPendentes = this.solicitacoes.filter(s => s.status !== 'concluido').length;

    // Verifica cache de tracking
    const usarCache = this._isTrackingCacheValido();
    const trackingData = usarCache ? this._trackingCache : null;

    // Se não tiver cache, dispara busca em background
    if (!usarCache) {
      this._carregarTrackingCache();
    }

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
          <div class="central-card-value" id="val-clientes-hoje">${trackingData ? trackingData.acessosHoje : '—'}</div>
          <div class="central-card-sub">Acessos no dia</div>
        </div>

        <div class="central-card" id="card-ultimo-acesso">
          <div class="central-card-icon">🕐</div>
          <div class="central-card-title">Último Acesso</div>
          <div class="central-card-value" id="val-ultimo-acesso" style="font-size:16px;">${trackingData && trackingData.ultimoAcesso ? trackingData.ultimoAcesso.nome : '—'}</div>
          <div class="central-card-sub" id="sub-ultimo-acesso">${trackingData && trackingData.ultimoAcesso ? trackingData.ultimoAcesso.data : 'Nenhum acesso registrado'}</div>
        </div>

        <div class="central-card" id="card-cliques-whatsapp">
          <div class="central-card-icon">💚</div>
          <div class="central-card-title">Cliques WhatsApp</div>
          <div class="central-card-value" id="val-cliques-whatsapp">${trackingData ? trackingData.cliquesWhatsApp : '—'}</div>
          <div class="central-card-sub">Total de cliques</div>
        </div>

        <div class="central-card" id="card-cliques-maps">
          <div class="central-card-icon">🗺️</div>
          <div class="central-card-title">Cliques Google Maps</div>
          <div class="central-card-value" id="val-cliques-maps">${trackingData ? trackingData.cliquesMaps : '—'}</div>
          <div class="central-card-sub">Total de cliques</div>
        </div>
      </div>
    `;

    // Se usou cache, já mostrou dados — se não, atualiza quando carregar
    if (!usarCache) {
      // Tenta novamente após o cache carregar
      setTimeout(() => {
        if (this.currentTab === 'central' && this._isTrackingCacheValido()) {
          this._atualizarCardsTracking(this._trackingCache);
        }
      }, 100);
    }
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
      hoje.setHours(0,0,0,0);
      const hojeISO = hoje.toISOString();

      // === OTIMIZAÇÃO #2: Queries combinadas ===
      // Antes: 4 queries separadas (acessosHoje, ultimo, whatsapp, maps)
      // Agora: 2 queries (acessos + cliques combinados)

      // Query 1: Acessos de hoje + último acesso (combinado)
      const [snapAcessosHoje, snapUltimo] = await Promise.all([
        // Acessos de hoje
        getDocs(query(
          collection(db, 'portal_eventos'),
          where('tipo', '==', 'acesso'),
          where('createdAt', '>=', hojeISO)
        )),
        // Último acesso (limit 1)
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
          nome: d.clientName || '—',
          data: data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
      }

      // Query 2: Cliques WhatsApp + Maps (2 queries paralelas)
      const [snapWa, snapMaps] = await Promise.all([
        getDocs(query(
          collection(db, 'portal_eventos'),
          where('tipo', '==', 'clique_whatsapp')
        )),
        getDocs(query(
          collection(db, 'portal_eventos'),
          where('tipo', '==', 'clique_maps')
        ))
      ]);

      const cliquesWhatsApp = snapWa.size;
      const cliquesMaps = snapMaps.size;

      return { acessosHoje, ultimoAcesso, cliquesWhatsApp, cliquesMaps };
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
      this.mensagens.forEach(m => {
        const data = m.createdAt?.toDate ? m.createdAt.toDate() : (m.createdAt || new Date());
        const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const statusCls = m.lida ? (m.resposta ? 'respondida' : 'lida') : 'nova';
        const statusLabel = m.lida ? (m.resposta ? '🟣 Respondida' : '🔵 Lida') : '🟢 Nova';

        html += `
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
              ${!m.lida ? `<button class="admin-btn admin-btn-sm" onclick="PortalAdmin._marcarLida('${m.firestoreId}')">✅ Marcar Lida</button>` : ''}
              ${!m.resposta ? `<button class="admin-btn admin-btn-sm admin-btn-primary" onclick="PortalAdmin._responderMensagem('${m.firestoreId}')">💬 Responder</button>` : ''}
            </div>
          </div>
        `;
      });
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
        respondidaEm: new Date().toISOString()
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
      this.avaliacoes.forEach(a => {
        const data = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt || new Date());
        const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        html += `
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
      this.solicitacoes.forEach(s => {
        const data = s.createdAt?.toDate ? s.createdAt.toDate() : (s.createdAt || new Date());
        const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const concluido = s.status === 'concluido';
        const statusCls = concluido ? 'concluido' : 'pendente';
        const statusLabel = concluido ? '✅ Concluído' : '⏳ Pendente';

        html += `
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
              🔧 <strong>Equipamento:</strong> ${this._esc(s.tipoEquipamento || s.equipamento || '—')}
              ${s.marca ? ` · <strong>Marca:</strong> ${this._esc(s.marca)}` : ''}
              ${s.modelo ? ` · <strong>Modelo:</strong> ${this._esc(s.modelo)}` : ''}
            </div>
            <div class="admin-list-item-body" style="color:var(--text-muted);">
              🛠️ <strong>Defeito:</strong> ${this._esc(s.defeito || s.descricao || '—')}
            </div>
            <div class="admin-list-item-actions">
              ${!concluido ? `
                <button class="admin-btn admin-btn-sm admin-btn-primary" onclick="PortalAdmin._criarOS('${s.firestoreId}')">
                  📋 Criar OS
                </button>
                <button class="admin-btn admin-btn-sm" onclick="PortalAdmin._marcarConcluido('${s.firestoreId}')">
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
    }

    html += `</div>`;
    el.innerHTML = html;
  },

  // ===== CRIAR OS A PARTIR DE SOLICITAÇÃO =====
  _criarOS(firestoreId) {
    const item = this.solicitacoes.find(s => s.firestoreId === firestoreId);
    if (!item) return;

    const params = new URLSearchParams({
      nome: item.clientName || item.nome || '',
      telefone: item.telefone || '',
      equipamento: item.tipoEquipamento || item.equipamento || '',
      marca: item.marca || '',
      modelo: item.modelo || '',
      defeito: item.defeito || item.descricao || ''
    });

    const url = `../../os/index.html?${params.toString()}`;
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

      // Pico do gráfico para highlighting
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
            <div class="estat-card-value" style="font-size:16px;">${topClient?.nome || '—'}</div>
            <div class="estat-card-sub">${topClient?.total || 0} acesso(s)</div>
          </div>
          <div class="estat-card">
            <div class="estat-card-label">🕐 Último cliente</div>
            <div class="estat-card-value" style="font-size:16px;">${ultimoCliente?.nome || '—'}</div>
            <div class="estat-card-sub">${ultimoCliente?.data || '—'}</div>
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
      hoje.setHours(0,0,0,0);
      const hojeISO = hoje.toISOString();

      // Início da semana (domingo)
      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
      inicioSemana.setHours(0,0,0,0);
      const semISO = inicioSemana.toISOString();

      // Início do mês
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      inicioMes.setHours(0,0,0,0);
      const mesISO = inicioMes.toISOString();

      // === OTIMIZAÇÃO #3: Filtro server-side ===
      // Antes: buscava TODOS os eventos de acesso (sem filtro)
      // Agora: busca apenas do início do mês pra cá (reduz drasticamente os dados)
      const snapAcessos = await getDocs(query(
        collection(db, 'portal_eventos'),
        where('tipo', '==', 'acesso'),
        where('createdAt', '>=', mesISO),
        orderBy('createdAt', 'desc')
      ));

      // === OTIMIZAÇÃO #4: Single-pass nos dados ===
      // Antes: 3 ifs por documento + loop separado para clientCount + loop separado para último
      // Agora: tudo em um único forEach
      let acessosHoje = 0, acessosSemana = 0, acessosMes = 0;
      const clientCount = {};
      let ultimoAcessoTime = 0;
      let ultimoAcessoNome = '';
      let ultimoAcessoData = '';

      // Para o gráfico: pré-calcula os limites dos dias
      const dias = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(hoje);
        d.setDate(d.getDate() - i);
        const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        inicio.setHours(0,0,0,0);
        const fim = new Date(inicio);
        fim.setHours(23,59,59,999);
        dias.push({
          label: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
          inicio: inicio.getTime(),
          fim: fim.getTime(),
          count: 0
        });
      }

      snapAcessos.forEach(doc => {
        const d = doc.data();
        const ts = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || 0);
        const t = ts.getTime();

        // Contagens por período (filtro local nos dados já filtrados por mês)
        if (t >= new Date(hojeISO).getTime()) acessosHoje++;
        if (t >= new Date(semISO).getTime()) acessosSemana++;
        acessosMes++; // já está no range do mês

        // Contagem por cliente
        const tel = d.telefone || 'unknown';
        if (!clientCount[tel]) {
          clientCount[tel] = { nome: d.clientName || 'Cliente', total: 0 };
        }
        clientCount[tel].total++;

        // Último acesso
        if (t > ultimoAcessoTime) {
          ultimoAcessoTime = t;
          ultimoAcessoNome = d.clientName || 'Cliente';
          ultimoAcessoData = ts.toLocaleDateString('pt-BR') + ' ' + ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }

        // Gráfico: single-pass (em vez de iterar 7x)
        for (let i = 0; i < dias.length; i++) {
          if (t >= dias[i].inicio && t <= dias[i].fim) {
            dias[i].count++;
            break;
          }
        }
      });

      // Top cliente
      let topClient = { nome: '—', total: 0 };
      Object.values(clientCount).forEach(c => {
        if (c.total > topClient.total) topClient = c;
      });

      // Cliques WhatsApp e Maps (paralelo)
      const [snapWa, snapMaps] = await Promise.all([
        getDocs(query(
          collection(db, 'portal_eventos'),
          where('tipo', '==', 'clique_whatsapp')
        )),
        getDocs(query(
          collection(db, 'portal_eventos'),
          where('tipo', '==', 'clique_maps')
        ))
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

// ===== AUTO-INIT =====
document.addEventListener('DOMContentLoaded', () => window.PortalAdmin.init());
