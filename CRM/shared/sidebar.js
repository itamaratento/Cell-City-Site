/* ============================================================
   SIDEBAR GLOBAL — Cell City Gestão Empresarial
   Injeta o menu lateral em todos os módulos.
   Uso: <script src="../../shared/sidebar.js"></script>
   ============================================================ */
(function () {
  'use strict';

  // Não injetar se o Dashboard já tem sua própria sidebar no HTML,
  // ou se este script já rodou.
  if (document.getElementById('cc-global-sidebar')) return;
  if (document.getElementById('sidebar-left')) return; // dashboard usa HTML nativo

  // ── Lista mestra de módulos ──────────────────────────────────
  const ITEMS = [
    { id: 'os',                 href: '/CRM/pages/os/index.html',                  icon: '📦', label: 'OS',                   highlight: true },
    { id: 'caixa',              href: '/CRM/pages/caixa/index.html',               icon: '💰', label: 'Caixa' },
    { id: 'central-comandos',   href: '/CRM/pages/central-comandos/index.html',    icon: '⚡', label: 'Central de Comandos',   badge: 'Novo' },
    { id: 'notas',              type: 'button',                                    icon: '📋', label: 'Notas' },
    { id: 'financeiro',         href: '/CRM/pages/financeiro/index.html',          icon: '💹', label: 'Financeiro' },
    { id: 'crm-comercial',      href: '/CRM/pages/crm-comercial/index.html',       icon: '🎯', label: 'CRM Comercial',         badge: 'Novo' },
    { id: 'clientes',           href: '/CRM/pages/clientes/index.html',            icon: '👥', label: 'Clientes' },
    { id: 'estoque',            href: '/CRM/pages/estoque/index.html',             icon: '📱', label: 'Estoque' },
    { id: 'compras',            href: '/CRM/pages/compras/index.html',             icon: '🛒', label: 'Compras',                badge: 'Novo' },
    { id: 'fornecedor',         href: '/CRM/pages/fornecedor/index.html',          icon: '🏭', label: 'Fornecedor' },
    { id: 'pendencias',         href: '/CRM/pages/pendencias/index.html',          icon: '🗂️', label: 'Pendências e Contas',   badge: 'Novo' },
    { id: 'pos-venda',          href: '/CRM/pages/pos-venda/index.html',           icon: '💝', label: 'Pós-venda' },
    { id: 'garantias',          href: '/CRM/pages/garantias/index.html',           icon: '🛡️', label: 'Garantias' },
    { id: 'relatorios',         href: '/CRM/pages/relatorios/index.html',          icon: '📊', label: 'Relatórios' },
    { id: 'agenda',             href: '/CRM/pages/acaodasemana/index.html',        icon: '📅', label: 'Agenda' },
    { id: 'portal-tecnico',     href: '/CRM/pages/portal-tecnico/index.html',     icon: '🔓', label: 'Portal Técnico' },
    { id: 'central-automacao',  href: '/CRM/pages/central-organizacao/index.html', icon: '🤖', label: 'Central de Automação' },
    { id: 'portal-cliente',     href: '/CRM/pages/portal-cliente/admin.html',     icon: '🔷', label: 'Portal do Cliente' },
    { id: 'config',             href: '/CRM/pages/config/index.html',              icon: '⚙️', label: 'Configurações' },
  ];

  const COLLAPSE_KEY = 'cc_sidebar_state';
  const ORDER_KEY    = 'cc_sidebar_order';
  const W_EXPANDED   = 240;
  const W_COLLAPSED  = 72;
  const BAR_HEIGHT   = 56; // altura do brand-header

  // ── CSS ─────────────────────────────────────────────────────
  const CSS = `
    #cc-global-sidebar {
      position: fixed;
      left: 0;
      top: ${BAR_HEIGHT}px;
      bottom: 0;
      z-index: 500;
      display: flex;
      flex-direction: column;
      background: var(--bg-surface, #0d0e10);
      border-right: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
      width: ${W_EXPANDED}px;
      transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
    }
    #cc-global-sidebar.cc-collapsed {
      width: ${W_COLLAPSED}px;
    }

    /* Empurra o conteúdo da página para a direita */
    body.cc-has-sidebar {
      padding-left: ${W_EXPANDED}px !important;
      transition: padding-left 200ms cubic-bezier(0.4, 0, 0.2, 1);
      box-sizing: border-box;
    }
    body.cc-has-sidebar.cc-sidebar-collapsed {
      padding-left: ${W_COLLAPSED}px !important;
    }

    /* Botão toggle */
    #cc-sidebar-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 40px;
      flex-shrink: 0;
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
      color: var(--text-secondary, #8a9ab5);
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: background 150ms, color 150ms;
    }
    #cc-sidebar-toggle:hover {
      background: var(--bg-hover, rgba(255,255,255,0.04));
      color: var(--cell-green, #00c853);
    }
    .cc-toggle-icon {
      transition: transform 200ms;
      display: inline-block;
    }
    #cc-global-sidebar.cc-collapsed .cc-toggle-icon {
      transform: rotate(180deg);
    }

    /* Lista de módulos */
    #cc-sidebar-nav {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 6px 0;
    }
    #cc-sidebar-nav::-webkit-scrollbar { width: 4px; }
    #cc-sidebar-nav::-webkit-scrollbar-thumb {
      background: var(--border-medium, rgba(255,255,255,0.1));
      border-radius: 2px;
    }

    /* Item genérico */
    .cc-si {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 14px;
      color: var(--text-secondary, #8a9ab5);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      transition: background 150ms, color 150ms;
      position: relative;
      background: none;
      border: none;
      width: 100%;
      text-align: left;
      cursor: pointer;
      font-family: inherit;
      box-sizing: border-box;
    }
    .cc-si:hover {
      background: var(--bg-hover, rgba(255,255,255,0.04));
      color: var(--text-primary, #e8edf5);
    }
    .cc-si::before {
      content: '';
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 3px;
      background: transparent;
      border-radius: 0 2px 2px 0;
      transition: background 150ms;
    }
    .cc-si:hover::before,
    .cc-si.cc-active::before {
      background: var(--cell-green, #00c853);
    }

    /* Item ativo (módulo atual) */
    .cc-si.cc-active {
      color: var(--cell-green, #00c853);
      font-weight: 700;
    }

    /* Item de destaque (OS) */
    .cc-si.cc-highlight {
      color: var(--cell-green, #00c853);
      font-weight: 700;
    }
    .cc-si.cc-highlight .cc-si-icon { font-size: 18px; }

    /* Badge "Novo" */
    .cc-si-badge {
      font-size: 9px;
      font-weight: 700;
      background: var(--cell-green, #00c853);
      color: #000;
      border-radius: 4px;
      padding: 1px 5px;
      margin-left: auto;
      flex-shrink: 0;
      transition: opacity 150ms;
    }
    #cc-global-sidebar.cc-collapsed .cc-si-badge { opacity: 0; pointer-events: none; }

    /* Ícone e label */
    .cc-si-icon {
      font-size: 16px;
      width: 24px;
      text-align: center;
      flex-shrink: 0;
      transition: filter 150ms, transform 150ms;
    }
    .cc-si:hover .cc-si-icon {
      filter: brightness(1.5);
      transform: scale(1.12);
    }
    .cc-si-label {
      overflow: hidden;
      text-overflow: ellipsis;
      transition: opacity 150ms, max-width 200ms;
      max-width: 160px;
    }
    #cc-global-sidebar.cc-collapsed .cc-si-label {
      opacity: 0;
      max-width: 0;
    }

    /* Drag handle */
    .cc-drag-handle {
      font-size: 12px;
      color: var(--text-muted, rgba(255,255,255,0.2));
      cursor: grab;
      flex-shrink: 0;
      opacity: 0;
      transition: opacity 150ms;
    }
    .cc-si:hover .cc-drag-handle { opacity: 1; }
    #cc-global-sidebar.cc-collapsed .cc-drag-handle { display: none; }

    /* Drag visual */
    .cc-si.cc-dragging { opacity: 0.4; }
    .cc-si.cc-drag-over { background: var(--bg-hover, rgba(255,255,255,0.06)); }

    /* Rodapé */
    #cc-sidebar-footer {
      flex-shrink: 0;
      border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
      padding: 4px 0;
    }

    /* Tooltip (modo recolhido) */
    #cc-sidebar-tip {
      position: fixed;
      left: ${W_COLLAPSED + 8}px;
      background: #111827;
      color: #fff;
      font-size: 12px;
      font-weight: 500;
      padding: 6px 12px;
      border-radius: 6px;
      white-space: nowrap;
      z-index: 9999;
      pointer-events: none;
      box-shadow: 0 4px 16px rgba(0,0,0,0.45);
      opacity: 0;
      transition: opacity 80ms;
    }
    #cc-sidebar-tip.cc-tip-visible { opacity: 1; }

    /* Mobile: manter recolhido */
    @media (max-width: 680px) {
      #cc-global-sidebar { width: ${W_COLLAPSED}px !important; }
      body.cc-has-sidebar { padding-left: ${W_COLLAPSED}px !important; }
      body.cc-has-sidebar.cc-sidebar-collapsed { padding-left: ${W_COLLAPSED}px !important; }
    }
  `;

  // ── HTML builder ─────────────────────────────────────────────
  function buildHTML() {
    const path = window.location.pathname;

    const itemsHTML = ITEMS.map(item => {
      if (item.type === 'button') {
        return `<button class="cc-si" data-sid="${item.id}" data-tip="${item.label}" draggable="true">
          <span class="cc-drag-handle">⠿</span>
          <span class="cc-si-icon">${item.icon}</span>
          <span class="cc-si-label">${item.label}</span>
        </button>`;
      }
      // Detecta módulo ativo comparando o pathname
      const isActive = path.includes('/' + item.id + '/') ||
                       (item.id === 'agenda' && path.includes('/acaodasemana/')) ||
                       (item.id === 'central-automacao' && path.includes('/central-organizacao/'));
      const classes = ['cc-si',
        item.highlight ? 'cc-highlight' : '',
        isActive       ? 'cc-active'    : ''
      ].filter(Boolean).join(' ');

      return `<a class="${classes}" href="${item.href}" data-sid="${item.id}" data-tip="${item.label}" draggable="true">
        <span class="cc-drag-handle">⠿</span>
        <span class="cc-si-icon">${item.icon}</span>
        <span class="cc-si-label">${item.label}</span>
        ${item.badge ? `<span class="cc-si-badge">${item.badge}</span>` : ''}
      </a>`;
    }).join('');

    return `
      <button id="cc-sidebar-toggle" title="Recolher / expandir menu">
        <span class="cc-toggle-icon">◀</span>
      </button>
      <div id="cc-sidebar-nav">${itemsHTML}</div>
      <div id="cc-sidebar-footer"></div>
    `;
  }

  // ── Injeção de CSS ────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('cc-sidebar-css')) return;
    const s = document.createElement('style');
    s.id = 'cc-sidebar-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── Injeção do sidebar ────────────────────────────────────────
  function injectSidebar() {
    const nav = document.createElement('aside');
    nav.id = 'cc-global-sidebar';
    nav.setAttribute('aria-label', 'Menu principal');
    nav.innerHTML = buildHTML();
    document.body.prepend(nav);

    // Tooltip element
    const tip = document.createElement('div');
    tip.id = 'cc-sidebar-tip';
    document.body.appendChild(tip);
  }

  // ── Collapse / Expand ─────────────────────────────────────────
  function setupToggle(sidebar) {
    const btn = document.getElementById('cc-sidebar-toggle');
    if (!btn) return;

    const collapsed = localStorage.getItem(COLLAPSE_KEY) === '1';
    applyCollapse(sidebar, collapsed);

    btn.addEventListener('click', () => {
      const now = sidebar.classList.contains('cc-collapsed');
      applyCollapse(sidebar, !now);
      localStorage.setItem(COLLAPSE_KEY, !now ? '1' : '0');
    });
  }

  function applyCollapse(sidebar, collapsed) {
    sidebar.classList.toggle('cc-collapsed', collapsed);
    document.body.classList.toggle('cc-sidebar-collapsed', collapsed);
  }

  // ── Drag & Drop reorder ──────────────────────────────────────
  function setupDrag(navEl) {
    const ORDER_KEY_LOCAL = ORDER_KEY;

    const saveOrder = () => {
      const ids = [...navEl.querySelectorAll('.cc-si[data-sid]')].map(el => el.dataset.sid);
      localStorage.setItem(ORDER_KEY_LOCAL, JSON.stringify(ids));
    };

    const restoreOrder = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(ORDER_KEY_LOCAL) || '[]');
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
      const item = e.target.closest('.cc-si[data-sid]');
      if (!item) return;
      dragSrc = item;
      item.classList.add('cc-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    navEl.addEventListener('dragend', () => {
      if (dragSrc) dragSrc.classList.remove('cc-dragging');
      navEl.querySelectorAll('.cc-drag-over').forEach(el => el.classList.remove('cc-drag-over'));
      dragSrc = null;
    });

    navEl.addEventListener('dragover', e => {
      e.preventDefault();
      const item = e.target.closest('.cc-si[data-sid]');
      if (!item || item === dragSrc) return;
      navEl.querySelectorAll('.cc-drag-over').forEach(el => el.classList.remove('cc-drag-over'));
      item.classList.add('cc-drag-over');
      e.dataTransfer.dropEffect = 'move';
    });

    navEl.addEventListener('dragleave', e => {
      const item = e.target.closest('.cc-si[data-sid]');
      if (item) item.classList.remove('cc-drag-over');
    });

    navEl.addEventListener('drop', e => {
      e.preventDefault();
      const target = e.target.closest('.cc-si[data-sid]');
      if (!target || !dragSrc || target === dragSrc) return;
      target.classList.remove('cc-drag-over');
      const after = e.clientY > target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
      navEl.insertBefore(dragSrc, after ? target.nextSibling : target);
      saveOrder();
    });
  }

  // ── Tooltip (sidebar recolhida) ───────────────────────────────
  function setupTooltip(sidebar) {
    const tip = document.getElementById('cc-sidebar-tip');
    if (!tip) return;

    sidebar.addEventListener('mouseover', e => {
      if (!sidebar.classList.contains('cc-collapsed')) return;
      const item = e.target.closest('.cc-si');
      if (!item) return;
      const label = item.dataset.tip || '';
      if (!label) return;
      tip.textContent = label;
      const rect = item.getBoundingClientRect();
      tip.style.top = (rect.top + rect.height / 2 - 14) + 'px';
      tip.classList.add('cc-tip-visible');
    });

    sidebar.addEventListener('mouseleave', () => {
      tip.classList.remove('cc-tip-visible');
    });

    sidebar.addEventListener('mouseout', e => {
      if (!e.target.closest('.cc-si')) {
        tip.classList.remove('cc-tip-visible');
      }
    });
  }

  // ── Notas button → delega ao dock ────────────────────────────
  function setupNotasButton(navEl) {
    const btn = navEl.querySelector('[data-sid="notas"]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      // Tenta abrir via dock-notas (injetado pelo dock.js)
      const dockNotas = document.getElementById('dock-notas');
      if (dockNotas) { dockNotas.click(); return; }
      // Fallback: evento customizado para qualquer listener
      document.dispatchEvent(new CustomEvent('cc:open-notas'));
    });
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    injectStyles();
    injectSidebar();

    const sidebar = document.getElementById('cc-global-sidebar');
    const navEl   = document.getElementById('cc-sidebar-nav');
    if (!sidebar || !navEl) return;

    document.body.classList.add('cc-has-sidebar');

    setupToggle(sidebar);
    setupDrag(navEl);
    setupTooltip(sidebar);
    setupNotasButton(navEl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
