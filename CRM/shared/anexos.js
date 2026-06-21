/* ============================================================
   ANEXOS — Cell City CRM (Firebase Storage)
   Upload e gestão de comprovantes, notas fiscais, etc.
   Uso:
     import { uploadAnexo, renderAnexos, removerAnexo } from '../shared/anexos.js';
   ============================================================ */
import {
    storage, storageRef, uploadBytes, getDownloadURL, deleteObject
} from '../scripts/firebase.js';

const TIPOS_ACEITOS = ['image/jpeg','image/png','image/webp','application/pdf'];
const MAX_MB = 10;

/**
 * Faz upload de um arquivo e retorna o objeto do anexo.
 * @param {File}   file       — objeto File do input
 * @param {string} colecao    — ex: 'financeiro_despesas'
 * @param {string} docId      — ID do documento pai
 * @param {Function} [onProgress] — callback(0-100)
 * @returns {{ nome, url, tipo, tamanho, path, criadoEm }}
 */
export async function uploadAnexo(file, colecao, docId, onProgress) {
    if (!TIPOS_ACEITOS.includes(file.type)) {
        throw new Error(`Tipo não suportado: ${file.type}. Use JPG, PNG, WEBP ou PDF.`);
    }
    if (file.size > MAX_MB * 1024 * 1024) {
        throw new Error(`Arquivo muito grande (máx ${MAX_MB} MB).`);
    }

    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const path     = `comprovantes/${colecao}/${docId}/${safeName}`;
    const ref      = storageRef(storage, path);

    if (onProgress) onProgress(30);
    await uploadBytes(ref, file);
    if (onProgress) onProgress(80);
    const url = await getDownloadURL(ref);
    if (onProgress) onProgress(100);

    return {
        nome:      file.name,
        url,
        tipo:      file.type,
        tamanho:   file.size,
        path,
        criadoEm: new Date().toISOString(),
    };
}

/**
 * Remove um anexo do Storage.
 * @param {string} path — o campo `path` retornado por uploadAnexo
 */
export async function removerAnexo(path) {
    try {
        await deleteObject(storageRef(storage, path));
        return true;
    } catch (e) {
        console.warn('[Anexos] Erro ao remover do Storage:', e);
        return false;
    }
}

/**
 * Renderiza a lista de anexos dentro de um elemento HTML.
 * @param {HTMLElement} container
 * @param {Array} anexos — array de objetos retornados por uploadAnexo
 * @param {Function} [onRemover] — callback(index) ao clicar em remover
 */
export function renderAnexos(container, anexos = [], onRemover = null) {
    if (!container) return;
    if (!anexos.length) {
        container.innerHTML = '<div class="anexo-vazio">Nenhum anexo</div>';
        return;
    }
    container.innerHTML = anexos.map((a, i) => {
        const isImg  = a.tipo?.startsWith('image/');
        const isPdf  = a.tipo === 'application/pdf';
        const icone  = isPdf ? '📄' : isImg ? '🖼️' : '📎';
        const tamanho = a.tamanho ? `${(a.tamanho / 1024).toFixed(0)} KB` : '';
        return `<div class="anexo-item" data-idx="${i}">
            <span class="anexo-icone">${icone}</span>
            <a class="anexo-nome" href="${escHtml(a.url)}" target="_blank" rel="noopener">${escHtml(a.nome)}</a>
            <span class="anexo-tam">${tamanho}</span>
            ${onRemover ? `<button class="anexo-rm" data-idx="${i}" title="Remover">✕</button>` : ''}
        </div>`;
    }).join('');

    if (onRemover) {
        container.querySelectorAll('.anexo-rm').forEach(btn => {
            btn.onclick = () => onRemover(Number(btn.dataset.idx));
        });
    }
}

/**
 * Abre o seletor de arquivos e retorna o File selecionado.
 * @param {string} [accept] — MIME types, ex: 'image/*,application/pdf'
 */
export function selecionarArquivo(accept = 'image/*,application/pdf') {
    return new Promise(resolve => {
        const input     = document.createElement('input');
        input.type      = 'file';
        input.accept    = accept;
        input.onchange  = () => resolve(input.files[0] || null);
        input.oncancel  = () => resolve(null);
        input.click();
    });
}

function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
