// Reexporta a inicialização real do Firebase (CRM/scripts/firebase.js — arquivo
// protegido, não alterado). Dá aos repositórios um endereço estável em firebase/
// sem tocar nos imports existentes que continuam apontando pro caminho antigo.
export {
  db, auth,
  collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, runTransaction, serverTimestamp, limit
} from '../scripts/firebase.js';
