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

    /* === Slot do título: contêiner próprio, filho direto da barra ===
       Centralização visual real ancorada ao centro da barra inteira.
       Como é um elemento que só nós controlamos (classe exclusiva), nenhum
       CSS de módulo consegue sobrescrever sua posição — diferente de aplicar
       position no próprio <h1>/<span> do módulo, que vários módulos
       sobrescreviam (estoque) ou aninhavam em wrappers posicionados (caixa,
       pós-venda), quebrando a centralização. */
    /* Padrão (telas estreitas, < 1160px): o slot fica NO FLUXO, ocupando o
       miolo entre o grupo da esquerda (logo + Fixar) e os botões da direita,
       com o título centralizado nesse espaço. Como é um irmão flex, nunca
       sobrepõe os botões vizinhos — garante "não encostar" em janela reduzida. */
    #crm-brand-bar .crm-title-slot {
      position: static;
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none; /* nunca bloqueia cliques nos botões */
      z-index: 1;
    }

    /* Telas largas (>= 1160px): centralização visual REAL no centro da barra
       inteira. Aqui as laterais não alcançam o centro, então não há risco de
       sobreposição. O slot sai do fluxo (absolute) e o espaçador empurra os
       botões para a direita. */
    @media (min-width: 1160px) {
      #crm-brand-bar .crm-title-slot {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        flex: 0 0 auto;
        max-width: 46%;
      }
    }

    /* O título em si só recebe estilo de texto — a posição é do slot.
       !important nos itens de layout porque vários módulos estilizam o
       próprio título (ex.: pos-venda força position:absolute via CSS de id),
       o que o tiraria do fluxo do slot e o colapsaria a 0 de largura. */
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

    /* O espaçador só atua nas telas largas, onde o slot é absoluto: aí ele
       empurra os botões migrados para a direita. Em telas estreitas o próprio
       slot (flex:1) cumpre esse papel, então o espaçador fica neutro. */
    #crm-brand-bar .crm-bar-spacer {
      flex: 0 0 auto;
      width: 0;
    }
    @media (min-width: 1160px) {
      #crm-brand-bar .crm-bar-spacer {
        flex: 1 1 auto;
        width: auto;
      }
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
    // Ordem alvo: logo, [Fixar], slot, espaçador, botões. Inserimos o slot
    // logo após o logo; o "Fixar nos Favoritos" entra depois (favoritos.js),
    // também após o logo, ficando entre o logo e o slot.
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

    // Migra todos os filhos do header existente para dentro do brand bar.
    // O título vira .crm-page-title (centralizado em absolute); os demais
    // botões vão para a direita, após o espaçador.
    const existingHeader = document.querySelector('header');
    if (existingHeader) {
      let titleEl = null;
      while (existingHeader.firstElementChild) {
        const child = existingHeader.firstElementChild;
        if (!titleEl && isPageTitle(child)) titleEl = child;
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
