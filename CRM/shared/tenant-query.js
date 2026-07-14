/* ============================================================
   TENANT-QUERY.JS — Tenant-Aware Firestore Queries (PS-4)
   Cell City Gestão Empresarial

   Para módulos que ainda usam Firestore direto (sem repository).
   Fornece helpers que injetam empresa_id automaticamente.

   Uso:
     import { injectTenantFilter, tData } from './tenant-query.js';

     // Queries com tenant filter (espalhar no query())
     const q = query(collection(db, 'os'),
                     ...injectTenantFilter([where('status', '==', 'ativo')]));
     const snap = await getDocs(q);

     // Dados com tenant injection
     const dados = tData({ nome: 'João', valor: 100 });
     await addDoc(collection(db, 'caixa_lancamentos'), dados);

   Comportamento (PS-6):
   - injectTenantFilter só adiciona o where quando os filtros tenant
     estão ATIVOS (empresas/{id}.dados_migrados === true, ligado pelo
     tenant-provider). Antes do backfill, filtrar por empresa_id
     esconderia documentos legados sem o campo.
   - tData SEMPRE carimba empresa_id nas escritas (inofensivo antes
     do backfill e necessário depois).
   ============================================================ */

import { where } from '../scripts/firebase.js';
import { getTenantId, areTenantFiltersEnabled } from './tenant-context.js';

const TENANT_FIELD = 'empresa_id';

export function getTenantFieldValue() {
  return getTenantId() || '';
}

export function injectTenantFilter(constraints) {
  if (!areTenantFiltersEnabled()) return constraints;
  const tenantId = getTenantFieldValue();
  if (!tenantId) return constraints;
  return [where(TENANT_FIELD, '==', tenantId), ...constraints];
}

export function tData(data) {
  const tenantId = getTenantFieldValue();
  if (!tenantId) return { ...data };
  return { ...data, [TENANT_FIELD]: tenantId };
}

// Globais para scripts inline não-module (ex.: dashboard/index.html usa
// window.FirebaseFirestore) — mesmo padrão do firebase.js. Carregado
// via kernel.js → tenant-provider.js → aqui.
if (typeof window !== 'undefined') {
  window.ccTenant = { injectTenantFilter, tData, getTenantFieldValue };
}
