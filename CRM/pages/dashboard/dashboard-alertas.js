/* ============================================
CELL CITY CRM — DASHBOARD — CENTRAL DE ALERTAS
Etapa 9 da refatoração modular: agenda/ação da semana, autoatendimento, diário,
e o motor de geração de alertas (pós-venda, OS, meta, portal, avaliações).
Mixin aplicado em Dashboard.prototype (ver dashboard.js) — mesmo `this` de sempre.
============================================ */
import { db, collection, getDocs, onSnapshot, query, where, orderBy, limit } from "../../scripts/firebase.js";
import { injectTenantFilter } from "../../shared/tenant-query.js";

export const dashboardAlertasMixin = {
  // ===== AUTOATENDIMENTO =====
  setupAutoatendimento() {
    this._carregarContadorAutoatendimento();
  },

  async _carregarContadorAutoatendimento() {
    try {
      // Achado crítico (Auditoria Técnica Independente 2026-07-17): faltava
      // injectTenantFilter aqui — única query de pre_os neste arquivo sem
      // o filtro já usado em toda consulta irmã (os, agenda, diario_registros...).
      const q = query(collection(db, 'pre_os'), ...injectTenantFilter([where('status', '==', 'AGUARDANDO_CONVERSAO')]));

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
  },

  // ===== DIÁRIO — alerta de revisões vencidas (coleção isolada diario_registros) =====
  // Lê apenas diario_registros; não toca em módulos operacionais.
  async setupDiarioBadge() {
    const badge = document.getElementById('diario-badge');
    if (!badge) return;
    const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);
    try {
      onSnapshot(query(collection(db, 'diario_registros'), ...injectTenantFilter([])), snap => {
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
  },

  // ===== AGENDA INTELIGENTE — lê as notas (sticky notes) e extrai os horários =====
  // Cada dia é 1 documento { data, texto, cor }. As linhas do texto no formato
  // "HH:MM descrição" viram compromissos com horário para o Dashboard.
  async _lerAgenda() {
    try {
      const snap = await getDocs(query(collection(db, 'agenda'), ...injectTenantFilter([])));
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
  },

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
  },

  // ===== AGENDA — conta compromissos no horário/atrasados (janela 60 min) =====
  async _contarAcoesVencidas(eventos) {
    try {
      const evs = eventos || await this._lerAgenda();
      const venc = this._vencidos(evs);
      return { count: venc.length, titulos: venc.map(e => e.titulo) };
    } catch {
      return { count: 0, titulos: [] };
    }
  },

  // ===== AGENDA — calcula o próximo compromisso futuro =====
  _proximoCompromisso(eventos) {
    const agora = Date.now();
    return (eventos || [])
      .filter(e => !e.concluido && e.data)
      .map(e => ({ ...e, ts: new Date(`${e.data}T${e.hora || '00:00'}:00`).getTime() }))
      .filter(e => e.ts >= agora)
      .sort((a, b) => a.ts - b.ts)[0] || null;
  },

  // ===== AGENDA — card do Dashboard: destaca ENQUANTO tarefa não for concluída =====
  // ⚠ Regras de prioridade:
  //   1. Tarefas VENCIDAS (qualquer dia passado, não concluídas)
  //   2. Tarefas do HORÁRIO ATUAL (hoje, janela 0–5 min)
  //   3. Tarefas PRÓXIMAS (hoje, 6–15 min)
  // O card SÓ para de destacar quando TODAS as tarefas vencidas forem concluídas
  // ===== DESTAQUE NO CARD DO MÓDULO AÇÃO DA SEMANA =====
  // Apenas adiciona/remove classe visual — sem som, sem sobrepor a Central de Alertas
  atualizarCardAcaoSemana() {
    const verificar = async () => {
      const card = document.querySelector('.module-card[data-module="acaodasemana"]');
      if (!card) return;
      const eventos = await this._lerAgenda();
      const agora = Date.now();
      const hojeISO = new Date().toISOString().slice(0, 10);
      const temVencidas = (eventos || []).some(e => {
        if (e.concluido || !e.data) return false;
        if (e.hora) return new Date(`${e.data}T${e.hora}:00`).getTime() < agora;
        return e.data < hojeISO;
      });
      card.classList.toggle('acao-vencida', temVencidas);
    };
    verificar();
    // Não relê com a aba oculta — o refresh ao voltar o foco (abaixo) já cobre esse caso.
    setInterval(() => { if (!document.hidden) verificar(); }, 300000);
    window.addEventListener('focus', verificar);
  },

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
      // ===== PRIORIDADE MÁXIMA — AÇÃO DA SEMANA (VENCIDAS + horário atual + próximas) =====
      // Regras:
      //   1. Vencidas de QUALQUER DIA aparecem sempre (CRÍTICO)
      //   2. Horário atual aparece se não houver vencidas
      //   3. Próximas (até 15min) aparece se não houver vencidas nem horário atual
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

      // Atrasadas de QUALQUER DIA (não concluídas, horário/data passou)
      const atrasadas = (eventos || []).filter(estaAtrasado);
      const atrasadasDiasAnteriores = atrasadas.filter(e => e.data < hojeISO);

      // No horário atual (hoje, diff 0–5 min)
      const noHorario = (eventos || []).filter(e => {
        if (e.concluido || !e.data || !e.hora) return false;
        if (e.data !== hojeISO) return false;
        const diff = diffMinEvento(e);
        return diff >= 0 && diff <= 5;
      });

      // Próximas (hoje, 6–15 min)
      const proximas = (eventos || []).filter(e => {
        if (e.concluido || !e.data || !e.hora) return false;
        if (e.data !== hojeISO) return false;
        const diff = diffMinEvento(e);
        return diff > 5 && diff <= 15;
      });

      // ─── Gera alertas na ordem de prioridade ───

      // ⚠ 1. PRIORIDADE MÁXIMA — VENCIDAS (inclui dias anteriores)
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

        // Detail mais informativo: mostra quantas são de dias anteriores
        const diasAntLabel = atrasadasDiasAnteriores.length > 0
          ? ` (${atrasadasDiasAnteriores.length} de dias anteriores)`
          : '';

        alertas.push({
          icon: '🔴', cat: 'critico', cor: 'critico',
          title: `AÇÃO DA SEMANA · ${totalAtrasadas} pendente(s)${diasAntLabel}`,
          sub: `🔴 Aguardando conclusão · ${_fmtAtraso(atrasoMin)} atrasado`,
          detail: `${totalAtrasadas} tarefa(s) atrasada(s) — Ex.: "${tituloExemplo}". Conclua no módulo Ação da Semana para remover este alerta.`,
          som: true, pulsar: true, repetir: true, tipo: 'acaoSemanaVencidas'
        });
      }

      // ⚠ 2. HORÁRIO ATUAL (só aparece se NÃO houver vencidas)
      if (atrasadas.length === 0 && noHorario.length > 0) {
        alertas.push({
          icon: '⏰', cat: 'critico', cor: 'critico',
          title: 'AÇÃO DA SEMANA · AGORA',
          sub: noHorario.length === 1 ? 'Tarefa programada para AGORA' : `${noHorario.length} tarefas AGORA`,
          detail: noHorario.map(e => `${e.hora} ${e.titulo}`).join(' · '),
          som: true, pulsar: true, repetir: false, tipo: 'acaoSemanaAgora'
        });
      }

      // ⚠ 3. PRÓXIMAS (até 15 min) — só se não houver vencidas nem AGORA
      if (atrasadas.length === 0 && noHorario.length === 0 && proximas.length > 0) {
        alertas.push({
          icon: '⏰', cat: 'atencao', cor: 'atencao',
          title: 'AÇÃO DA SEMANA · Próximos',
          sub: proximas.length === 1 ? `Em ${proximas[0].hora}` : `${proximas.length} tarefas em breve`,
          detail: proximas.map(e => `${e.hora} ${e.titulo}`).join(' · '),
          som: true, pulsar: false, repetir: false, tipo: 'acaoSemanaProximas'
        });
      }

      const osSnap = await getDocs(query(collection(db, 'os'), ...injectTenantFilter([])));
      const contatosSnap = await getDocs(query(collection(db, 'posvenda_contatos'), ...injectTenantFilter([])));

      const contatosFeitos = new Set();
      contatosSnap.forEach(d => { const c = d.data(); if (c.ativo === false) return; contatosFeitos.add(`${c.osId}_${c.prazo}`); });

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
          detail: `Cliente ${c.nome} está há ${c.dias} dias aguardando o contato de pós-venda.`,
          som: true, pulsar: true, repetir: false, tipo: 'posVendaCritico'
        });
      });
      if (pvVencidos > 0) {
        alertas.push({
          icon: '💡', cat: 'critico', cor: 'critico',
          title: 'PÓS-VENDA ATRASADO',
          sub: `${pvVencidos} contato(s) vencido(s)`,
          detail: `Existem ${pvVencidos} contato(s) de pós-venda vencidos. Entre em contato o quanto antes.`,
          som: true, pulsar: true, repetir: false, tipo: 'posVendaCritico'
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
        // 'orcamento_enviado' = novo fluxo; 'orcamento' = OS antigas
        if (os.status === 'orcamento_enviado' || os.status === 'orcamento') {
          osOrcamento++;
          const ref = getDeliveryDate(os) || os.createdAt;
          if (ref && calcDias(typeof ref === 'string' ? ref : (ref.toDate ? ref.toDate().toISOString() : ref)) > 2) {
            osOrcamentoParado++;
          }
        }
        // 'concluido' = novo fluxo; 'pronto' = OS antigas
        if (os.status === 'concluido' || os.status === 'pronto') osPronto++;
      });

      if (osOrcamentoParado > 0) {
        alertas.push({
          icon: '💡', cat: 'critico', cor: 'critico',
          title: 'OS AGUARDANDO CLIENTE',
          sub: `${osOrcamentoParado} orçamento(s) parado(s)`,
          detail: `${osOrcamentoParado} cliente(s) com orçamento aguardando aprovação há mais de 2 dias.`,
          som: true, pulsar: true, repetir: false, tipo: 'osAguardandoCliente'
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
          query(collection(db, 'mensagens_portal'), ...injectTenantFilter([where('lida', '==', false)]))
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
          query(collection(db, 'avaliacoes'), ...injectTenantFilter([]), orderBy('createdAt', 'desc'), limit(5))
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
              detail: `${avaliacoesCriticas.length} cliente(s) deram nota baixa. Verifique o feedback e entre em contato.`,
              som: true, pulsar: true, repetir: false, tipo: 'avaliacoesCriticas'
            });
          }
        }
      } catch (e) {
        console.warn('Central de Alertas — erro ao buscar avaliações:', e);
      }

    } catch (e) {
      console.warn('Central de Alertas — erro ao gerar:', e);
    }

    // ===== APARELHOS PRONTOS NÃO RETIRADOS =====
    try {
      const prontoSnap = await getDocs(
        query(collection(db, 'os'), ...injectTenantFilter([where('status', '==', 'concluido')]))
      );
      const prontos = [];
      prontoSnap.forEach(d => {
        const os = { id: d.id, ...d.data() };
        let dataConcluido = null;
        if (Array.isArray(os.timeline)) {
          const entry = [...os.timeline].reverse().find(t =>
            typeof t.text === 'string' && t.text.includes('→ Concluído')
          );
          if (entry?.date) dataConcluido = entry.date;
        }
        if (!dataConcluido) dataConcluido = os.updatedAt;
        if (!dataConcluido) return;
        const dias = calcDias(dataConcluido);
        if (dias > 3) prontos.push({ ...os, _dias: dias });
      });
      if (prontos.length > 0) {
        prontos.sort((a, b) => b._dias - a._dias);
        alertas.push({
          icon: '📦', cat: 'atencao', cor: 'atencao',
          title: 'APARELHOS NÃO RETIRADOS',
          sub: `${prontos.length} aparelho(s) pronto(s) há mais de 3 dias`,
          detail: `Toque para ver a lista. Ex.: ${prontos.slice(0, 2).map(o => `${o.id} (${o._dias}d)`).join(', ')}`,
          _osData: prontos,
          _tipo: 'pronto_nao_retirado',
          _titulo: 'Aparelhos Prontos — Não Retirados',
        });
      }
    } catch (e) { console.warn('Central de Alertas — OS prontas:', e); }

    // ===== ORÇAMENTOS SEM RESPOSTA =====
    try {
      const orcSnap = await getDocs(
        query(collection(db, 'os'), ...injectTenantFilter([where('status', 'in', ['orcamento', 'orcamento_enviado'])]))
      );
      const orcamentos = [];
      orcSnap.forEach(d => {
        const os = { id: d.id, ...d.data() };
        const dias = calcDias(os.updatedAt);
        if (dias > 2) orcamentos.push({ ...os, _dias: dias });
      });
      if (orcamentos.length > 0) {
        orcamentos.sort((a, b) => b._dias - a._dias);
        alertas.push({
          icon: '💬', cat: 'atencao', cor: 'atencao',
          title: 'ORÇAMENTOS SEM RESPOSTA',
          sub: `${orcamentos.length} orçamento(s) sem resposta há mais de 2 dias`,
          detail: `Toque para ver a lista. Ex.: ${orcamentos.slice(0, 2).map(o => `${o.id} (${o._dias}d)`).join(', ')}`,
          _osData: orcamentos,
          _tipo: 'orcamento_abandonado',
          _titulo: 'Orçamentos Sem Resposta',
        });
      }
    } catch (e) { console.warn('Central de Alertas — orçamentos:', e); }

    return alertas;
  },

  // ===== ALERTAS + DICAS ROTATIVAS =====
  setupAlerts() {
    const titleEl    = document.querySelector('.alert-title');
    const subtitleEl = document.querySelector('.alert-subtitle');
    const detailEl   = document.querySelector('.alert-detail');
    const iconEl     = document.getElementById('alert-cat-icon');
    const progressEl = document.getElementById('alert-progress-bar');
    if (!titleEl || !subtitleEl || !detailEl) return;

    // ─── Funções de som ───
    const tocarSomCurto = () => {
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
    const tocarSomVencida = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const beep = (freq, start, dur) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.25, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
          osc.start(start);
          osc.stop(start + dur);
        };
        beep(1047, ctx.currentTime, 0.15);
        beep(784, ctx.currentTime + 0.2, 0.15);
        beep(1047, ctx.currentTime + 0.4, 0.15);
      } catch {}
    };
    // Expõe para o botão "Testar Som" do modal
    this._tocarSomVencida = tocarSomVencida;

    // ─── Verifica se pode tocar som para o tipo de alerta ───
    const verificarConfigSom = (tipoAlerta) => {
      const config = this.carregarConfigAlertas();
      if (!config.som.ativo) return false;
      const agora = new Date();
      const hAtual = agora.getHours() * 60 + agora.getMinutes();
      const [hIni, mIni] = config.som.horarioInicio.split(':').map(Number);
      const [hFim, mFim] = config.som.horarioFim.split(':').map(Number);
      if (hAtual < hIni * 60 + mIni || hAtual >= hFim * 60 + mFim) return false;
      if (!config.som.diasSemana.includes(agora.getDay())) return false;
      if (config.som.silencio.ativo) {
        const [hSil, mSil] = config.som.silencio.inicio.split(':').map(Number);
        const [hSilF, mSilF] = config.som.silencio.fim.split(':').map(Number);
        if (hAtual >= hSil * 60 + mSil && hAtual < hSilF * 60 + mSilF) return false;
      }
      if (tipoAlerta && config.alertasComSom[tipoAlerta] === false) return false;
      return true;
    };

    // ─── Verifica se alerta deve pulsar ───
    const verificarPulsacao = (alerta) => {
      if (!alerta.pulsar) return false;
      const config = this.carregarConfigAlertas();
      if (alerta.cat === 'critico' && config.pulsacao.critico) return true;
      if (alerta.cat === 'atencao' && config.pulsacao.atencao) return true;
      return false;
    };

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
      this._alertaAtual = dica;
      const card = document.getElementById('alerts-card');
      if (card) card.style.cursor = dica._osData?.length ? 'pointer' : '';

      const aplicarSomEPulsacao = () => {
        // Som
        if (dica.som && verificarConfigSom(dica.tipo)) {
          if (dica.cat === 'critico') {
            tocarSomVencida();
          } else {
            tocarSomCurto();
          }
        }
        // Pulsação visual
        if (card && verificarPulsacao(dica)) {
          card.classList.add('alert-card-pulsing');
          setTimeout(() => card.classList.remove('alert-card-pulsing'), 10000);
        }
      };

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
          aplicarSomEPulsacao();
        }, 400);
      } else {
        titleEl.textContent    = dica.title;
        subtitleEl.textContent = dica.sub;
        detailEl.textContent   = dica.detail;
        aplicarCategoria(dica);
      }
    };

    // Click no card de alertas abre lista quando for alerta de OS
    const alertsCard = document.getElementById('alerts-card');
    if (alertsCard) {
      alertsCard.addEventListener('click', () => {
        if (this._alertaAtual?._osData?.length) this.mostrarAlertaOS(this._alertaAtual);
      });
    }

    mostrar(DICAS[0], false);

    // Aplica nova lista (alertas reais ou dicas) reiniciando o ciclo
    const aplicarLista = (nova) => {
      lista = (nova && nova.length) ? nova : DICAS;
      idx = 0;
      mostrar(lista[0], true);

      // Atualiza badge e subtítulo no card de módulo "Central de Alertas"
      const badge = document.getElementById('alertas-count-badge');
      const cardSub = document.getElementById('alertas-card-sub');
      const criticos = (nova || []).filter(a => a.cat === 'critico').length;
      const total = (nova || []).length;
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
        if (criticos > 0) {
          cardSub.textContent = `${criticos} alerta(s) crítico(s)`;
        } else if (total > 0) {
          cardSub.textContent = `${total} alerta(s) pendente(s)`;
        } else {
          cardSub.textContent = 'Sem pendências';
        }
      }
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

    // Re-toca som a cada 30s se o alerta atual tiver repetir:true (ex: vencidas)
    setInterval(() => {
      const atual = lista[idx];
      if (atual && atual.repetir && atual.som && verificarConfigSom(atual.tipo)) {
        if (atual.cat === 'critico') tocarSomVencida();
        else tocarSomCurto();
      }
    }, 30000);

    // Re-verifica os módulos a cada 10 minutos — não relê com a aba oculta.
    setInterval(() => { if (!document.hidden) atualizarAlertas(); }, 600000);
    // Ao voltar para a aba, atualiza na hora (mesmo padrão de 'focus' já usado no Dashboard/Agenda).
    document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizarAlertas(); });
  }
};
