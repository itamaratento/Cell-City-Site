// Testes de RBAC (Fase 2, Sprint 2 — moduloId 'crm') — CRM/pages/crm-comercial/crm.js.
// Importa o arquivo REAL via tests/rbac/loader.mjs (SDK direto do Firestore,
// não migrado para a Camada Repository — ver CRM/TECHDOC.md §22.4).
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
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/crm-comercial/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/crm-comercial/crm.js')).href;

function setup({ matriz = null, adminLegado = false } = {}) {
    fsMock.__reset();
    perm.__reset();
    // Lead sem telefone: evita o branch assíncrono de lookupClientePorTelefone
    // em abrirDetalhe(), fora do escopo deste teste (é RBAC, não integração).
    fsMock.__seed('crm_leads', 'lead_1', { nome: 'Cliente Teste', status: 'novo_contato', criadoEm: '2026-07-07T10:00:00.000Z' });
    perm.__setMatriz(matriz);
    perm.__setAdminLegado(adminLegado);
    return mountPage(HTML_PATH, '/CRM/pages/crm-comercial/index.html');
}

test('CRM restrito (visualizar✔ criar✘ editar✘ excluir✘): card "Novo Cliente" oculto, detalhe sem editar/excluir', async () => {
    const { document, window } = setup({ matriz: { crm: { visualizar: true, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);

    assert.equal(document.querySelector('.crm-novo-cliente-block'), null);

    await window.abrirDetalhe('lead_1');
    const detalhe = document.getElementById('crm-detalhe');
    assert.equal(detalhe.querySelector('.crm-btn-editar'), null);
    assert.equal(detalhe.querySelector('.crm-btn-excluir'), null);
});

test('CRM matriz total: card "Novo Cliente" visível, detalhe com editar/excluir', async () => {
    const { document, window } = setup({ matriz: { crm: { visualizar: true, criar: true, editar: true, excluir: true } } });
    await importFresh(MOD_URL);

    assert.ok(document.querySelector('.crm-novo-cliente-block'));

    await window.abrirDetalhe('lead_1');
    const detalhe = document.getElementById('crm-detalhe');
    assert.ok(detalhe.querySelector('.crm-btn-editar'));
    assert.ok(detalhe.querySelector('.crm-btn-excluir'));
});

test('CRM não migrado (matriz null): fail-open total', async () => {
    const { document } = setup({ matriz: null });
    await importFresh(MOD_URL);

    assert.ok(document.querySelector('.crm-novo-cliente-block'));
});

test('CRM visualizar:false: redirect para o Dashboard', async () => {
    const harness = setup({ matriz: { crm: { visualizar: false, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);

    assert.match(harness.getCapturedHref(), /dashboard\/index\.html/);
});

test('CRM admin legado: bypass total independente da matriz', async () => {
    const { document } = setup({ matriz: { crm: { visualizar: false, criar: false, editar: false, excluir: false } }, adminLegado: true });
    await importFresh(MOD_URL);

    assert.ok(document.querySelector('.crm-novo-cliente-block'));
});
