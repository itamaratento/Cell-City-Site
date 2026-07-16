/* ============================================
   PORTAL-MENSAGENS.JS — Tela de mensagens do Portal do Cliente
   P2.2 (2026-07-16): extraído de portal.js (split por responsabilidade).
   Estende window.Portal — carregar DEPOIS de portal.js no index.html.
   ============================================ */
Object.assign(window.Portal, {
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
      /* O link 'Ver todas' foi removido — o histórico já é exibido completo na tela */
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
});
