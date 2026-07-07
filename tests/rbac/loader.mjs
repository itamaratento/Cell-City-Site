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
