// Testes de RBAC — Clientes (Config Impressão)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/clientes/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/clientes/clientes.js')).href;

function setup({ matriz = null } = {}) {
    perm.__reset();
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/clientes/index.html');
}

test('Clientes sem permissao: body mostra Acesso negado', async () => {
    const { document } = setup({ matriz: { clientes: { visualizar: false } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    assert.ok(document.body.innerHTML.includes('Acesso negado'));
});

test('Clientes com visualizar: form carrega', async () => {
    const { document } = setup({ matriz: { clientes: { visualizar: true } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const nome = document.getElementById('loja-nome');
    assert.ok(nome, 'loja-nome deve existir');
});

test('Clientes admin legado: acesso liberado', async () => {
    const { document } = setup();
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const nome = document.getElementById('loja-nome');
    assert.ok(nome, 'admin legado ve form');
});
