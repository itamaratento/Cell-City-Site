/* ============================================
   PORTAL-AUTH.JS — Login e sincronização de OS do Portal do Cliente
   P2.2 (2026-07-16): extraído de portal.js (split por responsabilidade).
   Estende window.Portal — carregar DEPOIS de portal.js no index.html.
   ============================================ */
Object.assign(window.Portal, {
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
    const formatted = this._phoneMask(digits); // formato canônico (exibição na sessão)

    false && console.log('[Portal] Buscando cliente — digits:', digits, 'formatted:', formatted); // PII desabilitado PS-6

    // Busca do nome em clientes via Cloud Function (Admin SDK).
    let clientName = '';
    try {
      const resp = await window.PortalFunctions.obterNomeCliente({ phoneDigits: digits });
      clientName = (resp.data && resp.data.name) || '';
      false && console.log('[Portal] Nome do cliente (Cloud Function):', clientName, '| phoneDigits:', digits);
    } catch (errCliente) {
      console.warn('[Portal] Não foi possível obter o nome do cliente (portalObterNomeCliente):', errCliente);
    }

    // Busca OS do cliente pelo telefone — via Cloud Function.
    let osCount = 0;
    try {
      const respOS = await window.PortalFunctions.consultarOSPorTelefone({ phoneDigits: digits });
      osCount = ((respOS.data && respOS.data.lista) || []).length;
    } catch (errOS) {
      console.warn('[Portal] Não foi possível consultar OS no login:', errOS);
    }
    console.log('[Portal] OSs encontradas (Cloud Function):', osCount);

    if (osCount === 0 && !clientName) {
      false && console.log('[Portal] Nenhum resultado para o telefone:', formatted); // PII desabilitado PS-6
      return false;
    }

    // Cria sessão
    this.session = {
      telefone: formatted,
      telefoneDigits: digits,
      clientName: clientName || `Cliente`,
      osCount
    };
    sessionStorage.setItem('portal_session', JSON.stringify(this.session));

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
    // Polling via Cloud Function (consultarOSPorTelefonePublica).
    if (this.unsubscribeOS) this.unsubscribeOS();
    const timer = setInterval(() => this._fetchOS(), 60000);
    this.unsubscribeOS = () => clearInterval(timer);
    this._fetchOS();
  },

  async _fetchOS() {
    if (!this.session) return;
    const digits = this.session.telefoneDigits || this._phoneDigits(this.session.telefone);
    let lista = [];
    try {
      const resp = await window.PortalFunctions.consultarOSPorTelefone({ phoneDigits: digits });
      lista = (resp.data && resp.data.lista) || [];
    } catch (err) {
      console.warn('[Portal] Erro ao atualizar OS via Cloud Function:', err);
      return;
    }
    this.currentOS = lista.map(os => ({ firestoreId: os.id, ...os }));
    this.currentOS.sort((a, b) => {
      const da = a.createdAt || a.updatedAt || '';
      const db_ = b.createdAt || b.updatedAt || '';
      return db_ > da ? 1 : -1;
    });
    const hashParts = location.hash.replace(/^#\/?/, '').split('/');
    const route = hashParts[0];
    if (route === 'os') this.renderOSList();
    else if (route === 'os-detalhe') {
      const id = hashParts[1];
      if (id) this.renderOSDetalhe(id);
    }
    else if (route === 'painel') this.renderPainel();
    else if (route === 'garantias') this.renderGarantias();
  },

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
    const route = location.hash.replace(/^#\/?/, '').split('/')[0];
    if (route === 'mensagens') this.renderMensagens();
  },

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
});
