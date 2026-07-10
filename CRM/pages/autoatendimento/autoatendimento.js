// ============================================
// AUTOATENDIMENTO — Cell City CRM
// ============================================
import { initModulo } from '../../scripts/kernel.js';
import { carregarPermissoes, podeVisualizar } from '../../shared/permissoes.js';
import { PreOSRepository as PreOS } from '../../repositories/os.repository.js';

const COL = 'pre_os';
const CACHE_KEY = 'cc_preos_cache';

// ===== STATE =====
let preOSList = [];
let statusFiltro = 'AGUARDANDO_CONVERSAO';
let termoBusca = '';
let preOSEmFoco = null;
let listenerPreOS = null;

// ===== EXPOSIÇÃO GLOBAL =====
window.filtrarPreOS = filtrarPreOS;
window.filtrarPorStatus = filtrarPorStatus;
window.abrirModalAutoatendimento = abrirModalAutoatendimento;
window.fecharModalAutoatendimento = fecharModalAutoatendimento;
window.converterEmOS = converterEmOS;

// ===== INIT =====
async function init() {
    const ctx = await initModulo();
    if (!ctx) return;
    await carregarPermissoes(ctx);
    if (!podeVisualizar('autoatendimento')) { window.location.href = (location.pathname==='/dev'||location.pathname.startsWith('/dev/')?'/dev':'') + '/CRM/pages/dashboard/index.html'; return; }
    carregarPreOS();
    setupListenerRealtime();
    document.getElementById('auto-modal')?.addEventListener('click', e => {
        if (e.target.id === 'auto-modal') fecharModalAutoatendimento();
    });
}

// ===== CARREGAR PRÉ-OS =====
async function carregarPreOS() {
    try {
        const lista = await PreOS.list({ orderByField: 'criadoEm', direction: 'desc' });
        preOSList = lista.map(d => ({ ...d, id: d.id }));
        localStorage.setItem(CACHE_KEY, JSON.stringify(preOSList));
    } catch {
        preOSList = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    }
    render();
}

// ===== LISTENER REALTIME =====
function setupListenerRealtime() {
    try {
        if (listenerPreOS) listenerPreOS(); // cancela listener anterior
        listenerPreOS = PreOS.onChange(lista => {
            preOSList = lista.map(d => ({ ...d, id: d.id }));
            localStorage.setItem(CACHE_KEY, JSON.stringify(preOSList));
            render();
        }, { orderByField: 'criadoEm', direction: 'desc' });
    } catch (e) {
        console.warn('Listener realtime:', e);
    }
}

// ===== FILTROS =====
function filtrarPorStatus(status) {
    statusFiltro = status;
    render();
    // Update filter buttons
    document.querySelectorAll('.auto-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        const btnText = btn.textContent.trim();
        const isActive =
            (statusFiltro === 'AGUARDANDO_CONVERSAO' && btnText === 'Aguardando') ||
            (statusFiltro === 'CONVERTIDA' && btnText === 'Convertidas') ||
            (statusFiltro === 'TODAS' && btnText === 'Todas');
        if (isActive) btn.classList.add('active');
    });
}

function filtrarPreOS() {
    termoBusca = (document.getElementById('auto-busca')?.value || '').toLowerCase().trim();
    render();
}

// ===== RENDER =====
function render() {
    const lista = document.getElementById('auto-lista');
    if (!lista) return;

    let filtrados = preOSList.slice();

    // Filtro de status
    if (statusFiltro !== 'TODAS') {
        filtrados = filtrados.filter(p => p.status === statusFiltro);
    }

    // Filtro de busca
    if (termoBusca) {
        filtrados = filtrados.filter(p =>
            (p.cliente?.nome || '').toLowerCase().includes(termoBusca) ||
            (p.cliente?.whatsapp || '').toLowerCase().includes(termoBusca)
        );
    }

    // Contadores
    const pendentes = preOSList.filter(p => p.status === 'AGUARDANDO_CONVERSAO').length;
    const convertidas = preOSList.filter(p => p.status === 'CONVERTIDA').length;
    const elPendentes = document.getElementById('auto-contador-pendentes');
    const elConvertidas = document.getElementById('auto-contador-convertidas');
    if (elPendentes) elPendentes.textContent = pendentes;
    if (elConvertidas) elConvertidas.textContent = convertidas;

    // Render lista
    if (!filtrados.length) {
        lista.innerHTML = `<div class="auto-empty"><div class="auto-empty-icon">📝</div><p>${
            preOSList.length ? 'Nenhuma pré-OS encontrada para esse filtro.' : 'Nenhuma solicitação de Autoatendimento ainda.'
        }</p></div>`;
        return;
    }

    lista.innerHTML = filtrados.map(renderCard).join('');
}

function renderCard(p) {
    const statusClass = p.status === 'AGUARDANDO_CONVERSAO' ? 'aguardando' : 'convertida';
    const statusLabel = p.status === 'AGUARDANDO_CONVERSAO' ? '⏳ Aguardando' : '✅ Convertida';
    const data = formatarData(p.criadoEmISO || new Date().toISOString());

    return `
    <div class="auto-card" onclick="abrirModalAutoatendimento('${p.id}')">
        <div class="auto-card-header">
            <div class="auto-card-nome">${esc(p.cliente?.nome || '—')}</div>
            <span class="auto-card-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="auto-card-info">
            <div class="auto-card-info-item">
                <div class="auto-card-info-label">📱 Telefone</div>
                <div class="auto-card-info-value">${esc(p.cliente?.whatsapp || '—')}</div>
            </div>
            <div class="auto-card-info-item">
                <div class="auto-card-info-label">📱 Aparelho</div>
                <div class="auto-card-info-value">${esc(p.aparelho?.marca || '')} ${esc(p.aparelho?.modelo || '')}</div>
            </div>
        </div>
        <div class="auto-card-problema">
            <strong>⚠️ Problema:</strong> ${esc((p.problema || '').substring(0, 100))}${(p.problema || '').length > 100 ? '...' : ''}
        </div>
        <div class="auto-card-footer">
            <span class="auto-card-data">📅 ${data}</span>
            <div class="auto-card-acoes">
                <button class="auto-acao" onclick="event.stopPropagation();abrirModalAutoatendimento('${p.id}')" title="Ver detalhes">👁️</button>
            </div>
        </div>
    </div>`;
}

// ===== MODAL =====
function abrirModalAutoatendimento(id) {
    const p = preOSList.find(x => x.id === id);
    if (!p) return;

    preOSEmFoco = p;
    const modalBody = document.getElementById('auto-modal-body');
    const btnConverter = document.getElementById('auto-btn-converter');

    const html = `
        <div class="auto-modal-field">
            <div class="auto-modal-label">👤 Nome</div>
            <div class="auto-modal-value">${esc(p.cliente?.nome || '—')}</div>
        </div>
        <div class="auto-modal-field">
            <div class="auto-modal-label">📱 WhatsApp</div>
            <div class="auto-modal-value">${esc(p.cliente?.whatsapp || '—')}</div>
        </div>
        ${p.cliente?.cpf ? `<div class="auto-modal-field">
            <div class="auto-modal-label">🆔 CPF</div>
            <div class="auto-modal-value">${esc(p.cliente.cpf)}</div>
        </div>` : ''}
        <div class="auto-modal-field">
            <div class="auto-modal-label">📱 Marca</div>
            <div class="auto-modal-value">${esc(p.aparelho?.marca || '—')}</div>
        </div>
        <div class="auto-modal-field">
            <div class="auto-modal-label">📱 Modelo</div>
            <div class="auto-modal-value">${esc(p.aparelho?.modelo || '—')}</div>
        </div>
        <div class="auto-modal-field">
            <div class="auto-modal-label">⚠️ Problema Relatado</div>
            <div class="auto-modal-value">${esc(p.problema || '—')}</div>
        </div>
        ${p.estado_aparelho && p.estado_aparelho.length > 0 ? `<div class="auto-modal-field">
            <div class="auto-modal-label">🔍 Estado do Aparelho</div>
            <div class="auto-modal-value">${traduzirEstado(p.estado_aparelho)}</div>
        </div>` : ''}
        ${p.acessorios && p.acessorios.length > 0 ? `<div class="auto-modal-field">
            <div class="auto-modal-label">📦 Acessórios</div>
            <div class="auto-modal-value">${traduzirAcessorios(p.acessorios)}</div>
        </div>` : ''}
        ${p.origem_cliente ? `<div class="auto-modal-field">
            <div class="auto-modal-label">🌐 Como nos conheceu</div>
            <div class="auto-modal-value">${traduzirOrigem(p.origem_cliente)}</div>
        </div>` : ''}
        ${p.senha ? `<div class="auto-modal-field">
            <div class="auto-modal-label">🔒 Senha</div>
            <div class="auto-modal-value">${esc(p.senha)}</div>
        </div>` : ''}
        ${p.imei ? `<div class="auto-modal-field">
            <div class="auto-modal-label">📟 IMEI</div>
            <div class="auto-modal-value">${esc(p.imei)}</div>
        </div>` : ''}
        ${p.observacoes ? `<div class="auto-modal-field">
            <div class="auto-modal-label">📝 Observações</div>
            <div class="auto-modal-value">${esc(p.observacoes)}</div>
        </div>` : ''}
        <div class="auto-modal-field">
            <div class="auto-modal-label">📅 Recebido em</div>
            <div class="auto-modal-value">${formatarDataCompleta(p.criadoEmISO || new Date().toISOString())}</div>
        </div>
        <div class="auto-modal-field">
            <div class="auto-modal-label">📌 Status</div>
            <div class="auto-modal-value">${p.status === 'AGUARDANDO_CONVERSAO' ? '⏳ Aguardando Conversão' : '✅ Convertida'}</div>
        </div>
        ${p.osId ? `<div class="auto-modal-field">
            <div class="auto-modal-label">🔗 OS Associada</div>
            <div class="auto-modal-value">${esc(p.osId)}</div>
        </div>` : ''}
    `;

    if (modalBody) modalBody.innerHTML = html;
    if (btnConverter) {
        btnConverter.style.display = p.status === 'AGUARDANDO_CONVERSAO' ? 'block' : 'none';
    }

    const modal = document.getElementById('auto-modal');
    if (modal) modal.classList.add('active');
}

function fecharModalAutoatendimento() {
    const modal = document.getElementById('auto-modal');
    if (modal) modal.classList.remove('active');
    preOSEmFoco = null;
}

// ===== CONVERSÃO PARA OS =====
async function converterEmOS() {
    if (!preOSEmFoco) {
        console.warn('[Conversão] Nenhuma Pré-OS em foco.');
        return;
    }

    // Preparar dados para a página de OS pré-preencher
    const dadosOS = {
        clienteNome: preOSEmFoco.cliente?.nome || '',
        clienteWhatsapp: preOSEmFoco.cliente?.whatsapp || '',
        clienteCPF: preOSEmFoco.cliente?.cpf || '',
        aparelhoMarca: preOSEmFoco.aparelho?.marca || '',
        aparelhoModelo: preOSEmFoco.aparelho?.modelo || '',
        defeito: preOSEmFoco.problema || '',
        senha: preOSEmFoco.password || '',
        lockType: preOSEmFoco.lockType || '',
        patternSequence: preOSEmFoco.patternSequence || null,
        observacoes: preOSEmFoco.observacoes || '',
        origem: 'Autoatendimento',
        preOSId: preOSEmFoco.id
    };

    console.log('🚀 [Conversão] Pré-OS', preOSEmFoco.id, '→ abrindo formulário de OS pré-preenchido:', dadosOS);

    // Armazenar em sessionStorage para a página de OS ler ao carregar.
    // A Pré-OS só é marcada como CONVERTIDA quando a OS for de fato salva (na página de OS).
    sessionStorage.setItem('cc_dados_preos', JSON.stringify(dadosOS));

    window.location.href = '../os/index.html';
}

// ===== TRADUÇÃO =====
function traduzirEstado(array) {
    const mapa = {
        'tela_quebrada': 'Tela quebrada',
        'tampa_quebrada': 'Tampa quebrada',
        'marcas_uso': 'Marcas de uso',
        'amassados': 'Amassados',
        'arranhoes': 'Arranhões',
        'nao_liga': 'Aparelho não liga',
        'foi_aberto': 'Já foi aberto',
        'sem_riscos': 'Sem riscos aparentes',
        'outros': 'Outros'
    };
    return array.map(e => mapa[e] || e).join(', ');
}

function traduzirAcessorios(array) {
    const mapa = {
        'capa': 'Capa',
        'pelicula': 'Película',
        'chip': 'Chip',
        'cartao': 'Cartão de Memória',
        'carregador': 'Carregador',
        'caixa': 'Caixa',
        'outros': 'Outros'
    };
    return array.map(e => mapa[e] || e).join(', ');
}

function traduzirOrigem(valor) {
    const mapa = {
        'google': 'Google',
        'instagram': 'Instagram',
        'whatsapp': 'WhatsApp',
        'indicacao': 'Indicação',
        'cliente_antigo': 'Cliente Antigo',
        'outro': 'Outro'
    };
    return mapa[valor] || valor;
}

// ===== UTILS =====
function formatarData(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatarDataCompleta(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===== INICIALIZAR =====
init();
