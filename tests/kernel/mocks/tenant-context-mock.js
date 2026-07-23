// Mock de CRM/shared/tenant-context.js — kernel.js só chama clearTenant()
// no logout. Demais APIs existem para o provider mock permanecer simples.
let _current = null;

export function clearTenant() {
  _current = null;
}

export function setTenant(tenant) {
  _current = tenant ? { ...tenant } : null;
}

export function getTenant() {
  return _current;
}

export function __reset() {
  _current = null;
}
