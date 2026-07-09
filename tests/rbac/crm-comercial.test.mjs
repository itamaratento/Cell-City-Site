// Testes RBAC do CRM Comercial
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';
after(closeAllMounted);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/crm-comercial/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/crm-comercial/crm.js')).href;
function setup(matriz) {
    perm.__reset(); perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/crm-comercial/index.html');
}
test('CRM visualizar:false: redirect', async () => {
    const h = setup({ crm: { visualizar: false } });
    await importFresh(MOD_URL, { document: h.document });
    await new Promise(r => setTimeout(r, 100));
    assert.match(h.getCapturedHref(), /dashboard/);
});
test('CRM admin legado: bypass', async () => {
    perm.__reset(); perm.__setAdminLegado(true);
    const h = setup({ crm: { visualizar: false } });
    await importFresh(MOD_URL, { document: h.document });
    await new Promise(r => setTimeout(r, 100));
    assert.ok(h.document.querySelector('header'));
});
test('CRM visualizar:true: carrega', async () => {
    const h = setup({ crm: { visualizar: true, criar: true } });
    await importFresh(MOD_URL, { document: h.document });
    await new Promise(r => setTimeout(r, 100));
    assert.ok(h.document.querySelector('header'));
});
