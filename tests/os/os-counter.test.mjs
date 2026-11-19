/**
 * Contador atômico de OS — reserva + create-only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatOsId,
  ERR_OS_JA_EXISTE,
  reserveNextOsNumber,
  createOsDocExclusive,
} from '../../CRM/pages/os/os-counter.js';

/** Mock mínimo de Firestore (docs em Map) compatível com reserve/create. */
function makeFakeFirestore(seed = {}) {
  const store = new Map();
  for (const [path, data] of Object.entries(seed)) {
    store.set(path, { ...data });
  }
  const db = { __fake: true };
  function doc(_db, ...parts) {
    const path = parts.join('/');
    return { path, id: parts[parts.length - 1] };
  }
  async function runTransaction(_db, fn) {
    const tx = {
      async get(ref) {
        const data = store.get(ref.path);
        return {
          exists: () => data != null,
          data: () => (data != null ? { ...data } : undefined),
        };
      },
      set(ref, data) {
        store.set(ref.path, { ...data });
      },
    };
    return fn(tx);
  }
  return {
    db,
    doc,
    runTransaction,
    get: (path) => store.get(path),
    has: (path) => store.has(path),
  };
}

test('formatOsId: padding de 4 dígitos', () => {
  assert.equal(formatOsId(1), 'OS-0001');
  assert.equal(formatOsId(42), 'OS-0042');
  assert.equal(formatOsId(12345), 'OS-12345');
});

test('reserveNextOsNumber: incrementa metadata/counter a partir do banco', async () => {
  const fake = makeFakeFirestore({ 'metadata/counter': { value: 10 } });
  const n = await reserveNextOsNumber(fake);
  assert.equal(n, 11);
  assert.deepEqual(fake.get('metadata/counter'), { value: 11 });
});

test('reserveNextOsNumber: pula OS já existente (robô/outra aba)', async () => {
  const fake = makeFakeFirestore({
    'metadata/counter': { value: 100 },
    'os/OS-0101': { id: 'OS-0101', clientName: 'Robô' },
    'os/OS-0102': { id: 'OS-0102', clientName: 'Outra aba' },
  });
  const n = await reserveNextOsNumber(fake);
  assert.equal(n, 103);
  assert.equal(formatOsId(n), 'OS-0103');
  assert.deepEqual(fake.get('metadata/counter'), { value: 103 });
});

test('reserveNextOsNumber: counter ausente começa em 1', async () => {
  const fake = makeFakeFirestore();
  const n = await reserveNextOsNumber(fake);
  assert.equal(n, 1);
  assert.deepEqual(fake.get('metadata/counter'), { value: 1 });
});

test('createOsDocExclusive: grava OS nova com tenant', async () => {
  const fake = makeFakeFirestore();
  await createOsDocExclusive({
    ...fake,
    osData: { id: 'OS-0007', clientName: 'Ana' },
    injectTenant: (d) => ({ ...d, empresa_id: 'loja-a' }),
  });
  assert.deepEqual(fake.get('os/OS-0007'), {
    id: 'OS-0007',
    clientName: 'Ana',
    empresa_id: 'loja-a',
  });
});

test('createOsDocExclusive: nunca sobrescreve OS existente', async () => {
  const fake = makeFakeFirestore({
    'os/OS-0007': { id: 'OS-0007', clientName: 'Original' },
  });
  await assert.rejects(
    () => createOsDocExclusive({
      ...fake,
      osData: { id: 'OS-0007', clientName: 'Invasor' },
      injectTenant: (d) => d,
    }),
    (err) => err.code === ERR_OS_JA_EXISTE && err.osId === 'OS-0007'
  );
  assert.equal(fake.get('os/OS-0007').clientName, 'Original');
});

test('cenário robô: CRM com contador stale não colide nem sobrescreve', async () => {
  // CRM tinha localCounter=100; robô já gravou counter=101 + OS-0101.
  const fake = makeFakeFirestore({
    'metadata/counter': { value: 101 },
    'os/OS-0101': { id: 'OS-0101', clientName: 'Robô' },
  });
  const n = await reserveNextOsNumber(fake);
  assert.equal(n, 102);
  await createOsDocExclusive({
    ...fake,
    osData: { id: formatOsId(n), clientName: 'CRM' },
    injectTenant: (d) => ({ ...d, empresa_id: 'loja-a' }),
  });
  assert.equal(fake.get('os/OS-0101').clientName, 'Robô');
  assert.equal(fake.get('os/OS-0102').clientName, 'CRM');
  await assert.rejects(
    () => createOsDocExclusive({
      ...fake,
      osData: { id: 'OS-0101', clientName: 'Invasor' },
      injectTenant: (d) => d,
    }),
    (err) => err.code === ERR_OS_JA_EXISTE
  );
});
