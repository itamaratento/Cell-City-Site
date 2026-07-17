// Testes de isolamento multiempresa — PS-6 (FASE 15 da certificação)
//
// Simula três empresas (empresa-a, empresa-b e cellcity-master) contra as
// Firestore Rules REAIS (CRM/firestore.rules, mesmo arquivo deployado) no
// emulador. Garante:
//   - Nenhuma empresa lê/lista/escreve dados de outra.
//   - empresa_id é imutável em update (não dá para "doar" ou "roubar" docs).
//   - Todo create nasce carimbado com a empresa do autor.
//   - admin é tenant-scoped em usuarios/; só master_admin atravessa.
//   - empresas/ só expõe o próprio doc de config.
//
// Rodar: npm test (dentro de tests/firestore-rules/)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'cellcity-tenant-test',
    firestore: {
      rules: readFileSync('../../CRM/firestore.rules', 'utf8'),
    },
  });

  // Cenário base: 3 empresas, 1 usuário de cada + 1 master_admin
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection('empresas').doc('empresa-a').set({ nome_fantasia: 'Empresa A', status: 'ativo' });
    await db.collection('empresas').doc('empresa-b').set({ nome_fantasia: 'Empresa B', status: 'ativo' });
    await db.collection('empresas').doc('cellcity-master').set({ nome_fantasia: 'Cell City', status: 'ativo' });

    await db.collection('usuarios').doc('user-a').set({ perfil: 'tecnico', empresa_id: 'empresa-a' });
    await db.collection('usuarios').doc('user-b').set({ perfil: 'tecnico', empresa_id: 'empresa-b' });
    await db.collection('usuarios').doc('admin-a').set({ perfil: 'admin', empresa_id: 'empresa-a' });
    await db.collection('usuarios').doc('admin-b').set({ perfil: 'admin', empresa_id: 'empresa-b' });
    await db.collection('usuarios').doc('master').set({ perfil: 'master_admin', empresa_id: 'cellcity-master' });

    await db.collection('clientes').doc('cli-a').set({ name: 'Cliente A', empresa_id: 'empresa-a' });
    await db.collection('clientes').doc('cli-b').set({ name: 'Cliente B', empresa_id: 'empresa-b' });
    await db.collection('os').doc('OS-A-1').set({ id: 'OS-A-1', clientName: 'A', status: 'aberto', empresa_id: 'empresa-a' });
    await db.collection('os').doc('OS-B-1').set({ id: 'OS-B-1', clientName: 'B', status: 'aberto', empresa_id: 'empresa-b' });
  });
});

after(async () => {
  await testEnv.cleanup();
});

const dbA = () => testEnv.authenticatedContext('user-a').firestore();
const dbB = () => testEnv.authenticatedContext('user-b').firestore();
const dbAdminA = () => testEnv.authenticatedContext('admin-a').firestore();
const dbMaster = () => testEnv.authenticatedContext('master').firestore();

// ── LEITURA ──────────────────────────────────────────────────

test('empresa A lê o próprio cliente → permitido', async () => {
  await assertSucceeds(dbA().collection('clientes').doc('cli-a').get());
});

test('empresa A lê cliente da empresa B → NEGADO', async () => {
  await assertFails(dbA().collection('clientes').doc('cli-b').get());
});

test('empresa A lista clientes com filtro da própria empresa → permitido', async () => {
  await assertSucceeds(dbA().collection('clientes').where('empresa_id', '==', 'empresa-a').get());
});

test('empresa A lista clientes filtrando pela empresa B → NEGADO', async () => {
  await assertFails(dbA().collection('clientes').where('empresa_id', '==', 'empresa-b').get());
});

test('empresa A lista clientes SEM filtro → NEGADO (isolamento não-provável)', async () => {
  await assertFails(dbA().collection('clientes').get());
});

test('master_admin lê cliente de qualquer empresa → permitido (suporte)', async () => {
  await assertSucceeds(dbMaster().collection('clientes').doc('cli-a').get());
  await assertSucceeds(dbMaster().collection('clientes').doc('cli-b').get());
  await assertSucceeds(dbMaster().collection('clientes').get());
});

// ── CREATE ───────────────────────────────────────────────────

test('empresa A cria cliente carimbado com a própria empresa → permitido', async () => {
  await assertSucceeds(dbA().collection('clientes').doc('cli-a-novo').set({ name: 'Novo A', empresa_id: 'empresa-a' }));
});

test('empresa A cria cliente carimbado com a empresa B → NEGADO (forja de tenant)', async () => {
  await assertFails(dbA().collection('clientes').doc('cli-forjado').set({ name: 'Forjado', empresa_id: 'empresa-b' }));
});

test('empresa A cria cliente SEM empresa_id → NEGADO (carimbo obrigatório)', async () => {
  await assertFails(dbA().collection('clientes').doc('cli-sem-empresa').set({ name: 'Sem Empresa' }));
});

test('master_admin cria doc para qualquer empresa → permitido (suporte)', async () => {
  await assertSucceeds(dbMaster().collection('clientes').doc('cli-b-suporte').set({ name: 'Criado pelo suporte', empresa_id: 'empresa-b' }));
});

// ── UPDATE ───────────────────────────────────────────────────

test('empresa A atualiza o próprio cliente (empresa_id inalterado) → permitido', async () => {
  await assertSucceeds(dbA().collection('clientes').doc('cli-a').update({ name: 'Cliente A v2' }));
});

test('empresa A atualiza cliente da empresa B → NEGADO', async () => {
  await assertFails(dbA().collection('clientes').doc('cli-b').update({ name: 'invadido' }));
});

test('empresa A tenta MOVER o próprio cliente para a empresa B → NEGADO (empresa_id imutável)', async () => {
  await assertFails(dbA().collection('clientes').doc('cli-a').update({ empresa_id: 'empresa-b' }));
});

test('empresa B tenta ROUBAR cliente da A reatribuindo empresa_id → NEGADO', async () => {
  await assertFails(dbB().collection('clientes').doc('cli-a').update({ empresa_id: 'empresa-b' }));
});

// ── DELETE (o bug do mesmaEmpresaWrite negava TODO delete) ──

test('empresa A exclui o próprio doc → permitido (regressão do delete corrigida)', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('clientes').doc('cli-a-del').set({ name: 'del', empresa_id: 'empresa-a' });
  });
  await assertSucceeds(dbA().collection('clientes').doc('cli-a-del').delete());
});

test('empresa A exclui doc da empresa B → NEGADO', async () => {
  await assertFails(dbA().collection('clientes').doc('cli-b').delete());
});

// ── OS (fluxo crítico) ───────────────────────────────────────

test('empresa A lista as próprias OS (com filtro) → permitido; da B → negado', async () => {
  await assertSucceeds(dbA().collection('os').where('empresa_id', '==', 'empresa-a').get());
  await assertFails(dbA().collection('os').where('empresa_id', '==', 'empresa-b').get());
});

test('empresa A cria OS da própria empresa → permitido; forjando B → negado', async () => {
  await assertSucceeds(dbA().collection('os').doc('OS-A-2').set({ id: 'OS-A-2', status: 'aberto', empresa_id: 'empresa-a' }));
  await assertFails(dbA().collection('os').doc('OS-FORJA').set({ id: 'OS-FORJA', status: 'aberto', empresa_id: 'empresa-b' }));
});

test('empresa A atualiza OS da empresa B → NEGADO', async () => {
  await assertFails(dbA().collection('os').doc('OS-B-1').update({ status: 'entregue' }));
});

// ── USUARIOS (RBAC tenant-scoped) ────────────────────────────

test('admin da empresa A lê usuário da própria empresa → permitido', async () => {
  await assertSucceeds(dbAdminA().collection('usuarios').doc('user-a').get());
});

test('admin da empresa A lê usuário da empresa B → NEGADO (PS-6: admin é tenant-scoped)', async () => {
  await assertFails(dbAdminA().collection('usuarios').doc('user-b').get());
});

test('admin da empresa A lista usuários com filtro da própria empresa → permitido; sem filtro → negado', async () => {
  await assertSucceeds(dbAdminA().collection('usuarios').where('empresa_id', '==', 'empresa-a').get());
  await assertFails(dbAdminA().collection('usuarios').get());
});

test('admin da empresa A cria usuário na própria empresa → permitido; na B → negado', async () => {
  await assertSucceeds(dbAdminA().collection('usuarios').doc('user-a2').set({ perfil: 'tecnico', empresa_id: 'empresa-a' }));
  await assertFails(dbAdminA().collection('usuarios').doc('user-b2').set({ perfil: 'tecnico', empresa_id: 'empresa-b' }));
});

test('admin da empresa A edita usuário da B → NEGADO; master_admin → permitido', async () => {
  await assertFails(dbAdminA().collection('usuarios').doc('user-b').update({ status: 'inativo' }));
  await assertSucceeds(dbMaster().collection('usuarios').doc('user-b').update({ status: 'ativo' }));
});

test('usuário comum não lista usuários de ninguém (nem da própria empresa)', async () => {
  // user-a é 'tecnico' — a exceção de list é só para admin/master_admin;
  // o Chat perde a lista de contatos para não-admins (pendência documentada).
  await assertFails(dbA().collection('usuarios').where('empresa_id', '==', 'empresa-a').get());
});

// ── EMPRESAS (config do tenant) ──────────────────────────────

test('empresa A lê a própria config → permitido; da B → negado; lista → negado', async () => {
  await assertSucceeds(dbA().collection('empresas').doc('empresa-a').get());
  await assertFails(dbA().collection('empresas').doc('empresa-b').get());
  await assertFails(dbA().collection('empresas').get());
});

test('admin da empresa A NÃO escreve na própria config (write é do operador) → negado', async () => {
  await assertFails(dbAdminA().collection('empresas').doc('empresa-a').update({ plano: 'enterprise' }));
});

test('master_admin escreve config de qualquer empresa → permitido; delete → negado (histórico)', async () => {
  await assertSucceeds(dbMaster().collection('empresas').doc('empresa-b').update({ status: 'ativo' }));
  await assertFails(dbMaster().collection('empresas').doc('empresa-b').delete());
});

// ── DOC LEGADO (transição pré-backfill) ──────────────────────
//
// ACHADO CRÍTICO desta homologação: a primeira versão de mesmaEmpresaRead()
// tinha um disjunto `resource.data.get('empresa_id', null) == null` para
// manter doc legado legível durante a transição. Provado (harness abaixo
// reproduziu isoladamente) que esse disjunto quebra a análise de
// "resultado potencial" do motor de Rules para QUERIES sem filtro: em vez
// de negar a lista inteira (comportamento seguro quando a regra não é
// provável para todo doc da coleção), o motor passou a devolver TODOS os
// documentos de TODAS as empresas para qualquer list()/get() sem
// where('empresa_id'==...) — vazamento total, não parcial. Removido da
// regra (ver comentário em CRM/firestore.rules::mesmaEmpresaRead).
//
// Consequência aceita, testada abaixo: doc sem empresa_id fica ILEGÍVEL
// (get E list) para staff comum — só master_admin consegue ler e
// reivindicar. Isso é seguro-por-padrão (nega em vez de vazar) e é
// compatível com a ordem de deploy já planejada: backfill (que inclui
// `usuarios`) roda e é validado ANTES destas Rules irem para produção —
// não deveria existir doc sem empresa_id quando esta regra valer.
test('doc legado sem empresa_id: GET negado para staff comum (fail-closed pós-correção)', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('clientes').doc('cli-legado').set({ name: 'Legado' });
  });
  await assertFails(dbA().collection('clientes').doc('cli-legado').get());
});

test('doc legado sem empresa_id: LIST sem filtro NÃO vaza (regressão do achado crítico)', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('clientes').doc('cli-legado-2').set({ name: 'Legado 2' });
  });
  // Antes da correção, esta chamada devolvia TODOS os clientes de TODAS
  // as empresas (empresa-a, empresa-b) — vazamento total.
  await assertFails(dbA().collection('clientes').get());
});

test('doc legado sem empresa_id: master_admin lê e reivindica; staff comum não reivindica', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('clientes').doc('cli-legado-3').set({ name: 'Legado 3' });
  });
  await assertSucceeds(dbMaster().collection('clientes').doc('cli-legado-3').get());
  await assertFails(dbA().collection('clientes').doc('cli-legado-3').update({ empresa_id: 'empresa-a' }));
  await assertSucceeds(dbMaster().collection('clientes').doc('cli-legado-3').update({ empresa_id: 'empresa-a' }));
});

// ── FINANCEIRO_CATEGORIAS/ITENS (achado A1, Auditoria Técnica
// Independente 2026-07-17) ────────────────────────────────────
//
// A regra desta subcoleção tinha um 3º disjunto `empresa_id do doc-pai
// == null → allow` — o mesmo padrão que a seção "DOC LEGADO" acima prova
// ser inseguro (reabre a coleção inteira para qualquer empresa), só que
// nunca tinha sido removido aqui. Nenhum teste cobria esta subcoleção
// antes desta correção — os testes abaixo fecham essa lacuna.
test('financeiro_categorias/itens: empresa A lê/escreve item da própria categoria → permitido', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    // Reusa o mesmo handle: chamar ctx.firestore() duas vezes no mesmo
    // callback trava as settings do SDK ("Firestore has already been
    // started") e derruba o seed antes de a rule ser avaliada.
    const seed = ctx.firestore();
    await seed.collection('financeiro_categorias').doc('cat-a').set({ nome: 'Cat A', empresa_id: 'empresa-a' });
    await seed.collection('financeiro_categorias').doc('cat-a').collection('itens').doc('item-a').set({ nome: 'Item A' });
  });
  await assertSucceeds(dbA().collection('financeiro_categorias').doc('cat-a').collection('itens').doc('item-a').get());
  await assertSucceeds(dbA().collection('financeiro_categorias').doc('cat-a').collection('itens').doc('item-a-novo').set({ nome: 'Novo' }));
});

test('financeiro_categorias/itens: empresa A lê/escreve item de categoria da empresa B → NEGADO', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const seed = ctx.firestore();
    await seed.collection('financeiro_categorias').doc('cat-b').set({ nome: 'Cat B', empresa_id: 'empresa-b' });
    await seed.collection('financeiro_categorias').doc('cat-b').collection('itens').doc('item-b').set({ nome: 'Item B' });
  });
  await assertFails(dbA().collection('financeiro_categorias').doc('cat-b').collection('itens').doc('item-b').get());
  await assertFails(dbA().collection('financeiro_categorias').doc('cat-b').collection('itens').doc('item-b-forja').set({ nome: 'Forja' }));
});

test('financeiro_categorias/itens: categoria-pai legada (sem empresa_id) → item NEGADO para staff comum, PERMITIDO para master_admin (regressão do achado A1)', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const seed = ctx.firestore();
    await seed.collection('financeiro_categorias').doc('cat-legado').set({ nome: 'Cat Legado' });
    await seed.collection('financeiro_categorias').doc('cat-legado').collection('itens').doc('item-legado').set({ nome: 'Item Legado' });
  });
  // Antes da correção do achado A1, esta leitura era PERMITIDA para
  // QUALQUER empresa liberada — vazamento cross-tenant via categoria
  // ainda não migrada. Mesma direção segura-por-padrão já usada no
  // resto do arquivo: nega em vez de vazar.
  await assertFails(dbA().collection('financeiro_categorias').doc('cat-legado').collection('itens').doc('item-legado').get());
  await assertFails(dbB().collection('financeiro_categorias').doc('cat-legado').collection('itens').doc('item-legado').get());
  await assertSucceeds(dbMaster().collection('financeiro_categorias').doc('cat-legado').collection('itens').doc('item-legado').get());
});

// ── PRE_OS (achado crítico, Auditoria Técnica Independente 2026-07-17)
// ───────────────────────────────────────────────────────────────────
// pre_os não tinha NENHUM gate de tenant em read/update/delete — a
// única coleção de negócio deste arquivo nessa condição. Cliente
// continua criando sem login (`allow create: if true`), mas agora
// carimba empresa_id (abrir-atendimento.html); read/update/delete
// passam a exigir mesmaEmpresaRead()/empresaImutavel() como o resto
// do arquivo.
test('pre_os: cliente cria sem login (create público, comportamento preservado)', async () => {
  await assertSucceeds(
    testEnv.unauthenticatedContext().firestore()
      .collection('pre_os').doc('pre-publico').set({ problema: 'Tela quebrada', empresa_id: 'empresa-a' })
  );
});

test('pre_os: empresa A lê/atualiza a própria pré-OS → permitido', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('pre_os').doc('preos-a').set({ problema: 'Tela', empresa_id: 'empresa-a', status: 'AGUARDANDO_CONVERSAO' });
  });
  await assertSucceeds(dbA().collection('pre_os').doc('preos-a').get());
  await assertSucceeds(dbA().collection('pre_os').doc('preos-a').update({ status: 'VISUALIZADO' }));
});

test('pre_os: empresa A lê/atualiza/exclui pré-OS da empresa B → NEGADO (achado crítico corrigido)', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('pre_os').doc('preos-b').set({ problema: 'Tela', empresa_id: 'empresa-b', status: 'AGUARDANDO_CONVERSAO' });
  });
  // Antes da correção, esta leitura/escrita era PERMITIDA para qualquer
  // empresa liberada — o próprio Dashboard (dashboard-alertas.js,
  // dashboard-alertas-panel.js) consultava/escutava pre_os sem filtro
  // de tenant, tornando o vazamento efetivamente explorável pela UI.
  await assertFails(dbA().collection('pre_os').doc('preos-b').get());
  await assertFails(dbA().collection('pre_os').doc('preos-b').update({ status: 'VISUALIZADO' }));
  await assertFails(dbA().collection('pre_os').doc('preos-b').delete());
});

test('pre_os: empresa A lista com filtro da própria empresa → permitido; sem filtro → negado', async () => {
  await assertSucceeds(dbA().collection('pre_os').where('empresa_id', '==', 'empresa-a').get());
  await assertFails(dbA().collection('pre_os').get());
});
