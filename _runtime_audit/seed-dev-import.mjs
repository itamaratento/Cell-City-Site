#!/usr/bin/env node
// Fase 3 (seed) — importa o JSON já anonimizado (seed-dev-export.mjs) no
// projeto cellcity-crm-dev. Usa sa-key-dev.json — estruturalmente incapaz de
// escrever em produção (a chave só existe/tem permissão nesse projeto).
// Uso: node seed-dev-import.mjs <arquivo.json>

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const arquivo = process.argv[2];
if (!arquivo) {
  console.error('Uso: node seed-dev-import.mjs <arquivo-exportado.json>');
  process.exit(1);
}

function _deser(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object' && val._ts_) return new Date(val._ts_);
  if (Array.isArray(val)) return val.map(_deser);
  if (typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val)) out[k] = _deser(val[k]);
    return out;
  }
  return val;
}

async function main() {
  const seed = JSON.parse(readFileSync(arquivo, 'utf8'));
  if (!seed.anonimizado) {
    console.error('ABORTADO: arquivo não está marcado como anonimizado — não importar no DEV sem confirmar isso.');
    process.exit(1);
  }

  const sa = JSON.parse(readFileSync('/home/cellcity/Músicas/projetos/Cell-City-Site/sa-key-dev.json', 'utf8'));
  if (sa.project_id !== 'cellcity-crm-dev') {
    console.error(`ABORTADO: sa-key-dev.json aponta para "${sa.project_id}", esperado "cellcity-crm-dev".`);
    process.exit(1);
  }
  initializeApp({ credential: cert(sa) });
  const db = getFirestore();

  let totalDocs = 0;
  for (const [colecao, docs] of Object.entries(seed.colecoes)) {
    let batch = db.batch();
    let n = 0;
    for (const { id, data } of docs) {
      batch.set(db.collection(colecao).doc(id), _deser(data));
      n++;
      totalDocs++;
      if (n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    if (n % 400 !== 0) await batch.commit();
    console.log(`${colecao}: ${docs.length} docs importados`);
  }
  console.log(`\nTotal: ${totalDocs} docs importados em cellcity-crm-dev`);
}

main().catch(e => { console.error(e); process.exit(1); });
