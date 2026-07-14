import { db, collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, query } from '../../scripts/firebase.js';
import { injectTenantFilter, tData } from '../../shared/tenant-query.js';
import { initModulo } from '../../scripts/kernel.js';
import { carregarPermissoes, podeVisualizar, podeCriar, podeEditar, podeExcluir } from '../../shared/permissoes.js';
import { escHtml } from '../../shared/sanitize.js';
import { formatDateOnly } from '../../shared/date-utils.js';

const COL_PAGAR   = 'financeiro_pagar';
const COL_FIXAS   = 'financeiro_fixas';
const COL_RECEBER = 'financeiro_receber';
const COL_CATS    = 'financeiro_categorias';

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

// ── toggle busca ───────────────────────────────────────────────────
const toggleBuscaBtn = document.getElementById('fin-toggle-busca');
const topBar = document.getElementById('fin-top-bar');
toggleBuscaBtn?.addEventListener('click', () => {
    topBar.classList.toggle('fin-busca-collapsed');
    toggleBuscaBtn.classList.toggle('expanded');
});

// ── tabs (delegated via ativarTab definido abaixo) ─────────────────
// listeners das 3 abas fixas são adicionados após a definição de ativarTab

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
            getDocs(query(collection(db, COL_PAGAR), ...injectTenantFilter([]))),
            getDocs(query(collection(db, COL_FIXAS), ...injectTenantFilter([]))),
            getDocs(query(collection(db, COL_RECEBER), ...injectTenantFilter([])))
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
    atualizarResumoCompleto();
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
                    ${c.status !== 'pago' && podeEditar('financeiro') ? `<button class="fin-btn-marcar" data-id="${c.id}" data-col="pagar" data-novo="pago" title="Marcar como pago">✓ Pago</button>` : ''}
                    ${podeEditar('financeiro')  ? `<button class="fin-card-edit-btn" data-id="${c.id}" data-col="pagar" title="Editar">✏️</button>` : ''}
                    ${podeExcluir('financeiro') ? `<button class="fin-card-del-btn" data-id="${c.id}" data-col="pagar" title="Excluir">🗑️</button>` : ''}
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
                    ${podeEditar('financeiro')  ? `<button class="fin-card-edit-btn" data-id="${c.id}" data-col="fixa" title="Editar">✏️</button>` : ''}
                    ${podeExcluir('financeiro') ? `<button class="fin-card-del-btn" data-id="${c.id}" data-col="fixa" title="Excluir">🗑️</button>` : ''}
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
                    ${c.status !== 'recebido' && podeEditar('financeiro') ? `<button class="fin-btn-marcar fin-btn-receber" data-id="${c.id}" data-col="receber" data-novo="recebido" title="Marcar como recebido">✓ Recebido</button>` : ''}
                    ${podeEditar('financeiro')  ? `<button class="fin-card-edit-btn" data-id="${c.id}" data-col="receber" title="Editar">✏️</button>` : ''}
                    ${podeExcluir('financeiro') ? `<button class="fin-card-del-btn" data-id="${c.id}" data-col="receber" title="Excluir">🗑️</button>` : ''}
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
        await setDoc(doc(db, colecao, id), tData(atualizado));
        if (col === 'pagar') {
            dadosPagar = dadosPagar.map(c => c.id === id ? atualizado : c);
            renderPagar(dadosPagar);
        } else {
            dadosReceber = dadosReceber.map(c => c.id === id ? atualizado : c);
            renderReceber(dadosReceber);
        }
        atualizarResumoCompleto();
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
        atualizarResumoCompleto();
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
        await setDoc(doc(db, COL_PAGAR, id), tData(dados));
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
        await setDoc(doc(db, COL_FIXAS, id), tData(dados));
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
        await setDoc(doc(db, COL_RECEBER, id), tData(dados));
        toast(editandoId ? '✏️ Atualizado!' : '✅ Conta adicionada!');
        fecharForm('form-receber', 'btn-nova-receber');
        await recarregar('receber');
    } catch { toast('⚠ Erro ao salvar.'); }
}

// ── recarregar parcial ─────────────────────────────────────────────
async function recarregar(col) {
    try {
        const colMap = {
            pagar:   { col: COL_PAGAR,   arr: () => dadosPagar,   render: renderPagar,   calc: 'pago' },
            fixa:    { col: COL_FIXAS,   arr: () => dadosFixas,   render: renderFixas },
            receber: { col: COL_RECEBER, arr: () => dadosReceber, render: renderReceber, calc: 'recebido' }
        };
        const m = colMap[col];
        if (!m) return;
        // Otimização: reler apenas a coleção afetada (não todas as 3)
        const sp = await getDocs(query(collection(db, m.col), ...injectTenantFilter([])));
        const arr = [];
        sp.forEach(d => arr.push({ id: d.id, ...d.data() }));
        if (m.calc) arr.forEach((c, i) => { arr[i] = calcStatus(c, m.calc); });
        if (col === 'pagar') dadosPagar = arr;
        else if (col === 'fixa') dadosFixas = arr;
        else if (col === 'receber') dadosReceber = arr;
        m.render(arr);
        atualizarResumoCompleto();
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

// ── Relatório Mensal ───────────────────────────────────────────────
function fmtDataRel(iso) { return formatDateOnly(iso, '—'); }
function ymKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function diaKey(iso) { return (iso||'').substring(0,7); }

function renderRelatorio() {
    const sel = document.getElementById('fin-rel-mes');
    const mes = sel?.value || ymKey(new Date());
    const [ano, mesNum] = mes.split('-').map(Number);

    // Status de fechamento
    const fechado = dadosFechamentos[mes];
    const fechadoEl = document.getElementById('fin-rel-status');
    if (fechadoEl) {
        if (fechado) {
            fechadoEl.className = 'fin-rel-status-fechado';
            fechadoEl.innerHTML = `🔒 Fechado — Saldo: ${fmt(fechado.saldoFinal)}`;
        } else {
            fechadoEl.className = 'fin-rel-status-aberto';
            fechadoEl.innerHTML = '📂 Mês aberto — ainda não fechado';
        }
    }

    // Botão fechar (controle de visibilidade)
    const btnFechar = document.getElementById('btn-fechar-mes');
    if (btnFechar) {
        btnFechar.style.display = fechado ? 'none' : '';
        btnFechar.disabled = false;
    }

    const itemsPagar   = dadosPagar.filter(c => diaKey(c.vencimento) === mes);
    const itemsReceber = dadosReceber.filter(c => diaKey(c.vencimento) === mes);
    const totalFixas   = dadosFixas.reduce((s,c) => s + Number(c.valor||0), 0);

    const totalRecebido = itemsReceber.filter(c => c.status === 'recebido').reduce((s,c) => s + Number(c.valor||0), 0);
    const totalAReceber = itemsReceber.filter(c => c.status !== 'recebido' && c.status !== 'vencido').reduce((s,c) => s + Number(c.valor||0), 0);
    const totalPago     = itemsPagar.filter(c => c.status === 'pago').reduce((s,c) => s + Number(c.valor||0), 0);
    const totalAPagar   = itemsPagar.filter(c => c.status !== 'pago' && c.status !== 'vencido').reduce((s,c) => s + Number(c.valor||0), 0);
    const totalVencido  = itemsPagar.filter(c => c.status === 'vencido').reduce((s,c) => s + Number(c.valor||0), 0);
    const totalVencidoRec = itemsReceber.filter(c => c.status === 'vencido').reduce((s,c) => s + Number(c.valor||0), 0);

    const receitaTotal = totalRecebido + totalAReceber;
    const despesaTotal = totalPago + totalAPagar + totalVencido + totalFixas;
    const saldo = receitaTotal - despesaTotal;

    document.getElementById('rel-rec-total').textContent   = fmt(totalRecebido + totalAReceber);
    document.getElementById('rel-rec-recebido').textContent = fmt(totalRecebido);
    document.getElementById('rel-rec-pendente').textContent = fmt(totalAReceber + totalVencidoRec);
    document.getElementById('rel-desp-total').textContent   = fmt(totalPago + totalAPagar + totalVencido + totalFixas);
    document.getElementById('rel-desp-pago').textContent    = fmt(totalPago);
    document.getElementById('rel-desp-pendente').textContent = fmt(totalAPagar + totalVencido);
    document.getElementById('rel-fixas-total').textContent  = fmt(totalFixas);
    document.getElementById('rel-saldo').textContent       = fmt(saldo);
    document.getElementById('rel-saldo').className         = `fin-rel-valor-grande ${saldo >= 0 ? 'fin-verde' : 'fin-vermelho'}`;

    // Lista de lançamentos do mês
    const todos = [
        ...itemsReceber.map(c => ({ ...c, tipo: 'receber', icon: '💰' })),
        ...itemsPagar.map(c => ({ ...c, tipo: 'pagar', icon: '💸' }))
    ].sort((a,b) => (a.vencimento||'').localeCompare(b.vencimento||''));

    const container = document.getElementById('fin-rel-lista');
    if (!todos.length) {
        container.innerHTML = '<div class="fin-empty" style="display:flex"><div class="fin-empty-icon">📊</div><div class="fin-empty-title">Nenhum lançamento neste mês</div></div>';
        return;
    }
    container.innerHTML = todos.map(c => {
        const isReceita = c.tipo === 'receber';
        const statusOk  = c.status === 'recebido' || c.status === 'pago';
        return `<div class="fin-card ${statusOk ? 'fin-card-pago' : c.status === 'vencido' ? 'fin-card-vencido' : ''}">
            <div class="fin-card-left">
                <span class="fin-cat-icon">${isReceita ? '💰' : '💸'}</span>
                <div class="fin-card-info">
                    <div class="fin-card-desc">${escHtml(c.descricao)}</div>
                    <div class="fin-card-sub">📅 ${fmtDataRel(c.vencimento)} · ${isReceita ? 'Receber' : 'Pagar'} · ${statusBadge(c.status)}</div>
                </div>
            </div>
            <div class="fin-card-right">
                <div class="fin-card-valor ${isReceita ? 'fin-verde' : ''}">${fmt(c.valor)}</div>
            </div>
        </div>`;
    }).join('');
}

function gerarMesesOption() {
    const sel = document.getElementById('fin-rel-mes');
    if (!sel) return;
    const hoje = new Date();
    const atual = ymKey(hoje);
    let opts = '';
    for (let i = -12; i <= 1; i++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        const key = ymKey(d);
        const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        opts += `<option value="${key}" ${key === atual ? 'selected' : ''}>${label.charAt(0).toUpperCase() + label.slice(1)}</option>`;
    }
    sel.innerHTML = opts;
}

// ── Fluxo de Caixa Projetado ──────────────────────────────────────
function renderFluxoCaixa() {
    const hoje = new Date();
    const hojeISO = hoje.toISOString().slice(0, 10);

    const periodos = [
        { label: '30 dias', dias: 30, id: 'fluxo-30' },
        { label: '60 dias', dias: 60, id: 'fluxo-60' },
        { label: '90 dias', dias: 90, id: 'fluxo-90' }
    ];

    for (const p of periodos) {
        const limite = new Date(hoje);
        limite.setDate(limite.getDate() + p.dias);
        const limiteISO = limite.toISOString().slice(0, 10);

        const aPagar   = dadosPagar.filter(c =>
            c.status !== 'pago' && c.vencimento && c.vencimento >= hojeISO && c.vencimento <= limiteISO
        ).reduce((s,c) => s + Number(c.valor||0), 0);

        const fixasNoPeriodo = dadosFixas.reduce((s,c) => s + Number(c.valor||0), 0);
        const mesesNoPeriodo = Math.max(1, Math.round(p.dias / 30));
        const totalFixas     = fixasNoPeriodo * mesesNoPeriodo;

        const aReceber = dadosReceber.filter(c =>
            c.status !== 'recebido' && c.vencimento && c.vencimento >= hojeISO && c.vencimento <= limiteISO
        ).reduce((s,c) => s + Number(c.valor||0), 0);

        const saldoProjetado = aReceber - aPagar - totalFixas;

        const el = document.getElementById(p.id);
        if (!el) continue;
        el.innerHTML = `
            <div class="fin-fluxo-header">
                <span class="fin-fluxo-label">${p.label}</span>
                <span class="fin-fluxo-saldo ${saldoProjetado >= 0 ? 'fin-verde' : 'fin-vermelho'}">${fmt(saldoProjetado)}</span>
            </div>
            <div class="fin-fluxo-detalhes">
                <span>📥 Receber: <strong>${fmt(aReceber)}</strong></span>
                <span>📤 Pagar: <strong>${fmt(aPagar)}</strong></span>
                <span>📌 Fixas: <strong>${fmt(totalFixas)}</strong></span>
            </div>`;
    }
}

// ── Geração Automática de Despesas Recorrentes ────────────────────
async function gerarDespesasDoMes() {
    if (!podeCriar('financeiro')) { toast('❌ Sem permissão'); return; }

    const hoje = new Date();
    const mesKey = ymKey(hoje);
    const mesAno = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // Verifica se já gerou para este mês
    const jaGerado = dadosPagar.some(c =>
        c.descricao && c.descricao.includes('(Fixa)') && diaKey(c.vencimento) === mesKey
    );
    if (jaGerado) {
        if (!confirm(`Despesas de ${mesAno} já foram geradas. Gerar novamente?`)) return;
    }

    let count = 0;
    for (const fixa of dadosFixas) {
        const dia = fixa.dia || 1;
        const vencISO = `${mesKey}-${String(dia).padStart(2, '0')}`;
        const descricao = `${fixa.descricao} (Fixa)`;

        // Evita duplicata exata
        if (dadosPagar.some(c => c.descricao === descricao && diaKey(c.vencimento) === mesKey)) continue;

        try {
            await setDoc(doc(db, COL_PAGAR, `fixa_${fixa.id}_${mesKey}`), tData({
                descricao,
                categoria: fixa.categoria || 'Outro',
                vencimento: vencISO,
                valor: Number(fixa.valor) || 0,
                status: 'pendente',
                obs: `Gerado automaticamente de "${fixa.descricao}"`,
                criadoEm: serverTimestamp(),
                atualizadoEm: serverTimestamp()
            }));
            count++;
        } catch(e) { console.warn('Erro ao gerar despesa fixa:', e); }
    }

    if (count > 0) {
        toast(`✅ ${count} despesa(s) gerada(s) para ${mesAno}`);
        await recarregar('pagar');
    } else {
        toast('📌 Nenhuma nova despesa para gerar');
    }
}

// ── Dashboard / Resumo Aprimorado ─────────────────────────────────
function atualizarResumoCompleto() {
    atualizarResumo();

    const aPagarVencido = dadosPagar.filter(c => c.status === 'vencido').reduce((s,c) => s + Number(c.valor||0), 0);
    const aReceberVencido = dadosReceber.filter(c => c.status === 'vencido').reduce((s,c) => s + Number(c.valor||0), 0);
    const aPagarPendente = dadosPagar.filter(c => c.status === 'pendente').reduce((s,c) => s + Number(c.valor||0), 0);
    const totalGeralPagar = dadosPagar.reduce((s,c) => s + Number(c.valor||0), 0);
    const totalGeralReceber = dadosReceber.reduce((s,c) => s + Number(c.valor||0), 0);

    const elVencido = document.getElementById('res-vencido');
    const elPendente = document.getElementById('res-pendente');
    const elTotalPagar = document.getElementById('res-total-pagar');
    const elTotalReceber = document.getElementById('res-total-receber');

    if (elVencido) elVencido.textContent = fmt(aPagarVencido + aReceberVencido);
    if (elPendente) elPendente.textContent = fmt(aPagarPendente);
    if (elTotalPagar) elTotalPagar.textContent = fmt(totalGeralPagar);
    if (elTotalReceber) elTotalReceber.textContent = fmt(totalGeralReceber);
}

// ── utilitários ────────────────────────────────────────────────────
function formatarData(iso) { return formatDateOnly(iso); }

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

// ── CATEGORIAS PERSONALIZADAS ──────────────────────────────────────
let categoriasCustom = []; // [{id, nome}]
let dadosCustom = {};      // {catId: [{id, descricao, valor, vencimento, status, obs}]}

async function carregarCategorias() {
    try {
        const snap = await getDocs(query(collection(db, COL_CATS), ...injectTenantFilter([])));
        categoriasCustom = [];
        snap.forEach(d => categoriasCustom.push({ id: d.id, ...d.data() }));
        categoriasCustom.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
        for (const cat of categoriasCustom) {
            const s = await getDocs(collection(db, `${COL_CATS}/${cat.id}/itens`));
            dadosCustom[cat.id] = [];
            s.forEach(d => dadosCustom[cat.id].push({ id: d.id, ...d.data() }));
            dadosCustom[cat.id] = dadosCustom[cat.id].map(c => calcStatus(c, 'pago'));
        }
    } catch { categoriasCustom = []; }
    renderTabsCustom();
    renderPainéisCustom();
}

function renderTabsCustom() {
    // Remove abas custom anteriores (mantém as 3 fixas + botão +)
    document.querySelectorAll('.fin-tab-custom').forEach(el => el.remove());
    const tabAdd = document.getElementById('fin-tab-add');
    categoriasCustom.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'fin-tab fin-tab-custom';
        btn.dataset.tab = 'custom-' + cat.id;
        btn.textContent = '📁 ' + cat.nome;
        tabAdd.before(btn);
        btn.addEventListener('click', () => ativarTab('custom-' + cat.id));
    });
}

function renderPainéisCustom() {
    const container = document.getElementById('fin-custom-panels');
    container.innerHTML = '';
    categoriasCustom.forEach(cat => {
        const itens = dadosCustom[cat.id] || [];
        const panel = document.createElement('div');
        panel.className = 'fin-panel';
        panel.id = 'tab-custom-' + cat.id;
        panel.innerHTML = `
            <div class="fin-panel-header-custom">
                <div class="fin-toolbar">
                    ${podeCriar('financeiro') ? `<button class="fin-btn-nova" data-catid="${cat.id}">＋ Novo Item</button>` : ''}
                </div>
                ${podeExcluir('financeiro') ? `<button class="fin-custom-del-tab" data-catid="${cat.id}">🗑 Excluir categoria</button>` : ''}
            </div>
            <div class="fin-form" id="form-custom-${cat.id}" style="display:none">
                <div class="fin-form-titulo">Novo Item — ${escHtml(cat.nome)}</div>
                <div class="fin-form-grid">
                    <div class="fin-form-group fin-span2"><label>Descrição</label><input type="text" id="cx-desc-${cat.id}" placeholder="Descrição..." maxlength="120"></div>
                    <div class="fin-form-group"><label>Vencimento</label><input type="date" id="cx-venc-${cat.id}"></div>
                    <div class="fin-form-group"><label>Valor (R$)</label><input type="number" id="cx-valor-${cat.id}" min="0" step="0.01" placeholder="0,00"></div>
                    <div class="fin-form-group"><label>Status</label><select id="cx-status-${cat.id}"><option value="pendente">🟡 Pendente</option><option value="pago">✅ Pago</option></select></div>
                    <div class="fin-form-group"><label>Observação</label><input type="text" id="cx-obs-${cat.id}" placeholder="Opcional..." maxlength="200"></div>
                </div>
                <div class="fin-form-btns">
                    <button class="fin-btn-salvar" data-save-cat="${cat.id}">Salvar</button>
                    <button class="fin-btn-cancelar" data-cancel-cat="${cat.id}">Cancelar</button>
                </div>
            </div>
            <div id="custom-lista-${cat.id}"></div>
            <div class="fin-empty" id="custom-empty-${cat.id}" style="${itens.length ? 'display:none' : 'display:flex'}">
                <div class="fin-empty-icon">📁</div>
                <div class="fin-empty-title">Nenhum item em ${escHtml(cat.nome)}</div>
            </div>`;
        container.appendChild(panel);
        renderCustomLista(cat.id, itens);

        // eventos do painel (botões condicionais ao RBAC podem não existir no DOM)
        panel.querySelector('[data-catid="' + cat.id + '"].fin-btn-nova')?.addEventListener('click', () => {
            panel.querySelector(`#form-custom-${cat.id}`).style.display = 'flex';
            panel.querySelector(`.fin-btn-nova`).style.display = 'none';
            panel.querySelector(`#cx-desc-${cat.id}`).focus();
        });
        panel.querySelector(`[data-save-cat="${cat.id}"]`).addEventListener('click', () => salvarCustomItem(cat.id, panel));
        panel.querySelector(`[data-cancel-cat="${cat.id}"]`).addEventListener('click', () => {
            panel.querySelector(`#form-custom-${cat.id}`).style.display = 'none';
            panel.querySelector(`.fin-btn-nova`).style.display = '';
        });
        panel.querySelector('.fin-custom-del-tab')?.addEventListener('click', () => excluirCategoria(cat.id, cat.nome));
    });
}

function renderCustomLista(catId, itens) {
    const listaEl = document.getElementById(`custom-lista-${catId}`);
    const emptyEl = document.getElementById(`custom-empty-${catId}`);
    const f = itens.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
    if (!f.length) { if (listaEl) listaEl.innerHTML = ''; if (emptyEl) emptyEl.style.display = 'flex'; return; }
    if (emptyEl) emptyEl.style.display = 'none';
    listaEl.innerHTML = f.map(c => `
        <div class="fin-card${c.status === 'vencido' ? ' fin-card-vencido' : c.status === 'pago' ? ' fin-card-pago' : ''}">
            <div class="fin-card-left">
                <span class="fin-cat-icon">📁</span>
                <div class="fin-card-info">
                    <div class="fin-card-desc">${escHtml(c.descricao)}</div>
                    <div class="fin-card-sub">${c.vencimento ? `📅 ${formatarData(c.vencimento)}` : ''}${c.obs ? ` · ${escHtml(c.obs)}` : ''}</div>
                </div>
            </div>
            <div class="fin-card-right">
                <div class="fin-card-valor">${fmt(c.valor)}</div>
                ${statusBadge(c.status)}
                <div class="fin-card-acoes">
                    ${c.status !== 'pago' && podeEditar('financeiro') ? `<button class="fin-btn-marcar" data-cid="${c.id}" data-catid="${catId}" title="Marcar pago">✓ Pago</button>` : ''}
                    ${podeExcluir('financeiro') ? `<button class="fin-card-del-btn" data-cid="${c.id}" data-catid="${catId}" title="Excluir">🗑️</button>` : ''}
                </div>
            </div>
        </div>`).join('');

    listaEl.querySelectorAll('.fin-btn-marcar').forEach(btn => {
        btn.addEventListener('click', () => marcarCustom(btn.dataset.catid, btn.dataset.cid, 'pago'));
    });
    listaEl.querySelectorAll('.fin-card-del-btn').forEach(btn => {
        btn.addEventListener('click', () => excluirCustomItem(btn.dataset.catid, btn.dataset.cid));
    });
}

async function salvarCustomItem(catId, panel) {
    const desc  = panel.querySelector(`#cx-desc-${catId}`)?.value.trim();
    if (!desc) { panel.querySelector(`#cx-desc-${catId}`)?.focus(); return; }
    const dados = {
        descricao:   desc,
        vencimento:  panel.querySelector(`#cx-venc-${catId}`)?.value || '',
        valor:       Number(panel.querySelector(`#cx-valor-${catId}`)?.value) || 0,
        status:      panel.querySelector(`#cx-status-${catId}`)?.value || 'pendente',
        obs:         panel.querySelector(`#cx-obs-${catId}`)?.value.trim() || '',
        atualizadoEm: serverTimestamp()
    };
    const id = `item_${Date.now()}`;
    try {
        await setDoc(doc(db, `${COL_CATS}/${catId}/itens`, id), dados);
        dadosCustom[catId] = dadosCustom[catId] || [];
        dadosCustom[catId].push({ id, ...dados });
        dadosCustom[catId] = dadosCustom[catId].map(c => calcStatus(c, 'pago'));
        renderCustomLista(catId, dadosCustom[catId]);
        panel.querySelector(`#form-custom-${catId}`).style.display = 'none';
        panel.querySelector('.fin-btn-nova').style.display = '';
        ['cx-desc-', 'cx-venc-', 'cx-valor-', 'cx-obs-'].forEach(p => { const el = panel.querySelector(`#${p}${catId}`); if (el) el.value = ''; });
        toast('✅ Item adicionado!');
    } catch { toast('⚠ Erro ao salvar.'); }
}

async function marcarCustom(catId, itemId, novoStatus) {
    const itens = dadosCustom[catId] || [];
    const item = itens.find(c => c.id === itemId);
    if (!item) return;
    const atualizado = { ...item, status: novoStatus };
    try {
        await setDoc(doc(db, `${COL_CATS}/${catId}/itens`, itemId), atualizado);
        dadosCustom[catId] = itens.map(c => c.id === itemId ? atualizado : c);
        renderCustomLista(catId, dadosCustom[catId]);
        toast('✅ Marcado como pago!');
    } catch { toast('⚠ Erro.'); }
}

async function excluirCustomItem(catId, itemId) {
    if (!confirm('Excluir este item?')) return;
    try {
        await deleteDoc(doc(db, `${COL_CATS}/${catId}/itens`, itemId));
        dadosCustom[catId] = (dadosCustom[catId] || []).filter(c => c.id !== itemId);
        renderCustomLista(catId, dadosCustom[catId]);
        toast('🗑️ Removido.');
    } catch { toast('⚠ Erro.'); }
}

async function excluirCategoria(catId, nome) {
    if (!confirm(`Excluir a categoria "${nome}" e todos os seus itens?`)) return;
    try {
        // deleta itens da subcoleção
        const snap = await getDocs(collection(db, `${COL_CATS}/${catId}/itens`));
        for (const d of snap.docs) await deleteDoc(d.ref);
        await deleteDoc(doc(db, COL_CATS, catId));
        categoriasCustom = categoriasCustom.filter(c => c.id !== catId);
        delete dadosCustom[catId];
        renderTabsCustom();
        renderPainéisCustom();
        // volta para aba "pagar"
        ativarTab('pagar');
        toast('🗑️ Categoria excluída.');
    } catch { toast('⚠ Erro ao excluir.'); }
}

function ativarTab(tabId) {
    document.querySelectorAll('.fin-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.fin-panel').forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`[data-tab="${tabId}"]`);
    const panel = document.getElementById('tab-' + tabId);
    if (btn)   btn.classList.add('active');
    if (panel) panel.classList.add('active');
}

// Botão "+" para nova categoria
document.getElementById('fin-tab-add').addEventListener('click', () => {
    document.getElementById('fin-cat-nome').value = '';
    document.getElementById('fin-modal-cat').style.display = 'flex';
    setTimeout(() => document.getElementById('fin-cat-nome').focus(), 50);
});
document.getElementById('fin-cat-cancelar').addEventListener('click', () => {
    document.getElementById('fin-modal-cat').style.display = 'none';
});
document.getElementById('fin-cat-salvar').addEventListener('click', async () => {
    const nome = document.getElementById('fin-cat-nome').value.trim();
    if (!nome) { document.getElementById('fin-cat-nome').focus(); return; }
    const id = `cat_${Date.now()}`;
    try {
        await setDoc(doc(db, COL_CATS, id), tData({ nome, criadoEm: serverTimestamp() }));
        document.getElementById('fin-modal-cat').style.display = 'none';
        categoriasCustom.push({ id, nome });
        dadosCustom[id] = [];
        renderTabsCustom();
        renderPainéisCustom();
        ativarTab('custom-' + id);
        toast(`✅ Categoria "${nome}" criada!`);
    } catch { toast('⚠ Erro ao criar categoria.'); }
});
document.getElementById('fin-cat-nome').addEventListener('keypress', e => {
    if (e.key === 'Enter') document.getElementById('fin-cat-salvar').click();
});
document.getElementById('fin-modal-cat').addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('fin-modal-cat').style.display = 'none';
});

// sobrescreve a função de tabs para incluir custom + relatório
document.querySelectorAll('.fin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        ativarTab(btn.dataset.tab);
        if (btn.dataset.tab === 'relatorio') {
            renderRelatorio();
            renderFluxoCaixa();
            renderAnaliseCategoria();
            renderHistoricoFechamentos();
        }
    });
});

// ── Coleção de Fechamentos ─────────────────────────────────────────
const COL_FECHAMENTOS = 'financeiro_fechamentos';
let dadosFechamentos = {}; // {mesKey: {receita, despesa, saldo, ...}}

async function carregarFechamentos() {
    try {
        const snap = await getDocs(query(collection(db, COL_FECHAMENTOS), ...injectTenantFilter([])));
        dadosFechamentos = {};
        snap.forEach(d => { dadosFechamentos[d.id] = { id: d.id, ...d.data() }; });
    } catch { dadosFechamentos = {}; }
}

// ── Fechamento Mensal ──────────────────────────────────────────────
async function fecharMes(mesKey) {
    if (!podeEditar('financeiro')) { toast('❌ Sem permissão'); return; }
    if (!mesKey) mesKey = document.getElementById('fin-rel-mes')?.value || ymKey(new Date());

    // Verifica se mês já foi fechado
    if (dadosFechamentos[mesKey]) {
        if (!confirm(`Mês ${mesKey} já foi fechado. Refazer fechamento?`)) return;
    }

    const [ano, mes] = mesKey.split('-').map(Number);
    const dataRef = new Date(ano, mes - 1, 1);
    const label = dataRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // Calcula totais do mês
    const itemsPagar   = dadosPagar.filter(c => diaKey(c.vencimento) === mesKey);
    const itemsReceber = dadosReceber.filter(c => diaKey(c.vencimento) === mesKey);

    const totalRecebido = itemsReceber.filter(c => c.status === 'recebido').reduce((s,c) => s + Number(c.valor||0), 0);
    const totalAReceber = itemsReceber.filter(c => c.status !== 'recebido').reduce((s,c) => s + Number(c.valor||0), 0);
    const totalPago     = itemsPagar.filter(c => c.status === 'pago').reduce((s,c) => s + Number(c.valor||0), 0);
    const totalAPagar   = itemsPagar.filter(c => c.status !== 'pago').reduce((s,c) => s + Number(c.valor||0), 0);
    const totalFixas    = dadosFixas.reduce((s,c) => s + Number(c.valor||0), 0);

    const receitaTotal = totalRecebido + totalAReceber;
    const despesaTotal = totalPago + totalAPagar + totalFixas;
    const saldoFinal   = receitaTotal - despesaTotal;

    const fechamento = {
        mes: mesKey,
        label,
        receitaTotal,
        despesaTotal,
        saldoFinal,
        totalRecebido,
        totalAReceber,
        totalPago,
        totalAPagar,
        totalFixas,
        qtdPagar: itemsPagar.length,
        qtdReceber: itemsReceber.length,
        qtdFixas: dadosFixas.length,
        fechadoEm: serverTimestamp()
    };

    try {
        await setDoc(doc(db, COL_FECHAMENTOS, mesKey), tData(fechamento));
        dadosFechamentos[mesKey] = { id: mesKey, ...fechamento };
        toast(`✅ Mês ${label} fechado! Saldo: ${fmt(saldoFinal)}`);

        // Gera despesas do próximo mês automaticamente
        const proxMes = new Date(ano, mes, 1); // mês seguinte
        const proxKey = ymKey(proxMes);
        let countFixas = 0;
        for (const fixa of dadosFixas) {
            const dia = fixa.dia || 1;
            const vencISO = `${proxKey}-${String(dia).padStart(2, '0')}`;
            const desc = `${fixa.descricao} (Fixa)`;
            if (dadosPagar.some(c => c.descricao === desc && diaKey(c.vencimento) === proxKey)) continue;
            try {
                await setDoc(doc(db, COL_PAGAR, `fixa_${fixa.id}_${proxKey}`), tData({
                    descricao: desc, categoria: fixa.categoria || 'Outro',
                    vencimento: vencISO, valor: Number(fixa.valor) || 0,
                    status: 'pendente', obs: `Gerado no fechamento de ${mesKey}`,
                    criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp()
                }));
                countFixas++;
            } catch(e) { console.warn('Erro ao gerar fixa pós-fechamento:', e); }
        }

        await recarregar('pagar');
        renderRelatorio();
        renderFluxoCaixa();
        renderHistoricoFechamentos();
        if (countFixas > 0) toast(`📌 ${countFixas} despesa(s) gerada(s) para ${ymKey(proxMes)}`);
    } catch(e) {
        console.error('Erro ao fechar mês:', e);
        toast('❌ Erro ao fechar mês');
    }
}

// ── Histórico de Fechamentos ───────────────────────────────────────
function renderHistoricoFechamentos() {
    const container = document.getElementById('fin-historico-fechamentos');
    if (!container) return;

    const keys = Object.keys(dadosFechamentos).sort().reverse();
    if (!keys.length) {
        container.innerHTML = '<div class="fin-empty" style="display:flex;padding:16px"><div class="fin-empty-icon">🔒</div><div class="fin-empty-title">Nenhum mês fechado ainda</div></div>';
        return;
    }

    container.innerHTML = keys.map(key => {
        const f = dadosFechamentos[key];
        const className = f.saldoFinal >= 0 ? 'fin-verde' : 'fin-vermelho';
        return `<div class="fin-hist-card" onclick="document.getElementById('fin-rel-mes').value='${key}';renderRelatorio();renderFluxoCaixa();">
            <div class="fin-hist-mes">${f.label || key}</div>
            <div class="fin-hist-valores">
                <span>📥 ${fmt(f.receitaTotal)}</span>
                <span>📤 ${fmt(f.despesaTotal)}</span>
            </div>
            <div class="fin-hist-saldo ${className}">${fmt(f.saldoFinal)}</div>
            <div class="fin-hist-sub">${f.qtdPagar || 0} contas · ${f.qtdFixas || 0} fixas</div>
        </div>`;
    }).join('');
}

// ── Análise por Categoria ──────────────────────────────────────────
function renderAnaliseCategoria() {
    const container = document.getElementById('fin-analise-categoria');
    if (!container) return;

    const sel = document.getElementById('fin-rel-mes');
    const mes = sel?.value || ymKey(new Date());

    const itemsPagar = dadosPagar.filter(c => diaKey(c.vencimento) === mes && c.status !== 'pago');
    const itemsReceber = dadosReceber.filter(c => diaKey(c.vencimento) === mes && c.status !== 'recebido');

    if (!itemsPagar.length && !itemsReceber.length) {
        container.innerHTML = '<div class="fin-empty" style="display:flex;padding:16px"><div class="fin-empty-icon">📊</div><div class="fin-empty-title">Nenhum dado para análise</div></div>';
        return;
    }

    // Agrupa pagar por categoria
    const catsPagar = {};
    itemsPagar.forEach(c => {
        const cat = c.categoria || 'Outro';
        catsPagar[cat] = (catsPagar[cat] || 0) + Number(c.valor || 0);
    });
    const totalPagar = Object.values(catsPagar).reduce((s, v) => s + v, 0);

    // Agrupa receber por descrição (já que receber não tem categoria)
    const totalReceber = itemsReceber.reduce((s, c) => s + Number(c.valor || 0), 0);

    let html = '';

    if (totalPagar > 0) {
        html += `<div class="fin-analise-subtitle">💸 Despesas por Categoria</div>`;
        html += `<div class="fin-analise-bars">`;
        const sorted = Object.entries(catsPagar).sort((a, b) => b[1] - a[1]);
        sorted.forEach(([cat, valor]) => {
            const pct = (valor / totalPagar * 100).toFixed(1);
            const icon = CAT_ICON[cat] || '📌';
            html += `<div class="fin-analise-item">
                <div class="fin-analise-header">
                    <span>${icon} ${cat}</span>
                    <span><strong>${fmt(valor)}</strong> (${pct}%)</span>
                </div>
                <div class="fin-analise-bar-track">
                    <div class="fin-analise-bar-fill" style="width:${pct}%"></div>
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    if (totalReceber > 0) {
        html += `<div class="fin-analise-subtitle" style="margin-top:16px">💰 Receitas</div>`;
        html += `<div class="fin-analise-total">Total a receber: <strong class="fin-verde">${fmt(totalReceber)}</strong></div>`;
    }

    container.innerHTML = html || '<div class="fin-empty" style="display:flex;padding:16px"><div class="fin-empty-icon">📊</div><div class="fin-empty-title">Nenhum dado para análise</div></div>';
}

// ── exports globais ────────────────────────────────────────────────
window.renderRelatorio = renderRelatorio;
window.renderFluxoCaixa = renderFluxoCaixa;
window.gerarDespesasDoMes = gerarDespesasDoMes;
window.fecharMes = fecharMes;
window.renderAnaliseCategoria = renderAnaliseCategoria;
window.carregarFechamentos = carregarFechamentos;
window.renderHistoricoFechamentos = renderHistoricoFechamentos;
window.ymKey = ymKey;

// ── boot (RBAC Fase 2, Sprint 4 — moduloId 'financeiro') ────────────
async function _boot() {
    const ctx = await initModulo();
    if (!ctx) return; // kernel.js já redirecionou para login
    await carregarPermissoes(ctx);
    if (!podeVisualizar('financeiro')) { window.location.href = (location.pathname==='/dev'||location.pathname.startsWith('/dev/')?'/dev':'') + '/CRM/pages/dashboard/index.html'; return; }
    if (!podeCriar('financeiro')) {
        document.getElementById('btn-nova-pagar').style.display = 'none';
        document.getElementById('btn-nova-fixa').style.display = 'none';
        document.getElementById('btn-nova-receber').style.display = 'none';
        document.getElementById('fin-tab-add').style.display = 'none';
    }

    await carregar();
    await carregarCategorias();
    await carregarFechamentos();
    gerarMesesOption();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
} else {
    _boot();
}
