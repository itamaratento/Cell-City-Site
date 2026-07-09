// Testes de RBAC — Central de Alertas
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/central-alertas/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/central-alertas/central-alertas.js')).href;

function setup({ matriz = null } = {}) {
    perm.__reset();
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/central-alertas/index.html');
}

test('Central Alertas sem permissao: body mostra Acesso negado', async () => {
    const { document } = setup({ matriz: { 'central-alertas': { visualizar: false } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    assert.ok(document.body.innerHTML.includes('Acesso negado'));
});

test('Central Alertas com permissao: container carrega', async () => {
    const { document } = setup({ matriz: { 'central-alertas': { visualizar: true } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const resumo = document.getElementById('alr-resumo');
    assert.ok(resumo, 'alr-resumo deve existir');
});

test('Central Alertas admin legado: acesso liberado', async () => {
    const { document } = setup();
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const resumo = document.getElementById('alr-resumo');
    assert.ok(resumo, 'admin legado deve ver o resumo');
});
