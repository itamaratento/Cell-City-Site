// Backfill de empresa_id nos dados existentes — PS-3/PS-6
//
// Reescrito na PS-6: a versão original usava require() em ESM (crash
// imediato) e where('empresa_id','==',null), que NÃO encontra documentos
// onde o campo está AUSENTE (Firestore não indexa campo inexistente).
// Esta versão faz scan completo paginado por __name__ via REST e filtra
// no cliente — encontra ausente E null.
//
// Uso:
//   node scripts/backfill-empresa-id.mjs                 # dry-run no DEV
//   node scripts/backfill-empresa-id.mjs --execute       # escreve no DEV
//   node scripts/backfill-empresa-id.mjs --project prod  # dry-run no PROD
//   node scripts/backfill-empresa-id.mjs --project prod --execute
//
// Autenticação: token do gcloud (conta ativa precisa de acesso ao
// Firestore do projeto-alvo):  gcloud auth print-access-token
//
// Idempotente: só escreve em documentos com empresa_id ausente ou null;
// nunca sobrescreve um empresa_id já preenchido (updateMask só no campo).

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ARGS = process.argv.slice(2);
const EXECUTE = ARGS.includes('--execute');
const PROJECT = ARGS.includes('--project')
  ? (ARGS[ARGS.indexOf('--project') + 1] === 'prod' ? 'cellcity-crm' : 'cellcity-crm-dev')
  : 'cellcity-crm-dev';

const TARGET_TENANT = 'cellcity-master';
const FIELD = 'empresa_id';
const PAGE_SIZE = 300;
const BATCH_SIZE = 400; // batchWrite aceita até 500

// Coleções tenant-scoped (PS-6: + usuarios, perfis_operacionais,
// auditoria_usuarios_permissoes — as rules agora exigem empresa_id nelas)
export const COLLECTIONS = [
  'os', 'clientes',
  'caixa_lancamentos', 'categorias_caixa',
  'financeiro_pagar', 'financeiro_receber', 'financeiro_categorias',
  'financeiro_fixas', 'lembretes_pagamento', 'financeiro_fechamentos',
  'estoque_produtos', 'produtos', 'categorias_produtos',
  'fornecedor_compras', 'fornecedor_tendencias', 'fornecedores_cadastro',
  'compras_pedidos',
  'agenda', 'tarefas_semana', 'acoes_semana', 'notas_usuarios',
  'posvenda_contatos', 'posvenda_mensagens', 'posvenda_rastreamento',
  'crm_leads', 'crm_templates', 'contas_numeros', 'chips_cadastros',
  'avaliacoes', 'mensagens_portal', 'portal_eventos',
  'agendamentos', 'solicitacoes_diagnostico', 'pre_os',
  'catalogo_produtos', 'catalogo_config',
  'comandos', 'categorias_comandos', 'informacoes',
  'categorias_informacoes', 'central_organizacao',
  'diario_registros', 'diario_eventos',
  'historico_diario', 'historico_semanal', 'historico_mensal',
  'resumo_live', 'vendas_importadas',
  'alertas_usuario', 'central_alertas_status',
  'cc_lixeira', 'cc_gdrive_logs', 'gdrive_backup',
  'estoque', 'backup_logs',
  'chat_mensagens',
  'usuarios', 'perfis_operacionais', 'auditoria_usuarios_permissoes',
];

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function getToken() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

let _token = getToken();
function headers() {
  return {
    'Authorization': `Bearer ${_token}`,
    'Content-Type': 'application/json',
    'x-goog-user-project': PROJECT,
  };
}

async function api(path, body, retry = true) {
  const resp = await fetch(`${BASE}${path}`, {
    method: 'POST', headers: headers(), body: JSON.stringify(body),
  });
  if (resp.status === 401 && retry) {
    _token = getToken();
    return api(path, body, false);
  }
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 400)}`);
  return resp.json();
}

// Scan completo de uma coleção (paginado, projeção só no campo empresa_id)
async function* scanColecao(colId) {
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
    if (docs.length === 0) return;
    for (const r of docs) yield r.document;
    if (docs.length < PAGE_SIZE) return;
    cursor = docs[docs.length - 1].document.name;
  }
}

function valorEmpresa(doc) {
  const f = doc.fields?.[FIELD];
  if (!f) return undefined;                    // campo ausente
  if ('nullValue' in f) return null;           // null explícito
  return f.stringValue ?? `<${Object.keys(f)[0]}>`;
}

async function corrigirLote(nomes) {
  const writes = nomes.map(name => ({
    update: { name, fields: { [FIELD]: { stringValue: TARGET_TENANT } } },
    updateMask: { fieldPaths: [FIELD] },
    currentDocument: { exists: true },
  }));
  const resp = await api(':batchWrite', { writes });
  const erros = (resp.status || []).filter(s => s.code && s.code !== 0);
  return { ok: writes.length - erros.length, erros: erros.length };
}

async function main() {
  console.log(`=== BACKFILL ${FIELD} → '${TARGET_TENANT}' ===`);
  console.log(`Projeto: ${PROJECT}  |  Modo: ${EXECUTE ? '🔴 EXECUÇÃO' : '🟢 DRY-RUN (análise)'}`);
  console.log(`Coleções: ${COLLECTIONS.length}\n`);

  let totGeral = 0, totPend = 0, totOk = 0, totOutro = 0, totCorrigidos = 0, totFalhas = 0;
  const divergentes = [];

  for (const col of COLLECTIONS) {
    let total = 0, pendentes = 0, corretos = 0, outros = 0;
    const paraCorrigir = [];
    try {
      for await (const doc of scanColecao(col)) {
        total++;
        const v = valorEmpresa(doc);
        if (v === undefined || v === null) { pendentes++; paraCorrigir.push(doc.name); }
        else if (v === TARGET_TENANT) corretos++;
        else { outros++; divergentes.push(`${col}/${doc.name.split('/').pop()} = ${v}`); }
      }
    } catch (e) {
      console.log(`[${col}] ERRO: ${e.message}`);
      totFalhas++;
      continue;
    }

    let corrigidos = 0, falhas = 0;
    if (EXECUTE && paraCorrigir.length > 0) {
      for (let i = 0; i < paraCorrigir.length; i += BATCH_SIZE) {
        const r = await corrigirLote(paraCorrigir.slice(i, i + BATCH_SIZE));
        corrigidos += r.ok; falhas += r.erros;
      }
    }

    totGeral += total; totPend += pendentes; totOk += corretos; totOutro += outros;
    totCorrigidos += corrigidos; totFalhas += falhas;

    if (total > 0 || pendentes > 0) {
      const acao = EXECUTE ? ` → corrigidos ${corrigidos}${falhas ? ` (⚠️ ${falhas} falhas)` : ''}` : '';
      console.log(`[${col}] total=${total} ok=${corretos} pendentes=${pendentes} outros=${outros}${acao}`);
    }
  }

  console.log('\n=== RESUMO ===');
  console.log(`Documentos escaneados: ${totGeral}`);
  console.log(`Já corretos (${TARGET_TENANT}): ${totOk}`);
  console.log(`Pendentes (ausente/null): ${totPend}${EXECUTE ? ` → corrigidos: ${totCorrigidos}` : ''}`);
  console.log(`Com OUTRO empresa_id (preservados): ${totOutro}`);
  if (divergentes.length) {
    console.log('\nDocs com empresa_id divergente (não tocados):');
    divergentes.slice(0, 20).forEach(d => console.log('  ' + d));
    if (divergentes.length > 20) console.log(`  ... +${divergentes.length - 20}`);
  }
  if (totFalhas) console.log(`\n⚠️  Falhas: ${totFalhas}`);

  if (!EXECUTE && totPend > 0) {
    console.log(`\nDry-run: nada foi escrito. Rode com --execute para corrigir ${totPend} docs.`);
  }
  if (EXECUTE && totPend === totCorrigidos && totFalhas === 0) {
    console.log('\n✅ Backfill concluído sem falhas.');
    console.log('PRÓXIMOS PASSOS:');
    console.log('  1. node scripts/validar-backfill.mjs' + (PROJECT.endsWith('-dev') ? '' : ' --project prod'));
    console.log(`  2. Marcar empresas/${TARGET_TENANT}.dados_migrados = true (ativa os filtros tenant)`);
    console.log('  3. Deploy das Firestore Rules atualizadas');
  }
  process.exitCode = totFalhas > 0 ? 1 : 0;
}

// Guard de entrypoint: validar-backfill.mjs importa COLLECTIONS daqui —
// o backfill só roda quando este arquivo é o script principal.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(e => { console.error('ERRO FATAL:', e.message); process.exit(1); });
}
