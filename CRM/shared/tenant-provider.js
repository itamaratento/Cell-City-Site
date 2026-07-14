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

import { setTenant, tryRestoreTenant, setTenantFiltersEnabled } from './tenant-context.js';
import { resolveTenantFromUser, getTenantConfig, DEFAULT_TENANT_ID } from './tenant-resolver.js';
// Importado pelo efeito colateral: expõe window.ccTenant para os scripts
// inline não-module (dashboard/index.html) já na carga do kernel.
import './tenant-query.js';

export async function initTenant(ctx, empresaId) {
  if (!ctx || !ctx.uid) {
    console.warn('[TenantProvider] initTenant chamado sem contexto válido');
    const fallback = { tenantId: DEFAULT_TENANT_ID, tenantName: 'Cell City Informática' };
    setTenant(fallback);
    return fallback;
  }

  const restored = tryRestoreTenant();
  if (restored && restored.tenantId) {
    // PS-6: reativa os filtros a partir do cache da sessão — o flag
    // dadosMigrados foi persistido junto com o tenant no sessionStorage.
    if (restored.dadosMigrados === true) setTenantFiltersEnabled(true);
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
      dadosMigrados: config.dados_migrados === true,
    };

    setTenant(tenant);

    // PS-6: ativação automática dos filtros empresa_id, gateada pelo
    // estado dos dados. empresas/{id}.dados_migrados só é marcado true
    // após o backfill validado (scripts/backfill-empresa-id.mjs +
    // validar-backfill.mjs). Ligar antes esconderia docs legados.
    if (tenant.dadosMigrados) setTenantFiltersEnabled(true);

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
