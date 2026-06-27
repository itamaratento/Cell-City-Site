/* ============================================================
   MODULES-ORDER.JS — Reordenação de módulos Cell City
   • Desktop: drag & drop na grade
   • Mobile:  drag por alça (⠿) via touch
   • Ordem compartilhada: localStorage 'cc_mod_order'
   ============================================================ */
(function () {
  'use strict';

  const ORDER_KEY = 'cc_mod_order';

  /* ── API pública (window.CCModOrder) ─────────────────────── */
  const CCModOrder = {
    get() {
      try { return JSON.parse(localStorage.getItem(ORDER_KEY) || 'null'); } catch { return null; }
    },
    set(arr) {
      localStorage.setItem(ORDER_KEY, JSON.stringify(arr));
      window.dispatchEvent(new CustomEvent('cc-mod-order-changed', { detail: arr }));
    },
    /* Ordena array de objetos pela ordem salva. idFn(item) → id string */
    sort(items, idFn) {
      const order = this.get();
      if (!order || !order.length) return items;
      return [...items].sort((a, b) => {
        const ai = order.indexOf(idFn(a));
        const bi = order.indexOf(idFn(b));
        if (ai < 0 && bi < 0) return 0;
        if (ai < 0) return 1;
        if (bi < 0) return -1;
        return ai - bi;
      });
    },
    /* Lê a ordem atual dos cards no DOM */
    readGrid() {
      return Array.from(document.querySelectorAll('.modules-grid [data-module]'))
        .map(el => el.dataset.module);
    },
    /* Lê a ordem atual dos items mobile */
    readMobile(container) {
      return Array.from(container.querySelectorAll('[data-mob-id]'))
        .map(el => el.dataset.mobId);
    }
  };

  window.CCModOrder = CCModOrder;

  /* ═══════════════════════════════════════════════════════════
     DESKTOP — Drag & Drop na grade de módulos
     ═══════════════════════════════════════════════════════════ */
  function applyOrderToGrid() {
    const grid = document.querySelector('.modules-grid');
    if (!grid) return;
    const order = CCModOrder.get();
    if (!order || !order.length) return;

    const cards = Array.from(grid.querySelectorAll('[data-module]'));
    const rank = {};
    order.forEach((id, i) => { rank[id] = i; });

    cards.sort((a, b) => {
      const ai = rank[a.dataset.module] ?? 999;
      const bi = rank[b.dataset.module] ?? 999;
      return ai - bi;
    });

    /* Re-insere na ordem correta sem re-renderizar */
    cards.forEach(card => grid.appendChild(card));
  }

  function setupDesktopDrag() {
    const grid = document.querySelector('.modules-grid');
    if (!grid) return;
    if (grid.dataset.orderDrag) return; // já inicializado
    grid.dataset.orderDrag = '1';

    /* Adiciona CSS para feedback visual */
    if (!document.getElementById('mod-order-css')) {
      const s = document.createElement('style');
      s.id = 'mod-order-css';
      s.textContent = `
        .modules-grid [data-module] { cursor: grab; }
        .modules-grid [data-module]:active { cursor: grabbing; }
        .modules-grid [data-module].mod-dragging {
          opacity: 0.35;
          transform: scale(0.97) !important;
          box-shadow: none !important;
        }
        .modules-grid [data-module].mod-drop-before {
          box-shadow: -4px 0 0 0 #00c853, 0 0 0 1px rgba(0,200,83,0.25) !important;
        }
        .modules-grid [data-module].mod-drop-after {
          box-shadow: 4px 0 0 0 #00c853, 0 0 0 1px rgba(0,200,83,0.25) !important;
        }
        /* Dica de arrastar no título da seção */
        .modules-header::after {
          content: 'Arraste os cards para reordenar';
          font-size: 10px;
          color: #4b5563;
          margin-left: 8px;
          font-weight: 400;
        }
      `;
      document.head.appendChild(s);
    }

    let dragSrc = null;

    grid.addEventListener('dragstart', e => {
      const card = e.target.closest('[data-module]');
      if (!card) return;
      dragSrc = card;
      requestAnimationFrame(() => card.classList.add('mod-dragging'));
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.module);
    });

    grid.addEventListener('dragend', () => {
      if (dragSrc) dragSrc.classList.remove('mod-dragging');
      grid.querySelectorAll('.mod-drop-before, .mod-drop-after').forEach(el => {
        el.classList.remove('mod-drop-before', 'mod-drop-after');
      });
      dragSrc = null;
    });

    grid.addEventListener('dragover', e => {
      e.preventDefault();
      const card = e.target.closest('[data-module]');
      if (!card || card === dragSrc) return;
      grid.querySelectorAll('.mod-drop-before, .mod-drop-after').forEach(el => {
        el.classList.remove('mod-drop-before', 'mod-drop-after');
      });
      const rect = card.getBoundingClientRect();
      const half = rect.left + rect.width / 2;
      card.classList.add(e.clientX < half ? 'mod-drop-before' : 'mod-drop-after');
      e.dataTransfer.dropEffect = 'move';
    });

    grid.addEventListener('dragleave', e => {
      const card = e.target.closest('[data-module]');
      if (card) {
        card.classList.remove('mod-drop-before', 'mod-drop-after');
      }
    });

    grid.addEventListener('drop', e => {
      e.preventDefault();
      const target = e.target.closest('[data-module]');
      if (!target || !dragSrc || target === dragSrc) return;
      target.classList.remove('mod-drop-before', 'mod-drop-after');

      const rect = target.getBoundingClientRect();
      const after = e.clientX >= rect.left + rect.width / 2;
      if (after) target.after(dragSrc);
      else target.before(dragSrc);

      CCModOrder.set(CCModOrder.readGrid());
    });

    /* Habilita draggable em todos os cards */
    grid.querySelectorAll('[data-module]').forEach(card => {
      card.setAttribute('draggable', 'true');
    });

    /* Observa novos cards adicionados ao grid */
    new MutationObserver(() => {
      grid.querySelectorAll('[data-module]:not([draggable])').forEach(card => {
        card.setAttribute('draggable', 'true');
      });
    }).observe(grid, { childList: true });
  }

  /* ═══════════════════════════════════════════════════════════
     MOBILE — Touch drag via alça (⠿)
     Chamado pelo mobile.js após renderizar a lista
     ═══════════════════════════════════════════════════════════ */
  CCModOrder.setupTouchDrag = function (container) {
    if (!container) return;
    if (container.dataset.touchDrag) return;
    container.dataset.touchDrag = '1';

    let dragEl    = null;
    let cloneEl   = null;
    let dragRect  = null;
    let touchOffY = 0;
    let touchOffX = 0;
    let lastTarget = null;

    function getAllItems() {
      return Array.from(container.querySelectorAll('.mob-item'));
    }

    function findItemAt(x, y) {
      /* Esconde clone para não interferir em elementFromPoint */
      if (cloneEl) cloneEl.style.pointerEvents = 'none';
      const el = document.elementFromPoint(x, y);
      if (cloneEl) cloneEl.style.pointerEvents = '';
      return el ? el.closest('.mob-item') : null;
    }

    container.addEventListener('touchstart', e => {
      const handle = e.target.closest('.mob-drag-handle');
      if (!handle) return;
      const item = handle.closest('.mob-item');
      if (!item) return;

      e.preventDefault(); // evita scroll enquanto arrasta pela alça

      dragEl   = item;
      dragRect = item.getBoundingClientRect();
      const touch = e.touches[0];
      touchOffY = touch.clientY - dragRect.top;
      touchOffX = touch.clientX - dragRect.left;

      /* Clone visual */
      cloneEl = item.cloneNode(true);
      cloneEl.style.cssText = `
        position: fixed;
        top:    ${dragRect.top}px;
        left:   ${dragRect.left}px;
        width:  ${dragRect.width}px;
        height: ${dragRect.height}px;
        z-index: 9999;
        pointer-events: none;
        opacity: 0.9;
        background: #1e2126;
        box-shadow: 0 12px 40px rgba(0,0,0,0.55);
        border-radius: 10px;
        transition: none;
        transform: scale(1.02);
      `;
      document.body.appendChild(cloneEl);

      dragEl.style.opacity = '0.25';
    }, { passive: false });

    document.addEventListener('touchmove', e => {
      if (!cloneEl || !dragEl) return;
      e.preventDefault();

      const touch = e.touches[0];
      const newTop  = touch.clientY - touchOffY;
      const newLeft = touch.clientX - touchOffX;

      cloneEl.style.top  = newTop  + 'px';
      cloneEl.style.left = newLeft + 'px';

      /* Destaca o item alvo */
      const over = findItemAt(touch.clientX, touch.clientY);
      if (lastTarget && lastTarget !== over) {
        lastTarget.style.outline = '';
      }
      if (over && over !== dragEl) {
        over.style.outline = '2px solid rgba(0,200,83,0.5)';
        lastTarget = over;
      }
    }, { passive: false });

    document.addEventListener('touchend', e => {
      if (!cloneEl || !dragEl) return;

      const touch = e.changedTouches[0];
      const over  = findItemAt(touch.clientX, touch.clientY);

      /* Limpa destaques */
      if (lastTarget) { lastTarget.style.outline = ''; lastTarget = null; }

      /* Move item para a posição correta */
      if (over && over !== dragEl) {
        const rect  = over.getBoundingClientRect();
        const after = touch.clientY > rect.top + rect.height / 2;
        const parent = dragEl.parentNode;
        if (parent === over.parentNode) {
          if (after) over.after(dragEl);
          else       over.before(dragEl);
        }
      }

      /* Restaura e limpa */
      dragEl.style.opacity = '';
      cloneEl.remove();
      cloneEl = null;
      dragEl  = null;

      /* Salva ordem (flat list de todos os IDs na tela) */
      CCModOrder.set(CCModOrder.readMobile(container));
    });
  };

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    applyOrderToGrid();
    setupDesktopDrag();
    /* Reaplicar ao grid quando a ordem mudar pelo mobile */
    window.addEventListener('cc-mod-order-changed', applyOrderToGrid);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
