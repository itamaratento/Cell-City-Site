// RBAC — Config Impressão e Garantias (pages/config/impressao.html)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/config/impressao.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/config/impressao.js')).href;

function setup({ matriz = null } = {}) {
    perm.__reset();
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/config/impressao.html');
}

test('Impressão sem permissao (config.visualizar=false): redirect Dashboard', async () => {
    const harness = setup({ matriz: { config: { visualizar: false } } });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 150));
    assert.match(harness.getCapturedHref(), /dashboard\/index\.html/);
});

test('Impressão com visualizar: form carrega', async () => {
    const harness = setup({ matriz: { config: { visualizar: true } } });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 150));
    assert.doesNotMatch(harness.getCapturedHref(), /dashboard\/index\.html/);
    assert.ok(harness.document.getElementById('loja-nome'), 'loja-nome deve existir');
});

test('Impressão admin legado: acesso liberado', async () => {
    const harness = setup();
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 150));
    assert.doesNotMatch(harness.getCapturedHref(), /dashboard\/index\.html/);
    assert.ok(harness.document.getElementById('loja-nome'), 'admin legado ve form');
});
