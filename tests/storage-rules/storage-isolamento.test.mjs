// Testes de Storage Rules — achado A2 (Auditoria Técnica Independente
// 2026-07-17): delete dos paths legados restrito à empresa dona.
//
// empresaDoUsuario() faz cross-service lookup em Firestore — emulador
// Firestore precisa estar de pé. projectId do harness DEVE coincidir com
// --project do emulators:exec (ver package.json).

import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'cellcity-storage-test',
    firestore: {
      rules: 'service cloud.firestore { match /databases/{db}/documents/{doc=**} { allow read, write: if true; } }',
    },
    storage: {
      rules: readFileSync('../../storage.rules', 'utf8'),
    },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const st = ctx.storage();
    await db.doc('usuarios/user-master').set({ perfil: 'tecnico', empresa_id: 'cellcity-master' });
    await db.doc('usuarios/user-a').set({ perfil: 'tecnico', empresa_id: 'empresa-a' });
    await st.ref('os/OS-0001/foto.jpg').put(Buffer.from('fake-jpg'), { contentType: 'image/jpeg' });
    await st.ref('docs/manual.pdf').put(Buffer.from('fake-pdf'), { contentType: 'application/pdf' });
    await st.ref('empresas/empresa-a/os/OS-A-1/foto.jpg').put(Buffer.from('fake-jpg'), { contentType: 'image/jpeg' });
  });
});

after(async () => {
  await testEnv.cleanup();
});

const storageMaster = () => testEnv.authenticatedContext('user-master').storage();
const storageA = () => testEnv.authenticatedContext('user-a').storage();

// FASE 4.1: Storage OS — leitura exige autenticação + mesma empresa.
// URLs com token já emitidas continuam válidas; getDownloadURL anônimo falha.
test('os/ legado: leitura sem login -> NEGADO (FASE 4.1)', async () => {
  await assertFails(testEnv.unauthenticatedContext().storage().ref('os/OS-0001/foto.jpg').getDownloadURL());
});

test('os/ legado: leitura autenticada pela empresa dona -> permitido', async () => {
  await assertSucceeds(storageMaster().ref('os/OS-0001/foto.jpg').getDownloadURL());
});

test('os/ legado: write continua fechado', async () => {
  await assertFails(storageMaster().ref('os/OS-0001/outra.jpg').put(Buffer.from('x'), { contentType: 'image/jpeg' }));
});

test('os/ legado: delete pela empresa dona (cellcity-master) -> permitido', async () => {
  await assertSucceeds(storageMaster().ref('os/OS-0001/foto.jpg').delete());
});

test('os/ legado: delete por OUTRA empresa -> NEGADO (A2)', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref('os/OS-0001/foto.jpg').put(Buffer.from('fake-jpg'), { contentType: 'image/jpeg' });
  });
  await assertFails(storageA().ref('os/OS-0001/foto.jpg').delete());
});

test('docs/ legado: leitura por autenticado -> permitido', async () => {
  await assertSucceeds(storageA().ref('docs/manual.pdf').getDownloadURL());
});

test('docs/ legado: write continua fechado', async () => {
  await assertFails(storageMaster().ref('docs/novo.pdf').put(Buffer.from('x'), { contentType: 'application/pdf' }));
});

test('docs/ legado: delete pela empresa dona -> permitido', async () => {
  await assertSucceeds(storageMaster().ref('docs/manual.pdf').delete());
});

test('docs/ legado: delete por OUTRA empresa -> NEGADO (A2)', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref('docs/manual2.pdf').put(Buffer.from('fake-pdf'), { contentType: 'application/pdf' });
  });
  await assertFails(storageA().ref('docs/manual2.pdf').delete());
});

// FASE 4.1: leitura canônica de fotos de OS NÃO é mais pública.
test('canonico os/: leitura anonima -> NEGADO (FASE 4.1)', async () => {
  await assertFails(testEnv.unauthenticatedContext().storage().ref('empresas/empresa-a/os/OS-A-1/foto.jpg').getDownloadURL());
});

test('canonico os/: leitura pela propria empresa -> permitido', async () => {
  await assertSucceeds(storageA().ref('empresas/empresa-a/os/OS-A-1/foto.jpg').getDownloadURL());
});

test('canonico os/: leitura cross-tenant -> NEGADO', async () => {
  await assertFails(storageMaster().ref('empresas/empresa-a/os/OS-A-1/foto.jpg').getDownloadURL());
});

test('canonico os/: empresa A escreve/exclui proprios arquivos -> permitido', async () => {
  await assertSucceeds(
    storageA().ref('empresas/empresa-a/os/OS-A-1/foto2.jpg').put(Buffer.from('x'), { contentType: 'image/jpeg' })
  );
  await assertSucceeds(storageA().ref('empresas/empresa-a/os/OS-A-1/foto2.jpg').delete());
});

test('canonico os/: empresa fora do tenant nao escreve/exclui -> NEGADO', async () => {
  await assertFails(
    storageMaster().ref('empresas/empresa-a/os/OS-A-1/intrusa.jpg').put(Buffer.from('x'), { contentType: 'image/jpeg' })
  );
  await assertFails(storageMaster().ref('empresas/empresa-a/os/OS-A-1/foto.jpg').delete());
});
