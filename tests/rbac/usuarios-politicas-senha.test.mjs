// Testes de Políticas de Senha — CRM/pages/usuarios-permissoes/.
// Cobre: validarSenhaPoliticas, calcularForcaSenha, testarSenha, renderPoliticas.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, importFresh, closeAllMounted } from './helpers/dom-harness.mjs';
import * as fsMock from './mocks/firestore-mock.js';
import * as perm from './mocks/permissoes.js';

after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/usuarios-permissoes/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/usuarios-permissoes/usuarios-permissoes.js')).href;

function setup() {
    fsMock.__reset();
    perm.__reset();
    perm.__setAdminLegado(false);
    return mountPage(HTML_PATH, '/CRM/pages/usuarios-permissoes/index.html');
}

describe('Políticas de Senha — validarSenhaPoliticas', () => {
    test('senha válida: nenhum erro', async () => {
        const { window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        const erros = window.validarSenhaPoliticas('Abc12345');
        assert.equal(erros.length, 0);
    });

    test('senha muito curta: erro de comprimento', async () => {
        const { window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        const erros = window.validarSenhaPoliticas('Ab1');
        assert.ok(erros.some(e => e.includes('Mínimo') || e.includes('caracteres')));
    });

    test('senha sem maiúscula: erro', async () => {
        const { window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        const erros = window.validarSenhaPoliticas('abcdef123');
        assert.ok(erros.some(e => e.includes('maiúscula')));
    });

    test('senha sem minúscula: erro', async () => {
        const { window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        const erros = window.validarSenhaPoliticas('ABCDEF123');
        assert.ok(erros.some(e => e.includes('minúscula')));
    });

    test('senha sem número: erro', async () => {
        const { window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        const erros = window.validarSenhaPoliticas('Abcdefgh');
        assert.ok(erros.some(e => e.includes('número')));
    });
});

describe('Políticas de Senha — calcularForcaSenha', () => {
    test('senha fraca (< 50)', async () => {
        const { window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        assert.ok(window.calcularForcaSenha('abc') < 50);
    });

    test('senha forte (>= 80)', async () => {
        const { window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        assert.ok(window.calcularForcaSenha('Abcd1234!@#$Xyz') >= 80);
    });
});

describe('Políticas de Senha — UI', () => {
    test('aba políticas de senha existe no HTML', async () => {
        const { document } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        const tab = document.querySelector('[data-tab="politicas"]');
        assert.ok(tab);
        assert.ok(tab.textContent.includes('Políticas'));
    });

    test('panel políticas de senha existe', async () => {
        const { document } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        const panel = document.getElementById('up-panel-politicas');
        assert.ok(panel);
        assert.ok(document.getElementById('pol-expiracao'));
        assert.ok(document.getElementById('pol-min-length'));
        assert.ok(document.getElementById('pol-historico'));
    });

    test('salvarPoliticas salva no Firestore', async () => {
        const { window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        await window.salvarPoliticas();
        await new Promise(r => setTimeout(r, 80));

        const saved = fsMock.__raw('config', 'politicas_senha');
        assert.ok(saved);
        assert.ok(saved.expiracao_dias > 0);
        assert.ok(saved.forca_minima);
    });
});
