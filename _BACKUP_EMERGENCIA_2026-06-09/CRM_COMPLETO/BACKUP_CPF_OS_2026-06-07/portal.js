/* ============================================
   Portal do Cliente — Cell City Informática
   Módulo SPA do CRM
   ============================================ */

// ===== CONSTANTES =====
const STATUS_LABEL = {
  // ===== Fluxo oficial (8 etapas) =====
  'recebido':             { label: 'Recebido',             cor: '#42A5F5', icon: '📥' },
  'em_analise':           { label: 'Em Análise',           cor: '#42A5F5', icon: '🔍' },
  'orcamento_enviado':    { label: 'Orçamento Enviado',    cor: '#FFA726', icon: '📋' },
  'orcamento_aprovado':   { label: 'Orçamento Aprovado',   cor: '#66BB6A', icon: '👍' },
  'orcamento_recusado':   { label: 'Orçamento Recusado',   cor: '#EF5350', icon: '❌' },
  'em_reparo':            { label: 'Em Reparo',            cor: '#FF6D00', icon: '🛠️' },
  'testes_finais':        { label: 'Testes Finais',        cor: '#a78bfa', icon: '🧪' },
  'concluido':            { label: 'Concluído',            cor: '#00C853', icon: '✅' },
  'entregue':             { label: 'Entregue',             cor: '#78909C', icon: '🎉' },
  // ===== Compatibilidade com OS antigas =====
  'aguardando_peca':      { label: 'Aguardando Peça',      cor: '#42A5F5', icon: '🔵' },
  'orcamento':            { label: 'Orçamento Enviado',    cor: '#FFA726', icon: '📋' },
  'pronto':               { label: 'Concluído',            cor: '#00C853', icon: '✅' },
  'aguardando_aprovacao': { label: 'Orçamento Enviado',    cor: '#FFA726', icon: '📋' },
  'aprovado':             { label: 'Orçamento Aprovado',   cor: '#66BB6A', icon: '👍' },
  'devolvido_orcamento':  { label: 'Não Aprovado',         cor: '#8D6E63', icon: '❌' },
  'garantia_em_atendimento': { label: 'Garantia em Atendimento', cor: '#D32F2F', icon: '🔴' }
};

const PRAZO_GARANTIA_DIAS = 90; // 3 meses padrão

// ===== DADOS DA LOJA (fallback) =====
// Fonte primária: documento `config/impressao`.loja no Firestore (mesma config usada
// na impressão de OS). Este objeto é só o fallback, com os dados REAIS da loja —
// nada de endereço/telefone fictício hardcoded espalhado pelas telas.
const LOJA_DEFAULT = {
  nome: 'Cell City Informática',
  endereco: 'Rua 6, nº 455 — Setor Central, Goiânia — GO, CEP 74023-030',
  whatsapp: '(62) 98160-5863',
  horarios: 'Seg–Sex: 08:00–18:00 • Sáb: 08:00–14:00',
  mapsUrl: 'https://www.google.com/maps/dir//Cell+City+%E2%80%93+Conserto+de+Celular,+Notebook+e+Impressora,+R.+6,+455+-+St.+Central,+Goi%C3%A2nia+-+GO,+74023-030/',
  googlePlaceId: ''
};

// ===== OBJETO PRINCIPAL =====
window.Portal = {
  // ---- Estado da Sessão ----
  session: null,       // { telefone, clientName, osCount, ... }
  loja: { ...LOJA_DEFAULT }, // dados da loja (carregados do Firestore em _boot)
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

    try {
      // Carrega os dados reais da loja do Firestore (config/impressao.loja)
      await this._loadLoja();
    } catch (err) {
      console.warn('[Portal] Erro ao carregar dados da loja, usando padrão:', err);
      this.loja = null;
    }

    console.log('[Portal] location.hash:', location.hash);
    console.log('[Portal] sessionStorage.portal_session:', sessionStorage.getItem('portal_session'));

    // Tenta restaurar sessão
    const saved = sessionStorage.getItem('portal_session');
    if (saved) {
      try {
        this.session = JSON.parse(saved);
        console.log('[Portal] Sessão restaurada:', JSON.stringify(this.session));
        console.log('[AUDIT:BOOT] telefone da sessão restaurada:', JSON.stringify(this.session?.telefone));

        // Inicia listeners em tempo real para a sessão restaurada
        console.log('[AUDIT:BOOT] Iniciando _listenOS() e _listenMensagens() para sessão restaurada');
        this._listenOS();
        this._listenMensagens();
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
    try {
      console.log('[Portal] Chamando _handleRoute()');
      this._handleRoute();
    } catch (err) {
      console.error('[Portal] Erro no boot ao chamar _handleRoute():', err);
      const el = document.getElementById('app-content');
      if (el) {
        el.innerHTML = `<div class="login-container"><div class="login-logo">🔷</div><h1 class="login-title">Portal do Cliente</h1><p style="color:#EF5350;">❌ Erro ao iniciar. <button class="login-btn" onclick="location.reload()">Recarregar</button></p></div>`;
      }
    }
  },

  // ===== ROTEAMENTO =====
  _handleRoute() {
    try {
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

      // Mostra footer e WhatsApp (header global permanece sempre visível)
      const footer = document.getElementById('app-footer');
      if (footer) footer.style.display = '';
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
        case 'como-chegar': this.renderComoChegar(); break;
        default:            location.hash = '#/painel';
      }
      // Marca o link ativo (exceto login, os-detalhe)
      const navRoute = route === 'como-chegar' ? 'painel' : route;
      if (navRoute !== 'login' && navRoute !== 'os-detalhe') {
        this._setActiveNav(navRoute);
      }
    } catch (err) {
      console.error('[Portal] Erro no roteamento:', err);
      const el = document.getElementById('app-content');
      if (el) {
        el.innerHTML = `<div class="login-container"><div style="text-align:center;padding:40px 20px;"><span style="font-size:48px;">⚠️</span><h3>Ops! Algo deu errado.</h3><p style="color:#666;margin:12px 0;">Ocorreu um erro inesperado. Tente novamente.</p><button class="login-btn" onclick="location.reload()">🔄 Recarregar</button></div></div>`;
      }
    }
  },

  navegar(hash) {
    location.hash = '#' + hash;
  },

  // ===== DADOS DA LOJA =====
  async _loadLoja() {
    try {
      const db = window.db;
      const { doc, getDoc } = window.FirebaseModules;
      if (db && getDoc) {
        const snap = await getDoc(doc(db, 'config', 'impressao'));
        if (snap.exists()) {
          const data = snap.data();
          // Mescla com o default para preencher campos que a config não tem (maps/horários).
          this.loja = { ...LOJA_DEFAULT, ...(data.loja || {}) };
          // Carrega modelos de garantia para exibição no Portal
          this.garantias = Array.isArray(data.garantias) ? data.garantias : [];
        }
      }
    } catch (e) {
      console.warn('[Portal] Não foi possível carregar config da loja, usando padrão:', e);
    }
    // Atualiza o botão flutuante de WhatsApp (estático no index.html) com o número real.
    const waBtn = document.getElementById('whatsapp-float');
    if (waBtn) waBtn.href = this._waLink('Olá! Vim pelo Portal do Cliente');
    return this.loja;
  },

  // Extrai só os dígitos do WhatsApp e garante o DDI 55 (Brasil) para links wa.me.
  _waDigits() {
    let d = (this.loja.whatsapp || '').replace(/\D/g, '');
    if (d && !d.startsWith('55')) d = '55' + d;
    return d;
  },

  _waLink(text) {
    const d = this._waDigits();
    const q = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${d}${q}`;
  },

  // ===== TELEFONE — VARIANTES DE FORMATO =====
  // CAUSA-RAIZ (ETAPA 1 — Item 2): o login canonicaliza o telefone para a máscara
  // "(NN) NNNNN-NNNN" e salva esse único formato na sessão. Mas as OS no Firestore
  // podem estar gravadas em OUTROS formatos (dígitos puros "NNNNNNNNNNN", máscara de
  // 10 dígitos, ou com/sem o 9º dígito). O login tinha fallback p/ dígitos puros, mas
  // os listeners em tempo real (_listenOS/_listenMensagens) consultavam só a máscara →
  // retornavam 0 docs. Casos reais: Mauricio MID e Maria Cuba (OS gravadas como dígitos puros).
  //
  // Solução mínima e robusta: gerar TODOS os formatos plausíveis a partir dos dígitos e
  // consultar com where('phone','in', variantes). Cobre máscara-11, raw-11, máscara-10,
  // raw-10 e a divergência clássica do 9º dígito. Firestore aceita até 30 valores no 'in'.
  _phoneMask(dg) {
    if (dg.length === 11) return `(${dg.slice(0,2)}) ${dg.slice(2,7)}-${dg.slice(7)}`;
    if (dg.length === 10) return `(${dg.slice(0,2)}) ${dg.slice(2,6)}-${dg.slice(6)}`;
    return dg;
  },

  _phoneVariants(input) {
    const dg = String(input == null ? '' : input).replace(/\D/g, '');
    const variants = new Set();
    const pushAll = (d) => {
      if (!d || d.length < 10) return;
      variants.add(d);                 // dígitos puros (raw)
      variants.add(this._phoneMask(d)); // com máscara
    };
    pushAll(dg);
    // Divergência do 9º dígito (celulares BR): gera a forma alternativa
    if (dg.length === 11 && dg[2] === '9') {
      pushAll(dg.slice(0, 2) + dg.slice(3)); // remove o 9 → 10 dígitos
    } else if (dg.length === 10) {
      pushAll(dg.slice(0, 2) + '9' + dg.slice(2)); // insere o 9 → 11 dígitos
    }
    return [...variants];
  },

  // ===== LOGIN =====
  renderLogin() {
    console.log('[Portal] renderLogin() chamado');
    const ftr = document.getElementById('app-footer');
    const waBtn = document.getElementById('whatsapp-float');
    if (ftr) ftr.style.display = 'none';
    if (waBtn) waBtn.style.display = 'none';
    console.log('[Portal] Footer/WhatsApp ocultados (header global permanece visível)');

    const el = document.getElementById('app-content');
    if (!el) {
      console.error('[Portal] ERRO: #app-content não encontrado no DOM!');
      return;
    }
    console.log('[Portal] Substituindo innerHTML de #app-content');
    el.innerHTML = `
      <div class="login-container">
        <!-- Card central -->
        <div class="login-card">
          <h1>Portal do Cliente</h1>
          <p>Acesse sua área exclusiva utilizando seu telefone</p>
          <div class="login-form-box">
            <div class="login-form-group">
              <input type="tel" id="login-phone" class="login-input"
                     placeholder="Telefone" maxlength="15"
                     inputmode="numeric" autocomplete="tel">
              <span class="login-error" id="login-error"></span>
            </div>
            <button id="btn-login" class="login-btn" onclick="Portal.doLogin()">
              Entrar
            </button>
            <button id="btn-login-loading" class="login-btn" style="display:none" disabled>
              <span class="spinner"></span> Verificando...
            </button>
          </div>
        </div>
      </div>
    `;
    console.log('[Portal] Login renderizado. Verificando se #login-phone existe:', !!document.getElementById('login-phone'));

    // Máscara de telefone
    const input = document.getElementById('login-phone');
    if (!input) {
      console.error('[Portal] ERRO: #login-phone não encontrado após render!');
      return;
    }
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
      // A tela de OS (os.js) armazena o telefone em formatos divergentes: máscara
      // "(62) 98160-5863" OU dígitos puros "62981605863". Geramos TODAS as variantes
      // plausíveis e consultamos com where('phone','in', variantes) — isso garante que
      // login, listeners e garantias usem exatamente o mesmo critério de busca.
      const formatted = this._phoneMask(raw); // formato canônico (exibição na sessão)
      const variants = this._phoneVariants(raw);

      console.log('[Portal] Buscando cliente — raw:', raw, 'formatted:', formatted, 'variants:', JSON.stringify(variants));

      // Busca em clientes (todas as variantes de formato)
      let clientName = '';
      const qClientes = query(collection(db, 'clientes'), where('phone', 'in', variants));
      const snapClientes = await getDocs(qClientes);
      if (!snapClientes.empty) {
        const cl = snapClientes.docs[0].data();
        clientName = cl.name || '';
        console.log('[Portal] Cliente encontrado:', clientName, '| phone:', JSON.stringify(cl.phone));
      } else {
        console.log('[Portal] Cliente não encontrado em nenhuma variante de formato.');
      }

      // Busca OS do cliente (todas as variantes de formato)
      const qOS = query(collection(db, 'os'), where('phone', 'in', variants));
      const snapOS = await getDocs(qOS);
      const osCount = snapOS.size;
      console.log('[Portal] OSs encontradas (in variantes):', osCount);
      snapOS.forEach(d => {
        const data = d.data();
        console.log('[AUDIT:OS] ID:', d.id, '| phone:', JSON.stringify(data.phone), '| status:', data.status, '| model:', data.model);
      });

      if (osCount === 0 && !clientName) {
        btn.style.display = '';
        loading.style.display = 'none';
        errorEl.textContent = '❌ Nenhum serviço encontrado com este telefone.';
        console.log('[Portal] Nenhum resultado para o telefone:', formatted);
        return;
      }

      // Cria sessão
      // telefone     = formato canônico (máscara) usado para EXIBIÇÃO e para gravar
      //                mensagens/avaliações/eventos (dados criados pelo próprio Portal).
      // telefoneVariants = todos os formatos plausíveis, usados nas CONSULTAS de OS
      //                (os.js grava em formatos divergentes — ver _phoneVariants).
      this.session = {
        telefone: formatted,
        telefoneVariants: variants,
        clientName: clientName || `Cliente`,
        osCount
      };
      sessionStorage.setItem('portal_session', JSON.stringify(this.session));
      console.log('[Portal] Sessão criada:', JSON.stringify(this.session));
      console.log('[AUDIT:SESSION] telefone salvo na sessão:', JSON.stringify(this.session.telefone));
      console.log('[AUDIT:SESSION] osCount do login (getDocs):', osCount);

      // Tracking de acesso (ETAPA 3)
      this._registrarEvento('acesso', {
        telefone: this.session.telefone,
        clientName: this.session.clientName
      });

      // Escuta OS em tempo real
      this._listenOS();
      this._listenMensagens();

      // Vai para o painel
      location.hash = '#painel';
    } catch (err) {
      console.error('[Portal] Erro no login:', err);
      btn.style.display = '';
      loading.style.display = 'none';
      errorEl.textContent = '❌ Erro ao conectar. Tente novamente.';
    }
  },

  // ===== LISTENERS EM TEMPO REAL =====
  _listenOS() {
    if (!this.session?.telefone) {
      console.warn('[Portal] _listenOS() cancelado — sessão sem telefone');
      return;
    }
    if (this.unsubscribeOS) this.unsubscribeOS();
    const db = window.db;
    if (!db) { console.warn('[Portal] _listenOS() cancelado — db não disponível'); return; }
    const { collection, query, where, onSnapshot } = window.FirebaseModules;
    // Usa todas as variantes de formato. Fallback para sessões antigas (restauradas do
    // sessionStorage) que não têm telefoneVariants: recalcula a partir do telefone.
    const variants = (this.session.telefoneVariants && this.session.telefoneVariants.length)
      ? this.session.telefoneVariants
      : this._phoneVariants(this.session.telefone);
    console.log('[AUDIT:LISTENER] Iniciando listener com variantes:', JSON.stringify(variants));
    console.log('[AUDIT:LISTENER] query: where("phone", "in", ' + JSON.stringify(variants) + ')');
    const q = query(collection(db, 'os'), where('phone', 'in', variants));
    this.unsubscribeOS = onSnapshot(q, (snap) => {
      console.log('[AUDIT:LISTENER] onSnapshot disparado! size:', snap.size);
      console.log('[AUDIT:LISTENER] metadata.hasPendingWrites:', snap.metadata.hasPendingWrites);
      this.currentOS = [];
      snap.forEach(d => {
        const data = d.data();
        console.log('[AUDIT:LISTENER:doc] ID:', d.id, '| phone:', JSON.stringify(data.phone), '| status:', data.status, '| model:', data.model);
        this.currentOS.push({ firestoreId: d.id, ...data });
      });
      console.log('[AUDIT:LISTENER] currentOS.length após snapshot:', this.currentOS.length);
      // Se currentOS estiver vazio, logar aviso
      if (this.currentOS.length === 0) {
        console.warn('[AUDIT:LISTENER] *** ALERTA: listener retornou 0 documentos! variantes usadas:', JSON.stringify(variants));
      }
      this.currentOS.sort((a, b) => {
        const da = a.createdAt || a.updatedAt || '';
        const db_ = b.createdAt || b.updatedAt || '';
        return db_ > da ? 1 : -1;
      });
      // Se estiver em tela que mostra OS, atualiza
      const route = location.hash.slice(1).split('/')[0];
      console.log('[AUDIT:LISTENER] Rota atual:', route, '| hash:', location.hash);
      if (route === 'os') this.renderOSList();
      else if (route === 'os-detalhe') {
        const id = location.hash.split('/')[1];
        if (id) this.renderOSDetalhe(id);
      }
      else if (route === 'painel') this.renderPainel();
      else if (route === 'garantias') this.renderGarantias();
    }, (err) => console.warn('[Portal] Erro listener OS:', err));
  },

  _listenMensagens() {
    if (!this.session?.telefone) {
      console.warn('[Portal] _listenMensagens() cancelado — sessão sem telefone');
      return;
    }
    if (this.unsubscribeMsgs) this.unsubscribeMsgs();
    const db = window.db;
    if (!db) { console.warn('[Portal] _listenMensagens() cancelado — db não disponível'); return; }
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
    // Marca o link ativo no menu inferior
    this._setActiveNav('painel');

    const s = this.session;
    const os = this.currentOS;
    console.log('[AUDIT:PAINEL] this.currentOS.length:', os?.length);
    console.log('[AUDIT:PAINEL] this.session?.telefone:', JSON.stringify(s?.telefone));
    console.log('[AUDIT:PAINEL] osCount do login:', s?.osCount);
    if (os?.length > 0) {
      console.log('[AUDIT:PAINEL] OS encontradas no currentOS:');
      os.forEach(o => console.log('  - ID:', o.firestoreId || o.id, '| phone:', JSON.stringify(o.phone), '| status:', o.status));
    } else {
      console.warn('[AUDIT:PAINEL] *** ALERTA: currentOS VAZIO! OS serão exibidas como 0.');
    }
    const activeOS = os.filter(o => o.status !== 'entregue' && o.status !== 'devolvido_orcamento' && o.status !== 'orcamento_recusado');
    const warranties = os.filter(o => this._emGarantia(o));
    const msgsNaoLidas = (this.currentMsgs || []).filter(m => !m.lida);
    console.log('[AUDIT:PAINEL] activeOS:', activeOS.length, '| warranties:', warranties.length, '| msgsNaoLidas:', msgsNaoLidas.length);

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

        <!-- GRID DE NAVEGAÇÃO -->
        <div class="painel-grid">
          <div class="painel-card" onclick="Portal.navegar('como-chegar')">
            <div class="painel-card-icon">📍</div>
            <div class="painel-card-title">Como Chegar</div>
            <div class="painel-card-sub">Veja como nos encontrar</div>
          </div>
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
          <div class="painel-card painel-card-destaque painel-card-solicitar" onclick="Portal.navegar('contato')">
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
            <div class="painel-card-sub">WhatsApp & Telefone</div>
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
          <div class="os-card-model">📱 ${this._esc([o.brand, o.model].filter(Boolean).join(' '))}</div>
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
  // Ordem oficial do fluxo (8 etapas).
  STATUS_ORDER: ['recebido','em_analise','orcamento_enviado','orcamento_aprovado','em_reparo','testes_finais','concluido','entregue'],

  // Mapeia status antigos (OS já gravadas) para a etapa equivalente do fluxo novo.
  _getLockTypeLabel(type) {
    const map = {
      'Numerica': 'Senha',
      'Padrao': 'Padrão',
      'Biometria': 'Biometria',
      'Face ID': 'Face ID',
      'Digital': 'Digital',
      'Sem senha': 'Sem bloqueio'
    };
    return map[type] || type || 'Não informado';
  },

  _normStatus(status) {
    const map = {
      orcamento: 'orcamento_enviado',
      pronto: 'concluido',
      aguardando_peca: 'em_reparo',
      aguardando_aprovacao: 'orcamento_enviado',
      aprovado: 'orcamento_aprovado',
      devolvido_orcamento: 'orcamento_recusado'
    };
    return map[status] || status;
  },

  _statusProgress(status) {
    const ORDER = this.STATUS_ORDER;
    const LABELS = ['Recebida','Em análise','Orçamento enviado','Orçamento aprovado','Em reparo','Testes finais','Concluída','Entregue'];
    const idx = ORDER.indexOf(this._normStatus(status));
    if (idx === -1) return { percent: 0, label: (STATUS_LABEL[status] && STATUS_LABEL[status].label) || status || '—' };
    const pct = Math.round((idx / (ORDER.length - 1)) * 100);
    return { percent: pct, label: `${idx + 1}/${ORDER.length} — ${LABELS[idx]}` };
  },

  // ===== DETALHE DA OS =====
  renderOSDetalhe(osId) {
    const el = document.getElementById('app-content');

    const o = this.currentOS.find(x => x.id === osId || x.firestoreId === osId);
    if (!o) {
      el.innerHTML = `<div class="os-container"><div class="empty-state"><p>OS não encontrada na lista local</p><button class="login-btn" onclick="Portal.navegar('os')">Voltar</button></div></div>`;
      return;
    }

    const st = STATUS_LABEL[o.status] || { label: o.status, cor: '#999', icon: '❓' };
    const date = this._fmtDate(o.createdAt);
    const updated = this._fmtDate(o.updatedAt);
    const timeline = Array.isArray(o.timeline) ? o.timeline : [];
    const progress = this._statusProgress(o.status);
    const MAPS_URL = 'https://www.google.com/maps/dir//Cell+City+%E2%80%93+Conserto+de+Celular,+Notebook+e+Impressora,+R.+6,+455+-+St.+Central,+Goi%C3%A2nia+-+GO,+74023-030/';

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
            <div class="os-detail-row"><span class="os-detail-label">📱 Aparelho</span><span class="os-detail-value">${this._esc([o.brand, o.model].filter(Boolean).join(' '))}</span></div>
            ${o.imei ? `<div class="os-detail-row"><span class="os-detail-label">🔢 IMEI</span><span class="os-detail-value">${this._esc(o.imei)}</span></div>` : ''}
            <div class="os-detail-row"><span class="os-detail-label">🔧 Defeito</span><span class="os-detail-value">${this._esc(o.defect || '')}</span></div>
            ${o.observations ? `<div class="os-detail-row"><span class="os-detail-label">📝 Obs</span><span class="os-detail-value">${this._esc(o.observations)}</span></div>` : ''}
            <div class="os-detail-row"><span class="os-detail-label">📅 Abertura</span><span class="os-detail-value">${date}</span></div>
            <div class="os-detail-row"><span class="os-detail-label">🔄 Atualização</span><span class="os-detail-value">${updated}</span></div>
            ${o.valor ? `<div class="os-detail-row"><span class="os-detail-label">💰 À vista / PIX</span><span class="os-detail-value">R$ ${Number(o.valor).toFixed(2)}</span></div>` : ''}
            ${o.valorCartao ? `<div class="os-detail-row"><span class="os-detail-label">💳 Cartão</span><span class="os-detail-value">R$ ${Number(o.valorCartao).toFixed(2)}</span></div>` : ''}
            ${o.technician ? `<div class="os-detail-row"><span class="os-detail-label">🛠️ Técnico</span><span class="os-detail-value">${this._esc(o.technician)}</span></div>` : ''}
            ${o.lockType ? `<div class="os-detail-row"><span class="os-detail-label">🔒 Bloqueio</span><span class="os-detail-value">${this._esc(this._getLockTypeLabel(o.lockType))}</span></div>` : ''}
          </div>
    `;

    // Banner de Pronto para Retirada
    if (o.status === 'concluido' || o.status === 'pronto') {
      html += `
        <a href="${MAPS_URL}" target="_blank" class="pronto-banner" style="text-decoration:none;display:flex;margin-bottom:12px;">
          <div class="pronto-banner-icon">🟢</div>
          <div class="pronto-banner-text">
            <strong>Seu aparelho está pronto para retirada!</strong>
            <span>📍 Toque aqui para ver como chegar</span>
          </div>
        </a>
      `;
    }

    // Card de orçamento (aguardando aprovação do cliente)
    if (o.status === 'orcamento_enviado' || o.status === 'orcamento') {
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
        status: 'orcamento_aprovado',
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
        status: 'orcamento_recusado',
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

      console.log('[AUDIT:GARANTIAS] this.currentOS.length:', this.currentOS?.length);
      if (this.currentOS?.length > 0) {
        this.currentOS.forEach(o => {
          const emGar = this._emGarantia(o);
          const dd = this._getDeliveryDate(o);
          console.log('[AUDIT:GARANTIAS:OS] ID:', o.firestoreId || o.id, '| status:', o.status, '| garantiaId:', o.garantiaId, '| emGarantia:', emGar, '| deliveryDate:', dd?.toISOString?.() || dd);
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

      // Classifica OS em 3 grupos mutuamente exclusivos
      const pendentes = this.currentOS.filter(o =>
        o.garantiaId && !this._getDeliveryDate(o)
      );
      const ativas = this.currentOS.filter(o => this._emGarantia(o));
      const expiradas = this.currentOS.filter(o =>
        !this._emGarantia(o) && this._getDeliveryDate(o)
      );

      console.log('[AUDIT:GARANTIAS] pendentes:', pendentes.length, '| ativas:', ativas.length, '| expiradas:', expiradas.length);

      let html = `<div class="garantias-container"><h2 class="screen-title">🛡️ Minhas Garantias</h2>`;

      if (pendentes.length === 0 && ativas.length === 0 && expiradas.length === 0) {
        html += `<div class="empty-state"><div class="empty-icon">🛡️</div><p>Nenhum serviço com garantia encontrado.</p><button class="login-btn" onclick="Portal.navegar('painel')">Voltar</button></div></div>`;
        el.innerHTML = html;
        return;
      }

      // Helper para link da garantia
      const osLink = (o) => `/CRM/garantia.html?id=${this._esc(o.id || o.firestoreId || '')}`;

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
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
                  <a href="${osLink(o)}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;font-weight:600;font-size:13px;text-decoration:none;background:linear-gradient(135deg,#00C853,#00A040);color:#fff;transition:all 0.3s;">👁️ Visualizar Garantia</a>
                  <a href="${osLink(o)}" download style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;font-weight:600;font-size:13px;text-decoration:none;background:var(--bg-surface,#1a1d23);color:var(--text-primary,#f5f7fa);border:1px solid var(--border,rgba(255,255,255,0.10));transition:all 0.3s;">📥 Baixar Garantia</a>
                </div>
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
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
                  <a href="${osLink(o)}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;font-weight:600;font-size:13px;text-decoration:none;background:linear-gradient(135deg,#00C853,#00A040);color:#fff;transition:all 0.3s;">👁️ Visualizar Garantia</a>
                  <a href="${osLink(o)}" download style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;font-weight:600;font-size:13px;text-decoration:none;background:var(--bg-surface,#1a1d23);color:var(--text-primary,#f5f7fa);border:1px solid var(--border,rgba(255,255,255,0.10));transition:all 0.3s;">📥 Baixar Garantia</a>
                </div>
              </div>
            `;
          } catch (err) {
            console.warn('[Portal] Erro ao renderizar garantia individual:', err, o);
          }
        });
      }

      // ===== 3. Garantias Expiradas =====
      if (expiradas.length > 0) {
        html += `<h3 class="garantias-subtitle" style="color:#78909C;">⌛ Garantias Expiradas (${expiradas.length})</h3>`;
        expiradas.slice(0, 5).forEach(o => {
          try {
            const dd = this._getDeliveryDate(o);
            const prazo = o.prazoGarantia || PRAZO_GARANTIA_DIAS;
            const dataFim = new Date(dd);
            dataFim.setDate(dataFim.getDate() + prazo);
            const dataFimStr = dataFim.toLocaleDateString('pt-BR');
            const nomeGarantia = getGarantiaNome(o);

            html += `
              <div class="garantia-card" style="border-left: 4px solid #78909C;opacity:0.7;">
                <div class="garantia-card-top">
                  <span class="garantia-card-model">📱 ${this._esc(o.model || '')}</span>
                  <span class="garantia-card-status-badge" style="background:#78909C20;color:#78909C;border:1px solid #78909C40;">
                    🔴 Expirada
                  </span>
                </div>
                <div class="garantia-card-info">
                  ${nomeGarantia ? `<span>🛡️ Garantia: <strong>${this._esc(nomeGarantia)}</strong></span>` : ''}
                  <span>📅 Vencida em: <strong>${dataFimStr}</strong></span>
                  <span class="garantia-card-id">OS #${this._esc(o.firestoreId || o.id || '')}</span>
                </div>
              </div>
            `;
          } catch (err) {
            console.warn('[Portal] Erro ao renderizar garantia expirada:', err, o);
          }
        });
      }

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

  // ===== AVALIAR =====
  renderAvaliar() {
    const el = document.getElementById('app-content');

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
          <a href="${this.loja.googlePlaceId ? 'https://search.google.com/local/writereview?placeid=' + this.loja.googlePlaceId : (this.loja.mapsUrl || LOJA_DEFAULT.mapsUrl)}" target="_blank" class="avaliar-google-btn">
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
      // Verifica se já avaliou antes de salvar (evita duplicatas)
      if (!this.currentAval && !sessionStorage.getItem('portal_avaliou')) {
        this._salvarAvaliacao(val, '');
        sessionStorage.setItem('portal_avaliou', '1');
      }
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
    if (val < 1 || val > 3) {
      this._toast('Selecione uma nota (1 a 3 estrelas)', 'warning');
      return;
    }
    const texto = document.getElementById('avaliar-texto').value.trim();

    // Verifica duplicata: já avaliou nesta sessão?
    if (sessionStorage.getItem('portal_avaliou')) {
      this._toast('Você já enviou uma avaliação. Obrigado!', 'info');
      return;
    }

    document.getElementById('btn-avaliar').style.display = 'none';
    document.getElementById('btn-avaliar-loading').style.display = '';

    await this._salvarAvaliacao(val, texto);

    // Marca como já avaliou nesta sessão
    sessionStorage.setItem('portal_avaliou', '1');

    document.getElementById('btn-avaliar-loading').style.display = 'none';
    document.getElementById('avaliar-feedback').style.display = 'none';
    document.getElementById('avaliar-nota').textContent = '✅ Obrigado pelo seu feedback!';
    this._toast('Feedback enviado com sucesso!', 'success');
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
      this._toast('Erro ao salvar. Tente novamente.', 'error');
    }
  },

  // ===== MENSAGENS =====
  renderMensagens() {
    const el = document.getElementById('app-content');

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

    // Marca mensagens não lidas como lidas no Firestore
    const naoLidas = msgs.filter(m => !m.lida && !m.resposta);
    naoLidas.forEach(m => this._marcarMensagemLida(m.id));
  },

  async _marcarMensagemLida(msgId) {
    try {
      const db = window.db;
      const { doc, updateDoc } = window.FirebaseModules;
      await updateDoc(doc(db, 'mensagens_portal', msgId), { lida: true });
    } catch (err) {
      // Silencia erro se a mensagem já foi lida por outro meio
    }
  },

  async enviarMensagem() {
    const nome = document.getElementById('msg-nome').value.trim();
    const texto = document.getElementById('msg-texto').value.trim();
    const errorEl = document.getElementById('msg-error');

    if (!nome) {
      errorEl.textContent = '📝 Digite seu nome';
      document.getElementById('msg-nome')?.focus();
      return;
    }
    if (!texto) {
      errorEl.textContent = '💬 Digite sua mensagem';
      document.getElementById('msg-texto')?.focus();
      return;
    }
    if (texto.length < 3) {
      errorEl.textContent = '📝 A mensagem deve ter pelo menos 3 caracteres';
      document.getElementById('msg-texto')?.focus();
      return;
    }

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
      this._toast('Mensagem enviada com sucesso!', 'success');
    } catch (err) {
      console.error('[Portal] Erro ao enviar mensagem:', err);
      errorEl.textContent = '❌ Erro ao enviar. Tente novamente.';
      this._toast('Erro ao enviar mensagem', 'error');
    }
    document.getElementById('btn-msg').style.display = '';
    document.getElementById('btn-msg-loading').style.display = 'none';
  },

  // ===== CONTATO =====
  renderContato() {
    const el = document.getElementById('app-content');

    const loja = this.loja || LOJA_DEFAULT;
    const tel = loja.whatsapp || '';
    const horarios = (loja.horarios || '').split('•').map(s => s.trim()).filter(Boolean);

    el.innerHTML = `
      <div class="contato-container">
        <h2 class="screen-title">📍 Fale Conosco</h2>

        <!-- LINHA 1: WhatsApp + Telefone -->
        <div class="contato-grid">
          <a href="${this._waLink('Olá! Vim pelo Portal do Cliente')}" target="_blank" class="contato-card contato-card-whatsapp" onclick="window.Portal._registrarEvento('clique_whatsapp',{pagina:'contato'})">
            <div class="contato-card-icon">💚</div>
            <div class="contato-card-info">
              <div class="contato-card-title">WhatsApp</div>
              <div class="contato-card-text">${this._esc(tel)}</div>
            </div>
          </a>
          <a href="tel:+${this._waDigits()}" class="contato-card phone-card">
            <div class="contato-card-icon">📞</div>
            <div class="contato-card-info">
              <div class="contato-card-title">Telefone</div>
              <div class="contato-card-text">${this._esc(tel)}</div>
            </div>
          </a>
        </div>

        <!-- LINHA 2: Endereço + Horários -->
        <div class="contato-grid">
          <div class="contato-card address-card">
            <div class="contato-card-icon">📍</div>
            <div class="contato-card-info">
              <div class="contato-card-title">Endereço</div>
              <div class="contato-card-text">${this._esc(loja.endereco || '')}</div>
            </div>
          </div>
          ${horarios.length ? `
          <div class="contato-card hours-card">
            <div class="contato-card-icon">🕐</div>
            <div class="contato-card-info">
              <div class="contato-card-title">Horários</div>
              ${horarios.map(h => `<div class="contato-card-text">${this._esc(h)}</div>`).join('')}
            </div>
          </div>` : ''}
        </div>

        <!-- LINHA 3: Google Maps -->
        <a href="${loja.mapsUrl || LOJA_DEFAULT.mapsUrl}" target="_blank" class="contato-card contato-card-map map-card" onclick="window.Portal._registrarEvento('clique_maps',{pagina:'contato'})">
          <div class="contato-card-icon">🗺️</div>
          <div class="contato-card-info">
            <div class="contato-card-title">Ver no mapa</div>
            <div class="contato-card-text">Google Maps</div>
          </div>
          <div class="contato-card-arrow">→</div>
        </a>

        <!-- SOLICITAÇÃO DE DIAGNÓSTICO -->
        <div class="contato-form-section">
          <div class="contato-form-header">
            <span class="contato-form-icon">🔧</span>
            <div class="contato-form-header-text">
              <div class="contato-form-title">Solicitar Diagnóstico Gratuito</div>
              <div class="contato-form-sub">Preencha os dados abaixo e nossa equipe entrará em contato com um orçamento.</div>
            </div>
          </div>
          <div class="contato-form-body">
            <label class="form-label">Tipo de Equipamento *</label>
            <select id="solicitacao-equipamento" class="solicitacao-select">
              <option value="">Selecione...</option>
              <option value="celular">📱 Celular</option>
              <option value="notebook">💻 Notebook</option>
              <option value="impressora">🖨️ Impressora</option>
            </select>

            <label class="form-label">Marca</label>
            <input type="text" id="solicitacao-marca" class="solicitacao-input" placeholder="Ex: Samsung, HP, Epson...">

            <label class="form-label">Modelo</label>
            <input type="text" id="solicitacao-modelo" class="solicitacao-input" placeholder="Ex: Galaxy S23, Pavilion, EcoTank...">

            <label class="form-label">Descrição do Defeito *</label>
            <textarea id="solicitacao-desc" class="msg-textarea" placeholder="Ex: Não liga, tela trincada, superaquecendo..."></textarea>

            <div style="margin-top:12px;text-align:right;">
              <button id="btn-enviar-solicitacao" class="btn-solicitar" onclick="window.Portal._enviarSolicitacaoDiagnostico()">
                🔧 Solicitar Orçamento
              </button>
              <span id="btn-solicitacao-loading" style="display:none;padding:10px 24px;color:#888;">Enviando...</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ===== COMO CHEGAR (P5.3) =====
  renderComoChegar() {
    const el = document.getElementById('app-content');

    const loja = this.loja || LOJA_DEFAULT;
    const MAPS_URL = loja.mapsUrl || LOJA_DEFAULT.mapsUrl;
    const WHATSAPP_URL = this._waLink('Olá! Vim pelo Portal do Cliente e gostaria de saber como chegar');
    const horarios = (loja.horarios || '').split('•').map(s => s.trim()).filter(Boolean);

    // Verifica se há OS pronta para retirada
    const osPronta = this.currentOS.filter(o => o.status === 'concluido' || o.status === 'pronto');

    // Formata endereço em partes para melhor visualização
    const endereco = this._esc(loja.endereco || '');
    const bairro = this._esc(loja.bairro || '');
    const cidade = this._esc(loja.cidade || '');

    el.innerHTML = `
      <div class="como-chegar-container">
        ${osPronta.length > 0 ? `
          <a href="${MAPS_URL}" target="_blank" class="pronto-banner" onclick="window.Portal._registrarEvento('clique_maps',{pagina:'como-chegar',origem:'banner'})">
            <div class="pronto-banner-icon">🟢</div>
            <div class="pronto-banner-text">
              <strong>Seu aparelho está pronto para retirada!</strong>
              <span>📍 Toque para ver a rota até a loja</span>
            </div>
          </a>
        ` : ''}

        <!-- MAPA INTERATIVO -->
        <a href="${MAPS_URL}" target="_blank" class="como-chegar-mapa" onclick="window.Portal._registrarEvento('clique_maps',{pagina:'como-chegar',origem:'placeholder'})">
          <div class="mapa-placeholder">
            <span class="mapa-icon">🗺️</span>
            <span class="mapa-text">Abrir no Google Maps</span>
            <span class="mapa-sub">Toque para ver a rota até a ${this._esc(loja.nome || 'Cell City')}</span>
          </div>
        </a>

        <!-- ENDEREÇO DA LOJA -->
        <div class="como-chegar-card endereco-card">
          <div class="como-chegar-card-icon">📍</div>
          <div class="como-chegar-card-info">
            <div class="como-chegar-card-title">${this._esc(loja.nome || 'Cell City Informática')}</div>
            <div class="como-chegar-card-text">${endereco}${bairro ? `, ${bairro}` : ''}${cidade ? ` — ${cidade}` : ''}</div>
          </div>
        </div>

        <!-- AÇÕES RÁPIDAS -->
        <div class="como-chegar-acoes">
          <a href="${MAPS_URL}" target="_blank" class="acao-card" onclick="window.Portal._registrarEvento('clique_maps',{pagina:'como-chegar',origem:'acao-card'})">
            <span class="acao-icon">🗺️</span>
            <span class="acao-label">Abrir no Maps</span>
          </a>
          <a href="${WHATSAPP_URL}" target="_blank" class="acao-card" onclick="window.Portal._registrarEvento('clique_whatsapp',{pagina:'como-chegar'})">
            <span class="acao-icon">💚</span>
            <span class="acao-label">Falar no WhatsApp</span>
          </a>
          <a href="tel:+${this._waDigits()}" class="acao-card">
            <span class="acao-icon">📞</span>
            <span class="acao-label">Ligar Agora</span>
          </a>
          <div class="acao-card">
            <span class="acao-icon">🕐</span>
            <span class="acao-label">${horarios.length ? horarios.map(h => this._esc(h)).join('<br>') : 'Consulte horários'}</span>
          </div>
        </div>

        <!-- BOTÃO PRINCIPAL -->
        <a href="${MAPS_URL}" target="_blank" class="como-chegar-btn" onclick="window.Portal._registrarEvento('clique_maps',{pagina:'como-chegar',origem:'botao-principal'})">
          <span>🗺️</span>
          <span>Abrir no Google Maps</span>
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
  _getInitial(name) {
    if (!name || typeof name !== 'string') return '?';
    return name.trim().charAt(0).toUpperCase();
  },

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

  // ===== TOAST MELHORADO COM TIPOS =====
  _toast(msg, tipo = 'info') {
    const existing = document.querySelector('.portal-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.className = `portal-toast portal-toast-${tipo}`;
    toast.innerHTML = `<span class="toast-icon">${icons[tipo] || 'ℹ️'}</span><span class="toast-text">${msg}</span>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    const duracao = tipo === 'error' ? 5000 : 3000;
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duracao);
  },

  // ===== NAVEGAÇÃO INFERIOR =====
  _setActiveNav(route) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const active = document.querySelector(`.nav-item[data-route="${route}"]`);
    if (active) active.classList.add('active');
  },

  // ===== TRACKING DE EVENTOS (ETAPA 3) =====
  async _registrarEvento(tipo, dados = {}) {
    try {
      const db = window.db;
      const { collection, addDoc, serverTimestamp } = window.FirebaseModules;
      const payload = {
        tipo,
        createdAt: serverTimestamp(),
        ...dados
      };
      if (this.session) {
        payload.telefone = this.session.telefone;
        payload.clientName = this.session.clientName;
      }
      await addDoc(collection(db, 'portal_eventos'), payload);
      console.log('[Portal] Evento registrado:', tipo);
    } catch (err) {
      console.warn('[Portal] Erro ao registrar evento:', tipo, err.message);
    }
  },

  // ===== SOLICITAÇÃO DE DIAGNÓSTICO (ETAPA 3) =====
  async _enviarSolicitacaoDiagnostico() {
    const descInput = document.getElementById('solicitacao-desc');
    const equipInput = document.getElementById('solicitacao-equipamento');
    const marcaInput = document.getElementById('solicitacao-marca');
    const modeloInput = document.getElementById('solicitacao-modelo');
    const btn = document.getElementById('btn-enviar-solicitacao');
    const loading = document.getElementById('btn-solicitacao-loading');
    if (!descInput || !equipInput) return;

    const equip = equipInput.value.trim();
    const desc = descInput.value.trim();
    const marca = marcaInput ? marcaInput.value.trim() : '';
    const modelo = modeloInput ? modeloInput.value.trim() : '';

    if (!equip) {
      equipInput.style.borderColor = '#EF5350';
      equipInput.focus();
      this._toast('Selecione o tipo de equipamento', 'warning');
      return;
    }
    if (desc.length < 10) {
      descInput.style.borderColor = '#EF5350';
      descInput.focus();
      this._toast('Descreva o problema (mínimo 10 caracteres)', 'warning');
      return;
    }

    btn.style.display = 'none';
    loading.style.display = '';

    try {
      const db = window.db;
      const { collection, addDoc, serverTimestamp } = window.FirebaseModules;
      const payload = {
        telefone: this.session?.telefone || '',
        clientName: this.session?.clientName || '',
        tipoEquipamento: equip,
        marca: marca,
        modelo: modelo,
        descricao: desc,
        status: 'pendente',
        respondido: false,
        origem: 'portal',
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'solicitacoes_diagnostico'), payload);
      this._toast('Solicitação enviada com sucesso! Em breve entraremos em contato.', 'success');
      descInput.value = '';
      descInput.style.borderColor = '';
      if (equipInput) { equipInput.value = ''; equipInput.style.borderColor = ''; }
      if (marcaInput) marcaInput.value = '';
      if (modeloInput) modeloInput.value = '';
    } catch (err) {
      console.error('[Portal] Erro ao enviar solicitação:', err);
      this._toast('Erro ao enviar. Tente novamente.', 'error');
    } finally {
      btn.style.display = '';
      loading.style.display = 'none';
    }
  },

  // ===== STATUS STEPS HTML =====
  _statusStepsHTML(status) {
    const ORDER = this.STATUS_ORDER;
    const LABELS = ['📥', '🔍', '📋', '👍', '🛠️', '🧪', '✅', '🎉'];
    const idx = ORDER.indexOf(this._normStatus(status));
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
