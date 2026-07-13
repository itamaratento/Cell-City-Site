// Cell City CRM — Service Worker v2.0 (bump: cache expandido Sprint MOD-V2-003)
const CACHE = 'cellcity-crm-v16';

// Arquivos do shell — carregados no install (expandido para cobrir shared + módulos principais)
const SHELL = [
  '/CRM/',
  '/CRM/index.html',
  '/CRM/assets/logo.png',
  '/CRM/shared/brand-header.js',
  '/CRM/shared/dock.css',
  '/CRM/shared/dock.js',
  '/CRM/shared/central-modulos.js',
  '/CRM/shared/modulos.catalogo.json',
  '/CRM/shared/favoritos.js',
  '/CRM/shared/menu-favoritos.js',
  '/CRM/shared/sidebar.js',
  '/CRM/shared/permissoes.js',
  '/CRM/shared/session.js',
  '/CRM/shared/sanitize.js',
  '/CRM/shared/date-utils.js',
  '/CRM/shared/env-config.js',
  '/CRM/shared/obs-expand.js',
  '/CRM/scripts/firebase.js',
  '/CRM/scripts/kernel.js',
  '/CRM/pages/dashboard/index.html',
  '/CRM/pages/dashboard/dashboard.css',
  '/CRM/pages/dashboard/dashboard.js',
  '/CRM/pages/caixa/index.html',
  '/CRM/pages/caixa/caixa.css',
  '/CRM/pages/caixa/caixa.js',
  '/CRM/pages/os/index.html',
  '/CRM/pages/os/os.css',
  '/CRM/pages/os/os.js',
  '/CRM/pages/clientes/index.html',
  '/CRM/pages/clientes/clientes.css',
  '/CRM/pages/clientes/clientes.js',
  '/CRM/pages/estoque/index.html',
  '/CRM/pages/estoque/estoque.css',
  '/CRM/pages/estoque/estoque.js',
  '/CRM/pages/financeiro/index.html',
  '/CRM/pages/financeiro/financeiro.css',
  '/CRM/pages/financeiro/financeiro.js',
  '/CRM/pages/compras/index.html',
  '/CRM/pages/compras/compras.css',
  '/CRM/pages/compras/compras.js',
  '/CRM/pages/fornecedor/index.html',
  '/CRM/pages/fornecedor/fornecedor.css',
  '/CRM/pages/fornecedor/fornecedor.js',
  '/CRM/pages/relatorios/index.html',
  '/CRM/pages/relatorios/relatorios.css',
  '/CRM/pages/relatorios/relatorios.js',
  '/CRM/pages/central-modulos/index.html',
  '/CRM/pages/central-modulos/central-modulos-page.js',
  '/CRM/pages/analise/index.html',
  '/CRM/pages/analise/analise.css',
  '/CRM/pages/analise/analise.js',
  '/CRM/pages/importar/index.html',
  '/CRM/pages/importar/importar.css',
  '/CRM/pages/importar/importar.js',
  '/CRM/pages/config/index.html',
  '/CRM/pages/config/config.js',
  '/CRM/pages/config/config.css',
  '/CRM/pages/pos-venda/index.html',
  '/CRM/pages/pos-venda/posvenda.css',
  '/CRM/pages/pos-venda/posvenda.js',
  '/CRM/pages/usuarios-permissoes/index.html',
  '/CRM/pages/usuarios-permissoes/usuarios-permissoes.css',
  '/CRM/pages/usuarios-permissoes/usuarios-permissoes.js',
  '/CRM/pages/central-alertas/index.html',
  '/CRM/pages/central-alertas/central-alertas.css',
  '/CRM/pages/central-alertas/central-alertas.js',
];

// ── Install: pré-carrega o shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// ── Activate: limpa caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estratégia por tipo de recurso
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Firestore e APIs externas → sempre network (não cachear)
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    return; // deixa o browser lidar normalmente
  }

  // Fontes do Google → cache-first
  if (url.hostname.includes('fonts.google') || url.hostname.includes('fonts.gstatic')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // Arquivos do CRM → network-first com fallback para cache
  if (url.pathname.startsWith('/CRM/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Atualiza o cache com a versão mais recente
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request)) // offline → serve do cache
    );
  }
});
