/* ============================================================
   LIXEIRA — Cell City CRM
   Soft-delete: move para 'lixeira' antes de excluir.
   ============================================================ */
import {
    db, collection, addDoc, doc, getDoc, setDoc, deleteDoc, getDocs,
    query, where, serverTimestamp
} from '../scripts/firebase.js';

const COL_LIXEIRA = 'lixeira';

/**
 * Move um documento para a lixeira em vez de deletar permanentemente.
 * @param {string} colecao   — nome da coleção original (ex: 'financeiro_despesas')
 * @param {string} id        — ID do documento
 * @param {Object} [dados]   — dados já carregados (evita leitura extra)
 */
export async function moverParaLixeira(colecao, id, dados = null) {
    try {
        const docRef  = doc(db, colecao, id);
        const docData = dados || (await getDoc(docRef)).data();
        if (!docData) throw new Error('Documento não encontrado');

        await addDoc(collection(db, COL_LIXEIRA), {
            colecaoOrigem:  colecao,
            idOriginal:     id,
            dados:          JSON.stringify(docData),
            deletadoEmISO:  new Date().toISOString(),
            deletadoEm:     serverTimestamp(),
        });

        await deleteDoc(docRef);
        return true;
    } catch (e) {
        console.error('[Lixeira] Erro ao mover:', e);
        return false;
    }
}

/**
 * Restaura um documento da lixeira para sua coleção original.
 * @param {string} lixeiraId — ID do documento na coleção lixeira
 */
export async function restaurarDaLixeira(lixeiraId) {
    try {
        const lixRef  = doc(db, COL_LIXEIRA, lixeiraId);
        const lixSnap = await getDoc(lixRef);
        if (!lixSnap.exists()) throw new Error('Não encontrado na lixeira');

        const { colecaoOrigem, idOriginal, dados } = lixSnap.data();
        const dadosObj = JSON.parse(dados || '{}');

        await setDoc(doc(db, colecaoOrigem, idOriginal), {
            ...dadosObj,
            restauradoEm: new Date().toISOString(),
        });

        await deleteDoc(lixRef);
        return true;
    } catch (e) {
        console.error('[Lixeira] Erro ao restaurar:', e);
        return false;
    }
}

/**
 * Exclui permanentemente um item já na lixeira.
 * @param {string} lixeiraId
 */
export async function excluirPermanente(lixeiraId) {
    try {
        await deleteDoc(doc(db, COL_LIXEIRA, lixeiraId));
        return true;
    } catch (e) {
        console.error('[Lixeira] Erro ao excluir permanente:', e);
        return false;
    }
}

/**
 * Lista todos os itens da lixeira, opcionalmente filtrados por coleção.
 * @param {string} [colecao]
 */
export async function listarLixeira(colecao = null) {
    try {
        const ref  = collection(db, COL_LIXEIRA);
        const snap = colecao
            ? await getDocs(query(ref, where('colecaoOrigem', '==', colecao)))
            : await getDocs(ref);
        const itens = [];
        snap.forEach(d => itens.push({ id: d.id, ...d.data() }));
        return itens.sort((a, b) => (b.deletadoEmISO || '').localeCompare(a.deletadoEmISO || ''));
    } catch (e) {
        console.error('[Lixeira] Erro ao listar:', e);
        return [];
    }
}
