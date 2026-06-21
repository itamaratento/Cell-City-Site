import { db, collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from '../../scripts/firebase.js';

const COL_PAGAR   = 'financeiro_pagar';
const COL_FIXAS   = 'financeiro_fixas';
const COL_RECEBER = 'financeiro_receber';

const fmt = v => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const hoje = () => new Date().toISOString().slice(0, 10);
const $ = id => document.getElementById(id);

let dadosPagar   = [];
let dadosFixas   = [];
let dadosReceber = [];
let filtroStatusPagar   = 'todos';
let filtroStatusReceber = 'todos';
let editandoId = null;
let editandoColecao = null;
let secaoAtiva = 'home';

// ── Toast ──────────────────────────────────────────────────────────────
const toastEl = $('fin-toast');
let toastTimer;
function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), 2500);
}

// ── Sidebar mobile ─────────────────────────────────────────────────────
const sidebarEl  = $('fin-sidebar');
const overlayEl  = $('fin-sb-overlay');
const sbOpenBtn  = $('fin-sb-open');

function abrirSidebar() {
    sidebarEl.classList.add('open');
    overlayEl.classList.add('open');
}
function fecharSidebar() {
    sidebarEl.classList.remove('open');
    overlayEl.classList.remove('open');
}
sbOpenBtn?.addEventListener('click', abrirSidebar);
overlayEl?.addEventListener('click', fecharSidebar);

// ── Navegação por seções ───────────────────────────────────────────────
const SEC_META = {
    home:    { titulo: '💹 Financeiro',         novo: false },
    pagar:   { titulo: '💰 Contas a Pagar',      novo: true  },
    receber: { titulo: '💵 Contas a Receber',    novo: true  },
    fixas:   { titulo: '📅 Despesas Fixas',      novo: true  },
    resumo:  { titulo: '📊 Resumo Financeiro',   novo: false },
};

function navegar(sec) {
    if (!SEC_META[sec]) return;
    secaoAtiva = sec;
    fecharSidebar();

    // sidebar: marcação ativa
    document.querySelectorAll('.fin-sb-item[data-sec]').forEach(el => {
        el.classList.toggle('active', el.dataset.sec === sec);
    });

    // breadcrumb
    $('fin-main-titulo').textContent = SEC_META[sec].titulo;

    // mostrar/ocultar home grid e seções
    $('fin-home-grid').style.display = sec === 'home' ? '' : 'none';
    ['pagar','receber','fixas','resumo'].forEach(s => {
        $('fin-sec-' + s).style.display = s === sec ? '' : 'none';
    });

    // botão ＋ Novo
    const btnNovo = $('fin-btn-novo');
    btnNovo.style.display = SEC_META[sec].novo ? '' : 'none';
}

// Cliques no sidebar
document.querySelectorAll('.fin-sb-item[data-sec]').forEach(el => {
    el.addEventListener('click', () => navegar(el.dataset.sec));
});

// Cliques nos cards do home grid
document.querySelectorAll('.fin-home-block[data-sec]').forEach(el => {
    el.addEventListener('click', () => navegar(el.dataset.sec));
});

// Botão ＋ Novo (abre form da seção ativa)
$('fin-btn-novo')?.addEventListener('click', () => {
    if (secaoAtiva === 'pagar')   abrirFormPagar();
    if (secaoAtiva === 'receber') abrirFormReceber();
    if (secaoAtiva === 'fixas')   abrirFormFixa();
});

// ── Carregar dados ─────────────────────────────────────────────────────
async function carregar() {
    try {
        const [sp, sf, sr] = await Promise.all([
            getDocs(collection(db, COL_PAGAR)),
            getDocs(collection(db, COL_FIXAS)),
            getDocs(collection(db, COL_RECEBER))
        ]);
        dadosPagar   = []; sp.forEach(d => dadosPagar.push({ id: d.id, ...d.data() }));
        dadosFixas   = []; sf.forEach(d => dadosFixas.push({ id: d.id, ...d.data() }));
        dadosReceber = []; sr.forEach(d => dadosReceber.push({ id: d.id, ...d.data() }));
    } catch {
        dadosPagar = []; dadosFixas = []; dadosReceber = [];
    }
    dadosPagar   = dadosPagar.map(c => calcStatus(c, 'pago'));
    dadosReceber = dadosReceber.map(c => calcStatus(c, 'recebido'));

    $('pagar-loading').style.display   = 'none';
    $('fixas-loading').style.display   = 'none';
    $('receber-loading').style.display = 'none';

    renderPagar(dadosPagar);
    renderFixas(dadosFixas);
    renderReceber(dadosReceber);
    atualizarContadores();
}

function calcStatus(item, pago) {
    if (item.status === pago) return item;
    if (item.vencimento && item.vencimento < hoje()) return { ...item, status: 'vencido' };
    return item;
}

// ── Contadores (sidebar + home grid + resumo) ──────────────────────────
function atualizarContadores() {
    const pendPagar   = dadosPagar.filter(c => c.status !== 'pago');
    const pendReceber = dadosReceber.filter(c => c.status !== 'recebido');
    const vencPagar   = dadosPagar.filter(c => c.status === 'vencido').length;
    const vencReceber = dadosReceber.filter(c => c.status === 'vencido').length;
    const totalFixas  = dadosFixas.reduce((s, c) => s + Number(c.valor || 0), 0);
    const totalPagar  = pendPagar.reduce((s, c) => s + Number(c.valor || 0), 0);
    const totalReceber = pendReceber.reduce((s, c) => s + Number(c.valor || 0), 0);

    // Sidebar
    $('sb-count-pagar').textContent   = pendPagar.length;
    $('sb-count-receber').textContent = pendReceber.length;
    $('sb-count-fixas').textContent   = dadosFixas.length;

    // Home grid
    const hcPagar = $('hc-pagar');
    hcPagar.textContent = pendPagar.length;
    hcPagar.className = 'fin-home-count' + (pendPagar.length === 0 ? ' fin-home-count-zero' : '');

    const hcReceber = $('hc-receber');
    hcReceber.textContent = pendReceber.length;
    hcReceber.className = 'fin-home-count' + (pendReceber.length === 0 ? ' fin-home-count-zero' : '');

    const hcFixas = $('hc-fixas');
    hcFixas.textContent = dadosFixas.length;
    hcFixas.className = 'fin-home-count' + (dadosFixas.length === 0 ? ' fin-home-count-zero' : '');

    // Resumo Financeiro
    $('res-pagar').textContent         = fmt(totalPagar);
    $('res-pagar-count').textContent   = pendPagar.length + (pendPagar.length === 1 ? ' conta' : ' contas');
    $('res-receber').textContent       = fmt(totalReceber);
    $('res-receber-count').textContent = pendReceber.length + (pendReceber.length === 1 ? ' conta' : ' contas');
    $('res-fixas').textContent         = fmt(totalFixas);
    $('res-fixas-count').textContent   = dadosFixas.length + (dadosFixas.length === 1 ? ' item' : ' itens');
    const totalVenc = vencPagar + vencReceber;
    $('res-vencidas').textContent = totalVenc;
    $('res-vencidas-label').textContent = `${vencPagar} pagar + ${vencReceber} receber`;
}

// ── Busca global ───────────────────────────────────────────────────────
function buscarGlobal() {
    const q = ($('fin-search')?.value || '').trim().toLowerCase();
    if (!q) {
        renderPagar(dadosPagar); renderFixas(dadosFixas); renderReceber(dadosReceber);
        return;
    }
    const f = lista => lista.filter(c =>
        (c.descricao || '').toLowerCase().includes(q) ||
        (c.cliente   || '').toLowerCase().includes(q) ||
        (c.categoria || '').toLowerCase().includes(q) ||
        (c.obs       || '').toLowerCase().includes(q)
    );
    renderPagar(f(dadosPagar)); renderFixas(f(dadosFixas)); renderReceber(f(dadosReceber));
}
$('fin-search')?.addEventListener('input', buscarGlobal);

// ── Utilitários ────────────────────────────────────────────────────────
function formatarData(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}
function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function statusBadge(status) {
    const m = {
        pendente: { label: 'Pendente',  cls: 'badge-pendente' },
        pago:     { label: 'Pago',      cls: 'badge-pago'     },
        recebido: { label: 'Recebido',  cls: 'badge-pago'     },
        vencido:  { label: 'Vencido',   cls: 'badge-vencido'  }
    };
    const s = m[status] || { label: status, cls: '' };
    return `<span class="fin-badge ${s.cls}">${s.label}</span>`;
}
const CAT_ICON = {
    Aluguel: '🏠', Fornecedor: '📦', Serviços: '⚡', Salário: '👤',
    Imposto: '🧾', Equipamento: '🔧', Assinatura: '📱',
    Energia: '💡', Água: '💧', Internet: '🌐', Sistema: '💻',
    Marketing: '📢', Fornecedores: '📦', Transporte: '🚗', Outro: '📌'
};

// ── Render Contas a Pagar ──────────────────────────────────────────────
function renderPagar(lista) {
    const listaEl = $('pagar-lista');
    const emptyEl = $('pagar-empty');
    let f = filtroStatusPagar !== 'todos' ? lista.filter(c => c.status === filtroStatusPagar) : lista;
    f = f.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
    if (!f.length) { listaEl.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
    emptyEl.style.display = 'none';
    listaEl.innerHTML = f.map(c => `
        <div class="fin-card${c.status === 'vencido' ? ' fin-card-vencido' : c.status === 'pago' ? ' fin-card-pago' : ''}">
            <div class="fin-card-left">
                <span class="fin-cat-icon">${CAT_ICON[c.categoria] || '📌'}</span>
                <div class="fin-card-info">
                    <div class="fin-card-desc">${escHtml(c.descricao)}</div>
                    <div class="fin-card-sub">${c.vencimento ? `📅 ${formatarData(c.vencimento)}` : ''}${c.obs ? ` · ${escHtml(c.obs)}` : ''}</div>
                </div>
            </div>
            <div class="fin-card-right">
                <div class="fin-card-valor">${fmt(c.valor)}</div>
                ${statusBadge(c.status)}
                <div class="fin-card-acoes">
                    ${c.status !== 'pago' ? `<button class="fin-btn-marcar" data-id="${c.id}" data-col="pagar" data-novo="pago">✓ Pago</button>` : ''}
                    <button class="fin-card-edit-btn" data-id="${c.id}" data-col="pagar" title="Editar">✏️</button>
                    <button class="fin-card-del-btn" data-id="${c.id}" data-col="pagar" title="Excluir">🗑️</button>
                </div>
            </div>
        </div>`).join('');
    bindCardEvents(listaEl);
}

// ── Render Despesas Fixas ──────────────────────────────────────────────
function renderFixas(lista) {
    const listaEl = $('fixas-lista');
    const emptyEl = $('fixas-empty');
    if (!lista.length) { listaEl.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
    emptyEl.style.display = 'none';
    listaEl.innerHTML = lista.map(c => `
        <div class="fin-card">
            <div class="fin-card-left">
                <span class="fin-cat-icon">${CAT_ICON[c.categoria] || '📌'}</span>
                <div class="fin-card-info">
                    <div class="fin-card-desc">${escHtml(c.descricao)}</div>
                    <div class="fin-card-sub">Vence todo dia <strong>${c.dia || '?'}</strong></div>
                </div>
            </div>
            <div class="fin-card-right">
                <div class="fin-card-valor">${fmt(c.valor)}/mês</div>
                <div class="fin-card-acoes">
                    <button class="fin-card-edit-btn" data-id="${c.id}" data-col="fixa" title="Editar">✏️</button>
                    <button class="fin-card-del-btn" data-id="${c.id}" data-col="fixa" title="Excluir">🗑️</button>
                </div>
            </div>
        </div>`).join('');
    bindCardEvents(listaEl);
}

// ── Render Contas a Receber ────────────────────────────────────────────
function renderReceber(lista) {
    const listaEl = $('receber-lista');
    const emptyEl = $('receber-empty');
    let f = filtroStatusReceber !== 'todos' ? lista.filter(c => c.status === filtroStatusReceber) : lista;
    f = f.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
    if (!f.length) { listaEl.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
    emptyEl.style.display = 'none';
    listaEl.innerHTML = f.map(c => `
        <div class="fin-card${c.status === 'vencido' ? ' fin-card-vencido' : c.status === 'recebido' ? ' fin-card-pago' : ''}">
            <div class="fin-card-left">
                <span class="fin-cat-icon">💰</span>
                <div class="fin-card-info">
                    <div class="fin-card-desc">${escHtml(c.descricao || c.cliente || '—')}</div>
                    ${c.cliente && c.descricao ? `<div class="fin-card-cliente">👤 ${escHtml(c.cliente)}</div>` : ''}
                    <div class="fin-card-sub">${c.vencimento ? `📅 ${formatarData(c.vencimento)}` : ''}${c.obs ? ` · ${escHtml(c.obs)}` : ''}</div>
                </div>
            </div>
            <div class="fin-card-right">
                <div class="fin-card-valor fin-verde">${fmt(c.valor)}</div>
                ${statusBadge(c.status)}
                <div class="fin-card-acoes">
                    ${c.status !== 'recebido' ? `<button class="fin-btn-marcar fin-btn-receber" data-id="${c.id}" data-col="receber" data-novo="recebido">✓ Recebido</button>` : ''}
                    <button class="fin-card-edit-btn" data-id="${c.id}" data-col="receber" title="Editar">✏️</button>
                    <button class="fin-card-del-btn" data-id="${c.id}" data-col="receber" title="Excluir">🗑️</button>
                </div>
            </div>
        </div>`).join('');
    bindCardEvents(listaEl);
}

// ── Bind eventos nos cards ─────────────────────────────────────────────
function bindCardEvents(container) {
    container.querySelectorAll('.fin-btn-marcar').forEach(btn => {
        btn.addEventListener('click', () => marcarStatus(btn.dataset.id, btn.dataset.col, btn.dataset.novo));
    });
    container.querySelectorAll('.fin-card-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => abrirEdicao(btn.dataset.id, btn.dataset.col));
    });
    container.querySelectorAll('.fin-card-del-btn').forEach(btn => {
        btn.addEventListener('click', () => excluir(btn.dataset.id, btn.dataset.col));
    });
}

// ── Marcar status ──────────────────────────────────────────────────────
async function marcarStatus(id, col, novoStatus) {
    const arr    = col === 'pagar' ? dadosPagar : dadosReceber;
    const colecao = col === 'pagar' ? COL_PAGAR : COL_RECEBER;
    const item = arr.find(c => c.id === id);
    if (!item) return;
    const atualizado = { ...item, status: novoStatus, [`${novoStatus}Em`]: hoje() };
    try {
        await setDoc(doc(db, colecao, id), atualizado);
        if (col === 'pagar') {
            dadosPagar = dadosPagar.map(c => c.id === id ? atualizado : c);
            renderPagar(dadosPagar);
        } else {
            dadosReceber = dadosReceber.map(c => c.id === id ? atualizado : c);
            renderReceber(dadosReceber);
        }
        atualizarContadores();
        toast(novoStatus === 'pago' ? '✅ Marcado como pago!' : '✅ Recebimento confirmado!');
    } catch { toast('⚠ Erro ao atualizar.'); }
}

// ── Excluir ────────────────────────────────────────────────────────────
async function excluir(id, col) {
    if (!confirm('Excluir este lançamento?')) return;
    const colecao = col === 'pagar' ? COL_PAGAR : col === 'fixa' ? COL_FIXAS : COL_RECEBER;
    try {
        await deleteDoc(doc(db, colecao, id));
        if (col === 'pagar')   dadosPagar   = dadosPagar.filter(c => c.id !== id);
        if (col === 'fixa')    dadosFixas   = dadosFixas.filter(c => c.id !== id);
        if (col === 'receber') dadosReceber = dadosReceber.filter(c => c.id !== id);
        renderPagar(dadosPagar); renderFixas(dadosFixas); renderReceber(dadosReceber);
        atualizarContadores();
        toast('🗑️ Removido.');
    } catch { toast('⚠ Erro ao excluir.'); }
}

// ── Abrir edição ───────────────────────────────────────────────────────
function abrirEdicao(id, col) {
    if (col === 'pagar') {
        const item = dadosPagar.find(c => c.id === id);
        if (!item) return;
        editandoId = id; editandoColecao = 'pagar';
        $('form-pagar-titulo').textContent = 'Editar Conta a Pagar';
        $('fp-desc').value   = item.descricao || '';
        $('fp-cat').value    = item.categoria || 'Outro';
        $('fp-venc').value   = item.vencimento || '';
        $('fp-valor').value  = item.valor || '';
        $('fp-status').value = item.status === 'vencido' ? 'pendente' : (item.status || 'pendente');
        $('fp-obs').value    = item.obs || '';
        $('form-pagar').style.display = 'flex';
        navegar('pagar');
    } else if (col === 'fixa') {
        const item = dadosFixas.find(c => c.id === id);
        if (!item) return;
        editandoId = id; editandoColecao = 'fixa';
        $('form-fixa-titulo').textContent = 'Editar Despesa Fixa';
        $('ff-desc').value  = item.descricao || '';
        $('ff-cat').value   = item.categoria || 'Outro';
        $('ff-dia').value   = item.dia || 10;
        $('ff-valor').value = item.valor || '';
        $('form-fixa').style.display = 'flex';
        navegar('fixas');
    } else if (col === 'receber') {
        const item = dadosReceber.find(c => c.id === id);
        if (!item) return;
        editandoId = id; editandoColecao = 'receber';
        $('form-receber-titulo').textContent = 'Editar Conta a Receber';
        $('fr-cliente').value = item.cliente || '';
        $('fr-desc').value    = item.descricao || '';
        $('fr-venc').value    = item.vencimento || '';
        $('fr-valor').value   = item.valor || '';
        $('fr-status').value  = item.status === 'vencido' ? 'pendente' : (item.status || 'pendente');
        $('fr-obs').value     = item.obs || '';
        $('form-receber').style.display = 'flex';
        navegar('receber');
    }
}

// ── Fechar form ────────────────────────────────────────────────────────
function fecharForm(formId) {
    $(formId).style.display = 'none';
    editandoId = null; editandoColecao = null;
}

// ── Abrir forms (novo) ─────────────────────────────────────────────────
function abrirFormPagar() {
    editandoId = null; editandoColecao = null;
    $('form-pagar-titulo').textContent = 'Nova Conta a Pagar';
    $('fp-desc').value = ''; $('fp-obs').value = '';
    $('fp-cat').value = 'Outro'; $('fp-venc').value = '';
    $('fp-valor').value = ''; $('fp-status').value = 'pendente';
    $('form-pagar').style.display = 'flex';
    setTimeout(() => $('fp-desc').focus(), 50);
}
function abrirFormFixa() {
    editandoId = null; editandoColecao = null;
    $('form-fixa-titulo').textContent = 'Nova Despesa Fixa';
    $('ff-desc').value = ''; $('ff-cat').value = 'Outro';
    $('ff-dia').value = '10'; $('ff-valor').value = '';
    $('form-fixa').style.display = 'flex';
    setTimeout(() => $('ff-desc').focus(), 50);
}
function abrirFormReceber() {
    editandoId = null; editandoColecao = null;
    $('form-receber-titulo').textContent = 'Nova Conta a Receber';
    $('fr-cliente').value = ''; $('fr-desc').value = ''; $('fr-obs').value = '';
    $('fr-venc').value = ''; $('fr-valor').value = ''; $('fr-status').value = 'pendente';
    $('form-receber').style.display = 'flex';
    setTimeout(() => $('fr-cliente').focus(), 50);
}

// ── Salvar Contas a Pagar ──────────────────────────────────────────────
async function salvarPagar() {
    const desc = $('fp-desc').value.trim();
    if (!desc) { $('fp-desc').focus(); return; }
    const dados = {
        descricao:    desc,
        categoria:    $('fp-cat').value,
        vencimento:   $('fp-venc').value,
        valor:        Number($('fp-valor').value) || 0,
        status:       $('fp-status').value,
        obs:          $('fp-obs').value.trim(),
        atualizadoEm: serverTimestamp()
    };
    const id = editandoId || `pag_${Date.now()}`;
    try {
        await setDoc(doc(db, COL_PAGAR, id), dados);
        toast(editandoId ? '✏️ Atualizado!' : '✅ Conta adicionada!');
        fecharForm('form-pagar');
        await recarregar('pagar');
    } catch { toast('⚠ Erro ao salvar.'); }
}

// ── Salvar Despesas Fixas ──────────────────────────────────────────────
async function salvarFixa() {
    const desc = $('ff-desc').value.trim();
    if (!desc) { $('ff-desc').focus(); return; }
    const dados = {
        descricao:    desc,
        categoria:    $('ff-cat').value,
        dia:          Number($('ff-dia').value) || 1,
        valor:        Number($('ff-valor').value) || 0,
        atualizadoEm: serverTimestamp()
    };
    const id = editandoId || `fix_${Date.now()}`;
    try {
        await setDoc(doc(db, COL_FIXAS, id), dados);
        toast(editandoId ? '✏️ Atualizado!' : '✅ Despesa fixa adicionada!');
        fecharForm('form-fixa');
        await recarregar('fixa');
    } catch { toast('⚠ Erro ao salvar.'); }
}

// ── Salvar Contas a Receber ────────────────────────────────────────────
async function salvarReceber() {
    const desc = $('fr-desc').value.trim() || $('fr-cliente').value.trim();
    if (!desc) { $('fr-desc').focus(); return; }
    const dados = {
        cliente:      $('fr-cliente').value.trim(),
        descricao:    $('fr-desc').value.trim(),
        vencimento:   $('fr-venc').value,
        valor:        Number($('fr-valor').value) || 0,
        status:       $('fr-status').value,
        obs:          $('fr-obs').value.trim(),
        atualizadoEm: serverTimestamp()
    };
    const id = editandoId || `rec_${Date.now()}`;
    try {
        await setDoc(doc(db, COL_RECEBER, id), dados);
        toast(editandoId ? '✏️ Atualizado!' : '✅ Conta adicionada!');
        fecharForm('form-receber');
        await recarregar('receber');
    } catch { toast('⚠ Erro ao salvar.'); }
}

// ── Recarregar parcial ─────────────────────────────────────────────────
async function recarregar(col) {
    try {
        if (col === 'pagar') {
            const sp = await getDocs(collection(db, COL_PAGAR));
            dadosPagar = []; sp.forEach(d => dadosPagar.push({ id: d.id, ...d.data() }));
            dadosPagar = dadosPagar.map(c => calcStatus(c, 'pago'));
            renderPagar(dadosPagar);
        } else if (col === 'fixa') {
            const sf = await getDocs(collection(db, COL_FIXAS));
            dadosFixas = []; sf.forEach(d => dadosFixas.push({ id: d.id, ...d.data() }));
            renderFixas(dadosFixas);
        } else if (col === 'receber') {
            const sr = await getDocs(collection(db, COL_RECEBER));
            dadosReceber = []; sr.forEach(d => dadosReceber.push({ id: d.id, ...d.data() }));
            dadosReceber = dadosReceber.map(c => calcStatus(c, 'recebido'));
            renderReceber(dadosReceber);
        }
        atualizarContadores();
    } catch {}
}

// ── Eventos dos formulários ────────────────────────────────────────────
$('fp-salvar')?.addEventListener('click', salvarPagar);
$('fp-cancelar')?.addEventListener('click', () => fecharForm('form-pagar'));
$('fp-desc')?.addEventListener('keypress', e => { if (e.key === 'Enter') salvarPagar(); });

$('ff-salvar')?.addEventListener('click', salvarFixa);
$('ff-cancelar')?.addEventListener('click', () => fecharForm('form-fixa'));

$('fr-salvar')?.addEventListener('click', salvarReceber);
$('fr-cancelar')?.addEventListener('click', () => fecharForm('form-receber'));
$('fr-desc')?.addEventListener('keypress', e => { if (e.key === 'Enter') salvarReceber(); });

// ── Filtros de status ──────────────────────────────────────────────────
document.querySelectorAll('[data-s]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-s]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filtroStatusPagar = btn.dataset.s;
        renderPagar(dadosPagar);
    });
});
document.querySelectorAll('[data-s2]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-s2]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filtroStatusReceber = btn.dataset.s2;
        renderReceber(dadosReceber);
    });
});

// ── Inicialização ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => carregar());
