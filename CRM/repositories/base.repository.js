// Factory genérica de repositórios Firestore — camada de acesso a dados pura,
// sem lógica de negócio. Encapsula as primitivas do SDK modular v10.8.0 já
// usadas no projeto (collection, addDoc, getDocs, getDoc, doc, setDoc,
// updateDoc, deleteDoc, query, orderBy, where, onSnapshot, limit).
import {
  db, collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc,
  deleteDoc, query, orderBy, where, onSnapshot, limit
} from '../firebase/client.js';

export function createRepository(collectionName) {
  const col = () => collection(db, collectionName);
  const ref = (id) => doc(db, collectionName, id);

  function buildQuery({ where: whereClauses = [], orderByField = null, direction = 'asc', limitTo = null } = {}) {
    const constraints = whereClauses.map(([field, op, value]) => where(field, op, value));
    if (orderByField) constraints.push(orderBy(orderByField, direction));
    if (limitTo)      constraints.push(limit(limitTo));
    return constraints.length ? query(col(), ...constraints) : col();
  }

  return {
    collectionName,

    async getById(id) {
      const snap = await getDoc(ref(id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    async list(opts) {
      const snap = await getDocs(buildQuery(opts));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async create(data) {
      return addDoc(col(), data);
    },

    async set(id, data, options) {
      return setDoc(ref(id), data, options);
    },

    async update(id, data) {
      return updateDoc(ref(id), data);
    },

    async remove(id) {
      return deleteDoc(ref(id));
    },

    onChange(callback, opts = {}) {
      return onSnapshot(buildQuery(opts), snap => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, opts.onError || (() => {}));
    }
  };
}
