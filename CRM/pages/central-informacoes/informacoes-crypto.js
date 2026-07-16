// Criptografia local de senhas — extraído de informacoes.js (P2.2, 2026-07-16).
// Sem dependência de estado do módulo. CryptoJS é global (carregado via
// <script> clássico em index.html — https://cdnjs.../crypto-js.min.js).
const CRIPTOGRAFIA_KEY = 'cellcity-2026'; // Chave para criptografia local (não é seguro, apenas ofuscação)

export function criptografarSenha(plaintext) {
    return CryptoJS.AES.encrypt(plaintext, CRIPTOGRAFIA_KEY).toString();
}

export function descriptografarSenha(ciphertext) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, CRIPTOGRAFIA_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
}
