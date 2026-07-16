/* ============================================
   PORTAL-AGENDAMENTO.JS — Agendamento de atendimento do Portal do Cliente
   P2.2 (2026-07-16): extraído de portal.js (split por responsabilidade).
   Estende window.Portal — carregar DEPOIS de portal.js no index.html.
   ============================================ */
Object.assign(window.Portal, {
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
});
