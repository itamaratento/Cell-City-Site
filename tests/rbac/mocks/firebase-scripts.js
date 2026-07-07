// Mock de scripts/firebase.js (módulos ainda no SDK direto, ex.: caixa.js, crm.js, entrada.js)
export const db = { __mock: true };
export {
    serverTimestamp, collection, doc, query, where, orderBy,
    getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot,
    runTransaction
} from './firestore-mock.js';
