// Testes do módulo Config (CRM/pages/config/) — tela de PIN e conta.
// Diferente dos demais módulos, Config NÃO aplica gate RBAC próprio
// (é acessível a qualquer usuário autenticado). Os testes verificam
// que a página carrega sem redirect independente da matriz de permissões.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';
after(closeAllMounted);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/config/config.js')).href;
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/config/index.html');
function setup({ config } = {}) {
    perm.__reset();
    perm.__setMatriz(config ? { config } : null);
    return mountPage(HTML_PATH, '/CRM/pages/config/index.html');
}
test('Config sem restricao: carrega e exibe wrapper', async () => {
    const { document } = setup();
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    assert.ok(document.getElementById('screen-pin') || document.getElementById('pin-wrapper'));
});
test('Config visualizar:false: nao redireciona (config nao tem gate RBAC)', async () => {
    const harness = setup({ config: { visualizar: false } });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 150));
    const href = harness.getCapturedHref();
    assert.ok(!href || !/dashboard/.test(href));
});
test('Config admin legado: carrega', async () => {
    perm.__reset(); perm.__setAdminLegado(true);
    const { document } = setup({ config: { visualizar: false } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    assert.ok(document.getElementById('screen-pin') || document.getElementById('pin-wrapper'));
});