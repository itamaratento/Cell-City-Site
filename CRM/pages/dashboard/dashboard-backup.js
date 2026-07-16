// Modal de Backup (extraído de dashboard/index.html inline, P2.9 2026-07-16)
(function () {
  var SLOTS = {
    DIARIO:         ['01-DIARIO',        '02-DIARIO'],
    SEMANAL:        ['03-SEMANAL',       '04-SEMANAL'],
    MENSAL:         ['05-MENSAL',        '06-MENSAL'],
    GRANDE_MUDANCA: ['07-GRANDE-MUDANCA','08-GRANDE-MUDANCA'],
  };
  var COLECOES = [
    'os','caixa_lancamentos','clientes','agendamentos','pre_os',
    'estoque_produtos','posvenda_contatos','solicitacoes_diagnostico',
    'produtos','diario_registros','informacoes','backup_logs',
  ];

  function nextSlot(tipo) {
    var slots = SLOTS[tipo];
    var last  = localStorage.getItem('cc_bk_' + tipo);
    return last === slots[0] ? slots[1] : slots[0];
  }

  function setStatus(msg, state) {
    var el = document.getElementById('backup-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = state === 'ok' ? '#00c853' : state === 'err' ? '#f44336' : '#888';
  }

  function setBtns(disabled) {
    document.querySelectorAll('.bk-tipo-btn').forEach(function (b) { b.disabled = disabled; });
  }

  function updateSlotPreview() {
    var el = document.getElementById('bk-slot-preview');
    if (!el) return;
    var parts = Object.keys(SLOTS).map(function (t) {
      return '<b>' + t.replace('_', ' ') + '</b>: próximo slot → <span>' + nextSlot(t) + '</span>';
    });
    el.innerHTML = parts.join(' &nbsp;|&nbsp; ');
  }

  window.openBackupModal = function () {
    var m = document.getElementById('backup-modal');
    if (m) { m.style.display = 'flex'; setStatus(''); setBtns(false); updateSlotPreview(); }
  };

  window.closeBackupModal = function () {
    var m = document.getElementById('backup-modal');
    if (m) m.style.display = 'none';
  };

  window.runBackup = async function (tipo) {
    var db = window.dbFirestore, FB = window.FirebaseFirestore;
    if (!db || !FB || !FB.getDocs || !FB.collection) {
      setStatus('Firestore não disponível. Aguarde a conexão.', 'err'); return;
    }
    setBtns(true);
    setStatus('⏳ Exportando dados do Firestore...');
    var slot  = nextSlot(tipo);
    var agora = new Date();
    var data  = {};
    try {
      for (var i = 0; i < COLECOES.length; i++) {
        var col = COLECOES[i];
        try {
          var colRef = (col === 'pre_os' || !window.ccTenant)
            ? FB.collection(db, col)
            : FB.query(FB.collection(db, col), ...window.ccTenant.injectTenantFilter([]));
          var snap = await FB.getDocs(colRef);
          data[col] = [];
          snap.forEach(function (d) { var obj = d.data(); obj._id = d.id; data[col].push(obj); });
        } catch (e) {
          data[col] = { _erro: e.message };
        }
      }
      var totalDocs = Object.values(data).reduce(function (s, v) {
        return s + (Array.isArray(v) ? v.length : 0);
      }, 0);
      var meta = {
        tipo: tipo, slot: slot,
        dataISO: agora.toISOString(),
        data: agora.toLocaleDateString('pt-BR'),
        hora: agora.toLocaleTimeString('pt-BR'),
        totalDocs: totalDocs, versao: '2.0', sistema: 'Cell City Gestão Empresarial',
      };
      var payload = { __meta: meta };
      Object.keys(data).forEach(function (k) { payload[k] = data[k]; });
      var json = JSON.stringify(payload, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url  = URL.createObjectURL(blob);
      var nome = 'backup_' + tipo + '.json';
      var a = document.createElement('a');
      a.href = url; a.download = nome;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      localStorage.setItem('cc_bk_' + tipo, slot);
      try {
        await FB.addDoc(FB.collection(db, 'backup_logs'), (window.ccTenant ? window.ccTenant.tData : Object)({
          tipo: tipo, slot: slot,
          dataISO: agora.toISOString(),
          data: agora.toLocaleDateString('pt-BR'),
          hora: agora.toLocaleTimeString('pt-BR'),
          totalDocs: totalDocs, arquivo: nome,
          colecoes: COLECOES,
        }));
      } catch (e) { console.warn('[Backup] log Firestore falhou:', e.message); }
      setStatus('✅ ' + nome + '\n' + totalDocs + ' documentos exportados', 'ok');
      updateSlotPreview();
    } catch (e) {
      setStatus('❌ Erro: ' + e.message, 'err');
    } finally {
      setBtns(false);
    }
  };

  document.addEventListener('click', function (e) {
    if (e.target === document.getElementById('backup-modal')) closeBackupModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeBackupModal();
  });
})();
