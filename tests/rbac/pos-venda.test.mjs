// Testes de RBAC — Pós-Venda
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/pos-venda/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/pos-venda/posvenda.js')).href;

function setup({ matriz = null } = {}) {
    perm.__reset();
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/pos-venda/index.html');
}

test('PosVenda sem permissao: body mostra Acesso negado', async () => {
    const { document } = setup({ matriz: { 'pos-venda': { visualizar: false } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    assert.ok(document.body.innerHTML.includes('Acesso negado'));
});

test('PosVenda com visualizar: tabs carregam', async () => {
    const { document } = setup({ matriz: { 'pos-venda': { visualizar: true } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const tabs = document.querySelector('.posv-tabs');
    assert.ok(tabs, 'tabs de pos-venda devem existir');
});

test('PosVenda admin legado: acesso liberado', async () => {
    const { document } = setup();
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const tabs = document.querySelector('.posv-tabs');
    assert.ok(tabs, 'admin legado ve as tabs');
});
