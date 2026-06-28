/**
 * BACKFILL: adiciona empresa_id = 'cellcity-master' em documentos antigos
 *
 * Coleções afetadas: caixa_lancamentos (335 docs), categorias_caixa (10 docs)
 * Idempotente: pula documentos que já têm empresa_id.
 *
 * Para rodar:
 *   cd /home/cellcity/Músicas/projetos/Cell-City-Site/CRM
 *   npm install firebase-admin
 *   node scripts/backfill-empresa-id.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../../sa-key.json');

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'cellcity-crm'
});

const db = getFirestore();
const EMPRESA_ID = 'cellcity-master';
const BATCH_SIZE = 400;

async function backfillCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    if (!doc.data().empresa_id) {
      batch.update(doc.ref, { empresa_id: EMPRESA_ID });
      batchCount++;
      updated++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch(); // novo batch após cada commit
        batchCount = 0;
        console.log(`  ${collectionName}: ${updated} docs atualizados até agora...`);
      }
    } else {
      skipped++;
    }
  }

  if (batchCount > 0) await batch.commit();

  console.log(`✅ ${collectionName}: ${updated} atualizados, ${skipped} já tinham empresa_id`);
  return { updated, skipped };
}

async function main() {
  console.log('=== BACKFILL empresa_id ===');
  console.log(`Empresa: ${EMPRESA_ID}`);
  console.log('');

  const collections = [
    'caixa_lancamentos',
    'categorias_caixa',
    'lembretes_pagamento',
  ];

  for (const col of collections) {
    try {
      await backfillCollection(col);
    } catch (e) {
      console.error(`❌ Erro em ${col}:`, e.message);
    }
  }

  console.log('\nBackfill concluído.');
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
