// Testes do módulo Fornecedor — CRM/pages/fornecedor/.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as fsMock from './mocks/firestore-mock.js';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/fornecedor/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/fornecedor/fornecedor.js')).href;

function setup(matriz) {
    fsMock.__reset();
    perm.__reset();
    fsMock.__seed('fornecedores_cadastro', 'f1', { nome: 'Distribuidora A', contato: 'João', telefone1: '(62) 99999-0001', email: 'joao@dist.com', cnpj: '00.000.000/0001-01', obs: '' });
    fsMock.__seed('fornecedor_compras', 'c1', { nome: 'Fone Bluetooth', quantidade: 5, urgencia: 'alta', obs: '' });
    fsMock.__seed('estoque_produtos', 'e1', { nome: 'Cabo USB', quantidade: 2, quantidadeMinima: 5, categoria: 'Cabo' });
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/fornecedor/index.html');
}

test('Fornecedor cadastro: renderiza fornecedores seeded', async () => {
    const { document } = setup({ fornecedor: { visualizar: true, criar: true, editar: true, excluir: true } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));

    const tab = document.querySelector('[data-tab="fornecedores"]');
    assert.ok(tab);
    tab.click();
    await new Promise(r => setTimeout(r, 100));

    const cards = document.querySelectorAll('#forn-lista .forn-card');
    assert.equal(cards.length, 1);
    assert.ok(cards[0].textContent.includes('Distribuidora A'));
});

test('Fornecedor compras: renderiza itens da lista', async () => {
    const { document } = setup({ fornecedor: { visualizar: true, criar: true, editar: true, excluir: true } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));

    const cards = document.querySelectorAll('.forn-card');
    assert.ok(cards.length >= 1);
});

test('Fornecedor estoque baixo: renderiza alertas', async () => {
    const { document } = setup({ fornecedor: { visualizar: true, criar: true, editar: true, excluir: true } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));

    const tab = document.querySelector('[data-tab="estoque-baixo"]');
    assert.ok(tab);
    tab.click();
    await new Promise(r => setTimeout(r, 100));

    const alertas = document.querySelectorAll('.forn-card-alerta');
    assert.equal(alertas.length, 1);
});

test('Fornecedor visualizar:false: redirect', async () => {
    const harness = setup({ fornecedor: { visualizar: false, criar: false, editar: false, excluir: false } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));
    assert.match(harness.getCapturedHref(), /dashboard/);
});

test('Fornecedor admin legado: bypass total', async () => {
    const { document } = setup({ fornecedor: { visualizar: false, criar: false, editar: false, excluir: false } });
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));
    const cards = document.querySelectorAll('#forn-lista .forn-card');
    // Admin legado ignora redirect, consegue ver o módulo
    assert.ok(document.getElementById('btn-nova-compra'));
});
