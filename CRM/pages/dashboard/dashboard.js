/* ============================================
CELL CITY CRM — DASHBOARD CONTROLLER v4.3 FINAL
✅ ETAPA 1: Data completa + Relógio + Logo + Alertas em modo seguro
✅ ETAPA 2: Meta Semanal conectada ao resumo_live do Firestore
============================================ */
import { db, doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from "../../scripts/firebase.js";


class Dashboard {
  constructor() {
    this.state = {
      meta: { current: 151, goal: 10000 },
      calendar: {
        open: false,
        viewDate: new Date(),
        selectedDate: null
      },
      searchData: {
        os: [
          { id: 'OS-2847', title: 'iPhone 11 - Tela quebrada', sub: 'Cliente: João Silva' },
          { id: 'OS-2846', title: 'Samsung A52 - Bateria', sub: 'Cliente: Maria Santos' },
          { id: 'OS-2845', title: 'Xiaomi Redmi Note 10', sub: 'Cliente: Pedro Lima' }
        ],
        clientes: [
          { id: 'C-001', title: 'João Silva', sub: '(11) 99999-1234' },
          { id: 'C-002', title: 'Maria Santos', sub: '(11) 98888-5678' },
          { id: 'C-003', title: 'Pedro Lima', sub: '(11) 97777-9012' }
        ],
        produtos: [
          { id: 'P-001', title: 'Tela iPhone 11', sub: 'Estoque: 12 un.' },
          { id: 'P-002', title: 'Bateria Samsung A52', sub: 'Estoque: 8 un.' },
          { id: 'P-003', title: 'Carregador USB-C', sub: 'Estoque: 24 un.' }
        ],
        modulos: [
          { id: 'os', title: 'Ordem de Serviço', sub: 'Módulo' },
          { id: 'clientes', title: 'Clientes', sub: 'Módulo' },
          { id: 'caixa', title: 'Caixa', sub: 'Módulo' },
          { id: 'estoque', title: 'Estoque', sub: 'Módulo' },
          { id: 'campanhas', title: 'Campanhas', sub: 'Módulo' },
          { id: 'analise', title: 'Análise', sub: 'Módulo' },
          { id: 'pos-venda', title: 'Pós-venda', sub: 'Módulo' },
          { id: 'config', title: 'Configurações', sub: 'Módulo' },
          { id: 'ferramentas', title: 'Ferramentas', sub: 'Módulo' },
          { id: 'fornecedor',  title: 'Fornecedor',  sub: 'Módulo' },
          { id: 'financeiro',  title: 'Financeiro',  sub: 'Módulo' },
          { id: 'em-breve',    title: 'Em Breve',    sub: 'Módulo' }
        ]
      }
    };
    this.init();
  }

  init() {
    this._verificarFechamentoCaixa();
    this.setupNotas();
    this.setupClock();
    this.setupMetaSemanal();
    this.setupAlerts();
    this.setupGlobalSearch();
    this.setupCalendar();
    this.setupModules();
    this.setupDockTools();
    this.setupKeyboardShortcuts();
    this.setupOutsideClicks();
    console.log('✅ Dashboard Cell City v4.3 — ETAPA 1 concluída. Aguardando ETAPA 2 (os.js + caixa.js).');
  }

  // ===== RELÓGIO & DATA COMPLETA =====
  setupClock() {
    const clockEl = document.getElementById('clock-display');
    const dateText = document.getElementById('date-text');

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

      if (dateText) dateText.textContent = dateFull;
      if (clockEl) clockEl.textContent = timeStr;
    };

    update();
    setInterval(update, 1000);
  }

  // ===== FECHAMENTO AUTOMÁTICO DO CAIXA =====
  _verificarFechamentoCaixa() {
    const CACHE_KEY = 'caixa_ultimo_fechamento';
    const ultimoExec = localStorage.getItem(CACHE_KEY);
    const hojeKey   = new Date().toISOString().slice(0, 10);

    // Já rodou hoje — não precisa fazer nada
    if (ultimoExec && ultimoExec.startsWith(hojeKey)) {
      console.log('✅ [Dashboard] Fechamento do Caixa já executado hoje.');
      return;
    }

    // Carrega o Caixa em iframe invisível para disparar o orquestrador
    console.log('🔄 [Dashboard] Disparando fechamento automático do Caixa em background...');
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'display:none;width:0;height:0;position:absolute;';
    iframe.src = '/CRM/pages/caixa/index.html';
    document.body.appendChild(iframe);

    // Remove após 40s (tempo suficiente para o orquestrador concluir)
    setTimeout(() => {
      iframe.remove();
      console.log('✅ [Dashboard] Iframe do Caixa removido.');
    }, 40000);
  }

  // ===== BLOCO DE NOTAS =====
  setupNotas() {
    const btnNotas  = document.getElementById('dock-notas');
    const panel     = document.getElementById('nota-panel');
    const btnClose  = document.getElementById('nota-close');
    const textarea  = document.getElementById('nota-textarea');
    const statusEl  = document.getElementById('nota-status');
    if (!btnNotas || !panel || !textarea) return;

    // ID do dispositivo/usuário — persistente no localStorage
    let userId = localStorage.getItem('cc_nota_uid');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('cc_nota_uid', userId);
    }

    const docRef = doc(db, 'notas_usuarios', userId);
    let saveTimer = null;

    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

    // Carrega nota do Firestore
    const carregarNota = async () => {
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          textarea.value = snap.data().conteudo || '';
        }
        setStatus('✓ sincronizado');
      } catch { setStatus(''); }
    };

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
            userId
          });
          setStatus('✓ salvo');
        } catch { setStatus('⚠ erro ao salvar'); }
      }, 1000);
    };

    // Abre/fecha painel
    btnNotas.addEventListener('click', () => {
      const aberto = panel.style.display !== 'none';
      panel.style.display = aberto ? 'none' : 'flex';
      if (!aberto) { carregarNota(); textarea.focus(); }
    });

    btnClose.addEventListener('click', () => { panel.style.display = 'none'; });

    // Auto-save ao digitar
    textarea.addEventListener('input', salvarNota);
  }

  // ===== META SEMANAL =====
  setupMetaSemanal() {
    this.updateMeta(this.state.meta.current, this.state.meta.goal);
    this._carregarMetaFirestore();
  }

  async _carregarMetaFirestore() {
    try {
      const CRESCIMENTO = 1.15;

      // Número da semana ISO (1-53)
      const _weekNum = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const jan1 = new Date(d.getFullYear(), 0, 1);
        return Math.ceil((((d - jan1) / 86400000) + 1) / 7);
      };

      const now      = new Date();
      const anoAtual = now.getFullYear();
      const numSem   = _weekNum(now);

      // Lê todos os lançamentos via SDK (autenticado)
      const snap = await getDocs(collection(db, 'caixa_lancamentos'));

      let lucroAtual = 0;
      // Acumula lucro da mesma semana por ano: { 2024: 1200, 2025: 1500 }
      const lucroPorAno = {};

      snap.forEach(d => {
        const l = d.data();
        const iso = l.dataISO || l.createdAtISO || '';
        if (!iso) return;
        const lucro = Number(l.lucro || 0);
        const dt = new Date(iso);
        const ano = dt.getFullYear();
        const sem = _weekNum(dt);

        if (ano === anoAtual && sem === numSem) lucroAtual += lucro;
        if (ano !== anoAtual && sem === numSem) {
          lucroPorAno[ano] = (lucroPorAno[ano] || 0) + lucro;
        }
      });

      // Meta base: lucro do ano anterior na mesma semana, ou média dos anos disponíveis
      const anosHistorico = Object.keys(lucroPorAno).map(Number).sort((a, b) => b - a);
      let lucroBase = 0;
      if (lucroPorAno[anoAtual - 1] > 0) {
        lucroBase = lucroPorAno[anoAtual - 1]; // prefere ano anterior
      } else if (anosHistorico.length > 0) {
        const soma = anosHistorico.reduce((s, a) => s + lucroPorAno[a], 0);
        lucroBase = soma / anosHistorico.length; // média dos anos disponíveis
      }

      const metaCalculada = lucroBase > 0
        ? Math.round(lucroBase * CRESCIMENTO)
        : this.state.meta.goal;

      this.updateMeta(lucroAtual, metaCalculada);

      const footer = document.querySelector('.meta-footer');
      if (footer) {
        const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR')}`;
        const baseLabel = lucroPorAno[anoAtual - 1] > 0
          ? `base ${anoAtual - 1}: ${fmt(Math.round(lucroBase))}`
          : anosHistorico.length > 0
            ? `média histórica: ${fmt(Math.round(lucroBase))}`
            : '';
        footer.innerHTML = `⚠ Faltam <span class="meta-remaining" id="meta-remaining">${fmt(Math.max(metaCalculada - lucroAtual, 0))}</span>${baseLabel ? ` <span class="meta-ref"> · ${baseLabel}</span>` : ''}`;
      }
    } catch (e) {
      console.warn('Meta Semanal:', e);
    }
  }

  updateMeta(current, goal) {
    this.state.meta = { current, goal };
    const percent = Math.min((current / goal) * 100, 100);
    const remaining = Math.max(goal - current, 0);
    const formatBRL = (v) => `R$ ${v.toLocaleString('pt-BR')}`;
    const elCurrent = document.getElementById('meta-current');
    const elGoal = document.getElementById('meta-goal');
    const elPercent = document.getElementById('meta-percent');
    const elRemaining = document.getElementById('meta-remaining');
    const fill = document.getElementById('meta-progress');

    if (elCurrent) elCurrent.textContent = formatBRL(current);
    if (elGoal) elGoal.textContent = formatBRL(goal);
    if (elPercent) elPercent.textContent = `${percent.toFixed(0)}%`;
    if (elRemaining) elRemaining.textContent = formatBRL(remaining);
    if (fill) {
      requestAnimationFrame(() => { fill.style.width = `${percent}%`; });
    }
  }

  // ===== ALERTAS + DICAS ROTATIVAS =====
  setupAlerts() {
    const titleEl    = document.querySelector('.alert-title');
    const subtitleEl = document.querySelector('.alert-subtitle');
    const detailEl   = document.querySelector('.alert-detail');
    const iconEl     = document.getElementById('alert-cat-icon');
    const progressEl = document.getElementById('alert-progress-bar');
    if (!titleEl || !subtitleEl || !detailEl) return;

    const DICAS = [
      { icon: '💡', cat: 'crm',          title: 'DICA DO CRM',      sub: 'Cadastre seus clientes',         detail: 'Registre o histórico de cada atendimento para fidelizar melhor.' },
      { icon: '💡', cat: 'crm',          title: 'DICA DO CRM',      sub: 'Ordens de Serviço',              detail: 'Use as OS para nunca perder o controle de um reparo em andamento.' },
      { icon: '💡', cat: 'crm',          title: 'DICA DO CRM',      sub: 'Controle financeiro',            detail: 'Registre todas as entradas e saídas no Caixa para ter visão real do seu financeiro.' },
      { icon: '💡', cat: 'crm',          title: 'DICA DO CRM',      sub: 'Estoque atualizado',             detail: 'Mantenha o Estoque em dia para evitar surpresas na hora do reparo.' },
      { icon: '📈', cat: 'vendas',       title: 'DICA DE VENDAS',   sub: 'Hora certa de vender mais',      detail: 'Cliente buscando o aparelho é a melhor hora para oferecer capinha, película ou acessório.' },
      { icon: '📈', cat: 'vendas',       title: 'DICA DE VENDAS',   sub: 'Pós-venda ativo',                detail: 'Ligue ou mande mensagem 7 dias após a entrega. Isso fideliza e gera indicações.' },
      { icon: '📈', cat: 'vendas',       title: 'DICA DE VENDAS',   sub: 'Ofereça garantia no serviço',   detail: 'Transmite confiança e diferencia a Cell City da concorrência.' },
      { icon: '💪', cat: 'motivacional', title: 'MOTIVACIONAL',     sub: 'Cada OS é um passo',             detail: 'Cada OS concluída é um cliente satisfeito e um passo rumo à meta semanal.' },
      { icon: '💪', cat: 'motivacional', title: 'MOTIVACIONAL',     sub: 'Consistência vence',             detail: 'Consistência bate talento. Atenda bem todos os dias.' },
      { icon: '💪', cat: 'motivacional', title: 'MOTIVACIONAL',     sub: 'Cell City crescendo 💪',         detail: 'Um reparo de cada vez. Foco, qualidade e atendimento fazem a diferença.' }
    ];

    let idx = 0;

    const CAT_CLASS = { crm: 'cat-crm', vendas: 'cat-vendas', motivacional: 'cat-motivacional' };
    const BAR_CLASS = { crm: 'cat-crm-bar', vendas: 'cat-vendas-bar', motivacional: 'cat-motivacional-bar' };
    const DURATION  = 180000;

    const aplicarCategoria = (dica) => {
      const cls = CAT_CLASS[dica.cat] || 'cat-crm';
      titleEl.className = 'alert-title ' + cls;
      if (iconEl) iconEl.textContent = dica.icon;
      if (progressEl) {
        progressEl.className = 'alert-progress-bar ' + (BAR_CLASS[dica.cat] || 'cat-crm-bar');
        progressEl.style.animation = 'none';
        progressEl.getBoundingClientRect();
        progressEl.style.animation = `progressFill ${DURATION}ms linear forwards`;
      }
    };

    const mostrar = (dica, animacao) => {
      if (animacao) {
        [titleEl, subtitleEl, detailEl].forEach(el => {
          el.style.transition = 'opacity 0.4s ease';
          el.style.opacity = '0';
        });
        if (iconEl) { iconEl.style.transition = 'opacity 0.4s ease'; iconEl.style.opacity = '0'; }
        setTimeout(() => {
          titleEl.textContent    = dica.title;
          subtitleEl.textContent = dica.sub;
          detailEl.textContent   = dica.detail;
          aplicarCategoria(dica);
          [titleEl, subtitleEl, detailEl].forEach(el => el.style.opacity = '1');
          if (iconEl) iconEl.style.opacity = '1';
        }, 400);
      } else {
        titleEl.textContent    = dica.title;
        subtitleEl.textContent = dica.sub;
        detailEl.textContent   = dica.detail;
        aplicarCategoria(dica);
      }
    };

    mostrar(DICAS[0], false);

    setInterval(() => {
      idx = (idx + 1) % DICAS.length;
      mostrar(DICAS[idx], true);
    }, 180000); // 3 minutos
  }

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
  }

  toggleCalendar() {
    const popup = document.getElementById('calendar-popup');
    const dateBtn = document.getElementById('date-display');
    this.state.calendar.open = !this.state.calendar.open;
    popup.classList.toggle('visible', this.state.calendar.open);
    dateBtn.classList.toggle('active', this.state.calendar.open);
  }

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
  }

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
  }

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
  }

  // ===== BUSCA GLOBAL INTELIGENTE =====
  setupGlobalSearch() {
    const input = document.getElementById('global-search-input');
    const resultsBox = document.getElementById('search-results');
    let timeout;

    input.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const term = e.target.value.trim().toLowerCase();
        if (term.length < 2) {
          resultsBox.classList.remove('visible');
          return;
        }
        this.performSearch(term, resultsBox);
      }, 200);
    });

    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 2) {
        resultsBox.classList.add('visible');
      }
    });
  }

  performSearch(term, resultsBox) {
    const data = this.state.searchData;
    const groups = [];
    const filter = (arr) => arr.filter(item =>
      item.title.toLowerCase().includes(term) ||
      item.sub.toLowerCase().includes(term) ||
      item.id.toLowerCase().includes(term)
    );

    const osResults = filter(data.os);
    if (osResults.length) groups.push({ title: 'Ordens de Serviço', icon: '📦', items: osResults, module: 'os' });

    const clientesResults = filter(data.clientes);
    if (clientesResults.length) groups.push({ title: 'Clientes', icon: '👥', items: clientesResults, module: 'clientes' });

    const produtosResults = filter(data.produtos);
    if (produtosResults.length) groups.push({ title: 'Produtos / Estoque', icon: '📱', items: produtosResults, module: 'estoque' });

    const modulosResults = filter(data.modulos);
    if (modulosResults.length) groups.push({ title: 'Módulos', icon: '🧩', items: modulosResults, module: null });

    if (groups.length === 0) {
      resultsBox.innerHTML = `<div class="search-empty">Nenhum resultado para "<strong>${this.escapeHtml(term)}</strong>"</div>`;
    } else {
      resultsBox.innerHTML = groups.map(group => `
        <div class="search-group">
          <div class="search-group-title">${group.icon} ${group.title}</div>
          ${group.items.slice(0, 5).map(item => `
            <div class="search-item" data-module="${group.module || item.id}">
              <div class="search-item-text">
                <div class="search-item-title">${this.escapeHtml(item.title)}</div>
                <div class="search-item-sub">${this.escapeHtml(item.sub)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('');

      resultsBox.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', () => {
          const module = item.getAttribute('data-module');
          if (module) this.navigateTo(module);
          document.getElementById('global-search-input').value = '';
          resultsBox.classList.remove('visible');
        });
      });
    }
    resultsBox.classList.add('visible');
  }

  // ===== MÓDULOS =====
  setupModules() {
    document.querySelectorAll('.module-card[data-module]').forEach(card => {
      card.addEventListener('click', () => {
        const module = card.getAttribute('data-module');
        this.navigateTo(module);
      });
    });
  }

  // ===== FERRAMENTAS NA DOCK LATERAL =====
  setupDockTools() {
    const toolsItem = document.getElementById('dock-ferramentas');
    if (toolsItem) {
      toolsItem.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateTo('ferramentas');
      });
    }
  }

  // ===== MINHA SEMANA — movido para acaodasemana/acaodasemana.js =====
  setupMinhaSemana_REMOVIDO() {
    const DIAS = [
      { key: 'segunda',  label: 'Segunda' },
      { key: 'terca',    label: 'Terça'   },
      { key: 'quarta',   label: 'Quarta'  },
      { key: 'quinta',   label: 'Quinta'  },
      { key: 'sexta',    label: 'Sexta'   },
      { key: 'sabado',   label: 'Sábado'  },
      { key: 'domingo',  label: 'Domingo' },
    ];
    const PRIO = { alta: '🔴', media: '🟡', baixa: '🟢' };
    const JS_DIA = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
    const diaHoje = JS_DIA[new Date().getDay()];

    const userId = localStorage.getItem('cc_nota_uid') || 'user_default';
    const ref = doc(db, 'tarefas_semana', userId);
    let tarefas = {};

    const container = document.getElementById('semana-acordeao');
    if (!container) return;

    const render = () => {
      container.innerHTML = '';
      DIAS.forEach(({ key, label }) => {
        const lista = tarefas[key] || [];
        const aberto = key === diaHoje;

        const bloco = document.createElement('div');
        bloco.className = 'semana-dia';

        // cabeçalho
        const titulo = document.createElement('div');
        titulo.className = 'semana-dia-titulo' + (aberto ? ' aberto' : '');
        titulo.innerHTML = `<span>${label}</span>
          <div class="semana-dia-meta">
            ${lista.filter(t=>!t.concluido).length > 0
              ? `<span class="semana-dia-count">${lista.filter(t=>!t.concluido).length}</span>`
              : ''}
            <span class="semana-dia-arrow">▶</span>
          </div>`;

        // corpo
        const corpo = document.createElement('div');
        corpo.className = 'semana-dia-corpo' + (aberto ? ' aberto' : '');

        // lista de tarefas
        const listaEl = document.createElement('div');
        listaEl.className = 'semana-tarefas-lista';

        lista.forEach((t, idx) => {
          const item = document.createElement('div');
          item.className = 'semana-tarefa' + (t.concluido ? ' concluida' : '');

          const chk = document.createElement('input');
          chk.type = 'checkbox'; chk.className = 'semana-tarefa-check'; chk.checked = !!t.concluido;
          chk.addEventListener('change', () => {
            tarefas[key][idx].concluido = chk.checked;
            salvar(); render();
          });

          const prio = document.createElement('span');
          prio.className = 'semana-tarefa-prio';
          prio.textContent = PRIO[t.prioridade] || '🟡';

          const desc = document.createElement('span');
          desc.className = 'semana-tarefa-desc';
          desc.textContent = t.descricao;

          const del = document.createElement('button');
          del.className = 'semana-tarefa-del'; del.textContent = '✕';
          del.addEventListener('click', () => {
            tarefas[key].splice(idx, 1);
            salvar(); render();
          });

          item.append(chk, prio, desc, del);
          listaEl.appendChild(item);
        });

        // formulário
        const form = document.createElement('div');
        form.className = 'semana-add-form';
        form.innerHTML = `
          <input type="text" placeholder="Nova tarefa..." maxlength="80">
          <select>
            <option value="media">🟡</option>
            <option value="alta">🔴</option>
            <option value="baixa">🟢</option>
          </select>
          <button class="semana-add-btn">＋</button>`;

        const addFn = () => {
          const inp = form.querySelector('input');
          const sel = form.querySelector('select');
          const desc = inp.value.trim();
          if (!desc) return;
          if (!tarefas[key]) tarefas[key] = [];
          tarefas[key].push({ descricao: desc, prioridade: sel.value, concluido: false, criadoEm: new Date().toISOString() });
          inp.value = '';
          salvar(); render();
        };
        form.querySelector('.semana-add-btn').addEventListener('click', addFn);
        form.querySelector('input').addEventListener('keypress', e => { if (e.key === 'Enter') addFn(); });

        corpo.appendChild(listaEl);
        corpo.appendChild(form);

        // acordeão toggle
        titulo.addEventListener('click', () => {
          const estaAberto = corpo.classList.contains('aberto');
          corpo.classList.toggle('aberto', !estaAberto);
          titulo.classList.toggle('aberto', !estaAberto);
        });

        bloco.appendChild(titulo);
        bloco.appendChild(corpo);
        container.appendChild(bloco);
      });
    };

    const salvar = async () => {
      try { await setDoc(ref, { tarefas, atualizadoEm: serverTimestamp() }); } catch {}
    };

    const carregar = async () => {
      try {
        const snap = await getDoc(ref);
        tarefas = snap.exists() ? (snap.data().tarefas || {}) : {};
      } catch { tarefas = {}; }
      render();
    };

    carregar();
  }

  // ===== SIDEBAR ANOTAÇÕES — movido para acaodasemana/acaodasemana.js =====
  setupSidebarNotas_REMOVIDO() {
    const area     = document.getElementById('sidebar-notas-area');
    const statusEl = document.getElementById('sidebar-notas-status');
    if (!area) return;

    const userId = localStorage.getItem('cc_nota_uid') || 'user_default';
    const ref    = doc(db, 'notas_usuarios', userId);
    let saveTimer = null;

    const setStatus = msg => { if (statusEl) statusEl.textContent = msg; };

    // Carrega
    getDoc(ref).then(snap => {
      if (snap.exists()) area.value = snap.data().conteudo || '';
      setStatus('✓ sincronizado');
    }).catch(() => setStatus(''));

    // Auto-save com debounce 1s
    area.addEventListener('input', () => {
      clearTimeout(saveTimer);
      setStatus('digitando...');
      saveTimer = setTimeout(async () => {
        setStatus('salvando...');
        try {
          await setDoc(ref, { conteudo: area.value, atualizadoEm: serverTimestamp(), userId });
          setStatus('✓ salvo');
        } catch { setStatus('⚠ erro'); }
      }, 1000);
    });
  }

  navigateTo(module) {
    const routes = {
      os: '../../pages/os/index.html',
      clientes: '../../pages/clientes/index.html',
      caixa: '../../pages/caixa/index.html',
      estoque: '../../pages/estoque/index.html',
      campanhas: '../../pages/campanhas/index.html',
      analise: '../../pages/analise/index.html',
      'pos-venda': '../../pages/pos-venda/index.html',
      config: '../../pages/config/index.html',
      ferramentas: '../../pages/config/index.html',
      fornecedor: '../../pages/fornecedor/index.html',
      financeiro: '../../pages/financeiro/index.html',
      'em-breve': '../../pages/em-breve/index.html',
      'minha-semana':   '../../pages/minha-semana/index.html',
      'acaodasemana':   '../../pages/acaodasemana/index.html'
    };
    const url = routes[module];
    if (url) {
      console.log(`[Router] Navegando para: ${module}`);
      window.location.href = url;
    } else {
      console.warn(`[Router] Rota não encontrada: ${module}`);
    }
  }

  // ===== CLIQUES FORA =====
  setupOutsideClicks() {
    document.addEventListener('click', (e) => {
      const calPopup = document.getElementById('calendar-popup');
      const dateBtn = document.getElementById('date-display');
      if (this.state.calendar.open &&
          !calPopup.contains(e.target) &&
          !dateBtn.contains(e.target)) {
        this.state.calendar.open = false;
        calPopup.classList.remove('visible');
        dateBtn.classList.remove('active');
      }

      const searchBox = document.getElementById('global-search');
      const searchResults = document.getElementById('search-results');
      if (!searchBox.contains(e.target)) {
        searchResults.classList.remove('visible');
      }
    });
  }

  // ===== ATALHOS =====
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
      if (e.key === 'Escape') {
        document.getElementById('global-search-input')?.blur();
        document.getElementById('search-results')?.classList.remove('visible');
        if (this.state.calendar.open) {
          this.state.calendar.open = false;
          document.getElementById('calendar-popup').classList.remove('visible');
          document.getElementById('date-display').classList.remove('active');
        }
      }
    });
  }
}

// ===== INICIALIZAÇÃO =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Dashboard());
} else {
  new Dashboard();
}