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
    });
  });
}

async function seedUsuario(uid, perfil) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('usuarios').doc(uid).set({ perfil });
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

test('list de os com staff real (perfil != pendente) → permitido (não-regressão)', async () => {
  await seedOS();
  await seedUsuario('staff-uid-2', 'admin');
  const db = testEnv.authenticatedContext('staff-uid-2').firestore();
  await assertSucceeds(db.collection('os').get());
});

test('list de os com perfil pendente → permitido (list NÃO fechou nesta sprint — ver comentário em CRM/firestore.rules)', async () => {
  // `list` em `os` fica de fora do FECHAMENTO Sprint 1b de propósito:
  // doLogin()/_listenOS() (CRM/pages/portal-cliente/portal.js) ainda fazem
  // `query(os).where(phoneDigits==...)` direto do client SDK, sempre com
  // sessão anônima (sem doc usuarios/{uid}). Tentar fechar `list` aqui
  // quebrou o login de todo cliente real numa homologação real desta sprint
  // (revertido) — fica registrado como pendência para uma sprint futura que
  // migre login/listener para outro mecanismo.
  await seedOS();
  await seedUsuario('pendente-uid', 'pendente');
  const db = testEnv.authenticatedContext('pendente-uid').firestore();
  await assertSucceeds(db.collection('os').get());
});

test('list de os com sessão anônima → permitido (doLogin()/_listenOS() dependem disto — não migrado nesta sprint)', async () => {
  await seedOS();
  const db = testEnv.authenticatedContext('anon-uid-2', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  await assertSucceeds(db.collection('os').get());
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
    await assertSucceeds(db.collection(colecao).add({ teste: true }));
  });

  test(`read/write em ${colecao} sem autenticação → negado (não-regressão)`, async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection(colecao).add({ teste: true }));
  });
}
