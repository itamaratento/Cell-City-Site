/* ============================================
   Portal do Cliente — Cell City Informática
   Módulo SPA do CRM

   P2.2 (2026-07-16): módulo dividido por responsabilidade — este arquivo
   é só o núcleo (estado + boot + roteamento + dados da loja + telefone +
   utilitários + logout). As demais telas vivem em arquivos irmãos
   (portal-auth.js, portal-painel.js, portal-os.js, portal-garantias.js,
   portal-avaliar.js, portal-mensagens.js, portal-contato.js,
   portal-agendamento.js), cada um com `Object.assign(window.Portal, {...})`
   — mesmo padrão de scripts clássicos (sem type="module") já usado no
   catálogo de scripts do index.html. Comportamento e API pública
   (`window.Portal`/`Portal.*`) preservados; zero mudança funcional.

   Constantes abaixo usam `var` (não `const`) DE PROPÓSITO: scripts
   clássicos separados não compartilham bindings `const`/`let` de topo,
   mas `var` no escopo global vira `window.X` — visível em todos os
   arquivos-irmãos carregados depois deste no index.html, exatamente como
   os métodos já acessavam antes da divisão (STATUS_LABEL, LOJA_DEFAULT
   etc. continuam bare identifiers no restante do código).
   ============================================ */

// ===== CONSTANTES =====
var STATUS_LABEL = {
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

var PRAZO_GARANTIA_DIAS = 90; // 3 meses padrão

// ===== STATUS DO AGENDAMENTO =====
// O agendamento é apenas reserva de horário para atendimento inicial / avaliação /
// recebimento — NÃO representa prazo de conclusão do reparo.
var AGENDAMENTO_STATUS = {
  'aguardando':  { label: 'Aguardando Confirmação', cor: '#FFA726', icon: '⏳' },
  'confirmado':  { label: 'Confirmado',             cor: '#00C853', icon: '✅' },
  'reagendado':  { label: 'Reagendado',             cor: '#42A5F5', icon: '🔄' },
  'cancelado':   { label: 'Não Confirmado',         cor: '#EF5350', icon: '❌' },
  'atendido':    { label: 'Atendimento Realizado',  cor: '#78909C', icon: '✔️' }
};

var AGENDAMENTO_TIPO_EQUIP = {
  celular:    '📱 Celular',
  notebook:   '💻 Notebook',
  impressora: '🖨️ Impressora',
  outro:      '🔧 Outro'
};

var AGENDAMENTO_MOTIVO = {
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
var LOJA_DEFAULT = {
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
    false && console.log('[Portal] sessionStorage.portal_session:', sessionStorage.getItem('portal_session')); // PII desabilitado — SEC-CONSOLE-001 (logava telefone da sessão)

    // Tenta restaurar sessão
    const saved = sessionStorage.getItem('portal_session');
    if (saved) {
      try {
        this.session = JSON.parse(saved);
        // Sessões salvas antes da padronização de telefone não têm telefoneDigits.
        if (!this.session.telefoneDigits && this.session.telefone) {
          this.session.telefoneDigits = this._phoneDigits(this.session.telefone);
        }
        false && console.log('[Portal] Sessão restaurada:', JSON.stringify(this.session));
        false && console.log('[AUDIT:BOOT] telefone da sessão restaurada:', JSON.stringify(this.session?.telefone));

        // Inicia listeners em tempo real para a sessão restaurada
        false && console.log('[AUDIT:BOOT] Iniciando _listenOS() e _carregarMensagens() para sessão restaurada');
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
        false && console.log('[Portal] Auto-login vindo da OS — telefone:', digitsAuto); // PII desabilitado PS-6
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
};

// ===== AUTO-INIT =====
// Disparado aqui (último script do bloco Portal carregado no index.html) —
// todos os Object.assign(window.Portal, {...}) dos arquivos-irmãos já
// rodaram antes deste ponto (scripts clássicos executam em ordem, de forma
// síncrona, bem antes do DOMContentLoaded).
document.addEventListener('DOMContentLoaded', () => window.Portal.init());
