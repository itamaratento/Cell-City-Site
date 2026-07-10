// ============================================================
//  NÚCLEO COMPARTILHADO — Sincronização CRM ↔ Google Drive
//  Regra única para TODOS os módulos (Tutoriais, Soluções Técnicas,
//  Diário e futuros). O CRM é a fonte MASTER; o Drive é espelho de backup.
//
//  Fase 1 (este arquivo): exclusão em cascata, log de auditoria, lixeira
//  global (escrita) e detecção de arquivo ausente no Drive.
//  Fases 2/3 (migração Firestore em tempo real + UI da lixeira) reutilizam
//  estas mesmas primitivas, garantindo comportamento idêntico entre módulos.
//
//  Coleções Firestore:
//   • cc_lixeira      — itens excluídos (retenção 30 dias)
//   • cc_gdrive_logs  — auditoria (ação, módulo, apelido, data/hora)
// ============================================================
import { db, collection, doc, getDocs, setDoc, deleteDoc, addDoc, serverTimestamp }
    from "../scripts/firebase.js";

export const COL_LIXEIRA = 'cc_lixeira';
export const COL_LOGS = 'cc_gdrive_logs';
export const RETENCAO_DIAS = 30;

// ── Identidade do dispositivo (apelido p/ logs/lixeira) ───────────────
//  Não há login nominal (auth anônima); cada aparelho define um apelido
//  uma vez, guardado localmente.
const APELIDO_KEY = 'cc_device_nick';
export function getApelido() {
    try { return localStorage.getItem(APELIDO_KEY) || ''; } catch { return ''; }
}
export function setApelido(nome) {
    try { localStorage.setItem(APELIDO_KEY, (nome || '').trim()); } catch {}
}
function apelidoOuPadrao() { return getApelido() || 'Dispositivo não identificado'; }

// ── Log de auditoria ──────────────────────────────────────────────────
//  acao: 'exclusao' | 'exclusao_definitiva' | 'restauracao' | 'reenvio' | ...
export async function registrarLog(acao, info = {}) {
    try {
        await addDoc(collection(db, COL_LOGS), {
            acao,
            modulo: info.modulo || '',
            registroId: info.registroId || '',
            titulo: info.titulo || '',
            detalhe: info.detalhe || '',
            apelido: apelidoOuPadrao(),
            em: serverTimestamp()
        });
    } catch (e) { console.warn('cc-sync: falha ao registrar log', e); }
}

// ── Lixeira global (escrita) ──────────────────────────────────────────
//  Guarda o snapshot completo do registro para permitir restauração.
//  id do doc = `${modulo}__${registroId}` (estável; evita duplicar).
function lixeiraDocId(modulo, registroId) { return `${modulo}__${registroId}`; }

export async function enviarParaLixeira(modulo, registro, extra = {}) {
    const registroId = registro.id || registro.registroId || '';
    try {
        await setDoc(doc(db, COL_LIXEIRA, lixeiraDocId(modulo, registroId)), {
            modulo,
            registroId,
            titulo: registro.titulo || registro.defeito || registro.nome || '(sem título)',
            registro,                       // snapshot completo p/ restaurar
            backupDriveId: registro.backupDriveId || '',
            backupDriveLink: registro.backupDriveLink || '',
            apelido: apelidoOuPadrao(),
            excluidoEm: new Date().toISOString(),
            excluidoEmTs: serverTimestamp(),
            ...extra
        });
        return true;
    } catch (e) { console.warn('cc-sync: falha ao enviar para lixeira', e); return false; }
}

export async function listarLixeira() {
    try {
        const snap = await getDocs(collection(db, COL_LIXEIRA));
        const out = [];
        snap.forEach(d => out.push(Object.assign({ _docId: d.id }, d.data())));
        return out.sort((a, b) => (b.excluidoEm || '').localeCompare(a.excluidoEm || ''));
    } catch (e) { console.warn('cc-sync: falha ao listar lixeira', e); return []; }
}

export async function removerDaLixeira(modulo, registroId) {
    try { await deleteDoc(doc(db, COL_LIXEIRA, lixeiraDocId(modulo, registroId))); return true; }
    catch (e) { console.warn('cc-sync: falha ao remover da lixeira', e); return false; }
}

// Purga itens com mais de RETENCAO_DIAS (executa no carregamento — sem backend).
//  Se `backup` for informado, apaga também o TXT remanescente no Drive.
export async function purgarLixeira(backup) {
    const limite = Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000;
    let purgados = 0;
    try {
        const itens = await listarLixeira();
        for (const it of itens) {
            const t = Date.parse(it.excluidoEm || '');
            if (isNaN(t) || t >= limite) continue;
            if (backup && it.backupDriveId) { try { await backup.excluirArquivo(it.backupDriveId); } catch {} }
            await deleteDoc(doc(db, COL_LIXEIRA, it._docId));
            purgados++;
        }
    } catch (e) { console.warn('cc-sync: falha na purga da lixeira', e); }
    return purgados;
}

// ── Exclusão em cascata (CRM → Drive) ─────────────────────────────────
//  O CRM é MASTER: ao excluir aqui, apaga o TXT no Drive, arquiva na
//  lixeira e registra log. A remoção do registro no store do módulo é
//  responsabilidade do próprio módulo (chamado após este retornar).
export async function excluirEmCascata({ backup, modulo, registro }) {
    const resultado = { lixeira: false, drive: null, log: false };
    resultado.lixeira = await enviarParaLixeira(modulo, registro);
    if (backup && registro.backupDriveId) {
        resultado.drive = await backup.excluirArquivo(registro.backupDriveId);
    } else {
        resultado.drive = { ok: true, semArquivo: true };
    }
    await registrarLog('exclusao', {
        modulo, registroId: registro.id, titulo: registro.titulo || registro.defeito || '',
        detalhe: resultado.drive && resultado.drive.ok ? 'Arquivo do Drive removido' : 'Falha ao remover arquivo do Drive'
    });
    resultado.log = true;
    return resultado;
}

// ── Detecção de ausência no Drive ─────────────────────────────────────
//  Recebe a lista de registros do módulo e o `backup`. Retorna um Set com
//  os ids cujo backupDriveId não existe mais no Drive (excluído por fora).
export async function detectarAusentes({ backup, registros }) {
    const ausentes = new Set();
    if (!backup) return ausentes;
    for (const r of registros) {
        if (!r.backupDriveId) continue;
        const res = await backup.existeArquivo(r.backupDriveId);
        if (res.ok && res.existe === false) ausentes.add(r.id);
    }
    return ausentes;
}
