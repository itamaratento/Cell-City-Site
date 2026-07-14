/* ============================================================
   TENANT-RESOLVER.JS — Resolução de Tenant (PS-1)
   Cell City Gestão Empresarial

   Responsabilidade: determinar a qual empresa/tenant um
   determinado usuário pertence, lendo do Firestore.

   Fontes de verdade (em ordem de precedência):
   1. usuarios/{uid}.empresa_id (campo no documento do usuário)
   2. Modo Suporte (sessionStorage 'cc_suporte_empresa_id')
   3. Fallback: 'cellcity-master' (Cell City, compatibilidade)

   Uso:
     import { resolveTenantFromUser, getTenantConfig } from './tenant-resolver.js';
     const tenant = await resolveTenantFromUser(uid);
     const config = await getTenantConfig(tenant.tenantId);
   ============================================================ */

import { db, doc, getDoc } from '../scripts/firebase.js';

export const DEFAULT_TENANT_ID = 'cellcity-master';

export async function resolveTenantFromUser(uid) {
  if (!uid) return { tenantId: DEFAULT_TENANT_ID, tenantName: 'Cell City Informática' };

  try {
    const userSnap = await getDoc(doc(db, 'usuarios', uid));

    if (!userSnap.exists()) {
      return { tenantId: DEFAULT_TENANT_ID, tenantName: 'Cell City Informática' };
    }

    const userData = userSnap.data();
    const suporteId = sessionStorage.getItem('cc_suporte_empresa_id');
    const tenantId = suporteId || userData.empresa_id || DEFAULT_TENANT_ID;

    return { tenantId, tenantName: '' };
  } catch (e) {
    console.warn('[TenantResolver] Erro ao resolver tenant, usando fallback:', e);
    return { tenantId: DEFAULT_TENANT_ID, tenantName: 'Cell City Informática' };
  }
}

export async function getTenantConfig(tenantId) {
  if (!tenantId) return {};
  try {
    const snap = await getDoc(doc(db, 'empresas', tenantId));
    if (snap.exists()) {
      return snap.data();
    }
  } catch (e) {
    console.warn('[TenantResolver] Erro ao carregar config da empresa:', e);
  }
  return {};
}
