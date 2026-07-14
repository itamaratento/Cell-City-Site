/* ============================================================
   SAAS-AUDITORIA.JS — Log de Auditoria e Observabilidade SaaS
   Cell City Gestão Empresarial — PRÉ-SAAS (PS-5)

   Registra eventos de auditoria por empresa no Firestore.
   Uso:
     import { logEvento, logAcao } from './saas-auditoria.js';
     await logAcao('usuario_criado', { uid: '...' });
   ============================================================ */

import { db, collection, addDoc, serverTimestamp } from '../scripts/firebase.js';
import { getTenant } from './tenant-context.js';

const COL_EVENTOS = 'saas_eventos';
const COL_AUDITORIA = 'auditoria_saas';

export async function logEvento(tipo, detalhes = {}) {
  const tenant = getTenant();
  try {
    await addDoc(collection(db, COL_EVENTOS), {
      tipo,
      empresa_id: tenant?.tenantId || 'sistema',
      tenantId: tenant?.tenantId || null,
      detalhes,
      criadoEm: serverTimestamp()
    });
  } catch (e) {
    console.warn('[SaaS Auditoria] Erro ao registrar evento:', e);
  }
}

export async function logAcao(acao, detalhes = {}) {
  const tenant = getTenant();
  try {
    await addDoc(collection(db, COL_AUDITORIA), {
      acao,
      empresa_id: tenant?.tenantId || 'sistema',
      tenantId: tenant?.tenantId || null,
      usuario_id: detalhes.uid || tenant?.uid || null,
      usuario_nome: detalhes.nome || null,
      detalhes,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn('[SaaS Auditoria] Erro ao logar ação:', e);
  }
}
