// ===== CELL CITY — AUTOMAÇÃO: INFRAESTRUTURA COMPARTILHADA =====
// Funções exportadas usadas por dashboard.js (FASE 1-C) e, futuramente,
// por os.js e posvenda.js após a migração da FASE 2-B.
//
// Regra: toda automação deve usar registrarAutomacao() + jaExecutouAutomacao().
// Padrão de ID do log: {automationId}_{osId}_{timestamp}
// Padrão de ID de dedup: {automationId}_{osId}  (automacao_execucoes)

import { db, doc, setDoc, getDoc, serverTimestamp } from '../scripts/firebase.js';

// Grava log em automacao_logs e, quando status é 'executado' ou 'ignorado',
// marca o flag de deduplicação em automacao_execucoes (ID estável).
export async function registrarAutomacao({ automationId, osId, cliente, telefone, status, detalhes, erro }) {
    const logId = `${automationId}_${osId}_${Date.now()}`;
    try {
        await setDoc(doc(db, 'automacao_logs', logId), {
            automationId,
            osId,
            cliente:     cliente   || '',
            telefone:    (telefone || '').replace(/\D/g, ''),
            status,                           // 'executado' | 'ignorado' | 'erro'
            executadoEm: serverTimestamp(),
            detalhes:    detalhes  || null,
            erro:        erro      || null
        });
        // Flag estável: evita reprocessamento em ciclos futuros.
        // Gravado tanto para 'executado' (enviou) quanto 'ignorado' (descartado intencionalmente).
        if (status === 'executado' || status === 'ignorado') {
            await setDoc(doc(db, 'automacao_execucoes', `${automationId}_${osId}`), {
                automationId,
                osId,
                status,
                executadoEm: serverTimestamp()
            });
        }
    } catch (e) {
        console.warn(`⚠️ [Automação] Log "${automationId}/${osId}" não gravado:`, e);
    }
}

// Retorna true se já existe flag de execução (executado ou ignorado) para
// esta combinação automationId + osId. Fail-open: se der erro, retorna false
// para não bloquear a automação indefinidamente.
export async function jaExecutouAutomacao(automationId, osId) {
    try {
        const snap = await getDoc(doc(db, 'automacao_execucoes', `${automationId}_${osId}`));
        return snap.exists();
    } catch (e) {
        console.warn(`⚠️ [Automação] jaExecutouAutomacao falhou — permitindo execução:`, e);
        return false;
    }
}
