/* ============================================================
   COMPRAS — Módulo de compras financeiras Cell City Gestão Empresarial
   Coleções Firestore:
     compras_financeiras        — cabeçalho da compra
     compras_financeiras/{id}/itens — itens de cada compra
     financeiro_pagar           — lançamento automático criado
   ============================================================ */
import {
    db, collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, getDoc, runTransaction
} from '../../scripts/firebase.js';
import { logAudit }           from '../../shared/auditoria.js';
import { moverParaLixeira }   from '../../shared/lixeira.js';
import { mostrarMenuExportar } from '../../shared/exportar.js';

const COL_COMPRAS      = 'compras_financeiras';
const COL_FORNECEDORES = 'fornecedores';
const COL_FIN_PAGAR    = 'financeiro_pagar';
const COL_ESTOQUE      = 'estoque_produtos';

const fmt = v => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const hoje = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => new Date().toISOString().slice(0, 7); // "2026-06"
const $ = id => document.getElementById(id);

/* ── Estado ──────────────────────────────────────────────────── */
let comprasData    = [];
let fornecedores   = [];
let secaoAtiva     = 'home';
let filtroStatus   = 'todos';
let editandoId     = null;
let itensForm      = [];       // [{id, produto, quantidade, valorUnitario, valorTotal}]
let itensExpandidos = {};      // {compraId: [{...}]}
let excluirCallback = null;    // para o modal de confirmação

/* ── Utilitários ─────────────────────────────────────────────── */
function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatarData(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}
const PAGAMENTO_LABEL = {
    pix: '💸 PIX', dinheiro: '💵 Dinheiro', boleto: '🧾 Boleto',
    cartao: '💳 Cartão', prazo: '📅 A Prazo', transferencia: '🏦 Transferência'
};
const STATUS_BADGE = {
    pendente: '<span class="cmp-badge badge-pendente">Pendente</span>',
    parcial:  '<span class="cmp-badge badge-parcial">Parcial</span>',
    pago:     '<span class="cmp-badge badge-pago">Pago</span>',
};

/* ── Toast ───────────────────────────────────────────────────── */
let toastTimer;
function toast(msg) {
    const el = $('cmp-toast');
    el.textContent = msg;
    el.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visivel'), 2500);
}

/* ── Modal confirmar exclusão ─────────────────────────────────── */
function confirmar(mensagem, cb) {
    $('cmp-modal-body').textContent = mensagem;
    $('cmp-modal').style.display = 'flex';
    excluirCallback = cb;
}
$('cmp-modal-ok')?.addEventListener('click', () => {
    $('cmp-modal').style.display = 'none';
    if (excluirCallback) excluirCallback();
    excluirCallback = null;
});
$('cmp-modal-cancel')?.addEventListener('click', () => {
    $('cmp-modal').style.display = 'none';
    excluirCallback = null;
});
$('cmp-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) {
        $('cmp-modal').style.display = 'none';
        excluirCallback = null;
    }
});

/* ── Sidebar mobile ──────────────────────────────────────────── */
const sidebarEl = $('cmp-sidebar');
const overlayEl = $('cmp-sb-overlay');
$('cmp-sb-open')?.addEventListener('click', () => {
    sidebarEl.classList.add('open'); overlayEl.classList.add('open');
});
overlayEl?.addEventListener('click', () => {
    sidebarEl.classList.remove('open'); overlayEl.classList.remove('open');
});
function fecharSidebar() {
    sidebarEl.classList.remove('open'); overlayEl.classList.remove('open');
}

/* ── Navegação ───────────────────────────────────────────────── */
const SEC_TITLES = {
    home:      '🛒 Compras',
    todas:     '📋 Todas as Compras',
    pendentes: '⏳ Compras Pendentes',
    pagas:     '✅ Compras Pagas',
    resumo:    '📊 Resumo',
};

function navegar(sec) {
    secaoAtiva = sec;
    fecharSidebar();

    document.querySelectorAll('.cmp-sb-item[data-sec]').forEach(el => {
        el.classList.toggle('active', el.dataset.sec === sec);
    });

    $('cmp-main-titulo').textContent = SEC_TITLES[sec] || sec;

    $('cmp-sec-home').style.display    = sec === 'home'   ? '' : 'none';
    $('cmp-sec-lista').style.display   = ['todas','pendentes','pagas'].includes(sec) ? '' : 'none';
    $('cmp-sec-resumo').style.display  = sec === 'resumo' ? '' : 'none';

    if (['todas','pendentes','pagas'].includes(sec)) {
        filtroStatus = sec === 'todas' ? 'todos' : (sec === 'pendentes' ? 'pendente' : 'pago');
        renderLista();
    }
}

document.querySelectorAll('.cmp-sb-item[data-sec]').forEach(el => {
    el.addEventListener('click', () => navegar(el.dataset.sec));
});
document.querySelectorAll('.cmp-home-block[data-sec]').forEach(el => {
    el.addEventListener('click', () => navegar(el.dataset.sec));
});

/* ── Botão ＋ Nova Compra ─────────────────────────────────────── */
$('cmp-btn-novo')?.addEventListener('click', () => {
    if (!['todas','pendentes','pagas'].includes(secaoAtiva)) navegar('todas');
    abrirFormNovo();
});

/* ── Busca ───────────────────────────────────────────────────── */
$('cmp-search')?.addEventListener('input', () => {
    if (['todas','pendentes','pagas'].includes(secaoAtiva)) renderLista();
});

/* ── Carregar dados ──────────────────────────────────────────── */
async function carregar() {
    try {
        const [snapC, snapF] = await Promise.all([
            getDocs(collection(db, COL_COMPRAS)),
            getDocs(collection(db, COL_FORNECEDORES))
        ]);
        comprasData = [];
        snapC.forEach(d => comprasData.push({ id: d.id, ...d.data() }));
        fornecedores = [];
        snapF.forEach(d => fornecedores.push({ id: d.id, ...d.data() }));
        comprasData.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    } catch { comprasData = []; fornecedores = []; }

    $('cmp-loading').style.display = 'none';
    popularSelectFornecedor();
    atualizarContadores();
    renderLista();
}

function popularSelectFornecedor() {
    const sel = $('cmp-fornecedor');
    if (!sel) return;
    const atual = sel.value;
    sel.innerHTML = '<option value="">— Selecione o fornecedor —</option>';
    fornecedores.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
    fornecedores.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.nome + (f.cidade ? ` — ${f.cidade}` : '');
        sel.appendChild(opt);
    });
    if (atual) sel.value = atual;
}

/* ── Contadores ──────────────────────────────────────────────── */
function atualizarContadores() {
    const mes = mesAtual();
    const doMes = comprasData.filter(c => (c.data || '').startsWith(mes));
    const pendentes = comprasData.filter(c => c.status === 'pendente' || c.status === 'parcial');
    const pagas = comprasData.filter(c => c.status === 'pago');

    const totalMes = doMes.reduce((s, c) => s + Number(c.valorTotal || 0), 0);
    const totalPago = comprasData.filter(c => c.status === 'pago').reduce((s, c) => s + Number(c.valorTotal || 0), 0);
    const totalPendente = pendentes.reduce((s, c) => s + Number(c.valorTotal || 0), 0);

    // Sidebar
    atualizarCount('sb-count-todas', comprasData.length);
    atualizarCount('sb-count-pendentes', pendentes.length);
    atualizarCount('sb-count-pagas', pagas.length);

    // Home grid
    atualizarFmt('hc-mes', totalMes, 'hc-mes');
    atualizarFmt('hc-qtd-mes', doMes.length, 'hc-qtd-mes', true);
    atualizarFmt('hc-pago', totalPago, 'hc-pago');
    atualizarFmt('hc-pendente', totalPendente, 'hc-pendente');

    // Resumo
    const pagoMes = doMes.filter(c => c.status === 'pago').reduce((s, c) => s + Number(c.valorTotal || 0), 0);
    const pendenteMes = doMes.filter(c => c.status !== 'pago').reduce((s, c) => s + Number(c.valorTotal || 0), 0);
    const meses = new Set(comprasData.map(c => (c.data || '').slice(0, 7))).size || 1;
    const totalGeral = comprasData.reduce((s, c) => s + Number(c.valorTotal || 0), 0);

    setText('res-total-mes', fmt(totalMes));
    setText('res-qtd-mes', doMes.length + (doMes.length === 1 ? ' compra' : ' compras'));
    setText('res-total-pago', fmt(pagoMes));
    setText('res-qtd-pago', doMes.filter(c => c.status === 'pago').length + ' compras');
    setText('res-total-pendente', fmt(pendenteMes));
    setText('res-qtd-pendente', doMes.filter(c => c.status !== 'pago').length + ' compras');
    setText('res-media', fmt(totalGeral / meses));
    setText('res-meses', `${meses} ${meses === 1 ? 'mês registrado' : 'meses registrados'}`);
}

function atualizarCount(id, n) {
    const el = $(id); if (!el) return;
    el.textContent = n;
}
function atualizarFmt(id, valor, cardId, inteiro = false) {
    const el = $(id); if (!el) return;
    el.textContent = inteiro ? valor : fmt(valor);
    el.className = 'cmp-home-count' + (valor === 0 ? ' cmp-home-count-zero' : '');
    if (id === 'hc-pendente' && valor > 0) el.classList.add('cmp-count-alerta');
}
function setText(id, v) { const el = $(id); if (el) el.textContent = v; }

/* ── Render Lista ────────────────────────────────────────────── */
function renderLista() {
    const listaEl = $('cmp-lista');
    const emptyEl = $('cmp-empty');
    if (!listaEl) return;

    const q = ($('cmp-search')?.value || '').trim().toLowerCase();

    let lista = comprasData;

    // Filtro por seção
    if (secaoAtiva === 'pendentes') {
        lista = lista.filter(c => c.status === 'pendente' || c.status === 'parcial');
    } else if (secaoAtiva === 'pagas') {
        lista = lista.filter(c => c.status === 'pago');
    }

    // Busca
    if (q) {
        lista = lista.filter(c =>
            (c.fornecedorNome || '').toLowerCase().includes(q) ||
            (c.obs || '').toLowerCase().includes(q) ||
            (c.nf || '').toLowerCase().includes(q)
        );
    }

    if (!lista.length) {
        listaEl.innerHTML = '';
        emptyEl.style.display = 'flex';
        return;
    }
    emptyEl.style.display = 'none';

    listaEl.innerHTML = lista.map(c => {
        const itens = itensExpandidos[c.id];
        const expandido = !!itens;
        return `
        <div class="cmp-card" id="card-${c.id}">
            <div class="cmp-card-top">
                <div class="cmp-card-info">
                    <div class="cmp-card-forn">${escHtml(c.fornecedorNome || '—')}</div>
                    <div class="cmp-card-meta">
                        <span>📅 ${formatarData(c.data)}</span>
                        <span>${PAGAMENTO_LABEL[c.pagamento] || c.pagamento || ''}</span>
                        ${c.nf ? `<span>NF: ${escHtml(c.nf)}</span>` : ''}
                        ${c.obs ? `<span>· ${escHtml(c.obs)}</span>` : ''}
                    </div>
                </div>
                <div class="cmp-card-right">
                    <div class="cmp-card-valor">${fmt(c.valorTotal)}</div>
                    ${STATUS_BADGE[c.status] || ''}
                </div>
            </div>
            <div class="cmp-card-acoes">
                ${c.status !== 'pago' ? `<button class="cmp-btn-status" data-id="${c.id}" data-acao="pago">✓ Marcar Pago</button>` : ''}
                <button class="cmp-btn-expand" data-id="${c.id}">📦 ${expandido ? 'Ocultar Itens' : 'Ver Itens'}</button>
                <button class="cmp-card-edit-btn" data-id="${c.id}" title="Editar">✏️</button>
                <button class="cmp-card-del-btn" data-id="${c.id}" title="Excluir">🗑️</button>
            </div>
            <div class="cmp-card-detalhe ${expandido ? 'open' : ''}" id="detalhe-${c.id}">
                ${expandido ? renderItens(c.id, itens) : ''}
            </div>
        </div>`;
    }).join('');

    bindCardEvents(listaEl);
}

function renderItens(compraId, itens) {
    if (!itens || !itens.length) return '<div class="cmp-detalhe-empty">Nenhum item registrado.</div>';
    const total = itens.reduce((s, i) => s + Number(i.valorTotal || 0), 0);
    return `
        <div class="cmp-detalhe-titulo">📦 Itens</div>
        ${itens.map(i => `
            <div class="cmp-detalhe-item">
                <span class="cmp-detalhe-nome">${escHtml(i.produto)}</span>
                <span class="cmp-detalhe-qty">${i.quantidade}x ${fmt(i.valorUnitario)}</span>
                <span class="cmp-detalhe-val">${fmt(i.valorTotal)}</span>
            </div>`).join('')}
        <div class="cmp-detalhe-total">Total: ${fmt(total)}</div>`;
}

/* ── Bind eventos nos cards ──────────────────────────────────── */
function bindCardEvents(container) {
    container.querySelectorAll('.cmp-btn-status').forEach(btn => {
        btn.addEventListener('click', () => marcarStatus(btn.dataset.id, btn.dataset.acao));
    });
    container.querySelectorAll('.cmp-btn-expand').forEach(btn => {
        btn.addEventListener('click', () => toggleItens(btn.dataset.id));
    });
    container.querySelectorAll('.cmp-card-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => abrirFormEditar(btn.dataset.id));
    });
    container.querySelectorAll('.cmp-card-del-btn').forEach(btn => {
        btn.addEventListener('click', () => excluirCompra(btn.dataset.id));
    });
}

/* ── Expandir itens ──────────────────────────────────────────── */
async function toggleItens(id) {
    const detalheEl = $('detalhe-' + id);
    const btnEl = document.querySelector(`.cmp-btn-expand[data-id="${id}"]`);
    if (!detalheEl) return;

    if (itensExpandidos[id]) {
        delete itensExpandidos[id];
        detalheEl.classList.remove('open');
        detalheEl.innerHTML = '';
        if (btnEl) btnEl.textContent = '📦 Ver Itens';
        return;
    }

    try {
        const snap = await getDocs(collection(db, `${COL_COMPRAS}/${id}/itens`));
        const itens = [];
        snap.forEach(d => itens.push({ id: d.id, ...d.data() }));
        itensExpandidos[id] = itens;
        detalheEl.innerHTML = renderItens(id, itens);
        detalheEl.classList.add('open');
        if (btnEl) btnEl.textContent = '📦 Ocultar Itens';
    } catch { toast('⚠ Erro ao carregar itens.'); }
}

/* ── Marcar status ───────────────────────────────────────────── */
async function marcarStatus(id, novoStatus) {
    const c = comprasData.find(x => x.id === id);
    if (!c) return;
    try {
        await setDoc(doc(db, COL_COMPRAS, id), { ...c, status: novoStatus, atualizadoEm: serverTimestamp() });

        // Atualiza lançamento no financeiro se existir
        if (c.finPagarId) {
            const finStatus = novoStatus === 'pago' ? 'pago' : 'pendente';
            await setDoc(doc(db, COL_FIN_PAGAR, c.finPagarId), {
                status: finStatus, atualizadoEm: serverTimestamp()
            }, { merge: true });
        }

        c.status = novoStatus;
        atualizarContadores();
        renderLista();
        toast('✅ Status atualizado!');
    } catch { toast('⚠ Erro ao atualizar.'); }
}

/* ── Excluir compra ──────────────────────────────────────────── */
function excluirCompra(id) {
    const c = comprasData.find(x => x.id === id);
    if (!c) return;
    confirmar(`Mover compra de "${c.fornecedorNome}" para a Lixeira?`, async () => {
        try {
            // Salva itens como parte dos dados para o histórico
            const snap = await getDocs(collection(db, `${COL_COMPRAS}/${id}/itens`));
            const itens = snap.docs.map(d => d.data());

            // Move para lixeira com dados completos
            await moverParaLixeira(COL_COMPRAS, id, { ...c, _itens: itens });
            await logAudit({ modulo: 'compras', acao: 'exclusao', id, antes: c, descricao: `Compra ${c.fornecedorNome} — ${fmt(c.valorTotal)}` });

            // Remove subcoleção de itens
            for (const d of snap.docs) await deleteDoc(d.ref);

            // Remove lançamento financeiro associado
            if (c.finPagarId) {
                await deleteDoc(doc(db, COL_FIN_PAGAR, c.finPagarId)).catch(() => {});
            }

            comprasData = comprasData.filter(x => x.id !== id);
            delete itensExpandidos[id];
            atualizarContadores();
            renderLista();
            toast('🗑️ Compra movida para a Lixeira.');
        } catch { toast('⚠ Erro ao excluir.'); }
    });
}

/* ── Itens no formulário ─────────────────────────────────────── */
function renderItensForm() {
    const listaEl = $('cmp-items-form-lista');
    if (!listaEl) return;
    if (!itensForm.length) { listaEl.innerHTML = ''; atualizarTotalForm(); return; }
    listaEl.innerHTML = itensForm.map((item, idx) => `
        <div class="cmp-item-row">
            <span class="cmp-item-nome">${escHtml(item.produto)}</span>
            <span class="cmp-item-qty-lbl">${item.quantidade}x ${fmt(item.valorUnitario)}</span>
            <span class="cmp-item-valor">${fmt(item.valorTotal)}</span>
            <button class="cmp-item-del" data-idx="${idx}" title="Remover">✕</button>
        </div>`).join('');
    listaEl.querySelectorAll('.cmp-item-del').forEach(btn => {
        btn.addEventListener('click', () => {
            itensForm.splice(Number(btn.dataset.idx), 1);
            renderItensForm();
        });
    });
    atualizarTotalForm();
}

function atualizarTotalForm() {
    const total = itensForm.reduce((s, i) => s + Number(i.valorTotal || 0), 0);
    setText('cmp-items-total-form', fmt(total));
}

$('cmp-item-add-btn')?.addEventListener('click', adicionarItemForm);
$('cmp-item-prod')?.addEventListener('keypress', e => { if (e.key === 'Enter') adicionarItemForm(); });

function adicionarItemForm() {
    const prod = $('cmp-item-prod')?.value.trim();
    const qty  = Number($('cmp-item-qty')?.value) || 1;
    const unit = Number($('cmp-item-unit')?.value) || 0;
    if (!prod) { $('cmp-item-prod')?.focus(); return; }
    itensForm.push({
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        produto: prod,
        quantidade: qty,
        valorUnitario: unit,
        valorTotal: qty * unit
    });
    $('cmp-item-prod').value = '';
    $('cmp-item-qty').value = '1';
    $('cmp-item-unit').value = '';
    $('cmp-item-prod').focus();
    renderItensForm();
}

/* ── Abrir formulário ────────────────────────────────────────── */
function abrirFormNovo() {
    editandoId = null;
    itensForm = [];
    $('cmp-form-titulo').textContent = 'Nova Compra';
    $('cmp-fornecedor').value  = '';
    $('cmp-data').value        = hoje();
    $('cmp-pagamento').value   = 'pix';
    $('cmp-nf').value          = '';
    $('cmp-status').value      = 'pendente';
    $('cmp-obs').value         = '';
    $('cmp-valor-manual').value = '';
    renderItensForm();
    $('cmp-form').style.display = 'flex';
    setTimeout(() => $('cmp-fornecedor')?.focus(), 50);
}

async function abrirFormEditar(id) {
    const c = comprasData.find(x => x.id === id);
    if (!c) return;
    editandoId = id;

    // Carregar itens existentes
    try {
        const snap = await getDocs(collection(db, `${COL_COMPRAS}/${id}/itens`));
        itensForm = [];
        snap.forEach(d => itensForm.push({ id: d.id, ...d.data() }));
    } catch { itensForm = []; }

    $('cmp-form-titulo').textContent = 'Editar Compra';
    $('cmp-fornecedor').value   = c.fornecedorId || '';
    $('cmp-data').value         = c.data || hoje();
    $('cmp-pagamento').value    = c.pagamento || 'pix';
    $('cmp-nf').value           = c.nf || '';
    $('cmp-status').value       = c.status || 'pendente';
    $('cmp-obs').value          = c.obs || '';
    $('cmp-valor-manual').value = c.valorTotal || '';

    navegar('todas');
    renderItensForm();
    $('cmp-form').style.display = 'flex';
    setTimeout(() => $('cmp-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

function fecharForm() {
    $('cmp-form').style.display = 'none';
    editandoId = null;
    itensForm = [];
}

$('cmp-btn-salvar')?.addEventListener('click', salvarCompra);
$('cmp-btn-cancelar')?.addEventListener('click', fecharForm);

/* ── Salvar compra ───────────────────────────────────────────── */
async function salvarCompra() {
    const fornId  = $('cmp-fornecedor')?.value;
    const data    = $('cmp-data')?.value;
    if (!fornId) { toast('⚠ Selecione o fornecedor.'); $('cmp-fornecedor')?.focus(); return; }
    if (!data)   { toast('⚠ Informe a data da compra.'); $('cmp-data')?.focus(); return; }

    const forn = fornecedores.find(f => f.id === fornId);
    const totalItens = itensForm.reduce((s, i) => s + Number(i.valorTotal || 0), 0);
    const valorManual = Number($('cmp-valor-manual')?.value) || 0;
    const valorTotal = totalItens > 0 ? totalItens : valorManual;
    const status = $('cmp-status')?.value || 'pendente';
    const pagamento = $('cmp-pagamento')?.value || 'pix';

    const compraId = editandoId || `cmp_${Date.now()}`;
    const compraAntiga = comprasData.find(c => c.id === compraId);

    const compra = {
        fornecedorId:   fornId,
        fornecedorNome: forn?.nome || '',
        data,
        valorTotal,
        pagamento,
        nf:    $('cmp-nf')?.value.trim() || '',
        status,
        obs:   $('cmp-obs')?.value.trim() || '',
        atualizadoEm: serverTimestamp(),
        finPagarId: compraAntiga?.finPagarId || null,
    };
    if (!editandoId) compra.criadoEm = serverTimestamp();

    try {
        await setDoc(doc(db, COL_COMPRAS, compraId), compra);

        // Salvar itens na subcoleção
        if (itensForm.length) {
            // Se editando, excluir itens antigos primeiro
            if (editandoId) {
                const snapOld = await getDocs(collection(db, `${COL_COMPRAS}/${compraId}/itens`));
                for (const d of snapOld.docs) await deleteDoc(d.ref);
            }
            for (const item of itensForm) {
                await setDoc(doc(db, `${COL_COMPRAS}/${compraId}/itens`, item.id), {
                    produto:       item.produto,
                    quantidade:    item.quantidade,
                    valorUnitario: item.valorUnitario,
                    valorTotal:    item.valorTotal,
                });
            }
        }

        // Criar/atualizar lançamento no financeiro_pagar
        const finId = compraAntiga?.finPagarId || `pagar_cmp_${compraId}`;
        const finStatus = status === 'pago' ? 'pago' : 'pendente';
        await setDoc(doc(db, COL_FIN_PAGAR, finId), {
            descricao:    `Compra — ${forn?.nome || 'Fornecedor'}`,
            categoria:    'Compras de Mercadorias',
            vencimento:   data,
            valor:        valorTotal,
            status:       finStatus,
            obs:          `Compra #${compraId}`,
            atualizadoEm: serverTimestamp(),
        }, { merge: true });

        // Atualiza referência do finPagarId na compra
        if (!compra.finPagarId) {
            await setDoc(doc(db, COL_COMPRAS, compraId), { finPagarId: finId }, { merge: true });
        }

        // Atualiza estoque com custo médio automático
        if (itensForm.length) {
            await atualizarEstoqueComCompra(itensForm);
        }

        await logAudit({
            modulo:    'compras',
            acao:      editandoId ? 'edicao' : 'criacao',
            id:        docRef.id,
            descricao: `Compra ${$('cmp-fornecedor')?.value || ''} — ${$('cmp-valor-total')?.textContent || ''}`,
        });
        toast(editandoId ? '✏️ Compra atualizada!' : '✅ Compra registrada!');
        fecharForm();
        await recarregar();
    } catch (e) {
        console.error(e);
        toast('⚠ Erro ao salvar.');
    }
}

/* ── Atualiza Estoque com Custo Médio ────────────────────────── */
async function atualizarEstoqueComCompra(itens) {
    let snapEstoque;
    try { snapEstoque = await getDocs(collection(db, COL_ESTOQUE)); }
    catch { return; }

    const todosProdutos = [];
    snapEstoque.forEach(d => todosProdutos.push({ id: d.id, ...d.data() }));

    for (const item of itens) {
        if (!item.produto || !item.quantidade) continue;
        const nomeBusca = item.produto.trim().toUpperCase();
        const qtdCompra = Number(item.quantidade) || 0;
        const custoUnit = Number(item.valorUnitario) || 0;

        // Busca produto no estoque (exata → parcial)
        let prod = todosProdutos.find(p =>
            (p.nome || '').toUpperCase() === nomeBusca
        );
        if (!prod) {
            prod = todosProdutos.find(p =>
                (p.nome || '').toUpperCase().includes(nomeBusca.slice(0, 8)) ||
                nomeBusca.includes((p.nome || '').toUpperCase().slice(0, 8))
            );
        }

        try {
            if (prod) {
                // Produto encontrado → atualiza qty e custo médio
                await runTransaction(db, async tx => {
                    const ref  = doc(db, COL_ESTOQUE, prod.id);
                    const snap = await tx.get(ref);
                    if (!snap.exists()) return;
                    const data = snap.data();
                    const qtdAtual    = Number(data.quantidade   || 0);
                    const custoAtual  = Number(data.custo_medio  || data.custo || 0);
                    const qtdTotal    = qtdAtual + qtdCompra;
                    const custoMedio  = qtdTotal > 0
                        ? ((qtdAtual * custoAtual) + (qtdCompra * custoUnit)) / qtdTotal
                        : custoUnit;
                    tx.update(ref, {
                        quantidade:   qtdTotal,
                        custo_medio:  Math.round(custoMedio * 100) / 100,
                        custo:        Math.round(custoMedio * 100) / 100,
                        atualizadoEm: serverTimestamp(),
                    });
                });
            } else {
                // Produto não existe → cria com dados básicos
                const id = `prod_cmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                await setDoc(doc(db, COL_ESTOQUE, id), {
                    nome:             item.produto.trim(),
                    categoria:        'Outro',
                    quantidade:       qtdCompra,
                    quantidadeMinima: 1,
                    custo:            custoUnit,
                    custo_medio:      custoUnit,
                    venda:            0,
                    favorito:         false,
                    historico:        [],
                    localizacao:      '',
                    tags:             [],
                    criadoEm:         serverTimestamp(),
                    atualizadoEm:     serverTimestamp(),
                });
            }
        } catch (err) {
            console.error(`[ESTOQUE] Erro ao atualizar "${item.produto}":`, err);
        }
    }
}

/* ── Recarregar ──────────────────────────────────────────────── */
async function recarregar() {
    try {
        const snap = await getDocs(collection(db, COL_COMPRAS));
        comprasData = [];
        snap.forEach(d => comprasData.push({ id: d.id, ...d.data() }));
        comprasData.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    } catch {}
    atualizarContadores();
    renderLista();
}

/* ── Exportar ────────────────────────────────────────────────── */
window.exportarCompras = function() {
    const cols = ['fornecedorNome', 'valorTotal', 'data', 'status', 'formaPagamento', 'obs'];
    const hdrs = {
        fornecedorNome: 'Fornecedor', valorTotal: 'Valor Total (R$)',
        data: 'Data', status: 'Status', formaPagamento: 'Forma de Pagamento', obs: 'Obs',
    };
    mostrarMenuExportar(comprasData, cols, hdrs, 'compras');
};

/* ── API pública (chamada pela barra de ações rápidas) ──────── */
window.cmpNavegar = (sec) => navegar(sec);

/* ── Init ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => carregar());
