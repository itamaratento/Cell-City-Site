/* ============================================================
   AUDITORIA — Cell City Gestão Empresarial
   Registra criação, edição e exclusão em auditoria_logs.
   Uso: import { logAudit } from '../shared/auditoria.js';
        await logAudit({ modulo, acao, id, antes, depois });
   ============================================================ */
import {
    db, collection, addDoc, serverTimestamp
} from '../scripts/firebase.js';

const COL = 'auditoria_logs';

/**
 * @param {Object} opts
 * @param {string}  opts.modulo     — ex: 'despesas', 'compras', 'caixa'
 * @param {string}  opts.acao       — 'criacao' | 'edicao' | 'exclusao'
 * @param {string}  opts.id         — ID do documento afetado
 * @param {Object}  [opts.antes]    — dados anteriores (para edição/exclusão)
 * @param {Object}  [opts.depois]   — dados novos (para criação/edição)
 * @param {string}  [opts.descricao]— texto resumido do item (ex: descrição da despesa)
 */
export async function logAudit({ modulo, acao, id, antes = null, depois = null, descricao = '' }) {
    try {
        await addDoc(collection(db, COL), {
            modulo,
            acao,
            documentoId: id,
            descricao:   String(descricao).slice(0, 200),
            antes:        antes  ? JSON.stringify(antes)  : null,
            depois:       depois ? JSON.stringify(depois) : null,
            usuario:      'sistema',
            criadoEmISO:  new Date().toISOString(),
            criadoEm:     serverTimestamp(),
        });
    } catch (e) {
        console.warn('[Auditoria] Falha ao registrar log:', e);
    }
}
