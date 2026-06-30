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
      /* Folga vertical para o conteúdo logo abaixo da barra não ficar colado.
         position:sticky já cria contexto de posicionamento para o título
         centralizado em absolute abaixo. */
      margin-bottom: 14px;
    }

    /* === Brand Header (logo clicável) ===
       Sem caixa/pill ao redor — a logo já tem identidade visual própria
       (gradiente, linha decorativa); uma borda/fundo verde por cima
       competia com ela e ficava desproporcional num cabeçalho compacto. */
    .brand-header {
      display: flex;
      align-items: center;
      cursor: pointer;
      user-select: none;
      flex-shrink: 0;
      transition: opacity 150ms ease;
    }
    .brand-header:hover { opacity: 0.85; }
    .brand-header:active { opacity: 0.7; }
    .brand-header-logo {
      display: block;
      height: 36px;
      width: auto;
      object-fit: contain;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }

    /* === Layout tripartido: logo | [espaçador flex] | botões direita ===
       Título sempre no centro ABSOLUTO da barra — fora do fluxo flex.
       Isso garante centralização visual real independente da largura do
       logo (esquerda) ou dos botões (direita), em qualquer breakpoint.
       Nenhum elemento do fluxo pode colidir com o título porque ele é
       pointer-events:none e z-index:1. */
    #crm-brand-bar .crm-title-slot {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      max-width: 46%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 1;
    }
    /* Em telas estreitas reduz a zona máxima do título para não encostar
       nos botões que tomam mais espaço proporcional. */
    @media (max-width: 680px) {
      #crm-brand-bar .crm-title-slot { max-width: 36%; }
    }

    /* O título em si só recebe estilo de texto — a posição é do slot.
       !important em propriedades de layout porque vários módulos estilizam
       o próprio elemento (ex.: pos-venda força position:absolute), o que
       o colapsaria a 0 dentro do slot. */
    #crm-brand-bar .crm-page-title {
      position: static !important;
      float: none !important;
      inset: auto !important;
      transform: none !important;
      margin: 0 !important;
      max-width: 100%;
      text-align: center;
      font-size: 17px !important;
      font-weight: 700;
      color: #4ade80;
      letter-spacing: 0.3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }

    /* Espaçador sempre ativo: empurra botões (Favoritar, ações de módulo)
       para o lado direito em todos os breakpoints. */
    #crm-brand-bar .crm-bar-spacer {
      flex: 1 1 auto;
    }

    /* Elementos migrados do header original ficam neutralizados quanto ao
       flex: evita que um .header-spacer com flex:1 do módulo (ex.: pós-venda)
       concorra com o crm-bar-spacer e quebre o alinhamento. */
    #crm-brand-bar .crm-bar-migrated {
      flex: 0 0 auto !important;
      width: auto !important;
      margin: 0 !important;
    }

    /* Logo compacto em telas muito estreitas */
    @media (max-width: 480px) {
      .brand-header-logo { height: 28px; }
    }

    /* === Atalho Site Cell City === */
    .crm-site-cc-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 8px;
      background: rgba(0, 200, 83, 0.06);
      border: 1px solid rgba(0, 200, 83, 0.22);
      flex-shrink: 0;
      text-decoration: none;
      cursor: pointer;
      transition: background 180ms, border-color 180ms, box-shadow 180ms;
    }
    .crm-site-cc-btn:hover {
      background: rgba(0, 200, 83, 0.14);
      border-color: rgba(0, 200, 83, 0.45);
      box-shadow: 0 0 10px rgba(0, 200, 83, 0.18);
    }
    .crm-site-cc-icon {
      font-size: 16px;
      line-height: 1;
      filter: hue-rotate(120deg) saturate(1.4);
    }
    .crm-site-cc-label {
      font-size: 11.5px;
      font-weight: 600;
      color: #8b949e;
      white-space: nowrap;
      transition: color 180ms;
    }
    .crm-site-cc-btn:hover .crm-site-cc-label {
      color: #00e676;
    }
  `;

  const BRAND_HTML = `
    <div class="brand-header" id="brand-header" title="Cell City Gestão Empresarial">
      <img class="brand-header-logo" src="/CRM/assets/logo-horizontal.png" alt="Cell City Informática" draggable="false">
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

  // Identifica o elemento de título do módulo dentro do header original.
  // Reconhece os marcadores explícitos (#headerTitle, .header-title) e também
  // títulos genéricos (<h1>) usados por vários módulos sem id/classe própria.
  // Um <h1> só é tratado como título se NÃO contiver controles interativos
  // (ex.: acaodasemana usa um h1 com botões/navegação — esse fica intocado).
  function isPageTitle(el) {
    if (el.id === 'headerTitle' || el.classList.contains('header-title')) return true;
    if (el.tagName === 'H1' || el.tagName === 'H2') {
      return !el.querySelector('button, a, input, select, [onclick], [id]');
    }
    return false;
  }

  // Move o título para dentro de um slot dedicado (filho direto da barra),
  // que é o elemento de fato centralizado. Remove estilos inline do título
  // que conflitam com a centralização (ex.: estoque usa
  // transform:translateX(-80px) / flex / text-align inline no <h1>).
  function installTitle(bar, el) {
    ['flex', 'flexGrow', 'flexBasis', 'width', 'maxWidth', 'textAlign',
     'transform', 'margin', 'marginLeft', 'marginRight', 'position',
     'left', 'right', 'top'].forEach(p => { el.style[p] = ''; });
    el.classList.add('crm-page-title');
    const slot = document.createElement('div');
    slot.className = 'crm-title-slot';
    if (el.parentNode) el.parentNode.removeChild(el);
    slot.appendChild(el);
    // O slot é absoluto — não interfere no fluxo flex.
    // Inserimos como 2º filho (após o logo) só por semântica DOM;
    // visualmente fica centrado via CSS position:absolute.
    const logo = bar.querySelector('#brand-header');
    if (logo && logo.nextSibling) bar.insertBefore(slot, logo.nextSibling);
    else bar.insertBefore(slot, bar.firstChild);
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

    // Injeta o logo (sempre o 1º elemento, à extrema esquerda)
    const wrapper = document.createElement('div');
    wrapper.innerHTML = BRAND_HTML.trim();
    const brandEl = wrapper.firstElementChild;
    bar.appendChild(brandEl);
    attachHandler(brandEl);

    // Espaçador flexível: separa o grupo da esquerda (logo + "Fixar nos
    // Favoritos", injetado depois por favoritos.js) dos botões migrados,
    // que ficam alinhados à direita. O título absoluto fica centralizado
    // sobre o miolo livre.
    const spacer = document.createElement('div');
    spacer.className = 'crm-bar-spacer';
    bar.appendChild(spacer);

    // Atalho fixo para o site institucional
    const siteBtn = document.createElement('a');
    siteBtn.className = 'crm-site-cc-btn crm-bar-migrated';
    siteBtn.href = 'https://www.cellcityinformatica.com.br';
    siteBtn.target = '_blank';
    siteBtn.rel = 'noopener noreferrer';
    siteBtn.title = 'Abrir Site da Cell City';
    siteBtn.innerHTML = '<span class="crm-site-cc-icon">🌐</span><span class="crm-site-cc-label">Site</span>';
    bar.appendChild(siteBtn);

    // Migra todos os filhos do header existente para dentro do brand bar.
    // O título vira .crm-page-title (centralizado em absolute); os demais
    // botões recebem .crm-bar-migrated para neutralizar flex herdado do módulo
    // (ex.: .header-spacer com flex:1 que concorreria com .crm-bar-spacer).
    const existingHeader = document.querySelector('header');
    if (existingHeader) {
      let titleEl = null;
      while (existingHeader.firstElementChild) {
        const child = existingHeader.firstElementChild;
        if (!titleEl && isPageTitle(child)) titleEl = child;
        child.classList.add('crm-bar-migrated');
        bar.appendChild(child);
      }
      existingHeader.remove();

      // Fallback: alguns módulos (ex.: caixa) aninham o título dentro de um
      // wrapper (.header-center), então ele não aparece como filho direto.
      // Procuramos marcadores explícitos em qualquer profundidade — seguros
      // por serem sempre títulos de texto (não capturam h1 interativos).
      if (!titleEl) titleEl = bar.querySelector('#headerTitle, .header-title');

      if (titleEl) installTitle(bar, titleEl);
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
