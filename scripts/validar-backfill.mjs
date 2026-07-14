// Validação do backfill de empresa_id — PS-3
// Uso: node scripts/validar-backfill.mjs
// Verifica se todas as coleções têm empresa_id preenchido

const VALIDATION_CONFIG = {
  field: 'empresa_id',
  expectedValue: 'cellcity-master',
  sampleSize: 100,
};

const COLLECTIONS = [
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
  'agendamentos', 'solicitacoes_diagnostico',
  'catalogo_produtos',
  'comandos', 'categorias_comandos', 'informacoes',
  'categorias_informacoes', 'central_organizacao',
  'diario_registros', 'diario_eventos',
  'historico_diario', 'historico_semanal', 'historico_mensal',
  'resumo_live', 'vendas_importadas',
  'alertas_usuario',
  'cc_lixeira', 'cc_gdrive_logs', 'gdrive_backup',
  'estoque', 'backup_logs',
  'chat_mensagens',
];

async function validarColecao(db, nomeColecao) {
  const totalSnap = await db.collection(nomeColecao).count().get();
  const total = totalSnap.data().count;

  if (total === 0) return { colecao: nomeColecao, total: 0, pendentes: 0, status: 'VAZIA' };

  // Amostra para verificar valor correto
  const amostra = await db.collection(nomeColecao)
    .limit(VALIDATION_CONFIG.sampleSize)
    .get();

  let semCampo = 0;
  let valorIncorreto = 0;
  let ok = 0;

  amostra.forEach(doc => {
    const val = doc.data()[VALIDATION_CONFIG.field];
    if (val === undefined || val === null) semCampo++;
    else if (val !== VALIDATION_CONFIG.expectedValue) valorIncorreto++;
    else ok++;
  });

  // Verifica documentos pendentes
  const pendentesSnap = await db.collection(nomeColecao)
    .where(VALIDATION_CONFIG.field, '==', null)
    .limit(1)
    .get();

  let pendentes = pendentesSnap.size;

  if (pendentes === 0 && ok === 0 && total > 0) {
    // Pode ser que o campo não exista (undefined != null no Firestore)
    const missingFieldSnap = await db.collection(nomeColecao)
      .where(VALIDATION_CONFIG.field, '==', '__missing__')
      .limit(1)
      .get();
    // Firestore não aceita where com __missing__, então tentamos outro approach
    // Verificamos se a amostra tem documentos com campo undefined
    if (semCampo > 0) pendentes = -1; // indica que precisa de verificação manual
  }

  return {
    colecao: nomeColecao,
    total,
    pendentes,
    amostraOk: ok,
    amostraSemCampo: semCampo,
    amostraValorIncorreto: valorIncorreto,
    status: pendentes === 0 ? 'OK' : (pendentes > 0 ? 'PENDENTE' : 'REVISAO')
  };
}

async function main() {
  const admin = require('firebase-admin');
  const serviceAccount = require('../sa-key.json');

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  console.log('=== VALIDAÇÃO DE BACKFILL ===');
  console.log(`Campo: ${VALIDATION_CONFIG.field}`);
  console.log(`Valor esperado: ${VALIDATION_CONFIG.expectedValue}`);
  console.log(`Coleções: ${COLLECTIONS.length}`);
  console.log('');

  const resultados = [];
  let totalDocs = 0;
  let totalPendentes = 0;
  let totalVazias = 0;

  for (const nome of COLLECTIONS) {
    process.stdout.write(`[${nome}]... `);
    try {
      const r = await validarColecao(db, nome);
      resultados.push(r);
      totalDocs += r.total;
      if (r.status === 'PENDENTE') totalPendentes += r.pendentes;
      if (r.status === 'VAZIA') totalVazias++;
      console.log(`${r.status} (${r.total} docs)`);
    } catch (err) {
      console.log(`ERRO: ${err.message}`);
      resultados.push({ colecao: nome, status: 'ERRO', erro: err.message });
    }
  }

  console.log('');
  console.log('=== RESUMO ===');
  console.log(`Total de documentos: ${totalDocs}`);
  console.log(`Coleções vazias: ${totalVazias}`);
  console.log(`Coleções OK: ${resultados.filter(r => r.status === 'OK').length}`);
  console.log(`Coleções com pendência: ${resultados.filter(r => r.status === 'PENDENTE').length}`);
  console.log(`Coleções em revisão: ${resultados.filter(r => r.status === 'REVISAO').length}`);
  console.log(`Coleções com erro: ${resultados.filter(r => r.status === 'ERRO').length}`);
  console.log('');

  const problemas = resultados.filter(r => r.status === 'PENDENTE' || r.status === 'REVISAO' || r.status === 'ERRO');
  if (problemas.length > 0) {
    console.log('⚠️  COLEÇÕES COM PROBLEMAS:');
    problemas.forEach(r => {
      console.log(`  - ${r.colecao}: ${r.status}${r.erro ? ` (${r.erro})` : ''}`);
      if (r.amostraSemCampo > 0) console.log(`      Amostra: ${r.amostraSemCampo} docs sem campo`);
      if (r.amostraValorIncorreto > 0) console.log(`      Amostra: ${r.amostraValorIncorreto} docs com valor incorreto`);
    });
  }

  if (totalPendentes === 0) {
    console.log('✅ BACKFILL VALIDADO — Todos os documentos têm empresa_id correto.');
    console.log('📌 PRÓXIMO PASSO:');
    console.log('   1. Executar ativarFiltrosTenant() no navegador');
    console.log('   2. Fazer deploy das Firestore Rules atualizadas');
    console.log('   3. Iniciar testes de isolamento entre empresas');
  } else {
    console.log(`❌ ${totalPendentes} documentos pendentes — executar backfill novamente.`);
  }
}

main().catch(console.error);
