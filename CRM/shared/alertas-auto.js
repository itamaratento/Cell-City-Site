/**
 * alertas-auto.js — Cell City CRM
 * Motor de geração automática de alertas para alertas_usuario.
 *
 * Executa verificações periódicas em múltiplos módulos e cria
 * alertas no Firestore sem duplicação.
 */

import { db } from '../scripts/firebase.js';
import {
    collection, addDoc, getDocs, query, where, limit,
    serverTimestamp
} from '../scripts/firebase.js';

const COL = 'alertas_usuario';
const LS_KEY_VERIF = 'cc_alertas_auto_ts';
const INTERVALO_MS = 15 * 60 * 1000; // 15 min

// ── Core: cria alerta sem duplicar ───────────────────────────────────────────
async function _criarAuto({ autoId, titulo, descricao, tipo, prioridade, link, modulo }) {
    if (!titulo) return null;

    if (autoId) {
        try {
            const snap = await getDocs(
                query(collection(db, COL), where('autoId', '==', autoId), limit(5))
            );
            const existeAtivo = snap.docs.some(d => d.data().status !== 'concluido');
            if (existeAtivo) return null;
        } catch { return null; }
    }

    const agora = new Date();
    try {
        await addDoc(collection(db, COL), {
            titulo,
            descricao:   descricao || '',
            tipo:        tipo || 'lembrete',
            prioridade:  prioridade || 'media',
            status:      'pendente',
            data:        agora.toISOString().slice(0, 10),
            hora:        `${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`,
            repeticao:   'nenhuma',
            link:        link || null,
            modulo:      modulo || null,
            autoId:      autoId || null,
            automatico:  true,
            criadoEmISO: agora.toISOString(),
            criadoEm:    serverTimestamp(),
        });
        return true;
    } catch (e) {
        console.warn('[AlertaAuto] Erro ao criar:', e.message);
        return null;
    }
}

// ── Helpers de data ───────────────────────────────────────────────────────────
const _hoje      = () => new Date().toISOString().slice(0, 10);
const _diasAtras = n  => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const _diasFre   = n  => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const _diasDiff  = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
const _diasFuturo= iso => Math.ceil( (new Date(iso).getTime() - Date.now()) / 864e5);
const _fmtData   = iso => iso?.split('-').reverse().join('/') || '';

// ── Módulo: Ordens de Serviço ─────────────────────────────────────────────────
async function _verificarOS() {
    const h = _hoje();
    const limite7d  = _diasAtras(7);
    const limite30d = _diasAtras(30);
    const garantia7 = _diasFre(7);
    const concluidos = ['concluido', 'entregue', 'cancelado', 'cancelada'];
    const prontos    = ['pronto', 'pronta', 'aguardando_retirada', 'aguardando retirada'];

    let snap;
    try { snap = await getDocs(query(collection(db, 'os'), limit(300))); }
    catch (e) { console.warn('[AlertaAuto] OS:', e.message); return; }

    for (const d of snap.docs) {
        const os      = { id: d.id, ...d.data() };
        const st      = (os.status || '').toLowerCase().trim();
        const entrada = os.dataEntrada || os.data || '';
        const cli     = os.nomeCliente || os.cliente || 'Cliente';
        const ap      = os.aparelho || os.modelo || '';
        const linkOS  = `../../pages/os/index.html#os-${os.id}`;
        const etiq    = ap ? `${cli} — ${ap}` : cli;

        // OS pronta para entrega
        if (prontos.includes(st)) {
            await _criarAuto({
                autoId:    `os_pronta_${os.id}`,
                titulo:    `OS pronta para retirada`,
                descricao: `${etiq} está pronto para ser retirado.`,
                tipo: 'os', prioridade: 'alta', link: linkOS, modulo: 'os',
            });
        }

        // Aparelho pronto mas não retirado há 30+ dias
        if (prontos.includes(st) && os.dataConclusao && os.dataConclusao < limite30d) {
            const d30 = _diasDiff(os.dataConclusao);
            await _criarAuto({
                autoId:    `os_nao_retirada_${os.id}`,
                titulo:    `Aparelho não retirado há ${d30} dias`,
                descricao: `${etiq} — pronto desde ${_fmtData(os.dataConclusao)}, cliente não retirou.`,
                tipo: 'os', prioridade: 'critica', link: linkOS, modulo: 'os',
            });
        }

        // OS parada há mais de 7 dias (sem ser concluída)
        if (entrada && entrada < limite7d && !concluidos.includes(st) && !prontos.includes(st)) {
            const dP = _diasDiff(entrada);
            await _criarAuto({
                autoId:    `os_parada_${os.id}`,
                titulo:    `OS parada há ${dP} dias`,
                descricao: `${etiq} — entrada em ${_fmtData(entrada)}, sem movimentação.`,
                tipo: 'os', prioridade: dP > 30 ? 'critica' : 'alta', link: linkOS, modulo: 'os',
            });
        }

        // OS aguardando peça
        if (['aguardando_peca', 'aguardando peça', 'aguardando_pecas', 'ag. peça'].includes(st)) {
            await _criarAuto({
                autoId:    `os_aguardando_peca_${os.id}`,
                titulo:    `OS aguardando peça`,
                descricao: `${etiq} aguardando peça há ${entrada ? _diasDiff(entrada) : '?'} dias.`,
                tipo: 'os', prioridade: 'media', link: linkOS, modulo: 'os',
            });
        }

        // Garantia vencendo em até 7 dias
        const dGar = os.dataGarantia || os.garantiaAte || '';
        if (dGar && dGar >= h && dGar <= garantia7) {
            const dG = _diasFuturo(dGar);
            await _criarAuto({
                autoId:    `os_garantia_${os.id}_${dGar}`,
                titulo:    `Garantia vence em ${dG} dia(s)`,
                descricao: `${etiq} — garantia expira em ${_fmtData(dGar)}.`,
                tipo: 'os', prioridade: 'media', link: linkOS, modulo: 'os',
            });
        }
    }
}

// ── Módulo: Clientes ─────────────────────────────────────────────────────────
async function _verificarClientes() {
    const h    = _hoje();
    const mmdd = h.slice(5); // MM-DD
    const lim30 = _diasAtras(30);

    let snap;
    try { snap = await getDocs(query(collection(db, 'clientes'), limit(500))); }
    catch (e) { console.warn('[AlertaAuto] Clientes:', e.message); return; }

    for (const d of snap.docs) {
        const c     = { id: d.id, ...d.data() };
        const nome  = c.nome || c.nomeCompleto || 'Cliente';
        const link  = `../../pages/clientes/index.html#cli-${c.id}`;
        const aniv  = c.aniversario || c.dataNascimento || '';

        // Aniversariante do dia (suporta YYYY-MM-DD e DD/MM/YYYY)
        if (aniv) {
            const anivNorm = aniv.includes('/') ? aniv.slice(3, 8).replace('/', '-') : aniv.slice(5);
            if (anivNorm === mmdd) {
                await _criarAuto({
                    autoId:    `aniversario_${c.id}_${h.slice(0, 7)}`,
                    titulo:    `🎂 Aniversário: ${nome}`,
                    descricao: `${nome} faz aniversário hoje! Envie uma mensagem de parabéns.`,
                    tipo: 'cliente', prioridade: 'media', link, modulo: 'clientes',
                });
            }
        }

        // Cliente sem contato há 30+ dias
        const ult = c.ultimoContato || c.dataUltimoAtendimento || c.ultimoAtendimento || '';
        if (ult && ult < lim30) {
            const dS = _diasDiff(ult);
            await _criarAuto({
                autoId:    `cliente_sem_contato_${c.id}`,
                titulo:    `Cliente sem contato: ${nome}`,
                descricao: `${nome} não tem registro de atendimento há ${dS} dias. Considere entrar em contato.`,
                tipo: 'cliente', prioridade: 'baixa', link, modulo: 'clientes',
            });
        }

        // Pós-venda programado (se tiver campo posVendaData)
        const pvData = c.posVendaData || c.proximoContato || '';
        if (pvData && pvData <= h) {
            await _criarAuto({
                autoId:    `posvenda_${c.id}_${pvData}`,
                titulo:    `Pós-venda pendente: ${nome}`,
                descricao: `${nome} — pós-venda programado para ${_fmtData(pvData)} não foi realizado.`,
                tipo: 'cliente', prioridade: 'media', link, modulo: 'clientes',
            });
        }
    }
}

// ── Módulo: Estoque ───────────────────────────────────────────────────────────
async function _verificarEstoque() {
    let snap;
    // Tenta as coleções mais comuns
    for (const colNome of ['estoque', 'produtos', 'produtos_estoque']) {
        try {
            snap = await getDocs(query(collection(db, colNome), limit(300)));
            if (snap && !snap.empty) break;
        } catch {}
    }
    if (!snap) return;

    for (const d of snap.docs) {
        const p    = { id: d.id, ...d.data() };
        const nome = p.nome || p.descricao || p.titulo || p.codigo || 'Produto';
        const qtd  = Number(p.quantidade ?? p.estoque ?? p.qtd ?? p.saldo ?? -1);
        const min  = Number(p.estoqueMinimo ?? p.minimo ?? p.qtdMinima ?? p.qtdMin ?? 1);
        const link = `../../pages/estoque/index.html#prod-${p.id}`;

        if (qtd < 0) continue;

        if (qtd === 0) {
            await _criarAuto({
                autoId:    `estoque_zerado_${p.id}`,
                titulo:    `Estoque zerado: ${nome}`,
                descricao: `${nome} está com estoque zerado. Faça a reposição urgente.`,
                tipo: 'estoque', prioridade: 'critica', link, modulo: 'estoque',
            });
        } else if (qtd <= min) {
            await _criarAuto({
                autoId:    `estoque_minimo_${p.id}`,
                titulo:    `Estoque mínimo atingido: ${nome}`,
                descricao: `${nome} — ${qtd} un. disponível(is), mínimo configurado: ${min} un.`,
                tipo: 'estoque', prioridade: 'alta', link, modulo: 'estoque',
            });
        }
    }
}

// ── Módulo: Financeiro ────────────────────────────────────────────────────────
async function _verificarFinanceiro() {
    const h  = _hoje();
    const h7 = _diasFre(7);
    const pagos = ['pago', 'paga', 'recebido', 'recebida', 'quitado', 'quitada', 'liquidado'];

    let snap;
    for (const colNome of ['caixa_lancamentos', 'lancamentos', 'contas_pagar', 'financeiro', 'contas']) {
        try {
            snap = await getDocs(query(collection(db, colNome), limit(300)));
            if (snap && !snap.empty) break;
        } catch {}
    }
    if (!snap) return;

    for (const d of snap.docs) {
        const c    = { id: d.id, ...d.data() };
        const desc = c.descricao || c.titulo || c.nome || 'Conta';
        const venc = c.dataVencimento || c.vencimento || c.data || '';
        const st   = (c.status || c.situacao || c.pago || '').toString().toLowerCase();
        const tipo = (c.tipo || c.natureza || c.categoria || '').toLowerCase();
        const linkF = `../../pages/financeiro/index.html`;

        // Ignora receitas e lançamentos já pagos
        if (!venc) continue;
        if (pagos.some(p => st.includes(p))) continue;
        if (tipo.includes('receita') || tipo.includes('entrada')) continue;

        const val = c.valor ? ` — R$ ${Number(c.valor).toFixed(2).replace('.', ',')}` : '';

        if (venc === h) {
            await _criarAuto({
                autoId:    `conta_hoje_${d.id}`,
                titulo:    `Conta vence HOJE: ${desc}`,
                descricao: `${desc}${val} vence hoje. Efetue o pagamento para evitar multas.`,
                tipo: 'financeiro', prioridade: 'critica', link: linkF, modulo: 'financeiro',
            });
        } else if (venc > h && venc <= h7) {
            const dF = _diasFuturo(venc);
            await _criarAuto({
                autoId:    `conta_avencer_${d.id}_${venc}`,
                titulo:    `Conta vence em ${dF} dia(s): ${desc}`,
                descricao: `${desc}${val} — vencimento em ${_fmtData(venc)}.`,
                tipo: 'financeiro', prioridade: 'alta', link: linkF, modulo: 'financeiro',
            });
        } else if (venc < h) {
            const dAt = _diasDiff(venc);
            await _criarAuto({
                autoId:    `conta_vencida_${d.id}`,
                titulo:    `Conta vencida há ${dAt} dia(s): ${desc}`,
                descricao: `${desc}${val} — venceu em ${_fmtData(venc)} e não foi paga.`,
                tipo: 'financeiro', prioridade: 'critica', link: linkF, modulo: 'financeiro',
            });
        }
    }
}

// ── Módulo: Agenda ────────────────────────────────────────────────────────────
async function _verificarAgenda() {
    const h    = _hoje();
    const h1   = _diasFre(1);
    const conc = ['concluido', 'concluída', 'cancelado', 'cancelada', 'realizado'];

    let snap;
    try {
        snap = await getDocs(query(
            collection(db, 'agenda'),
            where('data', '>=', _diasAtras(3)),
            where('data', '<=', h1),
            limit(100)
        ));
    } catch {
        // fallback: query sem filtros
        try { snap = await getDocs(query(collection(db, 'agenda'), limit(100))); }
        catch (e) { console.warn('[AlertaAuto] Agenda:', e.message); return; }
    }

    for (const d of snap.docs) {
        const ev   = { id: d.id, ...d.data() };
        const tit  = ev.titulo || ev.descricao || ev.assunto || 'Compromisso';
        const st   = (ev.status || '').toLowerCase();
        const linkA = `../../pages/agenda/index.html`;

        if (conc.some(s => st.includes(s))) continue;
        if (!ev.data || ev.data > h1) continue;

        if (ev.data === h) {
            await _criarAuto({
                autoId:    `agenda_hoje_${d.id}`,
                titulo:    `📅 Compromisso hoje: ${tit}`,
                descricao: `${tit}${ev.hora ? ' às ' + ev.hora : ''}${ev.local ? ' — ' + ev.local : ''}.`,
                tipo: 'agenda', prioridade: 'media', link: linkA, modulo: 'agenda',
            });
        } else if (ev.data < h) {
            const dV = _diasDiff(ev.data);
            await _criarAuto({
                autoId:    `agenda_vencida_${d.id}`,
                titulo:    `Compromisso vencido há ${dV} dia(s)`,
                descricao: `${tit} — marcado para ${_fmtData(ev.data)} não foi concluído.`,
                tipo: 'agenda', prioridade: 'alta', link: linkA, modulo: 'agenda',
            });
        }
    }
}

// ── Módulo: Metas ─────────────────────────────────────────────────────────────
async function _verificarMetas() {
    const mesAtual = _hoje().slice(0, 7);
    let snap;
    try { snap = await getDocs(query(collection(db, 'metas'), limit(50))); }
    catch (e) { console.warn('[AlertaAuto] Metas:', e.message); return; }

    for (const d of snap.docs) {
        const m      = { id: d.id, ...d.data() };
        const tit    = m.titulo || m.descricao || m.nome || 'Meta';
        const vMeta  = Number(m.valorMeta  || m.meta      || m.objetivo   || 0);
        const vAtual = Number(m.valorAtual || m.realizado || m.progresso  || 0);
        const per    = (m.periodo || m.mes || m.referencia || '').slice(0, 7);
        const linkM  = `../../pages/metas/index.html`;

        if (!vMeta || per !== mesAtual) continue;
        const pct = Math.round((vAtual / vMeta) * 100);

        if (pct >= 100) {
            await _criarAuto({
                autoId:    `meta_atingida_${d.id}_${mesAtual}`,
                titulo:    `🎯 Meta atingida: ${tit}`,
                descricao: `${tit} — ${pct}% da meta mensal atingida. Parabéns!`,
                tipo: 'meta', prioridade: 'baixa', link: linkM, modulo: 'metas',
            });
        } else if (pct < 50) {
            await _criarAuto({
                autoId:    `meta_critica_${d.id}_${mesAtual}`,
                titulo:    `Meta em risco: ${tit}`,
                descricao: `${tit} — apenas ${pct}% da meta atingida (R$ ${vAtual.toFixed(2).replace('.', ',')} de R$ ${vMeta.toFixed(2).replace('.', ',')}).`,
                tipo: 'meta', prioridade: pct < 25 ? 'critica' : 'alta', link: linkM, modulo: 'metas',
            });
        } else if (pct < 80) {
            await _criarAuto({
                autoId:    `meta_atencao_${d.id}_${mesAtual}`,
                titulo:    `Atenção: Meta em ${pct}% — ${tit}`,
                descricao: `${tit} — ${pct}% da meta mensal. Restam R$ ${(vMeta - vAtual).toFixed(2).replace('.', ',')} para atingir.`,
                tipo: 'meta', prioridade: 'media', link: linkM, modulo: 'metas',
            });
        }
    }
}

// ── Módulo: Sistema ────────────────────────────────────────────────────────────
async function _verificarSistema() {
    const h   = _hoje();
    const linkS = `../../pages/configuracoes/index.html`;

    // Verifica se há registro de último backup
    try {
        const snap = await getDocs(query(
            collection(db, 'sistema_logs'),
            where('tipo', '==', 'backup'),
            limit(1)
        ));
        if (!snap.empty) {
            const ultimo = snap.docs[0].data();
            const dU = ultimo.criadoEmISO || ultimo.data || '';
            if (dU && dU < _diasAtras(1)) {
                await _criarAuto({
                    autoId:    `sistema_backup_${h}`,
                    titulo:    `Backup não realizado`,
                    descricao: `Último backup registrado em ${_fmtData(dU.slice(0, 10))}. Considere fazer um backup manual.`,
                    tipo: 'lembrete', prioridade: 'media', link: linkS, modulo: 'sistema',
                });
            }
        }
    } catch {}
}

// ── Orquestrador principal ────────────────────────────────────────────────────
export async function verificarAlertasAuto(forcar = false) {
    const agora  = Date.now();
    const ultima = parseInt(localStorage.getItem(LS_KEY_VERIF) || '0');
    if (!forcar && agora - ultima < INTERVALO_MS) return;
    localStorage.setItem(LS_KEY_VERIF, String(agora));

    console.log('[AlertaAuto] Verificando alertas automáticos…');

    await Promise.allSettled([
        _verificarOS(),
        _verificarClientes(),
        _verificarEstoque(),
        _verificarFinanceiro(),
        _verificarAgenda(),
        _verificarMetas(),
        _verificarSistema(),
    ]);

    console.log('[AlertaAuto] Verificação concluída.');
}

// Chama também ao recarregar (forçado se passou da última verificação)
export function iniciarVerificacoesAuto() {
    verificarAlertasAuto(false);
    setInterval(() => verificarAlertasAuto(false), INTERVALO_MS);
}
