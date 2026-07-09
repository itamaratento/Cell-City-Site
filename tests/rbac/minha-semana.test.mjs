// Testes de RBAC — Minha Semana
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/minha-semana/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/minha-semana/minha-semana.js')).href;

function setup({ matriz = null } = {}) {
    perm.__reset();
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/minha-semana/index.html');
}

test('Minha Semana sem permissao: body mostra Acesso negado', async () => {
    const { document } = setup({ matriz: { 'minha-semana': { visualizar: false } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    assert.ok(document.body.innerHTML.includes('Acesso negado'));
});

test('Minha Semana com visualizar: dias carregam', async () => {
    const { document } = setup({ matriz: { 'minha-semana': { visualizar: true } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const dias = document.getElementById('ms-dias');
    assert.ok(dias, 'container ms-dias deve existir');
});

test('Minha Semana admin legado: acesso liberado', async () => {
    const { document } = setup();
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const dias = document.getElementById('ms-dias');
    assert.ok(dias, 'admin legado ve o container');
});
