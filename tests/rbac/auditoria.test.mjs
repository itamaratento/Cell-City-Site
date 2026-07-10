// Testes do módulo Auditoria — CRM/pages/auditoria/auditoria.js.
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
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/auditoria/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/auditoria/auditoria.js')).href;

const AGORA = new Date('2026-07-09T12:00:00');

function seedDados() {
    fsMock.__seed('auditoria_usuarios_permissoes', 'log1', {
        acao: 'usuario_criado', admin_nome: 'Admin Mestre', admin_uid: 'uid_admin',
        alvo_nome: 'João Silva', detalhes: { perfil: 'tecnico' },
        timestamp: new Date(AGORA.getTime() - 3600000)
    });
    fsMock.__seed('auditoria_usuarios_permissoes', 'log2', {
        acao: 'senha_redefinida', admin_nome: 'Admin Mestre', admin_uid: 'uid_admin',
        alvo_nome: 'Maria Souza', detalhes: { via: 'email' },
        timestamp: new Date(AGORA.getTime() - 7200000)
    });
    fsMock.__seed('auditoria_usuarios_permissoes', 'log3', {
        acao: 'permissoes_alteradas', admin_nome: 'Gerente TI', admin_uid: 'uid_ti',
        alvo_nome: null, detalhes: null,
        timestamp: new Date(AGORA.getTime() - 86400000)
    });
}

function setup() {
    fsMock.__reset();
    perm.__reset();
    fsMock.__seed('perfis_operacionais', 'adm', { nome: 'Administrador', sistema: true });
    fsMock.__seed('usuarios', 'u1', { nome_exibicao: 'Admin Mestre', email: 'admin@cellcity.com' });
    seedDados();
    return mountPage(HTML_PATH, '/CRM/pages/auditoria/index.html');
}

describe('Auditoria — renderDashboard', () => {
    test('exibe cards com totais', async () => {
        const { document, window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 200));

        const cards = document.getElementById('au-cards');
        assert.ok(cards);
        assert.ok(cards.innerHTML.includes('3')); // total = 3 logs
        assert.ok(cards.innerHTML.includes('3')); // today count
    });
});

describe('Auditoria — metaAcao', () => {
    test('retorna metadata para ação conhecida', async () => {
        const { window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        const m = window.metaAcao('usuario_criado');
        assert.equal(m.label, 'Usuário criado');
        assert.equal(m.badge, 'success');
    });

    test('retorna fallback para ação desconhecida', async () => {
        const { window } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        const m = window.metaAcao('acao_inexistente');
        assert.ok(m.label.includes('acao_inexistente'));
    });
});

describe('Auditoria — RBAC', () => {
    test('visualizar:false: redirect para Dashboard', async () => {
        const harness = setup();
        perm.__setMatriz({ auditoria: { visualizar: false } });
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 150));
        assert.match(harness.getCapturedHref(), /dashboard\/index\.html/);
    });

    test('admin legado: acesso liberado', async () => {
        const harness = setup();
        perm.__setAdminLegado(true);
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 200));
        assert.doesNotMatch(harness.getCapturedHref(), /dashboard\/index\.html/);
        assert.ok(harness.document.getElementById('au-cards').innerHTML.trim() !== '');
    });
});

describe('Auditoria — HTML structure', () => {
    test('index.html contém elementos essenciais', async () => {
        const { document } = setup();
        await importFresh(MOD_URL);
        await new Promise(r => setTimeout(r, 100));

        assert.ok(document.getElementById('au-cards'));
        assert.ok(document.getElementById('au-busca'));
        assert.ok(document.getElementById('au-tbody'));
        assert.ok(document.getElementById('au-table'));
        assert.ok(document.getElementById('au-ant'));
        assert.ok(document.getElementById('au-prox'));
    });
});
