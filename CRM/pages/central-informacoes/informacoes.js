// ============================================
// CENTRAL DE INFORMAÇÕES — Cell City CRM
// ============================================
import { initModulo } from '../../scripts/kernel.js';
import { carregarPermissoes, podeVisualizar } from '../../shared/permissoes.js';
import { serverTimestamp } from '../../firebase/client.js';
import { InformacoesRepository as Informacoes, CategoriasInformacoesRepository as CategoriasInformacoes } from '../../repositories/central.repository.js';
import { getStorage, ref, uploadBytes, getBytes, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getTenantFieldValue } from "../../shared/tenant-query.js";
import { escHtml as escapeHtml } from '../../shared/sanitize.js';

const COL = 'informacoes';
const CAT_COL = 'categorias_informacoes';
const CACHE_KEY = 'cc_informacoes_cache';
const RECENTES_KEY = 'cc_informacoes_recentes';
const CACHE_CAT_KEY = 'cc_categorias_informacoes_cache';
const VIEWMODE_KEY = 'cc_informacoes_viewmode';

const TIPOS_REGISTRO = ['Todos', 'Comando', 'Site', 'Senha', 'Anotação', 'Documento'];
// Mapeamento do nome de exibição → valor armazenado no Firestore (sem acento, minúsculo)
const TIPO_PARA_VALOR = {
    'Todos':    null,
    'Comando':  'comando',
    'Site':     'site',
    'Senha':    'senha',
    'Anotação': 'anotacao',
    'Documento':'documento'
};
const CATEGORIAS_PADRAO = ['CRM', 'Claude', 'Programação', 'Financeiro', 'Marketing', 'Instagram', 'WhatsApp', 'Igreja', 'Outros'];
const CRIPTOGRAFIA_KEY = 'cellcity-2026'; // Chave para criptografia local (não é seguro, apenas ofuscação)

const storage = getStorage();

// ===== STATE =====
let informacoes = [];
let categorias = [...CATEGORIAS_PADRAO];
let tipoFiltro = 'Todos';
let categoriaFiltro = 'Todas';
let termoBusca = '';
let viewMode = localStorage.getItem(VIEWMODE_KEY) || 'lista';
let currentEditType = null;
let currentEditFile = null;
let infoLeituraIdAtivo = null;

// ===== EXPOSIÇÃO GLOBAL =====
window.filtrarInformacoes = filtrarInformacoes;
window.filtrarPorTipo = filtrarPorTipo;
window.filtrarPorCategoria = filtrarPorCategoria;
window.setViewMode = setViewMode;

window.abrirFormNovaInfo = abrirFormNovaInfo;
window.fecharFormNovaInfo = fecharFormNovaInfo;
window.fecharFormEditar = fecharFormEditar;
window.abrirFormComando = abrirFormComando;
window.abrirFormSite = abrirFormSite;
window.abrirFormSenha = abrirFormSenha;
window.abrirFormAnotacao = abrirFormAnotacao;
window.abrirFormDocumento = abrirFormDocumento;

window.salvarInformacao = salvarInformacao;
window.editarInformacao = editarInformacao;
window.excluirInformacao = excluirInformacao;
window.toggleFavorito = toggleFavorito;

window.abrirFormCategoria = abrirFormCategoria;
window.fecharFormCategoria = fecharFormCategoria;
window.salvarCategoria = salvarCategoria;

window.abrirSite = abrirSite;
window.copiarUsuario = copiarUsuario;
window.copiarSenha = copiarSenha;
window.toggleSenhaVisibility = toggleSenhaVisibility;
window.downloadDocumento = downloadDocumento;
window.limparArquivo = limparArquivo;

window.copiarTitulo = copiarTitulo;
window.visualizarSenha = visualizarSenha;
window.copiarComando = copiarComando;
window.duplicarComando = duplicarComando;
window.abrirNaCentralComandos = abrirNaCentralComandos;

window.adicionarUrl = adicionarUrl;
window.removerUrl = removerUrl;
window.adicionarLinhaComando = adicionarLinhaComando;
window.adicionarGrupoComando = adicionarGrupoComando;
window.removerLinhaComando = removerLinhaComando;
window.copiarLinhaCmd = copiarLinhaCmd;
window.copiarLinhaRender = copiarLinhaRender;
window.toggleUrlsCollapse = toggleUrlsCollapse;
window.toggleSiteSection = toggleSiteSection;
window.abrirTelaCheiaInfo = abrirTelaCheiaInfo;
window.fecharTelaCheiaInfo = fecharTelaCheiaInfo;
window.editarTelaCheiaInfo = editarTelaCheiaInfo;
window.copiarTelaCheiaInfo = copiarTelaCheiaInfo;
window.imprimirTelaCheiaInfo = imprimirTelaCheiaInfo;

// ===== INIT =====
async function init() {
    const ctx = await initModulo();
    if (!ctx) return;
    await carregarPermissoes(ctx);
    if (!podeVisualizar('central-informacoes')) { window.location.href = (location.pathname==='/dev'||location.pathname.startsWith('/dev/')?'/dev':'') + '/CRM/pages/dashboard/index.html'; return; }
    await carregarCategorias();
    montarCategorias();
    montarSelectCategorias();
    montarFiltrosTipo();
    aplicarBotoesView();
    await carregarInformacoes();

    // Event listeners para modais
    document.getElementById('info-modal-tipo')?.addEventListener('click', e => {
        if (e.target.id === 'info-modal-tipo') fecharFormNovaInfo();
    });
    document.getElementById('info-modal-editar')?.addEventListener('click', e => {
        if (e.target.id === 'info-modal-editar') fecharFormEditar();
    });
    document.getElementById('info-modal-cat')?.addEventListener('click', e => {
        if (e.target.id === 'info-modal-cat') fecharFormCategoria();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && infoLeituraIdAtivo) fecharTelaCheiaInfo();
    });

    // Event delegation para títulos clicáveis
    let lastClickTime = 0;
    const doubleClickDelay = 300;
    let pendingClickTimer = null;

    document.getElementById('info-lista')?.addEventListener('click', e => {
        const titulo = e.target.closest('.info-titulo-clicavel');
        if (!titulo) return;

        const id = titulo.dataset.id;
        const tipo = titulo.dataset.tipo;
        const now = Date.now();

        // Detectar duplo clique
        if (now - lastClickTime < doubleClickDelay && pendingClickTimer) {
            clearTimeout(pendingClickTimer);
            pendingClickTimer = null;
            editarInformacao(id);
        } else {
            lastClickTime = now;
            pendingClickTimer = setTimeout(() => {
                copiarTitulo(id, tipo);
                pendingClickTimer = null;
            }, doubleClickDelay);
        }
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
    document.getElementById('info-view-lista')?.classList.toggle('active', viewMode === 'lista');
    document.getElementById('info-view-cards')?.classList.toggle('active', viewMode === 'cards');
}

// ===== CARREGAR DO FIRESTORE (TEMPO REAL via onSnapshot) =====
let _unsubCategorias = null;
let _unsubInformacoes = null;

function carregarCategorias() {
    // Pinta imediatamente a partir do cache (offline / 1ª pintura)
    try {
        const cached = localStorage.getItem(CACHE_CAT_KEY);
        if (cached) categorias = JSON.parse(cached);
    } catch {}
    if (_unsubCategorias) { _unsubCategorias(); _unsubCategorias = null; }
    _unsubCategorias = CategoriasInformacoes.onChange((lista) => {
        const customizadas = lista.map(d => d.nome).filter(Boolean);
        categorias = customizadas.length > 0
            ? [...CATEGORIAS_PADRAO, ...customizadas]
            : [...CATEGORIAS_PADRAO];
        localStorage.setItem(CACHE_CAT_KEY, JSON.stringify(categorias));
        montarCategorias();
        montarSelectCategorias();
    }, { onError: (e) => console.warn('⚠️ onSnapshot categorias:', e) });
}

function carregarInformacoes() {
    // Pinta imediatamente a partir do cache
    try { informacoes = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch { informacoes = []; }
    if (_unsubInformacoes) { _unsubInformacoes(); _unsubInformacoes = null; }
    _unsubInformacoes = Informacoes.onChange((lista) => {
        informacoes = lista;
        localStorage.setItem(CACHE_KEY, JSON.stringify(informacoes));
        render();
    }, {
        orderByField: 'criadoEm', direction: 'desc',
        onError: (e) => {
            console.warn('⚠️ onSnapshot informações:', e);
            render();
        }
    });
}

// ===== FILTROS =====
function montarFiltrosTipo() {
    const cont = document.getElementById('info-tipo-chips');
    if (!cont) return;
    cont.innerHTML = TIPOS_REGISTRO.map(t =>
        `<button class="info-tipo-chip${t === tipoFiltro ? ' active' : ''}" onclick="filtrarPorTipo('${t}')">${t === 'Todos' ? 'Todos' : t}</button>`
    ).join('');
}

function filtrarPorTipo(tipo) {
    tipoFiltro = tipo;
    montarFiltrosTipo();
    render();
}

function montarCategorias() {
    const cont = document.getElementById('info-categorias');
    if (!cont) return;
    const todas = ['Todas', ...categorias];
    cont.innerHTML = todas.map(c =>
        `<button class="info-cat-chip${c === categoriaFiltro ? ' active' : ''}" onclick="filtrarPorCategoria('${c}')">${c}</button>`
    ).join('');
}

function montarSelectCategorias() {
    const sel = document.getElementById('info-f-categoria');
    if (!sel) return;
    sel.innerHTML = categorias.map(c => `<option value="${c}">${c}</option>`).join('');
}

function filtrarPorCategoria(cat) {
    categoriaFiltro = cat;
    montarCategorias();
    render();
}

function filtrarInformacoes() {
    termoBusca = (document.getElementById('info-busca')?.value || '').toLowerCase().trim();
    render();
}

// ===== RENDER =====
function render() {
    const lista = document.getElementById('info-lista');
    const contador = document.getElementById('info-contador');
    if (!lista) return;

    let filtrados = informacoes.slice();

    // Filtrar por tipo
    if (tipoFiltro !== 'Todos') {
        const tipoValor = TIPO_PARA_VALOR[tipoFiltro] ?? tipoFiltro.toLowerCase();
        filtrados = filtrados.filter(i => i.tipo === tipoValor);
    }

    // Filtrar por categoria
    if (categoriaFiltro !== 'Todas') {
        filtrados = filtrados.filter(i => i.categoria === categoriaFiltro);
    }

    // Busca textual
    if (termoBusca) {
        filtrados = filtrados.filter(i => {
            const titulo = (i.titulo || '').toLowerCase();
            const categoria = (i.categoria || '').toLowerCase();
            const conteudo = (i.conteudo || '').toLowerCase();
            const usuario = (i.usuario || '').toLowerCase();
            const siteServico = (i.site_servico || '').toLowerCase();
            const descricao = (i.descricao || '').toLowerCase();
            const urls = (Array.isArray(i.urls) ? i.urls.join(' ') : (i.url || '')).toLowerCase();
            const tags = (i.tags || '').toLowerCase();
            const cmdTexto = Array.isArray(i.linhas)
                ? i.linhas.filter(l => l.cmd).map(l => l.cmd).join(' ').toLowerCase()
                : '';

            return titulo.includes(termoBusca) ||
                   categoria.includes(termoBusca) ||
                   conteudo.includes(termoBusca) ||
                   usuario.includes(termoBusca) ||
                   siteServico.includes(termoBusca) ||
                   descricao.includes(termoBusca) ||
                   urls.includes(termoBusca) ||
                   tags.includes(termoBusca) ||
                   cmdTexto.includes(termoBusca);
        });
    }

    // Favoritos no topo
    filtrados.sort((a, b) => (b.favorito === true) - (a.favorito === true));

    if (contador) contador.textContent = filtrados.length;

    const countEl = document.getElementById('info-resultado-count');
    if (countEl) {
        const ativo = termoBusca || tipoFiltro !== 'Todos' || categoriaFiltro !== 'Todas';
        if (ativo) {
            const n = filtrados.length;
            countEl.textContent = n === 1 ? '1 registro encontrado' : `${n} registros encontrados`;
            countEl.style.display = 'block';
        } else {
            countEl.style.display = 'none';
        }
    }

    lista.classList.toggle('modo-lista', viewMode === 'lista');
    lista.classList.toggle('modo-cards', viewMode === 'cards');

    if (filtrados.length === 0) {
        lista.innerHTML = `
            <div class="info-empty">
                <div class="info-empty-icon">📚</div>
                <p>Nenhuma informação encontrada.</p>
            </div>
        `;
        return;
    }

    if (viewMode === 'lista') {
        lista.innerHTML = filtrados.map(renderItemLista).join('');
    } else {
        lista.innerHTML = filtrados.map(renderItemCard).join('');
    }
}

function renderItemLista(info) {
    const icone = getIconoTipo(info.tipo);
    const estrela = info.favorito ? '⭐' : '☆';
    const cmdsHtml = info.tipo === 'comando'
        ? `<div class="info-cmds-compact">${renderComandosCompacto(info)}</div>`
        : '';

    return `
        <div class="info-lista-item${info.tipo === 'comando' ? ' info-lista-item-comando' : ''}">
            <span class="info-lista-item-icon">${icone}</span>
            <div class="info-lista-item-content">
                <div class="info-lista-item-titulo info-titulo-clicavel" data-id="${info.id}" data-tipo="${info.tipo}">${escapeHtml(info.titulo)}</div>
                <div class="info-lista-item-meta">${escapeHtml(info.categoria)}</div>
                ${cmdsHtml}
            </div>
            <div class="info-lista-item-actions">
                ${renderAcoesPorTipo(info)}
                <button type="button" class="info-card-btn leitura" onclick="abrirTelaCheiaInfo('${info.id}', event)" title="Tela cheia">⛶ Tela Cheia</button>
                <button class="info-card-btn" onclick="toggleFavorito('${info.id}')" title="Favorito">${estrela}</button>
                <button class="info-card-btn edit" onclick="editarInformacao('${info.id}')">✏️</button>
                <button class="info-card-btn delete" onclick="excluirInformacao('${info.id}')">🗑️</button>
            </div>
        </div>
    `;
}

function renderItemCard(info) {
    const icone = getIconoTipo(info.tipo);
    const badge = `<span class="info-card-badge ${info.tipo}">${getTituloTipo(info.tipo)}</span>`;
    const estrela = info.favorito ? '⭐' : '☆';
    let conteudo = '';

    if (info.tipo === 'comando') {
        conteudo = renderComandosCompacto(info);
    } else if (info.tipo === 'anotacao') {
        conteudo = escapeHtml((info.conteudo || '').substring(0, 100));
    } else if (info.tipo === 'site') {
        const totalUrls = Array.isArray(info.urls) ? info.urls.length : (info.url ? 1 : 0);
        const urlLabel = totalUrls > 1 ? `URLs (${totalUrls})` : 'URL';
        conteudo = `<strong>${urlLabel}:</strong> ${escapeHtml(info.url || '-')}<br><strong>Usuário:</strong> ${escapeHtml(info.usuario || '-')}`;
    } else if (info.tipo === 'senha') {
        conteudo = `<strong>Serviço:</strong> ${escapeHtml(info.site_servico)}<br><strong>Usuário:</strong> ${escapeHtml(info.usuario)}`;
    } else if (info.tipo === 'documento') {
        conteudo = `<strong>Descrição:</strong> ${escapeHtml(info.descricao || '-')}`;
    }

    return `
        <div class="info-card">
            <div class="info-card-header">
                <div class="info-card-titulo">
                    <span class="info-card-icon">${icone}</span>
                    <span class="info-card-titulo-texto info-titulo-clicavel" data-id="${info.id}" data-tipo="${info.tipo}">${escapeHtml(info.titulo)}</span>
                    ${badge}
                </div>
                <span>${estrela}</span>
            </div>
            <div class="info-card-content">${conteudo}</div>
            <div class="info-card-actions" style="margin-top: 12px;">
                ${renderAcoesPorTipo(info)}
                <button type="button" class="info-card-btn leitura" onclick="abrirTelaCheiaInfo('${info.id}', event)">⛶ Tela Cheia</button>
                <button class="info-card-btn" onclick="toggleFavorito('${info.id}')">⭐</button>
                <button class="info-card-btn edit" onclick="editarInformacao('${info.id}')">✏️</button>
                <button class="info-card-btn delete" onclick="excluirInformacao('${info.id}')">🗑️</button>
            </div>
        </div>
    `;
}

function renderAcoesPorTipo(info) {
    if (info.tipo === 'comando') {
        return `
            <button class="info-card-btn copy" onclick="copiarComando('${info.id}')">📋 Copiar</button>
            <button class="info-card-btn" onclick="duplicarComando('${info.id}')" title="Duplicar comando">📄 Duplicar</button>
            <button class="info-card-btn" onclick="abrirNaCentralComandos()" title="Abrir na Central de Comandos">🗂️ Central</button>
        `;
    } else if (info.tipo === 'site') {
        return `
            <button class="info-card-btn copy" onclick="abrirSite('${info.id}')">🌐 Abrir</button>
            ${info.usuario ? `<button class="info-card-btn copy" onclick="copiarUsuario('${info.id}')">👤 User</button>` : ''}
            ${info.usuario ? `<button class="info-card-btn copy" onclick="copiarSenha('${info.id}', 'site')">🔑 Senha</button>` : ''}
        `;
    } else if (info.tipo === 'senha') {
        return `
            <button class="info-card-btn copy" onclick="copiarUsuario('${info.id}')">👤 User</button>
            <button class="info-card-btn copy" onclick="copiarSenha('${info.id}', 'senha')">🔑 Senha</button>
            <button class="info-card-btn eye" onclick="visualizarSenha('${info.id}')" title="Visualizar senha">👁</button>
        `;
    } else if (info.tipo === 'documento') {
        return `<button class="info-card-btn copy" onclick="downloadDocumento('${info.id}')">📥 Download</button>`;
    }
    return '';
}

function getIconoTipo(tipo) {
    const ícones = {
        'comando': '📝',
        'site': '🌐',
        'senha': '🔐',
        'anotacao': '📌',
        'documento': '📄'
    };
    return ícones[tipo] || '📌';
}

function getTituloTipo(tipo) {
    const títulos = {
        'comando': 'Comando',
        'site': 'Site',
        'senha': 'Senha',
        'anotacao': 'Anotação',
        'documento': 'Documento'
    };
    return títulos[tipo] || tipo;
}

// ===== LEITURA EM TELA CHEIA =====
function abrirTelaCheiaInfo(id, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const info = informacoes.find(x => x.id === id);
    if (!info) return;

    const item = event?.target?.closest?.('.info-lista-item, .info-card');
    if (!item) return;

    if (infoLeituraIdAtivo === id && item.classList.contains('info-expandido')) {
        fecharTelaCheiaInfo();
        return;
    }

    fecharTelaCheiaInfo();
    infoLeituraIdAtivo = id;
    item.classList.add('info-expandido');
    item.insertAdjacentHTML('beforeend', renderLeituraInline(info));
    const btn = item.querySelector('.info-card-btn.leitura');
    if (btn) btn.textContent = '↙ Restaurar';
}

function fecharTelaCheiaInfo() {
    document.querySelectorAll('.info-leitura-inline').forEach(el => el.remove());
    document.querySelectorAll('.info-expandido').forEach(el => el.classList.remove('info-expandido'));
    document.querySelectorAll('.info-card-btn.leitura').forEach(btn => { btn.textContent = '⛶ Tela Cheia'; });
    infoLeituraIdAtivo = null;
}

function editarTelaCheiaInfo() {
    if (!infoLeituraIdAtivo) return;
    const id = infoLeituraIdAtivo;
    fecharTelaCheiaInfo();
    editarInformacao(id);
}

async function copiarTelaCheiaInfo() {
    const info = informacoes.find(x => x.id === infoLeituraIdAtivo);
    if (!info) return;
    let texto = '';
    try {
        texto = obterTextoCopiavel(info);
    } catch {
        return toast('❌ Erro ao descriptografar senha');
    }
    if (!texto) return toast('⚠️ Nenhum conteúdo para copiar');
    await navigator.clipboard.writeText(texto).catch(() => {
        document.execCommand('copy', false, texto);
    });
    toast('✅ Conteúdo copiado!');
}

function imprimirTelaCheiaInfo() {
    window.print();
}

function renderLeituraInline(info) {
    return `
        <section class="info-leitura-inline" data-id="${info.id}">
            <header class="info-leitura-header">
                <div class="info-leitura-titulo-wrap">
                    <div class="info-leitura-kicker">
                        <span>${getIconoTipo(info.tipo)}</span>
                        <span>${escapeHtml(info.categoria || 'Sem categoria')}</span>
                        <span>${escapeHtml(getTituloTipo(info.tipo))}</span>
                    </div>
                    <h2>${escapeHtml(info.titulo || '(sem título)')}</h2>
                </div>
                <div class="info-leitura-header-acoes">
                    ${renderAcoesPorTipo(info)}
                    <button type="button" class="info-card-btn" onclick="toggleFavorito('${info.id}')" title="Favoritar">⭐</button>
                    <button type="button" class="info-card-btn edit" onclick="editarTelaCheiaInfo()" title="Editar">✏️</button>
                    <button type="button" class="info-card-btn leitura" onclick="fecharTelaCheiaInfo()" title="Restaurar">↙</button>
                </div>
            </header>
            <div class="info-leitura-corpo">${renderTelaCheiaConteudo(info)}</div>
            <footer class="info-leitura-rodape">
                ${renderAcoesPorTipo(info)}
                <button type="button" class="info-card-btn" onclick="toggleFavorito('${info.id}')">⭐ Favoritar</button>
                <button type="button" class="info-card-btn edit" onclick="editarTelaCheiaInfo()">✏️ Editar</button>
                <button type="button" class="info-card-btn copy" onclick="copiarTelaCheiaInfo()">📋 Copiar</button>
                <button type="button" class="info-card-btn" onclick="imprimirTelaCheiaInfo()">🖨️ Imprimir</button>
                <button type="button" class="info-card-btn delete" onclick="excluirInformacao('${info.id}')">🗑️ Excluir</button>
                <button type="button" class="info-card-btn leitura" onclick="fecharTelaCheiaInfo()">↙ Restaurar</button>
            </footer>
        </section>
    `;
}

function renderTelaCheiaConteudo(info) {
    if (info.tipo === 'comando') return renderTelaCheiaComando(info);
    if (info.tipo === 'site') return renderTelaCheiaSite(info);
    if (info.tipo === 'senha') return renderTelaCheiaSenha(info);
    if (info.tipo === 'documento') return renderTelaCheiaDocumento(info);
    return `<div class="info-leitura-texto">${formatarTextoLeitura(info.conteudo || '(vazio)')}</div>`;
}

function renderTelaCheiaComando(info) {
    const linhas = getLinhasData(info);
    let html = '';
    if (info.sistema || info.tags) {
        html += '<div class="info-leitura-dados">';
        if (info.sistema) html += `<div><strong>Sistema:</strong> ${escapeHtml(info.sistema)}</div>`;
        if (info.tags) html += `<div><strong>Tags:</strong> ${escapeHtml(info.tags)}</div>`;
        html += '</div>';
    }
    html += '<div class="info-leitura-comandos">';
    let num = 0;
    linhas.forEach(item => {
        if (item.grupo !== undefined) {
            html += `<div class="info-leitura-grupo">── ${escapeHtml(item.grupo || 'Grupo')} ──</div>`;
        } else if (item.cmd) {
            num++;
            html += `
                <div class="info-leitura-cmd-linha">
                    <span>${num}</span>
                    <code>${escapeHtml(item.cmd)}</code>
                </div>
            `;
        }
    });
    html += '</div>';
    if (info.observacoes) {
        html += `<div class="info-leitura-bloco"><strong>Observações</strong><div>${formatarTextoLeitura(info.observacoes)}</div></div>`;
    }
    return html;
}

function renderTelaCheiaSite(info) {
    const urls = getUrlsInfo(info);
    let html = '<div class="info-leitura-dados">';
    html += `<div><strong>URL${urls.length > 1 ? 's' : ''}:</strong> ${urls.length ? urls.map(u => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(u)}</a>`).join('<br>') : '-'}</div>`;
    if (info.usuario) html += `<div><strong>Usuário:</strong> ${escapeHtml(info.usuario)}</div>`;
    if (info.senhaOculta) html += `<div><strong>Senha:</strong> ••••••••••</div>`;
    html += '</div>';
    if (info.observacoes) html += `<div class="info-leitura-bloco"><strong>Observações</strong><div>${formatarTextoLeitura(info.observacoes)}</div></div>`;
    return html;
}

function renderTelaCheiaSenha(info) {
    let html = '<div class="info-leitura-dados">';
    if (info.site_servico) html += `<div><strong>Site / Serviço:</strong> ${escapeHtml(info.site_servico)}</div>`;
    html += `<div><strong>Usuário:</strong> ${escapeHtml(info.usuario || '-')}</div>`;
    html += '<div><strong>Senha:</strong> ••••••••••</div>';
    html += '</div>';
    if (info.observacoes) html += `<div class="info-leitura-bloco"><strong>Observações</strong><div>${formatarTextoLeitura(info.observacoes)}</div></div>`;
    return html;
}

function renderTelaCheiaDocumento(info) {
    let html = '<div class="info-leitura-dados">';
    html += `<div><strong>Documento:</strong> ${escapeHtml(info.titulo || '-')}${info.extensao ? '.' + escapeHtml(info.extensao) : ''}</div>`;
    if (info.descricao) html += `<div><strong>Descrição:</strong> ${escapeHtml(info.descricao)}</div>`;
    html += '</div>';
    if (info.storageUrl) {
        html += `<button class="info-card-btn copy info-leitura-download" onclick="downloadDocumento('${info.id}')">📥 Download</button>`;
    }
    return html;
}

function obterTextoCopiavel(info) {
    if (info.tipo === 'comando') {
        return getLinhasData(info).filter(l => l.cmd).map(l => l.cmd).join('\n');
    }
    if (info.tipo === 'site') {
        return getUrlsInfo(info).join('\n');
    }
    if (info.tipo === 'senha') {
        return info.senhaOculta ? descriptografarSenha(info.senhaOculta) : '';
    }
    if (info.tipo === 'documento') {
        return info.descricao || info.titulo || '';
    }
    return info.conteudo || '';
}

function formatarTextoLeitura(texto) {
    const linhas = String(texto || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n');

    let html = '';
    let paragrafo = [];
    let listaAberta = false;

    const flushParagrafo = () => {
        if (!paragrafo.length) return;
        html += `<p>${paragrafo.join('<br>')}</p>`;
        paragrafo = [];
    };

    const fecharLista = () => {
        if (!listaAberta) return;
        html += '</ul>';
        listaAberta = false;
    };

    linhas.forEach(linhaOriginal => {
        const linha = linhaOriginal.trim();

        if (!linha) {
            flushParagrafo();
            fecharLista();
            return;
        }

        const bullet = linha.match(/^([*•✓-])\s+(.+)$/);
        const numerado = linha.match(/^(\d+[.)])\s+(.+)$/);

        if (bullet || numerado) {
            flushParagrafo();
            if (!listaAberta) {
                html += '<ul>';
                listaAberta = true;
            }
            html += `<li>${escapeHtml((bullet?.[2] || numerado?.[2] || '').trim())}</li>`;
            return;
        }

        const ehTitulo = /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9\s:()/-]{4,}$/.test(linha) && linha.length <= 80;
        if (ehTitulo) {
            flushParagrafo();
            fecharLista();
            html += `<h3>${escapeHtml(linha)}</h3>`;
            return;
        }

        fecharLista();
        paragrafo.push(escapeHtml(linha));
    });

    flushParagrafo();
    fecharLista();

    return html || '<p>(vazio)</p>';
}

// ===== AÇÕES POR TIPO =====
async function copiarTitulo(id, tipo) {
    const info = informacoes.find(x => x.id === id);
    if (!info) return;

    let conteudoCopiar = '';

    if (tipo === 'comando') {
        const linhas = getLinhasData(info);
        conteudoCopiar = linhas.filter(l => l.cmd).map(l => l.cmd).join('\n');
    } else if (tipo === 'site') {
        conteudoCopiar = info.url || '';
    } else if (tipo === 'senha') {
        if (info.senhaOculta) {
            try {
                conteudoCopiar = descriptografarSenha(info.senhaOculta);
            } catch (err) {
                toast('❌ Erro ao descriptografar senha');
                return;
            }
        }
    } else if (tipo === 'anotacao') {
        conteudoCopiar = info.conteudo || '';
    } else if (tipo === 'documento') {
        toast('📥 Use o botão Download para arquivos');
        return;
    }

    if (!conteudoCopiar) {
        toast('⚠️ Nenhum conteúdo para copiar');
        return;
    }

    await navigator.clipboard.writeText(conteudoCopiar).catch(() => {
        document.execCommand('copy', false, conteudoCopiar);
    });
    toast('✅ Conteúdo copiado com sucesso.');
}

async function copiarComando(id) {
    const info = informacoes.find(x => x.id === id);
    if (!info) return;
    const linhas = getLinhasData(info);
    const texto = linhas.filter(l => l.cmd).map(l => l.cmd).join('\n');
    if (!texto) return;
    await navigator.clipboard.writeText(texto).catch(() => {
        document.execCommand('copy', false, texto);
    });
    toast('✅ Comandos copiados!');
}

async function duplicarComando(id) {
    const orig = informacoes.find(x => x.id === id);
    if (!orig) return;
    try {
        const agoraISO = new Date().toISOString();
        const novoId = Informacoes.newId();
        const dados = { ...orig, id: novoId, titulo: 'Cópia de ' + orig.titulo, favorito: false, criadoEm: serverTimestamp(), criadoEmISO: agoraISO, atualizadoEm: serverTimestamp(), atualizadoEmISO: agoraISO };
        await Informacoes.set(novoId, dados);
        toast('✅ Comando duplicado!');
        await carregarInformacoes();
    } catch (err) {
        console.error(err);
        toast('❌ Erro ao duplicar.');
    }
}

function abrirNaCentralComandos() {
    window.location.href = '../central-comandos/index.html';
}

// ===== COMANDO: GERENCIADOR DE LINHAS =====

function getLinhasData(info) {
    if (Array.isArray(info.linhas) && info.linhas.length) return info.linhas;
    if (info.conteudo) return [{ cmd: info.conteudo }];
    return [{ cmd: '' }];
}

function setLinhasComando(linhas) {
    const list = document.getElementById('info-cmds-list');
    if (!list) return;
    list.innerHTML = '';
    const items = Array.isArray(linhas) && linhas.length ? linhas : [{ cmd: '' }];
    items.forEach(item => {
        if (item.grupo !== undefined) addGroupRow(item.grupo);
        else addCmdRow(item.cmd || '');
    });
    atualizarCmdsUI();
}

function addCmdRow(value = '') {
    const list = document.getElementById('info-cmds-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'info-cmd-row';
    row.innerHTML = `
        <span class="info-cmd-num"></span>
        <input type="text" class="info-cmd-input" placeholder="Ex: sudo apt update">
        <button type="button" class="info-card-btn copy info-cmd-btn" onclick="copiarLinhaCmd(this)" title="Copiar este comando">📋</button>
        <button type="button" class="info-card-btn delete info-cmd-btn" onclick="removerLinhaComando(this)" title="Remover">🗑️</button>
    `;
    row.querySelector('.info-cmd-input').value = value;
    list.appendChild(row);
    atualizarCmdsUI();
}

function addGroupRow(label = '') {
    const list = document.getElementById('info-cmds-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'info-cmd-group-row';
    row.innerHTML = `
        <span class="info-cmd-group-dash">──</span>
        <input type="text" class="info-cmd-group-input" placeholder="Nome do grupo...">
        <button type="button" class="info-card-btn delete info-cmd-btn" onclick="removerLinhaComando(this)" title="Remover grupo">🗑️</button>
    `;
    row.querySelector('.info-cmd-group-input').value = label;
    list.appendChild(row);
    atualizarCmdsUI();
}

function atualizarCmdsUI() {
    const rows = document.querySelectorAll('#info-cmds-list .info-cmd-row');
    rows.forEach((r, i) => {
        const num = r.querySelector('.info-cmd-num');
        if (num) num.textContent = i + 1;
    });
}

function adicionarLinhaComando() {
    addCmdRow('');
    const inputs = document.querySelectorAll('#info-cmds-list .info-cmd-input');
    inputs[inputs.length - 1]?.focus();
}

function adicionarGrupoComando() {
    addGroupRow('');
    const inputs = document.querySelectorAll('#info-cmds-list .info-cmd-group-input');
    inputs[inputs.length - 1]?.focus();
}

function removerLinhaComando(btn) {
    const cmdRows = document.querySelectorAll('#info-cmds-list .info-cmd-row');
    if (btn.closest('.info-cmd-row') && cmdRows.length <= 1) {
        cmdRows[0].querySelector('.info-cmd-input').value = '';
        return;
    }
    btn.closest('.info-cmd-row, .info-cmd-group-row')?.remove();
    atualizarCmdsUI();
}

async function copiarLinhaCmd(btn) {
    const input = btn.closest('.info-cmd-row')?.querySelector('.info-cmd-input');
    if (!input || !input.value.trim()) return toast('⚠️ Linha vazia.');
    const v = input.value.trim();
    await navigator.clipboard.writeText(v).catch(() => { document.execCommand('copy', false, v); });
    toast('✅ Copiado!');
}

async function copiarLinhaRender(btn) {
    const cmd = btn.dataset.cmd || '';
    if (!cmd) return toast('⚠️ Linha vazia.');
    await navigator.clipboard.writeText(cmd).catch(() => { document.execCommand('copy', false, cmd); });
    toast('✅ Copiado!');
}

function getLinhasComando() {
    const rows = document.querySelectorAll('#info-cmds-list > div');
    return Array.from(rows).map(row => {
        if (row.classList.contains('info-cmd-group-row')) {
            return { grupo: row.querySelector('.info-cmd-group-input')?.value.trim() || '' };
        }
        return { cmd: row.querySelector('.info-cmd-input')?.value.trim() || '' };
    });
}

function renderComandosCompacto(info) {
    const linhas = getLinhasData(info);
    if (!linhas.length || (linhas.length === 1 && !linhas[0].cmd)) {
        return '<span class="info-cmd-empty">Nenhum comando</span>';
    }
    return linhas.map(item => {
        if (item.grupo !== undefined) {
            return `<div class="info-cmds-group-label">── ${escapeHtml(item.grupo || 'Grupo')} ──</div>`;
        }
        if (!item.cmd) return '';
        return `
            <div class="info-cmds-compact-linha">
                <code class="info-cmds-compact-code">${escapeHtml(item.cmd)}</code>
                <button class="info-card-btn copy info-cmds-copy-btn" onclick="copiarLinhaRender(this)" data-cmd="${escapeHtml(item.cmd)}" title="Copiar">📋</button>
            </div>
        `;
    }).join('');
}

async function abrirSite(id) {
    const info = informacoes.find(x => x.id === id);
    if (!info || !info.url) return;
    window.open(info.url, '_blank');
}

async function copiarUsuario(id) {
    const info = informacoes.find(x => x.id === id);
    if (!info || !info.usuario) return;
    await navigator.clipboard.writeText(info.usuario).catch(() => {
        document.execCommand('copy', false, info.usuario);
    });
    toast('✅ Usuário copiado!');
}

async function copiarSenha(id, tipo) {
    const info = informacoes.find(x => x.id === id);
    if (!info || !info.senhaOculta) return;

    try {
        const senhaDescriptografada = descriptografarSenha(info.senhaOculta);
        await navigator.clipboard.writeText(senhaDescriptografada).catch(() => {
            document.execCommand('copy', false, senhaDescriptografada);
        });
        toast('✅ Senha copiada!');
    } catch (err) {
        toast('❌ Erro ao descriptografar senha');
    }
}

async function visualizarSenha(id) {
    const info = informacoes.find(x => x.id === id);
    if (!info || !info.senhaOculta) {
        toast('⚠️ Senha não disponível');
        return;
    }

    try {
        const senhaDescriptografada = descriptografarSenha(info.senhaOculta);
        mostrarPopoverSenha(id, senhaDescriptografada);
    } catch (err) {
        toast('❌ Erro ao descriptografar senha');
    }
}

function mostrarPopoverSenha(id, senha) {
    // Verificar se já existe popover aberto
    const popoverExistente = document.getElementById('info-popover-senha-' + id);
    if (popoverExistente) {
        popoverExistente.remove();
        return;
    }

    // Criar popover
    const popover = document.createElement('div');
    popover.id = 'info-popover-senha-' + id;
    popover.className = 'info-popover-senha';
    popover.innerHTML = `
        <div class="info-popover-header">
            <span>🔐 Senha</span>
            <button class="info-popover-close" onclick="document.getElementById('info-popover-senha-${id}').remove()">✕</button>
        </div>
        <div class="info-popover-content">
            <div class="info-popover-senha-display">
                <code>${escapeHtml(senha)}</code>
            </div>
            <button class="info-popover-btn-copy" onclick="navigator.clipboard.writeText('${escapeBotoes(senha)}'); toast('✅ Copiado!'); document.getElementById('info-popover-senha-${id}').remove();">
                📋 Copiar
            </button>
        </div>
    `;

    document.body.appendChild(popover);
    toast('👁 Senha visível por 10 segundos');

    // Auto-fechar após 10 segundos
    setTimeout(() => {
        const el = document.getElementById('info-popover-senha-' + id);
        if (el) {
            el.remove();
            toast('🔒 Senha ocultada');
        }
    }, 10000);
}

function escapeBotoes(text) {
    return text.replace(/'/g, "\\'");
}

function getUrlsInfo(info) {
    if (!info) return [];
    if (Array.isArray(info.urls) && info.urls.length) return info.urls.filter(Boolean);
    return info.url ? [info.url] : [];
}

async function downloadDocumento(id) {
    const info = informacoes.find(x => x.id === id);
    if (!info || !info.storageUrl) return;

    try {
        toast('📥 Baixando arquivo...');
        const bytes = await getBytes(ref(storage, info.storageUrl));
        const blob = new Blob([bytes]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = info.titulo + '.' + (info.extensao || 'pdf');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('✅ Download concluído!');
    } catch (err) {
        console.error('Download error:', err);
        toast('❌ Erro ao baixar arquivo');
    }
}

// ===== CRIPTOGRAFIA LOCAL =====
function criptografarSenha(plaintext) {
    return CryptoJS.AES.encrypt(plaintext, CRIPTOGRAFIA_KEY).toString();
}

function descriptografarSenha(ciphertext) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, CRIPTOGRAFIA_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
}

// ===== FORMS =====
function abrirFormNovaInfo() {
    document.getElementById('info-modal-tipo').classList.add('active');
}

function fecharFormNovaInfo() {
    document.getElementById('info-modal-tipo').classList.remove('active');
}

function abrirFormSite() {
    fecharFormNovaInfo();
    abrirFormEditarInterno('site', '🌐 Novo Site');
}

function abrirFormSenha() {
    fecharFormNovaInfo();
    abrirFormEditarInterno('senha', '🔐 Nova Senha');
}

function abrirFormAnotacao() {
    fecharFormNovaInfo();
    abrirFormEditarInterno('anotacao', '📌 Nova Anotação');
}

function abrirFormDocumento() {
    fecharFormNovaInfo();
    abrirFormEditarInterno('documento', '📄 Novo Documento');
}

function abrirFormComando() {
    fecharFormNovaInfo();
    abrirFormEditarInterno('comando', '📝 Novo Comando');
}

function abrirFormEditarInterno(tipo, titulo) {
    currentEditType = tipo;
    currentEditFile = null;

    // Limpar campos
    document.getElementById('info-edit-id').value = '';
    document.getElementById('info-edit-tipo').value = tipo;
    document.getElementById('info-modal-titulo').textContent = titulo;
    document.getElementById('info-f-titulo').value = '';
    document.getElementById('info-f-categoria').value = categorias[0];
    document.getElementById('info-f-favorito').checked = false;

    // Limpar campos tipo-específicos
    ['comando', 'site', 'senha', 'anotacao', 'documento'].forEach(t => {
        const el = document.getElementById(`info-form-${t}`);
        if (el) el.style.display = 'none';
    });

    // Mostrar campos do tipo
    const formTipo = document.getElementById(`info-form-${tipo}`);
    if (formTipo) formTipo.style.display = 'block';

    // Limpar campos específicos
    if (tipo === 'comando') {
        setLinhasComando([{ cmd: '' }]);
        document.getElementById('info-f-tags').value = '';
        document.getElementById('info-f-sistema').value = '';
        document.getElementById('info-f-observacoes-cmd').value = '';
    } else if (tipo === 'site') {
        setUrls(['']);
        document.getElementById('info-f-usuario').value = '';
        document.getElementById('info-f-senha-site').value = '';
        document.getElementById('info-f-observacoes-site').value = '';
        resetSiteSections();
    } else if (tipo === 'senha') {
        document.getElementById('info-f-site-servico').value = '';
        document.getElementById('info-f-usuario-senha').value = '';
        document.getElementById('info-f-senha').value = '';
        document.getElementById('info-f-observacoes-senha').value = '';
    } else if (tipo === 'anotacao') {
        document.getElementById('info-f-conteudo-anotacao').value = '';
    } else if (tipo === 'documento') {
        document.getElementById('info-f-arquivo').value = '';
        document.getElementById('info-f-descricao-doc').value = '';
        document.getElementById('info-arquivo-carregado').style.display = 'none';
    }

    document.getElementById('info-modal-editar').classList.add('active');
    setTimeout(() => document.getElementById('info-f-titulo')?.focus(), 100);
}

function fecharFormEditar() {
    document.getElementById('info-modal-editar').classList.remove('active');
}

// ===== SITE: MÚLTIPLAS URLs + SEÇÕES RECOLHÍVEIS =====
function setUrls(urls) {
    const list = document.getElementById('info-urls-list');
    if (!list) return;
    list.innerHTML = '';
    (Array.isArray(urls) && urls.length ? urls : ['']).forEach(u => addUrlRow(u));
    atualizarUrlsUI();
    // A lista de URLs sempre começa expandida
    document.getElementById('info-urls-wrap')?.classList.remove('collapsed');
}

function addUrlRow(value = '') {
    const list = document.getElementById('info-urls-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'info-url-row';
    row.innerHTML = `
        <div class="info-url-label"></div>
        <div class="info-senha-group">
            <input type="url" class="info-f-url-item" placeholder="https://exemplo.com">
            <button type="button" class="info-btn-olho info-url-remove" onclick="removerUrl(this)" title="Remover URL">🗑️</button>
        </div>
    `;
    row.querySelector('.info-f-url-item').value = value || '';
    list.appendChild(row);
    atualizarUrlsUI();
}

function adicionarUrl() {
    document.getElementById('info-urls-wrap')?.classList.remove('collapsed');
    addUrlRow('');
    const inputs = document.querySelectorAll('.info-f-url-item');
    inputs[inputs.length - 1]?.focus();
}

function removerUrl(btn) {
    const rows = document.querySelectorAll('#info-urls-list .info-url-row');
    if (rows.length <= 1) {
        // Mantém ao menos uma linha; apenas limpa o valor
        const input = rows[0]?.querySelector('.info-f-url-item');
        if (input) input.value = '';
        return;
    }
    btn.closest('.info-url-row')?.remove();
    atualizarUrlsUI();
}

function atualizarUrlsUI() {
    const rows = document.querySelectorAll('#info-urls-list .info-url-row');
    rows.forEach((r, i) => {
        const lbl = r.querySelector('.info-url-label');
        if (lbl) lbl.textContent = 'URL ' + (i + 1);
    });
    const count = document.getElementById('info-urls-count');
    if (count) count.textContent = rows.length;
}

function getUrls() {
    return Array.from(document.querySelectorAll('.info-f-url-item'))
        .map(i => i.value.trim())
        .filter(Boolean);
}

function toggleUrlsCollapse() {
    document.getElementById('info-urls-wrap')?.classList.toggle('collapsed');
}

function toggleSiteSection(sec) {
    document.getElementById('info-site-sec-' + sec)?.classList.toggle('collapsed');
}

function resetSiteSections(info) {
    // Por padrão todas recolhidas; ao editar, abre as que já têm conteúdo
    ['usuario', 'senha', 'observacoes'].forEach(sec => {
        document.getElementById('info-site-sec-' + sec)?.classList.add('collapsed');
    });
    if (info) {
        if (info.usuario) document.getElementById('info-site-sec-usuario')?.classList.remove('collapsed');
        if (info.senhaOculta) document.getElementById('info-site-sec-senha')?.classList.remove('collapsed');
        if (info.observacoes) document.getElementById('info-site-sec-observacoes')?.classList.remove('collapsed');
    }
}

function editarInformacao(id) {
    const info = informacoes.find(x => x.id === id);
    if (!info) return;

    currentEditType = info.tipo;
    currentEditFile = null;

    const tipo = info.tipo;
    const titulo = getTituloTipo(tipo);

    // Mostrar form correto
    document.getElementById('info-edit-id').value = id;
    document.getElementById('info-edit-tipo').value = tipo;
    document.getElementById('info-modal-titulo').textContent = `✏️ Editar ${titulo}`;

    ['comando', 'site', 'senha', 'anotacao', 'documento'].forEach(t => {
        const el = document.getElementById(`info-form-${t}`);
        if (el) el.style.display = 'none';
    });
    const formTipo = document.getElementById(`info-form-${tipo}`);
    if (formTipo) formTipo.style.display = 'block';

    // Preencher campos comuns
    document.getElementById('info-f-titulo').value = info.titulo || '';
    document.getElementById('info-f-categoria').value = info.categoria || categorias[0];
    document.getElementById('info-f-favorito').checked = info.favorito === true;

    // Preencher campos tipo-específicos
    if (tipo === 'comando') {
        setLinhasComando(getLinhasData(info));
        document.getElementById('info-f-tags').value = info.tags || '';
        document.getElementById('info-f-sistema').value = info.sistema || '';
        document.getElementById('info-f-observacoes-cmd').value = info.observacoes || '';
    } else if (tipo === 'site') {
        // Compat: registros antigos têm só `url` (string); novos têm `urls` (array).
        const urls = Array.isArray(info.urls) && info.urls.length ? info.urls : (info.url ? [info.url] : ['']);
        setUrls(urls);
        document.getElementById('info-f-usuario').value = info.usuario || '';
        document.getElementById('info-f-senha-site').value = '';
        document.getElementById('info-f-observacoes-site').value = info.observacoes || '';
        resetSiteSections(info);
    } else if (tipo === 'senha') {
        document.getElementById('info-f-site-servico').value = info.site_servico || '';
        document.getElementById('info-f-usuario-senha').value = info.usuario || '';
        document.getElementById('info-f-senha').value = '';
        document.getElementById('info-f-observacoes-senha').value = info.observacoes || '';
    } else if (tipo === 'anotacao') {
        document.getElementById('info-f-conteudo-anotacao').value = info.conteudo || '';
    } else if (tipo === 'documento') {
        document.getElementById('info-f-arquivo').value = '';
        document.getElementById('info-f-descricao-doc').value = info.descricao || '';
        document.getElementById('info-arquivo-carregado').style.display = info.storageUrl ? 'flex' : 'none';
        if (info.storageUrl) {
            document.getElementById('info-arquivo-nome').textContent = info.titulo;
        }
    }

    document.getElementById('info-modal-editar').classList.add('active');
}

async function salvarInformacao() {
    const id = document.getElementById('info-edit-id').value;
    const tipo = currentEditType || document.getElementById('info-edit-tipo').value;
    const titulo = document.getElementById('info-f-titulo').value.trim();
    const categoria = document.getElementById('info-f-categoria').value;
    const favorito = document.getElementById('info-f-favorito').checked;

    if (!titulo) return toast('⚠️ Informe o título.');
    if (!tipo) return toast('⚠️ Tipo inválido.');

    const agoraISO = new Date().toISOString();
    let dados = { titulo, categoria, favorito, atualizadoEm: serverTimestamp(), atualizadoEmISO: agoraISO, tipo };

    // Validar e adicionar campos específicos
    if (tipo === 'comando') {
        const linhas = getLinhasComando();
        const tags = document.getElementById('info-f-tags').value.trim();
        const sistema = document.getElementById('info-f-sistema').value.trim();
        const observacoes = document.getElementById('info-f-observacoes-cmd').value.trim();
        if (!linhas.some(l => l.cmd && l.cmd.trim())) return toast('⚠️ Adicione pelo menos um comando.');
        dados.linhas = linhas;
        dados.tags = tags;
        dados.sistema = sistema;
        dados.observacoes = observacoes;
    } else if (tipo === 'site') {
        const urls = getUrls();
        const usuario = document.getElementById('info-f-usuario').value.trim();
        const senha = document.getElementById('info-f-senha-site').value.trim();
        const observacoes = document.getElementById('info-f-observacoes-site').value.trim();
        if (!urls.length) return toast('⚠️ Informe pelo menos uma URL.');
        // Ao EDITAR, o campo de senha vem em branco por segurança. Se o usuário não
        // redigitar, preservamos a senha já salva (antes era apagada — perda de dados).
        const senhaOrig = (informacoes.find(c => c.id === id) || {}).senhaOculta || '';
        dados.urls = urls;
        dados.url = urls[0]; // compat: registros antigos/cartões usam o campo único `url`
        dados.usuario = usuario || '';
        dados.senhaOculta = senha ? criptografarSenha(senha) : senhaOrig;
        dados.observacoes = observacoes;
    } else if (tipo === 'senha') {
        const siteServico = document.getElementById('info-f-site-servico').value.trim();
        const usuario = document.getElementById('info-f-usuario-senha').value.trim();
        const senha = document.getElementById('info-f-senha').value.trim();
        const observacoes = document.getElementById('info-f-observacoes-senha').value.trim();
        // Na edição, senha em branco = manter a atual (não obriga redigitar a cada edição).
        const senhaOrig = (informacoes.find(c => c.id === id) || {}).senhaOculta || '';
        if (!siteServico || !usuario) return toast('⚠️ Informe site/serviço e usuário.');
        if (!id && !senha) return toast('⚠️ Informe a senha.');
        dados.site_servico = siteServico;
        dados.usuario = usuario;
        dados.senhaOculta = senha ? criptografarSenha(senha) : senhaOrig;
        dados.observacoes = observacoes;
    } else if (tipo === 'anotacao') {
        const conteudo = document.getElementById('info-f-conteudo-anotacao').value.trim();
        if (!conteudo) return toast('⚠️ Informe o conteúdo da anotação.');
        dados.conteudo = conteudo;
    } else if (tipo === 'documento') {
        const arquivo = currentEditFile;
        const descricao = document.getElementById('info-f-descricao-doc').value.trim();

        if (!id && !arquivo) return toast('⚠️ Selecione um arquivo.');

        dados.descricao = descricao;

        if (arquivo) {
            try {
                toast('📤 Enviando arquivo...');
                // BUG corrigido (revisão 07/06/2026): o path era gerado 2x com Date.now(),
                // podendo divergir em ms → storageUrl não batia com o arquivo enviado
                // (download quebrado / arquivo órfão). Agora o path é calculado UMA vez.
                const storagePath = `empresas/${getTenantFieldValue() || 'cellcity-master'}/docs/${Date.now()}_${arquivo.name}`;
                await uploadBytes(ref(storage, storagePath), arquivo);
                dados.storageUrl = storagePath;
                dados.extensao = arquivo.name.split('.').pop();
                toast('✅ Arquivo enviado.');
            } catch (err) {
                console.error('Upload error:', err);
                return toast('❌ Erro ao enviar arquivo.');
            }
        }
    }

    // Salvar
    try {
        if (id) {
            // Editar
            const orig = informacoes.find(c => c.id === id) || {};
            const dadosFinais = { ...orig, ...dados };
            await Informacoes.set(id, dadosFinais, { merge: true });
            toast('✅ Informação atualizada.');
        } else {
            // Novo
            dados.criadoEm = serverTimestamp();
            dados.criadoEmISO = agoraISO;
            const novoId = Informacoes.newId();
            await Informacoes.set(novoId, { ...dados, id: novoId });
            toast('✅ Informação criada.');
        }

        fecharFormEditar();
        await carregarInformacoes();
    } catch (err) {
        console.error('Save error:', err);
        toast('❌ Erro ao salvar.');
    }
}

async function excluirInformacao(id) {
    if (!confirm('Tem certeza que deseja excluir?')) return;

    try {
        const info = informacoes.find(x => x.id === id);

        // Excluir arquivo do Storage se for documento
        if (info && info.tipo === 'documento' && info.storageUrl) {
            try {
                await deleteObject(ref(storage, info.storageUrl));
            } catch (err) {
                console.warn('Erro ao deletar arquivo do Storage:', err);
            }
        }

        await Informacoes.remove(id);
        informacoes = informacoes.filter(x => x.id !== id);
        localStorage.setItem(CACHE_KEY, JSON.stringify(informacoes));
        render();
        toast('✅ Informação excluída.');
    } catch (err) {
        console.error('Delete error:', err);
        toast('❌ Erro ao excluir.');
    }
}

async function toggleFavorito(id) {
    const info = informacoes.find(x => x.id === id);
    if (!info) return;
    info.favorito = !info.favorito;
    render();
    try {
        await Informacoes.set(id, { ...info, atualizadoEm: serverTimestamp() }, { merge: true });
        localStorage.setItem(CACHE_KEY, JSON.stringify(informacoes));
    } catch {
        localStorage.setItem(CACHE_KEY, JSON.stringify(informacoes));
    }
}

// ===== CATEGORIAS =====
function abrirFormCategoria() {
    document.getElementById('info-f-cat-nome').value = '';
    document.getElementById('info-modal-cat').classList.add('active');
    setTimeout(() => document.getElementById('info-f-cat-nome')?.focus(), 100);
}

function fecharFormCategoria() {
    document.getElementById('info-modal-cat').classList.remove('active');
}

async function salvarCategoria() {
    const nome = document.getElementById('info-f-cat-nome').value.trim();
    if (!nome) return toast('⚠️ Informe o nome da categoria.');
    if (categorias.includes(nome)) return toast('⚠️ Esta categoria já existe.');

    const agoraISO = new Date().toISOString();
    const novoId = CategoriasInformacoes.newId();
    const dados = { id: novoId, nome, criadoEm: serverTimestamp(), criadoEmISO: agoraISO };

    try {
        await CategoriasInformacoes.set(novoId, dados);
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

// ===== ARQUIVO =====
function limparArquivo() {
    document.getElementById('info-f-arquivo').value = '';
    document.getElementById('info-arquivo-carregado').style.display = 'none';
    currentEditFile = null;
}

document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('info-f-arquivo');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const arquivo = e.target.files[0];
            if (arquivo) {
                if (arquivo.size > 5 * 1024 * 1024) {
                    toast('⚠️ Arquivo muito grande (máx 5MB)');
                    e.target.value = '';
                    return;
                }
                currentEditFile = arquivo;
                document.getElementById('info-arquivo-carregado').style.display = 'flex';
                document.getElementById('info-arquivo-nome').textContent = arquivo.name;
            }
        });
    }
});

function toggleSenhaVisibility(fieldId, btn) {
    const field = document.getElementById(fieldId);
    if (field.type === 'password') {
        field.type = 'text';
        btn.textContent = '🙈';
    } else {
        field.type = 'password';
        btn.textContent = '👁️';
    }
}

// ===== TOAST =====
function toast(msg) {
    const el = document.getElementById('info-toast');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.classList.remove('success', 'error', 'warning');
    if (msg.includes('✅')) el.classList.add('success');
    else if (msg.includes('❌')) el.classList.add('error');
    else if (msg.includes('⚠️')) el.classList.add('warning');

    setTimeout(() => {
        el.style.display = 'none';
    }, 2500);
}

// ===== INIT =====
init();
