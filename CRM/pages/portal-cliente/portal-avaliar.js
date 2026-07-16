/* ============================================
   PORTAL-AVALIAR.JS — Tela de avaliação do atendimento do Portal do Cliente
   P2.2 (2026-07-16): extraído de portal.js (split por responsabilidade).
   Estende window.Portal — carregar DEPOIS de portal.js no index.html.
   ============================================ */
Object.assign(window.Portal, {
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
});
