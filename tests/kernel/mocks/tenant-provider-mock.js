// Mock de CRM/shared/tenant-provider.js — isola o Kernel dos efeitos
// colaterais reais (tenant-query, Firestore de empresas). O contrato
// usado por kernel.js é só initTenant(ctx, empresaId).
let _calls = [];

export async function initTenant(ctx, empresaId) {
  const tenant = {
    tenantId: empresaId || 'cellcity-master',
    tenantName: 'Cell City Informática',
  };
  _calls.push({ ctxUid: ctx?.uid, empresaId });
  return tenant;
}

export function __reset() {
  _calls = [];
}

export function __getCalls() {
  return _calls.slice();
}
