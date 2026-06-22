#!/usr/bin/env node
// ============================================================
//  backup-dados.js — Exporta Firestore → JSON
//  Rodar do diretório do projeto: node backup-dados.js
// ============================================================

import { initializeApp }                     from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInAnonymously }        from 'firebase/auth';
import { writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

const BACKUP_DIR = '/home/cellcity/Músicas/backups/dados';
const LOG_FILE   = '/home/cellcity/Músicas/backups/historico.log';

const COLECOES = [
  'os', 'clientes', 'caixa_lancamentos', 'categorias_caixa',
  'estoque_produtos', 'pendencias', 'fornecedores', 'fornecedor_compras',
  'financeiro_despesas', 'financeiro_fixas', 'financeiro_pagar',
  'financeiro_receber', 'financeiro_cat_despesas', 'financeiro_centros_custo',
  'compras_financeiras', 'config', 'configuracoes', 'posvenda_contatos',
  'posvenda_mensagens', 'chips_cadastros', 'alertas_usuario',
];

function _ser(val) {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (typeof val.toDate === 'function') return { _ts_: val.toDate().toISOString() };
  if (val.seconds !== undefined && val.nanoseconds !== undefined)
    return { _ts_: new Date(val.seconds * 1000 + val.nanoseconds / 1e6).toISOString() };
  if (Array.isArray(val)) return val.map(_ser);
  const out = {};
  for (const k of Object.keys(val)) out[k] = _ser(val[k]);
  return out;
}

const app  = initializeApp({
  apiKey:            'AIzaSyD5wQRvcVdweOhVqwd8e08JuzRXOESEbqE',
  authDomain:        'cellcity-crm.firebaseapp.com',
  projectId:         'cellcity-crm',
  storageBucket:     'cellcity-crm.firebasestorage.app',
  messagingSenderId: '645609867368',
  appId:             '1:645609867368:web:b3ee19ccfe3d17c61c53dd',
});

const db   = getFirestore(app);
const auth = getAuth(app);

try {
  console.log('\n📦 Iniciando backup de dados (Firestore)…\n');
  await signInAnonymously(auth);

  mkdirSync(BACKUP_DIR, { recursive: true });

  const resultado = {
    versao: 2, sistema: 'Cell City CRM',
    exportadoEm: new Date().toISOString(),
    totalDocs: 0, colecoes: {},
  };

  for (const colId of COLECOES) {
    try {
      const snap = await getDocs(collection(db, colId));
      const docs = snap.docs.map(d => ({ _id: d.id, ..._ser(d.data()) }));
      resultado.colecoes[colId] = docs;
      resultado.totalDocs += docs.length;
      console.log(`  ✓ ${colId} (${docs.length} docs)`);
    } catch (e) {
      console.log(`  ⚠ ${colId} — ${e.message}`);
      resultado.colecoes[colId] = [];
    }
  }

  const dt   = new Date();
  const nome = `CellCity-dados-${dt.toISOString().slice(0,16).replace('T','-').replace(':','')}.json`;
  writeFileSync(join(BACKUP_DIR, nome), JSON.stringify(resultado, null, 2));

  const sizeMB = (Buffer.byteLength(JSON.stringify(resultado)) / 1024 / 1024).toFixed(2);
  appendFileSync(LOG_FILE, `${dt.toISOString()} | dados | ${nome} | ${sizeMB}MB | ${resultado.totalDocs} docs\n`);

  console.log(`\n✅ BACKUP DE DADOS CONCLUÍDO: ${nome} (${sizeMB} MB · ${resultado.totalDocs} docs)\n`);
  process.exit(0);
} catch (e) {
  console.error('❌ Erro no backup de dados:', e.message);
  process.exit(1);
}
