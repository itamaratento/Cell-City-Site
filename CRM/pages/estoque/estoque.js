import {
    db, collection, getDocs, doc, getDoc, setDoc, deleteDoc,
    serverTimestamp, authReady
} from "../../scripts/firebase.js";

// ── Coleções ───────────────────────────────────────────────────────────────────
const COL        = 'estoque_produtos';
const CAT_COL    = 'estoque_config';
const CAT_ID     = 'categorias';
const COL_CAIXA  = 'caixa_lancamentos';

// ── Estado ─────────────────────────────────────────────────────────────────────
let produtos   = [];
let estCats    = [];
let editandoId = null;
let catEditId  = null;
let _secao     = 'home';
let _busca     = '';

// ── Categorias padrão (semeadas na 1ª carga) ──────────────────────────────────
const CATS_PADRAO = [
    { nome:'Cabo',       icon:'🔌' }, { nome:'Capinha',    icon:'📱' },
    { nome:'Película',   icon:'🛡️' }, { nome:'Carregador', icon:'⚡' },
    { nome:'Fone',       icon:'🎧' }, { nome:'Bateria',    icon:'🔋' },
    { nome:'Tela',       icon:'📺' }, { nome:'Peça',       icon:'🔧' },
    { nome:'Acessório',  icon:'✨' }, { nome:'Outro',      icon:'📌' },
];

// ── Emojis sugeridos no icon-picker ──────────────────────────────────────────
const ICON_SUGESTOES = [
    '📁','📦','🔌','📱','🛡️','⚡','🎧','🔋','📺','🔧','✨','📌',
    '💻','🖥️','⌨️','🖱️','📷','🎮','🎵','🔊','💿','🕹️','⌚','🎒',
    '👓','🏷️','🛒','💡','🔑','🔐','📎','🗂️','🖨️','🧲','🔩','🪛',
    '📡','🔭','🧪','🎯','🛍️','🪝','🔦','⛽','🧹','📐','✂️','📋',
];

// ── Títulos de seção ───────────────────────────────────────────────────────────
const NAV_TITULOS = {
    home:           '🏠 Home',
    produtos:       '📦 Produtos',
    favoritos:      '⭐ Favoritos',
    baixo:          '⚠️ Estoque Baixo',
    zerado:         '🚫 Sem Estoque',
    categorias:     '📁 Categorias',
    rentabilidade:  '📊 Rentabilidade',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtR(v) {
    return `R$ ${Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
}
function catIcon(nome) {
    return estCats.find(c => c.nome === nome)?.icon || '📦';
}
function catPrefix(nome) {
    const s = (nome||'').replace(/[^a-zA-ZÀ-ÿ]/g,'').slice(0,3).toUpperCase();
    return s || 'OUT';
}
function parseTags(v) {
    return String(v||'').split(',').map(t=>t.trim()).filter(Boolean);
}

// ── Toast ──────────────────────────────────────────────────────────────────────
let _toastT;
const toastEl = document.getElementById('est-toast');
function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('visivel');
    clearTimeout(_toastT);
    _toastT = setTimeout(() => toastEl.classList.remove('visivel'), 2400);
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVEGAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
function navegarPara(secao) {
    _secao = secao;

    document.querySelectorAll('.est-sb-item').forEach(item =>
        item.classList.toggle('active', item.dataset.nav === secao));
    document.querySelectorAll('.est-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${secao}`)?.classList.add('active');

    const tit = document.getElementById('est-nav-titulo');
    if (tit) tit.textContent = NAV_TITULOS[secao] || secao;

    // Topbar: oculta search e "+ Produto" na seção de categorias
    const searchWrap = document.getElementById('est-topbar-search');
    const btnNovo    = document.getElementById('est-btn-novo');
    const hidden = secao === 'categorias';
    if (searchWrap) searchWrap.style.display = hidden ? 'none' : '';
    if (btnNovo)    btnNovo.style.display    = hidden ? 'none' : '';

    // Fecha sidebar mobile
    document.getElementById('est-sidebar')?.classList.remove('open');
    document.getElementById('est-sb-overlay')?.classList.remove('open');

    // Renderiza o painel
    if (secao === 'home')           renderHome();
    if (secao === 'baixo')          renderPainelSimples('baixo',    p => p.quantidade > 0 && p.quantidade <= p.quantidadeMinima);
    if (secao === 'zerado')         renderPainelSimples('zerado',   p => p.quantidade <= 0);
    if (secao === 'favoritos')      renderPainelSimples('favoritos',p => p.favorito);
    if (secao === 'categorias')     renderCategorias();
    if (secao === 'rentabilidade')  renderRentabilidade();
}

// Sidebar clicks + mobile toggle
document.querySelectorAll('.est-sb-item').forEach(item =>
    item.addEventListener('click', () => navegarPara(item.dataset.nav)));

document.getElementById('est-sb-open')?.addEventListener('click', () => {
    document.getElementById('est-sidebar')?.classList.toggle('open');
    document.getElementById('est-sb-overlay')?.classList.toggle('open');
});
document.getElementById('est-sb-overlay')?.addEventListener('click', () => {
    document.getElementById('est-sidebar')?.classList.remove('open');
    document.getElementById('est-sb-overlay')?.classList.remove('open');
});

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIAS — Firestore
// ─────────────────────────────────────────────────────────────────────────────
async function carregarCategorias() {
    try {
        const snap = await getDoc(doc(db, CAT_COL, CAT_ID));
        if (snap.exists()) {
            estCats = snap.data().itens || [];
        } else {
            estCats = CATS_PADRAO.map((c, i) => ({
                id: `cat_${Date.now()}_${i}`, nome: c.nome, icon: c.icon,
                favorita: false, ordem: i,
            }));
            await salvarCategorias();
        }
    } catch {
        estCats = CATS_PADRAO.map((c, i) => ({
            id: `cat_fb_${i}`, nome: c.nome, icon: c.icon, favorita: false, ordem: i,
        }));
    }
    popularSelectCat();
    _atualizarSbCats();
}

async function salvarCategorias() {
    await setDoc(doc(db, CAT_COL, CAT_ID), {
        itens: estCats, atualizadoEm: serverTimestamp(),
    });
}

// Popula o <select> do formulário de produto dinamicamente
function popularSelectCat() {
    const sel = document.getElementById('est-inp-cat');
    if (!sel) return;
    const atual = sel.value;
    const sorted = [...estCats].sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));
    sel.innerHTML = sorted.map(c =>
        `<option value="${escHtml(c.nome)}">${c.icon} ${escHtml(c.nome)}</option>`
    ).join('');
    if (atual && [...sel.options].some(o => o.value === atual)) sel.value = atual;
}

function _atualizarSbCats() {
    const n = estCats.length;
    ['sb-count-cats','est-total-cats'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = n;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIAS — Renderização da lista (painel Categorias)
// ─────────────────────────────────────────────────────────────────────────────
function renderCategorias() {
    const lista = document.getElementById('est-cat-lista');
    if (!lista) return;
    const sorted = [...estCats].sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));

    if (!sorted.length) {
        lista.innerHTML = '<div class="est-empty"><div class="est-empty-icon">📁</div><div class="est-empty-title">Nenhuma categoria</div><div class="est-empty-sub">Clique em ＋ Nova Categoria para começar.</div></div>';
        return;
    }

    const contagem = {};
    produtos.forEach(p => { const c = p.categoria || 'Outro'; contagem[c] = (contagem[c] || 0) + 1; });

    lista.innerHTML = sorted.map((cat, idx) => {
        const qtd      = contagem[cat.nome] || 0;
        const isFirst  = idx === 0;
        const isLast   = idx === sorted.length - 1;
        return `
        <div class="est-cat-item">
            <span class="est-cat-item-icon">${cat.icon}</span>
            <div class="est-cat-item-info">
                <div class="est-cat-item-nome">${escHtml(cat.nome)}${cat.favorita ? ' ⭐' : ''}</div>
                <div class="est-cat-item-meta">
                    <span class="est-cat-item-qtd">${qtd}</span> produto${qtd !== 1 ? 's' : ''}
                </div>
            </div>
            <div class="est-cat-item-acoes">
                <button class="est-cat-btn ord" data-mover="${cat.id}" data-dir="-1"
                    ${isFirst ? 'disabled' : ''} title="Mover para cima">▲</button>
                <button class="est-cat-btn ord" data-mover="${cat.id}" data-dir="1"
                    ${isLast ? 'disabled' : ''} title="Mover para baixo">▼</button>
                <button class="est-cat-btn fav ${cat.favorita ? 'ativo' : ''}"
                    data-fav-cat="${cat.id}" title="${cat.favorita ? 'Remover favorito' : 'Favoritar'}">⭐</button>
                <button class="est-cat-btn" data-edit-cat="${cat.id}" title="Editar">✏️</button>
                <button class="est-cat-btn del" data-del-cat="${cat.id}" title="Excluir">✕</button>
            </div>
        </div>`;
    }).join('');

    lista.querySelectorAll('[data-mover]').forEach(btn =>
        btn.addEventListener('click', () => moverCategoria(btn.dataset.mover, Number(btn.dataset.dir))));
    lista.querySelectorAll('[data-fav-cat]').forEach(btn =>
        btn.addEventListener('click', () => toggleFavCat(btn.dataset.favCat)));
    lista.querySelectorAll('[data-edit-cat]').forEach(btn =>
        btn.addEventListener('click', () => abrirFormCat(btn.dataset.editCat)));
    lista.querySelectorAll('[data-del-cat]').forEach(btn =>
        btn.addEventListener('click', () => excluirCategoria(btn.dataset.delCat)));
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIAS — CRUD
// ─────────────────────────────────────────────────────────────────────────────
function initIconPicker() {
    const container = document.getElementById('est-catf-icons');
    if (!container || container.dataset.init) return;
    container.dataset.init = '1';
    container.innerHTML = ICON_SUGESTOES.map(ic =>
        `<button class="est-catf-icon-btn" data-icon="${ic}">${ic}</button>`
    ).join('');
    container.querySelectorAll('.est-catf-icon-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.est-catf-icon-btn').forEach(b => b.classList.remove('sel'));
            btn.classList.add('sel');
            const iconInp = document.getElementById('est-catf-icon');
            const preview = document.getElementById('est-catf-preview');
            if (iconInp) iconInp.value = btn.dataset.icon;
            if (preview) preview.textContent = btn.dataset.icon;
        });
    });
}

function abrirFormCat(id = null) {
    catEditId = id;
    initIconPicker();
    const form    = document.getElementById('est-catf');
    const titulo  = document.getElementById('est-catf-titulo');
    const iconInp = document.getElementById('est-catf-icon');
    const preview = document.getElementById('est-catf-preview');
    const nomeInp = document.getElementById('est-catf-nome');

    if (id) {
        const cat = estCats.find(c => c.id === id);
        if (!cat) return;
        titulo.textContent = 'Editar Categoria';
        iconInp.value      = cat.icon;
        preview.textContent = cat.icon;
        nomeInp.value      = cat.nome;
        document.querySelectorAll('.est-catf-icon-btn').forEach(b =>
            b.classList.toggle('sel', b.dataset.icon === cat.icon));
    } else {
        titulo.textContent  = 'Nova Categoria';
        iconInp.value       = '📁';
        preview.textContent = '📁';
        nomeInp.value       = '';
        document.querySelectorAll('.est-catf-icon-btn').forEach(b => b.classList.remove('sel'));
    }

    form.style.display = 'flex';
    nomeInp.focus();
}

function fecharFormCat() {
    document.getElementById('est-catf').style.display = 'none';
    catEditId = null;
}

async function salvarCategoria() {
    const icon = document.getElementById('est-catf-icon').value.trim() || '📁';
    const nome = document.getElementById('est-catf-nome').value.trim();
    if (!nome) { document.getElementById('est-catf-nome').focus(); return; }

    if (estCats.some(c => c.nome.toLowerCase() === nome.toLowerCase() && c.id !== catEditId)) {
        toast('⚠️ Já existe uma categoria com esse nome.'); return;
    }

    if (catEditId) {
        const cat = estCats.find(c => c.id === catEditId);
        if (cat) { cat.nome = nome; cat.icon = icon; }
    } else {
        estCats.push({
            id: `cat_${Date.now()}`, nome, icon,
            favorita: false, ordem: estCats.length,
        });
    }

    try {
        await salvarCategorias();
        toast(catEditId ? '✏️ Categoria atualizada!' : '✅ Categoria criada!');
        fecharFormCat();
        popularSelectCat();
        _atualizarSbCats();
        renderCategorias();
        renderHome();
    } catch {
        toast('⚠️ Erro ao salvar categoria.');
    }
}

async function excluirCategoria(id) {
    const cat = estCats.find(c => c.id === id);
    if (!cat) return;
    const qtd = produtos.filter(p => p.categoria === cat.nome).length;
    if (qtd > 0) {
        toast(`⚠️ Mova os ${qtd} produto(s) desta categoria antes de excluí-la.`); return;
    }
    if (!confirm(`Excluir a categoria "${cat.nome}"?`)) return;
    estCats = estCats.filter(c => c.id !== id);
    try {
        await salvarCategorias();
        toast('🗑️ Categoria excluída.');
        popularSelectCat();
        _atualizarSbCats();
        renderCategorias();
        renderHome();
    } catch {
        toast('⚠️ Erro ao excluir categoria.');
    }
}

async function toggleFavCat(id) {
    const cat = estCats.find(c => c.id === id);
    if (!cat) return;
    cat.favorita = !cat.favorita;
    try {
        await salvarCategorias();
        renderCategorias();
    } catch {
        toast('⚠️ Erro ao salvar.');
    }
}

async function moverCategoria(id, dir) {
    const sorted = [...estCats].sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));
    const idx    = sorted.findIndex(c => c.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;
    const tmp             = sorted[idx].ordem;
    sorted[idx].ordem    = sorted[target].ordem;
    sorted[target].ordem = tmp;
    sorted.forEach(c => { const orig = estCats.find(x => x.id === c.id); if (orig) orig.ordem = c.ordem; });
    try {
        await salvarCategorias();
        popularSelectCat();
        renderCategorias();
        renderHome();
    } catch {
        toast('⚠️ Erro ao reordenar.');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUTOS — Carregamento
// ─────────────────────────────────────────────────────────────────────────────
async function carregar() {
    try {
        const snap = await getDocs(collection(db, COL));
        produtos = [];
        snap.forEach(d => produtos.push({ id: d.id, ...d.data() }));
        // Migração da coleção antiga
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
                    venda: Number(p.venda || 0), custo: Number(p.custo || 0),
                    favorito: false, localizacao: '', tags: [], historico: [],
                });
            });
        }
    } catch { produtos = []; }

    document.getElementById('est-loading').style.display = 'none';
    render(produtos.filter(matchBusca));
    atualizarContadores();
    // Re-renderiza painel ativo se necessário
    if (_secao === 'baixo')     renderPainelSimples('baixo',    p => p.quantidade > 0 && p.quantidade <= p.quantidadeMinima);
    if (_secao === 'zerado')    renderPainelSimples('zerado',   p => p.quantidade <= 0);
    if (_secao === 'favoritos') renderPainelSimples('favoritos',p => p.favorito);
    if (_secao === 'home')      renderHome();
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTADORES (sidebar + resumo)
// ─────────────────────────────────────────────────────────────────────────────
function atualizarContadores() {
    const baixo  = produtos.filter(p => p.quantidade > 0 && p.quantidade <= p.quantidadeMinima);
    const zerado = produtos.filter(p => p.quantidade <= 0);
    const favs   = produtos.filter(p => p.favorito);
    const setEl  = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    setEl('est-total-produtos', produtos.length);
    setEl('est-total-baixo',    baixo.length);
    setEl('est-total-zerado',   zerado.length);
    setEl('est-total-favs',     favs.length);
    setEl('est-total-cats',     estCats.length);
    setEl('sb-count-produtos',  produtos.length);
    setEl('sb-count-baixo',     baixo.length  || '');
    setEl('sb-count-zerado',    zerado.length || '');
    setEl('sb-count-favs',      favs.length   || '');
    setEl('sb-count-cats',      estCats.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────────────────────────────────────
function renderHome() {
    atualizarContadores();

    // Últimos 5 cadastrados
    const ultimos = [...produtos]
        .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0))
        .slice(0, 5);

    const ultimosEl = document.getElementById('est-home-ultimos');
    if (ultimosEl) {
        ultimosEl.innerHTML = ultimos.length
            ? ultimos.map(p => `
                <div class="est-ultimos-item" onclick="Estoque.editarProduto('${p.id}')">
                    <span class="est-ultimos-icon">${catIcon(p.categoria)}</span>
                    <div style="flex:1;min-width:0">
                        <div class="est-ultimos-nome">${escHtml(p.nome)}</div>
                        <div class="est-ultimos-cat">${escHtml(p.categoria || '—')}</div>
                    </div>
                    <span class="est-ultimos-qty">${p.quantidade}</span>
                </div>`).join('')
            : '<div style="color:var(--text3);font-size:13px;padding:8px">Nenhum produto cadastrado ainda.</div>';
    }

    // Grid de categorias
    const grid = document.getElementById('est-home-grid');
    if (!grid) return;
    const sorted   = [...estCats].sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));
    const contagem = {};
    produtos.forEach(p => { const c = p.categoria || 'Outro'; contagem[c] = (contagem[c] || 0) + 1; });

    grid.innerHTML = sorted.length
        ? sorted.map(cat => {
            const qtd = contagem[cat.nome] || 0;
            return `<div class="est-home-card" onclick="Estoque.navCat('${escHtml(cat.nome)}')">
                <span class="est-home-card-icon">${cat.icon}</span>
                ${qtd > 0 ? `<span class="est-home-card-count">${qtd}</span>` : ''}
                <span class="est-home-card-label">${escHtml(cat.nome)}</span>
            </div>`;
        }).join('')
        : '<div style="color:var(--text3);font-size:13px;grid-column:1/-1;padding:8px">Nenhuma categoria cadastrada.</div>';
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTA DE PRODUTOS (agrupada por categoria)
// ─────────────────────────────────────────────────────────────────────────────
function render(lista) {
    const container = document.getElementById('est-cats-container');
    const emptyEl   = document.getElementById('est-empty');
    if (!container) return;

    if (!lista.length) {
        container.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'flex';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    const grupos   = {};
    const catOrdem = {};
    estCats.forEach(c => { catOrdem[c.nome] = c.ordem ?? 99; });
    lista.forEach(p => {
        const cat = p.categoria || 'Outro';
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(p);
    });

    container.innerHTML = Object.entries(grupos)
        .sort(([a], [b]) => (catOrdem[a] ?? 99) - (catOrdem[b] ?? 99) || a.localeCompare(b, 'pt-BR'))
        .map(([cat, itens]) => {
            const icon  = catIcon(cat);
            const baixo = itens.filter(p => p.quantidade <= p.quantidadeMinima).length;
            const badge = baixo ? `<span class="est-cat-badge-alerta">${baixo} baixo</span>` : '';
            return `
            <div class="est-cat-group">
                <div class="est-cat-header expanded" data-cat="${escHtml(cat)}">
                    <span class="est-cat-toggle">＋</span>
                    <span class="est-cat-icon">${icon}</span>
                    <span class="est-cat-nome">${escHtml(cat)}</span>
                    <span class="est-cat-count">${itens.length}</span>
                    ${badge}
                </div>
                <div class="est-cat-lista" data-cat="${escHtml(cat)}">
                    ${itens.map(p => renderCard(p)).join('')}
                </div>
            </div>`;
        }).join('');

    _bindListEvents(container);
}

function renderCard(p) {
    const baixo  = p.quantidade <= p.quantidadeMinima;
    const qtyCls = baixo ? ' est-qty-baixo' : (p.quantidade > p.quantidadeMinima * 2 ? ' est-qty-ok' : '');
    const tags   = Array.isArray(p.tags) ? p.tags : (p.tags ? parseTags(p.tags) : []);
    const tagsHtml  = tags.length ? `<div class="est-card-tags">${tags.map(t => `<span class="est-tag">${escHtml(t)}</span>`).join('')}</div>` : '';
    const localHtml = p.localizacao ? `<span class="est-card-local">${escHtml(p.localizacao)}</span>` : '';
    return `
    <div class="est-card${baixo ? ' est-card-alerta' : ''}">
        <div class="est-card-info">
            <div class="est-card-nome">${escHtml(p.nome || p.description || '—')}</div>
            <div class="est-card-meta">
                <span class="est-card-preco">${fmtR(p.venda)}</span>
                ${p.custo ? `<span class="est-card-custo">Custo: ${fmtR(p.custo)}</span>` : ''}
                ${p.codigoBarras ? `<span class="est-card-cod">${escHtml(p.codigoBarras)}</span>` : ''}
                ${localHtml}
            </div>
            ${tagsHtml}
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
            <button class="est-card-fav ${p.favorito ? 'ativo' : ''}" data-fav="${p.id}" title="${p.favorito ? 'Remover favorito' : 'Favoritar'}">⭐</button>
            <button class="est-card-hist" data-hist="${p.id}" title="Histórico de movimentações">📋</button>
            ${p.codigoBarras ? `<button class="est-card-print" data-print="${p.id}" title="Imprimir etiqueta">🖨️</button>` : ''}
            <button class="est-card-edit" data-edit="${p.id}" title="Editar">✏️</button>
            <button class="est-card-del"  data-del="${p.id}"  title="Excluir">✕</button>
        </div>
    </div>`;
}

function _bindListEvents(root) {
    // Collapse categoria
    root.querySelectorAll('.est-cat-header').forEach(header => {
        header.addEventListener('click', () => {
            const cat   = header.dataset.cat;
            const lista = root.querySelector(`.est-cat-lista[data-cat="${CSS.escape(cat)}"]`);
            if (lista) { header.classList.toggle('expanded'); lista.classList.toggle('collapsed'); }
        });
    });
    root.querySelectorAll('[data-print]').forEach(btn =>
        btn.addEventListener('click', () => { const p = produtos.find(x=>x.id===btn.dataset.print); if(p) imprimirEtiqueta(p); }));
    root.querySelectorAll('[data-edit]').forEach(btn =>
        btn.addEventListener('click', () => abrirFormEdicao(btn.dataset.edit)));
    root.querySelectorAll('[data-del]').forEach(btn =>
        btn.addEventListener('click', () => excluir(btn.dataset.del)));
    root.querySelectorAll('[data-entrada]').forEach(btn =>
        btn.addEventListener('click', () => abrirModal('entrada', btn.dataset.entrada)));
    root.querySelectorAll('[data-saida]').forEach(btn =>
        btn.addEventListener('click', () => abrirModal('saida', btn.dataset.saida)));
    root.querySelectorAll('[data-fav]').forEach(btn =>
        btn.addEventListener('click', () => toggleFavProd(btn.dataset.fav)));
    root.querySelectorAll('[data-hist]').forEach(btn =>
        btn.addEventListener('click', () => abrirHist(btn.dataset.hist)));
}

// ─────────────────────────────────────────────────────────────────────────────
// PAINÉIS SIMPLES (Favoritos / Baixo / Zerado)
// ─────────────────────────────────────────────────────────────────────────────
function renderPainelSimples(secao, filtro) {
    const ids  = { baixo:'est-baixo-lista', zerado:'est-zerado-lista', favoritos:'est-favs-lista' };
    const vids = { baixo:'est-baixo-vazio', zerado:'est-zerado-vazio', favoritos:'est-favs-vazio' };
    const listaEl = document.getElementById(ids[secao]);
    const vazioEl = document.getElementById(vids[secao]);
    if (!listaEl) return;

    const itens = produtos.filter(filtro);
    if (!itens.length) {
        listaEl.innerHTML = '';
        if (vazioEl) vazioEl.style.display = 'flex';
        return;
    }
    if (vazioEl) vazioEl.style.display = 'none';
    listaEl.innerHTML = `<div class="est-cat-lista" style="border:1px solid var(--border);border-radius:10px;overflow:hidden">
        ${itens.map(p => renderCard(p)).join('')}
    </div>`;
    _bindListEvents(listaEl);
}

// ─────────────────────────────────────────────────────────────────────────────
// FAVORITOS DE PRODUTO
// ─────────────────────────────────────────────────────────────────────────────
async function toggleFavProd(id) {
    const p = produtos.find(x => x.id === id);
    if (!p) return;
    p.favorito = !p.favorito;
    try {
        await setDoc(doc(db, COL, id), { ...p, atualizadoEm: serverTimestamp() });
        toast(p.favorito ? '⭐ Produto favoritado.' : 'Favorito removido.');
        render(produtos.filter(matchBusca));
        atualizarContadores();
        if (_secao === 'favoritos') renderPainelSimples('favoritos', x => x.favorito);
    } catch { toast('⚠️ Erro ao salvar.'); }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSCA
// ─────────────────────────────────────────────────────────────────────────────
function matchBusca(p) {
    if (!_busca) return true;
    const q    = _busca.toLowerCase();
    const tags = Array.isArray(p.tags) ? p.tags.join(' ') : (p.tags || '');
    return (p.nome        || '').toLowerCase().includes(q) ||
           (p.categoria   || '').toLowerCase().includes(q) ||
           (p.codigoBarras|| '').toLowerCase().includes(q) ||
           (p.localizacao || '').toLowerCase().includes(q) ||
           tags.toLowerCase().includes(q);
}

function filtrar() {
    _busca = (document.getElementById('est-search').value || '').trim();
    render(produtos.filter(matchBusca));
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMULÁRIO DE PRODUTO
// ─────────────────────────────────────────────────────────────────────────────
function abrirFormNovo() {
    editandoId = null;
    document.getElementById('est-form-titulo').textContent = 'Novo Produto';
    ['est-inp-nome','est-inp-venda','est-inp-custo','est-inp-codigo','est-inp-local','est-inp-tags'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('est-inp-qty').value = '0';
    document.getElementById('est-inp-min').value = '1';
    document.getElementById('est-form').style.display = 'flex';
    document.getElementById('est-btn-novo').style.display = 'none';
    document.getElementById('est-inp-nome').focus();
    if (_secao !== 'produtos') navegarPara('produtos');
}

function abrirFormEdicao(id) {
    const p = produtos.find(x => x.id === id);
    if (!p) return;
    editandoId = id;
    document.getElementById('est-form-titulo').textContent   = 'Editar Produto';
    document.getElementById('est-inp-nome').value            = p.nome || p.description || '';
    document.getElementById('est-inp-cat').value             = p.categoria || '';
    document.getElementById('est-inp-qty').value             = p.quantidade ?? 0;
    document.getElementById('est-inp-min').value             = p.quantidadeMinima ?? 1;
    document.getElementById('est-inp-venda').value           = p.venda || '';
    document.getElementById('est-inp-custo').value           = p.custo || '';
    document.getElementById('est-inp-codigo').value          = p.codigoBarras || '';
    document.getElementById('est-inp-local').value           = p.localizacao || '';
    document.getElementById('est-inp-tags').value            = Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || '');
    document.getElementById('est-form').style.display        = 'flex';
    document.getElementById('est-btn-novo').style.display    = 'none';
    document.getElementById('est-inp-nome').focus();
    if (_secao !== 'produtos') navegarPara('produtos');
}

function fecharForm() {
    document.getElementById('est-form').style.display     = 'none';
    document.getElementById('est-btn-novo').style.display = '';
    editandoId = null;
}

async function salvarProduto() {
    const nome = document.getElementById('est-inp-nome').value.trim();
    if (!nome) { document.getElementById('est-inp-nome').focus(); return; }

    const cat              = document.getElementById('est-inp-cat').value;
    const codigoExistente  = editandoId ? produtos.find(p => p.id === editandoId)?.codigoBarras : null;
    const codigoBarras     = document.getElementById('est-inp-codigo').value.trim() || codigoExistente || `CC-${catPrefix(cat)}-${Date.now().toString().slice(-6)}`;
    const tags             = parseTags(document.getElementById('est-inp-tags').value);
    const localizacao      = document.getElementById('est-inp-local').value.trim();

    const base = {
        nome, categoria: cat, codigoBarras,
        quantidade:       Number(document.getElementById('est-inp-qty').value)   || 0,
        quantidadeMinima: Number(document.getElementById('est-inp-min').value)   || 1,
        venda:            Number(document.getElementById('est-inp-venda').value) || 0,
        custo:            Number(document.getElementById('est-inp-custo').value) || 0,
        localizacao, tags, atualizadoEm: serverTimestamp(),
    };

    const existing = editandoId ? produtos.find(p => p.id === editandoId) : null;
    const dados    = existing
        ? { ...existing, ...base }
        : { ...base, favorito: false, historico: [], criadoEm: serverTimestamp() };

    const id = editandoId || `prod_${Date.now()}`;
    try {
        await setDoc(doc(db, COL, id), dados);
        toast(editandoId ? '✏️ Produto atualizado!' : '✅ Produto adicionado!');
        fecharForm();
        await carregar();
    } catch { toast('⚠️ Erro ao salvar.'); }
}

async function excluir(id) {
    if (!confirm('Excluir este produto do estoque?')) return;
    try {
        await deleteDoc(doc(db, COL, id));
        toast('🗑️ Produto removido.');
        await carregar();
    } catch { toast('⚠️ Erro ao excluir.'); }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL DE MOVIMENTAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
let modalTipo   = null;
let modalProdId = null;

function abrirModal(tipo, id) {
    modalTipo   = tipo;
    modalProdId = id;
    const prod  = produtos.find(p => p.id === id);
    document.getElementById('est-modal-titulo').textContent =
        tipo === 'entrada' ? `➕ Entrada — ${prod?.nome || ''}` : `➖ Saída — ${prod?.nome || ''}`;
    document.getElementById('est-modal-label').textContent =
        tipo === 'entrada' ? 'Quantidade a adicionar' : 'Quantidade a retirar';
    document.getElementById('est-modal-qty').value = '1';
    document.getElementById('est-modal-obs').value = '';
    document.getElementById('est-modal-overlay').style.display = 'flex';
    setTimeout(() => document.getElementById('est-modal-qty').focus(), 80);
}

async function confirmarModal() {
    const qty = Number(document.getElementById('est-modal-qty').value) || 0;
    if (qty <= 0) return;
    const obs  = document.getElementById('est-modal-obs').value.trim();
    const prod = produtos.find(p => p.id === modalProdId);
    if (!prod) return;

    const novaQty = modalTipo === 'entrada'
        ? prod.quantidade + qty
        : Math.max(prod.quantidade - qty, 0);

    // Adiciona entrada no histórico (FIFO, máx 30)
    const hist = Array.isArray(prod.historico) ? [...prod.historico] : [];
    hist.unshift({
        tipo: modalTipo, qty, obs,
        dt: new Date().toLocaleDateString('pt-BR', {
            day:'2-digit', month:'2-digit', year:'2-digit',
            hour:'2-digit', minute:'2-digit',
        }),
    });
    if (hist.length > 30) hist.length = 30;

    try {
        await setDoc(doc(db, COL, modalProdId), {
            ...prod, quantidade: novaQty, historico: hist, atualizadoEm: serverTimestamp(),
        });
        fecharModal();
        toast(modalTipo === 'entrada' ? `+${qty} unidades adicionadas.` : `-${qty} unidades retiradas.`);
        await carregar();
    } catch { toast('⚠️ Erro ao movimentar.'); }
}

function fecharModal() {
    document.getElementById('est-modal-overlay').style.display = 'none';
    modalTipo = null; modalProdId = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTÓRICO DE MOVIMENTAÇÕES
// ─────────────────────────────────────────────────────────────────────────────
function abrirHist(id) {
    const prod = produtos.find(p => p.id === id);
    if (!prod) return;
    document.getElementById('est-hist-titulo').textContent = `📋 ${prod.nome}`;
    const hist = Array.isArray(prod.historico) ? prod.historico : [];
    const body = document.getElementById('est-hist-body');
    body.innerHTML = hist.length
        ? hist.map(h => `
            <div class="est-hist-entry">
                <span class="est-hist-tipo">${h.tipo === 'entrada' ? '➕' : '➖'}</span>
                <div class="est-hist-info">
                    <span class="est-hist-qty ${h.tipo}">${h.tipo === 'entrada' ? '+' : '-'}${h.qty}</span>
                    ${h.obs ? `<div class="est-hist-obs">${escHtml(h.obs)}</div>` : ''}
                </div>
                <span class="est-hist-dt">${h.dt || '—'}</span>
            </div>`).join('')
        : '<div class="est-hist-vazio">Nenhuma movimentação registrada ainda.<br>Use os botões + / − para movimentar.</div>';
    document.getElementById('est-hist-overlay').style.display = 'flex';
}

// ─────────────────────────────────────────────────────────────────────────────
// ETIQUETA
// ─────────────────────────────────────────────────────────────────────────────
function imprimirEtiqueta(produto) {
    const codigo = produto.codigoBarras;
    if (!codigo) { toast('⚠️ Produto sem código de barras.'); return; }
    const venda = Number(produto.venda || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
    const win   = window.open('', '_blank', 'width=420,height=320,menubar=no,toolbar=no');
    if (!win) { toast('⚠️ Permita pop-ups para imprimir etiquetas'); return; }
    win.document.write(`<!DOCTYPE html><html><head>
<title>Etiqueta</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<style>
@page{margin:3mm;size:80mm 50mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff}
.etq{width:72mm;padding:3mm;text-align:center}
.nome{font-size:11px;font-weight:bold;margin-bottom:2mm;line-height:1.2}
.preco{font-size:12px;font-weight:bold;margin-bottom:2mm}
svg{max-width:100%;height:auto}
.cod{font-size:8px;color:#555;margin-top:1mm;font-family:monospace;letter-spacing:1px}
@media print{body{min-height:0}}
</style></head><body>
<div class="etq">
<div class="nome">${escHtml(produto.nome)}</div>
<div class="preco">${venda}</div>
<svg id="bcode"></svg>
<div class="cod">${escHtml(codigo)}</div>
</div>
<script>
try{JsBarcode("#bcode","${codigo}",{format:"CODE128",width:1.8,height:40,displayValue:false,margin:2,background:"#fff",lineColor:"#000"});}catch(e){}
window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},400);},300);};
<\/script></body></html>`);
    win.document.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTOS
// ─────────────────────────────────────────────────────────────────────────────
document.getElementById('est-btn-novo')?.addEventListener('click', abrirFormNovo);
document.getElementById('est-btn-cancelar')?.addEventListener('click', fecharForm);
document.getElementById('est-btn-salvar')?.addEventListener('click', salvarProduto);
document.getElementById('est-inp-nome')?.addEventListener('keypress', e => { if (e.key === 'Enter') salvarProduto(); });

document.getElementById('est-search')?.addEventListener('input', filtrar);
document.getElementById('est-search')?.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const q = document.getElementById('est-search').value.trim();
    const match = produtos.find(p => p.codigoBarras === q);
    if (match) toast(`📦 ${match.nome}  —  Qtd: ${match.quantidade}`);
});

document.getElementById('est-modal-confirmar')?.addEventListener('click', confirmarModal);
document.getElementById('est-modal-cancelar')?.addEventListener('click',  fecharModal);
document.getElementById('est-modal-overlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) fecharModal(); });
document.getElementById('est-hist-overlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('est-hist-overlay').style.display = 'none'; });

document.getElementById('est-btn-nova-cat')?.addEventListener('click', () => abrirFormCat());
document.getElementById('est-catf-salvar')?.addEventListener('click', salvarCategoria);
document.getElementById('est-catf-cancelar')?.addEventListener('click', fecharFormCat);
document.getElementById('est-catf-nome')?.addEventListener('keypress', e => { if (e.key === 'Enter') salvarCategoria(); });
document.getElementById('est-catf-icon')?.addEventListener('input', e => {
    const preview = document.getElementById('est-catf-preview');
    if (preview) preview.textContent = e.target.value || '📁';
});

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA (chamada via onclick no HTML)
// ─────────────────────────────────────────────────────────────────────────────
window.Estoque = {
    nav(secao)     { navegarPara(secao); },
    navCat(cat)    {
        navegarPara('produtos');
        _busca = cat;
        const s = document.getElementById('est-search');
        if (s) s.value = cat;
        render(produtos.filter(matchBusca));
    },
    editarProduto(id) {
        navegarPara('produtos');
        abrirFormEdicao(id);
    },
    fecharHist() {
        document.getElementById('est-hist-overlay').style.display = 'none';
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await authReady;
    await carregarCategorias();
    await carregar();
    navegarPara('home');
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS — usados pelo módulo Caixa
// ─────────────────────────────────────────────────────────────────────────────
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

export async function listarProdutosEstoque() {
    try {
        const snap = await getDocs(collection(db, COL));
        const lista = [];
        snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
        return lista;
    } catch { return []; }
}

export async function buscarPorCodigoBarras(codigo) {
    const local = produtos.find(p => p.codigoBarras === codigo);
    if (local) return local;
    try {
        const snap = await getDocs(collection(db, COL));
        let found = null;
        snap.forEach(d => { if (d.data().codigoBarras === codigo) found = { id: d.id, ...d.data() }; });
        return found;
    } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// RENTABILIDADE — Painel de análise de lucratividade por produto
// ─────────────────────────────────────────────────────────────────────────────
let _rentOrdem = 'receita';
let _rentCache = null; // {lancamentos}

async function renderRentabilidade() {
    const loadEl = document.getElementById('rent-loading');
    if (loadEl) loadEl.style.display = 'flex';

    // Bind botões de ordem
    document.querySelectorAll('.est-rent-filtro').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.est-rent-filtro').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _rentOrdem = btn.dataset.ord;
            _renderRentTabela(_rentCache);
        };
    });

    // Carrega caixa_lancamentos (cache simples p/ sessão)
    if (!_rentCache) {
        try {
            const snap = await getDocs(collection(db, COL_CAIXA));
            _rentCache = [];
            snap.forEach(d => _rentCache.push({ id: d.id, ...d.data() }));
        } catch { _rentCache = []; }
    }
    if (loadEl) loadEl.style.display = 'none';
    _renderRentTabela(_rentCache);
}

function _renderRentTabela(lancamentos) {
    // Agrupa apenas entradas e serviços (vendas) por descrição
    const vendas = (lancamentos || []).filter(l => l.tipo === 'entrada' || l.tipo === 'servico');

    // Mapa: nome_produto → { qtd, receita, custo }
    const mapa = {};
    for (const l of vendas) {
        const nome = (l.descricao || '').trim();
        if (!nome) continue;
        const custo = Number(l.custo || 0);
        if (!mapa[nome]) mapa[nome] = { nome, qtd: 0, receita: 0, custo: 0 };
        mapa[nome].qtd++;
        mapa[nome].receita += Number(l.valor || 0);
        mapa[nome].custo   += custo;
    }

    let lista = Object.values(mapa).map(p => ({
        ...p,
        lucro:  p.receita - p.custo,
        margem: p.receita > 0 ? ((p.receita - p.custo) / p.receita) * 100 : 0,
    }));

    // Ordenação
    if (_rentOrdem === 'receita') lista.sort((a, b) => b.receita - a.receita);
    if (_rentOrdem === 'lucro')   lista.sort((a, b) => b.lucro - a.lucro);
    if (_rentOrdem === 'margem')  lista.sort((a, b) => a.margem - b.margem);
    if (_rentOrdem === 'qtd')     lista.sort((a, b) => b.qtd - a.qtd);

    // Totais
    const totReceita = lista.reduce((s, p) => s + p.receita, 0);
    const totCPV     = lista.reduce((s, p) => s + p.custo, 0);
    const totLucro   = totReceita - totCPV;
    const totMargem  = totReceita > 0 ? (totLucro / totReceita) * 100 : 0;

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('rent-receita-total', fmtR(totReceita));
    setEl('rent-cpv-total',     fmtR(totCPV));
    setEl('rent-lucro-total',   fmtR(totLucro));
    setEl('rent-margem-total',  `${totMargem.toFixed(1)}%`);

    const tabelaEl = document.getElementById('est-rent-tabela');
    if (!tabelaEl) return;

    if (!lista.length) {
        tabelaEl.innerHTML = '<div class="est-empty"><div class="est-empty-icon">📊</div><div class="est-empty-title">Sem dados de vendas</div><div class="est-empty-sub">As vendas registradas no Caixa aparecerão aqui com custo automático.</div></div>';
        return;
    }

    tabelaEl.innerHTML = `
        <div class="est-rent-table">
            <div class="est-rent-thead">
                <div class="est-rent-th est-rent-col-nome">Produto</div>
                <div class="est-rent-th est-rent-col-num">Vendas</div>
                <div class="est-rent-th est-rent-col-num">Receita</div>
                <div class="est-rent-th est-rent-col-num">CPV</div>
                <div class="est-rent-th est-rent-col-num">Lucro</div>
                <div class="est-rent-th est-rent-col-num">Margem</div>
            </div>
            ${lista.slice(0, 50).map(p => {
                const margemCor = p.margem >= 40 ? '#00c853' : p.margem >= 20 ? '#f9a825' : '#f44336';
                return `<div class="est-rent-row">
                    <div class="est-rent-td est-rent-col-nome">${escHtml(p.nome)}</div>
                    <div class="est-rent-td est-rent-col-num">${p.qtd}</div>
                    <div class="est-rent-td est-rent-col-num">${fmtR(p.receita)}</div>
                    <div class="est-rent-td est-rent-col-num est-rent-custo">${fmtR(p.custo)}</div>
                    <div class="est-rent-td est-rent-col-num est-rent-lucro">${fmtR(p.lucro)}</div>
                    <div class="est-rent-td est-rent-col-num" style="color:${margemCor};font-weight:700">${p.margem.toFixed(1)}%</div>
                </div>`;
            }).join('')}
        </div>`;
}
