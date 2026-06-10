// =====================================================
// HEADER COMPONENT – Cabeçalho Global Compartilhado
// Cell City Informática
// =====================================================
// Este script injeta o header em todas as páginas que
// incluírem <script src="js/header-component.js" defer>
// no <head>. Qualquer alteração no header deve ser feita
// APENAS neste arquivo.
// =====================================================

(function () {
  'use strict';

  // ===================================================
  // CSS DO CABEÇALHO (inline para autocontido)
  // ===================================================
  const HEADER_CSS = `
    /* ===== HEADER GLOBAL ===== */
    .header {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      background: rgba(11,13,16,0.96);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 1000;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding: 6px 0;
    }

    .header-flex {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 0px;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }

    .header .logo {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      margin-left: -14px;
    }

    .header .nav {
      display: flex;
      align-items: center;
      flex: 0 0 auto;
      justify-content: flex-start;
      width: auto;
      margin-left: 52px;
    }

    .header .logo img {
      width: 100px;
      height: auto;
      border-radius: 10px;
      display: block;
    }

    .nav-row {
      display: flex;
      gap: 5px;
      align-items: center;
      justify-content: flex-start;
      flex-wrap: wrap;
    }

    .header .nav a {
      font-size: 0.78rem;
      font-weight: 700;
      color: #fff;
      transition: color 0.3s;
      white-space: nowrap;
    }

    .header .nav a:hover {
      color: #ffcc00;
    }

    /* ---- Nav Links (Serviços) ---- */
    .nav-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 5px 12px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.82rem;
      transition: all 0.3s ease;
      border: 2px solid transparent;
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
      text-decoration: none;
    }

    .nav-link:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 204, 0, 0.3);
      color: #ffcc00;
      transform: translateY(-1px);
    }

    /* ---- Nav Buttons (Serviços + Ações) ---- */
    .nav-btn {
      background: linear-gradient(135deg, #00C853 0%, #00A040 100%);
      color: white !important;
      padding: 5px 12px !important;
      border-radius: 6px !important;
      font-weight: 600 !important;
      font-size: 0.82rem !important;
      transition: all 0.3s ease !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      line-height: 1 !important;
      text-decoration: none !important;
      margin-left: 0 !important;
    }

    .nav-btn:hover {
      background: linear-gradient(135deg, #00A040 0%, #008030 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 200, 83, 0.3);
    }

    /* ---- Botão: Celulares (Verde) ---- */
    .nav-celular {
      background: linear-gradient(135deg, #00C853 0%, #00A040 100%) !important;
    }
    .nav-celular:hover {
      background: linear-gradient(135deg, #00A040 0%, #008030 100%) !important;
      box-shadow: 0 4px 12px rgba(0, 200, 83, 0.3) !important;
    }

    /* ---- Botão: Notebooks (Azul) ---- */
    .nav-notebook {
      background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%) !important;
    }
    .nav-notebook:hover {
      background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%) !important;
      box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3) !important;
    }

    /* ---- Botão: Impressoras (Roxo) ---- */
    .nav-impressora {
      background: linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%) !important;
    }
    .nav-impressora:hover {
      background: linear-gradient(135deg, #7B1FA2 0%, #6A1B9A 100%) !important;
      box-shadow: 0 4px 12px rgba(156, 39, 176, 0.3) !important;
    }

    .nav-atendimento {
      background: linear-gradient(135deg, #FF6B35 0%, #FF5722 100%);
    }

    .nav-atendimento:hover {
      background: linear-gradient(135deg, #FF5722 0%, #E64A19 100%);
      box-shadow: 0 4px 12px rgba(255, 91, 34, 0.3);
    }

    .nav-consultar {
      background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
    }

    .nav-consultar:hover {
      background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%);
      box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
    }

    .nav-portal {
      background: linear-gradient(135deg, #00C853 0%, #009624 100%);
    }

    .nav-portal:hover {
      background: linear-gradient(135deg, #009624 0%, #007A1E 100%);
      box-shadow: 0 4px 12px rgba(0, 200, 83, 0.3);
    }

    /* ===== RESPONSIVO: TABLET / DESKTOP GRANDE (1024px+) ===== */
    @media (min-width: 1024px) {
      .header .logo img {
        width: 105px;
      }

      .header .nav a {
        font-size: 0.85rem;
      }

      .nav-link,
      .nav-btn {
        padding: 6px 14px !important;
        font-size: 0.85rem !important;
      }

      .nav-row {
        gap: 7px;
      }
    }

    /* ===== RESPONSIVO: MOBILE / TABLET PEQUENO (até 767px) ===== */
    @media (max-width: 767px) {
      .header {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        overflow: visible !important;
        position: relative;
        z-index: 9999;
        padding: 10px 12px 8px;
        background: rgba(11,13,16,0.96);
      }

      .header-flex {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        gap: 8px;
        padding: 0;
      }

      .header .logo img {
        display: block !important;
        width: 85px;
        max-width: 28vw;
        height: auto;
      }

      .header .nav {
        display: flex !important;
        flex-direction: column;
        gap: 5px;
        width: 100%;
        align-items: center;
      }

      .nav-row {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 4px;
        width: 100%;
      }

      .header .nav a {
        font-size: 0.72rem;
      }

      .nav-link,
      .nav-btn {
        padding: 4px 8px !important;
        font-size: 0.72rem !important;
      }
    }

    /* ===== RESPONSIVO: TELAS MUITO PEQUENAS (≤ 400px) ===== */
    @media (max-width: 400px) {
      .header {
        padding: 8px 10px 6px;
      }

      .header-flex {
        gap: 4px;
      }

      .header .logo img {
        width: 75px;
      }

      .header .nav {
        gap: 4px;
      }

      .nav-row {
        gap: 2px;
      }

      .header .nav a {
        font-size: 0.65rem;
      }

      .nav-link,
      .nav-btn {
        padding: 3px 6px !important;
        font-size: 0.65rem !important;
      }
    }
  `;

  // ===================================================
  // HTML DO CABEÇALHO
  // ===================================================
  const HEADER_HTML = `
    <div class="container header-flex">
      <a href="/" class="logo" aria-label="Cell City Informática - Página inicial">
        <img src="/imagens/logooficial.jpeg" alt="Cell City Informática" width="100" height="29">
      </a>
      <nav class="nav" role="navigation" aria-label="Menu principal">
        <div class="nav-row">
          <a href="/celular/index.html" class="nav-btn nav-celular">Celulares</a>
          <a href="/notebook/index.html" class="nav-btn nav-notebook">Notebooks</a>
          <a href="/impressora/index.html" class="nav-btn nav-impressora">Impressoras</a>
          <a href="/consultar-os.html" class="nav-btn nav-consultar">🔍 Consultar OS</a>
          <a href="/autoatendimento.html" class="nav-btn nav-atendimento">📱 Abrir Atendimento</a>
          <a href="/CRM/pages/portal-cliente/index.html" class="nav-btn nav-portal">🔐 Portal do Cliente</a>
        </div>
      </nav>
    </div>
  `;

  // ===================================================
  // INJEÇÃO
  // ===================================================
  function init() {
    // Evita injeção duplicada
    if (document.querySelector('.header')) return;

    // Injeta CSS uma única vez
    if (!document.getElementById('header-component-style')) {
      const style = document.createElement('style');
      style.id = 'header-component-style';
      style.textContent = HEADER_CSS;
      document.head.appendChild(style);
    }

    // Cria o elemento header
    const header = document.createElement('header');
    header.className = 'header';
    header.setAttribute('role', 'banner');
    header.innerHTML = HEADER_HTML;

    // Insere como primeiro elemento do body
    document.body.insertBefore(header, document.body.firstChild);
  }

  // Aguarda o DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
