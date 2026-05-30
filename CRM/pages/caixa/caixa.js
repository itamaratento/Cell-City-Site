// ===== IMPORTS (Padrão OS) =====
import { 
    db, 
    collection, 
    doc, 
    setDoc, 
    addDoc,
    getDocs, 
    getDoc,
    updateDoc, 
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp 
} from "../../scripts/firebase.js";

// ═══════════════════════════════════════════
// 🎯 COLLECTIONS OFICIAIS
// ═══════════════════════════════════════════
const COLLECTION_LANCAMENTOS = "caixa_lancamentos";
const COLLECTION_CATEGORIAS = "categorias_caixa";

// ═══════════════════════════════════════════
// 📊 ARQUITETURA HISTÓRICA V19 (Enterprise)
// ═══════════════════════════════════════════
// 🔒 FECHADOS: Imutáveis, auditoria, BI
const COLLECTION_HISTORICO_DIARIO = "historico_diario";
const COLLECTION_HISTORICO_SEMANAL = "historico_semanal";
const COLLECTION_HISTORICO_MENSAL = "historico_mensal";

// 🔄 LIVE: Mutáveis, realtime, período em andamento
const COLLECTION_RESUMO_LIVE = "resumo_live";

// ═══════════════════════════════════════════
// 🏛️ CONSTANTES DE SISTEMA (V19)
// ═══════════════════════════════════════════
const SYSTEM_META = {
    SOURCE: "caixa_operacional",
    VERSION: "v19",
    CREATED_BY: "admin"
};

// 🎯 Schema version para compatibilidade futura
const SCHEMA_VERSION = 1;

// 🎯 Preparação para ecossistema (BI + IA)
const PREPARED_FOR = ["dashboard", "analytics", "ia"];

// 🌎 Timezone fixo (evita inconsistência temporal)
const TIMEZONE = "America/Sao_Paulo";

// 📦 Cache keys
const CACHE_KEYS = {
    ULTIMO_FECHAMENTO: 'caixa_ultimo_fechamento',
    ULTIMO_LIVE: 'caixa_ultimo_live'
};

// ═══════════════════════════════════════════
// 🔥 EXPOSIÇÃO GLOBAL
// ═══════════════════════════════════════════
window.selecionarTipo = selecionarTipo;
window.salvarLancamento = salvarLancamento;
window.adicionarNovaCategoria = adicionarNovaCategoria;
window.cancelarNovaCategoria = cancelarNovaCategoria;
window.executarSalvarCategoria = executarSalvarCategoria;
window.excluirLancamento = excluirLancamento;
window.editarLancamento = editarLancamento;
window.fecharModalEdicao = fecharModalEdicao;
window.salvarEdicao = salvarEdicao;
window.selecionarTipoEdicao = selecionarTipoEdicao;
window.pesquisarLancamentos = pesquisarLancamentos;
window.filtrarPorPeriodo = filtrarPorPeriodo;
window.calcularLucro = calcularLucro;
window.forcarFechamentoManual = forcarFechamentoManual;
window.forcarResumoLiveManual = forcarResumoLiveManual;

console.log('🔥 [CAIXA V19] Arquitetura Enterprise ativa.');
console.log('   🎯 Schema Version:', SCHEMA_VERSION);
console.log('   🌎 Timezone fixo:', TIMEZONE);
console.log('   🎯 Prepared for:', PREPARED_FOR.join(', '));
console.log('   🔒 Fechados: historico_diario | historico_semanal | historico_mensal');
console.log('   🔄 Live: resumo_live (dia_* | semana_* | mes_*)');

// ===== STATE =====
let lancamentos = [];
let categorias = [];
let tipoSelecionado = '';
let tipoSelecionadoEdicao = '';
let periodoFiltro = 'todos';
let termoPesquisa = '';
let listenerLancamentos = null;
let listenerCategorias = null;

// 🔒 LOCKS
let isFechamentoExecutando = false;
let isResumoLiveExecutando = false;
let ultimoResumoLiveExecutado = 0;

// ===== INICIALIZAÇÃO =====
async function init() {
    console.log('✅ Caixa V19 inicializado.');
    await carregarCategorias();
    iniciarListenerCategorias();
    iniciarListenerLancamentos();
    setTimeout(() => executarOrquestradorHistorico(), 2500);
}

// ═══════════════════════════════════════════════════════════════
// 📊 CAMADA HISTÓRICA V19 — ENTERPRISE GRADE
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════
// 🌎 UTILITÁRIOS TEMPORAIS (TIMEZONE FIXO)
// ═══════════════════════════════════════════
function getDataEmSP(date = new Date()) {
    // Retorna data em America/Sao_Paulo independente do timezone do servidor
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(date); // "YYYY-MM-DD"
}

function getHoraEmSP(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    return formatter.format(date); // "HH:MM:SS"
}

function getDiaSemanaEmSP(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        weekday: 'short'
    });
    const dayName = formatter.format(date);
    const map = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    return map[dayName];
}

function getDayKey(date = new Date()) {
    return getDataEmSP(date); // "YYYY-MM-DD" em SP
}

function getWeekKey(date = new Date()) {
    // ISO week em timezone SP
    const spDate = new Date(getDataEmSP(date) + 'T12:00:00');
    const d = new Date(Date.UTC(spDate.getFullYear(), spDate.getMonth(), spDate.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getMonthKey(date = new Date()) {
    const sp = getDataEmSP(date);
    return sp.substring(0, 7); // "YYYY-MM"
}

function getPartesDataSP(date = new Date()) {
    const sp = getDataEmSP(date);
    const [ano, mes, dia] = sp.split('-').map(Number);
    return { ano, mes, dia, diaSemana: getDiaSemanaEmSP(date), dataCompleta: sp };
}

// ═══════════════════════════════════════════
// 🔐 HASH DE SNAPSHOT (Auditoria)
// ═══════════════════════════════════════════
function gerarHashSnapshot(resumo) {
    // Formato legível para auditoria: E{entradas}-S{saidas}-L{lucro}-T{total}
    const E = (resumo.entradas || 0).toFixed(2);
    const S = (resumo.saidas || 0).toFixed(2);
    const L = (resumo.lucro || 0).toFixed(2);
    const T = resumo.totalLancamentos || 0;
    return `E${E}-S${S}-L${L}-T${T}`;
}

// ═══════════════════════════════════════════
// 🧮 CÁLCULO DE RESUMOS
// ═══════════════════════════════════════════
function calcularResumoPeriodo(lancamentosFiltrados) {
    const entradas = lancamentosFiltrados
        .filter(l => l.tipo === 'entrada')
        .reduce((sum, l) => sum + (l.valor || 0), 0);
    
    const saidas = lancamentosFiltrados
        .filter(l => l.tipo === 'saida')
        .reduce((sum, l) => sum + (l.valor || 0), 0);
    
    const servicos = lancamentosFiltrados
        .filter(l => l.tipo === 'servico')
        .reduce((sum, l) => sum + (l.valor || 0), 0);
    
    const lucro = lancamentosFiltrados.reduce((sum, l) => sum + (l.lucro || 0), 0);
    
    return {
        entradas,
        saidas,
        servicos,
        lucro,
        saldo: entradas - saidas,
        totalLancamentos: lancamentosFiltrados.length
    };
}

// ═══════════════════════════════════════════
// 🏛️ METADATA PADRÃO (injetada em todos os docs)
// ═══════════════════════════════════════════
function criarMetadataPadrao(tipo, createdFrom = "automatico") {
    return {
        schemaVersion: SCHEMA_VERSION,
        status: tipo, // "fechado" ou "live"
        createdFrom,
        preparedFor: PREPARED_FOR,
        source: SYSTEM_META.SOURCE,
        version: SYSTEM_META.VERSION,
        timezone: TIMEZONE
    };
}

// ═══════════════════════════════════════════
// 🔒 SNAPSHOTS FECHADOS (Imutáveis + Anti-Dup)
// ═══════════════════════════════════════════
async function verificarESalvarSnapshotFechado(collectionName, docId, dadosSnapshot, label, createdFrom = "automatico") {
    try {
        const ref = doc(db, collectionName, docId);
        const snap = await getDoc(ref);
        
        if (snap.exists()) {
            console.log(`ℹ️ [🔒 FECHADO] ${label} "${docId}" já existe. IGNORADO (imutável).`);
            console.log(`   📌 Hash existente: ${snap.data().snapshotHash || 'N/A'}`);
            return { status: 'ja_existe', docId, hashExistente: snap.data().snapshotHash };
        }
        
        const resumo = {
            entradas: dadosSnapshot.entradas,
            saidas: dadosSnapshot.saidas,
            lucro: dadosSnapshot.lucro,
            totalLancamentos: dadosSnapshot.totalLancamentos
        };
        const hash = gerarHashSnapshot(resumo);
        
        const docFinal = {
            ...dadosSnapshot,
            snapshotHash: hash,
            ...criarMetadataPadrao("fechado", createdFrom),
            criadoEm: serverTimestamp()
        };
        
        await setDoc(ref, docFinal);
        
        console.log(`✅ [🔒 FECHADO] ${label} "${docId}" CRIADO.`);
        console.log(`   🔐 Hash: ${hash}`);
        console.log(`   📌 Created from: ${createdFrom}`);
        console.log(`   🎯 Schema: v${SCHEMA_VERSION}`);
        console.log(`   📊 Totais:`, resumo);
        
        return { status: 'criado', docId, hash };
        
    } catch (error) {
        console.error(`❌ [🔒 FECHADO] Erro ao salvar ${label} "${docId}":`, error.code, error.message);
        return { status: 'erro', error: error.message };
    }
}

async function gerarFechamentoDiario(dataRef, createdFrom = "automatico") {
    const diaKey = getDayKey(dataRef);
    console.log(`📅 [🔒 DIÁRIO] Analisando: ${diaKey} (timezone: ${TIMEZONE})`);
    
    const lancamentosDoDia = lancamentos.filter(l => l.dia === diaKey);
    if (lancamentosDoDia.length === 0) {
        console.log(`ℹ️ [🔒 DIÁRIO] Sem lançamentos em ${diaKey}. Pulando.`);
        return { status: 'sem_lancamentos', diaKey };
    }
    
    const resumo = calcularResumoPeriodo(lancamentosDoDia);
    const partes = getPartesDataSP(dataRef);
    
    return await verificarESalvarSnapshotFechado(
        COLLECTION_HISTORICO_DIARIO, 
        diaKey, 
        {
            diaKey,
            ano: partes.ano,
            mes: partes.mes,
            dia: partes.dia,
            diaSemana: partes.diaSemana,
            ...resumo
        }, 
        'Diário',
        createdFrom
    );
}

async function gerarFechamentoSemanal(dataRef, createdFrom = "automatico") {
    const semanaKey = getWeekKey(dataRef);
    console.log(`📆 [🔒 SEMANAL] Analisando: ${semanaKey} (timezone: ${TIMEZONE})`);
    
    const lancamentosDaSemana = lancamentos.filter(l => {
        if (!l.dataISO) return false;
        return getWeekKey(new Date(l.dataISO)) === semanaKey;
    });
    
    if (lancamentosDaSemana.length === 0) {
        console.log(`ℹ️ [🔒 SEMANAL] Sem lançamentos na ${semanaKey}. Pulando.`);
        return { status: 'sem_lancamentos', semanaKey };
    }
    
    const resumo = calcularResumoPeriodo(lancamentosDaSemana);
    const [anoStr, semanaStr] = semanaKey.split('-W');
    
    return await verificarESalvarSnapshotFechado(
        COLLECTION_HISTORICO_SEMANAL, 
        semanaKey, 
        {
            semanaKey,
            ano: parseInt(anoStr),
            semana: parseInt(semanaStr),
            ...resumo
        }, 
        'Semanal',
        createdFrom
    );
}

async function gerarFechamentoMensal(dataRef, createdFrom = "automatico") {
    const mesKey = getMonthKey(dataRef);
    console.log(`🗓️ [🔒 MENSAL] Analisando: ${mesKey} (timezone: ${TIMEZONE})`);
    
    const lancamentosDoMes = lancamentos.filter(l => l.mes === mesKey);
    if (lancamentosDoMes.length === 0) {
        console.log(`ℹ️ [🔒 MENSAL] Sem lançamentos em ${mesKey}. Pulando.`);
        return { status: 'sem_lancamentos', mesKey };
    }
    
    const resumo = calcularResumoPeriodo(lancamentosDoMes);
    const [anoStr, mesStr] = mesKey.split('-');
    
    return await verificarESalvarSnapshotFechado(
        COLLECTION_HISTORICO_MENSAL, 
        mesKey, 
        {
            mesKey,
            ano: parseInt(anoStr),
            mes: parseInt(mesStr),
            ...resumo
        }, 
        'Mensal',
        createdFrom
    );
}

// ═══════════════════════════════════════════
// 🔄 RESUMOS LIVE (Mutáveis + Debounce)
// ═══════════════════════════════════════════
async function salvarResumoLive(docId, dados, label) {
    try {
        const ref = doc(db, COLLECTION_RESUMO_LIVE, docId);
        
        const resumo = {
            entradas: dados.entradas,
            saidas: dados.saidas,
            lucro: dados.lucro,
            totalLancamentos: dados.totalLancamentos
        };
        const hash = gerarHashSnapshot(resumo);
        
        const docFinal = {
            ...dados,
            snapshotHash: hash,
            ...criarMetadataPadrao("live", "automatico"),
            atualizadoEm: serverTimestamp()
        };
        
        await setDoc(ref, docFinal, { merge: true });
        
        console.log(`🔥 [🔄 LIVE] ${label} "${docId}" ATUALIZADO.`);
        console.log(`   🔐 Hash: ${hash}`);
        console.log(`   📊 Totais: E=${resumo.entradas.toFixed(2)} S=${resumo.saidas.toFixed(2)} L=${resumo.lucro.toFixed(2)} T=${resumo.totalLancamentos}`);
        
        return { status: 'atualizado', docId, hash };
        
    } catch (error) {
        console.error(`❌ [🔄 LIVE] Erro ao atualizar ${label} "${docId}":`, error.code, error.message);
        return { status: 'erro', error: error.message };
    }
}

async function atualizarResumosLive(createdFrom = "automatico") {
    // 🔒 DEBOUNCE: mínimo 2s entre execuções
    const agora = Date.now();
    if (agora - ultimoResumoLiveExecutado < 2000) {
        console.log(`⏸️ [🔄 LIVE] Debounce ativo (${((2000 - (agora - ultimoResumoLiveExecutado))/1000).toFixed(1)}s restante). Pulando.`);
        return;
    }
    
    // 🔒 LOCK
    if (isResumoLiveExecutando) {
        console.log('🔒 [🔄 LIVE] Lock ativo. Pulando (concorrência bloqueada).');
        return;
    }
    
    isResumoLiveExecutando = true;
    ultimoResumoLiveExecutado = agora;
    console.log('🔒 [🔄 LIVE] Lock ADQUIRIDO.');
    
    try {
        console.log('═══════════════════════════════════════');
        console.log(`🔥 [🔄 LIVE] Atualizando resumos (timezone: ${TIMEZONE})...`);
        console.log('═══════════════════════════════════════');
        
        if (lancamentos.length === 0) {
            console.log('ℹ️ [🔄 LIVE] Sem lançamentos. Pulando.');
            return;
        }
        
        const hoje = new Date();
        const partes = getPartesDataSP(hoje);
        let totalAtualizacoes = 0;
        
        // 🔥 HOJE
        const diaKey = getDayKey(hoje);
        const lancHoje = lancamentos.filter(l => l.dia === diaKey);
        if (lancHoje.length > 0) {
            const resumo = calcularResumoPeriodo(lancHoje);
            await salvarResumoLive(`dia_${diaKey}`, {
                tipo: 'diario',
                chave: diaKey,
                ano: partes.ano,
                mes: partes.mes,
                dia: partes.dia,
                diaSemana: partes.diaSemana,
                ...resumo
            }, 'Hoje');
            totalAtualizacoes++;
        }
        
        // 🔥 SEMANA ATUAL
        const semanaKey = getWeekKey(hoje);
        const lancSemana = lancamentos.filter(l => {
            if (!l.dataISO) return false;
            return getWeekKey(new Date(l.dataISO)) === semanaKey;
        });
        if (lancSemana.length > 0) {
            const resumo = calcularResumoPeriodo(lancSemana);
            const [anoStr, semanaStr] = semanaKey.split('-W');
            await salvarResumoLive(`semana_${semanaKey}`, {
                tipo: 'semanal',
                chave: semanaKey,
                ano: parseInt(anoStr),
                semana: parseInt(semanaStr),
                ...resumo
            }, 'Semana Atual');
            totalAtualizacoes++;
        }
        
        // 🔥 MÊS ATUAL
        const mesKey = getMonthKey(hoje);
        const lancMes = lancamentos.filter(l => l.mes === mesKey);
        if (lancMes.length > 0) {
            const resumo = calcularResumoPeriodo(lancMes);
            const [anoStr, mesStr] = mesKey.split('-');
            await salvarResumoLive(`mes_${mesKey}`, {
                tipo: 'mensal',
                chave: mesKey,
                ano: parseInt(anoStr),
                mes: parseInt(mesStr),
                ...resumo
            }, 'Mês Atual');
            totalAtualizacoes++;
        }
        
        localStorage.setItem(CACHE_KEYS.ULTIMO_LIVE, new Date().toISOString());
        
        console.log('═══════════════════════════════════════');
        console.log(`✅ [🔄 LIVE] ${totalAtualizacoes} resumo(s) atualizado(s).`);
        console.log('═══════════════════════════════════════');
        
    } finally {
        isResumoLiveExecutando = false;
        console.log('🔓 [🔄 LIVE] Lock LIBERADO.');
    }
}

// ═══════════════════════════════════════════
// 🔄 ORQUESTRADOR PRINCIPAL
// ═══════════════════════════════════════════
async function verificarFechamentosAutomaticos(createdFrom = "automatico") {
    // 🔒 LOCK
    if (isFechamentoExecutando) {
        console.log('🔒 [🔒 FECHADO] Lock ativo. Pulando (concorrência bloqueada).');
        return;
    }
    
    // 📦 CACHE (só para automático)
    if (createdFrom === "automatico") {
        const ultimoExec = localStorage.getItem(CACHE_KEYS.ULTIMO_FECHAMENTO);
        const hojeKey = getDayKey(new Date());
        if (ultimoExec && ultimoExec.startsWith(hojeKey)) {
            console.log(`📦 [🔒 FECHADO] Cache ativo: executado em ${ultimoExec}. Pulando.`);
            return;
        }
    }
    
    isFechamentoExecutando = true;
    console.log('🔒 [🔒 FECHADO] Lock ADQUIRIDO.');
    
    try {
        console.log('═══════════════════════════════════════');
        console.log(`🔒 [🔒 FECHADO] Iniciando fechamentos (timezone: ${TIMEZONE})...`);
        console.log(`   📌 Created from: ${createdFrom}`);
        console.log('═══════════════════════════════════════');
        
        if (lancamentos.length === 0) {
            console.log('ℹ️ [🔒 FECHADO] Sem lançamentos. Nada a fechar.');
            return;
        }
        
        const hoje = new Date();
        const partes = getPartesDataSP(hoje);
        const resultados = [];
        
        // ✅ 1. DIA ANTERIOR (sempre)
        const ontem = new Date(hoje);
        ontem.setDate(ontem.getDate() - 1);
        resultados.push(await gerarFechamentoDiario(ontem, createdFrom));
        
        // ✅ 2. Se segunda-feira → SEMANA ANTERIOR
        if (partes.diaSemana === 1) {
            console.log('📅 Hoje é segunda-feira → fechando semana anterior');
            const semanaPassada = new Date(hoje);
            semanaPassada.setDate(semanaPassada.getDate() - 7);
            resultados.push(await gerarFechamentoSemanal(semanaPassada, createdFrom));
        } else {
            const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
            console.log(`ℹ️ Hoje é ${dias[partes.diaSemana]} → semana anterior não será fechada`);
        }
        
        // ✅ 3. Se dia 1º → MÊS ANTERIOR
        if (partes.dia === 1) {
            console.log('📅 Hoje é dia 1º → fechando mês anterior');
            const mesPassado = new Date(hoje);
            mesPassado.setMonth(mesPassado.getMonth() - 1);
            resultados.push(await gerarFechamentoMensal(mesPassado, createdFrom));
        } else {
            console.log(`ℹ️ Hoje é dia ${partes.dia} → mês anterior não será fechado`);
        }
        
        // 📦 Salvar cache (só se automático)
        if (createdFrom === "automatico") {
            const agoraISO = new Date().toISOString();
            localStorage.setItem(CACHE_KEYS.ULTIMO_FECHAMENTO, agoraISO);
            console.log(`   📦 Cache salvo: ${agoraISO}`);
        }
        
        console.log('═══════════════════════════════════════');
        console.log('✅ [🔒 FECHADO] Verificação concluída.');
        console.log('   Resultados:', resultados.map(r => r.status).join(' | '));
        console.log('═══════════════════════════════════════');
        
    } finally {
        isFechamentoExecutando = false;
        console.log('🔓 [🔒 FECHADO] Lock LIBERADO.');
    }
}

async function executarOrquestradorHistorico() {
    console.log('🎯 [ORQUESTRADOR V19] Iniciando camada histórica enterprise...');
    await verificarFechamentosAutomaticos("automatico");
    await atualizarResumosLive("automatico");
    console.log('🎯 [ORQUESTRADOR V19] Camada histórica inicializada.');
}

// 🔥 DEBUG MANUAL (exposto no window)
async function forcarFechamentoManual() {
    console.warn('⚠️ [MANUAL] Forçando fechamento (ignora cache, createdFrom=manual)...');
    localStorage.removeItem(CACHE_KEYS.ULTIMO_FECHAMENTO);
    await verificarFechamentosAutomaticos("manual");
}

async function forcarResumoLiveManual() {
    console.warn('⚠️ [MANUAL] Forçando resumo live (ignora debounce)...');
    ultimoResumoLiveExecutado = 0;
    await atualizarResumosLive("manual");
}

// ═══════════════════════════════════════════════════════════════
// 💼 LÓGICA OPERACIONAL (CRUD - MANTIDA IGUAL)
// ═══════════════════════════════════════════════════════════════

async function carregarCategorias() {
    try {
        const snap = await getDocs(collection(db, COLLECTION_CATEGORIAS));
        categorias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        if (categorias.length === 0) {
            const padrao = [
                { nome: 'Vendas', tipoPadrao: 'entrada' },
                { nome: 'Serviços', tipoPadrao: 'servico' },
                { nome: 'Fornecedores', tipoPadrao: 'saida' },
                { nome: 'Despesas', tipoPadrao: 'saida' },
                { nome: 'Marketing', tipoPadrao: 'saida' }
            ];
            
            for (const cat of padrao) {
                const agora = new Date();
                await setDoc(doc(db, COLLECTION_CATEGORIAS, cat.nome), { 
                    nome: cat.nome, tipoPadrao: cat.tipoPadrao, status: "ativo",
                    source: SYSTEM_META.SOURCE, version: SYSTEM_META.VERSION,
                    createdBy: SYSTEM_META.CREATED_BY,
                    createdAt: serverTimestamp(), createdAtISO: agora.toISOString(),
                    updatedAt: serverTimestamp(), updatedAtISO: agora.toISOString()
                });
            }
            categorias = padrao.map(c => ({ id: c.nome, ...c, status: "ativo" }));
        }
        
        atualizarSelectCategorias();
        atualizarSelectCategoriasEdicao();
    } catch (error) {
        console.error('❌ Erro ao carregar categorias:', error);
        showToast('❌ Erro ao carregar categorias');
    }
}

function iniciarListenerCategorias() {
    if (listenerCategorias) listenerCategorias();
    listenerCategorias = onSnapshot(
        collection(db, COLLECTION_CATEGORIAS),
        (snap) => {
            categorias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            atualizarSelectCategorias();
            atualizarSelectCategoriasEdicao();
        },
        (error) => console.error('❌ Erro no listener de categorias:', error)
    );
}

function atualizarSelectCategorias() {
    const select = document.getElementById('categoria');
    if (!select) return;
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione...</option>' +
        categorias.filter(c => c.status === 'ativo' || !c.status)
            .map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
    if (valorAtual && categorias.find(c => c.nome === valorAtual)) select.value = valorAtual;
}

function atualizarSelectCategoriasEdicao() {
    const select = document.getElementById('editCategoria');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione...</option>' +
        categorias.filter(c => c.status === 'ativo' || !c.status)
            .map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
}

// ═══════════════════════════════════════════
// NOVA CATEGORIA
// ═══════════════════════════════════════════
function adicionarNovaCategoria() {
    const existingForm = document.getElementById('nova-categoria-form');
    if (existingForm) { existingForm.querySelector('#nova-categoria-input')?.focus(); return; }
    
    const formSection = document.querySelector('.secao-lancamento .form-section');
    if (!formSection) return alert('❌ Formulário não encontrado');
    
    const labels = formSection.querySelectorAll('label');
    let categoriaGroup = null;
    for (const label of labels) {
        if (label.textContent.includes('Categoria')) { categoriaGroup = label.closest('.form-group'); break; }
    }
    if (!categoriaGroup) return alert('❌ Campo de categoria não encontrado');
    
    const formHTML = `
        <div id="nova-categoria-form" style="margin-top:12px;padding:14px;background:rgba(0,200,83,0.08);border:1px solid var(--green-primary);border-radius:10px;">
            <label style="display:block;font-size:12px;font-weight:700;color:#00E676;margin-bottom:8px;">➕ Nova Categoria</label>
            <input type="text" id="nova-categoria-input" placeholder="Ex: ÁGUA, LUZ..." autocomplete="off"
                onkeypress="if(event.key==='Enter'){event.preventDefault();window.executarSalvarCategoria();}"
                style="width:100%;padding:12px;background:#1c1f1d;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;font-size:14px;margin-bottom:10px;outline:none;">
            <div style="display:flex;gap:8px;">
                <button type="button" onclick="window.executarSalvarCategoria()" style="flex:1;padding:11px;background:#00C853;color:#000;border:none;border-radius:8px;font-weight:800;cursor:pointer;font-size:13px;">💾 Salvar</button>
                <button type="button" onclick="window.cancelarNovaCategoria()" style="padding:11px 18px;background:#1c1f1d;color:#d1d5db;border:1px solid rgba(255,255,255,0.1);border-radius:8px;cursor:pointer;font-size:13px;">✕</button>
            </div>
        </div>`;
    
    categoriaGroup.insertAdjacentHTML('afterend', formHTML);
    setTimeout(() => document.getElementById('nova-categoria-input')?.focus(), 100);
}

function cancelarNovaCategoria() {
    const form = document.getElementById('nova-categoria-form');
    if (form) { form.style.opacity = '0'; form.style.transform = 'translateY(-10px)'; form.style.transition = 'all 0.2s ease'; setTimeout(() => form.remove(), 200); }
}

async function executarSalvarCategoria() {
    try {
        const input = document.getElementById("nova-categoria-input");
        if (!input) return alert("Input não encontrado");
        const nome = input.value.trim().toUpperCase();
        if (!nome) { alert("Digite a categoria"); input.focus(); return; }
        if (!db) return alert("Firebase não carregado");
        const id = nome.replace(/[\/.#\[\]]/g, "").replace(/\s+/g, "_");
        const existe = categorias.find(c => c.id === id || c.nome === nome || (c.nome && c.nome.toUpperCase() === nome));
        if (existe) { alert(`Categoria "${nome}" já existe`); input.value = ''; input.focus(); return; }
        
        const agora = new Date();
        const dadosCategoria = {
            nome, status: "ativo", tipoPadrao: "entrada",
            source: SYSTEM_META.SOURCE, version: SYSTEM_META.VERSION, createdBy: SYSTEM_META.CREATED_BY,
            createdAtISO: agora.toISOString(), updatedAtISO: agora.toISOString(),
            createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        };
        
        let docRef;
        try { docRef = doc(db, "categorias_caixa", id); await setDoc(docRef, dadosCategoria); }
        catch { docRef = await addDoc(collection(db, "categorias_caixa"), dadosCategoria); }
        
        await carregarCategorias();
        const select = document.getElementById("categoria");
        if (select) select.value = nome;
        cancelarNovaCategoria();
        alert(`✅ Categoria "${nome}" criada com sucesso!`);
    } catch (error) {
        console.error("❌ Erro ao salvar categoria:", error);
        alert("Erro ao salvar categoria:\n\n" + error.message);
    }
}

// ═══════════════════════════════════════════
// TIPO / CÁLCULO / VALIDAÇÕES
// ═══════════════════════════════════════════
function selecionarTipo(tipo) {
    tipoSelecionado = tipo;
    document.querySelectorAll('#screen-main .tipo-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`#screen-main [data-tipo="${tipo}"]`)?.classList.add('selected');
    if (tipo === 'servico') {
        const cat = categorias.find(c => c.tipoPadrao === 'servico');
        if (cat) { const s = document.getElementById('categoria'); if (s) s.value = cat.nome; }
    }
}

function selecionarTipoEdicao(tipo) {
    tipoSelecionadoEdicao = tipo;
    document.querySelectorAll('#modalEdicao .tipo-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`#modalEdicao [data-tipo="${tipo}"]`)?.classList.add('selected');
    calcularLucroEdicao();
}

function calcularLucro() {
    const v = parseFloat(document.getElementById('valor')?.value || 0);
    const c = parseFloat(document.getElementById('custo')?.value || 0);
    const l = v - c;
    const li = document.getElementById('lucroAuto');
    const ap = document.getElementById('alertaPrejuizo');
    if (li) li.value = l >= 0 ? `R$ ${l.toFixed(2)}` : `- R$ ${Math.abs(l).toFixed(2)}`;
    if (ap) ap.style.display = l < 0 ? 'block' : 'none';
}

function calcularLucroEdicao() {
    const v = parseFloat(document.getElementById('editValor')?.value || 0);
    const c = parseFloat(document.getElementById('editCusto')?.value || 0);
    const l = v - c;
    const li = document.getElementById('editLucroAuto');
    if (li) li.value = l >= 0 ? `R$ ${l.toFixed(2)}` : `- R$ ${Math.abs(l).toFixed(2)}`;
}

function validarLancamento(d) {
    if (!d.tipo) return "Selecione o tipo";
    if (!d.descricao?.trim()) return "Descrição obrigatória";
    if (!d.categoria) return "Categoria obrigatória";
    if (!d.valor || d.valor <= 0) return "Valor inválido";
    return null;
}

function criarEstruturaTemporal() {
    const a = new Date();
    const partes = getPartesDataSP(a);
    return {
        dataISO: a.toISOString(), 
        dia: partes.dataCompleta,
        mes: getMonthKey(a),
        ano: partes.ano, 
        semana: getNumeroSemana(a),
        horario: getHoraEmSP(a),
        diaSemana: partes.diaSemana, 
        diaMes: partes.dia, 
        mesNumero: partes.mes,
        timezone: TIMEZONE
    };
}

function getNumeroSemana(data) {
    const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
    const dn = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dn);
    const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - ys) / 86400000) + 1) / 7);
}

// ═══════════════════════════════════════════
// SALVAR LANÇAMENTO
// ═══════════════════════════════════════════
async function salvarLancamento() {
    const valor = parseFloat(document.getElementById('valor')?.value || 0);
    const custo = parseFloat(document.getElementById('custo')?.value || 0);
    const lucro = valor - custo;
    const t = criarEstruturaTemporal();
    
    const dados = {
        tipo: tipoSelecionado, descricao: document.getElementById('descricao')?.value.trim() || '',
        categoria: document.getElementById('categoria')?.value || '',
        valor, custo, lucro, status: "ativo",
        source: SYSTEM_META.SOURCE, version: SYSTEM_META.VERSION, createdBy: SYSTEM_META.CREATED_BY,
        createdAt: serverTimestamp(), createdAtISO: t.dataISO,
        updatedAt: serverTimestamp(), updatedAtISO: t.dataISO,
        dataISO: t.dataISO, dia: t.dia, mes: t.mes, ano: t.ano,
        semana: t.semana, horario: t.horario,
        diaSemana: t.diaSemana, diaMes: t.diaMes, mesNumero: t.mesNumero,
        timezone: t.timezone,
        editHistory: [], editCount: 0
    };
    
    const erro = validarLancamento(dados);
    if (erro) return showToast(`⚠️ ${erro}`);
    
    try {
        const docRef = doc(collection(db, COLLECTION_LANCAMENTOS));
        await setDoc(docRef, { ...dados, id: docRef.id });
        showToast('✅ Lançamento salvo com sucesso');
        document.getElementById('descricao').value = '';
        document.getElementById('valor').value = '';
        document.getElementById('custo').value = '';
        document.getElementById('lucroAuto').value = '';
        document.getElementById('alertaPrejuizo').style.display = 'none';
        tipoSelecionado = '';
        document.querySelectorAll('#screen-main .tipo-btn').forEach(btn => btn.classList.remove('selected'));
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        showToast('❌ Erro ao salvar lançamento');
    }
}

// ═══════════════════════════════════════════
// REALTIME LISTENER
// ═══════════════════════════════════════════
function iniciarListenerLancamentos() {
    if (listenerLancamentos) { listenerLancamentos(); listenerLancamentos = null; }
    
    const q = query(collection(db, COLLECTION_LANCAMENTOS), orderBy("dataISO", "desc"));
    
    listenerLancamentos = onSnapshot(q, (snap) => {
        lancamentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        atualizarInterface();
        atualizarResumosLive("automatico");
    }, (error) => console.error('❌ Erro no listener:', error));
}

// ═══════════════════════════════════════════
// FILTROS / PESQUISA
// ═══════════════════════════════════════════
function filtrarPorPeriodo(periodo) {
    periodoFiltro = periodo;
    document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-periodo="${periodo}"]`)?.classList.add('active');
    atualizarInterface();
}

function aplicarFiltros(lista) {
    let f = lista;
    const hoje = new Date();
    const hojeSP = getDataEmSP(hoje);
    const h = new Date(hojeSP + 'T00:00:00');
    const is = new Date(h); is.setDate(h.getDate() - h.getDay());
    const im = new Date(hojeSP.substring(0, 7) + '-01T00:00:00');
    if (periodoFiltro === 'hoje') f = f.filter(l => l.dia === hojeSP);
    else if (periodoFiltro === 'semana') f = f.filter(l => new Date(l.dataISO) >= is);
    else if (periodoFiltro === 'mes') f = f.filter(l => l.mes === getMonthKey(hoje));
    return f;
}

function pesquisarLancamentos() {
    termoPesquisa = document.getElementById('searchInput')?.value || '';
    const sr = document.getElementById('resultados-pesquisa');
    const sn = document.querySelectorAll('.secao-normal');
    if (termoPesquisa.trim()) {
        if (sr) sr.style.display = 'block';
        sn.forEach(s => s.style.display = 'none');
        renderizarResultadosPesquisa();
    } else {
        if (sr) sr.style.display = 'none';
        sn.forEach(s => s.style.display = 'block');
        atualizarInterface();
    }
}

function renderizarResultadosPesquisa() {
    const t = termoPesquisa.toLowerCase();
    const r = lancamentos.filter(l =>
        l.descricao?.toLowerCase().includes(t) || l.categoria?.toLowerCase().includes(t) ||
        l.valor?.toString().includes(t) || l.tipo?.toLowerCase().includes(t) || l.dia?.includes(t)
    );
    const e = r.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
    const sa = r.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0);
    const elE = document.getElementById('total-pesquisa-entradas');
    const elS = document.getElementById('total-pesquisa-saidas');
    const elSa = document.getElementById('total-pesquisa-saldo');
    const elC = document.getElementById('contador-resultados');
    if (elE) elE.textContent = formatarMoeda(e);
    if (elS) elS.textContent = formatarMoeda(sa);
    if (elSa) elSa.textContent = formatarMoeda(e - sa);
    if (elC) elC.textContent = r.length;
    const c = document.getElementById('lista-resultados-pesquisa');
    if (!c) return;
    if (r.length === 0) { c.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><p>Nenhum resultado</p></div>`; return; }
    c.innerHTML = r.map(l => renderizarCardMovimentacao(l)).join('');
}

// ═══════════════════════════════════════════
// ATUALIZAR INTERFACE
// ═══════════════════════════════════════════
function atualizarInterface() {
    if (termoPesquisa.trim()) return;
    const f = aplicarFiltros(lancamentos);
    const e = f.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
    const sa = f.filter(l => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0);
    const lu = f.reduce((s, l) => s + (l.lucro || 0), 0);
    const elSaldo = document.getElementById('saldoGeral');
    const elE = document.getElementById('totalEntradas');
    const elS = document.getElementById('totalSaidas');
    const elL = document.getElementById('totalLucro');
    const elC = document.getElementById('contadorLancamentos');
    if (elSaldo) elSaldo.textContent = formatarMoeda(e - sa);
    if (elE) elE.textContent = formatarMoeda(e);
    if (elS) elS.textContent = formatarMoeda(sa);
    if (elL) elL.textContent = formatarMoeda(lu);
    if (elC) elC.textContent = f.length;
    renderizarLista(f);
}

function renderizarCardMovimentacao(l) {
    const vc = l.tipo === 'entrada' ? 'valor-entrada' : l.tipo === 'saida' ? 'valor-saida' : 'valor-servico';
    const tc = `tag-${l.tipo}`;
    const ue = l.editHistory?.length > 0 ? l.editHistory[l.editHistory.length - 1] : null;
    return `
        <div class="movimentacao-card">
            <div class="movimentacao-header">
                <div class="movimentacao-descricao">${l.descricao}</div>
                <div class="movimentacao-valor ${vc}">${l.tipo === 'saida' ? '-' : '+'} ${formatarMoeda(l.valor)}</div>
            </div>
            <div class="movimentacao-info">
                <span class="tag ${tc}">${l.tipo}</span>
                <span class="tag tag-categoria">${l.categoria}</span>
                ${l.lucro !== undefined ? `<span class="tag" style="background:rgba(33,150,243,0.15);color:#60a5fa;">Lucro: ${formatarMoeda(l.lucro)}</span>` : ''}
                <div class="movimentacao-acoes">
                    <button class="btn-acao btn-editar" onclick="editarLancamento('${l.id}')" title="Editar">✏️</button>
                    <button class="btn-acao btn-excluir" onclick="excluirLancamento('${l.id}')" title="Excluir">🗑️</button>
                </div>
            </div>
            <div class="movimentacao-historico">
                <div class="historico-item">📅 Criado: ${formatarData(l.dataISO)}</div>
                ${ue ? `<div class="historico-item">✏️ Editado ${l.editCount || l.editHistory.length}x: ${formatarData(ue.editedAtISO || ue.editedAt)}</div>` : ''}
            </div>
        </div>`;
}

function renderizarLista(lista) {
    const c = document.getElementById('listaMovimentacoes');
    if (!c) return;
    if (lista.length === 0) { c.innerHTML = `<div class="empty-state"><div class="icon">📊</div><p>Nenhum lançamento encontrado</p></div>`; return; }
    c.innerHTML = lista.map(l => renderizarCardMovimentacao(l)).join('');
}

// ═══════════════════════════════════════════
// EXCLUSÃO REAL
// ═══════════════════════════════════════════
async function excluirLancamento(id) {
    if (!confirm('Deseja realmente excluir este lançamento?\n\nEsta ação é PERMANENTE.')) return;
    try {
        await deleteDoc(doc(db, COLLECTION_LANCAMENTOS, id));
        showToast('🗑️ Lançamento excluído permanentemente');
    } catch (error) {
        console.error('❌ Erro ao excluir:', error);
        showToast('❌ Erro ao excluir: ' + error.message);
    }
}

// ═══════════════════════════════════════════
// EDIÇÃO
// ═══════════════════════════════════════════
function editarLancamento(id) {
    const l = lancamentos.find(x => x.id === id);
    if (!l) return showToast('❌ Lançamento não encontrado');
    document.getElementById('editId').value = id;
    document.getElementById('editDescricao').value = l.descricao || '';
    document.getElementById('editCategoria').value = l.categoria || '';
    document.getElementById('editValor').value = l.valor || 0;
    document.getElementById('editCusto').value = l.custo || 0;
    tipoSelecionadoEdicao = l.tipo;
    document.querySelectorAll('#modalEdicao .tipo-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`#modalEdicao [data-tipo="${l.tipo}"]`)?.classList.add('selected');
    calcularLucroEdicao();
    const hd = document.getElementById('editHistorico');
    if (l.editHistory && l.editHistory.length > 0) {
        hd.innerHTML = `<div class="edit-historico-title">📜 Histórico (${l.editHistory.length})</div>` +
            l.editHistory.slice().reverse().map(h => `
                <div class="edit-historico-item">
                    <div class="edit-historico-data">${formatarData(h.editedAtISO || h.editedAt)}</div>
                    <div style="font-size:11px;color:var(--text2);margin-top:4px;">${renderizarMudancas(h)}</div>
                </div>`).join('');
    } else { hd.innerHTML = '<div class="edit-historico-title">📜 Nenhuma edição anterior</div>'; }
    document.getElementById('modalEdicao').classList.add('active');
}

function renderizarMudancas(h) {
    if (h.changes && !h.oldData) return `<span style="color:var(--text3);">${h.changes}</span>`;
    if (!h.oldData || !h.newData) return '';
    const campos = ['tipo','descricao','categoria','valor','custo'];
    const labels = {tipo:'Tipo',descricao:'Descrição',categoria:'Categoria',valor:'Valor',custo:'Custo'};
    return campos.filter(c => h.oldData[c] !== h.newData[c]).map(c => {
        const o = c==='valor'||c==='custo' ? formatarMoeda(h.oldData[c]) : h.oldData[c];
        const n = c==='valor'||c==='custo' ? formatarMoeda(h.newData[c]) : h.newData[c];
        return `<div><strong>${labels[c]}:</strong> <span style="color:var(--red);">${o}</span> → <span style="color:var(--green-light);">${n}</span></div>`;
    }).join('');
}

function fecharModalEdicao() { document.getElementById('modalEdicao').classList.remove('active'); }

async function salvarEdicao() {
    const id = document.getElementById('editId').value;
    const orig = lancamentos.find(l => l.id === id);
    if (!orig) return showToast('❌ Lançamento não encontrado');
    const nv = parseFloat(document.getElementById('editValor').value || 0);
    const nc = parseFloat(document.getElementById('editCusto').value || 0);
    const dados = { tipo: tipoSelecionadoEdicao, descricao: document.getElementById('editDescricao').value.trim(),
        categoria: document.getElementById('editCategoria').value, valor: nv, custo: nc, lucro: nv - nc };
    const erro = validarLancamento(dados);
    if (erro) return showToast(`⚠️ ${erro}`);
    const oldData = { tipo: orig.tipo, descricao: orig.descricao, categoria: orig.categoria, valor: orig.valor, custo: orig.custo, lucro: orig.lucro };
    const newData = { ...dados };
    const campos = ['tipo','descricao','categoria','valor','custo'];
    if (!campos.some(c => oldData[c] !== newData[c])) { showToast('ℹ️ Nenhuma alteração'); fecharModalEdicao(); return; }
    const ts = new Date().toISOString();
    const eh = orig.editHistory || [];
    eh.push({ editedAt: ts, editedAtISO: ts, editedBy: SYSTEM_META.CREATED_BY, oldData, newData });
    try {
        await updateDoc(doc(db, COLLECTION_LANCAMENTOS, id), {
            ...dados, status: "editado", editHistory: eh,
            editCount: (orig.editCount || 0) + 1,
            updatedAt: serverTimestamp(), updatedAtISO: ts
        });
        showToast('✅ Lançamento atualizado com sucesso');
        fecharModalEdicao();
    } catch (error) {
        console.error('❌ Erro ao atualizar:', error);
        showToast('❌ Erro ao atualizar: ' + error.message);
    }
}

// ═══════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════
function formatarMoeda(v) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0); }
function formatarData(iso) { if(!iso) return ''; return new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }
function showToast(msg) { const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500); }

// ═══════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════
document.getElementById('editValor')?.addEventListener('input', calcularLucroEdicao);
document.getElementById('editCusto')?.addEventListener('input', calcularLucroEdicao);
document.getElementById('modalEdicao')?.addEventListener('click', (e) => { if(e.target.id==='modalEdicao') fecharModalEdicao(); });

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
window.addEventListener('beforeunload', () => { if(listenerLancamentos) listenerLancamentos(); if(listenerCategorias) listenerCategorias(); });

// ═══════════════════════════════════════════
// ⚠️ LEMBRETES DE PAGAMENTO
// ═══════════════════════════════════════════
window.toggleLembretes    = toggleLembretes;
window.toggleFormLembrete = toggleFormLembrete;
window.salvarLembrete     = salvarLembrete;
window.removerLembrete    = removerLembrete;
window.pagarLembrete      = pagarLembrete;

const COLL_LEMBRETES = 'lembretes_pagamento';
let lembretes = [];
let lembretesPanelAberto = false;
let lembreteFormAberto = false;

function toggleLembretes() {
    lembretesPanelAberto = !lembretesPanelAberto;
    const panel   = document.getElementById('lembretes-panel');
    const chevron = document.getElementById('lembretes-chevron');
    if (panel)   panel.style.display   = lembretesPanelAberto ? 'block' : 'none';
    if (chevron) chevron.textContent   = lembretesPanelAberto ? '▲' : '▼';
    if (lembretesPanelAberto) carregarLembretes();
}

function toggleFormLembrete(show) {
    lembreteFormAberto = show;
    const form = document.getElementById('lembretes-form');
    const btn  = document.getElementById('btn-novo-lem');
    if (form) form.style.display = show ? 'block' : 'none';
    if (btn)  btn.style.display  = show ? 'none'  : 'block';
    if (!show) limparFormLembrete();
}

function limparFormLembrete() {
    ['lem-fornecedor','lem-descricao','lem-quantidade','lem-valor','lem-vencimento','lem-observacao']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

async function carregarLembretes() {
    try {
        const snap = await getDocs(query(collection(db, COLL_LEMBRETES), orderBy('createdAt', 'asc')));
        lembretes = [];
        snap.forEach(d => lembretes.push({ id: d.id, ...d.data() }));
    } catch {
        lembretes = JSON.parse(localStorage.getItem('cc_lembretes') || '[]');
    }
    renderLembretes();
}

async function salvarLembrete() {
    const fornecedor = document.getElementById('lem-fornecedor')?.value.trim();
    const descricao  = document.getElementById('lem-descricao')?.value.trim();
    const valor      = parseFloat(document.getElementById('lem-valor')?.value || 0);
    const quantidade = parseInt(document.getElementById('lem-quantidade')?.value || 1);
    if (!fornecedor || !descricao || !valor) return showToast('⚠️ Preencha Fornecedor, Descrição e Valor');
    const dados = {
        fornecedor, descricao, valor, quantidade,
        vencimento:  document.getElementById('lem-vencimento')?.value  || '',
        observacao:  document.getElementById('lem-observacao')?.value.trim()  || '',
        createdAt: serverTimestamp(),
        createdAtISO: new Date().toISOString()
    };
    try {
        const ref = doc(collection(db, COLL_LEMBRETES));
        await setDoc(ref, { ...dados, id: ref.id });
        showToast('✅ Lembrete salvo!');
    } catch {
        dados.id = Date.now().toString();
        lembretes.push(dados);
        localStorage.setItem('cc_lembretes', JSON.stringify(lembretes));
        showToast('✅ Lembrete salvo localmente');
    }
    toggleFormLembrete(false);
    await carregarLembretes();
}

async function removerLembrete(id) {
    if (!confirm('Remover este lembrete sem pagar?')) return;
    try {
        await deleteDoc(doc(db, COLL_LEMBRETES, id));
    } catch {
        lembretes = lembretes.filter(l => l.id !== id);
        localStorage.setItem('cc_lembretes', JSON.stringify(lembretes));
    }
    await carregarLembretes();
    showToast('🗑️ Lembrete removido');
}

async function pagarLembrete(id, fornecedor, descricao, valor) {
    if (!confirm(`Confirmar pagamento de ${formatarMoeda(valor)} para ${fornecedor}?\n\nIsso vai registrar uma SAÍDA no caixa.`)) return;
    const t = criarEstruturaTemporal();
    const dados = {
        tipo: 'saida',
        descricao: `${fornecedor} — ${descricao}`,
        categoria: 'Fornecedor',
        valor, custo: 0, lucro: -valor,
        status: 'ativo',
        source: SYSTEM_META.SOURCE, version: SYSTEM_META.VERSION, createdBy: SYSTEM_META.CREATED_BY,
        createdAt: serverTimestamp(), createdAtISO: t.dataISO,
        updatedAt: serverTimestamp(), updatedAtISO: t.dataISO,
        dataISO: t.dataISO, dia: t.dia, mes: t.mes, ano: t.ano,
        semana: t.semana, horario: t.horario,
        diaSemana: t.diaSemana, diaMes: t.diaMes, mesNumero: t.mesNumero,
        timezone: t.timezone, editHistory: [], editCount: 0
    };
    try {
        const ref = doc(collection(db, COLLECTION_LANCAMENTOS));
        await setDoc(ref, { ...dados, id: ref.id });
        await deleteDoc(doc(db, COLL_LEMBRETES, id));
        showToast('✅ Pagamento registrado no caixa!');
        await carregarLembretes();
    } catch (err) {
        console.error('❌ Erro ao pagar lembrete:', err);
        showToast('❌ Erro ao registrar. Tente novamente.');
    }
}

function renderLembretes() {
    const lista = document.getElementById('lembretes-lista');
    const badge = document.getElementById('lembretes-badge');
    if (!lista) return;
    if (badge) {
        badge.textContent    = lembretes.length;
        badge.style.display  = lembretes.length > 0 ? 'inline-flex' : 'none';
    }
    if (!lembretes.length) {
        lista.innerHTML = `<div class="lem-empty">Nenhum lembrete pendente</div>`;
        return;
    }
    lista.innerHTML = lembretes.map(l => {
        const qtd   = l.quantidade && l.quantidade > 1 ? l.quantidade : 1;
        const total = l.valor * qtd;
        const venc  = l.vencimento ? `<span class="lem-venc">📅 ${new Date(l.vencimento+'T12:00:00').toLocaleDateString('pt-BR')}</span>` : '';
        const obs   = l.observacao ? `<div class="lem-obs">${l.observacao}</div>` : '';
        const qtdLabel = qtd > 1 ? `<span class="lem-qtd">${qtd}x ${formatarMoeda(l.valor)}</span>` : '';
        return `
        <div class="lem-card">
            <div class="lem-card-top">
                <div class="lem-card-info">
                    <div class="lem-fornecedor">${l.fornecedor}</div>
                    <div class="lem-descricao">${l.descricao}</div>
                    ${qtdLabel}${venc}${obs}
                </div>
                <div class="lem-valor">${formatarMoeda(total)}</div>
            </div>
            <div class="lem-card-actions">
                <button class="lem-btn-pagar" onclick="pagarLembrete('${l.id}','${l.fornecedor.replace(/'/g,"\\'")}','${l.descricao.replace(/'/g,"\\'")}',${total})">
                    💸 Pagar
                </button>
                <button class="lem-btn-remover" onclick="removerLembrete('${l.id}')">✕</button>
            </div>
        </div>`;
    }).join('');
}