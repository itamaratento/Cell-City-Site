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

// ===== AUTENTICAÇÃO =====
// A autenticação real é gerenciada pelo kernel.js (signInWithEmailAndPassword).
// Este arquivo apenas expõe `auth` e resolve `authReady` com o estado atual.
// Módulos que ainda não migraram para kernel.js continuam funcionando enquanto
// houver uma sessão Firebase ativa (real ou anônima legada).
const auth = getAuth(app);

// NOTA: setPersistence é controlado exclusivamente pelo kernel.js (via login()).
// O padrão do Firebase Auth em browsers já é browserLocalPersistence — não
// forçar aqui evita sobrescrever a escolha de "lembrar de mim" do kernel.

// Resolve com o usuário atual na primeira mudança de estado.
// Com kernel.js ativo: resolve com o usuário real já autenticado.
// Sem sessão ativa: resolve com null (módulo deve usar kernel.initModulo()).
const authReady = new Promise((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    unsubscribe();
    resolve(user ?? null);
  });
});

// Retorna o usuário atual de forma síncrona (null se não autenticado).
function getAuthUser() { return auth.currentUser; }

// NOTA: o antigo adaptador `FirestoreDB` e a função `listenToOrders` foram
// removidos — apontavam para coleções legadas ("orders"/"clients") que nenhuma
// página usa. O CRM/Portal acessam o Firestore diretamente pelos exports abaixo
// (coleções reais: "os", "clientes", "estoque_produtos", etc.).

// ===== EXPORTS PARA USO DIRETO (opcional) =====
export {
  db,
  auth,
  authReady,
  getAuthUser,
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

// ===== GLOBALS para scripts inline (operações user-triggered) =====
if (typeof window !== 'undefined') {
  window.dbFirestore = db;
  window.FirebaseFirestore = {
    collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc,
    query, orderBy, onSnapshot, runTransaction, serverTimestamp
  };
}
