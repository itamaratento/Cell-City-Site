// Testes de Firestore Rules — Sprint 1a (achado crítico da auditoria de
// 2026-07-04: `os/{osId}` tinha `allow get: if true`, expondo o documento
// inteiro — senha/padrão/foto de desbloqueio, endereço, IMEI — para
// qualquer visitante sem login) + FECHAMENTO Sprint 1b (2026-07-06):
// `os` (list/create/update/delete) e as 5 coleções do Portal
// (avaliacoes/mensagens_portal/portal_eventos/agendamentos/
// solicitacoes_diagnostico) tiveram `temAcessoLiberado()` restaurado depois
// que o cliente do Portal migrou para Cloud Functions (Admin SDK, ignora
// estas Rules) — sessão anônima não precisa mais de acesso direto, e a
// brecha de conta 'pendente' nessas 6 coleções (reaberta pela reconciliação
// de 2026-07-05) está fechada de novo.

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
    projectId: 'cellcity-rules-test',
    firestore: {
      rules: readFileSync('../../CRM/firestore.rules', 'utf8'),
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

const OS_ID = 'OS-0001';

async function seedOS() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('os').doc(OS_ID).set({
      id: OS_ID,
      clientName: 'Cliente Teste',
      phoneDigits: '61999998888',
      status: 'em_reparo',
      // Campos que NUNCA deveriam ser lidos publicamente — presentes só
      // para provar que a Rule fechada bloqueia o get() inteiro, não
      // porque algum teste abaixo tente ler estes valores.
      password: 'segredo-do-aparelho',
      endereco: 'Rua Teste, 123',
      empresa_id: 'cellcity-master',
    });
  });
}

async function seedUsuario(uid, perfil, empresa = 'cellcity-master') {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    // PS-6: todo usuário tem empresa_id (backfill garantiu isso nos dados
    // reais; o escape de usuário-sem-empresa foi removido das Rules).
    await ctx.firestore().collection('usuarios').doc(uid).set({ perfil, empresa_id: empresa });
  });
}

test('get de os/{osId} sem autenticação → negado', async () => {
  await seedOS();
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(db.collection('os').doc(OS_ID).get());
});

test('get de os/{osId} com sessão anônima → negado', async () => {
  await seedOS();
  const db = testEnv.authenticatedContext('anon-uid', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  await assertFails(db.collection('os').doc(OS_ID).get());
});

test('get de os/{osId} com staff real autenticado → negado (Rule fecha para todos; staff usa list)', async () => {
  await seedOS();
  await seedUsuario('staff-uid', 'tecnico');
  const db = testEnv.authenticatedContext('staff-uid').firestore();
  await assertFails(db.collection('os').doc(OS_ID).get());
});

test('list de os sem autenticação → negado (não-regressão)', async () => {
  await seedOS();
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(db.collection('os').get());
});

// PS-6: `list` de /os FECHOU. O Portal migrou login/listener para
// consultarOSPorTelefonePublica (Cloud Function) — a dependência que
// mantinha o list aberto deixou de existir. Equipe lista com filtro de
// empresa (provável para as Rules); sem filtro, o Firestore não consegue
// provar o isolamento e nega.
test('list de os com staff real e filtro de empresa → permitido (PS-6)', async () => {
  await seedOS();
  await seedUsuario('staff-uid-2', 'admin');
  const db = testEnv.authenticatedContext('staff-uid-2').firestore();
  await assertSucceeds(db.collection('os').where('empresa_id', '==', 'cellcity-master').get());
});

test('list de os com staff real SEM filtro de empresa → negado (PS-6 — isolamento não-provável)', async () => {
  await seedOS();
  await seedUsuario('staff-uid-3', 'admin');
  const db = testEnv.authenticatedContext('staff-uid-3').firestore();
  await assertFails(db.collection('os').get());
});

test('list de os com perfil pendente → negado (PS-6 — fechado junto com a migração do Portal)', async () => {
  await seedOS();
  await seedUsuario('pendente-uid', 'pendente');
  const db = testEnv.authenticatedContext('pendente-uid').firestore();
  await assertFails(db.collection('os').get());
});

test('list de os com sessão anônima → negado (PS-6 — Portal usa só Cloud Function)', async () => {
  await seedOS();
  const db = testEnv.authenticatedContext('anon-uid-2', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  await assertFails(db.collection('os').get());
  await assertFails(db.collection('os').where('phoneDigits', '==', '61999998888').get());
});

test('update em os/{osId} sem autenticação → negado', async () => {
  await seedOS();
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(db.collection('os').doc(OS_ID).update({ status: 'entregue' }));
});

test('update em os/{osId} com sessão anônima → negado (FECHAMENTO Sprint 1b — aprovar/recusar orçamento agora é portalResponderOrcamento)', async () => {
  await seedOS();
  const db = testEnv.authenticatedContext('anon-uid-3', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  await assertFails(db.collection('os').doc(OS_ID).update({ status: 'orcamento_aprovado' }));
});

test('update em os/{osId} com perfil pendente → negado (FECHAMENTO Sprint 1b)', async () => {
  await seedOS();
  await seedUsuario('pendente-update-uid', 'pendente');
  const db = testEnv.authenticatedContext('pendente-update-uid').firestore();
  await assertFails(db.collection('os').doc(OS_ID).update({ status: 'orcamento_aprovado' }));
});

test('update em os/{osId} com staff aprovado → permitido (não-regressão — módulo de OS interno)', async () => {
  await seedOS();
  await seedUsuario('staff-aprovado', 'tecnico');
  const db = testEnv.authenticatedContext('staff-aprovado').firestore();
  await assertSucceeds(db.collection('os').doc(OS_ID).update({ status: 'em_reparo' }));
});

// ── FECHAMENTO Sprint 1b (2026-07-06): as 5 coleções do Portal do Cliente
// migraram para Cloud Functions (functions/index.js, Admin SDK, ignoram
// estas Rules) — a checagem de perfil volta a valer para qualquer acesso
// direto via client SDK, fechando a brecha de conta 'pendente' reaberta
// pela reconciliação de 2026-07-05.
for (const colecao of ['avaliacoes', 'mensagens_portal', 'portal_eventos', 'agendamentos', 'solicitacoes_diagnostico']) {
  test(`read/write em ${colecao} com sessão anônima → negado (FECHAMENTO Sprint 1b — cliente do Portal usa só Cloud Function)`, async () => {
    const db = testEnv.authenticatedContext(`anon-${colecao}`, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
    await assertFails(db.collection(colecao).add({ teste: true, criadoEm: new Date().toISOString() }));
  });

  test(`read/write em ${colecao} com perfil pendente → negado (FECHAMENTO Sprint 1b)`, async () => {
    await seedUsuario(`pendente-${colecao}`, 'pendente');
    const db = testEnv.authenticatedContext(`pendente-${colecao}`).firestore();
    await assertFails(db.collection(colecao).add({ teste: true }));
  });

  test(`read/write em ${colecao} com staff aprovado → permitido (não-regressão — dashboard/central de alertas ainda lê direto)`, async () => {
    await seedUsuario(`staff-${colecao}`, 'admin');
    const db = testEnv.authenticatedContext(`staff-${colecao}`).firestore();
    // PS-6: create exige carimbo de empresa_id (tData() nos módulos)
    await assertSucceeds(db.collection(colecao).add({ teste: true, empresa_id: 'cellcity-master' }));
  });

  test(`read/write em ${colecao} sem autenticação → negado (não-regressão)`, async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection(colecao).add({ teste: true }));
  });
}

// ── HARDENING (auditoria 2026-07-06, plans/AUDITORIA_GERAL_20260706.md):
// diario_eventos/alertas_usuario/chips_cadastros/contas_numeros eram usadas
// por módulos internos ativos sem nenhuma regra — falhavam fechado. Mesmo
// padrão de temAcessoLiberado() já usado nas demais coleções internas.
for (const colecao of ['diario_eventos', 'alertas_usuario', 'chips_cadastros', 'contas_numeros', 'central_organizacao', 'backup_logs']) {
  test(`read/write em ${colecao} com staff aprovado → permitido (hardening 2026-07-06)`, async () => {
    await seedUsuario(`staff-hard-${colecao}`, 'admin');
    const db = testEnv.authenticatedContext(`staff-hard-${colecao}`).firestore();
    await assertSucceeds(db.collection(colecao).add({ teste: true, empresa_id: 'cellcity-master' }));
  });

  test(`read/write em ${colecao} com perfil pendente → negado (hardening 2026-07-06)`, async () => {
    await seedUsuario(`pendente-hard-${colecao}`, 'pendente');
    const db = testEnv.authenticatedContext(`pendente-hard-${colecao}`).firestore();
    await assertFails(db.collection(colecao).add({ teste: true }));
  });

  test(`read/write em ${colecao} sem autenticação → negado (hardening 2026-07-06)`, async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection(colecao).add({ teste: true }));
  });
}

// catalogo_config tem forma diferente (get público do doc `geral`, igual a
// /config) — testes dedicados em vez do loop genérico acima.
test('get de catalogo_config/geral sem autenticação → permitido (catálogo público)', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    // PS-6: empresa_id presente desde o seed — pós-fix da FASE 15 (achado
    // crítico do vazamento de list sem filtro), docs sem empresa_id ficam
    // ilegíveis para staff comum até serem reivindicados (ver
    // tenant-isolamento.test.mjs).
    await ctx.firestore().collection('catalogo_config').doc('geral').set({ ativo: true, empresa_id: 'cellcity-master' });
  });
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(db.collection('catalogo_config').doc('geral').get());
});

test('write em catalogo_config/geral sem autenticação → negado', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(db.collection('catalogo_config').doc('geral').set({ ativo: false }));
});

test('write em catalogo_config/geral com staff aprovado → permitido', async () => {
  await seedUsuario('staff-catalogo-config', 'admin');
  const db = testEnv.authenticatedContext('staff-catalogo-config').firestore();
  await assertSucceeds(db.collection('catalogo_config').doc('geral').set({ ativo: true, empresa_id: 'cellcity-master' }));
});

// FASE 4.1 — config: whitelist pública (impressao/horarios); demais docs fechados
test('config/impressao: get anônimo → permitido (whitelist Portal/garantia)', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('config').doc('impressao').set({ loja: { nome: 'Cell City' } });
  });
  await assertSucceeds(testEnv.unauthenticatedContext().firestore().collection('config').doc('impressao').get());
});

test('config/crm_pre_os_counter: get anônimo → NEGADO (FASE 4.1)', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('config').doc('crm_pre_os_counter').set({ value: 1 });
  });
  await assertFails(testEnv.unauthenticatedContext().firestore().collection('config').doc('crm_pre_os_counter').get());
});

test('config/crm_pre_os_counter: get staff liberado → permitido', async () => {
  await seedUsuario('staff-config', 'tecnico');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('config').doc('crm_pre_os_counter').set({ value: 1 });
  });
  await assertSucceeds(testEnv.authenticatedContext('staff-config').firestore().collection('config').doc('crm_pre_os_counter').get());
});

// ── REVISÃO 2026-07-10: os módulos Chat (Sprint 15), Compras (Sprint 13),
// Fechamento Mensal (Sprint 10) e Cadastro de Fornecedores (2026-07-09)
// foram commitados sem rule para as suas coleções — caíam no deny-by-default
// e quebravam em runtime. Mesmo padrão de temAcessoLiberado() das demais
// coleções internas; crm_templates teve a leitura apertada para o mesmo
// padrão (era `auth != null`, incluía sessão anônima do Portal).
for (const colecao of ['chat_mensagens', 'compras_pedidos', 'financeiro_fechamentos', 'fornecedores_cadastro', 'crm_templates']) {
  test(`read/write em ${colecao} com staff aprovado → permitido (revisão 2026-07-10)`, async () => {
    await seedUsuario(`staff-rev-${colecao}`, 'admin');
    const db = testEnv.authenticatedContext(`staff-rev-${colecao}`).firestore();
    await assertSucceeds(db.collection(colecao).add({ teste: true, empresa_id: 'cellcity-master' }));
  });

  test(`read/write em ${colecao} com perfil pendente → negado (revisão 2026-07-10)`, async () => {
    await seedUsuario(`pendente-rev-${colecao}`, 'pendente');
    const db = testEnv.authenticatedContext(`pendente-rev-${colecao}`).firestore();
    await assertFails(db.collection(colecao).add({ teste: true }));
  });

  test(`read/write em ${colecao} com sessão anônima → negado (revisão 2026-07-10)`, async () => {
    const db = testEnv.authenticatedContext(`anon-rev-${colecao}`, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
    await assertFails(db.collection(colecao).add({ teste: true }));
  });

  test(`read/write em ${colecao} sem autenticação → negado (revisão 2026-07-10)`, async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection(colecao).add({ teste: true }));
  });
}

// Mensagens do Chat são imutáveis por Rule (update/delete: false) — o
// módulo só lê e adiciona (chat.js usa addDoc/onSnapshot, nunca edita).
test('update em chat_mensagens com staff aprovado → negado (mensagens imutáveis)', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('chat_mensagens').doc('msg1').set({ texto: 'oi' });
  });
  await seedUsuario('staff-chat-upd', 'admin');
  const db = testEnv.authenticatedContext('staff-chat-upd').firestore();
  await assertFails(db.collection('chat_mensagens').doc('msg1').update({ texto: 'editado' }));
});
