import { db, collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from '../../scripts/firebase.js';

const COL_PAGAR     = 'financeiro_pagar';
const COL_FIXAS     = 'financeiro_fixas';
const COL_RECEBER   = 'financeiro_receber';
const COL_DESPESAS  = 'financeiro_despesas';
const COL_COMPRAS   = 'compras_financeiras';
const COL_CAIXA     = 'caixa_lancamentos';

const fmt = v => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const hoje = () => new Date().toISOString().slice(0, 10);
const $ = id => document.getElementById(id);

let dadosPagar     = [];
let dadosFixas     = [];
let dadosReceber   = [];
let dadosDespesas  = [];
let dadosCompras   = [];
let dadosCaixa     = [];
let filtroStatusPagar   = 'todos';
let filtroStatusReceber = 'todos';
let filtroStatusFixas   = 'todas';
let editandoId = null;
let editandoColecao = null;
let secaoAtiva = 'home';
let periodoResumo = 'mes';
let periodoFluxo  = 'mes';
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
    home:    { titulo: '💹 Financeiro',              novo: false },
    pagar:   { titulo: '💰 Contas a Pagar',           novo: true  },
    receber: { titulo: '💵 Contas a Receber',         novo: true  },
    fixas:   { titulo: '📅 Despesas Fixas',           novo: true  },
    resumo:  { titulo: '📊 Resultado Financeiro',     novo: false },
    fluxo:   { titulo: '📈 Fluxo de Caixa Unificado', novo: false },
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
    ['pagar','receber','fixas','resumo','fluxo'].forEach(s => {
        $('fin-sec-' + s).style.display = s === sec ? '' : 'none';
    });
    if (sec === 'resumo') renderResultado();
    if (sec === 'fluxo')  renderFluxo();

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
        const [sp, sf, sr, sd, sc, scx] = await Promise.all([
            getDocs(collection(db, COL_PAGAR)),
            getDocs(collection(db, COL_FIXAS)),
            getDocs(collection(db, COL_RECEBER)),
            getDocs(collection(db, COL_DESPESAS)),
            getDocs(collection(db, COL_COMPRAS)),
            getDocs(collection(db, COL_CAIXA)),
        ]);
        dadosPagar    = []; sp.forEach(d  => dadosPagar.push({ id: d.id, ...d.data() }));
        dadosFixas    = []; sf.forEach(d  => dadosFixas.push({ id: d.id, ...d.data() }));
        dadosReceber  = []; sr.forEach(d  => dadosReceber.push({ id: d.id, ...d.data() }));
        dadosDespesas = []; sd.forEach(d  => dadosDespesas.push({ id: d.id, ...d.data() }));
        dadosCompras  = []; sc.forEach(d  => dadosCompras.push({ id: d.id, ...d.data() }));
        dadosCaixa    = []; scx.forEach(d => dadosCaixa.push({ id: d.id, ...d.data() }));
    } catch {
        dadosPagar = []; dadosFixas = []; dadosReceber = [];
        dadosDespesas = []; dadosCompras = []; dadosCaixa = [];
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
    bindPeriodoResumo();
    bindPeriodoFluxo();
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
    } catch { toast('⚠ Erro ao atualizar.'); }
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
        } catch { toast('⚠ Erro ao excluir.'); }
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
        descricao:       desc,
        categoria:       $('ff-cat').value,
        recorrencia:     $('ff-recorrencia').value,
        data_inicio:     $('ff-data-inicio').value,
        valor:           Number($('ff-valor').value) || 0,
        forma_pagamento: $('ff-pagamento').value,
        status:          $('ff-status').value,
        obs:             $('ff-obs').value.trim(),
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

    // Contas recebidas
    const recebidas = filtrarFluxo(dadosReceber, 'vencimento').filter(c => c.status === 'recebido');
    const valRecebidas = recebidas.reduce((s, c) => s + Number(c.valor || 0), 0);

    const totalEntradas = valCaixaEnt + valRecebidas;

    // ── Saídas ────────────────────────────────────────────────────────
    // Caixa: tipo = saida
    const caixaSaidas = filtrarFluxo(dadosCaixa, 'dia').filter(l => l.tipo === 'saida');
    const valCaixaSai = caixaSaidas.reduce((s, l) => s + Number(l.valor || 0), 0);

    // Despesas do módulo Despesas
    const despPeriodo = filtrarFluxo(dadosDespesas, 'data');
    const valDespesas = despPeriodo.reduce((s, d) => s + Number(d.valor || 0), 0);

    // Compras pagas
    const comprasP = filtrarFluxo(dadosCompras, 'data').filter(c => c.status === 'pago');
    const valCompras = comprasP.reduce((s, c) => s + Number(c.valorTotal || 0), 0);

    // Contas pagas (pagar)
    const contasPagas = filtrarFluxo(dadosPagar, 'vencimento').filter(c => c.status === 'pago');
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
        recebidas.forEach(c => movs.push({ data: c.vencimento || '', desc: c.descricao || c.cliente || '—', valor: c.valor, tipo: 'entrada', fonte: 'Contas a Receber' }));
        caixaSaidas.forEach(l => movs.push({ data: (l.dia || l.dataISO || '').slice(0,10), desc: l.descricao || '—', valor: l.valor, tipo: 'saida', fonte: 'Caixa' }));
        despPeriodo.forEach(d => movs.push({ data: d.data || '', desc: d.descricao || '—', valor: d.valor, tipo: 'saida', fonte: 'Despesas' }));
        comprasP.forEach(c => movs.push({ data: c.data || '', desc: c.fornecedorNome || '—', valor: c.valorTotal, tipo: 'saida', fonte: 'Compras' }));
        contasPagas.forEach(c => movs.push({ data: c.vencimento || '', desc: c.descricao || '—', valor: c.valor, tipo: 'saida', fonte: 'Contas a Pagar' }));
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

// ── Inicialização ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => carregar());
