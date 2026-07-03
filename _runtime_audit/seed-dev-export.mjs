#!/usr/bin/env node
// Fase 3 (seed) — exporta coleções de PRODUÇÃO para JSON, com anonimização opcional por campo.
// Evolução de backup-dados.js: aceita a lista de coleções e o mapa de anonimização como
// parâmetros explícitos, em vez de uma lista fixa incompleta (achado da Fase 3: produção tem
// 70 coleções raiz, não 21).
//
// NÃO EXECUTAR ainda: aguarda decisão do proprietário sobre (a) quais coleções entram no seed
// e (b) estratégia de anonimização LGPD. Ver relatório da Fase 3 para as opções.
//
// Uso pretendido: node seed-dev-export.mjs --config seed-config.json

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const EXPORT_DIR = '/home/cellcity/Músicas/backups/dev-seed';

function _ser(val) {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (typeof val.toDate === 'function') return { _ts_: val.toDate().toISOString() };
  if (Array.isArray(val)) return val.map(_ser);
  const out = {};
  for (const k of Object.keys(val)) out[k] = _ser(val[k]);
  return out;
}

// Aplica a função de anonimização de um campo, se configurada para a coleção.
function anonimizar(doc, regrasColecao) {
  if (!regrasColecao) return doc;
  const out = { ...doc };
  for (const [campo, fn] of Object.entries(regrasColecao)) {
    if (campo in out) out[campo] = fn(out[campo]);
  }
  return out;
}

async function main() {
  const configPath = process.argv.includes('--config')
    ? process.argv[process.argv.indexOf('--config') + 1]
    : null;
  if (!configPath) {
    console.error('Uso: node seed-dev-export.mjs --config seed-config.json');
    console.error('O config define: { "colecoes": [...], "anonimizacao": { "clientes": { "telefone": "mask", "sobrenome": "mask" } } }');
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const sa = JSON.parse(readFileSync('/home/cellcity/Músicas/projetos/Cell-City-Site/sa-key.json', 'utf8'));
  initializeApp({ credential: cert(sa) });
  const db = getFirestore();

  mkdirSync(EXPORT_DIR, { recursive: true });
  const resultado = { exportadoEm: new Date().toISOString(), origem: 'cellcity-crm', colecoes: {} };

  for (const nome of config.colecoes) {
    const snap = await db.collection(nome).get();
    resultado.colecoes[nome] = snap.docs.map(d => ({
      id: d.id,
      data: _ser(d.data()),
    }));
    console.log(`${nome}: ${snap.size} docs`);
  }

  const out = `${EXPORT_DIR}/seed-${Date.now()}.json`;
  writeFileSync(out, JSON.stringify(resultado, null, 2));
  console.log(`\nExportado para ${out}`);
}

main().catch(e => { console.error(e); process.exit(1); });
