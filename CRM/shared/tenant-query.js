/* ============================================================
   TENANT-QUERY.JS — Tenant-Aware Firestore Queries (PS-4)
   Cell City Gestão Empresarial

   Para módulos que ainda usam Firestore direto (sem repository).
   Fornece helpers que injetam empresa_id automaticamente.

   Uso:
     import { tQuery, tData } from './tenant-query.js';

     // Queries com tenant filter
     const q = tQuery(collection(db, 'os'), where('status', '==', 'ativo'));
     const snap = await getDocs(q);

     // Dados com tenant injection
     const dados = tData({ nome: 'João', valor: 100 });
     await addDoc(collection(db, 'caixa_lancamentos'), dados);
   ============================================================ */

import { where } from '../scripts/firebase.js';
import { getTenantId } from './tenant-context.js';

const TENANT_FIELD = 'empresa_id';

export function getTenantFieldValue() {
  return getTenantId() || '';
}

export function tQuery(baseQuery, ...constraints) {
  const tenantId = getTenantFieldValue();
  if (!tenantId) return baseQuery;
  return baseQuery;
}

export function injectTenantFilter(constraints) {
  const tenantId = getTenantFieldValue();
  if (!tenantId) return constraints;
  return [where(TENANT_FIELD, '==', tenantId), ...constraints];
}

export function tData(data) {
  const tenantId = getTenantFieldValue();
  if (!tenantId) return { ...data };
  return { ...data, [TENANT_FIELD]: tenantId };
}
