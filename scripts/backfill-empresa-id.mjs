// Backfill empresa_id nos dados existentes — PS-3
// Uso: node --experimental-vm-modules scripts/backfill-empresa-id.mjs
// Requer: firebase-admin SDK ou sa-key.json com permissão de escrita

const BACKFILL_CONFIG = {
  batchSize: 500,
  targetTenant: 'cellcity-master',
  field: 'empresa_id',
};

// Coleções que precisam de backfill (excluindo globais e protegidas)
const COLLECTIONS = [
  // Núcleo
  'os', 'clientes',
  // Caixa
  'caixa_lancamentos', 'categorias_caixa',
  // Financeiro
  'financeiro_pagar', 'financeiro_receber', 'financeiro_categorias',
  'financeiro_fixas', 'lembretes_pagamento', 'financeiro_fechamentos',
  // Estoque
  'estoque_produtos', 'produtos', 'categorias_produtos',
  // Fornecedor/Compras
  'fornecedor_compras', 'fornecedor_tendencias', 'fornecedores_cadastro',
  'compras_pedidos',
  // Agenda/Tarefas
  'agenda', 'tarefas_semana', 'acoes_semana', 'notas_usuarios',
  // Pós-Venda
  'posvenda_contatos', 'posvenda_mensagens', 'posvenda_rastreamento',
  // CRM
  'crm_leads', 'crm_templates', 'contas_numeros', 'chips_cadastros',
  // Portal
  'avaliacoes', 'mensagens_portal', 'portal_eventos',
  'agendamentos', 'solicitacoes_diagnostico',
  // Catálogo
  'catalogo_produtos', 'catalogo_config',
  // Conhecimento
  'comandos', 'categorias_comandos', 'informacoes',
  'categorias_informacoes', 'central_organizacao',
  // Diário
  'diario_registros', 'diario_eventos',
  // Histórico
  'historico_diario', 'historico_semanal', 'historico_mensal',
  'resumo_live', 'vendas_importadas',
  // Alertas
  'alertas_usuario',
  // Backup/Sync
  'cc_lixeira', 'cc_gdrive_logs', 'gdrive_backup',
  // Legado
  'estoque', 'backup_logs',
  // Chat
  'chat_mensagens',
];

async function backfillColecao(db, nomeColecao) {
  const { FieldValue } = require('firebase-admin').firestore;
  let total = 0;
  let hasMore = true;

  while (hasMore) {
    const snapshot = await db.collection(nomeColecao)
      .where(BACKFILL_CONFIG.field, '==', null)
      .limit(BACKFILL_CONFIG.batchSize)
      .get();

    if (snapshot.empty) {
      // Tenta documentos que não têm o campo (null vs undefined)
      const snapMissing = await db.collection(nomeColecao)
        .where(BACKFILL_CONFIG.field, '==', '__missing__')
        .limit(BACKFILL_CONFIG.batchSize)
        .get();
      if (snapMissing.empty) {
        hasMore = false;
        break;
      }

      const batch = db.batch();
      let count = 0;
      snapMissing.forEach(doc => {
        batch.update(doc.ref, { [BACKFILL_CONFIG.field]: BACKFILL_CONFIG.targetTenant });
        count++;
      });
      await batch.commit();
      total += count;
      console.log(`  → ${nomeColecao}: +${count} docs (missing field)`);
      continue;
    }

    const batch = db.batch();
    let count = 0;
    snapshot.forEach(doc => {
      batch.update(doc.ref, { [BACKFILL_CONFIG.field]: BACKFILL_CONFIG.targetTenant });
      count++;
    });
    await batch.commit();
    total += count;
    console.log(`  → ${nomeColecao}: +${count} docs`);
  }

  return total;
}

async function main() {
  console.log('=== BACKFILL empresa_id ===');
  console.log(`Alvo: ${BACKFILL_CONFIG.targetTenant}`);
  console.log(`Coleções: ${COLLECTIONS.length}`);
  console.log('');

  const admin = require('firebase-admin');
  const serviceAccount = require('../sa-key.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const db = admin.firestore();
  let totalGeral = 0;
  const resultados = [];

  for (const nome of COLLECTIONS) {
    console.log(`[${nome}]`);
    try {
      const total = await backfillColecao(db, nome);
      resultados.push({ colecao: nome, documentos: total });
      totalGeral += total;
      if (total === 0) console.log(`  → OK (nenhum pendente)`);
    } catch (err) {
      console.error(`  → ERRO: ${err.message}`);
      resultados.push({ colecao: nome, documentos: -1, erro: err.message });
    }
  }

  console.log('');
  console.log('=== RESUMO ===');
  console.log(`Total de documentos atualizados: ${totalGeral}`);
  console.log(`Coleções processadas: ${COLLECTIONS.length}`);
  console.log('');

  const falhas = resultados.filter(r => r.erro);
  if (falhas.length > 0) {
    console.log('⚠️  FALHAS:');
    falhas.forEach(f => console.log(`  - ${f.colecao}: ${f.erro}`));
  }

  console.log('Backfill concluído.');
  console.log('');
  console.log('PRÓXIMO PASSO: Após validar os dados, execute:');
  console.log('  1. node scripts/validar-backfill.mjs');
  console.log('  2. Ativar enableFilter() nas repositories');
  console.log('  3. Fazer deploy das Firestore Rules atualizadas');
}

main().catch(console.error);
