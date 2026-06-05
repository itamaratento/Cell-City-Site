/* ============================================
CELL CITY CRM — DASHBOARD CONTROLLER v4.3 FINAL
✅ ETAPA 1: Data completa + Relógio + Logo + Alertas em modo seguro
✅ ETAPA 2: Meta Semanal conectada ao resumo_live do Firestore
============================================ */
import { db, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, onSnapshot, query, where, orderBy, limit } from "../../scripts/firebase.js";


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
    this.setupAutoatendimento();
    this.setupAlerts();
    this.setupGlobalSearch();
    this.setupCalendar();
    this.setupModules();
    this.setupDockTools();
    this.setupKeyboardShortcuts();
    this.setupOutsideClicks();
    this.setupAvisoAcoes();
    this.monitorarCardAcaoSemana();
    this.setupAlarmeOS();
    console.log('✅ Dashboard Cell City v4.3 — ETAPA 1 concluída. Aguardando ETAPA 2 (os.js + caixa.js).');
  }

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

  // ===== AUTOATENDIMENTO =====
  setupAutoatendimento() {
    this._carregarContadorAutoatendimento();
  }

  async _carregarContadorAutoatendimento() {
    try {
      const q = query(collection(db, 'pre_os'), where('status', '==', 'AGUARDANDO_CONVERSAO'));

      // Listener realtime
      onSnapshot(q, snap => {
        const pendentes = snap.size;
        const badge = document.getElementById('auto-badge');

        if (badge) {
          badge.textContent = pendentes;
          if (pendentes === 0) {
            badge.classList.add('empty');
          } else {
            badge.classList.remove('empty');
          }
        }
      });
    } catch (e) {
      console.warn('Erro ao carregar Autoatendimento:', e);
    }
  }

  // ===== AGENDA INTELIGENTE — lê as notas (sticky notes) e extrai os horários =====
  // Cada dia é 1 documento { data, texto, cor }. As linhas do texto no formato
  // "HH:MM descrição" viram compromissos com horário para o Dashboard.
  async _lerAgenda() {
    try {
      const snap = await getDocs(collection(db, 'agenda'));
      const eventos = [];
      const hojeISO = new Date().toISOString().slice(0, 10);

      // Helper: extrai {texto, concluido} de cada nota do documento
      const notasDe = (dados) => {
        if (Array.isArray(dados.notas)) return dados.notas.map(n => n || {}).filter(n => n.texto);
        if (typeof dados.texto === 'string') return dados.texto.split(/\r?\n+/).map(s => ({ texto: s.trim(), concluido: false })).filter(n => n.texto);
        if (dados.titulo) return [{ texto: `${dados.hora ? dados.hora + ' ' : ''}${dados.titulo}`, concluido: false }];
        return [];
      };
      const horaDoTexto = (txt) => { const m = String(txt).match(/^\s*(\d{1,2}:\d{2})\b/); return m ? m[1] : ''; };
      const semHora = (txt) => String(txt).replace(/^\s*\d{1,2}:\d{2}\s*/, '').trim();
      // A recorrência (origem) cai em `iso`?
      const recCai = (iso, origem, pat) => {
        if (!pat || iso < origem) return false;
        const a = new Date(iso + 'T00:00:00'), b = new Date(origem + 'T00:00:00');
        if (pat === 'semanal') return a.getDay() === b.getDay();
        if (pat === 'mensal')  return a.getDate() === b.getDate();
        if (pat === 'anual')   return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
        return false;
      };

      snap.forEach(d => {
        const dados = d.data();
        const dia = dados.data || d.id;
        const notas = notasDe(dados);

        if (dados.recorrencia) {
          // RECORRENTE: gera alerta na ocorrência de HOJE (quando o padrão bate)
          // e SOMENTE quando há horário definido. Sem horário, fica só na Agenda.
          if (recCai(hojeISO, dia, dados.recorrencia)) {
            const horaPadrao = /^\d{1,2}:\d{2}$/.test(dados.alertaHora || '') ? dados.alertaHora : '';
            const DIASEM = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
            const wd = DIASEM[new Date(hojeISO + 'T00:00:00').getDay()];
            notas.forEach(n => {
              const hora = horaDoTexto(n.texto) || horaPadrao;
              if (!hora) return; // sem horário → não gera alerta no Dashboard
              const desc = semHora(n.texto) || n.texto;
              eventos.push({
                data: hojeISO, hora, titulo: desc, concluido: !!n.concluido, alerta: true,
                recorrente: true, rotulo: `🔄 ${wd} ${hora} ${desc}`
              });
            });
          }
        } else if (dados.alertaDashboard) {
          // OPT-IN (não recorrente): gera alertas para TODAS as notas com horário definido
          const comHora = notas.filter(n => horaDoTexto(n.texto));
          if (comHora.length > 0) {
            comHora.forEach(n => {
              const hora = horaDoTexto(n.texto);
              eventos.push({
                data: dia, hora, titulo: semHora(n.texto) || n.texto,
                concluido: !!n.concluido, alerta: true
              });
            });
          } else if (notas.length > 0) {
            // Sem horário: usa a primeira nota + alertaHora configurado
            const n = notas[0];
            eventos.push({
              data: dia, hora: dados.alertaHora || '', titulo: n.texto,
              concluido: !!n.concluido, alerta: true
            });
          }
        }
      });
      return eventos;
    } catch {
      return [];
    }
  }

  // ===== AGENDA — TODOS os itens atrasados (qualquer hora/dia passado) =====
  _vencidos(eventos) {
    const agora = Date.now();
    const hojeISO = new Date().toISOString().slice(0, 10);
    return (eventos || []).filter(e => {
      if (e.concluido || !e.data) return false;
      if (e.hora) {
        // Tem horário definido — compara data+hora
        const dt = new Date(`${e.data}T${e.hora}:00`).getTime();
        return (agora - dt) / 60000 >= 0;
      }
      // Sem horário — compara apenas a data (considera vencido se data passou)
      return e.data < hojeISO;
    });
  }

  // ===== AGENDA — conta compromissos no horário/atrasados (janela 60 min) =====
  async _contarAcoesVencidas(eventos) {
    try {
      const evs = eventos || await this._lerAgenda();
      const venc = this._vencidos(evs);
      return { count: venc.length, titulos: venc.map(e => e.titulo) };
    } catch {
      return { count: 0, titulos: [] };
    }
  }

  // ===== AGENDA — calcula o próximo compromisso futuro =====
  _proximoCompromisso(eventos) {
    const agora = Date.now();
    return (eventos || [])
      .filter(e => !e.concluido && e.data)
      .map(e => ({ ...e, ts: new Date(`${e.data}T${e.hora || '00:00'}:00`).getTime() }))
      .filter(e => e.ts >= agora)
      .sort((a, b) => a.ts - b.ts)[0] || null;
  }

  // ===== AGENDA — card do Dashboard: destaca ENQUANTO tarefa não for concluída =====
  // Prioridade: 1. Atrasadas (qualquer dia), 2. Horário atual, 3. Próximas (até 15 min)
  monitorarCardAcaoSemana() {
    const card = document.querySelector('.module-card[data-module="acaodasemana"]');
    if (!card) return;
    const subEl = card.querySelector('.module-sub');
    const subOriginal = 'Agenda Inteligente';

    const _fmtAtraso = (min) => {
      if (min >= 1440) return `${Math.floor(min/1440)}d ${Math.floor((min%1440)/60)}h`;
      if (min >= 60)   return `${Math.floor(min/60)}h${min%60 ? ' '+(min%60)+'min' : ''}`;
      return `${min} min`;
    };

    const verificar = async () => {
      const eventos = await this._lerAgenda();
      const agora = Date.now();
      const hojeISO = new Date().toISOString().slice(0, 10);
      const d = new Date();
      const minsAtual = d.getHours() * 60 + d.getMinutes();

      // ─── Helper para determinar se um evento está atrasado ───
      const estaAtrasado = (e) => {
        if (e.concluido || !e.data) return false;
        if (e.hora) {
          return new Date(`${e.data}T${e.hora}:00`).getTime() < agora;
        }
        // Sem horário — considera atrasado se a data já passou
        return e.data < hojeISO;
      };

      // ─── Helper para calcular minutos entre agora e o evento ───
      const diffMinEvento = (e) => {
        if (!e.hora) return Infinity; // sem horário, não calcula diff
        const [h, m] = e.hora.split(':').map(Number);
        return (h * 60 + m) - minsAtual;
      };

      // 1. PRIORIDADE MÁXIMA — ATRASADOS (qualquer dia, não concluído, horário/data passou)
      const atrasados = (eventos || []).filter(estaAtrasado);

      // 2. HORÁRIO ATUAL — tarefas de hoje com hora exata agora (janela 0–5 min)
      const noHorario = (eventos || []).filter(e => {
        if (e.concluido || !e.data || !e.hora) return false;
        if (e.data !== hojeISO) return false;
        const diff = diffMinEvento(e);
        return diff >= 0 && diff <= 5;
      });

      // 3. PRÓXIMOS — tarefas de hoje até 15 min (só se não houver atrasadas)
      const proximos = (eventos || []).filter(e => {
        if (e.concluido || !e.data || !e.hora) return false;
        if (e.data !== hojeISO) return false;
        const diff = diffMinEvento(e);
        return diff > 5 && diff <= 15;
      });

      // --- definir qual estado mostrar (prioridade: atrasados > noHorario > proximos > padrão) ---
      // Contador de alertas pendentes (atrasados + no horário agora)
      const pendentes = atrasados.length + noHorario.length;
      const cont = pendentes > 1 ? `(${pendentes}) ` : '';

      if (atrasados.length > 0) {
        // Pega o MAIS atrasado (mais antigo primeiro)
        const pior = atrasados.sort((a, b) => {
          const tsA = new Date(`${a.data}T${a.hora || '00:00'}:00`).getTime();
          const tsB = new Date(`${b.data}T${b.hora || '00:00'}:00`).getTime();
          return tsA - tsB;
        })[0];
        card.classList.add('acao-vencida');
        if (subEl) {
          const dt = new Date(`${pior.data}T${pior.hora || '00:00'}:00`);
          const atrasoMin = Math.max(0, Math.round((agora - dt.getTime()) / 60000));
          const rot = pior.rotulo || `${pior.hora || ''} ${pior.titulo}`;
          subEl.textContent = `🔴 ${cont}${rot} · ${_fmtAtraso(atrasoMin)} atrasado`;
        }
      } else if (noHorario.length > 0) {
        card.classList.add('acao-vencida');
        if (subEl) {
          const ev = noHorario[0];
          const rot = ev.rotulo || `${ev.hora} ${ev.titulo}`;
          subEl.textContent = `🔴 ${cont}${rot} · AGORA!`;
        }
      } else {
        card.classList.remove('acao-vencida');
        if (subEl) {
          // Próximo compromisso (até 15 min) ou futuro distante
          const prox = this._proximoCompromisso(eventos);
          const rotProx = prox && (prox.rotulo || `${prox.hora ? prox.hora + ' ' : ''}${prox.titulo}`);
          subEl.textContent = prox ? `📅 Próx.: ${rotProx}` : subOriginal;
        }
      }
    };

    verificar();
    setInterval(verificar, 60000);
    window.addEventListener('focus', verificar);
  }

  // ===== CENTRAL DE ALERTAS — verifica Pós-venda, OS e Caixa =====
  async gerarAlertas() {
    const alertas = [];
    const now = new Date();

    // Helpers Pós-venda (mesma lógica do módulo posvenda.js)
    const getDeliveryDate = (os) => {
      if (Array.isArray(os.timeline)) {
        const entry = [...os.timeline].reverse().find(t => t.text === 'Entregue ao cliente');
        if (entry?.date) return entry.date;
      }
      const ua = os.updatedAt;
      if (!ua) return null;
      if (typeof ua === 'string') return ua;
      if (ua.toDate) return ua.toDate().toISOString();
      return null;
    };
    const calcDias = (dateStr) => {
      try { return Math.floor((now - new Date(dateStr)) / 86400000); } catch { return 0; }
    };

    try {
      // ===== PRIORIDADE MÁXIMA — AÇÃO DA SEMANA (atrasadas + horário atual + próximas) =====
      const eventos = await this._lerAgenda();
      const agora = Date.now();
      const hojeISO = new Date().toISOString().slice(0, 10);
      const d = new Date();
      const minsAtual = d.getHours() * 60 + d.getMinutes();

      // ─── Helper: verifica se evento está atrasado ───
      const estaAtrasado = (e) => {
        if (e.concluido || !e.data) return false;
        if (e.hora) return new Date(`${e.data}T${e.hora}:00`).getTime() < agora;
        return e.data < hojeISO; // sem horário — data passou
      };

      // ─── Helper: diff em minutos do evento ───
      const diffMinEvento = (e) => {
        if (!e.hora) return Infinity;
        const [h, m] = e.hora.split(':').map(Number);
        return (h * 60 + m) - minsAtual;
      };

      // Atrasadas (qualquer dia, não concluídas, horário/data passou)
      const atrasadas = (eventos || []).filter(estaAtrasado);

      // No horário atual (hoje, diff 0–5 min) — só se não houver atrasadas
      const noHorario = (eventos || []).filter(e => {
        if (e.concluido || !e.data || !e.hora) return false;
        if (e.data !== hojeISO) return false;
        const diff = diffMinEvento(e);
        return diff >= 0 && diff <= 5;
      });

      // Próximas (hoje, 6–15 min) — só se não houver atrasadas nem noHorario
      const proximas = (eventos || []).filter(e => {
        if (e.concluido || !e.data || !e.hora) return false;
        if (e.data !== hojeISO) return false;
        const diff = diffMinEvento(e);
        return diff > 5 && diff <= 15;
      });

      // Gera alertas na ordem de prioridade

      // 1. PRIORIDADE MÁXIMA — ATRASADAS (inclui dias anteriores)
      if (atrasadas.length > 0) {
        const totalAtrasadas = atrasadas.length;
        const _fmtAtraso = (min) => {
          if (min >= 1440) return `${Math.floor(min/1440)}d ${Math.floor((min%1440)/60)}h`;
          if (min >= 60)   return `${Math.floor(min/60)}h${min%60 ? ' '+(min%60)+'min' : ''}`;
          return `${min} min`;
        };
        const maisAntiga = atrasadas.sort((a, b) => {
          const tsA = new Date(`${a.data}T${a.hora || '00:00'}:00`).getTime();
          const tsB = new Date(`${b.data}T${b.hora || '00:00'}:00`).getTime();
          return tsA - tsB;
        })[0];
        const tituloExemplo = maisAntiga.titulo;
        const dtExemplo = new Date(`${maisAntiga.data}T${maisAntiga.hora || '00:00'}:00`);
        const atrasoMin = Math.max(0, Math.round((agora - dtExemplo.getTime()) / 60000));
        alertas.push({
          icon: '💡', cat: 'critico', cor: 'critico',
          title: `AÇÃO DA SEMANA · ${totalAtrasadas} atrasada(s)`,
          sub: `🔴 Aguardando conclusão · ${_fmtAtraso(atrasoMin)} atrasado`,
          detail: `${totalAtrasadas} tarefa(s) atrasada(s) — Ex.: ${tituloExemplo}. Conclua para remover o alerta.`
        });
      }

      // 2. HORÁRIO ATUAL (só se NÃO houver atrasadas)
      if (atrasadas.length === 0 && noHorario.length > 0) {
        alertas.push({
          icon: '💡', cat: 'critico', cor: 'critico',
          title: 'AÇÃO DA SEMANA',
          sub: noHorario.length === 1 ? 'Tarefa programada para AGORA' : `${noHorario.length} tarefas AGORA`,
          detail: noHorario.map(e => `${e.hora} ${e.titulo}`).join(' · ')
        });
      }

      // 3. PRÓXIMAS (até 15 min)
      if (atrasadas.length === 0 && noHorario.length === 0 && proximas.length > 0) {
        alertas.push({
          icon: '💡', cat: 'atencao', cor: 'atencao',
          title: 'AÇÃO DA SEMANA · Próximos',
          sub: proximas.length === 1 ? `Em ${proximas[0].hora}` : `${proximas.length} tarefas em breve`,
          detail: proximas.map(e => `${e.hora} ${e.titulo}`).join(' · ')
        });
      }

      const osSnap = await getDocs(collection(db, 'os'));
      const contatosSnap = await getDocs(collection(db, 'posvenda_contatos'));

      const contatosFeitos = new Set();
      contatosSnap.forEach(d => { const c = d.data(); contatosFeitos.add(`${c.osId}_${c.prazo}`); });

      const osList = [];
      osSnap.forEach(d => osList.push({ firestoreId: d.id, ...d.data() }));

      // ===== PRIORIDADE 1 — PÓS-VENDA =====
      let pvPendentes = 0;
      let pvVencidos = 0;
      const pvVencidosClientes = [];

      osList.forEach(os => {
        if (os.status !== 'entregue') return;
        const dd = getDeliveryDate(os);
        if (!dd) return;
        const dias = calcDias(dd);
        const osId = os.id || os.firestoreId;
        [5, 15, 30].forEach(prazo => {
          if (contatosFeitos.has(`${osId}_${prazo}`)) return;
          const proxPrazo = prazo === 5 ? 15 : prazo === 15 ? 30 : 999;
          if (dias < prazo || dias >= proxPrazo) return;
          pvPendentes++;
          if (dias > prazo + 2) {
            pvVencidos++;
            pvVencidosClientes.push({ nome: os.clientName || 'Cliente', dias });
          }
        });
      });

      // Clientes vencidos específicos (crítico) — até 3
      pvVencidosClientes.slice(0, 3).forEach(c => {
        alertas.push({
          icon: '💡', cat: 'critico', cor: 'critico',
          title: 'PÓS-VENDA ATRASADO',
          sub: `${c.nome} aguardando contato`,
          detail: `Cliente ${c.nome} está há ${c.dias} dias aguardando o contato de pós-venda.`
        });
      });
      if (pvVencidos > 0) {
        alertas.push({
          icon: '💡', cat: 'critico', cor: 'critico',
          title: 'PÓS-VENDA ATRASADO',
          sub: `${pvVencidos} contato(s) vencido(s)`,
          detail: `Existem ${pvVencidos} contato(s) de pós-venda vencidos. Entre em contato o quanto antes.`
        });
      }
      if (pvPendentes > 0) {
        alertas.push({
          icon: '💡', cat: 'atencao', cor: 'atencao',
          title: 'PÓS-VENDA PENDENTE',
          sub: `${pvPendentes} cliente(s) pendente(s)`,
          detail: `Existem ${pvPendentes} cliente(s) aguardando contato de pós-venda.`
        });
      }

      // ===== PRIORIDADE 2 — ORDEM DE SERVIÇO =====
      let osOrcamento = 0;
      let osPronto = 0;
      let osOrcamentoParado = 0;
      osList.forEach(os => {
        if (os.status === 'orcamento') {
          osOrcamento++;
          const ref = getDeliveryDate(os) || os.createdAt;
          if (ref && calcDias(typeof ref === 'string' ? ref : (ref.toDate ? ref.toDate().toISOString() : ref)) > 2) {
            osOrcamentoParado++;
          }
        }
        if (os.status === 'pronto') osPronto++;
      });

      if (osOrcamentoParado > 0) {
        alertas.push({
          icon: '💡', cat: 'critico', cor: 'critico',
          title: 'OS AGUARDANDO CLIENTE',
          sub: `${osOrcamentoParado} orçamento(s) parado(s)`,
          detail: `${osOrcamentoParado} cliente(s) com orçamento aguardando aprovação há mais de 2 dias.`
        });
      }
      if (osOrcamento > 0) {
        alertas.push({
          icon: '💡', cat: 'atencao', cor: 'atencao',
          title: 'OS AGUARDANDO APROVAÇÃO',
          sub: `${osOrcamento} aparelho(s) no orçamento`,
          detail: `Existem ${osOrcamento} aparelho(s) aguardando aprovação do orçamento.`
        });
      }
      if (osPronto > 0) {
        alertas.push({
          icon: '💡', cat: 'atencao', cor: 'atencao',
          title: 'OS PRONTAS PARA ENTREGA',
          sub: `${osPronto} OS pronta(s)`,
          detail: `Existem ${osPronto} OS pronta(s) para entrega. Avise os clientes.`
        });
      }

      // ===== PRIORIDADE 3 — CAIXA (META) =====
      const meta = this.state && this.state.meta;
      if (meta && meta.goal > 0) {
        const percent = Math.round((meta.current / meta.goal) * 100);
        const falta = Math.max(meta.goal - meta.current, 0);
        const fmt = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
        if (percent >= 100) {
          alertas.push({
            icon: '✅', cat: 'crm', cor: null,
            title: 'META SEMANAL CONCLUÍDA',
            sub: 'Parabéns! 🎉',
            detail: `Meta semanal atingida (${percent}%). Excelente trabalho!`
          });
        } else {
          alertas.push({
            icon: '💡', cat: 'atencao', cor: 'atencao',
            title: 'META SEMANAL',
            sub: `Atingida em ${percent}%`,
            detail: `Meta semanal em ${percent}%. Faltam ${fmt(falta)} para atingir o objetivo.`
          });
        }
      }

      // ===== PRIORIDADE 4 — PORTAL DO CLIENTE =====
      try {
        const portalMsgsSnap = await getDocs(
          query(collection(db, 'mensagens_portal'), where('lida', '==', false))
        );
        const msgsNaoLidas = [];
        portalMsgsSnap.forEach(d => msgsNaoLidas.push({ id: d.id, ...d.data() }));

        if (msgsNaoLidas.length > 0) {
          const badge = document.getElementById('portal-badge');
          if (badge) {
            badge.textContent = msgsNaoLidas.length;
            badge.style.display = '';
          }

          alertas.push({
            icon: '💬', cat: 'atencao', cor: 'atencao',
            title: 'PORTAL DO CLIENTE',
            sub: `${msgsNaoLidas.length} mensagem(ns) não lida(s)`,
            detail: `${msgsNaoLidas.length} cliente(s) enviaram mensagem pelo Portal do Cliente. Acesse o módulo para responder.`
          });

          msgsNaoLidas.slice(0, 3).forEach(m => {
            alertas.push({
              icon: '💬', cat: 'crm', cor: null,
              title: `📩 ${m.clientName || m.nome || 'Cliente'}`,
              sub: (m.texto || '').slice(0, 60) + ((m.texto || '').length > 60 ? '...' : ''),
              detail: `Cliente enviou mensagem pelo portal. Acesse o módulo Portal do Cliente para visualizar e responder.`
            });
          });
        } else {
          const badge = document.getElementById('portal-badge');
          if (badge) badge.style.display = 'none';
        }
      } catch (e) {
        console.warn('Central de Alertas — erro ao buscar mensagens do portal:', e);
      }

      // ===== AVALIAÇÕES DO PORTAL =====
      try {
        const avaliacoesSnap = await getDocs(
          query(collection(db, 'avaliacoes'), orderBy('createdAt', 'desc'), limit(5))
        );
        const avaliacoesRecentes = [];
        avaliacoesSnap.forEach(d => avaliacoesRecentes.push({ id: d.id, ...d.data() }));

        if (avaliacoesRecentes.length > 0) {
          // Filtra avaliações de hoje para alerta
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const hojeTs = hoje.toISOString();
          const avaliacoesHoje = avaliacoesRecentes.filter(a => {
            if (!a.createdAt) return false;
            const dt = typeof a.createdAt === 'string' ? new Date(a.createdAt) : (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt));
            return dt >= hoje;
          });

          if (avaliacoesHoje.length > 0) {
            alertas.push({
              icon: '⭐', cat: 'crm', cor: null,
              title: 'AVALIAÇÕES RECEBIDAS',
              sub: `${avaliacoesHoje.length} nova(s) avaliação(ões) hoje`,
              detail: `${avaliacoesHoje.length} cliente(s) avaliaram o atendimento pelo Portal do Cliente hoje.`
            });
          }

          // Alerta para avaliações baixas (nota <= 2)
          const avaliacoesCriticas = avaliacoesRecentes.filter(a => a.nota && a.nota <= 2);
          if (avaliacoesCriticas.length > 0) {
            alertas.push({
              icon: '🔴', cat: 'critico', cor: 'critico',
              title: 'AVALIAÇÕES CRÍTICAS',
              sub: `${avaliacoesCriticas.length} avaliação(ões) com nota baixa`,
              detail: `${avaliacoesCriticas.length} cliente(s) deram nota baixa. Verifique o feedback e entre em contato.`
            });
          }
        }
      } catch (e) {
        console.warn('Central de Alertas — erro ao buscar avaliações:', e);
      }

      // ===== SOLICITAÇÕES DO PORTAL (mensagens não lidas) =====
      try {
        const solicitacoesSnap = await getDocs(
          query(collection(db, 'mensagens_portal'), where('lida', '==', false))
        );
        const solicitacoes = [];
        solicitacoesSnap.forEach(d => solicitacoes.push({ id: d.id, ...d.data() }));
        // Este bloco complementa o de mensagens, focando em solicitações específicas
        const solicitacoesServico = solicitacoes.filter(s =>
          s.texto && (s.texto.toLowerCase().includes('orçamento') ||
                      s.texto.toLowerCase().includes('conserto') ||
                      s.texto.toLowerCase().includes('reparo') ||
                      s.texto.toLowerCase().includes('manutenção'))
        );
        if (solicitacoesServico.length > 0) {
          alertas.push({
            icon: '🔧', cat: 'atencao', cor: 'atencao',
            title: 'SOLICITAÇÕES DE SERVIÇO',
            sub: `${solicitacoesServico.length} solicitação(ões) de serviço`,
            detail: `${solicitacoesServico.length} cliente(s) solicitaram serviço pelo Portal do Cliente.`
          });
        }
      } catch (e) {
        console.warn('Central de Alertas — erro ao buscar solicitações:', e);
      }

    } catch (e) {
      console.warn('Central de Alertas — erro ao gerar:', e);
    }

    return alertas;
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
    let lista = DICAS; // começa com dicas; vira lista de alertas quando houver pendências

    const CAT_CLASS = { crm: 'cat-crm', vendas: 'cat-vendas', motivacional: 'cat-motivacional', atencao: 'cat-atencao', critico: 'cat-critico' };
    const BAR_CLASS = { crm: 'cat-crm-bar', vendas: 'cat-vendas-bar', motivacional: 'cat-motivacional-bar', atencao: 'cat-atencao-bar', critico: 'cat-critico-bar' };
    const DURATION  = 120000; // 120s por alerta/dica na tela

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

    // Aplica nova lista (alertas reais ou dicas) reiniciando o ciclo
    const aplicarLista = (nova) => {
      lista = (nova && nova.length) ? nova : DICAS;
      idx = 0;
      mostrar(lista[0], true);
    };

    // Verifica os módulos e atualiza a lista de alertas
    const atualizarAlertas = async () => {
      try {
        const alertas = await this.gerarAlertas();
        aplicarLista(alertas);
      } catch (e) {
        console.warn('Central de Alertas:', e);
        aplicarLista(DICAS);
      }
    };

    // Primeira verificação ao abrir
    atualizarAlertas();

    // Rotaciona o que estiver na tela (alertas ou dicas)
    setInterval(() => {
      idx = (idx + 1) % lista.length;
      mostrar(lista[idx], true);
    }, DURATION); // 120 segundos

    // Re-verifica os módulos a cada 3 minutos
    setInterval(atualizarAlertas, 180000);
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
      'central-comandos': '../../pages/central-informacoes/index.html',
      'central-informacoes': '../../pages/central-informacoes/index.html',
      autoatendimento: '../../pages/autoatendimento/index.html',
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
      'acaodasemana':   '../../pages/acaodasemana/index.html',
      'portal-cliente': '../../pages/portal-cliente/index.html'
    };
    const url = routes[module];
    if (url) {
      console.log(`[Router] Navegando para: ${module}`);
      window.location.href = url;
    } else {
      console.warn(`[Router] Rota não encontrada: ${module}`);
    }
  }

  // ===== AVISO DE EVENTOS DA AGENDA =====
  // Prioridade: 1. Atrasados (qualquer dia), 2. Horário atual, 3. Próximos (até 15 min)
  setupAvisoAcoes() {
    let ultimoAvisoKey = ''; // controla para não repetir o mesmo aviso

    const _fmtAtraso = (min) => {
      const abs = Math.abs(min);
      if (abs >= 1440) return `${Math.floor(abs/1440)}d ${Math.floor((abs%1440)/60)}h`;
      if (abs >= 60)   return `${Math.floor(abs/60)}h${abs%60 ? ' '+(abs%60)+'min' : ''}`;
      return `${abs} min`;
    };

    const tocarSom = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
      } catch {}
    };

    const dispararAlerta = (evento, label) => {
      const card = document.querySelector('.alerts-card');
      const titleEl    = document.querySelector('.alert-title');
      const subtitleEl = document.querySelector('.alert-subtitle');
      const detailEl   = document.querySelector('.alert-detail');
      const iconEl     = document.getElementById('alert-cat-icon');
      if (!card || !titleEl) return;

      const horaFmt = evento.hora || '';
      if (iconEl) iconEl.textContent = '⏰';
      titleEl.textContent = `AGENDA — ${label}`;
      titleEl.className = 'alert-title cat-alerta-acao';
      if (subtitleEl) subtitleEl.textContent = evento.titulo;
      if (detailEl) detailEl.textContent = horaFmt ? `Horário: ${horaFmt}` : '';

      card.classList.add('alert-card-pulsing');
      tocarSom();
      setTimeout(() => card.classList.remove('alert-card-pulsing'), 10000);
    };

    const verificar = async () => {
      try {
        const eventos = await this._lerAgenda();
        const agora = new Date();
        const agoraTs = Date.now();
        const hojeISO = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}`;
        const hAtual = agora.getHours();
        const mAtual = agora.getMinutes();
        const minsAtual = hAtual * 60 + mAtual;

        // ─── Helper: verifica se evento está atrasado ───
        const estaAtrasado = (e) => {
          if (e.concluido || e.alerta === false || !e.data) return false;
          if (e.hora) return new Date(`${e.data}T${e.hora}:00`).getTime() < agoraTs;
          return e.data < hojeISO; // sem horário — data passou
        };

        // 1. PRIORIDADE MÁXIMA — ATRASADOS (qualquer dia/hora no passado, não concluído)
        const atrasados = (eventos || []).filter(estaAtrasado);

        if (atrasados.length > 0) {
          const pior = atrasados.sort((a, b) => {
            const tsA = new Date(`${a.data}T${a.hora || '00:00'}:00`).getTime();
            const tsB = new Date(`${b.data}T${b.hora || '00:00'}:00`).getTime();
            return tsA - tsB;
          })[0];
          const dtPior = new Date(`${pior.data}T${pior.hora || '00:00'}:00`);
          const diffMin = Math.round((agoraTs - dtPior.getTime()) / 60000);
          const key = `atrasado_${pior.data}_${pior.hora}`;
          if (ultimoAvisoKey !== key) {
            ultimoAvisoKey = key;
            dispararAlerta(pior, `ATRASADO há ${_fmtAtraso(diffMin)}`);
          }
          return; // atrasado tem prioridade total
        }

        // 2. SEGUNDA PRIORIDADE — HORÁRIO ATUAL (hoje, diff 0–5 min)
        for (const evento of eventos) {
          if (evento.concluido || evento.alerta === false || !evento.data || !evento.hora) continue;
          if (evento.data !== hojeISO) continue;
          const [hEv, mEv] = evento.hora.split(':').map(Number);
          const evMin = hEv * 60 + mEv;
          const diff = evMin - minsAtual;

          if (diff >= 0 && diff <= 5) {
            const key = `agora_${evento.hora}`;
            if (ultimoAvisoKey !== key) {
              ultimoAvisoKey = key;
              dispararAlerta(evento, diff === 0 ? 'AGORA!' : `em ${diff} min`);
            }
            return;
          }
        }

        // 3. TERCEIRA PRIORIDADE — PRÓXIMOS (hoje, 6–15 min)
        for (const evento of eventos) {
          if (evento.concluido || evento.alerta === false || !evento.data || !evento.hora) continue;
          if (evento.data !== hojeISO) continue;
          const [hEv, mEv] = evento.hora.split(':').map(Number);
          const evMin = hEv * 60 + mEv;
          const diff = evMin - minsAtual;

          if (diff > 5 && diff <= 15) {
            const key = `prox_${evento.hora}`;
            if (ultimoAvisoKey !== key) {
              ultimoAvisoKey = key;
              dispararAlerta(evento, `em ${diff} min`);
            }
            return;
          }
        }

        // Nada a alertar — reseta para permitir novos avisos
        ultimoAvisoKey = '';

      } catch {}
    };

    verificar();
    setInterval(verificar, 60000);
  }

  // ===== ALARME PARA OS NOVA =====
  setupAlarmeOS() {
    const panel = document.getElementById('alarme-panel');
    const btnClose = document.getElementById('alarme-close');
    const toggleAtivo = document.getElementById('alarme-ativo');
    const inputHoraInicio = document.getElementById('alarme-hora-inicio');
    const inputHoraFim = document.getElementById('alarme-hora-fim');
    const inputVolume = document.getElementById('alarme-volume');
    const inputAnotacao = document.getElementById('alarme-anotacao');
    const btnTestar = document.getElementById('alarme-testar-btn');
    const btnSalvar = document.getElementById('alarme-salvar-btn');
    const diasChecks = document.querySelectorAll('.alarme-dia-check');
    const statusLabel = document.getElementById('alarme-status-label');
    const volumeLabel = document.getElementById('alarme-volume-label');
    const debugInfo = document.getElementById('alarme-debug-info');

    if (!panel) return;

    // Registra Service Worker para background
    const registrarServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.register('/CRM/pages/dashboard/sw-alarme.js', {
            scope: '/CRM/'
          });
          console.log('✓ Service Worker Alarme registrado');

          // Registra Background Sync (sincronizar a cada hora)
          if ('sync' in reg) {
            try {
              await reg.sync.register('alarme-sync');
              console.log('📡 Background Sync registrado');
            } catch (e) {
              console.warn('Background Sync:', e);
            }
          }

          // Registra Periodic Background Sync (Android) - a cada 60 minutos
          if ('periodicSync' in reg) {
            try {
              await reg.periodicSync.register('alarme-periodico', {
                minInterval: 60 * 60 * 1000 // 60 minutos
              });
              console.log('⏰ Periodic Sync registrado (Android)');
            } catch (e) {
              console.warn('Periodic Sync:', e);
            }
          }

          return reg;
        } catch (e) {
          console.warn('⚠️ Service Worker:', e.message);
        }
      }
    };

    // Pede permissão de notificações
    const solicitarPermissaoNotificacoes = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            atualizarDebug('✓ Notificações ativadas');
            return true;
          }
        } catch (e) {
          console.warn('Notificações:', e);
        }
      }
      return Notification.permission === 'granted';
    };

    // Envia config para Service Worker
    const enviarConfigSW = (config) => {
      if (navigator.serviceWorker.controller) {
        const userId = localStorage.getItem('cc_nota_uid') || 'user_default';
        navigator.serviceWorker.controller.postMessage({
          tipo: 'iniciarRelogio',
          config: config,
          userId: userId
        });
        console.log('📤 Config enviada ao Service Worker');
      }
    };

    registrarServiceWorker();

    let audioContext = null;
    let isTocarAlarm = false;
    let unsubscribeOS = null;
    let ultimaOSDetectada = null;
    let intervaloVerificacao = null;
    let intervaloRelogio = null;
    let ultimoDisparo = null;
    let unsubscribeFirebase = null;
    let atualizandoDoFirebase = false;
    let alarmes = []; // Array de múltiplos alarmes

    // ===== LISTENER PARA MENSAGENS DO SERVICE WORKER =====
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { tipo, hora, anotacao, repeticao } = event.data;

        if (tipo === 'alarmeDisparou') {
          console.log(`📢 Alarme disparou às ${hora}: ${anotacao}`);
          atualizarDebug(`🔔 ALARME! ${hora} - ${anotacao}`);

          // Toca o som do alarme no app se ele estiver aberto
          const volume = (inputVolume?.value || 80) / 100;
          gerarSomAlarme(10, volume);

          // Foco na janela se estiver minimizada
          window.focus();

          // Vibração no Android
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 200]);
          }
        }
      });
      console.log('✅ Listener de mensagens do Service Worker configurado');
    }

    const atualizarDebug = (msg) => {
      const agora = new Date();
      const hora = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0') + ':' + String(agora.getSeconds()).padStart(2, '0');
      debugInfo.textContent = `[${hora}] ${msg}`;
      console.log(msg);
    };

    // Adicionar novo alarme
    const adicionarAlarme = () => {
      console.log('📥 [DEBUG] adicionarAlarme chamado');

      try {
        if (!inputHoraInicio || !inputAnotacao) {
          console.warn('⚠️ Elementos não encontrados');
          atualizarDebug('⚠️ Elementos não carregados');
          return;
        }

        const inputRepeticao = document.getElementById('alarme-repeticao');
        const repeticao = inputRepeticao ? parseInt(inputRepeticao.value) || 0 : 0;

        const novoAlarme = {
          id: Date.now().toString(),
          ativo: true,
          horaInicio: inputHoraInicio.value || '09:00',
          horaFim: inputHoraFim.value || '18:00',
          volume: inputVolume.value || 80,
          anotacao: inputAnotacao.value || 'Novo Alarme',
          dias: Array.from(diasChecks || [])
            .filter(c => c.checked)
            .map(c => parseInt(c.value)),
          repeticao: repeticao
        };

        console.log('📋 Novo alarme:', novoAlarme);

        alarmes.push(novoAlarme);
        salvarAlarmes();
        renderizarAlarmes();

        const msgRepeticao = repeticao > 0 ? ` (repete a cada ${repeticao}s)` : '';
        atualizarDebug(`➕ Alarme adicionado: ${novoAlarme.horaInicio}${msgRepeticao}`);

        console.log('✅ Alarme adicionado com sucesso');
      } catch (e) {
        console.error('❌ Erro ao adicionar alarme:', e);
        atualizarDebug(`❌ Erro: ${e.message}`);
      }
    };

    // Abrir/Editar alarme
    const abrirAlarme = (id) => {
      console.log('📂 [DEBUG] Abrindo alarme:', id);

      const alarme = alarmes.find(a => a.id === id);
      if (!alarme) {
        console.warn('⚠️ [DEBUG] Alarme não encontrado:', id);
        atualizarDebug('⚠️ Alarme não encontrado');
        return;
      }

      try {
        // Preenche os campos com dados do alarme
        if (inputHoraInicio) inputHoraInicio.value = alarme.horaInicio || '09:00';
        if (inputHoraFim) inputHoraFim.value = alarme.horaFim || '18:00';
        if (inputVolume) inputVolume.value = alarme.volume || 80;
        if (inputAnotacao) inputAnotacao.value = alarme.anotacao || 'Alarme';

        // Marca os dias
        if (diasChecks && diasChecks.length > 0) {
          diasChecks.forEach(check => {
            check.checked = (alarme.dias || []).includes(parseInt(check.value));
          });
        }

        // Define repetição
        const inputRepeticao = document.getElementById('alarme-repeticao');
        if (inputRepeticao) {
          inputRepeticao.value = alarme.repeticao || 0;
        }

        atualizarLabels();

        // Garante que o painel está visível
        if (panel && panel.style.display === 'none') {
          panel.style.display = 'flex';
          console.log('📂 Painel aberto automaticamente');
        }

        atualizarDebug(`✏️ Editando: ${alarme.anotacao}`);

        // Scroll para os campos
        setTimeout(() => {
          panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        console.log('✅ [DEBUG] Alarme aberto com sucesso:', alarme);
      } catch (e) {
        console.error('❌ [DEBUG] Erro ao abrir alarme:', e);
        atualizarDebug('❌ Erro ao abrir: ' + e.message);
      }
    };

    // Remover alarme
    const removerAlarme = (id) => {
      alarmes = alarmes.filter(a => a.id !== id);
      salvarAlarmes();
      renderizarAlarmes();
      atualizarDebug('🗑️ Alarme removido');
    };

    // Renderizar lista de alarmes
    const renderizarAlarmes = () => {
      const lista = document.getElementById('alarmes-lista');
      console.log('🎨 renderizarAlarmes chamado, lista:', lista, 'alarmes:', alarmes.length);
      if (!lista) {
        console.warn('⚠️ Lista não encontrada!');
        return;
      }

      if (alarmes.length === 0) {
        console.log('📭 Nenhum alarme, mostrando vazio');
        lista.innerHTML = '<div style="padding: 10px; color: var(--text-tertiary); text-align: center; font-size: 12px;">Nenhum alarme adicionado</div>';
        return;
      }

      const html = alarmes.map(alarme => {
        const repeticaoText = alarme.repeticao > 0 ? ` 🔁 ${alarme.repeticao}s` : '';
        return `
          <div style="padding: 10px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s; user-select: none; background: rgba(0,200,83,0.03);" onmouseover="this.style.background='rgba(0,200,83,0.08)'" onmouseout="this.style.background='rgba(0,200,83,0.03)'" onclick="console.log('Clicou em:', '${alarme.id}'); window.abrirAlarme('${alarme.id}'); return false;">
            <div style="flex: 1;">
              <div style="font-size: 13px; font-weight: 600; color: var(--cell-green); margin-bottom: 3px;">
                ⏰ ${alarme.horaInicio} → ${alarme.horaFim}${repeticaoText}
              </div>
              <div style="color: var(--text-tertiary); font-size: 11px; margin-bottom: 2px;">${alarme.anotacao || 'Sem descrição'}</div>
              <div style="color: var(--text-tertiary); font-size: 10px;">📅 ${alarme.dias?.length || 0} dias</div>
            </div>
            <button onclick="event.stopPropagation(); event.preventDefault(); window.removerAlarme('${alarme.id}'); return false;" style="background: none; border: none; color: var(--accent-red); cursor: pointer; font-size: 16px; padding: 4px 8px; flex-shrink: 0;">✕</button>
          </div>
        `;
      }).join('');

      lista.innerHTML = html;
      console.log('✅ Lista renderizada com', alarmes.length, 'alarme(s)');
    };

    // Salvar alarmes em Firebase
    const salvarAlarmes = async () => {
      if (atualizandoDoFirebase) {
        console.warn('⏳ Atualizando do Firebase, ignorando salvar');
        return;
      }

      const config = {
        alarmes: alarmes,
        atualizadoEm: new Date().toISOString(),
        dispositivo: navigator.userAgent.substring(0, 50)
      };

      console.log('💾 Salvando alarmes:', config);
      // Salva localmente
      localStorage.setItem('alarme_os_config', JSON.stringify(config));
      console.log('✅ Salvo no localStorage');

      // 📤 ENVIA AO SERVICE WORKER (INICIA MONITORAMENTO)
      const enviarAoServiceWorker = () => {
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({
            tipo: 'atualizarConfig',
            config: config,
            timestamp: Date.now()
          });
          console.log('📤 Config enviada ao Service Worker com alarmes ativas');
        }
      };

      // Salva no Firebase
      try {
        const { setDoc } = await import('../../scripts/firebase.js');
        const userId = localStorage.getItem('cc_nota_uid') || 'user_default';
        const docRef = doc(db, 'alarme_config', userId);

        // Inclui informação de dispositivo para rastrear sincronização
        const configComMetadata = {
          ...config,
          ultimaAtualizacao: {
            timestamp: Date.now(),
            dispositivo: navigator.userAgent.substring(0, 100),
            seuUserId: userId
          }
        };

        await setDoc(docRef, configComMetadata, { merge: true });
        console.log('✅ Salvo no Firebase - URL:', `alarme_config/${userId}`);
        atualizarDebug('☁️ Alarmes sincronizados com Firebase');

        // Aguarda um pouco para garantir que Firebase atualizou
        setTimeout(() => {
          enviarAoServiceWorker();
        }, 300);
      } catch (e) {
        console.error('❌ Erro ao sincronizar Firebase:', e);
        atualizarDebug(`❌ Erro Firebase: ${e.message}`);
        // Mesmo com erro, tenta avisar o SW
        enviarAoServiceWorker();
      }
    };

    // Carregar alarmes do localStorage
    const carregarAlarmes = () => {
      const config = JSON.parse(localStorage.getItem('alarme_os_config') || '{}');
      console.log('📂 carregarAlarmes - config:', config);
      if (config.alarmes && Array.isArray(config.alarmes)) {
        alarmes = config.alarmes;
        console.log('✅ Alarmes carregados:', alarmes.length);
      } else {
        console.log('❌ Nenhum alarme no localStorage');
      }
      renderizarAlarmes();
    };

    // Antigo: manter compatibilidade
    const salvarConfiguracao = salvarAlarmes;

    const atualizarHoraDispositivo = () => {
      const agora = new Date();
      const h = String(agora.getHours()).padStart(2, '0');
      const m = String(agora.getMinutes()).padStart(2, '0');
      const horaDispositivo = document.getElementById('alarme-hora-dispositivo');
      if (horaDispositivo) horaDispositivo.textContent = `${h}:${m}`;
    };

    const iniciarRelogio = () => {
      if (intervaloRelogio) clearInterval(intervaloRelogio);

      intervaloRelogio = setInterval(() => {
        if (!toggleAtivo.checked) return;

        const agora = new Date();
        const diaAtual = agora.getDay();
        const hAtual = agora.getHours();
        const mAtual = agora.getMinutes();
        const horaAtualFormatada = String(hAtual).padStart(2, '0') + ':' + String(mAtual).padStart(2, '0');

        const [hInicio, mInicio] = inputHoraInicio.value.split(':').map(Number);
        const horaInicioFormatada = String(hInicio).padStart(2, '0') + ':' + String(mInicio).padStart(2, '0');

        const diaPermitido = Array.from(diasChecks)
          .filter(c => c.checked)
          .map(c => parseInt(c.value))
          .includes(diaAtual);

        // Se chegou na hora início e está dentro de um dia permitido
        if (horaAtualFormatada === horaInicioFormatada && diaPermitido) {
          // Evita disparar várias vezes na mesma hora
          if (ultimoDisparo !== horaInicioFormatada) {
            ultimoDisparo = horaInicioFormatada;
            atualizarDebug(`⏰ HORA CHEGOU! ${horaInicioFormatada} - DISPARANDO!`);
            const volume = parseInt(inputVolume.value) / 100;
            gerarSomAlarme(10, volume);
          }
        }
      }, 1000);
    };

    const carregarConfiguracao = () => {
      try {
        if (!toggleAtivo || !inputHoraInicio) {
          console.warn('⚠️ Elementos ainda não carregados, pulando carregarConfiguracao');
          return;
        }
        const config = JSON.parse(localStorage.getItem('alarme_os_config') || '{}');
        atualizarUiComConfig(config);
        atualizarLabels();
        atualizarHoraDispositivo();
      } catch (e) {
        console.error('❌ Erro ao carregar configuração:', e);
      }
    };

    const atualizarUiComConfig = (config) => {
      if (!config) return;
      if (!toggleAtivo || !inputHoraInicio) {
        console.warn('⚠️ Elementos não encontrados ao atualizar UI');
        return;
      }

      try {
        if (config.ativo !== undefined && toggleAtivo) toggleAtivo.checked = config.ativo;
        if (config.horaInicio && inputHoraInicio) inputHoraInicio.value = config.horaInicio;
        if (config.horaFim && inputHoraFim) inputHoraFim.value = config.horaFim;
        if (config.volume && inputVolume) inputVolume.value = config.volume;
        if (config.anotacao && inputAnotacao) inputAnotacao.value = config.anotacao;
        if (config.dias && config.dias.length > 0 && diasChecks && diasChecks.length > 0) {
          diasChecks.forEach(c => c.checked = config.dias.includes(parseInt(c.value)));
        }
      } catch (e) {
        console.error('❌ Erro ao atualizar UI:', e);
      }
    };

    const sincronizarComFirebase = async () => {
      try {
        // Aguarda elementos estarem prontos
        if (!toggleAtivo || !inputHoraInicio) {
          console.warn('⚠️ Aguardando elementos para sincronizar');
          setTimeout(() => sincronizarComFirebase(), 500);
          return;
        }

        const { onSnapshot } = await import('../../scripts/firebase.js');
        const userId = localStorage.getItem('cc_nota_uid') || 'user_default';
        const docRef = doc(db, 'alarme_config', userId);

        if (unsubscribeFirebase) unsubscribeFirebase();

        console.log('🔄 Configurando listener Firebase para:', userId);

        unsubscribeFirebase = onSnapshot(docRef, (snapshot) => {
          if (snapshot.exists()) {
            const configFirebase = snapshot.data();
            const timestamp = configFirebase.ultimaAtualizacao?.timestamp || Date.now();
            const dispositivoRemoto = configFirebase.ultimaAtualizacao?.dispositivo || 'Outro dispositivo';

            console.log('📡 Alteração detectada do Firebase:', dispositivoRemoto);

            // Verifica se é uma atualização do mesmo dispositivo
            const ehDoMesmDispositivo = dispositivoRemoto.includes(navigator.userAgent.substring(0, 30));

            if (!ehDoMesmDispositivo && !atualizandoDoFirebase) {
              // Vem de outro dispositivo, atualiza!
              console.log('🔄 Recebendo alteração de outro dispositivo - sincronizando...');
              atualizandoDoFirebase = true;

              // Atualiza a lista de alarmes
              if (configFirebase.alarmes && Array.isArray(configFirebase.alarmes)) {
                alarmes = configFirebase.alarmes;
                console.log('✅ Alarmes atualizados:', alarmes.length);
              }

              atualizarUiComConfig(configFirebase);
              localStorage.setItem('alarme_os_config', JSON.stringify(configFirebase));
              renderizarAlarmes();
              atualizarLabels();

              atualizarDebug(`🔄 Sincronizado de outro dispositivo! ${alarmes.length} alarmes`);

              // Avisa o Service Worker sobre a mudança
              if (navigator.serviceWorker?.controller) {
                navigator.serviceWorker.controller.postMessage({
                  tipo: 'atualizarConfig',
                  config: configFirebase,
                  timestamp: timestamp
                });
              }

              atualizandoDoFirebase = false;
            } else {
              // É do próprio dispositivo, só atualiza timestamp
              console.log('✓ Confirmação da própria sincronização');
            }
          } else {
            console.log('📭 Nenhuma config no Firebase ainda');
          }
        }, (error) => {
          console.error('❌ Erro ao escutar Firebase:', error);
          atualizarDebug(`❌ Erro sincronização: ${error.message}`);
        });

        atualizarDebug('☁️ Sincronização ativa - monitorando alterações');
      } catch (e) {
        console.warn('Erro sincronização Firebase:', e);
      }
    };

    const atualizarLabels = () => {
      if (!toggleAtivo || !statusLabel || !volumeLabel || !inputVolume) {
        console.warn('⚠️ Elementos ausentes em atualizarLabels');
        return;
      }
      try {
        statusLabel.textContent = toggleAtivo.checked ? '✓ Ativado' : 'Desativado';
        volumeLabel.textContent = inputVolume.value + '%';
      } catch (e) {
        console.error('❌ Erro em atualizarLabels:', e);
      }
    };

    const tocarSomTeste = () => {
      const volume = parseInt(inputVolume.value) / 100;
      gerarSomAlarme(3, volume);
      atualizarDebug('🔊 Som testado!');
    };

    const gerarSomAlarme = (duracao = 2, vol = 0.8) => {
      if (isTocarAlarm) return;
      isTocarAlarm = true;

      try {
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const freq = 800;
        const tempoFim = audioContext.currentTime + duracao;

        const tocarBeep = () => {
          if (audioContext.currentTime >= tempoFim) {
            isTocarAlarm = false;
            return;
          }

          const osc = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          osc.frequency.value = freq;
          osc.type = 'sine';

          gainNode.gain.setValueAtTime(vol, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);

          osc.connect(gainNode);
          gainNode.connect(audioContext.destination);

          osc.start(audioContext.currentTime);
          osc.stop(audioContext.currentTime + 0.1);

          setTimeout(tocarBeep, 150);
        };

        tocarBeep();
      } catch (e) {
        atualizarDebug('⚠️ Erro ao tocar som');
        isTocarAlarm = false;
      }
    };

    const verificarHorarioEDia = () => {
      const agora = new Date();
      const diaAtual = agora.getDay();
      const hAtual = agora.getHours();
      const mAtual = agora.getMinutes();
      const horaEmMinutos = hAtual * 60 + mAtual;

      const [hInicio, mInicio] = inputHoraInicio.value.split(':').map(Number);
      const [hFim, mFim] = inputHoraFim.value.split(':').map(Number);
      const minInicio = hInicio * 60 + mInicio;
      const minFim = hFim * 60 + mFim;

      const diaPermitido = Array.from(diasChecks)
        .filter(c => c.checked)
        .map(c => parseInt(c.value))
        .includes(diaAtual);

      const dentroHorario = horaEmMinutos >= minInicio && horaEmMinutos <= minFim;

      atualizarDebug(`⏰ Dia ${diaAtual} (${diaPermitido ? 'OK' : 'X'}) | ${String(hAtual).padStart(2,'0')}:${String(mAtual).padStart(2,'0')} (${dentroHorario ? 'OK' : 'X'})`);

      return diaPermitido && dentroHorario;
    };

    const monitorarOS = async () => {
      if (!toggleAtivo.checked) {
        if (unsubscribeOS) unsubscribeOS();
        if (intervaloVerificacao) clearInterval(intervaloVerificacao);
        return;
      }

      try {
        const { onSnapshot, collection } = await import('../../scripts/firebase.js');

        const ordersRef = collection(db, 'os');

        if (unsubscribeOS) unsubscribeOS();

        atualizarDebug('📡 Conectando ao Firestore...');

        unsubscribeOS = onSnapshot(ordersRef, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const osId = change.doc.id;
              const osData = change.doc.data();
              const createdAt = osData.createdAt?.toDate?.() || new Date(osData.createdAt);

              const agora = new Date();
              const diffSegundos = (agora - createdAt) / 1000;

              if (diffSegundos < 15 && ultimaOSDetectada !== osId) {
                ultimaOSDetectada = osId;
                atualizarDebug(`📦 OS nova detectada: ${osId}`);

                if (verificarHorarioEDia()) {
                  atualizarDebug(`🔔 DISPARANDO ALARME!`);
                  const volume = parseInt(inputVolume.value) / 100;
                  gerarSomAlarme(5, volume);
                } else {
                  atualizarDebug(`⏭️ Fora do horário/dia`);
                }
              }
            }
          });
        });

        atualizarDebug('✓ Monitorando OS nova...');
      } catch (e) {
        atualizarDebug(`❌ Erro Firebase: ${e.message}`);
        if (intervaloVerificacao) clearInterval(intervaloVerificacao);
        intervaloVerificacao = setInterval(() => {
          if (toggleAtivo.checked) {
            verificarHorarioEDia();
          }
        }, 5000);
      }
    };

    // Exposição global para funções de alarme (ANTES de carregar)
    window.adicionarAlarme = adicionarAlarme;
    window.abrirAlarme = abrirAlarme;
    window.removerAlarme = removerAlarme;
    window.openAlarmePanel = () => {
      const estava_oculto = panel.style.display === 'none';
      panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';

      // Se estava oculto e agora abriu, re-renderiza a lista
      if (estava_oculto && panel.style.display === 'flex') {
        console.log('📂 Painel aberto, re-renderizando lista...');
        setTimeout(() => renderizarAlarmes(), 50);
      }
    };

    // DEBUG: Função para ver status de sincronização
    window.statusAlarme = () => {
      const userId = localStorage.getItem('cc_nota_uid') || 'user_default';
      const config = JSON.parse(localStorage.getItem('alarme_os_config') || '{}');
      console.log('=== STATUS DO ALARME ===');
      console.log('User ID:', userId);
      console.log('Alarmes salvos:', alarmes.length);
      console.log('Últimas alteração:', config.ultimaAtualizacao?.timestamp);
      console.log('Dispositivo:', config.ultimaAtualizacao?.dispositivo);
      console.log('Service Worker ativo:', !!navigator.serviceWorker?.controller);
      console.log('========================');
      return { userId, alarmes: alarmes.length, config };
    };

    carregarConfiguracao();
    carregarAlarmes();

    // Aguarda um pouco para garantir que alarmes foram carregados
    setTimeout(() => {
      console.log('⏱️ Iniciando sincronização com Firebase...');
      sincronizarComFirebase();

      // Ativa o Service Worker com os alarmes carregados
      if (navigator.serviceWorker?.controller && alarmes.length > 0) {
        const config = {
          alarmes: alarmes,
          atualizadoEm: new Date().toISOString(),
          dispositivo: navigator.userAgent.substring(0, 50)
        };
        navigator.serviceWorker.controller.postMessage({
          tipo: 'atualizarConfig',
          config: config,
          timestamp: Date.now()
        });
        console.log('🚀 Service Worker ativado com', alarmes.length, 'alarmes');
        atualizarDebug(`🚀 Monitorando ${alarmes.length} alarmes em background`);
      }
    }, 500);

    // Botão adicionar usa onclick direto no HTML agora
    console.log('✅ Alarme setup completo - adicionarAlarme exposta no window');

    // Janela Flutuante (abrir em nova janela pequena)
    const abrirJanelaFlutuante = () => {
      try {
        const width = 400;
        const height = 600;
        const left = window.innerWidth - width - 20;
        const top = 100;

        const janela = window.open(
          '/CRM/pages/dashboard/index.html?mini=1',
          'alarme-flutuante',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
        );

        if (janela) {
          atualizarDebug('📺 Janela flutuante aberta! (Desktop)');
        } else {
          atualizarDebug('⚠️ Popup bloqueado. Desbloqueia popups no navegador.');
        }
      } catch (e) {
        console.warn('Erro janela:', e);
        atualizarDebug('⚠️ Erro ao abrir janela');
      }
    };

    // Notificação Persistente (agora automática ao ativar)
    const mostrarNotificacaoPersistente = async () => {
      if (!('Notification' in window)) {
        atualizarDebug('⚠️ Notificações não suportadas');
        return;
      }

      if (Notification.permission === 'denied') {
        atualizarDebug('⚠️ Notificações bloqueadas nas config');
        return;
      }

      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          atualizarDebug('⚠️ Você bloqueou notificações');
          return;
        }
      }

      // Service Worker mostra a notificação
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          tipo: 'mostrarNotificacao'
        });
        atualizarDebug('📌 Notificação persistente na barra!');
      }
    };

    // Wake Lock para manter tela acordada
    const ativarWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          const wakeLock = await navigator.wakeLock.request('screen');
          atualizarDebug('🔒 Tela será mantida acordada');

          wakeLock.addEventListener('release', () => {
            console.log('Wake Lock liberado');
          });

          // Reacquire se página volta do background
          document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && toggleAtivo.checked) {
              try {
                await navigator.wakeLock.request('screen');
              } catch (e) {
                console.warn('Erro reacquiring wake lock:', e);
              }
            }
          });
        } catch (e) {
          console.warn('Wake Lock não disponível:', e);
        }
      }
    };

    toggleAtivo.addEventListener('change', async () => {
      atualizarLabels();
      salvarConfiguracao();
      if (toggleAtivo.checked) {
        // Pede permissão de notificações
        const temPermissao = await solicitarPermissaoNotificacoes();
        if (!temPermissao) {
          atualizarDebug('⚠️ Notificações bloqueadas. Ative nas config do navegador.');
        }

        // Ativa Wake Lock para manter tela acordada
        await ativarWakeLock();

        // Mostra dica de manter aberto
        const dica = `✓ ATIVADO! Para melhor funcionamento:\n1. Deixe a janela aberta\n2. Ou clique "Janela Flutuante"\n3. Ou clique "Notif. Ativa"\n4. Clique "⚡ Atalho" para acesso rápido`;
        atualizarDebug(dica);

        // Envia config para Service Worker
        const config = {
          horaInicio: inputHoraInicio.value,
          dias: Array.from(diasChecks)
            .filter(c => c.checked)
            .map(c => parseInt(c.value)),
          anotacao: inputAnotacao.value
        };
        enviarConfigSW(config);

        monitorarOS();
        iniciarRelogio();
      } else {
        atualizarDebug('✗ Alarme DESATIVADO');
        if (unsubscribeOS) unsubscribeOS();
        if (intervaloVerificacao) clearInterval(intervaloVerificacao);
        if (intervaloRelogio) clearInterval(intervaloRelogio);
        ultimoDisparo = null;

        // Para o Service Worker
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            tipo: 'pararRelogio'
          });
        }
      }
    });

    inputHoraInicio.addEventListener('change', async () => {
      await salvarConfiguracao();
      atualizarDebug(`⏰ Início: ${inputHoraInicio.value}`);
    });

    inputHoraFim.addEventListener('change', async () => {
      await salvarConfiguracao();
      atualizarDebug(`⏰ Fim: ${inputHoraFim.value}`);
    });

    inputVolume.addEventListener('input', atualizarLabels);
    inputVolume.addEventListener('change', salvarConfiguracao);
    inputAnotacao.addEventListener('input', salvarConfiguracao);

    diasChecks.forEach(check => {
      check.addEventListener('change', () => {
        salvarConfiguracao();
      });
    });

    const btnPiP = document.getElementById('alarme-pip-btn');
    const btnNotif = document.getElementById('alarme-notif-btn');
    const btnAtalho = document.getElementById('alarme-atalho-btn');

    btnTestar.addEventListener('click', tocarSomTeste);
    btnSalvar.addEventListener('click', () => {
      salvarConfiguracao();
      atualizarDebug('💾 Config salva!');
      setTimeout(() => alert('✓ Configuração salva com sucesso!'), 100);
    });

    // Botão Janela Flutuante
    if (btnPiP) {
      btnPiP.addEventListener('click', abrirJanelaFlutuante);
    }

    // Botão Notificação Persistente
    if (btnNotif) {
      btnNotif.addEventListener('click', mostrarNotificacaoPersistente);
    }

    // Botão Atalho
    if (btnAtalho) {
      btnAtalho.addEventListener('click', () => window.criarAtalho());
    }

    btnClose.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    // Abrir/Fechar painel alarme (ANTES de ser usado)
    window.openAlarmePanel = () => {
      panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    };

    // Criar atalho para tela inicial (ANTES de ser usado)
    window.criarAtalho = () => {
      // iOS
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        alert('iOS: Menu Compartilhar → Adicionar à Tela Inicial');
        atualizarDebug('📌 iOS: Use o menu Compartilhar');
        return;
      }

      // Android
      const isAndroid = /Android/.test(navigator.userAgent);
      if (isAndroid) {
        alert('✓ Atalho já criado! Procura "Cell City" na sua tela inicial ou gaveta de apps.\n\nSe não encontrar:\n1. Menu ⋮\n2. "Instalar app"\n3. Confirma');
        atualizarDebug('⚡ Verifique a tela inicial (Android)');
      } else {
        // Desktop
        alert('Desktop: O app já está instalado.\nDesktop não suporta atalho na tela inicial.');
        atualizarDebug('💻 Desktop: Use favoritos do navegador');
      }
    };

    // Verifica se abriu via atalho (abre painel automaticamente)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('alarme') === '1') {
      setTimeout(() => {
        panel.style.display = 'flex';
        atualizarDebug('⚡ Aberto via atalho');
      }, 500);
    }

    // Expõe função globalmente se não foi feito ainda
    if (!window.openAlarmePanel) {
      window.openAlarmePanel = () => {
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
      };
    }

    // Atualiza hora do dispositivo a cada segundo
    setInterval(atualizarHoraDispositivo, 1000);

    if (toggleAtivo.checked) {
      setTimeout(async () => {
        atualizarDebug('🔔 Reiniciando monitor...');

        // Pede permissão de notificações
        await solicitarPermissaoNotificacoes();

        // Envia config para Service Worker
        const config = {
          horaInicio: inputHoraInicio.value,
          dias: Array.from(diasChecks)
            .filter(c => c.checked)
            .map(c => parseInt(c.value)),
          anotacao: inputAnotacao.value
        };
        enviarConfigSW(config);

        monitorarOS();
        iniciarRelogio();
      }, 1000);
    }

    // Listener para mensagens do Service Worker
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.tipo === 'alarmeDisparat') {
          atualizarDebug(`🔔 ALARME DISPAROU: ${event.data.hora}`);
          const volume = parseInt(inputVolume.value) / 100;
          gerarSomAlarme(5, volume);
        }
      });

      // Envia config atualizada ao SW a cada 30 segundos (redundância)
      // Garante que SW sempre tem config mais recente
      setInterval(() => {
        if (toggleAtivo.checked && navigator.serviceWorker.controller) {
          const config = {
            ativo: toggleAtivo.checked,
            horaInicio: inputHoraInicio.value,
            horaFim: inputHoraFim.value,
            volume: inputVolume.value,
            anotacao: inputAnotacao.value,
            dias: Array.from(diasChecks)
              .filter(c => c.checked)
              .map(c => parseInt(c.value)),
            timestamp: Date.now()
          };
          navigator.serviceWorker.controller.postMessage({
            tipo: 'atualizarConfig',
            config: config
          });
        }
      }, 30000); // 30 segundos
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