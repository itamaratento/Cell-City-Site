/* ============================================
   Portal do Cliente — Cell City Informática
   Módulo SPA do CRM
   ============================================ */

// ===== CONSTANTES =====
const STATUS_LABEL = {
  'em_analise':           { label: 'Em Análise',           cor: '#FFA726', icon: '🟡' },
  'aguardando_peca':      { label: 'Aguardando Peça',      cor: '#42A5F5', icon: '🔵' },
  'em_reparo':            { label: 'Em Manutenção',        cor: '#FF6D00', icon: '🟠' },
  'orcamento':            { label: 'Orçamento',            cor: '#EF5350', icon: '📋' },
  'pronto':               { label: 'Pronto para Retirada', cor: '#00C853', icon: '🟢' },
  'entregue':             { label: 'Entregue',             cor: '#78909C', icon: '✅' },
  'devolvido_orcamento':  { label: 'Não Aprovado',         cor: '#8D6E63', icon: '❌' },
  'garantia_em_atendimento': { label: 'Garantia em Atendimento', cor: '#D32F2F', icon: '🔴' }
};

const PRAZO_GARANTIA_DIAS = 90; // 3 meses padrão

// ===== OBJETO PRINCIPAL =====
window.Portal = {
  // ---- Estado da Sessão ----
  session: null,       // { telefone, clientName, osCount, ... }
  currentOS: [],       // OS do cliente logado
  currentMsgs: [],     // Mensagens do cliente
  currentAval: null,   // Avaliação existente (se houver)
  unsubscribeOS: null, // Listener em tempo real das OS
  unsubscribeMsgs: null, // Listener em tempo real das mensagens

  // ===== INIT =====
  async init() {
    console.log('[Portal] init() chamado, authReady:', window.authReady);
    console.log('[Portal] db:', typeof window.db, 'FirebaseModules:', typeof window.FirebaseModules);

    // Aguarda Firebase estar pronto (com timeout de segurança)
    if (window.authReady) {
      console.log('[Portal] authReady = true, chamando _boot() direto');
      await this._boot();
    } else {
      console.log('[Portal] authReady = false, aguardando firebase-ready (timeout 12s)');
      // Timeout: se o Firebase não ficar pronto em 12s, inicia mesmo assim
      const timeout = setTimeout(() => {
        console.warn('[Portal] ***** TIMEOUT 12s ***** Firebase não ficou pronto — iniciando com timeout');
        this._boot();
      }, 12000);

      window.addEventListener('firebase-ready', () => {
        console.log('[Portal] Evento firebase-ready recebido!');
        clearTimeout(timeout);
        this._boot();
      });
    }
  },

  async _boot() {
    console.log('[Portal] _boot() chamado');
    console.log('[Portal] location.hash:', location.hash);
    console.log('[Portal] sessionStorage.portal_session:', sessionStorage.getItem('portal_session'));

    // Tenta restaurar sessão
    const saved = sessionStorage.getItem('portal_session');
    if (saved) {
      try {
        this.session = JSON.parse(saved);
        console.log('[Portal] Sessão restaurada:', this.session);
      } catch {
        console.warn('[Portal] Erro ao fazer parse da sessão');
        this.session = null;
      }
    } else {
      console.log('[Portal] Nenhuma sessão salva');
    }

    // Escuta hash
    window.addEventListener('hashchange', () => this._handleRoute());

    // Rota inicial
    console.log('[Portal] Chamando _handleRoute()');
    this._handleRoute();
  },

  // ===== ROTEAMENTO =====
  _handleRoute() {
    // Normaliza a hash: remove o "#" inicial E a "/" inicial
    // Ex: "#/login" → hashRaw = "/login" → hash = "login" → route = "login" ✓
    // Ex: "#/os/OS-0001" → hashRaw = "/os/OS-0001" → hash = "os/OS-0001" → parts = ["os","OS-0001"] → route = "os" ✓
    const hashRaw = location.hash.slice(1);                 // remove "#"
    const hash = hashRaw.replace(/^\//, '') || 'login';     // remove "/" inicial, default "login"
    const parts = hash.split('/');
    const route = parts[0];
    console.log('[Portal] _handleRoute() hashRaw:', hashRaw, 'hash:', hash, 'route:', route);

    // Rotas que não precisam de sessão
    if (route === 'login') {
      console.log('[Portal] Rota = login, chamando renderLogin()');
      this.renderLogin();
      return;
    }

    // Verifica sessão
    if (!this.session) {
      location.hash = '#/login';
      return;
    }

    // Mostra header/footer e WhatsApp
    document.getElementById('app-header').style.display = '';
    document.getElementById('app-footer').style.display = '';
    const waBtn = document.getElementById('whatsapp-float');
    if (waBtn) waBtn.style.display = '';

    // Navega
    switch (route) {
      case 'painel':      this.renderPainel(); break;
      case 'os':          this.renderOSList(); break;
      case 'os-detalhe':  this.renderOSDetalhe(parts[1]); break;
      case 'garantias':   this.renderGarantias(); break;
      case 'avaliar':     this.renderAvaliar(); break;
      case 'mensagens':   this.renderMensagens(); break;
      case 'contato':     this.renderContato(); break;
      default:            location.hash = '#/painel';
    }
    // Marca o link ativo (exceto login e os-detalhe)
    if (route !== 'login' && route !== 'os-detalhe') {
      this._setActiveNav(route);
    }
  },

  navegar(hash) {
    location.hash = '#' + hash;
  },

  // ===== LOGIN =====
  renderLogin() {
    console.log('[Portal] renderLogin() chamado');
    const hdr = document.getElementById('app-header');
    const ftr = document.getElementById('app-footer');
    const waBtn = document.getElementById('whatsapp-float');
    if (hdr) hdr.style.display = 'none';
    if (ftr) ftr.style.display = 'none';
    if (waBtn) waBtn.style.display = 'none';
    console.log('[Portal] Header/Footer/WhatsApp ocultados');

    const el = document.getElementById('app-content');
    if (!el) {
      console.error('[Portal] ERRO: #app-content não encontrado no DOM!');
      return;
    }
    console.log('[Portal] Substituindo innerHTML de #app-content');
    el.innerHTML = `
      <div class="login-container">
        <div class="login-logo">🔷</div>
        <h1 class="login-title">Portal do Cliente</h1>
        <p class="login-sub">Cell City Informática</p>
        <div class="login-card">
          <div class="login-form-group">
            <label class="login-label">📱 Seu telefone</label>
            <input type="tel" id="login-phone" class="login-input"
                   placeholder="(11) 99999-9999" maxlength="15"
                   inputmode="numeric" autocomplete="tel">
            <span class="login-hint">Digite o número cadastrado em seu serviço</span>
            <span class="login-error" id="login-error"></span>
          </div>
          <button id="btn-login" class="login-btn" onclick="Portal.doLogin()">
            Entrar
          </button>
          <button id="btn-login-loading" class="login-btn" style="display:none" disabled>
            <span class="spinner"></span> Verificando...
          </button>
        </div>
        <p class="login-footer-text">
          Já fez um serviço conosco?<br>
          <strong>Seu telefone já está cadastrado.</strong>
        </p>
        <div class="login-consulta-publica" onclick="window.open('https://cellcity.com.br/consultar-os.html','_blank')">
          🔍 Consultar OS (público)
        </div>
      </div>
    `;
    console.log('[Portal] Login renderizado. Verificando se #login-phone existe:', !!document.getElementById('login-phone'));

    // Máscara de telefone
    const input = document.getElementById('login-phone');
    input.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 7) {
        v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
      } else if (v.length > 2) {
        v = `(${v.slice(0,2)}) ${v.slice(2)}`;
      } else if (v.length > 0) {
        v = `(${v}`;
      }
      e.target.value = v;
      document.getElementById('login-error').textContent = '';
    });

    // Enter para logar
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.doLogin();
    });

    setTimeout(() => input.focus(), 300);
  },

  async doLogin() {
    const input = document.getElementById('login-phone');
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');
    const loading = document.getElementById('btn-login-loading');

    // Normaliza o telefone: extrai apenas dígitos
    const raw = input.value.replace(/\D/g, '');

    if (raw.length < 10 || raw.length > 11) {
      errorEl.textContent = '📞 Digite um telefone válido com DDD';
      input.focus();
      return;
    }

    // Mostra loading
    btn.style.display = 'none';
    loading.style.display = '';
    errorEl.textContent = '';

    try {
      const db = window.db;
      const { collection, query, where, getDocs } = window.FirebaseModules;

      // ===== NORMALIZAÇÃO DO TELEFONE =====
      // A tela de OS (os.js) armazena o telefone COM formatação (ex: "(62) 98160-5863")
      // O Portal usava raw (ex: "62981605863") e nunca encontrava correspondência.
      // Agora formatamos no MESMO padrão da tela de OS para garantir a busca.
      const formatPhone = (digits) => {
        if (digits.length === 11)
          return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
        if (digits.length === 10)
          return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
        return digits;
      };
      const formatted = formatPhone(raw);

      console.log('[Portal] Buscando cliente — raw:', raw, 'formatted:', formatted);

      // Busca em clientes (usa o formato com máscara, igual ao banco)
      let clientName = '';
      const qClientes = query(collection(db, 'clientes'), where('phone', '==', formatted));
      const snapClientes = await getDocs(qClientes);
      if (!snapClientes.empty) {
        const cl = snapClientes.docs[0].data();
        clientName = cl.name || '';
        console.log('[Portal] Cliente encontrado:', clientName);
      } else {
        console.log('[Portal] Cliente não encontrado com phone formatado, tentando raw...');
        // Fallback: tenta com dígitos puros (dados antigos ou alternativos)
        const qFallback = query(collection(db, 'clientes'), where('phone', '==', raw));
        const snapFallback = await getDocs(qFallback);
        if (!snapFallback.empty) {
          const cl = snapFallback.docs[0].data();
          clientName = cl.name || '';
          console.log('[Portal] Cliente encontrado via fallback (raw):', clientName);
        }
      }

      // Busca OS do cliente (usa o formato com máscara)
      let qOS = query(collection(db, 'os'), where('phone', '==', formatted));
      let snapOS = await getDocs(qOS);
      let osCount = snapOS.size;
      console.log('[Portal] OSs encontradas com formatted:', osCount);

      // Fallback: se não achou com formato, tenta com dígitos puros
      if (osCount === 0) {
        console.log('[Portal] Nenhuma OS com formatted, tentando raw...');
        qOS = query(collection(db, 'os'), where('phone', '==', raw));
        snapOS = await getDocs(qOS);
        osCount = snapOS.size;
        console.log('[Portal] OSs encontradas com raw:', osCount);
      }

      if (osCount === 0 && !clientName) {
        btn.style.display = '';
        loading.style.display = 'none';
        errorEl.textContent = '❌ Nenhum serviço encontrado com este telefone.';
        console.log('[Portal] Nenhum resultado para o telefone:', formatted);
        return;
      }

      // Cria sessão
      this.session = {
        telefone: formatted,
        clientName: clientName || `Cliente`,
        osCount
      };
      sessionStorage.setItem('portal_session', JSON.stringify(this.session));
      console.log('[Portal] Sessão criada:', this.session);

      // Escuta OS em tempo real
      this._listenOS();
      this._listenMensagens();

      // Vai para o painel
      location.hash = '#/painel';
    } catch (err) {
      console.error('[Portal] Erro no login:', err);
      btn.style.display = '';
      loading.style.display = 'none';
      errorEl.textContent = '❌ Erro ao conectar. Tente novamente.';
    }
  },

  // ===== LISTENERS EM TEMPO REAL =====
  _listenOS() {
    if (this.unsubscribeOS) this.unsubscribeOS();
    const db = window.db;
    const { collection, query, where, onSnapshot } = window.FirebaseModules;
    const q = query(collection(db, 'os'), where('phone', '==', this.session.telefone));
    this.unsubscribeOS = onSnapshot(q, (snap) => {
      this.currentOS = [];
      snap.forEach(d => this.currentOS.push({ firestoreId: d.id, ...d.data() }));
      this.currentOS.sort((a, b) => {
        const da = a.createdAt || a.updatedAt || '';
        const db_ = b.createdAt || b.updatedAt || '';
        return db_ > da ? 1 : -1;
      });
      // Se estiver em tela que mostra OS, atualiza
      const route = location.hash.slice(1).split('/')[0];
      if (route === 'os') this.renderOSList();
      else if (route === 'os-detalhe') {
        const id = location.hash.split('/')[1];
        if (id) this.renderOSDetalhe(id);
      }
      else if (route === 'painel') this.renderPainel();
    }, (err) => console.warn('[Portal] Erro listener OS:', err));
  },

  _listenMensagens() {
    if (this.unsubscribeMsgs) this.unsubscribeMsgs();
    const db = window.db;
    const { collection, query, where, onSnapshot, orderBy } = window.FirebaseModules;
    const q = query(
      collection(db, 'mensagens_portal'),
      where('telefone', '==', this.session.telefone),
      orderBy('createdAt', 'desc')
    );
    this.unsubscribeMsgs = onSnapshot(q, (snap) => {
      this.currentMsgs = [];
      snap.forEach(d => this.currentMsgs.push({ id: d.id, ...d.data() }));
      const route = location.hash.slice(1);
      if (route === 'mensagens') this.renderMensagens();
    }, (err) => console.warn('[Portal] Erro listener msgs:', err));
  },

  // ===== PAINEL PRINCIPAL =====
  renderPainel() {
    const el = document.getElementById('app-content');
    document.getElementById('btn-back').style.display = 'none';
    // Marca o link ativo no menu inferior
    this._setActiveNav('painel');

    const s = this.session;
    const os = this.currentOS;
    const activeOS = os.filter(o => o.status !== 'entregue' && o.status !== 'devolvido_orcamento' && o.status !== 'orcamento_recusado');
    const warranties = os.filter(o => this._emGarantia(o));
    const msgsNaoLidas = (this.currentMsgs || []).filter(m => !m.lida);

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
          <div class="greeting-avatar">👤</div>
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
          <div class="painel-aviso">
            ⚡ Você tem <strong>${activeOS.length}</strong> serviço(s) em andamento
          </div>
        ` : `
          <div class="painel-aviso" style="background:rgba(0,200,83,0.08);border-color:rgba(0,200,83,0.2);">
            ✅ Nenhum serviço em andamento no momento
          </div>
        `}

        <!-- GRID DE NAVEGAÇÃO -->
        <div class="painel-grid">
          <div class="painel-card" onclick="Portal.navegar('os')">
            <div class="painel-card-icon">📋</div>
            <div class="painel-card-title">Minhas OS</div>
            <div class="painel-card-sub">${os.length} registro(s)</div>
          </div>
          <div class="painel-card" onclick="Portal.navegar('garantias')">
            <div class="painel-card-icon">🛡️</div>
            <div class="painel-card-title">Garantias</div>
            <div class="painel-card-sub">${warranties.length} ativa(s)</div>
          </div>
          <div class="painel-card" onclick="Portal.navegar('avaliar')">
            <div class="painel-card-icon">⭐</div>
            <div class="painel-card-title">Avaliar</div>
            <div class="painel-card-sub">Seu feedback</div>
          </div>
          <div class="painel-card" onclick="Portal.navegar('mensagens')">
            <div class="painel-card-icon">💬</div>
            <div class="painel-card-title">Mensagens</div>
            <div class="painel-card-sub">${msgsNaoLidas.length > 0 ? `${msgsNaoLidas.length} pendente(s)` : 'Fale conosco'}</div>
          </div>
          <div class="painel-card" onclick="Portal.navegar('contato')">
            <div class="painel-card-icon">📍</div>
            <div class="painel-card-title">Contato</div>
            <div class="painel-card-sub">WhatsApp & Endereço</div>
          </div>
        </div>
      </div>
    `;
  },

  // ===== BUSCAR ÚLTIMA AVALIAÇÃO =====
  async _buscarUltimaAvaliacao() {
    try {
      const db = window.db;
      const { collection, query, where, getDocs, orderBy, limit } = window.FirebaseModules;
      const q = query(
        collection(db, 'avaliacoes'),
        where('telefone', '==', this.session.telefone),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data();
      }
    } catch (e) {
      // Se não tiver índice, tenta sem orderBy
      try {
        const db = window.db;
        const { collection, query, where, getDocs } = window.FirebaseModules;
        const q = query(collection(db, 'avaliacoes'), where('telefone', '==', this.session.telefone));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docs = [];
          snap.forEach(d => docs.push(d.data()));
          docs.sort((a, b) => (b.createdAt || '').toString().localeCompare((a.createdAt || '').toString()));
          return docs[0];
        }
      } catch (e2) { /* ignora */ }
    }
    return null;
  },

  // ===== LISTA DE OS =====
  renderOSList() {
    const el = document.getElementById('app-content');
    document.getElementById('btn-back').style.display = '';

    const os = this.currentOS;
    if (os.length === 0) {
      el.innerHTML = `
        <div class="os-container">
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <h3>Nenhuma OS encontrada</h3>
            <p>Você ainda não possui ordens de serviço registradas.</p>
            <button class="login-btn" onclick="Portal.navegar('painel')">Voltar</button>
          </div>
        </div>
      `;
      return;
    }

    let html = `<div class="os-container"><h2 class="screen-title">📋 Minhas Ordens de Serviço</h2><div class="os-list">`;
    os.forEach(o => {
      const st = STATUS_LABEL[o.status] || { label: o.status, cor: '#999' };
      const date = this._fmtDate(o.createdAt || o.updatedAt);
      const progress = this._statusProgress(o.status);
      html += `
        <div class="os-card" onclick="Portal.navegar('os-detalhe/${o.id}')">
          <div class="os-card-top">
            <span class="os-card-id">#${this._esc(o.id || '')}</span>
            <span class="os-card-status" style="background:${st.cor}20;color:${st.cor};border:1px solid ${st.cor}40">
              ${st.icon} ${st.label}
            </span>
          </div>
          <div class="os-card-model">📱 ${this._esc(o.model || '')}</div>
          <div class="os-card-defect">🔧 ${this._esc(o.defect || '')}</div>
          <div class="os-card-date">📅 ${date}</div>
          <div class="os-progress-bar">
            <div class="os-progress-fill" style="width:${progress.percent}%;background:${st.cor};"></div>
          </div>
          <div class="os-progress-label" style="color:${st.cor};">${progress.label}</div>
        </div>
      `;
    });
    html += `</div></div>`;
    el.innerHTML = html;
  },

  // ===== STATUS PROGRESS =====
  _statusProgress(status) {
    const ORDER = [
      'em_analise',
      'aguardando_peca',
      'orcamento',
      'em_reparo',
      'pronto',
      'entregue'
    ];
    const LABELS = [
      'Recebida',
      'Aguardando Peça',
      'Orçamento',
      'Em Reparo',
      'Pronta',
      'Concluída'
    ];
    const idx = ORDER.indexOf(status);
    if (idx === -1) return { percent: 0, label: status || '—' };
    const pct = Math.round((idx / (ORDER.length - 1)) * 100);
    return { percent: pct, label: `${idx + 1}/${ORDER.length} — ${LABELS[idx]}` };
  },

  // ===== DETALHE DA OS =====
  renderOSDetalhe(osId) {
    const el = document.getElementById('app-content');
    document.getElementById('btn-back').style.display = '';
    const o = this.currentOS.find(x => x.id === osId);
    if (!o) {
      el.innerHTML = `<div class="os-container"><div class="empty-state"><p>OS não encontrada</p><button class="login-btn" onclick="Portal.navegar('os')">Voltar</button></div></div>`;
      return;
    }

    const st = STATUS_LABEL[o.status] || { label: o.status, cor: '#999', icon: '❓' };
    const date = this._fmtDate(o.createdAt);
    const updated = this._fmtDate(o.updatedAt);
    const timeline = Array.isArray(o.timeline) ? o.timeline : [];
    const progress = this._statusProgress(o.status);

    // Verifica se está em garantia
    const emGarantia = this._emGarantia(o);
    const diasGarantia = emGarantia ? this._diasRestantesGarantia(o) : 0;

    let html = `
      <div class="os-container">
        <div class="os-detail">
          <div class="os-detail-header">
            <h2 class="os-detail-title">OS #${this._esc(o.id || '')}</h2>
          </div>

          <!-- STATUS VISUAL EM DESTAQUE -->
          <div class="os-status-visual" style="background:${st.cor}15;border:2px solid ${st.cor}40;">
            <div class="os-status-icon">${st.icon}</div>
            <div class="os-status-text">
              <span class="os-status-label" style="color:${st.cor};">${st.label}</span>
              <span class="os-status-sub">${this._esc(o.model || '')}</span>
            </div>
          </div>

          <!-- BARRA DE PROGRESSO DO STATUS -->
          <div class="os-progress-section">
            <div class="os-progress-steps">
              ${this._statusStepsHTML(o.status)}
            </div>
            <div class="os-progress-bar" style="margin-top:8px;">
              <div class="os-progress-fill" style="width:${progress.percent}%;background:${st.cor};"></div>
            </div>
            <div class="os-progress-label" style="color:${st.cor};text-align:center;margin-top:4px;">${progress.label}</div>
          </div>

          ${emGarantia ? `
          <div class="os-garantia-ativa">
            <span class="os-garantia-icon">🛡️</span>
            <span class="os-garantia-text">Este serviço está em garantia • ${diasGarantia} dia(s) restante(s)</span>
          </div>
          ` : ''}

          <div class="os-detail-section">
            <div class="os-detail-row"><span class="os-detail-label">📱 Modelo</span><span class="os-detail-value">${this._esc(o.model || '')}</span></div>
            <div class="os-detail-row"><span class="os-detail-label">🔧 Defeito</span><span class="os-detail-value">${this._esc(o.defect || '')}</span></div>
            ${o.observations ? `<div class="os-detail-row"><span class="os-detail-label">📝 Obs</span><span class="os-detail-value">${this._esc(o.observations)}</span></div>` : ''}
            <div class="os-detail-row"><span class="os-detail-label">📅 Abertura</span><span class="os-detail-value">${date}</span></div>
            <div class="os-detail-row"><span class="os-detail-label">🔄 Atualização</span><span class="os-detail-value">${updated}</span></div>
            ${o.valor ? `<div class="os-detail-row"><span class="os-detail-label">💰 Valor</span><span class="os-detail-value">R$ ${Number(o.valor).toFixed(2)}</span></div>` : ''}
          </div>
    `;

    // Card de orçamento (se status for orcamento)
    if (o.status === 'orcamento') {
      html += `
        <div class="orcamento-card">
          <div class="orcamento-title">💰 Orçamento Pendente</div>
          <p>Seu aparelho está com o orçamento pronto. Deseja autorizar o reparo?</p>
          ${o.valor ? `<div class="orcamento-valor">Valor: <strong>R$ ${Number(o.valor).toFixed(2)}</strong></div>` : ''}
          <div class="orcamento-actions">
            <button class="orcamento-btn aprovar" onclick="Portal.aprovarOrcamento('${osId}')">✅ Aprovar</button>
            <button class="orcamento-btn recusar" onclick="Portal.recusarOrcamento('${osId}')">❌ Recusar</button>
          </div>
          <p class="orcamento-obs">Após aprovação, entraremos em contato para informar o prazo.</p>
        </div>
      `;
    }

    // Timeline
    if (timeline.length > 0) {
      html += `<div class="os-detail-section"><h3 class="os-detail-section-title">📜 Histórico</h3><div class="timeline">`;
      timeline.forEach(t => {
        const d = this._fmtDateTime(t.date);
        html += `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-text">${this._esc(t.text || '')}</div>
              <div class="timeline-date">${d}</div>
            </div>
          </div>
        `;
      });
      html += `</div></div>`;
    }

    html += `</div></div>`;
    el.innerHTML = html;
  },

  // ===== ORÇAMENTO =====
  async aprovarOrcamento(osId) {
    if (!confirm('Confirmar aprovação do orçamento?')) return;
    try {
      const db = window.db;
      const { doc, updateDoc, serverTimestamp, arrayUnion } = window.FirebaseModules;
      const ref = doc(db, 'os', osId);
      await updateDoc(ref, {
        status: 'em_reparo',
        updatedAt: serverTimestamp(),
        timeline: arrayUnion({
          date: new Date().toISOString(),
          text: 'Orçamento aprovado pelo cliente (Portal)'
        })
      });
      this._toast('✅ Orçamento aprovado! Entraremos em contato.');
    } catch (err) {
      console.error('[Portal] Erro ao aprovar:', err);
      this._toast('❌ Erro ao aprovar. Tente novamente.');
    }
  },

  async recusarOrcamento(osId) {
    const motivo = prompt('Conte-nos o motivo (opcional):');
    try {
      const db = window.db;
      const { doc, updateDoc, serverTimestamp, arrayUnion } = window.FirebaseModules;
      const ref = doc(db, 'os', osId);
      await updateDoc(ref, {
        status: 'devolvido_orcamento',
        updatedAt: serverTimestamp(),
        timeline: arrayUnion({
          date: new Date().toISOString(),
          text: `Orçamento recusado pelo cliente (Portal)${motivo ? ': ' + motivo : ''}`
        })
      });
      this._toast('✅ Orçamento recusado. Seu aparelho será devolvido.');
    } catch (err) {
      console.error('[Portal] Erro ao recusar:', err);
      this._toast('❌ Erro ao recusar. Tente novamente.');
    }
  },

  // ===== GARANTIAS =====
  _emGarantia(os) {
    const dd = this._getDeliveryDate(os);
    if (!dd) return false;
    const prazo = os.prazoGarantia || PRAZO_GARANTIA_DIAS;
    const limite = new Date(dd);
    limite.setDate(limite.getDate() + prazo);
    return new Date() <= limite;
  },

  _diasRestantesGarantia(os) {
    const dd = this._getDeliveryDate(os);
    if (!dd) return 0;
    const prazo = os.prazoGarantia || PRAZO_GARANTIA_DIAS;
    const limite = new Date(dd);
    limite.setDate(limite.getDate() + prazo);
    return Math.ceil((limite - new Date()) / 86400000);
  },

  _getDeliveryDate(os) {
    if (Array.isArray(os.timeline)) {
      const entry = [...os.timeline].reverse().find(t => t.text && t.text.includes('Entregue'));
      if (entry?.date) return new Date(entry.date);
    }
    if (os.updatedAt) {
      const ua = os.updatedAt;
      if (typeof ua === 'string') return new Date(ua);
      if (ua.toDate) return ua.toDate();
    }
    return null;
  },

  renderGarantias() {
    const el = document.getElementById('app-content');
    document.getElementById('btn-back').style.display = '';

    const warranties = this.currentOS.filter(o =>
      this._emGarantia(o)
    );
    const expiringSoon = warranties.filter(o => this._diasRestantesGarantia(o) <= 15);
    const expired = this.currentOS.filter(o =>
      !this._emGarantia(o) && this._getDeliveryDate(o)
    );

    let html = `<div class="garantias-container"><h2 class="screen-title">🛡️ Minhas Garantias</h2>`;

    if (warranties.length === 0 && expired.length === 0) {
      html += `<div class="empty-state"><div class="empty-icon">🛡️</div><p>Nenhum serviço com garantia encontrado.</p><button class="login-btn" onclick="Portal.navegar('painel')">Voltar</button></div></div>`;
      el.innerHTML = html;
      return;
    }

    // Garantias ativas
    if (warranties.length > 0) {
      html += `<h3 class="garantias-subtitle">🟢 Garantias Válidas (${warranties.length})</h3>`;
      warranties.forEach(o => {
        const dias = this._diasRestantesGarantia(o);
        const dd = this._getDeliveryDate(o);
        const prazo = o.prazoGarantia || PRAZO_GARANTIA_DIAS;
        const dataFim = new Date(dd);
        dataFim.setDate(dataFim.getDate() + prazo);
        const dataFimStr = dataFim.toLocaleDateString('pt-BR');

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
              <span>📅 Garantia até: <strong>${dataFimStr}</strong></span>
              <span class="garantia-card-id">OS #${this._esc(o.id || '')}</span>
            </div>
          </div>
        `;
      });
    }

    // Vencidas
    if (expired.length > 0) {
      html += `<h3 class="garantias-subtitle" style="color:#78909C;">⌛ Garantias Expiradas (${expired.length})</h3>`;
      expired.slice(0, 5).forEach(o => {
        const dd = this._getDeliveryDate(o);
        const prazo = o.prazoGarantia || PRAZO_GARANTIA_DIAS;
        const dataFim = new Date(dd);
        dataFim.setDate(dataFim.getDate() + prazo);
        const dataFimStr = dataFim.toLocaleDateString('pt-BR');

        html += `
          <div class="garantia-card" style="border-left: 4px solid #78909C;opacity:0.7;">
            <div class="garantia-card-top">
              <span class="garantia-card-model">📱 ${this._esc(o.model || '')}</span>
              <span class="garantia-card-status-badge" style="background:#78909C20;color:#78909C;border:1px solid #78909C40;">
                🔴 Expirada
              </span>
            </div>
            <div class="garantia-card-info">
              <span>📅 Vencida em: <strong>${dataFimStr}</strong></span>
              <span class="garantia-card-id">OS #${this._esc(o.id || '')}</span>
            </div>
          </div>
        `;
      });
    }

    html += `</div>`;
    el.innerHTML = html;
  },

  // ===== AVALIAR =====
  renderAvaliar() {
    const el = document.getElementById('app-content');
    document.getElementById('btn-back').style.display = '';

    const entregues = this.currentOS.filter(o => o.status === 'entregue');
    const temEntregue = entregues.length > 0;

    if (!temEntregue) {
      el.innerHTML = `
        <div class="avaliar-container">
          <div class="empty-state">
            <div class="empty-icon">⭐</div>
            <h3>Nenhum serviço concluído</h3>
            <p>Você poderá avaliar após a conclusão de um serviço.</p>
            <button class="login-btn" onclick="Portal.navegar('painel')">Voltar</button>
          </div>
        </div>
      `;
      return;
    }

    let html = `
      <div class="avaliar-container">
        <h2 class="screen-title">⭐ Avaliar Atendimento</h2>
        <p class="avaliar-subtitle">Sua opinião é muito importante para nós!</p>

        <div class="avaliar-stars" id="avaliar-stars">
          ${[1,2,3,4,5].map(i => `<span class="star" data-val="${i}" onclick="Portal.setRating(${i})">☆</span>`).join('')}
        </div>
        <div class="avaliar-nota" id="avaliar-nota">Toque em uma estrela</div>

        <div id="avaliar-feedback" style="display:none;">
          <textarea id="avaliar-texto" class="avaliar-textarea" placeholder="Conte-nos sobre sua experiência (opcional)..." rows="3"></textarea>
          <button id="btn-avaliar" class="login-btn" onclick="Portal.enviarAvaliacao()">Enviar Avaliação</button>
          <button id="btn-avaliar-loading" class="login-btn" style="display:none" disabled><span class="spinner"></span> Enviando...</button>
        </div>

        <div id="avaliar-google" style="display:none;" class="avaliar-google-box">
          <p class="avaliar-google-text">💚 Seu feedback foi registrado! Que tal nos avaliar no Google?</p>
          <a href="https://search.google.com/local/writereview?placeid=SEU_PLACE_ID_AQUI" target="_blank" class="avaliar-google-btn">
            <span class="google-icon">G</span> Avaliar no Google
          </a>
          <p class="avaliar-google-obs">Você nos ajuda a crescer! 🙏</p>
        </div>
      </div>
    `;
    el.innerHTML = html;

    // Verifica se já avaliou
    this._checkAvaliacaoExistente();
  },

  _ratingSelected: 0,

  setRating(val) {
    this._ratingSelected = val;
    const stars = document.querySelectorAll('.star');
    stars.forEach((s, i) => {
      s.textContent = i < val ? '★' : '☆';
      s.style.color = i < val ? '#FFD700' : '#555';
    });
    document.getElementById('avaliar-nota').textContent =
      ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'][val];

    // Mostra feedback para 1-3, Google para 4-5
    if (val <= 3) {
      document.getElementById('avaliar-feedback').style.display = '';
      document.getElementById('avaliar-google').style.display = 'none';
    } else {
      document.getElementById('avaliar-feedback').style.display = 'none';
      document.getElementById('avaliar-google').style.display = '';
      // Já salva avaliação no Firestore
      this._salvarAvaliacao(val, '');
    }
  },

  async _checkAvaliacaoExistente() {
    try {
      const db = window.db;
      const { collection, query, where, getDocs } = window.FirebaseModules;
      const q = query(collection(db, 'avaliacoes'), where('telefone', '==', this.session.telefone));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const av = snap.docs[0].data();
        this.currentAval = av;
        document.querySelectorAll('.star').forEach((s, i) => {
          if (i < av.nota) { s.textContent = '★'; s.style.color = '#FFD700'; }
        });
        document.getElementById('avaliar-nota').textContent = `Você já nos avaliou com ${av.nota} ★`;
        document.getElementById('avaliar-feedback').style.display = 'none';

        if (av.nota >= 4) {
          document.getElementById('avaliar-google').style.display = '';
        }
      }
    } catch (e) { /* ignora */ }
  },

  async enviarAvaliacao() {
    const val = this._ratingSelected;
    if (val < 1 || val > 3) return;
    const texto = document.getElementById('avaliar-texto').value.trim();

    document.getElementById('btn-avaliar').style.display = 'none';
    document.getElementById('btn-avaliar-loading').style.display = '';

    await this._salvarAvaliacao(val, texto);

    document.getElementById('btn-avaliar-loading').style.display = 'none';
    document.getElementById('avaliar-feedback').style.display = 'none';
    document.getElementById('avaliar-nota').textContent = '✅ Obrigado pelo seu feedback!';
    this._toast('✅ Feedback enviado com sucesso!');
  },

  async _salvarAvaliacao(nota, texto) {
    try {
      const db = window.db;
      const { collection, addDoc, serverTimestamp } = window.FirebaseModules;
      await addDoc(collection(db, 'avaliacoes'), {
        telefone: this.session.telefone,
        clientName: this.session.clientName,
        nota,
        texto,
        origem: 'portal',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('[Portal] Erro ao salvar avaliação:', err);
      this._toast('❌ Erro ao salvar. Tente novamente.');
    }
  },

  // ===== MENSAGENS =====
  renderMensagens() {
    const el = document.getElementById('app-content');
    document.getElementById('btn-back').style.display = '';

    const msgs = this.currentMsgs || [];

    let html = `
      <div class="msg-container">
        <h2 class="screen-title">💬 Fale com a Cell City</h2>

        <div class="msg-form">
          <div class="msg-form-group">
            <label class="msg-label">Nome</label>
            <input type="text" id="msg-nome" class="msg-input"
                   value="${this._esc(this.session.clientName)}" placeholder="Seu nome">
          </div>
          <div class="msg-form-group">
            <label class="msg-label">Mensagem</label>
            <textarea id="msg-texto" class="msg-input msg-textarea"
                      placeholder="Digite sua mensagem..." rows="4"></textarea>
          </div>
          <div class="msg-error" id="msg-error"></div>
          <button id="btn-msg" class="login-btn" onclick="Portal.enviarMensagem()">📤 Enviar Mensagem</button>
          <button id="btn-msg-loading" class="login-btn" style="display:none" disabled>
            <span class="spinner"></span> Enviando...
          </button>
        </div>

        <div class="msg-history">
          <h3 class="msg-history-title">📜 Histórico de Mensagens</h3>
    `;

    if (msgs.length === 0) {
      html += `<div class="msg-empty">Nenhuma mensagem enviada ainda.</div>`;
    } else {
      msgs.forEach(m => {
        const d = this._fmtDateTime(m.createdAt);
        const lida = m.lida ? 'msg-lida' : '';
        html += `
          <div class="msg-item ${lida}">
            <div class="msg-item-header">
              <span class="msg-item-name">${this._esc(m.nome || m.clientName || 'Você')}</span>
              <span class="msg-item-date">${d}</span>
            </div>
            <div class="msg-item-text">${this._esc(m.texto || m.mensagem || '')}</div>
            ${m.resposta ? `
              <div class="msg-item-resposta">
                <div class="msg-resposta-header">📨 Resposta da Cell City</div>
                <div class="msg-resposta-text">${this._esc(m.resposta)}</div>
                <div class="msg-item-date">${this._fmtDateTime(m.respostaAt || m.respostaEm)}</div>
              </div>
            ` : ''}
            ${!m.lida && !m.resposta ? `<div class="msg-aguardando">⏳ Aguardando resposta...</div>` : ''}
          </div>
        `;
      });
    }

    if (msgs.length > 10) {
      html += `<div class="msg-archive-link" onclick="alert('Em breve: histórico completo.')">📚 Ver todas as mensagens</div>`;
    }

    html += `</div></div>`;
    el.innerHTML = html;
  },

  async enviarMensagem() {
    const nome = document.getElementById('msg-nome').value.trim();
    const texto = document.getElementById('msg-texto').value.trim();
    const errorEl = document.getElementById('msg-error');

    if (!nome) { errorEl.textContent = '📝 Digite seu nome'; return; }
    if (!texto) { errorEl.textContent = '💬 Digite sua mensagem'; return; }
    if (texto.length < 3) { errorEl.textContent = '📝 A mensagem deve ter pelo menos 3 caracteres'; return; }

    errorEl.textContent = '';
    document.getElementById('btn-msg').style.display = 'none';
    document.getElementById('btn-msg-loading').style.display = '';

    try {
      const db = window.db;
      const { collection, addDoc, serverTimestamp } = window.FirebaseModules;
      await addDoc(collection(db, 'mensagens_portal'), {
        telefone: this.session.telefone,
        clientName: this.session.clientName,
        nome,
        texto,
        lida: false,
        origem: 'portal',
        createdAt: serverTimestamp()
      });
      document.getElementById('msg-texto').value = '';
      this._toast('✅ Mensagem enviada com sucesso!');
    } catch (err) {
      console.error('[Portal] Erro ao enviar mensagem:', err);
      errorEl.textContent = '❌ Erro ao enviar. Tente novamente.';
    }
    document.getElementById('btn-msg').style.display = '';
    document.getElementById('btn-msg-loading').style.display = 'none';
  },

  // ===== CONTATO =====
  renderContato() {
    const el = document.getElementById('app-content');
    document.getElementById('btn-back').style.display = '';

    el.innerHTML = `
      <div class="contato-container">
        <h2 class="screen-title">📍 Fale Conosco</h2>

        <a href="https://wa.me/5511949464940?text=Olá!%20Vim%20pelo%20Portal%20do%20Cliente" target="_blank" class="contato-card whatsapp-card">
          <div class="contato-card-icon">💚</div>
          <div class="contato-card-info">
            <div class="contato-card-title">WhatsApp</div>
            <div class="contato-card-text">(11) 94946-4940</div>
          </div>
          <div class="contato-card-arrow">→</div>
        </a>

        <a href="tel:+5511949464940" class="contato-card phone-card">
          <div class="contato-card-icon">📞</div>
          <div class="contato-card-info">
            <div class="contato-card-title">Telefone</div>
            <div class="contato-card-text">(11) 94946-4940</div>
          </div>
          <div class="contato-card-arrow">→</div>
        </a>

        <div class="contato-card address-card">
          <div class="contato-card-icon">📍</div>
          <div class="contato-card-info">
            <div class="contato-card-title">Endereço</div>
            <div class="contato-card-text">Rua Cel. José Eusébio, 39 — sala 1</div>
            <div class="contato-card-text">Tatuapé, São Paulo — SP</div>
          </div>
        </div>

        <div class="contato-card hours-card">
          <div class="contato-card-icon">🕐</div>
          <div class="contato-card-info">
            <div class="contato-card-title">Horários</div>
            <div class="contato-card-text">Seg–Sex: 09:00–19:00</div>
            <div class="contato-card-text">Sáb: 09:00–14:00</div>
          </div>
        </div>

        <a href="https://www.google.com/maps/place/Rua+Cel.+Jos%C3%A9+Eus%C3%A9bio,+39+%E2%80%94+sala+1,+Tatuap%C3%A9,+S%C3%A3o+Paulo+%E2%80%94+SP" target="_blank" class="contato-card map-card">
          <div class="contato-card-icon">🗺️</div>
          <div class="contato-card-info">
            <div class="contato-card-title">Ver no mapa</div>
            <div class="contato-card-text">Google Maps</div>
          </div>
          <div class="contato-card-arrow">→</div>
        </a>
      </div>
    `;
  },

  // ===== LOGOUT =====
  logout() {
    if (!confirm('Deseja sair do Portal do Cliente?')) return;
    if (this.unsubscribeOS) this.unsubscribeOS();
    if (this.unsubscribeMsgs) this.unsubscribeMsgs();
    this.session = null;
    this.currentOS = [];
    this.currentMsgs = [];
    sessionStorage.removeItem('portal_session');
    location.hash = '#/login';
  },

  // ===== UTILITÁRIOS =====
  _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  _fmtDate(iso) {
    if (!iso) return '—';
    try {
      const d = typeof iso === 'string' ? new Date(iso) : (iso.toDate ? iso.toDate() : new Date(iso));
      return d.toLocaleDateString('pt-BR');
    } catch { return '—'; }
  },

  _fmtDateTime(iso) {
    if (!iso) return '—';
    try {
      const d = typeof iso === 'string' ? new Date(iso) : (iso.toDate ? iso.toDate() : new Date(iso));
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  },

  _toast(msg) {
    const existing = document.querySelector('.portal-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'portal-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // ===== NAVEGAÇÃO INFERIOR =====
  _setActiveNav(route) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const active = document.querySelector(`.nav-item[data-route="${route}"]`);
    if (active) active.classList.add('active');
  },

  // ===== STATUS STEPS HTML =====
  _statusStepsHTML(status) {
    const ORDER = [
      'em_analise',
      'aguardando_peca',
      'orcamento',
      'em_reparo',
      'pronto',
      'entregue'
    ];
    const LABELS = ['📥', '🔧', '📋', '🛠️', '✅', '🎉'];
    const idx = ORDER.indexOf(status);
    if (idx === -1) return '';
    let html = '';
    ORDER.forEach((s, i) => {
      const done = i <= idx;
      const isCurrent = i === idx;
      html += `
        <div class="os-step ${done ? 'done' : ''} ${isCurrent ? 'current' : ''}">
          <div class="os-step-dot">${done ? (isCurrent ? LABELS[i] : '✓') : '○'}</div>
        </div>
      `;
    });
    return html;
  }
};

// ===== AUTO-INIT =====
document.addEventListener('DOMContentLoaded', () => window.Portal.init());
