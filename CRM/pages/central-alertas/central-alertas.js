// ============================================
//  CENTRAL DE ALERTAS — Cell City CRM
//  Cruza Ação da Semana (coleção 'agenda'), Ordem de Serviço, Pós-venda,
//  Portal do Cliente e Avaliações para gerar a lista de pendências do dia.
//  Status (novo/lido/resolvido) é por usuário, sincronizado em tempo real
//  via Firestore (mesmo padrão de 'notas_usuarios' usado no dock).
// ============================================
import { initModulo } from '../../scripts/kernel.js';
import { serverTimestamp } from '../../firebase/client.js';
import { AgendaRepository as Agenda } from '../../repositories/diario.repository.js';
import { AvaliacoesRepository as Avaliacoes, MensagensPortalRepository as MensagensPortal } from '../../repositories/portal.repository.js';
import { OSRepository as OS } from '../../repositories/os.repository.js';
import { PosvendaContatosRepository as PosvendaContatos } from '../../repositories/posvenda.repository.js';
import { CentralAlertasStatusRepository as CentralAlertasStatus } from '../../repositories/sistema.repository.js';

const STATUS_COL = 'central_alertas_status';
const CONFIG_KEY = 'cc_config_alertas';
const REFRESH_MS = 300000;

const PRIORIDADE_ORDEM = { critico: 0, atencao: 1, crm: 2 };
const STATUS_LABEL = { novo: '🆕 Novo', lido: '👁️ Lido', resolvido: '✅ Resolvido' };

// ── Estado ──────────────────────────────────────────────────────────
let _uid = null;
let alertas = [];          // lista bruta gerada na última carga
let statusMap = {};        // { [alertId]: { status, em } }
let _unsubStatus = null;
let refreshTimer = null;
let buscaTexto = '';
let filtroPrio = '';
let filtroStatus = '';
let ordenarPor = 'prioridade';
let quickFilter = 'todos';

// ── Elementos ───────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const listaEl = $('alr-lista');
const loadingEl = $('alr-loading');
const emptyEl = $('alr-empty');
const emptyTituloEl = $('alr-empty-title');
const emptySubEl = $('alr-empty-sub');
const toastEl = $('alr-toast');
const searchEl = $('alr-search');
const filtroPrioEl = $('alr-filtro-prio');
const filtroStatusEl = $('alr-filtro-status');
const ordenarEl = $('alr-ordenar');

let toastTimer = null;

// ── Util ────────────────────────────────────────────────────────────
function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}
function slug(s) {
    return String(s ?? '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}
function alertId(a) {
    return slug((a.tipo || a.title) + '::' + (a.sub || ''));
}
function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), 2200);
}
function fmtDataHora(d) {
    if (!d) return '—';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function diasAtras(dias) {
    return new Date(Date.now() - (dias || 0) * 86400000);
}

// ── Ação da Semana — leitura da coleção 'agenda' (mesma regra do Dashboard) ──
async function lerAgenda() {
    try {
        const snap = await Agenda.list();
        const eventos = [];
        const hojeISO = new Date().toISOString().slice(0, 10);

        const notasDe = (dados) => {
            if (Array.isArray(dados.notas)) return dados.notas.map(n => n || {}).filter(n => n.texto);
            if (typeof dados.texto === 'string') return dados.texto.split(/\r?\n+/).map(s => ({ texto: s.trim(), concluido: false })).filter(n => n.texto);
            if (dados.titulo) return [{ texto: `${dados.hora ? dados.hora + ' ' : ''}${dados.titulo}`, concluido: false }];
            return [];
        };
        const horaDoTexto = (txt) => { const m = String(txt).match(/^\s*(\d{1,2}:\d{2})\b/); return m ? m[1] : ''; };
        const semHora = (txt) => String(txt).replace(/^\s*\d{1,2}:\d{2}\s*/, '').trim();
        const recCai = (iso, origem, pat) => {
            if (!pat || iso < origem) return false;
            const a = new Date(iso + 'T00:00:00'), b = new Date(origem + 'T00:00:00');
            if (pat === 'semanal') return a.getDay() === b.getDay();
            if (pat === 'mensal') return a.getDate() === b.getDate();
            if (pat === 'anual') return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
            return false;
        };

        snap.forEach(d => {
            const dados = d;
            const dia = dados.data || d.id;
            const notas = notasDe(dados);

            const gerarEvento = (dataAlvo, hora, titulo, concluido) => {
                if (!/^\d{1,2}:\d{2}$/.test(hora || '')) return;
                const desc = semHora(titulo) || titulo;
                eventos.push({ data: dataAlvo, hora, titulo: desc, concluido: !!concluido });
            };
            const gerarEventosDoDia = (dataAlvo, horaPadrao) => {
                notas.forEach(n => {
                    const hora = horaDoTexto(n.texto) || horaPadrao;
                    gerarEvento(dataAlvo, hora, n.texto, n.concluido);
                });
            };
            const temPendente = notas.some(n => !n.concluido);

            if (dados.recorrencia) {
                if (dados.alertaDashboard !== true) return;
                const horaPadrao = /^\d{1,2}:\d{2}$/.test(dados.alertaHora || '') ? dados.alertaHora : '';
                const excluir = Array.isArray(dados.recorrenciaExcluir) ? dados.recorrenciaExcluir : [];
                const pararEm = dados.recorrenciaPararEm || '';
                const ocorrenciaValida = (iso) => !excluir.includes(iso) && !(pararEm && iso >= pararEm);

                if (dia < hojeISO && temPendente && ocorrenciaValida(dia)) gerarEventosDoDia(dia, horaPadrao);
                if (recCai(hojeISO, dia, dados.recorrencia) && ocorrenciaValida(hojeISO)) {
                    if (dia === hojeISO) gerarEventosDoDia(hojeISO, horaPadrao);
                    else if (temPendente) gerarEventosDoDia(hojeISO, horaPadrao);
                }
            } else {
                if (dados.alertaDashboard !== true) return;
                const horaPadrao = /^\d{1,2}:\d{2}$/.test(dados.alertaHora || '') ? dados.alertaHora : '';
                gerarEventosDoDia(dia, horaPadrao);
            }
        });
        return eventos;
    } catch (e) {
        console.warn('Central de Alertas — erro ao ler agenda:', e);
        return [];
    }
}

// ── Geração dos alertas ─────────────────────────────────────────────
async function gerarAlertas() {
    const out = [];
    const now = new Date();

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

    // ── Carrega tudo em paralelo (1 única leitura de 'os', reaproveitada
    //    para pós-venda, prontos e orçamentos — evita 3 leituras repetidas) ──
    const [eventos, osDocs, contatosList, portalList, avaliacoesList] = await Promise.all([
        lerAgenda(),
        OS.list(),
        PosvendaContatos.list(),
        MensagensPortal.list({ where: [['lida', '==', false]] }).catch(e => { console.warn('Central de Alertas — mensagens_portal:', e); return null; }),
        Avaliacoes.list({ orderByField: 'createdAt', direction: 'desc', limitTo: 5 }).catch(e => { console.warn('Central de Alertas — avaliacoes:', e); return null; })
    ]);

    const osList = osDocs.map(d => ({ firestoreId: d.id, ...d }));

    // ===== AÇÃO DA SEMANA =====
    try {
        const agora = Date.now();
        const hojeISO = new Date().toISOString().slice(0, 10);
        const d = new Date();
        const minsAtual = d.getHours() * 60 + d.getMinutes();

        const estaAtrasado = (e) => {
            if (e.concluido || !e.data) return false;
            if (e.hora) return new Date(`${e.data}T${e.hora}:00`).getTime() < agora;
            return e.data < hojeISO;
        };
        const diffMinEvento = (e) => {
            if (!e.hora) return Infinity;
            const [h, m] = e.hora.split(':').map(Number);
            return (h * 60 + m) - minsAtual;
        };

        const atrasadas = (eventos || []).filter(estaAtrasado);
        const atrasadasDiasAnteriores = atrasadas.filter(e => e.data < hojeISO);
        const noHorario = (eventos || []).filter(e => {
            if (e.concluido || !e.data || !e.hora) return false;
            if (e.data !== hojeISO) return false;
            const diff = diffMinEvento(e);
            return diff >= 0 && diff <= 5;
        });
        const proximas = (eventos || []).filter(e => {
            if (e.concluido || !e.data || !e.hora) return false;
            if (e.data !== hojeISO) return false;
            const diff = diffMinEvento(e);
            return diff > 5 && diff <= 15;
        });

        if (atrasadas.length > 0) {
            const totalAtrasadas = atrasadas.length;
            const fmtAtraso = (min) => {
                if (min >= 1440) return `${Math.floor(min / 1440)}d ${Math.floor((min % 1440) / 60)}h`;
                if (min >= 60) return `${Math.floor(min / 60)}h${min % 60 ? ' ' + (min % 60) + 'min' : ''}`;
                return `${min} min`;
            };
            const maisAntiga = [...atrasadas].sort((a, b) => {
                const tsA = new Date(`${a.data}T${a.hora || '00:00'}:00`).getTime();
                const tsB = new Date(`${b.data}T${b.hora || '00:00'}:00`).getTime();
                return tsA - tsB;
            })[0];
            const dtExemplo = new Date(`${maisAntiga.data}T${maisAntiga.hora || '00:00'}:00`);
            const atrasoMin = Math.max(0, Math.round((agora - dtExemplo.getTime()) / 60000));
            const diasAntLabel = atrasadasDiasAnteriores.length > 0 ? ` (${atrasadasDiasAnteriores.length} de dias anteriores)` : '';

            out.push({
                icon: '🔴', cat: 'critico',
                title: `AÇÃO DA SEMANA · ${totalAtrasadas} pendente(s)${diasAntLabel}`,
                sub: `🔴 Aguardando conclusão · ${fmtAtraso(atrasoMin)} atrasado`,
                detail: `${totalAtrasadas} tarefa(s) atrasada(s) — Ex.: "${maisAntiga.titulo}". Conclua no módulo Ação da Semana para remover este alerta.`,
                som: true, pulsar: true, tipo: 'acaoSemanaVencidas',
                quando: dtExemplo, link: '../acaodasemana/index.html'
            });
        }
        if (atrasadas.length === 0 && noHorario.length > 0) {
            out.push({
                icon: '⏰', cat: 'critico',
                title: 'AÇÃO DA SEMANA · AGORA',
                sub: noHorario.length === 1 ? 'Tarefa programada para AGORA' : `${noHorario.length} tarefas AGORA`,
                detail: noHorario.map(e => `${e.hora} ${e.titulo}`).join(' · '),
                som: true, pulsar: true, tipo: 'acaoSemanaAgora',
                quando: now, link: '../acaodasemana/index.html'
            });
        }
        if (atrasadas.length === 0 && noHorario.length === 0 && proximas.length > 0) {
            out.push({
                icon: '⏰', cat: 'atencao',
                title: 'AÇÃO DA SEMANA · Próximos',
                sub: proximas.length === 1 ? `Em ${proximas[0].hora}` : `${proximas.length} tarefas em breve`,
                detail: proximas.map(e => `${e.hora} ${e.titulo}`).join(' · '),
                som: true, tipo: 'acaoSemanaProximas',
                quando: now, link: '../acaodasemana/index.html'
            });
        }
    } catch (e) { console.warn('Central de Alertas — ação da semana:', e); }

    // ===== PÓS-VENDA =====
    try {
        const contatosFeitos = new Set();
        contatosList.forEach(c => { if (c.ativo === false) return; contatosFeitos.add(`${c.osId}_${c.prazo}`); });

        let pvPendentes = 0, pvVencidos = 0;
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
                if (dias > prazo + 2) { pvVencidos++; pvVencidosClientes.push({ nome: os.clientName || 'Cliente', dias }); }
            });
        });

        pvVencidosClientes.slice(0, 3).forEach(c => {
            out.push({
                icon: '💡', cat: 'critico',
                title: 'PÓS-VENDA ATRASADO', sub: `${c.nome} aguardando contato`,
                detail: `Cliente ${c.nome} está há ${c.dias} dias aguardando o contato de pós-venda.`,
                som: true, pulsar: true, tipo: 'posVendaCritico',
                quando: diasAtras(c.dias), link: '../pos-venda/index.html'
            });
        });
        if (pvVencidos > 0) {
            out.push({
                icon: '💡', cat: 'critico',
                title: 'PÓS-VENDA ATRASADO', sub: `${pvVencidos} contato(s) vencido(s)`,
                detail: `Existem ${pvVencidos} contato(s) de pós-venda vencidos. Entre em contato o quanto antes.`,
                som: true, pulsar: true, tipo: 'posVendaCritico',
                quando: now, link: '../pos-venda/index.html'
            });
        }
        if (pvPendentes > 0) {
            out.push({
                icon: '💡', cat: 'atencao',
                title: 'PÓS-VENDA PENDENTE', sub: `${pvPendentes} cliente(s) pendente(s)`,
                detail: `Existem ${pvPendentes} cliente(s) aguardando contato de pós-venda.`,
                quando: now, link: '../pos-venda/index.html'
            });
        }
    } catch (e) { console.warn('Central de Alertas — pós-venda:', e); }

    // ===== ORDEM DE SERVIÇO =====
    try {
        let osOrcamento = 0, osPronto = 0, osOrcamentoParado = 0;
        osList.forEach(os => {
            if (os.status === 'orcamento_enviado' || os.status === 'orcamento') {
                osOrcamento++;
                const ref = getDeliveryDate(os) || os.createdAt;
                if (ref && calcDias(typeof ref === 'string' ? ref : (ref.toDate ? ref.toDate().toISOString() : ref)) > 2) osOrcamentoParado++;
            }
            if (os.status === 'concluido' || os.status === 'pronto') osPronto++;
        });

        if (osOrcamentoParado > 0) {
            out.push({
                icon: '💡', cat: 'critico',
                title: 'OS AGUARDANDO CLIENTE', sub: `${osOrcamentoParado} orçamento(s) parado(s)`,
                detail: `${osOrcamentoParado} cliente(s) com orçamento aguardando aprovação há mais de 2 dias.`,
                som: true, pulsar: true, tipo: 'osAguardandoCliente',
                quando: now, link: '../os/index.html'
            });
        }
        if (osOrcamento > 0) {
            out.push({
                icon: '💡', cat: 'atencao',
                title: 'OS AGUARDANDO APROVAÇÃO', sub: `${osOrcamento} aparelho(s) no orçamento`,
                detail: `Existem ${osOrcamento} aparelho(s) aguardando aprovação do orçamento.`,
                quando: now, link: '../os/index.html'
            });
        }
        if (osPronto > 0) {
            out.push({
                icon: '💡', cat: 'atencao',
                title: 'OS PRONTAS PARA ENTREGA', sub: `${osPronto} OS pronta(s)`,
                detail: `Existem ${osPronto} OS pronta(s) para entrega. Avise os clientes.`,
                quando: now, link: '../os/index.html'
            });
        }
    } catch (e) { console.warn('Central de Alertas — OS:', e); }

    // ===== PORTAL DO CLIENTE =====
    try {
        if (portalList) {
            const msgsNaoLidas = [...portalList];
            if (msgsNaoLidas.length > 0) {
                out.push({
                    icon: '💬', cat: 'atencao',
                    title: 'PORTAL DO CLIENTE', sub: `${msgsNaoLidas.length} mensagem(ns) não lida(s)`,
                    detail: `${msgsNaoLidas.length} cliente(s) enviaram mensagem pelo Portal do Cliente. Acesse o módulo para responder.`,
                    quando: now, link: '../portal-cliente/admin.html'
                });
                msgsNaoLidas.slice(0, 3).forEach(m => {
                    const quando = m.createdAt?.toDate ? m.createdAt.toDate() : now;
                    out.push({
                        icon: '💬', cat: 'crm',
                        title: `📩 ${m.clientName || m.nome || 'Cliente'}`,
                        sub: (m.texto || '').slice(0, 60) + ((m.texto || '').length > 60 ? '...' : ''),
                        detail: `Cliente enviou mensagem pelo portal. Acesse o módulo Portal do Cliente para visualizar e responder.`,
                        quando, link: '../portal-cliente/admin.html'
                    });
                });
            }
        }
    } catch (e) { console.warn('Central de Alertas — portal:', e); }

    // ===== AVALIAÇÕES =====
    try {
        if (avaliacoesList) {
            const avaliacoesRecentes = [...avaliacoesList];
            if (avaliacoesRecentes.length > 0) {
                const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
                const avaliacoesHoje = avaliacoesRecentes.filter(a => {
                    if (!a.createdAt) return false;
                    const dt = typeof a.createdAt === 'string' ? new Date(a.createdAt) : (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt));
                    return dt >= hoje;
                });
                if (avaliacoesHoje.length > 0) {
                    out.push({
                        icon: '⭐', cat: 'crm',
                        title: 'AVALIAÇÕES RECEBIDAS', sub: `${avaliacoesHoje.length} nova(s) avaliação(ões) hoje`,
                        detail: `${avaliacoesHoje.length} cliente(s) avaliaram o atendimento pelo Portal do Cliente hoje.`,
                        quando: now, link: '../portal-cliente/admin.html'
                    });
                }
                const avaliacoesCriticas = avaliacoesRecentes.filter(a => a.nota && a.nota <= 2);
                if (avaliacoesCriticas.length > 0) {
                    out.push({
                        icon: '🔴', cat: 'critico',
                        title: 'AVALIAÇÕES CRÍTICAS', sub: `${avaliacoesCriticas.length} avaliação(ões) com nota baixa`,
                        detail: `${avaliacoesCriticas.length} cliente(s) deram nota baixa. Verifique o feedback e entre em contato.`,
                        som: true, pulsar: true, tipo: 'avaliacoesCriticas',
                        quando: now, link: '../portal-cliente/admin.html'
                    });
                }
            }
        }
    } catch (e) { console.warn('Central de Alertas — avaliações:', e); }

    // ===== APARELHOS PRONTOS NÃO RETIRADOS =====
    try {
        const prontos = [];
        osList.forEach(os => {
            if (os.status !== 'concluido') return;
            let dataConcluido = null;
            if (Array.isArray(os.timeline)) {
                const entry = [...os.timeline].reverse().find(t => typeof t.text === 'string' && t.text.includes('→ Concluído'));
                if (entry?.date) dataConcluido = entry.date;
            }
            if (!dataConcluido) dataConcluido = os.updatedAt;
            if (!dataConcluido) return;
            const dias = calcDias(dataConcluido);
            if (dias > 3) prontos.push({ id: os.id || os.firestoreId, clientName: os.clientName, _dias: dias });
        });
        if (prontos.length > 0) {
            prontos.sort((a, b) => b._dias - a._dias);
            out.push({
                icon: '📦', cat: 'atencao',
                title: 'APARELHOS NÃO RETIRADOS', sub: `${prontos.length} aparelho(s) pronto(s) há mais de 3 dias`,
                detail: `Toque para ver a lista de aparelhos prontos aguardando retirada.`,
                _osData: prontos, _titulo: 'Aparelhos Prontos — Não Retirados',
                quando: diasAtras(prontos[0]._dias), link: '../os/index.html'
            });
        }
    } catch (e) { console.warn('Central de Alertas — OS prontas:', e); }

    // ===== ORÇAMENTOS SEM RESPOSTA =====
    try {
        const orcamentos = [];
        osList.forEach(os => {
            if (os.status !== 'orcamento' && os.status !== 'orcamento_enviado') return;
            const dias = calcDias(os.updatedAt);
            if (dias > 2) orcamentos.push({ id: os.id || os.firestoreId, clientName: os.clientName, _dias: dias });
        });
        if (orcamentos.length > 0) {
            orcamentos.sort((a, b) => b._dias - a._dias);
            out.push({
                icon: '💬', cat: 'atencao',
                title: 'ORÇAMENTOS SEM RESPOSTA', sub: `${orcamentos.length} orçamento(s) sem resposta há mais de 2 dias`,
                detail: `Toque para ver a lista de orçamentos parados.`,
                _osData: orcamentos, _titulo: 'Orçamentos Sem Resposta',
                quando: diasAtras(orcamentos[0]._dias), link: '../os/index.html'
            });
        }
    } catch (e) { console.warn('Central de Alertas — orçamentos:', e); }

    return out;
}

// ── Status (Firestore: central_alertas_status/{uid}) ──────────────────
function iniciarStatusSync() {
    if (_unsubStatus) _unsubStatus();
    _unsubStatus = CentralAlertasStatus.onDocChange(_uid, item => {
        statusMap = (item && item.itens) || {};
        render();
    }, e => console.warn('Central de Alertas — status sync:', e));
}
function getStatus(id) { return statusMap[id]?.status || 'novo'; }
async function setStatus(id, status) {
    statusMap = { ...statusMap, [id]: { status, em: new Date().toISOString() } };
    render();
    try {
        await CentralAlertasStatus.set(_uid, { itens: statusMap, atualizadoEm: serverTimestamp() }, { merge: true });
    } catch (e) { console.warn('Central de Alertas — falha ao salvar status:', e); }
}

// ── Carregar + render ──────────────────────────────────────────────
async function carregar() {
    loadingEl.style.display = 'flex';
    listaEl.innerHTML = '';
    emptyEl.style.display = 'none';
    try {
        alertas = await gerarAlertas();
    } catch (e) {
        console.warn('Central de Alertas — erro ao gerar:', e);
        alertas = [];
    }
    loadingEl.style.display = 'none';
    render();
}

function listaComStatus() {
    return alertas.map(a => {
        const id = alertId(a);
        return { ...a, id, status: getStatus(id) };
    });
}

function aplicarFiltros() {
    let lista = listaComStatus();
    if (quickFilter === 'critico') lista = lista.filter(a => a.cat === 'critico');
    else if (quickFilter === 'atencao') lista = lista.filter(a => a.cat === 'atencao');
    else if (quickFilter === 'novo') lista = lista.filter(a => a.status === 'novo');

    if (filtroPrio) lista = lista.filter(a => a.cat === filtroPrio);
    if (filtroStatus) lista = lista.filter(a => a.status === filtroStatus);
    if (buscaTexto) {
        const t = buscaTexto.toLowerCase();
        lista = lista.filter(a => `${a.title} ${a.sub || ''} ${a.detail || ''}`.toLowerCase().includes(t));
    }
    if (ordenarPor === 'prioridade') {
        lista.sort((a, b) => (PRIORIDADE_ORDEM[a.cat] ?? 3) - (PRIORIDADE_ORDEM[b.cat] ?? 3) || (b.quando?.getTime?.() || 0) - (a.quando?.getTime?.() || 0));
    } else {
        lista.sort((a, b) => (b.quando?.getTime?.() || 0) - (a.quando?.getTime?.() || 0));
    }
    return lista;
}

function atualizarResumo() {
    const todosComStatus = listaComStatus();
    $('alr-num-total').textContent = todosComStatus.length;
    $('alr-num-critico').textContent = todosComStatus.filter(a => a.cat === 'critico').length;
    $('alr-num-atencao').textContent = todosComStatus.filter(a => a.cat === 'atencao').length;
    $('alr-num-novo').textContent = todosComStatus.filter(a => a.status === 'novo').length;

    document.querySelectorAll('.alr-resumo-item').forEach(el => {
        el.classList.toggle('ativo', el.getAttribute('data-quick') === quickFilter);
    });
}

function render() {
    atualizarResumo();
    const lista = aplicarFiltros();

    if (lista.length === 0) {
        listaEl.innerHTML = '';
        emptyEl.style.display = 'block';
        const semAlertas = alertas.length === 0;
        emptyTituloEl.textContent = semAlertas ? 'Nenhum alerta pendente' : 'Nenhum alerta encontrado';
        emptySubEl.textContent = semAlertas ? 'Tudo certo por aqui. Novos alertas aparecem automaticamente.' : 'Ajuste os filtros ou a busca para ver outros alertas.';
        return;
    }
    emptyEl.style.display = 'none';
    listaEl.innerHTML = lista.map(renderCard).join('');

    listaEl.querySelectorAll('[data-acao]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.closest('.alr-card').getAttribute('data-id');
            const acao = btn.getAttribute('data-acao');
            if (acao === 'lido') setStatus(id, 'lido');
            else if (acao === 'resolver') { setStatus(id, 'resolvido'); toast('Alerta marcado como resolvido'); }
            else if (acao === 'reabrir') setStatus(id, 'novo');
        });
    });
    listaEl.querySelectorAll('.alr-card').forEach(card => {
        card.addEventListener('click', () => {
            const a = lista.find(x => x.id === card.getAttribute('data-id'));
            if (a) abrirDetalhe(a);
        });
    });
}

function renderCard(a) {
    const acoes = [];
    if (a.status !== 'novo') acoes.push(`<button class="alr-acao-btn" data-acao="reabrir" title="Marcar como novo">↩️</button>`);
    if (a.status === 'novo') acoes.push(`<button class="alr-acao-btn" data-acao="lido" title="Marcar como lido">👁️</button>`);
    if (a.status !== 'resolvido') acoes.push(`<button class="alr-acao-btn" data-acao="resolver" title="Resolver">✅</button>`);

    return `<div class="alr-card cat-${a.cat} status-${a.status}${a.pulsar && a.status === 'novo' ? ' pulsar' : ''}" data-id="${a.id}">
        <div class="alr-card-top">
            <span class="alr-card-icon">${a.icon || '💡'}</span>
            <div class="alr-card-main">
                <div class="alr-card-titulo">${escapeHtml(a.title)}</div>
                <div class="alr-card-sub">${escapeHtml(a.sub || '')}</div>
                <div class="alr-card-meta">
                    <span class="alr-badge alr-badge-${a.status}">${STATUS_LABEL[a.status]}</span>
                    <span class="alr-badge alr-badge-data">🕐 ${fmtDataHora(a.quando)}</span>
                </div>
            </div>
            <div class="alr-card-acoes">${acoes.join('')}</div>
        </div>
    </div>`;
}

// ── Modal de detalhes ───────────────────────────────────────────────
function abrirDetalhe(a) {
    $('alr-detalhe-titulo').textContent = `${a.icon || '💡'} ${a.title}`;
    let html = `<div class="alr-detalhe-sub">${escapeHtml(a.sub || '')}</div>`;
    html += `<div class="alr-detalhe-texto">${escapeHtml(a.detail || '')}</div>`;
    html += `<div class="alr-detalhe-texto" style="margin-top:10px;color:var(--text-tertiary);font-size:12.5px;">🕐 ${fmtDataHora(a.quando)} · ${STATUS_LABEL[a.status]}</div>`;

    if (Array.isArray(a._osData) && a._osData.length > 0) {
        html += `<div class="alr-detalhe-itens">` + a._osData.map(os => {
            const href = `../os/index.html#os-${encodeURIComponent(os.id)}`;
            return `<a class="alr-detalhe-item" href="${href}">
                <span>${escapeHtml(os.clientName || 'Cliente')} · OS ${escapeHtml(os.id)}</span>
                <span class="alr-detalhe-item-dias">${os._dias}d</span>
            </a>`;
        }).join('') + `</div>`;
    }
    $('alr-detalhe-body').innerHTML = html;

    const acoesEl = $('alr-detalhe-acoes');
    acoesEl.innerHTML = '';
    if (a.link) {
        const btnAbrir = document.createElement('a');
        btnAbrir.href = a.link;
        btnAbrir.className = 'alr-btn-salvar';
        btnAbrir.textContent = 'Abrir módulo';
        btnAbrir.style.textDecoration = 'none';
        btnAbrir.style.display = 'inline-flex';
        btnAbrir.style.alignItems = 'center';
        acoesEl.appendChild(btnAbrir);
    }
    const btnFechar2 = document.createElement('button');
    btnFechar2.className = 'alr-btn-cancelar';
    btnFechar2.textContent = 'Fechar';
    btnFechar2.addEventListener('click', () => { $('alr-modal-detalhe').style.display = 'none'; });
    acoesEl.appendChild(btnFechar2);

    if (a.status === 'novo') setStatus(a.id, 'lido');
    $('alr-modal-detalhe').style.display = 'flex';
}

// ── Marcar todos como lidos ─────────────────────────────────────────
async function marcarTodosComoLidos() {
    const novoMap = { ...statusMap };
    let alterou = false;
    alertas.forEach(a => {
        const id = alertId(a);
        if ((novoMap[id]?.status || 'novo') === 'novo') {
            novoMap[id] = { status: 'lido', em: new Date().toISOString() };
            alterou = true;
        }
    });
    if (!alterou) { toast('Nenhum alerta novo para marcar'); return; }
    statusMap = novoMap;
    render();
    try {
        await CentralAlertasStatus.set(_uid, { itens: statusMap, atualizadoEm: serverTimestamp() }, { merge: true });
        toast('Todos os alertas foram marcados como lidos');
    } catch (e) { console.warn('Central de Alertas — falha ao marcar todos:', e); }
}

// ── Configuração de som (mesma chave usada pelo painel do Dashboard) ──
function configPadrao() {
    return {
        som: {
            ativo: true, horarioInicio: '08:00', horarioFim: '18:00',
            diasSemana: [1, 2, 3, 4, 5],
            silencio: { ativo: false, inicio: '12:00', fim: '13:00' }
        },
        alertasComSom: {
            acaoSemanaVencidas: true, acaoSemanaAgora: false, acaoSemanaProximas: false,
            posVendaCritico: false, osAguardandoCliente: false, avaliacoesCriticas: false
        },
        pulsacao: { critico: true, atencao: false }
    };
}
function carregarConfigAlertas() {
    try {
        const raw = localStorage.getItem(CONFIG_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignora config inválida */ }
    return configPadrao();
}
function setChecked(id, v) { const el = $(id); if (el) el.checked = !!v; }
function getChecked(id) { const el = $(id); return el ? el.checked : false; }
function setValue(id, v) { const el = $(id); if (el) el.value = v; }
function getValue(id, fallback) { const el = $(id); return el ? el.value : fallback; }

function carregarConfigAlertasUI() {
    const config = carregarConfigAlertas();
    setChecked('alr-config-som-ativo', config.som.ativo);
    setValue('alr-config-som-inicio', config.som.horarioInicio);
    setValue('alr-config-som-fim', config.som.horarioFim);
    document.querySelectorAll('.alr-config-dia-sem').forEach(chk => {
        chk.checked = config.som.diasSemana.includes(parseInt(chk.value));
    });
    setChecked('alr-config-silencio-ativo', config.som.silencio.ativo);
    setValue('alr-config-silencio-inicio', config.som.silencio.inicio);
    setValue('alr-config-silencio-fim', config.som.silencio.fim);
    $('alr-config-silencio-campos').style.display = config.som.silencio.ativo ? 'flex' : 'none';
    document.querySelectorAll('.alr-config-alerta-som').forEach(chk => {
        chk.checked = config.alertasComSom[chk.getAttribute('data-tipo')] === true;
    });
    document.querySelectorAll('.alr-config-pulsacao').forEach(chk => {
        chk.checked = config.pulsacao[chk.getAttribute('data-nivel')] === true;
    });
}
function salvarConfigAlertas() {
    const config = {
        som: {
            ativo: getChecked('alr-config-som-ativo'),
            horarioInicio: getValue('alr-config-som-inicio', '08:00'),
            horarioFim: getValue('alr-config-som-fim', '18:00'),
            diasSemana: Array.from(document.querySelectorAll('.alr-config-dia-sem:checked')).map(c => parseInt(c.value)),
            silencio: {
                ativo: getChecked('alr-config-silencio-ativo'),
                inicio: getValue('alr-config-silencio-inicio', '12:00'),
                fim: getValue('alr-config-silencio-fim', '13:00')
            }
        },
        alertasComSom: {},
        pulsacao: {
            critico: document.querySelector('.alr-config-pulsacao[data-nivel="critico"]')?.checked ?? true,
            atencao: document.querySelector('.alr-config-pulsacao[data-nivel="atencao"]')?.checked ?? false
        }
    };
    document.querySelectorAll('.alr-config-alerta-som').forEach(chk => {
        config.alertasComSom[chk.getAttribute('data-tipo')] = chk.checked;
    });
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    toast('Configuração de alertas salva');
}
function tocarSomTeste() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const beep = (freq, start, dur) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.25, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
            osc.start(start); osc.stop(start + dur);
        };
        beep(1047, ctx.currentTime, 0.15);
        beep(784, ctx.currentTime + 0.2, 0.15);
        beep(1047, ctx.currentTime + 0.4, 0.15);
    } catch { /* áudio bloqueado pelo navegador */ }
}

// ── Eventos de UI ───────────────────────────────────────────────────
function setupEventos() {
    document.querySelectorAll('.alr-resumo-item').forEach(btn => {
        btn.addEventListener('click', () => {
            quickFilter = btn.getAttribute('data-quick');
            render();
        });
    });

    let buscaTimer = null;
    searchEl.addEventListener('input', () => {
        clearTimeout(buscaTimer);
        buscaTimer = setTimeout(() => { buscaTexto = searchEl.value.trim(); render(); }, 200);
    });
    filtroPrioEl.addEventListener('change', () => { filtroPrio = filtroPrioEl.value; render(); });
    filtroStatusEl.addEventListener('change', () => { filtroStatus = filtroStatusEl.value; render(); });
    ordenarEl.addEventListener('change', () => { ordenarPor = ordenarEl.value; render(); });

    $('alr-btn-atualizar').addEventListener('click', () => { carregar(); toast('Alertas atualizados'); });
    $('alr-btn-marcar-todos').addEventListener('click', marcarTodosComoLidos);

    $('alr-detalhe-fechar').addEventListener('click', () => { $('alr-modal-detalhe').style.display = 'none'; });

    $('alr-btn-config').addEventListener('click', () => {
        carregarConfigAlertasUI();
        $('alr-modal-config').style.display = 'flex';
    });
    $('alr-config-fechar').addEventListener('click', () => { $('alr-modal-config').style.display = 'none'; });
    $('alr-config-silencio-ativo').addEventListener('change', (e) => {
        $('alr-config-silencio-campos').style.display = e.target.checked ? 'flex' : 'none';
    });
    $('alr-btn-salvar-config').addEventListener('click', () => {
        salvarConfigAlertas();
        $('alr-modal-config').style.display = 'none';
    });
    $('alr-btn-testar-som').addEventListener('click', tocarSomTeste);
}

// ── Boot ────────────────────────────────────────────────────────────
async function init() {
    const ctx = await initModulo();
    if (!ctx) return;
    _uid = ctx.uid;

    setupEventos();
    iniciarStatusSync();
    await carregar();

    // Não relê com a aba oculta — o refresh ao voltar o foco (abaixo) já cobre esse caso.
    refreshTimer = setInterval(() => { if (!document.hidden) carregar(); }, REFRESH_MS);
    window.addEventListener('focus', carregar);
    window.addEventListener('beforeunload', () => {
        if (refreshTimer) clearInterval(refreshTimer);
        if (_unsubStatus) _unsubStatus();
    });
}

document.addEventListener('DOMContentLoaded', init);
