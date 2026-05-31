import { db, collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from '../../scripts/firebase.js';

const COL_COMPRAS    = 'fornecedor_compras';
const COL_TENDENCIAS = 'fornecedor_tendencias';
const COL_ESTOQUE    = 'estoque_produtos';

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

// ── tabs ───────────────────────────────────────────────────────────
document.querySelectorAll('.forn-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.forn-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.forn-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'estoque-baixo') carregarEstoqueBaixo();
        if (btn.dataset.tab === 'mercado') carregarTendencias();
    });
});

// ── COMPRAS ────────────────────────────────────────────────────────
let todosItensCompra = []; // cache para busca

async function carregarCompras() {
    document.getElementById('compras-loading').style.display = 'flex';
    try {
        const snap = await getDocs(collection(db, COL_COMPRAS));
        todosItensCompra = [];
        snap.forEach(d => todosItensCompra.push({ id: d.id, ...d.data() }));
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
    listaEl.innerHTML = itens.map(item => `
        <div class="forn-card">
            <div class="forn-card-info">
                <div class="forn-card-nome">${escHtml(item.nome)}</div>
                <div class="forn-card-sub">
                    Qtd: <strong>${item.quantidade || 1}</strong>
                    ${item.obs ? ` · ${escHtml(item.obs)}` : ''}
                </div>
            </div>
            <div class="forn-card-dir">
                <span class="forn-urg">${URGENCIA_ICON[item.urgencia] || '🟡'}</span>
                <button class="forn-card-edit" data-id="${item.id}" title="Editar">✏️</button>
                <button class="forn-card-comprado" data-id="${item.id}" title="Marcar como comprado e remover">✓ Comprado</button>
                <button class="forn-card-del" data-id="${item.id}" title="Excluir">🗑️ Excluir</button>
            </div>
        </div>
    `).join('');

    listaEl.querySelectorAll('.forn-card-edit').forEach(btn => {
        btn.addEventListener('click', () => abrirFormCompraEdicao(btn.dataset.id, todosItensCompra));
    });
    listaEl.querySelectorAll('.forn-card-comprado').forEach(btn => {
        btn.addEventListener('click', async () => {
            await excluirCompraById(btn.dataset.id, '✅ Compra concluída! Item removido da lista.');
        });
    });
    listaEl.querySelectorAll('.forn-card-del').forEach(btn => {
        btn.addEventListener('click', () => excluirCompra(btn.dataset.id));
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
        await setDoc(doc(db, COL_COMPRAS, id), dados);
        toast(editandoCompraId ? '✏️ Item atualizado!' : '✅ Item adicionado!');
        fecharFormCompra();
        await carregarCompras();
    } catch { toast('⚠ Erro ao salvar.'); }
}

async function excluirCompraById(id, mensagem = '🗑️ Item removido.') {
    try {
        await deleteDoc(doc(db, COL_COMPRAS, id));
        toast(mensagem);
        await carregarCompras();
    } catch { toast('⚠ Erro ao excluir.'); }
}

async function excluirCompra(id) {
    if (!confirm('Excluir este item da lista de compras?')) return;
    await excluirCompraById(id);
}

// ── ESTOQUE BAIXO ──────────────────────────────────────────────────
async function carregarEstoqueBaixo() {
    document.getElementById('baixo-loading').style.display = 'flex';
    try {
        const snap = await getDocs(collection(db, COL_ESTOQUE));
        const baixo = [];
        snap.forEach(d => {
            const p = { id: d.id, ...d.data() };
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
        const snap = await getDocs(collection(db, COL_TENDENCIAS));
        const itens = [];
        snap.forEach(d => itens.push({ id: d.id, ...d.data() }));
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
                await deleteDoc(doc(db, COL_TENDENCIAS, btn.dataset.id));
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
        await setDoc(doc(db, COL_TENDENCIAS, `tend_${Date.now()}`), dados);
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
document.getElementById('forn-btn-listar')?.addEventListener('click', () => {
    const inp = document.getElementById('forn-busca-global');
    if (inp) inp.value = '';
    renderCompras(todosItensCompra);
});

document.addEventListener('DOMContentLoaded', carregarCompras);
