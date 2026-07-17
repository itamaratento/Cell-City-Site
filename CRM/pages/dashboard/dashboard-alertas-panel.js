// Painel de Alertas — sino (extraído de dashboard/index.html inline, P2.9 2026-07-16)
(function () {
  var VISTOS_KEY = 'cc_orc_aprovacoes_vistas';
  var sino, badge, panel, body, footer;
  var firstLoad = true;
  var jaSoou = {};
  var osDocs = [];
  var agDocs = [];
  var diagDocs = [];
  var contatosFeitos = new Set();
  var ultimosAprov = [];
  var ultimosPv = [];
  var ultimosAg = [];
  var ultimosDiag = [];
  var PREOS_VISTOS_KEY = 'cc_preos_vistos';
  var preOSDocs = [];
  var ultimosPreOS = [];

  function getVistos() { try { return JSON.parse(localStorage.getItem(VISTOS_KEY) || '[]'); } catch (e) { return []; } }
  function setVistos(a) { try { localStorage.setItem(VISTOS_KEY, JSON.stringify(a)); } catch (e) {} }
  function keyOf(os) { return (os.id || os._id || '') + '|' + (os.orcamentoTimestamp || os.updatedAt || os.orcamentoDataResposta || ''); }
  function pvKey(it) { return 'pv|' + it.osId + '|' + it.prazo; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  function getPreOSVistos() { try { return JSON.parse(localStorage.getItem(PREOS_VISTOS_KEY) || '[]'); } catch (e) { return []; } }
  function setPreOSVistos(a) { try { localStorage.setItem(PREOS_VISTOS_KEY, JSON.stringify(a)); } catch (e) {} }
  function preOSKey(p) { return 'preos|' + (p.id || p._id || ''); }
  function formatarDataHoraPreOS(iso) {
    if (!iso) return '—';
    try { var d = new Date(iso); return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; }
  }

  function getDeliveryDate(os) {
    if (Array.isArray(os.timeline)) {
      var entry = os.timeline.slice().reverse().find(function (t) { return t.text && String(t.text).indexOf('Entregue') !== -1; });
      if (entry && entry.date) return entry.date;
    }
    if (os.status !== 'entregue') return null;
    var ua = os.updatedAt;
    if (!ua) return null;
    if (typeof ua === 'string') return ua;
    if (ua.toDate) return ua.toDate().toISOString();
    return null;
  }
  function calcDias(dateStr) { try { return Math.floor((Date.now() - new Date(dateStr)) / 86400000); } catch (e) { return 0; } }

  function posvendaPendentes() {
    var out = [];
    osDocs.forEach(function (os) {
      if (os.status !== 'entregue') return;
      var dd = getDeliveryDate(os); if (!dd) return;
      var dias = calcDias(dd);
      var osId = os.id || os._id;
      [5, 15, 30].forEach(function (prazo) {
        if (contatosFeitos.has(osId + '_' + prazo)) return;
        var prox = prazo === 5 ? 15 : prazo === 15 ? 30 : 999;
        if (dias < prazo || dias >= prox) return;
        out.push({ osId: osId, prazo: prazo, dias: dias, clientName: os.clientName || 'Cliente', model: os.model || '', phone: os.phone || '' });
      });
    });
    return out;
  }

  function beep() {
    try {
      var raw = localStorage.getItem('cc_config_alertas');
      var somAtivo = raw ? (JSON.parse(raw).som || {}).ativo !== false : false;
      if (!somAtivo) return;
      var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
      var ctx = new Ctx(); var o = ctx.createOscillator(); var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      o.start(); o.stop(ctx.currentTime + 0.27);
      o.onended = function () { try { ctx.close(); } catch (e) {} };
    } catch (e) {}
  }

  function itemHTML(os) {
    var aprov = (os.orcamentoResposta === 'aprovado') || os.status === 'orcamento_aprovado';
    var decisao = aprov ? '✅ Orçamento aprovado' : '❌ Orçamento recusado';
    var cor = aprov ? '#00C853' : '#ef4444';
    var dh = [os.orcamentoDataResposta || '', os.orcamentoHoraResposta || ''].filter(Boolean).join(' ');
    var origem = os.orcamentoOrigem ? (' • ' + esc(os.orcamentoOrigem)) : '';
    var escolha = os.orcamentoEscolhido ? (' • Opção ' + os.orcamentoEscolhido) : '';
    var valor = '';
    if (os.orcamentoEscolhido === '1' && os.orc1Valor) valor = 'R$ ' + Number(os.orc1Valor).toFixed(2);
    else if (os.orcamentoEscolhido === '2' && os.orc2Valor) valor = 'R$ ' + Number(os.orc2Valor).toFixed(2);
    else valor = os.valor ? ('R$ ' + Number(os.valor).toFixed(2)) : '—';
    var obs = os.orcamentoObs ? ('<div class="aprov-item-obs">📝 ' + esc(os.orcamentoObs) + '</div>') : '';
    return '<div class="aprov-item" data-key="' + esc(keyOf(os)) + '" style="border-left:3px solid ' + cor + ';">'
      + '<div class="aprov-item-os">' + esc(os.id || os._id || 'OS') + '</div>'
      + '<div class="aprov-item-cli">' + esc(os.clientName || '—') + '</div>'
      + '<div class="aprov-item-meta">' + esc(dh) + origem + escolha + '</div>'
      + '<div class="aprov-item-valor">' + esc(valor) + '</div>'
      + '<div class="aprov-item-dec" style="color:' + cor + ';">' + decisao + '</div>'
      + obs
      + '<button class="aprov-item-visto" data-key="' + esc(keyOf(os)) + '">✔ Marcar como visualizado</button>'
      + '</div>';
  }

  function pvItemHTML(it) {
    var dl = 'data-osid="' + esc(it.osId) + '" data-prazo="' + it.prazo + '"';
    return '<div class="aprov-item" data-key="' + esc(pvKey(it)) + '" style="border-left:3px solid #f59e0b;">'
      + '<div class="aprov-item-cli aprov-pv-link" ' + dl + ' title="Abrir registro no módulo Pós-venda">' + esc(it.clientName) + '</div>'
      + (it.model ? '<div class="aprov-item-meta">' + esc(it.model) + '</div>' : '')
      + '<div class="aprov-item-dec aprov-pv-link" ' + dl + ' style="color:#f59e0b;" title="Abrir registro no módulo Pós-venda">⏰ Prazo de ' + it.prazo + ' dias atingido</div>'
      + '<div class="aprov-pv-acoes">'
      + '<button class="aprov-pv-abrir-btn" ' + dl + '>📂 Abrir Registro</button>'
      + '<button class="aprov-pv-feito-btn" ' + dl + '>✅ Tarefa realizada</button>'
      + '</div>'
      + '<button class="aprov-item-visto" data-key="' + esc(pvKey(it)) + '">✔ Marcar como visualizado</button>'
      + '</div>';
  }

  function findPv(osid, prazo) {
    return ultimosPv.find(function (x) { return String(x.osId) === String(osid) && String(x.prazo) === String(prazo); });
  }

  function abrirRegistroPv(osid, prazo) {
    if (!osid) return;
    window.location.href = '../../pages/pos-venda/index.html?osid=' + encodeURIComponent(osid) + (prazo ? '&prazo=' + encodeURIComponent(prazo) : '');
  }

  function marcarTarefaRealizada(it) {
    if (!it) return;
    if (!confirm('Marcar como contato realizado?\n\nIsso registra a ação no Pós-venda e remove o alerta do sino.')) return;
    var dbx = window.dbFirestore, FB = window.FirebaseFirestore;
    if (!dbx || !FB || !FB.setDoc) { console.warn('[Alertas] Firestore indisponível.'); return; }
    var key = it.osId + '_' + it.prazo;
    if (contatosFeitos.has(key)) { recompute(); return; }
    FB.setDoc(FB.doc(dbx, 'posvenda_contatos', key), (window.ccTenant ? window.ccTenant.tData : Object)({
      osId: it.osId, clientName: it.clientName || '', phone: it.phone || '', model: it.model || '',
      prazo: it.prazo, emoji: '✅', resultado: 'Contato realizado (via Painel de Alertas)',
      dataContato: new Date().toISOString(), createdAt: FB.serverTimestamp()
    })).then(function () { contatosFeitos.add(key); recompute(); })
      .catch(function (e) { console.warn('[Alertas] erro:', e && e.message); alert('Não foi possível registrar.'); });
  }

  var AG_TIPO = { celular: '📱 Celular', notebook: '💻 Notebook', impressora: '🖨️ Impressora', outro: '🔧 Outro' };
  var AG_MOTIVO = { avaliacao: 'Avaliação / Diagnóstico', troca_tela: 'Troca de Tela', troca_bateria: 'Troca de Bateria', nao_liga: 'Não Liga', molhou: 'Molhou', atualizacao: 'Atualização', outro: 'Outro' };
  function agKey(a) { return 'ag|' + (a._id || a.id || ''); }
  function fmtDataAg(d) { return (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? d.split('-').reverse().join('/') : (d || 'Sem data'); }

  function agItemHTML(a) {
    var id = a._id || a.id;
    var dl = 'data-agid="' + esc(id) + '"';
    var tipo = AG_TIPO[a.tipoEquipamento] || esc(a.tipoEquipamento || '');
    var motivo = AG_MOTIVO[a.motivo] || esc(a.motivo || '');
    return '<div class="aprov-item" data-key="' + esc(agKey(a)) + '" style="border-left:3px solid #f59e0b;">'
      + '<div class="aprov-item-cli">🔔 ' + esc(a.clientName || a.nome || 'Cliente') + '</div>'
      + '<div class="aprov-item-meta">📅 ' + fmtDataAg(a.data) + (a.horario ? ' • ⏰ ' + esc(a.horario) : '') + '</div>'
      + '<div class="aprov-item-meta">' + (tipo || '') + (motivo ? (tipo ? ' • ' : '') + motivo : '') + '</div>'
      + (a.observacoes ? '<div class="aprov-item-meta">📝 ' + esc(a.observacoes) + '</div>' : '')
      + '<div class="aprov-item-dec" style="color:#f59e0b;">⏳ Aguardando Confirmação</div>'
      + '<div class="aprov-pv-acoes">'
      + '<button class="aprov-ag-confirmar-btn" ' + dl + '>✅ Confirmar</button>'
      + '<button class="aprov-ag-reagendar-btn" ' + dl + '>🔄 Reagendar</button>'
      + '<button class="aprov-ag-recusar-btn" ' + dl + '>❌ Recusar</button>'
      + '</div>'
      + '</div>';
  }

  function atualizarAg(id, campos) {
    var dbx = window.dbFirestore, FB = window.FirebaseFirestore;
    if (!dbx || !FB || !FB.setDoc) { alert('Firestore indisponível.'); return; }
    FB.setDoc(FB.doc(dbx, 'agendamentos', id), campos, { merge: true })
      .catch(function (e) { console.warn('[Alertas] erro agendamento:', e && e.message); alert('Não foi possível atualizar.'); });
  }
  function agConfirmar(id) { if (!id) return; if (!confirm('Confirmar este agendamento?')) return; atualizarAg(id, { status: 'confirmado' }); }
  function agReagendar(id) {
    if (!id) return;
    var data = prompt('Nova data (DD/MM/AAAA):'); if (!data) return;
    var iso = data, m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) iso = m[3] + '-' + m[2] + '-' + m[1];
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { alert('Data inválida.'); return; }
    var hora = prompt('Novo horário (HH:MM):');
    if (!hora || !/^\d{1,2}:\d{2}$/.test(hora)) { if (hora !== null) alert('Horário inválido.'); return; }
    atualizarAg(id, { status: 'reagendado', data: iso, horario: hora, observacaoAdmin: 'Reagendado para ' + fmtDataAg(iso) + ' às ' + hora + '.' });
  }
  function agRecusar(id) {
    if (!id) return;
    var motivo = prompt('Motivo da recusa:'); if (motivo === null) return;
    atualizarAg(id, { status: 'cancelado', observacaoAdmin: motivo.trim() || 'Horário indisponível' });
  }

  function diagKey(s) { return 'diag|' + (s._id || s.id || ''); }
  function diagEquip(s) { var partes = [s.marca, s.modelo].filter(Boolean).join(' ').trim(); return partes || AG_TIPO[s.tipoEquipamento] || esc(s.tipoEquipamento || 'Equipamento não informado'); }
  function diagItemHTML(s) {
    var id = s._id || s.id;
    var dl = 'data-diagid="' + esc(id) + '"';
    var painelUrl = '../../pages/portal-cliente/admin.html';
    return '<div class="aprov-item" data-key="' + esc(diagKey(s)) + '" style="border-left:3px solid #00C853;">'
      + '<div class="aprov-item-cli">🔔 Nova Solicitação de Diagnóstico</div>'
      + '<div class="aprov-item-meta">👤 Cliente: ' + esc(s.clientName || s.nome || 'Cliente') + '</div>'
      + '<div class="aprov-item-meta">🔧 Equipamento: ' + esc(diagEquip(s)) + '</div>'
      + (s.descricao ? '<div class="aprov-item-meta">📝 Motivo: ' + esc(s.descricao) + '</div>' : '')
      + (s.telefone ? '<div class="aprov-item-meta">📞 ' + esc(s.telefone) + '</div>' : '')
      + '<div class="aprov-item-dec" style="color:#00C853;">⏳ Aguardando Atendimento</div>'
      + '<div class="aprov-pv-acoes">'
      + '<button class="aprov-diag-atender-btn" ' + dl + '>✅ Marcar como Atendido</button>'
      + '<a class="aprov-pv-abrir-btn" href="' + painelUrl + '" target="_blank" rel="noopener">📋 Abrir Painel</a>'
      + '</div>'
      + '</div>';
  }
  function atualizarDiag(id, campos) {
    var dbx = window.dbFirestore, FB = window.FirebaseFirestore;
    if (!dbx || !FB || !FB.setDoc) { alert('Firestore indisponível.'); return; }
    FB.setDoc(FB.doc(dbx, 'solicitacoes_diagnostico', id), campos, { merge: true })
      .catch(function (e) { console.warn('[Alertas] erro diag:', e && e.message); alert('Não foi possível atualizar.'); });
  }
  function diagAtender(id) { if (!id) return; if (!confirm('Marcar esta solicitação como atendida?')) return; atualizarDiag(id, { status: 'concluido', respondido: true }); }

  function preOSItemHTML(p) {
    var id = p.id || p._id;
    var cliente = p.cliente || {};
    var aparelho = p.aparelho || {};
    var nome = cliente.nome || 'Cliente não informado';
    var modelo = [aparelho.marca, aparelho.modelo].filter(Boolean).join(' ') || 'Equipamento não informado';
    var problema = p.problema || '';
    var data = formatarDataHoraPreOS(p.criadoEmISO || p.criadoEm);
    return '<div class="aprov-item" data-key="' + esc(preOSKey(p)) + '" style="border-left:3px solid #00C853;">'
      + '<div class="aprov-item-cli">🆕 Novo Atendimento do Site</div>'
      + '<div class="aprov-item-meta">👤 Cliente: ' + esc(nome) + '</div>'
      + '<div class="aprov-item-meta">🔧 Equipamento: ' + esc(modelo) + '</div>'
      + (problema ? '<div class="aprov-item-meta">📝 Problema: ' + esc(problema) + '</div>' : '')
      + '<div class="aprov-item-meta">⏰ Recebido em: ' + esc(data) + '</div>'
      + '<div class="aprov-item-dec" style="color:#00C853;">⏳ Aguardando Conversão</div>'
      + '<button class="aprov-item-visto" data-key="' + esc(preOSKey(p)) + '">✔ Marcar como visualizado</button>'
      + '</div>';
  }

  function recompute() {
    if (!badge) return;
    var vistos = getVistos();
    var aprovPend = osDocs.filter(function (os) {
      return (os.orcamentoResposta === 'aprovado' || os.orcamentoResposta === 'recusado'
          || os.status === 'orcamento_aprovado' || os.status === 'orcamento_recusado')
          && !os.orcamentoVisto;
    }).filter(function (os) { return vistos.indexOf(keyOf(os)) < 0; });
    aprovPend.sort(function (a, b) {
      var ta = a.orcamentoTimestamp || a.updatedAt || ''; var tb = b.orcamentoTimestamp || b.updatedAt || '';
      return tb > ta ? 1 : (tb < ta ? -1 : 0);
    });
    var pvPend = posvendaPendentes().filter(function (it) { return vistos.indexOf(pvKey(it)) < 0; });
    pvPend.sort(function (a, b) { return b.dias - a.dias; });
    var agPend = agDocs.filter(function (a) { return a.status === 'aguardando'; });
    agPend.sort(function (a, b) { return (a.data || '9999-99-99') < (b.data || '9999-99-99') ? -1 : 1; });
    var diagPend = diagDocs.filter(function (s) { return (s.status || 'pendente') !== 'concluido'; });
    diagPend.sort(function (a, b) {
      var ta = (a.createdAt && a.createdAt.seconds) || 0; var tb = (b.createdAt && b.createdAt.seconds) || 0;
      return tb - ta;
    });
    var preOSVistos = getPreOSVistos();
    var preOSPend = preOSDocs.filter(function (p) {
      return (p.status || 'AGUARDANDO_CONVERSAO') === 'AGUARDANDO_CONVERSAO'
          && preOSVistos.indexOf(preOSKey(p)) < 0;
    });
    preOSPend.sort(function (a, b) {
      var ta = (a.criadoEm && a.criadoEm.seconds) || (new Date(a.criadoEmISO || 0).getTime() / 1000) || 0;
      var tb = (b.criadoEm && b.criadoEm.seconds) || (new Date(b.criadoEmISO || 0).getTime() / 1000) || 0;
      return tb - ta;
    });
    ultimosAprov = aprovPend; ultimosPv = pvPend; ultimosAg = agPend; ultimosDiag = diagPend; ultimosPreOS = preOSPend;
    var total = aprovPend.length + pvPend.length + agPend.length + diagPend.length + preOSPend.length;
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
    if (sino) sino.classList.toggle('tem-alerta', total > 0);
    if (!firstLoad) {
      var novo = aprovPend.some(function (os) { return !jaSoou[keyOf(os)]; })
              || pvPend.some(function (it) { return !jaSoou[pvKey(it)]; })
              || agPend.some(function (a) { return !jaSoou[agKey(a)]; })
              || diagPend.some(function (s) { return !jaSoou[diagKey(s)]; })
              || preOSPend.some(function (p) { return !jaSoou[preOSKey(p)]; });
      if (novo) beep();
    }
    aprovPend.forEach(function (os) { jaSoou[keyOf(os)] = true; });
    pvPend.forEach(function (it) { jaSoou[pvKey(it)] = true; });
    agPend.forEach(function (a) { jaSoou[agKey(a)] = true; });
    diagPend.forEach(function (s) { jaSoou[diagKey(s)] = true; });
    preOSPend.forEach(function (p) { jaSoou[preOSKey(p)] = true; });
    firstLoad = false;
    if (!total) {
      body.innerHTML = '<div class="aprov-vazio">Nenhum alerta pendente de visualização.</div>';
      footer.style.display = 'none';
    } else {
      var html = '';
      if (preOSPend.length) html += '<div class="aprov-secao">🆕 Novos Atendimentos do Site</div>' + preOSPend.map(preOSItemHTML).join('');
      if (diagPend.length) html += '<div class="aprov-secao">🔧 Solicitações de Diagnóstico</div>' + diagPend.map(diagItemHTML).join('');
      if (agPend.length) html += '<div class="aprov-secao">📅 Agendamentos</div>' + agPend.map(agItemHTML).join('');
      if (aprovPend.length) html += '<div class="aprov-secao">Aprovações</div>' + aprovPend.map(itemHTML).join('');
      if (pvPend.length) html += '<div class="aprov-secao">Pós-venda</div>' + pvPend.map(pvItemHTML).join('');
      body.innerHTML = html;
      footer.style.display = (aprovPend.length || pvPend.length || preOSPend.length) ? '' : 'none';
    }
  }

  function salvarVistoFirestore(key) {
    var db = window.dbFirestore, FB = window.FirebaseFirestore;
    if (!db || !FB || !FB.setDoc) return;
    if (key.indexOf('pv|') === 0) {
      var parts = key.split('|'); var osId = parts[1]; var prazo = parseInt(parts[2], 10);
      var it = ultimosPv.find(function (x) { return String(x.osId) === String(osId) && String(x.prazo) === String(prazo); });
      var fkey = osId + '_' + prazo;
      if (contatosFeitos.has(fkey)) return;
      FB.setDoc(FB.doc(db, 'posvenda_contatos', fkey), (window.ccTenant ? window.ccTenant.tData : Object)({
        osId: osId, clientName: (it && it.clientName) || '', phone: (it && it.phone) || '',
        model: (it && it.model) || '', prazo: prazo, emoji: '👁️',
        resultado: 'Visualizado (sem ação imediata)',
        dataContato: new Date().toISOString(), createdAt: FB.serverTimestamp()
      })).catch(function (e) { console.warn('[Alertas] erro pv visto:', e && e.message); });
    } else {
      var osId2 = key.split('|')[0];
      if (!osId2) return;
      FB.setDoc(FB.doc(db, 'os', osId2), { orcamentoVisto: true }, { merge: true })
        .catch(function (e) { console.warn('[Alertas] erro os visto:', e && e.message); });
    }
  }

  function marcarVisto(key) {
    var v = getVistos(); if (v.indexOf(key) < 0) { v.push(key); setVistos(v); }
    salvarVistoFirestore(key); recompute();
  }

  function bind() {
    sino = document.getElementById('aprov-sino');
    badge = document.getElementById('aprov-badge');
    panel = document.getElementById('aprov-panel');
    body = document.getElementById('aprov-panel-body');
    footer = document.getElementById('aprov-panel-footer');
    if (!sino || !panel) return false;
    sino.addEventListener('click', function (e) { e.stopPropagation(); panel.classList.toggle('open'); });
    document.getElementById('aprov-panel-close').addEventListener('click', function () { panel.classList.remove('open'); });
    document.addEventListener('click', function (e) {
      if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== sino) panel.classList.remove('open');
    });
    body.addEventListener('click', function (e) {
      var visto = e.target.closest('.aprov-item-visto');
      if (visto && visto.dataset.key && visto.dataset.key.indexOf('preos|') === 0) {
        var vv = getPreOSVistos();
        if (vv.indexOf(visto.dataset.key) < 0) { vv.push(visto.dataset.key); setPreOSVistos(vv); }
        recompute();
        var preOSId = visto.dataset.key.replace('preos|', '');
        var dbx = window.dbFirestore, FBx = window.FirebaseFirestore;
        if (dbx && FBx && FBx.setDoc && preOSId)
          FBx.setDoc(FBx.doc(dbx, 'pre_os', preOSId), { status: 'VISUALIZADO' }, { merge: true })
            .catch(function (e) { console.warn('[Alertas] erro pré-OS visto:', e && e.message); });
        return;
      }
      if (visto) { marcarVisto(visto.dataset.key); return; }
      var feito = e.target.closest('.aprov-pv-feito-btn');
      if (feito) { marcarTarefaRealizada(findPv(feito.dataset.osid, feito.dataset.prazo)); return; }
      var abrir = e.target.closest('.aprov-pv-abrir-btn, .aprov-pv-link');
      if (abrir) { abrirRegistroPv(abrir.dataset.osid, abrir.dataset.prazo); return; }
      var agC = e.target.closest('.aprov-ag-confirmar-btn');
      if (agC) { agConfirmar(agC.dataset.agid); return; }
      var agR = e.target.closest('.aprov-ag-reagendar-btn');
      if (agR) { agReagendar(agR.dataset.agid); return; }
      var agX = e.target.closest('.aprov-ag-recusar-btn');
      if (agX) { agRecusar(agX.dataset.agid); return; }
      var diagA = e.target.closest('.aprov-diag-atender-btn');
      if (diagA) { diagAtender(diagA.dataset.diagid); return; }
    });
    document.getElementById('aprov-marcar-todos').addEventListener('click', function () {
      var v = getVistos();
      ultimosAprov.forEach(function (os) { var k = keyOf(os); if (v.indexOf(k) < 0) { v.push(k); salvarVistoFirestore(k); } });
      ultimosPv.forEach(function (it) { var k = pvKey(it); if (v.indexOf(k) < 0) { v.push(k); salvarVistoFirestore(k); } });
      var pv = getPreOSVistos();
      var dbx = window.dbFirestore, FBx = window.FirebaseFirestore;
      ultimosPreOS.forEach(function (p) {
        var k = preOSKey(p); if (pv.indexOf(k) < 0) pv.push(k);
        var pid = p._id || p.id || '';
        if (dbx && FBx && FBx.setDoc && pid)
          FBx.setDoc(FBx.doc(dbx, 'pre_os', pid), { status: 'VISUALIZADO' }, { merge: true })
            .catch(function (e) { console.warn('[Alertas] erro pré-OS todos:', e && e.message); });
      });
      setPreOSVistos(pv); setVistos(v); recompute();
    });
    return true;
  }

  function start() {
    var db = window.dbFirestore, FB = window.FirebaseFirestore;
    if (!db || !FB) return;
    try {
      FB.onSnapshot(FB.query(FB.collection(db, 'os'), ...(window.ccTenant ? window.ccTenant.injectTenantFilter([]) : [])), function (snap) {
        osDocs = []; snap.forEach(function (d) { var os = d.data(); os._id = d.id; osDocs.push(os); }); recompute();
      }, function (err) { console.warn('[Alertas] listener os:', err && err.message); });
      FB.onSnapshot(FB.query(FB.collection(db, 'posvenda_contatos'), ...(window.ccTenant ? window.ccTenant.injectTenantFilter([]) : [])), function (snap) {
        contatosFeitos = new Set();
        snap.forEach(function (d) { var c = d.data(); if (c.ativo === false) return; contatosFeitos.add(c.osId + '_' + c.prazo); }); recompute();
      }, function (err) { console.warn('[Alertas] listener pv:', err && err.message); });
      FB.onSnapshot(FB.query(FB.collection(db, 'agendamentos'), ...(window.ccTenant ? window.ccTenant.injectTenantFilter([]) : [])), function (snap) {
        agDocs = []; snap.forEach(function (d) { var a = d.data(); a._id = d.id; agDocs.push(a); }); recompute();
      }, function (err) { console.warn('[Alertas] listener ag:', err && err.message); });
      FB.onSnapshot(FB.query(FB.collection(db, 'solicitacoes_diagnostico'), ...(window.ccTenant ? window.ccTenant.injectTenantFilter([]) : [])), function (snap) {
        diagDocs = []; snap.forEach(function (d) { var s = d.data(); s._id = d.id; diagDocs.push(s); }); recompute();
      }, function (err) { console.warn('[Alertas] listener diag:', err && err.message); });
      // Achado crítico (Auditoria Técnica Independente 2026-07-17): único
      // listener deste bloco sem o filtro de tenant já aplicado às 4
      // coleções irmãs acima (os, posvenda_contatos, agendamentos, diag).
      FB.onSnapshot(FB.query(FB.collection(db, 'pre_os'), ...(window.ccTenant ? window.ccTenant.injectTenantFilter([]) : [])), function (snap) {
        preOSDocs = []; snap.forEach(function (d) { var p = d.data(); p._id = d.id; preOSDocs.push(p); }); recompute();
      }, function (err) { console.warn('[Alertas] listener pre_os:', err && err.message); });
    } catch (e) { console.warn('[Alertas] start falhou:', e); }
  }

  function boot() {
    if (!bind()) return;
    window.addEventListener('kernel-ready', function() { start(); }, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
