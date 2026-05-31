import { db, collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from '../../scripts/firebase.js';

const COL_PAGAR   = 'financeiro_pagar';
const COL_FIXAS   = 'financeiro_fixas';
const COL_RECEBER = 'financeiro_receber';

const fmt = v => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const hoje = () => new Date().toISOString().slice(0, 10);

let dadosPagar   = [];
let dadosFixas   = [];
let dadosReceber = [];
let filtroStatusPagar   = 'todos';
let filtroStatusReceber = 'todos';
let editandoId = null;
let editandoColecao = null;

// ── toast ──────────────────────────────────────────────────────────
const toastEl = document.getElementById('fin-toast');
let toastTimer;
function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), 2500);
}

// ── tabs ───────────────────────────────────────────────────────────
document.querySelectorAll('.fin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.fin-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.fin-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
});

// ── filtros de status ──────────────────────────────────────────────
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

// ── carregar ───────────────────────────────────────────────────────
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
    // atualiza status vencido automaticamente
    dadosPagar   = dadosPagar.map(c => calcStatus(c, 'pago'));
    dadosReceber = dadosReceber.map(c => calcStatus(c, 'recebido'));

    document.getElementById('pagar-loading').style.display  = 'none';
    document.getElementById('fixas-loading').style.display  = 'none';
    document.getElementById('receber-loading').style.display = 'none';

    renderPagar(dadosPagar);
    renderFixas(dadosFixas);
    renderReceber(dadosReceber);
    atualizarResumo();
}

function calcStatus(item, pago) {
    if (item.status === pago) return item;
    if (item.vencimento && item.vencimento < hoje()) return { ...item, status: 'vencido' };
    return item;
}

// ── resumo ─────────────────────────────────────────────────────────
function atualizarResumo() {
    const aPagar   = dadosPagar.filter(c => c.status !== 'pago').reduce((s, c) => s + Number(c.valor || 0), 0);
    const fixasMes = dadosFixas.reduce((s, c) => s + Number(c.valor || 0), 0);
    const aReceber = dadosReceber.filter(c => c.status !== 'recebido').reduce((s, c) => s + Number(c.valor || 0), 0);
    document.getElementById('res-pagar').textContent   = fmt(aPagar);
    document.getElementById('res-fixas').textContent   = fmt(fixasMes);
    document.getElementById('res-receber').textContent = fmt(aReceber);
}

// ── STATUS BADGE ────────────────────────────────────────────────────
function statusBadge(status) {
    const m = {
        pendente: { label: 'Pendente', cls: 'badge-pendente' },
        pago:     { label: 'Pago',     cls: 'badge-pago' },
        recebido: { label: 'Recebido', cls: 'badge-pago' },
        vencido:  { label: 'Vencido',  cls: 'badge-vencido' }
    };
    const s = m[status] || { label: status, cls: '' };
    return `<span class="fin-badge ${s.cls}">${s.label}</span>`;
}

// ── CAT ICON ───────────────────────────────────────────────────────
const CAT_ICON = { Aluguel: '🏠', Fornecedor: '📦', Serviços: '⚡', Salário: '👤', Imposto: '🧾', Equipamento: '🔧', Assinatura: '📱', Outro: '📌' };

// ── RENDER PAGAR ───────────────────────────────────────────────────
function renderPagar(lista) {
    const listaEl = document.getElementById('pagar-lista');
    const emptyEl = document.getElementById('pagar-empty');
    let f = lista;
    if (filtroStatusPagar !== 'todos') f = lista.filter(c => c.status === filtroStatusPagar);
    f = f.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
    if (!f.length) { listaEl.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
    emptyEl.style.display = 'none';
    listaEl.innerHTML = f.map(c => `
        <div class="fin-card${c.status === 'vencido' ? ' fin-card-vencido' : c.status === 'pago' ? ' fin-card-pago' : ''}">
            <div class="fin-card-left">
                <span class="fin-cat-icon">${CAT_ICON[c.categoria] || '📌'}</span>
                <div class="fin-card-info">
                    <div class="fin-card-desc">${escHtml(c.descricao)}</div>
                    <div class="fin-card-sub">
                        ${c.vencimento ? `📅 ${formatarData(c.vencimento)}` : ''}
                        ${c.obs ? ` · ${escHtml(c.obs)}` : ''}
                    </div>
                </div>
            </div>
            <div class="fin-card-right">
                <div class="fin-card-valor">${fmt(c.valor)}</div>
                ${statusBadge(c.status)}
                <div class="fin-card-acoes">
                    ${c.status !== 'pago' ? `<button class="fin-btn-marcar" data-id="${c.id}" data-col="pagar" data-novo="pago" title="Marcar como pago">✓ Pago</button>` : ''}
                    <button class="fin-card-edit-btn" data-id="${c.id}" data-col="pagar" title="Editar">✏️</button>
                    <button class="fin-card-del-btn" data-id="${c.id}" data-col="pagar" title="Excluir">🗑️</button>
                </div>
            </div>
        </div>`).join('');
    bindCardEvents(listaEl);
}

// ── RENDER FIXAS ───────────────────────────────────────────────────
function renderFixas(lista) {
    const listaEl = document.getElementById('fixas-lista');
    const emptyEl = document.getElementById('fixas-empty');
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

// ── RENDER RECEBER ─────────────────────────────────────────────────
function renderReceber(lista) {
    const listaEl = document.getElementById('receber-lista');
    const emptyEl = document.getElementById('receber-empty');
    let f = lista;
    if (filtroStatusReceber !== 'todos') f = lista.filter(c => c.status === filtroStatusReceber);
    f = f.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
    if (!f.length) { listaEl.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
    emptyEl.style.display = 'none';
    listaEl.innerHTML = f.map(c => `
        <div class="fin-card${c.status === 'vencido' ? ' fin-card-vencido' : c.status === 'recebido' ? ' fin-card-pago' : ''}">
            <div class="fin-card-left">
                <span class="fin-cat-icon">💰</span>
                <div class="fin-card-info">
                    <div class="fin-card-desc">${escHtml(c.descricao)}</div>
                    <div class="fin-card-sub">
                        ${c.vencimento ? `📅 ${formatarData(c.vencimento)}` : ''}
                        ${c.obs ? ` · ${escHtml(c.obs)}` : ''}
                    </div>
                </div>
            </div>
            <div class="fin-card-right">
                <div class="fin-card-valor fin-verde">${fmt(c.valor)}</div>
                ${statusBadge(c.status)}
                <div class="fin-card-acoes">
                    ${c.status !== 'recebido' ? `<button class="fin-btn-marcar fin-btn-receber" data-id="${c.id}" data-col="receber" data-novo="recebido" title="Marcar como recebido">✓ Recebido</button>` : ''}
                    <button class="fin-card-edit-btn" data-id="${c.id}" data-col="receber" title="Editar">✏️</button>
                    <button class="fin-card-del-btn" data-id="${c.id}" data-col="receber" title="Excluir">🗑️</button>
                </div>
            </div>
        </div>`).join('');
    bindCardEvents(listaEl);
}

// ── bind eventos ───────────────────────────────────────────────────
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

// ── marcar status ──────────────────────────────────────────────────
async function marcarStatus(id, col, novoStatus) {
    const arr = col === 'pagar' ? dadosPagar : dadosReceber;
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
        atualizarResumo();
        toast(novoStatus === 'pago' ? '✅ Marcado como pago!' : '✅ Recebimento confirmado!');
    } catch { toast('⚠ Erro ao atualizar.'); }
}

// ── excluir ────────────────────────────────────────────────────────
async function excluir(id, col) {
    if (!confirm('Excluir este lançamento?')) return;
    const colecao = col === 'pagar' ? COL_PAGAR : col === 'fixa' ? COL_FIXAS : COL_RECEBER;
    try {
        await deleteDoc(doc(db, colecao, id));
        if (col === 'pagar')   dadosPagar   = dadosPagar.filter(c => c.id !== id);
        if (col === 'fixa')    dadosFixas   = dadosFixas.filter(c => c.id !== id);
        if (col === 'receber') dadosReceber = dadosReceber.filter(c => c.id !== id);
        renderPagar(dadosPagar); renderFixas(dadosFixas); renderReceber(dadosReceber);
        atualizarResumo();
        toast('🗑️ Removido.');
    } catch { toast('⚠ Erro ao excluir.'); }
}

// ── abrir edição ───────────────────────────────────────────────────
function abrirEdicao(id, col) {
    if (col === 'pagar') {
        const item = dadosPagar.find(c => c.id === id);
        if (!item) return;
        editandoId = id; editandoColecao = 'pagar';
        document.getElementById('form-pagar-titulo').textContent = 'Editar Conta';
        document.getElementById('fp-desc').value   = item.descricao || '';
        document.getElementById('fp-cat').value    = item.categoria || 'Outro';
        document.getElementById('fp-venc').value   = item.vencimento || '';
        document.getElementById('fp-valor').value  = item.valor || '';
        document.getElementById('fp-status').value = item.status === 'vencido' ? 'pendente' : (item.status || 'pendente');
        document.getElementById('fp-obs').value    = item.obs || '';
        document.getElementById('form-pagar').style.display = 'flex';
        document.getElementById('btn-nova-pagar').style.display = 'none';
    } else if (col === 'fixa') {
        const item = dadosFixas.find(c => c.id === id);
        if (!item) return;
        editandoId = id; editandoColecao = 'fixa';
        document.getElementById('form-fixa-titulo').textContent = 'Editar Despesa Fixa';
        document.getElementById('ff-desc').value  = item.descricao || '';
        document.getElementById('ff-cat').value   = item.categoria || 'Outro';
        document.getElementById('ff-dia').value   = item.dia || 10;
        document.getElementById('ff-valor').value = item.valor || '';
        document.getElementById('form-fixa').style.display = 'flex';
        document.getElementById('btn-nova-fixa').style.display = 'none';
    } else if (col === 'receber') {
        const item = dadosReceber.find(c => c.id === id);
        if (!item) return;
        editandoId = id; editandoColecao = 'receber';
        document.getElementById('form-receber-titulo').textContent = 'Editar Conta';
        document.getElementById('fr-desc').value   = item.descricao || '';
        document.getElementById('fr-venc').value   = item.vencimento || '';
        document.getElementById('fr-valor').value  = item.valor || '';
        document.getElementById('fr-status').value = item.status === 'vencido' ? 'pendente' : (item.status || 'pendente');
        document.getElementById('fr-obs').value    = item.obs || '';
        document.getElementById('form-receber').style.display = 'flex';
        document.getElementById('btn-nova-receber').style.display = 'none';
    }
}

// ── fechar forms ───────────────────────────────────────────────────
function fecharForm(formId, btnId) {
    document.getElementById(formId).style.display = 'none';
    document.getElementById(btnId).style.display = '';
    editandoId = null; editandoColecao = null;
}

// ── salvar PAGAR ───────────────────────────────────────────────────
async function salvarPagar() {
    const desc = document.getElementById('fp-desc').value.trim();
    if (!desc) { document.getElementById('fp-desc').focus(); return; }
    const dados = {
        descricao:   desc,
        categoria:   document.getElementById('fp-cat').value,
        vencimento:  document.getElementById('fp-venc').value,
        valor:       Number(document.getElementById('fp-valor').value) || 0,
        status:      document.getElementById('fp-status').value,
        obs:         document.getElementById('fp-obs').value.trim(),
        atualizadoEm: serverTimestamp()
    };
    const id = editandoId || `pag_${Date.now()}`;
    try {
        await setDoc(doc(db, COL_PAGAR, id), dados);
        toast(editandoId ? '✏️ Atualizado!' : '✅ Conta adicionada!');
        fecharForm('form-pagar', 'btn-nova-pagar');
        await recarregar('pagar');
    } catch { toast('⚠ Erro ao salvar.'); }
}

// ── salvar FIXA ────────────────────────────────────────────────────
async function salvarFixa() {
    const desc = document.getElementById('ff-desc').value.trim();
    if (!desc) { document.getElementById('ff-desc').focus(); return; }
    const dados = {
        descricao:   desc,
        categoria:   document.getElementById('ff-cat').value,
        dia:         Number(document.getElementById('ff-dia').value) || 1,
        valor:       Number(document.getElementById('ff-valor').value) || 0,
        atualizadoEm: serverTimestamp()
    };
    const id = editandoId || `fix_${Date.now()}`;
    try {
        await setDoc(doc(db, COL_FIXAS, id), dados);
        toast(editandoId ? '✏️ Atualizado!' : '✅ Despesa fixa adicionada!');
        fecharForm('form-fixa', 'btn-nova-fixa');
        await recarregar('fixa');
    } catch { toast('⚠ Erro ao salvar.'); }
}

// ── salvar RECEBER ─────────────────────────────────────────────────
async function salvarReceber() {
    const desc = document.getElementById('fr-desc').value.trim();
    if (!desc) { document.getElementById('fr-desc').focus(); return; }
    const dados = {
        descricao:   desc,
        vencimento:  document.getElementById('fr-venc').value,
        valor:       Number(document.getElementById('fr-valor').value) || 0,
        status:      document.getElementById('fr-status').value,
        obs:         document.getElementById('fr-obs').value.trim(),
        atualizadoEm: serverTimestamp()
    };
    const id = editandoId || `rec_${Date.now()}`;
    try {
        await setDoc(doc(db, COL_RECEBER, id), dados);
        toast(editandoId ? '✏️ Atualizado!' : '✅ Conta adicionada!');
        fecharForm('form-receber', 'btn-nova-receber');
        await recarregar('receber');
    } catch { toast('⚠ Erro ao salvar.'); }
}

// ── recarregar parcial ─────────────────────────────────────────────
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
        atualizarResumo();
    } catch {}
}

// ── busca global ───────────────────────────────────────────────────
function buscarGlobal() {
    const q = (document.getElementById('fin-busca')?.value || '').trim().toLowerCase();
    if (!q) {
        renderPagar(dadosPagar); renderFixas(dadosFixas); renderReceber(dadosReceber);
        return;
    }
    const filtrarLista = lista => lista.filter(c =>
        (c.descricao || '').toLowerCase().includes(q) ||
        (c.categoria || '').toLowerCase().includes(q) ||
        (c.obs || '').toLowerCase().includes(q)
    );
    renderPagar(filtrarLista(dadosPagar));
    renderFixas(filtrarLista(dadosFixas));
    renderReceber(filtrarLista(dadosReceber));
}

// ── utilitários ────────────────────────────────────────────────────
function formatarData(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}
function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── eventos ────────────────────────────────────────────────────────
// Contas a Pagar
document.getElementById('btn-nova-pagar').addEventListener('click', () => {
    editandoId = null; editandoColecao = null;
    document.getElementById('form-pagar-titulo').textContent = 'Nova Conta a Pagar';
    ['fp-desc','fp-obs'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('fp-cat').value    = 'Outro';
    document.getElementById('fp-venc').value   = '';
    document.getElementById('fp-valor').value  = '';
    document.getElementById('fp-status').value = 'pendente';
    document.getElementById('form-pagar').style.display = 'flex';
    document.getElementById('btn-nova-pagar').style.display = 'none';
    document.getElementById('fp-desc').focus();
});
document.getElementById('fp-salvar').addEventListener('click', salvarPagar);
document.getElementById('fp-cancelar').addEventListener('click', () => fecharForm('form-pagar', 'btn-nova-pagar'));

// Despesas Fixas
document.getElementById('btn-nova-fixa').addEventListener('click', () => {
    editandoId = null; editandoColecao = null;
    document.getElementById('form-fixa-titulo').textContent = 'Nova Despesa Fixa';
    document.getElementById('ff-desc').value  = '';
    document.getElementById('ff-cat').value   = 'Outro';
    document.getElementById('ff-dia').value   = '10';
    document.getElementById('ff-valor').value = '';
    document.getElementById('form-fixa').style.display = 'flex';
    document.getElementById('btn-nova-fixa').style.display = 'none';
    document.getElementById('ff-desc').focus();
});
document.getElementById('ff-salvar').addEventListener('click', salvarFixa);
document.getElementById('ff-cancelar').addEventListener('click', () => fecharForm('form-fixa', 'btn-nova-fixa'));

// Contas a Receber
document.getElementById('btn-nova-receber').addEventListener('click', () => {
    editandoId = null; editandoColecao = null;
    document.getElementById('form-receber-titulo').textContent = 'Nova Conta a Receber';
    ['fr-desc','fr-obs'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('fr-venc').value   = '';
    document.getElementById('fr-valor').value  = '';
    document.getElementById('fr-status').value = 'pendente';
    document.getElementById('form-receber').style.display = 'flex';
    document.getElementById('btn-nova-receber').style.display = 'none';
    document.getElementById('fr-desc').focus();
});
document.getElementById('fr-salvar').addEventListener('click', salvarReceber);
document.getElementById('fr-cancelar').addEventListener('click', () => fecharForm('form-receber', 'btn-nova-receber'));

// Busca
document.getElementById('fin-busca').addEventListener('input', buscarGlobal);
document.getElementById('fin-btn-listar').addEventListener('click', () => {
    document.getElementById('fin-busca').value = '';
    renderPagar(dadosPagar); renderFixas(dadosFixas); renderReceber(dadosReceber);
});

document.addEventListener('DOMContentLoaded', carregar);
