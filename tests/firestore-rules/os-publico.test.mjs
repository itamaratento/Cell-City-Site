// Testes de Firestore Rules — Sprint 1a (achado crítico da auditoria de
// 2026-07-04: `os/{osId}` tinha `allow get: if true`, expondo o documento
// inteiro — senha/padrão/foto de desbloqueio, endereço, IMEI — para
// qualquer visitante sem login). Cobre só o diff desta sprint (a regra
// `get` de `os` e a não-regressão de `list`/`update`), não o resto de
// `CRM/firestore.rules`.
//
// IMPORTANTE — não executado nesta sessão: este ambiente não tem
// node/npm/firebase-tools instalados. Para rodar de verdade:
//   cd tests/firestore-rules && npm install && npm test
// (`npm test` já invoca `firebase emulators:exec --only firestore`, que
// precisa do Firebase CLI autenticado — mesmo requisito dos testes de
// Rules já usados na Fase 1 do projeto, 18/18 casos antes do primeiro
// deploy de Usuários e Permissões). A homologação formal desta sprint
// depende dessa execução real, não só da leitura deste arquivo.

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

test('list de os com perfil pendente → permitido (reconciliação 2026-07-05, trade-off aceito até Sprint 1b)', async () => {
  // Antes da reconciliação, esta checagem negava (temAcessoLiberado() barrava
  // perfil 'pendente'). O HOTFIX P0 de produção (commit 60173b7) removeu essa
  // checagem de list/create/update/delete em `os` porque aprovar/recusar
  // orçamento (via update, sessão anônima do cliente) e a própria Consulta de
  // OS pública (via list) dependem de request.auth != null, sem doc
  // usuarios/{uid}. Reconciliar Sprint 1a com o hotfix significa aceitar,
  // conscientemente, que uma conta 'pendente' também consegue `list` em `os`
  // até a Sprint 1b migrar essas operações para Cloud Function.
  await seedOS();
  await seedUsuario('pendente-uid', 'pendente');
  const db = testEnv.authenticatedContext('pendente-uid').firestore();
  await assertSucceeds(db.collection('os').get());
});

test('list de os com sessão anônima → permitido (Consulta de OS pública, produção usa este caminho hoje)', async () => {
  await seedOS();
  const db = testEnv.authenticatedContext('anon-uid-2', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  await assertSucceeds(db.collection('os').get());
});

test('update em os/{osId} sem autenticação → negado', async () => {
  await seedOS();
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(db.collection('os').doc(OS_ID).update({ status: 'entregue' }));
});

test('update em os/{osId} com sessão anônima → permitido (aprovar/recusar orçamento, Consulta de OS e Portal)', async () => {
  await seedOS();
  const db = testEnv.authenticatedContext('anon-uid-3', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  await assertSucceeds(db.collection('os').doc(OS_ID).update({ status: 'orcamento_aprovado' }));
});

// ── Reconciliação 2026-07-05: as 5 coleções do Portal do Cliente também
// tiveram `temAcessoLiberado()` removido pelo mesmo motivo do /os acima —
// cliente usa sessão anônima, nunca tem doc usuarios/{uid}. Fix definitivo:
// Sprint 1b (Cloud Functions).
for (const colecao of ['avaliacoes', 'mensagens_portal', 'portal_eventos', 'agendamentos', 'solicitacoes_diagnostico']) {
  test(`read/write em ${colecao} com sessão anônima → permitido (reconciliação 2026-07-05)`, async () => {
    const db = testEnv.authenticatedContext(`anon-${colecao}`, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
    await assertSucceeds(db.collection(colecao).add({ teste: true, criadoEm: new Date().toISOString() }));
  });

  test(`read/write em ${colecao} sem autenticação → negado (não-regressão)`, async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection(colecao).add({ teste: true }));
  });
}
