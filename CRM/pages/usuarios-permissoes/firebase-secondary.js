/* ============================================================
   FIREBASE SECUNDÁRIO — módulo Usuários e Permissões
   Instância isolada do Firebase App/Auth usada apenas para criar
   contas funcionais e redefinir senhas SEM afetar a sessão do
   administrador logado no app principal (scripts/firebase.js).

   Não há Cloud Functions/Admin SDK para redefinir senha — por isso
   ainda depende de o admin informar a senha atual da conta. Exclusão
   de usuário já migrou para Admin SDK de verdade (functions/index.js,
   2026-07-04): não impersona mais o alvo, ver usuarios-permissoes.js.
   ============================================================ */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Mesmo projeto Firebase do ambiente atual (selecionado por env-config.js).
// Ler window.CC_FIREBASE_CONFIG garante que usuário criado no /dev nasce no
// Auth do DEV — corrige o caso original (eu@cellcity.com.br) que motivou a
// separação de ambientes. Import de efeito colateral popula window.* antes.
import "../../shared/env-config.js";
const firebaseConfig = window.CC_FIREBASE_CONFIG;

function _secondaryAuth() {
  const existing = getApps().find(a => a.name === 'usuarios-permissoes-secondary');
  const app = existing || initializeApp(firebaseConfig, 'usuarios-permissoes-secondary');
  return getAuth(app);
}

/** Cria uma conta funcional (Firebase Auth) sem derrubar a sessão do admin. */
export async function criarContaSecundaria(email, senha) {
  const auth = _secondaryAuth();
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  const uid = cred.user.uid;
  await signOut(auth);
  return uid;
}

/**
 * Redefine a senha de uma conta funcional. Exige a senha atual porque
 * não há Admin SDK disponível neste projeto (ver nota no topo do arquivo).
 */
export async function redefinirSenhaSecundaria(email, senhaAtual, novaSenha) {
  const auth = _secondaryAuth();
  await signInWithEmailAndPassword(auth, email, senhaAtual);
  await updatePassword(auth.currentUser, novaSenha);
  await signOut(auth);
}

/** Alternativa quando o admin não sabe a senha atual: link por e-mail. */
export async function enviarResetPorEmail(email) {
  const auth = _secondaryAuth();
  await sendPasswordResetEmail(auth, email);
  await signOut(auth).catch(() => {});
}
