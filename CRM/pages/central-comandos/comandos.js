// ============================================
// CENTRAL DE COMANDOS — Cell City CRM
// ============================================
import {
    db, collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, serverTimestamp
} from "../../scripts/firebase.js";

const COL = 'comandos';
const CACHE_KEY = 'cc_comandos_cache';
const RECENTES_KEY = 'cc_comandos_recentes';

const CATEGORIAS = ['CRM', 'Claude', 'Programação', 'Financeiro', 'Marketing', 'Instagram', 'WhatsApp', 'Igreja', 'Outros'];

// ===== STATE =====
let comandos = [];
let categoriaFiltro = 'Todas';
let termoBusca = '';

// ===== EXPOSIÇÃO GLOBAL =====
window.filtrarComandos    = filtrarComandos;
window.abrirFormComando   = abrirFormComando;
window.fecharFormComando  = fecharFormComando;
window.salvarComando      = salvarComando;
window.copiarComando      = copiarComando;
window.editarComando      = editarComando;
window.excluirComando     = excluirComando;
window.toggleFavorito     = toggleFavorito;
window.filtrarPorCategoria = filtrarPorCategoria;

// ===== INIT =====
function init() {
    montarCategorias();
    montarSelectCategorias();
    carregarComandos();
    document.getElementById('cmd-modal')?.addEventListener('click', e => {
        if (e.target.id === 'cmd-modal') fecharFormComando();
    });
}

// ===== CARREGAR =====
async function carregarComandos() {
    try {
        const snap = await getDocs(query(collection(db, COL), orderBy('criadoEm', 'desc')));
        comandos = [];
        snap.forEach(d => comandos.push({ id: d.id, ...d.data() }));
        localStorage.setItem(CACHE_KEY, JSON.stringify(comandos));
    } catch {
        comandos = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    }
    render();
    renderRecentes();
}

// ===== CATEGORIAS (chips de filtro) =====
function montarCategorias() {
    const cont = document.getElementById('cmd-categorias');
    if (!cont) return;
    const todas = ['Todas', ...CATEGORIAS];
    cont.innerHTML = todas.map(c =>
        `<button class="cmd-cat-chip${c === categoriaFiltro ? ' active' : ''}" onclick="filtrarPorCategoria('${c}')">${c}</button>`
    ).join('');
}

function montarSelectCategorias() {
    const sel = document.getElementById('cmd-f-categoria');
    if (!sel) return;
    sel.innerHTML = CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('');
}

function filtrarPorCategoria(cat) {
    categoriaFiltro = cat;
    montarCategorias();
    render();
}

// ===== PESQUISA =====
function filtrarComandos() {
    termoBusca = (document.getElementById('cmd-busca')?.value || '').toLowerCase().trim();
    render();
}

// ===== RENDER PRINCIPAL =====
function render() {
    const lista = document.getElementById('cmd-lista');
    const contador = document.getElementById('cmd-contador');
    if (!lista) return;

    let filtrados = comandos.slice();

    if (categoriaFiltro !== 'Todas') {
        filtrados = filtrados.filter(c => c.categoria === categoriaFiltro);
    }
    if (termoBusca) {
        filtrados = filtrados.filter(c =>
            (c.titulo || '').toLowerCase().includes(termoBusca) ||
            (c.categoria || '').toLowerCase().includes(termoBusca) ||
            (c.conteudo || '').toLowerCase().includes(termoBusca)
        );
    }

    // Favoritos primeiro, depois por data de criação (já vem ordenado por criadoEm desc)
    filtrados.sort((a, b) => (b.favorito === true) - (a.favorito === true));

    if (contador) contador.textContent = filtrados.length;

    if (!filtrados.length) {
        lista.innerHTML = `<div class="cmd-empty"><div class="cmd-empty-icon">🔍</div><p>${
            comandos.length ? 'Nenhum comando encontrado para essa busca.' : 'Nenhum comando ainda. Clique em <strong>➕ Novo Comando</strong> para começar.'
        }</p></div>`;
        return;
    }

    lista.innerHTML = filtrados.map(renderCard).join('');
}

function renderCard(c) {
    const fav = c.favorito === true;
    return `
    <div class="cmd-card${fav ? ' fav' : ''}" onclick="copiarComando('${c.id}')" title="Clique para copiar">
        <div class="cmd-card-top">
            <div class="cmd-card-titulo">${esc(c.titulo)}</div>
            <button class="cmd-card-fav" onclick="event.stopPropagation();toggleFavorito('${c.id}')" title="Favoritar">${fav ? '⭐' : '☆'}</button>
        </div>
        <span class="cmd-card-cat">${esc(c.categoria || 'Outros')}</span>
        <div class="cmd-card-conteudo">${esc(c.conteudo || '')}</div>
        <div class="cmd-card-rodape">
            <span class="cmd-card-data">${formatarData(c)}</span>
            <div class="cmd-card-acoes">
                <button class="cmd-acao cmd-acao-copiar" onclick="event.stopPropagation();copiarComando('${c.id}')" title="Copiar">📋</button>
                <button class="cmd-acao" onclick="event.stopPropagation();editarComando('${c.id}')" title="Editar">✏️</button>
                <button class="cmd-acao cmd-acao-excluir" onclick="event.stopPropagation();excluirComando('${c.id}')" title="Excluir">🗑️</button>
            </div>
        </div>
    </div>`;
}

// ===== ÚLTIMOS UTILIZADOS =====
function getRecentes() {
    return JSON.parse(localStorage.getItem(RECENTES_KEY) || '[]');
}

function registrarUso(id) {
    let recentes = getRecentes().filter(r => r !== id);
    recentes.unshift(id);
    recentes = recentes.slice(0, 6);
    localStorage.setItem(RECENTES_KEY, JSON.stringify(recentes));
    renderRecentes();
}

function renderRecentes() {
    const sec = document.getElementById('cmd-recentes-sec');
    const cont = document.getElementById('cmd-recentes');
    if (!sec || !cont) return;
    const recentes = getRecentes()
        .map(id => comandos.find(c => c.id === id))
        .filter(Boolean);
    if (!recentes.length) { sec.style.display = 'none'; return; }
    sec.style.display = 'block';
    cont.innerHTML = recentes.map(c =>
        `<button class="cmd-recente-chip" onclick="copiarComando('${c.id}')">📋 ${esc(c.titulo)}</button>`
    ).join('');
}

// ===== COPIAR =====
async function copiarComando(id) {
    const c = comandos.find(x => x.id === id);
    if (!c) return;
    const texto = c.conteudo || '';
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(texto);
        } else {
            const ta = document.createElement('textarea');
            ta.value = texto;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        toast('✅ Comando copiado com sucesso.');
        registrarUso(id);
    } catch {
        toast('⚠️ Não foi possível copiar.');
    }
}

// ===== FAVORITAR =====
async function toggleFavorito(id) {
    const c = comandos.find(x => x.id === id);
    if (!c) return;
    c.favorito = !c.favorito;
    render();
    try {
        await setDoc(doc(db, COL, id), { ...c, atualizadoEm: serverTimestamp() }, { merge: true });
        localStorage.setItem(CACHE_KEY, JSON.stringify(comandos));
    } catch {
        localStorage.setItem(CACHE_KEY, JSON.stringify(comandos));
    }
}

// ===== MODAL / CADASTRO =====
function abrirFormComando() {
    document.getElementById('cmd-edit-id').value = '';
    document.getElementById('cmd-modal-titulo').textContent = '➕ Novo Comando';
    document.getElementById('cmd-f-titulo').value = '';
    document.getElementById('cmd-f-categoria').value = CATEGORIAS[0];
    document.getElementById('cmd-f-conteudo').value = '';
    document.getElementById('cmd-f-favorito').checked = false;
    document.getElementById('cmd-modal').classList.add('active');
    setTimeout(() => document.getElementById('cmd-f-titulo')?.focus(), 100);
}

function editarComando(id) {
    const c = comandos.find(x => x.id === id);
    if (!c) return;
    document.getElementById('cmd-edit-id').value = id;
    document.getElementById('cmd-modal-titulo').textContent = '✏️ Editar Comando';
    document.getElementById('cmd-f-titulo').value = c.titulo || '';
    document.getElementById('cmd-f-categoria').value = c.categoria || CATEGORIAS[0];
    document.getElementById('cmd-f-conteudo').value = c.conteudo || '';
    document.getElementById('cmd-f-favorito').checked = c.favorito === true;
    document.getElementById('cmd-modal').classList.add('active');
}

function fecharFormComando() {
    document.getElementById('cmd-modal').classList.remove('active');
}

async function salvarComando() {
    const id = document.getElementById('cmd-edit-id').value;
    const titulo = document.getElementById('cmd-f-titulo').value.trim();
    const categoria = document.getElementById('cmd-f-categoria').value;
    const conteudo = document.getElementById('cmd-f-conteudo').value.trim();
    const favorito = document.getElementById('cmd-f-favorito').checked;

    if (!titulo)   return toast('⚠️ Informe o título.');
    if (!conteudo) return toast('⚠️ Informe o conteúdo do comando.');

    const agoraISO = new Date().toISOString();

    if (id) {
        // editar
        const orig = comandos.find(c => c.id === id) || {};
        const dados = {
            ...orig, titulo, categoria, conteudo, favorito,
            atualizadoEm: serverTimestamp(), atualizadoEmISO: agoraISO
        };
        try {
            await setDoc(doc(db, COL, id), dados, { merge: true });
            toast('✅ Comando atualizado.');
        } catch {
            toast('✅ Salvo localmente (offline).');
        }
        const idx = comandos.findIndex(c => c.id === id);
        if (idx >= 0) comandos[idx] = { ...dados, id };
    } else {
        // novo
        const ref = doc(collection(db, COL));
        const dados = {
            id: ref.id, titulo, categoria, conteudo, favorito,
            criadoEm: serverTimestamp(), criadoEmISO: agoraISO,
            atualizadoEm: serverTimestamp(), atualizadoEmISO: agoraISO
        };
        try {
            await setDoc(ref, dados);
            toast('✅ Comando salvo.');
        } catch {
            toast('✅ Salvo localmente (offline).');
        }
        comandos.unshift(dados);
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(comandos));
    fecharFormComando();
    render();
    renderRecentes();
}

// ===== EXCLUIR =====
async function excluirComando(id) {
    const c = comandos.find(x => x.id === id);
    if (!c) return;
    if (!confirm(`Excluir o comando "${c.titulo}"?\n\nEsta ação é permanente.`)) return;
    try {
        await deleteDoc(doc(db, COL, id));
    } catch {}
    comandos = comandos.filter(x => x.id !== id);
    localStorage.setItem(CACHE_KEY, JSON.stringify(comandos));
    // remove dos recentes
    localStorage.setItem(RECENTES_KEY, JSON.stringify(getRecentes().filter(r => r !== id)));
    render();
    renderRecentes();
    toast('🗑️ Comando excluído.');
}

// ===== UTILS =====
function formatarData(c) {
    const iso = c.atualizadoEmISO || c.criadoEmISO;
    if (!iso) return '';
    const d = new Date(iso);
    const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    return (c.atualizadoEmISO && c.atualizadoEmISO !== c.criadoEmISO) ? `✏️ ${data}` : `📅 ${data}`;
}

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let toastTimer;
function toast(msg) {
    const t = document.getElementById('cmd-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ===== START =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
