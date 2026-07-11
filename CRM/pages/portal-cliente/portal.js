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

// ===== STATUS DO AGENDAMENTO =====
// O agendamento é apenas reserva de horário para atendimento inicial / avaliação /
// recebimento — NÃO representa prazo de conclusão do reparo.
const AGENDAMENTO_STATUS = {
  'aguardando':  { label: 'Aguardando Confirmação', cor: '#FFA726', icon: '⏳' },
  'confirmado':  { label: 'Confirmado',             cor: '#00C853', icon: '✅' },
  'reagendado':  { label: 'Reagendado',             cor: '#42A5F5', icon: '🔄' },
  'cancelado':   { label: 'Não Confirmado',         cor: '#EF5350', icon: '❌' },
  'atendido':    { label: 'Atendimento Realizado',  cor: '#78909C', icon: '✔️' }
};

const AGENDAMENTO_TIPO_EQUIP = {
  celular:    '📱 Celular',
  notebook:   '💻 Notebook',
  impressora: '🖨️ Impressora',
  outro:      '🔧 Outro'
};

const AGENDAMENTO_MOTIVO = {
  avaliacao:      '🔍 Avaliação / Diagnóstico',
  troca_tela:     '📱 Troca de Tela',
  troca_bateria:  '🔋 Troca de Bateria',
  nao_liga:       '⚡ Não Liga',
  molhou:         '💧 Molhou',
  atualizacao:    '🔄 Atualização',
  outro:          '🔧 Outro'
};

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
  currentMsgs: [],     // Mensagens do cliente (Sprint 1b: carregadas sob demanda via Cloud Function, não mais onSnapshot — ver _carregarMensagens())
  currentAval: null,   // Avaliação existente (se houver)
  currentAgendamentos: [], // Agendamentos do cliente (Sprint 1b: idem, ver _carregarAgendamentos())
  unsubscribeOS: null, // Listener em tempo real das OS (fora de escopo da Sprint 1b — continua via Firestore direto)

  // Config de horários (fallback; sobrescrita ao carregar do Firestore config/horarios)
  _horariosConfig: {
    diasSemana: { inicio: '08:00', fim: '18:00', intervaloMin: 30 },
    sabado:     { inicio: '08:00', fim: '14:00', intervaloMin: 30 },
    domingo:    null, // Fechado
    vagasPorHorario: 2
  },

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
        // Sessões salvas antes da padronização de telefone não têm telefoneDigits.
        if (!this.session.telefoneDigits && this.session.telefone) {
          this.session.telefoneDigits = this._phoneDigits(this.session.telefone);
        }
        console.log('[Portal] Sessão restaurada:', JSON.stringify(this.session));
        console.log('[AUDIT:BOOT] telefone da sessão restaurada:', JSON.stringify(this.session?.telefone));

        // Inicia listeners em tempo real para a sessão restaurada
        console.log('[AUDIT:BOOT] Iniciando _listenOS() e _carregarMensagens() para sessão restaurada');
        this._listenOS();
        this._carregarMensagens();
        this._carregarAgendamentos();
      } catch {
        console.warn('[Portal] Erro ao fazer parse da sessão');
        this.session = null;
      }
    } else {
      console.log('[Portal] Nenhuma sessão salva');
    }

    // Auto-login vindo da Ordem de Serviço no CRM — botão "Portal do Cliente"
    // em CRM/pages/os/os.js::abrirPortalCliente(), que abre esta página com
    // ?tel=<phoneDigits>&os=<osId>. Evita a equipe pesquisar o cliente
    // manualmente: o telefone já é dado conhecido (o da própria OS).
    // Se a sessão restaurada já é do mesmo telefone, não repete a consulta —
    // só pula direto pra rota da OS (equivalente ao "cliente já logado").
    const paramsAuto = new URLSearchParams(location.search);
    const telAuto = paramsAuto.get('tel');
    if (telAuto) {
      const digitsAuto = this._phoneDigits(telAuto);
      const mesmoCliente = this.session && this.session.telefoneDigits === digitsAuto;
      if (!mesmoCliente) {
        console.log('[Portal] Auto-login vindo da OS — telefone:', digitsAuto);
        await this._autenticarComDigits(digitsAuto);
      }
      if (this.session) {
        const osAuto = paramsAuto.get('os');
        location.hash = osAuto ? `#/os-detalhe/${osAuto}` : '#/painel';
      }
      // Remove telefone/os da URL visível — não deixa esses dados na barra
      // de endereço nem sobrevivendo a um refresh (a sessão já está no
      // sessionStorage, que é a fonte de verdade a partir daqui).
      history.replaceState(null, '', location.pathname + (location.hash || ''));
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
      // Marca o body como logado → ativa o deslocamento do conteúdo p/ o menu lateral
      document.body.classList.add('portal-logged');

      // Navega
      switch (route) {
        case 'painel':      this.renderPainel(); break;
        case 'agendar':     this.renderAgendar(); this._carregarAgendamentos(); break;
        case 'os':          this.renderOSList(); break;
        case 'os-detalhe':  this.renderOSDetalhe(parts[1]); break;
        case 'garantias':   this.renderGarantias(); break;
        case 'avaliar':     this.renderAvaliar(); break;
        case 'mensagens':   this.renderMensagens(); this._carregarMensagens(); break;
        case 'contato':     this.renderContato(); break;
        case 'como-chegar': this.renderComoChegar(); break;
        default:            location.hash = '#/painel';
      }
      // Marca o link ativo (exceto login, os-detalhe)
      const navRoute = route === 'como-chegar' ? 'painel' : route;
      if (navRoute !== 'login' && navRoute !== 'os-detalhe') {
        this._setActiveNav(navRoute);
      }
      // Scrolla para o topo garantindo que o cabeçalho fixo não oculte o título
      // Timeout reduzido pois o render já completou (síncrono via innerHTML)
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    } catch (err) {
      console.error('[Portal] Erro no roteamento:', err);
      const el = document.getElementById('app-content');
      if (el) {
        el.innerHTML = `<div class="login-container"><div style="text-align:center;padding:40px 20px;"><span style="font-size:48px;">⚠️</span><h3>Ops! Algo deu errado.</h3><p style="color:#666;margin:12px 0;">Ocorreu um erro inesperado. Tente novamente.</p><button class="login-btn" onclick="location.reload()">🔄 Recarregar</button></div></div>`;
      }
    }
  },

  navegar(hash) {
    const newHash = '#' + hash;
    // Usa history.pushState para evitar o scroll âncora nativo do navegador
    // que ocorre quando location.hash é definido diretamente
    if (location.hash !== newHash) {
      history.pushState(null, '', newHash);
    }
    this._handleRoute();
    // Scrolla para o topo garantindo que o cabeçalho fixo não oculte o título
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
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

  // ===== TELEFONE — CAMPO CANÔNICO =====
  // Consultas de OS/clientes usam `phoneDigits`/`telefoneDigits` (só dígitos,
  // gerado por shared/phone-utils.js — a MESMA função usada por os.js para
  // gravar os dados). Isso elimina a necessidade de adivinhar variantes de
  // máscara: o valor gravado e o valor consultado vêm sempre da mesma fonte.
  // Ver shared/phone-utils.js para o histórico do bug que isso substitui
  // (máscaras divergentes entre os.js e portal.js causavam 0 resultados).
  _phoneMask(dg) {
    return window.PhoneUtils.maskPhone(dg);
  },

  _phoneDigits(input) {
    return window.PhoneUtils.normalizePhoneDigits(input);
  },

  // ===== LOGIN =====
  renderLogin() {
    console.log('[Portal] renderLogin() chamado');
    const ftr = document.getElementById('app-footer');
    const waBtn = document.getElementById('whatsapp-float');
    if (ftr) ftr.style.display = 'none';
    if (waBtn) waBtn.style.display = 'none';
    // Remove o estado "logado" → conteúdo de login volta a ocupar a tela inteira
    document.body.classList.remove('portal-logged');
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
      e.target.value = window.PhoneUtils.maskPhone(e.target.value);
      document.getElementById('login-error').textContent = '';
    });

    // Enter para logar
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.doLogin();
    });

    setTimeout(() => input.focus(), 300);
  },

  // Núcleo do login, sem dependência do formulário — usado tanto por
  // doLogin() (telefone digitado pelo cliente) quanto pelo auto-login vindo
  // da OS no CRM (?tel=<digits> na URL, ver _boot() e os.js::abrirPortalCliente()).
  // Retorna true se encontrou cliente/OS e criou sessão; false se não achou nada.
  async _autenticarComDigits(digits) {
    const db = window.db;
    const { collection, query, where, getDocs } = window.FirebaseModules;
    const formatted = this._phoneMask(digits); // formato canônico (exibição na sessão)

    console.log('[Portal] Buscando cliente — digits:', digits, 'formatted:', formatted);

    // Busca do nome em clientes: doc-ID é o próprio phoneDigits. `clientes`
    // exige temAcessoLiberado() nas Rules (tem CPF/e-mail/endereço, não
    // pode reabrir para sessão anônima como as outras 6 coleções do
    // Portal) — sessão anônima nunca tem doc usuarios/{uid}, então um
    // getDoc direto SEMPRE nega para cliente real. Fix definitivo do
    // HOTFIX P0 (2026-07-06): mesmo padrão das demais Cloud Functions
    // desta sprint — Admin SDK, retorna só `name`.
    let clientName = '';
    try {
      const resp = await window.PortalFunctions.obterNomeCliente({ phoneDigits: digits });
      clientName = (resp.data && resp.data.name) || '';
      console.log('[Portal] Nome do cliente (Cloud Function):', clientName, '| phoneDigits:', digits);
    } catch (errCliente) {
      console.warn('[Portal] Não foi possível obter o nome do cliente (portalObterNomeCliente):', errCliente);
    }

    // Busca OS do cliente pelo campo canônico
    const qOS = query(collection(db, 'os'), where('phoneDigits', '==', digits));
    const snapOS = await getDocs(qOS);
    const osCount = snapOS.size;
    console.log('[Portal] OSs encontradas (phoneDigits ==):', osCount);
    snapOS.forEach(d => {
      const data = d.data();
      console.log('[AUDIT:OS] ID:', d.id, '| phoneDigits:', data.phoneDigits, '| status:', data.status, '| model:', data.model);
    });

    if (osCount === 0 && !clientName) {
      console.log('[Portal] Nenhum resultado para o telefone:', formatted);
      return false;
    }

    // Cria sessão
    // telefone       = formato canônico (máscara), usado para EXIBIÇÃO.
    // telefoneDigits = campo canônico (só dígitos), usado em TODAS as consultas.
    this.session = {
      telefone: formatted,
      telefoneDigits: digits,
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
    this._carregarMensagens();
    this._carregarAgendamentos();
    return true;
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
      const digits = this._phoneDigits(raw);
      const ok = await this._autenticarComDigits(digits);
      if (!ok) {
        btn.style.display = '';
        loading.style.display = 'none';
        errorEl.textContent = '❌ Nenhum serviço encontrado com este telefone.';
        return;
      }
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
    // Fallback para sessões antigas (restauradas do sessionStorage) que não têm
    // telefoneDigits ainda: recalcula a partir do telefone mascarado da sessão.
    const digits = this.session.telefoneDigits || this._phoneDigits(this.session.telefone);
    console.log('[AUDIT:LISTENER] Iniciando listener com phoneDigits:', digits);
    const q = query(collection(db, 'os'), where('phoneDigits', '==', digits));
    this.unsubscribeOS = onSnapshot(q, (snap) => {
      console.log('[AUDIT:LISTENER] onSnapshot disparado! size:', snap.size);
      console.log('[AUDIT:LISTENER] metadata.hasPendingWrites:', snap.metadata.hasPendingWrites);
      this.currentOS = [];
      snap.forEach(d => {
        const data = d.data();
        console.log('[AUDIT:LISTENER:doc] ID:', d.id, '| phoneDigits:', data.phoneDigits, '| status:', data.status, '| model:', data.model);
        this.currentOS.push({ firestoreId: d.id, ...data });
      });
      console.log('[AUDIT:LISTENER] currentOS.length após snapshot:', this.currentOS.length);
      // Se currentOS estiver vazio, logar aviso
      if (this.currentOS.length === 0) {
        console.warn('[AUDIT:LISTENER] *** ALERTA: listener retornou 0 documentos! phoneDigits usado:', digits);
      }
      this.currentOS.sort((a, b) => {
        const da = a.createdAt || a.updatedAt || '';
        const db_ = b.createdAt || b.updatedAt || '';
        return db_ > da ? 1 : -1;
      });
      // Se estiver em tela que mostra OS, atualiza. Mesma normalização de
      // _handleRoute() (aceita "#rota" e "#/rota") — achado da homologação
      // do Lote 2: com hash "/" inicial (ex. link direto "#/os-detalhe/OS-1234"),
      // a leitura antiga (slice(1).split('/')[0]) resolvia para rota vazia e
      // o "id" (split('/')[1]) pegava "os-detalhe" em vez do ID da OS — a
      // tela nunca recebia a atualização ao vivo do aprovar/recusar orçamento.
      const hashParts = location.hash.replace(/^#\/?/, '').split('/');
      const route = hashParts[0];
      console.log('[AUDIT:LISTENER] Rota atual:', route, '| hash:', location.hash);
      if (route === 'os') this.renderOSList();
      else if (route === 'os-detalhe') {
        const id = hashParts[1];
        if (id) this.renderOSDetalhe(id);
      }
      else if (route === 'painel') this.renderPainel();
      else if (route === 'garantias') this.renderGarantias();
    }, (err) => console.warn('[Portal] Erro listener OS:', err));
  },

  // Sprint 1b: mensagens_portal fecha para acesso direto do cliente (Cloud
  // Function é o único caminho — ver functions/index.js::portalListarMensagens).
  // Sem onSnapshot possível nesse modelo (a Function não tem como "empurrar"
  // atualização — o cliente não prova posse do telefone em tempo de Rules,
  // só no payload de cada chamada). Busca ao entrar na tela e após enviar
  // mensagem; não atualiza sozinho enquanto a tela fica aberta.
  async _carregarMensagens() {
    if (!this.session?.telefoneDigits) {
      console.warn('[Portal] _carregarMensagens() cancelado — sessão sem telefone');
      return;
    }
    try {
      const resp = await window.PortalFunctions.listarMensagens({ phoneDigits: this.session.telefoneDigits });
      this.currentMsgs = resp.data.lista || [];
    } catch (err) {
      console.warn('[Portal] Erro ao carregar mensagens:', err);
    }
    // Normaliza como _handleRoute() (aceita "#mensagens" e "#/mensagens") —
    // a versão antiga (_listenMensagens(), location.hash.slice(1) sem
    // remover a barra) só recarregava a tela certa quando o hash vinha sem
    // "/" inicial (o caso comum via Portal.navegar(), mas não o único).
    const route = location.hash.replace(/^#\/?/, '').split('/')[0];
    if (route === 'mensagens') this.renderMensagens();
  },

  // Sprint 1b: mesmo motivo de _carregarMensagens() acima.
  async _carregarAgendamentos() {
    if (!this.session?.telefoneDigits) {
      console.warn('[Portal] _carregarAgendamentos() cancelado — sessão sem telefone');
      return;
    }
    try {
      const resp = await window.PortalFunctions.listarAgendamentos({ phoneDigits: this.session.telefoneDigits });
      this.currentAgendamentos = resp.data.lista || [];
    } catch (err) {
      console.warn('[Portal] Erro ao carregar agendamentos:', err);
    }
    const route = location.hash.replace(/^#\/?/, '').split('/')[0];
    if (route === 'agendar') this.renderAgendar();
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
            ${o.cpf ? `<div class="os-detail-row"><span class="os-detail-label">🆔 CPF</span><span class="os-detail-value">${this._esc(o.cpf)}</span></div>` : ''}
            <div class="os-detail-row"><span class="os-detail-label">🔧 Defeito</span><span class="os-detail-value">${this._esc(o.defect || '')}</span></div>
            ${o.observations ? `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px 16px;margin:10px 0 4px;"><div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">📝 Observações</div><div style="font-size:14px;color:#e8e8e8;white-space:pre-wrap;line-height:1.75;word-break:break-word;">${this._esc(o.observations)}</div></div>` : ''}
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
      const temOrc1 = o.orc1Desc || o.orc1Valor;
      const temOrc2 = o.orc2Desc || o.orc2Valor;
      const temMultiplos = temOrc1 && temOrc2;
      html += `
        <div class="orcamento-card">
          <div class="orcamento-title">💰 Orçamentos Disponíveis</div>
          <p>Seu aparelho está com o orçamento pronto. Deseja autorizar o reparo?</p>
          <div class="orcamento-opcoes">
            ${temOrc1 ? `
            <div class="orcamento-opcao" data-opcao="1">
              <div class="orcamento-opcao-titulo">Opção 1</div>
              ${o.orc1Desc ? `<div class="orcamento-opcao-desc" style="white-space:pre-wrap;line-height:1.7;word-break:break-word;">${this._esc(o.orc1Desc)}</div>` : ''}
              <div class="orcamento-opcao-valor">R$ ${Number(o.orc1Valor).toFixed(2)}</div>
            </div>
            ` : ''}
            ${temOrc2 ? `
            <div class="orcamento-opcao" data-opcao="2">
              <div class="orcamento-opcao-titulo">Opção 2</div>
              ${o.orc2Desc ? `<div class="orcamento-opcao-desc" style="white-space:pre-wrap;line-height:1.7;word-break:break-word;">${this._esc(o.orc2Desc)}</div>` : ''}
              <div class="orcamento-opcao-valor">R$ ${Number(o.orc2Valor).toFixed(2)}</div>
            </div>
            ` : ''}
            ${!temOrc1 && !temOrc2 && o.valor ? `
            <div class="orcamento-opcao">
              <div class="orcamento-opcao-titulo">Orçamento</div>
              <div class="orcamento-opcao-valor">R$ ${Number(o.valor).toFixed(2)}</div>
            </div>
            ` : ''}
          </div>
          <div class="orcamento-actions">
            <button class="orcamento-btn aprovar" onclick="Portal.aprovarOrcamento('${osId}')">✅ Aprovar</button>
            <button class="orcamento-btn recusar" onclick="Portal.recusarOrcamento('${osId}')">❌ Recusar</button>
          </div>
          <p class="orcamento-obs">Após aprovação, entraremos em contato para informar o prazo.</p>
        </div>
      `;
    }

    // Banner pós-decisão (orçamento já respondido pelo cliente)
    if (o.status === 'orcamento_aprovado' || o.orcamentoResposta === 'aprovado') {
      const escolhaLabel = o.orcamentoEscolhido ? ' — Opção ' + o.orcamentoEscolhido : '';
      const obsHtml = o.orcamentoObs ? '<div style="font-size:12px;color:#666;margin-top:6px;border-top:1px solid rgba(0,200,83,0.15);padding-top:6px;">📝 Observação: ' + this._esc(o.orcamentoObs) + '</div>' : '';
      html += `
        <div class="orcamento-resposta aprovado" style="background:rgba(0,200,83,0.1);border:1px solid rgba(0,200,83,0.4);border-radius:12px;padding:14px;margin-bottom:12px;">
          <div style="font-weight:700;color:#00C853;">✅ Orçamento aprovado pelo cliente${escolhaLabel}.</div>
          ${o.orcamentoDataResposta ? `<div style="font-size:13px;color:#666;margin-top:4px;">📅 ${this._esc(o.orcamentoDataResposta)}${o.orcamentoHoraResposta ? ' • ⏰ ' + this._esc(o.orcamentoHoraResposta) : ''}</div>` : ''}
          ${obsHtml}
        </div>
      `;
    } else if (o.status === 'orcamento_recusado' || o.orcamentoResposta === 'recusado') {
      const obsHtml = o.orcamentoObs ? '<div style="font-size:12px;color:#666;margin-top:6px;border-top:1px solid rgba(239,83,80,0.15);padding-top:6px;">📝 Motivo: ' + this._esc(o.orcamentoObs) + '</div>' : '';
      html += `
        <div class="orcamento-resposta recusado" style="background:rgba(239,83,80,0.1);border:1px solid rgba(239,83,80,0.4);border-radius:12px;padding:14px;margin-bottom:12px;">
          <div style="font-weight:700;color:#EF5350;">❌ Orçamento recusado pelo cliente.</div>
          ${o.orcamentoDataResposta ? `<div style="font-size:13px;color:#666;margin-top:4px;">📅 ${this._esc(o.orcamentoDataResposta)}${o.orcamentoHoraResposta ? ' • ⏰ ' + this._esc(o.orcamentoHoraResposta) : ''}</div>` : ''}
          ${obsHtml}
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

    // ===== DOCUMENTAÇÃO DO SERVIÇO (Garantia + Relatório Técnico unificados) =====
    // Um único ponto de acesso: abre o documento completo (garantia.html), que reúne
    // Dados do Serviço, Garantia, Relatório Técnico e Histórico em uma só página.
    const rel = o.relatorioTecnico;
    const relVisivel = rel && rel.exibirPortal && (rel.defeitoInformado || rel.diagnostico || rel.solucaoAplicada || rel.observacoes);
    if (relVisivel || emGarantia) {
      const docUrl = `/CRM/garantia.html?id=${this._esc(o.id || o.firestoreId || '')}`;
      const sub = [emGarantia ? '🛡️ Garantia' : null, relVisivel ? '📋 Relatório técnico' : null].filter(Boolean).join(' • ');
      html += `
        <div class="os-detail-section">
          <h3 class="os-detail-section-title">📄 Documentação do Serviço</h3>
          <a href="${docUrl}" target="_blank" rel="noopener" class="doc-item" style="display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #e0e0e0;border-radius:12px;cursor:pointer;background:#fafafa;text-decoration:none;color:inherit;">
            <span style="font-size:22px;">🛡️</span>
            <div style="flex:1;">
              <div style="font-weight:700;color:#222;">Garantia e Relatório Técnico</div>
              <div style="font-size:12px;color:#888;">${sub || 'Documento completo do serviço'}</div>
            </div>
            <span style="color:#888;font-size:18px;">›</span>
          </a>
        </div>
      `;
    }

    html += `</div></div>`;
    el.innerHTML = html;
  },

  // ===== ORÇAMENTO =====
  // Guarda anti-duplo: só age se a OS ainda estiver 'orcamento_enviado'.
  _orcamentoRespondivel(osId) {
    const o = (this.currentOS || []).find(x => x.id === osId || x.firestoreId === osId);
    if (!o) return true; // se não achou em memória, deixa o Firestore decidir
    if (o.status === 'orcamento_enviado' || o.status === 'orcamento') return true;
    this._toast('Este orçamento já foi respondido.', 'info');
    return false;
  },

  async aprovarOrcamento(osId) {
    if (!this._orcamentoRespondivel(osId)) return;
    const o = (this.currentOS || []).find(x => x.id === osId || x.firestoreId === osId);
    const temOrc1 = o && (o.orc1Desc || o.orc1Valor);
    const temOrc2 = o && (o.orc2Desc || o.orc2Valor);
    const temMultiplos = temOrc1 && temOrc2;
    if (temMultiplos) {
      this._exibirModalEscolhaOrcamento(osId, o);
      return;
    }
    this._confirmarAprovacaoDireta(osId);
  },

  _confirmarAprovacaoDireta(osId) {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    const body = document.getElementById('orc-modal-body');
    const title = document.getElementById('orc-modal-title');
    if (!body || !title) return;
    overlay.style.display = 'flex';
    title.textContent = 'Confirmar Aprovação';
    body.innerHTML = '<p style="margin-bottom:12px;color:#666;">Deseja aprovar este orcamento?</p><div style="margin-bottom:12px;"><label style="font-size:13px;color:#888;display:block;margin-bottom:4px;">Observacao <span style="color:#aaa;">(opcional)</span></label><textarea id="orc-obs-input" rows="2" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:14px;resize:vertical;" placeholder="Ex.: Pode prosseguir, Tenho urgencia..."></textarea></div><div style="display:flex;gap:8px;margin-top:16px;"><button onclick="Portal._fecharModal();" style="flex:1;padding:12px;background:#f5f5f5;border:1px solid #ddd;border-radius:8px;cursor:pointer;font-weight:600;">Cancelar</button><button onclick="Portal._executarAprovacao(\'' + osId + '\')" style="flex:1;padding:12px;background:#00C853;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;">Confirmar Aprovacao</button></div>';
  },

  _exibirModalEscolhaOrcamento(osId, o) {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    const body = document.getElementById('orc-modal-body');
    const title = document.getElementById('orc-modal-title');
    if (!body || !title) return;
    overlay.style.display = 'flex';
    title.textContent = 'Selecione a opcao desejada';
    const desc1 = o.orc1Desc ? '<div class="orc-modal-opcao-desc">' + this._esc(o.orc1Desc) + '</div>' : '';
    const desc2 = o.orc2Desc ? '<div class="orc-modal-opcao-desc">' + this._esc(o.orc2Desc) + '</div>' : '';
    body.innerHTML = '<div class="orc-modal-opcoes"><label class="orc-modal-opcao" data-opcao="1"><input type="radio" name="orc-escolha" value="1" checked><div class="orc-modal-opcao-content"><div class="orc-modal-opcao-titulo">Opcao 1</div>' + desc1 + '<div class="orc-modal-opcao-valor">R$ ' + Number(o.orc1Valor).toFixed(2) + '</div></div></label><label class="orc-modal-opcao" data-opcao="2"><input type="radio" name="orc-escolha" value="2"><div class="orc-modal-opcao-content"><div class="orc-modal-opcao-titulo">Opcao 2</div>' + desc2 + '<div class="orc-modal-opcao-valor">R$ ' + Number(o.orc2Valor).toFixed(2) + '</div></div></label></div><div style="margin-top:12px;"><label style="font-size:13px;color:#888;display:block;margin-bottom:4px;">Observacao <span style="color:#aaa;">(opcional)</span></label><textarea id="orc-obs-input" rows="2" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:14px;resize:vertical;" placeholder="Ex.: Quero a peca original, Retiro amanha..."></textarea></div><div style="display:flex;gap:8px;margin-top:16px;"><button onclick="Portal._fecharModal();" style="flex:1;padding:12px;background:#f5f5f5;border:1px solid #ddd;border-radius:8px;cursor:pointer;font-weight:600;">Cancelar</button><button onclick="Portal._executarAprovacao(\'' + osId + '\')" style="flex:1;padding:12px;background:#00C853;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;">Confirmar Aprovacao</button></div>';
  },

  async _executarAprovacao(osId) {
    const selectedRadio = document.querySelector('input[name="orc-escolha"]:checked');
    const escolha = selectedRadio ? selectedRadio.value : null;
    const obs = document.getElementById('orc-obs-input')?.value?.trim() || '';
    this._fecharModal();
    try {
      // portalResponderOrcamento (Sprint 1b) substitui o updateDoc direto e
      // adiciona a checagem que faltava: phoneDigits do payload precisa bater
      // com o phoneDigits gravado na OS. _listenOS() (inalterado) recebe a
      // atualização normalmente e re-renderiza a tela.
      await window.PortalFunctions.responderOrcamento({
        osId, phoneDigits: this.session.telefoneDigits, resposta: 'aprovado', escolha, obs: obs || undefined,
      });
      this._toast('Orcamento aprovado! Entraremos em contato.');
    } catch (err) {
      console.error('[Portal] Erro ao aprovar:', err);
      this._toast(err.message || 'Erro ao aprovar. Tente novamente.');
    }
  },

  async recusarOrcamento(osId) {
    if (!this._orcamentoRespondivel(osId)) return;
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    const body = document.getElementById('orc-modal-body');
    const title = document.getElementById('orc-modal-title');
    if (!body || !title) return;
    overlay.style.display = 'flex';
    title.textContent = 'Motivo da Recusa';
    body.innerHTML = '<p style="margin-bottom:12px;color:#666;">Conte-nos o motivo da recusa:</p><div style="margin-bottom:12px;"><label style="font-size:13px;color:#888;display:block;margin-bottom:4px;">Motivo <span style="color:#ef4444;">*</span></label><textarea id="orc-recusa-motivo" rows="3" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:14px;resize:vertical;" placeholder="Ex.: Valor acima do esperado, Vou procurar outra assistencia..." oninput="document.getElementById(\'recusa-confirm-btn\').disabled = this.value.trim().length < 3"></textarea><div id="recusa-erro" style="color:#ef4444;font-size:12px;margin-top:4px;display:none;">Por favor, informe o motivo da recusa.</div></div><div style="display:flex;gap:8px;margin-top:16px;"><button onclick="Portal._fecharModal();" style="flex:1;padding:12px;background:#f5f5f5;border:1px solid #ddd;border-radius:8px;cursor:pointer;font-weight:600;">Cancelar</button><button id="recusa-confirm-btn" onclick="Portal._executarRecusa(\'' + osId + '\')" style="flex:1;padding:12px;background:#ef4444;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;" disabled>Confirmar Recusa</button></div>';
  },

  async _executarRecusa(osId) {
    const motivo = document.getElementById('orc-recusa-motivo')?.value?.trim();
    if (!motivo || motivo.length < 3) {
      const erro = document.getElementById('recusa-erro');
      if (erro) erro.style.display = 'block';
      return;
    }
    this._fecharModal();
    try {
      await window.PortalFunctions.responderOrcamento({
        osId, phoneDigits: this.session.telefoneDigits, resposta: 'recusado', obs: motivo,
      });
      this._toast('Orcamento recusado. Seu aparelho sera devolvido.');
    } catch (err) {
      console.error('[Portal] Erro ao recusar:', err);
      this._toast(err.message || 'Erro ao recusar. Tente novamente.');
    }
  },

  _fecharModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'none';
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
      const LBL = 'font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px;';
      // Bloco de ações: Garantia + (se houver) Relatório Técnico
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
                ${acoesDoc(o)}
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
      // Verifica se já avaliou antes de salvar (evita duplicatas). Achado da
      // homologação: _checkAvaliacaoExistente() é fire-and-forget (chamado
      // sem await em renderAvaliar()) — sem o gate _avaliacaoCheckDone, um
      // toque rápido em 4-5 estrelas antes da Cloud Function responder
      // criava uma avaliação duplicada (this.currentAval ainda indefinido).
      // Essa janela de corrida já existia antes desta sprint (mesmo desenho
      // fire-and-forget), mas a Cloud Function é mais lenta que a leitura
      // local de Firestore que existia antes, alargando a janela.
      if (this._avaliacaoCheckDone && !this.currentAval && !sessionStorage.getItem('portal_avaliou')) {
        this._salvarAvaliacao(val, '');
        sessionStorage.setItem('portal_avaliou', '1');
      }
    }
  },

  async _checkAvaliacaoExistente() {
    this._avaliacaoCheckDone = false;
    try {
      const resp = await window.PortalFunctions.listarAvaliacoes({ phoneDigits: this.session.telefoneDigits });
      const lista = resp.data.lista || [];
      if (lista.length) {
        const av = lista[0];
        this.currentAval = av;
        // Refs consultadas só depois de confirmar que a tela ainda existe —
        // o cliente pode ter navegado para outra rota enquanto a Cloud
        // Function estava em voo (mesma classe de achado de enviarMensagem()).
        const notaEl = document.getElementById('avaliar-nota');
        const feedback = document.getElementById('avaliar-feedback');
        const googleEl = document.getElementById('avaliar-google');
        if (notaEl) {
          document.querySelectorAll('.star').forEach((s, i) => {
            if (i < av.nota) { s.textContent = '★'; s.style.color = '#FFD700'; }
          });
          notaEl.textContent = `Você já nos avaliou com ${av.nota} ★`;
          if (feedback) feedback.style.display = 'none';
          if (av.nota >= 4 && googleEl) googleEl.style.display = '';
        }
      }
    } catch (e) { /* ignora */ }
    this._avaliacaoCheckDone = true;
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

    // Refs cacheadas antes do await — mesmo achado/fix de enviarMensagem()
    // acima: re-consultar document.getElementById() depois do await quebra
    // se o cliente já navegou para outra rota (tela de Avaliar não existe
    // mais no DOM).
    const btnLoading = document.getElementById('btn-avaliar-loading');
    const feedback = document.getElementById('avaliar-feedback');
    const notaEl = document.getElementById('avaliar-nota');

    document.getElementById('btn-avaliar').style.display = 'none';
    btnLoading.style.display = '';

    await this._salvarAvaliacao(val, texto);

    // Marca como já avaliou nesta sessão
    sessionStorage.setItem('portal_avaliou', '1');

    btnLoading.style.display = 'none';
    feedback.style.display = 'none';
    notaEl.textContent = '✅ Obrigado pelo seu feedback!';
    this._toast('Feedback enviado com sucesso!', 'success');
  },

  async _salvarAvaliacao(nota, texto) {
    try {
      await window.PortalFunctions.criarAvaliacao({
        phoneDigits: this.session.telefoneDigits,
        clientName: this.session.clientName,
        nota,
        texto,
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
      await window.PortalFunctions.marcarMensagemLida({ phoneDigits: this.session.telefoneDigits, msgId });
    } catch (err) {
      // Silencia erro se a mensagem já foi lida por outro meio
    }
  },

  async enviarMensagem() {
    // Refs cacheadas antes do await (achado da homologação do Lote 2): se o
    // cliente navegar para outra rota enquanto a Cloud Function está em voo,
    // re-consultar document.getElementById() depois do await devolve null
    // (a tela de Mensagens já não existe mais) — mesmo padrão defensivo já
    // usado em _enviarAgendamento()/_enviarSolicitacaoDiagnostico(). Um
    // elemento cacheado, mesmo destacado do DOM, aceita `.value`/`.style`
    // sem lançar.
    const nomeEl = document.getElementById('msg-nome');
    const textoEl = document.getElementById('msg-texto');
    const errorEl = document.getElementById('msg-error');
    const btn = document.getElementById('btn-msg');
    const loading = document.getElementById('btn-msg-loading');

    const nome = nomeEl.value.trim();
    const texto = textoEl.value.trim();

    if (!nome) {
      errorEl.textContent = '📝 Digite seu nome';
      nomeEl.focus();
      return;
    }
    if (!texto) {
      errorEl.textContent = '💬 Digite sua mensagem';
      textoEl.focus();
      return;
    }
    if (texto.length < 3) {
      errorEl.textContent = '📝 A mensagem deve ter pelo menos 3 caracteres';
      textoEl.focus();
      return;
    }

    errorEl.textContent = '';
    btn.style.display = 'none';
    loading.style.display = '';

    try {
      await window.PortalFunctions.enviarMensagem({
        phoneDigits: this.session.telefoneDigits,
        clientName: this.session.clientName,
        nome,
        texto,
      });
      textoEl.value = '';
      this._toast('Mensagem enviada com sucesso!', 'success');
      await this._carregarMensagens();
    } catch (err) {
      console.error('[Portal] Erro ao enviar mensagem:', err);
      errorEl.textContent = '❌ Erro ao enviar. Tente novamente.';
      this._toast('Erro ao enviar mensagem', 'error');
    }
    btn.style.display = '';
    loading.style.display = 'none';
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
            <textarea id="solicitacao-desc" class="solicitacao-input solicitacao-textarea" rows="5" placeholder="Ex: Não liga, tela trincada, superaquecendo..."></textarea>

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

  // ===== AGENDAMENTO — HELPERS DE HORÁRIO =====

  async _buscarHorariosOcupados(dataISO) {
    try {
      const resp = await window.PortalFunctions.listarHorariosOcupados({ data: dataISO });
      return resp.data.ocupados || [];
    } catch (e) {
      console.warn('[Portal] Erro ao buscar horários ocupados:', e);
      return [];
    }
  },

  _gerarHorariosDisponiveis(dataISO, horariosOcupados = []) {
    if (!dataISO) return [];
    const data = new Date(dataISO + 'T12:00:00');
    const diaSemana = data.getDay(); // 0=domingo, 6=sábado
    const cfg = this._horariosConfig;
    const config = diaSemana === 0
      ? cfg.domingo
      : (diaSemana === 6 ? cfg.sabado : cfg.diasSemana);
    if (!config || config.fechado) return [];
    const [hInicio, mInicio] = config.inicio.split(':').map(Number);
    const [hFim, mFim] = config.fim.split(':').map(Number);
    const intervalo = config.intervaloMin || 30;
    const inicio = hInicio * 60 + mInicio;
    const fim = hFim * 60 + mFim;
    const ocupadosSet = new Set(horariosOcupados);
    const slots = [];
    for (let min = inicio; min < fim; min += intervalo) {
      const h = String(Math.floor(min / 60)).padStart(2, '0');
      const m = String(min % 60).padStart(2, '0');
      const horario = `${h}:${m}`;
      slots.push({ valor: horario, disponivel: !ocupadosSet.has(horario) });
    }
    return slots;
  },

  async _atualizarHorariosDisponiveis() {
    const dataInput = document.getElementById('ag-data');
    const horarioSelect = document.getElementById('ag-horario-select');
    if (!dataInput || !horarioSelect) return;
    const dataISO = dataInput.value;
    if (!dataISO) return;

    horarioSelect.innerHTML = '<option value="">Carregando...</option>';
    horarioSelect.disabled = true;

    // Tenta carregar config do Firestore (Feature #3); usa fallback local se falhar
    try {
      const db = window.db;
      const { doc, getDoc } = window.FirebaseModules;
      if (db && getDoc) {
        const snap = await getDoc(doc(db, 'config', 'horarios'));
        if (snap.exists()) {
          const d = snap.data();
          this._horariosConfig = {
            diasSemana: { inicio: d.segSex?.inicio || '08:00', fim: d.segSex?.fim || '18:00', intervaloMin: d.segSex?.intervalo || 30 },
            sabado:     { inicio: d.sabado?.inicio || '08:00', fim: d.sabado?.fim || '14:00', intervaloMin: d.sabado?.intervalo || 30, fechado: d.sabado?.fechado || false },
            domingo:    { fechado: d.domingo?.fechado !== false },
            vagasPorHorario: d.vagasPorHorario || 2
          };
        }
      }
    } catch (e) { /* usa config local */ }

    const ocupados = await this._buscarHorariosOcupados(dataISO);
    const slots = this._gerarHorariosDisponiveis(dataISO, ocupados);

    if (slots.length === 0) {
      horarioSelect.innerHTML = '<option value="">🚫 Loja fechada nesta data</option>';
      horarioSelect.disabled = true;
      return;
    }

    const vagasMax = this._horariosConfig.vagasPorHorario || 2;
    const ocupadosCount = {};
    ocupados.forEach(h => { ocupadosCount[h] = (ocupadosCount[h] || 0) + 1; });

    let html = '<option value="">Selecione um horário...</option>';
    slots.forEach(s => {
      const qtd = ocupadosCount[s.valor] || 0;
      const cheio = qtd >= vagasMax;
      if (cheio) {
        html += `<option value="${s.valor}" disabled>${s.label || s.valor} — 🔴 Lotado</option>`;
      } else {
        const vagas = vagasMax - qtd;
        html += `<option value="${s.valor}">${s.valor}${qtd > 0 ? ` — ⚡ ${vagas} vaga(s)` : ''}</option>`;
      }
    });

    horarioSelect.innerHTML = html;
    horarioSelect.disabled = false;
  },

  // ===== AGENDAR ATENDIMENTO =====
  // Reserva de horário para atendimento inicial / avaliação / recebimento.
  // NÃO representa prazo de conclusão do reparo (aviso obrigatório no form).
  renderAgendar() {
    const el = document.getElementById('app-content');
    const s = this.session;

    // Data mínima = hoje (não permite agendar no passado)
    const hoje = new Date();
    const minData = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

    const ags = this.currentAgendamentos || [];

    let historico = '';
    if (ags.length > 0) {
      historico = `
        <div class="msg-history">
          <h3 class="msg-history-title">📜 Meus Agendamentos</h3>
          ${ags.map(a => {
            const st = AGENDAMENTO_STATUS[a.status] || { label: a.status || '—', cor: '#999', icon: '📅' };
            const dataFmt = this._fmtDataAgendamento(a.data);
            const tipo = AGENDAMENTO_TIPO_EQUIP[a.tipoEquipamento] || this._esc(a.tipoEquipamento || '');
            const motivo = AGENDAMENTO_MOTIVO[a.motivo] || this._esc(a.motivo || '');
            return `
              <div class="msg-item">
                <div class="msg-item-header">
                  <span class="msg-item-name">📅 ${dataFmt}${a.horario ? ' • ⏰ ' + this._esc(a.horario) : ''}</span>
                  <span class="os-card-status" style="background:${st.cor}20;color:${st.cor};border:1px solid ${st.cor}40;">${st.icon} ${st.label}</span>
                </div>
                <div class="msg-item-text">
                  ${tipo ? `${tipo}` : ''}${motivo ? ` • ${motivo}` : ''}
                  ${a.observacoes ? `<br><span style="color:#888;">📝 ${this._esc(a.observacoes)}</span>` : ''}
                </div>
                ${a.status === 'confirmado' ? `
                  <div class="msg-item-resposta">
                    <div class="msg-resposta-header">✅ Agendamento Confirmado</div>
                    <div class="msg-resposta-text">📅 ${dataFmt}${a.horario ? ' • ⏰ ' + this._esc(a.horario) : ''}<br><span style="color:#888;font-size:12px;">Este horário refere-se ao atendimento inicial do equipamento.</span></div>
                  </div>
                ` : ''}
                ${a.status === 'reagendado' && a.observacaoAdmin ? `
                  <div class="msg-item-resposta">
                    <div class="msg-resposta-header">🔄 Reagendado pela Cell City</div>
                    <div class="msg-resposta-text">${this._esc(a.observacaoAdmin)}</div>
                  </div>
                ` : ''}
                ${a.status === 'cancelado' ? `
                  <div class="msg-item-resposta">
                    <div class="msg-resposta-header">❌ Agendamento Não Confirmado</div>
                    <div class="msg-resposta-text">Motivo: ${this._esc(a.observacaoAdmin || 'Horário indisponível')}</div>
                  </div>
                ` : ''}
                ${a.status === 'aguardando' ? `<div class="msg-aguardando">⏳ Aguardando confirmação da loja...</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    el.innerHTML = `
      <div class="msg-container">
        <h2 class="screen-title">📅 Agendar Atendimento</h2>
        <p class="avaliar-subtitle">Reserve um horário para atendimento, avaliação ou recebimento do seu equipamento.</p>

        <div class="msg-form">
          <div class="msg-form-group">
            <label class="msg-label">Nome *</label>
            <input type="text" id="ag-nome" class="msg-input" value="${this._esc(s.clientName || '')}" placeholder="Seu nome">
          </div>
          <div class="msg-form-group">
            <label class="msg-label">Telefone *</label>
            <input type="tel" id="ag-telefone" class="msg-input" value="${this._esc(s.telefone || '')}" placeholder="(00) 00000-0000" maxlength="15" inputmode="numeric">
          </div>
          <div class="msg-form-group" style="display:flex;gap:10px;">
            <div style="flex:1;">
              <label class="msg-label">Data desejada *</label>
              <input type="date" id="ag-data" class="msg-input" min="${minData}">
            </div>
            <div style="flex:1;">
              <label class="msg-label">Horário desejado *</label>
              <select id="ag-horario-select" class="solicitacao-select" disabled>
                <option value="">Selecione uma data primeiro...</option>
              </select>
            </div>
          </div>
          <div class="msg-form-group">
            <label class="msg-label">Tipo de equipamento *</label>
            <select id="ag-equipamento" class="solicitacao-select">
              <option value="">Selecione...</option>
              <option value="celular">📱 Celular</option>
              <option value="notebook">💻 Notebook</option>
              <option value="impressora">🖨️ Impressora</option>
              <option value="outro">🔧 Outro</option>
            </select>
          </div>
          <div class="msg-form-group">
            <label class="msg-label">Motivo do atendimento *</label>
            <select id="ag-motivo" class="solicitacao-select">
              <option value="">Selecione...</option>
              <option value="avaliacao">🔍 Avaliação / Diagnóstico</option>
              <option value="troca_tela">📱 Troca de Tela</option>
              <option value="troca_bateria">🔋 Troca de Bateria</option>
              <option value="nao_liga">⚡ Não Liga</option>
              <option value="molhou">💧 Molhou</option>
              <option value="atualizacao">🔄 Atualização</option>
              <option value="outro">🔧 Outro</option>
            </select>
          </div>
          <div class="msg-form-group">
            <label class="msg-label">Observações</label>
            <textarea id="ag-observacoes" class="msg-input msg-textarea" placeholder="Campo opcional..." rows="3"></textarea>
          </div>

          <!-- AVISO OBRIGATÓRIO -->
          <div class="painel-aviso" style="display:block;text-align:left;background:rgba(255,167,38,0.10);border-color:rgba(255,167,38,0.35);line-height:1.5;">
            ⚠️ <strong>Importante:</strong> Este agendamento é destinado ao atendimento inicial, avaliação ou recebimento do equipamento.
            A conclusão do serviço dependerá da análise técnica, disponibilidade de peças e complexidade do reparo.
          </div>

          <div class="msg-error" id="ag-error"></div>
          <button id="btn-ag" class="login-btn" onclick="Portal._enviarAgendamento()">📅 Solicitar Agendamento</button>
          <button id="btn-ag-loading" class="login-btn" style="display:none" disabled>
            <span class="spinner"></span> Enviando...
          </button>
        </div>

        ${historico}
      </div>
    `;

    // Máscara de telefone
    const tel = document.getElementById('ag-telefone');
    if (tel) {
      tel.addEventListener('input', (e) => {
        e.target.value = window.PhoneUtils.maskPhone(e.target.value);
      });
    }

    // Listener: ao mudar a data, carrega os horários disponíveis
    const dataInput = document.getElementById('ag-data');
    if (dataInput) {
      dataInput.addEventListener('change', () => this._atualizarHorariosDisponiveis());
    }
  },

  async _enviarAgendamento() {
    const nome = document.getElementById('ag-nome')?.value.trim();
    const telefone = document.getElementById('ag-telefone')?.value.trim();
    const data = document.getElementById('ag-data')?.value;
    const horario = document.getElementById('ag-horario-select')?.value;
    const tipoEquipamento = document.getElementById('ag-equipamento')?.value;
    const motivo = document.getElementById('ag-motivo')?.value;
    const observacoes = document.getElementById('ag-observacoes')?.value.trim();
    const errorEl = document.getElementById('ag-error');

    const fail = (msg, id) => {
      if (errorEl) errorEl.textContent = msg;
      document.getElementById(id)?.focus();
    };

    if (!nome) return fail('📝 Digite seu nome', 'ag-nome');
    if (!telefone || telefone.replace(/\D/g, '').length < 10) return fail('📞 Digite um telefone válido com DDD', 'ag-telefone');
    if (!data) return fail('📅 Selecione a data desejada', 'ag-data');
    if (!horario) return fail('⏰ Selecione o horário desejado', 'ag-horario-select');
    if (!tipoEquipamento) return fail('🔧 Selecione o tipo de equipamento', 'ag-equipamento');
    if (!motivo) return fail('🔍 Selecione o motivo do atendimento', 'ag-motivo');

    if (errorEl) errorEl.textContent = '';
    const btn = document.getElementById('btn-ag');
    const loading = document.getElementById('btn-ag-loading');
    if (btn) btn.style.display = 'none';
    if (loading) loading.style.display = '';

    try {
      await window.PortalFunctions.criarAgendamento({
        phoneDigits: this.session?.telefoneDigits || window.PhoneUtils.normalizePhoneDigits(telefone),
        telefoneInformado: telefone,
        clientName: this.session?.clientName || nome,
        nome,
        data,
        horario,
        tipoEquipamento,
        motivo,
        observacoes: observacoes || '',
      });
      this._toast('Agendamento solicitado! Aguarde a confirmação da loja.', 'success');
      // Limpa os campos editáveis (mantém nome/telefone da sessão)
      ['ag-data', 'ag-observacoes'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
      ['ag-equipamento', 'ag-motivo'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
      const selHorario = document.getElementById('ag-horario-select');
      if (selHorario) { selHorario.innerHTML = '<option value="">Selecione uma data primeiro...</option>'; selHorario.disabled = true; }
      await this._carregarAgendamentos();
    } catch (err) {
      console.error('[Portal] Erro ao enviar agendamento:', err);
      if (errorEl) errorEl.textContent = '❌ Erro ao enviar. Tente novamente.';
      this._toast('Erro ao solicitar agendamento', 'error');
    } finally {
      if (btn) btn.style.display = '';
      if (loading) loading.style.display = 'none';
    }
  },

  // Formata "YYYY-MM-DD" → "DD/MM/YYYY" (data do <input type=date>, sem fuso)
  _fmtDataAgendamento(data) {
    if (!data) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data.split('-').reverse().join('/');
    return this._fmtDate(data);
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
    this.session = null;
    this.currentOS = [];
    this.currentMsgs = [];
    this.currentAgendamentos = [];
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
    if (!this.session?.telefoneDigits) return; // eventos só existem depois do login (mesmo comportamento de antes)
    try {
      await window.PortalFunctions.registrarEvento({
        phoneDigits: this.session.telefoneDigits,
        clientName: this.session.clientName,
        tipo,
        dados,
      });
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
      await window.PortalFunctions.criarSolicitacaoDiagnostico({
        phoneDigits: this.session?.telefoneDigits || '',
        clientName: this.session?.clientName || '',
        tipoEquipamento: equip,
        marca: marca,
        modelo: modelo,
        descricao: desc,
      });
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
