/* ============================================
CELL CITY CRM — DASHBOARD — EVENTOS
Etapa 5 da refatoração modular: listeners globais, atalhos e sidebar (drag-and-drop).
Mixin aplicado em Dashboard.prototype (ver dashboard.js) — mesmo `this` de sempre.
============================================ */

export const dashboardEventsMixin = {
  // ===== BOTÃO DE ATUALIZAÇÃO (recarrega o painel) =====
  setupReloadBtn() {
    const btn = document.getElementById('sys-reload-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      btn.classList.add('spinning');
      window.location.reload();
    });
  },

  // ===== FERRAMENTAS NA DOCK LATERAL =====
  setupDockTools() {
    const toolsItem = document.getElementById('dock-ferramentas');
    if (toolsItem) {
      toolsItem.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateTo('ferramentas');
      });
    }
  },

  // ===== CLIQUES FORA =====
  setupOutsideClicks() {
    document.addEventListener('click', (e) => {
      const calPopup = document.getElementById('calendar-popup');
      const dateBtn = document.getElementById('date-display');
      if (this.state.calendar.open &&
          !calPopup.contains(e.target) &&
          !dateBtn.contains(e.target)) {
        this.state.calendar.open = false;
        calPopup.classList.remove('visible');
        dateBtn.classList.remove('active');
      }

      const searchBox = document.getElementById('global-search');
      const searchResults = document.getElementById('search-results');
      if (!searchBox.contains(e.target)) {
        searchResults.classList.remove('visible');
      }
    });
  },

  // ===== ATALHOS =====
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
      if (e.key === 'Escape') {
        document.getElementById('global-search-input')?.blur();
        document.getElementById('search-results')?.classList.remove('visible');
        if (this.state.calendar.open) {
          this.state.calendar.open = false;
          document.getElementById('calendar-popup').classList.remove('visible');
          document.getElementById('date-display').classList.remove('active');
        }
      }
    });
  },

  // ===== SIDEBAR ESQUERDA — REORDENAÇÃO (sempre compacta) =====
  setupSidebar() {
    const sidebar = document.getElementById('sidebar-left');
    const navEl   = document.getElementById('sidebar-nav');
    if (!sidebar) return;

    // ----- drag-and-drop reordering -----
    if (!navEl) return;

    const ORDER_KEY = 'cc_sidebar_order';

    const saveOrder = () => {
      const sids = [...navEl.querySelectorAll('.sidebar-item[data-sid]')].map(el => el.dataset.sid);
      localStorage.setItem(ORDER_KEY, JSON.stringify(sids));
    };

    const restoreOrder = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]');
        if (!saved.length) return;
        saved.forEach(sid => {
          const el = navEl.querySelector(`[data-sid="${sid}"]`);
          if (el) navEl.appendChild(el);
        });
      } catch (_) {}
    };

    restoreOrder();

    let dragSrc = null;

    navEl.addEventListener('dragstart', e => {
      const item = e.target.closest('.sidebar-item[data-sid]');
      if (!item) return;
      dragSrc = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    navEl.addEventListener('dragend', () => {
      if (dragSrc) dragSrc.classList.remove('dragging');
      navEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      dragSrc = null;
    });

    navEl.addEventListener('dragover', e => {
      e.preventDefault();
      const item = e.target.closest('.sidebar-item[data-sid]');
      if (!item || item === dragSrc) return;
      navEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      item.classList.add('drag-over');
      e.dataTransfer.dropEffect = 'move';
    });

    navEl.addEventListener('dragleave', e => {
      const item = e.target.closest('.sidebar-item[data-sid]');
      if (item) item.classList.remove('drag-over');
    });

    navEl.addEventListener('drop', e => {
      e.preventDefault();
      const target = e.target.closest('.sidebar-item[data-sid]');
      if (!target || !dragSrc || target === dragSrc) return;
      target.classList.remove('drag-over');
      const rect = target.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      navEl.insertBefore(dragSrc, after ? target.nextSibling : target);
      saveOrder();
    });
  }
};
