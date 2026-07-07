// Mock de firebase/client.js (módulos migrados para a Camada Repository, ex.: estoque.js).
// Reexporta tudo que CRM/repositories/base.repository.js precisa — o
// base.repository.js e os *.repository.js REAIS rodam sem alteração nos
// testes, só esta borda é mockada (mesmo princípio da homologação da
// Camada Repository Fase 1).
export const db = { __mock: true };
export {
    serverTimestamp, collection, doc, query, where, orderBy, limit,
    getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot
} from './firestore-mock.js';
