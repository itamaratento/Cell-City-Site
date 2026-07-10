/* ============================================
CELL CITY CRM — DASHBOARD — INTERFACE
Etapa 6 da refatoração modular: relógio, calendário, notas, config de alertas,
grid de módulos (RBAC), navegação e modal de OS do alerta.
Mixin aplicado em Dashboard.prototype (ver dashboard.js) — mesmo `this` de sempre.
============================================ */
import { db, doc, setDoc, serverTimestamp, onSnapshot } from "../../scripts/firebase.js";
import { podeVisualizar } from '../../shared/permissoes.js';
import { RBAC_CARD_PARA_MODULO_ID, dashboardShared } from './dashboard-state.js';

export const dashboardUiMixin = {
  // ===== RELÓGIO & DATA COMPLETA =====
  setupClock() {
    const clockEl = document.getElementById('clock-display');
    const dateText = document.getElementById('date-text');
    const dayOfYearEl = document.getElementById('day-of-year-display');

    const update = () => {
      const now = new Date();

      // DATA COMPLETA — Ex: "Sexta-feira, 29 de maio de 2026"
      const dateOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      };
      let dateFull = now.toLocaleDateString('pt-BR', dateOptions);
      // Capitaliza a primeira letra
      dateFull = dateFull.charAt(0).toUpperCase() + dateFull.slice(1);

      // HORA APENAS — Ex: "17:50"
      const timeStr = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      // DIA DO ANO — Ex: "152"
      const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);

      if (dateText) dateText.textContent = dateFull;
      if (clockEl) clockEl.textContent = timeStr;
      if (dayOfYearEl) dayOfYearEl.textContent = dayOfYear;
    };

    update();
    setInterval(update, 1000);
  },

  // ===== BLOCO DE NOTAS =====
  setupNotas() {
    const btnNotas  = document.getElementById('dock-notas');
    const panel     = document.getElementById('nota-panel');
    const btnClose  = document.getElementById('nota-close');
    const textarea  = document.getElementById('nota-textarea');
    const statusEl  = document.getElementById('nota-status');
    if (!btnNotas || !panel || !textarea) return;

    // Identidade ESTÁVEL da conta (substitui o antigo cc_nota_uid aleatório).
    let docRef = doc(db, 'notas_usuarios', dashboardShared.uid);
    let saveTimer = null;
    let notaUnsub = null;

    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

    // Sincronização em tempo real — aplica valor remoto quando não está digitando
    const assinarNota = () => {
      if (notaUnsub) { notaUnsub(); notaUnsub = null; }
      docRef = doc(db, 'notas_usuarios', dashboardShared.uid);
      notaUnsub = onSnapshot(docRef, (snap) => {
        const remoto = snap.exists() ? (snap.data().conteudo || '') : '';
        if (document.activeElement !== textarea && textarea.value !== remoto) {
          textarea.value = remoto;
        }
        setStatus('✓ sincronizado');
      }, () => setStatus(''));
    };
    assinarNota();

    // Salva nota no Firestore (debounce 1s)
    const salvarNota = () => {
      clearTimeout(saveTimer);
      setStatus('digitando...');
      saveTimer = setTimeout(async () => {
        setStatus('salvando...');
        try {
          await setDoc(docRef, {
            conteudo:    textarea.value,
            atualizadoEm: serverTimestamp(),
            userId: dashboardShared.uid
          });
          setStatus('✓ salvo');
        } catch { setStatus('⚠ erro ao salvar'); }
      }, 1000);
    };

    // Abre/fecha painel
    btnNotas.addEventListener('click', () => {
      const aberto = panel.style.display !== 'none';
      panel.style.display = aberto ? 'none' : 'flex';
      if (!aberto) textarea.focus();
    });

    btnClose.addEventListener('click', () => { panel.style.display = 'none'; });

    // Auto-save ao digitar
    textarea.addEventListener('input', salvarNota);
  },

  // ===== MINI CALENDÁRIO =====
  setupCalendar() {
    const dateBtn = document.getElementById('date-display');
    const popup = document.getElementById('calendar-popup');
    const prevBtn = document.getElementById('cal-prev');
    const nextBtn = document.getElementById('cal-next');
    const noteInput = document.getElementById('cal-note-input');

    dateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCalendar();
    });

    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.state.calendar.viewDate.setMonth(this.state.calendar.viewDate.getMonth() - 1);
      this.renderCalendar();
    });

    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.state.calendar.viewDate.setMonth(this.state.calendar.viewDate.getMonth() + 1);
      this.renderCalendar();
    });

    noteInput.addEventListener('input', () => {
      if (!this.state.calendar.selectedDate) return;
      const key = `cellcity_note_${this.state.calendar.selectedDate}`;
      const value = noteInput.value.trim();
      if (value) {
        localStorage.setItem(key, value);
      } else {
        localStorage.removeItem(key);
      }
      this.renderCalendar();
    });

    this.renderCalendar();
  },

  toggleCalendar() {
    const popup = document.getElementById('calendar-popup');
    const dateBtn = document.getElementById('date-display');
    this.state.calendar.open = !this.state.calendar.open;
    popup.classList.toggle('visible', this.state.calendar.open);
    dateBtn.classList.toggle('active', this.state.calendar.open);
  },

  renderCalendar() {
    const viewDate = this.state.calendar.viewDate;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const today = new Date();
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    document.getElementById('cal-title').textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const grid = document.getElementById('cal-grid');
    grid.innerHTML = '';

    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      grid.appendChild(this.createCalDay(day, true, null));
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
      grid.appendChild(this.createCalDay(d, false, dateStr, isToday));
    }

    const totalCells = grid.children.length;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      grid.appendChild(this.createCalDay(i, true, null));
    }
  },

  createCalDay(day, isOtherMonth, dateStr, isToday = false) {
    const el = document.createElement('div');
    el.className = 'cal-day';
    if (isOtherMonth) el.classList.add('other-month');
    if (isToday) el.classList.add('today');
    if (dateStr && this.state.calendar.selectedDate === dateStr) el.classList.add('selected');
    if (dateStr && localStorage.getItem(`cellcity_note_${dateStr}`)) el.classList.add('has-note');
    el.textContent = day;
    if (!isOtherMonth && dateStr) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectCalDay(dateStr);
      });
    }
    return el;
  },

  selectCalDay(dateStr) {
    this.state.calendar.selectedDate = dateStr;
    const [y, m, d] = dateStr.split('-');
    const display = `${d}/${m}/${y}`;
    document.getElementById('cal-note-date').textContent = display;
    const noteArea = document.getElementById('cal-note-area');
    const noteInput = document.getElementById('cal-note-input');
    noteArea.style.display = 'block';
    noteInput.value = localStorage.getItem(`cellcity_note_${dateStr}`) || '';
    noteInput.focus();
    this.renderCalendar();
  },

  // ===== MÓDULOS =====
  setupModules() {
    document.querySelectorAll('.module-card[data-module]').forEach(card => {
      const moduloId = RBAC_CARD_PARA_MODULO_ID[card.getAttribute('data-module')];
      if (moduloId && !podeVisualizar(moduloId)) {
        card.style.display = 'none';
        return;
      }
      card.addEventListener('click', () => {
        const module = card.getAttribute('data-module');
        this.navigateTo(module);
      });
    });
  },

  navigateTo(module) {
    const routes = {
      os: '../../pages/os/index.html',
      'central-comandos': '../../pages/central-comandos/index.html',
      'central-informacoes': '../../pages/central-informacoes/index.html',
      autoatendimento: '../../pages/autoatendimento/index.html',
      clientes: '../../pages/clientes/index.html',
      caixa: '../../pages/caixa/index.html',
      estoque: '../../pages/estoque/index.html',
      campanhas: '../../pages/campanhas/index.html',
      analise: '../../pages/analise/index.html',
      relatorios: '../../pages/relatorios/index.html',
      'pos-venda': '../../pages/pos-venda/index.html',
      config: '../../pages/config/index.html',
      fornecedor: '../../pages/fornecedor/index.html',
      financeiro: '../../pages/financeiro/index.html',
      'em-breve': '../../pages/em-breve/index.html',
      'minha-semana':        '../../pages/minha-semana/index.html',
      'acaodasemana':        '../../pages/acaodasemana/index.html',
      'portal-cliente':      '../../pages/portal-cliente/admin.html',
      'portal-tecnico':      '../../pages/portal-tecnico/index.html',
      'diario':              '../../pages/diario/index.html',
      'central-alertas':     '../../pages/central-alertas/index.html',
      'central-organizacao': '../../pages/central-organizacao/index.html',
      'contas':              '../../pages/contas/index.html',
      'catalogo':            '../../pages/catalogo/index.html',
      'relatorios':          '../../pages/relatorios/index.html',
      'crm-comercial':       '../../pages/crm-comercial/index.html',
      'compras':             '../../pages/compras/index.html',
      'auditoria':           '../../pages/auditoria/index.html'
    };
    const url = routes[module];
    if (url) {
      console.log(`[Router] Navegando para: ${module}`);
      window.location.href = url;
    } else {
      console.warn(`[Router] Rota não encontrada: ${module}`);
    }
  },

  // ===== AVISO DE EVENTOS DA AGENDA =====
  // Prioridade: 1. Atrasados (qualquer dia), 2. Horário atual, 3. Próximos (até 15 min)
  // ⚠ O alerta sonoro REPETE a cada ciclo ENQUANTO houver tarefas vencidas não concluídas.
  // Só para quando TODAS as tarefas atrasadas forem concluídas.
  // ===== CONFIGURAÇÃO DE ALERTAS =====
  setupConfigAlertas() {
    const modal = document.getElementById('modal-config-alertas');
    const btnFechar = document.getElementById('btn-fechar-config-alertas');
    const btnSalvar = document.getElementById('btn-salvar-config');
    const btnTestar = document.getElementById('btn-testar-som');
    const chkSilencio = document.getElementById('config-silencio-ativo');
    const camposSilencio = document.getElementById('config-silencio-campos');

    if (!modal) return;

    // Abre a config de alertas (chamado pelo botão ⚙️ do card oculto)
    const abrirConfig = (e) => {
      if (e) e.stopPropagation();
      this.carregarConfigAlertasUI();
      modal.style.display = 'flex';
    };

    const btnAbrir = document.getElementById('btn-abrir-config-alertas');
    if (btnAbrir) btnAbrir.addEventListener('click', abrirConfig);

    if (btnFechar) {
      btnFechar.addEventListener('click', () => { modal.style.display = 'none'; });
    }
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });

    if (chkSilencio && camposSilencio) {
      chkSilencio.addEventListener('change', () => {
        camposSilencio.style.display = chkSilencio.checked ? 'flex' : 'none';
      });
    }
    if (btnSalvar) {
      btnSalvar.addEventListener('click', () => {
        this.salvarConfigAlertas();
        modal.style.display = 'none';
      });
    }
    if (btnTestar) {
      btnTestar.addEventListener('click', () => {
        if (this._tocarSomVencida) this._tocarSomVencida();
      });
    }
  },

  carregarConfigAlertas() {
    try {
      const raw = localStorage.getItem('cc_config_alertas');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      som: {
        ativo: false,
        horarioInicio: '08:00',
        horarioFim: '18:00',
        diasSemana: [1, 2, 3, 4, 5],
        silencio: { ativo: false, inicio: '12:00', fim: '13:00' }
      },
      alertasComSom: {
        acaoSemanaVencidas: true,
        acaoSemanaAgora: false,
        acaoSemanaProximas: false,
        posVendaCritico: false,
        osAguardandoCliente: false,
        avaliacoesCriticas: false
      },
      pulsacao: { critico: true, atencao: false }
    };
  },

  carregarConfigAlertasUI() {
    const config = this.carregarConfigAlertas();
    this._setChecked('config-som-ativo', config.som.ativo);
    this._setValue('config-som-inicio', config.som.horarioInicio);
    this._setValue('config-som-fim', config.som.horarioFim);
    document.querySelectorAll('.config-dia-sem').forEach(chk => {
      chk.checked = config.som.diasSemana.includes(parseInt(chk.value));
    });
    this._setChecked('config-silencio-ativo', config.som.silencio.ativo);
    this._setValue('config-silencio-inicio', config.som.silencio.inicio);
    this._setValue('config-silencio-fim', config.som.silencio.fim);
    const camposSilencio = document.getElementById('config-silencio-campos');
    if (camposSilencio) {
      camposSilencio.style.display = config.som.silencio.ativo ? 'flex' : 'none';
    }
    document.querySelectorAll('.config-alerta-som').forEach(chk => {
      const tipo = chk.getAttribute('data-tipo');
      chk.checked = config.alertasComSom[tipo] === true;
    });
    document.querySelectorAll('.config-pulsacao').forEach(chk => {
      const nivel = chk.getAttribute('data-nivel');
      chk.checked = config.pulsacao[nivel] === true;
    });
  },

  salvarConfigAlertas() {
    const config = {
      som: {
        ativo: this._getChecked('config-som-ativo'),
        horarioInicio: this._getValue('config-som-inicio', '08:00'),
        horarioFim: this._getValue('config-som-fim', '18:00'),
        diasSemana: Array.from(document.querySelectorAll('.config-dia-sem:checked')).map(c => parseInt(c.value)),
        silencio: {
          ativo: this._getChecked('config-silencio-ativo'),
          inicio: this._getValue('config-silencio-inicio', '12:00'),
          fim: this._getValue('config-silencio-fim', '13:00')
        }
      },
      alertasComSom: {},
      pulsacao: {
        critico: document.querySelector('.config-pulsacao[data-nivel="critico"]')?.checked ?? true,
        atencao: document.querySelector('.config-pulsacao[data-nivel="atencao"]')?.checked ?? false
      }
    };
    document.querySelectorAll('.config-alerta-som').forEach(chk => {
      config.alertasComSom[chk.getAttribute('data-tipo')] = chk.checked;
    });
    localStorage.setItem('cc_config_alertas', JSON.stringify(config));
    console.log('✅ Configuração de alertas salva:', config);
  },

  // ===== MODAL: LISTA DE OS DO ALERTA =====
  mostrarAlertaOS(alerta) {
    const modal   = document.getElementById('os-alerta-modal');
    const titleEl = document.getElementById('os-modal-title');
    const listEl  = document.getElementById('os-modal-list');
    if (!modal || !titleEl || !listEl) return;

    titleEl.textContent = alerta._titulo || alerta.title;
    const labelDias = alerta._tipo === 'pronto_nao_retirado' ? 'aguardando retirada' : 'sem resposta';

    listEl.innerHTML = alerta._osData.map(os => `
      <div style="background:#1a1d1b;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px 16px;display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:start;">
        <span style="font-size:12px;font-weight:800;color:#00e676;grid-row:1/3;">${os.id}</span>
        <span style="font-size:14px;font-weight:700;color:#fff;">${os.clientName || '—'}</span>
        <span style="font-size:12px;color:#6b7280;">${os.phone ? '📞 ' + os.phone : 'Sem telefone'}</span>
        <span style="font-size:11px;color:#f59e0b;font-weight:600;grid-column:1/-1;margin-top:4px;">⏱ ${os._dias} dia(s) ${labelDias}</span>
      </div>`).join('');

    modal.style.display = 'flex';
  }
};
