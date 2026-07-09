// Testes do módulo Config (CRM/pages/config/)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';
after(closeAllMounted);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/clientes/clientes.js')).href;
function setup({ config }) {
    perm.__reset();
    perm.__setMatriz({ config });
    return mountPage(join(REPO_ROOT, 'CRM/pages/clientes/index.html'), '/CRM/pages/clientes/index.html');
}
test('Config visualizar:false: redirect', async () => {
    const harness = setup({ config: { visualizar: false } });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 100));
    assert.match(harness.getCapturedHref(), /dashboard/);
});
test('Config admin legado: bypass', async () => {
    perm.__reset(); perm.__setAdminLegado(true);
    const harness = setup({ config: { visualizar: false } });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 100));
    assert.ok(harness.document.getElementById('mainHeader'));
});
test('Config visualizar:true: carrega', async () => {
    const harness = setup({ config: { visualizar: true } });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 100));
    assert.ok(harness.document.getElementById('mainHeader'));
});