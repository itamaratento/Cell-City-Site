/* ============================================================
   FIREBASE SECUNDÁRIO — módulo Usuários e Permissões
   Instância isolada do Firebase App/Auth usada apenas para criar
   contas funcionais e redefinir senhas SEM afetar a sessão do
   administrador logado no app principal (scripts/firebase.js).

   Não há Cloud Functions/Admin SDK neste projeto — por isso a
   redefinição de senha depende de o admin informar a senha atual
   da conta (ele mesmo a define/controla). Isso é uma limitação
   conhecida da Fase 1, documentada no plano de entrega.
   ============================================================ */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
  sendPasswordResetEmail,
  signOut,
  deleteUser
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

/**
 * Exclui a conta do Firebase Auth. Como não há Admin SDK, é preciso
 * autenticar como o próprio usuário-alvo (senha atual dele) para poder
 * apagá-lo — client SDK só permite deleteUser() no usuário autenticado
 * na instância corrente. Roda na instância secundária, sem afetar a
 * sessão do admin logado.
 */
export async function excluirContaSecundaria(email, senhaAtual) {
  const auth = _secondaryAuth();
  await signInWithEmailAndPassword(auth, email, senhaAtual);
  await deleteUser(auth.currentUser);
  await signOut(auth).catch(() => {});
}
