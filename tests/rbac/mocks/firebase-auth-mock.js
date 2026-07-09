// Mock mínimo do Firebase Auth para testes — satisfaz os imports de
// firebase-secondary.js sem executar Auth real.
export class Auth {
    constructor() { this.currentUser = null; }
}
export function getAuth() { return new Auth(); }
export async function createUserWithEmailAndPassword() { return { user: { uid: 'mock-uid-' + Date.now() } }; }
export async function signInWithEmailAndPassword() { return { user: { uid: 'mock-uid' } }; }
export async function updatePassword() {}
export async function sendPasswordResetEmail() {}
export async function signOut() {}
