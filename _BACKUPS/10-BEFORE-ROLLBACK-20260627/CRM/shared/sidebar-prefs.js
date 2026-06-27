/* ============================================================
   SIDEBAR-PREFS — Cell City CRM
   Gerencia preferências da barra lateral: visibilidade, ordem, fixados.
   Firestore: usuarios/{uid}/preferencias/sidebar
   localStorage: cc_sidebar_prefs (cache rápido)
   ============================================================ */
import { db, doc, setDoc, onSnapshot, serverTimestamp } from '../scripts/firebase.js';
import { getUid, onUid } from './session.js';

const LS_KEY = 'cc_sidebar_prefs';
const fsPath = (uid) => doc(db, 'usuarios', uid, 'preferencias', 'sidebar');

// Catálogo mestre — espelha ITEMS em sidebar.js
export const ITENS_SIDEBAR = [
  { id: 'os',                icon: '📦', label: 'Ordem de Serviço',     categoria: 'Principal',     highlight: true },
  { id: 'caixa',             icon: '💰', label: 'Caixa',                categoria: 'Principal' },
  { id: 'financeiro',        icon: '💹', label: 'Financeiro',           categoria: 'Financeiro' },
  { id: 'clientes',          icon: '👥', label: 'Clientes',             categoria: 'Operacional' },
  { id: 'estoque',           icon: '📱', label: 'Estoque',              categoria: 'Estoque' },
  { id: 'crm-comercial',     icon: '🎯', label: 'CRM Comercial',        categoria: 'Comercial',     badge: 'Novo' },
  { id: 'compras',           icon: '🛒', label: 'Compras',              categoria: 'Comercial',     badge: 'Novo' },
  { id: 'central-comandos',  icon: '⚡', label: 'Central de Comandos',  categoria: 'Ferramentas',   badge: 'Novo' },
  { id: 'notas',             icon: '📋', label: 'Notas',                categoria: 'Ferramentas',   type: 'button' },
  { id: 'fornecedor',        icon: '🏭', label: 'Fornecedor',           categoria: 'Comercial' },
  { id: 'pendencias',        icon: '🗂️',  label: 'Pendências e Contas',  categoria: 'Financeiro',    badge: 'Novo' },
  { id: 'pos-venda',         icon: '💝', label: 'Pós-venda',            categoria: 'Comercial' },
  { id: 'garantias',         icon: '🛡️',  label: 'Garantias',            categoria: 'Operacional' },
  { id: 'relatorios',        icon: '📊', label: 'Relatórios',           categoria: 'Relatórios' },
  { id: 'agenda',            icon: '📅', label: 'Agenda',               categoria: 'Ferramentas' },
  { id: 'portal-tecnico',    icon: '🔓', label: 'Portal Técnico',       categoria: 'Administração' },
  { id: 'central-automacao', icon: '🤖', label: 'Central de Automação', categoria: 'Ferramentas' },
  { id: 'portal-cliente',    icon: '🔷', label: 'Portal do Cliente',    categoria: 'Administração' },
  { id: 'backup',            icon: '🛡️',  label: 'Backup do Sistema',    categoria: 'Administração' },
  { id: 'config',            icon: '⚙️',  label: 'Configurações',        categoria: 'Administração' },
];

let _prefs     = null;
let _unsub     = null;
let _listeners = [];

export function getDefaultPrefs() {
  return {
    itens: ITENS_SIDEBAR.map((item, i) => ({
      id:      item.id,
      visivel: true,
      fixado:  item.highlight || false,
      ordem:   i
    }))
  };
}

function _notify() {
  _listeners.forEach(fn => { try { fn(_prefs); } catch {} });
  window.dispatchEvent(new CustomEvent('cc-sidebar-changed', { detail: _prefs }));
}

function _saveLS(p) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
}

function _assinar(uid) {
  if (_unsub) { _unsub(); _unsub = null; }
  _unsub = onSnapshot(fsPath(uid), snap => {
    if (snap.exists()) {
      const d = snap.data();
      _prefs = { itens: Array.isArray(d.itens) ? d.itens : [] };
    } else {
      try {
        const c = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
        _prefs = c || getDefaultPrefs();
      } catch { _prefs = getDefaultPrefs(); }
    }
    _saveLS(_prefs);
    _notify();
  }, err => console.warn('[SidebarPrefs]', err));
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
    await setDoc(fsPath(uid), { itens: prefs.itens, atualizadoEm: serverTimestamp() });
  } catch (e) { console.warn('[SidebarPrefs] setDoc:', e); }
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
