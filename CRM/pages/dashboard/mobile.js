/* ============================================================
   MOBILE.JS — Modo Mobile Profissional Cell City
   Injeta layout mobile (lista, categorias, drawer) no dashboard.
   ============================================================ */
(function () {
  'use strict';

  const MOBILE_BP = 768;
  const FAV_KEY   = 'cc_modulos_favs';
  const VIEW_KEY  = 'cc_mob_view'; // 'lista' | 'grade'

  /* ── Catálogo de módulos por categoria ─────────────────── */
  const CATEGORIAS = [
    { id: 'operacional', label: '📦 Operacional', modulos: [
      { id: 'os',               nome: 'Ordem de Serviço',     icone: '📦', desc: 'Gestão técnica de reparos' },
      { id: 'central-alertas',  nome: 'Central de Alertas',   icone: '🔔', desc: 'Alertas e pendências do sistema' },
      { id: 'clientes',         nome: 'Clientes',             icone: '👥', desc: 'Base de clientes' },
      { id: 'estoque',          nome: 'Estoque',              icone: '📱', desc: 'Peças e produtos' },
      { id: 'acaodasemana',     nome: 'Agenda',               icone: '📅', desc: 'Agenda inteligente e tarefas' },
      { id: 'garantias',        nome: 'Garantias',            icone: '🛡️', desc: 'Termos e configurações de garantia' },
      { id: 'autoatendimento',  nome: 'Autoatendimento',      icone: '🤖', desc: 'Pré-OS online do site' },
    ]},
    { id: 'financeiro', label: '💰 Financeiro', modulos: [
      { id: 'caixa',      nome: 'Caixa',               icone: '💰', desc: 'Fluxo financeiro diário' },
      { id: 'financeiro', nome: 'Financeiro',          icone: '💹', desc: 'Controle financeiro detalhado' },
      { id: 'despesas',   nome: 'Despesas',            icone: '💸', desc: 'Controle de despesas e saídas' },
      { id: 'compras',    nome: 'Compras',             icone: '🛒', desc: 'Pedidos e recebimentos de peças' },
      { id: 'fechamento', nome: 'Fechamento',          icone: '🔒', desc: 'Relatório mensal consolidado' },
      { id: 'pendencias', nome: 'Pendências e Contas', icone: '📋', desc: 'Clientes, parceiros e empréstimos' },
    ]},
    { id: 'comercial', label: '🎯 Comercial', modulos: [
      { id: 'crm-comercial', nome: 'CRM Comercial', icone: '🎯', desc: 'Leads, orçamentos e oportunidades' },
      { id: 'fornecedor',    nome: 'Fornecedor',    icone: '🏭', desc: 'Gestão de fornecedores' },
      { id: 'pos-venda',     nome: 'Pós-venda',     icone: '💝', desc: 'Fidelização e garantia de clientes' },
      { id: 'catalogo',      nome: 'Catálogo',      icone: '🛍️', desc: 'Produtos e vendas via WhatsApp' },
    ]},
    { id: 'relatorios', label: '📊 Relatórios', modulos: [
      { id: 'relatorios', nome: 'Relatórios', icone: '📊', desc: 'Gráficos e análise do negócio' },
    ]},
    { id: 'ferramentas', label: '⚡ Ferramentas', modulos: [
      { id: 'central-comandos',    nome: 'Central de Comandos',    icone: '⚡',  desc: 'Ferramentas e atalhos rápidos' },
      { id: 'central-organizacao', nome: 'Central de Automação',   icone: '🔧', desc: 'WhatsApp, automações e histórico' },
      { id: 'central-informacoes', nome: 'Central de Informações', icone: '📚', desc: 'Comandos, sites, senhas e mais' },
      { id: 'portal-cliente',      nome: 'Portal do Cliente',      icone: '🔷', desc: 'Acesso e diagnóstico do cliente' },
      { id: 'portal-tecnico',      nome: 'Portal Técnico',        icone: '🔓', desc: 'FRP, firmwares e soluções técnicas' },
      { id: 'diario',              nome: 'Diário',                icone: '📔', desc: 'Organização pessoal e planejamento' },
    ]},
    { id: 'administracao', label: '⚙️ Administração', modulos: [
      { id: 'auditoria',   nome: 'Auditoria',    icone: '🔍', desc: 'Logs e rastreamento de ações' },
      { id: 'lixeira',     nome: 'Lixeira',      icone: '🗑️', desc: 'Restaurar itens excluídos' },
      { id: 'integridade', nome: 'Integridade',  icone: '🛡️', desc: 'Verificar consistência dos dados' },
      { id: 'homologacao', nome: 'Homologação',  icone: '🧪', desc: 'Auditoria completa de integrações' },
      { id: 'config',      nome: 'Configurações',icone: '⚙️', desc: 'Configurações do sistema' },
    ]},
  ];

  /* Todos os módulos em lista plana (para busca rápida de ícone/desc) */
  const TODOS_MODULOS = CATEGORIAS.flatMap(c => c.modulos);

  /* ── Items do drawer lateral ────────────────────────────── */
  const DRAWER_ITEMS = [
    { href: '/CRM/pages/os/index.html',               icon: '📦', label: 'Ordem de Serviço' },
    { href: '/CRM/pages/caixa/index.html',            icon: '💰', label: 'Caixa' },
    { href: '/CRM/pages/central-comandos/index.html', icon: '⚡', label: 'Central de Comandos', badge: 'Novo' },
    { href: '/CRM/pages/financeiro/index.html',       icon: '💹', label: 'Financeiro' },
    { href: '/CRM/pages/despesas/index.html',         icon: '💸', label: 'Despesas' },
    { href: '/CRM/pages/crm-comercial/index.html',    icon: '🎯', label: 'CRM Comercial', badge: 'Novo' },
    { href: '/CRM/pages/clientes/index.html',         icon: '👥', label: 'Clientes' },
    { href: '/CRM/pages/estoque/index.html',          icon: '📱', label: 'Estoque' },
    { href: '/CRM/pages/compras/index.html',          icon: '🛒', label: 'Compras', badge: 'Novo' },
    { href: '/CRM/pages/fornecedor/index.html',       icon: '🏭', label: 'Fornecedor' },
    { href: '/CRM/pages/pendencias/index.html',       icon: '📋', label: 'Pendências e Contas', badge: 'Novo' },
    { href: '/CRM/pages/pos-venda/index.html',        icon: '💝', label: 'Pós-venda' },
    { href: '/CRM/pages/garantias/index.html',        icon: '🛡️', label: 'Garantias' },
    { href: '/CRM/pages/relatorios/index.html',       icon: '📊', label: 'Relatórios' },
    { href: '/CRM/pages/acaodasemana/index.html',     icon: '📅', label: 'Agenda' },
    { href: '/CRM/pages/portal-tecnico/index.html',   icon: '🔓', label: 'Portal Técnico' },
    { href: '/CRM/pages/central-organizacao/index.html', icon: '🔧', label: 'Central de Automação' },
    { href: '/CRM/pages/portal-cliente/admin.html',   icon: '🔷', label: 'Portal do Cliente' },
    { href: '/CRM/pages/config/index.html',           icon: '⚙️', label: 'Configurações' },
  ];

  /* ── Helpers ─────────────────────────────────────────────── */
  function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || 'null'); } catch { return null; }
  }
  function getView() {
    return localStorage.getItem(VIEW_KEY) || 'lista';
  }
  function setView(v) {
    localStorage.setItem(VIEW_KEY, v);
  }
  function navigate(id) {
    if (window.__cmNavigate) window.__cmNavigate(id);
  }
  function isMobileNow() {
    return window.innerWidth <= MOBILE_BP;
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* ── Botão hambúrguer ────────────────────────────────────── */
  function buildHamburger() {
    if (document.getElementById('mob-menu-btn')) return;
    const topLeft = document.querySelector('.top-meta-left');
    if (!topLeft) return;
    const btn = document.createElement('button');
    btn.id = 'mob-menu-btn';
    btn.innerHTML = '☰';
    btn.title = 'Menu';
    btn.setAttribute('aria-label', 'Abrir menu lateral');
    btn.addEventListener('click', openDrawer);
    topLeft.prepend(btn);
  }

  /* ── Barra de controle Lista/Grade ──────────────────────── */
  function buildCtrlBar() {
    if (document.getElementById('mob-ctrl-bar')) return;
    const main = document.querySelector('.main-content');
    if (!main) return;

    const bar = document.createElement('div');
    bar.id = 'mob-ctrl-bar';
    bar.innerHTML = `
      <div id="mob-ctrl-left">
        <button class="mob-view-btn" id="mob-btn-lista" data-view="lista">☰ Lista</button>
        <button class="mob-view-btn" id="mob-btn-grade" data-view="grade">☷ Grade</button>
      </div>
      <div id="mob-ctrl-right"></div>`;
    main.prepend(bar);

    bar.querySelectorAll('.mob-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.view;
        setView(v);
        applyView(v);
      });
    });

    applyView(getView());
  }

  function applyView(v) {
    const container = document.getElementById('mob-modules');
    if (!container) return;
    container.classList.toggle('view-lista', v === 'lista');
    container.classList.toggle('view-grade', v === 'grade');
    const btnLista = document.getElementById('mob-btn-lista');
    const btnGrade = document.getElementById('mob-btn-grade');
    if (btnLista) btnLista.classList.toggle('ativo', v === 'lista');
    if (btnGrade) btnGrade.classList.toggle('ativo', v === 'grade');
  }

  /* ── Drawer sidebar ──────────────────────────────────────── */
  function buildDrawer() {
    if (document.getElementById('mob-drawer')) return;

    const overlay = document.createElement('div');
    overlay.id = 'mob-overlay';
    overlay.addEventListener('click', closeDrawer);
    document.body.appendChild(overlay);

    const drawer = document.createElement('div');
    drawer.id = 'mob-drawer';
    drawer.setAttribute('aria-label', 'Menu de navegação');
    drawer.innerHTML = `
      <div class="mob-drawer-header">
        <img class="mob-drawer-logo" src="/CRM/assets/logo.svg" alt="Cell City" draggable="false"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
        <span style="display:none;font-size:15px;font-weight:700;color:#f5f7fa;">📱 Cell City</span>
        <button id="mob-drawer-close" aria-label="Fechar menu">✕</button>
      </div>
      <nav class="mob-drawer-nav">
        ${DRAWER_ITEMS.map(item => `
          <a class="mob-drawer-item" href="${esc(item.href)}">
            <span class="mob-di-icon">${item.icon}</span>
            <span class="mob-di-label">${esc(item.label)}</span>
            ${item.badge ? `<span class="mob-di-badge">${esc(item.badge)}</span>` : ''}
          </a>`).join('')}
      </nav>`;

    document.body.appendChild(drawer);
    document.getElementById('mob-drawer-close').addEventListener('click', closeDrawer);
  }

  function openDrawer() {
    document.getElementById('mob-overlay')?.classList.add('open');
    document.getElementById('mob-drawer')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    document.getElementById('mob-overlay')?.classList.remove('open');
    document.getElementById('mob-drawer')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Container de módulos mobile ─────────────────────────── */
  function buildMobileModules() {
    if (document.getElementById('mob-modules')) return;
    const main = document.querySelector('.main-content');
    if (!main) return;

    const container = document.createElement('div');
    container.id = 'mob-modules';
    main.appendChild(container);

    renderMobileModules();

    /* Atualiza quando favoritos ou ordem mudam */
    window.addEventListener('cc-modulos-changed', renderMobileModules);
    window.addEventListener('cc-mod-order-changed', renderMobileModules);
  }

  /* ── Renderiza toda a lista mobile ──────────────────────── */
  function renderMobileModules() {
    const container = document.getElementById('mob-modules');
    if (!container) return;

    const favs = getFavs(); // null = todos | array = selecionados

    /* ── Seção FAVORITOS ── */
    let favHtml = '';
    const favIds = favs && favs.length > 0 ? favs : [];

    // Coleta módulos favoritos e ordena pela ordem salva
    let favModulos = [];
    TODOS_MODULOS.forEach(mod => {
      if (favIds.includes(mod.id)) favModulos.push(mod);
    });
    if (window.CCModOrder) favModulos = window.CCModOrder.sort(favModulos, m => m.id);

    if (favModulos.length > 0) {
      favHtml = favModulos.map(mod => renderItem(mod)).join('');
    } else {
      favHtml = `<div class="mob-fav-empty">
        ⭐ Use a Central de Módulos para adicionar favoritos
      </div>`;
    }

    /* ── Seção TODOS OS MÓDULOS (por categoria, accordion) ── */
    const catsHtml = CATEGORIAS.map((cat, idx) => {
      const collapsed = idx >= 2 ? 'collapsed' : '';
      const ordered = window.CCModOrder
        ? window.CCModOrder.sort(cat.modulos, m => m.id)
        : cat.modulos;
      return `
        <div class="mob-cat-section">
          <div class="mob-cat-header ${collapsed}" data-cat="${esc(cat.id)}">
            <span class="mob-cat-label">${cat.label}</span>
            <div class="mob-cat-right">
              <span class="mob-cat-count">${cat.modulos.length}</span>
              <span class="mob-cat-arrow">▼</span>
            </div>
          </div>
          <div class="mob-cat-body ${collapsed}">
            ${ordered.map(mod => renderItem(mod)).join('')}
          </div>
        </div>`;
    }).join('');

    /* ── Monta HTML final ── */
    container.innerHTML = `
      <div class="mob-section-header">
        <span class="mob-section-title">⭐ Módulos Favoritos</span>
      </div>
      <div class="mob-fav-section" id="mob-mods-fav-wrap">
        ${favHtml}
      </div>

      <div class="mob-section-header mob-todos-header">
        <span class="mob-section-title">📚 Todos os Módulos</span>
      </div>
      <div class="mob-cats-container">
        ${catsHtml}
      </div>`;

    /* ── Bind cliques nos módulos ── */
    container.querySelectorAll('[data-mob-id]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.mobId));
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(el.dataset.mobId);
        }
      });
    });

    /* ── Accordion das categorias ── */
    container.querySelectorAll('.mob-cat-header').forEach(h => {
      h.addEventListener('click', () => {
        const body = h.nextElementSibling;
        if (!body) return;
        const isCollapsed = h.classList.contains('collapsed');
        h.classList.toggle('collapsed', !isCollapsed);
        body.classList.toggle('collapsed', !isCollapsed);
      });
    });

    /* Aplica view atual */
    applyView(getView());

    /* Ativa drag por alça (precisa de CCModOrder do modules-order.js) */
    if (window.CCModOrder && window.CCModOrder.setupTouchDrag) {
      window.CCModOrder.setupTouchDrag(container);
    }
  }

  /* ── Gera HTML de um item de módulo ─────────────────────── */
  function renderItem(mod) {
    const isOs = mod.id === 'os';
    return `<div
      class="mob-item${isOs ? ' mob-item-os' : ''}"
      data-mob-id="${esc(mod.id)}"
      role="button"
      tabindex="0"
      aria-label="${esc(mod.nome)}">
      <button class="mob-drag-handle" title="Arrastar para reordenar" aria-label="Reordenar" tabindex="-1">⠿</button>
      <div class="mob-item-icon">${mod.icone}</div>
      <div class="mob-item-info">
        <div class="mob-item-nome">${esc(mod.nome)}</div>
        <div class="mob-item-desc">${esc(mod.desc || '')}</div>
      </div>
    </div>`;
  }

  /* ── Inicialização ───────────────────────────────────────── */
  let _iniciado = false;

  function init() {
    if (!isMobileNow()) return;
    if (_iniciado) return;
    _iniciado = true;

    buildHamburger();
    buildCtrlBar();
    buildDrawer();
    buildMobileModules();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Fecha drawer com swipe (simplificado) */
  let _touchX = 0;
  document.addEventListener('touchstart', e => { _touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _touchX;
    const drawer = document.getElementById('mob-drawer');
    if (drawer && drawer.classList.contains('open') && dx < -60) closeDrawer();
  }, { passive: true });

})();
