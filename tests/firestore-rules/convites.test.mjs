// Sprint 4 · F1 — Firestore Rules da coleção convites (+ regressão BL-006)
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

const CONVITE_A = {
  empresa_id: 'empresa-a',
  email: 'novo@a.com',
  email_normalizado: 'novo@a.com',
  token_hash: 'hash-a-pendente',
  token_prefix: 'abc12345',
  status: 'pendente',
  perfil_operacional_id: 'tecnico',
  criado_por: 'admin-a',
  criado_em: new Date('2026-07-27T12:00:00Z'),
  expira_em: new Date('2026-08-03T12:00:00Z'),
};

const CONVITE_B = {
  ...CONVITE_A,
  empresa_id: 'empresa-b',
  email: 'novo@b.com',
  email_normalizado: 'novo@b.com',
  token_hash: 'hash-b-pendente',
  criado_por: 'admin-b',
};

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'cellcity-convites-test',
    firestore: {
      rules: readFileSync('../../CRM/firestore.rules', 'utf8'),
    },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection('empresas').doc('empresa-a').set({ nome_fantasia: 'Empresa A', status: 'ativo' });
    await db.collection('empresas').doc('empresa-b').set({ nome_fantasia: 'Empresa B', status: 'ativo' });
    await db.collection('empresas').doc('cellcity-master').set({ nome_fantasia: 'Cell City', status: 'ativo' });

    await db.collection('usuarios').doc('user-a').set({ perfil: 'tecnico', empresa_id: 'empresa-a', status: 'ativo' });
    await db.collection('usuarios').doc('admin-a').set({ perfil: 'admin', empresa_id: 'empresa-a', status: 'ativo' });
    await db.collection('usuarios').doc('admin-b').set({ perfil: 'admin', empresa_id: 'empresa-b', status: 'ativo' });
    await db.collection('usuarios').doc('master').set({ perfil: 'master_admin', empresa_id: 'cellcity-master', status: 'ativo' });
    await db.collection('usuarios').doc('pendente-a').set({
      perfil: 'pendente',
      empresa_id: 'cellcity-master',
      status: 'ativo',
    });

    await db.collection('convites').doc('conv-a1').set(CONVITE_A);
    await db.collection('convites').doc('conv-b1').set(CONVITE_B);
  });
});

after(async () => {
  await testEnv.cleanup();
});

const dbTecnicoA = () => testEnv.authenticatedContext('user-a').firestore();
const dbAdminA = () => testEnv.authenticatedContext('admin-a').firestore();
const dbAdminB = () => testEnv.authenticatedContext('admin-b').firestore();
const dbMaster = () => testEnv.authenticatedContext('master').firestore();
const dbPendente = () => testEnv.authenticatedContext('pendente-a').firestore();
const dbAnon = () => testEnv.unauthenticatedContext().firestore();

// ── LEITURA ──────────────────────────────────────────────────

test('S4-F1: admin A lê convite da própria empresa → permitido', async () => {
  await assertSucceeds(dbAdminA().collection('convites').doc('conv-a1').get());
});

test('S4-F1: admin A lê convite da empresa B → NEGADO', async () => {
  await assertFails(dbAdminA().collection('convites').doc('conv-b1').get());
});

test('S4-F1: admin A lista convites filtrando a própria empresa → permitido', async () => {
  await assertSucceeds(
    dbAdminA().collection('convites').where('empresa_id', '==', 'empresa-a').get(),
  );
});

test('S4-F1: admin A lista convites da empresa B → NEGADO', async () => {
  await assertFails(
    dbAdminA().collection('convites').where('empresa_id', '==', 'empresa-b').get(),
  );
});

test('S4-F1: admin A lista convites SEM filtro → NEGADO', async () => {
  await assertFails(dbAdminA().collection('convites').get());
});

test('S4-F1: técnico da empresa A NÃO lê convites (só Admin/Owner) → NEGADO', async () => {
  await assertFails(dbTecnicoA().collection('convites').doc('conv-a1').get());
  await assertFails(
    dbTecnicoA().collection('convites').where('empresa_id', '==', 'empresa-a').get(),
  );
});

test('S4-F1: master_admin lê convite de qualquer empresa → permitido', async () => {
  await assertSucceeds(dbMaster().collection('convites').doc('conv-a1').get());
  await assertSucceeds(dbMaster().collection('convites').doc('conv-b1').get());
});

test('S4-F1: perfil pendente NÃO lê convites → NEGADO', async () => {
  await assertFails(dbPendente().collection('convites').doc('conv-a1').get());
});

test('S4-F1: anônimo NÃO lê convites → NEGADO', async () => {
  await assertFails(dbAnon().collection('convites').doc('conv-a1').get());
});

// ── ESCRITA CLIENT (sempre negada — só Admin SDK / F2) ────────

test('S4-F1: admin A NÃO cria convite pelo client → NEGADO', async () => {
  await assertFails(
    dbAdminA().collection('convites').doc('conv-forjado').set({
      ...CONVITE_A,
      email: 'forjado@a.com',
      email_normalizado: 'forjado@a.com',
      token_hash: 'hash-forjado',
    }),
  );
});

test('S4-F1: admin A NÃO atualiza status/token_hash pelo client → NEGADO', async () => {
  await assertFails(dbAdminA().collection('convites').doc('conv-a1').update({ status: 'aceito' }));
  await assertFails(
    dbAdminA().collection('convites').doc('conv-a1').update({ token_hash: 'outro' }),
  );
});

test('S4-F1: admin A NÃO apaga convite pelo client → NEGADO', async () => {
  await assertFails(dbAdminA().collection('convites').doc('conv-a1').delete());
});

test('S4-F1: master_admin NÃO escreve convites pelo client (só CF) → NEGADO', async () => {
  await assertFails(
    dbMaster().collection('convites').doc('conv-master').set({
      ...CONVITE_A,
      empresa_id: 'empresa-a',
      token_hash: 'hash-master',
    }),
  );
});

test('S4-F1: convidado/técnico NÃO cria convite → NEGADO', async () => {
  await assertFails(
    dbTecnicoA().collection('convites').doc('conv-tec').set({
      ...CONVITE_A,
      token_hash: 'hash-tec',
    }),
  );
});

// ── REGRESSÃO BL-006 (usuarios — campos privilegiados) ───────

test('S4-F1 regressão BL-006: técnico NÃO escala próprio perfil → NEGADO', async () => {
  await assertFails(
    dbTecnicoA().collection('usuarios').doc('user-a').update({ perfil: 'admin' }),
  );
  await assertFails(
    dbTecnicoA().collection('usuarios').doc('user-a').update({
      perfil_operacional_id: 'admin-op',
    }),
  );
  await assertFails(
    dbTecnicoA().collection('usuarios').doc('user-a').update({ empresa_id: 'empresa-b' }),
  );
  await assertFails(
    dbTecnicoA().collection('usuarios').doc('user-a').update({ status: 'inativo' }),
  );
});

test('S4-F1 regressão BL-006: técnico pode atualizar campo não privilegiado → permitido', async () => {
  await assertSucceeds(
    dbTecnicoA().collection('usuarios').doc('user-a').update({ nome_exibicao: 'Técnico A' }),
  );
});

test('S4-F1: índices compostos declarados no repo (smoke estático)', () => {
  const idx = JSON.parse(readFileSync('../../CRM/firestore.indexes.json', 'utf8'));
  const convites = idx.indexes.filter((i) => i.collectionGroup === 'convites');
  assert.equal(convites.length, 2);
  const paths = convites.map((i) => i.fields.map((f) => f.fieldPath).join('+'));
  assert.ok(paths.includes('empresa_id+status+criado_em'));
  assert.ok(paths.includes('empresa_id+email_normalizado+status'));
});
