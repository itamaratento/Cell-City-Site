import { db, collection, getDocs, query, orderBy, limit } from '../../scripts/firebase.js';

const AUTOMACOES = [
    { id: 'entrada_os',      icon: '📱', nome: 'Entrada de O.S.' },
    { id: 'pronto_retirada', icon: '📦', nome: 'Pronto para Retirada' },
    { id: 'posvenda_7d',     icon: '💬', nome: 'Pós-venda 7 Dias' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

function nomeAuto(id) {
    return AUTOMACOES.find(a => a.id === id)?.nome || id;
}

function badge(status) {
    const map = {
        executado: '<span class="badge badge-ok">executado</span>',
        ignorado:  '<span class="badge badge-ign">ignorado</span>',
        erro:      '<span class="badge badge-err">erro</span>',
        error:     '<span class="badge badge-err">erro</span>',
    };
    return map[status] ?? `<span class="badge">${status}</span>`;
}

// ── Carregamento de dados ─────────────────────────────────────────────────────

async function carregarDados() {
    // Busca os últimos 200 logs — suficiente para stats, últimas 20 e erros
    const snap = await getDocs(
        query(collection(db, 'automacao_logs'), orderBy('executadoEm', 'desc'), limit(200))
    );
    const logs = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));

    renderCards(logs);
    renderStats(logs);
    renderExecucoes(logs.slice(0, 20));
    renderErros(logs.filter(l => l.status === 'erro' || l.status === 'error'));
}

// ── Renderizações ─────────────────────────────────────────────────────────────

function renderCards(logs) {
    for (const auto of AUTOMACOES) {
        const count = logs.filter(l => l.automationId === auto.id && l.status === 'executado').length;
        const el = document.getElementById(`count-${auto.id}`);
        if (el) el.textContent = count;
    }
}

function renderStats(logs) {
    let total = 0;
    for (const auto of AUTOMACOES) {
        const count = logs.filter(l => l.automationId === auto.id && l.status === 'executado').length;
        total += count;
        const el = document.getElementById(`stat-${auto.id}`);
        if (el) el.textContent = count;
    }
    const elTotal = document.getElementById('stat-total');
    if (elTotal) elTotal.textContent = total;
}

function renderExecucoes(logs) {
    const el = document.getElementById('list-execucoes');
    if (!logs.length) {
        el.innerHTML = '<div class="empty">Nenhum registro encontrado.</div>';
        return;
    }
    el.innerHTML = `
        <table class="log-table">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>O.S.</th>
                    <th>Cliente</th>
                    <th>Automação</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${logs.map(l => `
                <tr>
                    <td>${formatTs(l.executadoEm)}</td>
                    <td class="mono">${l.osId || '—'}</td>
                    <td>${l.cliente || '—'}</td>
                    <td>${nomeAuto(l.automationId)}</td>
                    <td>${badge(l.status)}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
}

function renderErros(erros) {
    const el = document.getElementById('list-erros');
    if (!erros.length) {
        el.innerHTML = '<div class="empty">✅ Nenhum erro registrado.</div>';
        return;
    }
    el.innerHTML = `
        <table class="log-table">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>O.S.</th>
                    <th>Automação</th>
                    <th>Mensagem de erro</th>
                </tr>
            </thead>
            <tbody>
                ${erros.map(l => `
                <tr>
                    <td>${formatTs(l.executadoEm)}</td>
                    <td class="mono">${l.osId || '—'}</td>
                    <td>${nomeAuto(l.automationId)}</td>
                    <td class="err-msg">${l.erro || '—'}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
});

// ── API pública (usada pelo botão Atualizar no HTML) ──────────────────────────

window.Portal = {
    recarregar() {
        document.getElementById('list-execucoes').innerHTML = '<div class="loading">Carregando...</div>';
        document.getElementById('list-erros').innerHTML     = '<div class="loading">Carregando...</div>';
        carregarDados().catch(e => console.error('[Portal Automação]', e));
    }
};

// ── Init ──────────────────────────────────────────────────────────────────────

carregarDados().catch(e => console.error('[Portal Automação]', e));
