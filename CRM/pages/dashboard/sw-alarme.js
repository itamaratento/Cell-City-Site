// Service Worker para Alarme em Background (PWA)
const CACHE_NAME = 'alarme-os-v1';

self.addEventListener('install', (event) => {
  console.log('🔧 [PWA] Service Worker Alarme instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✓ [PWA] Service Worker Alarme ativado');
  self.clients.claim();
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('message', (event) => {
  const { tipo, config } = event.data;

  if (tipo === 'iniciarRelogio') {
    iniciarRelogioBackground(config);
  }

  if (tipo === 'pararRelogio') {
    pararRelogioBackground();
  }
});

let intervaloRelogio = null;
let ultimoDisparo = null;

function iniciarRelogioBackground(config) {
  console.log('🔔 [SW] Iniciando relógio em background:', config);

  if (intervaloRelogio) clearInterval(intervaloRelogio);

  intervaloRelogio = setInterval(() => {
    const agora = new Date();
    const diaAtual = agora.getDay();
    const hAtual = agora.getHours();
    const mAtual = agora.getMinutes();
    const horaAtualFormatada = String(hAtual).padStart(2, '0') + ':' + String(mAtual).padStart(2, '0');

    const [hInicio, mInicio] = config.horaInicio.split(':').map(Number);
    const horaInicioFormatada = String(hInicio).padStart(2, '0') + ':' + String(mInicio).padStart(2, '0');

    const diasPermitidos = config.dias || [];
    const diaPermitido = diasPermitidos.includes(diaAtual);

    // Quando chega na hora início
    if (horaAtualFormatada === horaInicioFormatada && diaPermitido) {
      if (ultimoDisparo !== horaInicioFormatada) {
        ultimoDisparo = horaInicioFormatada;

        console.log(`🔔 [SW] HORA CHEGOU! ${horaInicioFormatada}`);

        // Envia notificação
        self.registration.showNotification('🔔 ALARME - OS Nova', {
          body: `Hora: ${horaInicioFormatada} | ${config.anotacao || 'Verificar novo evento'}`,
          icon: '/CRM/assets/logo.png',
          badge: '/CRM/assets/logo.png',
          tag: 'alarme-os',
          requireInteraction: true,
          actions: [
            { action: 'abrir', title: '👀 Abrir CRM' },
            { action: 'fechar', title: '✕ Fechar' }
          ]
        });

        // Notifica a aba ativa (se estiver aberta)
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              tipo: 'alarmeDisparat',
              hora: horaInicioFormatada
            });
          });
        });
      }
    }
  }, 1000);
}

function pararRelogioBackground() {
  if (intervaloRelogio) {
    clearInterval(intervaloRelogio);
    intervaloRelogio = null;
  }
  ultimoDisparo = null;
  console.log('⏹️ [SW] Relógio parado');
}

// Quando clica na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'abrir') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (let client of clientList) {
          if (client.url === '/CRM/pages/dashboard/index.html' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/CRM/pages/dashboard/');
        }
      })
    );
  }
});

// Background Sync (para Android)
self.addEventListener('sync', (event) => {
  if (event.tag === 'alarme-sync') {
    console.log('🔄 [PWA] Background Sync: Alarme verificado');
  }
});

// Periodic Background Sync (opcional, requer permissão)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'alarme-periodico') {
    console.log('⏰ [PWA] Periodic Sync: Verificando alarmes...');
  }
});
