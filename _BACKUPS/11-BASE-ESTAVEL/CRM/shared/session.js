/* ============================================================
   SESSÃO / IDENTIDADE DE CONTA — Cell City Gestão Empresarial
   ------------------------------------------------------------
   Fornece um identificador de usuário ESTÁVEL e COMPARTILHADO
   entre todos os dispositivos (notebook, PC, celular), para que
   a sincronização via Firestore funcione de verdade.

   Substitui o antigo `cc_nota_uid` (aleatório por aparelho), que
   impedia qualquer sincronização real.

   Modelo: CONTA ÚNICA DA LOJA.
   • Quando há login Firebase ativo → usa auth.currentUser.uid.
   • Sem login (ou ainda carregando) → usa a chave canônica da loja
     (STORE_KEY), garantindo que TODOS os aparelhos compartilhem o
     MESMO conjunto de dados imediatamente, sem depender do Console.

   Login (Google ou E-mail/Senha) é gerenciado na página de
   Ferramentas (config) e persiste no aparelho (browserLocalPersistence),
   convivendo silenciosamente com o gate de PIN existente.
   ============================================================ */

// ETAPA 1: session.js usa o evento 'cc-auth-changed' de firebase.js.
// NÃO cria listener onAuthStateChanged próprio — o listener único fica em firebase.js.
import { auth, authReady, getAuthUser } from '../scripts/firebase.js';
import {
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

/* Chave canônica da conta única da loja. Usada como identificador
   quando ainda não há login Firebase — mantém todos os aparelhos
   apontando para os MESMOS documentos. */
export const STORE_KEY = 'loja-cellcity';

let _uid = STORE_KEY;
let _user = null;
let _resolveReady;
export const uidReady = new Promise((r) => { _resolveReady = r; });
let _readyResolved = false;

// Garante sessão persistente neste aparelho (não exige novo login a cada visita)
try { setPersistence(auth, browserLocalPersistence); } catch {}

// Processa a mudança de estado de autenticação recebida do listener único em firebase.js.
// Chamado tanto no carregamento inicial (via authReady) quanto em mudanças posteriores
// (logout, re-login) via evento 'cc-auth-changed'.
function _handleAuthChange(user) {
  const real = user && user.uid && !user.isAnonymous;
  _user = real ? user : null;
  _uid  = real ? user.uid : STORE_KEY;
  console.log(`[AUTH] session.js uid=${_uid} (${real ? 'autenticado' : 'chave da loja'})`);
  if (!_readyResolved) { _readyResolved = true; _resolveReady(_uid); }
  window.dispatchEvent(new CustomEvent('cc-uid-changed', { detail: { uid: _uid, user: _user } }));
}

// Se firebase.js já resolveu antes de session.js ser importado, pega o valor armazenado.
const _existingUser = getAuthUser();
if (_existingUser !== undefined) {
  _handleAuthChange(_existingUser);
} else {
  // Aguarda a resolução inicial do listener único em firebase.js
  authReady.then(_handleAuthChange);
}

// Reage a mudanças futuras (logout, re-login) sem criar um listener adicional no Firebase.
window.addEventListener('cc-auth-changed', (e) => _handleAuthChange(e.detail.user));

// Fallback: resolve em 2,5s caso Firebase Auth não responda (ex.: provider não configurado)
setTimeout(() => {
  if (!_readyResolved) {
    console.warn('[AUTH] session.js: timeout 2.5s — usando chave da loja como fallback');
    _readyResolved = true;
    _resolveReady(_uid);
  }
}, 2500);

/* uid atual (síncrono). Use após `await uidReady` quando precisar de certeza. */
export function getUid() { return _uid || STORE_KEY; }

/* Usuário Firebase atual (ou null se usando a chave da loja). */
export function getUser() { return _user; }

/* Executa cb(uid) agora (se já pronto) e a cada mudança de identidade. */
export function onUid(cb) {
  if (_readyResolved) cb(_uid);
  window.addEventListener('cc-uid-changed', (e) => cb(e.detail.uid));
}

/* ---------- Login / Logout (usados na página de Ferramentas) ---------- */
export async function loginGoogle() {
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function loginEmail(email, senha) {
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInWithEmailAndPassword(auth, email, senha);
  return cred.user;
}

export async function criarContaEmail(email, senha) {
  await setPersistence(auth, browserLocalPersistence);
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}
