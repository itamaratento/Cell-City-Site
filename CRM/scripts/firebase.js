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
  getAuth,
  signInAnonymously,
  onAuthStateChanged
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

// ===== AUTENTICAÇÃO ANÔNIMA (compartilhada por todas as páginas) =====
// Garante que TODAS as páginas que importam este arquivo tenham um usuário
// autenticado, satisfazendo as regras do Firestore (request.auth != null).
// O Firestore aguarda automaticamente o token de auth antes de enviar as
// requisições, então não é preciso alterar as páginas que já usam `db`.
const auth = getAuth(app);
const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      resolve(user);
    } else {
      signInAnonymously(auth).catch((e) => {
        console.warn('⚠️ Falha na autenticação anônima:', e);
        resolve(null);
      });
    }
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
  deleteObject
};

// ===== GLOBALS PARA DEBUG (opcional) =====
if (typeof window !== 'undefined') {
  window.dbFirestore = db;
  window.FirebaseFirestore = {
    collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc,
    query, orderBy, onSnapshot, runTransaction, serverTimestamp
  };
  console.log("🔥 Firebase global carregado");
  window.dispatchEvent(new CustomEvent("firebase-ready", { detail: { db } }));
}
