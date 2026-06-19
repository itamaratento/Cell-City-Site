import {
    db, collection, doc, getDocs, setDoc, deleteDoc,
    serverTimestamp, query, orderBy, where, authReady
} from '../../scripts/firebase.js';

const COL          = 'alertas_usuario';
const CMDS_CACHE   = 'cc_comandos_cache';
const CACHE_KEY    = 'cc_alertas_cache';
const CFG_KEY      = 'cc_alertas_config';
const BADGE_KEY    = 'cc_alertas_badge';

// ── Estado ────────────────────────────────────────────────────────────────────
const st = {
    lista:    [],          // todos os alertas
    comandos: [],          // cache de comandos para vínculo
    secao:    'home',
    cal:      { ano: 0, mes: 0 },
    calView:  'mes',      // 'mes' | 'semana'
    calDiaSel: null,
    calSemanaOffset: 0,    // semanas para navegação na visão Semana
};

// ── Helpers de data ───────────────────────────────────────────────────────────
function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function agoraHHMM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function fmtData(iso) {
    if (!iso) return '—';
    const [y,m,d] = iso.split('-');
    return `${d}/${m}/${y}`;
}
function fmtMesAno(ano, mes) {
    return new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
}
function calcProxima(alerta) {
    let base = alerta.data;
    if (!base) return '';
    const hoje = hojeISO();
    if (alerta.repeticao === 'nenhuma') return base;
    let d = new Date(base + 'T12:00:00');
    const now = new Date();
    while (d <= now) {
        const dias = {
            diario:    1,
            semanal:   7,
            mensal:    30,
            quinzenal: 15,
            trinta:    30,
            custom:    parseInt(alerta.customDias) || 7,
        }[alerta.repeticao] || 1;
        if (alerta.repeticao === 'mensal') {
            d.setMonth(d.getMonth() + 1);
        } else {
            d.setDate(d.getDate() + dias);
        }
    }
    return d.toISOString().slice(0,10);
}

// ── Esc ───────────────────────────────────────────────────────────────────────
function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer;
function toast(msg) {
    const t = document.getElementById('al-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.add('hidden'), 2800);
}

// ── Firestore ─────────────────────────────────────────────────────────────────
async function carregar() {
    try {
        const snap = await getDocs(query(collection(db, COL), orderBy('data'), orderBy('hora')));
        st.lista = [];
        snap.forEach(d => st.lista.push({ id: d.id, ...d.data() }));
        localStorage.setItem(CACHE_KEY, JSON.stringify(st.lista));
    } catch {
        st.lista = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    }
    render();
    atualizarBadges();
    _salvarBadgeGlobal();
}

function carregarComandos() {
    const raw = localStorage.getItem(CMDS_CACHE);
    st.comandos = raw ? JSON.parse(raw) : [];
    _popularSelectComandos();
}

function _popularSelectComandos() {
    const sel = document.getElementById('al-f-comando');
    if (!sel) return;
    const opt0 = '<option value="">— Nenhum —</option>';
    const opts = st.comandos.map(c =>
        `<option value="${esc(c.id)}">${esc(c.titulo)}${c.categoria ? ' · ' + esc(c.categoria) : ''}</option>`
    ).join('');
    sel.innerHTML = opt0 + opts;
}

async function persistir(dados) {
    const id   = dados.id || doc(collection(db, COL)).id;
    const ref  = doc(db, COL, id);
    const obj  = { ...dados, id, atualizadoEm: serverTimestamp(), atualizadoEmISO: new Date().toISOString() };
    if (!dados.criadoEmISO) {
        obj.criadoEm    = serverTimestamp();
        obj.criadoEmISO = new Date().toISOString();
    }
    await setDoc(ref, obj, { merge: true });
    return { ...obj };
}

// ── Navegação ─────────────────────────────────────────────────────────────────
const SECAO_TITULO = {
    home: '🏠 Home', hoje: '📅 Alertas de Hoje', agendados: '⏰ Agendados',
    recorrentes: '🔁 Recorrentes', concluidos: '✅ Concluídos',
    comandos: '⚡ Comandos', tarefas: '✅ Tarefas',
    calendario: '🗓️ Calendário', configuracoes: '⚙️ Configurações',
};

function navegar(secao) {
    st.secao = secao;
    document.querySelectorAll('.al-sb-item').forEach(el =>
        el.classList.toggle('active', el.dataset.nav === secao)
    );
    document.querySelectorAll('.al-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${secao}`)?.classList.add('active');
    const tit = document.getElementById('al-topbar-titulo');
    if (tit) tit.textContent = SECAO_TITULO[secao] || secao;
    document.getElementById('al-sidebar')?.classList.remove('open');
    document.getElementById('al-overlay')?.classList.remove('open');
    if (secao === 'calendario') renderCalendario();
    else render();
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
    renderHome();
    renderLista('hoje',       listaHoje());
    renderLista('agendados',  listaAgendados());
    renderLista('recorrentes',listaRecorrentes());
    renderLista('concluidos', listaConcluidos());
    renderLista('comandos',   listaComandos());
    renderLista('tarefas',    listaTarefas());
    atualizarBadges();
}

// Determina se um alerta já disparou (data+hora <= agora)
function jaDisp(a) {
    const h  = hojeISO();
    const hm = agoraHHMM();
    const de = dataEfetiva(a);
    if (!de) return false;
    if (de < h)  return true;                        // data passada → vencido, conta como disparado
    if (de > h)  return false;                       // data futura
    return (a.hora || '00:00') <= hm;               // hoje: só se hora já passou
}

// "Hoje" = alertas do dia atual CUJO HORÁRIO JÁ CHEGOU
function listaHoje()        { const h=hojeISO(); const hm=agoraHHMM(); return st.lista.filter(a=>a.status!=='concluido'&&dataEfetiva(a)===h&&(a.hora||'00:00')<=hm).sort(sortHora); }
// "Agendados" = data futura OU hoje mas horário ainda não chegou
function listaAgendados()   { const h=hojeISO(); const hm=agoraHHMM(); return st.lista.filter(a=>a.status!=='concluido'&&(dataEfetiva(a)>h||(dataEfetiva(a)===h&&(a.hora||'00:00')>hm))).sort(sortData); }
function listaRecorrentes() { return st.lista.filter(a=>a.status!=='concluido'&&a.repeticao&&a.repeticao!=='nenhuma').sort(sortData); }
function listaConcluidos()  { return st.lista.filter(a=>a.status==='concluido').sort((a,b)=>(b.atualizadoEmISO||'').localeCompare(a.atualizadoEmISO||'')); }
function listaVencidos()    { const h=hojeISO(); return st.lista.filter(a=>a.status!=='concluido'&&dataEfetiva(a)<h); }
function listaComandos()   { return st.lista.filter(a=>a.status!=='concluido'&&a.tipo==='comando'&&jaDisp(a)).sort(sortData); }
function listaTarefas()    { return st.lista.filter(a=>a.status!=='concluido'&&a.tipo==='tarefa'&&jaDisp(a)).sort(sortData); }
// Ativos = disparados (usados para badge/sino)
function listaAtivos()     { return st.lista.filter(a=>a.status!=='concluido'&&jaDisp(a)); }

function dataEfetiva(a) {
    if (a.repeticao && a.repeticao !== 'nenhuma') return calcProxima(a);
    return a.data || '';
}
function sortHora(a,b)  { return (a.hora||'').localeCompare(b.hora||''); }
function sortData(a,b)  { const da=dataEfetiva(a), db2=dataEfetiva(b); return da.localeCompare(db2)||sortHora(a,b); }

function renderHome() {
    const hoje   = listaHoje();
    const prox   = listaAgendados().slice(0,5);
    const venc   = listaVencidos();
    const cmds   = listaComandos().slice(0,5);
    const tarefs = listaTarefas().slice(0,5);

    // Próximo alerta a disparar
    const todosPendentes = st.lista.filter(a=>a.status!=='concluido').sort(sortData);
    const proximoAlerta = todosPendentes[0] || null;

    // Stats
    const statsEl = document.getElementById('home-stats');
    if (statsEl) {
        statsEl.innerHTML = `
        <div class="al-stat-card hoje" onclick="Alertas.navegar('hoje')">
            <span class="al-stat-icon">📅</span>
            <span class="al-stat-num">${hoje.length}</span>
            <span class="al-stat-lbl">Hoje</span>
        </div>
        <div class="al-stat-card pendente" onclick="Alertas.navegar('agendados')">
            <span class="al-stat-icon">⏰</span>
            <span class="al-stat-num">${listaAgendados().length}</span>
            <span class="al-stat-lbl">Agendados</span>
        </div>
        <div class="al-stat-card vencido" onclick="Alertas.navegar('agendados')">
            <span class="al-stat-icon">🚨</span>
            <span class="al-stat-num">${venc.length}</span>
            <span class="al-stat-lbl">Vencidos</span>
        </div>
        <div class="al-stat-card cmd" onclick="Alertas.navegar('comandos')">
            <span class="al-stat-icon">⚡</span>
            <span class="al-stat-num">${cmds.length}</span>
            <span class="al-stat-lbl">Comandos</span>
        </div>
        <div class="al-stat-card tarefa" onclick="Alertas.navegar('tarefas')">
            <span class="al-stat-icon">✅</span>
            <span class="al-stat-num">${tarefs.length}</span>
            <span class="al-stat-lbl">Tarefas</span>
        </div>`;
        // Próximo alerta — card full-width
        if (proximoAlerta) {
            const pe = dataEfetiva(proximoAlerta);
            const ph = proximoAlerta.hora || '--:--';
            const extra = document.createElement('div');
            extra.className = 'al-stat-proximo';
            extra.innerHTML = `
                <span class="al-stat-proximo-hora">⏰ ${ph}</span>
                <div class="al-stat-proximo-info">
                    <div class="al-stat-proximo-titulo">${esc(proximoAlerta.titulo)}</div>
                    <div class="al-stat-proximo-data">Próximo • ${fmtData(pe)}</div>
                </div>`;
            statsEl.appendChild(extra);
        }
    }

    const elHoje = document.getElementById('home-hoje-lista');
    if (elHoje) elHoje.innerHTML = hoje.length ? hoje.map(htmlItem).join('') : '<div class="al-empty"><div class="al-empty-icon">✅</div><p>Nenhum alerta para hoje.</p></div>';

    const elProx = document.getElementById('home-proximos-lista');
    if (elProx) elProx.innerHTML = prox.length ? prox.map(htmlItem).join('') : '<div class="al-empty"><p>Nenhum alerta agendado.</p></div>';

    const secVenc = document.getElementById('home-vencidos-sec');
    const elVenc  = document.getElementById('home-vencidos-lista');
    if (secVenc && elVenc) {
        secVenc.style.display = venc.length ? '' : 'none';
        elVenc.innerHTML = venc.map(htmlItem).join('');
    }

    // Comandos agendados no Home
    const elCmds = document.getElementById('home-comandos-lista');
    if (elCmds) elCmds.innerHTML = cmds.length ? cmds.map(htmlItem).join('') : '<div class="al-empty"><p>Nenhum comando agendado.</p></div>';

    // Tarefas agendadas no Home
    const elTarefs = document.getElementById('home-tarefas-lista');
    if (elTarefs) elTarefs.innerHTML = tarefs.length ? tarefs.map(htmlItem).join('') : '<div class="al-empty"><p>Nenhuma tarefa agendada.</p></div>';
}

function renderLista(secao, lista) {
    const el = document.getElementById(`lista-${secao}`);
    if (!el) return;
    if (!lista.length) {
        el.innerHTML = `<div class="al-empty"><div class="al-empty-icon">🔔</div><p>Nenhum alerta aqui.</p></div>`;
        return;
    }
    el.innerHTML = lista.map(htmlItem).join('');
}

function htmlItem(a) {
    const hoje      = hojeISO();
    const deISO     = dataEfetiva(a);
    const vencido   = deISO < hoje && a.status !== 'concluido';
    const hojeAtivo = deISO === hoje;
    const cls       = a.status === 'concluido' ? 'concluido' : (vencido ? 'vencido' : (hojeAtivo ? 'hoje-ativo' : ''));
    const repLabel  = { nenhuma:'', diario:'Diário', semanal:'Semanal', mensal:'Mensal', quinzenal:'15 dias', trinta:'30 dias', custom:`${a.customDias||7} dias` }[a.repeticao||'nenhuma'] || '';
    const cmd       = a.comandoId ? st.comandos.find(c=>c.id===a.comandoId) : null;

    const prioCls = `prio-${a.prioridade||'media'}`;
    return `
    <div class="al-item ${cls} ${prioCls}" data-id="${a.id}">
        <label class="al-item-check" title="Selecionar">
            <input type="checkbox" class="al-checkbox" data-id="${a.id}" onchange="Alertas._atualizarSelecao()">
        </label>
        <div class="al-item-prioridade prioridade-${esc(a.prioridade||'media')}"></div>
        <div class="al-item-body">
            <div class="al-item-titulo">${esc(a.titulo)}</div>
            <div class="al-item-meta">
                <span class="al-item-hora">${esc(a.hora||'--:--')}</span>
                <span class="al-item-data">${fmtData(deISO)}</span>
                <span class="al-item-tipo">${tipoLabel(a.tipo)}</span>
                ${repLabel ? `<span class="al-item-rep">🔁 ${repLabel}</span>` : ''}
            </div>
            ${a.descricao ? `<div class="al-item-descricao">${esc(a.descricao)}</div>` : ''}
            ${cmd ? `<div class="al-item-cmd">⚡ ${esc(cmd.titulo)}</div>` : ''}
        </div>
        <div class="al-item-acoes">
            ${cmd ? `<button class="al-acao al-acao-executar" onclick="Alertas.executarComando('${a.id}')" title="Executar comando">▶</button>` : ''}
            ${cmd ? `<button class="al-acao al-acao-copiar" onclick="Alertas.copiarComando('${a.id}')" title="Copiar comando">📋</button>` : ''}
            ${a.status!=='concluido' ? `<button class="al-acao al-acao-concluir" onclick="Alertas.concluir('${a.id}')" title="Concluir">✔</button>` : ''}
            ${a.status!=='concluido' ? `<button class="al-acao" onclick="Alertas.abrirAdiar('${a.id}')" title="Adiar">⏰</button>` : ''}
            <button class="al-acao" onclick="Alertas.editar('${a.id}')" title="Editar">✏️</button>
            <button class="al-acao al-acao-excluir" onclick="Alertas.excluir('${a.id}')" title="Excluir">🗑️</button>
        </div>
    </div>`;
}

function tipoLabel(tipo) {
    const m = {lembrete:'🔔',comando:'⚡',tarefa:'✅',whatsapp:'📱',instagram:'📸',financeiro:'💰',os:'🔧',cliente:'👤',fornecedor:'🏢',outro:'📌'};
    return (m[tipo]||'🔔') + ' ' + (tipo||'lembrete').charAt(0).toUpperCase() + (tipo||'lembrete').slice(1);
}

function atualizarBadges() {
    const hj = listaHoje().length;
    const el = document.getElementById('sb-badge-hoje');
    if (el) { el.textContent = hj || ''; el.classList.toggle('show', hj > 0); }
    const ag = listaAgendados().length;
    const el2 = document.getElementById('sb-badge-agendados');
    if (el2) { el2.textContent = ag || ''; el2.classList.toggle('show', ag > 0); }
    const cm = listaComandos().length;
    const el3 = document.getElementById('sb-badge-comandos');
    if (el3) { el3.textContent = cm || ''; el3.classList.toggle('show', cm > 0); }
    const tf = listaTarefas().length;
    const el4 = document.getElementById('sb-badge-tarefas');
    if (el4) { el4.textContent = tf || ''; el4.classList.toggle('show', tf > 0); }
}

function _salvarBadgeGlobal() {
    const total = listaAtivos().length;
    localStorage.setItem(BADGE_KEY, String(total));
    // Dispara evento de storage para o dashboard atualizar em tempo real
    try {
        window.dispatchEvent(new StorageEvent('storage', { key: BADGE_KEY, newValue: String(total) }));
    } catch(_) {}
}

// ── Seleção em lote ───────────────────────────────────────────────────────────
function _atualizarSelecao() {
    const selecionados = document.querySelectorAll('.al-checkbox:checked');
    const toolbar = document.getElementById('al-toolbar-lote');
    const count = document.getElementById('al-lote-count');
    if (toolbar) toolbar.classList.toggle('visible', selecionados.length > 0);
    if (count) count.textContent = selecionados.length;
}

function _getSelecionados() {
    return [...document.querySelectorAll('.al-checkbox:checked')].map(el => el.dataset.id);
}

function selecionarTodos() {
    const checkboxes = document.querySelectorAll('.al-checkbox');
    const todosMarcados = [...checkboxes].every(c => c.checked);
    checkboxes.forEach(c => c.checked = !todosMarcados);
    _atualizarSelecao();
}

async function excluirSelecionados() {
    const ids = _getSelecionados();
    if (!ids.length) return;
    const nomes = ids.map(id => {
        const a = st.lista.find(x=>x.id===id);
        return a ? `"${a.titulo}"` : id;
    }).join(', ');
    if (!confirm(`Excluir ${ids.length} alerta(s)?\n\n${nomes}\n\nEsta ação é permanente.`)) return;

    let erros = 0;
    for (const id of ids) {
        try { await deleteDoc(doc(db, COL, id)); } catch { erros++; }
        st.lista = st.lista.filter(x=>x.id!==id);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(st.lista));
    toast(erros ? `🗑️ ${ids.length - erros} excluído(s). ${erros} erro(s).` : `🗑️ ${ids.length} alerta(s) excluído(s).`);
    render();
    _salvarBadgeGlobal();
}

async function concluirSelecionados() {
    const ids = _getSelecionados();
    if (!ids.length) return;
    if (!confirm(`Concluir ${ids.length} alerta(s)?`)) return;
    for (const id of ids) {
        const a = st.lista.find(x=>x.id===id);
        if (!a || a.status === 'concluido') continue;
        a.status = 'concluido';
        try {
            await setDoc(doc(db, COL, id), { status:'concluido', atualizadoEmISO: new Date().toISOString() }, { merge:true });
        } catch {}
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(st.lista));
    toast(`✅ ${ids.length} alerta(s) concluído(s).`);
    render();
    _salvarBadgeGlobal();
}

// ── Calendário ────────────────────────────────────────────────────────────────
function setCalView(view) {
    st.calView = view;
    document.querySelectorAll('.al-cal-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderCalendario();
}

function _semanaInicio(offset) {
    const hoje = new Date();
    const diaSem = hoje.getDay(); // 0=Dom
    const diff = (offset || 0) * 7;
    const seg = new Date(hoje);
    seg.setDate(hoje.getDate() - diaSem + diff);
    seg.setHours(0,0,0,0);
    return seg;
}

function renderCalendario() {
    const { ano, mes, calView } = st;
    const el = document.getElementById('al-cal-grid');
    const lb = document.getElementById('cal-mes-label');
    if (!el) return;

    const hoje = hojeISO();
    const hojeAno = parseInt(hoje.slice(0,4)), hojeM = parseInt(hoje.slice(5,7))-1, hojeD = parseInt(hoje.slice(8,10));
    const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

    if (calView === 'semana') {
        el.classList.add('semana');
        const semanaInicio = _semanaInicio(st.calSemanaOffset || 0);
        const label = semanaInicio.toLocaleDateString('pt-BR', { day:'numeric', month:'long', year:'numeric' });
        if (lb) lb.textContent = `📅 Semana de ${label}`;

        let html = dias.map(d=>`<div class="al-cal-day-header">${d}</div>`).join('');

        for (let i=0; i<7; i++) {
            const d = new Date(semanaInicio);
            d.setDate(semanaInicio.getDate() + i);
            const iso = d.toISOString().slice(0,10);
            const alertasNoDia = st.lista.filter(a=>a.status!=='concluido'&&dataEfetiva(a)===iso);
            const isHoje = (iso === hoje);
            const isSel  = st.calDiaSel === iso;
            const dots   = alertasNoDia.slice(0,5).map(a=>`<div class="al-cal-dot dot-${a.prioridade||'media'}"></div>`).join('');
            html += `<div class="al-cal-day${alertasNoDia.length?' com-alertas':''}${isHoje?' hoje':''}${isSel?' selecionado':''}" onclick="Alertas.selDia('${iso}')">
                <span class="al-cal-day-num">${d.getDate()}</span>
                ${dots ? `<div class="al-cal-day-dots">${dots}</div>` : ''}
                ${alertasNoDia.slice(0,2).map(a => `<span style="font-size:9px;color:var(--text3);line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">${esc(a.titulo||'').slice(0,12)}</span>`).join('')}
            </div>`;
        }
        el.innerHTML = html;
        if (st.calDiaSel) _renderCalDetalhe(st.calDiaSel);
        return;
    }

    el.classList.remove('semana');
    if (lb) lb.textContent = fmtMesAno(ano, mes);

    const primDia   = new Date(ano, mes, 1).getDay();
    const diasNoMes = new Date(ano, mes+1, 0).getDate();

    let html = dias.map(d=>`<div class="al-cal-day-header">${d}</div>`).join('');

    for (let i=0; i<primDia; i++) html += `<div class="al-cal-day vazio"></div>`;

    for (let d=1; d<=diasNoMes; d++) {
        const iso = `${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const alertasNoDia = st.lista.filter(a=>a.status!=='concluido'&&dataEfetiva(a)===iso);
        const isHoje = (ano===hojeAno && mes===hojeM && d===hojeD);
        const isSel  = st.calDiaSel === iso;
        const dots   = alertasNoDia.slice(0,5).map(a=>`<div class="al-cal-dot dot-${a.prioridade||'media'}"></div>`).join('');
        html += `<div class="al-cal-day${alertasNoDia.length?' com-alertas':''}${isHoje?' hoje':''}${isSel?' selecionado':''}" onclick="Alertas.selDia('${iso}')">
            <span class="al-cal-day-num">${d}</span>
            ${dots ? `<div class="al-cal-day-dots">${dots}</div>` : ''}
        </div>`;
    }
    el.innerHTML = html;

    if (st.calDiaSel) _renderCalDetalhe(st.calDiaSel);
}

function _renderCalDetalhe(iso) {
    const el    = document.getElementById('al-cal-detalhe');
    const tit   = document.getElementById('al-cal-detalhe-data');
    const lista = document.getElementById('al-cal-detalhe-lista');
    if (!el) return;
    const alertas = st.lista.filter(a=>a.status!=='concluido'&&dataEfetiva(a)===iso);
    if (!alertas.length) { el.style.display='none'; return; }
    el.style.display = '';
    if (tit) tit.textContent = `📅 ${fmtData(iso)} — ${alertas.length} alerta(s)`;
    if (lista) lista.innerHTML = alertas.map(htmlItem).join('');
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function abrirForm() {
    document.getElementById('al-edit-id').value = '';
    document.getElementById('al-modal-titulo').textContent = '➕ Novo Alerta';
    document.getElementById('al-f-titulo').value      = '';
    document.getElementById('al-f-descricao').value   = '';
    document.getElementById('al-f-tipo').value        = 'lembrete';
    document.getElementById('al-f-prioridade').value  = 'media';
    document.getElementById('al-f-categoria').value   = '';
    document.getElementById('al-f-data').value        = hojeISO();
    document.getElementById('al-f-hora').value        = agoraHHMM();
    document.getElementById('al-f-repeticao').value   = 'nenhuma';
    document.getElementById('al-f-comando').value     = '';
    document.getElementById('al-custom-dias-wrap').classList.add('hidden');
    document.getElementById('al-modal').classList.add('active');
    setTimeout(() => document.getElementById('al-f-titulo')?.focus(), 80);
}

function editar(id) {
    const a = st.lista.find(x=>x.id===id);
    if (!a) return;
    document.getElementById('al-edit-id').value = id;
    document.getElementById('al-modal-titulo').textContent = '✏️ Editar Alerta';
    document.getElementById('al-f-titulo').value     = a.titulo||'';
    document.getElementById('al-f-descricao').value  = a.descricao||'';
    document.getElementById('al-f-tipo').value       = a.tipo||'lembrete';
    document.getElementById('al-f-prioridade').value = a.prioridade||'media';
    document.getElementById('al-f-categoria').value  = a.categoria||'';
    document.getElementById('al-f-data').value       = a.data||hojeISO();
    document.getElementById('al-f-hora').value       = a.hora||'';
    document.getElementById('al-f-repeticao').value  = a.repeticao||'nenhuma';
    document.getElementById('al-f-comando').value    = a.comandoId||'';
    document.getElementById('al-f-custom-dias').value= a.customDias||7;
    document.getElementById('al-custom-dias-wrap').classList.toggle('hidden', (a.repeticao||'nenhuma')!=='custom');
    document.getElementById('al-modal').classList.add('active');
}

function fecharForm() {
    document.getElementById('al-modal').classList.remove('active');
}

function toggleCustomDias() {
    const v = document.getElementById('al-f-repeticao').value;
    document.getElementById('al-custom-dias-wrap').classList.toggle('hidden', v !== 'custom');
}

async function salvar() {
    const id        = document.getElementById('al-edit-id').value;
    const titulo    = document.getElementById('al-f-titulo').value.trim();
    const data      = document.getElementById('al-f-data').value;
    const hora      = document.getElementById('al-f-hora').value;
    if (!titulo) return toast('⚠️ Informe o título do alerta.');
    if (!data)   return toast('⚠️ Informe a data.');
    if (!hora)   return toast('⚠️ Informe o horário.');

    const repet     = document.getElementById('al-f-repeticao').value;
    const cmdId     = document.getElementById('al-f-comando').value;
    const cmd       = cmdId ? st.comandos.find(c=>c.id===cmdId) : null;

    const dados = {
        titulo,
        descricao:  document.getElementById('al-f-descricao').value.trim(),
        tipo:       document.getElementById('al-f-tipo').value,
        prioridade: document.getElementById('al-f-prioridade').value,
        categoria:  document.getElementById('al-f-categoria').value.trim(),
        data, hora,
        repeticao:  repet,
        customDias: repet === 'custom' ? parseInt(document.getElementById('al-f-custom-dias').value)||7 : null,
        comandoId:  cmdId || null,
        status:     'pendente',
    };

    if (id) {
        const orig = st.lista.find(x=>x.id===id)||{};
        dados.id = id;
        dados.criadoEmISO = orig.criadoEmISO;
        dados.criadoEm    = orig.criadoEm;
        dados.status      = orig.status || 'pendente';
    }

    try {
        const salvo = await persistir(dados);
        toast(id ? '✅ Alerta atualizado.' : '✅ Alerta salvo.');
        if (id) {
            const idx = st.lista.findIndex(x=>x.id===id);
            if (idx>=0) st.lista[idx] = salvo;
        } else {
            st.lista.push(salvo);
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(st.lista));
    } catch {
        toast('✅ Salvo localmente (offline).');
        if (!id) {
            dados.id = Date.now().toString();
            st.lista.push(dados);
            localStorage.setItem(CACHE_KEY, JSON.stringify(st.lista));
        }
    }

    fecharForm();
    render();
    if (st.secao === 'calendario') renderCalendario();
    _salvarBadgeGlobal();
}

async function excluir(id) {
    const a = st.lista.find(x=>x.id===id);
    if (!a) return;
    if (!confirm(`Excluir "${a.titulo}"?\n\nEsta ação é permanente.`)) return;
    try { await deleteDoc(doc(db, COL, id)); } catch {}
    st.lista = st.lista.filter(x=>x.id!==id);
    localStorage.setItem(CACHE_KEY, JSON.stringify(st.lista));
    toast('🗑️ Alerta excluído.');
    render();
    _salvarBadgeGlobal();
}

async function concluir(id) {
    const a = st.lista.find(x=>x.id===id);
    if (!a) return;
    a.status = 'concluido';
    try {
        await setDoc(doc(db, COL, id), { status:'concluido', atualizadoEm: serverTimestamp(), atualizadoEmISO: new Date().toISOString() }, { merge:true });
    } catch {}
    localStorage.setItem(CACHE_KEY, JSON.stringify(st.lista));
    toast('✅ Alerta concluído!');
    render();
    _salvarBadgeGlobal();
}

async function copiarComando(id) {
    const a   = st.lista.find(x=>x.id===id);
    const cmd = a?.comandoId ? st.comandos.find(c=>c.id===a.comandoId) : null;
    if (!cmd) return toast('⚠️ Nenhum comando vinculado.');
    const blocos = cmd.blocos?.length ? cmd.blocos : (cmd.conteudo ? [cmd.conteudo] : []);
    const texto  = blocos.join('\n\n---\n\n');
    try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(texto);
        else {
            const ta = document.createElement('textarea');
            ta.value = texto; ta.style.cssText='position:fixed;opacity:0';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
        }
        toast('✅ Comando copiado! Cole no terminal.');
    } catch { toast('⚠️ Não foi possível copiar.'); }
}

// ── Executar Comando ─────────────────────────────────────────────────────────
async function executarComando(id) {
    const a   = st.lista.find(x=>x.id===id);
    const cmd = a?.comandoId ? st.comandos.find(c=>c.id===a.comandoId) : null;
    if (!cmd) return toast('⚠️ Nenhum comando vinculado.');
    const blocos = cmd.blocos?.length ? cmd.blocos : (cmd.conteudo ? [cmd.conteudo] : []);
    const texto  = blocos.join('\n\n---\n\n');
    try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(texto);
        else {
            const ta = document.createElement('textarea');
            ta.value = texto; ta.style.cssText='position:fixed;opacity:0';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
        }
        toast('✅ Comando copiado para área de transferência!');
        // Se tiver janela do terminal, tenta focar (opcional)
    } catch { toast('⚠️ Não foi possível copiar.'); }
}

// ── Adiar Alerta ─────────────────────────────────────────────────────────────
function abrirAdiar(id) {
    document.getElementById('al-adiar-id').value = id;
    document.getElementById('al-adiar-custom').value = '';
    document.getElementById('al-modal-adiar').classList.add('active');
}

function fecharAdiar() {
    document.getElementById('al-modal-adiar').classList.remove('active');
}

async function adiar(minutos) {
    const id = document.getElementById('al-adiar-id').value;
    const a = st.lista.find(x=>x.id===id);
    if (!a) return toast('⚠️ Alerta não encontrado.');

    const agora = new Date();
    const novaData = new Date(agora.getTime() + minutos * 60 * 1000);
    a.data = novaData.toISOString().slice(0,10);
    a.hora = `${String(novaData.getHours()).padStart(2,'0')}:${String(novaData.getMinutes()).padStart(2,'0')}`;
    a.adiadoEm = new Date().toISOString();
    a.adiadoPor = minutos;

    try {
        await setDoc(doc(db, COL, id), {
            data: a.data, hora: a.hora, adiadoEm: a.adiadoEm, adiadoPor: minutos,
            atualizadoEm: serverTimestamp(), atualizadoEmISO: new Date().toISOString()
        }, { merge: true });
        toast(`⏰ Adiado por ${minutos} min. Novo horário: ${a.hora}`);
    } catch {
        toast(`⏰ Adiado localmente por ${minutos} min.`);
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(st.lista));
    fecharAdiar();
    render();
    if (st.secao === 'calendario') renderCalendario();
    _salvarBadgeGlobal();
}

async function adiarCustom() {
    const minutos = parseInt(document.getElementById('al-adiar-custom').value);
    if (!minutos || minutos < 1) return toast('⚠️ Informe um número válido de minutos.');
    await adiar(minutos);
}

// ── Calendário — ações ────────────────────────────────────────────────────────
function selDia(iso) {
    st.calDiaSel = st.calDiaSel === iso ? null : iso;
    renderCalendario();
}

// ── Configurações ─────────────────────────────────────────────────────────────
function carregarConfig() {
    const raw = localStorage.getItem(CFG_KEY);
    const cfg = raw ? JSON.parse(raw) : { somGlobal:true, notifBrowser:true, modoNotif:'som_popup', tipos:{ critico:true, alto:true, medio:true, baixo:false } };
    const el = (id) => document.getElementById(id);
    if (el('cfg-som-global'))    el('cfg-som-global').checked = cfg.somGlobal !== false;
    if (el('cfg-notif-browser')) el('cfg-notif-browser').checked = cfg.notifBrowser !== false;
    if (el('cfg-modo-notif'))    el('cfg-modo-notif').value = cfg.modoNotif || 'som_popup';
    document.querySelectorAll('.cfg-tipo-som').forEach(chk => {
        chk.checked = cfg.tipos?.[chk.dataset.tipo] !== false;
    });
}

function salvarConfig() {
    const cfg = {
        somGlobal:    document.getElementById('cfg-som-global')?.checked ?? true,
        notifBrowser: document.getElementById('cfg-notif-browser')?.checked ?? true,
        modoNotif:    document.getElementById('cfg-modo-notif')?.value || 'som_popup',
        tipos: {},
    };
    document.querySelectorAll('.cfg-tipo-som').forEach(chk => {
        cfg.tipos[chk.dataset.tipo] = chk.checked;
    });
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    toast('✅ Configurações salvas.');
}

// ── Verificação de alertas vencidos ──────────────────────────────────────────
function _tocarSom() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        o.start(); o.stop(ctx.currentTime + 0.35);
        o.onended = () => { try { ctx.close(); } catch(_) {} };
    } catch(_) {}
}

function verificarDisparos() {
    const hj    = hojeISO();
    const hm    = agoraHHMM();
    const devem = st.lista.filter(a =>
        a.status === 'pendente' &&
        dataEfetiva(a) === hj &&
        a.hora <= hm
    );
    if (!devem.length) return;
    const cfg   = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
    const modo  = cfg.modoNotif || 'som_popup';
    const usaSom    = cfg.somGlobal !== false && (modo === 'som' || modo === 'som_popup');
    const usaPopup  = cfg.notifBrowser !== false && (modo === 'popup' || modo === 'som_popup');

    if (usaSom) _tocarSom();

    devem.forEach(a => {
        if (usaPopup && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`🔔 ${a.titulo}`, {
                body: `${a.hora} — ${tipoLabel(a.tipo)}${a.descricao ? '\n'+a.descricao : ''}`,
                icon: '/CRM/assets/logo.png',
            });
        }
    });
}

// ── Sidebar mobile ────────────────────────────────────────────────────────────
function setupSidebar() {
    document.getElementById('al-sb-open')?.addEventListener('click', () => {
        document.getElementById('al-sidebar')?.classList.toggle('open');
        document.getElementById('al-overlay')?.classList.toggle('open');
    });
    document.getElementById('al-overlay')?.addEventListener('click', () => {
        document.getElementById('al-sidebar')?.classList.remove('open');
        document.getElementById('al-overlay')?.classList.remove('open');
    });
    document.querySelectorAll('.al-sb-item').forEach(el =>
        el.addEventListener('click', () => navegar(el.dataset.nav))
    );
    document.getElementById('al-modal')?.addEventListener('click', e => {
        if (e.target.id === 'al-modal') fecharForm();
    });
    document.getElementById('al-modal-adiar')?.addEventListener('click', e => {
        if (e.target.id === 'al-modal-adiar') fecharAdiar();
    });
    document.getElementById('cal-prev')?.addEventListener('click', () => {
        if (st.calView === 'semana') {
            st.calSemanaOffset = (st.calSemanaOffset || 0) - 1;
        } else {
            if (--st.cal.mes < 0) { st.cal.mes=11; st.cal.ano--; }
        }
        renderCalendario();
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
        if (st.calView === 'semana') {
            st.calSemanaOffset = (st.calSemanaOffset || 0) + 1;
        } else {
            if (++st.cal.mes > 11) { st.cal.mes=0; st.cal.ano++; }
        }
        renderCalendario();
    });
}

// ── Permissão notificação ─────────────────────────────────────────────────────
async function pedirPermissaoNotif() {
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────
const agora = new Date();
st.cal.ano = agora.getFullYear();
st.cal.mes = agora.getMonth();

setupSidebar();
carregarComandos();
carregarConfig();
pedirPermissaoNotif();

authReady.then(async () => {
    await carregar();
    verificarDisparos();
    // Agenda re-render alinhado à virada do minuto (ex: XX:55:00, não XX:55:37)
    // para que os alertas apareçam exatamente no horário configurado
    (function agendarMinuto() {
        const agora = new Date();
        const msAteVirada = (60 - agora.getSeconds()) * 1000 - agora.getMilliseconds() + 50;
        setTimeout(() => {
            render();
            verificarDisparos();
            _salvarBadgeGlobal();
            agendarMinuto(); // reprogramar para o próximo minuto
        }, msAteVirada);
    })();
});

// ── Exposição global ──────────────────────────────────────────────────────────
window.Alertas = {
    navegar, abrirForm, editar, fecharForm, salvar, excluir, concluir,
    copiarComando, executarComando,
    abrirAdiar, fecharAdiar, adiar, adiarCustom,
    selDia, toggleCustomDias, salvarConfig,
    setCalView,
    // Seleção em lote
    _atualizarSelecao, selecionarTodos, excluirSelecionados, concluirSelecionados,
};
