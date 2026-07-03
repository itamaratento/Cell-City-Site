#!/usr/bin/env node
// Fase 3 (seed) — exporta coleções de PRODUÇÃO para JSON, já anonimizadas.
// A anonimização acontece ANTES de gravar em disco — o arquivo exportado nunca
// contém telefone/nome real. Ver anonimizacao-dev-seed.mjs para as regras.
//
// Lista de coleções e critério de inclusão/exclusão: decisão formal do
// proprietário em 2026-07-03, registrada no relatório de encerramento da Fase 3.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { anonimizarDocumento } from './anonimizacao-dev-seed.mjs';

const EXPORT_DIR = '/home/cellcity/Músicas/backups/dev-seed';

// "Claramente devem entrar" + itens válidos da lista antiga do backup-dados.js
// (excluídas as 6 que hoje não têm nenhum documento em produção).
const COLECOES = [
  'usuarios', 'empresas', 'perfis_operacionais', 'agenda', 'mensagens_portal',
  'crm_leads', 'diario_registros', 'diario_metas', 'diario_eventos',
  'estoque_config', 'estoque_movimentacoes', 'favoritos_usuarios', 'produtos',
  'encomendas', 'comandos', 'categorias_comandos', 'categorias_produtos',
  'categorias_informacoes', 'informacoes', 'central_organizacao',
  'chat_historico', 'notas_usuarios', 'preferencias_sistema',
  'solicitacoes_diagnostico', 'tarefas_semana', 'acoes_semana',
  'portal_eventos', 'alarme_config', 'pre_os', 'categorias_wpp',
  'os', 'clientes', 'caixa_lancamentos', 'categorias_caixa',
  'estoque_produtos', 'pendencias', 'fornecedores', 'fornecedor_compras',
  'financeiro_fixas', 'financeiro_pagar', 'financeiro_cat_despesas',
  'config', 'configuracoes', 'posvenda_contatos', 'alertas_usuario',
];

// Excluídas por decisão formal (legado/teste/logs/operacional, sem valor para
// homologação funcional no DEV): clients, orders, teste_caixa, lancamentos_caixa,
// lixeira, cc_lixeira, robo_atividade, tarefas_robo, assinaturas, backup_historico,
// backup_logs, automacao_execucoes, automacao_logs, cc_gdrive_logs, gdrive_backup,
// auditoria_logs, monitoramento, metadata, historico_alertas.
//
// Adiadas por incerteza ("na dúvida, não copiar" — decisão formal 2026-07-03):
// historico_diario, historico_semanal, historico_mensal, auditoria_saas,
// auditoria_usuarios_permissoes, resumo_live.

function _ser(val) {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (typeof val.toDate === 'function') return { _ts_: val.toDate().toISOString() };
  if (Array.isArray(val)) return val.map(_ser);
  const out = {};
  for (const k of Object.keys(val)) out[k] = _ser(val[k]);
  return out;
}

async function main() {
  const sa = JSON.parse(readFileSync('/home/cellcity/Músicas/projetos/Cell-City-Site/sa-key.json', 'utf8'));
  initializeApp({ credential: cert(sa) });
  const db = getFirestore();

  mkdirSync(EXPORT_DIR, { recursive: true });
  const resultado = { exportadoEm: new Date().toISOString(), origem: 'cellcity-crm', anonimizado: true, colecoes: {} };
  let totalDocs = 0;

  for (const nome of COLECOES) {
    const snap = await db.collection(nome).get();
    resultado.colecoes[nome] = snap.docs.map(d => ({
      id: d.id,
      data: anonimizarDocumento(_ser(d.data())),
    }));
    totalDocs += snap.size;
    console.log(`${nome}: ${snap.size} docs`);
  }

  const out = `${EXPORT_DIR}/seed-${Date.now()}.json`;
  writeFileSync(out, JSON.stringify(resultado, null, 2));
  console.log(`\nTotal: ${totalDocs} docs em ${COLECOES.length} coleções`);
  console.log(`Exportado (já anonimizado) para ${out}`);
}

main().catch(e => { console.error(e); process.exit(1); });
