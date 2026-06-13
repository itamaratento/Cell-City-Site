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
    where,
    serverTimestamp 
} from "../../scripts/firebase.js";

// ═══════════════════════════════════════════
// 🎯 COLLECTIONS
// ═══════════════════════════════════════════
const COLLECTION_PRODUTOS = "estoque_produtos";

// ═══════════════════════════════════════════
// 🏛️ CONSTANTES DE SISTEMA
// ═══════════════════════════════════════════
const SYSTEM_META = {
    SOURCE: "estoque_operacional",
    VERSION: "v1",
    CREATED_BY: "admin"
};

const SCHEMA_VERSION = 1;
const TIMEZONE = "America/Sao_Paulo";

// ═══════════════════════════════════════════
// 🌎 UTILITÁRIOS TEMPORAIS
// ═══════════════════════════════════════════
function getDataEmSP(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(date);
}

function getHoraEmSP(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    return formatter.format(date);
}

// ═══════════════════════════════════════════
// 🔥 EXPOSIÇÃO GLOBAL
// ═══════════════════════════════════════════
window.cadastrarProduto = cadastrarProduto;
window.excluirProduto = excluirProduto;
window.editarProduto = editarProduto;
window.fecharModalEdicao = fecharModalEdicao;
window.salvarEdicao = salvarEdicao;
window.buscarProdutos = buscarProdutos;
window.filtrarCategoria = filtrarCategoria;

console.log('📦 [ESTOQUE V1] Módulo de Estoque ativo.');

// ===== STATE =====
let produtos = [];
let todosProdutos = [];
let listenerProdutos = null;
let filtroCategoria = 'todos';

// ═══════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════
async function init() {
    console.log('✅ Estoque V1 inicializado.');
    await carregarCategoriasSelect();
    iniciarListenerProdutos();
}

// ═══════════════════════════════════════════
// LISTENER REALTIME
// ═══════════════════════════════════════════
function iniciarListenerProdutos() {
    if (listenerProdutos) { listenerProdutos(); listenerProdutos = null; }
    
    const q = query(collection(db, COLLECTION_PRODUTOS), orderBy("createdAt", "desc"));
    
    listenerProdutos = onSnapshot(q, (snap) => {
        produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        todosProdutos = [...produtos];
        aplicarFiltrosEAtualizar();
    }, (error) => console.error('❌ Erro no listener de produtos:', error));
}

// ═══════════════════════════════════════════
// CATEGORIAS
// ═══════════════════════════════════════════
async function carregarCategoriasSelect() {
    try {
        const categoriasPadrao = ['Venda', 'Serviço', 'Fornecedores', 'Despesas', 'Marketing'];
        let todasCategorias = [...categoriasPadrao];
        
        // Tenta carregar categorias existentes do Firestore
        try {
            const snap = await getDocs(collection(db, "categorias_caixa"));
            const catsFirestore = snap.docs.map(d => d.data().nome);
            catsFirestore.forEach(c => {
                if (!todasCategorias.includes(c)) todasCategorias.push(c);
            });
        } catch (e) {
            console.log('ℹ️ Categorias do Firestore não disponíveis, usando padrão');
        }
        
        const select = document.getElementById('categoria');
        const selectFiltro = document.getElementById('filtroCategoria');
        const selectEdit = document.getElementById('editCategoria');
        
        const options = todasCategorias.map(c => `<option value="${c}">${c}</option>`).join('');
        
        if (select) select.innerHTML = '<option value="">Selecione...</option>' + options;
        if (selectEdit) selectEdit.innerHTML = '<option value="">Selecione...</option>' + options;
        if (selectFiltro) {
            selectFiltro.innerHTML = '<option value="todos">Todas as Categorias</option>' + options;
        }
    } catch (error) {
        console.error('❌ Erro ao carregar categorias:', error);
    }
}

// ═══════════════════════════════════════════
// CRUD - CADASTRAR
// ═══════════════════════════════════════════
async function cadastrarProduto() {
    const nome = document.getElementById('nome')?.value?.trim().toUpperCase();
    const descricao = document.getElementById('descricao')?.value?.trim();
    const categoria = document.getElementById('categoria')?.value;
    const quantidade = parseInt(document.getElementById('quantidade')?.value) || 0;
    const preco = parseFloat(document.getElementById('preco')?.value) || 0;

    // Validação
    if (!nome) return showToast('⚠️ Nome do produto é obrigatório');
    if (!categoria) return showToast('⚠️ Categoria é obrigatória');
    if (quantidade < 0) return showToast('⚠️ Quantidade não pode ser negativa');

    // Verificar duplicata por nome
    const existe = produtos.find(p => p.nome === nome);
    if (existe) return showToast(`⚠️ Produto "${nome}" já cadastrado no estoque`);

    const agora = new Date();
    const dataSP = getDataEmSP(agora);

    const dados = {
        nome,
        descricao,
        categoria,
        quantidade,
        preco,
        status: "ativo",
        source: SYSTEM_META.SOURCE,
        version: SYSTEM_META.VERSION,
        createdBy: SYSTEM_META.CREATED_BY,
        createdAt: serverTimestamp(),
        createdAtISO: agora.toISOString(),
        updatedAt: serverTimestamp(),
        updatedAtISO: agora.toISOString(),
        dataCadastro: dataSP,
        horarioCadastro: getHoraEmSP(agora),
        schemaVersion: SCHEMA_VERSION
    };

    try {
        const docRef = doc(collection(db, COLLECTION_PRODUTOS));
        await setDoc(docRef, { ...dados, id: docRef.id });
        showToast('✅ Produto cadastrado com sucesso');
        limparFormulario();
    } catch (error) {
        console.error('❌ Erro ao cadastrar produto:', error);
        showToast('❌ Erro ao cadastrar: ' + error.message);
    }
}

// ═══════════════════════════════════════════
// CRUD - EXCLUIR
// ═══════════════════════════════════════════
async function excluirProduto(id) {
    if (!confirm('🗑️ Deseja realmente excluir este produto?\n\nEsta ação é PERMANENTE.')) return;
    
    try {
        await deleteDoc(doc(db, COLLECTION_PRODUTOS, id));
        showToast('🗑️ Produto excluído permanentemente');
    } catch (error) {
        console.error('❌ Erro ao excluir:', error);
        showToast('❌ Erro ao excluir: ' + error.message);
    }
}

// ═══════════════════════════════════════════
// CRUD - EDITAR (abrir modal)
// ═══════════════════════════════════════════
function editarProduto(id) {
    const p = produtos.find(x => x.id === id);
    if (!p) return showToast('❌ Produto não encontrado');
    
    document.getElementById('editId').value = id;
    document.getElementById('editNome').value = p.nome || '';
    document.getElementById('editDescricao').value = p.descricao || '';
    document.getElementById('editCategoria').value = p.categoria || '';
    document.getElementById('editQuantidade').value = p.quantidade || 0;
    document.getElementById('editPreco').value = p.preco || 0;
    
    document.getElementById('modalEdicao').classList.add('active');
}

function fecharModalEdicao() {
    document.getElementById('modalEdicao').classList.remove('active');
}

// ═══════════════════════════════════════════
// CRUD - SALVAR EDIÇÃO
// ═══════════════════════════════════════════
async function salvarEdicao() {
    const id = document.getElementById('editId').value;
    const original = produtos.find(p => p.id === id);
    if (!original) return showToast('❌ Produto não encontrado');
    
    const nome = document.getElementById('editNome')?.value?.trim().toUpperCase();
    const descricao = document.getElementById('editDescricao')?.value?.trim();
    const categoria = document.getElementById('editCategoria')?.value;
    const quantidade = parseInt(document.getElementById('editQuantidade')?.value) || 0;
    const preco = parseFloat(document.getElementById('editPreco')?.value) || 0;
    
    if (!nome) return showToast('⚠️ Nome do produto é obrigatório');
    if (!categoria) return showToast('⚠️ Categoria é obrigatória');
    if (quantidade < 0) return showToast('⚠️ Quantidade não pode ser negativa');
    
    // Verificar duplicata (exceto o próprio produto)
    const duplicata = produtos.find(p => p.nome === nome && p.id !== id);
    if (duplicata) return showToast(`⚠️ Produto "${nome}" já cadastrado`);
    
    const agora = new Date();
    
    const dados = {
        nome,
        descricao,
        categoria,
        quantidade,
        preco,
        updatedAt: serverTimestamp(),
        updatedAtISO: agora.toISOString()
    };
    
    try {
        await updateDoc(doc(db, COLLECTION_PRODUTOS, id), dados);
        showToast('✅ Produto atualizado com sucesso');
        fecharModalEdicao();
    } catch (error) {
        console.error('❌ Erro ao atualizar:', error);
        showToast('❌ Erro ao atualizar: ' + error.message);
    }
}

// ═══════════════════════════════════════════
// FILTROS
// ═══════════════════════════════════════════
function buscarProdutos() {
    aplicarFiltrosEAtualizar();
}

function filtrarCategoria() {
    const select = document.getElementById('filtroCategoria');
    filtroCategoria = select ? select.value : 'todos';
    aplicarFiltrosEAtualizar();
}

function aplicarFiltrosEAtualizar() {
    const termo = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    let lista = [...todosProdutos];
    
    // Filtro por categoria
    if (filtroCategoria && filtroCategoria !== 'todos') {
        lista = lista.filter(p => p.categoria === filtroCategoria);
    }
    
    // Filtro por texto (nome, descrição, categoria)
    if (termo.trim()) {
        lista = lista.filter(p => 
            (p.nome && p.nome.toLowerCase().includes(termo)) ||
            (p.descricao && p.descricao.toLowerCase().includes(termo)) ||
            (p.categoria && p.categoria.toLowerCase().includes(termo))
        );
    }
    
    atualizarInterface(lista);
}

// ═══════════════════════════════════════════
// RENDERIZAR
// ═══════════════════════════════════════════
function atualizarInterface(lista) {
    const container = document.getElementById('listaProdutos');
    const contador = document.getElementById('contadorProdutos');
    
    if (contador) contador.textContent = lista.length;
    if (!container) return;
    
    if (lista.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <p>Nenhum produto encontrado</p>
            </div>`;
        return;
    }
    
    container.innerHTML = lista.map(p => `
        <div class="produto-card">
            <div class="produto-header">
                <div class="produto-nome">${p.nome}</div>
                <div class="produto-quantidade ${p.quantidade <= 0 ? 'qtd-zero' : p.quantidade <= 3 ? 'qtd-baixa' : 'qtd-ok'}">
                    ${p.quantidade} un.
                </div>
            </div>
            ${p.descricao ? `<div class="produto-descricao">${p.descricao}</div>` : ''}
            <div class="produto-info">
                <span class="tag tag-categoria">${p.categoria}</span>
                <span class="tag tag-preco">R$ ${(p.preco || 0).toFixed(2)}</span>
                <span class="tag tag-data">📅 ${p.dataCadastro || '-'}</span>
            </div>
            <div class="produto-acoes">
                <button class="btn-acao btn-editar" onclick="editarProduto('${p.id}')" title="Editar">✏️</button>
                <button class="btn-acao btn-excluir" onclick="excluirProduto('${p.id}')" title="Excluir">🗑️</button>
            </div>
        </div>
    `).join('');
}

function limparFormulario() {
    document.getElementById('nome').value = '';
    document.getElementById('descricao').value = '';
    document.getElementById('categoria').value = '';
    document.getElementById('quantidade').value = '';
    document.getElementById('preco').value = '';
    document.getElementById('nome').focus();
}

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════
function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ═══════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════
document.getElementById('modalEdicao')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalEdicao') fecharModalEdicao();
});

document.getElementById('searchInput')?.addEventListener('input', (e) => {
    buscarProdutos();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharModalEdicao();
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
    if (listenerProdutos) listenerProdutos();
});
