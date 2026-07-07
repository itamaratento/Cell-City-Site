// Testes de RBAC (Fase 2, Sprint 2 — moduloId 'agenda') — CRM/pages/acaodasemana/acaodasemana.js.
// Decisão de produto: a UI não separa criar/editar (autosave reescreve o dia
// inteiro), então a escrita só é liberada com podeCriar('agenda') E
// podeEditar('agenda') (AND, mais restritivo) — ver TECHDOC §7.2.
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
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/acaodasemana/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/acaodasemana/acaodasemana.js')).href;

function setup({ matriz = null, adminLegado = false } = {}) {
    fsMock.__reset();
    perm.__reset();
    perm.__setMatriz(matriz);
    perm.__setAdminLegado(adminLegado);
    return mountPage(HTML_PATH, '/CRM/pages/acaodasemana/index.html');
}

test('Agenda: só visualizar (sem criar+editar juntos) deixa a nota somente leitura', async () => {
    const { document } = setup({ matriz: { agenda: { visualizar: true, criar: true, editar: false } } });
    await importFresh(MOD_URL);

    assert.equal(document.getElementById('ag-nota-area').getAttribute('readonly'), 'true');
    assert.equal(document.getElementById('ag-recorr-esta').getAttribute('disabled'), 'true');
    assert.equal(document.getElementById('ag-recorr-futuras').getAttribute('disabled'), 'true');
});

test('Agenda: criar E editar juntos liberam a escrita (nota editável)', async () => {
    const { document } = setup({ matriz: { agenda: { visualizar: true, criar: true, editar: true } } });
    await importFresh(MOD_URL);

    assert.equal(document.getElementById('ag-nota-area').hasAttribute('readonly'), false);
});

test('Agenda: não migrado (matriz null): fail-open, nota editável', async () => {
    const { document } = setup({ matriz: null });
    await importFresh(MOD_URL);

    assert.equal(document.getElementById('ag-nota-area').hasAttribute('readonly'), false);
});

test('Agenda: visualizar:false redireciona para o Dashboard', async () => {
    const harness = setup({ matriz: { agenda: { visualizar: false, criar: false, editar: false } } });
    await importFresh(MOD_URL);

    assert.match(harness.getCapturedHref(), /dashboard\/index\.html/);
});

test('Agenda: admin legado — bypass, nota editável independente da matriz', async () => {
    const { document } = setup({ matriz: { agenda: { visualizar: false, criar: false, editar: false } }, adminLegado: true });
    await importFresh(MOD_URL);

    assert.equal(document.getElementById('ag-nota-area').hasAttribute('readonly'), false);
});
