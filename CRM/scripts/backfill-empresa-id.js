/**
 * BACKFILL: adiciona empresa_id = 'cellcity-master' em documentos antigos
 *
 * Coleções afetadas: caixa_lancamentos, categorias_caixa, lembretes_pagamento
 *
 * ATENÇÃO: Execute manualmente após confirmar com o usuário.
 * Para rodar: node backfill-empresa-id.js
 *
 * Pré-requisito: npm install firebase-admin
 */

const admin = require('firebase-admin');
const serviceAccount = require('../sa-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'cellcity-crm'
});

const db = admin.firestore();
const EMPRESA_ID = 'cellcity-master';

async function backfillCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  let updated = 0;
  let skipped = 0;

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    if (!doc.data().empresa_id) {
      batch.update(doc.ref, { empresa_id: EMPRESA_ID });
      batchCount++;
      updated++;

      if (batchCount >= 400) {
        await batch.commit();
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
