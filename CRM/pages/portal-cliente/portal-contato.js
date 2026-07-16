/* ============================================
   PORTAL-CONTATO.JS — Contato, Como Chegar e Solicitação de Diagnóstico
   P2.2 (2026-07-16): extraído de portal.js (split por responsabilidade).
   Estende window.Portal — carregar DEPOIS de portal.js no index.html.
   ============================================ */
Object.assign(window.Portal, {
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
});
