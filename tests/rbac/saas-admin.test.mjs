// Testes do módulo Admin SaaS (Sprint 4 — aprovação de empresas pendentes)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mountPage, closeAllMounted } from './helpers/dom-harness.mjs';
import * as fsMock from './mocks/firestore-mock.js';
import * as kernelMock from './mocks/kernel.js';
after(closeAllMounted);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/saas-admin/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/saas-admin/saas-admin.js')).href;

async function abrir(ctx, seeds = []) {
    fsMock.__reset();
    kernelMock.__setCtx(ctx);
    for (const s of seeds) fsMock.__seed(s.col, s.id, s.data);
    const h = mountPage(HTML_PATH, '/CRM/pages/saas-admin/index.html');
    const mod = await import(MOD_URL + '?t=' + Date.now() + '_' + Math.random().toString(36).slice(2));
    await mod.initSaasAdmin();
    await new Promise((r) => setTimeout(r, 60));
    return h;
}

test('SaaS Admin: bloqueia acesso para quem não é master_admin', async () => {
    const h = await abrir({ uid: 'u1', perfil: 'admin', empresaId: 'empresa_teste' });
    assert.match(h.document.body.innerHTML, /Acesso restrito/);
});

test('SaaS Admin: master_admin vê empresa pendente com ações de aprovação', async () => {
    const h = await abrir(
        { uid: 'master1', perfil: 'master_admin', empresaId: 'cellcity-master' },
        [{ col: 'empresas', id: 'emp_1', data: {
            nome_fantasia: 'Loja Teste', razao_social: 'Loja Teste Ltda',
            plano: 'profissional', status: 'pendente_aprovacao',
            contato_nome: 'Maria', contato_email: 'maria@loja.com',
        } }]
    );
    const grid = h.document.getElementById('saas-grid');
    assert.match(grid.innerHTML, /Aprovar/);
    assert.match(grid.innerHTML, /Rejeitar/);
    assert.match(grid.innerHTML, /aguardando aprova/);
});

test('SaaS Admin: empresa ativa não exibe ações de aprovação', async () => {
    const h = await abrir(
        { uid: 'master1', perfil: 'master_admin', empresaId: 'cellcity-master' },
        [{ col: 'empresas', id: 'emp_ativa', data: {
            nome_fantasia: 'Empresa Ativa', plano: 'enterprise', status: 'ativo',
        } }]
    );
    const grid = h.document.getElementById('saas-grid');
    assert.doesNotMatch(grid.innerHTML, /Aprovar/);
    assert.match(grid.innerHTML, /Editar/);
});

test('SaaS Admin: aprovar cria usuário admin, atualiza status e loga auditoria (plano não-trial → ativo)', async () => {
    const h = await abrir(
        { uid: 'master1', perfil: 'master_admin', empresaId: 'cellcity-master' },
        [{ col: 'empresas', id: 'emp_2', data: {
            nome_fantasia: 'Loja Dois', plano: 'profissional', status: 'pendente_aprovacao',
            contato_nome: 'João', contato_email: 'joao@loja2.com',
        } }]
    );
    h.document.querySelector('button[data-acao="aprovar"][data-id="emp_2"]').click();
    await new Promise((r) => setTimeout(r, 30));
    const overlay = h.document.querySelector('.modal-overlay');
    assert.ok(overlay, 'modal de aprovação deve abrir');
    assert.equal(overlay.querySelector('#ap-email').value, 'joao@loja2.com');

    overlay.querySelector('#ap-confirmar').click();
    await new Promise((r) => setTimeout(r, 100));

    const usuarios = fsMock.__all('usuarios');
    assert.equal(usuarios.length, 1);
    assert.equal(usuarios[0].perfil, 'admin');
    assert.equal(usuarios[0].empresa_id, 'emp_2');
    assert.equal(usuarios[0].email, 'joao@loja2.com');

    const empresa = fsMock.__raw('empresas', 'emp_2');
    assert.equal(empresa.status, 'ativo');
    assert.ok(empresa.data_aprovacao);
    assert.equal(empresa.aprovado_por, 'master1');

    const auditoria = fsMock.__all('auditoria_saas');
    assert.equal(auditoria.length, 1);
    assert.equal(auditoria[0].acao, 'empresa_aprovada');
    assert.equal(auditoria[0].detalhes.empresa_id, 'emp_2');
});

test('SaaS Admin: aprovar empresa do plano trial mantém status trial', async () => {
    const h = await abrir(
        { uid: 'master1', perfil: 'master_admin', empresaId: 'cellcity-master' },
        [{ col: 'empresas', id: 'emp_3', data: {
            nome_fantasia: 'Loja Trial', plano: 'trial', status: 'pendente_aprovacao',
            contato_nome: 'Ana', contato_email: 'ana@lojatrial.com',
        } }]
    );
    h.document.querySelector('button[data-acao="aprovar"][data-id="emp_3"]').click();
    await new Promise((r) => setTimeout(r, 30));
    h.document.querySelector('#ap-confirmar').click();
    await new Promise((r) => setTimeout(r, 100));

    const empresa = fsMock.__raw('empresas', 'emp_3');
    assert.equal(empresa.status, 'trial');
});

test('SaaS Admin: rejeitar empresa pendente marca status rejeitada e loga auditoria', async () => {
    const h = await abrir(
        { uid: 'master1', perfil: 'master_admin', empresaId: 'cellcity-master' },
        [{ col: 'empresas', id: 'emp_4', data: {
            nome_fantasia: 'Loja Quatro', plano: 'basico', status: 'pendente_aprovacao',
        } }]
    );
    h.document.querySelector('button[data-acao="rejeitar"][data-id="emp_4"]').click();
    await new Promise((r) => setTimeout(r, 60));

    const empresa = fsMock.__raw('empresas', 'emp_4');
    assert.equal(empresa.status, 'rejeitada');
    assert.equal(empresa.rejeitado_por, 'master1');

    const auditoria = fsMock.__all('auditoria_saas');
    assert.equal(auditoria.length, 1);
    assert.equal(auditoria[0].acao, 'empresa_rejeitada');
});
