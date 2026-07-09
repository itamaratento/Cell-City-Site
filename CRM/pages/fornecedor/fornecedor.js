import { serverTimestamp } from '../../firebase/client.js';
import { db, collection, getDocs, doc, setDoc, deleteDoc } from '../../scripts/firebase.js';
import { FornecedorComprasRepository as FornecedorCompras, FornecedorTendenciasRepository as FornecedorTendencias } from '../../repositories/fornecedor.repository.js';
import { EstoqueRepository as Estoque } from '../../repositories/estoque.repository.js';

const COL_COMPRAS    = 'fornecedor_compras';
const COL_TENDENCIAS = 'fornecedor_tendencias';
const COL_ESTOQUE    = 'estoque_produtos';
const COL_FORN       = 'fornecedores_cadastro';

const URGENCIA_ICON = { alta: '🔴', media: '🟡', baixa: '🟢' };
const TEND_ICON     = { crescendo: '📈', estavel: '➡️', caindo: '📉' };

let editandoCompraId = null;

// ── toast ──────────────────────────────────────────────────────────
const toastEl = document.getElementById('forn-toast');
let toastTimer;
function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), 2200);
}

// ── toggle busca ───────────────────────────────────────────────────
const toggleBuscaBtn = document.getElementById('forn-toggle-busca');
const buscaWrap = document.getElementById('forn-busca-wrap');
toggleBuscaBtn?.addEventListener('click', () => {
    buscaWrap.classList.toggle('forn-busca-collapsed');
    toggleBuscaBtn.classList.toggle('expanded');
});

// ── tabs ───────────────────────────────────────────────────────────
document.querySelectorAll('.forn-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.forn-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.forn-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'estoque-baixo') carregarEstoqueBaixo();
        if (btn.dataset.tab === 'mercado') carregarTendencias();
        if (btn.dataset.tab === 'fornecedores') carregarFornecedores();
    });
});

// ── COMPRAS ────────────────────────────────────────────────────────
let todosItensCompra = []; // cache para busca

async function carregarCompras() {
    document.getElementById('compras-loading').style.display = 'flex';
    try {
        todosItensCompra = await FornecedorCompras.list();
        todosItensCompra.sort((a, b) => {
            const p = { alta: 0, media: 1, baixa: 2 };
            return (p[a.urgencia] ?? 1) - (p[b.urgencia] ?? 1);
        });
        renderCompras(todosItensCompra);
    } catch {
        todosItensCompra = [];
        renderCompras([]);
    }
    document.getElementById('compras-loading').style.display = 'none';
}

function filtrarCompras() {
    const q = (document.getElementById('forn-busca-global')?.value || '').trim().toLowerCase();
    if (!q) { renderCompras(todosItensCompra); return; }
    renderCompras(todosItensCompra.filter(item =>
        (item.nome || '').toLowerCase().includes(q) ||
        (item.obs  || '').toLowerCase().includes(q)
    ));
}

function renderCompras(itens) {
    const listaEl = document.getElementById('compras-lista');
    const emptyEl = document.getElementById('compras-empty');
    if (!itens.length) { listaEl.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
    emptyEl.style.display = 'none';
    listaEl.innerHTML = itens.map(item => {
        const feita = item.status === 'feita';
        return `
        <div class="forn-card${feita ? ' forn-card--feita' : ''}">
            <div class="forn-card-info">
                <div class="forn-card-nome">${escHtml(item.nome)}${feita ? ' <span class="forn-badge-feita">✅ feita</span>' : ''}</div>
                <div class="forn-card-sub">
                    Qtd: <strong>${item.quantidade || 1}</strong>
                    ${item.obs ? ` · ${escHtml(item.obs)}` : ''}
                </div>
            </div>
            <div class="forn-card-dir">
                <span class="forn-urg">${URGENCIA_ICON[item.urgencia] || '🟡'}</span>
                <button class="forn-card-edit" data-id="${item.id}" title="Editar">✏️</button>
                <button class="forn-card-comprado" data-id="${item.id}" title="Comprado — remove da lista">✓ Comprado</button>
                <button class="forn-card-feita${feita ? ' marcado' : ''}" data-id="${item.id}" data-feita="${feita}" title="${feita ? 'Desmarcar feita' : 'Marcar tarefa como feita'}">${feita ? '↩ Desmarcar' : '✅ Feita'}</button>
            </div>
        </div>`;
    }).join('');

    listaEl.querySelectorAll('.forn-card-edit').forEach(btn => {
        btn.addEventListener('click', () => abrirFormCompraEdicao(btn.dataset.id, todosItensCompra));
    });
    listaEl.querySelectorAll('.forn-card-comprado').forEach(btn => {
        btn.addEventListener('click', () => excluirCompraById(btn.dataset.id, '✅ Comprado! Item removido da lista.'));
    });
    listaEl.querySelectorAll('.forn-card-feita').forEach(btn => {
        btn.addEventListener('click', () => concluirCompra(btn.dataset.id, btn.dataset.feita === 'true'));
    });
}

function abrirFormCompra() {
    editandoCompraId = null;
    document.getElementById('form-compra-titulo').textContent = 'Novo Item para Comprar';
    document.getElementById('fc-nome').value   = '';
    document.getElementById('fc-qty').value    = '1';
    document.getElementById('fc-urgencia').value = 'media';
    document.getElementById('fc-obs').value    = '';
    document.getElementById('form-compra').style.display = 'flex';
    document.getElementById('btn-nova-compra').style.display = 'none';
    document.getElementById('fc-nome').focus();
}

function abrirFormCompraEdicao(id, itens) {
    const item = itens.find(x => x.id === id);
    if (!item) return;
    editandoCompraId = id;
    document.getElementById('form-compra-titulo').textContent = 'Editar Item';
    document.getElementById('fc-nome').value     = item.nome || '';
    document.getElementById('fc-qty').value      = item.quantidade || 1;
    document.getElementById('fc-urgencia').value = item.urgencia || 'media';
    document.getElementById('fc-obs').value      = item.obs || '';
    document.getElementById('form-compra').style.display = 'flex';
    document.getElementById('btn-nova-compra').style.display = 'none';
    document.getElementById('fc-nome').focus();
}

function fecharFormCompra() {
    document.getElementById('form-compra').style.display = 'none';
    document.getElementById('btn-nova-compra').style.display = '';
    editandoCompraId = null;
}

async function salvarCompra() {
    const nome = document.getElementById('fc-nome').value.trim();
    if (!nome) { document.getElementById('fc-nome').focus(); return; }
    const dados = {
        nome,
        quantidade: Number(document.getElementById('fc-qty').value) || 1,
        urgencia:   document.getElementById('fc-urgencia').value,
        obs:        document.getElementById('fc-obs').value.trim(),
        atualizadoEm: serverTimestamp()
    };
    const id = editandoCompraId || `compra_${Date.now()}`;
    try {
        await FornecedorCompras.set(id, dados);
        toast(editandoCompraId ? '✏️ Item atualizado!' : '✅ Item adicionado!');
        fecharFormCompra();
        await carregarCompras();
    } catch { toast('⚠ Erro ao salvar.'); }
}

async function excluirCompraById(id, mensagem = '🗑️ Item removido.') {
    try {
        await FornecedorCompras.remove(id);
        toast(mensagem);
        await carregarCompras();
    } catch { toast('⚠ Erro ao excluir.'); }
}

async function excluirCompra(id) {
    if (!confirm('Excluir este item da lista de compras?')) return;
    await excluirCompraById(id);
}

async function concluirCompra(id, jaFeita) {
    try {
        await FornecedorCompras.update(id, { status: jaFeita ? '' : 'feita' });
        toast(jaFeita ? '↩ Desmarcado.' : '✅ Tarefa marcada como feita!');
        await carregarCompras();
    } catch { toast('⚠ Erro ao marcar.'); }
}

// ── ESTOQUE BAIXO ──────────────────────────────────────────────────
async function carregarEstoqueBaixo() {
    document.getElementById('baixo-loading').style.display = 'flex';
    try {
        const lista = await Estoque.list();
        const baixo = [];
        lista.forEach(p => {
            if (p.quantidade <= p.quantidadeMinima) baixo.push(p);
        });
        renderEstoqueBaixo(baixo);
    } catch { renderEstoqueBaixo([]); }
    document.getElementById('baixo-loading').style.display = 'none';
}

function renderEstoqueBaixo(itens) {
    const listaEl = document.getElementById('baixo-lista');
    const emptyEl = document.getElementById('baixo-empty');
    if (!itens.length) { listaEl.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
    emptyEl.style.display = 'none';
    const CAT_ICON = { 'Cabo':'🔌','Capinha':'📱','Película':'🛡️','Carregador':'⚡','Fone':'🎧','Bateria':'🔋','Tela':'📺','Peça':'🔧','Acessório':'✨','Outro':'📌' };
    listaEl.innerHTML = itens.map(p => `
        <div class="forn-card forn-card-alerta">
            <div class="forn-card-info">
                <div class="forn-card-nome">
                    ${CAT_ICON[p.categoria] || '📌'} ${escHtml(p.nome || p.description || '—')}
                </div>
                <div class="forn-card-sub">
                    Categoria: ${escHtml(p.categoria || 'Outro')} ·
                    Qtd atual: <strong style="color:#f87171">${p.quantidade}</strong> /
                    Mín: ${p.quantidadeMinima}
                </div>
            </div>
            <span class="forn-badge-alerta">⚠ Baixo</span>
        </div>
    `).join('');
}

// ── TENDÊNCIAS DE MERCADO ──────────────────────────────────────────
async function carregarTendencias() {
    try {
        const itens = await FornecedorTendencias.list();
        renderTendencias(itens);
    } catch { renderTendencias([]); }
}

function renderTendencias(itens) {
    const listaEl = document.getElementById('tendencias-lista');
    const emptyEl = document.getElementById('tendencias-empty');
    if (!itens.length) { listaEl.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
    emptyEl.style.display = 'none';
    const PRIO = { alta: '🔴', media: '🟡', baixa: '🟢' };
    listaEl.innerHTML = itens.map(item => `
        <div class="forn-card">
            <div class="forn-card-info">
                <div class="forn-card-nome">
                    ${TEND_ICON[item.tendencia] || '📈'} ${escHtml(item.produto)}
                </div>
                ${item.obs ? `<div class="forn-card-sub">${escHtml(item.obs)}</div>` : ''}
            </div>
            <div class="forn-card-dir">
                <span>${PRIO[item.prio] || '🟡'}</span>
                <button class="forn-card-del" data-id="${item.id}" title="Remover">✕</button>
            </div>
        </div>
    `).join('');

    listaEl.querySelectorAll('.forn-card-del').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Remover observação?')) return;
            try {
                await FornecedorTendencias.remove(btn.dataset.id);
                toast('🗑️ Removido.');
                await carregarTendencias();
            } catch { toast('⚠ Erro.'); }
        });
    });
}

async function salvarTendencia() {
    const produto = document.getElementById('ft-produto').value.trim();
    if (!produto) { document.getElementById('ft-produto').focus(); return; }
    const dados = {
        produto,
        tendencia:   document.getElementById('ft-tendencia').value,
        prio:        document.getElementById('ft-prio').value,
        obs:         document.getElementById('ft-obs').value.trim(),
        criadoEm:    serverTimestamp()
    };
    try {
        await FornecedorTendencias.set(`tend_${Date.now()}`, dados);
        toast('✅ Observação salva!');
        fecharFormTendencia();
        await carregarTendencias();
    } catch { toast('⚠ Erro ao salvar.'); }
}

function fecharFormTendencia() {
    document.getElementById('form-tendencia').style.display = 'none';
    document.getElementById('btn-nova-tendencia').style.display = '';
}

function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── FORNECEDORES (cadastro) ────────────────────────────────────────
let fornecedoresCache = [];
async function carregarFornecedores() {
    try {
        const snap = await getDocs(collection(db, COL_FORN));
        fornecedoresCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFornecedores(fornecedoresCache);
    } catch { fornecedoresCache = []; renderFornecedores([]); }
}
function renderFornecedores(lista) {
    const el = document.getElementById('forn-lista');
    const empty = document.getElementById('forn-empty');
    if (!lista.length) { el.innerHTML = ''; empty.style.display = 'flex'; return; }
    empty.style.display = 'none';
    el.innerHTML = lista.map(f => `<div class="forn-card" style="cursor:default">
        <div class="forn-card-info">
            <div class="forn-card-nome">${escHtml(f.nome || '—')}</div>
            <div class="forn-card-sub">
                ${f.contato ? `👤 ${escHtml(f.contato)}` : ''}
                ${f.telefone1 ? ` · 📞 ${escHtml(f.telefone1)}` : ''}
                ${f.email ? ` · ✉️ ${escHtml(f.email)}` : ''}
                ${f.cnpj ? `<br>🏛️ CNPJ: ${escHtml(f.cnpj)}` : ''}
            </div>
        </div>
        <div class="forn-card-dir">
            <button class="forn-card-edit" data-id="${f.id}" title="Editar">✏️</button>
            <button class="forn-card-del" data-id="${f.id}" title="Excluir">✕</button>
        </div>
    </div>`).join('');
    el.querySelectorAll('.forn-card-edit').forEach(b => b.addEventListener('click', () => abrirFormFornecedor(b.dataset.id)));
    el.querySelectorAll('.forn-card-del').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Excluir fornecedor?')) return;
        await deleteDoc(doc(db, COL_FORN, b.dataset.id));
        toast('🗑️ Removido.');
        await carregarFornecedores();
    }));
}
function abrirFormFornecedor(id) {
    const f = id ? fornecedoresCache.find(x => x.id === id) : null;
    document.getElementById('ff-titulo').textContent = f ? 'Editar Fornecedor' : 'Novo Fornecedor';
    ['nome','contato','telefone1','telefone2','email','cnpj','endereco','cidade','estado','obs'].forEach(campo => {
        document.getElementById('ff-' + campo).value = f?.[campo] || '';
    });
    document.getElementById('ff-salvar').dataset.id = id || '';
    document.getElementById('form-fornecedor').style.display = 'flex';
    document.getElementById('btn-nova-fornecedor').style.display = 'none';
}
function fecharFormFornecedor() {
    document.getElementById('form-fornecedor').style.display = 'none';
    document.getElementById('btn-nova-fornecedor').style.display = '';
}
async function salvarFornecedor() {
    const dados = {};
    ['nome','contato','telefone1','telefone2','email','cnpj','endereco','cidade','estado','obs'].forEach(campo => {
        dados[campo] = document.getElementById('ff-' + campo).value.trim();
    });
    if (!dados.nome) { toast('⚠ Informe o nome do fornecedor'); return; }
    const id = document.getElementById('ff-salvar').dataset.id || `forn_${Date.now()}`;
    try {
        await setDoc(doc(db, COL_FORN, id), { ...dados, atualizadoEm: serverTimestamp() });
        toast(id ? '✏️ Fornecedor atualizado!' : '✅ Fornecedor salvo!');
        fecharFormFornecedor();
        await carregarFornecedores();
    } catch { toast('⚠ Erro ao salvar.'); }
}

// ── eventos ────────────────────────────────────────────────────────
document.getElementById('btn-nova-compra').addEventListener('click', abrirFormCompra);
document.getElementById('fc-salvar').addEventListener('click', salvarCompra);
document.getElementById('fc-cancelar').addEventListener('click', fecharFormCompra);
document.getElementById('fc-nome').addEventListener('keypress', e => { if (e.key === 'Enter') salvarCompra(); });

document.getElementById('btn-nova-tendencia').addEventListener('click', () => {
    document.getElementById('form-tendencia').style.display = 'flex';
    document.getElementById('btn-nova-tendencia').style.display = 'none';
    document.getElementById('ft-produto').focus();
});
document.getElementById('ft-salvar').addEventListener('click', salvarTendencia);
document.getElementById('ft-cancelar').addEventListener('click', fecharFormTendencia);

// busca global
document.getElementById('forn-busca-global')?.addEventListener('input', filtrarCompras);
document.getElementById('btn-nova-fornecedor')?.addEventListener('click', () => abrirFormFornecedor(null));
document.getElementById('ff-salvar')?.addEventListener('click', salvarFornecedor);
document.getElementById('ff-cancelar')?.addEventListener('click', fecharFormFornecedor);
document.getElementById('forn-btn-listar')?.addEventListener('click', async () => {
    if (!todosItensCompra.length) { toast('⚠ Lista já está vazia.'); return; }
    if (!confirm(`Apagar todos os ${todosItensCompra.length} itens da lista de compras? Esta ação não pode ser desfeita.`)) return;
    try {
        await Promise.all(todosItensCompra.map(item => FornecedorCompras.remove(item.id)));
        toast('🗑️ Lista limpa com sucesso!');
        await carregarCompras();
    } catch { toast('⚠ Erro ao limpar a lista.'); }
});

document.addEventListener('DOMContentLoaded', carregarCompras);
