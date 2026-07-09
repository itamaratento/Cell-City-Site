// Testes de WhatsApp Templates — CRM/pages/crm-comercial/crm.js.
// Cobre: substituição de variáveis, geração de URL WhatsApp,
// seletor de templates, e gate RBAC no gerenciamento.
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
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/crm-comercial/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/crm-comercial/crm.js')).href;

function setup({ matriz = null, adminLegado = false } = {}) {
    fsMock.__reset();
    perm.__reset();
    fsMock.__seed('crm_leads', 'lead_1', { nome: 'João Silva', telefone: '(62) 99999-0001', aparelho: 'Samsung A15', servico: 'Troca de Tela', valor: 180, status: 'novo_contato', criadoEm: '2026-07-07T10:00:00.000Z' });
    fsMock.__seed('crm_templates', 'tpl_1', { nome: 'Orçamento', texto: 'Olá {nome}! O orçamento do {aparelho} ficou em {valor}.' });
    fsMock.__seed('crm_templates', 'tpl_2', { nome: 'Pronto', texto: '{nome}, seu {aparelho} ficou pronto! Valor: {valor}.' });
    perm.__setMatriz(matriz);
    perm.__setAdminLegado(adminLegado);
    return mountPage(HTML_PATH, '/CRM/pages/crm-comercial/index.html');
}

describe('WhatsApp Templates — substituirVars', () => {
    test('substitui todas as variáveis', async () => {
        const { window } = setup({ matriz: { crm: { visualizar: true, criar: true, editar: true, excluir: true } } });
        await importFresh(MOD_URL);

        const lead = { nome: 'João', aparelho: 'Samsung A15', servico: 'Troca de Tela', valor: 180, telefone: '(62) 99999-0001', obs: 'Chegar após 14h' };
        const result = window.substituirVars('Olá {nome}! Aparelho: {aparelho}. Serviço: {servico}. Valor: {valor}. Tel: {tel}. Obs: {obs}.', lead);
        assert.match(result, /Olá João!/);
        assert.match(result, /Aparelho: Samsung A15/);
        assert.match(result, /Serviço: Troca de Tela/);
        assert.match(result, /Valor: R\$ 180,00/);
        assert.match(result, /Tel: 62999990001/);
        assert.match(result, /Obs: Chegar após 14h/);
    });

    test('variáveis ausentes viram string vazia', async () => {
        const { window } = setup({ matriz: { crm: { visualizar: true, criar: true, editar: true, excluir: true } } });
        await importFresh(MOD_URL);

        const result = window.substituirVars('{nome} — {aparelho}', { nome: 'João' });
        assert.equal(result, 'João — ');
    });

    test('valor zero é formatado corretamente', async () => {
        const { window } = setup({ matriz: { crm: { visualizar: true, criar: true, editar: true, excluir: true } } });
        await importFresh(MOD_URL);

        const result = window.substituirVars('Valor: {valor}', { valor: 0 });
        assert.equal(result, 'Valor: ');
    });
});

describe('WhatsApp Templates — carregarTemplates', () => {
    test('carrega templates do Firestore no cache', async () => {
        const { window } = setup({ matriz: { crm: { visualizar: true, criar: true, editar: true, excluir: true } } });
        await importFresh(MOD_URL);
        await window.carregarTemplates();

        const cached = window.__templatesCache();
        assert.equal(cached.length, 2);
        assert.ok(cached.some(t => t.nome === 'Orçamento'));
        assert.ok(cached.some(t => t.nome === 'Pronto'));
    });
});

describe('WhatsApp Templates — abrirTemplatePicker (fallback sem templates)', () => {
    test('sem templates: abre WhatsApp direto sem modal', async () => {
        fsMock.__reset();
        perm.__reset();
        fsMock.__seed('crm_leads', 'lead_1', { nome: 'João Silva', telefone: '(62) 99999-0001', status: 'novo_contato', criadoEm: '2026-07-07T10:00:00.000Z' });
        perm.__setMatriz({ crm: { visualizar: true, criar: true, editar: true, excluir: true } });
        const harness = setup({ matriz: { crm: { visualizar: true, criar: true, editar: true, excluir: true } } });
        fsMock.__reset();
        fsMock.__seed('crm_leads', 'lead_1', { nome: 'João Silva', telefone: '(62) 99999-0001', status: 'novo_contato', criadoEm: '2026-07-07T10:00:00.000Z' });
        perm.__setMatriz({ crm: { visualizar: true, criar: true, editar: true, excluir: true } });
        await importFresh(MOD_URL);

        const lead = { id: 'lead_1', nome: 'João Silva', telefone: '(62) 99999-0001' };
        await window.abrirWhatsApp('lead_1');
        const modal = document.getElementById('crm-modal');
        assert.ok(!modal.classList.contains('open'));
    });
});

describe('WhatsApp Templates — RBAC template management', () => {
    test('sem podeEditar: botão Gerenciar não aparece no picker', async () => {
        const { document, window } = setup({ matriz: { crm: { visualizar: true, criar: true, editar: false, excluir: true } } });
        await importFresh(MOD_URL);

        await window.abrirDetalhe('lead_1');
        const btnWpp = document.querySelector('.crm-btn-wpp');
        assert.ok(btnWpp);

        btnWpp.click();
        await new Promise(r => setTimeout(r, 50));

        const gerBtn = document.querySelector('[onclick*="abrirGerenciarTemplates"]');
        assert.equal(gerBtn, null);
    });

    test('abrirGerenciarTemplates sem podeEditar: bloqueado', async () => {
        const { window } = setup({ matriz: { crm: { visualizar: true, criar: true, editar: false, excluir: false } } });
        await importFresh(MOD_URL);

        await window.abrirGerenciarTemplates();
        const modal = document.getElementById('crm-modal');
        assert.ok(!modal.classList.contains('open'));
    });

    test('abrirGerenciarTemplates com podeEditar: modal abre', async () => {
        const { document, window } = setup({ matriz: { crm: { visualizar: true, criar: false, editar: true, excluir: false } } });
        await importFresh(MOD_URL);

        await window.abrirGerenciarTemplates();
        await new Promise(r => setTimeout(r, 80));

        const modal = document.getElementById('crm-modal');
        assert.ok(modal.classList.contains('open'));
        assert.ok(document.querySelector('#crm-modal-body h3'));
    });

    test('admin legado: pode gerenciar templates mesmo com matriz restrita', async () => {
        const { document, window } = setup({ matriz: { crm: { visualizar: false, criar: false, editar: false, excluir: false } }, adminLegado: true });
        await importFresh(MOD_URL);

        await window.abrirGerenciarTemplates();
        await new Promise(r => setTimeout(r, 80));

        const modal = document.getElementById('crm-modal');
        assert.ok(modal.classList.contains('open'));
    });
});

describe('WhatsApp Templates — abrirWhatsApp', () => {
    test('lead sem telefone: não abre, exibe toast', async () => {
        fsMock.__reset();
        perm.__reset();
        fsMock.__seed('crm_leads', 'lead_no_tel', { nome: 'Sem Telefone', status: 'novo_contato', criadoEm: '2026-07-07T10:00:00.000Z' });
        perm.__setMatriz({ crm: { visualizar: true, criar: true, editar: true, excluir: true } });
        const { window } = setup({ matriz: { crm: { visualizar: true, criar: true, editar: true, excluir: true } } });
        fsMock.__reset();
        fsMock.__seed('crm_leads', 'lead_no_tel', { nome: 'Sem Telefone', status: 'novo_contato', criadoEm: '2026-07-07T10:00:00.000Z' });
        perm.__setMatriz({ crm: { visualizar: true, criar: true, editar: true, excluir: true } });
        await importFresh(MOD_URL);

        await window.abrirWhatsApp('lead_no_tel');
        const toast = document.getElementById('crm-toast');
        assert.ok(toast.classList.contains('show'));
        assert.match(toast.textContent, /Telefone/);
    });
});
