/* ============================================
CELL CITY CRM — DASHBOARD — ALARME DE NOVA OS
Etapa 10 da refatoração modular: alarme configurável de chegada de nova OS
(Service Worker, notificações, Wake Lock, janela flutuante).
Mixin aplicado em Dashboard.prototype (ver dashboard.js) — mesmo `this` de sempre.
============================================ */
import { db, doc, setDoc, collection, onSnapshot, query } from "../../scripts/firebase.js";
import { injectTenantFilter } from '../../shared/tenant-query.js';
import { dashboardShared } from './dashboard-state.js';

export const dashboardAlarmeOsMixin = {
  // ===== ALARME PARA OS NOVA =====
  setupAlarmeOS() {
    const panel = document.getElementById('alarme-panel');
    const btnClose = document.getElementById('alarme-close');
    const toggleAtivo = document.getElementById('alarme-ativo');
    const inputHoraInicio = document.getElementById('alarme-hora-inicio');
    const inputHoraFim = document.getElementById('alarme-hora-fim');
    const inputVolume = document.getElementById('alarme-volume');
    const inputAnotacao = document.getElementById('alarme-anotacao');
    const btnTestar = document.getElementById('alarme-testar-btn');
    const btnSalvar = document.getElementById('alarme-salvar-btn');
    const diasChecks = document.querySelectorAll('.alarme-dia-check');
    const statusLabel = document.getElementById('alarme-status-label');
    const volumeLabel = document.getElementById('alarme-volume-label');
    const debugInfo = document.getElementById('alarme-debug-info');

    if (!panel) return;

    // Registra Service Worker para background
    const registrarServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          // H-002 (homologação 2026-07-03): scope '/CRM/' excede o máximo
          // permitido para um script em '/CRM/pages/dashboard/' (o browser
          // recusa o registro sem o header Service-Worker-Allowed, que o
          // GitHub Pages não permite configurar). Escopo restrito à pasta
          // real do arquivo — único valor que o browser aceita aqui.
          const reg = await navigator.serviceWorker.register('/CRM/pages/dashboard/sw-alarme.js', {
            scope: '/CRM/pages/dashboard/'
          });
          console.log('✓ Service Worker Alarme registrado');

          // Registra Background Sync (sincronizar a cada hora)
          if ('sync' in reg) {
            try {
              await reg.sync.register('alarme-sync');
              console.log('📡 Background Sync registrado');
            } catch (e) {
              console.warn('Background Sync:', e);
            }
          }

          // Registra Periodic Background Sync (Android) - a cada 60 minutos
          if ('periodicSync' in reg) {
            try {
              await reg.periodicSync.register('alarme-periodico', {
                minInterval: 60 * 60 * 1000 // 60 minutos
              });
              console.log('⏰ Periodic Sync registrado (Android)');
            } catch (e) {
              console.warn('Periodic Sync:', e);
            }
          }

          return reg;
        } catch (e) {
          console.warn('⚠️ Service Worker:', e.message);
        }
      }
    };

    // Pede permissão de notificações
    const solicitarPermissaoNotificacoes = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            atualizarDebug('✓ Notificações ativadas');
            return true;
          }
        } catch (e) {
          console.warn('Notificações:', e);
        }
      }
      return Notification.permission === 'granted';
    };

    // Envia config para Service Worker
    const enviarConfigSW = (config) => {
      if (navigator.serviceWorker.controller) {
        const userId = dashboardShared.uid;
        navigator.serviceWorker.controller.postMessage({
          tipo: 'iniciarRelogio',
          config: config,
          userId: userId
        });
        console.log('📤 Config enviada ao Service Worker');
      }
    };

    registrarServiceWorker();

    let audioContext = null;
    let isTocarAlarm = false;
    let unsubscribeOS = null;
    let ultimaOSDetectada = null;
    let intervaloVerificacao = null;
    let intervaloRelogio = null;
    let ultimoDisparo = null;
    let unsubscribeFirebase = null;
    let atualizandoDoFirebase = false;
    let alarmes = []; // Array de múltiplos alarmes

    // ===== LISTENER PARA MENSAGENS DO SERVICE WORKER =====
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { tipo, hora, anotacao, repeticao } = event.data;

        if (tipo === 'alarmeDisparou') {
          console.log(`📢 Alarme disparou às ${hora}: ${anotacao}`);
          atualizarDebug(`🔔 ALARME! ${hora} - ${anotacao}`);

          // Toca o som do alarme no app se ele estiver aberto
          const volume = (inputVolume?.value || 80) / 100;
          gerarSomAlarme(10, volume);

          // Foco na janela se estiver minimizada
          window.focus();

          // Vibração no Android
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 200]);
          }
        }
      });
      console.log('✅ Listener de mensagens do Service Worker configurado');
    }

    const atualizarDebug = (msg) => {
      const agora = new Date();
      const hora = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0') + ':' + String(agora.getSeconds()).padStart(2, '0');
      debugInfo.textContent = `[${hora}] ${msg}`;
      console.log(msg);
    };

    // Adicionar novo alarme
    const adicionarAlarme = () => {
      console.log('📥 [DEBUG] adicionarAlarme chamado');

      try {
        if (!inputHoraInicio || !inputAnotacao) {
          console.warn('⚠️ Elementos não encontrados');
          atualizarDebug('⚠️ Elementos não carregados');
          return;
        }

        const inputRepeticao = document.getElementById('alarme-repeticao');
        const repeticao = inputRepeticao ? parseInt(inputRepeticao.value) || 0 : 0;

        const novoAlarme = {
          id: Date.now().toString(),
          ativo: true,
          horaInicio: inputHoraInicio.value || '09:00',
          horaFim: inputHoraFim.value || '18:00',
          volume: inputVolume.value || 80,
          anotacao: inputAnotacao.value || 'Novo Alarme',
          dias: Array.from(diasChecks || [])
            .filter(c => c.checked)
            .map(c => parseInt(c.value)),
          repeticao: repeticao
        };

        console.log('📋 Novo alarme:', novoAlarme);

        alarmes.push(novoAlarme);
        salvarAlarmes();
        renderizarAlarmes();

        const msgRepeticao = repeticao > 0 ? ` (repete a cada ${repeticao}s)` : '';
        atualizarDebug(`➕ Alarme adicionado: ${novoAlarme.horaInicio}${msgRepeticao}`);

        console.log('✅ Alarme adicionado com sucesso');
      } catch (e) {
        console.error('❌ Erro ao adicionar alarme:', e);
        atualizarDebug(`❌ Erro: ${e.message}`);
      }
    };

    // Abrir/Editar alarme
    const abrirAlarme = (id) => {
      console.log('📂 [DEBUG] Abrindo alarme:', id);

      const alarme = alarmes.find(a => a.id === id);
      if (!alarme) {
        console.warn('⚠️ [DEBUG] Alarme não encontrado:', id);
        atualizarDebug('⚠️ Alarme não encontrado');
        return;
      }

      try {
        // Preenche os campos com dados do alarme
        if (inputHoraInicio) inputHoraInicio.value = alarme.horaInicio || '09:00';
        if (inputHoraFim) inputHoraFim.value = alarme.horaFim || '18:00';
        if (inputVolume) inputVolume.value = alarme.volume || 80;
        if (inputAnotacao) inputAnotacao.value = alarme.anotacao || 'Alarme';

        // Marca os dias
        if (diasChecks && diasChecks.length > 0) {
          diasChecks.forEach(check => {
            check.checked = (alarme.dias || []).includes(parseInt(check.value));
          });
        }

        // Define repetição
        const inputRepeticao = document.getElementById('alarme-repeticao');
        if (inputRepeticao) {
          inputRepeticao.value = alarme.repeticao || 0;
        }

        atualizarLabels();

        // Garante que o painel está visível
        if (panel && panel.style.display === 'none') {
          panel.style.display = 'flex';
          console.log('📂 Painel aberto automaticamente');
        }

        atualizarDebug(`✏️ Editando: ${alarme.anotacao}`);

        // Scroll para os campos
        setTimeout(() => {
          panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        console.log('✅ [DEBUG] Alarme aberto com sucesso:', alarme);
      } catch (e) {
        console.error('❌ [DEBUG] Erro ao abrir alarme:', e);
        atualizarDebug('❌ Erro ao abrir: ' + e.message);
      }
    };

    // Remover alarme
    const removerAlarme = (id) => {
      alarmes = alarmes.filter(a => a.id !== id);
      salvarAlarmes();
      renderizarAlarmes();
      atualizarDebug('🗑️ Alarme removido');
    };

    // Renderizar lista de alarmes
    const renderizarAlarmes = () => {
      const lista = document.getElementById('alarmes-lista');
      console.log('🎨 renderizarAlarmes chamado, lista:', lista, 'alarmes:', alarmes.length);
      if (!lista) {
        console.warn('⚠️ Lista não encontrada!');
        return;
      }

      if (alarmes.length === 0) {
        console.log('📭 Nenhum alarme, mostrando vazio');
        lista.innerHTML = '<div style="padding: 10px; color: var(--text-tertiary); text-align: center; font-size: 12px;">Nenhum alarme adicionado</div>';
        return;
      }

      const html = alarmes.map(alarme => {
        const repeticaoText = alarme.repeticao > 0 ? ` 🔁 ${alarme.repeticao}s` : '';
        return `
          <div style="padding: 10px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s; user-select: none; background: rgba(0,200,83,0.03);" onmouseover="this.style.background='rgba(0,200,83,0.08)'" onmouseout="this.style.background='rgba(0,200,83,0.03)'" onclick="console.log('Clicou em:', '${alarme.id}'); window.abrirAlarme('${alarme.id}'); return false;">
            <div style="flex: 1;">
              <div style="font-size: 13px; font-weight: 600; color: var(--cell-green); margin-bottom: 3px;">
                ⏰ ${alarme.horaInicio} → ${alarme.horaFim}${repeticaoText}
              </div>
              <div style="color: var(--text-tertiary); font-size: 11px; margin-bottom: 2px;">${alarme.anotacao || 'Sem descrição'}</div>
              <div style="color: var(--text-tertiary); font-size: 10px;">📅 ${alarme.dias?.length || 0} dias</div>
            </div>
            <button onclick="event.stopPropagation(); event.preventDefault(); window.removerAlarme('${alarme.id}'); return false;" style="background: none; border: none; color: var(--accent-red); cursor: pointer; font-size: 16px; padding: 4px 8px; flex-shrink: 0;">✕</button>
          </div>
        `;
      }).join('');

      lista.innerHTML = html;
      console.log('✅ Lista renderizada com', alarmes.length, 'alarme(s)');
    };

    // Salvar alarmes em Firebase
    const salvarAlarmes = async () => {
      if (atualizandoDoFirebase) {
        console.warn('⏳ Atualizando do Firebase, ignorando salvar');
        return;
      }

      const config = {
        alarmes: alarmes,
        atualizadoEm: new Date().toISOString(),
        dispositivo: navigator.userAgent.substring(0, 50)
      };

      console.log('💾 Salvando alarmes:', config);
      // Salva localmente
      localStorage.setItem('alarme_os_config', JSON.stringify(config));
      console.log('✅ Salvo no localStorage');

      // 📤 ENVIA AO SERVICE WORKER (INICIA MONITORAMENTO)
      const enviarAoServiceWorker = () => {
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({
            tipo: 'atualizarConfig',
            config: config,
            timestamp: Date.now()
          });
          console.log('📤 Config enviada ao Service Worker com alarmes ativas');
        }
      };

      // Salva no Firebase
      try {
        const { setDoc } = await import('../../scripts/firebase.js');
        const userId = dashboardShared.uid;
        const docRef = doc(db, 'alarme_config', userId);

        // Inclui informação de dispositivo para rastrear sincronização
        const configComMetadata = {
          ...config,
          ultimaAtualizacao: {
            timestamp: Date.now(),
            dispositivo: navigator.userAgent.substring(0, 100),
            seuUserId: userId
          }
        };

        await setDoc(docRef, configComMetadata, { merge: true });
        console.log('✅ Salvo no Firebase - URL:', `alarme_config/${userId}`);
        atualizarDebug('☁️ Alarmes sincronizados com Firebase');

        // Aguarda um pouco para garantir que Firebase atualizou
        setTimeout(() => {
          enviarAoServiceWorker();
        }, 300);
      } catch (e) {
        console.error('❌ Erro ao sincronizar Firebase:', e);
        atualizarDebug(`❌ Erro Firebase: ${e.message}`);
        // Mesmo com erro, tenta avisar o SW
        enviarAoServiceWorker();
      }
    };

    // Carregar alarmes do localStorage
    const carregarAlarmes = () => {
      const config = JSON.parse(localStorage.getItem('alarme_os_config') || '{}');
      console.log('📂 carregarAlarmes - config:', config);
      if (config.alarmes && Array.isArray(config.alarmes)) {
        alarmes = config.alarmes;
        console.log('✅ Alarmes carregados:', alarmes.length);
      } else {
        console.log('❌ Nenhum alarme no localStorage');
      }
      renderizarAlarmes();
    };

    // Antigo: manter compatibilidade
    const salvarConfiguracao = salvarAlarmes;

    const atualizarHoraDispositivo = () => {
      const agora = new Date();
      const h = String(agora.getHours()).padStart(2, '0');
      const m = String(agora.getMinutes()).padStart(2, '0');
      const horaDispositivo = document.getElementById('alarme-hora-dispositivo');
      if (horaDispositivo) horaDispositivo.textContent = `${h}:${m}`;
    };

    const iniciarRelogio = () => {
      if (intervaloRelogio) clearInterval(intervaloRelogio);

      intervaloRelogio = setInterval(() => {
        if (!toggleAtivo.checked) return;

        const agora = new Date();
        const diaAtual = agora.getDay();
        const hAtual = agora.getHours();
        const mAtual = agora.getMinutes();
        const horaAtualFormatada = String(hAtual).padStart(2, '0') + ':' + String(mAtual).padStart(2, '0');

        const [hInicio, mInicio] = inputHoraInicio.value.split(':').map(Number);
        const horaInicioFormatada = String(hInicio).padStart(2, '0') + ':' + String(mInicio).padStart(2, '0');

        const diaPermitido = Array.from(diasChecks)
          .filter(c => c.checked)
          .map(c => parseInt(c.value))
          .includes(diaAtual);

        // Se chegou na hora início e está dentro de um dia permitido
        if (horaAtualFormatada === horaInicioFormatada && diaPermitido) {
          // Evita disparar várias vezes na mesma hora
          if (ultimoDisparo !== horaInicioFormatada) {
            ultimoDisparo = horaInicioFormatada;
            atualizarDebug(`⏰ HORA CHEGOU! ${horaInicioFormatada} - DISPARANDO!`);
            const volume = parseInt(inputVolume.value) / 100;
            gerarSomAlarme(10, volume);
          }
        }
      }, 1000);
    };

    const carregarConfiguracao = () => {
      try {
        if (!toggleAtivo || !inputHoraInicio) {
          console.warn('⚠️ Elementos ainda não carregados, pulando carregarConfiguracao');
          return;
        }
        const config = JSON.parse(localStorage.getItem('alarme_os_config') || '{}');
        atualizarUiComConfig(config);
        atualizarLabels();
        atualizarHoraDispositivo();
      } catch (e) {
        console.error('❌ Erro ao carregar configuração:', e);
      }
    };

    const atualizarUiComConfig = (config) => {
      if (!config) return;
      if (!toggleAtivo || !inputHoraInicio) {
        console.warn('⚠️ Elementos não encontrados ao atualizar UI');
        return;
      }

      try {
        if (config.ativo !== undefined && toggleAtivo) toggleAtivo.checked = config.ativo;
        if (config.horaInicio && inputHoraInicio) inputHoraInicio.value = config.horaInicio;
        if (config.horaFim && inputHoraFim) inputHoraFim.value = config.horaFim;
        if (config.volume && inputVolume) inputVolume.value = config.volume;
        if (config.anotacao && inputAnotacao) inputAnotacao.value = config.anotacao;
        if (config.dias && config.dias.length > 0 && diasChecks && diasChecks.length > 0) {
          diasChecks.forEach(c => c.checked = config.dias.includes(parseInt(c.value)));
        }
      } catch (e) {
        console.error('❌ Erro ao atualizar UI:', e);
      }
    };

    const sincronizarComFirebase = async () => {
      try {
        // Aguarda elementos estarem prontos
        if (!toggleAtivo || !inputHoraInicio) {
          console.warn('⚠️ Aguardando elementos para sincronizar');
          setTimeout(() => sincronizarComFirebase(), 500);
          return;
        }

        const { onSnapshot } = await import('../../scripts/firebase.js');
        const userId = dashboardShared.uid;
        const docRef = doc(db, 'alarme_config', userId);

        if (unsubscribeFirebase) unsubscribeFirebase();

        console.log('🔄 Configurando listener Firebase para:', userId);

        unsubscribeFirebase = onSnapshot(docRef, (snapshot) => {
          if (snapshot.exists()) {
            const configFirebase = snapshot.data();
            const timestamp = configFirebase.ultimaAtualizacao?.timestamp || Date.now();
            const dispositivoRemoto = configFirebase.ultimaAtualizacao?.dispositivo || 'Outro dispositivo';

            console.log('📡 Alteração detectada do Firebase:', dispositivoRemoto);

            // Verifica se é uma atualização do mesmo dispositivo
            const ehDoMesmDispositivo = dispositivoRemoto.includes(navigator.userAgent.substring(0, 30));

            if (!ehDoMesmDispositivo && !atualizandoDoFirebase) {
              // Vem de outro dispositivo, atualiza!
              console.log('🔄 Recebendo alteração de outro dispositivo - sincronizando...');
              atualizandoDoFirebase = true;

              // Atualiza a lista de alarmes
              if (configFirebase.alarmes && Array.isArray(configFirebase.alarmes)) {
                alarmes = configFirebase.alarmes;
                console.log('✅ Alarmes atualizados:', alarmes.length);
              }

              atualizarUiComConfig(configFirebase);
              localStorage.setItem('alarme_os_config', JSON.stringify(configFirebase));
              renderizarAlarmes();
              atualizarLabels();

              atualizarDebug(`🔄 Sincronizado de outro dispositivo! ${alarmes.length} alarmes`);

              // Avisa o Service Worker sobre a mudança
              if (navigator.serviceWorker?.controller) {
                navigator.serviceWorker.controller.postMessage({
                  tipo: 'atualizarConfig',
                  config: configFirebase,
                  timestamp: timestamp
                });
              }

              atualizandoDoFirebase = false;
            } else {
              // É do próprio dispositivo, só atualiza timestamp
              console.log('✓ Confirmação da própria sincronização');
            }
          } else {
            console.log('📭 Nenhuma config no Firebase ainda');
          }
        }, (error) => {
          console.error('❌ Erro ao escutar Firebase:', error);
          atualizarDebug(`❌ Erro sincronização: ${error.message}`);
        });

        atualizarDebug('☁️ Sincronização ativa - monitorando alterações');
      } catch (e) {
        console.warn('Erro sincronização Firebase:', e);
      }
    };

    const atualizarLabels = () => {
      if (!toggleAtivo || !statusLabel || !volumeLabel || !inputVolume) {
        console.warn('⚠️ Elementos ausentes em atualizarLabels');
        return;
      }
      try {
        statusLabel.textContent = toggleAtivo.checked ? '✓ Ativado' : 'Desativado';
        volumeLabel.textContent = inputVolume.value + '%';
      } catch (e) {
        console.error('❌ Erro em atualizarLabels:', e);
      }
    };

    const tocarSomTeste = () => {
      const volume = parseInt(inputVolume.value) / 100;
      gerarSomAlarme(3, volume);
      atualizarDebug('🔊 Som testado!');
    };

    const gerarSomAlarme = (duracao = 2, vol = 0.8) => {
      if (isTocarAlarm) return;
      isTocarAlarm = true;

      try {
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const freq = 800;
        const tempoFim = audioContext.currentTime + duracao;

        const tocarBeep = () => {
          if (audioContext.currentTime >= tempoFim) {
            isTocarAlarm = false;
            return;
          }

          const osc = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          osc.frequency.value = freq;
          osc.type = 'sine';

          gainNode.gain.setValueAtTime(vol, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);

          osc.connect(gainNode);
          gainNode.connect(audioContext.destination);

          osc.start(audioContext.currentTime);
          osc.stop(audioContext.currentTime + 0.1);

          setTimeout(tocarBeep, 150);
        };

        tocarBeep();
      } catch (e) {
        atualizarDebug('⚠️ Erro ao tocar som');
        isTocarAlarm = false;
      }
    };

    const verificarHorarioEDia = () => {
      const agora = new Date();
      const diaAtual = agora.getDay();
      const hAtual = agora.getHours();
      const mAtual = agora.getMinutes();
      const horaEmMinutos = hAtual * 60 + mAtual;

      const [hInicio, mInicio] = inputHoraInicio.value.split(':').map(Number);
      const [hFim, mFim] = inputHoraFim.value.split(':').map(Number);
      const minInicio = hInicio * 60 + mInicio;
      const minFim = hFim * 60 + mFim;

      const diaPermitido = Array.from(diasChecks)
        .filter(c => c.checked)
        .map(c => parseInt(c.value))
        .includes(diaAtual);

      const dentroHorario = horaEmMinutos >= minInicio && horaEmMinutos <= minFim;

      atualizarDebug(`⏰ Dia ${diaAtual} (${diaPermitido ? 'OK' : 'X'}) | ${String(hAtual).padStart(2,'0')}:${String(mAtual).padStart(2,'0')} (${dentroHorario ? 'OK' : 'X'})`);

      return diaPermitido && dentroHorario;
    };

    const monitorarOS = async () => {
      if (!toggleAtivo.checked) {
        if (unsubscribeOS) unsubscribeOS();
        if (intervaloVerificacao) clearInterval(intervaloVerificacao);
        return;
      }

      try {
        const { onSnapshot, collection, query } = await import('../../scripts/firebase.js');

        const ordersRef = query(collection(db, 'os'), ...injectTenantFilter([]));

        if (unsubscribeOS) unsubscribeOS();

        atualizarDebug('📡 Conectando ao Firestore...');

        unsubscribeOS = onSnapshot(ordersRef, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const osId = change.doc.id;
              const osData = change.doc.data();
              const createdAt = osData.createdAt?.toDate?.() || new Date(osData.createdAt);

              const agora = new Date();
              const diffSegundos = (agora - createdAt) / 1000;

              if (diffSegundos < 15 && ultimaOSDetectada !== osId) {
                ultimaOSDetectada = osId;
                atualizarDebug(`📦 OS nova detectada: ${osId}`);

                if (verificarHorarioEDia()) {
                  atualizarDebug(`🔔 DISPARANDO ALARME!`);
                  const volume = parseInt(inputVolume.value) / 100;
                  gerarSomAlarme(5, volume);
                } else {
                  atualizarDebug(`⏭️ Fora do horário/dia`);
                }
              }
            }
          });
        });

        atualizarDebug('✓ Monitorando OS nova...');
      } catch (e) {
        atualizarDebug(`❌ Erro Firebase: ${e.message}`);
        if (intervaloVerificacao) clearInterval(intervaloVerificacao);
        intervaloVerificacao = setInterval(() => {
          if (toggleAtivo.checked) {
            verificarHorarioEDia();
          }
        }, 5000);
      }
    };

    // Exposição global para funções de alarme (ANTES de carregar)
    window.adicionarAlarme = adicionarAlarme;
    window.abrirAlarme = abrirAlarme;
    window.removerAlarme = removerAlarme;
    window.openAlarmePanel = () => {
      const estava_oculto = panel.style.display === 'none';
      panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';

      // Se estava oculto e agora abriu, re-renderiza a lista
      if (estava_oculto && panel.style.display === 'flex') {
        console.log('📂 Painel aberto, re-renderizando lista...');
        setTimeout(() => renderizarAlarmes(), 50);
      }
    };

    // DEBUG: Função para ver status de sincronização
    window.statusAlarme = () => {
      const userId = dashboardShared.uid;
      const config = JSON.parse(localStorage.getItem('alarme_os_config') || '{}');
      console.log('=== STATUS DO ALARME ===');
      console.log('User ID:', userId);
      console.log('Alarmes salvos:', alarmes.length);
      console.log('Últimas alteração:', config.ultimaAtualizacao?.timestamp);
      console.log('Dispositivo:', config.ultimaAtualizacao?.dispositivo);
      console.log('Service Worker ativo:', !!navigator.serviceWorker?.controller);
      console.log('========================');
      return { userId, alarmes: alarmes.length, config };
    };

    carregarConfiguracao();
    carregarAlarmes();

    // Aguarda um pouco para garantir que alarmes foram carregados
    setTimeout(() => {
      console.log('⏱️ Iniciando sincronização com Firebase...');
      sincronizarComFirebase();

      // Ativa o Service Worker com os alarmes carregados
      if (navigator.serviceWorker?.controller && alarmes.length > 0) {
        const config = {
          alarmes: alarmes,
          atualizadoEm: new Date().toISOString(),
          dispositivo: navigator.userAgent.substring(0, 50)
        };
        navigator.serviceWorker.controller.postMessage({
          tipo: 'atualizarConfig',
          config: config,
          timestamp: Date.now()
        });
        console.log('🚀 Service Worker ativado com', alarmes.length, 'alarmes');
        atualizarDebug(`🚀 Monitorando ${alarmes.length} alarmes em background`);
      }
    }, 500);

    // Botão adicionar usa onclick direto no HTML agora
    console.log('✅ Alarme setup completo - adicionarAlarme exposta no window');

    // Janela Flutuante (abrir em nova janela pequena)
    const abrirJanelaFlutuante = () => {
      try {
        const width = 400;
        const height = 600;
        const left = window.innerWidth - width - 20;
        const top = 100;

        const prefix = location.pathname === '/dev' || location.pathname.startsWith('/dev/') ? '/dev' : '';
        const janela = window.open(
          prefix + '/CRM/pages/dashboard/index.html?mini=1',
          'alarme-flutuante',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
        );

        if (janela) {
          atualizarDebug('📺 Janela flutuante aberta! (Desktop)');
        } else {
          atualizarDebug('⚠️ Popup bloqueado. Desbloqueia popups no navegador.');
        }
      } catch (e) {
        console.warn('Erro janela:', e);
        atualizarDebug('⚠️ Erro ao abrir janela');
      }
    };

    // Notificação Persistente (agora automática ao ativar)
    const mostrarNotificacaoPersistente = async () => {
      if (!('Notification' in window)) {
        atualizarDebug('⚠️ Notificações não suportadas');
        return;
      }

      if (Notification.permission === 'denied') {
        atualizarDebug('⚠️ Notificações bloqueadas nas config');
        return;
      }

      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          atualizarDebug('⚠️ Você bloqueou notificações');
          return;
        }
      }

      // Service Worker mostra a notificação
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          tipo: 'mostrarNotificacao'
        });
        atualizarDebug('📌 Notificação persistente na barra!');
      }
    };

    // Wake Lock para manter tela acordada
    const ativarWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          const wakeLock = await navigator.wakeLock.request('screen');
          atualizarDebug('🔒 Tela será mantida acordada');

          wakeLock.addEventListener('release', () => {
            console.log('Wake Lock liberado');
          });

          // Reacquire se página volta do background
          document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && toggleAtivo.checked) {
              try {
                await navigator.wakeLock.request('screen');
              } catch (e) {
                console.warn('Erro reacquiring wake lock:', e);
              }
            }
          });
        } catch (e) {
          console.warn('Wake Lock não disponível:', e);
        }
      }
    };

    toggleAtivo.addEventListener('change', async () => {
      atualizarLabels();
      salvarConfiguracao();
      if (toggleAtivo.checked) {
        // Pede permissão de notificações
        const temPermissao = await solicitarPermissaoNotificacoes();
        if (!temPermissao) {
          atualizarDebug('⚠️ Notificações bloqueadas. Ative nas config do navegador.');
        }

        // Ativa Wake Lock para manter tela acordada
        await ativarWakeLock();

        // Mostra dica de manter aberto
        const dica = `✓ ATIVADO! Para melhor funcionamento:\n1. Deixe a janela aberta\n2. Ou clique "Janela Flutuante"\n3. Ou clique "Notif. Ativa"\n4. Clique "⚡ Atalho" para acesso rápido`;
        atualizarDebug(dica);

        // Envia config para Service Worker
        const config = {
          horaInicio: inputHoraInicio.value,
          dias: Array.from(diasChecks)
            .filter(c => c.checked)
            .map(c => parseInt(c.value)),
          anotacao: inputAnotacao.value
        };
        enviarConfigSW(config);

        monitorarOS();
        iniciarRelogio();
      } else {
        atualizarDebug('✗ Alarme DESATIVADO');
        if (unsubscribeOS) unsubscribeOS();
        if (intervaloVerificacao) clearInterval(intervaloVerificacao);
        if (intervaloRelogio) clearInterval(intervaloRelogio);
        ultimoDisparo = null;

        // Para o Service Worker
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            tipo: 'pararRelogio'
          });
        }
      }
    });

    inputHoraInicio.addEventListener('change', async () => {
      await salvarConfiguracao();
      atualizarDebug(`⏰ Início: ${inputHoraInicio.value}`);
    });

    inputHoraFim.addEventListener('change', async () => {
      await salvarConfiguracao();
      atualizarDebug(`⏰ Fim: ${inputHoraFim.value}`);
    });

    inputVolume.addEventListener('input', atualizarLabels);
    inputVolume.addEventListener('change', salvarConfiguracao);
    inputAnotacao.addEventListener('input', salvarConfiguracao);

    diasChecks.forEach(check => {
      check.addEventListener('change', () => {
        salvarConfiguracao();
      });
    });

    const btnPiP = document.getElementById('alarme-pip-btn');
    const btnNotif = document.getElementById('alarme-notif-btn');
    const btnAtalho = document.getElementById('alarme-atalho-btn');

    btnTestar.addEventListener('click', tocarSomTeste);
    btnSalvar.addEventListener('click', () => {
      salvarConfiguracao();
      atualizarDebug('💾 Config salva!');
      setTimeout(() => alert('✓ Configuração salva com sucesso!'), 100);
    });

    // Botão Janela Flutuante
    if (btnPiP) {
      btnPiP.addEventListener('click', abrirJanelaFlutuante);
    }

    // Botão Notificação Persistente
    if (btnNotif) {
      btnNotif.addEventListener('click', mostrarNotificacaoPersistente);
    }

    // Botão Atalho
    if (btnAtalho) {
      btnAtalho.addEventListener('click', () => window.criarAtalho());
    }

    btnClose.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    // Abrir/Fechar painel alarme (ANTES de ser usado)
    window.openAlarmePanel = () => {
      panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    };

    // Criar atalho para tela inicial (ANTES de ser usado)
    window.criarAtalho = () => {
      // iOS
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        alert('iOS: Menu Compartilhar → Adicionar à Tela Inicial');
        atualizarDebug('📌 iOS: Use o menu Compartilhar');
        return;
      }

      // Android
      const isAndroid = /Android/.test(navigator.userAgent);
      if (isAndroid) {
        alert('✓ Atalho já criado! Procura "Cell City" na sua tela inicial ou gaveta de apps.\n\nSe não encontrar:\n1. Menu ⋮\n2. "Instalar app"\n3. Confirma');
        atualizarDebug('⚡ Verifique a tela inicial (Android)');
      } else {
        // Desktop
        alert('Desktop: O app já está instalado.\nDesktop não suporta atalho na tela inicial.');
        atualizarDebug('💻 Desktop: Use favoritos do navegador');
      }
    };

    // Verifica se abriu via atalho (abre painel automaticamente)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('alarme') === '1') {
      setTimeout(() => {
        panel.style.display = 'flex';
        atualizarDebug('⚡ Aberto via atalho');
      }, 500);
    }

    // Expõe função globalmente se não foi feito ainda
    if (!window.openAlarmePanel) {
      window.openAlarmePanel = () => {
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
      };
    }

    // Atualiza hora do dispositivo a cada segundo
    setInterval(atualizarHoraDispositivo, 1000);

    if (toggleAtivo.checked) {
      setTimeout(async () => {
        atualizarDebug('🔔 Reiniciando monitor...');

        // Pede permissão de notificações
        await solicitarPermissaoNotificacoes();

        // Envia config para Service Worker
        const config = {
          horaInicio: inputHoraInicio.value,
          dias: Array.from(diasChecks)
            .filter(c => c.checked)
            .map(c => parseInt(c.value)),
          anotacao: inputAnotacao.value
        };
        enviarConfigSW(config);

        monitorarOS();
        iniciarRelogio();
      }, 1000);
    }

    // Listener para mensagens do Service Worker
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.tipo === 'alarmeDisparat') {
          atualizarDebug(`🔔 ALARME DISPAROU: ${event.data.hora}`);
          const volume = parseInt(inputVolume.value) / 100;
          gerarSomAlarme(5, volume);
        }
      });

      // Envia config atualizada ao SW a cada 30 segundos (redundância)
      // Garante que SW sempre tem config mais recente
      setInterval(() => {
        if (toggleAtivo.checked && navigator.serviceWorker.controller) {
          const config = {
            ativo: toggleAtivo.checked,
            horaInicio: inputHoraInicio.value,
            horaFim: inputHoraFim.value,
            volume: inputVolume.value,
            anotacao: inputAnotacao.value,
            dias: Array.from(diasChecks)
              .filter(c => c.checked)
              .map(c => parseInt(c.value)),
            timestamp: Date.now()
          };
          navigator.serviceWorker.controller.postMessage({
            tipo: 'atualizarConfig',
            config: config
          });
        }
      }, 30000); // 30 segundos
    }
  }
};
