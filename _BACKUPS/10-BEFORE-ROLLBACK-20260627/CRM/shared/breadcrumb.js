/* ============================================================
   BREADCRUMB COMPARTILHADO — Cell City Gestão Empresarial
   Uso:
     1. Adicione data-bc no <html>:
        data-bc='[{"icon":"💹","label":"Financeiro","url":"/CRM/pages/financeiro/"},{"icon":"🛒","label":"Compras"}]'
     2. Defina o ponto de injeção (um dos dois):
        data-bc-before=".cmp-main-header"   (insere antes do seletor)
        data-bc-host=".fec-main"            (insere como 1º filho do seletor)
     3. Inclua o script:
        <script src="../../shared/breadcrumb.js"></script>
   ============================================================ */
(function () {
  'use strict';

  const CSS = `
    .cc-breadcrumb {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 2px;
      padding: 0 0 10px;
      font-size: 12px;
      line-height: 1;
      color: var(--text-tertiary, #6b7280);
      user-select: none;
    }
    .cc-breadcrumb-sep {
      color: var(--text-tertiary, #4b5563);
      margin: 0 3px;
      font-size: 11px;
      opacity: 0.6;
    }
    .cc-breadcrumb-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--cell-green, #00c853);
      text-decoration: none;
      font-weight: 500;
      opacity: 0.8;
      transition: opacity 0.15s, color 0.15s;
      white-space: nowrap;
      border-radius: 4px;
      padding: 2px 4px;
    }
    .cc-breadcrumb-link:hover {
      opacity: 1;
      background: rgba(0, 200, 83, 0.08);
    }
    .cc-breadcrumb-icon {
      font-size: 12px;
      line-height: 1;
      flex-shrink: 0;
    }
    .cc-breadcrumb-current {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--text-secondary, #9ca3af);
      font-weight: 600;
      white-space: nowrap;
      padding: 2px 4px;
    }
    @media (max-width: 480px) {
      .cc-breadcrumb { font-size: 11px; }
      .cc-breadcrumb-icon { font-size: 11px; }
    }
  `;

  function injectStyles() {
    if (document.getElementById('cc-breadcrumb-style')) return;
    const s = document.createElement('style');
    s.id = 'cc-breadcrumb-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function buildItem(item, isCurrent) {
    if (!isCurrent && item.url) {
      const a = document.createElement('a');
      a.className = 'cc-breadcrumb-link';
      a.href = item.url;
      a.title = 'Ir para ' + item.label;
      if (item.icon) {
        const ico = document.createElement('span');
        ico.className = 'cc-breadcrumb-icon';
        ico.textContent = item.icon;
        ico.setAttribute('aria-hidden', 'true');
        a.appendChild(ico);
      }
      a.appendChild(document.createTextNode(item.label));
      return a;
    } else {
      const span = document.createElement('span');
      span.className = 'cc-breadcrumb-current';
      span.setAttribute('aria-current', 'page');
      if (item.icon) {
        const ico = document.createElement('span');
        ico.className = 'cc-breadcrumb-icon';
        ico.textContent = item.icon;
        ico.setAttribute('aria-hidden', 'true');
        span.appendChild(ico);
      }
      span.appendChild(document.createTextNode(item.label));
      return span;
    }
  }

  function render(trail) {
    const nav = document.createElement('nav');
    nav.className = 'cc-breadcrumb';
    nav.setAttribute('aria-label', 'Breadcrumb');

    trail.forEach(function (item, idx) {
      if (idx > 0) {
        const sep = document.createElement('span');
        sep.className = 'cc-breadcrumb-sep';
        sep.textContent = '›';
        sep.setAttribute('aria-hidden', 'true');
        nav.appendChild(sep);
      }
      nav.appendChild(buildItem(item, idx === trail.length - 1));
    });

    return nav;
  }

  function init() {
    const html = document.documentElement;
    const raw = html.getAttribute('data-bc');
    if (!raw) return;

    var trail;
    try { trail = JSON.parse(raw); } catch (e) { return; }
    if (!Array.isArray(trail) || trail.length < 2) return;

    injectStyles();

    const nav = render(trail);

    // Ponto de injeção: data-bc-before tem prioridade sobre data-bc-host
    const beforeSel = html.getAttribute('data-bc-before');
    const hostSel   = html.getAttribute('data-bc-host');

    if (beforeSel) {
      const target = document.querySelector(beforeSel);
      if (target && target.parentNode) {
        target.parentNode.insertBefore(nav, target);
        return;
      }
    }

    if (hostSel) {
      const host = document.querySelector(hostSel);
      if (host) {
        host.insertBefore(nav, host.firstChild);
        return;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
