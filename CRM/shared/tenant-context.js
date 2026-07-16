/* ============================================================
   TENANT-CONTEXT.JS — Contexto Multiempresa (PS-1)
   Cell City Gestão Empresarial

   Responsabilidade: único holder do contexto de tenant ativo.
   Não resolve nem carrega dados — apenas armazena e expõe.

   Uso (sempre após initModulo()/tenantReady):
     import { getTenant, setTenant, onTenantChange } from './tenant-context.js';

     const t = getTenant();
     console.log(t.tenantId);   // 'cellcity-master'
     console.log(t.tenantName); // 'Cell City Informática'

   Ciclo de vida:
     initModulo() → tenant-provider.initTenant(ctx) → setTenant({...})
                                                        ↓
                                                  getTenant() disponível
                                                        ↓
     logout() → clearTenant()
   ============================================================ */

import { STORAGE_KEYS, registerTenantFiltersChecker } from './app-config.js';

let _currentTenant = null;
let _listeners = [];
let _filtersEnabled = false;
const TENANT_CACHE_KEY = STORAGE_KEYS.TENANT_CACHE;

function _broadcast() {
  _listeners.forEach(fn => {
    try { fn(_currentTenant); } catch (e) { console.warn('[TenantCtx] Listener error:', e); }
  });
}

export function getTenant() {
  return _currentTenant;
}

export function setTenant(tenant) {
  _currentTenant = tenant ? { ...tenant } : null;
  try {
    if (_currentTenant) {
      sessionStorage.setItem(TENANT_CACHE_KEY, JSON.stringify(_currentTenant));
    } else {
      sessionStorage.removeItem(TENANT_CACHE_KEY);
    }
  } catch (_) { /* storage indisponível */ }
  _broadcast();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tenant-changed', { detail: _currentTenant }));
  }
}

export function clearTenant() {
  setTenant(null);
}

export function onTenantChange(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(f => f !== fn); };
}

export function tryRestoreTenant() {
  if (_currentTenant) return _currentTenant;
  try {
    const raw = sessionStorage.getItem(TENANT_CACHE_KEY);
    if (raw) {
      _currentTenant = JSON.parse(raw);
      return _currentTenant;
    }
  } catch (_) { /* ignora */ }
  return null;
}

export function getTenantId() {
  return _currentTenant?.tenantId || '';
}

export function getTenantName() {
  return _currentTenant?.tenantName || '';
}

/* ── Filtros tenant (PS-6) ─────────────────────────────────────
   Flag global consultada por base.repository.tenant.js e
   tenant-query.js. Só pode ser ligada quando os dados do tenant
   já passaram pelo backfill de empresa_id (empresas/{id}.dados_migrados
   === true) — ligar antes faria documentos legados sem o campo
   sumirem de todas as listagens. Quem liga é o tenant-provider. */
export function setTenantFiltersEnabled(enabled) {
  _filtersEnabled = !!enabled;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tenant-filters-enabled', {
      detail: { enabled: _filtersEnabled }
    }));
  }
}

export function areTenantFiltersEnabled() {
  return _filtersEnabled;
}

registerTenantFiltersChecker(areTenantFiltersEnabled);
