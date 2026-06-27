// ===== FIREBASE SETUP - Modular SDK v10.8.0 =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,        // ← ADICIONADO: cria docs com ID automático
  getDocs,        // ← ADICIONADO: lê coleções
  getDoc,         // ← ADICIONADO: lê documento único (CORREÇÃO CRÍTICA)
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  limit,
  increment,
  arrayUnion,
  Timestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5wQRvcVdweOhVqwd8e08JuzRXOESEbqE",
  authDomain: "cellcity-crm.firebaseapp.com",
  projectId: "cellcity-crm",
  storageBucket: "cellcity-crm.firebasestorage.app",
  messagingSenderId: "645609867368",
  appId: "1:645609867368:web:b3ee19ccfe3d17c61c53dd"
};

// Inicializa
const app = initializeApp(firebaseConfig);
const db      = getFirestore(app);
const storage = getStorage(app);

// ===== AUTENTICAÇÃO — SaaS =====
// NÃO usa mais signInAnonymously! O SaaS precisa do UID real do usuário
// para carregar o contexto da empresa (tenant). Usuário anônimo não tem
// documento em "usuarios/{uid}", então loadContext() retorna null.
//
// initializeAuth com persistência explícita evita o iframe cross-origin
// que o Firefox bloqueia, causando "Pending promise was never set"
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence]
});
// Flag para evitar loop infinito ao limpar sessão anônima
let _cleaningAnonymous = false;

const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, async (user) => {
    // ── SESSÃO ANÔNIMA DETECTADA ───────────────────────────────────
    // Impede que sessões anônimas deixadas por outras páginas
    // (ex: consultar-os.html, portal-cliente) contaminem o CRM.
    if (user?.isAnonymous && !_cleaningAnonymous) {
      _cleaningAnonymous = true;
      console.warn("[AUTH] ⚠️ Sessão anônima detectada (herdada de outra página). Limpando...");
      try {
        await signOut(auth);
        console.log("[AUTH] ✅ Sessão anônima removida com sucesso.");
      } catch (e) {
        console.warn("[AUTH] Erro ao limpar sessão anônima:", e);
      }
      // Redireciona para o login — o usuário precisa se autenticar
      // de verdade (Google, email/senha, PIN) para usar o CRM.
      // Não resolve a promise — o redirect leva a uma página nova.
      const loginPath = '/CRM/pages/config/index.html';
      if (window.location.pathname !== loginPath) {
        window.location.replace(loginPath);
      }
      return;
    }
    resolve(user); // resolve com null se não logado — módulos tratam o redirecionamento
  });
});

// NOTA: o antigo adaptador `FirestoreDB` e a função `listenToOrders` foram
// removidos — apontavam para coleções legadas ("orders"/"clients") que nenhuma
// página usa. O CRM/Portal acessam o Firestore diretamente pelos exports abaixo
// (coleções reais: "os", "clientes", "estoque_produtos", etc.).

// ===== EXPORTS PARA USO DIRETO (opcional) =====
export {
  db,
  storage,
  auth,
  authReady,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  limit,
  increment,
  arrayUnion,
  Timestamp,
  writeBatch,
  // Firebase Storage
  storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  // Firebase Auth extras
  sendPasswordResetEmail
};

// ===== GLOBALS PARA DEBUG / BOOTSTRAP =====
if (typeof window !== 'undefined') {
  window.dbFirestore = db;
  window.ccAuth = auth;   // usado pelo bootstrap-master.js
  window.FirebaseFirestore = {
    collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc,
    query, orderBy, onSnapshot, runTransaction, serverTimestamp
  };
  console.log("🔥 Firebase global carregado");
  window.dispatchEvent(new CustomEvent("firebase-ready", { detail: { db } }));
}
