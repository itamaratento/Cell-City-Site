// Mock de scripts/firebase.js (módulos ainda no SDK direto, ex.: caixa.js, crm.js, entrada.js)
export const db = { __mock: true };
export {
    serverTimestamp, collection, doc, query, where, orderBy,
    getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot,
    runTransaction
} from './firestore-mock.js';

// Storage carregado sob demanda em firebase.js real — só usado por upload/delete
// de foto (fora do escopo dos testes de RBAC); stub suficiente para satisfazer
// o import de módulos como os.js sem implementar upload de verdade.
export async function getFirebaseStorage() {
    return { __mock: true };
}
