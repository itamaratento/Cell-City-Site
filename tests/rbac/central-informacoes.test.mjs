// Testes do módulo Central de Informações
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';
after(closeAllMounted);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/central-informacoes/informacoes.js')).href;
function setup(matriz) {
    perm.__reset(); perm.__setMatriz(matriz);
    return mountPage(join(REPO_ROOT, 'CRM/pages/central-informacoes/index.html'), '/CRM/pages/central-informacoes/index.html');
}
test('central-informacoes visualizar:false: redirect', async () => {
    const h = setup({ 'central-informacoes': { visualizar: false } });
    await importFresh(MOD_URL, { document: h.document });
    await new Promise(r => setTimeout(r, 100));
    assert.match(h.getCapturedHref(), /dashboard/);
});
test('central-informacoes admin legado: bypass', async () => {
    perm.__reset(); perm.__setAdminLegado(true);
    const h = setup({ 'central-informacoes': { visualizar: false } });
    await importFresh(MOD_URL, { document: h.document });
    await new Promise(r => setTimeout(r, 100));
    assert.ok(h.document.querySelector('header.header'));
});
test('central-informacoes visualizar:true: carrega', async () => {
    const h = setup({ 'central-informacoes': { visualizar: true } });
    await importFresh(MOD_URL, { document: h.document });
    await new Promise(r => setTimeout(r, 100));
    assert.ok(h.document.querySelector('header.header'));
});
