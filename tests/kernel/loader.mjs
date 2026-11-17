// Loader ESM (node:module register) — redireciona a borda do Kernel
// (Firebase Auth/Firestore + firebase.js + camada tenant) para mocks.
// O próprio kernel.js é importado SEM CÓPIA do código-fonte real.
const HERE = new URL('.', import.meta.url).href;

const REDIRECTS = [
  [/\/CRM\/scripts\/firebase\.js(\?.*)?$/, HERE + 'mocks/firebase-scripts.js'],
  [/\/CRM\/shared\/tenant-provider\.js(\?.*)?$/, HERE + 'mocks/tenant-provider-mock.js'],
  [/\/CRM\/shared\/tenant-context\.js(\?.*)?$/, HERE + 'mocks/tenant-context-mock.js'],
  [/\/CRM\/shared\/tenant-resolver\.js(\?.*)?$/, HERE + 'mocks/tenant-resolver-mock.js'],
];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.includes('firebase-auth.js')) {
    return { url: HERE + 'mocks/firebase-auth-mock.js', shortCircuit: true };
  }
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
