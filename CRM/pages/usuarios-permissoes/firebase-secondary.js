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
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Mesmo projeto Firebase de scripts/firebase.js — duplicado aqui de
// propósito para manter este módulo isolado (não importar de firebase.js).
const firebaseConfig = {
  apiKey: "AIzaSyD5wQRvcVdweOhVqwd8e08JuzRXOESEbqE",
  authDomain: "cellcity-crm.firebaseapp.com",
  projectId: "cellcity-crm",
  storageBucket: "cellcity-crm.firebasestorage.app",
  messagingSenderId: "645609867368",
  appId: "1:645609867368:web:b3ee19ccfe3d17c61c53dd"
};

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
