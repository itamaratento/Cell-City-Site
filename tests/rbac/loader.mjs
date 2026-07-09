// Loader ESM (node:module register) que redireciona só as importações de
// infraestrutura (Firestore, kernel.js, permissoes.js, Camada Repository)
// para os mocks de tests/rbac/mocks/ — os módulos de página e as
// Repositories reais são importados SEM CÓPIA, direto do código-fonte.
// Elimina o risco de desatualização que já ocorreu nesta semana (a
// evidência de homologação do Estoque ficou obsoleta quando o código
// mudou, porque o harness anterior rodava sobre uma CÓPIA congelada).
const HERE = new URL('.', import.meta.url).href;

const REDIRECTS = [
  [/\/CRM\/scripts\/firebase\.js(\?.*)?$/, HERE + 'mocks/firebase-scripts.js'],
  [/\/CRM\/scripts\/kernel\.js(\?.*)?$/, HERE + 'mocks/kernel.js'],
  [/\/CRM\/shared\/permissoes\.js(\?.*)?$/, HERE + 'mocks/permissoes.js'],
  [/\/CRM\/firebase\/client\.js(\?.*)?$/, HERE + 'mocks/firebase-client.js'],
];

export async function resolve(specifier, context, nextResolve) {
  // Firestore SDK do CDN: redireciona para o mock principal (firestore-mock.js)
  // que exporta todas as funções do Firestore SDK usadas pelos módulos reais.
  // O mock genérico cobre collection, doc, getDocs, addDoc, setDoc, updateDoc,
  // deleteDoc, onSnapshot, runTransaction, serverTimestamp e também getApp,
  // initializeApp, getApps (usados por firebase-secondary.js).
  if (specifier === 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js' ||
      specifier === 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js' ||
      specifier.startsWith('https://www.gstatic.com/firebasejs/') && specifier.endsWith('/firebase-firestore.js')) {
    return { url: HERE + 'mocks/firestore-mock.js', shortCircuit: true };
  }
  // firebase-secondary.js importa firebase-auth.js do CDN — mock mínimo.
  if (specifier.includes('firebase-auth.js')) {
    return { url: HERE + 'mocks/firebase-auth-mock.js', shortCircuit: true };
  }
  // usuarios-permissoes.js importa firebase-functions.js do CDN — mock mínimo.
  if (specifier.includes('firebase-functions.js')) {
    return { url: HERE + 'mocks/firebase-functions-mock.js', shortCircuit: true };
  }
  // Fallback genérico para qualquer outro CDN firebasejs (app, storage, etc.)
  if (specifier.startsWith('https://www.gstatic.com/firebasejs/')) {
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
