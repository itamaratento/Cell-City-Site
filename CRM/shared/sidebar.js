/* ============================================================
   CENTRAL DE MÓDULOS — Cell City Gestão Empresarial

   • Catálogo completo de módulos do sistema
   • Favoritos da Home → usuarios/{uid}/preferencias/modulos
   • Modal com busca instantânea e filtro por categoria
   • Botão ⭐ em cada card da home filtra quais aparecem
   ============================================================ */
import { db, doc, setDoc, onSnapshot, serverTimestamp } from '../scripts/firebase.js';
import { getUid, onUid } from './session.js';

const MAX_FAVS   = 24;
const LS_KEY     = 'cc_modulos_favs';
const PREFS_PATH = (uid) => doc(db, 'usuarios', uid, 'preferencias', 'modulos');

// ── Catálogo completo ──────────────────────────────────────────
export const TODOS_MODULOS = [
  // Operacional
  { id: 'os',                  nome: 'Ordem de Serviço',       icone: '📦', descricao: 'Gestão técnica de reparos',              categoria: 'Operacional'   },
  { id: 'caixa',               nome: 'Caixa',                   icone: '💰', descricao: 'Fluxo financeiro diário',                categoria: 'Financeiro'    },
  { id: 'central-alertas',     nome: 'Central de Alertas',      icone: '🔔', descricao: 'Alertas e pendências do sistema',       categoria: 'Operacional'   },
  { id: 'clientes',            nome: 'Clientes',                icone: '👥', descricao: 'Base de clientes',                      categoria: 'Operacional'   },
  { id: 'estoque',             nome: 'Estoque',                 icone: '📱', descricao: 'Peças e produtos',                      categoria: 'Estoque'       },
  { id: 'acaodasemana',        nome: 'Agenda',                  icone: '📅', descricao: 'Agenda inteligente e tarefas',          categoria: 'Operacional'   },
  { id: 'autoatendimento',     nome: 'Autoatendimento',         icone: '🤖', descricao: 'Pré-OS online do site',                 categoria: 'Operacional'   },
  { id: 'garantias',           nome: 'Garantias',               icone: '🛡️', descricao: 'Termos e configurações de garantia',   categoria: 'Operacional'   },
  // Financeiro
  { id: 'financeiro',          nome: 'Financeiro',              icone: '💹', descricao: 'Controle financeiro detalhado',         categoria: 'Financeiro'    },
  { id: 'despesas',            nome: 'Despesas',                icone: '💸', descricao: 'Controle de despesas e saídas',          categoria: 'Financeiro'    },
  { id: 'compras',             nome: 'Compras',                 icone: '🛒', descricao: 'Pedidos e recebimentos de peças',       categoria: 'Estoque'       },
  { id: 'fechamento',          nome: 'Fechamento',              icone: '🔒', descricao: 'Relatório mensal consolidado',          categoria: 'Financeiro'    },
  { id: 'pendencias',          nome: 'Pendências e Contas',     icone: '📋', descricao: 'Clientes, parceiros e empréstimos',     categoria: 'Financeiro'    },
  // Comercial
  { id: 'crm-comercial',       nome: 'CRM Comercial',           icone: '🎯', descricao: 'Leads, orçamentos e oportunidades',     categoria: 'Comercial'     },
  { id: 'fornecedor',          nome: 'Fornecedor',              icone: '🏭', descricao: 'Gestão de fornecedores',                categoria: 'Comercial'     },
  { id: 'pos-venda',           nome: 'Pós-venda',               icone: '💝', descricao: 'Fidelização e garantia de clientes',    categoria: 'Comercial'     },
  { id: 'catalogo',            nome: 'Catálogo',                icone: '🛍️', descricao: 'Produtos e vendas via WhatsApp',       categoria: 'Comercial'     },
  // Estoque
  // Relatórios
  { id: 'relatorios',          nome: 'Relatórios',              icone: '📊', descricao: 'Gráficos e análise do negócio',        categoria: 'Relatórios'    },
  // Ferramentas
  { id: 'central-comandos',    nome: 'Central de Comandos',     icone: '⚡', descricao: 'Ferramentas e atalhos rápidos',         categoria: 'Ferramentas'   },
  { id: 'central-organizacao', nome: 'Central de Automação',    icone: '🔧', descricao: 'WhatsApp, automações e histórico',     categoria: 'Ferramentas'   },
  { id: 'central-informacoes', nome: 'Central de Informações',  icone: '📚', descricao: 'Comandos, sites, senhas e mais',        categoria: 'Ferramentas'   },
  { id: 'portal-cliente',      nome: 'Portal do Cliente',       icone: '🔷', descricao: 'Acesso e diagnóstico do cliente',       categoria: 'Ferramentas'   },
  { id: 'portal-tecnico',      nome: 'Portal Técnico',          icone: '🔓', descricao: 'FRP, firmwares e soluções técnicas',    categoria: 'Ferramentas'   },
  { id: 'diario',              nome: 'Diário',                  icone: '📔', descricao: 'Organização pessoal e planejamento',    categoria: 'Ferramentas'   },
  // Administração
  { id: 'auditoria',           nome: 'Auditoria',               icone: '🔍', descricao: 'Logs e rastreamento de ações',          categoria: 'Administração' },
  { id: 'lixeira',             nome: 'Lixeira',                 icone: '🗑️', descricao: 'Restaurar itens excluídos',            categoria: 'Administração' },
  { id: 'integridade',         nome: 'Integridade',             icone: '🛡️', descricao: 'Verificar consistência dos dados',     categoria: 'Administração' },
  { id: 'homologacao',         nome: 'Homologação',             icone: '🧪', descricao: 'Auditoria completa de integrações',     categoria: 'Administração' },
  { id: 'backup',              nome: 'Backup do Sistema',       icone: '🛡️', descricao: 'Exportar dados e backup do código',    categoria: 'Administração' },
  { id: 'config',              nome: 'Configurações',           icone: '⚙️', descricao: 'Ferramentas e configurações do sistema',categoria: 'Administração' },
  { id: 'favoritos',           nome: 'Favoritos',               icone: '⭐', descricao: 'Acesso rápido aos módulos favoritos',      categoria: 'Ferramentas'   },
  // SaaS — visível apenas para Master Admin
  { id: 'saas', nome: 'Central SaaS', icone: '🏢', descricao: 'Painel Master: empresas, planos e usuários', categoria: 'SaaS', masterOnly: true },
];

// ── Estado interno ────────────────────────────────────────────
let _favs      = null;   // null = não carregado → mostra tudo (backward compat)
let _unsub     = null;
let _listeners = [];

// ── Cache local ───────────────────────────────────────────────
function _readCache() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
}
function _writeCache(arr) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch {}
}

// ── Notificação de mudança ────────────────────────────────────
function _notify() {
  _listeners.forEach(fn => { try { fn(_favs); } catch {} });
  window.dispatchEvent(new CustomEvent('cc-modulos-changed'));
}

// ── API pública ───────────────────────────────────────────────

/** Retorna array de IDs favoritos, ou null se ainda não definido (mostra tudo). */
export function getFavoritosHome() { return _favs; }

/** Retorna true se o módulo está favoritado. */
export function isFavorito(id) {
  if (_favs === null) return false;
  return _favs.includes(id);
}

/** Registra callback chamado quando favoritos mudam. */
export function onModulosChanged(fn) { _listeners.push(fn); }

/**
 * Define diretamente os favoritos da home — usado ao aplicar layouts prontos.
 * Passa null para limpar e mostrar todos os módulos.
 */
export async function setFavoritos(ids) {
  _favs = Array.isArray(ids) ? ids.slice(0, MAX_FAVS) : null;
  if (_favs !== null) _writeCache(_favs);
  else { try { localStorage.removeItem(LS_KEY); } catch {} }
  _notify();
  await _salvar();
}

/**
 * Alterna o favorito de um módulo.
 * Retorna false se o limite MAX_FAVS foi atingido ao adicionar.
 */
export async function toggleFavorito(id) {
  const cur = _favs ? [..._favs] : [];
  const idx = cur.indexOf(id);
  if (idx >= 0) {
    cur.splice(idx, 1);
  } else {
    if (cur.length >= MAX_FAVS) {
      _toast(`Limite de ${MAX_FAVS} módulos favoritos atingido.`);
      return false;
    }
    cur.push(id);
  }
  _favs = cur;
  _writeCache(cur);
  _notify();
  await _salvar();
  return true;
}

/** Abre o modal da Central de Módulos. */
export function abrirCentralModulos() {
  _buildModal();
  const o = document.getElementById('cm-overlay');
  if (o) {
    o.classList.add('open');
    _updateLayoutSection();
    setTimeout(() => document.getElementById('cm-search-input')?.focus(), 80);
  }
}

/** Fecha o modal. */
export function fecharCentralModulos() {
  document.getElementById('cm-overlay')?.classList.remove('open');
}

// ── Firestore ─────────────────────────────────────────────────
async function _salvar() {
  try {
    await setDoc(PREFS_PATH(getUid()), {
      favoritos:    _favs,
      atualizadoEm: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('[CentralModulos] salvar:', e);
  }
}

function _assinar(uid) {
  if (_unsub) { _unsub(); _unsub = null; }
  _unsub = onSnapshot(PREFS_PATH(uid), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const remote = Array.isArray(data.favoritos) ? data.favoritos : null;
      if (JSON.stringify(remote) !== JSON.stringify(_favs)) {
        _favs = remote;
        if (remote) _writeCache(remote);
        _notify();
      }
    } else {
      // Sem documento ainda: tenta cache local
      const cached = _readCache();
      if (cached !== null && _favs === null) {
        _favs = cached;
        _notify();
      }
      // Se não há cache: _favs=null → mostra todos os módulos (backward compat)
    }
  }, (e) => console.warn('[CentralModulos] onSnapshot:', e));
}

// ── Toast ─────────────────────────────────────────────────────
function _toast(msg) {
  let el = document.getElementById('cm-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cm-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'cm-toast-show';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = ''; }, 3000);
}

// ── Estilos (injetados uma vez) ───────────────────────────────
function _injectStyles() {
  if (document.getElementById('cm-styles')) return;
  const css = `
/* ── Central de Módulos — modal ── */
#cm-overlay {
  display: none; position: fixed; inset: 0;
  background: rgba(0,0,0,.72); z-index: 3000;
  align-items: flex-start; justify-content: center;
  padding: 20px 16px; box-sizing: border-box;
}
#cm-overlay.open { display: flex; }
#cm-modal {
  background: #0d0f14;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 16px; width: 100%; max-width: 620px;
  max-height: 90vh; display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,.7); overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
}
#cm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid rgba(255,255,255,.07); flex-shrink: 0;
}
#cm-title {
  font-size: 16px; font-weight: 800; color: #f5f7fa;
  display: flex; align-items: center; gap: 8px;
}
#cm-count {
  font-size: 11px; font-weight: 600; color: #6b7280;
  background: rgba(255,255,255,.07); padding: 2px 8px;
  border-radius: 99px; margin-left: 4px;
}
#cm-close-btn {
  background: none; border: none; color: #6b7280;
  font-size: 20px; cursor: pointer; line-height: 1;
  padding: 4px 8px; border-radius: 6px; transition: background .15s, color .15s;
}
#cm-close-btn:hover { background: rgba(255,80,80,.15); color: #ff6b6b; }
#cm-search-wrap {
  padding: 14px 20px 10px; flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,.07);
}
#cm-search-input {
  width: 100%; background: #1a1d23;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 8px; padding: 10px 14px;
  color: #f5f7fa; font-size: 13px; font-family: inherit;
  outline: none; box-sizing: border-box; transition: border-color .15s;
}
#cm-search-input:focus { border-color: #00c853; }
#cm-search-input::placeholder { color: #6b7280; }
#cm-legend {
  font-size: 11px; color: #4b5563; padding: 6px 20px 0; flex-shrink: 0;
}
#cm-body {
  overflow-y: auto; flex: 1; padding: 4px 0 16px;
}
#cm-body::-webkit-scrollbar { width: 4px; }
#cm-body::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,.12); border-radius: 2px;
}
.cm-cat-header {
  font-size: 10px; font-weight: 700; color: #6b7280;
  text-transform: uppercase; letter-spacing: .6px;
  padding: 14px 20px 6px;
}
.cm-item {
  display: flex; align-items: center; gap: 14px;
  padding: 10px 20px; cursor: pointer; transition: background .12s;
}
.cm-item:hover { background: rgba(255,255,255,.04); }
.cm-item-icon { font-size: 22px; width: 32px; text-align: center; flex-shrink: 0; }
.cm-item-info { flex: 1; min-width: 0; }
.cm-item-nome {
  font-size: 13.5px; font-weight: 600; color: #e8edf5;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cm-item-desc { font-size: 11.5px; color: #8a9ab5; margin-top: 1px; }
.cm-star {
  background: none; border: none; font-size: 20px; cursor: pointer;
  padding: 4px 6px; border-radius: 6px; transition: background .15s, transform .12s;
  flex-shrink: 0; line-height: 1; color: #4b5563;
}
.cm-star:hover { background: rgba(255,200,0,.10); transform: scale(1.2); }
.cm-star.on { color: #f5a623; }
.cm-star.on:hover { color: #e5952d; }
.cm-empty-search {
  text-align: center; color: #6b7280;
  font-size: 13px; padding: 32px 20px;
}

/* ── Estrela nos cards da home ── */
.module-card { position: relative; overflow: visible; }
.mc-star {
  position: absolute; top: 8px; right: 8px;
  background: rgba(10,12,16,.7); backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 6px; font-size: 13px; line-height: 1;
  padding: 3px 5px; cursor: pointer; z-index: 5;
  transition: background .15s, color .15s, transform .12s, opacity .15s;
  color: #6b7280; opacity: 0;
}
.module-card:hover .mc-star { opacity: 1; }
.mc-star.on { color: #f5a623; opacity: 1; }
.mc-star:hover { background: rgba(255,200,0,.18); color: #f5a623; transform: scale(1.15); }

/* ── Estado vazio na home ── */
#cm-home-empty {
  display: none; flex-direction: column; align-items: center;
  justify-content: center; padding: 56px 24px; text-align: center;
  gap: 12px; font-family: 'Inter', system-ui, sans-serif;
}
.cm-empty-ico { font-size: 52px; }
.cm-empty-tit { font-size: 18px; font-weight: 700; color: #c8d0dc; }
.cm-empty-sub { font-size: 13px; color: #8a9ab5; }
.cm-empty-cta {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 10px; padding: 11px 22px;
  background: rgba(0,200,83,.14); border: 1px solid rgba(0,200,83,.4);
  border-radius: 9px; color: #00c853; font-size: 13.5px; font-weight: 600;
  cursor: pointer; font-family: inherit; transition: background .15s;
}
.cm-empty-cta:hover { background: rgba(0,200,83,.24); }

/* ── Layout do Sistema — seção no modal ── */
#cm-layout-section {
  padding: 12px 20px 10px;
  border-bottom: 1px solid rgba(255,255,255,.07);
  flex-shrink: 0;
}
.cm-layout-title {
  font-size: 10px; font-weight: 700; color: #6b7280;
  text-transform: uppercase; letter-spacing: .6px;
  margin-bottom: 10px;
}
.cm-layout-row {
  display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
}
.cm-layout-row:last-child { margin-bottom: 0; }
.cm-layout-row-label {
  font-size: 12px; color: #8a9ab5; flex-shrink: 0; min-width: 120px;
}
.cm-layout-modes { display: flex; gap: 4px; flex-wrap: wrap; }
.cm-lm-btn {
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
  border-radius: 6px; color: rgba(255,255,255,.55); font-size: 11.5px;
  font-weight: 500; padding: 5px 10px; cursor: pointer;
  transition: background .12s, color .12s, border-color .12s;
  font-family: inherit; white-space: nowrap; line-height: 1;
}
.cm-lm-btn:hover { background: rgba(255,255,255,.09); color: rgba(255,255,255,.85); }
.cm-lm-btn.active {
  background: rgba(0,200,83,.14); border-color: rgba(0,200,83,.4);
  color: #00c853; font-weight: 600;
}
.cm-lc-btn {
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
  border-radius: 6px; color: rgba(255,255,255,.55); font-size: 11.5px;
  font-weight: 500; padding: 5px 12px; cursor: pointer;
  transition: background .12s, color .12s, border-color .12s;
  font-family: inherit; white-space: nowrap; line-height: 1;
}
.cm-lc-btn:hover { background: rgba(255,255,255,.09); color: rgba(255,255,255,.85); }
.cm-lc-btn.active {
  background: rgba(99,179,237,.12); border-color: rgba(99,179,237,.35);
  color: #63b3ed; font-weight: 600;
}

/* ── Toast ── */
#cm-toast {
  position: fixed; bottom: 24px; left: 50%;
  transform: translateX(-50%) translateY(12px);
  background: #151920; border: 1px solid rgba(0,200,83,.3);
  color: #e8edf5; font-size: 13px; font-weight: 500;
  padding: 10px 20px; border-radius: 8px; z-index: 9999;
  pointer-events: none; opacity: 0;
  transition: opacity .25s, transform .25s;
  font-family: 'Inter', system-ui, sans-serif;
}
#cm-toast.cm-toast-show { opacity: 1; transform: translateX(-50%) translateY(0); }
  `;
  const s = document.createElement('style');
  s.id = 'cm-styles';
  s.textContent = css;
  document.head.appendChild(s);
}

// ── Layout do Sistema ─────────────────────────────────────────
const _HOME_MODE_KEY = 'cc_home_mode';
const _COMPACT_KEY   = 'dashboard_modo_compacto';

function _applyHomeMode(modo) {
  const MODOS = ['modulos', 'dashboard', 'completo'];
  if (!MODOS.includes(modo)) modo = 'modulos';
  // Proxy: aciona o botão oculto do dashboard (carrega Firestore sync)
  const hiddenBtn = document.querySelector(`.home-mode-btn[data-mode="${modo}"]`);
  if (hiddenBtn) {
    hiddenBtn.click();
  } else {
    document.documentElement.setAttribute('data-home-mode', modo);
    localStorage.setItem(_HOME_MODE_KEY, modo);
  }
  _updateLayoutSection();
}

function _toggleCompact() {
  // Proxy: aciona o botão oculto do dashboard (carrega Firestore sync)
  const hiddenBtn = document.getElementById('compact-mode-toggle');
  if (hiddenBtn) {
    hiddenBtn.click();
  } else {
    const isCompact = localStorage.getItem(_COMPACT_KEY) === 'true';
    const novo = !isCompact;
    document.body.classList.toggle('modo-compacto', novo);
    localStorage.setItem(_COMPACT_KEY, novo ? 'true' : '');
  }
  _updateLayoutSection();
}

function _updateLayoutSection() {
  const modo = document.documentElement.getAttribute('data-home-mode')
    || localStorage.getItem(_HOME_MODE_KEY)
    || 'modulos';
  const isCompact = document.body.classList.contains('modo-compacto')
    || localStorage.getItem(_COMPACT_KEY) === 'true';

  document.querySelectorAll('#cm-layout-modes .cm-lm-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === modo);
  });

  const cBtn = document.getElementById('cm-layout-compact');
  if (cBtn) {
    cBtn.textContent = isCompact ? '▣ Compacto' : '▢ Normal';
    cBtn.classList.toggle('active', isCompact);
  }
}

// ── Modal ─────────────────────────────────────────────────────
let _modalBuilt = false;

function _buildModal() {
  if (_modalBuilt) { _renderBody(''); return; }
  _modalBuilt = true;

  const o = document.createElement('div');
  o.id = 'cm-overlay';
  o.innerHTML = `
    <div id="cm-modal" role="dialog" aria-modal="true" aria-label="Central de Módulos">
      <div id="cm-header">
        <span id="cm-title">🧩 Central de Módulos <span id="cm-count"></span></span>
        <button id="cm-close-btn" aria-label="Fechar">✕</button>
      </div>
      <div id="cm-search-wrap">
        <input id="cm-search-input" type="text"
          placeholder="🔍 Buscar por nome, descrição ou categoria…" autocomplete="off">
      </div>
      <div id="cm-layout-section">
        <div class="cm-layout-title">⚙️ Layout do Sistema</div>
        <div class="cm-layout-row">
          <span class="cm-layout-row-label">Modo de exibição</span>
          <div class="cm-layout-modes" id="cm-layout-modes">
            <button class="cm-lm-btn" data-mode="modulos">📦 Módulos</button>
            <button class="cm-lm-btn" data-mode="dashboard">📊 Dashboard</button>
            <button class="cm-lm-btn" data-mode="completo">⊞ Completo</button>
          </div>
        </div>
        <div class="cm-layout-row">
          <span class="cm-layout-row-label">Tamanho dos cards</span>
          <button class="cm-lc-btn" id="cm-layout-compact">▢ Normal</button>
        </div>
      </div>
      <div id="cm-legend">⭐ = aparece na home &nbsp;|&nbsp; ☆ = oculto na home</div>
      <div id="cm-body"></div>
    </div>`;
  document.body.appendChild(o);

  document.getElementById('cm-close-btn').addEventListener('click', fecharCentralModulos);
  o.addEventListener('click', (e) => { if (e.target === o) fecharCentralModulos(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharCentralModulos(); });
  document.getElementById('cm-search-input').addEventListener('input', (e) => {
    _renderBody(e.target.value.trim().toLowerCase());
  });

  document.getElementById('cm-layout-modes').addEventListener('click', (e) => {
    const btn = e.target.closest('.cm-lm-btn');
    if (btn && btn.dataset.mode) _applyHomeMode(btn.dataset.mode);
  });
  document.getElementById('cm-layout-compact').addEventListener('click', _toggleCompact);

  _renderBody('');
}

function _renderBody(filtro) {
  const body = document.getElementById('cm-body');
  if (!body) return;

  // Módulos masterOnly só aparecem para Master Admin
  let isMaster = false;
  try {
    const ctx = JSON.parse(sessionStorage.getItem('cc_tenant_ctx') || 'null');
    isMaster = ctx?.perfil === 'master_admin';
  } catch {}

  let lista = TODOS_MODULOS.filter(m => !m.masterOnly || isMaster);
  if (filtro) {
    lista = lista.filter(m =>
      m.nome.toLowerCase().includes(filtro) ||
      m.descricao.toLowerCase().includes(filtro) ||
      m.categoria.toLowerCase().includes(filtro)
    );
  }

  // Atualiza contador de favoritos
  const favCount = _favs ? _favs.length : 0;
  const countEl = document.getElementById('cm-count');
  if (countEl) countEl.textContent = _favs !== null ? `${favCount} / ${MAX_FAVS} favoritos` : '';

  if (lista.length === 0) {
    body.innerHTML = `<div class="cm-empty-search">Nenhum módulo encontrado para "<strong>${_esc(filtro)}</strong>"</div>`;
    return;
  }

  // Agrupar por categoria (mantém ordem de aparição no catálogo)
  const grupos = {};
  const ordem  = [];
  lista.forEach(m => {
    if (!grupos[m.categoria]) { grupos[m.categoria] = []; ordem.push(m.categoria); }
    grupos[m.categoria].push(m);
  });

  body.innerHTML = ordem.map(cat => `
    <div class="cm-cat-header">${_esc(cat)}</div>
    ${grupos[cat].map(m => {
      const on = _favs !== null && _favs.includes(m.id);
      return `<div class="cm-item" data-cid="${m.id}">
        <span class="cm-item-icon">${m.icone}</span>
        <div class="cm-item-info">
          <div class="cm-item-nome">${_esc(m.nome)}</div>
          <div class="cm-item-desc">${_esc(m.descricao)}</div>
        </div>
        <button class="cm-star ${on ? 'on' : ''}" data-cid="${m.id}"
          title="${on ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">${on ? '⭐' : '☆'}</button>
      </div>`;
    }).join('')}
  `).join('');

  // Clique no item → navega
  function _urlModulo(id) {
    const base = '/CRM/pages/';
    const mapa = {
      'os':                    'os/index.html',
      'caixa':                 'caixa/index.html',
      'central-alertas':       'central-alertas/index.html',
      'clientes':              'clientes/index.html',
      'estoque':               'estoque/index.html',
      'acaodasemana':          'acaodasemana/index.html',
      'autoatendimento':       'autoatendimento/index.html',
      'garantias':             'garantias/index.html',
      'financeiro':            'financeiro/index.html',
      'compras':               'compras/index.html',
      'fechamento':            'fechamento/index.html',
      'pendencias':            'pendencias/index.html',
      'crm-comercial':         'crm-comercial/index.html',
      'fornecedor':            'fornecedor/index.html',
      'pos-venda':             'pos-venda/index.html',
      'catalogo':              'catalogo/index.html',
      'relatorios':            'relatorios/index.html',
      'central-comandos':      'central-comandos/index.html',
      'central-organizacao':   'central-organizacao/index.html',
      'central-informacoes':   'central-informacoes/index.html',
      'portal-cliente':        'portal-cliente/admin.html',
      'portal-tecnico':        'portal-tecnico/index.html',
      'diario':                'diario/index.html',
      'auditoria':             'auditoria/index.html',
      'lixeira':               'lixeira/index.html',
      'integridade':           'integridade/index.html',
      'homologacao':           'homologacao/index.html',
      'backup':                'backup/index.html',
      'config':                'config/index.html',
      'mensagens-wpp':         'mensagens-wpp/index.html',
      'venda-rapida':          'venda-rapida/index.html',
      'saas':                  'saas/index.html',
    };
    return mapa[id] ? base + mapa[id] : null;
  }

  body.querySelectorAll('.cm-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.cm-star')) return;
      const id = el.dataset.cid;
      const url = _urlModulo(id);
      if (url) {
        fecharCentralModulos();
        window.location.href = url;
      } else if (window.__cmNavigate) {
        window.__cmNavigate(id);
        fecharCentralModulos();
      }
    });
  });

  // Clique na estrela → toggle
  body.querySelectorAll('.cm-star').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFavorito(btn.dataset.cid);
      _renderBody(filtro); // re-renderiza mantendo o filtro
    });
  });
}

// ── Helpers ────────────────────────────────────────────────────
function _esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ── Init ───────────────────────────────────────────────────────
export function init() {
  _injectStyles();

  // Carrega cache local imediatamente (sem esperar Firestore)
  const cached = _readCache();
  if (cached !== null) { _favs = cached; _notify(); }

  // Assina Firestore ao obter / trocar UID
  onUid(() => _assinar(getUid()));

  // Verifica URL param para auto-abrir
  if (new URLSearchParams(window.location.search).get('abrir') === 'central-modulos') {
    setTimeout(() => abrirCentralModulos(), 600);
  }

  // Expõe globalmente para sidebar.js, mobile.js e outros scripts
  window.abrirCentralModulos  = abrirCentralModulos;
  window.__ccSetFavoritos     = setFavoritos;
  window.__ccGetFavoritos     = getFavoritosHome;
}
