// Testes de RBAC (Fase 2, Sprint 4 — moduloId 'financeiro') — ver
// CRM/TECHDOC.md §7.4. Importa CRM/pages/financeiro/financeiro.js REAL (não
// uma cópia) via tests/rbac/loader.mjs — se o código mudar, este teste roda
// contra a mudança na próxima execução, não contra uma evidência congelada.
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
const HTML_PATH = join(REPO_ROOT, 'CRM/pages/financeiro/index.html');
const MOD_URL = new URL('file://' + join(REPO_ROOT, 'CRM/pages/financeiro/financeiro.js')).href;

function setup({ matriz = null, adminLegado = false } = {}) {
    fsMock.__reset();
    perm.__reset();
    fsMock.__seed('financeiro_pagar', 'pag_1', { descricao: 'Aluguel', categoria: 'Aluguel', vencimento: '2026-08-01', valor: 1500, status: 'pendente' });
    fsMock.__seed('financeiro_fixas', 'fix_1', { descricao: 'Internet', categoria: 'Serviços', dia: 10, valor: 200 });
    fsMock.__seed('financeiro_receber', 'rec_1', { descricao: 'Cliente João', vencimento: '2026-08-05', valor: 800, status: 'pendente' });
    fsMock.__seed('financeiro_categorias', 'cat_1', { nome: 'Seguros' });
    fsMock.__seed('financeiro_categorias/cat_1/itens', 'item_1', { descricao: 'Seguro do carro', valor: 300, status: 'pendente' });
    perm.__setMatriz(matriz);
    perm.__setAdminLegado(adminLegado);
    return mountPage(HTML_PATH, '/CRM/pages/financeiro/index.html');
}

test('Financeiro restrito (visualizar✔ criar✘ editar✘ excluir✘): botões de novo ocultos, cards sem editar/excluir/marcar', async () => {
    const { document } = setup({ matriz: { financeiro: { visualizar: true, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);

    assert.equal(document.getElementById('btn-nova-pagar').style.display, 'none');
    assert.equal(document.getElementById('btn-nova-fixa').style.display, 'none');
    assert.equal(document.getElementById('btn-nova-receber').style.display, 'none');
    assert.equal(document.getElementById('fin-tab-add').style.display, 'none');

    assert.equal(document.querySelectorAll('.fin-card-edit-btn').length, 0);
    assert.equal(document.querySelectorAll('.fin-card-del-btn').length, 0);
    assert.equal(document.querySelectorAll('.fin-btn-marcar').length, 0);

    // painel de categoria custom: sem "Novo Item" e sem "Excluir categoria"
    // (obs: .fin-btn-nova também é a classe dos 3 botões estáticos "Nova X" — escopo ao painel custom)
    assert.equal(document.querySelectorAll('#fin-custom-panels .fin-btn-nova').length, 0);
    assert.equal(document.querySelectorAll('.fin-custom-del-tab').length, 0);
});

test('Financeiro matriz total (tudo true): tudo visível', async () => {
    const { document } = setup({ matriz: { financeiro: { visualizar: true, criar: true, editar: true, excluir: true } } });
    await importFresh(MOD_URL);

    assert.notEqual(document.getElementById('btn-nova-pagar').style.display, 'none');
    assert.notEqual(document.getElementById('btn-nova-fixa').style.display, 'none');
    assert.notEqual(document.getElementById('btn-nova-receber').style.display, 'none');
    assert.notEqual(document.getElementById('fin-tab-add').style.display, 'none');

    // 1 pagar + 1 fixa + 1 receber = 3 editar / 3 excluir; + item custom = +1 excluir
    assert.equal(document.querySelectorAll('.fin-card-edit-btn').length, 3);
    assert.equal(document.querySelectorAll('.fin-card-del-btn').length, 4);
    // marcar: pagar (pendente) + receber (pendente) + custom item (pendente) = 3
    assert.equal(document.querySelectorAll('.fin-btn-marcar').length, 3);

    assert.equal(document.querySelectorAll('#fin-custom-panels .fin-btn-nova').length, 1);
    assert.equal(document.querySelectorAll('.fin-custom-del-tab').length, 1);
});

test('Financeiro não migrado (matriz null): fail-open total', async () => {
    const { document } = setup({ matriz: null });
    await importFresh(MOD_URL);

    assert.notEqual(document.getElementById('btn-nova-pagar').style.display, 'none');
    assert.equal(document.querySelectorAll('.fin-card-edit-btn').length, 3);
    assert.equal(document.querySelectorAll('.fin-card-del-btn').length, 4);
});

test('Financeiro visualizar:false: redirect para o Dashboard antes de renderizar', async () => {
    const harness = setup({ matriz: { financeiro: { visualizar: false, criar: false, editar: false, excluir: false } } });
    await importFresh(MOD_URL);

    assert.match(harness.getCapturedHref(), /dashboard\/index\.html/);
    assert.equal(harness.document.getElementById('pagar-lista').innerHTML, '');
});

test('Financeiro admin legado: bypass total independente da matriz', async () => {
    const { document } = setup({ matriz: { financeiro: { visualizar: false, criar: false, editar: false, excluir: false } }, adminLegado: true });
    await importFresh(MOD_URL);

    assert.notEqual(document.getElementById('btn-nova-pagar').style.display, 'none');
    assert.equal(document.querySelectorAll('.fin-card-edit-btn').length, 3);
});

test('Financeiro: marcar como pago (editar) só some quando editar=false, mesmo com item já pago não aparece', async () => {
    const { document } = setup({ matriz: { financeiro: { visualizar: true, criar: true, editar: true, excluir: true } } });
    fsMock.__seed('financeiro_pagar', 'pag_2', { descricao: 'Já pago', categoria: 'Outro', vencimento: '2026-07-01', valor: 100, status: 'pago' });
    await importFresh(MOD_URL);

    // pag_1 (pendente) tem botão marcar; pag_2 (pago) não tem, mesmo com editar=true
    assert.equal(document.querySelectorAll('.fin-btn-marcar').length, 3);
});
