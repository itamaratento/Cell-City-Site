// Testes de RBAC — Catálogo
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/catalogo/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/catalogo/catalogo.js')).href;

function setup({ matriz = null } = {}) {
    perm.__reset();
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/catalogo/index.html');
}

test('Catalogo sem permissao: body mostra Acesso negado', async () => {
    const { document } = setup({ matriz: { catalogo: { visualizar: false } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    assert.ok(document.body.innerHTML.includes('Acesso negado'));
});

test('Catalogo so visualizar: botoes de acao ocultos', async () => {
    const { document } = setup({ matriz: { catalogo: { visualizar: true, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const addBtn = document.querySelector('[onclick*="admAbrirForm()"]');
    if (addBtn) assert.equal(addBtn.style.display, 'none');
});

test('Catalogo admin legado: acesso liberado', async () => {
    const { document } = setup();
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const prodTab = document.querySelector('[data-tab="produtos"]');
    assert.ok(prodTab, 'admin legado ve produtos');
});
