import { db, collection, getDocs, getDoc, doc, setDoc, deleteDoc, serverTimestamp, query, where } from '../../scripts/firebase.js';
import { getEmpresaId } from '../../shared/tenant.js';

const COL_PAGAR     = 'financeiro_pagar';
const COL_FIXAS     = 'financeiro_fixas';
const COL_RECEBER   = 'financeiro_receber';
const COL_DESPESAS  = 'financeiro_despesas';
const COL_COMPRAS   = 'compras_financeiras';
const COL_CAIXA     = 'caixa_lancamentos';
const COL_METAS     = 'financeiro_metas';
const COL_OS        = 'os';

const fmt = v => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const hoje = () => new Date().toISOString().slice(0, 10);
const $ = id => document.getElementById(id);

let dadosPagar     = [];
let dadosFixas     = [];
let dadosReceber   = [];
let dadosDespesas  = [];
let dadosCompras   = [];
let dadosCaixa     = [];
let dadosOS        = [];
let dadosMetas     = {};
let filtroStatusPagar   = 'todos';
let filtroStatusReceber = 'todos';
let filtroStatusFixas   = 'todas';
let editandoId = null;
let editandoColecao = null;
let secaoAtiva = 'home';
let periodoResumo = 'mes';
let periodoFluxo  = 'mes';
let perioDash     = 'mes';
let customDataIni = '';
let customDataFim = '';

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
    home:      { titulo: '💹 Financeiro',               novo: false },
    pagar:     { titulo: '💰 Contas a Pagar',            novo: true  },
    receber:   { titulo: '💵 Contas a Receber',          novo: true  },
    fixas:     { titulo: '📅 Despesas Fixas',            novo: true  },
    resumo:    { titulo: '📊 Resultado Financeiro',      novo: false },
    fluxo:     { titulo: '📈 Fluxo de Caixa Unificado',  novo: false },
    dashboard: { titulo: '🎯 Dashboard Executivo',       novo: false },
    metas:     { titulo: '🏆 Metas Financeiras',         novo: false },
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
    ['pagar','receber','fixas','resumo','fluxo','dashboard','metas'].forEach(s => {
        $('fin-sec-' + s).style.display = s === sec ? '' : 'none';
    });
    if (sec === 'resumo')    renderResultado();
    if (sec === 'fluxo')     renderFluxo();
    if (sec === 'dashboard') setTimeout(renderDashboard, 0);
    if (sec === 'metas')     renderMetas();

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
        const eid = getEmpresaId();
        const qEid = col => query(collection(db, col), where('empresa_id', '==', eid));
        const [sp, sf, sr, sd, sc, scx, sos] = await Promise.all([
            getDocs(qEid(COL_PAGAR)),
            getDocs(qEid(COL_FIXAS)),
            getDocs(qEid(COL_RECEBER)),
            getDocs(qEid(COL_DESPESAS)),
            getDocs(qEid(COL_COMPRAS)),
            getDocs(qEid(COL_CAIXA)),
            getDocs(qEid(COL_OS)),
        ]);
        dadosPagar    = []; sp.forEach(d  => dadosPagar.push({ id: d.id, ...d.data() }));
        dadosFixas    = []; sf.forEach(d  => dadosFixas.push({ id: d.id, ...d.data() }));
        dadosReceber  = []; sr.forEach(d  => dadosReceber.push({ id: d.id, ...d.data() }));
        dadosDespesas = []; sd.forEach(d  => dadosDespesas.push({ id: d.id, ...d.data() }));
        dadosCompras  = []; sc.forEach(d  => dadosCompras.push({ id: d.id, ...d.data() }));
        dadosCaixa    = []; scx.forEach(d => dadosCaixa.push({ id: d.id, ...d.data() }));
        dadosOS       = []; sos.forEach(d => dadosOS.push({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error('[Financeiro] Erro ao carregar dados:', e);
        toast('⚠ Falha ao carregar dados do servidor.');
        dadosPagar = []; dadosFixas = []; dadosReceber = [];
        dadosDespesas = []; dadosCompras = []; dadosCaixa = []; dadosOS = [];
    }
    // Carregar metas (documento único)
    try {
        const metaSnap = await getDoc(doc(db, COL_METAS, getEmpresaId()));
        dadosMetas = metaSnap.exists() ? metaSnap.data() : {};
    } catch (e) { console.error('[Financeiro] Erro ao carregar metas:', e); dadosMetas = {}; }
    dadosPagar   = dadosPagar.map(c => calcStatus(c, 'pago'));
    dadosReceber = dadosReceber.map(c => calcStatus(c, 'recebido'));

    $('pagar-loading').style.display   = 'none';
    $('fixas-loading').style.display   = 'none';
    $('receber-loading').style.display = 'none';

    renderPagar(dadosPagar);
    renderFixas(dadosFixas);
    renderReceber(dadosReceber);
    atualizarContadores();
    bindPeriodoResumo();
    bindPeriodoFluxo();
    bindDashPeriodo();
    bindMetasForm();
    atualizarHomeCardMetas();
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

    // (indicadores legados removidos — renderResultado() cuida do painel)
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
    Marketing: '📢', Fornecedores: '📦', Transporte: '🚗',
    Contador: '📋', Telefone: '📞', 'Pró-labore': '💼', Outro: '📌'
};
const RECORR_LABEL = { mensal: 'Mensal', quinzenal: 'Quinzenal', semanal: 'Semanal', anual: 'Anual' };
const PAG_ICON = {
    'Boleto': '🧾', 'Débito Automático': '🔄', 'PIX': '💚',
    'Cartão': '💳', 'Dinheiro': '💵', 'TED/DOC': '🏦'
};

// ── Próxima ocorrência por dia-do-mês (compat. registros antigos) ────────
function proximaOcorrenciaStr(dia) {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth();
    let d = new Date(ano, mes, dia, 12, 0, 0);
    if (d <= agora) d = new Date(ano, mes + 1, dia, 12, 0, 0);
    return d.toISOString().slice(0, 10);
}

// ── Próxima ocorrência real com avanço de ciclo ──────────────────────────
function computarProximaOcorrencia(dados) {
    const recorrencia = dados.recorrencia || 'mensal';
    const agora = new Date();

    let base;
    if (dados.data_inicio) {
        base = new Date(dados.data_inicio + 'T12:00:00');
    } else {
        const dia = Number(dados.dia) || 10;
        base = new Date(agora.getFullYear(), agora.getMonth(), dia, 12, 0, 0);
        if (base <= agora) base = new Date(agora.getFullYear(), agora.getMonth() + 1, dia, 12, 0, 0);
        return base.toISOString().slice(0, 10);
    }

    if (base > agora) return base.toISOString().slice(0, 10);

    const diaDoMes = base.getDate();
    let curr = new Date(base);
    let guard = 0;
    while (curr <= agora && guard++ < 500) {
        switch (recorrencia) {
            case 'mensal':    curr = new Date(curr.getFullYear(), curr.getMonth() + 1, diaDoMes, 12, 0, 0); break;
            case 'quinzenal': curr = new Date(curr.getTime() + 15 * 86400000); break;
            case 'semanal':   curr = new Date(curr.getTime() +  7 * 86400000); break;
            case 'anual':     curr = new Date(curr.getFullYear() + 1, curr.getMonth(), diaDoMes, 12, 0, 0); break;
            default:          return curr.toISOString().slice(0, 10);
        }
    }
    return curr.toISOString().slice(0, 10);
}

// ── Calcular lista de ocorrências futuras para gerar lançamentos ─────────
function calcularOcorrencias(dados, maxOcorr) {
    const recorrencia = dados.recorrencia || 'mensal';
    const agora = new Date();
    let base;

    if (dados.data_inicio) {
        base = new Date(dados.data_inicio + 'T12:00:00');
    } else {
        const dia = Number(dados.dia) || 10;
        base = new Date(agora.getFullYear(), agora.getMonth(), dia, 12, 0, 0);
        if (base <= agora) base = new Date(agora.getFullYear(), agora.getMonth() + 1, dia, 12, 0, 0);
    }

    // Avança até >= hoje caso data_inicio seja antiga
    const diaDoMes = base.getDate();
    let guard = 0;
    while (base < agora && guard++ < 500) {
        switch (recorrencia) {
            case 'mensal':    base = new Date(base.getFullYear(), base.getMonth() + 1, diaDoMes, 12, 0, 0); break;
            case 'quinzenal': base = new Date(base.getTime() + 15 * 86400000); break;
            case 'semanal':   base = new Date(base.getTime() +  7 * 86400000); break;
            case 'anual':     base = new Date(base.getFullYear() + 1, base.getMonth(), diaDoMes, 12, 0, 0); break;
            default: guard = 9999;
        }
    }

    const datas = [];
    for (let i = 0; i < maxOcorr; i++) {
        datas.push(base.toISOString().slice(0, 10));
        switch (recorrencia) {
            case 'mensal':    base = new Date(base.getFullYear(), base.getMonth() + 1, diaDoMes, 12, 0, 0); break;
            case 'quinzenal': base = new Date(base.getTime() + 15 * 86400000); break;
            case 'semanal':   base = new Date(base.getTime() +  7 * 86400000); break;
            case 'anual':     base = new Date(base.getFullYear() + 1, base.getMonth(), diaDoMes, 12, 0, 0); break;
        }
    }
    return datas;
}

// ── Gerar lançamentos automáticos em Contas a Pagar ──────────────────────
async function gerarLancamentos(fixaId, dados) {
    if ((dados.status || 'ativa') !== 'ativa') return;

    // Remove apenas os pendentes gerados automaticamente por esta fixa
    const antigos = dadosPagar.filter(p => p.fixaId === fixaId && p.status !== 'pago');
    for (const p of antigos) {
        try { await deleteDoc(doc(db, COL_PAGAR, p.id)); } catch {}
    }

    const recorrencia = dados.recorrencia || 'mensal';
    const maxOcorr = recorrencia === 'anual' ? 3 : recorrencia === 'semanal' ? 12 : 12;
    const datas = calcularOcorrencias(dados, maxOcorr);

    for (const vencimento of datas) {
        const jaExistePago = dadosPagar.some(
            p => p.fixaId === fixaId && p.vencimento === vencimento && p.status === 'pago'
        );
        if (jaExistePago) continue;

        const lancId = `pag_fix_${fixaId}_${vencimento.replace(/-/g, '')}`;
        await setDoc(doc(db, COL_PAGAR, lancId), {
            descricao:    dados.descricao,
            categoria:    dados.categoria,
            vencimento,
            valor:        dados.valor,
            status:       'pendente',
            obs:          dados.obs || '',
            fixaId,
            origem:       'despesa_fixa',
            empresa_id:   getEmpresaId(),
            atualizadoEm: serverTimestamp()
        });
    }
}

// ── Dashboard Despesas Fixas ──────────────────────────────────────────────
function renderDashboardFixas() {
    const ativas = dadosFixas.filter(f => (f.status || 'ativa') === 'ativa');
    const totalMensal = ativas.reduce((s, f) => {
        const v = Number(f.valor || 0);
        const r = f.recorrencia || 'mensal';
        if (r === 'semanal')   return s + v * 4.33;
        if (r === 'quinzenal') return s + v * 2;
        if (r === 'anual')     return s + v / 12;
        return s + v;
    }, 0);

    const agora = new Date();
    let proximas = 0, vencidasCount = 0;
    ativas.forEach(f => {
        const prox = computarProximaOcorrencia(f);
        const d = new Date(prox + 'T12:00:00');
        const diff = Math.ceil((d - agora) / 86400000);
        if (diff < 0)       vencidasCount++;
        else if (diff <= 7) proximas++;
    });

    const el = id => document.getElementById(id);
    if (el('fdash-total'))    el('fdash-total').textContent    = ativas.length;
    if (el('fdash-mensal'))   el('fdash-mensal').textContent   = fmt(totalMensal);
    if (el('fdash-proximas')) el('fdash-proximas').textContent = proximas;
    if (el('fdash-vencidas')) el('fdash-vencidas').textContent = vencidasCount;
}

// ── Alertas Despesas Fixas ────────────────────────────────────────────────
function renderAlertasFixas() {
    const alertasEl = $('fixas-alertas');
    if (!alertasEl) return;

    const agora = new Date();
    const vencendo = [], vencidas = [];

    dadosFixas
        .filter(f => (f.status || 'ativa') === 'ativa')
        .forEach(f => {
            const prox = computarProximaOcorrencia(f);
            const d = new Date(prox + 'T12:00:00');
            const diff = Math.ceil((d - agora) / 86400000);
            if (diff < 0)       vencidas.push({ ...f, diff, prox });
            else if (diff <= 7) vencendo.push({ ...f, diff, prox });
        });

    const items = [
        ...vencidas.map(f => ({
            cls: 'fin-fixas-alerta-vencida',
            icon: '🔴',
            nome: f.descricao,
            val:  fmt(f.valor),
            msg:  `Venceu há ${Math.abs(f.diff)} dia${Math.abs(f.diff) !== 1 ? 's' : ''}`
        })),
        ...vencendo.map(f => ({
            cls: 'fin-fixas-alerta-vencendo',
            icon: '⚠️',
            nome: f.descricao,
            val:  fmt(f.valor),
            msg:  f.diff === 0 ? 'Vence hoje' : `Vence em ${f.diff} dia${f.diff !== 1 ? 's' : ''}`
        }))
    ];

    if (!items.length) { alertasEl.innerHTML = ''; return; }

    alertasEl.innerHTML = `
        <div class="fin-fixas-alertas-wrap">
            <div class="fin-fixas-alertas-titulo">⚡ Alertas</div>
            ${items.map(i => `
            <div class="fin-fixas-alerta-item ${i.cls}">
                <span>${i.icon}</span>
                <span class="fin-fixas-alerta-nome">${escHtml(i.nome)}</span>
                <span class="fin-fixas-alerta-msg">${i.msg}</span>
                <span class="fin-fixas-alerta-val">${i.val}</span>
            </div>`).join('')}
        </div>`;
}

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
    renderDashboardFixas();
    renderAlertasFixas();

    const listaEl = $('fixas-lista');
    const emptyEl = $('fixas-empty');

    let f = filtroStatusFixas !== 'todas'
        ? lista.filter(c => (c.status || 'ativa') === filtroStatusFixas)
        : lista;

    f = f.sort((a, b) => {
        const dA = computarProximaOcorrencia(a);
        const dB = computarProximaOcorrencia(b);
        return dA.localeCompare(dB);
    });

    if (!f.length) { listaEl.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
    emptyEl.style.display = 'none';

    listaEl.innerHTML = f.map(c => {
        const status  = c.status || 'ativa';
        const recorr  = c.recorrencia || 'mensal';
        const proxVenc = computarProximaOcorrencia(c);
        const inativo  = status === 'inativa' ? ' fin-card-pago' : '';
        const pagIcon  = PAG_ICON[c.forma_pagamento] || '';

        return `
        <div class="fin-card${inativo}">
            <div class="fin-card-left">
                <span class="fin-cat-icon">${CAT_ICON[c.categoria] || '📌'}</span>
                <div class="fin-card-info">
                    <div class="fin-card-desc">${escHtml(c.descricao)}</div>
                    <div class="fin-card-sub">
                        📅 Próx: ${formatarData(proxVenc)} &nbsp;·&nbsp; ${RECORR_LABEL[recorr] || recorr}
                        ${c.forma_pagamento ? ` &nbsp;·&nbsp; ${pagIcon} ${escHtml(c.forma_pagamento)}` : ''}
                        ${c.obs ? ` &nbsp;·&nbsp; ${escHtml(c.obs)}` : ''}
                    </div>
                </div>
            </div>
            <div class="fin-card-right">
                <div class="fin-card-valor">${fmt(c.valor)}/mês</div>
                <span class="fin-badge ${status === 'ativa' ? 'badge-ativa' : 'badge-inativa'}">${status === 'ativa' ? 'Ativa' : 'Inativa'}</span>
                <div class="fin-card-acoes">
                    <button class="fin-card-edit-btn" data-id="${c.id}" data-col="fixa" title="Editar">✏️</button>
                    <button class="fin-card-del-btn" data-id="${c.id}" data-col="fixa" title="Excluir">🗑️</button>
                </div>
            </div>
        </div>`;
    }).join('');
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
    } catch (e) { console.error('[Financeiro] Erro ao atualizar status:', e); toast('⚠ Erro ao atualizar.'); }
}

// ── Excluir ────────────────────────────────────────────────────────────
async function excluir(id, col) {
    if (col === 'fixa') {
        const temLanc = dadosPagar.some(p => p.fixaId === id);
        let msg = 'Excluir esta despesa fixa?';
        if (temLanc) msg += '\n\nOs lançamentos pendentes em Contas a Pagar gerados por ela também serão removidos.';
        if (!confirm(msg)) return;
        try {
            if (temLanc) {
                const pendentes = dadosPagar.filter(p => p.fixaId === id && p.status !== 'pago');
                for (const p of pendentes) {
                    await deleteDoc(doc(db, COL_PAGAR, p.id));
                }
            }
            await deleteDoc(doc(db, COL_FIXAS, id));
            dadosFixas = dadosFixas.filter(c => c.id !== id);
            renderFixas(dadosFixas);
            atualizarContadores();
            toast('🗑️ Despesa fixa removida.');
            await recarregar('pagar');
        } catch (e) { console.error('[Financeiro] Erro ao excluir despesa fixa:', e); toast('⚠ Erro ao excluir.'); }
        return;
    }

    if (!confirm('Excluir este lançamento?')) return;
    const colecao = col === 'pagar' ? COL_PAGAR : COL_RECEBER;
    try {
        await deleteDoc(doc(db, colecao, id));
        if (col === 'pagar')   dadosPagar   = dadosPagar.filter(c => c.id !== id);
        if (col === 'receber') dadosReceber = dadosReceber.filter(c => c.id !== id);
        renderPagar(dadosPagar); renderReceber(dadosReceber);
        atualizarContadores();
        toast('🗑️ Removido.');
    } catch (e) { console.error('[Financeiro] Erro ao excluir:', e); toast('⚠ Erro ao excluir.'); }
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
        $('ff-desc').value        = item.descricao || '';
        $('ff-cat').value         = item.categoria || 'Outro';
        $('ff-recorrencia').value = item.recorrencia || 'mensal';
        $('ff-data-inicio').value = item.data_inicio || '';
        $('ff-valor').value       = item.valor || '';
        $('ff-pagamento').value   = item.forma_pagamento || 'PIX';
        $('ff-status').value      = item.status || 'ativa';
        $('ff-obs').value         = item.obs || '';
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
    $('ff-desc').value        = '';
    $('ff-cat').value         = 'Outro';
    $('ff-recorrencia').value = 'mensal';
    $('ff-data-inicio').value = '';
    $('ff-valor').value       = '';
    $('ff-pagamento').value   = 'PIX';
    $('ff-status').value      = 'ativa';
    $('ff-obs').value         = '';
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
        empresa_id:   getEmpresaId(),
        atualizadoEm: serverTimestamp()
    };
    const id = editandoId || `pag_${Date.now()}`;
    try {
        await setDoc(doc(db, COL_PAGAR, id), dados);
        toast(editandoId ? '✏️ Atualizado!' : '✅ Conta adicionada!');
        fecharForm('form-pagar');
        await recarregar('pagar');
    } catch (e) { console.error('[Financeiro] Erro ao salvar conta a pagar:', e); toast('⚠ Erro ao salvar.'); }
}

// ── Salvar Despesas Fixas ──────────────────────────────────────────────
async function salvarFixa() {
    const desc = $('ff-desc').value.trim();
    if (!desc) { $('ff-desc').focus(); return; }
    const dados = {
        descricao:       desc,
        categoria:       $('ff-cat').value,
        recorrencia:     $('ff-recorrencia').value,
        data_inicio:     $('ff-data-inicio').value,
        valor:           Number($('ff-valor').value) || 0,
        forma_pagamento: $('ff-pagamento').value,
        status:          $('ff-status').value,
        obs:             $('ff-obs').value.trim(),
        empresa_id:      getEmpresaId(),
        atualizadoEm:    serverTimestamp()
    };
    const id = editandoId || `fix_${Date.now()}`;
    try {
        await setDoc(doc(db, COL_FIXAS, id), dados);
        await gerarLancamentos(id, dados);
        toast(editandoId ? '✏️ Atualizado! Lançamentos regenerados.' : '✅ Despesa fixa adicionada! Lançamentos criados.');
        fecharForm('form-fixa');
        await recarregar('fixa');
        await recarregar('pagar');
    } catch (e) {
        console.error(e);
        toast('⚠ Erro ao salvar.');
    }
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
        empresa_id:   getEmpresaId(),
        atualizadoEm: serverTimestamp()
    };
    const id = editandoId || `rec_${Date.now()}`;
    try {
        await setDoc(doc(db, COL_RECEBER, id), dados);
        toast(editandoId ? '✏️ Atualizado!' : '✅ Conta adicionada!');
        fecharForm('form-receber');
        await recarregar('receber');
    } catch (e) { console.error('[Financeiro] Erro ao salvar conta a receber:', e); toast('⚠ Erro ao salvar.'); }
}

// ── Recarregar parcial ─────────────────────────────────────────────────
async function recarregar(col) {
    try {
        const eid = getEmpresaId();
        const qEid = c => query(collection(db, c), where('empresa_id', '==', eid));
        if (col === 'pagar') {
            const sp = await getDocs(qEid(COL_PAGAR));
            dadosPagar = []; sp.forEach(d => dadosPagar.push({ id: d.id, ...d.data() }));
            dadosPagar = dadosPagar.map(c => calcStatus(c, 'pago'));
            renderPagar(dadosPagar);
        } else if (col === 'fixa') {
            const sf = await getDocs(qEid(COL_FIXAS));
            dadosFixas = []; sf.forEach(d => dadosFixas.push({ id: d.id, ...d.data() }));
            renderFixas(dadosFixas);
        } else if (col === 'receber') {
            const sr = await getDocs(qEid(COL_RECEBER));
            dadosReceber = []; sr.forEach(d => dadosReceber.push({ id: d.id, ...d.data() }));
            dadosReceber = dadosReceber.map(c => calcStatus(c, 'recebido'));
            renderReceber(dadosReceber);
        }
        atualizarContadores();
    } catch (e) { console.error('[Financeiro] Erro ao recarregar:', e); }
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
document.querySelectorAll('[data-fixas-s]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-fixas-s]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filtroStatusFixas = btn.dataset.fixasS;
        renderFixas(dadosFixas);
    });
});

// ──────────────────────────────────────────────────────────────────────
// 📊 RESULTADO FINANCEIRO INTELIGENTE
// ──────────────────────────────────────────────────────────────────────
function bindPeriodoResumo() {
    document.querySelectorAll('.fin-pfiltro').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.fin-pfiltro').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            periodoResumo = btn.dataset.p;
            $('fin-custom-range').style.display = periodoResumo === 'custom' ? 'flex' : 'none';
            if (periodoResumo !== 'custom') renderResultado();
        });
    });
    $('fin-btn-aplicar-periodo')?.addEventListener('click', () => {
        customDataIni = $('fin-data-ini')?.value || '';
        customDataFim = $('fin-data-fim')?.value || '';
        if (customDataIni && customDataFim) renderResultado();
    });
}

function filtrarPorPeriodo(lista, campoData) {
    const agora = new Date();
    const pad = n => String(n).padStart(2, '0');
    const anoAtual  = agora.getFullYear();
    const mesAtual  = pad(agora.getMonth() + 1);
    const diaAtual  = pad(agora.getDate());
    const hojeStr   = `${anoAtual}-${mesAtual}-${diaAtual}`;
    const mesStr    = `${anoAtual}-${mesAtual}`;
    const anoStr    = String(anoAtual);

    // Início da semana (segunda)
    const dow  = agora.getDay() || 7;
    const seg  = new Date(agora); seg.setDate(agora.getDate() - dow + 1);
    const segStr = seg.toISOString().slice(0, 10);

    return lista.filter(item => {
        const d = item[campoData] || item.data || item.vencimento || item.dia || '';
        // caixa_lancamentos usa .dia = "YYYY-MM-DD"
        const dStr = typeof d === 'string' ? d.slice(0, 10) : '';
        switch (periodoResumo) {
            case 'hoje':   return dStr === hojeStr;
            case 'semana': return dStr >= segStr && dStr <= hojeStr;
            case 'mes':    return dStr.startsWith(mesStr);
            case 'ano':    return dStr.startsWith(anoStr);
            case 'custom': return dStr >= customDataIni && dStr <= customDataFim;
            default:       return true;
        }
    });
}

function renderResultado() {
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };

    // Receitas recebidas no período
    const recebidas = filtrarPorPeriodo(dadosReceber, 'vencimento')
        .filter(c => c.status === 'recebido');
    const totalReceita = recebidas.reduce((s, c) => s + Number(c.valor || 0), 0);

    // Despesas (módulo Despesas) no período
    const despPeriodo = filtrarPorPeriodo(dadosDespesas, 'data');
    const totalDespesas = despPeriodo.reduce((s, d) => s + Number(d.valor || 0), 0);

    // Compras pagas no período
    const comprasP = filtrarPorPeriodo(dadosCompras, 'data').filter(c => c.status === 'pago');
    const totalCompras = comprasP.reduce((s, c) => s + Number(c.valorTotal || 0), 0);

    // A Pagar pendente (geral, sem filtro — posição atual)
    const pendPagar  = dadosPagar.filter(c => c.status !== 'pago');
    const totalPagar = pendPagar.reduce((s, c) => s + Number(c.valor || 0), 0);

    // A Receber pendente (geral)
    const pendReceber  = dadosReceber.filter(c => c.status !== 'recebido');
    const totalReceber = pendReceber.reduce((s, c) => s + Number(c.valor || 0), 0);

    // Despesas Fixas (total mensal)
    const totalFixas = dadosFixas.reduce((s, c) => s + Number(c.valor || 0), 0);

    // CPV — custo dos produtos vendidos via Caixa no período
    const caixaPeriodo = filtrarPorPeriodo(dadosCaixa, 'dataISO');
    const vendasCaixa  = caixaPeriodo.filter(l => l.tipo === 'entrada' || l.tipo === 'servico');
    const receitaCaixa = vendasCaixa.reduce((s, l) => s + Number(l.valor || 0), 0);
    const cpvTotal     = vendasCaixa.reduce((s, l) => s + Number(l.custo || 0), 0);
    const lucroBruto   = receitaCaixa - cpvTotal;
    const margemBruta  = receitaCaixa > 0 ? (lucroBruto / receitaCaixa) * 100 : 0;

    // Lucro Líquido = Receita Financeiro − Despesas − Compras
    const lucro = totalReceita - totalDespesas - totalCompras;

    // Saldo Atual = A Receber − A Pagar
    const saldo = totalReceber - totalPagar;

    set('ri-receita',       fmt(totalReceita));
    set('ri-receita-sub',   `${recebidas.length} conta${recebidas.length !== 1 ? 's' : ''} recebida${recebidas.length !== 1 ? 's' : ''}`);
    set('ri-despesas',      fmt(totalDespesas));
    set('ri-despesas-sub',  `${despPeriodo.length} registro${despPeriodo.length !== 1 ? 's' : ''}`);
    set('ri-compras',       fmt(totalCompras));
    set('ri-compras-sub',   `${comprasP.length} compra${comprasP.length !== 1 ? 's' : ''} paga${comprasP.length !== 1 ? 's' : ''}`);
    set('ri-pagar',         fmt(totalPagar));
    set('ri-pagar-sub',     `${pendPagar.length} conta${pendPagar.length !== 1 ? 's' : ''}`);
    set('ri-receber',       fmt(totalReceber));
    set('ri-receber-sub',   `${pendReceber.length} conta${pendReceber.length !== 1 ? 's' : ''}`);
    set('ri-fixas',         fmt(totalFixas));
    set('ri-fixas-sub',     `${dadosFixas.length} item${dadosFixas.length !== 1 ? 's' : ''}`);
    set('ri-lucro',         fmt(lucro));
    set('ri-saldo',         fmt(saldo));

    // Cards CPV / Lucro Bruto / Margem
    set('ri-cpv',           fmt(cpvTotal));
    set('ri-cpv-sub',       `${vendasCaixa.length} venda${vendasCaixa.length !== 1 ? 's' : ''} no caixa`);
    set('ri-lucro-bruto',   fmt(lucroBruto));
    set('ri-lucro-bruto-sub', `Receita Caixa: ${fmt(receitaCaixa)}`);
    set('ri-margem',        `${margemBruta.toFixed(1)}%`);
    set('ri-margem-sub',    'Margem bruta (Caixa)');

    // Cor card Lucro Bruto
    const lbCard = $('fin-res-lucro-bruto-card');
    if (lbCard) lbCard.className = 'fin-res-card ' + (lucroBruto >= 0 ? 'fin-res-lucro' : 'fin-res-prejuizo');

    // Cor do card Lucro
    const lucroCard = $('fin-res-lucro-card');
    if (lucroCard) lucroCard.className = 'fin-res-card ' + (lucro >= 0 ? 'fin-res-lucro' : 'fin-res-prejuizo');
    const saldoCard = $('fin-res-saldo-card');
    if (saldoCard) saldoCard.className = 'fin-res-card ' + (saldo >= 0 ? 'fin-res-saldo' : 'fin-res-prejuizo');

    // Alerta vencidas
    const vencPagar   = dadosPagar.filter(c => c.status === 'vencido').length;
    const vencReceber = dadosReceber.filter(c => c.status === 'vencido').length;
    const alertaEl = $('fin-res-alerta');
    if (alertaEl && (vencPagar + vencReceber) > 0) {
        $('fin-res-alerta-txt').textContent =
            `${vencPagar} conta${vencPagar !== 1 ? 's' : ''} a pagar e ${vencReceber} conta${vencReceber !== 1 ? 's' : ''} a receber estão vencidas.`;
        alertaEl.style.display = 'flex';
    } else if (alertaEl) {
        alertaEl.style.display = 'none';
    }
}

// ──────────────────────────────────────────────────────────────────────
// 📈 FLUXO DE CAIXA UNIFICADO
// ──────────────────────────────────────────────────────────────────────
function bindPeriodoFluxo() {
    document.querySelectorAll('.fin-pfiltro-fluxo').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.fin-pfiltro-fluxo').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            periodoFluxo = btn.dataset.p;
            renderFluxo();
        });
    });
}

function filtrarFluxo(lista, campoData) {
    const agora = new Date();
    const pad = n => String(n).padStart(2, '0');
    const anoAtual = agora.getFullYear();
    const mesAtual = pad(agora.getMonth() + 1);
    const diaAtual = pad(agora.getDate());
    const hojeStr  = `${anoAtual}-${mesAtual}-${diaAtual}`;
    const mesStr   = `${anoAtual}-${mesAtual}`;
    const anoStr   = String(anoAtual);
    const dow = agora.getDay() || 7;
    const seg = new Date(agora); seg.setDate(agora.getDate() - dow + 1);
    const segStr = seg.toISOString().slice(0, 10);

    return lista.filter(item => {
        const raw = item[campoData] || item.data || item.vencimento || item.dia || item.dataISO || '';
        const dStr = typeof raw === 'string' ? raw.slice(0, 10) : '';
        switch (periodoFluxo) {
            case 'hoje':   return dStr === hojeStr;
            case 'semana': return dStr >= segStr && dStr <= hojeStr;
            case 'mes':    return dStr.startsWith(mesStr);
            case 'ano':    return dStr.startsWith(anoStr);
            default:       return true;
        }
    });
}

function renderFluxo() {
    const loadEl = $('fluxo-loading');
    const contEl = $('fin-fluxo-content');
    if (loadEl) loadEl.style.display = 'none';
    if (contEl) contEl.style.display = '';

    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };

    // ── Entradas ──────────────────────────────────────────────────────
    // Caixa: tipo = entrada | servico
    const caixaEntradas = filtrarFluxo(dadosCaixa, 'dia')
        .filter(l => l.tipo === 'entrada' || l.tipo === 'servico');
    const valCaixaEnt = caixaEntradas.reduce((s, l) => s + Number(l.valor || 0), 0);

    // Contas recebidas — usa recebidoEm (data real do pagamento) e exclui as oriundas do Caixa
    const recebidas = filtrarFluxo(dadosReceber, 'recebidoEm')
        .filter(c => c.status === 'recebido' && !c.origemCaixa);
    const valRecebidas = recebidas.reduce((s, c) => s + Number(c.valor || 0), 0);

    const totalEntradas = valCaixaEnt + valRecebidas;

    // ── Saídas ────────────────────────────────────────────────────────
    // Caixa: tipo = saida
    const caixaSaidas = filtrarFluxo(dadosCaixa, 'dia').filter(l => l.tipo === 'saida');
    const valCaixaSai = caixaSaidas.reduce((s, l) => s + Number(l.valor || 0), 0);

    // Despesas do módulo Despesas (exclui as importadas do Caixa — já contadas em caixaSaidas)
    const despPeriodo = filtrarFluxo(dadosDespesas, 'data').filter(d => !d.origemCaixa);
    const valDespesas = despPeriodo.reduce((s, d) => s + Number(d.valor || 0), 0);

    // Compras pagas
    const comprasP = filtrarFluxo(dadosCompras, 'data').filter(c => c.status === 'pago');
    const valCompras = comprasP.reduce((s, c) => s + Number(c.valorTotal || 0), 0);

    // Contas pagas — usa pagoEm (data real do pagamento) e exclui as geradas por compras
    const contasPagas = filtrarFluxo(dadosPagar, 'pagoEm')
        .filter(c => c.status === 'pago' && c.origem !== 'compra' && !c.id?.startsWith('pagar_cmp_'));
    const valContasPagas = contasPagas.reduce((s, c) => s + Number(c.valor || 0), 0);

    const totalSaidas = valCaixaSai + valDespesas + valCompras + valContasPagas;
    const saldo = totalEntradas - totalSaidas;

    set('fluxo-entradas', fmt(totalEntradas));
    set('fluxo-entradas-sub', `Caixa: ${fmt(valCaixaEnt)} · Recebidas: ${fmt(valRecebidas)}`);
    set('fluxo-saidas', fmt(totalSaidas));
    set('fluxo-saidas-sub', `Despesas: ${fmt(valDespesas)} · Compras: ${fmt(valCompras)} · Contas: ${fmt(valContasPagas)} · Caixa: ${fmt(valCaixaSai)}`);
    set('fluxo-saldo', fmt(saldo));

    const saldoCard = $('fin-fluxo-saldo-card');
    if (saldoCard) saldoCard.className = 'fin-fluxo-card ' + (saldo >= 0 ? 'fin-fluxo-saldo-pos' : 'fin-fluxo-saldo-neg');

    // Fontes
    const fontesEl = $('fin-fluxo-fontes');
    if (fontesEl) {
        const fontes = [
            { nome: '💰 Caixa Operacional (entradas)', valor: valCaixaEnt, tipo: 'entrada' },
            { nome: '📥 Contas a Receber (recebidas)',  valor: valRecebidas, tipo: 'entrada' },
            { nome: '🔴 Caixa Operacional (saídas)',    valor: valCaixaSai,  tipo: 'saida' },
            { nome: '💸 Despesas',                      valor: valDespesas,  tipo: 'saida' },
            { nome: '📦 Compras (pagas)',                valor: valCompras,   tipo: 'saida' },
            { nome: '💰 Contas a Pagar (pagas)',         valor: valContasPagas, tipo: 'saida' },
        ].filter(f => f.valor > 0);

        const maxVal = Math.max(...fontes.map(f => f.valor), 1);
        fontesEl.innerHTML = fontes.map(f => {
            const pct = Math.round((f.valor / maxVal) * 100);
            const cor = f.tipo === 'entrada' ? '#00c853' : '#f44336';
            return `<div class="fin-barra-item">
                <div class="fin-barra-nome">${f.nome}</div>
                <div class="fin-barra-track"><div class="fin-barra-fill" style="width:${pct}%;background:${cor}"></div></div>
                <div class="fin-barra-val">${fmt(f.valor)}</div>
            </div>`;
        }).join('') || '<div style="color:var(--text-muted);font-size:13px;padding:10px">Nenhuma movimentação neste período.</div>';
    }

    // Timeline movimentações
    const movEl = $('fin-fluxo-lista');
    if (movEl) {
        // Construir lista unificada
        const movs = [];
        caixaEntradas.forEach(l => movs.push({ data: (l.dia || l.dataISO || '').slice(0,10), desc: l.descricao || '—', valor: l.valor, tipo: 'entrada', fonte: 'Caixa' }));
        recebidas.forEach(c => movs.push({ data: c.recebidoEm || c.vencimento || '', desc: c.descricao || c.cliente || '—', valor: c.valor, tipo: 'entrada', fonte: 'Contas a Receber' }));
        caixaSaidas.forEach(l => movs.push({ data: (l.dia || l.dataISO || '').slice(0,10), desc: l.descricao || '—', valor: l.valor, tipo: 'saida', fonte: 'Caixa' }));
        despPeriodo.forEach(d => movs.push({ data: d.data || '', desc: d.descricao || '—', valor: d.valor, tipo: 'saida', fonte: 'Despesas' }));
        comprasP.forEach(c => movs.push({ data: c.data || '', desc: c.fornecedorNome || '—', valor: c.valorTotal, tipo: 'saida', fonte: 'Compras' }));
        contasPagas.forEach(c => movs.push({ data: c.pagoEm || c.vencimento || '', desc: c.descricao || '—', valor: c.valor, tipo: 'saida', fonte: 'Contas a Pagar' }));
        movs.sort((a, b) => b.data.localeCompare(a.data));

        set('fluxo-mov-count', `(${movs.length})`);

        if (!movs.length) {
            movEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:10px">Nenhuma movimentação no período.</div>';
        } else {
            movEl.innerHTML = movs.slice(0, 80).map(m => {
                const cor = m.tipo === 'entrada' ? '#00c853' : '#f44336';
                const sinal = m.tipo === 'entrada' ? '+' : '−';
                const dFormatada = m.data ? m.data.split('-').reverse().join('/') : '';
                return `<div class="fin-fluxo-mov-item">
                    <span class="fin-fluxo-mov-data">${dFormatada}</span>
                    <span class="fin-fluxo-mov-desc">${escHtml(m.desc)}</span>
                    <span class="fin-fluxo-mov-fonte">${m.fonte}</span>
                    <span class="fin-fluxo-mov-val" style="color:${cor}">${sinal} ${fmt(m.valor)}</span>
                </div>`;
            }).join('');
        }
    }
}

// ══════════════════════════════════════════════════════════════════════
// 🏆 METAS FINANCEIRAS
// ══════════════════════════════════════════════════════════════════════

const OS_TERMINAIS = ['entregue', 'orcamento_recusado', 'devolvido_orcamento'];

function calcStatusMeta(realizado, meta) {
    if (!meta || meta <= 0) return null;
    if (realizado < 0) return { pct: 0, pctReal: 0, cor: 'red', txt: '📉 Prejuízo' };
    const pct = (realizado / meta) * 100;
    if (pct >= 100) return { pct: 100, pctReal: pct, cor: 'green', txt: '✅ Meta Atingida' };
    if (pct >= 75)  return { pct,       pctReal: pct, cor: 'yellow', txt: '⚡ Próximo da Meta' };
    return                 { pct,       pctReal: pct, cor: 'red',   txt: '📉 Abaixo da Meta' };
}

function projetarMes(realizado) {
    const agora = new Date();
    const dia   = Math.max(agora.getDate(), 1);
    const total = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    return (realizado / dia) * total;
}

function renderMetas() {
    const agora  = new Date();
    const ano    = agora.getFullYear();
    const mes    = String(agora.getMonth() + 1).padStart(2, '0');
    const ini    = `${ano}-${mes}-01`;
    const hoje   = agora.toISOString().slice(0, 10);
    const mesStr = `${ano}-${mes}`;

    const labelEl = $('metas-periodo-label');
    if (labelEl) {
        const lbl = agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        labelEl.textContent = lbl.charAt(0).toUpperCase() + lbl.slice(1);
    }

    // Realizados — reusa cálculos existentes (sem duplicação)
    const metricas     = calcMetricasDash(ini, hoje);
    const recebTotal   = dadosReceber
        .filter(c => c.status === 'recebido' && (c.vencimento || '').startsWith(mesStr))
        .reduce((s, c) => s + Number(c.valor || 0), 0);
    const recebPend    = dadosReceber
        .filter(c => c.status !== 'recebido' && (c.vencimento || '').startsWith(mesStr))
        .reduce((s, c) => s + Number(c.valor || 0), 0);
    const osConcluidas = dadosOS.filter(o =>
        o.status === 'entregue' && (o.updatedAt || o.createdAt || '').startsWith(mesStr)
    ).length;
    const osAndamento  = dadosOS.filter(o =>
        !OS_TERMINAIS.includes(o.status) && (o.createdAt || '').startsWith(mesStr)
    ).length;

    const m = dadosMetas;
    const metasDef = [
        {
            icon: '💰', titulo: 'Faturamento Mensal',
            meta: Number(m.faturamento_mensal || 0),
            realizado: metricas.faturamento,
            tipo: 'moeda',
            extra: null,
        },
        {
            icon: '📈', titulo: 'Lucro Líquido Mensal',
            meta: Number(m.lucro_mensal || 0),
            realizado: metricas.lucro,
            tipo: 'moeda',
            extra: null,
        },
        {
            icon: '📥', titulo: 'Recebimentos do Mês',
            meta: Number(m.recebimentos_mensal || 0),
            realizado: recebTotal,
            tipo: 'moeda',
            extra: { label: 'A receber no mês', valor: fmt(recebPend) },
        },
        {
            icon: '🔧', titulo: 'Ordens de Serviço',
            meta: Number(m.os_mensal || 0),
            realizado: osConcluidas,
            tipo: 'qtd',
            extra: { label: 'Em andamento', valor: String(osAndamento) },
        },
    ];

    const gridEl = $('fin-metas-grid');
    if (!gridEl) return;

    const nenhumaMeta = !m.faturamento_mensal && !m.lucro_mensal && !m.recebimentos_mensal && !m.os_mensal;
    if (nenhumaMeta) {
        gridEl.innerHTML = `
        <div class="fin-metas-vazio">
            <div class="fin-metas-vazio-icon">🏆</div>
            <div class="fin-metas-vazio-titulo">Nenhuma meta configurada</div>
            <div class="fin-metas-vazio-sub">Clique em <strong>⚙️ Configurar Metas</strong> para definir seus objetivos mensais e acompanhar o desempenho em tempo real.</div>
        </div>`;
        atualizarHomeCardMetas();
        return;
    }

    const fmtV = (v, tipo) => tipo === 'qtd' ? String(Math.round(v)) : fmt(v);

    gridEl.innerHTML = metasDef.map(md => {
        const si      = calcStatusMeta(md.realizado, md.meta);
        const projecao = projetarMes(md.realizado);
        const projStr  = fmtV(projecao, md.tipo);
        const projAcima = md.meta > 0 ? projecao >= md.meta : null;
        const projCor   = projAcima === null ? '#6b7280' : projAcima ? '#00c853' : '#fbbf24';

        const COR_BG   = { green: 'rgba(0,200,83,.13)',   yellow: 'rgba(251,191,36,.13)', red: 'rgba(239,68,68,.13)' };
        const COR_TXT  = { green: '#00e676',              yellow: '#fbbf24',              red: '#ef4444' };
        const COR_BRD  = { green: 'rgba(0,200,83,.28)',   yellow: 'rgba(251,191,36,.28)', red: 'rgba(239,68,68,.28)' };
        const COR_FILL = { green: '#00c853',              yellow: '#fbbf24',              red: '#ef4444' };

        const badgeHtml = si ? `<span class="fin-meta-badge" style="background:${COR_BG[si.cor]};color:${COR_TXT[si.cor]};border:1px solid ${COR_BRD[si.cor]}">${si.txt}</span>` : '';
        const barPct    = si ? Math.min(si.pct, 100) : 0;
        const barCor    = si ? COR_FILL[si.cor] : '#6b7280';
        const pctLabel  = si ? `${si.pct.toFixed(1)}%` : '—';
        const pctCor    = si ? COR_TXT[si.cor] : '#6b7280';

        const extraHtml = md.extra ? `
        <div class="fin-meta-row">
            <span class="fin-meta-row-lbl">${md.extra.label}</span>
            <span class="fin-meta-row-val">${md.extra.valor}</span>
        </div>` : '';

        const projHtml = md.meta > 0 ? `
        <div class="fin-meta-projecao">
            <span class="fin-meta-proj-lbl">📈 Projeção final</span>
            <span class="fin-meta-proj-val" style="color:${projCor}">${projStr}</span>
            <span class="fin-meta-proj-status" style="color:${projCor}">${projAcima ? 'Acima da Meta' : 'Abaixo da Meta'}</span>
        </div>` : '';

        return `
        <div class="fin-meta-card">
            <div class="fin-meta-card-head">
                <span class="fin-meta-icon">${md.icon}</span>
                <div class="fin-meta-titulo">${md.titulo}</div>
                ${badgeHtml}
            </div>
            <div class="fin-meta-valores">
                <div class="fin-meta-row">
                    <span class="fin-meta-row-lbl">Meta</span>
                    <span class="fin-meta-row-val">${md.meta > 0 ? fmtV(md.meta, md.tipo) : `<em style="color:var(--text-tertiary)">Não definida</em>`}</span>
                </div>
                <div class="fin-meta-row">
                    <span class="fin-meta-row-lbl">Realizado</span>
                    <span class="fin-meta-row-val" style="color:${si ? COR_TXT[si.cor] : 'var(--text-primary)'}; font-weight:700">${fmtV(md.realizado, md.tipo)}</span>
                </div>
                ${extraHtml}
            </div>
            <div class="fin-meta-prog-wrap">
                <div class="fin-meta-prog-track">
                    <div class="fin-meta-prog-fill" style="width:${barPct.toFixed(1)}%;background:${barCor}"></div>
                </div>
                <span class="fin-meta-prog-pct" style="color:${pctCor}">${pctLabel}</span>
            </div>
            ${projHtml}
        </div>`;
    }).join('');

    atualizarHomeCardMetas();
}

function atualizarHomeCardMetas() {
    const pctEl = $('hc-metas-pct');
    const barEl = $('hc-metas-bar');
    if (!pctEl) return;

    const meta = Number(dadosMetas.faturamento_mensal || 0);
    if (!meta) {
        pctEl.textContent = 'Definir';
        if (barEl) barEl.style.width = '0%';
        return;
    }

    const agora = new Date();
    const ano   = agora.getFullYear();
    const mes   = String(agora.getMonth() + 1).padStart(2, '0');
    const fat   = calcMetricasDash(`${ano}-${mes}-01`, agora.toISOString().slice(0, 10)).faturamento;
    const pct   = Math.min((fat / meta) * 100, 100);

    pctEl.textContent = pct.toFixed(0) + '%';
    if (barEl) {
        barEl.style.width      = pct + '%';
        barEl.style.background = pct >= 100 ? '#00c853' : pct >= 75 ? '#fbbf24' : '#ef4444';
    }
}

function abrirFormMetas() {
    const m = dadosMetas;
    $('meta-faturamento').value  = m.faturamento_mensal  || '';
    $('meta-lucro').value        = m.lucro_mensal        || '';
    $('meta-recebimentos').value = m.recebimentos_mensal || '';
    $('meta-os').value           = m.os_mensal           || '';
    $('form-metas').style.display = 'flex';
    setTimeout(() => $('meta-faturamento').focus(), 50);
}

async function salvarMetas() {
    const dados = {
        faturamento_mensal:  Number($('meta-faturamento').value)  || 0,
        lucro_mensal:        Number($('meta-lucro').value)        || 0,
        recebimentos_mensal: Number($('meta-recebimentos').value) || 0,
        os_mensal:           Number($('meta-os').value)           || 0,
        atualizadoEm: serverTimestamp(),
    };
    try {
        await setDoc(doc(db, COL_METAS, getEmpresaId()), dados);
        dadosMetas = { ...dados };
        fecharForm('form-metas');
        renderMetas();
        toast('🎯 Metas salvas com sucesso!');
    } catch (e) {
        console.error(e);
        toast('⚠ Erro ao salvar metas.');
    }
}

function bindMetasForm() {
    $('fin-btn-metas-config')?.addEventListener('click', abrirFormMetas);
    $('meta-salvar')?.addEventListener('click', salvarMetas);
    $('meta-cancelar')?.addEventListener('click', () => fecharForm('form-metas'));
}

// ══════════════════════════════════════════════════════════════════════
// 🎯 DASHBOARD EXECUTIVO FINANCEIRO
// ══════════════════════════════════════════════════════════════════════

function dashRange() {
    const agora = new Date();
    const pad   = n => String(n).padStart(2, '0');
    const ano   = agora.getFullYear();
    const mes   = pad(agora.getMonth() + 1);
    const dia   = pad(agora.getDate());
    const hoje  = `${ano}-${mes}-${dia}`;
    const dow   = agora.getDay() || 7;
    const seg   = new Date(agora); seg.setDate(agora.getDate() - dow + 1);
    const segStr = seg.toISOString().slice(0, 10);
    switch (perioDash) {
        case 'hoje':   return { ini: hoje,              fim: hoje, labelComp: 'vs ontem' };
        case 'semana': return { ini: segStr,             fim: hoje, labelComp: 'vs sem. ant.' };
        case 'mes':    return { ini: `${ano}-${mes}-01`, fim: hoje, labelComp: 'vs mês ant.' };
        case 'ano':    return { ini: `${ano}-01-01`,     fim: hoje, labelComp: 'vs ano ant.' };
        default:       return { ini: `${ano}-${mes}-01`, fim: hoje, labelComp: 'vs mês ant.' };
    }
}

function dashRangeAnterior() {
    const agora = new Date();
    const pad   = n => String(n).padStart(2, '0');
    const ano   = agora.getFullYear();
    const mes   = agora.getMonth();
    switch (perioDash) {
        case 'hoje': {
            const d = new Date(agora); d.setDate(d.getDate() - 1);
            const s = d.toISOString().slice(0, 10);
            return { ini: s, fim: s };
        }
        case 'semana': {
            const dow = agora.getDay() || 7;
            const s = new Date(agora); s.setDate(agora.getDate() - dow + 1 - 7);
            const f = new Date(s); f.setDate(s.getDate() + 6);
            return { ini: s.toISOString().slice(0, 10), fim: f.toISOString().slice(0, 10) };
        }
        case 'mes': {
            const prim = new Date(ano, mes - 1, 1);
            const ult  = new Date(ano, mes, 0);
            return {
                ini: `${prim.getFullYear()}-${pad(prim.getMonth() + 1)}-01`,
                fim: ult.toISOString().slice(0, 10),
            };
        }
        case 'ano':
            return { ini: `${ano - 1}-01-01`, fim: `${ano - 1}-12-31` };
        default:
            return null;
    }
}

function filtrarDash(lista, campo, ini, fim) {
    return lista.filter(item => {
        const raw = item[campo] || item.data || item.vencimento || item.dia || item.dataISO || '';
        const d   = typeof raw === 'string' ? raw.slice(0, 10) : '';
        return d >= ini && d <= fim;
    });
}

function calcMetricasDash(ini, fim) {
    const cxEnt = filtrarDash(dadosCaixa, 'dia', ini, fim)
        .filter(l => l.tipo === 'entrada' || l.tipo === 'servico');
    const receb = filtrarDash(dadosReceber, 'recebidoEm', ini, fim)
        .filter(c => c.status === 'recebido' && !c.origemCaixa);
    const cxSai = filtrarDash(dadosCaixa, 'dia', ini, fim)
        .filter(l => l.tipo === 'saida');
    const desps = filtrarDash(dadosDespesas, 'data', ini, fim)
        .filter(d => !d.origemCaixa);
    const comps = filtrarDash(dadosCompras, 'data', ini, fim)
        .filter(c => c.status === 'pago');
    const pags  = filtrarDash(dadosPagar, 'pagoEm', ini, fim)
        .filter(c => c.status === 'pago' && c.origem !== 'compra' && !c.id?.startsWith('pagar_cmp_'));

    const faturamento = cxEnt.reduce((s, l) => s + Number(l.valor    || 0), 0)
                      + receb.reduce((s, c) => s + Number(c.valor    || 0), 0);
    const despesas    = cxSai.reduce((s, l) => s + Number(l.valor    || 0), 0)
                      + desps.reduce((s, d) => s + Number(d.valor    || 0), 0)
                      + comps.reduce((s, c) => s + Number(c.valorTotal || 0), 0)
                      + pags.reduce( (s, c) => s + Number(c.valor    || 0), 0);
    const lucro    = faturamento - despesas;
    const aPagar   = dadosPagar.filter(c => c.status !== 'pago')
                               .reduce((s, c) => s + Number(c.valor || 0), 0);
    const aReceber = dadosReceber.filter(c => c.status !== 'recebido')
                                 .reduce((s, c) => s + Number(c.valor || 0), 0);
    return { faturamento, despesas, lucro, aPagar, aReceber, saldo: aReceber - aPagar };
}

function ultimos6Meses() {
    const agora = new Date();
    const res   = [];
    for (let i = 5; i >= 0; i--) {
        const d   = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const ano = d.getFullYear();
        const m   = String(d.getMonth() + 1).padStart(2, '0');
        const ini = `${ano}-${m}-01`;
        const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
        const lbl = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        res.push({ ini, fim, label: lbl });
    }
    return res;
}

// ── Helpers de Canvas ─────────────────────────────────────────────────
function fmtK(v) {
    const abs = Math.abs(v);
    const sig = v < 0 ? '-' : '';
    if (abs >= 1000) return sig + 'R$' + (abs / 1000).toFixed(1) + 'k';
    return sig + 'R$' + abs.toFixed(0);
}

function setupCanvasDash(id, height) {
    const canvas = $(id);
    if (!canvas) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w   = Math.max(canvas.parentElement.getBoundingClientRect().width, 180);
    canvas.width  = w * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = '100%';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w, h: height };
}

function drawBarChartDash(id, labels, datasets) {
    const c = setupCanvasDash(id, 188);
    if (!c) return;
    const { ctx, w, h } = c;
    const pad = { top: 26, right: 10, bottom: 38, left: 54 };
    const cW  = w - pad.left - pad.right;
    const cH  = h - pad.top  - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    const allVals = datasets.flatMap(d => d.data).filter(isFinite);
    const maxVal  = Math.max(...allVals, 1);

    for (let i = 0; i <= 4; i++) {
        const y = pad.top + cH * (1 - i / 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
        ctx.fillStyle = '#6b7280';
        ctx.font      = '10px -apple-system,sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(fmtK(maxVal * i / 4), pad.left - 4, y + 3);
    }

    const nG  = labels.length;
    const nB  = datasets.length;
    const gW  = cW / nG;
    const bW  = Math.max(Math.min((gW - 8) / nB - 2, 28), 4);
    const tot = nB * bW + (nB - 1) * 2;

    datasets.forEach((ds, di) => {
        ctx.fillStyle = ds.color;
        ds.data.forEach((val, gi) => {
            const bH = Math.max((Number(val) / maxVal) * cH, 0);
            const x  = pad.left + gi * gW + (gW - tot) / 2 + di * (bW + 2);
            ctx.fillRect(x, pad.top + cH - bH, bW, bH);
        });
    });

    ctx.fillStyle = '#6b7280';
    ctx.font      = '10px -apple-system,sans-serif';
    ctx.textAlign = 'center';
    labels.forEach((lbl, i) => ctx.fillText(lbl, pad.left + i * gW + gW / 2, h - 8));

    // Legenda
    let lx = pad.left;
    datasets.forEach(ds => {
        ctx.fillStyle = ds.color;
        ctx.fillRect(lx, 7, 10, 8);
        ctx.fillStyle = '#a1a8b3';
        ctx.font      = '10px -apple-system,sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(ds.label || '', lx + 13, 15);
        lx += Math.max((ds.label || '').length * 6 + 22, 68);
    });
}

function drawLineChartDash(id, labels, datasets) {
    const c = setupCanvasDash(id, 188);
    if (!c) return;
    const { ctx, w, h } = c;
    const pad = { top: 20, right: 14, bottom: 38, left: 54 };
    const cW  = w - pad.left - pad.right;
    const cH  = h - pad.top  - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    const allVals = datasets.flatMap(d => d.data).filter(isFinite);
    const minVal  = Math.min(...allVals, 0);
    const maxVal  = Math.max(...allVals, 1);
    const range   = Math.abs(maxVal - minVal) || 1;
    const n       = labels.length;

    for (let i = 0; i <= 4; i++) {
        const val = minVal + range * (i / 4);
        const y   = pad.top + cH * (1 - i / 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
        ctx.fillStyle = '#6b7280';
        ctx.font      = '10px -apple-system,sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(fmtK(val), pad.left - 4, y + 3);
    }

    if (minVal < 0) {
        const y0 = pad.top + cH * (1 - (0 - minVal) / range);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(pad.left, y0); ctx.lineTo(w - pad.right, y0); ctx.stroke();
        ctx.setLineDash([]);
    }

    datasets.forEach(ds => {
        const pts = ds.data.map((val, i) => ({
            x: pad.left + (n > 1 ? i / (n - 1) : 0.5) * cW,
            y: pad.top  + cH * (1 - (Number(val) - minVal) / range),
        }));

        const isGreen = ds.color === '#00c853';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pad.top + cH);
        pts.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(pts[pts.length - 1].x, pad.top + cH);
        ctx.closePath();
        ctx.fillStyle = isGreen ? 'rgba(0,200,83,0.10)' : 'rgba(239,68,68,0.10)';
        ctx.fill();

        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = ds.color;
        ctx.lineWidth   = 2;
        ctx.stroke();

        ctx.fillStyle = ds.color;
        pts.forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
        });
    });

    ctx.fillStyle = '#6b7280';
    ctx.font      = '10px -apple-system,sans-serif';
    ctx.textAlign = 'center';
    labels.forEach((lbl, i) => {
        const x = pad.left + (n > 1 ? i / (n - 1) : 0.5) * cW;
        ctx.fillText(lbl, x, h - 8);
    });
}

function drawFluxoDiarioDash(id, ini, fim) {
    const c = setupCanvasDash(id, 188);
    if (!c) return;
    const { ctx, w, h } = c;

    const days = [];
    const cur  = new Date(ini + 'T12:00:00');
    const end  = new Date(fim + 'T12:00:00');
    while (cur <= end && days.length < 62) {
        days.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
    }
    if (!days.length) return;

    const dayNet = days.map(d => {
        let net = 0;
        dadosCaixa.forEach(l => {
            if ((l.dia || l.dataISO || '').slice(0, 10) !== d) return;
            if (l.tipo === 'entrada' || l.tipo === 'servico') net += Number(l.valor || 0);
            else if (l.tipo === 'saida')                      net -= Number(l.valor || 0);
        });
        return net;
    });

    const pad    = { top: 20, right: 10, bottom: 30, left: 54 };
    const cW     = w - pad.left - pad.right;
    const cH     = h - pad.top  - pad.bottom;
    const maxAbs = Math.max(...dayNet.map(v => Math.abs(v)), 1);

    ctx.clearRect(0, 0, w, h);

    for (let i = -2; i <= 2; i++) {
        const y   = pad.top + cH * 0.5 - (i / 2) * cH * 0.45;
        const isZ = i === 0;
        ctx.strokeStyle = isZ ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)';
        ctx.lineWidth   = isZ ? 1.5 : 1;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
        if (i !== 0 && i % 2 === 0) {
            ctx.fillStyle = '#6b7280';
            ctx.font      = '10px -apple-system,sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(fmtK(maxAbs * i / 2), pad.left - 4, y + 3);
        }
    }

    const bW = Math.max(cW / days.length - 1, 2);
    const y0 = pad.top + cH * 0.5;
    days.forEach((d, i) => {
        const val = dayNet[i];
        const bH  = (Math.abs(val) / maxAbs) * (cH * 0.45);
        const x   = pad.left + i * (cW / days.length);
        ctx.fillStyle = val >= 0 ? 'rgba(0,200,83,0.72)' : 'rgba(239,68,68,0.72)';
        ctx.fillRect(x, val >= 0 ? y0 - bH : y0, bW, bH);
    });

    ctx.fillStyle = '#6b7280';
    ctx.font      = '10px -apple-system,sans-serif';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.ceil(days.length / 7));
    days.forEach((d, i) => {
        if (i % step === 0) {
            ctx.fillText(d.slice(8) + '/' + d.slice(5, 7), pad.left + i * (cW / days.length) + bW / 2, h - 4);
        }
    });
}

function renderCatDespesasDash(ini, fim) {
    const el = $('fin-dash-cat');
    if (!el) return;

    const cats = {};
    const add  = (cat, val) => { cats[cat] = (cats[cat] || 0) + Number(val || 0); };

    filtrarDash(dadosDespesas, 'data', ini, fim).filter(d => !d.origemCaixa)
        .forEach(d => add(d.categoria || 'Outros', d.valor));
    filtrarDash(dadosCompras, 'data', ini, fim).filter(c => c.status === 'pago')
        .forEach(c => add('Compras de Mercadorias', c.valorTotal));
    filtrarDash(dadosPagar, 'vencimento', ini, fim)
        .filter(c => c.status === 'pago' && c.origem !== 'compra' && !c.id?.startsWith('pagar_cmp_'))
        .forEach(c => add(c.categoria || 'Outros', c.valor));
    filtrarDash(dadosCaixa, 'dia', ini, fim).filter(l => l.tipo === 'saida')
        .forEach(l => add(l.categoria || 'Caixa', l.valor));

    const items = Object.entries(cats)
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor);

    if (!items.length) {
        el.innerHTML = '<div style="color:var(--text-tertiary);font-size:13px;padding:8px 0">Sem despesas neste período.</div>';
        return;
    }

    const maxV = items[0].valor;
    const COLS = ['#ef4444','#f97316','#fbbf24','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#6b7280'];
    el.innerHTML = items.slice(0, 8).map((item, i) => {
        const pct = Math.round((item.valor / maxV) * 100);
        const cor = COLS[i % COLS.length];
        return `<div class="fin-barra-item">
            <div class="fin-barra-nome" style="color:${cor};width:130px">${escHtml(item.nome)}</div>
            <div class="fin-barra-track"><div class="fin-barra-fill" style="width:${pct}%;background:${cor}"></div></div>
            <div class="fin-barra-val">${fmt(item.valor)}</div>
        </div>`;
    }).join('');
}

function renderDashboard() {
    const { ini, fim, labelComp } = dashRange();
    const atual      = calcMetricasDash(ini, fim);
    const prevRange  = dashRangeAnterior();
    const prev       = prevRange ? calcMetricasDash(prevRange.ini, prevRange.fim) : null;

    const deltaPct = (curr, p) => {
        if (p === null || p === undefined || p === 0) return null;
        return ((curr - p) / Math.abs(p)) * 100;
    };

    const COR = { green: '#00e676', red: '#ef4444', blue: '#60a5fa', yellow: '#fbbf24' };

    const kpis = [
        { icon:'💰', label:'Faturamento',     valor: atual.faturamento, prevVal: prev?.faturamento, cor:'green',  inv: false },
        { icon:'📈', label:'Lucro Líquido',   valor: atual.lucro,        prevVal: prev?.lucro,        cor: atual.lucro  >= 0 ? 'green' : 'red', inv: false },
        { icon:'💸', label:'Despesas Totais', valor: atual.despesas,     prevVal: prev?.despesas,     cor:'red',   inv: true  },
        { icon:'⚖️', label:'Saldo Atual',     valor: atual.saldo,        prevVal: null,              cor: atual.saldo  >= 0 ? 'green' : 'red', inv: false },
        { icon:'📥', label:'A Receber',        valor: atual.aReceber,     prevVal: null,              cor:'blue',  inv: false },
        { icon:'⏳', label:'A Pagar',          valor: atual.aPagar,       prevVal: null,              cor:'yellow',inv: false },
        { icon:'📊', label:'Resultado',        valor: atual.faturamento - atual.despesas, prevVal: null, cor: (atual.faturamento - atual.despesas) >= 0 ? 'green' : 'red', inv: false },
    ];

    const gridEl = $('fin-dash-kpi');
    if (!gridEl) return;

    gridEl.innerHTML = kpis.map(k => {
        const pct = deltaPct(k.valor, k.prevVal);
        let deltaHtml = '';
        if (pct !== null && isFinite(pct)) {
            const positivo = k.inv ? pct <= 0 : pct >= 0;
            const arrow    = pct >= 0 ? '↑' : '↓';
            const dcor     = positivo ? '#00c853' : '#ef4444';
            deltaHtml = `<div class="fin-dash-kpi-delta" style="color:${dcor}">${arrow} ${Math.abs(pct).toFixed(1)}% <span style="opacity:.55;font-weight:400">${labelComp}</span></div>`;
        }
        return `<div class="fin-dash-kpi-card">
            <div class="fin-dash-kpi-icon">${k.icon}</div>
            <div class="fin-dash-kpi-valor" style="color:${COR[k.cor]}">${fmt(k.valor)}</div>
            <div class="fin-dash-kpi-label">${k.label}</div>
            ${deltaHtml}
        </div>`;
    }).join('');

    // Charts — 6 meses
    const m6     = ultimos6Meses();
    const lbs    = m6.map(m => m.label);
    const fat6   = m6.map(m => calcMetricasDash(m.ini, m.fim).faturamento);
    const desp6  = m6.map(m => calcMetricasDash(m.ini, m.fim).despesas);
    const lucro6 = m6.map(m => calcMetricasDash(m.ini, m.fim).lucro);

    drawBarChartDash('dash-chart-receita', lbs, [
        { data: fat6,  color: 'rgba(0,200,83,0.72)',  label: 'Receita'  },
        { data: desp6, color: 'rgba(239,68,68,0.72)', label: 'Despesas' },
    ]);
    drawLineChartDash('dash-chart-evolucao', lbs, [
        { data: lucro6, color: '#00c853', label: 'Lucro' },
    ]);
    renderCatDespesasDash(ini, fim);
    drawFluxoDiarioDash('dash-chart-fluxo', ini, fim);
}

function bindDashPeriodo() {
    document.querySelectorAll('.fin-pdash').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.fin-pdash').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            perioDash = btn.dataset.pd;
            renderDashboard();
        });
    });
}

// ── Inicialização ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => carregar());
