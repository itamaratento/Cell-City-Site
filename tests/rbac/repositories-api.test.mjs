// Testes da API padronizada da Camada Repository (P2.3.2, 2026-07-16).
// Importa as factories REAIS (base.repository.js / base.repository.tenant.js)
// via tests/rbac/loader.mjs — só a borda do Firestore (firebase/client.js)
// é mockada, mesmo princípio dos demais testes desta pasta.
// Rodar: node --import ./tests/rbac/register-loader.mjs --test tests/rbac/repositories-api.test.mjs
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createRepository } from '../../CRM/repositories/base.repository.js';
import { createTenantRepository } from '../../CRM/repositories/base.repository.tenant.js';
import { setTenant } from '../../CRM/shared/tenant-context.js';
import { __reset } from './mocks/firestore-mock.js';

beforeEach(() => __reset());

function novoRepo() { return createRepository('teste_padrao'); }
function novoRepoTenant() { return createTenantRepository('teste_padrao_tenant'); }

test('newId() retorna string nas DUAS factories (bugfix tenant: retornava objeto)', () => {
    assert.equal(typeof novoRepo().newId(), 'string');
    assert.equal(typeof novoRepoTenant().newId(), 'string');
});

test('API legada em inglês continua intacta (nenhum consumidor atual quebra)', async () => {
    const repo = novoRepo();
    for (const m of ['list', 'getById', 'create', 'set', 'update', 'remove', 'onChange', 'onDocChange', 'newId']) {
        assert.equal(typeof repo[m], 'function', `método legado ${m} sumiu`);
    }
    await repo.set('a', { nome: 'legado' });
    const d = await repo.getById('a');
    assert.equal(d.nome, 'legado'); // retorno cru, sem envelope
});

test('fluxo padronizado: criar → listar → buscarPorId → editar → contar → remover', async () => {
    const repo = novoRepo();

    const c = await repo.criar({ nome: 'Item 1', valor: 10 });
    assert.equal(c.ok, true);
    assert.ok(c.dados.id);

    const l = await repo.listar();
    assert.equal(l.ok, true);
    assert.equal(l.total, 1);
    assert.equal(l.origem, 'firestore');

    const b = await repo.buscarPorId(c.dados.id);
    assert.equal(b.ok, true);
    assert.equal(b.dados.nome, 'Item 1');

    const e = await repo.editar(c.dados.id, { valor: 20 });
    assert.equal(e.ok, true);
    assert.equal((await repo.buscarPorId(c.dados.id)).dados.valor, 20);

    const n = await repo.contar();
    assert.equal(n.ok, true);
    assert.equal(n.dados, 1);

    const r = await repo.remover(c.dados.id);
    assert.equal(r.ok, true);
    assert.equal((await repo.contar()).dados, 0);
});

test('envelope de erro: buscarPorId inexistente → ok:false + codigo nao-encontrado', async () => {
    const b = await novoRepo().buscarPorId('nao-existe');
    assert.equal(b.ok, false);
    assert.equal(b.dados, null);
    assert.equal(b.erro.operacao, 'buscarPorId');
    assert.equal(b.erro.codigo, 'nao-encontrado');
});

test('validar: rejeita payload não-objeto e validador customizado', async () => {
    const repo = novoRepo();
    assert.equal((await repo.criar(null)).ok, false);
    assert.equal((await repo.criar([1, 2])).ok, false);
    const v = await repo.criar({ nome: '' }, { validador: (d) => d.nome ? true : 'Nome obrigatório.' });
    assert.equal(v.ok, false);
    assert.equal(v.erro.mensagem, 'Nome obrigatório.');
    assert.equal((await repo.criar({ nome: 'ok' }, { validador: (d) => d.nome ? true : 'Nome obrigatório.' })).ok, true);
});

test('buscar/buscarPorFiltro/pesquisar filtram corretamente', async () => {
    const repo = novoRepo();
    await repo.set('1', { nome: 'Carregador Samsung', tipo: 'acessorio' });
    await repo.set('2', { nome: 'Tela iPhone', tipo: 'peca' });
    await repo.set('3', { nome: 'Carregador Motorola', tipo: 'acessorio' });

    const b = await repo.buscar('tipo', '==', 'acessorio');
    assert.equal(b.total, 2);

    const f = await repo.buscarPorFiltro([['tipo', '==', 'peca']]);
    assert.equal(f.total, 1);
    assert.equal(f.dados[0].nome, 'Tela iPhone');

    const p = await repo.pesquisar('nome', 'carregador');
    assert.equal(p.total, 2); // case-insensitive contains, em memória
});

test('listarPaginado: keyset por valor com temMais e cursor', async () => {
    const repo = novoRepo();
    for (let i = 1; i <= 5; i++) await repo.set(String(i), { seq: i });

    const p1 = await repo.listarPaginado({ orderByField: 'seq', pageSize: 2 });
    assert.equal(p1.ok, true);
    assert.equal(p1.total, 2);
    assert.equal(p1.temMais, true);
    assert.deepEqual(p1.dados.map(d => d.seq), [1, 2]);
    assert.equal(p1.cursor, 2);

    const p2 = await repo.listarPaginado({ orderByField: 'seq', pageSize: 2, cursor: p1.cursor });
    assert.deepEqual(p2.dados.map(d => d.seq), [3, 4]);
    assert.equal(p2.temMais, true);

    const p3 = await repo.listarPaginado({ orderByField: 'seq', pageSize: 2, cursor: p2.cursor });
    assert.deepEqual(p3.dados.map(d => d.seq), [5]);
    assert.equal(p3.temMais, false);

    const semOrder = await repo.listarPaginado({ pageSize: 2 });
    assert.equal(semOrder.ok, false);
    assert.equal(semOrder.erro.codigo, 'parametro-obrigatorio');
});

test('cache opt-in: segunda listagem vem do cache; criar/editar/remover invalidam', async () => {
    const repo = novoRepo();
    await repo.set('1', { nome: 'a' });

    const l1 = await repo.listar({ cacheTtlMs: 60000 });
    assert.equal(l1.origem, 'firestore');
    const l2 = await repo.listar({ cacheTtlMs: 60000 });
    assert.equal(l2.origem, 'cache');
    assert.equal(l2.total, 1);

    await repo.criar({ nome: 'b' }); // invalida
    const l3 = await repo.listar({ cacheTtlMs: 60000 });
    assert.equal(l3.origem, 'firestore');
    assert.equal(l3.total, 2);
});

test('tenant: criar() injeta empresa_id via factory tenant (delegação preservada)', async () => {
    // tenant-context REAL (não mockado) — simula sessão com tenant resolvido.
    setTenant({ tenantId: 'cellcity-master', tenantName: 'Cell City' });
    try {
        const repo = novoRepoTenant();
        const c = await repo.criar({ nome: 'doc tenant' });
        assert.equal(c.ok, true);
        const l = await repo.listar();
        assert.equal(l.total, 1);
        assert.equal(l.dados[0].empresa_id, 'cellcity-master');
    } finally {
        setTenant(null);
    }
});
