// Testes de RBAC — Contas & Números
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/contas/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/contas/contas.js')).href;

function setup({ matriz = null } = {}) {
    perm.__reset();
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/contas/index.html');
}

test('Contas sem permissao: body mostra Acesso negado', async () => {
    const { document } = setup({ matriz: { contas: { visualizar: false } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    assert.ok(document.body.innerHTML.includes('Acesso negado'));
});

test('Contas so visualizar: botao novo oculto', async () => {
    const { document } = setup({ matriz: { contas: { visualizar: true, criar: false } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const addBtn = document.querySelector('.add-btn');
    assert.ok(addBtn, 'botao add deve existir no HTML');
    if (addBtn) assert.equal(addBtn.style.display, 'none');
});

test('Contas admin legado: acesso liberado', async () => {
    const { document } = setup();
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    assert.ok(document.querySelector('.add-btn'), 'admin legado ve o botao add');
});
