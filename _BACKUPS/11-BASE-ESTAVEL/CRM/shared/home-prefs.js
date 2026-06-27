/* ============================================================
   HOME-PREFS — Cell City CRM
   Gerencia o layout do Painel Central (Home).
   Firestore pessoal: usuarios/{uid}/preferencias/home
   Firestore empresa: configuracoes/home_layout_empresa
   localStorage:      cc_home_prefs
   Evento:            cc-home-changed
   ============================================================ */
import { db, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from '../scripts/firebase.js';
import { getUid, onUid } from './session.js';

const LS_KEY      = 'cc_home_prefs';
const fsPath      = uid => doc(db, 'usuarios', uid, 'preferencias', 'home');
const CORP_PATH   = doc(db, 'configuracoes', 'home_layout_empresa');

export const MODOS    = [
  { id: 'grade',     label: 'Grade',     icone: '⊞', desc: '5 colunas, cards médios' },
  { id: 'lista',     label: 'Lista',     icone: '☰', desc: '1 coluna, horizontal' },
  { id: 'executivo', label: 'Executivo', icone: '◫', desc: '3 colunas, cards grandes' },
  { id: 'compacto',  label: 'Compacto',  icone: '⊟', desc: 'Muitas colunas, ícone + nome' },
];

export const TAMANHOS = [
  { id: 'pequeno', label: 'Pequeno' },
  { id: 'medio',   label: 'Médio'   },
  { id: 'grande',  label: 'Grande'  },
];

export const WIDGETS_FUTUROS = [
  { id: 'agenda-dia',      label: 'Agenda do Dia',        icone: '📅' },
  { id: 'caixa-rapido',    label: 'Caixa Rápido',         icone: '💰' },
  { id: 'financeiro-res',  label: 'Financeiro Resumido',  icone: '💹' },
  { id: 'os-andamento',    label: 'OS em Andamento',       icone: '📦' },
  { id: 'alertas',         label: 'Alertas do Sistema',   icone: '🔔' },
  { id: 'metas',           label: 'Metas da Semana',      icone: '🎯' },
  { id: 'aniversariantes', label: 'Aniversariantes',      icone: '🎂' },
  { id: 'ranking-tec',     label: 'Ranking de Técnicos',  icone: '🏆' },
];

let _prefs      = null;
let _unsub      = null;
let _listeners  = [];

export function getDefaultPrefs() {
  return {
    modo:               'grade',
    tamanho:            'medio',
    modulosOrdem:       [],      // array de IDs em ordem personalizada
    agruparCategorias:  false,
    maxModulos:         24,
    widgets:            [],
  };
}

function _notify() {
  _listeners.forEach(fn => { try { fn(_prefs); } catch {} });
  window.dispatchEvent(new CustomEvent('cc-home-changed', { detail: _prefs }));
}

function _saveLS(p) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
}

async function _loadCorpDefault() {
  try {
    const snap = await getDoc(CORP_PATH);
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

function _assinar(uid) {
  if (_unsub) { _unsub(); _unsub = null; }
  _unsub = onSnapshot(fsPath(uid), async snap => {
    if (snap.exists()) {
      _prefs = { ...getDefaultPrefs(), ...snap.data() };
    } else {
      // Tenta carregar padrão da empresa
      const corp = await _loadCorpDefault();
      _prefs = corp
        ? { ...getDefaultPrefs(), ...corp, _fonte: 'empresa' }
        : ((() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; } })() || getDefaultPrefs());
    }
    _saveLS(_prefs);
    _notify();
  }, err => console.warn('[HomePrefs]', err));
}

export function getPrefs() {
  if (_prefs) return _prefs;
  try {
    const c = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (c) return c;
  } catch {}
  return getDefaultPrefs();
}

export async function setPrefs(prefs) {
  _prefs = prefs;
  _saveLS(prefs);
  _notify();
  const uid = getUid();
  if (!uid) return;
  try {
    await setDoc(fsPath(uid), { ...prefs, atualizadoEm: serverTimestamp() });
  } catch (e) { console.warn('[HomePrefs] setDoc:', e); }
}

export async function salvarPadraoEmpresa(prefs) {
  try {
    await setDoc(CORP_PATH, { ...prefs, atualizadoEm: serverTimestamp() });
    return true;
  } catch (e) { console.warn('[HomePrefs] salvarEmpresa:', e); return false; }
}

export function onPrefsChanged(fn) {
  _listeners.push(fn);
}

export function init() {
  try {
    const c = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (c) { _prefs = c; _notify(); }
  } catch {}
  onUid(uid => _assinar(uid));
}
