import { db } from '../../scripts/firebase.js';
import { initModulo } from '/CRM/scripts/kernel.js';
import {
    collection, query, where, orderBy,
    getDocs, addDoc, deleteDoc, doc, setDoc,
    onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ── Constantes ────────────────────────────────────────────────
const COL_LANCAMENTOS  = 'caixa_lancamentos';
const COL_CATEGORIAS   = 'categorias_caixa';
const CATEGORIAS_PADRAO = [
    { nome: 'Vendas',       tipo: 'entrada' },
    { nome: 'Serviços',     tipo: 'servico' },
    { nome: 'Fornecedores', tipo: 'saida'   },
    { nome: 'Despesas',     tipo: 'saida'   },
    { nome: 'Marketing',    tipo: 'saida'   },
];

// ── Estado ────────────────────────────────────────────────────
let _empresaId  = null;
let _periodo    = 'hoje';
let _unsubLanc  = null;

// ── Boot ──────────────────────────────────────────────────────
async function init() {
    const ctx = await initModulo();
    if (!ctx) return;
    _empresaId = ctx.empresaId;
    console.log('[CAIXA] empresa_id:', _empresaId);

    document.getElementById('data').value = hoje();
    await carregarCategorias();
    assinarLancamentos();
}

// ── Categorias ────────────────────────────────────────────────
async function carregarCategorias() {
    const sel = document.getElementById('categoria');
    try {
        const snap = await getDocs(query(
            collection(db, COL_CATEGORIAS),
            where('empresa_id', '==', _empresaId)
        ));

        let cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (cats.length === 0) {
            for (const c of CATEGORIAS_PADRAO) {
                await setDoc(doc(db, COL_CATEGORIAS, c.nome), {
                    nome: c.nome, tipo: c.tipo, status: 'ativo',
                    empresa_id: _empresaId, criadoEm: serverTimestamp()
                });
            }
            cats = CATEGORIAS_PADRAO.map(c => ({ id: c.nome, ...c }));
        }

        sel.innerHTML = '<option value="">Selecione...</option>' +
            cats.filter(c => c.status !== 'inativo')
                .map(c => `<option value="${c.nome}">${c.nome}</option>`)
                .join('');

        console.log('[CAIXA] Categorias:', cats.length);
    } catch (e) {
        console.error('[CAIXA] Erro categorias:', e);
        sel.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

// ── Lançamentos ───────────────────────────────────────────────
function assinarLancamentos() {
    if (_unsubLanc) _unsubLanc();

    const { ini, fim } = intervalo(_periodo);

    const q = query(
        collection(db, COL_LANCAMENTOS),
        where('empresa_id', '==', _empresaId),
        where('data', '>=', ini),
        where('data', '<=', fim),
        orderBy('data', 'desc')
    );

    _unsubLanc = onSnapshot(q, snap => {
        const lancamentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderLista(lancamentos);
        renderTotais(lancamentos);
    }, err => {
        console.error('[CAIXA] Erro listener:', err);
        document.getElementById('lista-lancamentos').innerHTML =
            '<div class="erro">Erro ao carregar lançamentos.</div>';
    });
}

// ── Salvar ────────────────────────────────────────────────────
window.salvarLancamento = async function () {
    const tipo      = document.getElementById('tipo').value;
    const descricao = document.getElementById('descricao').value.trim();
    const categoria = document.getElementById('categoria').value;
    const valor     = parseFloat(document.getElementById('valor').value);
    const data      = document.getElementById('data').value;
    const obs       = document.getElementById('obs').value.trim();

    if (!descricao) return alerta('Informe a descrição.');
    if (!categoria) return alerta('Selecione uma categoria.');
    if (!valor || valor <= 0) return alerta('Informe o valor.');
    if (!data) return alerta('Informe a data.');

    const btn = document.querySelector('.btn-salvar');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        await addDoc(collection(db, COL_LANCAMENTOS), {
            tipo, descricao, categoria, valor, data, obs,
            empresa_id: _empresaId,
            criadoEm: serverTimestamp()
        });
        limparForm();
        console.log('[CAIXA] Lançamento salvo.');
    } catch (e) {
        console.error('[CAIXA] Erro ao salvar:', e);
        alerta('Erro ao salvar. Tente novamente.');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Salvar';
    }
};

// ── Excluir ───────────────────────────────────────────────────
window.excluirLancamento = async function (id) {
    if (!confirm('Excluir este lançamento?')) return;
    try {
        await deleteDoc(doc(db, COL_LANCAMENTOS, id));
    } catch (e) {
        console.error('[CAIXA] Erro ao excluir:', e);
        alerta('Erro ao excluir.');
    }
};

// ── Filtros ───────────────────────────────────────────────────
window.filtrar = function (btn) {
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    _periodo = btn.dataset.periodo;
    assinarLancamentos();
};

window.selecionarTipo = function (btn) {
    document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    document.getElementById('tipo').value = btn.dataset.tipo;
};

// ── Render ────────────────────────────────────────────────────
function renderLista(lancamentos) {
    const el = document.getElementById('lista-lancamentos');
    if (lancamentos.length === 0) {
        el.innerHTML = '<div class="vazio">Nenhum lançamento neste período.</div>';
        return;
    }

    el.innerHTML = lancamentos.map(l => `
        <div class="lancamento-card tipo-${l.tipo}">
            <div class="lanc-info">
                <div class="lanc-desc">${esc(l.descricao)}</div>
                <div class="lanc-meta">${esc(l.categoria)} · ${l.data}</div>
                ${l.obs ? `<div class="lanc-obs">${esc(l.obs)}</div>` : ''}
            </div>
            <div class="lanc-dir">
                <div class="lanc-valor tipo-${l.tipo}">${formatarMoeda(l.valor)}</div>
                <button class="btn-excluir" onclick="excluirLancamento('${l.id}')">✕</button>
            </div>
        </div>
    `).join('');
}

function renderTotais(lancamentos) {
    const entrada = lancamentos.filter(l => l.tipo !== 'saida').reduce((s, l) => s + (l.valor || 0), 0);
    const saida   = lancamentos.filter(l => l.tipo === 'saida').reduce((s, l) => s + (l.valor || 0), 0);
    document.getElementById('total-entrada').textContent = formatarMoeda(entrada);
    document.getElementById('total-saida').textContent   = formatarMoeda(saida);
    document.getElementById('total-saldo').textContent   = formatarMoeda(entrada - saida);
}

// ── Utilitários ───────────────────────────────────────────────
function hoje() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function intervalo(periodo) {
    const h = hoje();
    if (periodo === 'hoje') return { ini: h, fim: h };

    const d = new Date(h + 'T00:00:00');
    if (periodo === 'semana') {
        const dow = d.getDay() || 7;
        const seg = new Date(d); seg.setDate(d.getDate() - dow + 1);
        const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
        return { ini: seg.toLocaleDateString('en-CA'), fim: dom.toLocaleDateString('en-CA') };
    }
    const ini = `${h.slice(0, 7)}-01`;
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('en-CA');
    return { ini, fim };
}

function formatarMoeda(v) {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function alerta(msg) {
    alert(msg);
}

function limparForm() {
    document.getElementById('descricao').value = '';
    document.getElementById('categoria').value = '';
    document.getElementById('valor').value     = '';
    document.getElementById('obs').value       = '';
    document.getElementById('data').value      = hoje();
    document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('ativo'));
    document.querySelector('[data-tipo="entrada"]').classList.add('ativo');
    document.getElementById('tipo').value = 'entrada';
}

// ── Start ─────────────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
