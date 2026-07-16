/* ============================================================
   FIREBASE SECUNDÁRIO — módulo Admin SaaS (Sprint 4)
   Instância isolada do Firebase App/Auth usada apenas para criar a
   conta do administrador de uma empresa aprovada, SEM afetar a
   sessão do master_admin logado no console (mesmo padrão já usado
   em pages/usuarios-permissoes/firebase-secondary.js — cada página
   que precisa criar contas Auth mantém seu próprio app secundário
   nomeado, em vez de compartilhar uma instância entre páginas
   isoladas, ver CRM/ARQUITETURA.md §6 "isolamento página→página").

   Não há Cloud Functions/Admin SDK para criação de usuário neste
   projeto — por isso ainda é client SDK (createUserWithEmailAndPassword).
   ============================================================ */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Mesmo projeto Firebase do ambiente atual (selecionado por env-config.js).
// Ler window.CC_FIREBASE_CONFIG garante que a conta nasce no Auth do
// ambiente correto (DEV/PROD) — mesma correção aplicada em
// usuarios-permissoes/firebase-secondary.js. Import de efeito colateral
// popula window.* antes.
import "../../shared/env-config.js";
const firebaseConfig = window.CC_FIREBASE_CONFIG;

function _secondaryAuth() {
  const existing = getApps().find(a => a.name === 'saas-admin-secondary');
  const app = existing || initializeApp(firebaseConfig, 'saas-admin-secondary');
  return getAuth(app);
}

/** Cria a conta Auth do administrador da empresa aprovada, sem derrubar a sessão do master_admin. */
export async function criarContaSecundaria(email, senha) {
  const auth = _secondaryAuth();
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  const uid = cred.user.uid;
  await signOut(auth);
  return uid;
}
