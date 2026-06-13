(function () {
  const DASHBOARD_URL = '/CRM/pages/dashboard/index.html';

  const CSS = `
    /* === CRM Brand Bar (injetada em todas as páginas exceto dashboard) === */
    #crm-brand-bar {
      position: sticky;
      top: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 6px 16px;
      background: rgba(8, 9, 10, 0.97);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      min-height: 56px;
    }

    /* === Brand Header (logo clicável) === */
    .brand-header {
      display: flex;
      align-items: center;
      padding: 6px 14px;
      background: rgba(0, 200, 83, 0.06);
      border: 1px solid rgba(0, 200, 83, 0.25);
      border-radius: 12px;
      transition: all 250ms cubic-bezier(0.4,0,0.2,1);
      cursor: pointer;
      user-select: none;
      flex-shrink: 0;
      position: relative;
      box-shadow: 0 0 20px rgba(0, 200, 83, 0.15), inset 0 1px 0 rgba(0, 230, 118, 0.1);
    }
    .brand-header::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(0, 230, 118, 0.15) 0%, transparent 50%);
      opacity: 0.6;
      pointer-events: none;
    }
    .brand-header:hover {
      background: rgba(0, 200, 83, 0.10);
      border-color: rgba(0, 200, 83, 0.45);
      box-shadow: 0 0 28px rgba(0, 200, 83, 0.25), inset 0 1px 0 rgba(0, 230, 118, 0.15);
    }
    .brand-header:active {
      transform: translateY(0);
      opacity: 0.85;
    }
    .brand-header-text {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
      position: relative;
      z-index: 1;
    }
    .brand-header-title {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: -0.03em;
      white-space: nowrap;
      background: linear-gradient(180deg, #00e676 0%, #00c853 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 0 8px rgba(0, 200, 83, 0.4));
    }
    .brand-header-divider {
      height: 1px;
      background: linear-gradient(90deg, #00c853 0%, rgba(0, 200, 83, 0.2) 70%, transparent 100%);
      margin: 2px 0;
      width: 100%;
      opacity: 0.7;
    }
    .brand-header-subtitle {
      font-size: 10.5px;
      color: #a1a8b3;
      font-weight: 600;
      letter-spacing: 0.08em;
      white-space: nowrap;
      text-transform: uppercase;
    }

    /* === Título da página dentro do brand bar === */
    #crm-brand-bar .crm-page-title {
      flex: 1;
      text-align: center;
      font-size: 17px;
      font-weight: 700;
      color: #4ade80;
      letter-spacing: 0.3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
  `;

  const BRAND_HTML = `
    <div class="brand-header" id="brand-header" title="Voltar ao painel">
      <div class="brand-header-text">
        <div class="brand-header-title">Cell City Informática</div>
        <div class="brand-header-divider"></div>
        <div class="brand-header-subtitle">CRM Operacional</div>
      </div>
    </div>
  `;

  function injectStyles() {
    if (document.getElementById('crm-brand-header-style')) return;
    const style = document.createElement('style');
    style.id = 'crm-brand-header-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function attachHandler(el) {
    el.title = 'Voltar ao painel';
    el.addEventListener('click', function () {
      window.location.href = DASHBOARD_URL;
    });
  }

  function init() {
    injectStyles();

    // Dashboard: #brand-header já existe — só adiciona o onclick
    const existing = document.getElementById('brand-header');
    if (existing) {
      attachHandler(existing);
      return;
    }

    // Outras páginas: cria o brand bar autônomo
    const bar = document.createElement('header');
    bar.id = 'crm-brand-bar';

    // Injeta o logo
    const wrapper = document.createElement('div');
    wrapper.innerHTML = BRAND_HTML.trim();
    const brandEl = wrapper.firstElementChild;
    bar.appendChild(brandEl);
    attachHandler(brandEl);

    // Migra todos os filhos do header existente para dentro do brand bar
    const existingHeader = document.querySelector('header');
    if (existingHeader) {
      while (existingHeader.firstElementChild) {
        const child = existingHeader.firstElementChild;
        if (child.id === 'headerTitle' || child.classList.contains('header-title')) {
          child.className = 'crm-page-title';
        }
        bar.appendChild(child);
      }
      existingHeader.remove();
    }

    // Insere o brand bar como o 1º filho do body — completamente independente
    document.body.insertBefore(bar, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
