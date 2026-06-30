// ============================================
//  DIÁRIO — Central de organização pessoal
//  Coleções Firestore ISOLADAS (sem cruzamento com módulos operacionais):
//    • diario_registros  → os registros
//    • diario_eventos    → histórico p/ a Linha do Tempo
//
//  Layout focado em consulta/registro (hierarquia):
//    Título → Busca inteligente → Novo Registro → Favoritos →
//    Registros → [Resumo Geral / Estatísticas / Linha do Tempo] (recolhíveis)
// ============================================
import {
    db, collection, getDocs, doc, setDoc, addDoc, deleteDoc, serverTimestamp
} from "../../scripts/firebase.js";
import { initGDrive, backupConfigurado, fazerBackup, excluirArquivoDrive } from "./diario-gdrive.js";
import { excluirEmCascata, detectarAusentes, getApelido, setApelido } from "../../shared/cc-sync.js";

const COL = 'diario_registros';
const COL_EVT = 'diario_eventos';
const PANELS_KEY = 'cc_diario_panels';
const AUTOSAVE_MS = 2500;

// ── Categorias e subcategorias (conforme estrutura aprovada) ──────────
const CATEGORIAS = [
    { id: 'prioridades', icon: '⭐', nome: 'Prioridades', subs: ['Alta', 'Média', 'Baixa'] },
    { id: 'futuro',      icon: '📅', nome: 'Futuro',      subs: ['Planejamentos', 'Curto prazo', 'Médio prazo', 'Longo prazo'] },
    { id: 'decisoes',    icon: '⚖️', nome: 'Decisões',    subs: ['Pendentes', 'Tomadas', 'Histórico'] },
    { id: 'insights',    icon: '💡', nome: 'Insights',    subs: ['Ideias', 'Reflexões', 'Anotações rápidas'] },
    { id: 'metas',       icon: '🎯', nome: 'Metas',       subs: ['Pessoais', 'Financeiras', 'Profissionais'] },
    { id: 'saude',       icon: '🦷', nome: 'Saúde',       subs: ['Tratamentos', 'Consultas', 'Acompanhamentos'] },
    { id: 'moradia',     icon: '🏠', nome: 'Moradia',     subs: ['Projetos', 'Planejamento', 'Observações'] },
    { id: 'familia',     icon: '👨‍👩‍👧', nome: 'Família',  subs: ['Assuntos familiares', 'Registros importantes'] },
    { id: 'documentos',  icon: '📄', nome: 'Documentos',  subs: ['Anotações', 'Arquivos relacionados'] },
];
const CAT_MAP = Object.fromEntries(CATEGORIAS.map(c => [c.id, c]));

const STATUS_LABEL = {
    pendente: '⏳ Pendente',
    em_andamento: '🔄 Em andamento',
    aguardando: '⏸️ Aguardando',
    concluido: '✅ Concluído',
    arquivado: '🗄️ Arquivado'
};
const PRIO_LABEL = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' };

// Tipos de evento da Linha do Tempo
const EVT_INFO = {
    criado:     { icon: '➕', label: 'Registro criado' },
    atualizado: { icon: '✏️', label: 'Registro atualizado' },
    status:     { icon: '🔄', label: 'Status alterado' },
    favorito:   { icon: '⭐', label: 'Favorito' },
    arquivado:  { icon: '🗄️', label: 'Arquivado' },
    restaurado: { icon: '♻️', label: 'Restaurado' },
    excluido:   { icon: '🗑️', label: 'Excluído' }
};

// ── Estado ────────────────────────────────────────────────────────────
let registros = [];
let eventos = [];
let editandoId = null;
let quickFilter = null;     // filtro rápido das estatísticas
let timelineAberta = false;
let eventosCarregados = false;
let autosaveTimer = null;
let _carregarGen = 0;       // generation counter p/ evitar race condition

// ── Elementos ─────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const formEl     = $('dia-form');
const listaEl    = $('dia-lista');
const emptyEl    = $('dia-empty');
const loadingEl  = $('dia-loading');
const toastEl    = $('dia-toast');
const searchEl   = $('dia-search');
const searchResultsEl = $('dia-search-results');
const favoritosEl = $('dia-favoritos');
const alertaRevEl = $('dia-alerta-revisoes');

const inpTitulo   = $('dia-inp-titulo');
const inpCat      = $('dia-inp-cat');
const inpSubcat   = $('dia-inp-subcat');
const inpPrio     = $('dia-inp-prio');
const inpStatus   = $('dia-inp-status');
const inpConteudo = $('dia-inp-conteudo');
const inpTags     = $('dia-inp-tags');
const inpFavorito = $('dia-inp-favorito');
const inpRevisao  = $('dia-inp-revisao');
const formTitulo  = $('dia-form-titulo');
const detalhesEl  = $('dia-detalhes');
const autosaveEl  = $('dia-autosave-status');
const backupStatusEl = $('dia-backup-status');

const filtroCat    = $('dia-filtro-cat');
const filtroStatus = $('dia-filtro-status');
const filtroPrio   = $('dia-filtro-prio');
const ordenarEl    = $('dia-ordenar');

// Timeline
const tlCat     = $('dia-tl-cat');
const tlPeriodo = $('dia-tl-periodo');
const tlTipo    = $('dia-tl-tipo');
const tlFav     = $('dia-tl-fav');
const tlEl      = $('dia-timeline');

// ── Toast ─────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), 2200);
}

// ── Modal de confirmação ──────────────────────────────────────────────
function confirmar(titulo, corpo, txtBtn = 'Confirmar') {
    return new Promise((resolve) => {
        const overlay = $('dia-modal-overlay');
        $('dia-modal-titulo').textContent = titulo;
        $('dia-modal-body').textContent = corpo;
        const btnOk = $('dia-modal-confirmar');
        const btnNo = $('dia-modal-cancelar');
        btnOk.textContent = txtBtn;
        overlay.style.display = 'flex';
        const fechar = (res) => {
            overlay.style.display = 'none';
            btnOk.onclick = null; btnNo.onclick = null;
            resolve(res);
        };
        btnOk.onclick = () => fechar(true);
        btnNo.onclick = () => fechar(false);
    });
}

// ── Util ──────────────────────────────────────────────────────────────
function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}
function tsToMillis(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts.seconds) return ts.seconds * 1000;
    const t = new Date(ts).getTime();
    return isNaN(t) ? 0 : t;
}
function fmtData(ts) {
    const ms = tsToMillis(ts);
    if (!ms) return '—';
    return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function ehHoje(ts) {
    const ms = tsToMillis(ts);
    if (!ms) return false;
    const d = new Date(ms); const h = new Date();
    return d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth() && d.getDate() === h.getDate();
}

// ── Revisão programada ────────────────────────────────────────────────
function meiaNoiteHoje() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
// Dias até a revisão: <0 vencida, 0 hoje, >0 futuro. null se sem data.
function diasAteRevisao(r) {
    if (!r || !r.dataRevisao) return null;
    const rev = new Date(r.dataRevisao + 'T00:00:00');
    if (isNaN(rev.getTime())) return null;
    return Math.round((rev - meiaNoiteHoje()) / 86400000);
}
function revisaoAtiva(r) {
    return r.status !== 'concluido' && r.status !== 'arquivado';
}
function contarRevisoes() {
    let vencidas = 0, hoje = 0, prox7 = 0;
    registros.forEach(r => {
        if (!revisaoAtiva(r)) return;
        const d = diasAteRevisao(r);
        if (d === null) return;
        if (d < 0) vencidas++;
        else if (d === 0) hoje++;
        else if (d <= 7) prox7++;
    });
    return { vencidas, hoje, prox7, pendentes: vencidas + hoje + prox7 };
}

// ── Histórico (Linha do Tempo): registrar evento ──────────────────────
async function logEvento(tipo, r, descricao = '') {
    try {
        await addDoc(collection(db, COL_EVT), {
            registroId: r.id || '',
            registroTitulo: r.titulo || '(sem título)',
            categoria: r.categoria || '',
            tipo,
            descricao,
            em: serverTimestamp()
        });
        eventosCarregados = false; // força recarregar da próxima vez
    } catch (e) {
        console.warn('Diário: falha ao registrar evento', e);
    }
}

// ── Popular selects de categoria ──────────────────────────────────────
function popularCategorias() {
    inpCat.innerHTML = CATEGORIAS.map(c => `<option value="${c.id}">${c.icon} ${c.nome}</option>`).join('');
    const optsFiltro = CATEGORIAS.map(c => `<option value="${c.id}">${c.icon} ${c.nome}</option>`).join('');
    filtroCat.insertAdjacentHTML('beforeend', optsFiltro);
    tlCat.insertAdjacentHTML('beforeend', optsFiltro);
    atualizarSubcategorias();
}
function atualizarSubcategorias(selecionada) {
    const cat = CAT_MAP[inpCat.value];
    const subs = cat ? cat.subs : [];
    inpSubcat.innerHTML = '<option value="">—</option>' +
        subs.map(s => `<option value="${escapeHtml(s)}"${s === selecionada ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('');
}
inpCat.addEventListener('change', () => atualizarSubcategorias());

// ── Carregar registros (com generation counter p/ evitar race condition) ─
async function carregar() {
    const gen = ++_carregarGen;
    try {
        const snap = await getDocs(collection(db, COL));
        if (gen !== _carregarGen) return; // resultado obsoleto, ignorar
        registros = [];
        snap.forEach(d => registros.push({ id: d.id, ...d.data() }));
    } catch (e) {
        if (gen !== _carregarGen) return;
        console.warn('Diário: erro ao carregar', e);
        registros = [];
    }
    loadingEl.style.display = 'none';
    render();
}

// ── Resumo executivo + estatísticas + alerta discreto ─────────────────
function atualizarResumo() {
    const ativos = registros.filter(r => r.status !== 'arquivado');
    const alta = ativos.filter(r => r.prioridade === 'alta').length;
    const pendente = ativos.filter(r => r.status === 'pendente').length;
    const favorito = ativos.filter(r => r.favorito).length;
    const hoje = registros.filter(r => ehHoje(r.criadoEm)).length;
    const rev = contarRevisoes();

    // Estatísticas (filtros rápidos)
    $('dia-num-alta').textContent = alta;
    $('dia-num-pendente').textContent = pendente;
    $('dia-num-favorito').textContent = favorito;
    $('dia-num-hoje').textContent = hoje;
    $('dia-num-revisoes').textContent = rev.pendentes;
    $('dia-revisoes-sub').textContent = `Venc ${rev.vencidas} · Hoje ${rev.hoje} · 7d ${rev.prox7}`;

    // Resumo Geral (Alta/Revisões já exibidos acima, nos cards de filtro rápido)
    $('dia-exec-ativos').textContent = ativos.length;
    $('dia-exec-metas').textContent = ativos.filter(r => r.categoria === 'metas' && r.status === 'em_andamento').length;
    $('dia-exec-decisoes').textContent = ativos.filter(r => r.categoria === 'decisoes' && r.status === 'pendente').length;

    // Alerta visual discreto (sem pop-up) quando há revisão vencida
    const temVencida = rev.vencidas > 0;
    $('dia-card-revisoes').classList.toggle('tem-vencida', temVencida);
    if (temVencida) {
        alertaRevEl.style.display = 'flex';
        alertaRevEl.textContent = `🔔 ${rev.vencidas} revisão(ões) vencida(s) — clique para ver`;
    } else {
        alertaRevEl.style.display = 'none';
    }
}

// ── Filtro + busca + ordenação ────────────────────────────────────────
function aplicarFiltros() {
    let lista = [...registros];

    // Filtro rápido (estatísticas)
    if (quickFilter === 'alta')     lista = lista.filter(r => r.prioridade === 'alta' && r.status !== 'arquivado');
    if (quickFilter === 'pendente') lista = lista.filter(r => r.status === 'pendente');
    if (quickFilter === 'favorito') lista = lista.filter(r => r.favorito && r.status !== 'arquivado');
    if (quickFilter === 'hoje')     lista = lista.filter(r => ehHoje(r.criadoEm));
    if (quickFilter === 'revisoes') {
        lista = lista.filter(r => { const d = diasAteRevisao(r); return revisaoAtiva(r) && d !== null && d <= 7; });
    }

    // Filtros de seletor
    if (filtroCat.value)    lista = lista.filter(r => r.categoria === filtroCat.value);
    if (filtroStatus.value) lista = lista.filter(r => (r.status || 'pendente') === filtroStatus.value);
    if (filtroPrio.value)   lista = lista.filter(r => (r.prioridade || 'media') === filtroPrio.value);

    // Por padrão, esconde arquivados (a menos que filtre explicitamente)
    if (!filtroStatus.value && quickFilter !== 'hoje') {
        lista = lista.filter(r => r.status !== 'arquivado');
    }

    // Busca global: título, conteúdo, tags
    const termo = (searchEl.value || '').trim().toLowerCase();
    if (termo) lista = lista.filter(r => buscaCasa(r, termo));

    // Ordenação
    const ord = ordenarEl.value;
    lista.sort((a, b) => {
        if (ord === 'favorito' && !!a.favorito !== !!b.favorito) return a.favorito ? -1 : 1;
        if (ord === 'titulo') return (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR');
        if (ord === 'criado') return tsToMillis(b.criadoEm) - tsToMillis(a.criadoEm);
        if (ord === 'revisao') {
            const da = diasAteRevisao(a), db_ = diasAteRevisao(b);
            if (da === null && db_ === null) return tsToMillis(b.atualizadoEm) - tsToMillis(a.atualizadoEm);
            if (da === null) return 1;
            if (db_ === null) return -1;
            return da - db_;
        }
        return tsToMillis(b.atualizadoEm) - tsToMillis(a.atualizadoEm);
    });
    return lista;
}

function buscaCasa(r, termo) {
    const tags = Array.isArray(r.tags) ? r.tags.join(' ') : '';
    return (`${r.titulo || ''} ${r.conteudo || ''} ${tags}`).toLowerCase().includes(termo);
}

// ── HTML de um registro (card) ────────────────────────────────────────
function cardHtml(r) {
    const cat = CAT_MAP[r.categoria] || { icon: '📌', nome: r.categoria || '—' };
    const prio = r.prioridade || 'media';
    const status = r.status || 'pendente';
    const tags = Array.isArray(r.tags) ? r.tags : [];
    const sub = r.subcategoria ? `<span class="dia-badge">${escapeHtml(r.subcategoria)}</span>` : '';

    const dRev = diasAteRevisao(r);
    let revBadge = '', revClass = '';
    if (dRev !== null && revisaoAtiva(r)) {
        if (dRev < 0)        { revBadge = `<span class="dia-badge dia-badge-revisao">🔔 Revisão vencida (${Math.abs(dRev)}d)</span>`; revClass = 'revisao-vencida'; }
        else if (dRev === 0) { revBadge = `<span class="dia-badge dia-badge-revisao">🔔 Revisar hoje</span>`; revClass = 'revisao-vencida'; }
        else if (dRev <= 7)  { revBadge = `<span class="dia-badge dia-badge-revisao">🔔 Revisar em ${dRev}d</span>`; }
        else                 { revBadge = `<span class="dia-badge dia-badge-revisao">🔔 ${new Date(r.dataRevisao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>`; }
    }

    return `
    <div class="dia-card prio-${prio} ${status === 'arquivado' ? 'arquivado' : ''} ${revClass}" data-id="${r.id}">
        <div class="dia-card-top">
            <span class="dia-card-cat-icon">${cat.icon}</span>
            <div class="dia-card-main">
                <div class="dia-card-titulo">${escapeHtml(r.titulo || '(sem título)')}</div>
                <div class="dia-card-meta">
                    <span class="dia-badge dia-badge-cat">${escapeHtml(cat.nome)}</span>
                    ${sub}
                    <span class="dia-badge dia-badge-prio-${prio}">${PRIO_LABEL[prio] || prio}</span>
                    <span class="dia-badge dia-badge-status-${status}">${STATUS_LABEL[status] || status}</span>
                    ${revBadge}
                    ${tags.map(t => `<span class="dia-tag">#${escapeHtml(t)}</span>`).join('')}
                </div>
                ${r.conteudo ? `<div class="dia-card-conteudo">${escapeHtml(r.conteudo)}</div>` : ''}
                <div class="dia-card-data">Criado: ${fmtData(r.criadoEm)} · Atualizado: ${fmtData(r.atualizadoEm)}</div>
            </div>
            <div class="dia-card-acoes">
                <button class="dia-acao-btn dia-acao-fav ${r.favorito ? 'ativo' : ''}" data-acao="fav" data-id="${r.id}" title="Favorito">${r.favorito ? '⭐' : '☆'}</button>
                <button class="dia-acao-btn" data-acao="editar" data-id="${r.id}" title="Editar">✏️</button>
                <button class="dia-acao-btn" data-acao="arquivar" data-id="${r.id}" title="${status === 'arquivado' ? 'Restaurar' : 'Arquivar'}">${status === 'arquivado' ? '♻️' : '🗄️'}</button>
                <button class="dia-acao-btn" data-acao="excluir" data-id="${r.id}" title="Excluir">🗑️</button>
            </div>
        </div>
    </div>`;
}

// ── Render registros + favoritos + resumo ─────────────────────────────
function render() {
    atualizarResumo();
    renderFavoritos();

    const lista = aplicarFiltros();
    if (!lista.length) {
        listaEl.innerHTML = '';
        emptyEl.style.display = 'block';
        return;
    }
    emptyEl.style.display = 'none';
    listaEl.innerHTML = lista.map(cardHtml).join('');
}

// ── Bloco de Favoritos (acesso rápido) ────────────────────────────────
function renderFavoritos() {
    const favs = registros.filter(r => r.favorito && r.status !== 'arquivado')
        .sort((a, b) => tsToMillis(b.atualizadoEm) - tsToMillis(a.atualizadoEm));
    if (!favs.length) {
        favoritosEl.innerHTML = `<div class="dia-fav-vazio">Nenhum favorito ainda. Toque na ⭐ de um registro para fixá-lo aqui.</div>`;
        return;
    }
    favoritosEl.innerHTML = favs.map(r => {
        const cat = CAT_MAP[r.categoria] || { icon: '📌' };
        return `<button class="dia-fav-chip" data-fav-id="${r.id}" title="${escapeHtml(r.titulo || '')}">
            <span class="dia-fav-chip-ico">${cat.icon}</span>
            <span class="dia-fav-chip-txt">${escapeHtml(r.titulo || '(sem título)')}</span>
        </button>`;
    }).join('');
}
favoritosEl.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-fav-id]');
    if (chip) abrirEdicao(chip.dataset.favId);
});

// ── Busca inteligente (dropdown de resultados em tempo real) ──────────
function renderSearchResults() {
    const termo = (searchEl.value || '').trim().toLowerCase();
    if (!termo) { searchResultsEl.style.display = 'none'; searchResultsEl.innerHTML = ''; return; }

    const matches = registros.filter(r => buscaCasa(r, termo)).slice(0, 8);
    if (!matches.length) {
        searchResultsEl.innerHTML = `<div class="dia-sr-vazio">Nenhum resultado para “${escapeHtml(termo)}”.</div>`;
        searchResultsEl.style.display = 'block';
        return;
    }
    searchResultsEl.innerHTML = matches.map(r => {
        const cat = CAT_MAP[r.categoria] || { icon: '📌', nome: '' };
        const snippet = (r.conteudo || '').slice(0, 70);
        return `<button class="dia-sr-item" data-sr-id="${r.id}">
            <span class="dia-sr-ico">${cat.icon}</span>
            <span class="dia-sr-main">
                <span class="dia-sr-titulo">${escapeHtml(r.titulo || '(sem título)')}</span>
                <span class="dia-sr-sub">${escapeHtml(cat.nome)}${snippet ? ' · ' + escapeHtml(snippet) : ''}</span>
            </span>
            ${r.favorito ? '<span class="dia-sr-star">⭐</span>' : ''}
        </button>`;
    }).join('');
    searchResultsEl.style.display = 'block';
}
searchResultsEl.addEventListener('click', (e) => {
    const item = e.target.closest('[data-sr-id]');
    if (!item) return;
    searchResultsEl.style.display = 'none';
    abrirEdicao(item.dataset.srId);
});
// Fecha o dropdown ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dia-busca-wrap')) searchResultsEl.style.display = 'none';
});

// ── Delegação de cliques na lista ─────────────────────────────────────
listaEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-acao]');
    if (!btn) return;
    const id = btn.dataset.id;
    const acao = btn.dataset.acao;
    if (acao === 'fav') toggleFavorito(id);
    else if (acao === 'editar') abrirEdicao(id);
    else if (acao === 'arquivar') alternarArquivo(id);
    else if (acao === 'excluir') excluir(id);
});

// ── Detalhes do Registro (recolhível dentro do editor) ────────────────
function colapsarDetalhes() {
    detalhesEl.classList.remove('aberto');
    detalhesEl.querySelector('.dia-detalhes-arrow').textContent = '▶';
}
$('dia-detalhes-head').addEventListener('click', () => {
    const aberto = detalhesEl.classList.toggle('aberto');
    detalhesEl.querySelector('.dia-detalhes-arrow').textContent = aberto ? '▼' : '▶';
});

// ── Form: abrir/fechar ────────────────────────────────────────────────
function abrirForm(novo = true) {
    formEl.style.display = 'block';
    colapsarDetalhes();          // detalhes recolhidos por padrão (foco na escrita)
    setAutosaveStatus('');
    if (novo) backupStatusEl.textContent = '';
    formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (novo) inpTitulo.focus();
}
function fecharForm() {
    clearTimeout(autosaveTimer);
    formEl.style.display = 'none';
    editandoId = null;
    formTitulo.textContent = 'Novo Registro';
    inpTitulo.value = '';
    inpConteudo.value = '';
    inpTags.value = '';
    inpRevisao.value = '';
    inpFavorito.checked = false;
    inpCat.selectedIndex = 0;
    inpPrio.value = 'media';
    inpStatus.value = 'pendente';
    backupStatusEl.textContent = '';
    atualizarSubcategorias();
    colapsarDetalhes();
    setAutosaveStatus('');
}

$('dia-btn-novo').addEventListener('click', () => { fecharForm(); abrirForm(true); });
$('dia-btn-cancelar').addEventListener('click', fecharForm);

// ── Coleta dos campos do editor ───────────────────────────────────────
function coletarCampos() {
    const tags = inpTags.value.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    return {
        titulo: inpTitulo.value.trim(),
        conteudo: inpConteudo.value.trim(),
        categoria: inpCat.value,
        subcategoria: inpSubcat.value || '',
        prioridade: inpPrio.value,
        status: inpStatus.value,
        tags,
        favorito: inpFavorito.checked,
        dataRevisao: inpRevisao.value || ''
    };
}

// ── Salvar manual (criar/editar) ──────────────────────────────────────
$('dia-btn-salvar').addEventListener('click', salvar);
async function salvar() {
    clearTimeout(autosaveTimer);
    const campos = coletarCampos();
    if (!campos.titulo) { toast('⚠ Informe um título'); inpTitulo.focus(); return; }
    const dados = { ...campos, atualizadoEm: serverTimestamp() };

    let idSalvo = editandoId;
    try {
        if (editandoId) {
            const antigo = registros.find(r => r.id === editandoId) || {};
            await setDoc(doc(db, COL, editandoId), { ...dados, criadoEm: antigo.criadoEm || serverTimestamp() }, { merge: true });
            const ref = { id: editandoId, ...dados };
            if ((antigo.status || 'pendente') !== dados.status) {
                await logEvento('status', ref, `${STATUS_LABEL[antigo.status] || antigo.status || '—'} → ${STATUS_LABEL[dados.status]}`);
            } else {
                await logEvento('atualizado', ref);
            }
            toast('✓ Registro atualizado');
        } else {
            dados.criadoEm = serverTimestamp();
            const novoRef = doc(collection(db, COL));
            await setDoc(novoRef, dados);
            await logEvento('criado', { id: novoRef.id, ...dados });
            idSalvo = novoRef.id;
            toast('✓ Registro criado');
        }
        fecharForm();
        // Limpa busca e filtros para garantir que o novo registro apareça
        searchEl.value = '';
        quickFilter = null;
        document.querySelectorAll('.dia-resumo-item').forEach(i => i.classList.remove('ativo'));
        filtroCat.value = '';
        filtroStatus.value = '';
        filtroPrio.value = '';
        await carregar();
        recarregarTimelineSeAberta();
        // Backup automático no Drive — nunca bloqueia o salvamento local
        if (backupConfigurado()) {
            const reg = registros.find(r => r.id === idSalvo);
            if (reg) backupEAtualiza(reg);
        } else {
            toast('✓ Registro salvo');
        }
    } catch (e) {
        console.error(e);
        toast('⚠ Erro ao salvar');
    }
}

// ── Backup automático no Google Drive (assíncrono, não bloqueante) ────
async function backupEAtualiza(reg) {
    toast('✓ Registro salvo · ⏳ Backup Google Drive...');
    let res;
    try { res = await fazerBackup(reg); }
    catch (e) { res = { ok: false, erro: e.message || String(e) }; }

    if (res && res.ok) {
        try {
            await setDoc(doc(db, COL, reg.id), {
                backupDriveId: res.fileId,
                backupDriveLink: res.link || '',
                backupSyncEm: serverTimestamp()
            }, { merge: true });
            reg.backupDriveId = res.fileId;
            reg.backupDriveLink = res.link || '';
            reg.backupSyncEm = new Date();
        } catch (e) { console.warn('Diário: falha ao gravar refs do backup', e); }
        toast('✓ Registro salvo · ✓ Backup Google Drive concluído');
        render(); // atualiza a UI com os metadados do backup
    } else {
        console.warn('Diário: backup falhou', res && res.erro);
        toast('⚠ Registro salvo · ⚠ Falha no backup Google Drive');
    }
}

// ── Autosave (salvamento automático ao digitar) ───────────────────────
function setAutosaveStatus(state) {
    autosaveEl.className = 'dia-autosave' + (state ? ' ' + state : '');
    autosaveEl.textContent = state === 'salvando' ? '⏳ Salvando...'
        : state === 'salvo' ? '✓ Salvo automaticamente' : '';
}
function agendarAutosave() {
    if (formEl.style.display === 'none') return;
    setAutosaveStatus(''); // está digitando
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(executarAutosave, AUTOSAVE_MS);
}
let autosaveRunning = false;
async function executarAutosave() {
    if (formEl.style.display === 'none') return;
    if (autosaveRunning) { agendarAutosave(); return; } // evita escrita concorrente
    const campos = coletarCampos();
    if (!campos.titulo) { setAutosaveStatus(''); return; } // não salva sem título
    autosaveRunning = true;
    setAutosaveStatus('salvando');
    const persist = { ...campos, atualizadoEm: serverTimestamp() };
    try {
        if (editandoId) {
            const antigo = registros.find(r => r.id === editandoId) || {};
            await setDoc(doc(db, COL, editandoId), { ...persist, criadoEm: antigo.criadoEm || serverTimestamp() }, { merge: true });
            // Registra mudança de status no histórico (uma vez), sem poluir com cada tecla
            if ((antigo.status || 'pendente') !== campos.status) {
                await logEvento('status', { id: editandoId, ...campos }, `${STATUS_LABEL[antigo.status] || antigo.status || '—'} → ${STATUS_LABEL[campos.status]}`);
            }
            Object.assign(antigo, { id: editandoId, ...campos, atualizadoEm: new Date() });
            if (!registros.includes(antigo)) registros.push(antigo);
        } else {
            const novoRef = doc(collection(db, COL));
            await setDoc(novoRef, { ...persist, criadoEm: serverTimestamp() });
            await logEvento('criado', { id: novoRef.id, ...campos });
            editandoId = novoRef.id;
            formTitulo.textContent = 'Editar Registro';
            registros.push({ id: novoRef.id, ...campos, criadoEm: new Date(), atualizadoEm: new Date() });
        }
        render();                       // sincroniza lista/favoritos/resumo (sem rede)
        recarregarTimelineSeAberta();
        setAutosaveStatus('salvo');
    } catch (e) {
        console.warn('Diário: autosave falhou', e);
        setAutosaveStatus('');
    } finally {
        autosaveRunning = false;
    }
}
// Dispara o autosave ao editar qualquer campo
[inpTitulo, inpConteudo, inpTags].forEach(el => el.addEventListener('input', agendarAutosave));
[inpSubcat, inpPrio, inpStatus, inpRevisao, inpFavorito].forEach(el => el.addEventListener('change', agendarAutosave));
inpCat.addEventListener('change', agendarAutosave);

// ── Editar ────────────────────────────────────────────────────────────
function abrirEdicao(id) {
    const r = registros.find(x => x.id === id);
    if (!r) return;
    editandoId = id;
    formTitulo.textContent = 'Editar Registro';
    inpTitulo.value = r.titulo || '';
    inpConteudo.value = r.conteudo || '';
    inpCat.value = r.categoria || CATEGORIAS[0].id;
    atualizarSubcategorias(r.subcategoria);
    inpPrio.value = r.prioridade || 'media';
    inpStatus.value = r.status || 'pendente';
    inpTags.value = (Array.isArray(r.tags) ? r.tags : []).join(', ');
    inpRevisao.value = r.dataRevisao || '';
    inpFavorito.checked = !!r.favorito;
    backupStatusEl.textContent = r.backupSyncEm
        ? '✅ Backup em ' + fmtData(r.backupSyncEm)
        : '';
    abrirForm(false);
}

// ── Favorito ──────────────────────────────────────────────────────────
async function toggleFavorito(id) {
    const r = registros.find(x => x.id === id);
    if (!r) return;
    const novo = !r.favorito;
    r.favorito = novo; // otimista
    render();
    try {
        await setDoc(doc(db, COL, id), { favorito: novo, atualizadoEm: serverTimestamp() }, { merge: true });
        await logEvento('favorito', r, novo ? 'Marcado como favorito' : 'Removido dos favoritos');
        recarregarTimelineSeAberta();
    } catch { toast('⚠ Erro ao favoritar'); r.favorito = !novo; render(); }
}

// ── Arquivar / restaurar ──────────────────────────────────────────────
async function alternarArquivo(id) {
    const r = registros.find(x => x.id === id);
    if (!r) return;
    const arquivando = r.status !== 'arquivado';
    const novoStatus = arquivando ? 'arquivado' : 'pendente';
    try {
        await setDoc(doc(db, COL, id), { status: novoStatus, atualizadoEm: serverTimestamp() }, { merge: true });
        r.status = novoStatus;
        await logEvento(arquivando ? 'arquivado' : 'restaurado', r);
        toast(arquivando ? '🗄️ Arquivado' : '♻️ Restaurado');
        render();
        recarregarTimelineSeAberta();
    } catch { toast('⚠ Erro ao arquivar'); }
}

// ── Excluir ───────────────────────────────────────────────────────────
async function excluir(id) {
    const r = registros.find(x => x.id === id);
    const ok = await confirmar('Excluir registro', `Excluir "${r?.titulo || 'este registro'}"?\n\nO arquivo correspondente no Google Drive também será excluído. O item vai para a Lixeira e pode ser restaurado por 30 dias.`, 'Excluir');
    if (!ok) return;
    try {
        // Exclusão em cascata: Drive + Lixeira global + Log (CRM é a fonte MASTER)
        if (r) {
            try { await excluirEmCascata({ backup: { excluirArquivo: excluirArquivoDrive }, modulo: 'diario', registro: r }); }
            catch (e) { console.warn('Diário: cascata de exclusão falhou', e); }
        }
        await deleteDoc(doc(db, COL, id));
        if (r) await logEvento('excluido', r);
        registros = registros.filter(x => x.id !== id);
        toast('🗑️ Excluído');
        render();
        recarregarTimelineSeAberta();
    } catch { toast('⚠ Erro ao excluir'); }
}

// ====================================================================
//  LINHA DO TEMPO
// ====================================================================
function recarregarTimelineSeAberta() { if (timelineAberta) carregarTimeline(true); }

async function carregarTimeline(forcar = false) {
    if (eventosCarregados && !forcar) { renderTimeline(); return; }
    $('dia-tl-loading').style.display = 'flex';
    tlEl.innerHTML = '';
    $('dia-tl-empty').style.display = 'none';
    try {
        const snap = await getDocs(collection(db, COL_EVT));
        eventos = [];
        snap.forEach(d => eventos.push({ id: d.id, ...d.data() }));
        eventos.sort((a, b) => tsToMillis(b.em) - tsToMillis(a.em));
        eventosCarregados = true;
    } catch (e) {
        console.warn('Diário: erro ao carregar timeline', e);
        eventos = [];
    }
    $('dia-tl-loading').style.display = 'none';
    renderTimeline();
}

function renderTimeline() {
    const favIds = new Set(registros.filter(r => r.favorito).map(r => r.id));
    const periodo = tlPeriodo.value;
    const limiteMs = periodo === '7' ? Date.now() - 7 * 86400000
        : periodo === '30' ? Date.now() - 30 * 86400000
        : null;

    let lista = eventos.filter(ev => {
        if (tlCat.value && ev.categoria !== tlCat.value) return false;
        if (tlTipo.value && ev.tipo !== tlTipo.value) return false;
        if (tlFav.checked && !favIds.has(ev.registroId)) return false;
        const ms = tsToMillis(ev.em);
        if (periodo === 'hoje' && !ehHoje(ev.em)) return false;
        if (limiteMs && ms < limiteMs) return false;
        return true;
    });

    if (!lista.length) {
        tlEl.innerHTML = '';
        $('dia-tl-empty').style.display = 'block';
        return;
    }
    $('dia-tl-empty').style.display = 'none';

    let html = '';
    let diaAtual = '';
    lista.forEach(ev => {
        const ms = tsToMillis(ev.em);
        const data = ms ? new Date(ms) : null;
        const diaLabel = data ? data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Sem data';
        if (diaLabel !== diaAtual) {
            diaAtual = diaLabel;
            html += `<div class="dia-tl-dia-sep">${escapeHtml(diaLabel)}</div>`;
        }
        const info = EVT_INFO[ev.tipo] || { icon: '•', label: ev.tipo };
        const cat = CAT_MAP[ev.categoria];
        const hora = data ? data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
        const ehFav = favIds.has(ev.registroId);
        html += `
        <div class="dia-tl-item">
            <span class="dia-tl-dot"></span>
            <div class="dia-tl-card">
                <div class="dia-tl-linha1">
                    <span class="dia-tl-icon">${info.icon}</span>
                    <span class="dia-tl-tipo">${escapeHtml(info.label)}</span>
                    ${ehFav ? '<span class="dia-tl-fav-star">⭐</span>' : ''}
                    <span class="dia-tl-hora">${hora}</span>
                </div>
                <div class="dia-tl-reg">${cat ? cat.icon + ' ' : ''}${escapeHtml(ev.registroTitulo || '(sem título)')}</div>
                ${ev.descricao ? `<div class="dia-tl-desc">${escapeHtml(ev.descricao)}</div>` : ''}
            </div>
        </div>`;
    });
    tlEl.innerHTML = html;
}

[tlCat, tlPeriodo, tlTipo].forEach(el => el.addEventListener('change', renderTimeline));
tlFav.addEventListener('change', renderTimeline);

// ====================================================================
//  PAINÉIS RECOLHÍVEIS (Resumo Geral / Estatísticas / Linha do Tempo)
// ====================================================================
function lerEstadoPaineis() {
    try { return JSON.parse(localStorage.getItem(PANELS_KEY)) || {}; } catch { return {}; }
}
function salvarEstadoPaineis(estado) {
    try { localStorage.setItem(PANELS_KEY, JSON.stringify(estado)); } catch {}
}
function aplicarPainel(nome, aberto) {
    const sec = $('dia-panel-' + nome);
    if (!sec) return;
    sec.classList.toggle('aberto', aberto);
    const arrow = sec.querySelector('.dia-panel-arrow');
    if (arrow) arrow.textContent = aberto ? '▼' : '▶';
    if (nome === 'timeline') {
        timelineAberta = aberto;
        if (aberto) carregarTimeline();
    }
}
function togglePainel(nome) {
    const estado = lerEstadoPaineis();
    const novo = !$('dia-panel-' + nome).classList.contains('aberto');
    estado[nome] = novo;
    salvarEstadoPaineis(estado);
    aplicarPainel(nome, novo);
}
document.querySelectorAll('.dia-panel-head').forEach(head => {
    head.addEventListener('click', () => togglePainel(head.dataset.panel));
});
function initPaineis() {
    // Por padrão recolhidos (tela limpa); respeita preferência salva.
    const estado = lerEstadoPaineis();
    ['resumo', 'timeline', 'gdrive'].forEach(nome => aplicarPainel(nome, !!estado[nome]));
}

// ── Filtros rápidos das estatísticas ──────────────────────────────────
function focarLista() {
    const sec = listaEl.closest('.dia-bloco') || listaEl;
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
document.querySelectorAll('.dia-resumo-item[data-quick]').forEach(item => {
    item.addEventListener('click', () => {
        const q = item.dataset.quick;
        const jaAtivo = quickFilter === q;
        quickFilter = jaAtivo ? null : q;
        document.querySelectorAll('.dia-resumo-item').forEach(i => i.classList.remove('ativo'));
        if (!jaAtivo) item.classList.add('ativo');
        if (q === 'revisoes' && !jaAtivo) ordenarEl.value = 'revisao';
        render();
        if (!jaAtivo) focarLista();
    });
});

// ── Alerta discreto de revisões vencidas → filtra e foca a lista ──────
alertaRevEl.addEventListener('click', () => {
    quickFilter = 'revisoes';
    ordenarEl.value = 'revisao';
    document.querySelectorAll('.dia-resumo-item').forEach(i => i.classList.remove('ativo'));
    $('dia-card-revisoes').classList.add('ativo');
    render();
    focarLista();
});

// ── Filtros / busca / ordenação: eventos ──────────────────────────────
[filtroCat, filtroStatus, filtroPrio, ordenarEl].forEach(el => el.addEventListener('change', render));
searchEl.addEventListener('input', () => { render(); renderSearchResults(); });
searchEl.addEventListener('focus', renderSearchResults);

// ── Init ──────────────────────────────────────────────────────────────
popularCategorias();
initPaineis();
initGDrive();
// Apelido do dispositivo (global; usado nos logs de exclusão e na lixeira)
(function () {
    const inp = document.getElementById('gd-apelido');
    if (!inp) return;
    inp.value = getApelido();
    inp.addEventListener('change', () => setApelido(inp.value));
})();
carregar();
