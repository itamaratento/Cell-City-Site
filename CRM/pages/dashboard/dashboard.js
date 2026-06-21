/* ============================================
CELL CITY CRM — DASHBOARD CONTROLLER v4.3 FINAL
✅ ETAPA 1: Data completa + Relógio + Logo + Alertas em modo seguro
✅ ETAPA 2: Meta Semanal conectada ao resumo_live do Firestore
============================================ */
import { db, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, onSnapshot, query, where, orderBy, limit } from "../../scripts/firebase.js";
import { getUid, onUid } from "../../shared/session.js";
import { ccTocarSom, ccLog, ccSonsHabilitados } from "../../shared/cc-audio.js";


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
          { id: 'em-breve',    title: 'Em Breve',    sub: 'Módulo' },
          { id: 'diario',      title: 'Diário',      sub: 'Módulo' }
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
    this.setupDiarioBadge();
    this.setupAlerts();
    this.setupGlobalSearch();
    this.setupCalendar();
    this.setupModules();
    this.setupDockTools();
    this.setupSea();
    this.setupSidebar();
    this.setupPanelRight();
    this.setupExecutivePanel();
    this.setupKeyboardShortcuts();
    this.setupOutsideClicks();
    this.setupAvisoAcoes();
    this.monitorarCardAcaoSemana();
    this.setupAlarmeOS();
    this.setupCompactMode();
    this.setupConfigAlertas();
    this.setupPainelFinanceiro();
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

    // Identidade ESTÁVEL da conta (substitui o antigo cc_nota_uid aleatório).
    let docRef = doc(db, 'notas_usuarios', getUid());
    let saveTimer = null;
    let notaUnsub = null;

    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

    // Sincronização em tempo real — aplica valor remoto quando não está digitando
    const assinarNota = () => {
      if (notaUnsub) { notaUnsub(); notaUnsub = null; }
      docRef = doc(db, 'notas_usuarios', getUid());
      notaUnsub = onSnapshot(docRef, (snap) => {
        const remoto = snap.exists() ? (snap.data().conteudo || '') : '';
        if (document.activeElement !== textarea && textarea.value !== remoto) {
          textarea.value = remoto;
        }
        setStatus('✓ sincronizado');
      }, () => setStatus(''));
    };
    onUid(() => assinarNota());

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
            userId: getUid()
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

  // ===== DIÁRIO — alerta de revisões vencidas (coleção isolada diario_registros) =====
  // Lê apenas diario_registros; não toca em módulos operacionais.
  async setupDiarioBadge() {
    const badge = document.getElementById('diario-badge');
    if (!badge) return;
    const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);
    try {
      onSnapshot(collection(db, 'diario_registros'), snap => {
        let vencidas = 0;
        snap.forEach(d => {
          const r = d.data();
          if (!r || !r.dataRevisao) return;
          if (r.status === 'concluido' || r.status === 'arquivado') return;
          const rev = new Date(r.dataRevisao + 'T00:00:00');
          if (!isNaN(rev.getTime()) && rev < hoje0) vencidas++;
        });
        if (vencidas > 0) {
          badge.textContent = vencidas;
          badge.style.display = '';
          badge.classList.remove('empty');
        } else {
          badge.style.display = 'none';
        }
      });
    } catch (e) {
      console.warn('Erro ao carregar revisões do Diário:', e);
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

        // Helper para gerar evento individual
        // ⚠ REGRA: a Ação da Semana só conta tarefas com HORÁRIO VÁLIDO (HH:MM).
        //    Notas sem horário definido NÃO entram na contagem/alerta do painel.
        const gerarEvento = (dataAlvo, hora, titulo, concluido, recorrente) => {
          if (!/^\d{1,2}:\d{2}$/.test(hora || '')) return; // sem horário válido → não alerta
          const desc = semHora(titulo) || titulo;
          const rotulo = recorrente
            ? `🔄 ${['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][new Date(dataAlvo + 'T00:00:00').getDay()]} ${hora} ${desc}`
            : `${hora} ${desc}`;
          eventos.push({
            data: dataAlvo, hora, titulo: desc,
            concluido: !!concluido, alerta: true,
            recorrente: !!recorrente, rotulo,
            // 🐛 DEBUG TEMPORÁRIO — origem do evento (remover após investigação)
            _docId: d.id, _colecao: 'agenda',
            _recorrencia: dados.recorrencia || '(nenhuma)',
            _alertaDashboard: dados.alertaDashboard === true
          });
        };

        // Helper para gerar eventos de todas as notas de um dia.
        // (gerarEvento já descarta notas sem horário válido.)
        const gerarEventosDoDia = (dataAlvo, horaPadrao) => {
          notas.forEach(n => {
            const hora = horaDoTexto(n.texto) || horaPadrao;
            gerarEvento(dataAlvo, hora, n.texto, n.concluido, !!dados.recorrencia);
          });
        };

        // Verificar se uma tarefa está concluída (todas as notas concluídas OU
        // se alguma nota ainda está pendente)
        const temPendente = notas.some(n => !n.concluido);

        if (dados.recorrencia) {
          // ===== TAREFA RECORRENTE =====
          // Só gera alerta no Dashboard se "Exibir alerta no painel" estiver marcado.
          // (Mesma regra das tarefas não-recorrentes — antes esse ramo ignorava o flag,
          //  gerando alertas-fantasma de tarefas que não aparecem na Ação da Semana.)
          if (dados.alertaDashboard !== true) return;

          const horaPadrao = /^\d{1,2}:\d{2}$/.test(dados.alertaHora || '') ? dados.alertaHora : '';

          // Respeita as mesmas exclusões/encerramento que o módulo Ação da Semana:
          //  - recorrenciaExcluir: ocorrências individuais que o usuário removeu
          //  - recorrenciaPararEm: recorrência encerrada a partir desta data
          const excluir = Array.isArray(dados.recorrenciaExcluir) ? dados.recorrenciaExcluir : [];
          const pararEm = dados.recorrenciaPararEm || '';
          const ocorrenciaValida = (iso) => !excluir.includes(iso) && !(pararEm && iso >= pararEm);

          // 1. Gera evento para a DATA ORIGINAL se for passado (para aparecer como atrasada)
          if (dia < hojeISO && temPendente && ocorrenciaValida(dia)) {
            gerarEventosDoDia(dia, horaPadrao);
          }

          // 2. Gera evento para HOJE se o padrão de recorrência bater
          if (recCai(hojeISO, dia, dados.recorrencia) && ocorrenciaValida(hojeISO)) {
            // Evita duplicar quando a data original é hoje
            if (dia === hojeISO) {
              gerarEventosDoDia(hojeISO, horaPadrao);
            } else {
              // Data original é diferente de hoje — gera eventos para hoje com base
              // nas notas (se houver pendentes)
              if (temPendente) {
                gerarEventosDoDia(hojeISO, horaPadrao);
              }
            }
          }
        } else {
          // ===== TAREFA NÃO RECORRENTE =====
          // Só gera eventos se o usuário ativou explicitamente o alerta no Dashboard.
          // Caso contrário, a tarefa é apenas um lembrete local no calendário
          // e NÃO deve aparecer na Central de Alertas / Ação da Semana.
          if (dados.alertaDashboard !== true) return;

          const horaPadrao = /^\d{1,2}:\d{2}$/.test(dados.alertaHora || '') ? dados.alertaHora : '';

          // Gera evento para a DATA ORIGINAL (passada, hoje ou futura)
          // Se for passada, aparecerá como atrasada no Dashboard
          gerarEventosDoDia(dia, horaPadrao);
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
  // ⚠ Regras de prioridade:
  //   1. Tarefas VENCIDAS (qualquer dia passado, não concluídas)
  //   2. Tarefas do HORÁRIO ATUAL (hoje, janela 0–5 min)
  //   3. Tarefas PRÓXIMAS (hoje, 6–15 min)
  // O card SÓ para de destacar quando TODAS as tarefas vencidas forem concluídas
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

    const _fmtData = (dataISO) => {
      if (!dataISO) return '';
      const [y, m, d] = dataISO.split('-').map(Number);
      return `${d}/${m}`;
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

      // ─── Separa atrasados entre dias anteriores e hoje ───
      const atrasados = (eventos || []).filter(estaAtrasado);
      const atrasadosDiasAnteriores = atrasados.filter(e => e.data < hojeISO);
      const atrasadosHoje = atrasados.filter(e => e.data === hojeISO);

      // 2. HORÁRIO ATUAL — tarefas de hoje com hora exata agora (janela 0–5 min)
      const noHorario = (eventos || []).filter(e => {
        if (e.concluido || !e.data || !e.hora) return false;
        if (e.data !== hojeISO) return false;
        const diff = diffMinEvento(e);
        return diff >= 0 && diff <= 5;
      });

      // 3. PRÓXIMOS — tarefas de hoje até 15 min
      const proximos = (eventos || []).filter(e => {
        if (e.concluido || !e.data || !e.hora) return false;
        if (e.data !== hojeISO) return false;
        const diff = diffMinEvento(e);
        return diff > 5 && diff <= 15;
      });

      // ─── Prioridade: atrasados > noHorario > proximos > padrão ───
      const totalPendentes = atrasados.length + noHorario.length;
      const contador = totalPendentes > 1 ? `(${totalPendentes}) ` : '';

      if (atrasados.length > 0) {
        // ⚠ PRIORIDADE 1 — Tarefas VENCIDAS (inclui dias anteriores)
        // Destaca o card ENQUANTO houver pelo menos uma não concluída
        card.classList.add('acao-vencida');

        // Pega a MAIS atrasada (mais antiga primeiro)
        const pior = atrasados.sort((a, b) => {
          const tsA = new Date(`${a.data}T${a.hora || '00:00'}:00`).getTime();
          const tsB = new Date(`${b.data}T${b.hora || '00:00'}:00`).getTime();
          return tsA - tsB;
        })[0];

        if (subEl) {
          const dt = new Date(`${pior.data}T${pior.hora || '00:00'}:00`);
          const atrasoMin = Math.max(0, Math.round((agora - dt.getTime()) / 60000));
          const rot = pior.rotulo || `${pior.hora || ''} ${pior.titulo}`;

          // Se tem tarefas de dias anteriores, mostra indicador extra
          if (atrasadosDiasAnteriores.length > 0 && atrasadosHoje.length > 0) {
            subEl.textContent = `🔴 ${contador}${atrasadosDiasAnteriores.length} de ontem · ${atrasadosHoje.length} de hoje · ${_fmtAtraso(atrasoMin)} atrasado`;
          } else if (atrasadosDiasAnteriores.length > 0) {
            subEl.textContent = `🔴 ${contador}${rot} · ${_fmtAtraso(atrasoMin)} atrasado (${_fmtData(pior.data)})`;
          } else {
            subEl.textContent = `🔴 ${contador}${rot} · ${_fmtAtraso(atrasoMin)} atrasado`;
          }
        }
      } else if (noHorario.length > 0) {
        // ⚠ PRIORIDADE 2 — Tarefas no HORÁRIO ATUAL
        card.classList.add('acao-vencida');
        if (subEl) {
          const ev = noHorario[0];
          const rot = ev.rotulo || `${ev.hora} ${ev.titulo}`;
          subEl.textContent = `🔴 ${contador}${rot} · AGORA!`;
        }
      } else {
        // ✅ Nenhuma tarefa urgente — estado normal
        card.classList.remove('acao-vencida');
        if (subEl) {
          // Próximo compromisso futuro
          const prox = this._proximoCompromisso(eventos);
          if (prox) {
            const rotProx = prox.rotulo || `${prox.hora ? prox.hora + ' ' : ''}${prox.titulo}`;
            subEl.textContent = `📅 Próx.: ${rotProx}`;
          } else {
            subEl.textContent = subOriginal;
          }
        }
      }
    };

    verificar();
    setInterval(verificar, 30000); // verifica a cada 30s para resposta mais rápida
    window.addEventListener('focus', verificar);
  }

  // ===== CENTRAL DE ALERTAS — alertas manuais via onSnapshot =====
  async gerarAlertas() {
    return [];
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

      // Atualiza badge e subtítulo no card de módulo "Central de Alertas"
      const badge   = document.getElementById('alertas-count-badge');
      const cardSub = document.getElementById('alertas-card-sub');
      const criticos = (nova || []).filter(a => a.cat === 'critico').length;
      const total    = (nova || []).length;
      if (badge) {
        if (criticos > 0) {
          badge.textContent = criticos;
          badge.style.display = '';
          badge.style.background = '#ef4444';
        } else if (total > 0) {
          badge.textContent = total;
          badge.style.display = '';
          badge.style.background = '';
        } else {
          badge.style.display = 'none';
        }
      }
      if (cardSub) {
        if (criticos > 0) cardSub.textContent = `${criticos} alerta(s) crítico(s)`;
        else if (total > 0) cardSub.textContent = `${total} alerta(s) pendente(s)`;
        else cardSub.textContent = 'Sem pendências';
      }

    };

    // Funções auxiliares para prioridade do alerta manual
    const prioParaIcone = (p) => {
      const m = { critica: '🔴', alta: '🟠', media: '🟡', baixa: '⚪' };
      return m[p] || '🔔';
    };
    const prioParaCategoria = (p) => {
      const m = { critica: 'critico', alta: 'critico', media: 'atencao', baixa: 'crm' };
      return m[p] || 'crm';
    };
    const tocarSomAlerta = (tituloAlerta = '') => {
      ccTocarSom('alertas', 'Dashboard / Central de Alertas',
        `Alerta disparado${tituloAlerta ? ': ' + tituloAlerta : ''}`,
        { chave: `alerta_${tituloAlerta}`, cooldownMs: 60000, arquivo: 'AudioContext — ding duplo',
          freq: 880, freqEnd: 660, dur: 0.4, vol: 0.2 });
    };

    // Deep link: clique no badge abre Central de Alertas na seção certa
    let _badgeDeepLinkSetup = false;

    // Ouve alertas manuais em tempo real via Firestore
    onSnapshot(collection(db, 'alertas_usuario'), (snap) => {
      const todos = [];
      snap.forEach(d => todos.push({ id: d.id, ...d.data() }));
      const ativos = todos.filter(a => a.status !== 'concluido');
      const criticos = ativos.filter(a => a.prioridade === 'critica' || a.prioridade === 'alta').length;

      // Badge e subtítulo
      const badge   = document.getElementById('alertas-count-badge');
      const cardSub = document.getElementById('alertas-card-sub');
      if (badge) {
        if (criticos > 0) { badge.textContent = criticos; badge.style.display = ''; badge.style.background = '#ef4444'; }
        else if (ativos.length > 0) { badge.textContent = ativos.length; badge.style.display = ''; badge.style.background = ''; }
        else { badge.style.display = 'none'; }
        // Deep link — configura uma vez
        if (!_badgeDeepLinkSetup) {
          _badgeDeepLinkSetup = true;
          badge.style.cursor = 'pointer';
          badge.title = 'Abrir Central de Alertas';
          badge.addEventListener('click', (e) => {
            e.stopPropagation();
            const foco = criticos > 0 ? 'criticos' : (ativos.length > 0 ? 'pendentes' : '');
            window.location.href = `../../pages/central-alertas/index.html${foco ? '?foco=' + foco : ''}`;
          });
        }
      }
      if (cardSub) {
        if (criticos > 0) cardSub.textContent = `${criticos} alerta(s) crítico(s)`;
        else if (ativos.length > 0) cardSub.textContent = `${ativos.length} alerta(s) pendente(s)`;
        else cardSub.textContent = 'Sem pendências';
      }

      // Card pulsante — alertas que dispararam nos últimos 60s
      const agora60 = Date.now();
      const disparando = ativos.filter(a => {
        if (!a.data || !a.hora) return false;
        const ts = new Date(`${a.data}T${a.hora}:00`).getTime();
        return !isNaN(ts) && agora60 - ts >= 0 && agora60 - ts < 60000;
      });
      const alertCard = document.querySelector('.alerts-card');
      if (disparando.length > 0 && alertCard) {
        alertCard.classList.add('alert-card-pulsing');
        if (localStorage.getItem('cc_sons_sistema') === 'true') tocarSomAlerta();
        setTimeout(() => alertCard.classList.remove('alert-card-pulsing'), 10000);
      } else if (alertCard) {
        alertCard.classList.remove('alert-card-pulsing');
      }

      // Alimenta card rotativo com alertas ativos (fallback para DICAS se vazio)
      aplicarLista(ativos.slice(0, 10).map(a => ({
        icon: prioParaIcone(a.prioridade || 'media'),
        cat: prioParaCategoria(a.prioridade || 'media'),
        title: a.titulo || 'Alerta',
        sub: a.descricao || '',
        detail: `${a.data || ''}${a.hora ? ' às ' + a.hora : ''}`,
      })));
    });

    // Rotaciona o que estiver na tela (alertas ou dicas)
    setInterval(() => {
      idx = (idx + 1) % lista.length;
      mostrar(lista[idx], true);
    }, DURATION); // 120 segundos
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
  escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  setupGlobalSearch() {
    const input = document.getElementById('global-search-input');
    const resultsBox = document.getElementById('search-results');
    if (!input || !resultsBox) return;
    let timeout;

    this._searchIndex = null;       // cache de OS/clientes/produtos (Firestore)
    this._searchLoadedAt = 0;
    this._searchLoading = null;
    this._searchActiveIdx = -1;     // item destacado p/ navegação por teclado

    const run = () => {
      const term = input.value.trim().toLowerCase();
      if (term.length < 2) { resultsBox.classList.remove('visible'); return; }
      this.performSearch(term, resultsBox);
    };

    input.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(run, 200);
    });

    input.addEventListener('focus', () => {
      this._loadSearchIndex();                       // carrega/atualiza índice em background
      if (input.value.trim().length >= 2) run();
    });

    // Navegação por teclado nos resultados (↑ ↓ Enter). Esc já é tratado em setupKeyboardShortcuts.
    input.addEventListener('keydown', (e) => {
      const items = Array.from(resultsBox.querySelectorAll('.search-item'));
      if (!resultsBox.classList.contains('visible') || items.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._searchActiveIdx = Math.min(this._searchActiveIdx + 1, items.length - 1);
        this._highlightSearch(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._searchActiveIdx = Math.max(this._searchActiveIdx - 1, 0);
        this._highlightSearch(items);
      } else if (e.key === 'Enter') {
        const el = items[this._searchActiveIdx] || items[0];
        if (el) { e.preventDefault(); el.click(); }
      }
    });
  }

  _highlightSearch(items) {
    items.forEach((el, i) => {
      el.style.background = (i === this._searchActiveIdx) ? 'rgba(0,200,83,0.12)' : '';
    });
    const active = items[this._searchActiveIdx];
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  // Carrega (e cacheia por 60s) os dados reais do Firestore para a busca global.
  async _loadSearchIndex(force = false) {
    if (!force && this._searchIndex && (Date.now() - this._searchLoadedAt) < 60000) return this._searchIndex;
    if (this._searchLoading) return this._searchLoading;

    this._searchLoading = (async () => {
      const idx = { os: [], clientes: [], produtos: [] };

      // ----- OS (abre a OS exata via deep-link #os-<id>) -----
      try {
        const snap = await getDocs(collection(db, 'os'));
        snap.forEach(d => {
          const o = { ...d.data() };
          const id = o.id || d.id;
          const aparelho = [o.brand, o.model].filter(Boolean).join(' ') || 'Aparelho';
          idx.os.push({
            id: String(id),
            title: `${o.clientName || 'Cliente'} — ${aparelho}`,
            sub: `#${id}${o.defect ? ' · ' + o.defect : ''}`,
            search: `${id} ${o.clientName || ''} ${o.phone || ''} ${o.brand || ''} ${o.model || ''} ${o.defect || ''}`.toLowerCase(),
            url: `../../pages/os/index.html#os-${encodeURIComponent(id)}`
          });
        });
      } catch (e) { console.warn('[Busca] OS:', e); }

      // ----- Clientes (abre a tela de Clientes do módulo OS) -----
      try {
        const snap = await getDocs(collection(db, 'clientes'));
        snap.forEach(d => {
          const c = { ...d.data() };
          const phone = c.phone || d.id;
          const nOS = Array.isArray(c.history) ? ` · ${c.history.length} OS` : '';
          idx.clientes.push({
            id: String(phone),
            title: c.name || c.nome || 'Cliente',
            sub: `📞 ${phone}${nOS}`,
            search: `${c.name || c.nome || ''} ${phone}`.toLowerCase(),
            url: `../../pages/os/index.html#fav-clientes`
          });
        });
      } catch (e) { console.warn('[Busca] Clientes:', e); }

      // ----- Produtos (coleção dedicada + fallback) -----
      try {
        let snap = await getDocs(collection(db, 'estoque_produtos'));
        if (snap.empty) snap = await getDocs(collection(db, 'produtos'));
        snap.forEach(d => {
          const p = { ...d.data() };
          const nome = p.nome || p.description || '—';
          const qtd = (p.quantidade != null) ? ` · ${p.quantidade} un` : '';
          const preco = p.venda ? ` · R$ ${Number(p.venda).toFixed(2)}` : '';
          idx.produtos.push({
            id: String(d.id),
            title: nome,
            sub: `${p.categoria || 'Produto'}${qtd}${preco}`,
            search: `${nome} ${p.categoria || ''}`.toLowerCase(),
            url: `../../pages/estoque/index.html`
          });
        });
      } catch (e) { console.warn('[Busca] Produtos:', e); }

      this._searchIndex = idx;
      this._searchLoadedAt = Date.now();
      this._searchLoading = null;

      // Se o usuário já digitou algo, re-renderiza com os dados frescos
      const input = document.getElementById('global-search-input');
      const rb = document.getElementById('search-results');
      if (input && rb && input.value.trim().length >= 2) {
        this.performSearch(input.value.trim().toLowerCase(), rb);
      }
      return idx;
    })();

    return this._searchLoading;
  }

  performSearch(term, resultsBox) {
    const idx = this._searchIndex;
    const filt = (arr) => (arr || []).filter(it => it.search.includes(term)).slice(0, 6);

    // Índice ainda não carregado — dispara carga e mostra feedback
    if (!idx) {
      this._loadSearchIndex();
      resultsBox.innerHTML = `<div class="search-empty">Carregando dados…</div>`;
      resultsBox.classList.add('visible');
      return;
    }

    const groups = [];
    const osR = filt(idx.os);       if (osR.length) groups.push({ title: 'Ordens de Serviço', icon: '📦', items: osR });
    const clR = filt(idx.clientes); if (clR.length) groups.push({ title: 'Clientes', icon: '👥', items: clR });
    const prR = filt(idx.produtos); if (prR.length) groups.push({ title: 'Produtos / Estoque', icon: '📦', items: prR });

    // Módulos (lista estática já existente em state.searchData.modulos)
    const modR = (this.state.searchData.modulos || [])
      .filter(m => m.title.toLowerCase().includes(term) || m.id.toLowerCase().includes(term))
      .slice(0, 5)
      .map(m => ({ id: m.id, title: m.title, sub: 'Módulo', module: m.id }));
    if (modR.length) groups.push({ title: 'Módulos', icon: '🧩', items: modR });

    this._searchActiveIdx = -1;

    if (groups.length === 0) {
      resultsBox.innerHTML = `<div class="search-empty">Nenhum resultado para "<strong>${this.escapeHtml(term)}</strong>"</div>`;
    } else {
      resultsBox.innerHTML = groups.map(group => `
        <div class="search-group">
          <div class="search-group-title">${group.icon} ${group.title}</div>
          ${group.items.map(item => `
            <div class="search-item" ${item.url ? `data-url="${this.escapeHtml(item.url)}"` : `data-module="${this.escapeHtml(item.module || '')}"`}>
              <div class="search-item-text">
                <div class="search-item-title">${this.escapeHtml(item.title)}</div>
                <div class="search-item-sub">${this.escapeHtml(item.sub || '')}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('');

      resultsBox.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', () => {
          const url = item.getAttribute('data-url');
          const module = item.getAttribute('data-module');
          document.getElementById('global-search-input').value = '';
          resultsBox.classList.remove('visible');
          if (url) window.location.href = url;
          else if (module) this.navigateTo(module);
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

  // ===== CONSULTA DE PEÇAS SEA =====
  setupSea() {
    const btn = document.getElementById('btnSea');
    if (!btn) return;
    btn.addEventListener('click', () => {
      window.open('https://chat.likezap.com.br/sea9190', '_blank', 'noopener,noreferrer');
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

    const userId = getUid();
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

    const userId = getUid();
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
    if (module === 'central-alertas') {
      window.location.href = '../../pages/central-alertas/index.html';
      return;
    }
    const routes = {
      os:                    '../../pages/os/index.html',
      'central-comandos':    '../../pages/central-comandos/index.html',
      'central-informacoes': '../../pages/central-informacoes/index.html',
      autoatendimento:       '../../pages/autoatendimento/index.html',
      clientes:              '../../pages/clientes/index.html',
      caixa:                 '../../pages/caixa/index.html',
      estoque:               '../../pages/estoque/index.html',
      campanhas:             '../../pages/campanhas/index.html',
      analise:               '../../pages/analise/index.html',
      relatorios:            '../../pages/relatorios/index.html',
      'pos-venda':           '../../pages/pos-venda/index.html',
      config:                '../../pages/config/index.html',
      ferramentas:           '../../pages/config/index.html',
      garantias:             '../../pages/garantias/index.html',
      fornecedor:            '../../pages/fornecedor/index.html',
      financeiro:            '../../pages/financeiro/index.html',
      'em-breve':            '../../pages/em-breve/index.html',
      'minha-semana':        '../../pages/minha-semana/index.html',
      'acaodasemana':        '../../pages/acaodasemana/index.html',
      'portal-cliente':      '../../pages/portal-cliente/admin.html',
      'portal-tecnico':      '../../pages/portal-tecnico/index.html',
      'diario':              '../../pages/diario/index.html',
      'central-organizacao': '../../pages/central-organizacao/index.html',
      'contas':              '../../pages/contas/index.html',
      'catalogo':            '../../pages/catalogo/index.html',
      'crm-comercial':       '../../pages/crm-comercial/index.html',
      'compras':             '../../pages/compras/index.html',
      'fechamento':          '../../pages/fechamento/index.html',
      'auditoria':           '../../pages/auditoria/index.html',
      'lixeira':             '../../pages/lixeira/index.html',
      'integridade':         '../../pages/integridade/index.html',
      'homologacao':         '../../pages/homologacao/index.html',
      'pendencias':          '../../pages/pendencias/index.html',
      'mensagens-wpp':       '../../pages/mensagens-wpp/index.html',
      'venda-rapida':        '../../pages/venda-rapida/index.html',
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
  // Prioridade: 1. Atrasados, 2. Horário atual, 3. Próximos (até 15 min)
  // Som de atrasados respeita cooldown de 5 min por item para não spammar.
  setupAvisoAcoes() {
    let ultimoAvisoKey = '';
    let cicloAtrasados = 0;
    const _somAtrasadoCooldown = {}; // chave → timestamp do último som

    const _fmtAtraso = (min) => {
      const abs = Math.abs(min);
      if (abs >= 1440) return `${Math.floor(abs/1440)}d ${Math.floor((abs%1440)/60)}h`;
      if (abs >= 60)   return `${Math.floor(abs/60)}h${abs%60 ? ' '+(abs%60)+'min' : ''}`;
      return `${abs} min`;
    };

    const _fmtData = (dataISO) => {
      if (!dataISO) return '';
      const [y, m, d] = dataISO.split('-').map(Number);
      return `${d}/${m}`;
    };

    // ─── Toca som curto (para horário atual / próximos) ───
    // Sons via módulo centralizado — log + cooldown + controle de permissão
    const tocarSomCurto = (tituloEvento = '') => {
      ccTocarSom('agenda', 'Dashboard / Agenda',
        `Compromisso próximo${tituloEvento ? ': ' + tituloEvento : ''}`,
        { chave: `agenda_prox_${tituloEvento}`, cooldownMs: 5 * 60000,
          arquivo: 'AudioContext — sine descendente 880→440',
          freq: 880, freqEnd: 440, dur: 0.6, vol: 0.3 });
    };

    const tocarSomVencida = (tituloEvento = '') => {
      ccTocarSom('agenda', 'Dashboard / Agenda',
        `Tarefa vencida${tituloEvento ? ': ' + tituloEvento : ''}`,
        { chave: `agenda_venc_${tituloEvento}`, cooldownMs: 5 * 60000,
          arquivo: 'AudioContext — 3 beeps square 1047/784',
          tipo: 'beeps', vol: 0.25,
          beeps: [[1047, 0, 0.15], [784, 0.2, 0.15], [1047, 0.4, 0.15]] });
    };

    const dispararAlerta = (evento, label, comSom = true) => {
      const card = document.querySelector('.alerts-card');
      const titleEl    = document.querySelector('.alert-title');
      const subtitleEl = document.querySelector('.alert-subtitle');
      const detailEl   = document.querySelector('.alert-detail');
      const iconEl     = document.getElementById('alert-cat-icon');
      if (!card || !titleEl) return;

      const isAtrasado = label.includes('VENCIDA') || label.includes('PENDENTE');
      const horaFmt = evento.hora || '';
      const dataFmt = evento.data ? _fmtData(evento.data) : '';
      if (iconEl) iconEl.textContent = isAtrasado ? '🔴' : '⏰';
      titleEl.textContent = `AGENDA — ${label}`;
      titleEl.className = 'alert-title cat-alerta-acao';
      if (subtitleEl) subtitleEl.textContent = evento.titulo;
      if (detailEl) detailEl.textContent = horaFmt ? `Horário: ${horaFmt}${dataFmt ? ` (${dataFmt})` : ''}` : (dataFmt ? `Data: ${dataFmt}` : '');

      card.classList.add('alert-card-pulsing');
      if (comSom) {
        if (isAtrasado) tocarSomVencida(evento.titulo);
        else            tocarSomCurto(evento.titulo);
      }
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
        // ⚠ DIFERENTE dos demais: aqui NÃO usa ultimoAvisoKey para bloquear.
        // O som toca em CADA CICLO enquanto houver vencidas, garantindo que
        // o usuário será alertado repetidamente até concluir a tarefa.
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

          cicloAtrasados++;
          const labelAtraso = cicloAtrasados % 2 === 0
            ? `🔴 VENCIDA · ${_fmtAtraso(diffMin)} atrasado`
            : `🔴 TAREFA PENDENTE · ${_fmtAtraso(diffMin)} atrasado`;

          // CORREÇÃO: som apenas uma vez a cada 5 minutos por item atrasado
          const COOLDOWN_ATRASADO = 5 * 60 * 1000;
          const agora5 = Date.now();
          const podeTocarSomAgora = !_somAtrasadoCooldown[key] ||
            (agora5 - _somAtrasadoCooldown[key]) >= COOLDOWN_ATRASADO;

          if (podeTocarSomAgora) {
            _somAtrasadoCooldown[key] = agora5;
            dispararAlerta(pior, labelAtraso, true); // com som
          } else {
            // Atualiza visual sem som (passa false no 3º param não-sonoro)
            dispararAlerta(pior, labelAtraso, false);
          }
          ultimoAvisoKey = key;
          return;
        }

        // Se chegou aqui, não há atrasados — reseta contador
        cicloAtrasados = 0;

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
              dispararAlerta(evento, diff === 0 ? 'AGORA!' : `em ${diff} min`, false);
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
              dispararAlerta(evento, `em ${diff} min`, false);
            }
            return;
          }
        }

        // Nada a alertar — reseta para permitir novos avisos
        ultimoAvisoKey = '';

      } catch {}
    };

    verificar();
    setInterval(verificar, 30000); // 30s para resposta mais rápida em vencidas
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
        const userId = getUid();
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
        const userId = getUid();
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
        const userId = getUid();
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
      if (!ccSonsHabilitados('os')) return;
      ccLog('Dashboard / Alarme OS', 'Alarme de OS nova disparado', 'som', `AudioContext — beeps repetidos ${duracao}s vol=${vol}`);
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
      const userId = getUid();
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

  // ===== MODO COMPACTO (toggle visual) =====
  setupCompactMode() {
    const COMPACT_KEY = 'dashboard_modo_compacto';
    const btn = document.getElementById('compact-mode-toggle');
    if (!btn) return;

    // Path multiusuário: usuarios/{uid}/preferencias/layout
    const prefRef = (uid) => doc(db, 'usuarios', uid, 'preferencias', 'layout');

    const aplicar = (compacto, salvar = true) => {
      document.body.classList.toggle('modo-compacto', compacto);
      btn.classList.toggle('ativo', compacto);
      btn.textContent = compacto ? '▣ Compacto' : '▢ Compactar';
      btn.title = compacto ? 'Alternar para modo normal' : 'Alternar para modo compacto';
      localStorage.setItem(COMPACT_KEY, compacto ? 'true' : '');
      if (salvar) {
        setDoc(prefRef(getUid()), { sidebarCompacta: compacto, atualizadoEm: serverTimestamp() }, { merge: true })
          .catch(e => console.warn('[Preferências] salvar sidebarCompacta:', e?.message));
      }
    };

    // 1. localStorage → imediato
    aplicar(localStorage.getItem(COMPACT_KEY) === 'true', false);

    // 2. Firestore → assíncrono (carrega e aplica; não conflita com preferência local)
    onUid(async (uid) => {
      try {
        const snap = await getDoc(prefRef(uid));
        if (snap.exists()) {
          const d = snap.data();
          if (typeof d.sidebarCompacta === 'boolean') {
            const local = localStorage.getItem(COMPACT_KEY) === 'true';
            if (d.sidebarCompacta !== local) aplicar(d.sidebarCompacta, false);
          }
        }
      } catch (e) {
        console.warn('[Preferências] carregar sidebarCompacta:', e?.message);
      }
    });

    // Toggle ao clicar
    btn.addEventListener('click', () => {
      aplicar(!document.body.classList.contains('modo-compacto'), true);
    });
  }

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

  // ===== SIDEBAR ESQUERDA — RECOLHER/EXPANDIR =====
  setupSidebar() {
    const sidebar = document.getElementById('sidebar-left');
    const btn     = document.getElementById('sidebar-toggle');
    const navEl   = document.getElementById('sidebar-nav');
    if (!sidebar || !btn) return;

    // ----- colapsar / expandir -----
    const COLLAPSE_KEY = 'cc_sidebar_state';
    const aplicar = (collapsed) => {
      sidebar.classList.toggle('collapsed', collapsed);
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    };
    aplicar(localStorage.getItem(COLLAPSE_KEY) === '1');
    btn.addEventListener('click', () => aplicar(!sidebar.classList.contains('collapsed')));

    // ----- drag-and-drop reordering -----
    if (!navEl) return;

    const ORDER_KEY = 'cc_sidebar_order';

    const saveOrder = () => {
      const sids = [...navEl.querySelectorAll('.sidebar-item[data-sid]')].map(el => el.dataset.sid);
      localStorage.setItem(ORDER_KEY, JSON.stringify(sids));
    };

    const restoreOrder = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]');
        if (!saved.length) return;
        saved.forEach(sid => {
          const el = navEl.querySelector(`[data-sid="${sid}"]`);
          if (el) navEl.appendChild(el);
        });
      } catch (_) {}
    };

    restoreOrder();

    let dragSrc = null;

    navEl.addEventListener('dragstart', e => {
      const item = e.target.closest('.sidebar-item[data-sid]');
      if (!item) return;
      dragSrc = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    navEl.addEventListener('dragend', () => {
      if (dragSrc) dragSrc.classList.remove('dragging');
      navEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      dragSrc = null;
    });

    navEl.addEventListener('dragover', e => {
      e.preventDefault();
      const item = e.target.closest('.sidebar-item[data-sid]');
      if (!item || item === dragSrc) return;
      navEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      item.classList.add('drag-over');
      e.dataTransfer.dropEffect = 'move';
    });

    navEl.addEventListener('dragleave', e => {
      const item = e.target.closest('.sidebar-item[data-sid]');
      if (item) item.classList.remove('drag-over');
    });

    navEl.addEventListener('drop', e => {
      e.preventDefault();
      const target = e.target.closest('.sidebar-item[data-sid]');
      if (!target || !dragSrc || target === dragSrc) return;
      target.classList.remove('drag-over');
      const rect = target.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      navEl.insertBefore(dragSrc, after ? target.nextSibling : target);
      saveOrder();
    });
  }

  // ===== PAINEL DIREITO — RECOLHER/EXPANDIR =====
  setupPanelRight() {
    const panel   = document.getElementById('panel-right');
    const btnOpen = document.getElementById('panel-right-open-btn');
    const btnClose= document.getElementById('panel-right-close-btn');
    if (!panel) return;

    const KEY = 'cc_panel_right_state';
    const aplicar = (collapsed) => {
      panel.classList.toggle('collapsed', collapsed);
      localStorage.setItem(KEY, collapsed ? '1' : '0');
    };

    // Restaura estado salvo (default: expandido)
    aplicar(localStorage.getItem(KEY) === '1');

    if (btnOpen)  btnOpen.addEventListener('click',  () => aplicar(false));
    if (btnClose) btnClose.addEventListener('click', () => aplicar(true));

    // Toggle das seções internas (metas / alertas)
    const _bindToggle = (btnId, bodyId) => {
      const btn  = document.getElementById(btnId);
      const body = document.getElementById(bodyId);
      if (!btn || !body) return;
      const KEY2 = 'cc_pr_' + btnId;
      if (localStorage.getItem(KEY2) === '1') { body.classList.add('collapsed-body'); btn.textContent = '+'; }
      btn.addEventListener('click', () => {
        const col = body.classList.toggle('collapsed-body');
        btn.textContent = col ? '+' : '−';
        localStorage.setItem(KEY2, col ? '1' : '0');
      });
    };
    _bindToggle('metas-toggle', 'metas-body');
    _bindToggle('alertas-toggle', 'alertas-body');
  }

  // ===== PAINEL EXECUTIVO — KPIs EM TEMPO REAL =====
  setupExecutivePanel() {
    const fmt    = (v) => Number(v).toLocaleString('pt-BR');
    const fmtBRL = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const set    = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    const STATUS_ABERTO = ['em_andamento', 'aguardando', 'orcamento_enviado', 'pendente',
                           'recebido', 'diagnostico', 'aguardando_peca', 'pronto', 'concluido'];
    const STATUS_ANDAMENTO = ['em_andamento', 'aguardando', 'diagnostico'];
    const STATUS_AGUARDANDO_APROV = ['orcamento_enviado'];

    const hojeISO = new Date().toISOString().slice(0, 10);
    const inicioSemana = (() => {
      const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10);
    })();
    const ha30dias = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const atualizarOS = (snap) => {
      let abertas = 0, andamento = 0, aguardAprov = 0, bancada = 0;
      const clientesSet = new Set();
      let somaValorEntregue = 0, countEntregue = 0;
      let temposTotais = 0, countTempo = 0;
      let orcamentosHoje = 0;

      snap.forEach(d => {
        const os = d.data();
        const status = os.status || '';

        if (STATUS_ABERTO.includes(status)) abertas++;
        if (STATUS_ANDAMENTO.includes(status)) { andamento++; bancada++; }
        if (STATUS_AGUARDANDO_APROV.includes(status)) aguardAprov++;

        if (status === 'entregue' && os.valor) {
          somaValorEntregue += Number(os.valor);
          countEntregue++;
        }

        if (status === 'entregue' && os.createdAtISO && os.updatedAtISO) {
          const diff = (new Date(os.updatedAtISO) - new Date(os.createdAtISO)) / 86400000;
          if (diff > 0 && diff < 60) { temposTotais += diff; countTempo++; }
        }

        if (os.createdAtISO && os.createdAtISO >= ha30dias && os.phone) {
          clientesSet.add(os.phone);
        }

        if (STATUS_AGUARDANDO_APROV.includes(status) && os.updatedAtISO && os.updatedAtISO.startsWith(hojeISO)) {
          orcamentosHoje++;
        }
      });

      set('kpi-os-abertas', fmt(abertas));
      set('kpi-os-andamento', fmt(andamento));
      set('kpi-aguardando-aprov', fmt(aguardAprov));
      set('kpi-bancada', fmt(bancada));
      set('kpi-ticket-medio', countEntregue > 0 ? fmtBRL(somaValorEntregue / countEntregue) : '—');
      set('kpi-tempo-entrega', countTempo > 0 ? `${(temposTotais / countTempo).toFixed(1)} dias` : '—');
      set('kpi-clientes-ativos', fmt(clientesSet.size));
      set('kpi-orcamentos-enviados', fmt(orcamentosHoje));
    };

    const atualizarCaixa = (snap) => {
      let fatHoje = 0, lucroSemana = 0;
      snap.forEach(d => {
        const l = d.data();
        const iso = l.dataISO || l.createdAtISO || '';
        const val = Number(l.valor || 0);
        const lucro = Number(l.lucro || 0);
        if (iso.startsWith(hojeISO) && l.tipo !== 'saida') fatHoje += val;
        if (iso >= inicioSemana) lucroSemana += lucro;
      });
      set('kpi-faturamento-hoje', fmtBRL(fatHoje));
      set('kpi-lucro-semana', fmtBRL(lucroSemana));
    };

    const atualizarEstoque = (snap) => {
      let pecasFalta = 0;
      snap.forEach(d => {
        const p = d.data();
        const qty = Number(p.quantidade || p.estoque || 0);
        const min = Number(p.estoqueMinimo || p.minimo || 1);
        if (qty < min) pecasFalta++;
      });
      set('kpi-pecas-falta', fmt(pecasFalta));
    };

    const iniciar = () => {
      try {
        onSnapshot(collection(db, 'os'), atualizarOS,
          err => console.warn('[KPI] os:', err && err.message));
        onSnapshot(collection(db, 'caixa_lancamentos'), atualizarCaixa,
          err => console.warn('[KPI] caixa:', err && err.message));
        onSnapshot(collection(db, 'estoque'), atualizarEstoque,
          err => console.warn('[KPI] estoque:', err && err.message));
      } catch (e) { console.warn('[KPI] iniciar falhou:', e); }
    };

    if (db) iniciar();
    else window.addEventListener('firebase-ready', iniciar, { once: true });
  }

  // ===== CONFIGURAÇÃO DE ALERTAS (persistência) =====
  setupConfigAlertas() {
    const modal      = document.getElementById('modal-config-alertas');
    const btnFechar  = document.getElementById('btn-fechar-config-alertas');
    const btnSalvar  = document.getElementById('btn-salvar-config');
    const btnTestar  = document.getElementById('btn-testar-som');
    const chkSilencio    = document.getElementById('config-silencio-ativo');
    const camposSilencio = document.getElementById('config-silencio-campos');

    if (!modal) return;

    const abrirConfig = (e) => {
      if (e) e.stopPropagation();
      const listaModal = document.getElementById('modal-lista-alertas');
      if (listaModal) listaModal.style.display = 'none';
      this.carregarConfigAlertasUI();
      modal.style.display = 'flex';
    };

    const btnAbrir = document.getElementById('btn-abrir-config-alertas');
    if (btnAbrir) btnAbrir.addEventListener('click', abrirConfig);

    const btnConfigModal = document.getElementById('btn-config-alertas-modal');
    if (btnConfigModal) btnConfigModal.addEventListener('click', abrirConfig);

    if (btnFechar) btnFechar.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    const btnFecharLista = document.getElementById('btn-fechar-lista-alertas');
    const listaModal = document.getElementById('modal-lista-alertas');
    if (btnFecharLista && listaModal) btnFecharLista.addEventListener('click', () => { listaModal.style.display = 'none'; });
    if (listaModal) listaModal.addEventListener('click', (e) => { if (e.target === listaModal) listaModal.style.display = 'none'; });

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
  }

  carregarConfigAlertas() {
    try {
      const raw = localStorage.getItem('cc_config_alertas');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      som: {
        ativo: true,
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
  }

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
    if (camposSilencio) camposSilencio.style.display = config.som.silencio.ativo ? 'flex' : 'none';
    document.querySelectorAll('.config-alerta-som').forEach(chk => {
      const tipo = chk.getAttribute('data-tipo');
      chk.checked = config.alertasComSom[tipo] === true;
    });
    document.querySelectorAll('.config-pulsacao').forEach(chk => {
      const nivel = chk.getAttribute('data-nivel');
      chk.checked = config.pulsacao[nivel] === true;
    });
  }

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
  }

  _setChecked(id, value) { const el = document.getElementById(id); if (el) el.checked = !!value; }
  _getChecked(id) { const el = document.getElementById(id); return el ? el.checked : false; }
  _setValue(id, value) { const el = document.getElementById(id); if (el) el.value = value; }
  _getValue(id, fallback) { const el = document.getElementById(id); return el ? el.value : fallback; }

  // ══════════════════════════════════════════════════════════════════
  // 💰 PAINEL FINANCEIRO INTELIGENTE
  // Usa: resumo_live (caixa), financeiro_pagar/receber, estoque_produtos
  // ══════════════════════════════════════════════════════════════════
  setupPainelFinanceiro() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const R = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    const now = new Date();
    const mesKey     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const semanaKey  = (() => {
      const d = new Date(now); d.setHours(0,0,0,0);
      d.setDate(d.getDate() + 4 - (d.getDay() || 7));
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const w = Math.ceil(((d - jan1) / 86400000 + 1) / 7);
      return `${d.getFullYear()}-W${String(w).padStart(2,'0')}`;
    })();
    const hojeKey = now.toISOString().slice(0, 10);

    let _period = 'mes';
    let _liveDocs = {};

    const _getLiveKey = () => ({
      mes:    `mes_${mesKey}`,
      semana: `semana_${semanaKey}`,
      hoje:   `dia_${hojeKey}`,
    })[_period];

    const _lbl = { mes: 'do Mês', semana: 'da Semana', hoje: 'de Hoje' };

    const _updatePeriodo = () => {
      const key  = _getLiveKey();
      const data = _liveDocs[key] || {};
      set('fin-receita-periodo',  R(data.entradas   || 0));
      set('fin-despesas-periodo', R(data.saidas     || 0));
      set('fin-lucro-periodo',    R(data.lucro      || 0));
      set('fin-receita-lbl',  `Receita ${_lbl[_period]}`);
      set('fin-despesas-lbl', `Saídas ${_lbl[_period]}`);
      set('fin-lucro-lbl',    `Lucro ${_lbl[_period]}`);
      const lucroCard = document.getElementById('fin-card-lucro');
      if (lucroCard) lucroCard.className = 'fin-card ' + ((data.lucro || 0) >= 0 ? 'fin-card--lucro' : 'fin-card--prejuizo');

      const total = (data.entradas || 0);
      const qtdVendas = data.totalLancamentos || 0;
      set('fin-produtos-vendidos', qtdVendas);
      set('fin-ticket-medio',  qtdVendas > 0 ? R(total / qtdVendas) : '—');
    };

    // Botões de período
    document.querySelectorAll('.fin-exec-period').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.fin-exec-period').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _period = btn.dataset.period;
        _updatePeriodo();
      });
    });

    const _carregar = async () => {
      if (!db) return;

      try {
        // 1. Resumo Live (caixa pre-calculado)
        const liveSnap = await getDocs(collection(db, 'resumo_live'));
        liveSnap.forEach(d => { _liveDocs[d.id] = d.data(); });

        // Saldo = soma de todos os entradas − saídas de todos os documentos mensais/semanais?
        // Melhor: soma cumulativa de todos os dias
        let saldoTotal = 0;
        liveSnap.forEach(d => {
          const data = d.data();
          if (data.tipo === 'diario') saldoTotal += (data.saldo || 0);
        });
        // Evita double-count: usa apenas dados mensais históricos + dia atual
        // Abordagem simples: soma lancamentos do saldo já está no live do mes atual
        const mesDat = _liveDocs[`mes_${mesKey}`] || {};
        set('fin-saldo-caixa', R(mesDat.saldo || 0));

        _updatePeriodo();

        // Gráfico (últimos 6 meses)
        const meses6 = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const nome = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
          const doc_ = _liveDocs[`mes_${k}`] || {};
          meses6.push({ nome, receita: doc_.entradas || 0, lucro: doc_.lucro || 0 });
        }
        this._renderFinChart(meses6);

        // 2. Compras do mês (compras_financeiras)
        const compSnap = await getDocs(collection(db, 'compras_financeiras'));
        let comprasMes = 0;
        compSnap.forEach(d => {
          const c = d.data();
          if ((c.data || '').startsWith(mesKey) || (c.criadoEm?.toDate?.().toISOString() || '').startsWith(mesKey)) {
            comprasMes += Number(c.valorTotal || 0);
          }
        });
        set('fin-compras-mes', R(comprasMes));

        // 3. Contas a pagar
        const pagarSnap = await getDocs(collection(db, 'financeiro_pagar'));
        let aPagar = 0, vencidas = 0;
        const hojeStr = hojeKey;
        pagarSnap.forEach(d => {
          const c = d.data();
          if (c.status !== 'pago') {
            aPagar += Number(c.valor || 0);
            if (c.vencimento && c.vencimento < hojeStr) vencidas++;
          }
        });

        // 4. Contas a receber
        const receberSnap = await getDocs(collection(db, 'financeiro_receber'));
        let aReceber = 0;
        receberSnap.forEach(d => {
          const c = d.data();
          if (c.status !== 'recebido') {
            aReceber += Number(c.valor || 0);
            if (c.status !== 'recebido' && c.vencimento && c.vencimento < hojeStr) vencidas++;
          }
        });

        set('fin-a-pagar',  R(aPagar));
        set('fin-a-receber', R(aReceber));
        set('fin-vencidas',  vencidas || '—');
        const vcCard = document.getElementById('fin-card-vencidas');
        if (vcCard) vcCard.className = 'fin-card ' + (vencidas > 0 ? 'fin-card--vencida fin-card--alerta' : 'fin-card--vencida');

        // 5. Estoque baixo (estoque_produtos)
        const estSnap = await getDocs(collection(db, 'estoque_produtos'));
        let baixo = 0, maisVendidoNome = '—', maisLucrativoNome = '—';
        const prodMap = {};
        estSnap.forEach(d => {
          const p = d.data();
          const qty = Number(p.quantidade || 0);
          const min = Number(p.quantidadeMinima || p.estoqueMinimo || 1);
          if (qty > 0 && qty <= min) baixo++;
          prodMap[(p.nome || '').toUpperCase()] = { ...p, id: d.id };
        });
        set('fin-estoque-baixo', baixo || '—');

        // 6. Produto mais vendido / mais lucrativo (dos lançamentos do mês)
        const caixaSnap = await getDocs(collection(db, 'caixa_lancamentos'));
        const vendMap = {};
        caixaSnap.forEach(d => {
          const l = d.data();
          const iso = l.dataISO || '';
          if (!iso.startsWith(mesKey)) return;
          if (l.tipo !== 'entrada' && l.tipo !== 'servico') return;
          const nome = (l.descricao || '').trim().toUpperCase();
          if (!nome) return;
          if (!vendMap[nome]) vendMap[nome] = { nome: l.descricao || nome, qtd: 0, receita: 0, lucro: 0 };
          vendMap[nome].qtd++;
          vendMap[nome].receita += Number(l.valor || 0);
          vendMap[nome].lucro   += Number(l.lucro || 0);
        });
        const vendList = Object.values(vendMap);
        if (vendList.length) {
          vendList.sort((a, b) => b.qtd - a.qtd);
          maisVendidoNome = vendList[0].nome;
          vendList.sort((a, b) => b.lucro - a.lucro);
          maisLucrativoNome = vendList[0].nome;
        }
        set('fin-mais-vendido',    maisVendidoNome);
        set('fin-mais-lucrativo',  maisLucrativoNome);

        // 7. Meta mensal: usa mesKey para calcular receita do caixa no mês vs meta
        const metaGoal = this.state?.meta?.goal || 0;
        const metaAtual = mesDat.entradas || 0;
        const metaPct = metaGoal > 0 ? Math.min((metaAtual / metaGoal) * 100, 100) : 0;
        set('fin-meta-atual', R(metaAtual));
        set('fin-meta-goal',  R(metaGoal));
        set('fin-meta-pct',   `${metaPct.toFixed(0)}%`);
        const fill = document.getElementById('fin-meta-fill');
        if (fill) requestAnimationFrame(() => { fill.style.width = `${metaPct}%`; });
        const falta = Math.max(metaGoal - metaAtual, 0);
        set('fin-meta-falta', falta > 0 ? `Faltam ${R(falta)}` : '✅ Meta atingida!');

        // 8. Alertas destaque
        this._renderFinAlertas({ vencidas, baixo, aPagar, aReceber });

      } catch (e) {
        console.warn('[FinPanel] Erro ao carregar:', e);
      }
    };

    if (db) _carregar();
    else window.addEventListener('firebase-ready', _carregar, { once: true });
  }

  _renderFinChart(meses) {
    const area = document.getElementById('fin-chart-area');
    if (!area) return;
    const maxVal = Math.max(...meses.map(m => m.receita), 1);
    area.innerHTML = meses.map(m => {
      const pctR = (m.receita / maxVal * 100).toFixed(1);
      const pctL = (Math.max(m.lucro, 0) / maxVal * 100).toFixed(1);
      return `<div class="fin-chart-col">
        <div class="fin-chart-bars">
          <div class="fin-chart-bar fin-bar-receita" style="height:${pctR}%" title="Receita: R$ ${m.receita.toLocaleString('pt-BR', {minimumFractionDigits:2})}"></div>
          <div class="fin-chart-bar fin-bar-lucro"   style="height:${pctL}%" title="Lucro: R$ ${m.lucro.toLocaleString('pt-BR',  {minimumFractionDigits:2})}"></div>
        </div>
        <div class="fin-chart-lbl">${m.nome}</div>
      </div>`;
    }).join('');
  }

  _renderFinAlertas({ vencidas, baixo, aPagar, aReceber }) {
    const lista = document.getElementById('fin-alertas-lista');
    if (!lista) return;
    const R = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const alertas = [];
    if (vencidas > 0) alertas.push({ cor: 'fin-al-red',    txt: `${vencidas} conta${vencidas>1?'s':''} vencida${vencidas>1?'s':''}`, ico: '⚠️' });
    if (baixo > 0)    alertas.push({ cor: 'fin-al-orange', txt: `${baixo} produto${baixo>1?'s':''} com estoque baixo`, ico: '📦' });
    if (aPagar > 0)   alertas.push({ cor: 'fin-al-yellow', txt: `${R(aPagar)} em contas a pagar`, ico: '🏢' });
    if (aReceber > 0) alertas.push({ cor: 'fin-al-green',  txt: `${R(aReceber)} a receber`, ico: '🧾' });
    if (!alertas.length) {
      lista.innerHTML = '<div class="fin-alerta-ok">✅ Tudo em dia</div>';
      return;
    }
    lista.innerHTML = alertas.map(a =>
      `<div class="fin-alerta-item ${a.cor}">${a.ico} ${a.txt}</div>`
    ).join('');
  }
}

// ===== INICIALIZAÇÃO =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Dashboard());
} else {
  new Dashboard();
}