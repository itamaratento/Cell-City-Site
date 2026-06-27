/* ============================================================
   LIXEIRA — Cell City Gestão Empresarial
   Visualiza, restaura e exclui permanentemente itens da coleção 'lixeira'
   ============================================================ */
import { listarLixeira, restaurarDaLixeira, excluirPermanente } from '../../shared/lixeira.js';

const ICONES = {
    financeiro_despesas:   '💸',
    compras_financeiras:   '🛒',
    financeiro_pagar:      '🏢',
    financeiro_receber:    '🧾',
    estoque_produtos:      '📦',
    os:                    '📱',
    clientes:              '👤',
};

const LABELS = {
    financeiro_despesas:   'Despesas',
    compras_financeiras:   'Compras',
    financeiro_pagar:      'Contas a Pagar',
    financeiro_receber:    'Contas a Receber',
    estoque_produtos:      'Estoque',
    os:                    'Ordens de Serviço',
    clientes:              'Clientes',
};

let _itens   = [];
let _filtro  = '';

function toast(msg) {
    const el = document.getElementById('lx-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
}

function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function nomeLegivel(item) {
    try {
        const d = JSON.parse(item.dados || '{}');
        return d.descricao || d.nome || d.fornecedorNome || d.cliente || d.referencia || item.idOriginal;
    } catch { return item.idOriginal; }
}

function renderLista() {
    const loadEl = document.getElementById('lx-loading');
    const vaziEl = document.getElementById('lx-vazio');
    const listEl = document.getElementById('lx-lista');
    if (loadEl) loadEl.style.display = 'none';

    const filtrados = _filtro ? _itens.filter(i => i.colecaoOrigem === _filtro) : _itens;

    if (!filtrados.length) {
        if (vaziEl) vaziEl.style.display = 'flex';
        if (listEl) listEl.style.display = 'none';
        return;
    }

    if (vaziEl) vaziEl.style.display = 'none';
    if (!listEl) return;
    listEl.style.display = 'grid';

    listEl.innerHTML = filtrados.map(item => {
        const icone  = ICONES[item.colecaoOrigem] || '📄';
        const label  = LABELS[item.colecaoOrigem] || item.colecaoOrigem;
        const nome   = escHtml(nomeLegivel(item));
        const data   = item.deletadoEmISO
            ? new Date(item.deletadoEmISO).toLocaleString('pt-BR')
            : '—';
        return `
        <div class="lx-card" id="lx-card-${escHtml(item.id)}">
            <span class="lx-card-icon">${icone}</span>
            <div class="lx-card-body">
                <div class="lx-card-nome">${nome}</div>
                <div class="lx-card-meta">
                    Excluído em ${data}
                    <span class="lx-card-col">${label}</span>
                </div>
            </div>
            <div class="lx-card-btns">
                <button class="lx-btn-restaurar" onclick="lxRestaurar('${escHtml(item.id)}')">↩ Restaurar</button>
                <button class="lx-btn-excluir"   onclick="lxExcluir('${escHtml(item.id)}')">✕ Excluir</button>
            </div>
        </div>`;
    }).join('');
}

function renderFiltros() {
    const el = document.getElementById('lx-filtros');
    if (!el) return;

    const colecoes = [...new Set(_itens.map(i => i.colecaoOrigem))];

    const todos = `<button class="lx-filtro ${!_filtro ? 'active' : ''}" onclick="lxFiltrar('')">Todos (${_itens.length})</button>`;
    const chips = colecoes.map(col => {
        const qtd   = _itens.filter(i => i.colecaoOrigem === col).length;
        const label = LABELS[col] || col;
        return `<button class="lx-filtro ${_filtro === col ? 'active' : ''}" onclick="lxFiltrar('${col}')">${label} (${qtd})</button>`;
    }).join('');

    el.innerHTML = todos + chips;
}

async function init() {
    // Pré-filtra por querystring ?col=
    const params = new URLSearchParams(location.search);
    _filtro = params.get('col') || '';

    _itens = await listarLixeira();
    renderFiltros();
    renderLista();
}

window.lxFiltrar = function(col) {
    _filtro = col;
    renderFiltros();
    renderLista();
};

window.lxRestaurar = async function(id) {
    const card = document.getElementById(`lx-card-${id}`);
    if (card) card.style.opacity = '0.5';
    const ok = await restaurarDaLixeira(id);
    if (ok) {
        _itens = _itens.filter(i => i.id !== id);
        renderFiltros();
        renderLista();
        toast('✅ Item restaurado com sucesso!');
    } else {
        if (card) card.style.opacity = '1';
        toast('⚠ Erro ao restaurar.');
    }
};

window.lxExcluir = async function(id) {
    if (!confirm('Excluir permanentemente? Esta ação não pode ser desfeita.')) return;
    const ok = await excluirPermanente(id);
    if (ok) {
        _itens = _itens.filter(i => i.id !== id);
        renderFiltros();
        renderLista();
        toast('🗑️ Excluído permanentemente.');
    } else {
        toast('⚠ Erro ao excluir.');
    }
};

document.addEventListener('DOMContentLoaded', init);
