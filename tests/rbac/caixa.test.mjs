// Testes de RBAC (Fase 2, Sprint 3 — moduloId 'caixa') — persiste a
// homologação re-executada em 2026-07-07 (ver CRM/TECHDOC.md §7.3).
// Importa CRM/pages/caixa/caixa.js REAL via tests/rbac/loader.mjs.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as fsMock from './mocks/firestore-mock.js';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/caixa/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/caixa/caixa.js')).href;

function setup({ matriz = null, adminLegado = false, iframe = false } = {}) {
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    fsMock.__reset();
    perm.__reset();
    fsMock.__seed('estoque_produtos', 'prod_1', { nome: 'Capinha Teste', categoria: 'Capinha', quantidade: 5, quantidadeMinima: 1, venda: 30, custo: 10 });
    fsMock.__seed('caixa_lancamentos', 'lanc_1', { tipo: 'entrada', descricao: 'Venda teste', categoria: 'Vendas', valor: 100, custo: 40, lucro: 60, data: hoje, dataISO: hoje + 'T12:00:00.000Z', ano: 2026, empresa_id: 'empresa_teste' });
    fsMock.__seed('lembretes_pagamento', 'lemb_1', { fornecedor: 'Fornecedor X', descricao: 'Conta teste', valor: 80, vencimento: hoje, empresa_id: 'empresa_teste' });
    perm.__setMatriz(matriz);
    perm.__setAdminLegado(adminLegado);
    const harness = mountPage(HTML_PATH, '/CRM/pages/caixa/index.html');
    if (iframe) harness.setIframe(true);
    return harness;
}

test('Caixa restrito: form + novo-lembrete ocultos, cards sem editar/excluir, lembretes sem Pagar/excluir', async () => {
    const { document } = setup({ matriz: { caixa: { visualizar: true, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));

    assert.equal(document.getElementById('bloco-padrao-2').style.display, 'none');
    assert.equal(document.querySelector('.btn-novo-lembrete')?.style.display, 'none');
    assert.equal(document.querySelectorAll('.lancamento-card button[onclick^="editarLancamento"]').length, 0);
    assert.equal(document.querySelectorAll('.lancamento-card .btn-excluir').length, 0);
    assert.equal(document.querySelectorAll('.btn-pagar-lembrete').length, 0);
    assert.equal(document.querySelectorAll('.btn-excluir-lembrete').length, 0);
});

test('Caixa matriz total: tudo visível', async () => {
    const { document } = setup({ matriz: { caixa: { visualizar: true, criar: true, editar: true, excluir: true } } });
    await importFresh(MOD_URL);

    // Aguarda até que os lançamentos sejam carregados e renderizados
    let lancCards;
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 100));
        lancCards = document.querySelectorAll('.lancamento-card');
        if (lancCards.length > 0) break;
    }

    assert.notEqual(document.getElementById('bloco-padrao-2').style.display, 'none');
    assert.ok(lancCards.length >= 1, 'pelo menos 1 card de lançamento');
    assert.equal(document.querySelectorAll('.lancamento-card button[onclick^="editarLancamento"]').length, 1);
    assert.equal(document.querySelectorAll('.lancamento-card .btn-excluir').length, 1);
    assert.equal(document.querySelectorAll('.btn-pagar-lembrete').length, 1);
    assert.equal(document.querySelectorAll('.btn-excluir-lembrete').length, 1);
});

test('Caixa não migrado (matriz null): fail-open total', async () => {
    const { document } = setup({ matriz: null });
    await importFresh(MOD_URL);

    assert.notEqual(document.getElementById('bloco-padrao-2').style.display, 'none');
});

test('Caixa visualizar:false em janela principal: redirect para o Dashboard', async () => {
    const harness = setup({ matriz: { caixa: { visualizar: false, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);

    assert.match(harness.getCapturedHref(), /dashboard\/index\.html/);
});

test('Caixa admin legado: bypass total independente da matriz', async () => {
    const { document } = setup({ matriz: { caixa: { visualizar: false, criar: false, editar: false, excluir: false } }, adminLegado: true });
    await importFresh(MOD_URL);

    assert.notEqual(document.getElementById('bloco-padrao-2').style.display, 'none');
});

test('Caixa: venda com estoque.* 100% negado ainda cria lançamento E baixa o estoque (integração Estoque↔Caixa preservada)', async () => {
    const { document, window } = setup({
        matriz: {
            caixa: { visualizar: true, criar: true, editar: true, excluir: true },
            estoque: { visualizar: false, criar: false, editar: false, excluir: false }
        }
    });
    await importFresh(MOD_URL);

    document.getElementById('tipo').value = 'entrada';
    document.getElementById('descricao').value = 'Capinha Teste'; // match exato no cache -> auto-vincula
    document.getElementById('categoria').value = 'Vendas';
    document.getElementById('valor').value = '50';
    document.getElementById('custo').value = '20';
    document.getElementById('data').value = '2026-07-07';
    document.getElementById('obs').value = '';

    await window.salvarLancamento();
    await new Promise(r => setTimeout(r, 60));

    const lancamentos = await fsMock.getDocs(fsMock.collection(null, 'caixa_lancamentos'));
    assert.equal(lancamentos.docs.length, 2); // 1 semeado + 1 novo

    const prod = fsMock.__raw('estoque_produtos', 'prod_1');
    assert.equal(prod.quantidade, 4); // 5 -> 4, baixa executada sem checagem de permissão de estoque
});

test('Caixa: visualizar:false DENTRO de iframe simulado — sem redirect, boot abortado (previne loop com o Dashboard)', async () => {
    const harness = setup({ matriz: { caixa: { visualizar: false, criar: false, editar: false, excluir: false } }, iframe: true });
    await importFresh(MOD_URL);

    const href = harness.getCapturedHref();
    assert.ok(!href || !/dashboard/.test(href));
    const sel = harness.document.getElementById('categoria');
    assert.equal(sel.children.length, 1);
    assert.equal(sel.children[0].textContent, 'Carregando...');
});
