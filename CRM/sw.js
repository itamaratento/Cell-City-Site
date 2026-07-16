// Cell City CRM — Service Worker v2.1 (P2.5, 2026-07-16)
// SHELL regenerado a partir do fechamento transitivo REAL de imports das
// páginas pré-cacheadas (script em scratchpad da sessão; inclui tenant-*,
// repositories e os novos utilitários de os.js — corrige DT-12 e o 404 de
// clientes.js renomeado no P2.6 que impedia o v16 de instalar).
const CACHE = 'cellcity-crm-v17';

// Arquivos do shell — carregados no install (expandido para cobrir shared + módulos principais)
const SHELL = [
  '/CRM/',
  '/CRM/index.html',
  '/CRM/assets/logo.png',
  '/CRM/assets/logo.svg',
  '/CRM/shared/dock.css',
  '/CRM/shared/modulos.catalogo.json',
  '/CRM/pages/dashboard/index.html',
  '/CRM/pages/caixa/index.html',
  '/CRM/pages/os/index.html',
  '/CRM/pages/clientes/index.html',
  '/CRM/pages/estoque/index.html',
  '/CRM/pages/financeiro/index.html',
  '/CRM/pages/compras/index.html',
  '/CRM/pages/fornecedor/index.html',
  '/CRM/pages/relatorios/index.html',
  '/CRM/pages/central-modulos/index.html',
  '/CRM/pages/analise/index.html',
  '/CRM/pages/importar/index.html',
  '/CRM/pages/config/index.html',
  '/CRM/pages/pos-venda/index.html',
  '/CRM/pages/usuarios-permissoes/index.html',
  '/CRM/pages/central-alertas/index.html',
  '/CRM/pages/dashboard/dashboard.css',
  '/CRM/pages/caixa/caixa.css',
  '/CRM/pages/os/os.css',
  '/CRM/pages/clientes/clientes.css',
  '/CRM/pages/estoque/estoque.css',
  '/CRM/pages/financeiro/financeiro.css',
  '/CRM/pages/compras/compras.css',
  '/CRM/pages/fornecedor/fornecedor.css',
  '/CRM/pages/relatorios/relatorios.css',
  '/CRM/pages/analise/analise.css',
  '/CRM/pages/importar/importar.css',
  '/CRM/pages/config/config.css',
  '/CRM/pages/pos-venda/posvenda.css',
  '/CRM/pages/usuarios-permissoes/usuarios-permissoes.css',
  '/CRM/pages/central-alertas/central-alertas.css',
  '/CRM/firebase/client.js',
  '/CRM/pages/analise/analise.js',
  '/CRM/pages/caixa/caixa.js',
  '/CRM/pages/central-alertas/central-alertas.js',
  '/CRM/pages/central-modulos/central-modulos-page.js',
  '/CRM/pages/compras/compras.js',
  '/CRM/pages/config/config.js',
  '/CRM/pages/config/impressao.js',
  '/CRM/pages/dashboard/dashboard-alarme-os.js',
  '/CRM/pages/dashboard/dashboard-alertas.js',
  '/CRM/pages/dashboard/dashboard-busca.js',
  '/CRM/pages/dashboard/dashboard-caixa.js',
  '/CRM/pages/dashboard/dashboard-events.js',
  '/CRM/pages/dashboard/dashboard-init.js',
  '/CRM/pages/dashboard/dashboard-state.js',
  '/CRM/pages/dashboard/dashboard-ui.js',
  '/CRM/pages/dashboard/dashboard-utils.js',
  '/CRM/pages/dashboard/dashboard.js',
  '/CRM/pages/estoque/estoque.js',
  '/CRM/pages/financeiro/financeiro.js',
  '/CRM/pages/fornecedor/fornecedor.js',
  '/CRM/pages/importar/importar.js',
  '/CRM/pages/os/os-photo-storage.js',
  '/CRM/pages/os/os-ui-utils.js',
  '/CRM/pages/os/os.js',
  '/CRM/pages/pos-venda/posvenda.js',
  '/CRM/pages/relatorios/relatorios.js',
  '/CRM/pages/usuarios-permissoes/firebase-secondary.js',
  '/CRM/pages/usuarios-permissoes/usuarios-permissoes.js',
  '/CRM/repositories/base.repository.js',
  '/CRM/repositories/base.repository.padrao.js',
  '/CRM/repositories/base.repository.tenant.js',
  '/CRM/repositories/caixa.repository.js',
  '/CRM/repositories/clientes.repository.js',
  '/CRM/repositories/diario.repository.js',
  '/CRM/repositories/estoque.repository.js',
  '/CRM/repositories/financeiro.repository.js',
  '/CRM/repositories/fornecedor.repository.js',
  '/CRM/repositories/os.repository.js',
  '/CRM/repositories/portal.repository.js',
  '/CRM/repositories/posvenda.repository.js',
  '/CRM/repositories/produtos.repository.js',
  '/CRM/repositories/sistema.repository.js',
  '/CRM/scripts/firebase.js',
  '/CRM/scripts/kernel.js',
  '/CRM/services/format.service.js',
  '/CRM/services/os-financeiro.service.js',
  '/CRM/services/os-status.service.js',
  '/CRM/services/os-timeline.service.js',
  '/CRM/shared/brand-header.js',
  '/CRM/shared/central-modulos.js',
  '/CRM/shared/date-utils.js',
  '/CRM/shared/dock.js',
  '/CRM/shared/env-config.js',
  '/CRM/shared/favoritos.js',
  '/CRM/shared/menu-favoritos.js',
  '/CRM/shared/obs-expand.js',
  '/CRM/shared/permissoes.js',
  '/CRM/shared/phone-utils.js',
  '/CRM/shared/sanitize.js',
  '/CRM/shared/session.js',
  '/CRM/shared/sidebar.js',
  '/CRM/shared/tenant-context.js',
  '/CRM/shared/tenant-provider.js',
  '/CRM/shared/tenant-query.js',
  '/CRM/shared/tenant-resolver.js',
];

// ── Install: pré-carrega o shell
self.addEventListener('install', e => {
  // DT-13: cache.addAll é atômico — UM 404 rejeitava a instalação inteira
  // (foi o que aconteceu no v16: clientes.js renomeado quebrou o SW).
  // allSettled pré-cacheia o que existir e só reporta o que falhou.
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(SHELL.map(u => cache.add(u))).then(rs => {
        const falhas = rs.map((r, i) => r.status === 'rejected' ? SHELL[i] : null).filter(Boolean);
        if (falhas.length) console.warn('[SW] SHELL: não pré-cacheados:', falhas);
      })
    ).then(() => self.skipWaiting())
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
