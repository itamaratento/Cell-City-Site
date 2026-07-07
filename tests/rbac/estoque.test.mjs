// Testes de RBAC (Fase 2, Sprint 3 — moduloId 'estoque') — persiste a
// homologação re-executada em 2026-07-07 (34/34 cenários, ver
// CRM/TECHDOC.md §7.3). Importa CRM/pages/estoque/estoque.js REAL (não uma
// cópia) via tests/rbac/loader.mjs — se o código mudar, este teste roda
// contra a mudança na próxima execução, não contra uma evidência congelada.
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
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/estoque/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/estoque/estoque.js')).href;

function setup({ matriz = null, adminLegado = false } = {}) {
    fsMock.__reset();
    perm.__reset();
    fsMock.__seed('estoque_produtos', 'prod_1', { nome: 'Capinha Teste', categoria: 'Capinha', quantidade: 5, quantidadeMinima: 1, venda: 30, custo: 10 });
    perm.__setMatriz(matriz);
    perm.__setAdminLegado(adminLegado);
    return mountPage(HTML_PATH, '/CRM/pages/estoque/index.html');
}

test('Estoque restrito (visualizar✔ criar✘ editar✘ excluir✘): botão Novo oculto, cards sem editar/excluir/±', async () => {
    const { document } = setup({ matriz: { estoque: { visualizar: true, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);

    assert.equal(document.getElementById('est-btn-novo').style.display, 'none');
    assert.equal(document.querySelectorAll('.est-card-edit').length, 0);
    assert.equal(document.querySelectorAll('.est-card-del').length, 0);
    assert.equal(document.querySelectorAll('[data-entrada]').length, 0);
    assert.equal(document.querySelectorAll('[data-saida]').length, 0);
});

test('Estoque matriz total (tudo true): tudo visível', async () => {
    const { document } = setup({ matriz: { estoque: { visualizar: true, criar: true, editar: true, excluir: true } } });
    await importFresh(MOD_URL);

    assert.notEqual(document.getElementById('est-btn-novo').style.display, 'none');
    assert.equal(document.querySelectorAll('.est-card-edit').length, 1);
    assert.equal(document.querySelectorAll('.est-card-del').length, 1);
    assert.equal(document.querySelectorAll('[data-entrada]').length, 1);
});

test('Estoque não migrado (matriz null): fail-open total', async () => {
    const { document } = setup({ matriz: null });
    await importFresh(MOD_URL);

    assert.notEqual(document.getElementById('est-btn-novo').style.display, 'none');
    assert.equal(document.querySelectorAll('.est-card-edit').length, 1);
    assert.equal(document.querySelectorAll('.est-card-del').length, 1);
});

test('Estoque visualizar:false: redirect para o Dashboard antes de renderizar', async () => {
    const harness = setup({ matriz: { estoque: { visualizar: false, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);

    assert.match(harness.getCapturedHref(), /dashboard\/index\.html/);
    assert.equal(harness.document.getElementById('est-cats-container').innerHTML, '');
});

test('Estoque admin legado: bypass total independente da matriz', async () => {
    const { document } = setup({ matriz: { estoque: { visualizar: false, criar: false, editar: false, excluir: false } }, adminLegado: true });
    await importFresh(MOD_URL);

    assert.notEqual(document.getElementById('est-btn-novo').style.display, 'none');
    assert.equal(document.querySelectorAll('.est-card-edit').length, 1);
});
