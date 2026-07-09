// Testes do módulo Usuários e Permissões
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
after(closeAllMounted);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/usuarios-permissoes/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/usuarios-permissoes/usuarios-permissoes.js')).href;
test('Usuarios: pagina carrega com header', async () => {
    const h = mountPage(HTML_PATH, '/CRM/pages/usuarios-permissoes/index.html');
    await importFresh(MOD_URL, { document: h.document });
    await new Promise(r => setTimeout(r, 150));
    assert.ok(h.document.querySelector('header'));
});
test('Usuarios: contem abas de navegacao', async () => {
    const h = mountPage(HTML_PATH, '/CRM/pages/usuarios-permissoes/index.html');
    await importFresh(MOD_URL, { document: h.document });
    await new Promise(r => setTimeout(r, 150));
    assert.ok(h.document.querySelector('.up-tab'));
});
