/* ============================================================
   PORTAL-SYNC — espelho localStorage ↔ Firestore (tempo real)
   ------------------------------------------------------------
   Sincroniza chaves de localStorage com
   `usuarios/{uid}/portal-tecnico/{docId}` SEM exigir reescrita
   do código existente das páginas do Portal Técnico.

   • Gravações locais (das funções save* já existentes) são
     capturadas automaticamente (override de localStorage.setItem)
     e propagadas ao Firestore.
   • Mudanças vindas de outro dispositivo chegam por onSnapshot,
     atualizam o localStorage e disparam o re-render da página.

   Uso (em um <script type="module"> da página):
     import { STORAGE_KEYS } from '../../shared/app-config.js';
     import { syncPortalKeys } from '../../shared/portal-sync.js';
     syncPortalKeys([
       { key: STORAGE_KEYS.PT_TUTORIAIS, docId: 'tutoriais', onRemote: rerender },
       { key: STORAGE_KEYS.PT_FAVORITOS, docId: 'favoritos', onRemote: rerender },
     ]);
   ============================================================ */

import { STORAGE_KEYS } from './app-config.js';
import { db, doc, setDoc, onSnapshot, serverTimestamp } from '../scripts/firebase.js';
import { initModulo } from '../scripts/kernel.js';

let _uid = null;

/** Chaves padrão do Portal Técnico (localStorage ↔ Firestore). */
export const PORTAL_SYNC_KEYS = {
  tutoriais: STORAGE_KEYS.PT_TUTORIAIS,
  favoritos: STORAGE_KEYS.PT_FAVORITOS,
};

export function syncPortalKeys(keys) {
  const watched = new Map();
  keys.forEach(k => watched.set(k.key, k));
  let applyingRemote = false;
  let unsubs = [];

  const refOf = (docId) => doc(db, 'usuarios', _uid, 'portal-tecnico', docId);

  function push(key) {
    if (!_uid) return;
    const meta = watched.get(key);
    if (!meta) return;
    let valor;
    try { valor = JSON.parse(localStorage.getItem(key) ?? 'null'); }
    catch { valor = localStorage.getItem(key); }
    setDoc(refOf(meta.docId), { valor, atualizadoEm: serverTimestamp() })
      .catch(e => console.warn('⚠️ portal-sync push', key, e));
  }

  function subscribe() {
    const origSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      origSet(k, v);
      if (!applyingRemote && watched.has(k)) push(k);
    };

    unsubs.forEach(u => { try { u(); } catch {} });
    unsubs = [];
    keys.forEach(({ key, docId, onRemote }) => {
      const un = onSnapshot(refOf(docId), (snap) => {
        if (!snap.exists()) {
          if (localStorage.getItem(key) != null) push(key);
          return;
        }
        const valor = snap.data().valor;
        const str = JSON.stringify(valor);
        if (localStorage.getItem(key) !== str) {
          applyingRemote = true;
          origSet(key, str);
          applyingRemote = false;
          if (typeof onRemote === 'function') {
            try { onRemote(); } catch (e) { console.warn('portal-sync onRemote', e); }
          }
          window.dispatchEvent(new CustomEvent('cc-portal-synced', { detail: { key, docId } }));
        }
      }, (e) => console.warn('⚠️ portal-sync onSnapshot', docId, e));
      unsubs.push(un);
    });
  }

  initModulo().then(ctx => {
    if (!ctx) return;
    _uid = ctx.uid;
    subscribe();
  });
}
