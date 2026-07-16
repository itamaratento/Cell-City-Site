// Mock de CRM/scripts/firebase.js (arquivo protegido, nunca importado
// diretamente pelos testes) — fornece só `auth` e `db`, os dois símbolos
// que kernel.js importa de lá. `auth` é um objeto simples e mutável para
// que os testes simulem `auth.currentUser` (ex.: sessão anônima antes do
// login em `login()`).
export const auth = { currentUser: null, __mock: true };
export const db = { __mock: true };

export function __reset() {
  auth.currentUser = null;
}
