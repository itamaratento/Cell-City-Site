/* ============================================================
   BASE.REPOSITORY.TENANT.JS — Factory Multiempresa (PS-2)
   Cell City Gestão Empresarial

   Responsabilidade: estender a base.repository.js original
   com injeção automática de empresa_id e isolamento de dados.

   Diferenças da base.repository.js original:
    - create(data)   → injeta empresa_id automaticamente
    - set(id, data)  → injeta empresa_id automaticamente
    - list(opts)     → adiciona where empresa_id NA CONSULTA
                       (se o filtro estiver ativado — desligado por
                       padrão até a migração dos dados existentes)
    - onChange()     → adiciona where empresa_id no listener
    - getById()      → sem filtro (já é por ID único)
    - update()       → remove empresa_id do payload (proteção)
    - remove()       → sem filtro extra (já é por ID único)

   Controle de ativação do filtro:
     createTenantRepository() cria com filtro DESLIGADO.
     Ativar após a migração dos dados existentes:
       OSRepository.enableFilter()

   Uso:
     import { createTenantRepository } from './base.repository.tenant.js';
     export const OSRepository = createTenantRepository('os');

   Para coleções globais (sem tenant), continuar usando:
     import { createRepository } from './base.repository.js';
   ============================================================ */

import {
  db, collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc,
  deleteDoc, query, orderBy, where, onSnapshot, limit
} from '../firebase/client.js';
import { getTenantId } from '../shared/tenant-context.js';

export function createTenantRepository(collectionName, tenantField = 'empresa_id') {
  let _filterEnabled = false;

  function _getTenantId() {
    const id = getTenantId();
    if (!id) {
      console.warn('[TenantRepo] Tenant ID não disponível — operação pode vazar dados.');
    }
    return id;
  }

  function _injectTenant(data) {
    const tenantId = _getTenantId();
    if (!tenantId) return { ...data };
    return { ...data, [tenantField]: tenantId };
  }

  function _addTenantFilter(constraints, options = {}) {
    if (!_filterEnabled) return constraints;
    const tenantId = _getTenantId();
    if (!tenantId) return constraints;
    if (options.skipTenantFilter) return constraints;
    return [...constraints, where(tenantField, '==', tenantId)];
  }

  const col = () => collection(db, collectionName);
  const ref = (id) => doc(db, collectionName, id);

  function buildQuery({ where: whereClauses = [], orderByField = null, direction = 'asc', limitTo = null, skipTenantFilter = false } = {}) {
    let constraints = whereClauses.map(([field, op, value]) => where(field, op, value));
    constraints = _addTenantFilter(constraints, { skipTenantFilter });
    if (orderByField) constraints.push(orderBy(orderByField, direction));
    if (limitTo)      constraints.push(limit(limitTo));
    return constraints.length ? query(col(), ...constraints) : col();
  }

  return {
    collectionName,

    enableFilter() {
      _filterEnabled = true;
    },

    disableFilter() {
      _filterEnabled = false;
    },

    isFilterEnabled() {
      return _filterEnabled;
    },

    newId(extraData = {}) {
      const fullData = _injectTenant(extraData);
      return { id: doc(col()).id, ...fullData };
    },

    async getById(id) {
      const snap = await getDoc(ref(id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    async list(opts = {}) {
      const snap = await getDocs(buildQuery(opts));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async create(data) {
      return addDoc(col(), _injectTenant(data));
    },

    async set(id, data, options) {
      return setDoc(ref(id), _injectTenant(data), options);
    },

    async update(id, data) {
      const safe = { ...data };
      delete safe[tenantField];
      return updateDoc(ref(id), safe);
    },

    async remove(id) {
      return deleteDoc(ref(id));
    },

    onChange(callback, opts = {}) {
      return onSnapshot(buildQuery(opts), snap => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, opts.onError || (() => {}));
    },

    onDocChange(id, callback, onError) {
      return onSnapshot(ref(id), snap => {
        callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      }, onError || (() => {}));
    },

    getTenantField() {
      return tenantField;
    }
  };
}
