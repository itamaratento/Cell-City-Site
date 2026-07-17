// Testes de Storage Rules — achado A2 (Auditoria Técnica Independente
// 2026-07-17): `delete` dos paths legados (`os/{osId}/**`, `docs/**`)
// aceitava QUALQUER usuário autenticado, sem checar `empresa_id` — a
// única regra de todo o arquivo sem isolamento por empresa. Corrigido
// para exigir `empresaDoUsuario() == 'cellcity-master'` (a empresa
// dona dos arquivos legados, ver storage.rules).
//
// empresaDoUsuario() faz um cross-service lookup em Firestore
// (usuarios/{uid}.empresa_id) — por isso o emulador de Firestore
// também precisa estar de pé (ver package.json: --only firestore,storage).
//
// Rodar: npm test (dentro de tests/storage-rules/)

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
    projectId: 'cellcity-storage-test',
    firestore: {
      // Firestore aqui só serve o cross-service lookup de empresaDoUsuario()
      // (get() em regras sempre roda com acesso elevado, ignorando as Rules
      // do documento referenciado) — ruleset permissivo é suficiente e não
      // compromete o teste, que é sobre storage.rules, não firestore.rules.
      rules: 'service cloud.firestore { match /databases/{db}/documents/{doc=**} { allow read, write: if true; } }',
    },
    storage: {
      rules: readFileSync('../../storage.rules', 'utf8'),
    },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection('usuarios').doc('user-master').set({ perfil: 'tecnico', empresa_id: 'cellcity-master' });
    await db.collection('usuarios').doc('user-a').set({ perfil: 'tecnico', empresa_id: 'empresa-a' });

    // Seed de arquivos legados e canônicos, direto no storage (bypassa Rules).
    const st = ctx.storage();
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

// ── LEGADO: os/{osId}/** ──────────────────────────────────────

test('os/ legado: leitura pública (sem login) → permitido', async () => {
  await assertSucceeds(testEnv.unauthenticatedContext().storage().ref('os/OS-0001/foto.jpg').getDownloadURL());
});

test('os/ legado: write continua fechado (código novo só escreve no path canônico)', async () => {
  await assertFails(storageMaster().ref('os/OS-0001/outra.jpg').put(Buffer.from('x'), { contentType: 'image/jpeg' }));
});

test('os/ legado: delete pela empresa dona (cellcity-master) → permitido', async () => {
  await assertSucceeds(storageMaster().ref('os/OS-0001/foto.jpg').delete());
});

test('os/ legado: delete por OUTRA empresa → NEGADO (achado A2 corrigido)', async () => {
  // Antes da correção, qualquer autenticado conseguia apagar fotos de OS
  // legadas de qualquer empresa — sem nenhum gate de tenant.
  await assertFails(storageA().ref('os/OS-0001/foto.jpg').delete());
});

// ── LEGADO: docs/** ───────────────────────────────────────────

test('docs/ legado: leitura por qualquer autenticado → permitido (comportamento preservado)', async () => {
  await assertSucceeds(storageA().ref('docs/manual.pdf').getDownloadURL());
});

test('docs/ legado: write continua fechado', async () => {
  await assertFails(storageMaster().ref('docs/novo.pdf').put(Buffer.from('x'), { contentType: 'application/pdf' }));
});

test('docs/ legado: delete pela empresa dona (cellcity-master) → permitido', async () => {
  await assertSucceeds(storageMaster().ref('docs/manual.pdf').delete());
});

test('docs/ legado: delete por OUTRA empresa → NEGADO (achado A2 corrigido)', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref('docs/manual2.pdf').put(Buffer.from('fake-pdf'), { contentType: 'application/pdf' });
  });
  await assertFails(storageA().ref('docs/manual2.pdf').delete());
});

// ── CANÔNICO: empresas/{empresaId}/... (regressão, já existia antes de A2) ──

test('canônico: empresa A lê/escreve/exclui os próprios arquivos → permitido', async () => {
  await assertSucceeds(storageA().ref('empresas/empresa-a/os/OS-A-1/foto.jpg').getDownloadURL());
  await assertSucceeds(
    storageA().ref('empresas/empresa-a/os/OS-A-1/foto2.jpg').put(Buffer.from('x'), { contentType: 'image/jpeg' })
  );
  await assertSucceeds(storageA().ref('empresas/empresa-a/os/OS-A-1/foto2.jpg').delete());
});

test('canônico: empresa fora do tenant não lê/escreve/exclui arquivo de outra empresa → NEGADO', async () => {
  await assertFails(storageMaster().ref('empresas/empresa-a/os/OS-A-1/foto.jpg').getDownloadURL());
  await assertFails(
    storageMaster().ref('empresas/empresa-a/os/OS-A-1/intrusa.jpg').put(Buffer.from('x'), { contentType: 'image/jpeg' })
  );
  await assertFails(storageMaster().ref('empresas/empresa-a/os/OS-A-1/foto.jpg').delete());
});
