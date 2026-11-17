// Mock do Firebase Auth SDK (CDN) para os testes do Kernel. Implementa só
// as funções que kernel.js importa: onAuthStateChanged, signInWithEmailAndPassword,
// signOut, setPersistence, browserLocalPersistence, browserSessionPersistence.
//
// `onAuthStateChanged` guarda o callback registrado por kernel.js (uma única
// vez por import do módulo, exatamente como no SDK real) e expõe `__trigger()`
// para o teste simular o Firebase disparando um novo estado de autenticação.

export const browserLocalPersistence = Symbol('browserLocalPersistence');
export const browserSessionPersistence = Symbol('browserSessionPersistence');

let _callback = null;
let _lastPersistence = null;
let _signOutCalls = 0;
let _nextSignInUser = null;
let _nextSignInError = null;

export function onAuthStateChanged(_auth, cb) {
  _callback = cb;
  return () => { _callback = null; };
}

export async function setPersistence(_auth, persistence) {
  _lastPersistence = persistence;
}

export async function signInWithEmailAndPassword(auth, email) {
  if (_nextSignInError) {
    const err = _nextSignInError;
    _nextSignInError = null;
    throw err;
  }
  const user = _nextSignInUser || { uid: 'uid-login-' + Date.now(), email, isAnonymous: false };
  auth.currentUser = user;
  return { user };
}

export async function signOut(auth) {
  auth.currentUser = null;
  _signOutCalls += 1;
}

// ── Utilitários exclusivos dos testes (não existem no SDK real) ──────────

// Dispara o callback registrado por onAuthStateChanged e aguarda o handler
// assíncrono de kernel.js terminar (ele faz `await` em Firestore antes de
// resolver `_ready`/disparar `kernel-ready`).
export async function __trigger(user) {
  if (!_callback) throw new Error('[mock] onAuthStateChanged ainda não foi registrado');
  await _callback(user);
  await new Promise((r) => setTimeout(r, 0));
}

export function __hasListener() {
  return _callback !== null;
}

export function __getLastPersistence() {
  return _lastPersistence;
}

export function __getSignOutCalls() {
  return _signOutCalls;
}

export function __setNextSignInUser(user) {
  _nextSignInUser = user;
}

export function __setNextSignInError(err) {
  _nextSignInError = err;
}

export function __reset() {
  _callback = null;
  _lastPersistence = null;
  _signOutCalls = 0;
  _nextSignInUser = null;
  _nextSignInError = null;
}
