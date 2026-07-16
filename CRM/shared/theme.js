/* ==========================================================================
   CELL CITY CRM — THEME MANAGER v1.0 (P2.4)
   ==========================================================================
   Aplica o tema do Design System sem flash: incluir de forma SÍNCRONA no
   <head>, logo após o design-system.css:
     <script src="../../shared/theme.js"></script>

   Temas: 'dark' (padrão do CRM), 'light', 'auto' (segue o SO).
   O tema escolhido persiste em localStorage ('cc_theme').

   API global:
     CCTheme.get()        → tema atual ('dark' | 'light' | 'auto')
     CCTheme.set(tema)    → aplica e persiste
     CCTheme.cycle()      → alterna dark → light → auto → dark
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'cc_theme';
  var VALID = ['dark', 'light', 'auto'];
  var DEFAULT_THEME = 'dark'; // comportamento histórico do CRM

  function read() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return VALID.indexOf(v) !== -1 ? v : DEFAULT_THEME;
    } catch (e) {
      return DEFAULT_THEME;
    }
  }

  function apply(theme) {
    // 'dark' é o :root padrão do design-system.css; só os demais precisam
    // do atributo, mas mantê-lo sempre facilita depuração e CSS por tema.
    document.documentElement.setAttribute('data-theme', theme);
  }

  function set(theme) {
    if (VALID.indexOf(theme) === -1) theme = DEFAULT_THEME;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* modo privado */ }
    apply(theme);
    return theme;
  }

  function get() {
    return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
  }

  function cycle() {
    var next = VALID[(VALID.indexOf(get()) + 1) % VALID.length];
    return set(next);
  }

  // Aplicação imediata (script síncrono no <head> ⇒ sem flash)
  apply(read());

  window.CCTheme = { get: get, set: set, cycle: cycle, _valid: VALID.slice() };
})();
