/**
 * Alocação atômica do número de OS (metadata/counter).
 *
 * Evita colisão com robô externo / outra aba do CRM: o contador local
 * NÃO é fonte de verdade — sempre lê o valor atual no Firestore dentro
 * de runTransaction e, na mesma transação, garante que OS-XXXX está livre
 * (1 leitura extra no caminho feliz).
 */

export const ERR_OS_JA_EXISTE = 'OS_JA_EXISTE';

/** Formata o id canônico: OS-0001, OS-0042, … */
export function formatOsId(num) {
  return `OS-${String(num).padStart(4, '0')}`;
}

/**
 * Reserva o próximo número livre de OS.
 * @param {object} deps
 * @param {import('firebase/firestore').Firestore} deps.db
 * @param {typeof import('firebase/firestore').runTransaction} deps.runTransaction
 * @param {typeof import('firebase/firestore').doc} deps.doc
 * @returns {Promise<number>} valor reservado (já gravado em metadata/counter)
 */
export async function reserveNextOsNumber({ db, runTransaction, doc }) {
  let reserved = 0;
  await runTransaction(db, async (tx) => {
    const counterRef = doc(db, 'metadata', 'counter');
    const counterSnap = await tx.get(counterRef);
    let candidate = ((counterSnap.exists() && Number(counterSnap.data().value)) || 0) + 1;
    if (!Number.isFinite(candidate) || candidate < 1) candidate = 1;

    // Leituras antes de qualquer escrita (contrato Firestore).
    // Caminho feliz: 1 get extra (os/OS-XXXX). Se ocupado, avança.
    // Limite alto só para evitar loop infinito em dados corrompidos.
    const MAX_SKIP = 1000;
    let skipped = 0;
    while (skipped <= MAX_SKIP) {
      const osRef = doc(db, 'os', formatOsId(candidate));
      const osSnap = await tx.get(osRef);
      if (!osSnap.exists()) break;
      candidate += 1;
      skipped += 1;
    }
    if (skipped > MAX_SKIP) {
      throw new Error('Não foi possível reservar número de OS livre');
    }

    tx.set(counterRef, { value: candidate });
    reserved = candidate;
  });
  return reserved;
}

/**
 * Cria documento OS somente se o id ainda não existir (nunca sobrescreve).
 * Injeta empresa_id via injectTenant (ex.: tData).
 */
export async function createOsDocExclusive({ db, runTransaction, doc, osData, injectTenant }) {
  const osRef = doc(db, 'os', osData.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(osRef);
    if (snap.exists()) {
      const err = new Error(`${ERR_OS_JA_EXISTE}:${osData.id}`);
      err.code = ERR_OS_JA_EXISTE;
      err.osId = osData.id;
      throw err;
    }
    const payload = typeof injectTenant === 'function' ? injectTenant(osData) : { ...osData };
    tx.set(osRef, payload);
  });
}
