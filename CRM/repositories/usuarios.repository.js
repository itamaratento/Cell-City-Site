import { db, doc, getDoc, setDoc } from '../firebase/client.js';
import { createRepository } from './base.repository.js';

export const UsuariosRepository = createRepository('usuarios');
export const FavoritosUsuariosRepository = createRepository('favoritos_usuarios');
export const NotasUsuariosRepository = createRepository('notas_usuarios');

// Subcoleções de usuarios/{uid} — não cabem na factory genérica (path aninhado),
// escritas à mão com a mesma convenção de nomes.
export const PreferenciasRepository = {
  async getLayout(uid) {
    const snap = await getDoc(doc(db, 'usuarios', uid, 'preferencias', 'layout'));
    return snap.exists() ? snap.data() : null;
  },
  async setLayout(uid, data) {
    return setDoc(doc(db, 'usuarios', uid, 'preferencias', 'layout'), data, { merge: true });
  },
  async getModulos(uid) {
    const snap = await getDoc(doc(db, 'usuarios', uid, 'preferencias', 'modulos'));
    return snap.exists() ? snap.data() : null;
  },
  async setModulos(uid, data) {
    return setDoc(doc(db, 'usuarios', uid, 'preferencias', 'modulos'), data, { merge: true });
  }
};

export const PortalTecnicoRepository = {
  // Nomes alinhados ao vocabulário genérico do base.repository.js (getById/set),
  // em vez de espelhar getDoc/setDoc do SDK cru.
  async getById(uid, docId) {
    const snap = await getDoc(doc(db, 'usuarios', uid, 'portal-tecnico', docId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },
  async set(uid, docId, data, options) {
    return setDoc(doc(db, 'usuarios', uid, 'portal-tecnico', docId), data, options);
  }
};
