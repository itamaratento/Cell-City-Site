// Testes da Cloud Function saasOnboardingCriarEmpresa — Sprint 3 Onboarding
// Rodar: cd tests/functions && node ../../node_modules/.bin/firebase
// emulators:exec --only firestore --project cellcity-rules-test
// "node --test saas-onboarding.test.mjs"

import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as fns from '../../functions/index.js';

const require = createRequire(new URL('../../functions/index.js', import.meta.url));
const admin = require('firebase-admin');
const db = admin.firestore();

after(async () => {
  await admin.app().delete();
});

async function limpar() {
  // saas_email_index incluído (achado da missão autônoma 2026-07-17):
  // reserva atômica de e-mail contra a corrida do dedup — sem limpar
  // aqui, o teste de dedup "reaproveita" a reserva do teste anterior.
  for (const col of ['empresas', 'saas_eventos', 'saas_email_index']) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

beforeEach(limpar);

function comCode(codeEsperado) {
  return (err) => err.code === codeEsperado;
}

const payloadValido = {
  nome: 'Empresa Teste Sprint3',
  seuNome: 'Operador Teste',
  email: 'sprint3-onboard@test.cellcity.invalid',
  whatsapp: '62999887766',
  plano: 'basico',
};

test('saasOnboardingCriarEmpresa: cria empresa pendente com provisionamento', async () => {
  const resp = await fns.saasOnboardingCriarEmpresa.run({ data: payloadValido });
  assert.equal(resp.ok, true);
  assert.ok(resp.empresaId);

  const doc = await db.collection('empresas').doc(resp.empresaId).get();
  assert.equal(doc.exists, true);
  const data = doc.data();
  assert.equal(data.status, 'pendente_aprovacao');
  assert.equal(data.plano, 'basico');
  assert.equal(data.dados_migrados, true);
  assert.equal(data.contato_email, payloadValido.email);
  assert.equal(data.contato_whatsapp, payloadValido.whatsapp);
  assert.ok(Array.isArray(data.modulos_ativos));
  assert.equal(data.feature_flags.whatsapp, true);

  const evt = await db.collection('saas_eventos').doc(`onboard_${resp.empresaId}`).get();
  assert.equal(evt.exists, true);
  assert.equal(evt.data().tipo, 'onboarding');
});

test('saasOnboardingCriarEmpresa: dedup por e-mail', async () => {
  await fns.saasOnboardingCriarEmpresa.run({ data: payloadValido });
  await assert.rejects(
    () => fns.saasOnboardingCriarEmpresa.run({ data: { ...payloadValido, nome: 'Outra' } }),
    comCode('already-exists')
  );
});

test('saasOnboardingCriarEmpresa: rejeita e-mail inválido', async () => {
  await assert.rejects(
    () => fns.saasOnboardingCriarEmpresa.run({ data: { ...payloadValido, email: 'x' } }),
    comCode('invalid-argument')
  );
});

test('saasOnboardingCriarEmpresa: rejeita whatsapp inválido', async () => {
  await assert.rejects(
    () => fns.saasOnboardingCriarEmpresa.run({ data: { ...payloadValido, whatsapp: '123' } }),
    comCode('invalid-argument')
  );
});

test('saasOnboardingCriarEmpresa: plano inválido cai em trial', async () => {
  const resp = await fns.saasOnboardingCriarEmpresa.run({
    data: { ...payloadValido, email: 'trial-fallback@test.cellcity.invalid', plano: 'xyz' },
  });
  const doc = await db.collection('empresas').doc(resp.empresaId).get();
  assert.equal(doc.data().plano, 'trial');
});
