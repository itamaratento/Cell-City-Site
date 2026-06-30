import { db } from '../../scripts/firebase.js';
import { initModulo } from '/CRM/scripts/kernel.js';
import {
    collection, query, where, orderBy,
    getDocs, addDoc, deleteDoc, updateDoc, doc, setDoc,
    onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ── Constantes ────────────────────────────────────────────────
const COL_LANCAMENTOS = 'caixa_lancamentos';
const COL_CATEGORIAS  = 'categorias_caixa';
const COL_LEMBRETES   = 'lembretes_pagamento';
const CATEGORIAS_PADRAO = [
    { nome: 'Vendas',       tipo: 'entrada' },
    { nome: 'Serviços',     tipo: 'servico' },
    { nome: 'Fornecedores', tipo: 'saida'   },
    { nome: 'Despesas',     tipo: 'saida'   },
    { nome: 'Marketing',    tipo: 'saida'   },
];

// ── Estado ────────────────────────────────────────────────────
let _empresaId      = null;
let _periodo         = 'hoje';
let _unsubLanc       = null;
let _unsubLembretes  = null;
let _ultimosLanc     = [];
let _ultimosLembretes = [];

// ── Boot ──────────────────────────────────────────────────────
async function init() {
    const ctx = await initModulo();
    if (!ctx) return;
    _empresaId = ctx.empresaId;
    console.log('[CAIXA] empresa_id:', _empresaId);

    document.getElementById('data').value = hoje();
    await carregarCategorias();
    assinarLancamentos();
    assinarLembretes();
    carregarMetaSemanal();
}

// ── Categorias ────────────────────────────────────────────────
async function carregarCategorias(selectId = 'categoria') {
    const sel = document.getElementById(selectId);
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

        const valorAtual = sel.value;
        sel.innerHTML = '<option value="">Selecione...</option>' +
            cats.filter(c => c.status !== 'inativo')
                .map(c => `<option value="${c.nome}">${c.nome}</option>`)
                .join('');
        if (valorAtual) sel.value = valorAtual;

        console.log('[CAIXA] Categorias:', cats.length);
    } catch (e) {
        console.error('[CAIXA] Erro categorias:', e);
        sel.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

window.novaCategoria = async function () {
    const nome = prompt('Nome da nova categoria:');
    if (!nome || !nome.trim()) return;
    const nomeFmt = nome.trim();
    try {
        await setDoc(doc(db, COL_CATEGORIAS, nomeFmt), {
            nome: nomeFmt, tipo: document.getElementById('tipo').value,
            status: 'ativo', empresa_id: _empresaId, criadoEm: serverTimestamp()
        }, { merge: true });
        await carregarCategorias();
        document.getElementById('categoria').value = nomeFmt;
        showToast('Categoria adicionada.');
    } catch (e) {
        console.error('[CAIXA] Erro ao criar categoria:', e);
        showToast('Erro ao criar categoria.');
    }
};

// ── Lançamentos ───────────────────────────────────────────────
function assinarLancamentos() {
    if (_unsubLanc) _unsubLanc();

    let q;
    if (_periodo === 'todos') {
        q = query(
            collection(db, COL_LANCAMENTOS),
            where('empresa_id', '==', _empresaId),
            orderBy('data', 'desc')
        );
    } else {
        const { ini, fim } = intervalo(_periodo);
        q = query(
            collection(db, COL_LANCAMENTOS),
            where('empresa_id', '==', _empresaId),
            where('data', '>=', ini),
            where('data', '<=', fim),
            orderBy('data', 'desc')
        );
    }

    _unsubLanc = onSnapshot(q, snap => {
        _ultimosLanc = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderLista(_ultimosLanc);
        renderTotais(_ultimosLanc);
    }, err => {
        console.error('[CAIXA] Erro listener:', err);
        document.getElementById('lista-lancamentos').innerHTML =
            '<div class="erro">Erro ao carregar lançamentos.</div>';
    });
}

function calcularLucro(tipo, valor, custo) {
    const v = valor || 0, c = custo || 0;
    return tipo === 'saida' ? -(v - c) : (v - c);
}

// ── Salvar ────────────────────────────────────────────────────
window.salvarLancamento = async function () {
    const tipo      = document.getElementById('tipo').value;
    const descricao = document.getElementById('descricao').value.trim();
    const categoria = document.getElementById('categoria').value;
    const valor     = parseFloat(document.getElementById('valor').value);
    const custo     = parseFloat(document.getElementById('custo').value) || 0;
    const data      = document.getElementById('data').value;
    const obs       = document.getElementById('obs').value.trim();

    if (!descricao) return showToast('Informe a descrição.');
    if (!categoria) return showToast('Selecione uma categoria.');
    if (!valor || valor <= 0) return showToast('Informe o valor.');
    if (!data) return showToast('Informe a data.');

    const btn = document.querySelector('.btn-salvar');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        const dataISO = new Date(data + 'T12:00:00').toISOString();
        await addDoc(collection(db, COL_LANCAMENTOS), {
            tipo, descricao, categoria, valor, custo,
            lucro: calcularLucro(tipo, valor, custo),
            data, dataISO, ano: new Date(data + 'T12:00:00').getFullYear(),
            obs, empresa_id: _empresaId,
            criadoEm: serverTimestamp()
        });
        limparForm();
        showToast('Lançamento salvo.');
        console.log('[CAIXA] Lançamento salvo.');
    } catch (e) {
        console.error('[CAIXA] Erro ao salvar:', e);
        showToast('Erro ao salvar. Tente novamente.');
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
        showToast('Lançamento excluído.');
    } catch (e) {
        console.error('[CAIXA] Erro ao excluir:', e);
        showToast('Erro ao excluir.');
    }
};

// ── Edição ────────────────────────────────────────────────────
window.editarLancamento = function (id) {
    const l = _ultimosLanc.find(x => x.id === id);
    if (!l) return;

    document.getElementById('edit-id').value = id;
    document.getElementById('edit-tipo').value = l.tipo;
    document.getElementById('edit-descricao').value = l.descricao || '';
    document.getElementById('edit-valor').value = l.valor || '';
    document.getElementById('edit-custo').value = l.custo || '';

    document.querySelectorAll('#modal-edicao .tipo-btn').forEach(b => {
        b.classList.toggle('ativo', b.dataset.tipo === l.tipo);
    });

    carregarCategorias('edit-categoria').then(() => {
        document.getElementById('edit-categoria').value = l.categoria || '';
    });

    atualizarLucroEdicao();
    document.getElementById('modal-edicao').classList.add('aberto');
};

window.selecionarTipoEdicao = function (btn) {
    document.querySelectorAll('#modal-edicao .tipo-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    document.getElementById('edit-tipo').value = btn.dataset.tipo;
    atualizarLucroEdicao();
};

window.atualizarLucroEdicao = function () {
    const tipo  = document.getElementById('edit-tipo').value;
    const valor = parseFloat(document.getElementById('edit-valor').value) || 0;
    const custo = parseFloat(document.getElementById('edit-custo').value) || 0;
    const lucro = calcularLucro(tipo, valor, custo);
    const campo = document.getElementById('edit-lucroAuto');
    campo.value = formatarMoeda(lucro);
    campo.classList.toggle('negativo', lucro < 0);
};

window.salvarEdicao = async function () {
    const id        = document.getElementById('edit-id').value;
    const tipo      = document.getElementById('edit-tipo').value;
    const descricao = document.getElementById('edit-descricao').value.trim();
    const categoria = document.getElementById('edit-categoria').value;
    const valor     = parseFloat(document.getElementById('edit-valor').value);
    const custo     = parseFloat(document.getElementById('edit-custo').value) || 0;

    if (!descricao || !categoria || !valor || valor <= 0) {
        return showToast('Preencha descrição, categoria e valor.');
    }

    try {
        await updateDoc(doc(db, COL_LANCAMENTOS, id), {
            tipo, descricao, categoria, valor, custo,
            lucro: calcularLucro(tipo, valor, custo),
            atualizadoEm: serverTimestamp()
        });
        fecharEdicao();
        showToast('Lançamento atualizado.');
    } catch (e) {
        console.error('[CAIXA] Erro ao editar:', e);
        showToast('Erro ao salvar alterações.');
    }
};

window.fecharEdicao = function () {
    document.getElementById('modal-edicao').classList.remove('aberto');
};

// ── Filtros / Tipo ────────────────────────────────────────────
window.filtrar = function (btn) {
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    _periodo = btn.dataset.periodo;
    assinarLancamentos();
};

window.selecionarTipo = function (btn) {
    document.querySelectorAll('#bloco-padrao-2 .tipo-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    document.getElementById('tipo').value = btn.dataset.tipo;
    atualizarLucro();
};

window.atualizarLucro = function () {
    const tipo  = document.getElementById('tipo').value;
    const valor = parseFloat(document.getElementById('valor').value) || 0;
    const custo = parseFloat(document.getElementById('custo').value) || 0;
    const lucro = calcularLucro(tipo, valor, custo);

    const campo = document.getElementById('lucroAuto');
    campo.value = formatarMoeda(lucro);
    campo.classList.toggle('negativo', lucro < 0);

    document.getElementById('alertaPrejuizo').style.display = lucro < 0 ? 'block' : 'none';
};

// ── Pesquisa ──────────────────────────────────────────────────
window.pesquisar = function () {
    const termo = document.getElementById('searchInput').value.trim().toLowerCase();
    const painel = document.getElementById('resultados-pesquisa');

    if (!termo) {
        painel.style.display = 'none';
        return;
    }

    const resultados = _ultimosLanc.filter(l =>
        (l.descricao || '').toLowerCase().includes(termo) ||
        (l.categoria || '').toLowerCase().includes(termo)
    );

    painel.style.display = 'block';
    document.getElementById('contador-resultados').textContent = resultados.length;

    const entradas = resultados.filter(l => l.tipo !== 'saida').reduce((s, l) => s + (l.valor || 0), 0);
    const saidas   = resultados.filter(l => l.tipo === 'saida').reduce((s, l) => s + (l.valor || 0), 0);
    document.getElementById('pesq-entradas').textContent = formatarMoeda(entradas);
    document.getElementById('pesq-saidas').textContent   = formatarMoeda(saidas);
    document.getElementById('pesq-saldo').textContent    = formatarMoeda(entradas - saidas);

    document.getElementById('lista-pesquisa').innerHTML = resultados.length
        ? resultados.map(cardLancamento).join('')
        : '<div class="vazio">Nenhum resultado encontrado.</div>';
};

// ── Render ────────────────────────────────────────────────────
function cardLancamento(l) {
    return `
        <div class="lancamento-card tipo-${l.tipo}">
            <div class="lanc-info">
                <div class="lanc-desc">${esc(l.descricao)}</div>
                <div class="lanc-meta">${esc(l.categoria)} · ${l.data}</div>
                ${l.obs ? `<div class="lanc-obs">${esc(l.obs)}</div>` : ''}
            </div>
            <div class="lanc-dir">
                <div class="lanc-valor tipo-${l.tipo}">${formatarMoeda(l.valor)}</div>
                <div class="lanc-acoes">
                    <button onclick="editarLancamento('${l.id}')" title="Editar">✏️</button>
                    <button class="btn-excluir" onclick="excluirLancamento('${l.id}')" title="Excluir">✕</button>
                </div>
            </div>
        </div>`;
}

function renderLista(lancamentos) {
    const el = document.getElementById('lista-lancamentos');
    document.getElementById('contador-lancamentos').textContent = lancamentos.length;
    el.innerHTML = lancamentos.length
        ? lancamentos.map(cardLancamento).join('')
        : '<div class="vazio">Nenhum lançamento neste período.</div>';
}

function renderTotais(lancamentos) {
    const faturamento = lancamentos.filter(l => l.tipo !== 'saida').reduce((s, l) => s + (l.valor || 0), 0);
    const custos       = lancamentos.filter(l => l.tipo !== 'saida').reduce((s, l) => s + (l.custo || 0), 0);
    const lucro        = lancamentos.reduce((s, l) => s + (l.lucro ?? calcularLucro(l.tipo, l.valor, l.custo)), 0);

    document.getElementById('total-faturamento').textContent = formatarMoeda(faturamento);
    document.getElementById('total-custos').textContent      = formatarMoeda(custos);
    document.getElementById('total-lucro').textContent       = formatarMoeda(lucro);
}

// ── Lembretes ─────────────────────────────────────────────────
function assinarLembretes() {
    if (_unsubLembretes) _unsubLembretes();
    const q = query(collection(db, COL_LEMBRETES), where('empresa_id', '==', _empresaId));
    _unsubLembretes = onSnapshot(q, snap => {
        _ultimosLembretes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
        renderLembretes(_ultimosLembretes);
    }, err => console.error('[CAIXA] Erro lembretes:', err));
}

function renderLembretes(lembretes) {
    const badge = document.getElementById('lembretes-badge');
    badge.style.display = lembretes.length ? 'inline-block' : 'none';
    badge.textContent = lembretes.length;

    const hojeStr = hoje();
    const lista = document.getElementById('lista-lembretes');
    lista.innerHTML = lembretes.length ? lembretes.map(l => {
        const vencido = l.vencimento && l.vencimento < hojeStr;
        return `
            <div class="lembrete-item ${vencido ? 'vencido' : ''}">
                <div class="lembrete-info">
                    <div class="desc">${esc(l.fornecedor)} — ${esc(l.descricao)}</div>
                    <div class="meta">${formatarMoeda(l.valor)} ${l.vencimento ? '· vence ' + l.vencimento : ''}</div>
                </div>
                <div class="lembrete-acoes">
                    <button class="btn-pagar-lembrete" onclick="pagarLembrete('${l.id}')">Pagar</button>
                    <button class="btn-excluir-lembrete" onclick="excluirLembrete('${l.id}')">✕</button>
                </div>
            </div>`;
    }).join('') : '<div class="lembretes-vazio">Nenhum lembrete cadastrado.</div>';
}

window.toggleLembretes = function (abrir) {
    document.getElementById('modal-lembretes').classList.toggle('aberto', !!abrir);
};

window.abrirNovoLembrete = function () {
    document.getElementById('modal-novo-lembrete').classList.add('aberto');
};
window.fecharNovoLembrete = function () {
    document.getElementById('modal-novo-lembrete').classList.remove('aberto');
};

window.salvarLembrete = async function () {
    const fornecedor = document.getElementById('lem-fornecedor').value.trim();
    const descricao  = document.getElementById('lem-descricao').value.trim();
    const quantidade = parseInt(document.getElementById('lem-quantidade').value) || 1;
    const valor      = parseFloat(document.getElementById('lem-valor').value);
    const vencimento = document.getElementById('lem-vencimento').value;
    const observacao = document.getElementById('lem-observacao').value.trim();

    if (!fornecedor || !descricao || !valor || valor <= 0) {
        return showToast('Preencha fornecedor, descrição e valor.');
    }

    try {
        await addDoc(collection(db, COL_LEMBRETES), {
            fornecedor, descricao, quantidade, valor, vencimento, observacao,
            empresa_id: _empresaId, criadoEm: serverTimestamp()
        });
        ['lem-fornecedor', 'lem-descricao', 'lem-valor', 'lem-vencimento', 'lem-observacao'].forEach(id => {
            document.getElementById(id).value = '';
        });
        document.getElementById('lem-quantidade').value = 1;
        fecharNovoLembrete();
        showToast('Lembrete salvo.');
    } catch (e) {
        console.error('[CAIXA] Erro ao salvar lembrete:', e);
        showToast('Erro ao salvar lembrete.');
    }
};

window.pagarLembrete = async function (id) {
    const lembrete = _ultimosLembretes.find(l => l.id === id);
    if (!lembrete) return;

    if (!confirm(`Marcar "${lembrete.descricao}" como pago e lançar no Caixa?`)) return;

    try {
        const hojeStr = hoje();
        const dataISO = new Date(hojeStr + 'T12:00:00').toISOString();
        await addDoc(collection(db, COL_LANCAMENTOS), {
            tipo: 'saida', descricao: `${lembrete.fornecedor} — ${lembrete.descricao}`,
            categoria: 'Fornecedores', valor: lembrete.valor, custo: 0,
            lucro: -lembrete.valor, data: hojeStr, dataISO, ano: new Date().getFullYear(),
            obs: lembrete.observacao || '', empresa_id: _empresaId, criadoEm: serverTimestamp()
        });
        await deleteDoc(doc(db, COL_LEMBRETES, id));
        showToast('Lembrete pago e lançado no Caixa.');
    } catch (e) {
        console.error('[CAIXA] Erro ao pagar lembrete:', e);
        showToast('Erro ao pagar lembrete.');
    }
};

window.excluirLembrete = async function (id) {
    if (!confirm('Excluir este lembrete?')) return;
    try {
        await deleteDoc(doc(db, COL_LEMBRETES, id));
    } catch (e) {
        console.error('[CAIXA] Erro ao excluir lembrete:', e);
        showToast('Erro ao excluir lembrete.');
    }
};

// ── Meta semanal ──────────────────────────────────────────────
function numeroSemanaISO(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const jan1 = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - jan1) / 86400000) + 1) / 7);
}

async function carregarMetaSemanal() {
    try {
        const CRESCIMENTO = 1.15;
        const now      = new Date();
        const anoAtual = now.getFullYear();
        const semAtual = numeroSemanaISO(now);

        const snap = await getDocs(query(
            collection(db, COL_LANCAMENTOS),
            where('empresa_id', '==', _empresaId)
        ));

        let realizado = 0;
        const lucroPorAno = {};

        snap.forEach(d => {
            const l = d.data();
            if (!l.dataISO) return;
            const dt = new Date(l.dataISO);
            const ano = dt.getFullYear();
            const sem = numeroSemanaISO(dt);
            const lucro = Number(l.lucro || 0);

            if (ano === anoAtual && sem === semAtual) realizado += lucro;
            if (ano !== anoAtual && sem === semAtual) lucroPorAno[ano] = (lucroPorAno[ano] || 0) + lucro;
        });

        const anosHistorico = Object.keys(lucroPorAno).map(Number).sort((a, b) => b - a);
        let base = 0;
        if (lucroPorAno[anoAtual - 1] > 0) {
            base = lucroPorAno[anoAtual - 1];
        } else if (anosHistorico.length > 0) {
            base = anosHistorico.reduce((s, a) => s + lucroPorAno[a], 0) / anosHistorico.length;
        }
        const meta = base > 0 ? Math.round(base * CRESCIMENTO) : 5000;

        const percent  = Math.min(Math.round((realizado / meta) * 100), 100);
        const faltante = Math.max(meta - realizado, 0);

        document.getElementById('meta-realizado').textContent = formatarMoeda(realizado);
        document.getElementById('meta-meta').textContent      = formatarMoeda(meta);
        document.getElementById('meta-percent').textContent   = `${percent}%`;
        document.getElementById('meta-faltante').textContent  = formatarMoeda(faltante);
    } catch (e) {
        console.warn('[CAIXA] Meta semanal indisponível:', e);
    }
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
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}

function limparForm() {
    document.getElementById('descricao').value = '';
    document.getElementById('categoria').value = '';
    document.getElementById('valor').value     = '';
    document.getElementById('custo').value     = '';
    document.getElementById('obs').value       = '';
    document.getElementById('data').value      = hoje();
    document.getElementById('lucroAuto').value = '';
    document.getElementById('lucroAuto').classList.remove('negativo');
    document.getElementById('alertaPrejuizo').style.display = 'none';
    document.querySelectorAll('#bloco-padrao-2 .tipo-btn').forEach(b => b.classList.remove('ativo'));
    document.querySelector('#bloco-padrao-2 [data-tipo="entrada"]').classList.add('ativo');
    document.getElementById('tipo').value = 'entrada';
}

// ── Start ─────────────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
