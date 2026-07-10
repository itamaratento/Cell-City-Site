// Testes de RBAC — Agenda (Ação da Semana)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/acaodasemana/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/acaodasemana/acaodasemana.js')).href;

function setup({ matriz = null } = {}) {
    perm.__reset();
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/acaodasemana/index.html');
}

// O gate da Agenda (acaodasemana.js::_boot) REDIRECIONA para o Dashboard
// quando visualizar=false — não escreve "Acesso negado" no body.
test('Agenda sem permissao: redirect para Dashboard', async () => {
    const harness = setup({ matriz: { agenda: { visualizar: false } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    assert.match(harness.getCapturedHref(), /dashboard\/index\.html/);
});

test('Agenda com visualizar: calendario carrega', async () => {
    const harness = setup({ matriz: { agenda: { visualizar: true } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    assert.doesNotMatch(harness.getCapturedHref(), /dashboard\/index\.html/);
    const grade = harness.document.getElementById('ag-cal-grade');
    assert.ok(grade, 'grade do calendario deve existir');
    assert.ok(grade.children.length > 0, 'calendario renderizado pelo boot');
});

test('Agenda admin legado: acesso liberado', async () => {
    const harness = setup();
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    assert.doesNotMatch(harness.getCapturedHref(), /dashboard\/index\.html/);
    const grade = harness.document.getElementById('ag-cal-grade');
    assert.ok(grade && grade.children.length > 0, 'admin legado ve calendario');
});
