// Loader ESM (node:module register) que redireciona só as importações de
// infraestrutura usadas por CRM/scripts/kernel.js (Firebase Auth/Firestore
// via CDN + scripts/firebase.js) para os mocks de tests/kernel/mocks/.
// O próprio kernel.js é importado SEM CÓPIA, direto do código-fonte real —
// mesmo princípio já usado em tests/rbac/loader.mjs.
const HERE = new URL('.', import.meta.url).href;

const REDIRECTS = [
  [/\/CRM\/scripts\/firebase\.js(\?.*)?$/, HERE + 'mocks/firebase-scripts.js'],
];

export async function resolve(specifier, context, nextResolve) {
  // Firebase Auth SDK do CDN (qualquer versão) — mock com onAuthStateChanged
  // controlável pelo teste (__trigger).
  if (specifier.includes('firebase-auth.js')) {
    return { url: HERE + 'mocks/firebase-auth-mock.js', shortCircuit: true };
  }
  // Firestore SDK do CDN (qualquer versão) — mock em memória (doc/getDoc/
  // setDoc/updateDoc/serverTimestamp).
  if (specifier.includes('firebase-firestore.js')) {
    return { url: HERE + 'mocks/firestore-mock.js', shortCircuit: true };
  }

  const result = await nextResolve(specifier, context);
  for (const [pattern, target] of REDIRECTS) {
    if (pattern.test(result.url)) {
      return { url: target, shortCircuit: true };
    }
  }
  return result;
}
