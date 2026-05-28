// ===== IMPORTS (Padrão OS) =====
import { 
    db, 
    collection, 
    doc, 
    setDoc, 
    addDoc,
    getDocs, 
    updateDoc, 
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp 
} from "../../scripts/firebase.js";

// ═══════════════════════════════════════════
// 🎯 COLLECTION OFICIAL DO MÓDULO CAIXA
// ═══════════════════════════════════════════
const COLLECTION_LANCAMENTOS = "caixa_lancamentos";
const COLLECTION_CATEGORIAS = "categorias_caixa";

// ===== CONSTANTES DE METADATA =====
const SYSTEM_META = {
    SOURCE: "caixa_operacional",
    VERSION: "v15",
    CREATED_BY: "admin"
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

console.log('🔥 [CAIXA V15] Correção serverTimestamp em arrays aplicada.');

// ===== STATE =====
let lancamentos = [];
let categorias = [];
let tipoSelecionado = '';
let tipoSelecionadoEdicao = '';
let periodoFiltro = 'todos';
let termoPesquisa = '';
let listenerLancamentos = null;
let listenerCategorias = null;

// ===== INICIALIZAÇÃO =====
async function init() {
    console.log('✅ Caixa V15 inicializado.');
    await carregarCategorias();
    iniciarListenerCategorias();
    iniciarListenerLancamentos();
}

// ═══════════════════════════════════════════
// CATEGORIAS
// ═══════════════════════════════════════════
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
                    nome: cat.nome,
                    tipoPadrao: cat.tipoPadrao,
                    status: "ativo",
                    source: SYSTEM_META.SOURCE,
                    version: SYSTEM_META.VERSION,
                    createdBy: SYSTEM_META.CREATED_BY,
                    createdAt: serverTimestamp(),
                    createdAtISO: agora.toISOString(),
                    updatedAt: serverTimestamp(),
                    updatedAtISO: agora.toISOString()
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
        categorias
            .filter(c => c.status === 'ativo' || !c.status)
            .map(c => `<option value="${c.nome}">${c.nome}</option>`)
            .join('');
    
    if (valorAtual && categorias.find(c => c.nome === valorAtual)) {
        select.value = valorAtual;
    }
}

function atualizarSelectCategoriasEdicao() {
    const select = document.getElementById('editCategoria');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione...</option>' +
        categorias
            .filter(c => c.status === 'ativo' || !c.status)
            .map(c => `<option value="${c.nome}">${c.nome}</option>`)
            .join('');
}

// ═══════════════════════════════════════════
// NOVA CATEGORIA
// ═══════════════════════════════════════════
function adicionarNovaCategoria() {
    const existingForm = document.getElementById('nova-categoria-form');
    if (existingForm) {
        existingForm.querySelector('#nova-categoria-input')?.focus();
        return;
    }
    
    const formSection = document.querySelector('.secao-lancamento .form-section');
    if (!formSection) return alert('❌ Formulário não encontrado');
    
    const labels = formSection.querySelectorAll('label');
    let categoriaGroup = null;
    for (const label of labels) {
        if (label.textContent.includes('Categoria')) {
            categoriaGroup = label.closest('.form-group');
            break;
        }
    }
    
    if (!categoriaGroup) return alert('❌ Campo de categoria não encontrado');
    
    const formHTML = `
        <div id="nova-categoria-form" style="
            margin-top: 12px; padding: 14px;
            background: rgba(0, 200, 83, 0.08);
            border: 1px solid var(--green-primary);
            border-radius: 10px;
        ">
            <label style="display:block;font-size:12px;font-weight:700;color:#00E676;margin-bottom:8px;">
                ➕ Nova Categoria
            </label>
            <input type="text" id="nova-categoria-input" placeholder="Ex: ÁGUA, LUZ..."
                autocomplete="off"
                onkeypress="if(event.key==='Enter'){event.preventDefault();window.executarSalvarCategoria();}"
                style="width:100%;padding:12px;background:#1c1f1d;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;font-size:14px;margin-bottom:10px;outline:none;">
            <div style="display:flex;gap:8px;">
                <button type="button" onclick="window.executarSalvarCategoria()"
                    style="flex:1;padding:11px;background:#00C853;color:#000;border:none;border-radius:8px;font-weight:800;cursor:pointer;font-size:13px;">
                    💾 Salvar
                </button>
                <button type="button" onclick="window.cancelarNovaCategoria()"
                    style="padding:11px 18px;background:#1c1f1d;color:#d1d5db;border:1px solid rgba(255,255,255,0.1);border-radius:8px;cursor:pointer;font-size:13px;">
                    ✕
                </button>
            </div>
        </div>
    `;
    
    categoriaGroup.insertAdjacentHTML('afterend', formHTML);
    setTimeout(() => document.getElementById('nova-categoria-input')?.focus(), 100);
}

function cancelarNovaCategoria() {
    const form = document.getElementById('nova-categoria-form');
    if (form) {
        form.style.opacity = '0';
        form.style.transform = 'translateY(-10px)';
        form.style.transition = 'all 0.2s ease';
        setTimeout(() => form.remove(), 200);
    }
}

async function executarSalvarCategoria() {
    try {
        const input = document.getElementById("nova-categoria-input");
        if (!input) return alert("Input não encontrado");
        
        const nome = input.value.trim().toUpperCase();
        if (!nome) {
            alert("Digite a categoria");
            input.focus();
            return;
        }
        
        if (!db) return alert("Firebase não carregado");
        
        const id = nome.replace(/[\/.#\[\]]/g, "").replace(/\s+/g, "_");
        
        const existe = categorias.find(c => 
            c.id === id || c.nome === nome || (c.nome && c.nome.toUpperCase() === nome)
        );
        if (existe) {
            alert(`Categoria "${nome}" já existe`);
            input.value = '';
            input.focus();
            return;
        }
        
        const agora = new Date();
        const dadosCategoria = {
            nome: nome,
            status: "ativo",
            tipoPadrao: "entrada",
            source: SYSTEM_META.SOURCE,
            version: SYSTEM_META.VERSION,
            createdBy: SYSTEM_META.CREATED_BY,
            createdAtISO: agora.toISOString(),
            updatedAtISO: agora.toISOString(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        let docRef;
        try {
            docRef = doc(db, "categorias_caixa", id);
            await setDoc(docRef, dadosCategoria);
        } catch (erroSetDoc) {
            docRef = await addDoc(collection(db, "categorias_caixa"), dadosCategoria);
        }
        
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
        const categoriaServico = categorias.find(c => c.tipoPadrao === 'servico');
        if (categoriaServico) {
            const select = document.getElementById('categoria');
            if (select) select.value = categoriaServico.nome;
        }
    }
}

function selecionarTipoEdicao(tipo) {
    tipoSelecionadoEdicao = tipo;
    document.querySelectorAll('#modalEdicao .tipo-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`#modalEdicao [data-tipo="${tipo}"]`)?.classList.add('selected');
    calcularLucroEdicao();
}

function calcularLucro() {
    const valor = parseFloat(document.getElementById('valor')?.value || 0);
    const custo = parseFloat(document.getElementById('custo')?.value || 0);
    const lucro = valor - custo;
    
    const lucroInput = document.getElementById('lucroAuto');
    const alertaPrejuizo = document.getElementById('alertaPrejuizo');
    
    if (lucroInput) {
        lucroInput.value = lucro >= 0 ? `R$ ${lucro.toFixed(2)}` : `- R$ ${Math.abs(lucro).toFixed(2)}`;
    }
    if (alertaPrejuizo) {
        alertaPrejuizo.style.display = lucro < 0 ? 'block' : 'none';
    }
}

function calcularLucroEdicao() {
    const valor = parseFloat(document.getElementById('editValor')?.value || 0);
    const custo = parseFloat(document.getElementById('editCusto')?.value || 0);
    const lucro = valor - custo;
    
    const lucroInput = document.getElementById('editLucroAuto');
    if (lucroInput) {
        lucroInput.value = lucro >= 0 ? `R$ ${lucro.toFixed(2)}` : `- R$ ${Math.abs(lucro).toFixed(2)}`;
    }
}

function validarLancamento(dados) {
    if (!dados.tipo) return "Selecione o tipo";
    if (!dados.descricao?.trim()) return "Descrição obrigatória";
    if (!dados.categoria) return "Categoria obrigatória";
    if (!dados.valor || dados.valor <= 0) return "Valor inválido";
    return null;
}

function criarEstruturaTemporal() {
    const agora = new Date();
    return {
        dataISO: agora.toISOString(),
        dia: agora.toISOString().split('T')[0],
        mes: `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`,
        ano: agora.getFullYear(),
        semana: getNumeroSemana(agora),
        horario: agora.toTimeString().split(' ')[0],
        diaSemana: agora.getDay(),
        diaMes: agora.getDate(),
        mesNumero: agora.getMonth() + 1
    };
}

function getNumeroSemana(data) {
    const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ═══════════════════════════════════════════
// SALVAR LANÇAMENTO
// ═══════════════════════════════════════════
async function salvarLancamento() {
    const valor = parseFloat(document.getElementById('valor')?.value || 0);
    const custo = parseFloat(document.getElementById('custo')?.value || 0);
    const lucro = valor - custo;
    
    const temporal = criarEstruturaTemporal();
    
    const dados = {
        tipo: tipoSelecionado,
        descricao: document.getElementById('descricao')?.value.trim() || '',
        categoria: document.getElementById('categoria')?.value || '',
        valor, custo, lucro,
        status: "ativo",
        source: SYSTEM_META.SOURCE,
        version: SYSTEM_META.VERSION,
        createdBy: SYSTEM_META.CREATED_BY,
        createdAt: serverTimestamp(),
        createdAtISO: temporal.dataISO,
        updatedAt: serverTimestamp(),
        updatedAtISO: temporal.dataISO,
        dataISO: temporal.dataISO,
        dia: temporal.dia,
        mes: temporal.mes,
        ano: temporal.ano,
        semana: temporal.semana,
        horario: temporal.horario,
        diaSemana: temporal.diaSemana,
        diaMes: temporal.diaMes,
        mesNumero: temporal.mesNumero,
        editHistory: [],
        editCount: 0
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
    if (listenerLancamentos) {
        listenerLancamentos();
        listenerLancamentos = null;
    }
    
    const q = query(collection(db, COLLECTION_LANCAMENTOS), orderBy("dataISO", "desc"));
    
    listenerLancamentos = onSnapshot(q, (snap) => {
        lancamentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        atualizarInterface();
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
    let filtrados = lista;
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    
    if (periodoFiltro === 'hoje') filtrados = filtrados.filter(l => new Date(l.dataISO) >= hoje);
    else if (periodoFiltro === 'semana') filtrados = filtrados.filter(l => new Date(l.dataISO) >= inicioSemana);
    else if (periodoFiltro === 'mes') filtrados = filtrados.filter(l => new Date(l.dataISO) >= inicioMes);
    
    return filtrados;
}

function pesquisarLancamentos() {
    termoPesquisa = document.getElementById('searchInput')?.value || '';
    
    const secaoResultados = document.getElementById('resultados-pesquisa');
    const secoesNormais = document.querySelectorAll('.secao-normal');
    
    if (termoPesquisa.trim()) {
        if (secaoResultados) secaoResultados.style.display = 'block';
        secoesNormais.forEach(s => s.style.display = 'none');
        renderizarResultadosPesquisa();
    } else {
        if (secaoResultados) secaoResultados.style.display = 'none';
        secoesNormais.forEach(s => s.style.display = 'block');
        atualizarInterface();
    }
}

function renderizarResultadosPesquisa() {
    const termo = termoPesquisa.toLowerCase();
    const resultados = lancamentos.filter(l => 
        l.descricao?.toLowerCase().includes(termo) ||
        l.categoria?.toLowerCase().includes(termo) ||
        l.valor?.toString().includes(termo) ||
        l.tipo?.toLowerCase().includes(termo) ||
        l.dia?.includes(termo)
    );
    
    const entradas = resultados.filter(l => l.tipo === 'entrada').reduce((sum, l) => sum + l.valor, 0);
    const saidas = resultados.filter(l => l.tipo === 'saida').reduce((sum, l) => sum + l.valor, 0);
    const saldo = entradas - saidas;
    
    const elE = document.getElementById('total-pesquisa-entradas');
    const elS = document.getElementById('total-pesquisa-saidas');
    const elSaldo = document.getElementById('total-pesquisa-saldo');
    const elCont = document.getElementById('contador-resultados');
    
    if (elE) elE.textContent = formatarMoeda(entradas);
    if (elS) elS.textContent = formatarMoeda(saidas);
    if (elSaldo) elSaldo.textContent = formatarMoeda(saldo);
    if (elCont) elCont.textContent = resultados.length;
    
    const container = document.getElementById('lista-resultados-pesquisa');
    if (!container) return;
    
    if (resultados.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><p>Nenhum resultado</p></div>`;
        return;
    }
    
    container.innerHTML = resultados.map(l => renderizarCardMovimentacao(l)).join('');
}

// ═══════════════════════════════════════════
// ATUALIZAR INTERFACE
// ═══════════════════════════════════════════
function atualizarInterface() {
    if (termoPesquisa.trim()) return;
    
    const filtrados = aplicarFiltros(lancamentos);
    const entradas = filtrados.filter(l => l.tipo === 'entrada').reduce((sum, l) => sum + l.valor, 0);
    const saidas = filtrados.filter(l => l.tipo === 'saida').reduce((sum, l) => sum + l.valor, 0);
    const lucro = filtrados.reduce((sum, l) => sum + (l.lucro || 0), 0);
    const saldo = entradas - saidas;
    
    const elSaldo = document.getElementById('saldoGeral');
    const elE = document.getElementById('totalEntradas');
    const elS = document.getElementById('totalSaidas');
    const elL = document.getElementById('totalLucro');
    const elCont = document.getElementById('contadorLancamentos');
    
    if (elSaldo) elSaldo.textContent = formatarMoeda(saldo);
    if (elE) elE.textContent = formatarMoeda(entradas);
    if (elS) elS.textContent = formatarMoeda(saidas);
    if (elL) elL.textContent = formatarMoeda(lucro);
    if (elCont) elCont.textContent = filtrados.length;
    
    renderizarLista(filtrados);
}

function renderizarCardMovimentacao(l) {
    const valorClass = l.tipo === 'entrada' ? 'valor-entrada' : l.tipo === 'saida' ? 'valor-saida' : 'valor-servico';
    const tagClass = `tag-${l.tipo}`;
    const ultimaEdicao = l.editHistory?.length > 0 ? l.editHistory[l.editHistory.length - 1] : null;
    const temHistorico = ultimaEdicao !== null;
    
    return `
        <div class="movimentacao-card">
            <div class="movimentacao-header">
                <div class="movimentacao-descricao">${l.descricao}</div>
                <div class="movimentacao-valor ${valorClass}">
                    ${l.tipo === 'saida' ? '-' : '+'} ${formatarMoeda(l.valor)}
                </div>
            </div>
            <div class="movimentacao-info">
                <span class="tag ${tagClass}">${l.tipo}</span>
                <span class="tag tag-categoria">${l.categoria}</span>
                ${l.lucro !== undefined ? `<span class="tag" style="background:rgba(33,150,243,0.15);color:#60a5fa;">Lucro: ${formatarMoeda(l.lucro)}</span>` : ''}
                <div class="movimentacao-acoes">
                    <button class="btn-acao btn-editar" onclick="editarLancamento('${l.id}')" title="Editar">✏️</button>
                    <button class="btn-acao btn-excluir" onclick="excluirLancamento('${l.id}')" title="Excluir">🗑️</button>
                </div>
            </div>
            <div class="movimentacao-historico">
                <div class="historico-item">📅 Criado: ${formatarData(l.dataISO)}</div>
                ${temHistorico ? `<div class="historico-item">✏️ Editado ${l.editCount || l.editHistory.length}x: ${formatarData(ultimaEdicao.editedAtISO || ultimaEdicao.editedAt)}</div>` : ''}
            </div>
        </div>
    `;
}

function renderizarLista(lista) {
    const container = document.getElementById('listaMovimentacoes');
    if (!container) return;
    
    if (lista.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">📊</div><p>Nenhum lançamento encontrado</p></div>`;
        return;
    }
    
    container.innerHTML = lista.map(l => renderizarCardMovimentacao(l)).join('');
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
    const lancamento = lancamentos.find(l => l.id === id);
    if (!lancamento) return showToast('❌ Lançamento não encontrado');
    
    document.getElementById('editId').value = id;
    document.getElementById('editDescricao').value = lancamento.descricao || '';
    document.getElementById('editCategoria').value = lancamento.categoria || '';
    document.getElementById('editValor').value = lancamento.valor || 0;
    document.getElementById('editCusto').value = lancamento.custo || 0;
    
    tipoSelecionadoEdicao = lancamento.tipo;
    document.querySelectorAll('#modalEdicao .tipo-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`#modalEdicao [data-tipo="${lancamento.tipo}"]`)?.classList.add('selected');
    
    calcularLucroEdicao();
    
    const historicoDiv = document.getElementById('editHistorico');
    if (lancamento.editHistory && lancamento.editHistory.length > 0) {
        historicoDiv.innerHTML = `
            <div class="edit-historico-title">📜 Histórico de Edições (${lancamento.editHistory.length})</div>
            ${lancamento.editHistory.slice().reverse().map(h => `
                <div class="edit-historico-item">
                    <div class="edit-historico-data">${formatarData(h.editedAtISO || h.editedAt)}</div>
                    <div style="font-size:11px;color:var(--text2);margin-top:4px;">
                        ${renderizarMudancas(h)}
                    </div>
                </div>
            `).join('')}
        `;
    } else {
        historicoDiv.innerHTML = '<div class="edit-historico-title">📜 Nenhuma edição anterior</div>';
    }
    
    document.getElementById('modalEdicao').classList.add('active');
}

function renderizarMudancas(historico) {
    if (historico.changes && !historico.oldData) {
        return `<span style="color:var(--text3);">${historico.changes}</span>`;
    }
    if (!historico.oldData || !historico.newData) return '';
    
    const campos = ['tipo', 'descricao', 'categoria', 'valor', 'custo'];
    const labels = { tipo: 'Tipo', descricao: 'Descrição', categoria: 'Categoria', valor: 'Valor', custo: 'Custo' };
    
    const mudancas = campos
        .filter(c => historico.oldData[c] !== historico.newData[c])
        .map(c => {
            const old = c === 'valor' || c === 'custo' ? formatarMoeda(historico.oldData[c]) : historico.oldData[c];
            const newV = c === 'valor' || c === 'custo' ? formatarMoeda(historico.newData[c]) : historico.newData[c];
            return `<div><strong>${labels[c]}:</strong> <span style="color:var(--red);">${old}</span> → <span style="color:var(--green-light);">${newV}</span></div>`;
        });
    
    return mudancas.join('');
}

function fecharModalEdicao() {
    document.getElementById('modalEdicao').classList.remove('active');
}

// ═══════════════════════════════════════════
// 🔥 SALVAR EDIÇÃO — CORREÇÃO serverTimestamp EM ARRAY
// ═══════════════════════════════════════════
async function salvarEdicao() {
    const id = document.getElementById('editId').value;
    const lancamentoOriginal = lancamentos.find(l => l.id === id);
    
    if (!lancamentoOriginal) return showToast('❌ Lançamento não encontrado');
    
    const novoValor = parseFloat(document.getElementById('editValor').value || 0);
    const novoCusto = parseFloat(document.getElementById('editCusto').value || 0);
    
    const dadosAtualizados = {
        tipo: tipoSelecionadoEdicao,
        descricao: document.getElementById('editDescricao').value.trim(),
        categoria: document.getElementById('editCategoria').value,
        valor: novoValor,
        custo: novoCusto,
        lucro: novoValor - novoCusto
    };
    
    const erro = validarLancamento(dadosAtualizados);
    if (erro) return showToast(`⚠️ ${erro}`);
    
    const oldData = {
        tipo: lancamentoOriginal.tipo,
        descricao: lancamentoOriginal.descricao,
        categoria: lancamentoOriginal.categoria,
        valor: lancamentoOriginal.valor,
        custo: lancamentoOriginal.custo,
        lucro: lancamentoOriginal.lucro
    };
    
    const newData = { ...dadosAtualizados };
    
    const campos = ['tipo', 'descricao', 'categoria', 'valor', 'custo'];
    const mudou = campos.some(c => oldData[c] !== newData[c]);
    
    if (!mudou) {
        showToast('ℹ️ Nenhuma alteração detectada');
        fecharModalEdicao();
        return;
    }
    
    // ⚠️ CORREÇÃO CRÍTICA: usar ISO string DENTRO do array
    // Firestore NÃO permite serverTimestamp() dentro de arrays
    const agora = new Date();
    const timestampEdicao = agora.toISOString();
    
    const editHistory = lancamentoOriginal.editHistory || [];
    editHistory.push({
        editedAt: timestampEdicao,        // ✅ ISO string (não serverTimestamp)
        editedAtISO: timestampEdicao,     // ✅ ISO string
        editedBy: SYSTEM_META.CREATED_BY,
        oldData,
        newData
    });
    
    const updatePayload = {
        ...dadosAtualizados,
        status: "editado",
        editHistory,
        editCount: (lancamentoOriginal.editCount || 0) + 1,
        updatedAt: serverTimestamp(),          // ✅ serverTimestamp OK (nível superior)
        updatedAtISO: timestampEdicao
    };
    
    try {
        await updateDoc(doc(db, COLLECTION_LANCAMENTOS, id), updatePayload);
        
        console.log('✅ Lançamento atualizado:', {
            id,
            oldData,
            newData,
            editCount: updatePayload.editCount
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
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor || 0);
}

function formatarData(iso) {
    if (!iso) return '';
    const data = new Date(iso);
    return data.toLocaleDateString('pt-BR', { 
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit' 
    });
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════
document.getElementById('editValor')?.addEventListener('input', calcularLucroEdicao);
document.getElementById('editCusto')?.addEventListener('input', calcularLucroEdicao);

document.getElementById('modalEdicao')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalEdicao') fecharModalEdicao();
});

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.addEventListener('beforeunload', () => {
    if (listenerLancamentos) listenerLancamentos();
    if (listenerCategorias) listenerCategorias();
});