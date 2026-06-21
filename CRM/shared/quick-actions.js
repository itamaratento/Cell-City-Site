/* ============================================================
   QUICK ACTIONS — Cell City Gestão Empresarial
   Barra de ações rápidas configurável por módulo.

   Uso com preset de módulo:
     <div data-qa="despesas"></div>

   Uso com config inline (JSON):
     <div data-qa-custom='[
       {"icon":"➕","label":"Nova","primary":true,"trigger":"#btn"},
       {"icon":"📤","label":"Exportar","fn":"minhaFuncao"}
     ]'></div>

   Tipos de ação por botão:
     trigger — clica no elemento pelo seletor CSS (string)
     fn       — chama window[fn](...args)
     href     — navega para URL

   API pública:
     window.CcQuickActions.register('key', [...])  — adiciona/sobrescreve preset
     window.CcQuickActions.render(hostEl, 'key')   — renderiza manualmente

   Include:
     <script src="../../shared/quick-actions.js"></script>
   ============================================================ */
(function () {
  'use strict';

  /* ── Presets por módulo ─────────────────────────────────────── */
  var PRESETS = {
    despesas: [
      { icon: '➕', label: 'Nova Despesa',    primary: true, trigger: '#dsp-btn-novo' },
      { icon: '📤', label: 'Exportar',         fn: 'exportarDespesas' },
      { icon: '📊', label: 'Relatórios',       fn: 'dspNavegar', args: ['resumo'] },
      { icon: '🏷️', label: 'Categorias',       fn: 'dspNavegar', args: ['categorias'] },
      { icon: '🏢', label: 'Centros de Custo', fn: 'dspNavegar', args: ['centros'] },
    ],
    compras: [
      { icon: '➕', label: 'Nova Compra',      primary: true, trigger: '#cmp-btn-novo' },
      { icon: '📊', label: 'Resumo',           fn: 'cmpNavegar', args: ['resumo'] },
      { icon: '📤', label: 'Exportar',         fn: 'exportarCompras' },
    ],
    financeiro: [
      { icon: '💸', label: 'Despesas',         href: '/CRM/pages/despesas/' },
      { icon: '🛒', label: 'Compras',          href: '/CRM/pages/compras/' },
      { icon: '🏭', label: 'Fornecedores',     href: '/CRM/pages/fornecedor/' },
      { icon: '🔒', label: 'Fechamento',       href: '/CRM/pages/fechamento/' },
    ],
    'crm-comercial': [
      { icon: '➕', label: 'Novo Cliente',     primary: true, fn: 'crmNavegar', args: ['nova-entrada'] },
      { icon: '📞', label: 'Contatos',         fn: 'crmNavegar', args: ['contatos'] },
      { icon: '📋', label: 'Funil',            fn: 'crmNavegar', args: ['funil'] },
      { icon: '📊', label: 'Relatórios',       fn: 'crmNavegar', args: ['relatorios'] },
    ],
    os: [
      { icon: '➕', label: 'Nova OS',          primary: true, trigger: '#btn-nova-os' },
      { icon: '📦', label: 'Equipamentos',     fn: 'osNavegar', args: ['equipamentos'] },
      { icon: '📄', label: 'Garantias',        href: '/CRM/pages/garantias/' },
      { icon: '📊', label: 'Relatórios',       href: '/CRM/pages/relatorios/' },
    ],
    estoque: [
      { icon: '➕', label: 'Produto',          primary: true, trigger: '#btn-novo-produto' },
      { icon: '📦', label: 'Estoque',          fn: 'estNavegar', args: ['lista'] },
      { icon: '🏷️', label: 'Categorias',       fn: 'estNavegar', args: ['categorias'] },
      { icon: '📊', label: 'Relatórios',       fn: 'estNavegar', args: ['relatorios'] },
    ],
  };

  /* ── CSS embutido ───────────────────────────────────────────── */
  var CSS = [
    '.cc-qa{',
      'display:flex;align-items:center;gap:8px;flex-wrap:wrap;',
      'padding:10px 14px;',
      'background:var(--bg-surface,#121418);',
      'border:1px solid var(--border,rgba(255,255,255,0.08));',
      'border-radius:var(--radius,10px);',
      'margin-bottom:20px;',
    '}',
    '.cc-qa-btn{',
      'display:inline-flex;align-items:center;gap:6px;',
      'padding:7px 14px;',
      'border-radius:var(--radius-sm,8px);',
      'border:1px solid rgba(255,255,255,0.08);',
      'background:rgba(255,255,255,0.04);',
      'color:var(--text-secondary,#9ca3af);',
      'font-size:12.5px;font-weight:600;font-family:inherit;',
      'transition:background .15s,border-color .15s,color .15s,transform .1s;',
      'white-space:nowrap;cursor:pointer;',
      'text-decoration:none;line-height:1;',
    '}',
    '.cc-qa-btn:hover{',
      'background:rgba(0,200,83,0.08);',
      'border-color:rgba(0,200,83,0.35);',
      'color:var(--cell-green,#00c853);',
      'transform:translateY(-1px);',
    '}',
    '.cc-qa-btn:active{transform:translateY(0);}',
    '.cc-qa-btn.cc-qa-primary{',
      'background:var(--cell-green,#00c853)!important;',
      'border-color:var(--cell-green,#00c853)!important;',
      'color:#000!important;',
    '}',
    '.cc-qa-btn.cc-qa-primary:hover{',
      'background:var(--cell-green-light,#00e676)!important;',
      'border-color:var(--cell-green-light,#00e676)!important;',
      'color:#000!important;transform:translateY(-1px);',
    '}',
    '.cc-qa-ico{font-size:14px;line-height:1;flex-shrink:0;}',
    '.cc-qa-lbl{letter-spacing:.01em;}',
    '@media(max-width:700px){',
      '.cc-qa{gap:6px;padding:8px 10px;}',
      '.cc-qa-btn{padding:8px 10px;font-size:12px;}',
      '.cc-qa-lbl{display:none;}',
      '.cc-qa-ico{font-size:16px;}',
      '.cc-qa-btn.cc-qa-primary .cc-qa-lbl{display:inline;}',
      '.cc-qa-btn.cc-qa-primary{padding:7px 12px;}',
    '}',
  ].join('');

  function injectStyles() {
    if (document.getElementById('cc-qa-style')) return;
    var s = document.createElement('style');
    s.id = 'cc-qa-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function executeAction(action) {
    if (action.trigger) {
      var el = document.querySelector(action.trigger);
      if (el) { el.click(); return; }
    }
    if (action.href) {
      window.location.href = action.href;
      return;
    }
    if (action.fn) {
      var fn = window[action.fn];
      if (typeof fn === 'function') {
        fn.apply(null, action.args || []);
      } else {
        console.warn('[cc-qa] Função não encontrada no window:', action.fn);
      }
    }
  }

  function buildBar(actions) {
    var wrap = document.createElement('div');
    wrap.className = 'cc-qa';

    actions.forEach(function (action) {
      var btn = document.createElement('button');
      btn.className = 'cc-qa-btn' + (action.primary ? ' cc-qa-primary' : '');
      btn.title = action.label;
      btn.type = 'button';

      var ico = document.createElement('span');
      ico.className = 'cc-qa-ico';
      ico.textContent = action.icon;
      ico.setAttribute('aria-hidden', 'true');

      var lbl = document.createElement('span');
      lbl.className = 'cc-qa-lbl';
      lbl.textContent = action.label;

      btn.appendChild(ico);
      btn.appendChild(lbl);
      btn.addEventListener('click', function () { executeAction(action); });
      wrap.appendChild(btn);
    });

    return wrap;
  }

  function init() {
    injectStyles();

    /* Preset: <div data-qa="despesas"></div> */
    document.querySelectorAll('[data-qa]').forEach(function (host) {
      var key = host.getAttribute('data-qa');
      if (!key) return;
      var actions = PRESETS[key];
      if (!actions) {
        console.warn('[cc-qa] Preset não encontrado:', key);
        return;
      }
      host.appendChild(buildBar(actions));
    });

    /* Inline: <div data-qa-custom='[...]'></div> */
    document.querySelectorAll('[data-qa-custom]').forEach(function (host) {
      var actions;
      try { actions = JSON.parse(host.getAttribute('data-qa-custom')); }
      catch (e) { console.warn('[cc-qa] JSON inválido em data-qa-custom'); return; }
      if (!Array.isArray(actions) || !actions.length) return;
      host.appendChild(buildBar(actions));
    });
  }

  /* ── API pública ────────────────────────────────────────────── */
  window.CcQuickActions = {
    register: function (key, actions) { PRESETS[key] = actions; },
    render:   function (host, key) {
      injectStyles();
      var actions = PRESETS[key];
      if (actions) host.appendChild(buildBar(actions));
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
