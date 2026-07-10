// Testes de RBAC — Central de Comandos (moduloId 'central-comandos').
// Cobertura adicionada na evolução contínua (2026-07-10): o módulo tinha
// gate de visualização mas nenhum teste. O gate REDIRECIONA para o
// Dashboard quando visualizar=false (não escreve "Acesso negado").
// comandos.js usa a Camada Repository (central/sistema.repository) — o
// loader ESM resolve firebase/client.js para o mock, então o boot roda
// sem Firestore real. Boot via DOMContentLoaded → importFresh recebe
// { document }.
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
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/central-comandos/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/central-comandos/comandos.js')).href;

function setup({ matriz = null } = {}) {
    fsMock.__reset();
    perm.__reset();
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/central-comandos/index.html');
}

test('Central de Comandos sem permissao: redirect para Dashboard', async () => {
    const harness = setup({ matriz: { 'central-comandos': { visualizar: false } } });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 150));
    assert.match(harness.getCapturedHref(), /dashboard\/index\.html/);
});

test('Central de Comandos com visualizar: carrega sem redirect', async () => {
    const harness = setup({ matriz: { 'central-comandos': { visualizar: true } } });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 150));
    assert.doesNotMatch(harness.getCapturedHref(), /dashboard\/index\.html/);
    assert.ok(harness.document.getElementById('cmd-categorias'), 'estrutura da página presente');
});

test('Central de Comandos admin legado: acesso liberado', async () => {
    const harness = setup();
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 150));
    assert.doesNotMatch(harness.getCapturedHref(), /dashboard\/index\.html/);
});
