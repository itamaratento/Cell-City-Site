// Testes de RBAC — pages/clientes/ (lista real de clientes)
// Gate no módulo 'os' (mesma barreira da ficha unificada).
// Impressão/Garantias migrou para pages/config/impressao.html (ver impressao.test).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
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

test('Clientes HTML é lista (não Impressora)', () => {
    const html = readFileSync(HTML_PATH, 'utf8');
    assert.match(html, /id="cli-search"/);
    assert.doesNotMatch(html, /loja-nome|impressao\.js/);
});

test('Clientes sem permissao (os.visualizar=false): redirect para Dashboard', async () => {
    const harness = setup({ matriz: { os: { visualizar: false } } });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 150));
    assert.match(harness.getCapturedHref(), /dashboard\/index\.html/);
});

test('Clientes com visualizar os: busca carrega', async () => {
    const harness = setup({ matriz: { os: { visualizar: true } } });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 150));
    assert.doesNotMatch(harness.getCapturedHref(), /dashboard\/index\.html/);
    assert.ok(harness.document.getElementById('cli-search'), 'cli-search deve existir');
});

test('Clientes admin legado: acesso liberado', async () => {
    const harness = setup();
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 150));
    assert.doesNotMatch(harness.getCapturedHref(), /dashboard\/index\.html/);
    assert.ok(harness.document.getElementById('cli-search'), 'admin legado ve lista');
});
