(function () {
  const DASHBOARD_URL = '/CRM/pages/dashboard/index.html';

  const CSS = `
    /* === CRM Brand Bar (injetada em todas as páginas do CRM) ===
       No Dashboard (quando #brand-header já existe), o .top-bar existente
       recebe id=crm-brand-bar e perde a classe .top-bar, herdando todos
       os estilos abaixo — sem quebrar a estrutura interna (busca global,
       relógio, sino, etc.).                                        */
    #crm-brand-bar,
    .crm-brand-bar-unified {
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
      height: auto;
      flex-shrink: 0;
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

    /* Dashboard: a busca global deve ocupar o espaço central flexível */
    #crm-brand-bar > .global-search-wrapper {
      flex: 1 1 auto;
    }
    #crm-brand-bar > .global-search-wrapper .global-search {
      max-width: 620px;
      margin: 0 auto;
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
      .brand-header-divider,
      .brand-header-subtitle { display: none; }
      .brand-header { padding: 6px 10px; }
    }

    /* === Botão Global de Sons === */
    .crm-audio-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 8px;
      background: rgba(251,191,36,0.07);
      border: 1px solid rgba(251,191,36,0.22);
      flex-shrink: 0;
      cursor: pointer;
      transition: background 180ms, border-color 180ms, box-shadow 180ms;
      font-size: 11.5px;
      font-weight: 600;
      color: #fbbf24;
      white-space: nowrap;
      user-select: none;
      position: relative;
    }
    .crm-audio-btn.sons-off {
      background: rgba(148,163,184,0.06);
      border-color: rgba(148,163,184,0.2);
      color: #64748b;
    }
    .crm-audio-btn:hover { filter: brightness(1.15); }
    .crm-audio-btn-icon { font-size: 15px; line-height: 1; }

    /* Popup "Último Som" */
    .crm-audio-popup {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 260px;
      background: #1a1d22;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      padding: 14px;
      z-index: 99999;
      display: none;
      font-size: 12px;
      color: #cbd5e1;
      text-align: left;
    }
    .crm-audio-popup.open { display: block; }
    .crm-audio-popup-title { font-weight: 700; color: #fbbf24; margin-bottom: 10px; font-size: 12px; }
    .crm-audio-popup-row { display: flex; flex-direction: column; gap: 3px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .crm-audio-popup-row:last-of-type { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .crm-audio-popup-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
    .crm-audio-popup-val { color: #e2e8f0; }
    .crm-audio-popup-status-on { color: #4ade80; font-weight: 700; }
    .crm-audio-popup-status-off { color: #f87171; font-weight: 700; }
    .crm-audio-test-btn {
      width: 100%; margin-top: 10px; padding: 7px 12px;
      background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3);
      border-radius: 7px; color: #fbbf24; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: background 150ms;
    }
    .crm-audio-test-btn:hover { background: rgba(251,191,36,0.2); }
    .crm-audio-test-btn:disabled { opacity: 0.4; cursor: not-allowed; }

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
      <div class="brand-header-text">
        <div class="brand-header-title">Cell City Informática</div>
        <div class="brand-header-divider"></div>
        <div class="brand-header-subtitle">Gestão Empresarial</div>
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

  // ── Botão Global de Sons ────────────────────────────────────────────────────
  var _CC_LS_SONS = 'cc_sons_sistema';
  var _CC_LS_LOG  = 'cc_eventos_log';

  function _somLog(ts, origem, evento, tipo, arquivo, status, motivo) {
    try {
      var log = JSON.parse(localStorage.getItem(_CC_LS_LOG) || '[]');
      log.unshift({ ts: ts, origem: origem, evento: evento, tipo: tipo,
                    arquivo: arquivo || '', status: status || '', motivo: motivo || '' });
      if (log.length > 300) log.length = 300;
      localStorage.setItem(_CC_LS_LOG, JSON.stringify(log));
    } catch(ex) {}
  }

  function _somUltimo() {
    try { return (JSON.parse(localStorage.getItem(_CC_LS_LOG) || '[]')).find(function(e) { return e.tipo === 'som'; }) || null; }
    catch(ex) { return null; }
  }

  function _somFmt(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function(n) { return String(n).padStart(2,'0'); }).join(':')
      + ' — ' + String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
  }

  function _somOn() { return localStorage.getItem(_CC_LS_SONS) === 'true'; }

  function _somBtnAtualizar(btn) {
    if (_somOn()) {
      btn.innerHTML = '<span class="crm-audio-btn-icon">🔊</span><span class="crm-audio-btn-label">Sons do Sistema</span>';
      btn.classList.remove('sons-off');
      btn.title = 'Sons ATIVADOS — clique para desativar';
    } else {
      btn.innerHTML = '<span class="crm-audio-btn-icon">🔇</span><span class="crm-audio-btn-label">Sons do Sistema</span>';
      btn.classList.add('sons-off');
      btn.title = 'Sons DESATIVADOS — clique para ativar';
    }
  }

  function _somPopupRender(popup, btn) {
    var on = _somOn();
    var ult = _somUltimo();
    var statusCls = on ? 'crm-audio-popup-status-on' : 'crm-audio-popup-status-off';
    popup.innerHTML =
      '<div class="crm-audio-popup-title">🎵 Sons do Sistema</div>' +
      '<div class="crm-audio-popup-row">' +
        '<span class="crm-audio-popup-label">Status atual</span>' +
        '<span class="' + statusCls + '">' + (on ? '🔊 ATIVADOS' : '🔇 DESATIVADOS') + '</span>' +
      '</div>' +
      (ult ? (
        '<div class="crm-audio-popup-row"><span class="crm-audio-popup-label">Horário</span><span class="crm-audio-popup-val">' + _somFmt(ult.ts) + '</span></div>' +
        '<div class="crm-audio-popup-row"><span class="crm-audio-popup-label">Módulo</span><span class="crm-audio-popup-val">' + (ult.origem || '—') + '</span></div>' +
        '<div class="crm-audio-popup-row"><span class="crm-audio-popup-label">Evento</span><span class="crm-audio-popup-val">' + (ult.evento || '—') + '</span></div>' +
        '<div class="crm-audio-popup-row"><span class="crm-audio-popup-label">Arquivo de Áudio</span><span class="crm-audio-popup-val">' + (ult.arquivo || '—') + '</span></div>'
      ) : '<div class="crm-audio-popup-row"><span class="crm-audio-popup-label">Último som</span><span class="crm-audio-popup-val">Nenhum registrado</span></div>') +
      '<button class="crm-audio-test-btn"' + (on ? '' : ' disabled') + '>🔔 Testar Som</button>';
    popup.querySelector('.crm-audio-test-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      var b = e.currentTarget;
      if (!_somOn()) {
        _somLog(new Date().toISOString(), 'Botão Testar Som', 'Teste manual', 'bloqueado', '', 'BLOQUEADO', 'cc_sons_sistema = false');
        b.textContent = '🔇 Bloqueado!';
        setTimeout(function() { b.textContent = '🔔 Testar Som'; }, 1500);
        return;
      }
      var ts = new Date().toISOString();
      _somLog(ts, 'Botão Testar Som', 'Teste manual de som', 'som', 'AudioContext — sine 880', 'EXECUTADO', '');
      try {
        var C = window.AudioContext || window.webkitAudioContext;
        var ctx = new C(); var osc = ctx.createOscillator(); var g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
        g.gain.setValueAtTime(0.25, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.42);
        osc.onended = function() { try { ctx.close(); } catch(ex) {} };
      } catch(ex) {}
      b.textContent = '✅ Som tocado!';
      setTimeout(function() { b.textContent = '🔔 Testar Som'; }, 1500);
    });
  }

  function criarBotaoSom(bar) {
    if (document.getElementById('crm-audio-toggle')) return;

    // Default: sons desativados até o usuário ativar explicitamente
    if (localStorage.getItem(_CC_LS_SONS) === null) localStorage.setItem(_CC_LS_SONS, 'false');

    var btn = document.createElement('button');
    btn.id = 'crm-audio-toggle';
    btn.className = 'crm-audio-btn crm-bar-migrated';
    _somBtnAtualizar(btn);

    var popup = document.createElement('div');
    popup.className = 'crm-audio-popup';
    btn.appendChild(popup);

    // Clique no botão: toggle ON/OFF + abrir popup com info
    btn.addEventListener('click', function(e) {
      if (popup.contains(e.target)) return;
      // Toggle
      var novoEstado = !_somOn();
      localStorage.setItem(_CC_LS_SONS, novoEstado ? 'true' : 'false');
      if (!novoEstado) {
        _somLog(new Date().toISOString(), 'Botão Global de Sons', 'Sons do Sistema desativados', 'sistema', '', '', 'Usuário desativou manualmente');
      }
      _somBtnAtualizar(btn);
      _somPopupRender(popup, btn);
      popup.classList.add('open');
      e.stopPropagation();
    });

    // Fechar popup ao clicar fora
    document.addEventListener('click', function(e) {
      if (!btn.contains(e.target)) popup.classList.remove('open');
    }, true);

    var siteBtn = bar.querySelector('.crm-site-cc-btn, .site-cc-btn');
    if (siteBtn) bar.insertBefore(btn, siteBtn);
    else bar.appendChild(btn);
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

    // Dashboard: #brand-header já existe — aplica o id #crm-brand-bar
    // ao .top-bar existente. O seletor de ID (#crm-brand-bar) tem
    // especificidade maior que a classe (.top-bar), sobrepondo os
    // estilos originais sem precisar remover a classe — isso preserva
    // a compatibilidade com favoritos.js e demais scripts que referenciam
    // .top-bar.
    const existing = document.getElementById('brand-header');
    if (existing) {
      attachHandler(existing);

      const topBar = existing.closest('.top-bar');
      if (topBar) {
        // Aplica o id padronizado — a maior especificidade do ID
        // sobrepõe os estilos de .top-bar (grid → flex, etc.)
        topBar.id = 'crm-brand-bar';
        topBar.classList.add('crm-brand-bar-unified');

        // Garante que o botão Site existe no top-meta-right
        // (já existe no Dashboard com classe .site-cc-btn, mas
        //  deixamos o .crm-site-cc-btn como fallback)
        const right = topBar.querySelector('.top-meta-right');
        if (right && !right.querySelector('.crm-site-cc-btn, .site-cc-btn')) {
          const siteBtn = document.createElement('a');
          siteBtn.className = 'crm-site-cc-btn';
          siteBtn.href = 'https://www.cellcityinformatica.com.br';
          siteBtn.target = '_blank';
          siteBtn.rel = 'noopener noreferrer';
          siteBtn.title = 'Abrir Site da Cell City';
          siteBtn.innerHTML = '<span class="crm-site-cc-icon">🌐</span><span class="crm-site-cc-label">Site</span>';
          right.prepend(siteBtn);
        }
        // Injeta botão de som no dashboard
        criarBotaoSom(right || topBar);
      }
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
    // Insere ANTES do botão Site para que botões como "Favoritar" fiquem
    // mais à esquerda que o "Site".
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
        // Insere antes do siteBtn para que botões do header (ex: Favoritar)
        // fiquem à esquerda do atalho "Site"
        bar.insertBefore(child, siteBtn);
      }
      existingHeader.remove();

      // Fallback: alguns módulos (ex.: caixa) aninham o título dentro de um
      // wrapper (.header-center), então ele não aparece como filho direto.
      // Procuramos marcadores explícitos em qualquer profundidade — seguros
      // por serem sempre títulos de texto (não capturam h1 interativos).
      if (!titleEl) titleEl = bar.querySelector('#headerTitle, .header-title');

      if (titleEl) installTitle(bar, titleEl);
    }

    // Injeta botão de som (antes do siteBtn, que criarBotaoSom detecta automaticamente)
    criarBotaoSom(bar);

    // Insere o brand bar como o 1º filho do body — completamente independente
    document.body.insertBefore(bar, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
