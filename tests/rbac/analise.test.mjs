// Testes de RBAC — Análise
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/analise/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/analise/analise.js')).href;

function setup({ matriz = null } = {}) {
    perm.__reset();
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/analise/index.html');
}

test('Analise sem permissao: body mostra Acesso negado', async () => {
    const { document } = setup({ matriz: { analise: { visualizar: false } } });
    await importFresh(MOD_URL, { document });
    await new Promise(r => setTimeout(r, 150));
    assert.ok(document.body.innerHTML.includes('Acesso negado'));
});

test('Analise com permissao: init carrega', async () => {
    const { document } = setup({ matriz: { analise: { visualizar: true } } });
    await importFresh(MOD_URL, { document });
    await new Promise(r => setTimeout(r, 150));
    const body = document.getElementById('an-body');
    assert.ok(body, 'an-body deve existir');
});

test('Analise admin legado: acesso liberado', async () => {
    const { document } = setup();
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL, { document });
    await new Promise(r => setTimeout(r, 150));
    const body = document.getElementById('an-body');
    assert.ok(body, 'admin legado deve ver o painel');
});
