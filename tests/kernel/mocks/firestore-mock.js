// Fake Firestore em memória — só a borda do SDK usada por kernel.js é
// mockada (doc/getDoc/setDoc/updateDoc/serverTimestamp). Mesmo princípio de
// tests/rbac/mocks/firestore-mock.js, isolado aqui para não acoplar as duas
// suítes.
const store = new Map();

function col(name) {
  if (!store.has(name)) store.set(name, new Map());
  return store.get(name);
}

let _forceGetDocError = null;

export function doc(_db, colName, id) {
  return { __col: colName, __id: id };
}

export async function getDoc(ref) {
  if (_forceGetDocError) {
    const err = _forceGetDocError;
    _forceGetDocError = null;
    throw err;
  }
  const data = col(ref.__col).get(ref.__id);
  return {
    exists: () => data !== undefined,
    data: () => (data ? { ...data } : undefined),
    id: ref.__id,
  };
}

export async function setDoc(ref, data, opts) {
  const c = col(ref.__col);
  c.set(ref.__id, opts?.merge ? { ...(c.get(ref.__id) || {}), ...data } : { ...data });
}

export async function updateDoc(ref, data) {
  const c = col(ref.__col);
  if (!c.has(ref.__id)) {
    const err = new Error('no-document-to-update');
    err.code = 'not-found';
    throw err;
  }
  c.set(ref.__id, { ...c.get(ref.__id), ...data });
}

export function serverTimestamp() {
  return '__SERVER_TIMESTAMP__';
}

// ── Utilitários exclusivos dos testes ─────────────────────────────────
export function __reset() {
  store.clear();
  _forceGetDocError = null;
}

export function __seed(colName, id, data) {
  col(colName).set(id, { ...data });
}

export function __raw(colName, id) {
  const data = col(colName).get(id);
  return data ? { ...data } : undefined;
}

export function __setForceGetDocError(err) {
  _forceGetDocError = err;
}
