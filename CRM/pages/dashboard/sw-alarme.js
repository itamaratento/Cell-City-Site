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
// 🚫 REMOVIDO: Notificação do Ubuntu/SO desativada
async function mostrarNotificacaoPersistente(config) {
  console.log('📌 [SW] Notificação do Ubuntu bloqueada (apenas in-app)');
}

// Atualiza notificação a cada mudança
// 🚫 REMOVIDO: Notificações do SO desativadas
async function atualizarNotificacao(config) {
  console.log('📌 [SW] Notificações do SO desativadas');
}

self.addEventListener('message', (event) => {
  const { tipo, config, userId } = event.data;
  // Lembra a identidade da conta enviada pela página (getUid) para usar no
  // fetch independente do SW. Default alinhado ao STORE_KEY da sessão.
  if (userId) userIdAtual = userId;

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
let userIdAtual = null;            // identidade da conta (getUid) enviada pela página
let intervaloSincronizacao = null;
let alarmesAtivos = new Map(); // Rastreia alarmes em repetição
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

  // Usa a identidade da conta recebida via postMessage (getUid).
  // Default: STORE_KEY da sessão (conta única da loja).
  const userId = userIdAtual || 'loja-cellcity';

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
    console.log('🔄 [SW] Sincronizando com Firebase (5 min)...');
    sincronizarComFirebase();
  }, 300000); // 5 minutos

  // PRIMEIRO sync imediato
  setTimeout(() => sincronizarComFirebase(), 1000);

  // Verificação A CADA SEGUNDO (suporta múltiplos alarmes)
  console.log('⏱️ [SW] Iniciando verificação de alarmes a cada 1 segundo');
  let ultimoMinutoVerificado = -1;

  intervaloRelogio = setInterval(() => {
    const agora = new Date();
    const diaAtual = agora.getDay();
    const hAtual = agora.getHours();
    const mAtual = agora.getMinutes();
    const horaAtualFormatada = String(hAtual).padStart(2, '0') + ':' + String(mAtual).padStart(2, '0');

    // Log apenas a cada mudança de minuto (para não poluir logs)
    if (mAtual !== ultimoMinutoVerificado) {
      console.log(`⏰ [SW] Verificando alarmes às ${horaAtualFormatada}`);
      ultimoMinutoVerificado = mAtual;
    }

    // Verifica cada alarme
    const alarmes = configAtual?.alarmes || [];
    if (alarmes.length === 0) return;

    alarmes.forEach(alarme => {
      if (!alarme.ativo) return;

      const [hInicio, mInicio] = alarme.horaInicio.split(':').map(Number);
      const horaInicioFormatada = String(hInicio).padStart(2, '0') + ':' + String(mInicio).padStart(2, '0');

      const diasPermitidos = alarme.dias || [];
      const diaPermitido = diasPermitidos.includes(diaAtual);

      // Quando chega na hora
      if (horaAtualFormatada === horaInicioFormatada && diaPermitido) {
        const chaveDisparo = `disparo_${alarme.id}_${horaInicioFormatada}`;

        if (ultimoDisparo !== chaveDisparo) {
          ultimoDisparo = chaveDisparo;

          console.log(`🔔 [SW] ALARME! ${horaInicioFormatada} - ${alarme.anotacao}`);

          // Função para disparar notificação COM SOM
          const dispararAlarme = async () => {
            try {
              // 🚫 REMOVIDO: Notificação do Ubuntu/SO desativada
              console.log('📢 [SW] Disparo de alarme (notificação Ubuntu bloqueada):', alarme.anotacao);

              // Envia mensagem a todos os clientes (tabs abertas)
              const clients = await self.clients.matchAll();
              clients.forEach(client => {
                client.postMessage({
                  tipo: 'alarmeDisparou',
                  hora: horaInicioFormatada,
                  anotacao: alarme.anotacao,
                  repeticao: alarme.repeticao
                });
              });
            } catch (e) {
              console.error('❌ [SW] Erro ao disparar alarme:', e);
            }
          };

          // Dispara primeira vez
          dispararAlarme();

          // Se tem repetição, inicia intervalo
          if (alarme.repeticao && alarme.repeticao > 0) {
            const chaveIntervalo = `intervalo_${alarme.id}`;

            // Limpa intervalo anterior se existir
            if (alarmesAtivos.has(chaveIntervalo)) {
              clearInterval(alarmesAtivos.get(chaveIntervalo));
            }

            // Cria novo intervalo
            const novoIntervalo = setInterval(() => {
              dispararAlarme();
            }, alarme.repeticao * 1000);

            alarmesAtivos.set(chaveIntervalo, novoIntervalo);
            console.log(`🔁 [SW] Repetição iniciada: a cada ${alarme.repeticao}s`);
          }
        }
      } else {
        // Para a repetição quando sai do horário
        const chaveIntervalo = `intervalo_${alarme.id}`;
        if (alarmesAtivos.has(chaveIntervalo)) {
          clearInterval(alarmesAtivos.get(chaveIntervalo));
          alarmesAtivos.delete(chaveIntervalo);
          console.log(`⏹️ [SW] Repetição parada`);
        }
      }
    });
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

// 🚫 REMOVIDO: Notificações do SO desativadas
self.addEventListener('notificationclick', () => {});

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
