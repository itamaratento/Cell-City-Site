// Testes do módulo Diário
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';
after(closeAllMounted);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/diario/diario.js')).href;
function setup(diario) {
    perm.__reset(); perm.__setMatriz({ diario });
    return mountPage(join(REPO_ROOT, 'CRM/pages/diario/index.html'), '/CRM/pages/diario/index.html');
}
test('Diario visualizar:false: redirect', async () => {
    const harness = setup({ visualizar: false });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 100));
    assert.match(harness.getCapturedHref(), /dashboard/);
});
test('Diario admin legado: bypass', async () => {
    perm.__reset(); perm.__setAdminLegado(true);
    const harness = setup({ visualizar: false });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 100));
    assert.ok(harness.document.getElementById('mainHeader'));
});
test('Diario visualizar:true: carrega', async () => {
    const harness = setup({ visualizar: true });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 100));
    assert.ok(harness.document.getElementById('mainHeader'));
});