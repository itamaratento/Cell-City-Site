/* ============================================
   PORTAL-OS.JS — Lista, detalhe e orçamento de OS do Portal do Cliente
   P2.2 (2026-07-16): extraído de portal.js (split por responsabilidade).
   Estende window.Portal — carregar DEPOIS de portal.js no index.html.
   ============================================ */
Object.assign(window.Portal, {
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
      el.innerHTML = `<div class="os-container"><div class="empty-state"><p>Ordem de serviço não encontrada.</p><button class="login-btn" onclick="Portal.navegar('os')">Voltar</button></div></div>`;
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
            ${o.cpfMascarado ? `<div class="os-detail-row"><span class="os-detail-label">🆔 CPF</span><span class="os-detail-value">${this._esc(o.cpfMascarado)}</span></div>` : ''}
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

    // Link da Nota Fiscal (colado manualmente pela equipe após upload no
    // Google Drive — não é gerado nem armazenado pelo CRM). Restaurado
    // 2026-07-11: existia antes do rollback do SaaS, perdido em 27/06.
    if (o.nfLink) {
      html += `
        <div class="os-detail-section">
          <h3 class="os-detail-section-title">📄 Nota Fiscal</h3>
          <a href="${this._esc(o.nfLink)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:12px 18px;background:linear-gradient(135deg,#1976D2,#1565C0);color:#fff;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;">
            👁️ Visualizar Nota Fiscal
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
    body.innerHTML = '<p style="margin-bottom:12px;color:#666;">Deseja aprovar este orçamento?</p><div style="margin-bottom:12px;"><label style="font-size:13px;color:#888;display:block;margin-bottom:4px;">Observação <span style="color:#aaa;">(opcional)</span></label><textarea id="orc-obs-input" rows="2" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:14px;resize:vertical;" placeholder="Ex.: Pode prosseguir, tenho urgência..."></textarea></div><div style="display:flex;gap:8px;margin-top:16px;"><button onclick="Portal._fecharModal();" style="flex:1;padding:12px;background:#f5f5f5;border:1px solid #ddd;border-radius:8px;cursor:pointer;font-weight:600;">Cancelar</button><button onclick="Portal._executarAprovacao(\'' + osId + '\')" style="flex:1;padding:12px;background:#00C853;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;">Confirmar Aprovação</button></div>';
  },

  _exibirModalEscolhaOrcamento(osId, o) {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    const body = document.getElementById('orc-modal-body');
    const title = document.getElementById('orc-modal-title');
    if (!body || !title) return;
    overlay.style.display = 'flex';
    title.textContent = 'Selecione a opção desejada';
    const desc1 = o.orc1Desc ? '<div class="orc-modal-opcao-desc">' + this._esc(o.orc1Desc) + '</div>' : '';
    const desc2 = o.orc2Desc ? '<div class="orc-modal-opcao-desc">' + this._esc(o.orc2Desc) + '</div>' : '';
    body.innerHTML = '<div class="orc-modal-opcoes"><label class="orc-modal-opcao" data-opcao="1"><input type="radio" name="orc-escolha" value="1" checked><div class="orc-modal-opcao-content"><div class="orc-modal-opcao-titulo">Opção 1</div>' + desc1 + '<div class="orc-modal-opcao-valor">R$ ' + Number(o.orc1Valor).toFixed(2) + '</div></div></label><label class="orc-modal-opcao" data-opcao="2"><input type="radio" name="orc-escolha" value="2"><div class="orc-modal-opcao-content"><div class="orc-modal-opcao-titulo">Opção 2</div>' + desc2 + '<div class="orc-modal-opcao-valor">R$ ' + Number(o.orc2Valor).toFixed(2) + '</div></div></label></div><div style="margin-top:12px;"><label style="font-size:13px;color:#888;display:block;margin-bottom:4px;">Observação <span style="color:#aaa;">(opcional)</span></label><textarea id="orc-obs-input" rows="2" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:14px;resize:vertical;" placeholder="Ex.: Quero a peça original, retiro amanhã..."></textarea></div><div style="display:flex;gap:8px;margin-top:16px;"><button onclick="Portal._fecharModal();" style="flex:1;padding:12px;background:#f5f5f5;border:1px solid #ddd;border-radius:8px;cursor:pointer;font-weight:600;">Cancelar</button><button onclick="Portal._executarAprovacao(\'' + osId + '\')" style="flex:1;padding:12px;background:#00C853;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;">Confirmar Aprovação</button></div>';
  },

  async _executarAprovacao(osId) {
    const selectedRadio = document.querySelector('input[name="orc-escolha"]:checked');
    const escolha = selectedRadio ? selectedRadio.value : null;
    const obs = document.getElementById('orc-obs-input')?.value?.trim() || '';
    this._fecharModal();
    try {
      // portalResponderOrcamento (Sprint 1b) substitui o updateDoc direto e
      // adiciona a checagem que faltava: phoneDigits do payload precisa bater
      // com o phoneDigits gravado na OS. PS-6: sem listener em tempo real,
      // o refresh é imediato via _fetchOS().
      await window.PortalFunctions.responderOrcamento({
        osId, phoneDigits: this.session.telefoneDigits, resposta: 'aprovado', escolha, obs: obs || undefined,
      });
      this._toast('Orçamento aprovado! Entraremos em contato.');
      await this._fetchOS();
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
      this._toast('Orçamento recusado. Seu aparelho será devolvido.');
      await this._fetchOS();
    } catch (err) {
      console.error('[Portal] Erro ao recusar:', err);
      this._toast(err.message || 'Erro ao recusar. Tente novamente.');
    }
  },

  _fecharModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'none';
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
  },
});
