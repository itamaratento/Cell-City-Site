import {
    db, collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
    serverTimestamp, query, orderBy, where, authReady, auth
} from '../../scripts/firebase.js';
import { ccTocarSom, ccLog, ccSonsHabilitados } from '../../shared/cc-audio.js';

const COL          = 'alertas_usuario';
const CMDS_CACHE   = 'cc_comandos_cache';
const CACHE_KEY    = 'cc_alertas_cache';
const CFG_KEY      = 'cc_alertas_config';

// Estado do som intermitente
let _somIntermitenteId  = null;
let _somIntermitenteIds = [];

// ── Estado ────────────────────────────────────────────────────────────────────
const st = {
    lista:    [],          // todos os alertas
    comandos: [],          // cache de comandos para vínculo
    secao:    'home',
    cal:      { ano: 0, mes: 0 },
    calView:  'mes',      // 'mes' | 'semana'
    calDiaSel: null,
    calSemanaOffset: 0,    // semanas para navegação na visão Semana
    filtroBusca:     '',
    filtroTipo:      '',
    filtroPrioridade:'',
    // Encomendas
    encomendas:      [],
    encFiltro:       'pendentes',
    encFiltroMeu:    false,
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

// Avança a.data por um intervalo garantindo data futura (> hoje)
function _proxData(a) {
    const hoje = hojeISO();
    const dias = { diario:1, semanal:7, mensal:30, quinzenal:15, trinta:30, custom: parseInt(a.customDias)||7 }[a.repeticao] || 1;
    let d = new Date((a.data || hoje) + 'T12:00:00');
    do {
        a.repeticao === 'mensal' ? d.setMonth(d.getMonth()+1) : d.setDate(d.getDate()+dias);
    } while (d.toISOString().slice(0,10) <= hoje);
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
        const snap = await getDocs(collection(db, COL));
        st.lista = [];
        snap.forEach(d => st.lista.push({ id: d.id, ...d.data() }));
        st.lista.sort((a, b) => {
            const da = a.data || '', db2 = b.data || '';
            if (da !== db2) return da.localeCompare(db2);
            return (a.hora || '').localeCompare(b.hora || '');
        });
        localStorage.setItem(CACHE_KEY, JSON.stringify(st.lista));
        ccLog('Sistema', `${st.lista.length} alerta(s) carregado(s) do Firestore`, 'sistema');
    } catch (err) {
        console.error('Erro ao carregar alertas:', err);
        ccLog('Sistema', `Erro Firestore: ${err?.message || err}`, 'sistema');
        st.lista = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    }
    render();
    atualizarBadges();
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
    painel: '📊 Dashboard de Alertas',
    diagnostico: '🔎 Diagnóstico do Sistema',
    sons: '🔊 Sons e Notificações',
    encomendas: '📦 Encomendas',
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
    if (secao === 'hoje') _pararSomIntermitente();
    if (secao === 'calendario') renderCalendario();
    else if (secao === 'painel') renderPainel();
    else if (secao === 'diagnostico') renderDiagnostico();
    else if (secao === 'sons') carregarConfig();
    else if (secao === 'encomendas') carregarEncomendas();
    else render();
}

// ── Render ────────────────────────────────────────────────────────────────────
function filtroItem(a) {
    const termo = st.filtroBusca.toLowerCase().trim();
    if (termo && !a.titulo?.toLowerCase().includes(termo) && !a.descricao?.toLowerCase().includes(termo)) return false;
    if (st.filtroTipo && a.tipo !== st.filtroTipo) return false;
    if (st.filtroPrioridade && a.prioridade !== st.filtroPrioridade) return false;
    return true;
}

function render() {
    renderHome();
    renderLista('hoje',       listaHoje().filter(filtroItem));
    renderLista('agendados',  listaAgendados().filter(filtroItem));
    renderLista('recorrentes',listaRecorrentes().filter(filtroItem));
    renderLista('concluidos', listaConcluidos().filter(filtroItem));
    renderLista('comandos',   listaComandos().filter(filtroItem));
    renderLista('tarefas',    listaTarefas().filter(filtroItem));
    atualizarBadges();
    _atualizarBarraAtiva();
}

function setupBusca() {
    const input = document.getElementById('al-search-input');
    const clear = document.getElementById('al-search-clear');
    const tipo  = document.getElementById('al-search-tipo');
    const prio  = document.getElementById('al-search-prioridade');
    if (!input) return;
    const atualizar = () => {
        st.filtroBusca     = input.value;
        st.filtroTipo      = tipo?.value  || '';
        st.filtroPrioridade= prio?.value  || '';
        if (clear) clear.style.display = input.value ? '' : 'none';
        render();
    };
    input.addEventListener('input', atualizar);
    tipo?.addEventListener('change',  atualizar);
    prio?.addEventListener('change',  atualizar);
    clear?.addEventListener('click', () => { input.value = ''; atualizar(); input.focus(); });
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

// ── Ações Rápidas Contextuais ─────────────────────────────────────────────────
const _ACAO_RAPIDA_MAP = {
    os:         { label: '🔧 Abrir OS',          url: '../../pages/os/index.html' },
    cliente:    { label: '👤 Abrir Cadastro',     url: '../../pages/clientes/index.html' },
    agenda:     { label: '📅 Abrir Agenda',       url: '../../pages/agenda/index.html' },
    whatsapp:   { label: '📱 Abrir WhatsApp',     url: '../../pages/whatsapp/index.html' },
    financeiro: { label: '💰 Abrir Financeiro',   url: '../../pages/financeiro/index.html' },
    estoque:    { label: '📦 Abrir Estoque',      url: '../../pages/estoque/index.html' },
    meta:       { label: '🎯 Abrir Metas',        url: '../../pages/metas/index.html' },
    fornecedor: { label: '🏢 Abrir Fornecedor',   url: '../../pages/fornecedores/index.html' },
};

function _acoesRapidasHTML(a) {
    if (a.status === 'concluido') return '';
    const destino = a.link || (_ACAO_RAPIDA_MAP[a.tipo]?.url ?? '');
    const label   = (_ACAO_RAPIDA_MAP[a.tipo]?.label) || (a.link ? '🔗 Abrir link' : '');
    if (!destino || !label) return '';
    return `<a href="${esc(destino)}" class="al-acao-rapida" target="_blank" onclick="event.stopPropagation()">${label}</a>`;
}

function htmlItem(a) {
    const hoje      = hojeISO();
    const deISO     = dataEfetiva(a);
    const vencido   = deISO < hoje && a.status !== 'concluido';
    const hojeAtivo = deISO === hoje;
    const cls       = a.status === 'concluido' ? 'concluido' : (vencido ? 'vencido' : (hojeAtivo ? 'hoje-ativo' : ''));
    const critAtivo = a.prioridade === 'critica' && a.status !== 'concluido' && jaDisp(a);
    const repLabel  = { nenhuma:'', diario:'Diário', semanal:'Semanal', mensal:'Mensal', quinzenal:'15 dias', trinta:'30 dias', custom:`${a.customDias||7} dias` }[a.repeticao||'nenhuma'] || '';
    const cmd       = a.comandoId ? st.comandos.find(c=>c.id===a.comandoId) : null;
    const isRec     = a.repeticao && a.repeticao !== 'nenhuma';
    const concl     = a.execucoesConcluidas || 0;
    const total     = a.execucoesTotal || null;
    const pct       = total ? Math.min(100, (concl / total) * 100).toFixed(1) : 0;
    const progHTML  = isRec && total ? `
        <div class="al-item-progresso">
            <div class="al-prog-topo">
                <span class="al-prog-label">📊 ${concl} / ${total} concluídas</span>
                <span class="al-prog-restam">Restam ${total - concl}</span>
            </div>
            <div class="al-prog-bar-wrap"><div class="al-prog-bar" style="width:${pct}%"></div></div>
        </div>` : (isRec && concl > 0 ? `<div class="al-item-progresso"><span class="al-prog-label">🔁 ${concl} execuç${concl===1?'ão':'ões'} concluída${concl!==1?'s':''}</span></div>` : '');

    const prioCls = `prio-${a.prioridade||'media'}`;
    return `
    <div class="al-item ${cls} ${prioCls}${critAtivo ? ' critico-ativo' : ''}" data-id="${a.id}">
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
            ${progHTML}
            ${_acoesRapidasHTML(a)}
            ${a.concluidoEmISO ? `<div class="al-item-concluido-em">✅ Concluído em ${new Date(a.concluidoEmISO).toLocaleString('pt-BR')}</div>` : ''}
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
}

async function concluirSelecionados() {
    const ids = _getSelecionados();
    if (!ids.length) return;
    if (!confirm(`Concluir ${ids.length} alerta(s)?`)) return;
    for (const id of ids) {
        const a = st.lista.find(x=>x.id===id);
        if (!a || a.status === 'concluido') continue;
        await concluir(id);
    }
    toast(`✅ ${ids.length} alerta(s) processado(s).`);
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
    const linkEl = document.getElementById('al-f-link'); if (linkEl) linkEl.value = '';
    document.getElementById('al-custom-dias-wrap').classList.add('hidden');
    document.getElementById('al-qtd-wrap')?.classList.add('hidden');
    const qtdInfEl = document.getElementById('al-qtd-infinito');
    if (qtdInfEl) qtdInfEl.checked = true;
    document.getElementById('al-qtd-num-wrap')?.classList.add('hidden');
    const qtdNumEl = document.getElementById('al-f-execucoes-total');
    if (qtdNumEl) qtdNumEl.value = 30;
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
    const linkElE = document.getElementById('al-f-link'); if (linkElE) linkElE.value = a.link||'';
    document.getElementById('al-custom-dias-wrap').classList.toggle('hidden', (a.repeticao||'nenhuma')!=='custom');
    const isRec = (a.repeticao||'nenhuma') !== 'nenhuma';
    document.getElementById('al-qtd-wrap')?.classList.toggle('hidden', !isRec);
    const temTotal = !!a.execucoesTotal;
    const qtdInfE = document.getElementById('al-qtd-infinito');
    const qtdQntE = document.getElementById('al-qtd-quant');
    if (qtdInfE) qtdInfE.checked = !temTotal;
    if (qtdQntE) qtdQntE.checked = temTotal;
    document.getElementById('al-qtd-num-wrap')?.classList.toggle('hidden', !temTotal);
    const qtdNumElE = document.getElementById('al-f-execucoes-total');
    if (qtdNumElE) qtdNumElE.value = a.execucoesTotal || 30;
    document.getElementById('al-modal').classList.add('active');
}

function fecharForm() {
    document.getElementById('al-modal').classList.remove('active');
}

function toggleCustomDias() {
    const v = document.getElementById('al-f-repeticao').value;
    document.getElementById('al-custom-dias-wrap').classList.toggle('hidden', v !== 'custom');
    const isRec = v !== 'nenhuma';
    document.getElementById('al-qtd-wrap')?.classList.toggle('hidden', !isRec);
    if (!isRec) {
        const qtdInfEl = document.getElementById('al-qtd-infinito');
        if (qtdInfEl) qtdInfEl.checked = true;
        document.getElementById('al-qtd-num-wrap')?.classList.add('hidden');
    }
}

function toggleQuantidade() {
    const tipo = document.querySelector('input[name="al-qtd-tipo"]:checked')?.value;
    document.getElementById('al-qtd-num-wrap')?.classList.toggle('hidden', tipo !== 'quantidade');
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
    const qtdTipo   = document.querySelector('input[name="al-qtd-tipo"]:checked')?.value;
    const execucoesTotal = (repet !== 'nenhuma' && qtdTipo === 'quantidade')
        ? parseInt(document.getElementById('al-f-execucoes-total')?.value) || null
        : null;

    const dados = {
        titulo,
        descricao:  document.getElementById('al-f-descricao').value.trim(),
        tipo:       document.getElementById('al-f-tipo').value,
        prioridade: document.getElementById('al-f-prioridade').value,
        categoria:  document.getElementById('al-f-categoria').value.trim(),
        data, hora,
        repeticao:  repet,
        customDias: repet === 'custom' ? parseInt(document.getElementById('al-f-custom-dias').value)||7 : null,
        execucoesTotal: execucoesTotal || null,
        comandoId:  cmdId || null,
        link:       (document.getElementById('al-f-link')?.value || '').trim() || null,
        status:     'pendente',
    };

    if (id) {
        const orig = st.lista.find(x=>x.id===id)||{};
        dados.id = id;
        dados.criadoEmISO = orig.criadoEmISO;
        dados.criadoEm    = orig.criadoEm;
        dados.status      = orig.status || 'pendente';
        dados.execucoesConcluidas = orig.execucoesConcluidas || 0;
        dados.ultimaConcluidaEmISO = orig.ultimaConcluidaEmISO || null;
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
}

async function concluir(id) {
    const a = st.lista.find(x=>x.id===id);
    if (!a) return;
    const agoraISO = new Date().toISOString();
    const isRec = a.repeticao && a.repeticao !== 'nenhuma';

    if (!isRec) {
        a.status = 'concluido';
        a.concluidoEmISO = agoraISO;
        try {
            await setDoc(doc(db, COL, id), { status:'concluido', concluidoEmISO: agoraISO, atualizadoEm: serverTimestamp(), atualizadoEmISO: agoraISO }, { merge:true });
        } catch {}
        toast('✅ Alerta concluído!');
    } else {
        const execucoesConcluidas = (a.execucoesConcluidas || 0) + 1;
        const execucoesTotal = a.execucoesTotal || null;
        const finalizou = execucoesTotal && execucoesConcluidas >= execucoesTotal;

        if (finalizou) {
            a.status = 'concluido';
            a.concluidoEmISO = agoraISO;
            a.execucoesConcluidas = execucoesConcluidas;
            try {
                await setDoc(doc(db, COL, id), { status:'concluido', concluidoEmISO: agoraISO, execucoesConcluidas, atualizadoEm: serverTimestamp(), atualizadoEmISO: agoraISO }, { merge:true });
            } catch {}
            toast(`🎉 ${execucoesConcluidas}/${execucoesTotal} execuções concluídas! Alerta finalizado.`);
        } else {
            const proxData = _proxData(a);
            a.data = proxData;
            a.execucoesConcluidas = execucoesConcluidas;
            a.ultimaConcluidaEmISO = agoraISO;
            try {
                await setDoc(doc(db, COL, id), { data: proxData, execucoesConcluidas, ultimaConcluidaEmISO: agoraISO, atualizadoEm: serverTimestamp(), atualizadoEmISO: agoraISO }, { merge:true });
            } catch {}
            const restam = execucoesTotal ? ` — Restam ${execucoesTotal - execucoesConcluidas}` : '';
            toast(`✅ Execução ${execucoesConcluidas} concluída! Próxima: ${fmtData(proxData)}${restam}`);
        }
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(st.lista));
    // Remove do som intermitente se estava sendo monitorado
    if (_somIntermitenteIds.includes(id)) {
        _somIntermitenteIds = _somIntermitenteIds.filter(x => x !== id);
        if (!_somIntermitenteIds.length) _pararSomIntermitente();
        else _atualizarBarraAtiva();
    }
    render();
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
    // Sons do sistema (flag global — padrão desligado)
    if (el('cfg-sons-sistema'))  el('cfg-sons-sistema').checked = localStorage.getItem('cc_sons_sistema') === 'true';
    if (el('cfg-som-global'))    el('cfg-som-global').checked = cfg.somGlobal !== false;
    if (el('cfg-notif-browser')) el('cfg-notif-browser').checked = cfg.notifBrowser !== false;
    if (el('cfg-modo-notif'))    el('cfg-modo-notif').value = cfg.modoNotif || 'som_popup';
    document.querySelectorAll('.cfg-tipo-som').forEach(chk => {
        chk.checked = cfg.tipos?.[chk.dataset.tipo] !== false;
    });
    // Volume
    const volPct = Math.round(parseFloat(localStorage.getItem('cc_sons_volume') || '0.7') * 100);
    if (el('cfg-volume'))       el('cfg-volume').value = volPct;
    if (el('cfg-volume-label')) el('cfg-volume-label').textContent = volPct + '%';
    // Modo de repetição do som
    const modoRep = cfg.somModoRep || 'unico';
    if (el('cfg-som-unico'))        el('cfg-som-unico').checked = modoRep !== 'intermitente';
    if (el('cfg-som-intermitente')) el('cfg-som-intermitente').checked = modoRep === 'intermitente';
    if (el('cfg-intervalo-wrap'))   el('cfg-intervalo-wrap').style.display = modoRep === 'intermitente' ? '' : 'none';
    if (el('cfg-intervalo-som'))    el('cfg-intervalo-som').value = String(cfg.intervaloRepSom || 15);
}

function salvarConfig() {
    // Sons do sistema — grava flag global lida por todos os módulos
    const sonsSistema = document.getElementById('cfg-sons-sistema')?.checked ?? false;
    localStorage.setItem('cc_sons_sistema', sonsSistema ? 'true' : 'false');

    // Volume (0–100 → 0.00–1.00)
    const volumeEl = document.getElementById('cfg-volume');
    if (volumeEl) localStorage.setItem('cc_sons_volume', (parseInt(volumeEl.value) / 100).toFixed(2));

    const cfg = {
        somGlobal:    document.getElementById('cfg-som-global')?.checked ?? true,
        notifBrowser: document.getElementById('cfg-notif-browser')?.checked ?? true,
        modoNotif:    document.getElementById('cfg-modo-notif')?.value || 'som_popup',
        somModoRep:   document.querySelector('input[name="cfg-som-rep"]:checked')?.value || 'unico',
        intervaloRepSom: parseInt(document.getElementById('cfg-intervalo-som')?.value) || 15,
        tipos: {},
    };
    document.querySelectorAll('.cfg-tipo-som').forEach(chk => {
        cfg.tipos[chk.dataset.tipo] = chk.checked;
    });
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    toast('✅ Configurações salvas.');
}

function atualizarVolumeLabel(val) {
    const lbl = document.getElementById('cfg-volume-label');
    if (lbl) lbl.textContent = val + '%';
}

function testarSom() {
    const btn = document.getElementById('al-btn-testar-som');
    if (btn) { btn.textContent = '🔊 Tocando...'; btn.disabled = true; }
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) throw new Error('AudioContext indisponível');
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        const vol = Math.max(0, Math.min(1, parseFloat(localStorage.getItem('cc_sons_volume') || '0.7')));
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.25 * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.42);
        osc.onended = () => { try { ctx.close(); } catch {} };
    } catch {}
    setTimeout(() => {
        if (btn) { btn.textContent = '🔔 Testar Som'; btn.disabled = false; }
    }, 1200);
}

// ── Verificação de alertas vencidos ──────────────────────────────────────────
function _ccRegistrarEvento(origem, evento, tipo = 'som', extra = {}) {
    ccLog(origem, evento, tipo, '', extra);
}

function _tocarSom(tituloAlerta = '') {
    // Só verifica cfg.somGlobal da Central (cc_sons_sistema é para sons de UI, não para alertas agendados)
    const cfg = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
    if (cfg.somGlobal === false) {
        _ccRegistrarEvento('Central de Alertas', `Som bloqueado (cfg.somGlobal=false): ${tituloAlerta}`, 'bloqueado');
        return;
    }
    _ccRegistrarEvento('Central de Alertas',
        `Alerta disparado${tituloAlerta ? ': ' + tituloAlerta : ''}`, 'som',
        { arquivo: 'AudioContext — sine 880→660' });
    try {
        const vol = Math.max(0, Math.min(1, parseFloat(localStorage.getItem('cc_sons_volume') || '0.7')));
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx  = new Ctx();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.25 * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        // resume() garante que o AudioContext não fique suspenso (bloqueio de autoplay do navegador)
        ctx.resume().then(() => {
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.52);
            osc.onended = () => { try { ctx.close(); } catch {} };
        }).catch(() => {});
    } catch {}
}

// ── Popup visual de alerta disparado ─────────────────────────────────────────
let _notifyPopupTimer = null;

function _mostrarNotificacaoAlerta(devem) {
    const popup = document.getElementById('al-notify-popup');
    if (!popup) return;
    const count = document.getElementById('al-notify-popup-count');
    const lista = document.getElementById('al-notify-popup-lista');
    if (count) count.textContent = `${devem.length} alerta${devem.length !== 1 ? 's' : ''} disparado${devem.length !== 1 ? 's' : ''}`;
    if (lista) {
        lista.innerHTML = devem.slice(0, 3).map(a => {
            const destino = a.link || (_ACAO_RAPIDA_MAP[a.tipo]?.url ?? '');
            const label   = (_ACAO_RAPIDA_MAP[a.tipo]?.label) || (destino ? '🔗 Abrir' : '');
            return `<div class="al-notify-item">
                <div class="al-notify-titulo">${esc(a.titulo)}</div>
                ${a.descricao ? `<div class="al-notify-desc">${esc(a.descricao)}</div>` : ''}
                ${a.hora ? `<div class="al-notify-hora">🕐 ${esc(a.hora)}</div>` : ''}
                <div class="al-notify-btns">
                    ${destino && label ? `<a href="${esc(destino)}" class="al-notify-btn-abrir">${label}</a>` : ''}
                    <button class="al-notify-btn-concluir" onclick="Alertas.concluir('${a.id}')">✔ Feito</button>
                </div>
            </div>`;
        }).join('');
        if (devem.length > 3) lista.innerHTML += `<div class="al-notify-mais">+${devem.length - 3} mais na aba "Hoje"</div>`;
    }
    popup.style.display = 'flex';
    popup.classList.remove('al-notify-in');
    void popup.offsetWidth; // reflow para re-animar
    popup.classList.add('al-notify-in');
    clearTimeout(_notifyPopupTimer);
    _notifyPopupTimer = setTimeout(() => { popup.style.display = 'none'; }, 30000);
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
    const cfg    = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
    const modo   = cfg.modoNotif || 'som_popup';
    // cfg.somGlobal controla os alertas agendados (cc_sons_sistema é para sons de UI, não bloqueia alertas)
    const usaSom   = cfg.somGlobal !== false && (modo === 'som' || modo === 'som_popup');
    const usaPopup = cfg.notifBrowser !== false && (modo === 'popup' || modo === 'som_popup');

    if (usaSom) {
        _tocarSom(devem[0]?.titulo || '');
        if (cfg.somModoRep === 'intermitente') {
            _iniciarSomIntermitente(devem.map(a => a.id), cfg.intervaloRepSom || 15);
        }
    }

    devem.forEach(a => {
        _ccRegistrarEvento('Central de Alertas', `Notificação: ${a.titulo}`, 'notificacao');
        if (usaPopup && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`🔔 ${a.titulo}`, {
                body: `${a.hora} — ${tipoLabel(a.tipo)}${a.descricao ? '\n'+a.descricao : ''}`,
                icon: '/CRM/assets/logo.png',
            });
        }
    });

    _mostrarNotificacaoAlerta(devem);
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
setupBusca();
carregarComandos();
carregarConfig();
pedirPermissaoNotif();

authReady.then(async () => {
    await carregar();
    carregarEncomendas();
    verificarDisparos();
    // Processa parâmetro ?foco= vindo do badge do Dashboard
    const params = new URLSearchParams(window.location.search);
    const foco = params.get('foco');
    const nav  = params.get('nav');
    if (nav)                                             navegar(nav);
    else if (foco === 'criticos' || foco === 'critico') navegar('hoje');
    else if (foco === 'pendentes')                       navegar('agendados');
    // Agenda re-render alinhado à virada do minuto (ex: XX:55:00, não XX:55:37)
    // para que os alertas apareçam exatamente no horário configurado
    (function agendarMinuto() {
        const agora = new Date();
        const msAteVirada = (60 - agora.getSeconds()) * 1000 - agora.getMilliseconds() + 50;
        setTimeout(() => {
            render();
            verificarDisparos();
            agendarMinuto(); // reprogramar para o próximo minuto
        }, msAteVirada);
    })();
});

// ── Exportar CSV ──────────────────────────────────────────────────────────────
function exportarCSV() {
    const cab = ['Título','Descrição','Tipo','Prioridade','Data','Hora','Repetição','Status','Categoria','Comando','Criado em','Concluído em','Link'];
    const linhas = [cab];
    st.lista.forEach(a => {
        const cmd = a.comandoId ? st.comandos.find(c=>c.id===a.comandoId) : null;
        linhas.push([
            a.titulo||'', (a.descricao||'').replace(/\n/g,' '), a.tipo||'', a.prioridade||'',
            a.data||'', a.hora||'', a.repeticao||'nenhuma', a.status||'', a.categoria||'',
            cmd ? cmd.titulo : '',
            a.criadoEmISO  ? new Date(a.criadoEmISO).toLocaleString('pt-BR')  : '',
            a.concluidoEmISO ? new Date(a.concluidoEmISO).toLocaleString('pt-BR') : '',
            a.link||''
        ]);
    });
    const csv = linhas.map(l => l.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const el   = document.createElement('a');
    el.href = url; el.download = `alertas_${hojeISO()}.csv`;
    document.body.appendChild(el); el.click(); document.body.removeChild(el);
    URL.revokeObjectURL(url);
    toast(`📥 ${st.lista.length} alerta(s) exportados com sucesso!`);
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD DE ALERTAS
// ══════════════════════════════════════════════════════════════════════════════
const painelState = { filtro: '30d', dateStart: '', dateEnd: '' };

function _painelRangeMs() {
    const agora = Date.now();
    const f = painelState.filtro;
    if (f === 'hoje')   return { ini: new Date(hojeISO()+'T00:00:00').getTime(), fim: agora };
    if (f === '7d')     return { ini: agora - 7  * 864e5, fim: agora };
    if (f === '30d')    return { ini: agora - 30 * 864e5, fim: agora };
    if (f === 'custom') {
        const ini = painelState.dateStart ? new Date(painelState.dateStart+'T00:00:00').getTime() : 0;
        const fim = painelState.dateEnd   ? new Date(painelState.dateEnd+'T23:59:59').getTime()   : agora;
        return { ini, fim };
    }
    return { ini: agora - 30 * 864e5, fim: agora };
}

function _painelFiltrar() {
    const { ini, fim } = _painelRangeMs();
    return st.lista.filter(a => {
        const ts = a.criadoEmISO ? new Date(a.criadoEmISO).getTime()
                 : (a.data ? new Date(a.data+'T00:00:00').getTime() : null);
        if (ts === null) return true;
        return ts >= ini && ts <= fim;
    });
}

// ── SVG Helpers ──────────────────────────────────────────────────────────────
function _svgDonut(segments, cx=80, cy=80, R=62, ri=40) {
    const total = segments.reduce((s,d)=>s+d.v, 0);
    if (!total) return `<svg viewBox="0 0 160 160" class="pd-donut-svg">
        <circle cx="80" cy="80" r="62" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="22"/>
        <text x="80" y="84" text-anchor="middle" fill="rgba(255,255,255,0.25)" font-size="13">Sem dados</text></svg>`;
    let ang = -Math.PI / 2;
    const arcs = segments.map(d => {
        if (!d.v) return '';
        const sw = (d.v / total) * 2 * Math.PI;
        const ea = ang + sw;
        const x1=cx+R*Math.cos(ang), y1=cy+R*Math.sin(ang);
        const x2=cx+R*Math.cos(ea),  y2=cy+R*Math.sin(ea);
        const ix1=cx+ri*Math.cos(ang),iy1=cy+ri*Math.sin(ang);
        const ix2=cx+ri*Math.cos(ea), iy2=cy+ri*Math.sin(ea);
        const lg = sw > Math.PI ? 1 : 0;
        const p = `M${x1} ${y1}A${R} ${R} 0 ${lg} 1 ${x2} ${y2}L${ix2} ${iy2}A${ri} ${ri} 0 ${lg} 0 ${ix1} ${iy1}Z`;
        ang = ea;
        return `<path d="${p}" fill="${d.color}"><title>${d.label}: ${d.v}</title></path>`;
    });
    return `<svg viewBox="0 0 160 160" class="pd-donut-svg">${arcs.join('')}
        <text x="${cx}" y="${cy-7}" text-anchor="middle" fill="var(--text)" font-size="22" font-weight="800">${total}</text>
        <text x="${cx}" y="${cy+11}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="10">alertas</text></svg>`;
}

function _svgBarsH(rows) {
    if (!rows.length) return '<div class="pd-empty">Sem dados</div>';
    const maxV = Math.max(...rows.map(r=>r.v), 1);
    const BH = 20, GAP = 10, LW = 85, BW = 180, NUM = 32;
    const H = rows.length * (BH + GAP) + 4;
    const lines = rows.map((r, i) => {
        const y = i * (BH + GAP);
        const w = Math.max(3, (r.v / maxV) * BW);
        const pct = Math.round((r.v / maxV) * 100);
        return `
            <text x="0" y="${y+BH-4}" fill="rgba(255,255,255,0.5)" font-size="10.5">${r.label}</text>
            <rect x="${LW}" y="${y}" width="${w}" height="${BH}" fill="${r.color}" rx="4" opacity="0.85"/>
            <text x="${LW+w+5}" y="${y+BH-4}" fill="rgba(255,255,255,0.6)" font-size="10">${r.v}${r.v && maxV > 0 ? ` (${pct}%)` : ''}</text>`;
    });
    return `<svg viewBox="0 0 ${LW+BW+NUM} ${H}" style="width:100%;overflow:visible;display:block">${lines.join('')}</svg>`;
}

function _svgLine(series, labels) {
    const W=340, H=120, padL=28, padB=24, padT=8, padR=10;
    const IW = W - padL - padR, IH = H - padB - padT;
    const allVals = series.flatMap(s => s.data);
    const maxV = Math.max(...allVals, 1);
    const n = labels.length;
    const px = i => padL + (n > 1 ? (i/(n-1)) * IW : IW/2);
    const py = v => padT + IH - (v/maxV)*IH;

    const grid = [0,0.25,0.5,0.75,1].map(f => {
        const yg = py(maxV * f); const lv = Math.round(maxV * f);
        return `<line x1="${padL}" y1="${yg}" x2="${W-padR}" y2="${yg}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
                <text x="${padL-3}" y="${yg+3}" text-anchor="end" fill="rgba(255,255,255,0.25)" font-size="8">${lv}</text>`;
    });

    const xLabels = labels.map((l, i) => {
        if (n <= 1 || i % Math.max(1, Math.floor(n/5)) !== 0) return '';
        return `<text x="${px(i)}" y="${H-2}" text-anchor="middle" fill="rgba(255,255,255,0.25)" font-size="8">${l}</text>`;
    });

    const polylines = series.map(s => {
        const pts = s.data.map((v,i) => `${px(i)},${py(v)}`).join(' ');
        const dots = s.data.map((v,i) => v > 0 ? `<circle cx="${px(i)}" cy="${py(v)}" r="2.5" fill="${s.color}"/>` : '').join('');
        return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
    });

    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">${grid.join('')}${xLabels.join('')}${polylines.join('')}</svg>`;
}

// ── Render Painel ─────────────────────────────────────────────────────────────
function renderPainel() {
    const el = document.getElementById('panel-painel');
    if (!el || st.secao !== 'painel') return;

    const lista = _painelFiltrar();
    const { ini, fim } = _painelRangeMs();
    const hoje = hojeISO();

    // ── KPIs
    const ativos    = lista.filter(a => a.status !== 'concluido');
    const concl     = lista.filter(a => a.status === 'concluido');
    const vencidos  = ativos.filter(a => (a.data || '') < hoje);
    const adiados   = lista.filter(a => a.adiadoPor);

    const tempos = concl
        .filter(a => a.criadoEmISO && a.concluidoEmISO)
        .map(a => (new Date(a.concluidoEmISO) - new Date(a.criadoEmISO)) / 36e5);
    const tempoMedio = tempos.length ? (tempos.reduce((s,t)=>s+t,0) / tempos.length) : null;
    const tempoFmt = tempoMedio === null ? '—'
        : tempoMedio < 1 ? `${Math.round(tempoMedio*60)} min`
        : tempoMedio < 24 ? `${tempoMedio.toFixed(1).replace('.',',')}h`
        : `${(tempoMedio/24).toFixed(1).replace('.',',')}d`;

    // ── Donut prioridade
    const prioCores = { critica:'#ef4444', alta:'#fb923c', media:'#fbbf24', baixa:'#94a3b8' };
    const prioData = Object.entries(prioCores).map(([p,c]) => ({
        label: { critica:'Crítica', alta:'Alta', media:'Média', baixa:'Baixa' }[p],
        v: lista.filter(a => a.prioridade === p).length,
        color: c,
    }));

    // ── Bars por tipo
    const tipoNames = { os:'🔧 OS', cliente:'👤 Cliente', agenda:'📅 Agenda', whatsapp:'📱 WhatsApp',
        financeiro:'💰 Financeiro', estoque:'📦 Estoque', meta:'🎯 Meta', lembrete:'🔔 Lembrete',
        tarefa:'✅ Tarefa', comando:'⚡ Comando', fornecedor:'🏢 Fornecedor', outro:'📌 Outro' };
    const tipoCores = { os:'#6366f1', cliente:'#22d3ee', agenda:'#a78bfa', whatsapp:'#4ade80',
        financeiro:'#fbbf24', estoque:'#f97316', meta:'#ec4899', lembrete:'#94a3b8',
        tarefa:'#4ade80', comando:'#818cf8', fornecedor:'#fb923c', outro:'#64748b' };
    const tipoRows = Object.entries(tipoNames).map(([t,lbl]) => ({
        label: lbl,
        v: lista.filter(a => (a.tipo || 'lembrete') === t).length,
        color: tipoCores[t] || '#64748b',
    })).filter(r => r.v > 0).sort((a,b)=>b.v-a.v).slice(0,10);

    // ── Linha temporal (criados vs concluídos)
    const dias = painelState.filtro === 'hoje' ? 1
               : painelState.filtro === '7d'   ? 7
               : painelState.filtro === 'custom' && painelState.dateStart && painelState.dateEnd
                 ? Math.max(1, Math.round((new Date(painelState.dateEnd) - new Date(painelState.dateStart)) / 864e5) + 1)
               : 30;
    const criados30 = [], concl30 = [], labels30 = [];
    for (let d = 0; d < dias; d++) {
        const dayMs = fim - (dias - 1 - d) * 864e5;
        const dayISO = new Date(dayMs).toISOString().slice(0,10);
        labels30.push(dayISO.slice(5));
        criados30.push(lista.filter(a => {
            const ts = a.criadoEmISO || (a.data ? a.data + 'T00:00:00' : null);
            return ts && ts.slice(0,10) === dayISO;
        }).length);
        concl30.push(concl.filter(a => a.concluidoEmISO?.slice(0,10) === dayISO).length);
    }
    const lineSVG = _svgLine(
        [{ data: criados30, color: '#6366f1' }, { data: concl30, color: '#4ade80' }],
        labels30
    );

    // ── Render
    el.innerHTML = `
    <div class="pd-header">
        <h2 class="pd-title">📊 Dashboard de Alertas</h2>
        <div class="pd-filtros">
            <button class="pd-filtro-btn${painelState.filtro==='hoje' ? ' active' : ''}" onclick="Alertas._painelSetFiltro('hoje')">Hoje</button>
            <button class="pd-filtro-btn${painelState.filtro==='7d'   ? ' active' : ''}" onclick="Alertas._painelSetFiltro('7d')">7 dias</button>
            <button class="pd-filtro-btn${painelState.filtro==='30d'  ? ' active' : ''}" onclick="Alertas._painelSetFiltro('30d')">30 dias</button>
            <button class="pd-filtro-btn${painelState.filtro==='custom'?' active' : ''}" onclick="Alertas._painelSetFiltro('custom')">Personalizado</button>
            <div class="pd-custom-range${painelState.filtro==='custom'?' visible':''}">
                <input type="date" id="pd-date-start" value="${painelState.dateStart}" onchange="Alertas._painelCustomDate()" max="${hoje}">
                <span>até</span>
                <input type="date" id="pd-date-end"   value="${painelState.dateEnd}"   onchange="Alertas._painelCustomDate()" max="${hoje}">
            </div>
        </div>
    </div>

    <div class="pd-kpis">
        <div class="pd-kpi pd-kpi-ativo">
            <div class="pd-kpi-num">${ativos.length}</div>
            <div class="pd-kpi-label">Ativos</div>
        </div>
        <div class="pd-kpi pd-kpi-concluido">
            <div class="pd-kpi-num">${concl.length}</div>
            <div class="pd-kpi-label">Concluídos</div>
        </div>
        <div class="pd-kpi pd-kpi-vencido">
            <div class="pd-kpi-num">${vencidos.length}</div>
            <div class="pd-kpi-label">Vencidos</div>
        </div>
        <div class="pd-kpi pd-kpi-adiado">
            <div class="pd-kpi-num">${adiados.length}</div>
            <div class="pd-kpi-label">Adiados</div>
        </div>
        <div class="pd-kpi pd-kpi-tempo">
            <div class="pd-kpi-num">${tempoFmt}</div>
            <div class="pd-kpi-label">Tempo médio</div>
        </div>
    </div>

    <div class="pd-charts">
        <div class="pd-chart-card">
            <div class="pd-chart-titulo">Por Prioridade</div>
            <div class="pd-donut-wrap">
                ${_svgDonut(prioData)}
                <div class="pd-donut-legend">
                    ${prioData.map(d=>`<div class="pd-legend-item"><span class="pd-legend-dot" style="background:${d.color}"></span><span>${d.label}</span><strong>${d.v}</strong></div>`).join('')}
                </div>
            </div>
        </div>

        <div class="pd-chart-card">
            <div class="pd-chart-titulo">Por Módulo / Tipo</div>
            ${tipoRows.length ? _svgBarsH(tipoRows) : '<div class="pd-empty">Sem dados no período</div>'}
        </div>
    </div>

    <div class="pd-chart-card pd-chart-card--full">
        <div class="pd-chart-titulo">Criados <span style="color:#6366f1">▬</span> vs Concluídos <span style="color:#4ade80">▬</span></div>
        ${lineSVG}
    </div>

    <div class="pd-taxa-row">
        <div class="pd-taxa-card">
            <div class="pd-taxa-label">Taxa de conclusão</div>
            <div class="pd-taxa-bar-wrap"><div class="pd-taxa-bar" style="width:${lista.length ? Math.round((concl.length/lista.length)*100) : 0}%"></div></div>
            <div class="pd-taxa-pct">${lista.length ? Math.round((concl.length/lista.length)*100) : 0}%</div>
        </div>
        <div class="pd-taxa-card">
            <div class="pd-taxa-label">Taxa de vencimento</div>
            <div class="pd-taxa-bar-wrap"><div class="pd-taxa-bar pd-taxa-bar--danger" style="width:${ativos.length ? Math.round((vencidos.length/ativos.length)*100) : 0}%"></div></div>
            <div class="pd-taxa-pct">${ativos.length ? Math.round((vencidos.length/ativos.length)*100) : 0}%</div>
        </div>
    </div>`;
}

function _painelSetFiltro(f) {
    painelState.filtro = f;
    renderPainel();
}
function _painelCustomDate() {
    const s = document.getElementById('pd-date-start');
    const e = document.getElementById('pd-date-end');
    if (s) painelState.dateStart = s.value;
    if (e) painelState.dateEnd   = e.value;
    renderPainel();
}

// ══════════════════════════════════════════════════════════════════════════════
// DIAGNÓSTICO DO SISTEMA — Log de Sons e Eventos
// ══════════════════════════════════════════════════════════════════════════════
const DIAG_LS = 'cc_eventos_log';
const DIAG_TIPOS = { som:'🔊 Som', notificacao:'🔔 Notif.', firestore:'🔥 Firestore', bloqueado:'🔇 Bloq.', cooldown:'⏳ Cooldown', automacao:'🤖 Auto', sistema:'⚙️ Sistema', info:'ℹ️ Info' };
const diag = { filtroTipo: '' };

function _lerLogDiag() {
    try { return JSON.parse(localStorage.getItem(DIAG_LS) || '[]'); }
    catch { return []; }
}
function _limparLogDiag() {
    localStorage.removeItem(DIAG_LS);
    renderDiagnostico();
    _atualizarBadgeDiag();
}
function _atualizarBadgeDiag() {
    const log = _lerLogDiag();
    const sons = log.filter(e => e.tipo === 'som' && Date.now() - new Date(e.ts).getTime() < 3600000).length;
    const badge = document.getElementById('sb-badge-diagnostico');
    if (badge) { badge.textContent = sons || ''; badge.classList.toggle('show', sons > 0); }
}

function renderDiagnostico() {
    const el = document.getElementById('panel-diagnostico');
    if (!el || st.secao !== 'diagnostico') return;
    const log = _lerLogDiag();

    const filtrados = diag.filtroTipo
        ? log.filter(e => diag.filtroTipo === 'bloqueado'
            ? (e.tipo === 'bloqueado' || e.tipo === 'cooldown')
            : e.tipo === diag.filtroTipo)
        : log;

    const ultimoSom = log.find(e => e.tipo === 'som');
    const totalSons = log.filter(e => e.tipo === 'som').length;
    const totalNot  = log.filter(e => e.tipo === 'notificacao').length;
    const totalFire = log.filter(e => e.tipo === 'firestore').length;
    const totalBlq  = log.filter(e => e.tipo === 'bloqueado' || e.tipo === 'cooldown').length;
    const bloqueados = log.filter(e => e.tipo === 'bloqueado' || e.tipo === 'cooldown').slice(0, 5);

    const fmtTs = iso => {
        const d = new Date(iso);
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    };

    const statusBadge = e => {
        const s = e.status || (e.tipo === 'som' ? 'EXECUTADO' : e.tipo === 'bloqueado' ? 'BLOQUEADO' : e.tipo === 'cooldown' ? 'COOLDOWN' : '');
        if (!s) return '<span class="diag-status-empty">—</span>';
        const cls = s === 'EXECUTADO' ? 'diag-status-ok' : s === 'BLOQUEADO' ? 'diag-status-blq' : s === 'COOLDOWN' ? 'diag-status-cd' : '';
        return `<span class="diag-status-badge ${cls}">${s}</span>`;
    };

    const linhas = filtrados.slice(0, 200).map(e => `
        <tr class="diag-row diag-tipo-${e.tipo}">
            <td class="diag-ts">${fmtTs(e.ts)}</td>
            <td class="diag-tipo-badge">${DIAG_TIPOS[e.tipo] || e.tipo}</td>
            <td class="diag-origem">${esc(e.origem || '—')}</td>
            <td class="diag-evento">${esc(e.evento || '—')}</td>
            <td class="diag-arquivo">${esc(e.arquivo || '—')}</td>
            <td class="diag-status-col">${statusBadge(e)}</td>
            <td class="diag-motivo">${e.motivo ? `<span class="diag-motivo-text">${esc(e.motivo)}</span>` : '—'}</td>
        </tr>`).join('');

    const bloqRows = bloqueados.map(e => `
        <div class="diag-blq-item">
            <span class="diag-blq-ts">🕐 ${fmtTs(e.ts)}</span>
            <span class="diag-blq-modulo">📂 ${esc(e.origem || '—')}</span>
            <span class="diag-blq-evento">📋 ${esc(e.evento || '—')}</span>
            <span class="diag-blq-badge">${e.tipo === 'cooldown' ? 'COOLDOWN' : 'BLOQUEADO'}</span>
            ${e.motivo ? `<span class="diag-blq-motivo">Motivo: ${esc(e.motivo)}</span>` : ''}
        </div>`).join('');

    el.innerHTML = `
    <div class="diag-header">
        <div>
            <h2 class="diag-title">🔎 Diagnóstico do Sistema</h2>
            <div class="diag-sub">Rastreamento de todos os sons, notificações e eventos internos em tempo real.</div>
        </div>
        <div class="diag-actions">
            <button class="diag-btn-clear" onclick="Alertas._limparLogDiag()">🗑️ Limpar Log</button>
            <button class="diag-btn-refresh" onclick="Alertas.renderDiagnostico()">↺ Atualizar</button>
        </div>
    </div>

    ${ultimoSom ? `
    <div class="diag-ultimo-som">
        <div class="diag-ultimo-label">🔊 Último Som Executado</div>
        <div class="diag-ultimo-info">
            <span class="diag-ultimo-ts">🕐 ${fmtTs(ultimoSom.ts)}</span>
            <span class="diag-ultimo-origem">📂 ${esc(ultimoSom.origem)}</span>
            <span class="diag-ultimo-evento">📋 ${esc(ultimoSom.evento)}</span>
            ${ultimoSom.arquivo ? `<span class="diag-ultimo-arquivo">🎵 ${esc(ultimoSom.arquivo)}</span>` : ''}
        </div>
    </div>` : `<div class="diag-sem-som">✅ Nenhum som registrado nesta sessão.</div>`}

    <div class="diag-status-atual">
        <div class="diag-status-titulo">Sons do Sistema</div>
        <div class="diag-status-valor ${localStorage.getItem('cc_sons_sistema') === 'true' ? 'diag-status-on' : 'diag-status-off'}">
            ${localStorage.getItem('cc_sons_sistema') === 'true' ? '🔊 ATIVADOS' : '🔇 DESATIVADOS'}
        </div>
        <div class="diag-status-hint">${localStorage.getItem('cc_sons_sistema') === 'true'
            ? 'O botão 🔊 Sons do Sistema no cabeçalho está ON.'
            : 'O botão 🔇 Sons do Sistema no cabeçalho está OFF — nenhum som será executado.'}</div>
    </div>

    ${bloqueados.length ? `
    <div class="diag-blq-secao">
        <div class="diag-blq-titulo">🔇 Sons Bloqueados Recentes</div>
        ${bloqRows}
    </div>` : ''}

    <div class="diag-kpis">
        <div class="diag-kpi diag-kpi-som"><div class="diag-kpi-num">${totalSons}</div><div class="diag-kpi-lbl">Sons</div></div>
        <div class="diag-kpi diag-kpi-not"><div class="diag-kpi-num">${totalNot}</div><div class="diag-kpi-lbl">Notificações</div></div>
        <div class="diag-kpi diag-kpi-fire"><div class="diag-kpi-num">${totalFire}</div><div class="diag-kpi-lbl">Firestore</div></div>
        <div class="diag-kpi diag-kpi-blq"><div class="diag-kpi-num">${totalBlq}</div><div class="diag-kpi-lbl">Bloqueados</div></div>
        <div class="diag-kpi diag-kpi-total"><div class="diag-kpi-num">${log.length}</div><div class="diag-kpi-lbl">Total</div></div>
    </div>

    <div class="diag-filtros">
        <button class="diag-fil${!diag.filtroTipo?' active':''}" onclick="Alertas._diagFiltro('')">Todos</button>
        <button class="diag-fil${diag.filtroTipo==='som'?' active':''}" onclick="Alertas._diagFiltro('som')">🔊 Sons</button>
        <button class="diag-fil${diag.filtroTipo==='notificacao'?' active':''}" onclick="Alertas._diagFiltro('notificacao')">🔔 Notif.</button>
        <button class="diag-fil${diag.filtroTipo==='firestore'?' active':''}" onclick="Alertas._diagFiltro('firestore')">🔥 Firestore</button>
        <button class="diag-fil${diag.filtroTipo==='bloqueado'?' active':''}" onclick="Alertas._diagFiltro('bloqueado')">🔇 Bloqueados</button>
    </div>

    <div class="diag-table-wrap">
        ${filtrados.length ? `
        <table class="diag-table">
            <thead><tr>
                <th>Data/Hora</th><th>Tipo</th><th>Módulo</th><th>Evento</th>
                <th>Arquivo de Áudio</th><th>Status</th><th>Motivo</th>
            </tr></thead>
            <tbody>${linhas}</tbody>
        </table>` : '<div class="diag-vazio">Nenhum evento registrado com este filtro.</div>'}
    </div>`;

    _atualizarBadgeDiag();
}

function _diagFiltro(tipo) {
    diag.filtroTipo = tipo;
    renderDiagnostico();
}

// ── Modo Foco ─────────────────────────────────────────────────────────────────
const foco = { lista: [], idx: 0 };

function _focoFila() {
    const prioPeso = { critica: 0, alta: 1, media: 2, baixa: 3 };
    const ativos = [
        ...listaVencidos(),
        ...listaHoje().filter(a => !listaVencidos().find(v => v.id === a.id)),
        ...listaAtivos().filter(a => !listaVencidos().find(v => v.id === a.id) && !listaHoje().find(h => h.id === a.id)),
    ];
    const vistos = new Set();
    return ativos.filter(a => { if (vistos.has(a.id)) return false; vistos.add(a.id); return true; })
        .sort((a, b) => (prioPeso[a.prioridade] ?? 2) - (prioPeso[b.prioridade] ?? 2));
}

function abrirModoFoco() {
    foco.lista = _focoFila();
    foco.idx = 0;
    if (!foco.lista.length) { toast('✅ Nenhum alerta pendente no momento!'); return; }
    document.getElementById('al-modal-foco').classList.add('active');
    _focoRender();
}

function fecharModoFoco() {
    document.getElementById('al-modal-foco').classList.remove('active');
}

function _focoRender() {
    const total = foco.lista.length;
    const a = foco.lista[foco.idx];
    const counter = document.getElementById('foco-counter');
    const content = document.getElementById('foco-content');
    const actions = document.getElementById('foco-actions');
    const bar     = document.getElementById('foco-progress');

    if (!a) {
        if (counter) counter.textContent = '';
        if (bar) bar.style.width = '100%';
        if (content) content.innerHTML = `
            <div class="foco-done">
                <div class="foco-done-icon">🎉</div>
                <div class="foco-done-title">Todos os alertas foram processados!</div>
                <div class="foco-done-sub">Fila limpa. Bom trabalho!</div>
                <button class="foco-btn-fechar" onclick="Alertas.fecharModoFoco()">Fechar</button>
            </div>`;
        if (actions) actions.style.display = 'none';
        return;
    }

    if (counter) counter.textContent = `Alerta ${foco.idx + 1} de ${total}`;
    if (bar) bar.style.width = total > 1 ? `${(foco.idx / (total - 1)) * 100}%` : '100%';
    if (actions) actions.style.display = '';

    const prioLabel = { critica: '🔴 Crítica', alta: '🟠 Alta', media: '🟡 Média', baixa: '⚪ Baixa' };
    const tLabel = tipoLabel(a.tipo);
    const dataFmt = a.data ? fmtData(dataEfetiva(a)) : '';
    const cmd = a.comandoId ? st.comandos.find(c => c.id === a.comandoId) : null;

    const destino = a.link || (_ACAO_RAPIDA_MAP[a.tipo]?.url ?? '');
    const acaoLabel = a.link ? '🔗 Abrir Link' : (_ACAO_RAPIDA_MAP[a.tipo]?.label ?? '');

    if (content) content.innerHTML = `
        <div class="foco-prioridade prio-${a.prioridade || 'media'}">${prioLabel[a.prioridade] || '🟡 Média'}</div>
        <h2 class="foco-titulo">${esc(a.titulo || 'Alerta')}</h2>
        ${a.descricao ? `<p class="foco-descricao">${esc(a.descricao)}</p>` : ''}
        <div class="foco-meta">
            ${dataFmt ? `<span>📅 ${dataFmt}</span>` : ''}
            ${a.hora   ? `<span>🕐 ${esc(a.hora)}</span>` : ''}
            ${tLabel   ? `<span>${esc(tLabel)}</span>` : ''}
            ${cmd      ? `<span>⚡ ${esc(cmd.titulo)}</span>` : ''}
        </div>
        ${destino ? `<a href="${esc(destino)}" class="foco-link" target="_blank" onclick="event.stopPropagation()">${acaoLabel}</a>` : ''}
    `;

    // atualiza botão "Abrir Link" nas actions
    const btnLink = document.getElementById('foco-btn-link');
    if (btnLink) {
        btnLink.style.display = destino ? '' : 'none';
        btnLink.textContent = acaoLabel || '🔗 Abrir Link';
        btnLink.onclick = () => window.open(destino, '_blank');
    }
}

async function focoConcluir() {
    const a = foco.lista[foco.idx];
    if (!a) return;
    await concluir(a.id);
    foco.lista = _focoFila();
    if (foco.idx >= foco.lista.length) foco.idx = Math.max(0, foco.lista.length - 1);
    _focoRender();
}

async function focoAdiar(minutos) {
    const a = foco.lista[foco.idx];
    if (!a) return;
    const novaData = new Date(Date.now() + minutos * 60000);
    const novaDataISO  = novaData.toISOString().slice(0, 10);
    const novaHora     = `${String(novaData.getHours()).padStart(2,'0')}:${String(novaData.getMinutes()).padStart(2,'0')}`;
    a.data = novaDataISO; a.hora = novaHora; a.adiadoEm = new Date().toISOString(); a.adiadoPor = minutos;
    try {
        await setDoc(doc(db, COL, a.id), {
            data: novaDataISO, hora: novaHora, adiadoEm: a.adiadoEm, adiadoPor: minutos,
            atualizadoEm: serverTimestamp(), atualizadoEmISO: a.adiadoEm
        }, { merge: true });
        toast(`⏰ Adiado ${minutos < 60 ? minutos + ' min' : (minutos/60) + 'h'} — novo horário: ${novaHora}`);
    } catch { toast('⏰ Adiado localmente.'); }
    localStorage.setItem(CACHE_KEY, JSON.stringify(st.lista));
    render();
    foco.lista = _focoFila();
    if (foco.idx >= foco.lista.length) foco.idx = Math.max(0, foco.lista.length - 1);
    _focoRender();
}

function focoProximo() {
    if (foco.idx < foco.lista.length - 1) { foco.idx++; }
    else { foco.idx = foco.lista.length; } // dispara tela "concluído"
    _focoRender();
}

// ═══════════════════════════════════════════════════════════════════════════
// 📦 ENCOMENDAS — Painel na Central de Alertas
// ═══════════════════════════════════════════════════════════════════════════
const COL_ENC = 'encomendas';
const ENC_CACHE = 'cc_encomendas_cache';

const ENC_STATUS_LABEL = {
    aguardando_compra: '⏳ Aguardando Compra',
    comprada:          '🛍️ Comprada',
    em_transporte:     '🚚 Em Transporte',
    disponivel:        '📬 Disponível p/ Retirada',
    entregue:          '✅ Entregue',
    cancelada:         '❌ Cancelada',
};

const ENC_STATUS_COR = {
    aguardando_compra: '#fbbf24',
    comprada:          '#60a5fa',
    em_transporte:     '#a78bfa',
    disponivel:        '#34d399',
    entregue:          '#6b7280',
    cancelada:         '#f87171',
};

const ENC_TIPO_ALERTA_LABEL = {
    comprar_produto:      '🛒 Comprar produto',
    consultar_fornecedor: '🏪 Consultar fornecedor',
    cobrar_fornecedor:    '💰 Cobrar fornecedor',
    avisar_cliente:       '📞 Avisar cliente',
    confirmar_retirada:   '✅ Confirmar retirada',
    personalizado:        '✏️ Alerta personalizado',
};

let _encEditId   = null;
let _encAlertaId = null;

function _encHoje() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function _encDiasRestantes(dataPrevista) {
    if (!dataPrevista) return null;
    const hoje = new Date(_encHoje() + 'T00:00:00');
    const prev = new Date(dataPrevista + 'T00:00:00');
    return Math.round((prev - hoje) / 86400000);
}

async function carregarEncomendas() {
    try {
        const snap = await getDocs(query(collection(db, COL_ENC), orderBy('criadoEmISO', 'desc')));
        st.encomendas = [];
        snap.forEach(d => st.encomendas.push({ id: d.id, ...d.data() }));
        localStorage.setItem(ENC_CACHE, JSON.stringify(st.encomendas));
    } catch {
        st.encomendas = JSON.parse(localStorage.getItem(ENC_CACHE) || '[]');
    }
    renderEncomendas();
    _atualizarBadgeEncomendas();
}

function _atualizarBadgeEncomendas() {
    const pendentes = st.encomendas.filter(e =>
        ['aguardando_compra','comprada','em_transporte','disponivel'].includes(e.status)
    ).length;
    const badge = document.getElementById('sb-badge-encomendas');
    if (badge) {
        badge.textContent = pendentes || '';
        badge.style.display = pendentes > 0 ? '' : 'none';
    }
}

function filtrarEncomendas(filtro) {
    st.encFiltro = filtro;
    document.querySelectorAll('.enc-filtro-btn:not(.enc-filtro-meu)').forEach(b =>
        b.classList.toggle('active', b.dataset.filtro === filtro)
    );
    renderEncomendas();
}

function toggleMinhasEncomendas() {
    st.encFiltroMeu = !st.encFiltroMeu;
    const btn = document.getElementById('enc-btn-meu');
    if (btn) btn.classList.toggle('active', st.encFiltroMeu);
    renderEncomendas();
}

function _encFiltrar(lista, filtro) {
    const hoje = _encHoje();
    switch (filtro) {
        case 'pendentes':
            return lista.filter(e => ['aguardando_compra','comprada'].includes(e.status));
        case 'em_transporte':
            return lista.filter(e => e.status === 'em_transporte');
        case 'disponivel':
            return lista.filter(e => e.status === 'disponivel');
        case 'entregue':
            return lista.filter(e => e.status === 'entregue');
        case 'atrasadas':
            return lista.filter(e =>
                e.dataPrevista && e.dataPrevista < hoje &&
                !['entregue','cancelada'].includes(e.status)
            );
        default:
            return lista;
    }
}

function renderEncomendas() {
    const el = document.getElementById('lista-encomendas');
    if (!el) return;

    _renderEncStats();

    let source = st.encomendas;
    if (st.encFiltroMeu) {
        const uid = auth?.currentUser?.uid;
        if (uid) source = source.filter(e => e.criadoPor === uid);
    }

    const lista = _encFiltrar(source, st.encFiltro);
    if (!lista.length) {
        el.innerHTML = `<div class="enc-empty">
            <div style="font-size:32px;margin-bottom:8px">📦</div>
            <div>Nenhuma encomenda nesta categoria${st.encFiltroMeu ? ' (filtrando por suas encomendas)' : ''}</div>
        </div>`;
        return;
    }
    el.innerHTML = lista.map(e => _encCard(e)).join('');
}

function _renderEncStats() {
    const el = document.getElementById('enc-stats');
    if (!el) return;
    const hoje = _encHoje();
    const abertas    = st.encomendas.filter(e => !['entregue','cancelada'].includes(e.status)).length;
    const atrasadas  = st.encomendas.filter(e => e.dataPrevista && e.dataPrevista < hoje && !['entregue','cancelada'].includes(e.status)).length;
    const entregues  = st.encomendas.filter(e => e.status === 'entregue').length;
    const canceladas = st.encomendas.filter(e => e.status === 'cancelada').length;
    const valorAberto = st.encomendas
        .filter(e => !['entregue','cancelada'].includes(e.status))
        .reduce((s, e) => s + (Number(e.valorCombinado) || Number(e.valorVenda) || 0), 0);
    el.innerHTML = `
        <div class="enc-stat ${abertas > 0 ? 'ativa' : ''}">
            <span class="enc-stat-num">${abertas}</span>
            <span class="enc-stat-label">Em Aberto</span>
        </div>
        <div class="enc-stat ${atrasadas > 0 ? 'atrasada' : ''}">
            <span class="enc-stat-num">${atrasadas}</span>
            <span class="enc-stat-label">Atrasadas</span>
        </div>
        <div class="enc-stat entregue">
            <span class="enc-stat-num">${entregues}</span>
            <span class="enc-stat-label">Entregues</span>
        </div>
        <div class="enc-stat cancelada">
            <span class="enc-stat-num">${canceladas}</span>
            <span class="enc-stat-label">Canceladas</span>
        </div>
        ${valorAberto > 0 ? `<div class="enc-stat valor">
            <span class="enc-stat-num">R$ ${valorAberto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
            <span class="enc-stat-label">Valor em Aberto</span>
        </div>` : ''}
    `;
}

function _encCard(e) {
    const cor   = ENC_STATUS_COR[e.status] || '#adb5bd';
    const label = ENC_STATUS_LABEL[e.status] || e.status;
    const dias  = _encDiasRestantes(e.dataPrevista);
    let diasLabel = '';
    if (dias !== null) {
        if (dias < 0)        diasLabel = `<span class="enc-dias atrasado">${Math.abs(dias)}d atrasado</span>`;
        else if (dias === 0) diasLabel = `<span class="enc-dias hoje">Chega hoje!</span>`;
        else                 diasLabel = `<span class="enc-dias">${dias}d restantes</span>`;
    }
    const dtEnc  = e.dataEncomenda ? fmtData(e.dataEncomenda) : '—';
    const dtPrev = e.dataPrevista  ? fmtData(e.dataPrevista)  : '—';
    const vComb  = e.valorCombinado ? `R$ ${Number(e.valorCombinado).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '';
    const lucro  = (e.valorVenda != null && e.valorCusto != null) ? Number(e.valorVenda) - Number(e.valorCusto) : null;
    const modeloLabel = e.modelo ? ` <span class="enc-modelo">${esc(e.modelo)}</span>` : '';
    const btnsStatus = _encBotoesStatus(e);
    const historico  = (e.historicoStatus || []).slice().reverse();

    const waNum = (e.whatsapp || e.telefone || '').replace(/\D/g, '');
    const mensagemWA = encodeURIComponent(`Olá ${e.cliente}, sua encomenda de ${e.produto} está disponível para retirada na Cell City! 📦`);
    const waHref = waNum ? `https://wa.me/55${waNum}?text=${mensagemWA}` : '';

    return `<div class="enc-card" id="enc-card-${esc(e.id)}" style="border-left:4px solid ${cor}">
        <div class="enc-card-header">
            <span class="enc-status-badge" style="background:${cor}20;color:${cor};border-color:${cor}40">${label}</span>
            ${diasLabel}
        </div>
        <div class="enc-card-body">
            <div class="enc-cliente">👤 <strong>${esc(e.cliente)}</strong></div>
            <div class="enc-produto">📦 ${esc(e.produto)}${modeloLabel}${e.quantidade > 1 ? ` <span class="enc-qtd">×${e.quantidade}</span>` : ''}</div>
            ${e.fornecedorSugerido ? `<div class="enc-fornecedor">🏪 ${esc(e.fornecedorSugerido)}</div>` : ''}
            ${e.telefone || e.whatsapp ? `<div class="enc-contato">📞 ${esc(e.telefone || e.whatsapp)}</div>` : ''}
            <div class="enc-datas">📅 ${dtEnc}${e.dataPrevista ? ` → ${dtPrev}` : ''}</div>
            ${vComb || lucro !== null ? `<div class="enc-valores">
                ${vComb ? `<span class="enc-val-tag comb">💰 ${vComb}</span>` : ''}
                ${lucro !== null ? `<span class="enc-val-tag ${lucro >= 0 ? 'lucro' : 'prejuizo'}">📈 Lucro: R$ ${lucro.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>` : ''}
            </div>` : ''}
            ${e.observacoes ? `<div class="enc-obs">📝 ${esc(e.observacoes)}</div>` : ''}
            ${e.observacoesInternas ? `<div class="enc-obs-int">🔒 ${esc(e.observacoesInternas)}</div>` : ''}
        </div>
        ${btnsStatus ? `<div class="enc-card-actions">${btnsStatus}</div>` : ''}
        <div class="enc-card-actions-sec">
            <button class="enc-btn-sec enc-btn-edit"   onclick="Alertas.abrirFormEncomenda('${esc(e.id)}')">✏️ Editar</button>
            <button class="enc-btn-sec enc-btn-alerta"  onclick="Alertas.abrirModalAlerta('${esc(e.id)}')">🔔 Alerta</button>
            ${waNum ? `<button class="enc-btn-sec enc-btn-wa" onclick="window.open('${waHref}','_blank')">📲 WhatsApp</button>` : ''}
            ${e.telefone ? `<button class="enc-btn-sec enc-btn-tel" onclick="window.location.href='tel:${e.telefone}'">📞 Ligar</button>` : ''}
            ${e.fornecedorSugerido ? `<button class="enc-btn-sec enc-btn-forn" onclick="Alertas.contatarFornecedor('${esc(e.id)}')">🏪 Fornecedor</button>` : ''}
            <button class="enc-btn-sec enc-btn-del" onclick="Alertas.excluirEncomenda('${esc(e.id)}')">🗑️ Excluir</button>
        </div>
        ${historico.length > 0 ? `<details class="enc-historico">
            <summary>📋 Histórico (${historico.length})</summary>
            <div class="enc-historico-lista">
                ${historico.map(h => `<div class="enc-hist-item">
                    <span class="enc-hist-status" style="color:${ENC_STATUS_COR[h.status]||'#888'}">${ENC_STATUS_LABEL[h.status] || h.status}</span>
                    <span class="enc-hist-data">${new Date(h.data).toLocaleString('pt-BR')}</span>
                    ${h.obs ? `<span class="enc-hist-obs">${esc(h.obs)}</span>` : ''}
                </div>`).join('')}
            </div>
        </details>` : ''}
    </div>`;
}

function _encBotoesStatus(e) {
    const id = esc(e.id);
    const fluxo = {
        aguardando_compra: [
            { status: 'comprada',      label: '✅ Marcar Comprada' },
            { status: 'cancelada',     label: '❌ Cancelar', cls: 'enc-btn-cancel' },
        ],
        comprada: [
            { status: 'em_transporte', label: '🚚 Em Transporte' },
            { status: 'cancelada',     label: '❌ Cancelar', cls: 'enc-btn-cancel' },
        ],
        em_transporte: [
            { label: '📥 Receber Produto', action: `Alertas.receberEncomenda('${id}')`, cls: 'enc-btn-receber' },
            { status: 'cancelada',          label: '❌ Cancelar', cls: 'enc-btn-cancel' },
        ],
        disponivel: [
            { status: 'entregue',      label: '✔️ Marcar Entregue', cls: 'enc-btn-entregue' },
        ],
        entregue:  [],
        cancelada: [
            { status: 'aguardando_compra', label: '↩️ Reabrir', cls: '' },
        ],
    };
    return (fluxo[e.status] || []).map(a => {
        if (a.action) return `<button class="enc-btn ${a.cls||''}" onclick="${a.action}">${a.label}</button>`;
        return `<button class="enc-btn ${a.cls||''}" onclick="Alertas.atualizarStatusEncomenda('${id}','${a.status}')">${a.label}</button>`;
    }).join('');
}

async function atualizarStatusEncomenda(id, novoStatus) {
    const enc = st.encomendas.find(e => e.id === id);
    if (!enc) return;
    const agoraISO = new Date().toISOString();
    const uid = auth?.currentUser?.uid || '';
    const historico = [...(enc.historicoStatus || []), {
        status: novoStatus, data: agoraISO, obs: '', usuario: uid
    }];
    try {
        await updateDoc(doc(db, COL_ENC, id), {
            status: novoStatus,
            historicoStatus: historico,
            atualizadoEm: serverTimestamp(),
            atualizadoEmISO: agoraISO,
        });
        enc.status = novoStatus;
        enc.historicoStatus = historico;
        enc.atualizadoEmISO = agoraISO;
        localStorage.setItem(ENC_CACHE, JSON.stringify(st.encomendas));
        if (novoStatus === 'disponivel') await _alertaClienteAguardando(enc);
        toast(`✅ Status atualizado: ${ENC_STATUS_LABEL[novoStatus] || novoStatus}`);
    } catch {
        toast('❌ Erro ao atualizar status.');
    }
    renderEncomendas();
    _atualizarBadgeEncomendas();
}

// ── Formulário unificado criar/editar ─────────────────────────────────────────
function abrirFormEncomenda(id) {
    _encEditId = id || null;
    const overlay = document.getElementById('enc-modal-form-overlay');
    if (!overlay) return;
    const titulo = document.getElementById('enc-modal-form-titulo');

    if (id) {
        const enc = st.encomendas.find(e => e.id === id);
        if (!enc) return;
        if (titulo) titulo.textContent = '✏️ Editar Encomenda';
        document.getElementById('enc-edit-id').value            = enc.id;
        document.getElementById('enc-edit-cliente').value       = enc.cliente || '';
        document.getElementById('enc-edit-telefone').value      = enc.telefone || '';
        document.getElementById('enc-edit-whatsapp').value      = enc.whatsapp || '';
        document.getElementById('enc-edit-produto').value       = enc.produto || '';
        document.getElementById('enc-edit-modelo').value        = enc.modelo || '';
        document.getElementById('enc-edit-quantidade').value    = enc.quantidade || 1;
        document.getElementById('enc-edit-valor').value         = enc.valorCombinado || '';
        document.getElementById('enc-edit-fornecedor').value    = enc.fornecedorSugerido || '';
        document.getElementById('enc-edit-custo').value         = enc.valorCusto || '';
        document.getElementById('enc-edit-venda').value         = enc.valorVenda || '';
        document.getElementById('enc-edit-data-encomenda').value = enc.dataEncomenda || '';
        document.getElementById('enc-edit-data-prevista').value  = enc.dataPrevista  || '';
        document.getElementById('enc-edit-obs').value           = enc.observacoes || '';
        document.getElementById('enc-edit-obs-int').value       = enc.observacoesInternas || '';
        calcLucroEdit();
    } else {
        if (titulo) titulo.textContent = '📦 Nova Encomenda';
        document.getElementById('enc-edit-id').value = '';
        ['enc-edit-cliente','enc-edit-telefone','enc-edit-whatsapp','enc-edit-produto',
         'enc-edit-modelo','enc-edit-fornecedor','enc-edit-obs','enc-edit-obs-int'].forEach(i => {
            const el = document.getElementById(i); if (el) el.value = '';
        });
        ['enc-edit-valor','enc-edit-custo','enc-edit-venda'].forEach(i => {
            const el = document.getElementById(i); if (el) el.value = '';
        });
        document.getElementById('enc-edit-quantidade').value = 1;
        const hoje = new Date(); const hISO = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
        document.getElementById('enc-edit-data-encomenda').value = hISO;
        document.getElementById('enc-edit-data-prevista').value  = '';
        const lucroEl = document.getElementById('enc-edit-lucro'); if (lucroEl) lucroEl.style.display = 'none';
    }
    overlay.style.display = 'flex';
    setTimeout(() => document.getElementById('enc-edit-cliente')?.focus(), 120);
}

function fecharFormEncomenda() {
    const overlay = document.getElementById('enc-modal-form-overlay');
    if (overlay) overlay.style.display = 'none';
    _encEditId = null;
}

function calcLucroEdit() {
    const custo = parseFloat(document.getElementById('enc-edit-custo')?.value) || 0;
    const venda = parseFloat(document.getElementById('enc-edit-venda')?.value) || 0;
    const el = document.getElementById('enc-edit-lucro');
    if (!el) return;
    if (custo > 0 || venda > 0) {
        const lucro = venda - custo;
        el.style.display = 'block';
        el.textContent = `📈 Lucro previsto: R$ ${lucro.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
        el.style.color = lucro >= 0 ? '#34d399' : '#f87171';
    } else {
        el.style.display = 'none';
    }
}

async function salvarFormEncomenda() {
    const cliente = document.getElementById('enc-edit-cliente')?.value.trim();
    const produto  = document.getElementById('enc-edit-produto')?.value.trim();
    if (!cliente) { toast('⚠️ Informe o nome do cliente'); return; }
    if (!produto)  { toast('⚠️ Informe o produto desejado'); return; }

    const agoraISO = new Date().toISOString();
    const uid = auth?.currentUser?.uid || '';
    const id  = document.getElementById('enc-edit-id')?.value;
    const custo = parseFloat(document.getElementById('enc-edit-custo')?.value) || 0;
    const venda = parseFloat(document.getElementById('enc-edit-venda')?.value) || 0;

    const dados = {
        cliente,
        telefone:            document.getElementById('enc-edit-telefone')?.value.trim()   || '',
        whatsapp:            document.getElementById('enc-edit-whatsapp')?.value.trim()   || '',
        produto,
        modelo:              document.getElementById('enc-edit-modelo')?.value.trim()     || '',
        quantidade:          parseInt(document.getElementById('enc-edit-quantidade')?.value || 1),
        valorCombinado:      parseFloat(document.getElementById('enc-edit-valor')?.value  || 0),
        valorCusto:          custo,
        valorVenda:          venda,
        lucroPrevisto:       (venda > 0 || custo > 0) ? venda - custo : null,
        fornecedorSugerido:  document.getElementById('enc-edit-fornecedor')?.value.trim()  || '',
        dataEncomenda:       document.getElementById('enc-edit-data-encomenda')?.value || '',
        dataPrevista:        document.getElementById('enc-edit-data-prevista')?.value  || '',
        observacoes:         document.getElementById('enc-edit-obs')?.value.trim()     || '',
        observacoesInternas: document.getElementById('enc-edit-obs-int')?.value.trim() || '',
        atualizadoEm:        serverTimestamp(),
        atualizadoEmISO:     agoraISO,
    };

    try {
        if (id) {
            const enc = st.encomendas.find(e => e.id === id);
            const historico = [...(enc?.historicoStatus || []), {
                status: enc?.status || 'aguardando_compra',
                data: agoraISO,
                obs: 'Dados editados',
                usuario: uid,
            }];
            await updateDoc(doc(db, COL_ENC, id), { ...dados, historicoStatus: historico });
            Object.assign(enc, dados, { historicoStatus: historico });
            toast('✅ Encomenda atualizada!');
        } else {
            const ref = doc(collection(db, COL_ENC));
            const novaEnc = {
                ...dados,
                id: ref.id,
                status: 'aguardando_compra',
                historicoStatus: [{ status: 'aguardando_compra', data: agoraISO, obs: 'Criada na Central de Alertas', usuario: uid }],
                criadoPor: uid,
                criadoEm: serverTimestamp(),
                criadoEmISO: agoraISO,
            };
            await setDoc(ref, novaEnc);
            st.encomendas.unshift(novaEnc);
            toast('✅ Encomenda criada!');
        }
        localStorage.setItem(ENC_CACHE, JSON.stringify(st.encomendas));
        fecharFormEncomenda();
    } catch (err) {
        console.error('❌ Erro ao salvar encomenda:', err);
        toast('❌ Erro ao salvar. Verifique a conexão.');
    }
    renderEncomendas();
    _atualizarBadgeEncomendas();
}

// ── Excluir ───────────────────────────────────────────────────────────────────
async function excluirEncomenda(id) {
    const enc = st.encomendas.find(e => e.id === id);
    if (!enc) return;
    if (!confirm(`Excluir a encomenda de "${enc.cliente}" (${enc.produto})?\n\nEsta ação não pode ser desfeita.`)) return;
    try {
        await deleteDoc(doc(db, COL_ENC, id));
        st.encomendas = st.encomendas.filter(e => e.id !== id);
        localStorage.setItem(ENC_CACHE, JSON.stringify(st.encomendas));
        toast('🗑️ Encomenda excluída.');
    } catch {
        toast('❌ Erro ao excluir.');
    }
    renderEncomendas();
    _atualizarBadgeEncomendas();
}

// ── Contatar fornecedor ───────────────────────────────────────────────────────
function contatarFornecedor(id) {
    const enc = st.encomendas.find(e => e.id === id);
    if (!enc?.fornecedorSugerido) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(`Olá! Tenho interesse no produto: ${enc.produto}${enc.modelo ? ' ' + enc.modelo : ''}. Pode me passar o preço?`)}`, '_blank');
}

// ── Modal de alerta personalizado ─────────────────────────────────────────────
function abrirModalAlerta(id) {
    _encAlertaId = id;
    const enc = st.encomendas.find(e => e.id === id);
    if (!enc) return;
    const overlay = document.getElementById('enc-modal-alerta-overlay');
    if (!overlay) return;
    document.getElementById('enc-alerta-enc-id').value = id;
    document.getElementById('enc-alerta-desc').value   = `Encomenda: ${enc.produto}${enc.modelo ? ' ' + enc.modelo : ''} — Cliente: ${enc.cliente}`;
    const hoje = new Date(); const hISO = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
    document.getElementById('enc-alerta-data').value = hISO;
    document.getElementById('enc-alerta-hora').value = '08:00';
    document.getElementById('enc-alerta-tipo').value = 'avisar_cliente';
    document.getElementById('enc-alerta-prioridade').value = 'alta';
    document.getElementById('enc-alerta-titulo').value = '';
    const tipoEl = document.getElementById('enc-alerta-tipo');
    if (tipoEl) tipoEl.dispatchEvent(new Event('change'));
    overlay.style.display = 'flex';
}

function fecharModalAlerta() {
    const overlay = document.getElementById('enc-modal-alerta-overlay');
    if (overlay) overlay.style.display = 'none';
    _encAlertaId = null;
}

async function salvarAlertaEncomenda() {
    const id   = document.getElementById('enc-alerta-enc-id')?.value;
    const data = document.getElementById('enc-alerta-data')?.value;
    const hora = document.getElementById('enc-alerta-hora')?.value || '08:00';
    const tipo = document.getElementById('enc-alerta-tipo')?.value;
    const prio = document.getElementById('enc-alerta-prioridade')?.value || 'alta';
    const desc = document.getElementById('enc-alerta-desc')?.value.trim() || '';
    const titCustom = document.getElementById('enc-alerta-titulo')?.value.trim();
    if (!data) { toast('⚠️ Informe a data do alerta'); return; }

    const enc = st.encomendas.find(e => e.id === id);
    if (!enc) return;

    const titulo = tipo === 'personalizado' && titCustom
        ? titCustom
        : `${ENC_TIPO_ALERTA_LABEL[tipo] || tipo} — ${enc.cliente}`;

    const agoraISO = new Date().toISOString();
    try {
        const ref = doc(collection(db, 'alertas_usuario'));
        const novoAlerta = {
            id: ref.id,
            titulo,
            descricao:   desc || `${enc.produto}${enc.modelo ? ' ' + enc.modelo : ''}. Cliente: ${enc.cliente}.`,
            tipo:        'encomenda',
            prioridade:  prio,
            categoria:   'Encomenda',
            data,
            hora,
            repeticao:   'nenhuma',
            status:      'pendente',
            link:        '/CRM/pages/central-alertas/index.html?nav=encomendas',
            encomendaId:  id,
            encomendaTipo: tipo,
            criadoEmISO: agoraISO,
            atualizadoEmISO: agoraISO,
        };
        await setDoc(ref, { ...novoAlerta, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() });
        st.lista.push(novoAlerta);
        localStorage.setItem(CACHE_KEY, JSON.stringify(st.lista));
        render();
        atualizarBadges();
        toast('🔔 Alerta programado!');
        fecharModalAlerta();
    } catch {
        toast('❌ Erro ao criar alerta.');
    }
}

async function receberEncomenda(id) {
    const enc = st.encomendas.find(e => e.id === id);
    if (!enc) return;
    if (!confirm(`Receber a encomenda de "${enc.cliente}"?\n\nO status será alterado para "Disponível para Retirada" e será gerado um alerta de aviso.`)) return;

    const agoraISO = new Date().toISOString();
    const historico = [...(enc.historicoStatus || []), { status: 'disponivel', data: agoraISO, obs: 'Produto recebido e disponível para retirada' }];

    try {
        await updateDoc(doc(db, COL_ENC, id), {
            status: 'disponivel',
            historicoStatus: historico,
            atualizadoEm: serverTimestamp(),
            atualizadoEmISO: agoraISO,
        });
        enc.status = 'disponivel';
        enc.historicoStatus = historico;
        enc.atualizadoEmISO = agoraISO;
        localStorage.setItem(ENC_CACHE, JSON.stringify(st.encomendas));

        // Adicionar ao estoque
        await _adicionarEncEstoque(enc);
        // Criar alerta de retirada
        await _alertaClienteAguardando(enc);

        toast('📦 Produto recebido! Cliente notificado e estoque atualizado.');
    } catch {
        toast('❌ Erro ao registrar recebimento.');
    }
    renderEncomendas();
    _atualizarBadgeEncomendas();
}

async function _adicionarEncEstoque(enc) {
    try {
        const id = `enc_${enc.id}`;
        await setDoc(doc(db, 'estoque_produtos', id), {
            id,
            nome:             `${enc.produto}${enc.modelo ? ' ' + enc.modelo : ''}`,
            categoria:        'Encomenda',
            codigoBarras:     `ENC-${enc.id.slice(-6).toUpperCase()}`,
            quantidade:       enc.quantidade || 1,
            quantidadeMinima: 1,
            venda:            enc.valorCombinado || 0,
            custo:            0,
            localizacao:      '',
            tags:             ['encomenda', enc.cliente],
            favorito:         false,
            historico:        [{ tipo: 'entrada', qtd: enc.quantidade || 1, data: new Date().toISOString(), obs: `Encomenda recebida — cliente: ${enc.cliente}` }],
            criadoEm:         serverTimestamp(),
            atualizadoEm:     serverTimestamp(),
            encomendaId:      enc.id,
        });
    } catch (err) {
        console.warn('⚠️ Estoque não atualizado automaticamente:', err);
    }
}

async function _alertaClienteAguardando(enc) {
    try {
        const agoraISO = new Date().toISOString();
        const hoje = _encHoje();
        const ref = doc(collection(db, 'alertas_usuario'));
        const novoAlerta = {
            id: ref.id,
            titulo:      `📬 Cliente aguardando retirada — ${enc.cliente}`,
            descricao:   `${enc.produto}${enc.modelo ? ' ' + enc.modelo : ''} disponível para retirada.${enc.telefone ? ' Tel: ' + enc.telefone : ''}${enc.whatsapp ? ' / ' + enc.whatsapp : ''}`,
            tipo:        'encomenda',
            prioridade:  'alta',
            categoria:   'Encomenda',
            data:         hoje,
            hora:        '08:00',
            repeticao:   'nenhuma',
            status:      'pendente',
            link:        '/CRM/pages/central-alertas/index.html?nav=encomendas',
            encomendaId:  enc.id,
            encomendaTipo:'disponivel',
            criadoEmISO: agoraISO,
            atualizadoEmISO: agoraISO,
        };
        await setDoc(ref, { ...novoAlerta, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() });
        st.lista.push(novoAlerta);
        localStorage.setItem(CACHE_KEY, JSON.stringify(st.lista));
        render();
        atualizarBadges();
    } catch (err) {
        console.warn('⚠️ Alerta de retirada não criado:', err);
    }
}

// ── Som Intermitente ──────────────────────────────────────────────────────────
function _iniciarSomIntermitente(ids, intervaloSeg) {
    _pararSomIntermitente();
    _somIntermitenteIds = [...ids];
    _somIntermitenteId = setInterval(() => {
        _somIntermitenteIds = _somIntermitenteIds.filter(id => {
            const a = st.lista.find(x => x.id === id);
            return a && a.status !== 'concluido' && jaDisp(a);
        });
        if (!_somIntermitenteIds.length) { _pararSomIntermitente(); return; }
        _tocarSom(st.lista.find(a => a.id === _somIntermitenteIds[0])?.titulo || '');
        _atualizarBarraAtiva();
    }, Math.max(5, intervaloSeg) * 1000);
    _atualizarBarraAtiva();
}

function _pararSomIntermitente() {
    if (_somIntermitenteId) { clearInterval(_somIntermitenteId); _somIntermitenteId = null; }
    _somIntermitenteIds = [];
    _atualizarBarraAtiva();
}

function _dispensarSom() {
    _pararSomIntermitente();
}

function _atualizarBarraAtiva() {
    const bar = document.getElementById('al-alerta-ativo-bar');
    const msg = document.getElementById('al-alerta-ativo-msg');
    const btnVer = document.getElementById('al-btn-ver-alertas');

    const isIntermitente = _somIntermitenteId && _somIntermitenteIds.length > 0;
    const devemAgora = st.lista.filter(a =>
        a.status === 'pendente' && dataEfetiva(a) === hojeISO() && (a.hora || '00:00') <= agoraHHMM()
    );
    const ativo = isIntermitente || devemAgora.length > 0;

    if (bar) bar.style.display = ativo ? 'flex' : 'none';

    if (ativo && msg) {
        if (isIntermitente) {
            const titulos = _somIntermitenteIds
                .map(id => st.lista.find(a => a.id === id)?.titulo || '')
                .filter(Boolean);
            const extra = titulos.length > 2 ? ` +${titulos.length - 2}` : '';
            msg.textContent = `${_somIntermitenteIds.length} alerta(s) ativo(s): ${titulos.slice(0, 2).join(', ')}${extra}`;
        } else {
            const prim = devemAgora[0];
            msg.textContent = devemAgora.length === 1
                ? `🔔 ${prim.titulo}`
                : `🔔 ${devemAgora.length} alertas pendentes`;
            if (btnVer) {
                const dest = prim.link || (_ACAO_RAPIDA_MAP[prim.tipo]?.url ?? '');
                const lbl  = (_ACAO_RAPIDA_MAP[prim.tipo]?.label) || '👁 Ver alertas';
                btnVer.textContent = dest ? lbl : '👁 Ver alertas';
                btnVer.onclick = dest
                    ? () => { window.location.href = dest; }
                    : () => { navegar('hoje'); _dispensarSom(); };
            }
        }
    }

    if (!ativo && btnVer) {
        btnVer.textContent = '👁 Ver alertas';
        btnVer.onclick = () => { navegar('hoje'); _dispensarSom(); };
    }

    document.querySelectorAll('.al-sb-badge.show').forEach(b =>
        b.classList.toggle('pulsing', ativo)
    );
}

function _onChangeModoRep() {
    const v = document.querySelector('input[name="cfg-som-rep"]:checked')?.value;
    const el = document.getElementById('cfg-intervalo-wrap');
    if (el) el.style.display = v === 'intermitente' ? '' : 'none';
}

// ── Exposição global ──────────────────────────────────────────────────────────
window.Alertas = {
    navegar, abrirForm, editar, fecharForm, salvar, excluir, concluir,
    copiarComando, executarComando,
    abrirAdiar, fecharAdiar, adiar, adiarCustom,
    selDia, toggleCustomDias, toggleQuantidade, salvarConfig,
    atualizarVolumeLabel, testarSom,
    setCalView, exportarCSV,
    abrirModoFoco, fecharModoFoco, focoConcluir, focoAdiar, focoProximo,
    _painelSetFiltro, _painelCustomDate,
    renderDiagnostico, _limparLogDiag, _diagFiltro,
    // Seleção em lote
    _atualizarSelecao, selecionarTodos, excluirSelecionados, concluirSelecionados,
    // Encomendas
    filtrarEncomendas, toggleMinhasEncomendas,
    atualizarStatusEncomenda, receberEncomenda,
    abrirFormEncomenda, fecharFormEncomenda, salvarFormEncomenda, calcLucroEdit,
    excluirEncomenda, contatarFornecedor,
    abrirModalAlerta, fecharModalAlerta, salvarAlertaEncomenda,
    // Som intermitente
    _dispensarSom, _onChangeModoRep,
};
