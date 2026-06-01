import {
    db, collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp
} from "../../scripts/firebase.js";

const COL = 'estoque_produtos'; // nova coleção dedicada ao estoque

let produtos = [];
let editandoId = null;

const CAT_ICON = {
    'Cabo': '🔌', 'Capinha': '📱', 'Película': '🛡️', 'Carregador': '⚡',
    'Fone': '🎧', 'Bateria': '🔋', 'Tela': '📺', 'Peça': '🔧',
    'Acessório': '✨', 'Outro': '📌'
};

// ── elementos ──────────────────────────────────────────────────────
const formEl      = document.getElementById('est-form');
const btnNovo     = document.getElementById('est-btn-novo');
const btnSalvar   = document.getElementById('est-btn-salvar');
const btnCancelar = document.getElementById('est-btn-cancelar');
const inpNome     = document.getElementById('est-inp-nome');
const inpCat      = document.getElementById('est-inp-cat');
const inpQty      = document.getElementById('est-inp-qty');
const inpMin      = document.getElementById('est-inp-min');
const inpVenda    = document.getElementById('est-inp-venda');
const inpCusto    = document.getElementById('est-inp-custo');
const formTitulo  = document.getElementById('est-form-titulo');
const toastEl     = document.getElementById('est-toast');
const searchEl    = document.getElementById('est-search');

// ── toast ──────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), 2200);
}

// ── toggle busca ───────────────────────────────────────────────────
const toggleBuscaBtn = document.getElementById('est-toggle-busca');
const toolbarEl = document.getElementById('est-toolbar');
toggleBuscaBtn?.addEventListener('click', () => {
    toolbarEl.classList.toggle('est-toolbar-collapsed');
    toggleBuscaBtn.classList.toggle('expanded');
});

// ── toggle lista produtos ───────────────────────────────────────────
const toggleListaBtn = document.getElementById('est-lista-toggle');
const catsContainer = document.getElementById('est-cats-container');
toggleListaBtn?.addEventListener('click', () => {
    catsContainer.classList.toggle('collapsed');
    toggleListaBtn.classList.toggle('collapsed');
});

// ── carregar ───────────────────────────────────────────────────────
async function carregar() {
    try {
        const snap = await getDocs(collection(db, COL));
        produtos = [];
        snap.forEach(d => produtos.push({ id: d.id, ...d.data() }));
        // fallback: se coleção nova for vazia, tenta migrar da coleção antiga
        if (produtos.length === 0) {
            const snap2 = await getDocs(collection(db, 'produtos'));
            snap2.forEach(d => {
                const p = d.data();
                produtos.push({
                    id: d.id,
                    nome: p.description || p.nome || '—',
                    categoria: p.categoria || 'Outro',
                    quantidade: Number(p.quantidade || 0),
                    quantidadeMinima: Number(p.quantidadeMinima || 1),
                    venda: Number(p.venda || 0),
                    custo: Number(p.custo || 0)
                });
            });
        }
    } catch {
        produtos = [];
    }
    document.getElementById('est-loading').style.display = 'none';
    render(produtos);
}

// ── resumo ─────────────────────────────────────────────────────────
function atualizarResumo(lista) {
    const baixo = lista.filter(p => p.quantidade <= p.quantidadeMinima);
    const cats  = new Set(lista.map(p => p.categoria || 'Outro')).size;
    document.getElementById('est-total-produtos').textContent = lista.length;
    document.getElementById('est-total-baixo').textContent    = baixo.length;
    document.getElementById('est-total-cats').textContent     = cats;
}

// ── render ─────────────────────────────────────────────────────────
function render(lista) {
    atualizarResumo(lista);
    const container = document.getElementById('est-cats-container');
    const emptyEl   = document.getElementById('est-empty');

    if (!lista.length) {
        container.innerHTML = '';
        emptyEl.style.display = 'flex';
        return;
    }
    emptyEl.style.display = 'none';

    // Agrupar por categoria
    const grupos = {};
    lista.forEach(p => {
        const cat = p.categoria || 'Outro';
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(p);
    });

    const fmt = v => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    container.innerHTML = Object.entries(grupos)
        .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
        .map(([cat, itens]) => {
            const icon = CAT_ICON[cat] || '📌';
            const baixo = itens.filter(p => p.quantidade <= p.quantidadeMinima).length;
            const badges = baixo ? `<span class="est-cat-badge-alerta">${baixo} baixo</span>` : '';
            return `
            <div class="est-cat-group">
                <div class="est-cat-header expanded" data-cat="${cat}">
                    <span class="est-cat-toggle">＋</span>
                    <span class="est-cat-icon">${icon}</span>
                    <span class="est-cat-nome">${escHtml(cat)}</span>
                    <span class="est-cat-count">${itens.length}</span>
                    ${badges}
                </div>
                <div class="est-cat-lista" data-cat="${cat}">
                    ${itens.map(p => renderCard(p, fmt)).join('')}
                </div>
            </div>`;
        }).join('');

    // Toggle de categorias
    container.querySelectorAll('.est-cat-header').forEach(header => {
        header.addEventListener('click', () => {
            const cat = header.dataset.cat;
            const lista = container.querySelector(`.est-cat-lista[data-cat="${cat}"]`);
            if (lista) {
                header.classList.toggle('expanded');
                lista.classList.toggle('collapsed');
            }
        });
    });

    // eventos dos cards
    container.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => abrirFormEdicao(btn.dataset.edit));
    });
    container.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', () => excluir(btn.dataset.del));
    });
    container.querySelectorAll('[data-entrada]').forEach(btn => {
        btn.addEventListener('click', () => abrirModal('entrada', btn.dataset.entrada));
    });
    container.querySelectorAll('[data-saida]').forEach(btn => {
        btn.addEventListener('click', () => abrirModal('saida', btn.dataset.saida));
    });
}

function renderCard(p, fmt) {
    const baixo = p.quantidade <= p.quantidadeMinima;
    const qtyCls = baixo ? ' est-qty-baixo' : (p.quantidade > p.quantidadeMinima * 2 ? ' est-qty-ok' : '');
    return `
    <div class="est-card${baixo ? ' est-card-alerta' : ''}">
        <div class="est-card-info">
            <div class="est-card-nome">${escHtml(p.nome || p.description || '—')}</div>
            <div class="est-card-meta">
                <span class="est-card-preco">${fmt(p.venda)}</span>
                ${p.custo ? `<span class="est-card-custo">Custo: ${fmt(p.custo)}</span>` : ''}
            </div>
        </div>
        <div class="est-card-qty-area">
            <button class="est-qty-btn" data-saida="${p.id}" title="Saída">−</button>
            <div class="est-qty-wrap">
                <span class="est-qty${qtyCls}">${p.quantidade}</span>
                <span class="est-qty-min">mín: ${p.quantidadeMinima}</span>
            </div>
            <button class="est-qty-btn" data-entrada="${p.id}" title="Entrada">+</button>
        </div>
        <div class="est-card-acoes">
            <button class="est-card-edit" data-edit="${p.id}" title="Editar">✏️</button>
            <button class="est-card-del" data-del="${p.id}" title="Excluir">✕</button>
        </div>
    </div>`;
}

// ── formulário ─────────────────────────────────────────────────────
function abrirFormNovo() {
    editandoId = null;
    formTitulo.textContent = 'Novo Produto';
    inpNome.value  = '';
    inpCat.value   = 'Cabo';
    inpQty.value   = '0';
    inpMin.value   = '1';
    inpVenda.value = '';
    inpCusto.value = '';
    formEl.style.display = 'flex';
    btnNovo.style.display = 'none';
    inpNome.focus();
}

function abrirFormEdicao(id) {
    const p = produtos.find(x => x.id === id);
    if (!p) return;
    editandoId = id;
    formTitulo.textContent = 'Editar Produto';
    inpNome.value  = p.nome || p.description || '';
    inpCat.value   = p.categoria || 'Outro';
    inpQty.value   = p.quantidade ?? 0;
    inpMin.value   = p.quantidadeMinima ?? 1;
    inpVenda.value = p.venda || '';
    inpCusto.value = p.custo || '';
    formEl.style.display = 'flex';
    btnNovo.style.display = 'none';
    inpNome.focus();
}

function fecharForm() {
    formEl.style.display = 'none';
    btnNovo.style.display = '';
    editandoId = null;
}

async function salvarProduto() {
    const nome = inpNome.value.trim();
    if (!nome) { inpNome.focus(); return; }

    const dados = {
        nome,
        categoria:        inpCat.value,
        quantidade:       Number(inpQty.value) || 0,
        quantidadeMinima: Number(inpMin.value) || 1,
        venda:            Number(inpVenda.value) || 0,
        custo:            Number(inpCusto.value) || 0,
        atualizadoEm:     serverTimestamp()
    };

    const id = editandoId || `prod_${Date.now()}`;
    try {
        await setDoc(doc(db, COL, id), dados);
        toast(editandoId ? '✏️ Produto atualizado!' : '✅ Produto adicionado!');
        fecharForm();
        await carregar();
    } catch {
        toast('⚠ Erro ao salvar.');
    }
}

async function excluir(id) {
    if (!confirm('Excluir este produto do estoque?')) return;
    try {
        await deleteDoc(doc(db, COL, id));
        toast('🗑️ Produto removido.');
        await carregar();
    } catch {
        toast('⚠ Erro ao excluir.');
    }
}

// ── modal movimentação ────────────────────────────────────────────
let modalTipo = null;
let modalProdId = null;

function abrirModal(tipo, id) {
    modalTipo = tipo;
    modalProdId = id;
    const prod = produtos.find(p => p.id === id);
    document.getElementById('est-modal-titulo').textContent =
        tipo === 'entrada' ? `Entrada — ${prod?.nome || ''}` : `Saída — ${prod?.nome || ''}`;
    document.getElementById('est-modal-label').textContent =
        tipo === 'entrada' ? 'Quantidade a adicionar' : 'Quantidade a retirar';
    document.getElementById('est-modal-qty').value = '1';
    document.getElementById('est-modal-overlay').style.display = 'flex';
}

async function confirmarModal() {
    const qty = Number(document.getElementById('est-modal-qty').value) || 0;
    if (qty <= 0) return;
    const prod = produtos.find(p => p.id === modalProdId);
    if (!prod) return;

    const novaQty = modalTipo === 'entrada'
        ? prod.quantidade + qty
        : Math.max(prod.quantidade - qty, 0);

    try {
        await setDoc(doc(db, COL, modalProdId), { ...prod, quantidade: novaQty, atualizadoEm: serverTimestamp() });
        fecharModal();
        toast(modalTipo === 'entrada' ? `+${qty} unidades adicionadas.` : `-${qty} unidades retiradas.`);
        await carregar();
    } catch {
        toast('⚠ Erro ao movimentar.');
    }
}

function fecharModal() {
    document.getElementById('est-modal-overlay').style.display = 'none';
    modalTipo = null;
    modalProdId = null;
}

// ── busca ──────────────────────────────────────────────────────────
function filtrar() {
    const q = (searchEl.value || '').toLowerCase().trim();
    if (!q) { render(produtos); return; }
    render(produtos.filter(p =>
        (p.nome || p.description || '').toLowerCase().includes(q) ||
        (p.categoria || '').toLowerCase().includes(q)
    ));
}

function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── eventos ────────────────────────────────────────────────────────
btnNovo.addEventListener('click', abrirFormNovo);
btnCancelar.addEventListener('click', fecharForm);
btnSalvar.addEventListener('click', salvarProduto);
inpNome.addEventListener('keypress', e => { if (e.key === 'Enter') salvarProduto(); });
searchEl.addEventListener('input', filtrar);
document.getElementById('est-modal-confirmar').addEventListener('click', confirmarModal);
document.getElementById('est-modal-cancelar').addEventListener('click', fecharModal);
document.getElementById('est-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) fecharModal();
});

document.addEventListener('DOMContentLoaded', carregar);

// ── exporta função de desconto para Caixa ─────────────────────────
export async function descontarEstoque(produtoId, quantidade = 1) {
    try {
        const snap = await getDocs(collection(db, COL));
        let prod = null;
        snap.forEach(d => { if (d.id === produtoId) prod = { id: d.id, ...d.data() }; });
        if (!prod) return;
        const novaQty = Math.max((prod.quantidade || 0) - quantidade, 0);
        await setDoc(doc(db, COL, produtoId), { ...prod, quantidade: novaQty, atualizadoEm: serverTimestamp() });
    } catch {}
}

// Expõe lista de produtos do estoque para outros módulos (ex: Caixa)
export async function listarProdutosEstoque() {
    try {
        const snap = await getDocs(collection(db, COL));
        const lista = [];
        snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
        return lista;
    } catch { return []; }
}
