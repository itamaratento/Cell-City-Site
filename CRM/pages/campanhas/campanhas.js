import { initModulo } from '../../scripts/kernel.js';
import { carregarPermissoes, podeVisualizar } from '../../shared/permissoes.js';
import { ClientesRepository as Clientes } from '../../repositories/clientes.repository.js';

const COL_CLIENTES = 'clientes';
const DIAS_INATIVO = 90;

let todosClientes = [];
let mesFiltro = new Date().getMonth(); // 0-11
let modalClienteId = null;

// ── toast ──────────────────────────────────────────────────────────
const toastEl = document.getElementById('camp-toast');
let toastTimer;
function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), 2500);
}

// ── tabs ───────────────────────────────────────────────────────────
document.querySelectorAll('.camp-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.camp-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.camp-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'inativos')  renderInativos();
        if (btn.dataset.tab === 'clientes')  renderListaClientes(todosClientes);
    });
});

// ── carregar clientes ──────────────────────────────────────────────
async function carregar() {
    try {
        todosClientes = await Clientes.list();
        todosClientes.sort((a, b) => (a.name || a.nome || '').localeCompare(b.name || b.nome || '', 'pt-BR'));
    } catch { todosClientes = []; }

    document.getElementById('aniv-loading').style.display = 'none';
    document.getElementById('clientes-loading').style.display = 'none';
    renderAniversariantes();
    renderListaClientes(todosClientes);
}

// ── ANIVERSARIANTES ────────────────────────────────────────────────
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function atualizarMesLabel() {
    document.getElementById('mes-label').textContent = MESES[mesFiltro];
}

function renderAniversariantes() {
    atualizarMesLabel();
    const listaEl = document.getElementById('aniv-lista');
    const emptyEl = document.getElementById('aniv-empty');

    const hoje = new Date();
    const hojeMMDD = `${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

    const anivMes = todosClientes.filter(c => {
        const nasc = c.dataNascimento || c.birthday || '';
        if (!nasc) return false;
        const parts = nasc.split('-');
        if (parts.length < 2) return false;
        return Number(parts[1]) - 1 === mesFiltro;
    }).map(c => {
        const nasc = c.dataNascimento || c.birthday || '';
        const parts = nasc.split('-');
        const dia = parts[2] ? Number(parts[2]) : 0;
        return { ...c, diaAniv: dia };
    }).sort((a, b) => a.diaAniv - b.diaAniv);

    if (!anivMes.length) {
        listaEl.innerHTML = '';
        emptyEl.style.display = 'flex';
        return;
    }
    emptyEl.style.display = 'none';

    listaEl.innerHTML = anivMes.map(c => {
        const mmdd = `${String(mesFiltro+1).padStart(2,'0')}-${String(c.diaAniv).padStart(2,'0')}`;
        const isHoje = mmdd === hojeMMDD;
        const nome = c.name || c.nome || 'Sem nome';
        const fone = c.phone || c.telefone || '';
        const ult  = c.ultimaMensagemEm ? formatarData(c.ultimaMensagemEm) : '—';
        return `
        <div class="camp-card${isHoje ? ' camp-card-hoje' : ''}">
            <div class="camp-card-info">
                <div class="camp-card-nome">${isHoje ? '🎉 ' : ''}${escHtml(nome)}</div>
                <div class="camp-card-sub">
                    🎂 ${c.diaAniv} de ${MESES[mesFiltro]}
                    ${fone ? ` · 📞 ${escHtml(fone)}` : ''}
                </div>
                <div class="camp-card-sub">Última msg: ${ult}</div>
            </div>
            <div class="camp-card-acoes">
                ${fone ? `<a href="https://wa.me/55${fone.replace(/\D/g,'')}" target="_blank" class="camp-btn-wpp" title="WhatsApp">💬</a>` : ''}
                <button class="camp-btn-editar" data-id="${c.id}" title="Editar dados">✏️</button>
                <button class="camp-btn-msg" data-id="${c.id}" title="Marcar mensagem enviada hoje">✅</button>
            </div>
        </div>`;
    }).join('');

    bindCardEvents(listaEl);
}

// ── INATIVOS ───────────────────────────────────────────────────────
function renderInativos() {
    document.getElementById('inativos-loading').style.display = 'flex';
    const limite = new Date();
    limite.setDate(limite.getDate() - DIAS_INATIVO);

    const inativos = todosClientes.filter(c => {
        const ult = c.ultimaMensagemEm;
        if (!ult) return true;
        return new Date(ult) < limite;
    });

    document.getElementById('inativos-loading').style.display = 'none';
    const listaEl = document.getElementById('inativos-lista');
    const emptyEl = document.getElementById('inativos-empty');

    if (!inativos.length) {
        listaEl.innerHTML = '';
        emptyEl.style.display = 'flex';
        return;
    }
    emptyEl.style.display = 'none';

    listaEl.innerHTML = inativos.map(c => {
        const nome = c.name || c.nome || 'Sem nome';
        const fone = c.phone || c.telefone || '';
        const ult  = c.ultimaMensagemEm ? formatarData(c.ultimaMensagemEm) : 'Nunca';
        const diasAtras = c.ultimaMensagemEm
            ? Math.floor((Date.now() - new Date(c.ultimaMensagemEm)) / 86400000)
            : null;
        const tag = diasAtras !== null ? `${diasAtras} dias atrás` : 'Nunca contactado';
        return `
        <div class="camp-card">
            <div class="camp-card-info">
                <div class="camp-card-nome">${escHtml(nome)}</div>
                <div class="camp-card-sub">📅 Última mensagem: ${ult} · <span class="camp-inativo-tag">${tag}</span></div>
                ${fone ? `<div class="camp-card-fone">📞 ${escHtml(fone)}</div>` : ''}
            </div>
            <div class="camp-card-acoes">
                ${fone ? `<a href="https://wa.me/55${fone.replace(/\D/g,'')}" target="_blank" class="camp-btn-wpp" title="WhatsApp">💬</a>` : ''}
                <button class="camp-btn-msg" data-id="${c.id}" title="Marcar mensagem enviada hoje">✅</button>
            </div>
        </div>`;
    }).join('');

    bindCardEvents(listaEl);
}

// ── LISTA DE CLIENTES ──────────────────────────────────────────────
function renderListaClientes(lista) {
    const listaEl = document.getElementById('clientes-lista');
    const emptyEl = document.getElementById('clientes-empty');
    if (!lista.length) { listaEl.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
    emptyEl.style.display = 'none';

    listaEl.innerHTML = lista.map(c => {
        const nome = c.name || c.nome || 'Sem nome';
        const fone = c.phone || c.telefone || '';
        const nasc = c.dataNascimento
            ? `🎂 ${formatarData(c.dataNascimento)}`
            : '<span style="color:#6b7280">Sem aniversário</span>';
        const ult = c.ultimaMensagemEm
            ? `✉️ ${formatarData(c.ultimaMensagemEm)}`
            : '<span style="color:#6b7280">Nunca contatado</span>';
        return `
        <div class="camp-card">
            <div class="camp-card-info">
                <div class="camp-card-nome">${escHtml(nome)}</div>
                <div class="camp-card-sub">${nasc} · ${ult}</div>
                ${fone ? `<div class="camp-card-fone">📞 ${escHtml(fone)}</div>` : ''}
            </div>
            <div class="camp-card-acoes">
                <button class="camp-btn-editar" data-id="${c.id}" title="Editar aniversário">✏️</button>
            </div>
        </div>`;
    }).join('');

    bindCardEvents(listaEl);
}

// ── bind eventos ───────────────────────────────────────────────────
function bindCardEvents(container) {
    container.querySelectorAll('.camp-btn-editar').forEach(btn => {
        btn.addEventListener('click', () => abrirModal(btn.dataset.id));
    });
    container.querySelectorAll('.camp-btn-msg').forEach(btn => {
        btn.addEventListener('click', () => marcarMensagem(btn.dataset.id));
    });
}

// ── marcar mensagem ────────────────────────────────────────────────
async function marcarMensagem(clienteId) {
    const hoje = new Date().toISOString().slice(0, 10);
    const c = todosClientes.find(x => x.id === clienteId);
    if (!c) return;
    try {
        await Clientes.set(clienteId, { ...c, ultimaMensagemEm: hoje });
        c.ultimaMensagemEm = hoje;
        toast('✅ Mensagem marcada como enviada hoje!');
        renderAniversariantes();
        renderInativos();
        renderListaClientes(todosClientes);
    } catch { toast('⚠ Erro ao salvar.'); }
}

// ── MODAL ──────────────────────────────────────────────────────────
function abrirModal(clienteId) {
    const c = todosClientes.find(x => x.id === clienteId);
    if (!c) return;
    modalClienteId = clienteId;
    document.getElementById('camp-modal-titulo').textContent = c.name || c.nome || 'Cliente';
    document.getElementById('camp-modal-sub').textContent    = c.phone || c.telefone || '';
    document.getElementById('modal-nasc').value       = c.dataNascimento || '';
    document.getElementById('modal-ultima-msg').value = c.ultimaMensagemEm || '';
    document.getElementById('camp-modal-overlay').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('camp-modal-overlay').style.display = 'none';
    modalClienteId = null;
}

async function salvarModal() {
    const c = todosClientes.find(x => x.id === modalClienteId);
    if (!c) return;
    const nasc     = document.getElementById('modal-nasc').value || null;
    const ultimaMsg = document.getElementById('modal-ultima-msg').value || null;
    try {
        const atualizado = { ...c, dataNascimento: nasc, ultimaMensagemEm: ultimaMsg };
        await Clientes.set(modalClienteId, atualizado);
        const idx = todosClientes.findIndex(x => x.id === modalClienteId);
        if (idx !== -1) todosClientes[idx] = atualizado;
        fecharModal();
        toast('✅ Cliente atualizado!');
        renderAniversariantes();
        renderListaClientes(todosClientes);
    } catch { toast('⚠ Erro ao salvar.'); }
}

// ── busca ──────────────────────────────────────────────────────────
document.getElementById('camp-search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) { renderListaClientes(todosClientes); return; }
    renderListaClientes(todosClientes.filter(c =>
        (c.name || c.nome || '').toLowerCase().includes(q) ||
        (c.phone || c.telefone || '').includes(q)
    ));
});

// ── navegação de mês ───────────────────────────────────────────────
document.getElementById('mes-prev').addEventListener('click', () => {
    mesFiltro = (mesFiltro + 11) % 12;
    renderAniversariantes();
});
document.getElementById('mes-next').addEventListener('click', () => {
    mesFiltro = (mesFiltro + 1) % 12;
    renderAniversariantes();
});

// ── modal eventos ──────────────────────────────────────────────────
document.getElementById('modal-salvar').addEventListener('click', salvarModal);
document.getElementById('modal-cancelar').addEventListener('click', fecharModal);
document.getElementById('camp-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) fecharModal();
});

// ── utilitários ────────────────────────────────────────────────────
function formatarData(iso) {
    if (!iso) return '—';
    try {
        const [y, m, d] = iso.slice(0, 10).split('-');
        return `${d}/${m}/${y}`;
    } catch { return iso; }
}

function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', async () => {
    const ctx = await initModulo();
    if (!ctx) return;
    await carregarPermissoes(ctx);
    if (!podeVisualizar('campanhas')) { window.location.href = '/CRM/pages/dashboard/index.html'; return; }
    carregar();
});
