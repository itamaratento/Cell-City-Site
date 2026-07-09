// Testes de RBAC — Autoatendimento
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/autoatendimento/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/autoatendimento/autoatendimento.js')).href;

function setup({ matriz = null } = {}) {
    perm.__reset();
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/autoatendimento/index.html');
}

test('Autoatendimento sem permissao: body mostra Acesso negado', async () => {
    const { document } = setup({ matriz: { autoatendimento: { visualizar: false } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    assert.ok(document.body.innerHTML.includes('Acesso negado'));
});

test('Autoatendimento com visualizar: lista carrega', async () => {
    const { document } = setup({ matriz: { autoatendimento: { visualizar: true } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const lista = document.getElementById('auto-lista');
    assert.ok(lista, 'auto-lista deve existir');
});

test('Autoatendimento admin legado: acesso liberado', async () => {
    const { document } = setup();
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const lista = document.getElementById('auto-lista');
    assert.ok(lista, 'admin legado ve lista');
});
