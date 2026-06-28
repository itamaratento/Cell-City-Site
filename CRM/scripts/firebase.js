// ===== FIREBASE SETUP - Modular SDK v10.8.0 =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
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
  limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const db = getFirestore(app);

// Storage carregado sob demanda (evita que uma falha de CDN quebre o módulo inteiro)
let _storageCache = null;
async function getFirebaseStorage() {
    if (_storageCache) return _storageCache;
    try {
        const mod = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js");
        _storageCache = {
            storage:      mod.getStorage(app),
            storageRef:   mod.ref,
            uploadBytes:  mod.uploadBytes,
            getDownloadURL: mod.getDownloadURL,
            deleteObject: mod.deleteObject
        };
        return _storageCache;
    } catch (e) {
        console.warn('⚠️ Firebase Storage indisponível:', e);
        return null;
    }
}

// ===== AUTENTICAÇÃO ANÔNIMA (compartilhada por todas as páginas) =====
// Garante que TODAS as páginas que importam este arquivo tenham um usuário
// autenticado, satisfazendo as regras do Firestore (request.auth != null).
// O Firestore aguarda automaticamente o token de auth antes de enviar as
// requisições, então não é preciso alterar as páginas que já usam `db`.
const auth = getAuth(app);

// Garante persistência local antes de qualquer operação de auth
// (evita logout ao atualizar a página em qualquer browser)
setPersistence(auth, browserLocalPersistence).catch(() => {});

const authReady = new Promise((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      unsubscribe(); // Para de escutar após primeira resolução
      resolve(user);
    } else {
      signInAnonymously(auth).then((cred) => {
        resolve(cred.user);
      }).catch((e) => {
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
  auth,
  authReady,
  getFirebaseStorage,
  setPersistence,
  browserLocalPersistence,
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
  limit
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
