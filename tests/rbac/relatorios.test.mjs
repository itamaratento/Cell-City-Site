// Testes de RBAC — módulo Relatórios
// Importa CRM/pages/relatorios/relatorios.js REAL via tests/rbac/loader.mjs.
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
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/relatorios/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/relatorios/relatorios.js')).href;

function setup({ matriz = null } = {}) {
    fsMock.__reset();
    perm.__reset();
    fsMock.__seed('caixa_lancamentos', 'lanc_1', { tipo: 'entrada', descricao: 'Venda', valor: 100, data: '2026-07-01', empresa_id: 'empresa_teste' });
    fsMock.__seed('os', 'os_1', { status: 'entregue', data: '2026-07-01', empresa_id: 'empresa_teste' });
    perm.__setMatriz(matriz);
    const harness = mountPage(HTML_PATH, '/CRM/pages/relatorios/index.html');
    return harness;
}

test('Relatorios sem permissoes: body limpo com Acesso negado', async () => {
    const { document } = setup({ matriz: { relatorios: { visualizar: false } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    assert.ok(document.body.innerHTML.includes('Acesso negado'), 'body deve mostrar acesso negado');
});

test('Relatorios com visualizar: painel carrega', async () => {
    const { document } = setup({ matriz: { relatorios: { visualizar: true } } });
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const painel = document.getElementById('painel');
    assert.ok(painel, 'painel deve existir');
});

test('Relatorios admin legado: acesso liberado', async () => {
    const { document } = setup();
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL);
    await new Promise(r => setTimeout(r, 150));
    const painel = document.getElementById('painel');
    assert.ok(painel, 'admin legado deve ver o painel');
});
