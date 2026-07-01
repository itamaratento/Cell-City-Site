/* ============================================================
   MENU-FAVORITOS — Cell City CRM
   ------------------------------------------------------------
   Consome os favoritos de shared/central-modulos.js e injeta,
   automaticamente, um item no menu principal para cada módulo
   favoritado que ainda não esteja lá — sem duplicar o catálogo
   nem a lógica de favoritos (fonte única: central-modulos.js).

   Dois hosts suportados (mesma renderização, marcação diferente):
   • Dashboard nativo — #sidebar-nav / .sidebar-item
     (auto-montado por este arquivo).
   • shared/sidebar.js — #cc-sidebar-nav / .cc-si
     (chamado explicitamente por sidebar.js via renderFavoritosNoMenu,
     pois só ele sabe o momento exato em que o menu foi injetado).

   Itens injetados levam data-cc-fav="1" para poderem ser
   removidos quando o módulo for desfavoritado; itens fixos do
   HTML/JS nativo de cada host nunca são tocados.
   ============================================================ */
import { init, TODOS_MODULOS, getFavoritos } from './central-modulos.js';

const MARCACAO = {
  'sidebar-item': { drag: 'drag-handle',    icon: 'sidebar-icon', label: 'sidebar-label' },
  'cc-si':        { drag: 'cc-drag-handle', icon: 'cc-si-icon',   label: 'cc-si-label'   },
};

function montarItem(mod, itemClass) {
  const m = MARCACAO[itemClass] || MARCACAO['sidebar-item'];
  const a = document.createElement('a');
  a.className = itemClass;
  a.href = mod.url;
  a.dataset.sid = mod.id;
  a.dataset.tip = mod.nome;
  a.dataset.ccFav = '1';
  a.draggable = true;
  a.innerHTML = `
    <span class="${m.drag}">⠿</span>
    <span class="${m.icon}">${mod.icone}</span>
    <span class="${m.label}">${mod.nome}</span>
  `;
  return a;
}

/**
 * Injeta em navEl um item para cada módulo favoritado que ainda não
 * existe como item estático (data-sid), e remove os que foram
 * desfavoritados. itemClass define a marcação a espelhar
 * ('sidebar-item' no Dashboard nativo, 'cc-si' no shared/sidebar.js).
 */
export function renderFavoritosNoMenu(navEl, itemClass) {
  if (!navEl) return;

  const favoritos = getFavoritos();
  const presentes = new Set([...navEl.querySelectorAll('[data-sid]')].map(el => el.dataset.sid));

  favoritos.forEach(id => {
    if (presentes.has(id)) return;
    const mod = TODOS_MODULOS.find(m => m.id === id);
    if (!mod) return;
    navEl.appendChild(montarItem(mod, itemClass));
  });

  navEl.querySelectorAll('[data-cc-fav="1"]').forEach(el => {
    if (!favoritos.includes(el.dataset.sid)) el.remove();
  });
}

// ── Auto-mount: Dashboard nativo (#sidebar-nav) ──────────────────
function sincronizarDashboard() {
  renderFavoritosNoMenu(document.getElementById('sidebar-nav'), 'sidebar-item');
}

window.addEventListener('cc-modulos-changed', sincronizarDashboard);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', sincronizarDashboard);
} else {
  sincronizarDashboard();
}

init();
