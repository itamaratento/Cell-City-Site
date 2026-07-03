import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const sa = JSON.parse(readFileSync('/home/cellcity/Músicas/projetos/Cell-City-Site/sa-key.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const cols = await db.listCollections();
const names = cols.map(c => c.id).sort();
console.log(JSON.stringify(names, null, 2));
console.log(`\nTotal: ${names.length} coleções raiz`);
