/* ============================================================
   BARRA DE FAVORITOS — Cell City CRM
   ------------------------------------------------------------
   • Dashboard  → barra horizontal logo abaixo do cabeçalho.
   • Demais módulos → botão flutuante "📌 Fixar nos Favoritos"
     no topo da página, com lista de acesso rápido.
   • Armazenamento: Firestore `favoritos_usuarios/{uid}` (fonte da
     verdade) + onSnapshot (tempo real entre dispositivos).
     localStorage é usado APENAS como cache de pintura rápida/offline.

   Carregado automaticamente em todas as páginas que importam
   shared/dock.js, e diretamente no Dashboard via <script>.
   ============================================================ */

import { devPrefix, STORAGE_KEYS } from './app-config.js';
import { db, doc, setDoc, onSnapshot, serverTimestamp } from '../scripts/firebase.js';
import { initModulo } from '../scripts/kernel.js';
import { escHtml as esc } from './sanitize.js';

// Mesma detecção de ambiente usada em shared/brand-header.js — evita
// que favoritos/atalhos gravados com URL absoluta (ex.: OS_VIEWS)
// levem o usuário de volta para a MAIN quando ele está na DEVELOP.
function envUrl(url) {
  if (!url || typeof url !== 'string' || url.charAt(0) !== '/') return url;
  const prefix = devPrefix();
  const alreadyDev = url === '/dev' || url.startsWith('/dev/');
  return (prefix && !alreadyDev) ? prefix + url : url;
}

let _uid = null;

const STORAGE_KEY = STORAGE_KEYS.FAVORITOS;            // cache local (pintura rápida)
const isDashboard = window.location.pathname.includes('/dashboard/');

/* Estado em memória — sincronizado com o Firestore em tempo real. */
let _favs = [];
let _unsub = null;       // cancela o onSnapshot anterior ao trocar de uid
let _applyingRemote = false;

/* Registro dos módulos conhecidos — usado só para enfeitar
   ícone/rótulo ao fixar. A navegação usa a URL salva. */
const MODULES = {
  'os':                  { icon: '📦', label: 'Ordem de Serviço' },
  'caixa':               { icon: '💰', label: 'Caixa' },
  'central-alertas':     { icon: '🔔', label: 'Central de Alertas' },
  'acaodasemana':        { icon: '📅', label: 'Ação da Semana' },
  'minha-semana':        { icon: '📋', label: 'Minha Semana' },
  'pos-venda':           { icon: '💝', label: 'Pós-venda' },
  'clientes':            { icon: '👥', label: 'Clientes' },
  'analise':             { icon: '📊', label: 'Análise' },
  'fornecedor':          { icon: '🏭', label: 'Fornecedor' },
  'financeiro':          { icon: '💹', label: 'Financeiro' },
  'campanhas':           { icon: '📣', label: 'Campanhas' },
  'estoque':             { icon: '📱', label: 'Estoque' },
  'autoatendimento':     { icon: '🤖', label: 'Autoatendimento' },
  'central-informacoes':  { icon: '📚', label: 'Central de Informações' },
  'central-comandos':    { icon: '⚡', label: 'Central de Comandos' },
  'central-organizacao': { icon: '⚡', label: 'Central Automação' },
  'portal-tecnico':      { icon: '🔓', label: 'Portal Técnico' },
  'importar':            { icon: '📥', label: 'Importar' },
  'config':             { icon: '⚙️', label: 'Configurações' },
  'catalogo':           { icon: '🛍️', label: 'Catálogo' },
  'crm-comercial':      { icon: '🎯', label: 'CRM Comercial' },
  'compras':            { icon: '🛒', label: 'Compras' },
  'auditoria':          { icon: '🔍', label: 'Auditoria' },
  'relatorios':         { icon: '📊', label: 'Relatórios' },
  'contas':             { icon: '📇', label: 'Contas & Números' },
  'diario':             { icon: '📔', label: 'Diário' },
  'chat':               { icon: '💬', label: 'Chat' },
  'usuarios-permissoes': { icon: '🔐', label: 'Usuários e Permissões' },
  'portal-cliente':     { icon: '🔷', label: 'Portal do Cliente' }
};

/* Views fixáveis do módulo OS (piloto) — abrem via deep-link (#fav-...) que o
   os/index.html interpreta chamando as funções globais já existentes. */
const OS_VIEWS = [
  { key: 'os-andamento',   icon: '📦', label: 'OS em Andamento', url: '/CRM/pages/os/index.html#fav-andamento' },
  { key: 'os-finalizados', icon: '✅', label: 'OS Finalizados',  url: '/CRM/pages/os/index.html#fav-finalizados' },
  { key: 'os-clientes',    icon: '👥', label: 'Clientes (OS)',   url: '/CRM/pages/os/index.html#fav-clientes' },
];

/* ---------- Armazenamento (Firestore + cache local) ---------- */
function sanitize(arr) {
  return Array.isArray(arr) ? arr.filter(f => f && f.key && f.url) : [];
}

function favDocRef() {
  return doc(db, 'favoritos_usuarios', _uid);
}

/* Lê o estado atual (memória, com fallback no cache local p/ 1ª pintura). */
function loadFavoritos() {
  if (_favs.length) return _favs.slice();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return sanitize(raw ? JSON.parse(raw) : []);
  } catch { return []; }
}

/* Grava: memória + cache local + Firestore (fonte da verdade). */
function saveFavoritos(list) {
  _favs = sanitize(list);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_favs)); } catch {}
  // Avisa esta aba para re-renderizar imediatamente (UX otimista)
  window.dispatchEvent(new CustomEvent('cc-favoritos-changed'));
  // Persiste no Firestore — propaga para os demais dispositivos via onSnapshot
  if (!_applyingRemote) {
    setDoc(favDocRef(), { itens: _favs, atualizadoEm: serverTimestamp() })
      .catch(e => console.warn('⚠️ Falha ao salvar favoritos no Firestore:', e));
  }
}

/* Assina o documento do usuário e mantém o estado em tempo real. */
function subscribeFavoritos() {
  if (_unsub) { _unsub(); _unsub = null; }
  _unsub = onSnapshot(favDocRef(), (snap) => {
    // Migração 1ª vez: doc ainda não existe, mas há favoritos no cache local
    // → sobe para o Firestore em vez de descartá-los.
    if (!snap.exists()) {
      let local = [];
      try { local = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch {}
      if (local.length) { saveFavoritos(local); return; }
    }
    const itens = snap.exists() ? sanitize(snap.data().itens) : [];
    _favs = itens;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_favs)); } catch {}
    _applyingRemote = true;
    window.dispatchEvent(new CustomEvent('cc-favoritos-changed'));
    _applyingRemote = false;
  }, (e) => console.warn('⚠️ onSnapshot favoritos:', e));
}

function isFavorito(key) {
  return loadFavoritos().some(f => f.key === key);
}

function addFavorito(fav) {
  const list = loadFavoritos();
  if (list.some(f => f.key === fav.key)) return;
  list.push(fav);
  saveFavoritos(list);
}

function removeFavorito(key) {
  saveFavoritos(loadFavoritos().filter(f => f.key !== key));
}

/* ---------- Identifica o módulo da página atual ---------- */
function getCurrentModule() {
  // Override opcional: uma página (ex.: subpágina de módulo) pode declarar
  // sua própria identidade de favorito via atributos data-fav-* no <html>.
  // Mantém compatibilidade total — só age quando os atributos existem.
  const root = document.documentElement;
  const ovKey = root.getAttribute('data-fav-key');
  if (ovKey) {
    let ovLabel = root.getAttribute('data-fav-label');
    if (!ovLabel) ovLabel = (document.title || '').split(/[—|–\-]/)[0].trim() || ovKey;
    return {
      key: ovKey,
      label: ovLabel,
      icon: root.getAttribute('data-fav-icon') || '📌',
      url: root.getAttribute('data-fav-url') || window.location.pathname
    };
  }

  const path = window.location.pathname;            // ex.: /CRM/pages/os/index.html
  const m = path.match(/\/pages\/([^/]+)\//);
  if (!m) return null;
  const key = m[1];
  if (key === 'dashboard') return null;
  const meta = MODULES[key] || {};
  // Rótulo: registro > título do documento > nome da pasta
  let label = meta.label;
  if (!label) {
    label = (document.title || '').split(/[—|–\-]/)[0].trim() || key;
  }
  return {
    key,
    label,
    icon: meta.icon || '📌',
    url: path                                        // URL absoluta da própria página
  };
}

/* ---------- CSS (injetado uma única vez) ---------- */
function injectStyles() {
  if (document.getElementById('ccfav-styles')) return;
  const css = `
  .ccfav-bar{display:flex;align-items:center;gap:8px;padding:8px 18px;
    background:#0f1115;border-bottom:1px solid rgba(255,255,255,.06);
    font-family:'Inter',system-ui,sans-serif;}
  .ccfav-bar .ccfav-pin-emoji{flex:0 0 auto;color:#6b7280;font-size:13px;}
  .ccfav-scroll{display:flex;align-items:center;gap:8px;overflow-x:auto;
    scroll-behavior:smooth;scrollbar-width:none;flex:1 1 auto;}
  .ccfav-scroll::-webkit-scrollbar{display:none;}
  .ccfav-chip{display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;
    padding:6px 11px;border-radius:8px;cursor:pointer;user-select:none;
    background:#1a1d23;border:1px solid rgba(255,255,255,.08);
    color:#f5f7fa;font-size:12.5px;font-weight:500;white-space:nowrap;
    transition:background .15s,border-color .15s,transform .12s;}
  .ccfav-chip:hover{background:#22262e;border-color:#00c853;color:#00e676;}
  .ccfav-chip.dragging{opacity:.5;}
  .ccfav-chip.drag-over{border-color:#00c853;}
  .ccfav-chip .ccfav-ico{font-size:14px;line-height:1;}
  .ccfav-chip .ccfav-x{margin-left:2px;color:#6b7280;font-size:13px;
    line-height:1;padding:1px 3px;border-radius:4px;}
  .ccfav-chip .ccfav-x:hover{background:rgba(255,80,80,.18);color:#ff6b6b;}
  .ccfav-empty{color:#6b7280;font-size:12.5px;font-style:italic;}
  .ccfav-arrow{flex:0 0 auto;width:26px;height:26px;border-radius:6px;cursor:pointer;
    background:#1a1d23;border:1px solid rgba(255,255,255,.08);color:#a1a8b3;
    font-size:14px;display:none;align-items:center;justify-content:center;}
  .ccfav-arrow:hover{color:#00e676;border-color:#00c853;}
  .ccfav-arrow.show{display:inline-flex;}

  /* Lançador (páginas de módulo) — integrado no brand-bar à direita do espaçador */
  .ccfav-launcher{position:relative;display:flex;gap:6px;align-items:center;
    flex:0 0 auto;font-family:'Inter',system-ui,sans-serif;}
  .ccfav-launcher.ccfav-floating{position:fixed;top:10px;right:14px;z-index:10000;align-items:flex-start;}
  /* Mobile: esconde o texto do botão, mantém só o ícone ⭐ */
  @media(max-width:600px){
    .ccfav-pin-label{display:none;}
    .ccfav-pin-btn{padding:7px 9px;min-width:34px;justify-content:center;}
  }
  .ccfav-pin-btn{display:inline-flex;align-items:center;gap:6px;cursor:pointer;
    padding:7px 12px;border-radius:9px;font-size:12.5px;font-weight:600;
    background:#1a1d23;border:1px solid rgba(255,255,255,.10);color:#f5f7fa;
    box-shadow:0 4px 14px rgba(0,0,0,.35);transition:all .15s;}
  .ccfav-pin-btn:hover{border-color:#00c853;color:#00e676;}
  .ccfav-pin-btn.active{background:rgba(0,200,83,.14);border-color:#00c853;color:#00e676;}
  .ccfav-menu-btn{display:inline-flex;align-items:center;justify-content:center;cursor:pointer;
    width:34px;height:34px;border-radius:9px;font-size:14px;
    background:#1a1d23;border:1px solid rgba(255,255,255,.10);color:#a1a8b3;
    box-shadow:0 4px 14px rgba(0,0,0,.35);transition:all .15s;}
  .ccfav-menu-btn:hover{border-color:#00c853;color:#00e676;}
  .ccfav-dropdown{position:absolute;top:42px;right:0;min-width:210px;max-height:60vh;
    overflow-y:auto;background:#121418;border:1px solid rgba(255,255,255,.10);
    border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5);padding:6px;display:none;}
  .ccfav-dropdown.open{display:block;}
  .ccfav-dd-title{color:#6b7280;font-size:11px;text-transform:uppercase;
    letter-spacing:.5px;padding:6px 8px 4px;}
  .ccfav-dd-item{display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:7px;
    cursor:pointer;color:#f5f7fa;font-size:13px;}
  .ccfav-dd-item:hover{background:#22262e;color:#00e676;}
  .ccfav-dd-item .ccfav-x{margin-left:auto;color:#6b7280;font-size:13px;padding:1px 4px;border-radius:4px;}
  .ccfav-dd-item .ccfav-x:hover{background:rgba(255,80,80,.18);color:#ff6b6b;}
  .ccfav-dd-empty{color:#6b7280;font-size:12.5px;padding:10px 9px;font-style:italic;}
  .ccfav-dd-pin{margin-left:auto;cursor:pointer;font-size:13px;color:#6b7280;
    padding:2px 7px;border-radius:6px;border:1px solid rgba(255,255,255,.10);line-height:1.4;}
  .ccfav-dd-pin:hover{color:#00e676;border-color:#00c853;}
  .ccfav-dd-pin.on{color:#00e676;border-color:rgba(0,200,83,.5);background:rgba(0,200,83,.12);}
  .ccfav-dd-sep{height:1px;background:rgba(255,255,255,.08);margin:6px 4px;}
  `;
  const style = document.createElement('style');
  style.id = 'ccfav-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

/* ---------- Drag & drop (reordenar) ---------- */
function attachDragReorder(scrollEl) {
  let dragKey = null;

  scrollEl.querySelectorAll('.ccfav-chip').forEach(chip => {
    chip.setAttribute('draggable', 'true');

    chip.addEventListener('dragstart', (e) => {
      dragKey = chip.dataset.key;
      chip.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    chip.addEventListener('dragend', () => {
      dragKey = null;
      chip.classList.remove('dragging');
      scrollEl.querySelectorAll('.ccfav-chip').forEach(c => c.classList.remove('drag-over'));
    });
    chip.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (chip.dataset.key !== dragKey) chip.classList.add('drag-over');
    });
    chip.addEventListener('dragleave', () => chip.classList.remove('drag-over'));
    chip.addEventListener('drop', (e) => {
      e.preventDefault();
      chip.classList.remove('drag-over');
      const targetKey = chip.dataset.key;
      if (!dragKey || dragKey === targetKey) return;
      const list = loadFavoritos();
      const from = list.findIndex(f => f.key === dragKey);
      const to   = list.findIndex(f => f.key === targetKey);
      if (from < 0 || to < 0) return;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      saveFavoritos(list);
    });
  });
}

function navigate(url) { window.location.href = envUrl(url); }

/* ============================================================
   DASHBOARD — barra horizontal abaixo do cabeçalho
   ============================================================ */
function renderDashboardBar() {
  let bar = document.getElementById('ccfav-bar');
  const scroll = bar ? bar.querySelector('.ccfav-scroll') : null;
  const favs = loadFavoritos();

  // Cria a estrutura uma única vez
  if (!bar) {
    bar = document.createElement('nav');
    bar.id = 'ccfav-bar';
    bar.className = 'ccfav-bar';
    bar.innerHTML = `
      <span class="ccfav-pin-emoji" title="Favoritos">📌</span>
      <button class="ccfav-arrow" data-dir="-1" aria-label="Rolar para a esquerda">◀</button>
      <div class="ccfav-scroll"></div>
      <button class="ccfav-arrow" data-dir="1" aria-label="Rolar para a direita">▶</button>`;
    const header = document.querySelector('.top-bar');
    if (header && header.parentNode) header.parentNode.insertBefore(bar, header.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);

    const sc = bar.querySelector('.ccfav-scroll');
    bar.querySelectorAll('.ccfav-arrow').forEach(a => {
      a.addEventListener('click', () => sc.scrollBy({ left: 220 * Number(a.dataset.dir), behavior: 'smooth' }));
    });
    sc.addEventListener('scroll', () => updateArrows(bar));
    window.addEventListener('resize', () => updateArrows(bar));
  }

  const sc = bar.querySelector('.ccfav-scroll');
  sc.innerHTML = '';

  if (favs.length === 0) {
    const hint = document.createElement('span');
    hint.className = 'ccfav-empty';
    hint.textContent = 'Nenhum favorito ainda — abra um módulo e clique em "📌 Fixar nos Favoritos".';
    sc.appendChild(hint);
  } else {
    favs.forEach(fav => sc.appendChild(buildChip(fav)));
    attachDragReorder(sc);
  }

  // Chip "▶ Continuar" — lê STORAGE_KEYS.ULTIMA_TELA (app-config.js)
  try {
    const ultima = JSON.parse(localStorage.getItem(STORAGE_KEYS.ULTIMA_TELA) || 'null');
    if (ultima && ultima.url) {
      const chip = document.createElement('div');
      chip.className = 'ccfav-chip';
      chip.title = 'Continuar de onde parei: ' + (ultima.label || ultima.url);
      chip.innerHTML = '<span class="ccfav-ico">▶</span><span class="ccfav-txt">Continuar</span>';
      chip.addEventListener('click', () => { window.location.href = envUrl(ultima.url); });
      sc.appendChild(chip);
    }
  } catch (e) { /* localStorage indisponível */ }

  updateArrows(bar);
}

function buildChip(fav) {
  const chip = document.createElement('div');
  chip.className = 'ccfav-chip';
  chip.dataset.key = fav.key;
  chip.title = fav.label;
  chip.innerHTML = `<span class="ccfav-ico">${fav.icon || '📌'}</span><span class="ccfav-txt"></span><span class="ccfav-x" title="Remover dos Favoritos">✖</span>`;
  chip.querySelector('.ccfav-txt').textContent = fav.label;
  chip.addEventListener('click', (e) => {
    if (e.target.classList.contains('ccfav-x')) return;
    navigate(fav.url);
  });
  chip.querySelector('.ccfav-x').addEventListener('click', (e) => {
    e.stopPropagation();
    removeFavorito(fav.key);
  });
  // Clique direito também remove
  chip.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    removeFavorito(fav.key);
  });
  return chip;
}

function updateArrows(bar) {
  const sc = bar.querySelector('.ccfav-scroll');
  const arrows = bar.querySelectorAll('.ccfav-arrow');
  const overflow = sc.scrollWidth > sc.clientWidth + 4;
  arrows.forEach(a => a.classList.toggle('show', overflow));
}

/* ============================================================
   PÁGINAS DE MÓDULO — lançador flutuante (botão de fixar + menu)
   ============================================================ */
function renderLauncher() {
  const current = getCurrentModule();
  if (!current) return; // página não mapeada (ex.: portal) — não injeta nada

  let launcher = document.getElementById('ccfav-launcher');
  if (!launcher) {
    if (window.__ccfavMounting) return; // evita corrida durante a montagem assíncrona
    window.__ccfavMounting = true;

    launcher = document.createElement('div');
    launcher.id = 'ccfav-launcher';
    launcher.className = 'ccfav-launcher';
    launcher.innerHTML = `
      <button class="ccfav-pin-btn" type="button"></button>
      <button class="ccfav-menu-btn" type="button" title="Meus favoritos">★</button>
      <div class="ccfav-dropdown"></div>`;

    // Prefere encaixar dentro do brand-bar logo após o espaçador, ficando
    // sempre à direita (o espaçador empurra tudo que vem depois para a direita).
    // Fallback: flutuante fixo no topo, caso a barra não exista.
    const mount = (attempt) => {
      const bar = document.getElementById('crm-brand-bar');
      if (bar) {
        const spacer = bar.querySelector('.crm-bar-spacer');
        if (spacer) bar.insertBefore(launcher, spacer.nextSibling);
        else bar.appendChild(launcher);
      } else if (attempt < 20) {
        return setTimeout(() => mount(attempt + 1), 100);
      } else {
        launcher.classList.add('ccfav-floating');
        document.body.appendChild(launcher);
      }
      window.__ccfavMounting = false;
      renderLauncher(); // atualiza estado após montar
    };
    mount(0);

    const pinBtn  = launcher.querySelector('.ccfav-pin-btn');
    const menuBtn = launcher.querySelector('.ccfav-menu-btn');
    const dd      = launcher.querySelector('.ccfav-dropdown');

    pinBtn.addEventListener('click', () => {
      if (isFavorito(current.key)) removeFavorito(current.key);
      else addFavorito(current);
    });
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dd.classList.toggle('open');
      if (dd.classList.contains('open')) renderDropdown(dd);
    });
    document.addEventListener('click', (e) => {
      if (!launcher.contains(e.target)) dd.classList.remove('open');
    });
  }

  // Atualiza estado do botão de fixar
  const pinBtn = launcher.querySelector('.ccfav-pin-btn');
  const fixado = isFavorito(current.key);
  pinBtn.classList.toggle('active', fixado);
  pinBtn.innerHTML = fixado
    ? `<span>⭐</span><span class="ccfav-pin-label">Fixado</span>`
    : `<span>⭐</span><span class="ccfav-pin-label">Favoritar</span>`;

  // Se o dropdown estiver aberto, re-renderiza
  const dd = launcher.querySelector('.ccfav-dropdown');
  if (dd.classList.contains('open')) renderDropdown(dd);
}

function renderDropdown(dd) {
  const cur = getCurrentModule();
  const favs = loadFavoritos();
  let html = '';

  // Seção do piloto: fixar visões de OS (só na página do módulo OS)
  if (cur && cur.key === 'os') {
    html += `<div class="ccfav-dd-title">Fixar visão de OS</div>`;
    OS_VIEWS.forEach(v => {
      const on = isFavorito(v.key);
      html += `<div class="ccfav-dd-item ccfav-dd-osview" data-key="${v.key}">
        <span class="ccfav-ico">${v.icon}</span>
        <span class="ccfav-dd-txt">${esc(v.label)}</span>
        <span class="ccfav-dd-pin ${on ? 'on' : ''}" data-pin="${v.key}" title="${on ? 'Remover dos Favoritos' : 'Fixar nos Favoritos'}">${on ? '✓' : '📌'}</span>
      </div>`;
    });
    html += `<div class="ccfav-dd-sep"></div>`;
  }

  html += `<div class="ccfav-dd-title">Acesso rápido</div>`;
  if (favs.length === 0) {
    html += `<div class="ccfav-dd-empty">Nenhum favorito ainda.</div>`;
  } else {
    favs.forEach(fav => {
      html += `<div class="ccfav-dd-item" data-nav="${esc(fav.key)}">
        <span class="ccfav-ico">${fav.icon || '📌'}</span>
        <span class="ccfav-dd-txt">${esc(fav.label)}</span>
        <span class="ccfav-x" data-rm="${esc(fav.key)}" title="Remover">✖</span>
      </div>`;
    });
  }
  dd.innerHTML = html;

  // Pin/unpin de uma visão de OS
  dd.querySelectorAll('.ccfav-dd-pin').forEach(el => el.addEventListener('click', (e) => {
    e.stopPropagation();
    const k = el.dataset.pin;
    if (isFavorito(k)) removeFavorito(k);
    else { const v = OS_VIEWS.find(x => x.key === k); if (v) addFavorito(v); }
  }));
  // Clicar na linha da visão de OS (fora do pino) abre a visão direto
  dd.querySelectorAll('.ccfav-dd-osview').forEach(row => row.addEventListener('click', (e) => {
    if (e.target.classList.contains('ccfav-dd-pin')) return;
    const v = OS_VIEWS.find(x => x.key === row.dataset.key);
    if (v) navigate(v.url);
  }));
  // Favoritos de acesso rápido: navegar / remover
  dd.querySelectorAll('.ccfav-dd-item[data-nav]').forEach(row => row.addEventListener('click', (e) => {
    if (e.target.classList.contains('ccfav-x')) return;
    const f = favs.find(x => x.key === row.dataset.nav);
    if (f) navigate(f.url);
  }));
  dd.querySelectorAll('.ccfav-x[data-rm]').forEach(el => el.addEventListener('click', (e) => {
    e.stopPropagation();
    removeFavorito(el.dataset.rm);
  }));
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
function render() {
  if (isDashboard) renderDashboardBar();
  else renderLauncher();
}

function init() {
  injectStyles();
  render();
  window.addEventListener('cc-favoritos-changed', render);
  window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) render(); });
  initModulo().then(ctx => {
    if (!ctx) return;
    _uid = ctx.uid;
    subscribeFavoritos();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
