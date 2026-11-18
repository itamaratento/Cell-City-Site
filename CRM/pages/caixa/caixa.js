import { URLS } from '../../shared/app-config.js';
import { db, collection, query, where, orderBy, getDocs, getDoc, addDoc, deleteDoc, updateDoc, doc, setDoc, onSnapshot, serverTimestamp } from '../../scripts/firebase.js';
import { initModulo } from '../../scripts/kernel.js';
import { carregarPermissoes, podeVisualizar, podeCriar, podeEditar, podeExcluir } from '../../shared/permissoes.js';
import { escHtml as esc } from '../../shared/sanitize.js';
import { injectTenantFilter, tData } from '../../shared/tenant-query.js';
import {
    LOCAL_LOJA,
    LOCAL_FEIRA,
    labelLocal,
    normalizarLocal,
    precoSugerido,
    totaisPorLocal,
    breakdownLocais,
} from './loja-feira.js';
import {
    camposDataLancamento,
    normalizarCategoriaCaixa,
    chaveCategoriaCaixa,
    dedupeCategoriasCaixa,
} from './caixa-data.js';
import {
    buscarProdutosPorNome,
    montarPayloadVendaRapida,
    parseVendasFeiraTexto,
} from './venda-rapida.js';

// ── Constantes ────────────────────────────────────────────────
const COL_LANCAMENTOS = 'caixa_lancamentos';
const COL_CATEGORIAS  = 'categorias_caixa';
const COL_LEMBRETES   = 'lembretes_pagamento';
const COL_ESTOQUE     = 'estoque_produtos';
const CATEGORIAS_PADRAO = [
    { nome: 'Vendas',       tipo: 'entrada' },
    { nome: 'Serviços',     tipo: 'servico' },
    { nome: 'Fornecedores', tipo: 'saida'   },
    { nome: 'Despesas',     tipo: 'saida'   },
    { nome: 'Marketing',    tipo: 'saida'   },
];

// ── Estado ────────────────────────────────────────────────────
let _empresaId       = null;
let _periodo         = 'hoje';
let _localFiltro     = 'todos'; // todos | loja | feira
let _unsubLanc       = null;
let _unsubLembretes  = null;
let _ultimosLanc     = [];
let _ultimosLembretes = [];
let _produtoVinculado = null;  // { id, nome, custo, venda, vendaFeira, quantidade }
let _cacheProdutos   = [];
let _vendaPendente   = null;   // dados do form aguardando cadastro de produto
let _confirmResolve  = null;
let _vrProduto       = null;   // produto selecionado na venda rápida
let _feiraPrevia     = null;   // linhas ok da prévia de importação Feira

/** Substitui diálogos nativos do browser (travam automação) por modal na página. */
function confirmarCaixa(titulo, corpo, txtBtn = 'Confirmar') {
    return new Promise((resolve) => {
        _confirmResolve = resolve;
        document.getElementById('confirm-titulo').textContent = titulo;
        document.getElementById('confirm-body').textContent = corpo;
        document.getElementById('confirm-prompt-wrap').style.display = 'none';
        document.getElementById('confirm-ok').textContent = txtBtn;
        document.getElementById('confirm-ok').onclick = () => _fecharConfirm(true);
        document.getElementById('modal-confirm').classList.add('aberto');
    });
}

function promptCaixa(titulo, corpo, placeholder = '') {
    return new Promise((resolve) => {
        _confirmResolve = (ok) => {
            if (!ok) return resolve(null);
            resolve(document.getElementById('confirm-prompt-input').value);
        };
        document.getElementById('confirm-titulo').textContent = titulo;
        document.getElementById('confirm-body').textContent = corpo || '';
        const wrap = document.getElementById('confirm-prompt-wrap');
        wrap.style.display = 'block';
        const inp = document.getElementById('confirm-prompt-input');
        inp.value = '';
        inp.placeholder = placeholder;
        document.getElementById('confirm-ok').textContent = 'OK';
        document.getElementById('confirm-ok').onclick = () => _fecharConfirm(true);
        document.getElementById('modal-confirm').classList.add('aberto');
        setTimeout(() => inp.focus(), 50);
    });
}

window._fecharConfirm = function (ok) {
    document.getElementById('modal-confirm').classList.remove('aberto');
    const r = _confirmResolve;
    _confirmResolve = null;
    if (r) r(ok);
};

// ── Boot ──────────────────────────────────────────────────────
async function init() {
    const ctx = await initModulo();
    if (!ctx) return;
    _empresaId = ctx.empresaId;
    console.log('[CAIXA] empresa_id:', _empresaId);

    // RBAC (Fase 2, Sprint 3 — moduloId 'caixa'). O Dashboard carrega esta
    // página em iframe invisível (_verificarFechamentoCaixa); redirecionar
    // dentro do iframe criaria loop dashboard→caixa→dashboard→... — por isso
    // o redirect só acontece na janela principal; no iframe, apenas não boota.
    await carregarPermissoes(ctx);
    if (!podeVisualizar('caixa')) {
        if (window.self === window.top) window.location.href = URLS.dashboard();
        return;
    }
    if (!podeCriar('caixa')) {
        const form = document.getElementById('bloco-padrao-2');
        if (form) form.style.display = 'none';
        document.querySelector('.btn-novo-lembrete')?.style.setProperty('display', 'none');
    }

    try { document.getElementById('data').value = hoje(); } catch {}
    await carregarCategorias();
    assinarLancamentos();
    assinarLembretes();
    carregarMetaSemanal();
    _cacheProdutos = await carregarProdutosEstoque();
    setupAutocomplete();
    setupVendaRapida();
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

        const valorAtual = normalizarCategoriaCaixa(sel.value) || sel.value;
        // Deduplica DESPESAS/Despesas, VENDAS/Vendas etc. só no select — não regrava o banco.
        const catsUnicas = dedupeCategoriasCaixa(cats.filter(c => c.status !== 'inativo'));
        sel.innerHTML = '<option value="">Selecione...</option>' +
            catsUnicas
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
    const nome = await promptCaixa('Nova categoria', 'Nome da nova categoria:', 'Ex: Acessórios');
    if (!nome || !nome.trim()) return;
    const nomeFmt = normalizarCategoriaCaixa(nome.trim()) || nome.trim();
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
        aplicarFiltrosRender();
    }, err => {
        console.error('[CAIXA] Erro listener:', err);
        document.getElementById('lista-lancamentos').innerHTML =
            '<div class="erro">Erro ao carregar lançamentos.</div>';
    });
}

function listaComFiltroLocal() {
    if (_localFiltro === 'todos') return _ultimosLanc;
    return _ultimosLanc.filter(l => normalizarLocal(l.localVenda) === _localFiltro);
}

function aplicarFiltrosRender() {
    const lista = listaComFiltroLocal();
    renderLista(lista);
    renderTotais(_ultimosLanc, lista);
}

function calcularLucro(tipo, valor, custo) {
    const v = valor || 0, c = custo || 0;
    return tipo === 'saida' ? -(v - c) : (v - c);
}

// ── Salvar ────────────────────────────────────────────────────
window.salvarLancamento = async function () {
    const tipo      = document.getElementById('tipo').value;
    const descricao = document.getElementById('descricao').value.trim();
    const categoria = normalizarCategoriaCaixa(document.getElementById('categoria').value) || document.getElementById('categoria').value;
    const valor     = parseFloat(document.getElementById('valor').value);
    const custo     = parseFloat(document.getElementById('custo').value) || 0;
    const data      = document.getElementById('data').value;
    const obs       = document.getElementById('obs').value.trim();
    const localVenda = normalizarLocal(document.getElementById('local-venda')?.value);

    if (!descricao) return showToast('Informe a descrição.');
    if (!categoria) return showToast('Selecione uma categoria.');
    if (!valor || valor <= 0) return showToast('Informe o valor.');
    if (!data) return showToast('Informe a data.');
    if (tipo !== 'saida' && !document.getElementById('local-venda')?.value) {
        return showToast('Selecione o local da venda.');
    }

    // Auto-vincular produto se nome exato bater no cache
    if (!_produtoVinculado && tipo !== 'saida') {
        const nomeLower = descricao.toLowerCase();
        const encontrado = _cacheProdutos.find(p => (p.nome || '').toLowerCase() === nomeLower);
        if (encontrado) _produtoVinculado = encontrado;
    }

    // Produto não encontrado → perguntar se quer cadastrar (só para vendas)
    if (!_produtoVinculado && tipo === 'entrada') {
        const nomeLower = descricao.toLowerCase();
        const existe = _cacheProdutos.some(p => (p.nome || '').toLowerCase().includes(nomeLower));
        if (!existe) {
            const cadastrar = await confirmarCaixa(
                'Produto não encontrado',
                `Produto "${descricao}" não encontrado no estoque.\nDeseja cadastrar agora?`,
                'Cadastrar'
            );
            if (cadastrar) {
                _vendaPendente = { tipo, descricao, categoria, valor, custo, data, obs, localVenda };
                abrirModalNovoProduto(descricao, valor, custo);
                return;
            }
        }
    }

    const btn = document.querySelector('#bloco-padrao-2 .btn-salvar');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        await _executarSalvamento({ tipo, descricao, categoria, valor, custo, data, obs, localVenda });
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
    const ok = await confirmarCaixa('Excluir lançamento', 'Excluir este lançamento?', 'Excluir');
    if (!ok) return;
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
    const editLocal = document.getElementById('edit-local-venda');
    if (editLocal) editLocal.value = normalizarLocal(l.localVenda);

    document.querySelectorAll('#modal-edicao .tipo-btn').forEach(b => {
        b.classList.toggle('ativo', b.dataset.tipo === l.tipo);
    });

    carregarCategorias('edit-categoria').then(() => {
        const catCanon = normalizarCategoriaCaixa(l.categoria) || l.categoria || '';
        document.getElementById('edit-categoria').value = catCanon;
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
    const catSel    = document.getElementById('edit-categoria').value;
    const valor     = parseFloat(document.getElementById('edit-valor').value);
    const custo     = parseFloat(document.getElementById('edit-custo').value) || 0;
    const localVenda = normalizarLocal(document.getElementById('edit-local-venda')?.value);

    if (!descricao || !catSel || !valor || valor <= 0) {
        return showToast('Preencha descrição, categoria e valor.');
    }

    const existente = _ultimosLanc.find(x => x.id === id);
    // Não regrava categoria antiga se for só variação maiúsc./plural do mesmo canônico.
    const catOld = existente?.categoria || '';
    const categoria = (catOld && chaveCategoriaCaixa(catSel) === chaveCategoriaCaixa(catOld))
        ? catOld
        : (normalizarCategoriaCaixa(catSel) || catSel);
    const dataRef = existente?.data || existente?.dia || hoje();
    let camposData;
    try {
        camposData = camposDataLancamento(dataRef);
    } catch (e) {
        console.error('[CAIXA] Data inválida na edição:', e);
        return showToast('Data do lançamento inválida.');
    }

    try {
        await updateDoc(doc(db, COL_LANCAMENTOS, id), {
            tipo, descricao, categoria, valor, custo, localVenda,
            lucro: calcularLucro(tipo, valor, custo),
            data: camposData.dia,
            ...camposData,
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

window.filtrarLocal = function (btn) {
    document.querySelectorAll('.filtro-local-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    _localFiltro = btn.dataset.local || 'todos';
    aplicarFiltrosRender();
};

window.aoMudarLocalVenda = function () {
    if (!_produtoVinculado) return;
    const local = normalizarLocal(document.getElementById('local-venda')?.value);
    const sugerido = precoSugerido(_produtoVinculado, local);
    if (sugerido > 0) {
        document.getElementById('valor').value = sugerido;
        atualizarLucro();
    }
};

window.selecionarTipo = function (btn) {
    document.querySelectorAll('#bloco-padrao-2 .tipo-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    document.getElementById('tipo').value = btn.dataset.tipo;
    const campoLocal = document.getElementById('campo-local-venda');
    if (campoLocal) campoLocal.style.display = btn.dataset.tipo === 'saida' ? 'none' : '';
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
    const lucro = l.lucro ?? calcularLucro(l.tipo, l.valor, l.custo);
    // Para entradas/serviços: mostra lucro líquido; para saídas: mostra valor (despesa)
    const valorExibido = l.tipo === 'saida' ? l.valor : lucro;
    const temCusto = l.tipo !== 'saida' && (l.custo || 0) > 0;
    const localTxt = l.tipo === 'saida' ? '' : ` · ${labelLocal(normalizarLocal(l.localVenda))}`;
    return `
        <div class="lancamento-card tipo-${l.tipo}">
            <div class="lanc-info">
                <div class="lanc-desc">${esc(l.descricao)}</div>
                <div class="lanc-meta">${esc(normalizarCategoriaCaixa(l.categoria) || l.categoria || '')} · ${l.data}${localTxt}</div>
                ${temCusto ? `<div class="lanc-bruto">💵 bruto: ${formatarMoeda(l.valor)}</div>` : ''}
                ${l.obs ? `<div class="lanc-obs">${esc(l.obs)}</div>` : ''}
            </div>
            <div class="lanc-dir">
                <div class="lanc-valor tipo-${l.tipo}">${formatarMoeda(valorExibido)}</div>
                <div class="lanc-acoes">
                    ${podeEditar('caixa')  ? `<button onclick="editarLancamento('${l.id}')" title="Editar">✏️</button>` : ''}
                    ${podeExcluir('caixa') ? `<button class="btn-excluir" onclick="excluirLancamento('${l.id}')" title="Excluir">✕</button>` : ''}
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

/** `listaFiltrada` = período + local; `listaPeriodo` = só período (para breakdown). */
function renderTotais(listaPeriodo, listaFiltrada) {
    const lista = listaFiltrada || listaPeriodo || [];
    const t = totaisPorLocal(lista, 'todos');
    document.getElementById('total-faturamento').textContent = formatarMoeda(t.vendido);
    document.getElementById('total-custos').textContent      = formatarMoeda(t.custo);
    document.getElementById('total-lucro').textContent       = formatarMoeda(t.lucro);

    const box = document.getElementById('totais-por-local');
    if (!box) return;
    if (_localFiltro !== 'todos') {
        box.innerHTML = `<div>Filtro: <strong>${_localFiltro === LOCAL_FEIRA ? 'Feira da Marreta' : 'Loja Cell City'}</strong></div>`;
        return;
    }
    const bd = breakdownLocais(listaPeriodo || []);
    box.innerHTML = `
      <div>🏪 <strong>Loja</strong> — vendido ${formatarMoeda(bd.loja.vendido)} · custo ${formatarMoeda(bd.loja.custo)} · lucro ${formatarMoeda(bd.loja.lucro)}</div>
      <div>🎪 <strong>Feira</strong> — vendido ${formatarMoeda(bd.feira.vendido)} · custo ${formatarMoeda(bd.feira.custo)} · lucro ${formatarMoeda(bd.feira.lucro)}</div>`;
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
                    ${podeCriar('caixa')   ? `<button class="btn-pagar-lembrete" onclick="pagarLembrete('${l.id}')">Pagar</button>` : ''}
                    ${podeExcluir('caixa') ? `<button class="btn-excluir-lembrete" onclick="excluirLembrete('${l.id}')">✕</button>` : ''}
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

    const okPagar = await confirmarCaixa(
        'Pagar lembrete',
        `Marcar "${lembrete.descricao}" como pago e lançar no Caixa?`,
        'Pagar'
    );
    if (!okPagar) return;

    try {
        const hojeStr = hoje();
        const camposData = camposDataLancamento(hojeStr);
        await addDoc(collection(db, COL_LANCAMENTOS), {
            tipo: 'saida', descricao: `${lembrete.fornecedor} — ${lembrete.descricao}`,
            categoria: 'Fornecedores', valor: lembrete.valor, custo: 0,
            lucro: -lembrete.valor,
            localVenda: LOCAL_LOJA,
            data: camposData.dia,
            ...camposData,
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
    const okEx = await confirmarCaixa('Excluir lembrete', 'Excluir este lembrete?', 'Excluir');
    if (!okEx) return;
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
    const localEl = document.getElementById('local-venda');
    if (localEl) localEl.value = LOCAL_LOJA;
    const campoLocal = document.getElementById('campo-local-venda');
    if (campoLocal) campoLocal.style.display = '';
    document.getElementById('lucroAuto').value = '';
    document.getElementById('lucroAuto').classList.remove('negativo');
    document.getElementById('alertaPrejuizo').style.display = 'none';
    document.querySelectorAll('#bloco-padrao-2 .tipo-btn').forEach(b => b.classList.remove('ativo'));
    document.querySelector('#bloco-padrao-2 [data-tipo="entrada"]').classList.add('ativo');
    document.getElementById('tipo').value = 'entrada';
    // Limpar produto vinculado
    _produtoVinculado = null;
    document.getElementById('produto-badge').classList.remove('visivel');
    document.getElementById('qty-venda').value = '1';
}

// ── Estoque: carregar cache ────────────────────────────────────
async function carregarProdutosEstoque() {
    try {
        const snap = await getDocs(query(collection(db, COL_ESTOQUE), ...injectTenantFilter([])));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch { return []; }
}

// ── Estoque: autocomplete ──────────────────────────────────────
function setupAutocomplete() {
    const inp  = document.getElementById('descricao');
    const drop = document.getElementById('autocomplete-estoque');
    if (!inp || !drop) return;

    inp.addEventListener('input', () => {
        const tipo  = document.getElementById('tipo').value;
        const termo = inp.value.trim().toLowerCase();
        if (termo.length < 2 || tipo === 'saida') { drop.style.display = 'none'; return; }

        const matches = _cacheProdutos
            .filter(p => (p.nome || '').toLowerCase().includes(termo))
            .slice(0, 8);

        if (!matches.length) { drop.style.display = 'none'; return; }

        const local = normalizarLocal(document.getElementById('local-venda')?.value);
        drop.innerHTML = matches.map(p => {
            const zerado = p.quantidade <= 0;
            const baixo  = !zerado && p.quantidade <= (p.quantidadeMinima || 1);
            const cls    = zerado ? 'ac-zerado' : baixo ? 'ac-baixo' : '';
            const qtyTxt = zerado ? 'Estoque zerado' : `Estoque: ${p.quantidade}`;
            const preco  = precoSugerido(p, local);
            return `<div class="autocomplete-item ${cls}"
                         data-id="${p.id}" data-nome="${esc(p.nome)}"
                         data-custo="${p.custo || 0}" data-venda="${p.venda || 0}"
                         data-venda-feira="${p.vendaFeira || 0}"
                         data-qty="${p.quantidade || 0}">
                        <span class="ac-nome">${esc(p.nome)}</span>
                        <span class="ac-info">${qtyTxt} · ${formatarMoeda(preco)}</span>
                    </div>`;
        }).join('');
        drop.style.display = 'block';

        drop.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('mousedown', e => {
                e.preventDefault();
                vincularProduto({
                    id:         item.dataset.id,
                    nome:       item.dataset.nome,
                    custo:      parseFloat(item.dataset.custo) || 0,
                    venda:      parseFloat(item.dataset.venda) || 0,
                    vendaFeira: parseFloat(item.dataset.vendaFeira) || 0,
                    quantidade: parseInt(item.dataset.qty)    || 0
                });
                drop.style.display = 'none';
            });
        });
    });

    inp.addEventListener('blur', () => setTimeout(() => { drop.style.display = 'none'; }, 150));
    inp.addEventListener('focus', () => {
        if (inp.value.trim().length >= 2) inp.dispatchEvent(new Event('input'));
    });
}

function vincularProduto(p) {
    _produtoVinculado = p;
    document.getElementById('descricao').value = p.nome;
    document.getElementById('custo').value     = p.custo > 0 ? p.custo : '';
    const local = normalizarLocal(document.getElementById('local-venda')?.value);
    const sugerido = precoSugerido(p, local);
    // Sempre aplica o preço do local ao vincular (fluxo Loja × Feira)
    if (sugerido > 0) document.getElementById('valor').value = sugerido;
    atualizarLucro();

    const badge = document.getElementById('produto-badge');
    document.getElementById('produto-badge-nome').textContent =
        `📦 ${p.nome}${p.quantidade <= 0 ? ' — ⚠️ Sem estoque' : ` — ${p.quantidade} un.`}`;
    badge.classList.add('visivel');
}

window.desvinculaProduto = function () {
    _produtoVinculado = null;
    document.getElementById('produto-badge').classList.remove('visivel');
    document.getElementById('descricao').value = '';
    document.getElementById('custo').value     = '';
    document.getElementById('qty-venda').value = '1';
    atualizarLucro();
    document.getElementById('descricao').focus();
};

// ── Estoque: operações ─────────────────────────────────────────
async function descontarEstoqueLocal(produtoId, qty) {
    try {
        const snap = await getDoc(doc(db, COL_ESTOQUE, produtoId));
        if (!snap.exists()) return;
        const prod    = snap.data();
        const novaQtd = Math.max((prod.quantidade || 0) - qty, 0);
        await setDoc(doc(db, COL_ESTOQUE, produtoId), { ...prod, quantidade: novaQtd, atualizadoEm: serverTimestamp() });
        const idx = _cacheProdutos.findIndex(p => p.id === produtoId);
        if (idx >= 0) _cacheProdutos[idx].quantidade = novaQtd;
        if (novaQtd === 0)
            showToast(`⚠️ Estoque zerado: ${prod.nome}`);
        else if (novaQtd <= (prod.quantidadeMinima || 1))
            showToast(`⚠️ Estoque mínimo: ${prod.nome} (${novaQtd} un.)`);
    } catch (e) { console.error('[CAIXA] Erro descontar estoque:', e); }
}

async function incrementarEstoqueLocal(produtoId, qty, valorTotal) {
    try {
        const snap = await getDoc(doc(db, COL_ESTOQUE, produtoId));
        if (!snap.exists()) return;
        const prod        = snap.data();
        const qtdAtual    = prod.quantidade || 0;
        const custoAtual  = prod.custo      || 0;
        const custoUnit   = qty > 0 ? valorTotal / qty : 0;
        const novaQtd     = qtdAtual + qty;
        const novoCusto   = novaQtd > 0
            ? (qtdAtual * custoAtual + qty * custoUnit) / novaQtd
            : custoUnit;
        await setDoc(doc(db, COL_ESTOQUE, produtoId), { ...prod, quantidade: novaQtd, custo: novoCusto, atualizadoEm: serverTimestamp() });
        const idx = _cacheProdutos.findIndex(p => p.id === produtoId);
        if (idx >= 0) { _cacheProdutos[idx].quantidade = novaQtd; _cacheProdutos[idx].custo = novoCusto; }
        showToast(`✅ Estoque atualizado: ${prod.nome} (+${qty} un.)`);
    } catch (e) { console.error('[CAIXA] Erro incrementar estoque:', e); }
}

// ── Modal novo produto ─────────────────────────────────────────
function abrirModalNovoProduto(nome, valorVenda, custoSugerido) {
    document.getElementById('np-nome').value  = nome || '';
    document.getElementById('np-custo').value = custoSugerido > 0 ? custoSugerido : '';
    document.getElementById('np-venda').value = valorVenda > 0    ? valorVenda    : '';
    const npFeira = document.getElementById('np-venda-feira');
    if (npFeira) npFeira.value = '';
    document.getElementById('np-qty').value   = '0';
    document.getElementById('modal-novo-produto').classList.add('aberto');
    setTimeout(() => document.getElementById('np-nome').focus(), 100);
}

window.fecharModalNovoProduto = function () {
    document.getElementById('modal-novo-produto').classList.remove('aberto');
    _vendaPendente = null;
};

window.salvarNovoProduto = async function () {
    const nome  = document.getElementById('np-nome').value.trim();
    const cat   = document.getElementById('np-cat').value;
    const qty   = parseInt(document.getElementById('np-qty').value)    || 0;
    const custo = parseFloat(document.getElementById('np-custo').value) || 0;
    const venda = parseFloat(document.getElementById('np-venda').value) || 0;
    const vendaFeira = parseFloat(document.getElementById('np-venda-feira')?.value) || 0;

    if (!nome) return showToast('Informe o nome do produto.');

    const id = `prod_${Date.now()}`;
    try {
        await setDoc(doc(db, COL_ESTOQUE, id), tData({
            nome, categoria: cat, quantidade: qty, quantidadeMinima: 1,
            venda, vendaFeira, custo, atualizadoEm: serverTimestamp()
        }));
        const novoProd = { id, nome, custo, venda, vendaFeira, quantidade: qty };
        _cacheProdutos.push(novoProd);
        _produtoVinculado = novoProd;

        document.getElementById('modal-novo-produto').classList.remove('aberto');
        showToast('Produto cadastrado! Finalizando venda...');

        if (_vendaPendente) {
            const dados = { ..._vendaPendente };
            _vendaPendente = null;
            await _executarSalvamento(dados);
        }
    } catch (e) {
        console.error('[CAIXA] Erro ao cadastrar produto:', e);
        showToast('Erro ao cadastrar produto.');
    }
};

// ── Core: salvar lançamento no Firestore + estoque ─────────────
async function _executarSalvamento({ tipo, descricao, categoria, valor, custo, data, obs, localVenda }) {
    const camposData = camposDataLancamento(data);
    const local = tipo === 'saida' ? LOCAL_LOJA : normalizarLocal(localVenda);
    await addDoc(collection(db, COL_LANCAMENTOS), {
        tipo, descricao, categoria, valor, custo,
        localVenda: local,
        lucro: calcularLucro(tipo, valor, custo),
        data: camposData.dia,
        ...camposData,
        obs, empresa_id: _empresaId, criadoEm: serverTimestamp()
    });

    const qty = parseInt(document.getElementById('qty-venda')?.value) || 1;
    if (_produtoVinculado) {
        if (tipo === 'entrada' || tipo === 'servico') {
            await descontarEstoqueLocal(_produtoVinculado.id, qty);
        } else if (tipo === 'saida' && categoria === 'Fornecedores') {
            await incrementarEstoqueLocal(_produtoVinculado.id, qty, valor);
        }
    }

    _produtoVinculado = null;
    _vendaPendente    = null;
    limparForm();
    showToast('Lançamento salvo.');
    console.log('[CAIXA] Lançamento salvo.');
}

// ── Venda rápida ───────────────────────────────────────────────
function setupVendaRapida() {
    const inp = document.getElementById('vr-busca');
    const drop = document.getElementById('vr-autocomplete');
    if (!inp || !drop) return;
    inp.addEventListener('input', () => {
        const termo = inp.value.trim();
        const matches = buscarProdutosPorNome(_cacheProdutos, termo, 10);
        if (!matches.length) { drop.style.display = 'none'; return; }
        const local = normalizarLocal(document.getElementById('vr-local')?.value);
        drop.innerHTML = matches.map(p => {
            const preco = precoSugerido(p, local);
            return `<div class="autocomplete-item" data-id="${esc(p.id)}">
                <span class="ac-nome">${esc(p.nome || '')}</span>
                <span class="ac-info">${p.quantidade || 0} un · ${formatarMoeda(preco)}</span>
            </div>`;
        }).join('');
        drop.style.display = 'block';
        drop.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('mousedown', e => {
                e.preventDefault();
                const p = _cacheProdutos.find(x => x.id === item.dataset.id);
                if (!p) return;
                _vrProduto = p;
                inp.value = p.nome || '';
                const sel = document.getElementById('vr-produto-sel');
                if (sel) {
                    sel.style.display = 'block';
                    const loc = normalizarLocal(document.getElementById('vr-local')?.value);
                    sel.textContent = `📦 ${p.nome} · ${formatarMoeda(precoSugerido(p, loc))} · estoque ${p.quantidade || 0}`;
                }
                drop.style.display = 'none';
            });
        });
    });
    inp.addEventListener('blur', () => setTimeout(() => { drop.style.display = 'none'; }, 150));
    document.getElementById('vr-local')?.addEventListener('change', () => {
        if (!_vrProduto) return;
        const sel = document.getElementById('vr-produto-sel');
        const loc = normalizarLocal(document.getElementById('vr-local')?.value);
        if (sel) sel.textContent = `📦 ${_vrProduto.nome} · ${formatarMoeda(precoSugerido(_vrProduto, loc))} · estoque ${_vrProduto.quantidade || 0}`;
    });
}

window.salvarVendaRapida = async function () {
    if (!podeCriar('caixa')) return showToast('Sem permissão.');
    try {
        const payload = montarPayloadVendaRapida({
            produto: _vrProduto,
            local: document.getElementById('vr-local')?.value,
            quantidade: document.getElementById('vr-qty')?.value,
            dataYYYYMMDD: hoje(),
        });
        _produtoVinculado = _vrProduto;
        const qtyEl = document.getElementById('qty-venda');
        if (qtyEl) qtyEl.value = String(payload.quantidade);
        await _executarSalvamento(payload);
        _vrProduto = null;
        const inp = document.getElementById('vr-busca');
        if (inp) inp.value = '';
        const sel = document.getElementById('vr-produto-sel');
        if (sel) { sel.style.display = 'none'; sel.textContent = ''; }
        const q = document.getElementById('vr-qty');
        if (q) q.value = '1';
        showToast('⚡ Venda rápida salva.');
    } catch (e) {
        showToast(e.message || 'Erro na venda rápida.');
    }
};

window.preverImportFeira = function () {
    const texto = document.getElementById('feira-import-texto')?.value || '';
    const { ok, erros } = parseVendasFeiraTexto(texto);
    _feiraPrevia = ok;
    const box = document.getElementById('feira-import-previa');
    const btn = document.getElementById('btn-gravar-feira');
    if (!box) return;
    if (!ok.length && !erros.length) {
        box.innerHTML = 'Cole ao menos uma linha.';
        if (btn) btn.style.display = 'none';
        return;
    }
    const total = ok.reduce((s, l) => s + l.valor, 0);
    let html = `<strong>${ok.length} venda(s)</strong> · total ${formatarMoeda(total)} (local: Feira)<ul style="margin:8px 0 0;padding-left:18px;">`;
    ok.forEach(l => {
        html += `<li>${esc(l.descricao)} — ${formatarMoeda(l.valor)}</li>`;
    });
    html += '</ul>';
    if (erros.length) {
        html += `<div style="color:var(--red,#ef4444);margin-top:8px;">${erros.map(esc).join('<br>')}</div>`;
    }
    box.innerHTML = html;
    if (btn) btn.style.display = ok.length ? '' : 'none';
};

window.gravarImportFeira = async function () {
    if (!podeCriar('caixa')) return showToast('Sem permissão.');
    if (!_feiraPrevia || !_feiraPrevia.length) return showToast('Gere a prévia antes.');
    const okConf = await confirmarCaixa(
        'Importar Feira',
        `Gravar ${_feiraPrevia.length} venda(s) no Caixa (local Feira)?`,
        'Gravar'
    );
    if (!okConf) return;
    const data = hoje();
    let gravados = 0;
    try {
        for (const linha of _feiraPrevia) {
            const camposData = camposDataLancamento(data);
            await addDoc(collection(db, COL_LANCAMENTOS), {
                tipo: 'entrada',
                descricao: linha.descricao,
                categoria: 'Vendas',
                valor: linha.valor,
                custo: 0,
                lucro: linha.valor,
                localVenda: LOCAL_FEIRA,
                data: camposData.dia,
                ...camposData,
                obs: linha.obs || 'Importado da Feira',
                empresa_id: _empresaId,
                criadoEm: serverTimestamp(),
            });
            // Tenta vincular estoque pelo nome (baixa 1×qty se achar)
            const prod = _cacheProdutos.find(p =>
                String(p.nome || '').toLowerCase() === String(linha.nomeProduto || '').toLowerCase()
            );
            if (prod?.id) {
                try { await descontarEstoqueLocal(prod.id, linha.quantidade || 1); } catch (_) {}
            }
            gravados++;
        }
        _feiraPrevia = null;
        const btn = document.getElementById('btn-gravar-feira');
        if (btn) btn.style.display = 'none';
        const ta = document.getElementById('feira-import-texto');
        if (ta) ta.value = '';
        const box = document.getElementById('feira-import-previa');
        if (box) box.innerHTML = `✅ ${gravados} venda(s) gravadas na Feira.`;
        showToast(`✅ ${gravados} vendas importadas`);
    } catch (e) {
        console.error('[CAIXA] import Feira:', e);
        showToast('Erro ao gravar importação.');
    }
};

// ── Start ─────────────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
