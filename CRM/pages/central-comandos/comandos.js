// ============================================
// CENTRAL DE COMANDOS — Cell City CRM
// Versão com blocos modulares de comando
// ============================================
import { serverTimestamp } from '../../firebase/client.js';
import { ComandosRepository as Comandos, CategoriasComandosRepository as CategoriasComandos, InformacoesRepository as Informacoes } from '../../repositories/central.repository.js';
import { ConfigRepository as Config } from '../../repositories/sistema.repository.js';
// Fix 2026-07-10: init() usa initModulo()/carregarPermissoes()/podeVisualizar()
// (linhas ~148-151) mas os imports estavam ausentes — a página quebrava no
// boot com ReferenceError (gate RBAC nunca rodava, comandos não carregavam).
// Detectado pela nova suíte central-comandos.test.mjs.
import { initModulo } from '../../scripts/kernel.js';
import { carregarPermissoes, podeVisualizar } from '../../shared/permissoes.js';
import { escHtml as esc } from '../../shared/sanitize.js';
import { formatDate } from '../../shared/date-utils.js';

const COL = 'comandos';
const CAT_COL = 'categorias_comandos';
const CACHE_KEY = 'cc_comandos_cache';
const RECENTES_KEY = 'cc_comandos_recentes';
const CACHE_CAT_KEY = 'cc_categorias_cache';

const CATEGORIAS_PADRAO = ['CRM', 'Claude', 'Programação', 'Financeiro', 'Marketing', 'Instagram', 'WhatsApp', 'Igreja', 'Outros'];
const VIEWMODE_KEY = 'cc_comandos_viewmode';

// ===== MIGRAÇÃO v1: informacoes(tipo=comando) → comandos =====
// Executa uma única vez. Transfere registros legados da coleção `informacoes`
// (tipo:'comando', campo `conteudo`) para `comandos` (campo `blocos`).
// Os originais NÃO são apagados — recebem o campo `migracao:'comandos_v1'`
// como marcador de soft-delete, garantindo rastreabilidade.
async function executarMigracao() {
    const FLAG_ID = 'migracao_comandos_v1';

    // Verifica se já foi executada
    try {
        const flag = await Config.getById(FLAG_ID);
        if (flag && flag.concluida) return;
    } catch {
        return; // offline: não tenta migrar agora
    }

    let migrados = 0;
    let ignorados = 0;
    let erros = 0;
    const log = [];

    try {
        const lista = await Informacoes.list({ where: [['tipo', '==', 'comando']] });

        if (lista.length > 0) {
            const agora = new Date().toISOString();

            for (const orig of lista) {
                // Pula registros já migrados em execuções anteriores parciais
                if (orig.migracao === 'comandos_v1') {
                    ignorados++;
                    log.push({ id: orig.id, status: 'ja_migrado', titulo: orig.titulo || '' });
                    continue;
                }

                try {
                    const novoId = Comandos.newId();
                    await Comandos.set(novoId, {
                        id: novoId,
                        titulo: orig.titulo || '(sem título)',
                        categoria: orig.categoria || 'Outros',
                        blocos: [orig.conteudo || ''],
                        conteudo: orig.conteudo || '',
                        favorito: orig.favorito === true,
                        criadoEmISO: orig.criadoEmISO || agora,
                        atualizadoEmISO: agora,
                        criadoEm: serverTimestamp(),
                        atualizadoEm: serverTimestamp(),
                        migradoDe: orig.id
                    });

                    await Informacoes.update(orig.id, {
                        migracao: 'comandos_v1',
                        migracaoDestinoId: novoId,
                        migracaoEm: serverTimestamp()
                    });

                    migrados++;
                    log.push({ id: orig.id, novoId, status: 'ok', titulo: orig.titulo || '' });
                } catch (e) {
                    erros++;
                    log.push({ id: orig.id, status: 'erro', titulo: orig.titulo || '', erro: e.message });
                    console.error('⚠️ Migração: erro ao migrar registro', orig.id, e);
                }
            }
        }

        // Grava relatório no Firestore
        await Config.set(FLAG_ID, {
            concluida: true,
            executadaEm: serverTimestamp(),
            migrados,
            ignorados,
            erros,
            log
        });

        // Salva no localStorage para diagnóstico offline
        localStorage.setItem('cc_migracao_v1_log', JSON.stringify({
            data: new Date().toISOString(),
            migrados, ignorados, erros, log
        }));

        if (migrados > 0) {
            console.log(`✅ Migração concluída: ${migrados} comando(s) migrado(s).`);
            toast(`✅ Migração: ${migrados} comando(s) importado(s) da Central de Informações.`);
            await carregarComandos();
        } else {
            console.log('✅ Migração: nenhum registro legado encontrado.');
        }

    } catch (e) {
        console.error('⚠️ Migração: erro geral', e);
    }
}

// ===== STATE =====
let comandos = [];
let categorias = [...CATEGORIAS_PADRAO];
let categoriaFiltro = 'Todas';
let termoBusca = '';
let viewMode = localStorage.getItem(VIEWMODE_KEY) || 'lista';
let contadorBlocos = 0; // para IDs únicos dos blocos no formulário

// ===== EXPOSIÇÃO GLOBAL =====
window.filtrarComandos     = filtrarComandos;
window.abrirFormComando    = abrirFormComando;
window.fecharFormComando   = fecharFormComando;
window.salvarComando       = salvarComando;
window.copiarComando       = copiarComando;
window.copiarBloco         = copiarBloco;
window.copiarTodosBlocos   = copiarTodosBlocos;
window.editarComando       = editarComando;
window.excluirComando      = excluirComando;
window.toggleFavorito      = toggleFavorito;
window.filtrarPorCategoria = filtrarPorCategoria;
window.setViewMode         = setViewMode;
window.abrirFormCategoria  = abrirFormCategoria;
window.fecharFormCategoria = fecharFormCategoria;
window.salvarCategoria     = salvarCategoria;
window.adicionarBloco      = adicionarBloco;
window.removerBloco        = removerBloco;

// ===== INIT =====
async function init() {
    const ctx = await initModulo();
    if (!ctx) return;
    await carregarPermissoes(ctx);
    if (!podeVisualizar('central-comandos')) { window.location.href = (location.pathname==='/dev'||location.pathname.startsWith('/dev/')?'/dev':'') + '/CRM/pages/dashboard/index.html'; return; }
    await carregarCategorias();
    montarCategorias();
    montarSelectCategorias();
    aplicarBotoesView();
    await carregarComandos();
    executarMigracao(); // roda em background; recarrega lista se houver migração
    document.getElementById('cmd-modal')?.addEventListener('click', e => {
        if (e.target.id === 'cmd-modal') fecharFormComando();
    });
    document.getElementById('cmd-modal-cat')?.addEventListener('click', e => {
        if (e.target.id === 'cmd-modal-cat') fecharFormCategoria();
    });
}

// ===== MODO DE VISUALIZAÇÃO =====
function setViewMode(modo) {
    viewMode = modo;
    localStorage.setItem(VIEWMODE_KEY, modo);
    aplicarBotoesView();
    render();
}

function aplicarBotoesView() {
    document.getElementById('cmd-view-lista')?.classList.toggle('active', viewMode === 'lista');
    document.getElementById('cmd-view-cards')?.classList.toggle('active', viewMode === 'cards');
}

// ===== CARREGAR =====
async function carregarCategorias() {
    try {
        const lista = await CategoriasComandos.list();
        const customizadas = lista.map(d => d.nome).filter(Boolean);
        if (customizadas.length > 0) {
            categorias = [...CATEGORIAS_PADRAO, ...customizadas];
            localStorage.setItem(CACHE_CAT_KEY, JSON.stringify(categorias));
        }
    } catch {
        const cached = localStorage.getItem(CACHE_CAT_KEY);
        if (cached) categorias = JSON.parse(cached);
    }
}

async function carregarComandos() {
    try {
        comandos = await Comandos.list({ orderByField: 'criadoEm', direction: 'desc' });
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
    const todas = ['Todas', ...categorias];
    cont.innerHTML = todas.map(c =>
        `<button class="cmd-cat-chip${c === categoriaFiltro ? ' active' : ''}" onclick="filtrarPorCategoria('${c}')">${c}</button>`
    ).join('');
}

function montarSelectCategorias() {
    const sel = document.getElementById('cmd-f-categoria');
    if (!sel) return;
    sel.innerHTML = categorias.map(c => `<option value="${c}">${c}</option>`).join('');
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
            (c.conteudo || '').toLowerCase().includes(termoBusca) ||
            // Busca também dentro dos blocos
            (c.blocos || []).some(b => (b || '').toLowerCase().includes(termoBusca))
        );
    }

    // Favoritos sempre fixos no topo
    filtrados.sort((a, b) => (b.favorito === true) - (a.favorito === true));

    if (contador) contador.textContent = filtrados.length;

    lista.classList.toggle('modo-lista', viewMode === 'lista');
    lista.classList.toggle('modo-cards', viewMode === 'cards');

    if (!filtrados.length) {
        lista.innerHTML = `<div class="cmd-empty"><div class="cmd-empty-icon">🔍</div><p>${
            comandos.length ? 'Nenhum comando encontrado para essa busca.' : 'Nenhum comando ainda. Clique em <strong>➕ Novo Comando</strong> para começar.'
        }</p></div>`;
        return;
    }

    const renderizador = viewMode === 'lista' ? renderLinha : renderCard;
    lista.innerHTML = filtrados.map(renderizador).join('');
}

// Modo LISTA — linha compacta
function renderLinha(c) {
    const fav = c.favorito === true;
    const blocos = c.blocos && c.blocos.length > 0 ? c.blocos : (c.conteudo ? [c.conteudo] : []);
    const qtdBlocos = blocos.length;
    return `
    <div class="cmd-linha${fav ? ' fav' : ''}">
        <button class="cmd-linha-fav" onclick="toggleFavorito('${c.id}')" title="Favoritar">${fav ? '⭐' : '☆'}</button>
        <span class="cmd-linha-nome" onclick="copiarComando('${c.id}')" title="Clique para copiar">${esc(c.titulo)}</span>
        <span class="cmd-linha-cat">${esc(c.categoria || 'Outros')}</span>
        ${qtdBlocos > 1 ? `<span class="cmd-linha-qtd">${qtdBlocos} blocos</span>` : ''}
        <div class="cmd-linha-acoes">
            <button class="cmd-acao cmd-acao-copiar" onclick="copiarComando('${c.id}')" title="Copiar">📋</button>
            <button class="cmd-acao" onclick="editarComando('${c.id}')" title="Editar">✏️</button>
            <button class="cmd-acao cmd-acao-excluir" onclick="excluirComando('${c.id}')" title="Excluir">🗑️</button>
        </div>
    </div>`;
}

function renderCard(c) {
    const fav = c.favorito === true;
    const blocos = c.blocos && c.blocos.length > 0 ? c.blocos : (c.conteudo ? [c.conteudo] : []);
    const qtdBlocos = blocos.length;
    return `
    <div class="cmd-card${fav ? ' fav' : ''}">
        <div class="cmd-card-top">
            <div class="cmd-card-titulo">${esc(c.titulo)}</div>
            <button class="cmd-card-fav" onclick="event.stopPropagation();toggleFavorito('${c.id}')" title="Favoritar">${fav ? '⭐' : '☆'}</button>
        </div>
        <span class="cmd-card-cat">${esc(c.categoria || 'Outros')}</span>
        <div class="cmd-card-blocos" id="cmd-card-blocos-${c.id}">
            ${blocos.map((b, i) => `
                <div class="cmd-card-bloco">
                    <div class="cmd-card-bloco-header">
                        <span class="cmd-card-bloco-num">Comando ${i + 1}</span>
                        <button class="cmd-card-bloco-copiar" onclick="event.stopPropagation();copiarBloco('${c.id}', ${i})" title="Copiar este comando">📋 Copiar</button>
                    </div>
                    <div class="cmd-card-bloco-texto">${esc(b)}</div>
                </div>
            `).join('')}
        </div>
        ${qtdBlocos > 1 ? `
        <div class="cmd-card-rodape">
            <span class="cmd-card-data">${qtdBlocos} comandos • ${formatarData(c)}</span>
            <button class="cmd-acao cmd-acao-copiar-todos" onclick="event.stopPropagation();copiarTodosBlocos('${c.id}')" title="Copiar todos">📋 Copiar Todos</button>
        </div>
        ` : `
        <div class="cmd-card-rodape">
            <span class="cmd-card-data">${formatarData(c)}</span>
            <div class="cmd-card-acoes">
                <button class="cmd-acao cmd-acao-copiar" onclick="event.stopPropagation();copiarComando('${c.id}')" title="Copiar">📋</button>
                <button class="cmd-acao" onclick="event.stopPropagation();editarComando('${c.id}')" title="Editar">✏️</button>
                <button class="cmd-acao cmd-acao-excluir" onclick="event.stopPropagation();excluirComando('${c.id}')" title="Excluir">🗑️</button>
            </div>
        </div>
        `}
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

// ===== SISTEMA DE BLOCOS =====

/** Retorna os blocos atuais do formulário */
function getBlocosDoForm() {
    const container = document.getElementById('cmd-blocos-container');
    if (!container) return [];
    const textareas = container.querySelectorAll('.cmd-bloco-textarea');
    return Array.from(textareas).map(ta => ta.value.trim()).filter(Boolean);
}

/** Adiciona um novo bloco ao formulário */
function adicionarBloco(conteudoInicial = '') {
    contadorBlocos++;
    const container = document.getElementById('cmd-blocos-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'cmd-bloco-item';
    div.dataset.blocoId = contadorBlocos;

    div.innerHTML = `
        <div class="cmd-bloco-header">
            <span class="cmd-bloco-numero">Comando ${container.children.length + 1}</span>
            <button type="button" class="cmd-bloco-remover" onclick="removerBloco(this)" title="Remover este comando">✕</button>
        </div>
        <textarea class="cmd-bloco-textarea" rows="5" placeholder="Cole aqui o comando/prompt...">${esc(conteudoInicial)}</textarea>
    `;

    container.appendChild(div);
    atualizarNumeracaoBlocos();
}

/** Remove um bloco do formulário */
function removerBloco(botao) {
    const item = botao.closest('.cmd-bloco-item');
    if (!item) return;
    const container = document.getElementById('cmd-blocos-container');
    if (container.children.length <= 1) {
        toast('⚠️ Deve haver pelo menos um bloco de comando.');
        return;
    }
    item.remove();
    atualizarNumeracaoBlocos();
}

/** Atualiza a numeração dos blocos */
function atualizarNumeracaoBlocos() {
    const container = document.getElementById('cmd-blocos-container');
    if (!container) return;
    const itens = container.querySelectorAll('.cmd-bloco-item');
    itens.forEach((item, i) => {
        const num = item.querySelector('.cmd-bloco-numero');
        if (num) num.textContent = `Comando ${i + 1}`;
    });
}

// ===== COPIAR =====

/** Copia um comando inteiro (todos os blocos concatenados) */
async function copiarComando(id) {
    const c = comandos.find(x => x.id === id);
    if (!c) return;

    const blocos = c.blocos && c.blocos.length > 0 ? c.blocos : (c.conteudo ? [c.conteudo] : []);
    const texto = blocos.join('\n\n---\n\n');

    await copiarTexto(texto);
    toast('✅ Comando copiado com sucesso.');
    registrarUso(id);
}

/** Copia um bloco específico pelo índice */
async function copiarBloco(id, indice) {
    const c = comandos.find(x => x.id === id);
    if (!c) return;

    const blocos = c.blocos && c.blocos.length > 0 ? c.blocos : (c.conteudo ? [c.conteudo] : []);
    const texto = blocos[indice];
    if (!texto) return toast('⚠️ Bloco não encontrado.');

    await copiarTexto(texto);
    toast('✓ Comando copiado');
    registrarUso(id);
}

/** Copia todos os blocos de uma vez */
async function copiarTodosBlocos(id) {
    const c = comandos.find(x => x.id === id);
    if (!c) return;

    const blocos = c.blocos && c.blocos.length > 0 ? c.blocos : (c.conteudo ? [c.conteudo] : []);
    const texto = blocos.map((b, i) => `=== Comando ${i + 1} ===\n${b}`).join('\n\n');

    await copiarTexto(texto);
    toast('✅ Todos os comandos copiados.');
    registrarUso(id);
}

/** Função auxiliar para copiar texto para a área de transferência */
async function copiarTexto(texto) {
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
        await Comandos.set(id, { ...c, atualizadoEm: serverTimestamp() }, { merge: true });
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
    document.getElementById('cmd-f-categoria').value = categorias[0];
    document.getElementById('cmd-f-favorito').checked = false;

    // Limpa e adiciona primeiro bloco vazio
    const container = document.getElementById('cmd-blocos-container');
    container.innerHTML = '';
    contadorBlocos = 0;
    adicionarBloco('');

    document.getElementById('cmd-modal').classList.add('active');
    setTimeout(() => document.getElementById('cmd-f-titulo')?.focus(), 100);
}

function editarComando(id) {
    const c = comandos.find(x => x.id === id);
    if (!c) return;

    document.getElementById('cmd-edit-id').value = id;
    document.getElementById('cmd-modal-titulo').textContent = '✏️ Editar Comando';
    document.getElementById('cmd-f-titulo').value = c.titulo || '';
    document.getElementById('cmd-f-categoria').value = c.categoria || categorias[0];
    document.getElementById('cmd-f-favorito').checked = c.favorito === true;

    // Carrega blocos existentes
    const container = document.getElementById('cmd-blocos-container');
    container.innerHTML = '';
    contadorBlocos = 0;

    const blocos = c.blocos && c.blocos.length > 0 ? c.blocos : (c.conteudo ? [c.conteudo] : ['']);
    blocos.forEach(b => adicionarBloco(b));

    document.getElementById('cmd-modal').classList.add('active');
}

function fecharFormComando() {
    document.getElementById('cmd-modal').classList.remove('active');
}

// ===== MODAL / CATEGORIA =====
function abrirFormCategoria() {
    document.getElementById('cmd-f-cat-nome').value = '';
    document.getElementById('cmd-modal-cat').classList.add('active');
    setTimeout(() => document.getElementById('cmd-f-cat-nome')?.focus(), 100);
}

function fecharFormCategoria() {
    document.getElementById('cmd-modal-cat').classList.remove('active');
}

async function salvarCategoria() {
    const nome = document.getElementById('cmd-f-cat-nome').value.trim();
    if (!nome) return toast('⚠️ Informe o nome da categoria.');
    if (categorias.includes(nome)) return toast('⚠️ Esta categoria já existe.');

    const agoraISO = new Date().toISOString();
    const novoId = CategoriasComandos.newId();
    const dados = { id: novoId, nome, criadoEm: serverTimestamp(), criadoEmISO: agoraISO };

    try {
        await CategoriasComandos.set(novoId, dados);
        toast('✅ Categoria criada.');
    } catch {
        toast('✅ Categoria criada (offline).');
    }

    categorias.push(nome);
    localStorage.setItem(CACHE_CAT_KEY, JSON.stringify(categorias));
    fecharFormCategoria();
    montarCategorias();
    montarSelectCategorias();
}

async function salvarComando() {
    const id = document.getElementById('cmd-edit-id').value;
    const titulo = document.getElementById('cmd-f-titulo').value.trim();
    const categoria = document.getElementById('cmd-f-categoria').value;
    const favorito = document.getElementById('cmd-f-favorito').checked;

    if (!titulo) return toast('⚠️ Informe o título.');

    // Pega os blocos do formulário
    const blocos = getBlocosDoForm();
    if (!blocos.length) return toast('⚠️ Adicione pelo menos um comando.');

    const agoraISO = new Date().toISOString();

    if (id) {
        // editar
        const orig = comandos.find(c => c.id === id) || {};
        const dados = {
            ...orig, titulo, categoria, blocos, favorito,
            conteudo: blocos.join('\n\n---\n\n'), // mantém compatibilidade com versões antigas
            atualizadoEm: serverTimestamp(), atualizadoEmISO: agoraISO
        };
        try {
            await Comandos.set(id, dados, { merge: true });
            toast('✅ Comando atualizado.');
        } catch {
            toast('✅ Salvo localmente (offline).');
        }
        const idx = comandos.findIndex(c => c.id === id);
        if (idx >= 0) comandos[idx] = { ...dados, id };
    } else {
        // novo
        const novoId = Comandos.newId();
        const dados = {
            id: novoId, titulo, categoria, blocos, favorito,
            conteudo: blocos.join('\n\n---\n\n'), // mantém compatibilidade
            criadoEm: serverTimestamp(), criadoEmISO: agoraISO,
            atualizadoEm: serverTimestamp(), atualizadoEmISO: agoraISO
        };
        try {
            await Comandos.set(novoId, dados);
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
        await Comandos.remove(id);
    } catch {}
    comandos = comandos.filter(x => x.id !== id);
    localStorage.setItem(CACHE_KEY, JSON.stringify(comandos));
    localStorage.setItem(RECENTES_KEY, JSON.stringify(getRecentes().filter(r => r !== id)));
    render();
    renderRecentes();
    toast('🗑️ Comando excluído.');
}

// ===== UTILS =====
function formatarData(c) {
    const iso = c.atualizadoEmISO || c.criadoEmISO;
    if (!iso) return '';
    const data = formatDate(iso);
    return (c.atualizadoEmISO && c.atualizadoEmISO !== c.criadoEmISO) ? `✏️ ${data}` : `📅 ${data}`;
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
