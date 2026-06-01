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
  const { tipo, config, userId } = event.data;

  if (tipo === 'iniciarRelogio') {
    console.log('📥 [SW] Recebido iniciarRelogio');
    iniciarRelogioBackground(config);
  }

  if (tipo === 'pararRelogio') {
    console.log('📥 [SW] Recebido pararRelogio');
    pararRelogioBackground();
  }

  if (tipo === 'atualizarConfig') {
    console.log('📥 [SW] Config atualizada:', config);
    configAtual = config;
  }
});

let intervaloRelogio = null;
let ultimoDisparo = null;
let configAtual = null;
let intervaloSincronizacao = null;

// Simula Firebase fetch (já que não pode usar SDK diretamente em SW)
async function buscarConfigDoFirebase(userId) {
  try {
    // Usa a API REST do Firestore
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/cellcity-crm/databases/(default)/documents/alarme_config/${userId}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.fields) {
        // Converte do formato Firestore para objeto normal
        const config = {
          ativo: data.fields.ativo?.booleanValue || false,
          horaInicio: data.fields.horaInicio?.stringValue || '09:00',
          horaFim: data.fields.horaFim?.stringValue || '18:00',
          volume: data.fields.volume?.integerValue || 80,
          anotacao: data.fields.anotacao?.stringValue || '',
          dias: data.fields.dias?.arrayValue?.values?.map(v => parseInt(v.integerValue)) || [1,2,3,4,5]
        };
        return config;
      }
    }
  } catch (e) {
    console.warn('❌ [SW] Erro ao buscar Firebase:', e);
  }
  return null;
}

async function sincronizarComFirebase() {
  console.log('🔄 [SW] Sincronizando com Firebase...');

  // Tenta pegar userId do localStorage (via postMessage)
  const clients = await self.clients.matchAll();

  // Por enquanto, usa um userId padrão
  const userId = 'user_default';

  const configFirebase = await buscarConfigDoFirebase(userId);
  if (configFirebase) {
    configAtual = configFirebase;
    console.log('✓ [SW] Config atualizada do Firebase:', configAtual);

    // Armazena para reutilizar
    await self.registration.scope; // Garante que SW está ativo
  }
}

function iniciarRelogioBackground(config) {
  console.log('🔔 [SW] Iniciando relógio em background:', config);

  configAtual = config;

  if (intervaloRelogio) clearInterval(intervaloRelogio);
  if (intervaloSincronizacao) clearInterval(intervaloSincronizacao);

  // Sincroniza com Firebase a cada 5 minutos
  intervaloSincronizacao = setInterval(() => {
    sincronizarComFirebase();
  }, 300000); // 5 minutos

  // Verificação a cada segundo
  intervaloRelogio = setInterval(() => {
    const configUso = configAtual || config;

    if (!configUso.ativo) return;

    const agora = new Date();
    const diaAtual = agora.getDay();
    const hAtual = agora.getHours();
    const mAtual = agora.getMinutes();
    const horaAtualFormatada = String(hAtual).padStart(2, '0') + ':' + String(mAtual).padStart(2, '0');

    const [hInicio, mInicio] = configUso.horaInicio.split(':').map(Number);
    const horaInicioFormatada = String(hInicio).padStart(2, '0') + ':' + String(mInicio).padStart(2, '0');

    const diasPermitidos = configUso.dias || [];
    const diaPermitido = diasPermitidos.includes(diaAtual);

    // Quando chega na hora início
    if (horaAtualFormatada === horaInicioFormatada && diaPermitido) {
      if (ultimoDisparo !== horaInicioFormatada) {
        ultimoDisparo = horaInicioFormatada;

        console.log(`🔔 [SW] HORA CHEGOU! ${horaInicioFormatada}`);

        // Envia notificação
        self.registration.showNotification('🔔 ALARME - OS Nova', {
          body: `Hora: ${horaInicioFormatada} | ${configUso.anotacao || 'Verificar novo evento'}`,
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

// Background Sync (sincronizar com Firebase)
self.addEventListener('sync', (event) => {
  if (event.tag === 'alarme-sync') {
    console.log('🔄 [PWA] Background Sync: Sincronizando...');
    event.waitUntil(
      sincronizarComFirebase().catch(err => {
        console.warn('Erro sync:', err);
        return Promise.reject(err); // Retry automático
      })
    );
  }
});

// Periodic Background Sync (Android) - executado periodicamente
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'alarme-periodico') {
    console.log('⏰ [PWA] Periodic Sync ativado');
    event.waitUntil(
      sincronizarComFirebase().then(() => {
        console.log('✓ Sincronização periódica concluída');
      }).catch(err => {
        console.warn('Erro periodic sync:', err);
      })
    );
  }
});

// Wake Lock API (mantém tela acordada se necessário)
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      const wakeLock = await navigator.wakeLock.request('screen');
      console.log('🔒 Wake Lock: Tela será mantida acordada');

      wakeLock.addEventListener('release', () => {
        console.log('🔓 Wake Lock liberado');
      });
    } catch (e) {
      console.warn('Wake Lock não disponível:', e);
    }
  }
}
