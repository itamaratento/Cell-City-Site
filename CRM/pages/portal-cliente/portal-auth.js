/* ============================================
   PORTAL-AUTH.JS — Login e sincronização de OS do Portal do Cliente
   P2.2 (2026-07-16): extraído de portal.js (split por responsabilidade).
   Estende window.Portal — carregar DEPOIS de portal.js no index.html.

   Segurança (2026-11): login exige telefone + código de 4 dígitos
   (últimos 4 do CPF da OS, ou portalAccessCode gerado na criação).
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

    const pendingTel = this._pendingLogin?.tel
      ? this._phoneMask(this._pendingLogin.tel)
      : '';

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
          <p>Acesse com seu telefone e o código de 4 dígitos</p>
          <div class="login-form-box">
            <div class="login-form-group">
              <input type="tel" id="login-phone" class="login-input"
                     placeholder="Telefone" maxlength="15"
                     inputmode="numeric" autocomplete="tel"
                     value="${this._esc(pendingTel)}">
            </div>
            <div class="login-form-group">
              <input type="password" id="login-codigo" class="login-input"
                     placeholder="Código de acesso (4 dígitos)" maxlength="4"
                     inputmode="numeric" autocomplete="one-time-code"
                     pattern="[0-9]*">
              <span class="login-hint" id="login-hint">
                4 últimos dígitos do CPF ou o código informado pela loja
              </span>
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
    const codigoInput = document.getElementById('login-codigo');
    if (!input || !codigoInput) {
      console.error('[Portal] ERRO: campos de login não encontrados após render!');
      return;
    }
    input.addEventListener('input', (e) => {
      e.target.value = window.PhoneUtils.maskPhone(e.target.value);
      document.getElementById('login-error').textContent = '';
    });
    codigoInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
      document.getElementById('login-error').textContent = '';
    });

    // Enter: do telefone → foca código; do código → login
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        codigoInput.focus();
      }
    });
    codigoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.doLogin();
    });

    setTimeout(() => {
      if (pendingTel) codigoInput.focus();
      else input.focus();
    }, 300);
  },

  // Núcleo do login — telefone + código de 4 dígitos (CPF ou portalAccessCode).
  // Usado por doLogin() e, após o link ?tel=&os=, pelo formulário já pré-preenchido
  // (NÃO autentica sozinho só com o telefone da URL).
  async _autenticarComDigits(digits, codigo) {
    const formatted = this._phoneMask(digits);
    const codigoNorm = String(codigo || '').replace(/\D/g, '').slice(0, 4);
    if (codigoNorm.length !== 4) return false;

    let clientName = '';
    let osCount = 0;
    try {
      const resp = await window.PortalFunctions.autenticar({
        phoneDigits: digits,
        codigoAcesso: codigoNorm,
        osId: this._pendingLogin?.os || null,
      });
      if (!resp.data || !resp.data.ok) return false;
      clientName = resp.data.clientName || '';
      osCount = resp.data.osCount || 0;
    } catch (err) {
      console.warn('[Portal] Falha na autenticação do portal:', err?.code || err);
      return false;
    }

    // Cria sessão (codigoAcesso fica na sessão para as consultas seguintes)
    this.session = {
      telefone: formatted,
      telefoneDigits: digits,
      clientName: clientName || 'Cliente',
      osCount,
      codigoAcesso: codigoNorm,
    };
    sessionStorage.setItem('portal_session', JSON.stringify(this.session));

    this._registrarEvento('acesso', {
      telefone: this.session.telefone,
      clientName: this.session.clientName
    });

    this._listenOS();
    this._carregarMensagens();
    this._carregarAgendamentos();
    return true;
  },

  async doLogin() {
    const input = document.getElementById('login-phone');
    const codigoInput = document.getElementById('login-codigo');
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');
    const loading = document.getElementById('btn-login-loading');

    const raw = input.value.replace(/\D/g, '');
    const codigo = (codigoInput?.value || '').replace(/\D/g, '');

    if (raw.length < 10 || raw.length > 11) {
      errorEl.textContent = 'Digite um telefone válido com DDD';
      input.focus();
      return;
    }
    if (codigo.length !== 4) {
      errorEl.textContent = 'Digite o código de acesso com 4 dígitos';
      codigoInput?.focus();
      return;
    }

    btn.style.display = 'none';
    loading.style.display = '';
    errorEl.textContent = '';

    try {
      const digits = this._phoneDigits(raw);
      const ok = await this._autenticarComDigits(digits, codigo);
      if (!ok) {
        btn.style.display = '';
        loading.style.display = 'none';
        errorEl.textContent = 'Telefone ou código inválidos. Confira e tente de novo.';
        return;
      }
      const osDestino = this._pendingLogin?.os;
      this._pendingLogin = null;
      location.hash = osDestino ? `#/os-detalhe/${osDestino}` : '#painel';
    } catch (err) {
      console.error('[Portal] Erro no login:', err);
      btn.style.display = '';
      loading.style.display = 'none';
      errorEl.textContent = 'Erro ao conectar. Tente novamente.';
    }
  },

  // ===== LISTENERS EM TEMPO REAL =====
  _listenOS() {
    if (!this.session?.telefone) {
      console.warn('[Portal] _listenOS() cancelado — sessão sem telefone');
      return;
    }
    // PS-6: o onSnapshot direto em `os` foi substituído por polling via
    // Cloud Function (consultarOSPorTelefonePublica) — era a última
    // dependência que obrigava as Rules a manter `list` de /os aberto a
    // qualquer sessão autenticada (inclusive anônima), expondo TODOS os
    // campos de TODAS as OS (senha/padrão/foto de desbloqueio, endereço,
    // IMEI) a quem soubesse chamar a API. Perde-se o push em tempo real;
    // o intervalo de 60s cobre o caso de uso (cliente acompanhando a
    // própria OS) com custo de leitura menor que o listener.
    if (this.unsubscribeOS) this.unsubscribeOS();
    const timer = setInterval(() => this._fetchOS(), 60000);
    this.unsubscribeOS = () => clearInterval(timer);
    this._fetchOS();
  },

  async _fetchOS() {
    if (!this.session) return;
    const digits = this.session.telefoneDigits || this._phoneDigits(this.session.telefone);
    const codigo = this.session.codigoAcesso;
    if (!codigo) {
      console.warn('[Portal] Sessão sem código de acesso — forçando logout');
      this.logout();
      return;
    }
    let lista = [];
    try {
      const resp = await window.PortalFunctions.consultarOSPorTelefone({
        phoneDigits: digits,
        codigoAcesso: codigo,
      });
      lista = (resp.data && resp.data.lista) || [];
    } catch (err) {
      console.warn('[Portal] Erro ao atualizar OS via Cloud Function:', err);
      if (err?.code === 'functions/permission-denied' || err?.code === 'permission-denied') {
        this.logout();
      }
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
