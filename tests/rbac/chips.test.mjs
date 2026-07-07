// Testes de RBAC (Fase 2, Sprint 2 — moduloId 'crm') — CRM/pages/crm-comercial/chips.js
// (piloto original da Camada Repository — usa ChipsRepository real via loader).
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
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/crm-comercial/chips.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/crm-comercial/chips.js')).href;

function setup({ matriz = null, adminLegado = false } = {}) {
    fsMock.__reset();
    perm.__reset();
    fsMock.__seed('chips_cadastros', 'chip_1', { nome: 'Chip Teste', status: 'novo_cadastro', criadoEm: '2026-07-07T10:00:00.000Z' });
    perm.__setMatriz(matriz);
    perm.__setAdminLegado(adminLegado);
    return mountPage(HTML_PATH, '/CRM/pages/crm-comercial/chips.html');
}

test('Chips restrito: botão "Novo Chip" oculto, detalhe sem editar/excluir', async () => {
    const { document, window } = setup({ matriz: { crm: { visualizar: true, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);

    assert.equal(document.querySelector('.crm-btn-chegou').style.display, 'none');

    await window.abrirDetalhe('chip_1');
    const detalhe = document.getElementById('chip-detalhe');
    assert.equal(detalhe.querySelector('.crm-btn-editar'), null);
    assert.equal(detalhe.querySelector('.crm-btn-excluir'), null);
});

test('Chips matriz total: botão "Novo Chip" visível, detalhe com editar/excluir', async () => {
    const { document, window } = setup({ matriz: { crm: { visualizar: true, criar: true, editar: true, excluir: true } } });
    await importFresh(MOD_URL);

    assert.notEqual(document.querySelector('.crm-btn-chegou').style.display, 'none');

    await window.abrirDetalhe('chip_1');
    const detalhe = document.getElementById('chip-detalhe');
    assert.ok(detalhe.querySelector('.crm-btn-editar'));
    assert.ok(detalhe.querySelector('.crm-btn-excluir'));
});

test('Chips não migrado (matriz null): fail-open total', async () => {
    const { document } = setup({ matriz: null });
    await importFresh(MOD_URL);

    assert.notEqual(document.querySelector('.crm-btn-chegou').style.display, 'none');
});

test('Chips visualizar:false: redirect para o Dashboard', async () => {
    const harness = setup({ matriz: { crm: { visualizar: false, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);

    assert.match(harness.getCapturedHref(), /dashboard\/index\.html/);
});

test('Chips admin legado: bypass total independente da matriz', async () => {
    const { document } = setup({ matriz: { crm: { visualizar: false, criar: false, editar: false, excluir: false } }, adminLegado: true });
    await importFresh(MOD_URL);

    assert.notEqual(document.querySelector('.crm-btn-chegou').style.display, 'none');
});
