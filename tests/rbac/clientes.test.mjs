// Testes de RBAC — pages/clientes/ (Config de Impressão: loja/logo/garantias)
// Apesar do nome do diretório, o módulo é a tela de configuração de
// impressão e faz gate no módulo 'config' (impressao.js::init), com
// REDIRECT para o Dashboard — não com "Acesso negado" no body.
// O boot é via DOMContentLoaded, então importFresh recebe { document }.
// P2.6 (2026-07-16): clientes.js renomeado para CRM/pages/config/impressao.js
// (nome antigo enganoso — nunca geriu clientes). O HTML continua em
// CRM/pages/clientes/index.html; só o módulo JS mudou de lugar.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/clientes/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/config/impressao.js')).href;

function setup({ matriz = null } = {}) {
    perm.__reset();
    perm.__setMatriz(matriz);
    return mountPage(HTML_PATH, '/CRM/pages/clientes/index.html');
}

test('Config Impressão sem permissao (config.visualizar=false): redirect para Dashboard', async () => {
    const harness = setup({ matriz: { config: { visualizar: false } } });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 150));
    assert.match(harness.getCapturedHref(), /dashboard\/index\.html/);
});

test('Config Impressão com visualizar: form carrega', async () => {
    const harness = setup({ matriz: { config: { visualizar: true } } });
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 150));
    assert.doesNotMatch(harness.getCapturedHref(), /dashboard\/index\.html/);
    assert.ok(harness.document.getElementById('loja-nome'), 'loja-nome deve existir');
});

test('Config Impressão admin legado: acesso liberado', async () => {
    const harness = setup();
    perm.__setAdminLegado(true);
    await importFresh(MOD_URL, { document: harness.document });
    await new Promise(r => setTimeout(r, 150));
    assert.doesNotMatch(harness.getCapturedHref(), /dashboard\/index\.html/);
    assert.ok(harness.document.getElementById('loja-nome'), 'admin legado ve form');
});
