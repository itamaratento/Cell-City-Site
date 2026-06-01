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
    Promise.all([
      // Limpa caches antigos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Carrega config do IndexedDB se existir
      carregarConfigIndexedDB().then(config => {
        if (config) {
          console.log('📂 [SW] Config carregada do IndexedDB');
          configAtual = config;
        }
      })
    ])
  );
});

// Mostra notificação persistente
async function mostrarNotificacaoPersistente(config) {
  try {
    await self.registration.showNotification('🔔 Alarme CRM Ativo', {
      body: `Horário: ${config.horaInicio} | Monitorando...`,
      icon: '/CRM/assets/logo.png',
      badge: '/CRM/assets/logo.png',
      tag: 'alarme-persistente',
      requireInteraction: true,
      silent: true, // Não faz som agora (só quando dispara)
      actions: [
        { action: 'abrir', title: '👀 Abrir' },
        { action: 'parar', title: '⏹️ Parar' }
      ]
    });
    console.log('📌 [SW] Notificação persistente mostrada');
  } catch (e) {
    console.warn('❌ [SW] Erro notificação:', e);
  }
}

// Atualiza notificação a cada mudança
async function atualizarNotificacao(config) {
  if (!config.ativo) {
    try {
      await self.registration.getNotifications({ tag: 'alarme-persistente' }).then(notifs => {
        notifs.forEach(n => n.close());
      });
      console.log('📌 [SW] Notificação fechada');
    } catch (e) {
      console.warn('Erro ao fechar notificação:', e);
    }
  } else {
    await mostrarNotificacaoPersistente(config);
  }
}

self.addEventListener('message', (event) => {
  const { tipo, config, userId } = event.data;

  if (tipo === 'iniciarRelogio') {
    console.log('📥 [SW] Recebido iniciarRelogio');
    iniciarRelogioBackground(config);
    atualizarNotificacao(config);
  }

  if (tipo === 'pararRelogio') {
    console.log('📥 [SW] Recebido pararRelogio');
    pararRelogioBackground();
    atualizarNotificacao({ ativo: false });
  }

  if (tipo === 'atualizarConfig') {
    console.log('📥 [SW] Config atualizada:', config);
    configAtual = config;
    // Salva em IndexedDB para persistência
    salvarConfigIndexedDB(config).catch(err => {
      console.warn('Erro salvando em IndexedDB:', err);
    });
    // Atualiza notificação
    atualizarNotificacao(config);
  }

  if (tipo === 'mostrarNotificacao') {
    console.log('📥 [SW] Pedido para mostrar notificação');
    if (configAtual) {
      mostrarNotificacaoPersistente(configAtual);
    }
  }
});

let intervaloRelogio = null;
let ultimoDisparo = null;
let configAtual = null;
let intervaloSincronizacao = null;
const DB_NAME = 'AlarmeOSDB';
const STORE_NAME = 'config';

// IndexedDB para persistir config
async function salvarConfigIndexedDB(config) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(config, 'alarme');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function carregarConfigIndexedDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const get = store.get('alarme');

      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => resolve(null);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

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

async function iniciarRelogioBackground(config) {
  console.log('🔔 [SW] Iniciando relógio em background:', config);

  configAtual = config;

  // Salva em IndexedDB para persistência
  await salvarConfigIndexedDB(config);

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
  // NÃO fecha a notificação persistente automaticamente
  if (event.notification.tag !== 'alarme-persistente') {
    event.notification.close();
  }

  if (event.action === 'abrir' || !event.action) {
    // Clicou no corpo da notificação ou botão "Abrir"
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (let client of clientList) {
          if (client.url.includes('/CRM/') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/CRM/pages/dashboard/?alarme=1');
        }
      })
    );
  }

  if (event.action === 'parar') {
    // Clicou em "Parar" - para o alarme
    console.log('⏹️ [SW] Usuário clicou em Parar');
    ultimoDisparo = null;
    configAtual = { ...configAtual, ativo: false };

    // Fecha a notificação
    event.notification.close();
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
