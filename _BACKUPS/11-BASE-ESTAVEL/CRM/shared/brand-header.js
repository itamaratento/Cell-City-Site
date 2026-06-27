(function () {
  const DASHBOARD_URL = '/CRM/pages/dashboard/index.html';

  const CSS = `
    /* === CRM Brand Bar (injetada em todas as páginas do CRM) ===
       No Dashboard (quando #brand-header já existe), o .top-bar existente
       recebe id=crm-brand-bar e perde a classe .top-bar, herdando todos
       os estilos abaixo — sem quebrar a estrutura interna (busca global,
       relógio, sino, etc.).                                        */
    /* Barra fixa ao viewport — independente de padding-left do sidebar ou
       layout do módulo. Garante que o logo fique SEMPRE na mesma posição
       em todos os módulos. O dashboard sobrepõe com position:sticky via
       dashboard.css (crm-brand-bar-unified). */
    #crm-brand-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
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
      box-sizing: border-box;
    }
    /* Dashboard: .crm-brand-bar-unified retorna ao comportamento sticky
       (a barra fica dentro do flex-column do body, não precisa de fixed). */
    .crm-brand-bar-unified {
      position: sticky !important;
      left: auto !important;
      right: auto !important;
      width: auto !important;
      margin-bottom: 14px;
    }

    /* === Brand Header (logo clicável) === */
    .brand-header {
      display: flex;
      align-items: center;
      padding: 5px 16px;
      background: linear-gradient(135deg, rgba(0, 200, 83, 0.08) 0%, rgba(0, 200, 83, 0.02) 100%);
      border: 1px solid rgba(0, 200, 83, 0.2);
      border-radius: 10px;
      transition: all 300ms cubic-bezier(0.22, 1, 0.36, 1);
      cursor: pointer;
      user-select: none;
      flex-shrink: 0;
      position: relative;
      box-shadow: 0 0 12px rgba(0, 200, 83, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }
    .brand-header::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(0, 230, 118, 0.12) 0%, transparent 60%);
      opacity: 0.5;
      pointer-events: none;
    }
    .brand-header:hover {
      background: linear-gradient(135deg, rgba(0, 200, 83, 0.14) 0%, rgba(0, 200, 83, 0.04) 100%);
      border-color: rgba(0, 200, 83, 0.4);
      box-shadow: 0 0 24px rgba(0, 200, 83, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06);
      transform: translateY(-1px);
    }
    .brand-header:active {
      transform: translateY(0px) scale(0.98);
      opacity: 0.9;
    }
    .brand-header-logo {
      display: block;
      height: 46px;
      width: auto;
      position: relative;
      z-index: 1;
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
      .brand-header { padding: 6px 10px; }
    }

    /* ── Menu rápido na barra superior (quicknav) ── */
    #crm-quicknav {
      display: flex;
      align-items: center;
      gap: 1px;
      flex-shrink: 0;
      margin-left: 6px;
    }
    .crm-qn-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 7px;
      background: none;
      border: none;
      color: rgba(255,255,255,.5);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: background 140ms, color 140ms;
      position: relative;
      white-space: nowrap;
      font-family: inherit;
      line-height: 1;
      user-select: none;
    }
    .crm-qn-item:hover,
    .crm-qn-item:focus-within {
      background: rgba(255,255,255,.06);
      color: rgba(255,255,255,.9);
    }
    .crm-qn-item.qn-fixado { color: #00c853; font-weight: 700; }
    .crm-qn-item.qn-fixado:hover { color: #4ade80; }
    .crm-qn-ico   { font-size: 14px; line-height: 1; }
    .crm-qn-lbl   { line-height: 1; }
    .crm-qn-arrow { font-size: 8px; opacity: .55; margin-left: 1px; }

    /* Dropdown */
    .crm-qn-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      min-width: 180px;
      background: #111418;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 10px;
      padding: 6px;
      z-index: 99998;
      box-shadow: 0 8px 32px rgba(0,0,0,.55);
      opacity: 0;
      pointer-events: none;
      transform: translateY(-6px);
      transition: opacity .14s, transform .14s;
    }
    .crm-qn-item:hover .crm-qn-dropdown,
    .crm-qn-item:focus-within .crm-qn-dropdown {
      opacity: 1;
      pointer-events: all;
      transform: translateY(0);
    }
    /* Ponte invisível: evita gap entre botão e dropdown */
    .crm-qn-dropdown::before {
      content: '';
      position: absolute;
      top: -8px; left: 0; right: 0;
      height: 8px;
    }
    .crm-qn-sub {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 7px;
      color: rgba(255,255,255,.6);
      font-size: 12px;
      font-weight: 500;
      text-decoration: none;
      transition: background 120ms, color 120ms;
      white-space: nowrap;
      font-family: inherit;
    }
    .crm-qn-sub:hover { background: rgba(255,255,255,.07); color: #fff; }
    .crm-qn-sub-ico   { font-size: 13px; width: 18px; text-align: center; }
    .crm-qn-divider   {
      height: 1px;
      background: rgba(255,255,255,.07);
      margin: 4px 6px;
    }
    @media (max-width: 760px) { #crm-quicknav { display: none; } }

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

    /* ── Sininho Global de Alertas ── */
    #crm-bell-btn {
      position: relative;
      background: none;
      border: none;
      cursor: pointer;
      padding: 6px 8px;
      border-radius: 8px;
      font-size: 20px;
      line-height: 1;
      color: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;
      text-decoration: none;
    }
    #crm-bell-btn:hover { background: rgba(255,255,255,0.08); }
    .crm-bell-icon { display: inline-block; line-height: 1; }
    #crm-bell-badge {
      position: absolute;
      top: 1px; right: 1px;
      background: #ef4444;
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      min-width: 16px;
      height: 16px;
      border-radius: 8px;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
      line-height: 1;
      pointer-events: none;
      border: 1.5px solid #08090a;
    }
    @keyframes crm-bell-swing {
      0%,60%,100%{transform:rotate(0)}
      20%{transform:rotate(-10deg)}
      40%{transform:rotate(10deg)}
    }
    @keyframes crm-badge-pulse {
      0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.5)}
      60%{box-shadow:0 0 0 5px rgba(239,68,68,.0)}
    }
    #crm-bell-btn.tem-alerta .crm-bell-icon {
      color: #ef4444;
      animation: crm-bell-swing 2s ease-in-out infinite;
    }
    #crm-bell-btn.tem-alerta #crm-bell-badge {
      animation: crm-badge-pulse 2s ease infinite;
    }

    @keyframes crm-dd-fade {
      from { opacity:0; transform:translateY(-4px); }
      to   { opacity:1; transform:translateY(0); }
    }

    /* ── Menu rápido do sino ── */
    #crm-bell-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    #crm-bell-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      background: #13141a;
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 10px;
      min-width: 210px;
      display: none;
      flex-direction: column;
      z-index: 9999;
      box-shadow: 0 8px 28px rgba(0,0,0,0.40);
      overflow: hidden;
      animation: crm-dd-fade 150ms ease;
    }
    #crm-bell-dropdown.open { display: flex; }
    .crm-bell-dd-header {
      padding: 9px 14px 7px;
      font-size: 11px;
      font-weight: 700;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: .06em;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .crm-bell-dd-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      font-size: 13px;
      color: #e1e1e8;
      text-decoration: none;
      background: none;
      border: none;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      cursor: pointer;
      text-align: left;
      width: 100%;
      transition: background 140ms;
    }
    .crm-bell-dd-item:last-child { border-bottom: none; }
    .crm-bell-dd-item:hover { background: rgba(255,255,255,0.06); }
  `;

  const BRAND_HTML = `
    <div class="brand-header" id="brand-header" title="Cell City Gestão Empresarial">
      <img class="brand-header-logo" src="/CRM/assets/logo.svg" alt="Cell City Gestão Empresarial" draggable="false">
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
    // Default: sons ATIVADOS
    if (localStorage.getItem(_CC_LS_SONS) === null) localStorage.setItem(_CC_LS_SONS, 'true');
    // Migração: versão anterior gravava 'false' como padrão sem o usuário ter escolhido.
    // Reativa apenas se o usuário nunca salvou explicitamente a config de sons.
    if (localStorage.getItem(_CC_LS_SONS) === 'false' && !localStorage.getItem('cc_sons_user_choice')) {
      localStorage.setItem(_CC_LS_SONS, 'true');
    }
    // Botão movido para Central de Alertas → Sons e Notificações
    return;

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

  // ── Menu rápido (quicknav) ────────────────────────────────────
  var TOPBAR_LS = 'cc_topbar_prefs';

  function _topbarPrefs() {
    try { return JSON.parse(localStorage.getItem(TOPBAR_LS) || 'null'); } catch(ex) { return null; }
  }

  function _buildQuicknav() {
    var prefs = _topbarPrefs();
    if (!prefs || !Array.isArray(prefs.itens) || !prefs.itens.length) return null;

    var visiveis = prefs.itens
      .filter(function(i) { return i.visivel !== false; })
      .sort(function(a, b) {
        if (a.fixado && !b.fixado) return -1;
        if (!a.fixado && b.fixado) return 1;
        return (a.ordem || 0) - (b.ordem || 0);
      });

    if (!visiveis.length) return null;

    // Precisamos do catálogo para pegar submenus, icon, href
    // Lemos do localStorage de catalog cache (salvo por topbar-prefs.js via cc_topbar_prefs)
    var nav = document.createElement('nav');
    nav.id = 'crm-quicknav';
    nav.setAttribute('aria-label', 'Menu rápido');

    visiveis.forEach(function(conf) {
      var subConfs = Array.isArray(conf.submenus) ? conf.submenus.filter(function(s) { return s.visivel !== false; }) : [];
      var hasSub   = subConfs.length > 0;

      var el = document.createElement('a');
      el.className = 'crm-qn-item' + (conf.fixado ? ' qn-fixado' : '');
      el.href      = conf.href || '#';
      el.setAttribute('data-qnid', conf.id);
      el.innerHTML =
        '<span class="crm-qn-ico">' + (conf.icon || '📌') + '</span>' +
        '<span class="crm-qn-lbl">' + (conf.label || conf.id) + '</span>' +
        (hasSub ? '<span class="crm-qn-arrow">▾</span>' : '');

      if (hasSub) {
        var dd = document.createElement('div');
        dd.className = 'crm-qn-dropdown';
        // Link principal no topo do dropdown
        if (conf.href && conf.href !== '#') {
          var mainLink = document.createElement('a');
          mainLink.className = 'crm-qn-sub';
          mainLink.href = conf.href;
          mainLink.innerHTML =
            '<span class="crm-qn-sub-ico">' + (conf.icon || '🔗') + '</span>' +
            '<span>Abrir ' + (conf.label || '') + '</span>';
          dd.appendChild(mainLink);
          var div = document.createElement('div');
          div.className = 'crm-qn-divider';
          dd.appendChild(div);
        }
        subConfs.forEach(function(sub) {
          var s = document.createElement('a');
          s.className = 'crm-qn-sub';
          s.href = sub.href || '#';
          s.innerHTML =
            '<span class="crm-qn-sub-ico">' + (sub.icon || '›') + '</span>' +
            '<span>' + (sub.label || sub.id) + '</span>';
          dd.appendChild(s);
        });
        el.appendChild(dd);
      }

      nav.appendChild(el);
    });

    return nav;
  }

  function _insertQuicknav(bar) {
    var old = document.getElementById('crm-quicknav');
    if (old) old.remove();

    var nav = _buildQuicknav();
    if (!nav) return;

    // Insere após o logo, antes do spacer ou da busca global
    var anchor = bar.querySelector('.crm-bar-spacer, .global-search-wrapper, .top-meta-right');
    if (anchor) bar.insertBefore(nav, anchor);
    else bar.appendChild(nav);
  }

  function _refreshQuicknav() {
    var bar = document.getElementById('crm-brand-bar');
    if (bar) _insertQuicknav(bar);
  }

  window.addEventListener('cc-topbar-changed', _refreshQuicknav);

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
        // Injeta botão de som e sininho no dashboard
        criarBotaoSom(right || topBar);
        criarBotaoSino(right || topBar);
      }
      _insertQuicknav(topBar || existing.parentElement);
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

    // Injeta botão de som e sininho de alertas
    criarBotaoSom(bar);
    criarBotaoSino(bar);

    // Injeta menu rápido da barra superior
    _insertQuicknav(bar);

    // Insere o brand bar como o 1º filho do body — completamente independente
    document.body.insertBefore(bar, document.body.firstChild);

    // Empurra o conteúdo para baixo da barra fixa (56px altura + 14px folga).
    // Usa !important para sobrepor qualquer padding-top do módulo.
    if (!document.getElementById('crm-bar-body-offset')) {
      const s = document.createElement('style');
      s.id = 'crm-bar-body-offset';
      s.textContent = 'body { padding-top: 70px !important; }';
      document.head.appendChild(s);
    }
  }

  // ── Sininho global de alertas ─────────────────────────────────
  function _atualizarBadgeSino(count, isNew) {
    var btn   = document.getElementById('crm-bell-btn');
    var badge = document.getElementById('crm-bell-badge');
    if (!btn || !badge) return;
    var temAlerta = count > 0;
    badge.style.display = temAlerta ? 'flex' : 'none';
    badge.textContent   = count > 99 ? '99+' : String(count);
    if (temAlerta !== btn.classList.contains('tem-alerta')) {
      btn.classList.toggle('tem-alerta', temAlerta);
    }
    if (isNew && temAlerta) {
      // Re-dispara animação do shake
      btn.classList.remove('tem-alerta');
      void btn.offsetWidth;
      btn.classList.add('tem-alerta');
    }
  }

  function criarBotaoSino(bar) {
    if (document.getElementById('crm-bell-btn')) return;

    // Wrapper para posicionamento do dropdown
    var wrap = document.createElement('div');
    wrap.id = 'crm-bell-wrap';

    // Botão sino
    var btn = document.createElement('button');
    btn.id   = 'crm-bell-btn';
    btn.type = 'button';
    btn.title = 'Central de Alertas';
    btn.setAttribute('aria-label', 'Central de Alertas');
    btn.innerHTML = '<span class="crm-bell-icon">🔔</span>'
                  + '<span id="crm-bell-badge">0</span>';

    // Dropdown
    var dd = document.createElement('div');
    dd.id = 'crm-bell-dropdown';
    dd.innerHTML =
      '<div class="crm-bell-dd-header">Alertas</div>' +
      '<a class="crm-bell-dd-item" href="/CRM/pages/central-alertas/index.html">🔔 Ver todos os alertas</a>' +
      '<button class="crm-bell-dd-item" id="crm-dd-marcar-lidos">✔ Marcar todos como lidos</button>' +
      '<a class="crm-bell-dd-item" href="/CRM/pages/central-alertas/index.html">⚙️ Abrir Central de Alertas</a>';

    wrap.appendChild(btn);
    wrap.appendChild(dd);

    // Toggle dropdown
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      dd.classList.toggle('open');
    });

    // Marcar todos como lidos (dispara evento, alertas-badge.js escuta)
    dd.querySelector('#crm-dd-marcar-lidos').addEventListener('click', function() {
      dd.classList.remove('open');
      window.dispatchEvent(new CustomEvent('cc-cmd-marcar-todos'));
    });

    // Fechar ao clicar fora
    document.addEventListener('click', function(e) {
      if (!wrap.contains(e.target)) dd.classList.remove('open');
    });

    // Badge inicial do localStorage (antes do Firebase carregar)
    var cached = parseInt(localStorage.getItem('cc_alertas_badge_count') || '0', 10);
    _atualizarBadgeSino(cached, false);

    // Atualização em tempo real via alertas-badge.js
    window.addEventListener('cc-alertas-badge', function(e) {
      _atualizarBadgeSino(e.detail.count, e.detail.hasNew);
    });

    // Sincronização entre abas (storage event)
    window.addEventListener('storage', function(e) {
      if (e.key === 'cc_alertas_badge_count') {
        var count = parseInt(e.newValue || '0', 10);
        var prev  = parseInt(e.oldValue  || '0', 10);
        _atualizarBadgeSino(count, count > prev);
      }
    });

    // Insere antes do botão Site
    var siteBtn = bar.querySelector('.crm-site-cc-btn, .site-cc-btn');
    if (siteBtn) bar.insertBefore(wrap, siteBtn);
    else bar.appendChild(wrap);

    // Injeta módulo alertas-badge.js (Firestore em tempo real)
    if (!document.getElementById('crm-alertas-badge-module')) {
      var s = document.createElement('script');
      s.id   = 'crm-alertas-badge-module';
      s.type = 'module';
      s.textContent = "import('/CRM/shared/alertas-badge.js').then(function(m){m.iniciarBadgeAlertas();}).catch(function(){});";
      document.head.appendChild(s);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── PRELOAD DE CONTEXTO TENANT ──────────────────────────────────────────────
  // Inicia o carregamento do contexto da empresa logo que o brand-header carrega,
  // antes dos módulos JS iniciarem. Isso garante que getEmpresaId() retorne o
  // valor correto em vez do fallback 'cellcity-master' quando o módulo chamar init().
  //
  // Expõe window._ccTenantReady (Promise) para módulos que queiram aguardar:
  //   await window._ccTenantReady;
  // ─────────────────────────────────────────────────────────────────────────────
  window._ccTenantReady = (async function _preloadTenant() {
    try {
      const { authReady }           = await import('/CRM/scripts/firebase.js');
      const { loadContext, getTenant } = await import('/CRM/shared/tenant.js');
      const user = await authReady;
      if (user && !user.isAnonymous) {
        if (!getTenant()) {
          await loadContext(user.uid);
        }
      }
      return getTenant();
    } catch (e) {
      console.warn('[TENANT] brand-header preload falhou:', e.message);
      return null;
    }
  })();
})();
