/* ============================================================
   CENTRAL DE MÓDULOS — Cell City CRM (V2, Sprint MOD-V2-001)
   Catálogo de módulos do sistema + favoritos do usuário.

   O catálogo NÃO é mais hardcoded aqui: é gerado automaticamente
   por scripts/central-modulos/gerar-catalogo.mjs (varre CRM/pages/*)
   e publicado em shared/modulos.catalogo.json. Pasta nova em
   CRM/pages/ = módulo novo no catálogo, sem editar arquivo nenhum
   além de rodar o gerador.

   Favoritar um módulo aqui (⭐) faz ele aparecer automaticamente
   no menu principal (barra lateral do Dashboard) — ver
   shared/menu-favoritos.js, que consome os favoritos daqui.

   Compatibilidade preservada com os consumidores existentes:
   TODOS_MODULOS continua sendo um array exportado ({id, nome,
   icone, url}) e o evento 'cc-modulos-changed' continua sendo o
   sinal de re-render — ele agora também dispara quando o catálogo
   termina de carregar.

   Firestore: usuarios/{uid}/preferencias/modulos → { favoritos: string[] }
   localStorage: cc_modulos_favs      (cache de favoritos / offline)
                 cc_modulos_catalogo  (cache do catálogo / offline)
                 cc_modulos_log       (log local de eventos do módulo)
   ============================================================ */
import { devPrefix, STORAGE_KEYS } from './app-config.js';
import { db, doc, setDoc, onSnapshot, serverTimestamp } from '../scripts/firebase.js';
import { initModulo } from '../scripts/kernel.js';

const LS_KEY = STORAGE_KEYS.MODULOS_FAVS;
const LS_CATALOGO = STORAGE_KEYS.MODULOS_CATALOGO;
const LS_LOG = STORAGE_KEYS.MODULOS_LOG;
const LOG_MAX = 200;
const CATALOGO_URL = '/CRM/shared/modulos.catalogo.json';
const prefsRef = (uid) => doc(db, 'usuarios', uid, 'preferencias', 'modulos');

let _uid = null;

// ── Ambiente atual (MAIN/DEVELOP) — mesma detecção usada em
// shared/brand-header.js, para que nenhuma URL do catálogo aponte
// para a MAIN quando o usuário está navegando na DEVELOP (/dev).
const ENV_PREFIX = devPrefix();

// ── Catálogo (gerado; ver cabeçalho) ──────────────────────────
// Array de referência ESTÁVEL: preenchido in-place quando o JSON
// chega, para que consumidores que importaram TODOS_MODULOS antes
// do load (ex.: menu-favoritos.js) enxerguem os dados sem reimport.
export const TODOS_MODULOS = [];

let _catalogo = null;        // JSON completo (resumo, anomalias, diagnósticos)
let _carregando = null;      // promise em voo, evita fetch duplicado

export function getCatalogo() { return _catalogo; }

export function carregarCatalogo() {
  if (_catalogo) return Promise.resolve(_catalogo);
  if (_carregando) return _carregando;
  _carregando = (async () => {
    let data = null;
    try {
      const r = await fetch(ENV_PREFIX + CATALOGO_URL, { cache: 'no-cache' });
      if (r.ok) data = await r.json();
    } catch { /* offline — cai para o cache abaixo */ }
    if (data) {
      try { localStorage.setItem(LS_CATALOGO, JSON.stringify(data)); } catch {}
    } else {
      try { data = JSON.parse(localStorage.getItem(LS_CATALOGO) || 'null'); } catch {}
      if (data) registrarLog('catalogo-offline', 'catálogo servido do cache local (fetch falhou)');
    }
    if (!data || !Array.isArray(data.modulos)) {
      registrarLog('catalogo-erro', 'catálogo indisponível (sem rede e sem cache)');
      return null;
    }
    _catalogo = data;
    TODOS_MODULOS.length = 0;
    data.modulos
      .filter((m) => !m.oculto)
      .forEach((m) => TODOS_MODULOS.push({ ...m, url: ENV_PREFIX + m.url }));
    registrarLog('catalogo-carregado', `${TODOS_MODULOS.length} módulos (gerado em ${data.geradoEm})`);
    _notify();
    return _catalogo;
  })();
  return _carregando;
}

// ── Log local do módulo (auditorias, erros, execuções) ────────
export function registrarLog(evento, detalhe) {
  try {
    const log = JSON.parse(localStorage.getItem(LS_LOG) || '[]');
    log.push({ em: new Date().toISOString(), evento, detalhe: String(detalhe || '') });
    while (log.length > LOG_MAX) log.shift();
    localStorage.setItem(LS_LOG, JSON.stringify(log));
  } catch { /* localStorage cheio/indisponível — log é melhor-esforço */ }
}
export function getLogs() {
  try { return JSON.parse(localStorage.getItem(LS_LOG) || '[]'); } catch { return []; }
}

// ── Estado interno (favoritos) ────────────────────────────────
let _favs  = null; // null = ainda não carregado
let _unsub = null;

function _readCache() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
}
function _writeCache(arr) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch {}
}
function _notify() {
  window.dispatchEvent(new CustomEvent('cc-modulos-changed'));
}

// ── API pública ───────────────────────────────────────────────
export function getFavoritos() { return _favs || []; }
export function isFavorito(id) { return getFavoritos().includes(id); }

export async function toggleFavorito(id) {
  const cur = getFavoritos().slice();
  const idx = cur.indexOf(id);
  if (idx >= 0) cur.splice(idx, 1);
  else cur.push(id);

  _favs = cur;
  _writeCache(cur);
  registrarLog('favorito', `${idx >= 0 ? 'removido' : 'adicionado'}: ${id}`);
  _notify();

  if (!_uid) return;
  try {
    await setDoc(prefsRef(_uid), { favoritos: cur, atualizadoEm: serverTimestamp() }, { merge: true });
  } catch (e) {
    console.warn('[CentralModulos] erro ao salvar favoritos:', e);
    registrarLog('erro-favorito', e && e.message);
  }
}

// ── Firestore ─────────────────────────────────────────────────
function _assinar() {
  if (_unsub) { _unsub(); _unsub = null; }
  _unsub = onSnapshot(prefsRef(_uid), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      _favs = Array.isArray(data.favoritos) ? data.favoritos : [];
    } else {
      _favs = _readCache() || [];
    }
    _writeCache(_favs);
    _notify();
  }, (e) => console.warn('[CentralModulos] onSnapshot:', e));
}

// ── Init ─────────────────────────────────────────────────────
export function init() {
  const cached = _readCache();
  if (cached) { _favs = cached; _notify(); }
  carregarCatalogo();
  initModulo().then((ctx) => {
    if (!ctx) return;
    _uid = ctx.uid;
    _assinar();
  });
}
