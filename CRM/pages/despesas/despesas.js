/* ============================================================
   DESPESAS — Módulo de despesas Cell City CRM
   Coleções Firestore:
     financeiro_despesas          — registros de despesas
     financeiro_cat_despesas      — categorias personalizadas
     financeiro_centros_custo     — centros de custo
   ============================================================ */
import {
    db, collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp
} from '../../scripts/firebase.js';
import { logAudit }                   from '../../shared/auditoria.js';
import { moverParaLixeira }           from '../../shared/lixeira.js';
import { mostrarMenuExportar }        from '../../shared/exportar.js';
import { uploadAnexo, renderAnexos, selecionarArquivo } from '../../shared/anexos.js';

const COL_DESPESAS  = 'financeiro_despesas';
const COL_CATS      = 'financeiro_cat_despesas';
const COL_CENTROS   = 'financeiro_centros_custo';

const fmt = v => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const hoje = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => new Date().toISOString().slice(0, 7);
const $ = id => document.getElementById(id);

/* ── Categorias padrão ────────────────────────────────────────── */
const CATS_PADRAO = [
    { id: '_alimentacao', nome: 'Alimentação',     icone: '🍔', padrao: true },
    { id: '_combustivel', nome: 'Combustível',     icone: '⛽', padrao: true },
    { id: '_limpeza',     nome: 'Limpeza',         icone: '🧹', padrao: true },
    { id: '_mercadorias', nome: 'Mercadorias',     icone: '📦', padrao: true },
    { id: '_estrutura',   nome: 'Estrutura',       icone: '🏗️', padrao: true },
    { id: '_tecnologia',  nome: 'Tecnologia',      icone: '💻', padrao: true },
    { id: '_marketing',   nome: 'Marketing',       icone: '📢', padrao: true },
    { id: '_transporte',  nome: 'Transporte',      icone: '🚗', padrao: true },
    { id: '_adm',         nome: 'Administrativo',  icone: '📋', padrao: true },
    { id: '_outros',      nome: 'Outros',          icone: '💡', padrao: true },
];

/* ── Centros de custo padrão ──────────────────────────────────── */
const CENTROS_PADRAO = [
    { id: '_assistencia', nome: 'Assistência Técnica', icone: '🔧', padrao: true },
    { id: '_loja',        nome: 'Loja',                icone: '🏪', padrao: true },
    { id: '_informatica', nome: 'Informática',         icone: '💻', padrao: true },
    { id: '_pessoal',     nome: 'Pessoal',             icone: '👥', padrao: true },
];

/* ── Estado ──────────────────────────────────────────────────── */
let despesasData   = [];
let catsCustom     = [];
let centrosCustom  = [];
let secaoAtiva     = 'home';
let filtroTipo     = 'todos';
let editandoId     = null;
let _anexosForm    = [];   // anexos em memória durante edição do form
let excluirCallback = null;

// contexto de modal rápido (nova cat ou novo centro a partir do form)
let quickModalCtx  = null; // 'categoria' | 'centro'

/* ── Helpers ─────────────────────────────────────────────────── */
function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatarData(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}
function todasCats() { return [...CATS_PADRAO, ...catsCustom]; }
function todosCentros() { return [...CENTROS_PADRAO, ...centrosCustom]; }
function catById(id) { return todasCats().find(c => c.id === id) || null; }
function centroById(id) { return todosCentros().find(c => c.id === id) || null; }

const PAGAMENTO_LABEL = {
    dinheiro: '💵 Dinheiro', pix: '💸 PIX',
    debito: '💳 Débito', credito: '💳 Crédito', conta: '🏦 Conta',
};
const TIPO_BADGE = {
    empresarial: '<span class="dsp-badge badge-emp">🏢 Empresarial</span>',
    pessoal:     '<span class="dsp-badge badge-pes">👤 Pessoal</span>',
};

/* ── Toast ───────────────────────────────────────────────────── */
let toastTimer;
function toast(msg) {
    const el = $('dsp-toast');
    el.textContent = msg;
    el.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visivel'), 2500);
}

/* ── Modal de exclusão ───────────────────────────────────────── */
function confirmar(msg, cb) {
    $('dsp-modal-del-body').textContent = msg;
    $('dsp-modal-del').style.display = 'flex';
    excluirCallback = cb;
}
$('dsp-modal-del-ok')?.addEventListener('click', () => {
    $('dsp-modal-del').style.display = 'none';
    if (excluirCallback) excluirCallback();
    excluirCallback = null;
});
$('dsp-modal-del-cancel')?.addEventListener('click', () => {
    $('dsp-modal-del').style.display = 'none';
    excluirCallback = null;
});

/* ── Modal rápido Nova Categoria / Novo Centro ───────────────── */
$('dsp-btn-nova-cat')?.addEventListener('click', () => abrirModalQuick('categoria'));
$('dsp-btn-novo-centro')?.addEventListener('click', () => abrirModalQuick('centro'));

function abrirModalQuick(ctx) {
    quickModalCtx = ctx;
    $('dsp-modal-quick-titulo').textContent = ctx === 'categoria' ? 'Nova Categoria' : 'Novo Centro de Custo';
    $('dsp-quick-nome').value  = '';
    $('dsp-quick-icone').value = '';
    $('dsp-modal-quick').style.display = 'flex';
    setTimeout(() => $('dsp-quick-nome')?.focus(), 50);
}

$('dsp-modal-quick-ok')?.addEventListener('click', async () => {
    const nome  = $('dsp-quick-nome')?.value.trim();
    const icone = $('dsp-quick-icone')?.value.trim() || '💡';
    if (!nome) { $('dsp-quick-nome')?.focus(); return; }

    if (quickModalCtx === 'categoria') {
        const id = `cat_${Date.now()}`;
        await setDoc(doc(db, COL_CATS, id), { nome, icone, criadoEm: serverTimestamp() });
        catsCustom.push({ id, nome, icone });
        popularSelectCategorias();
        $('dsp-categoria').value = id;
        toast('✅ Categoria criada!');
    } else {
        const id = `ctr_${Date.now()}`;
        await setDoc(doc(db, COL_CENTROS, id), { nome, icone, criadoEm: serverTimestamp() });
        centrosCustom.push({ id, nome, icone });
        popularSelectCentros();
        $('dsp-centro').value = id;
        toast('✅ Centro de custo criado!');
    }
    $('dsp-modal-quick').style.display = 'none';
});
$('dsp-modal-quick-cancel')?.addEventListener('click', () => {
    $('dsp-modal-quick').style.display = 'none';
});

/* ── Sidebar mobile ──────────────────────────────────────────── */
const sidebarEl = $('dsp-sidebar');
const overlayEl = $('dsp-sb-overlay');
$('dsp-sb-open')?.addEventListener('click', () => {
    sidebarEl.classList.add('open'); overlayEl.classList.add('open');
});
overlayEl?.addEventListener('click', () => {
    sidebarEl.classList.remove('open'); overlayEl.classList.remove('open');
});
function fecharSidebar() {
    sidebarEl.classList.remove('open'); overlayEl.classList.remove('open');
}

/* ── Navegação ───────────────────────────────────────────────── */
const LISTA_SECS = ['todas', 'empresarial', 'pessoal', 'recorrentes'];
const SEC_TITLES = {
    home:        '💸 Despesas',
    todas:       '📋 Todas as Despesas',
    empresarial: '🏢 Despesas Empresariais',
    pessoal:     '👤 Despesas Pessoais',
    recorrentes: '🔄 Despesas Recorrentes',
    resumo:      '📊 Resumo de Despesas',
    categorias:  '🏷️ Categorias',
    centros:     '🏗️ Centros de Custo',
};

function navegar(sec) {
    secaoAtiva = sec;
    fecharSidebar();
    document.querySelectorAll('.dsp-sb-item[data-sec]').forEach(el => {
        el.classList.toggle('active', el.dataset.sec === sec);
    });
    $('dsp-main-titulo').textContent = SEC_TITLES[sec] || sec;

    $('dsp-sec-home').style.display       = sec === 'home'       ? '' : 'none';
    $('dsp-sec-lista').style.display      = LISTA_SECS.includes(sec) ? '' : 'none';
    $('dsp-sec-resumo').style.display     = sec === 'resumo'     ? '' : 'none';
    $('dsp-sec-categorias').style.display = sec === 'categorias' ? '' : 'none';
    $('dsp-sec-centros').style.display    = sec === 'centros'    ? '' : 'none';

    if (LISTA_SECS.includes(sec)) {
        filtroTipo = sec === 'todas'       ? 'todos'
                   : sec === 'empresarial' ? 'empresarial'
                   : sec === 'pessoal'     ? 'pessoal'
                   : 'recorrente';
        sincronizarFiltros();
        renderLista();
    }
    if (sec === 'resumo')    renderResumo();
    if (sec === 'categorias') renderCategorias();
    if (sec === 'centros')    renderCentros();
}

document.querySelectorAll('.dsp-sb-item[data-sec]').forEach(el => {
    el.addEventListener('click', () => navegar(el.dataset.sec));
});
document.querySelectorAll('.dsp-home-block[data-sec]').forEach(el => {
    el.addEventListener('click', () => navegar(el.dataset.sec));
});

/* Filtros rápidos */
document.querySelectorAll('.dsp-filtro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        filtroTipo = btn.dataset.filtro;
        sincronizarFiltros();
        renderLista();
    });
});
function sincronizarFiltros() {
    document.querySelectorAll('.dsp-filtro-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.filtro === filtroTipo);
    });
}

/* ── Botão ＋ Nova Despesa ────────────────────────────────────── */
$('dsp-btn-novo')?.addEventListener('click', () => {
    if (!LISTA_SECS.includes(secaoAtiva)) navegar('todas');
    abrirFormNovo();
});

/* ── Busca ───────────────────────────────────────────────────── */
$('dsp-search')?.addEventListener('input', () => {
    if (LISTA_SECS.includes(secaoAtiva)) renderLista();
});

/* ── Selects ─────────────────────────────────────────────────── */
function popularSelectCategorias() {
    const sel = $('dsp-categoria');
    if (!sel) return;
    const atual = sel.value;
    sel.innerHTML = '<option value="">— Categoria —</option>';
    todasCats().forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.icone} ${c.nome}`;
        sel.appendChild(o);
    });
    if (atual) sel.value = atual;
}
function popularSelectCentros() {
    const sel = $('dsp-centro');
    if (!sel) return;
    const atual = sel.value;
    sel.innerHTML = '<option value="">— Centro de Custo (opcional) —</option>';
    todosCentros().forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.icone} ${c.nome}`;
        sel.appendChild(o);
    });
    if (atual) sel.value = atual;
}

/* ── Carregar dados ──────────────────────────────────────────── */
async function carregar() {
    try {
        const [snapD, snapC, snapCt] = await Promise.all([
            getDocs(collection(db, COL_DESPESAS)),
            getDocs(collection(db, COL_CATS)),
            getDocs(collection(db, COL_CENTROS)),
        ]);
        despesasData = [];
        snapD.forEach(d => despesasData.push({ id: d.id, ...d.data() }));
        despesasData.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

        catsCustom = [];
        snapC.forEach(d => catsCustom.push({ id: d.id, ...d.data() }));

        centrosCustom = [];
        snapCt.forEach(d => centrosCustom.push({ id: d.id, ...d.data() }));
    } catch { despesasData = []; catsCustom = []; centrosCustom = []; }

    $('dsp-loading').style.display = 'none';
    popularSelectCategorias();
    popularSelectCentros();
    atualizarContadores();
    renderLista();
    gerarRecorrentesAutomaticas();
}

/* ── Contadores ──────────────────────────────────────────────── */
function atualizarContadores() {
    const mes = mesAtual();
    const doMes   = despesasData.filter(d => (d.data || '').startsWith(mes));
    const empresariais = despesasData.filter(d => d.tipo === 'empresarial');
    const pessoais     = despesasData.filter(d => d.tipo === 'pessoal');
    const recorrentes  = despesasData.filter(d => d.recorrente);

    const totalMes = doMes.reduce((s, d) => s + Number(d.valor || 0), 0);
    const empMes   = doMes.filter(d => d.tipo === 'empresarial').reduce((s, d) => s + Number(d.valor || 0), 0);
    const pesMes   = doMes.filter(d => d.tipo === 'pessoal').reduce((s, d) => s + Number(d.valor || 0), 0);

    setText('sb-count-todas', despesasData.length);
    setText('sb-count-emp', empresariais.length);
    setText('sb-count-pes', pessoais.length);
    setText('sb-count-rec', recorrentes.length);

    setText('hc-total-mes', fmt(totalMes));
    setClass('hc-total-mes', 'dsp-home-count', totalMes === 0);
    setText('hc-emp', fmt(empMes));
    setClass('hc-emp', 'dsp-home-count', empMes === 0);
    setText('hc-pes', fmt(pesMes));
    setClass('hc-pes', 'dsp-home-count', pesMes === 0);
    setText('hc-rec', recorrentes.length);
    setClass('hc-rec', 'dsp-home-count', recorrentes.length === 0);
}

function setText(id, v) { const el = $(id); if (el) el.textContent = v; }
function setClass(id, baseClass, zero) {
    const el = $(id);
    if (!el) return;
    el.className = baseClass + (zero ? ' dsp-home-count-zero' : '');
}

/* ── Render Lista ────────────────────────────────────────────── */
function renderLista() {
    const listaEl = $('dsp-lista');
    const emptyEl = $('dsp-empty');
    if (!listaEl) return;

    const q = ($('dsp-search')?.value || '').trim().toLowerCase();
    let lista = despesasData;

    if (filtroTipo === 'empresarial') lista = lista.filter(d => d.tipo === 'empresarial');
    else if (filtroTipo === 'pessoal') lista = lista.filter(d => d.tipo === 'pessoal');
    else if (filtroTipo === 'recorrente') lista = lista.filter(d => d.recorrente);

    if (q) {
        lista = lista.filter(d =>
            (d.descricao || '').toLowerCase().includes(q) ||
            (d.obs || '').toLowerCase().includes(q) ||
            ((catById(d.categoria)?.nome || '').toLowerCase().includes(q)) ||
            ((centroById(d.centro)?.nome || '').toLowerCase().includes(q))
        );
    }

    if (!lista.length) {
        listaEl.innerHTML = '';
        emptyEl.style.display = 'flex';
        return;
    }
    emptyEl.style.display = 'none';

    listaEl.innerHTML = lista.map(d => {
        const cat    = catById(d.categoria);
        const centro = centroById(d.centro);
        return `
        <div class="dsp-card" id="dcard-${d.id}">
            <div class="dsp-card-top">
                <div class="dsp-card-cat-icone">${cat?.icone || '💡'}</div>
                <div class="dsp-card-info">
                    <div class="dsp-card-desc">${escHtml(d.descricao)}</div>
                    <div class="dsp-card-meta">
                        <span>${cat?.nome || '—'}</span>
                        <span>📅 ${formatarData(d.data)}</span>
                        ${PAGAMENTO_LABEL[d.pagamento] ? `<span>${PAGAMENTO_LABEL[d.pagamento]}</span>` : ''}
                        ${centro ? `<span>🏗️ ${escHtml(centro.nome)}</span>` : ''}
                        ${d.recorrente ? '<span class="dsp-badge badge-rec">🔄 Recorrente</span>' : ''}
                        ${d.obs ? `<span>· ${escHtml(d.obs)}</span>` : ''}
                    </div>
                </div>
                <div class="dsp-card-right">
                    <div class="dsp-card-valor">${fmt(d.valor)}</div>
                    ${TIPO_BADGE[d.tipo] || ''}
                </div>
            </div>
            <div class="dsp-card-acoes">
                <button class="dsp-card-edit-btn" data-id="${d.id}" title="Editar">✏️ Editar</button>
                <button class="dsp-card-del-btn" data-id="${d.id}" title="Excluir">🗑️ Excluir</button>
            </div>
        </div>`;
    }).join('');

    listaEl.querySelectorAll('.dsp-card-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => abrirFormEditar(btn.dataset.id));
    });
    listaEl.querySelectorAll('.dsp-card-del-btn').forEach(btn => {
        btn.addEventListener('click', () => excluirDespesa(btn.dataset.id));
    });
}

/* ── Render Resumo ───────────────────────────────────────────── */
function renderResumo() {
    const mes = mesAtual();
    const doMes = despesasData.filter(d => (d.data || '').startsWith(mes));
    const empMes = doMes.filter(d => d.tipo === 'empresarial');
    const pesMes = doMes.filter(d => d.tipo === 'pessoal');
    const total  = doMes.reduce((s, d) => s + Number(d.valor || 0), 0);
    const empVal = empMes.reduce((s, d) => s + Number(d.valor || 0), 0);
    const pesVal = pesMes.reduce((s, d) => s + Number(d.valor || 0), 0);
    const meses  = new Set(despesasData.map(d => (d.data || '').slice(0, 7))).size || 1;
    const totalGeral = despesasData.reduce((s, d) => s + Number(d.valor || 0), 0);

    setText('res-total-mes', fmt(total));
    setText('res-qtd-mes', `${doMes.length} despesas`);
    setText('res-emp-mes', fmt(empVal));
    setText('res-emp-qtd', `${empMes.length} registros`);
    setText('res-pes-mes', fmt(pesVal));
    setText('res-pes-qtd', `${pesMes.length} registros`);
    setText('res-media', fmt(totalGeral / meses));
    setText('res-meses', `${meses} ${meses === 1 ? 'mês registrado' : 'meses registrados'}`);

    // Barras por categoria
    const catMap = {};
    doMes.forEach(d => {
        catMap[d.categoria] = (catMap[d.categoria] || 0) + Number(d.valor || 0);
    });
    const catOrdem = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxCat = catOrdem[0]?.[1] || 1;
    $('dsp-cat-barras').innerHTML = catOrdem.map(([id, val]) => {
        const c = catById(id);
        const pct = Math.round((val / maxCat) * 100);
        return `<div class="dsp-barra-item">
            <div class="dsp-barra-nome">${c?.icone || ''} ${escHtml(c?.nome || id)}</div>
            <div class="dsp-barra-track"><div class="dsp-barra-fill" style="width:${pct}%"></div></div>
            <div class="dsp-barra-val">${fmt(val)}</div>
        </div>`;
    }).join('') || '<div style="color:var(--text-muted);font-size:13px">Nenhum dado no mês.</div>';

    // Barras por centro de custo
    const ctrMap = {};
    doMes.forEach(d => {
        if (!d.centro) return;
        ctrMap[d.centro] = (ctrMap[d.centro] || 0) + Number(d.valor || 0);
    });
    const ctrOrdem = Object.entries(ctrMap).sort((a, b) => b[1] - a[1]);
    const maxCtr = ctrOrdem[0]?.[1] || 1;
    $('dsp-centro-barras').innerHTML = ctrOrdem.map(([id, val]) => {
        const c = centroById(id);
        const pct = Math.round((val / maxCtr) * 100);
        return `<div class="dsp-barra-item">
            <div class="dsp-barra-nome">${c?.icone || ''} ${escHtml(c?.nome || id)}</div>
            <div class="dsp-barra-track"><div class="dsp-barra-fill" style="width:${pct}%"></div></div>
            <div class="dsp-barra-val">${fmt(val)}</div>
        </div>`;
    }).join('') || '<div style="color:var(--text-muted);font-size:13px">Nenhuma despesa com centro de custo.</div>';
}

/* ── Render Categorias ───────────────────────────────────────── */
function renderCategorias() {
    const el = $('dsp-cat-lista');
    if (!el) return;
    const todas = todasCats();
    el.innerHTML = todas.map(c => `
        <div class="dsp-cat-chip">
            <div class="dsp-cat-chip-ico">${c.icone || '💡'}</div>
            <div class="dsp-cat-chip-nome">${escHtml(c.nome)}</div>
            ${c.padrao
                ? '<span class="dsp-cat-chip-padrao">padrão</span>'
                : `<button class="dsp-cat-chip-del" data-id="${c.id}" title="Excluir">🗑️</button>`}
        </div>`).join('');

    el.querySelectorAll('.dsp-cat-chip-del').forEach(btn => {
        btn.addEventListener('click', () => excluirCategoria(btn.dataset.id));
    });
}

/* ── Render Centros ──────────────────────────────────────────── */
function renderCentros() {
    const el = $('dsp-centro-lista');
    if (!el) return;
    const todos = todosCentros();
    el.innerHTML = todos.map(c => `
        <div class="dsp-cat-chip">
            <div class="dsp-cat-chip-ico">${c.icone || '🏗️'}</div>
            <div class="dsp-cat-chip-nome">${escHtml(c.nome)}</div>
            ${c.padrao
                ? '<span class="dsp-cat-chip-padrao">padrão</span>'
                : `<button class="dsp-cat-chip-del" data-id="${c.id}" title="Excluir">🗑️</button>`}
        </div>`).join('');

    el.querySelectorAll('.dsp-cat-chip-del').forEach(btn => {
        btn.addEventListener('click', () => excluirCentro(btn.dataset.id));
    });
}

/* ── CRUD Categorias (seção config) ──────────────────────────── */
$('dsp-btn-add-cat')?.addEventListener('click', () => {
    $('dsp-cat-form-titulo').textContent = 'Nova Categoria';
    $('dsp-cat-nome').value  = '';
    $('dsp-cat-icone').value = '';
    $('dsp-cat-form').style.display = 'flex';
    $('dsp-cat-nome')?.focus();
});
$('dsp-cat-cancelar')?.addEventListener('click', () => {
    $('dsp-cat-form').style.display = 'none';
});
$('dsp-cat-salvar')?.addEventListener('click', async () => {
    const nome  = $('dsp-cat-nome')?.value.trim();
    const icone = $('dsp-cat-icone')?.value.trim() || '💡';
    if (!nome) { $('dsp-cat-nome')?.focus(); return; }
    const id = `cat_${Date.now()}`;
    await setDoc(doc(db, COL_CATS, id), { nome, icone, criadoEm: serverTimestamp() });
    catsCustom.push({ id, nome, icone });
    popularSelectCategorias();
    $('dsp-cat-form').style.display = 'none';
    renderCategorias();
    toast('✅ Categoria criada!');
});

async function excluirCategoria(id) {
    const c = catsCustom.find(x => x.id === id);
    if (!c) return;
    confirmar(`Excluir categoria "${c.nome}"? As despesas dessa categoria não serão alteradas.`, async () => {
        await deleteDoc(doc(db, COL_CATS, id));
        catsCustom = catsCustom.filter(x => x.id !== id);
        popularSelectCategorias();
        renderCategorias();
        toast('🗑️ Categoria removida.');
    });
}

/* ── CRUD Centros de Custo (seção config) ────────────────────── */
$('dsp-btn-add-centro')?.addEventListener('click', () => {
    $('dsp-centro-form-titulo').textContent = 'Novo Centro de Custo';
    $('dsp-centro-nome').value  = '';
    $('dsp-centro-icone').value = '';
    $('dsp-centro-form').style.display = 'flex';
    $('dsp-centro-nome')?.focus();
});
$('dsp-centro-cancelar')?.addEventListener('click', () => {
    $('dsp-centro-form').style.display = 'none';
});
$('dsp-centro-salvar')?.addEventListener('click', async () => {
    const nome  = $('dsp-centro-nome')?.value.trim();
    const icone = $('dsp-centro-icone')?.value.trim() || '🏗️';
    if (!nome) { $('dsp-centro-nome')?.focus(); return; }
    const id = `ctr_${Date.now()}`;
    await setDoc(doc(db, COL_CENTROS, id), { nome, icone, criadoEm: serverTimestamp() });
    centrosCustom.push({ id, nome, icone });
    popularSelectCentros();
    $('dsp-centro-form').style.display = 'none';
    renderCentros();
    toast('✅ Centro de custo criado!');
});

async function excluirCentro(id) {
    const c = centrosCustom.find(x => x.id === id);
    if (!c) return;
    confirmar(`Excluir centro de custo "${c.nome}"?`, async () => {
        await deleteDoc(doc(db, COL_CENTROS, id));
        centrosCustom = centrosCustom.filter(x => x.id !== id);
        popularSelectCentros();
        renderCentros();
        toast('🗑️ Centro de custo removido.');
    });
}

/* ── Formulário de despesa ───────────────────────────────────── */
function abrirFormNovo() {
    editandoId = null;
    $('dsp-form-titulo').textContent = 'Nova Despesa';
    $('dsp-descricao').value = '';
    $('dsp-categoria').value = '';
    $('dsp-valor').value     = '';
    $('dsp-data').value      = hoje();
    $('dsp-tipo').value      = 'empresarial';
    $('dsp-pagamento').value = 'dinheiro';
    $('dsp-centro').value    = '';
    $('dsp-obs').value       = '';
    $('dsp-recorrente').checked = false;
    const fw = $('dsp-frequencia-wrap');
    if (fw) fw.style.display = 'none';
    _anexosForm = [];
    const al = $('dsp-anexos-lista');
    if (al) al.innerHTML = '';
    $('dsp-form').style.display = 'flex';
    setTimeout(() => $('dsp-descricao')?.focus(), 50);
}

function abrirFormEditar(id) {
    const d = despesasData.find(x => x.id === id);
    if (!d) return;
    editandoId = id;
    $('dsp-form-titulo').textContent = 'Editar Despesa';
    $('dsp-descricao').value = d.descricao || '';
    $('dsp-categoria').value = d.categoria || '';
    $('dsp-valor').value     = d.valor || '';
    $('dsp-data').value      = d.data || hoje();
    $('dsp-tipo').value      = d.tipo || 'empresarial';
    $('dsp-pagamento').value = d.pagamento || 'dinheiro';
    $('dsp-centro').value    = d.centro || '';
    $('dsp-obs').value       = d.obs || '';
    $('dsp-recorrente').checked = !!d.recorrente;
    const fw2 = $('dsp-frequencia-wrap');
    if (fw2) fw2.style.display = d.recorrente ? 'block' : 'none';
    const freqEl = $('dsp-frequencia');
    if (freqEl) freqEl.value = d.frequencia || 'mensal';
    _anexosForm = Array.isArray(d.anexos) ? [...d.anexos] : [];
    renderAnexos($('dsp-anexos-lista'), _anexosForm, (idx) => {
        _anexosForm.splice(idx, 1);
        renderAnexos($('dsp-anexos-lista'), _anexosForm, arguments.callee);
    });
    if (!LISTA_SECS.includes(secaoAtiva)) navegar('todas');
    $('dsp-form').style.display = 'flex';
    setTimeout(() => $('dsp-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

function fecharForm() {
    $('dsp-form').style.display = 'none';
    editandoId = null;
}

$('dsp-btn-salvar')?.addEventListener('click', salvarDespesa);
$('dsp-btn-cancelar')?.addEventListener('click', fecharForm);

async function salvarDespesa() {
    const descricao = $('dsp-descricao')?.value.trim();
    const valor     = Number($('dsp-valor')?.value) || 0;
    const data      = $('dsp-data')?.value;
    const categoria = $('dsp-categoria')?.value;

    if (!descricao) { toast('⚠ Informe a descrição.'); $('dsp-descricao')?.focus(); return; }
    if (!valor)     { toast('⚠ Informe o valor.');     $('dsp-valor')?.focus();     return; }
    if (!data)      { toast('⚠ Informe a data.');      $('dsp-data')?.focus();      return; }
    if (!categoria) { toast('⚠ Selecione a categoria.'); $('dsp-categoria')?.focus(); return; }

    const isRecorrente = !!$('dsp-recorrente')?.checked;
    const id = editandoId || `dsp_${Date.now()}`;
    const dadosAntes = editandoId ? { ...despesasData.find(x => x.id === editandoId) } : null;

    const despesa = {
        descricao,
        valor,
        data,
        categoria,
        tipo:         $('dsp-tipo')?.value        || 'empresarial',
        pagamento:    $('dsp-pagamento')?.value   || 'dinheiro',
        centro:       $('dsp-centro')?.value      || '',
        obs:          $('dsp-obs')?.value.trim()  || '',
        recorrente:   isRecorrente,
        frequencia:   isRecorrente ? ($('dsp-frequencia')?.value || 'mensal') : '',
        ultimaGeracao: isRecorrente ? (data || hoje()) : '',
        anexos:       _anexosForm,
        atualizadoEm: serverTimestamp(),
    };
    if (!editandoId) despesa.criadoEm = serverTimestamp();

    try {
        await setDoc(doc(db, COL_DESPESAS, id), despesa);
        await logAudit({
            modulo: 'despesas',
            acao:   editandoId ? 'edicao' : 'criacao',
            id,
            antes:  dadosAntes,
            depois: despesa,
            descricao,
        });
        toast(editandoId ? '✏️ Despesa atualizada!' : '✅ Despesa registrada!');
        _anexosForm = [];
        fecharForm();
        await recarregar();
    } catch (e) {
        console.error(e);
        toast('⚠ Erro ao salvar.');
    }
}

async function excluirDespesa(id) {
    const d = despesasData.find(x => x.id === id);
    if (!d) return;
    confirmar(`Mover despesa "${d.descricao}" para a Lixeira?`, async () => {
        try {
            const ok = await moverParaLixeira(COL_DESPESAS, id, d);
            if (!ok) { toast('⚠ Erro ao mover para lixeira.'); return; }
            await logAudit({ modulo: 'despesas', acao: 'exclusao', id, antes: d, descricao: d.descricao });
            despesasData = despesasData.filter(x => x.id !== id);
            atualizarContadores();
            renderLista();
            toast('🗑️ Movido para a Lixeira. Pode ser restaurado.');
        } catch { toast('⚠ Erro ao excluir.'); }
    });
}

/* ── Recarregar ──────────────────────────────────────────────── */
async function recarregar() {
    try {
        const snap = await getDocs(collection(db, COL_DESPESAS));
        despesasData = [];
        snap.forEach(d => despesasData.push({ id: d.id, ...d.data() }));
        despesasData.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    } catch {}
    atualizarContadores();
    renderLista();
    if (secaoAtiva === 'resumo') renderResumo();
}

/* ── Frequência (recorrentes) ─────────────────────────────────── */
window.toggleFrequencia = function(checked) {
    const fw = $('dsp-frequencia-wrap');
    if (fw) fw.style.display = checked ? 'block' : 'none';
};

/* ── Anexos ──────────────────────────────────────────────────── */
window.adicionarAnexo = async function() {
    const file = await selecionarArquivo();
    if (!file) return;

    const progWrap = $('dsp-anexo-progress');
    const progBar  = $('dsp-anexo-bar');
    if (progWrap) progWrap.style.display = 'block';

    try {
        const docId = editandoId || `dsp_${Date.now()}`;
        const anexo = await uploadAnexo(file, COL_DESPESAS, docId, pct => {
            if (progBar) progBar.style.width = `${pct}%`;
        });
        _anexosForm.push(anexo);
        renderAnexos($('dsp-anexos-lista'), _anexosForm, idx => {
            _anexosForm.splice(idx, 1);
            renderAnexos($('dsp-anexos-lista'), _anexosForm, arguments.callee);
        });
        toast('📎 Anexo adicionado!');
    } catch (e) {
        toast(`⚠ ${e.message}`);
    } finally {
        if (progWrap) progWrap.style.display = 'none';
        if (progBar)  progBar.style.width = '0%';
    }
};

/* ── Exportar ────────────────────────────────────────────────── */
window.exportarDespesas = function() {
    const cols = ['descricao', 'categoria', 'valor', 'data', 'tipo', 'pagamento', 'centro', 'recorrente'];
    const hdrs = {
        descricao: 'Descrição', categoria: 'Categoria', valor: 'Valor (R$)',
        data: 'Data', tipo: 'Tipo', pagamento: 'Forma Pagamento',
        centro: 'Centro de Custo', recorrente: 'Recorrente',
    };
    mostrarMenuExportar(despesasData, cols, hdrs, 'despesas');
};

/* ── Recorrentes Automáticas ─────────────────────────────────── */
async function gerarRecorrentesAutomaticas() {
    const hoje_str = hoje();
    const recorrentes = despesasData.filter(d => d.recorrente && d.ultimaGeracao);
    let geradas = 0;

    for (const d of recorrentes) {
        const proxima = calcularProximaData(d.ultimaGeracao, d.frequencia || 'mensal');
        if (!proxima || proxima > hoje_str) continue;

        const novoId = `dsp_rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const nova = {
            descricao:    d.descricao,
            valor:        d.valor,
            data:         proxima,
            categoria:    d.categoria,
            tipo:         d.tipo,
            pagamento:    d.pagamento || 'dinheiro',
            centro:       d.centro || '',
            obs:          d.obs   || '',
            recorrente:   false,
            origemRecorrente: d.id,
            criadoEm:    serverTimestamp(),
            atualizadoEm: serverTimestamp(),
        };
        try {
            await setDoc(doc(db, COL_DESPESAS, novoId), nova);
            // Atualiza ultimaGeracao da fonte
            await setDoc(doc(db, COL_DESPESAS, d.id), { ...d, ultimaGeracao: proxima, atualizadoEm: serverTimestamp() }, { merge: true });
            geradas++;
        } catch (e) {
            console.warn('[Recorrentes] Erro ao gerar:', e);
        }
    }

    if (geradas > 0) {
        toast(`🔄 ${geradas} despesa${geradas > 1 ? 's' : ''} recorrente${geradas > 1 ? 's' : ''} gerada${geradas > 1 ? 's' : ''} automaticamente.`);
        await recarregar();
    }
}

function calcularProximaData(ultimaISO, frequencia) {
    if (!ultimaISO) return null;
    const d = new Date(ultimaISO + 'T12:00:00');
    switch (frequencia) {
        case 'semanal':     d.setDate(d.getDate() + 7);    break;
        case 'quinzenal':   d.setDate(d.getDate() + 15);   break;
        case 'mensal':      d.setMonth(d.getMonth() + 1);  break;
        case 'trimestral':  d.setMonth(d.getMonth() + 3);  break;
        case 'semestral':   d.setMonth(d.getMonth() + 6);  break;
        case 'anual':       d.setFullYear(d.getFullYear() + 1); break;
        default:            return null;
    }
    return d.toISOString().slice(0, 10);
}

/* ── Init ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => carregar());
