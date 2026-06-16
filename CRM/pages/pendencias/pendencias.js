import { db, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from '../../scripts/firebase.js';

const COL = 'pendencias';

const TIPO = {
    cliente_devendo: { label: 'Cliente Devendo', badgeClass: 'badge--cliente', cardClass: 'pend-card--cliente' },
    colega_parceiro: { label: 'Colega / Parceiro', badgeClass: 'badge--colega',  cardClass: 'pend-card--colega' },
    eu_devo:         { label: 'Eu Devo',           badgeClass: 'badge--eu',       cardClass: 'pend-card--eu' },
    emprestimo:      { label: 'Empréstimo',         badgeClass: 'badge--emprestimo', cardClass: 'pend-card--emprestimo' },
};

let todos = [];
let abaAtiva = 'todos';
let mostrarResolvidos = false;
let editandoId = null;

// ── toast ──────────────────────────────────────────────────────────
const toastEl = document.getElementById('pend-toast');
let toastTimer;
function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), 2200);
}

// ── utilitários ────────────────────────────────────────────────────
function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatarValor(v) {
    if (v === null || v === undefined || v === '' || isNaN(Number(v))) return null;
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(d) {
    if (!d) return '';
    const [ano, mes, dia] = d.split('-');
    return `${dia}/${mes}/${ano}`;
}

function wppLink(tel, nome) {
    const digits = (tel || '').replace(/\D/g, '');
    if (!digits) return null;
    const num = digits.startsWith('55') ? digits : '55' + digits;
    const texto = encodeURIComponent(`Olá ${nome || ''}!`);
    return `https://wa.me/${num}?text=${texto}`;
}

// ── totais ─────────────────────────────────────────────────────────
function atualizarTotais(itens) {
    const abertos = itens.filter(i => i.status !== 'resolvido');

    let receber = 0;
    let pagar = 0;
    let emprestimos = 0;

    abertos.forEach(i => {
        const v = Number(i.valor) || 0;
        if (i.tipo === 'cliente_devendo' || i.tipo === 'colega_parceiro') receber += v;
        if (i.tipo === 'eu_devo') pagar += v;
        if (i.tipo === 'emprestimo') emprestimos++;
    });

    document.getElementById('total-receber').textContent =
        receber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('total-pagar').textContent =
        pagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('total-emprestimos').textContent = emprestimos;
}

// ── carregamento ───────────────────────────────────────────────────
async function carregar() {
    document.getElementById('pend-loading').style.display = 'flex';
    try {
        const snap = await getDocs(collection(db, COL));
        todos = [];
        snap.forEach(d => todos.push({ id: d.id, ...d.data() }));
        todos.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
    } catch (e) {
        console.error('[Pendências]', e);
        todos = [];
    }
    document.getElementById('pend-loading').style.display = 'none';
    atualizarTotais(todos);
    renderizar();
}

// ── renderização ───────────────────────────────────────────────────
function filtrados() {
    return todos.filter(i => {
        if (!mostrarResolvidos && i.status === 'resolvido') return false;
        if (abaAtiva === 'todos') return true;
        return i.tipo === abaAtiva;
    });
}

function renderizar() {
    const listaEl = document.getElementById('pend-lista');
    const emptyEl = document.getElementById('pend-empty');
    const itens = filtrados();

    if (!itens.length) {
        listaEl.innerHTML = '';
        emptyEl.style.display = 'flex';
        return;
    }
    emptyEl.style.display = 'none';

    listaEl.innerHTML = itens.map(item => {
        const t = TIPO[item.tipo] || TIPO.cliente_devendo;
        const resolvido = item.status === 'resolvido';
        const val = formatarValor(item.valor);
        const link = wppLink(item.telefone, item.nome);
        const badgeClass = resolvido ? 'badge--resolvido' : t.badgeClass;
        const badgeLabel = resolvido ? `${t.label} · Resolvido` : t.label;

        return `
        <div class="pend-card ${t.cardClass}${resolvido ? ' pend-card--resolvido' : ''}" data-id="${item.id}">
            <div class="pend-card-info">
                <span class="pend-card-badge ${badgeClass}">${badgeLabel}</span>
                <div class="pend-card-nome">${escHtml(item.nome)}</div>
                ${item.descricao ? `<div class="pend-card-desc">${escHtml(item.descricao)}</div>` : ''}
                ${val ? `<div class="pend-card-valor">${val}</div>` : ''}
                ${item.data ? `<div class="pend-card-meta">📅 ${formatarData(item.data)}</div>` : ''}
            </div>
            <div class="pend-card-acoes">
                ${link ? `<a class="pend-btn-wpp" href="${link}" target="_blank" rel="noopener">📱 WhatsApp</a>` : ''}
                ${resolvido
                    ? `<button class="pend-btn-reabrir" data-id="${item.id}">↩ Reabrir</button>`
                    : `<button class="pend-btn-resolver" data-id="${item.id}">✓ Resolver</button>`
                }
                <div class="pend-card-util">
                    <button class="pend-btn-edit" data-id="${item.id}" title="Editar">✏️</button>
                    <button class="pend-btn-del" data-id="${item.id}">✕</button>
                </div>
            </div>
        </div>`;
    }).join('');

    listaEl.querySelectorAll('.pend-btn-resolver').forEach(btn =>
        btn.addEventListener('click', () => alterarStatus(btn.dataset.id, 'resolvido')));
    listaEl.querySelectorAll('.pend-btn-reabrir').forEach(btn =>
        btn.addEventListener('click', () => alterarStatus(btn.dataset.id, 'aberto')));
    listaEl.querySelectorAll('.pend-btn-edit').forEach(btn =>
        btn.addEventListener('click', () => abrirEdicao(btn.dataset.id)));
    listaEl.querySelectorAll('.pend-btn-del').forEach(btn =>
        btn.addEventListener('click', () => excluir(btn.dataset.id)));
}

// ── status ─────────────────────────────────────────────────────────
async function alterarStatus(id, novoStatus) {
    try {
        await updateDoc(doc(db, COL, id), { status: novoStatus, atualizadoEm: serverTimestamp() });
        toast(novoStatus === 'resolvido' ? '✅ Marcado como resolvido!' : '↩ Reaberto.');
        await carregar();
    } catch { toast('⚠ Erro ao atualizar.'); }
}

// ── form ───────────────────────────────────────────────────────────
function abrirForm() {
    editandoId = null;
    document.getElementById('pend-form-titulo').textContent = 'Nova Pendência';
    document.getElementById('pf-nome').value = '';
    document.getElementById('pf-tipo').value = 'cliente_devendo';
    document.getElementById('pf-valor').value = '';
    document.getElementById('pf-descricao').value = '';
    document.getElementById('pf-telefone').value = '';
    document.getElementById('pf-data').value = new Date().toISOString().slice(0, 10);
    document.getElementById('pend-form').style.display = 'flex';
    document.getElementById('btn-nova-pend').style.display = 'none';
    document.getElementById('pf-nome').focus();
}

function abrirEdicao(id) {
    const item = todos.find(x => x.id === id);
    if (!item) return;
    editandoId = id;
    document.getElementById('pend-form-titulo').textContent = 'Editar Pendência';
    document.getElementById('pf-nome').value = item.nome || '';
    document.getElementById('pf-tipo').value = item.tipo || 'cliente_devendo';
    document.getElementById('pf-valor').value = item.valor != null ? item.valor : '';
    document.getElementById('pf-descricao').value = item.descricao || '';
    document.getElementById('pf-telefone').value = item.telefone || '';
    document.getElementById('pf-data').value = item.data || '';
    document.getElementById('pend-form').style.display = 'flex';
    document.getElementById('btn-nova-pend').style.display = 'none';
    document.getElementById('pf-nome').focus();
}

function fecharForm() {
    document.getElementById('pend-form').style.display = 'none';
    document.getElementById('btn-nova-pend').style.display = '';
    editandoId = null;
}

async function salvar() {
    const nome = document.getElementById('pf-nome').value.trim();
    if (!nome) { document.getElementById('pf-nome').focus(); return; }

    const valorRaw = document.getElementById('pf-valor').value;
    const dados = {
        nome,
        tipo:      document.getElementById('pf-tipo').value,
        valor:     valorRaw !== '' ? Number(valorRaw) : null,
        descricao: document.getElementById('pf-descricao').value.trim(),
        telefone:  document.getElementById('pf-telefone').value.trim(),
        data:      document.getElementById('pf-data').value,
        status:    editandoId ? (todos.find(x => x.id === editandoId)?.status || 'aberto') : 'aberto',
        atualizadoEm: serverTimestamp(),
    };
    if (!editandoId) dados.criadoEm = serverTimestamp();

    const id = editandoId || `pend_${Date.now()}`;
    try {
        await setDoc(doc(db, COL, id), dados, { merge: true });
        toast(editandoId ? '✏️ Atualizado!' : '✅ Pendência adicionada!');
        fecharForm();
        await carregar();
    } catch { toast('⚠ Erro ao salvar.'); }
}

async function excluir(id) {
    if (!confirm('Excluir esta pendência? Esta ação não pode ser desfeita.')) return;
    try {
        await deleteDoc(doc(db, COL, id));
        toast('🗑️ Excluído.');
        await carregar();
    } catch { toast('⚠ Erro ao excluir.'); }
}

// ── eventos ────────────────────────────────────────────────────────
document.getElementById('btn-nova-pend').addEventListener('click', abrirForm);
document.getElementById('pf-salvar').addEventListener('click', salvar);
document.getElementById('pf-cancelar').addEventListener('click', fecharForm);
document.getElementById('pf-nome').addEventListener('keypress', e => { if (e.key === 'Enter') salvar(); });

document.querySelectorAll('.pend-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.pend-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        abaAtiva = btn.dataset.tab;
        renderizar();
    });
});

document.getElementById('chk-resolvidos').addEventListener('change', e => {
    mostrarResolvidos = e.target.checked;
    renderizar();
});

document.addEventListener('DOMContentLoaded', carregar);
