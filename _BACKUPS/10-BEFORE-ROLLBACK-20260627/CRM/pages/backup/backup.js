/* ============================================================
   BACKUP — Cell City CRM
   Exporta / Importa todas as coleções do Firestore.
   Firestore: backup_historico (histórico de backups)
   ============================================================ */
import {
  db, collection, getDocs, doc, setDoc, query, orderBy, limit, writeBatch, Timestamp
} from '../../scripts/firebase.js';
import { getUid } from '../../shared/session.js';

const COL_HIST = 'backup_historico';

// ── Catálogo de coleções ───────────────────────────────────────
export const GRUPOS_COLECOES = [
  {
    grupo: 'Core do Negócio',
    critico: true,
    itens: [
      { id: 'os',                  label: 'Ordens de Serviço',        icone: '📦' },
      { id: 'clientes',            label: 'Clientes',                 icone: '👥' },
      { id: 'caixa_lancamentos',   label: 'Lançamentos do Caixa',     icone: '💰' },
      { id: 'categorias_caixa',    label: 'Categorias do Caixa',      icone: '🏷️' },
      { id: 'estoque_produtos',    label: 'Produtos / Estoque',       icone: '📱' },
      { id: 'pendencias',          label: 'Pendências e Contas',      icone: '📋' },
      { id: 'fornecedores',        label: 'Fornecedores',             icone: '🏭' },
      { id: 'fornecedor_compras',  label: 'Compras de Fornecedores',  icone: '🛒' },
      { id: 'crm_leads',           label: 'Leads CRM',                icone: '🎯' },
    ]
  },
  {
    grupo: 'Financeiro',
    critico: true,
    itens: [
      { id: 'financeiro_despesas',     label: 'Despesas',               icone: '📉' },
      { id: 'financeiro_fixas',        label: 'Despesas Fixas',         icone: '🔒' },
      { id: 'financeiro_pagar',        label: 'Contas a Pagar',         icone: '💸' },
      { id: 'financeiro_receber',      label: 'Contas a Receber',       icone: '💵' },
      { id: 'financeiro_cat_despesas', label: 'Categorias de Despesas', icone: '🏷️' },
      { id: 'financeiro_centros_custo',label: 'Centros de Custo',       icone: '🏢' },
      { id: 'compras_financeiras',     label: 'Compras Financeiras',    icone: '🛍️' },
      { id: 'lembretes_pagamento',     label: 'Lembretes',              icone: '🔔' },
      { id: 'relatorio_mensal',        label: 'Relatórios Mensais',     icone: '📊' },
    ]
  },
  {
    grupo: 'Operacional',
    critico: false,
    itens: [
      { id: 'alertas_usuario',    label: 'Alertas',             icone: '⚠️' },
      { id: 'pre_os',             label: 'Pré-OS',              icone: '📝' },
      { id: 'posvenda_contatos',  label: 'Contatos Pós-venda',  icone: '💝' },
      { id: 'posvenda_mensagens', label: 'Templates Pós-venda', icone: '📨' },
      { id: 'chips_cadastros',    label: 'Cadastro de Chips',   icone: '📡' },
      { id: 'agenda',             label: 'Agenda',              icone: '📅' },
      { id: 'agendamentos',       label: 'Agendamentos',        icone: '📆' },
    ]
  },
  {
    grupo: 'Configurações',
    critico: false,
    itens: [
      { id: 'config',         label: 'Configurações do Sistema', icone: '⚙️' },
      { id: 'configuracoes',  label: 'Configurações Gerais',     icone: '🔧' },
      { id: 'estoque_config', label: 'Config do Estoque',        icone: '📦' },
    ]
  },
  {
    grupo: 'Ferramentas',
    critico: false,
    itens: [
      { id: 'diario_registros',        label: 'Diário',                 icone: '📔' },
      { id: 'informacoes',             label: 'Central de Informações', icone: '📚' },
      { id: 'categorias_informacoes',  label: 'Categ. Informações',     icone: '🏷️' },
      { id: 'comandos',                label: 'Comandos',               icone: '⚡' },
      { id: 'categorias_comandos',     label: 'Categ. Comandos',        icone: '🏷️' },
      { id: 'categorias_wpp',          label: 'Categorias WhatsApp',    icone: '📲' },
      { id: 'notas_projeto',           label: 'Notas',                  icone: '📋' },
    ]
  },
  {
    grupo: 'Histórico / Logs',
    critico: false,
    itens: [
      { id: 'auditoria_logs',    label: 'Logs de Auditoria',  icone: '🔍' },
      { id: 'resumo_live',       label: 'Resumo Live',        icone: '📈' },
      { id: 'historico_diario',  label: 'Histórico Diário',   icone: '📅' },
      { id: 'historico_semanal', label: 'Histórico Semanal',  icone: '📅' },
      { id: 'historico_mensal',  label: 'Histórico Mensal',   icone: '📅' },
    ]
  },
];

// ── Serialização de Timestamps ─────────────────────────────────
function _ser(val) {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (typeof val.toDate === 'function' || (val.seconds !== undefined && val.nanoseconds !== undefined)) {
    const d = val.toDate ? val.toDate() : new Date(val.seconds * 1000 + val.nanoseconds / 1e6);
    return { _ts_: d.toISOString() };
  }
  if (Array.isArray(val)) return val.map(_ser);
  const out = {};
  for (const k of Object.keys(val)) out[k] = _ser(val[k]);
  return out;
}

function _deser(val) {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (val._ts_ !== undefined) return Timestamp.fromDate(new Date(val._ts_));
  if (Array.isArray(val)) return val.map(_deser);
  const out = {};
  for (const k of Object.keys(val)) out[k] = _deser(val[k]);
  return out;
}

// ── Exportar Firestore ─────────────────────────────────────────
export async function exportarFirestore(colecoes, onProgress = () => {}) {
  const resultado = {
    versao: 2,
    sistema: 'Cell City CRM',
    exportadoEm: new Date().toISOString(),
    totalDocs: 0,
    colecoes: {},
  };

  for (let i = 0; i < colecoes.length; i++) {
    const colId = colecoes[i];
    onProgress(Math.round(i / colecoes.length * 90), `Lendo ${colId}…`);
    try {
      const snap = await getDocs(collection(db, colId));
      const docs = snap.docs.map(d => ({ _id: d.id, ..._ser(d.data()) }));
      resultado.colecoes[colId] = docs;
      resultado.totalDocs += docs.length;
    } catch (e) {
      console.warn(`[Backup] Erro ao ler ${colId}:`, e);
      resultado.colecoes[colId] = [];
    }
  }

  onProgress(100, 'Exportação concluída!');
  return resultado;
}

// ── Importar / Restaurar ───────────────────────────────────────
export async function importarFirestore(backup, colecoesSelecionadas = null, onProgress = () => {}) {
  const cols = colecoesSelecionadas || Object.keys(backup.colecoes || {});
  const LOTE = 400;
  let total = 0;

  for (let i = 0; i < cols.length; i++) {
    const colId = cols[i];
    const docs  = backup.colecoes?.[colId] || [];
    onProgress(Math.round(i / cols.length * 90), `Restaurando ${colId} (${docs.length} docs)…`);
    if (!docs.length) continue;

    for (let j = 0; j < docs.length; j += LOTE) {
      const lote  = docs.slice(j, j + LOTE);
      const batch = writeBatch(db);
      lote.forEach(({ _id, ...data }) => {
        if (!_id) return;
        batch.set(doc(db, colId, _id), _deser(data));
      });
      await batch.commit();
      total += lote.length;
    }
  }

  onProgress(100, `Restauração concluída — ${total} documentos.`);
  return total;
}

// ── Histórico de Backups ───────────────────────────────────────
export async function registrarBackup({ tipo, nome, totalDocs = 0, tamanho = '', observacoes = '' }) {
  const uid = getUid() || 'loja-cellcity';
  try {
    const ref = doc(collection(db, COL_HIST));
    await setDoc(ref, {
      tipo, nome, totalDocs, tamanho, observacoes,
      usuario: uid,
      criadoEm: Timestamp.fromDate(new Date()),
    });
    return ref.id;
  } catch (e) { console.warn('[Backup] registrar:', e); return null; }
}

export async function carregarHistorico(max = 30) {
  try {
    const snap = await getDocs(
      query(collection(db, COL_HIST), orderBy('criadoEm', 'desc'), limit(max))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.warn('[Backup] histórico:', e); return []; }
}
