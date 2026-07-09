// Testes do módulo Compras — CRM/pages/compras/compras.js.
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
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/compras/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/compras/compras.js')).href;

function setup(matriz) {
    fsMock.__reset();
    perm.__reset();
    fsMock.__seed('compras_pedidos', 'comp_1', { descricao: 'Telas Samsung', fornecedor_ref: 'forn_1', data: '2026-07-01', valor: 1500, status: 'pendente' });
    fsMock.__seed('compras_pedidos', 'comp_2', { descricao: 'Baterias iPhone', data: '2026-07-05', valor: 800, status: 'recebido' });
    fsMock.__seed('fornecedor_compras', 'forn_1', { descricao: 'Distribuidora Peças' });
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/compras/index.html');
}

test('Compras restrito (visualizar:true, criar:false): botão Novo oculto', async () => {
    const { document } = setup({ compras: { visualizar: true, criar: false, editar: false, excluir: false } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));
    assert.equal(document.getElementById('cr-btn-nova').style.display, 'none');
});

test('Compras matriz total: botão Novo visível, cards com editar/excluir', async () => {
    const { document } = setup({ compras: { visualizar: true, criar: true, editar: true, excluir: true } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));
    assert.notEqual(document.getElementById('cr-btn-nova').style.display, 'none');
    assert.equal(document.querySelectorAll('.cr-card-edit-btn').length, 2);
    assert.equal(document.querySelectorAll('.cr-card-del-btn').length, 2);
});

test('Compras visualizar:false: redirect para Dashboard', async () => {
    const harness = setup({ compras: { visualizar: false, criar: false, editar: false, excluir: false } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));
    assert.match(harness.getCapturedHref(), /dashboard/);
});

test('Compras admin legado: bypass independente da matriz', async () => {
    const { document } = setup({ compras: { visualizar: false, criar: false, editar: false, excluir: false } });
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));
    assert.notEqual(document.getElementById('cr-btn-nova').style.display, 'none');
});

test('Compras: renderiza cards com dados mock', async () => {
    const { document } = setup({ compras: { visualizar: true, criar: true, editar: true, excluir: true } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 100));
    const cards = document.querySelectorAll('.cr-card');
    assert.equal(cards.length, 2);
    assert.ok(cards[0].textContent.includes('Telas Samsung'));
    assert.ok(cards[1].textContent.includes('Baterias iPhone'));
});
