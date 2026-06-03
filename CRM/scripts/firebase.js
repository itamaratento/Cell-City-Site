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
  serverTimestamp // ← ADICIONADO: timestamp do servidor
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
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

// ===== ADAPTADOR: Firestore + Cache Local =====
export const FirestoreDB = {
  // 🔹 Ler OS (online + fallback offline)
  async getOS() {
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q); // ← getDocs para coleção
      const orders = [];
      snapshot.forEach(d => orders.push({ firestoreId: d.id, ...d.data() }));
      localStorage.setItem('cc_orders_cache', JSON.stringify(orders));
      return orders;
    } catch (err) {
      console.warn('⚠️ Offline: usando cache local', err);
      return JSON.parse(localStorage.getItem('cc_orders_cache') || '[]');
    }
  },

  // 🔹 Salvar OS (online + local)
  async setOS(orders) {
    try {
      localStorage.setItem('cc_orders_cache', JSON.stringify(orders));
      const newOS = orders[0];
      if (newOS && !newOS.synced) {
        // ← addDoc gera ID automático (ideal para novas OS)
        const docRef = await addDoc(collection(db, "orders"), {
          ...newOS,
          synced: true,
          createdAt: newOS.createdAt ? new Date(newOS.createdAt) : serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        newOS.firestoreId = docRef.id;
        localStorage.setItem('cc_orders_cache', JSON.stringify(orders));
      }
      return true;
    } catch (err) {
      console.error('❌ Erro Firestore:', err);
      return false;
    }
  },

  // 🔹 Atualizar OS existente
  async updateOS(firestoreId, updates) {
    try {
      await updateDoc(doc(db, "orders", firestoreId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      // Atualiza cache local também
      const orders = JSON.parse(localStorage.getItem('cc_orders_cache') || '[]');
      const idx = orders.findIndex(o => o.firestoreId === firestoreId);
      if (idx >= 0) {
        orders[idx] = { ...orders[idx], ...updates };
        localStorage.setItem('cc_orders_cache', JSON.stringify(orders));
      }
      return true;
    } catch (err) {
      console.error('❌ Update error:', err);
      return false;
    }
  },

  // 🔹 Excluir OS
  async deleteOS(firestoreId) {
    try {
      await deleteDoc(doc(db, "orders", firestoreId));
      let orders = JSON.parse(localStorage.getItem('cc_orders_cache') || '[]');
      orders = orders.filter(o => o.firestoreId !== firestoreId);
      localStorage.setItem('cc_orders_cache', JSON.stringify(orders));
      return true;
    } catch (err) {
      console.error('❌ Delete error:', err);
      return false;
    }
  },

  // 🔹 Counter (documento único) - ✅ CORREÇÃO: getDoc
  async getCounter() {
    try {
      // ← getDoc para documento único (NÃO getDocs)
      const snap = await getDoc(doc(db, "config", "counter"));
      if (snap.exists()) return snap.data().value || 0;
      return 0;
    } catch {
      return parseInt(localStorage.getItem('cc_counter') || '0');
    }
  },

  async incCounter() {
    const local = parseInt(localStorage.getItem('cc_counter') || '0') + 1;
    localStorage.setItem('cc_counter', local);
    try {
      const ref = doc(db, "config", "counter");
      // Tenta atualizar; se não existir, cria
      await updateDoc(ref, { value: local, updatedAt: serverTimestamp() })
        .catch(() => setDoc(ref, { id: "counter", value: local, updatedAt: serverTimestamp() }));
    } catch {}
    return local;
  },

  // 🔹 Clients
  async getClients() {
    try {
      const snap = await getDocs(collection(db, "clients"));
      const clients = [];
      snap.forEach(d => clients.push({ id: d.id, ...d.data() }));
      localStorage.setItem('cc_clients_cache', JSON.stringify(clients));
      return clients;
    } catch {
      return JSON.parse(localStorage.getItem('cc_clients_cache') || '[]');
    }
  },

  async setClients(clients) {
    localStorage.setItem('cc_clients_cache', JSON.stringify(clients));
    return true;
  }
};

// 🔔 Listener em tempo real (sync entre dispositivos)
export function listenToOrders(callback) {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  return onSnapshot(q,
    (snap) => {
      const orders = [];
      snap.forEach(d => orders.push({ firestoreId: d.id, ...d.data() }));
      localStorage.setItem('cc_orders_cache', JSON.stringify(orders));
      callback(orders);
    },
    (err) => console.warn('⚠️ Listener offline', err)
  );
}

// ===== EXPORTS PARA USO DIRETO (opcional) =====
export {
  db,
  auth,
  authReady,
  collection,
  addDoc,
  getDocs,
  getDoc,      // ← ESSENCIAL para documentos únicos
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp
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