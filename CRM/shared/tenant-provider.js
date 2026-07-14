/* ============================================================
   TENANT-PROVIDER.JS — Inicializador de Tenant (PS-1)
   Cell City Gestão Empresarial

   Responsabilidade: orquestrar a inicialização do contexto
   de tenant imediatamente após o kernel.js resolver.

   Fluxo:
     1. Recebe o ctx do kernel.js (uid, perfil, ...)
     2. Chama tenant-resolver para determinar o tenantId
     3. Carrega config da empresa via getTenantConfig
     4. Popula o tenant-context com os dados resolvidos
     5. Dispara evento tenant-ready

   Uso (chamado por kernel.js automaticamente):
     import { initTenant } from './tenant-provider.js';
     const tenantCtx = await initTenant(kernelCtx);
   ============================================================ */

import { setTenant, tryRestoreTenant } from './tenant-context.js';
import { resolveTenantFromUser, getTenantConfig, DEFAULT_TENANT_ID } from './tenant-resolver.js';

export async function initTenant(ctx, empresaId) {
  if (!ctx || !ctx.uid) {
    console.warn('[TenantProvider] initTenant chamado sem contexto válido');
    const fallback = { tenantId: DEFAULT_TENANT_ID, tenantName: 'Cell City Informática' };
    setTenant(fallback);
    return fallback;
  }

  const restored = tryRestoreTenant();
  if (restored && restored.tenantId) {
    return restored;
  }

  try {
    // PS-2 (TD-001): usa empresaId já resolvido pelo kernel se disponível,
    // evitando dupla leitura do Firestore. O resolver só é consultado
    // quando o kernel não provê o valor (ex.: fallback).
    const tenantId = empresaId ||
      (await resolveTenantFromUser(ctx.uid)).tenantId;

    const config = await getTenantConfig(tenantId);

    const tenant = {
      tenantId,
      tenantName: config.nome_fantasia || config.razao_social || tenantId,
      config,
      logoUrl: config.logo_url || '',
      createdAt: config.createdAt || null,
    };

    setTenant(tenant);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tenant-ready', { detail: tenant }));
    }

    return tenant;
  } catch (e) {
    console.warn('[TenantProvider] Erro ao inicializar tenant, usando fallback:', e);
    const fallback = { tenantId: DEFAULT_TENANT_ID, tenantName: 'Cell City Informática' };
    setTenant(fallback);
    return fallback;
  }
}
