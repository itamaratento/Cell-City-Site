// Validação do backfill de empresa_id — PS-3/PS-6
//
// Reescrito na PS-6: a versão original usava require() em ESM (crash) e
// validava por amostra de 100 docs. Esta versão varre 100% dos documentos
// de cada coleção (paginado via REST) e classifica cada um:
//   OK        — empresa_id === valor esperado
//   PENDENTE  — campo ausente ou null (backfill incompleto)
//   DIVERGENTE— empresa_id de outra empresa (informativo; esperado
//               quando já existem empresas além da cellcity-master)
//
// Uso:
//   node scripts/validar-backfill.mjs                  # valida DEV
//   node scripts/validar-backfill.mjs --project prod   # valida PROD
//
// Sai com código 0 somente se PENDENTE == 0 em todas as coleções.

import { execSync } from 'node:child_process';
import { COLLECTIONS } from './backfill-empresa-id.mjs';

const ARGS = process.argv.slice(2);
const PROJECT = ARGS.includes('--project')
  ? (ARGS[ARGS.indexOf('--project') + 1] === 'prod' ? 'cellcity-crm' : 'cellcity-crm-dev')
  : 'cellcity-crm-dev';

const FIELD = 'empresa_id';
const EXPECTED = 'cellcity-master';
const PAGE_SIZE = 300;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

let _token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();

async function api(path, body, retry = true) {
  const resp = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${_token}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': PROJECT,
    },
    body: JSON.stringify(body),
  });
  if (resp.status === 401 && retry) {
    _token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
    return api(path, body, false);
  }
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  return resp.json();
}

async function validarColecao(colId) {
  let total = 0, ok = 0, pendentes = 0, divergentes = 0;
  let cursor = null;
  for (;;) {
    const q = {
      structuredQuery: {
        from: [{ collectionId: colId }],
        select: { fields: [{ fieldPath: FIELD }] },
        orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
        limit: PAGE_SIZE,
        ...(cursor ? { startAt: { values: [{ referenceValue: cursor }], before: false } } : {}),
      },
    };
    const rows = await api(':runQuery', q);
    const docs = rows.filter(r => r.document);
    if (docs.length === 0) break;
    for (const r of docs) {
      total++;
      const f = r.document.fields?.[FIELD];
      if (!f || 'nullValue' in f) pendentes++;
      else if (f.stringValue === EXPECTED) ok++;
      else divergentes++;
    }
    if (docs.length < PAGE_SIZE) break;
    cursor = docs[docs.length - 1].document.name;
  }
  return { colecao: colId, total, ok, pendentes, divergentes };
}

async function main() {
  console.log('=== VALIDAÇÃO DE BACKFILL (varredura completa) ===');
  console.log(`Projeto: ${PROJECT}  |  Campo: ${FIELD}  |  Esperado: ${EXPECTED}\n`);

  let totalDocs = 0, totalPend = 0, totalDiv = 0, vazias = 0, erros = 0;

  for (const col of COLLECTIONS) {
    try {
      const r = await validarColecao(col);
      totalDocs += r.total; totalPend += r.pendentes; totalDiv += r.divergentes;
      if (r.total === 0) { vazias++; continue; }
      const status = r.pendentes === 0 ? 'OK' : '❌ PENDENTE';
      console.log(`[${col}] ${status} — total=${r.total} ok=${r.ok} pendentes=${r.pendentes} divergentes=${r.divergentes}`);
    } catch (e) {
      erros++;
      console.log(`[${col}] ERRO: ${e.message}`);
    }
  }

  console.log('\n=== RESUMO ===');
  console.log(`Documentos: ${totalDocs} | Pendentes: ${totalPend} | Divergentes: ${totalDiv} | Coleções vazias: ${vazias} | Erros: ${erros}`);

  if (totalPend === 0 && erros === 0) {
    console.log('\n✅ BACKFILL VALIDADO — nenhum documento sem empresa_id.');
    console.log('PRÓXIMO PASSO: marcar empresas/cellcity-master.dados_migrados = true');
  } else {
    console.log(`\n❌ ${totalPend} documentos pendentes / ${erros} erros — reexecutar backfill.`);
  }
  process.exitCode = (totalPend === 0 && erros === 0) ? 0 : 1;
}

main().catch(e => { console.error('ERRO FATAL:', e.message); process.exit(1); });
