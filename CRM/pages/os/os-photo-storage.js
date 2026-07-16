// Upload/remoção de fotos no Firebase Storage — extraído de os.js (P2.2, 2026-07-16).
// Sem dependência de estado do módulo (currentOS/DB/etc.).
import { getFirebaseStorage } from '../../scripts/firebase.js';
import { getTenantFieldValue } from '../../shared/tenant-query.js';
import { DEFAULT_TENANT_ID } from '../../shared/app-config.js';

function dataURLtoBlob(dataURL) {
    const [header, data] = dataURL.split(',');
    const mimeType = (header.match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const binary = atob(data);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: mimeType });
}

// PS-6: todo upload novo vai para empresas/{empresaId}/... (path
// canônico multiempresa; ver storage.rules). URLs legadas em os/
// continuam válidas para leitura.
export function storagePrefixEmpresa() {
    return `empresas/${getTenantFieldValue() || DEFAULT_TENANT_ID}`;
}

export async function uploadPhotoToStorage(dataURL, path) {
    const sm = await getFirebaseStorage();
    if (!sm) throw new Error('Firebase Storage indisponível');
    const blob = dataURLtoBlob(dataURL);
    const ref = sm.storageRef(sm.storage, path);
    await sm.uploadBytes(ref, blob);
    return await sm.getDownloadURL(ref);
}

export async function deletePhotoFromStorage(url) {
    if (!url || !url.startsWith('https://firebasestorage')) return;
    try {
        const sm = await getFirebaseStorage();
        if (!sm) return;
        const u = new URL(url);
        const path = decodeURIComponent(u.pathname.split('/o/')[1]?.split('?')[0] || '');
        if (path) await sm.deleteObject(sm.storageRef(sm.storage, path));
    } catch {}
}
