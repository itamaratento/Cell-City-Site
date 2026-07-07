// Testes de RBAC (Fase 2, Sprint 2 — moduloId 'crm') — CRM/pages/crm-comercial/chips-entrada.js.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as fsMock from './mocks/firestore-mock.js';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/crm-comercial/chips-entrada.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/crm-comercial/chips-entrada.js')).href;

function setup({ matriz = null, adminLegado = false } = {}) {
    fsMock.__reset();
    perm.__reset();
    perm.__setMatriz(matriz);
    perm.__setAdminLegado(adminLegado);
    return mountPage(HTML_PATH, '/CRM/pages/crm-comercial/chips-entrada.html');
}

test('Chips-entrada sem podeCriar: redirect para a lista de chips', async () => {
    const harness = setup({ matriz: { crm: { visualizar: true, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);

    assert.match(harness.getCapturedHref(), /crm-comercial\/chips\.html/);
});

test('Chips-entrada com podeCriar: não redireciona', async () => {
    const harness = setup({ matriz: { crm: { visualizar: true, criar: true, editar: true, excluir: true } } });
    await importFresh(MOD_URL);

    assert.doesNotMatch(harness.getCapturedHref(), /chips\.html$/);
});

test('Chips-entrada não migrado (matriz null): fail-open, não redireciona', async () => {
    const harness = setup({ matriz: null });
    await importFresh(MOD_URL);

    assert.doesNotMatch(harness.getCapturedHref(), /chips\.html$/);
});
