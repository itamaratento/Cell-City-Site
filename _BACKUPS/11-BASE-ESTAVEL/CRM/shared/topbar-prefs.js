/* ============================================================
   TOPBAR-PREFS — Cell City CRM
   Gerencia o menu rápido da barra superior.
   Firestore: usuarios/{uid}/preferencias/topbar
   localStorage: cc_topbar_prefs
   Evento: cc-topbar-changed
   ============================================================ */
import { db, doc, setDoc, onSnapshot, serverTimestamp } from '../scripts/firebase.js';
import { getUid, onUid } from './session.js';

const LS_KEY = 'cc_topbar_prefs';
const fsPath = (uid) => doc(db, 'usuarios', uid, 'preferencias', 'topbar');

// Catálogo mestre de itens do menu superior
export const ITENS_TOPBAR = [
  {
    id: 'os', label: 'OS', icon: '📦', categoria: 'Operacional',
    href: '/CRM/pages/os/index.html',
    submenus: [
      { id: 'os-nova',     label: 'Nova OS',       icon: '➕', href: '/CRM/pages/os/index.html' },
      { id: 'os-list',     label: 'Em Andamento',  icon: '📋', href: '/CRM/pages/os/index.html' },
      { id: 'os-garantias',label: 'Garantias',     icon: '🛡️', href: '/CRM/pages/garantias/index.html' },
    ]
  },
  {
    id: 'caixa', label: 'Caixa', icon: '💰', categoria: 'Financeiro',
    href: '/CRM/pages/caixa/index.html', submenus: []
  },
  {
    id: 'financeiro', label: 'Financeiro', icon: '💹', categoria: 'Financeiro',
    href: '/CRM/pages/financeiro/index.html',
    submenus: [
      { id: 'fin-fechamento', label: 'Fechamento Mensal',   icon: '📅', href: '/CRM/pages/fechamento/index.html' },
      { id: 'fin-pendencias', label: 'Pendências e Contas', icon: '🗂️', href: '/CRM/pages/pendencias/index.html' },
    ]
  },
  {
    id: 'crm', label: 'CRM', icon: '🎯', categoria: 'Comercial',
    href: '/CRM/pages/crm-comercial/index.html',
    submenus: [
      { id: 'crm-clientes',  label: 'Clientes',  icon: '👥', href: '/CRM/pages/clientes/index.html' },
      { id: 'crm-pos',       label: 'Pós-venda', icon: '💝', href: '/CRM/pages/pos-venda/index.html' },
      { id: 'crm-catalogo',  label: 'Catálogo',  icon: '📚', href: '/CRM/pages/catalogo/index.html' },
    ]
  },
  {
    id: 'estoque', label: 'Estoque', icon: '📱', categoria: 'Estoque',
    href: '/CRM/pages/estoque/index.html',
    submenus: [
      { id: 'est-compras',    label: 'Compras',    icon: '🛒', href: '/CRM/pages/compras/index.html' },
      { id: 'est-fornecedor', label: 'Fornecedor', icon: '🏭', href: '/CRM/pages/fornecedor/index.html' },
    ]
  },
  {
    id: 'relatorios', label: 'Relatórios', icon: '📊', categoria: 'Relatórios',
    href: '/CRM/pages/relatorios/index.html', submenus: []
  },
  {
    id: 'central-comandos', label: 'Comandos', icon: '⚡', categoria: 'Ferramentas',
    href: '/CRM/pages/central-comandos/index.html',
    submenus: [
      { id: 'cmd-os',      label: 'Nova OS',       icon: '📦', href: '/CRM/pages/os/index.html' },
      { id: 'cmd-cliente', label: 'Novo Cliente',  icon: '👤', href: '/CRM/pages/clientes/index.html' },
      { id: 'cmd-venda',   label: 'Nova Venda',    icon: '💳', href: '/CRM/pages/caixa/index.html' },
      { id: 'cmd-produto', label: 'Novo Produto',  icon: '📦', href: '/CRM/pages/estoque/index.html' },
    ]
  },
  {
    id: 'central-informacoes', label: 'Informações', icon: '📚', categoria: 'Ferramentas',
    href: '/CRM/pages/central-informacoes/index.html', submenus: []
  },
  {
    id: 'portal-tecnico', label: 'Portal Técnico', icon: '🔓', categoria: 'Administração',
    href: '/CRM/pages/portal-tecnico/index.html', submenus: []
  },
  {
    id: 'portal-cliente', label: 'Portal Cliente', icon: '🔷', categoria: 'Administração',
    href: '/CRM/pages/portal-cliente/admin.html', submenus: []
  },
  {
    id: 'config', label: 'Configurações', icon: '⚙️', categoria: 'Administração',
    href: '/CRM/pages/config/index.html', submenus: []
  },
];

let _prefs     = null;
let _unsub     = null;
let _listeners = [];

export function getDefaultPrefs() {
  // Padrão: OS e Caixa visíveis, OS fixado
  return {
    itens: ITENS_TOPBAR.map((item, i) => ({
      id:       item.id,
      visivel:  i < 2,       // só OS e Caixa ligados por padrão
      fixado:   item.id === 'os',
      ordem:    i,
      submenus: item.submenus.map(s => ({ id: s.id, visivel: true }))
    }))
  };
}

function _notify() {
  _listeners.forEach(fn => { try { fn(_prefs); } catch {} });
  window.dispatchEvent(new CustomEvent('cc-topbar-changed', { detail: _prefs }));
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
  }, err => console.warn('[TopbarPrefs]', err));
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
  } catch (e) { console.warn('[TopbarPrefs] setDoc:', e); }
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
