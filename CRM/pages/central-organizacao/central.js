import { db, doc, getDoc, setDoc, serverTimestamp } from '../../scripts/firebase.js';

// ── Estrutura por seção ──────────────────────────────────────────────────────
// Cada seção é um documento em `central_organizacao/{secao}` com campo `itens: []`
// IDs dos documentos: 'whatsapp' | 'robos' | 'programas' | 'historico' | 'links'

const SECAO_DOC = 'central_organizacao';

// Configuração de cada seção: campos do formulário e como renderizar o card
const SECOES = {
    whatsapp: {
        campos: ['wpp-nome', 'wpp-numero', 'wpp-obs'],
        montar: (campos) => ({
            nome:   campos['wpp-nome'],
            numero: campos['wpp-numero'].replace(/\D/g, ''),
            obs:    campos['wpp-obs'],
        }),
        validar: (d) => d.nome && d.numero,
        erroValidacao: 'Preencha nome e número.',
        renderItem: (item, idx) => `
            <div class="item-card">
                <div class="item-body">
                    <div class="item-name">${esc(item.nome)}</div>
                    <div class="item-sub">📞 ${esc(item.numero)}</div>
                    ${item.obs ? `<div class="item-obs">${esc(item.obs)}</div>` : ''}
                </div>
                <button class="btn-delete" onclick="Central.remover('whatsapp', ${idx})" title="Remover">🗑</button>
            </div>`,
    },
    robos: {
        campos: ['robos-nome', 'robos-funcao', 'robos-obs'],
        montar: (campos) => ({
            nome:   campos['robos-nome'],
            funcao: campos['robos-funcao'],
            obs:    campos['robos-obs'],
        }),
        validar: (d) => d.nome,
        erroValidacao: 'Preencha o nome.',
        renderItem: (item, idx) => `
            <div class="item-card">
                <div class="item-body">
                    <div class="item-name">${esc(item.nome)}</div>
                    ${item.funcao ? `<div class="item-sub">🔧 ${esc(item.funcao)}</div>` : ''}
                    ${item.obs ? `<div class="item-obs">${esc(item.obs)}</div>` : ''}
                </div>
                <button class="btn-delete" onclick="Central.remover('robos', ${idx})" title="Remover">🗑</button>
            </div>`,
    },
    programas: {
        campos: ['programas-nome', 'programas-link', 'programas-obs'],
        montar: (campos) => ({
            nome: campos['programas-nome'],
            link: campos['programas-link'],
            obs:  campos['programas-obs'],
        }),
        validar: (d) => d.nome,
        erroValidacao: 'Preencha o nome.',
        renderItem: (item, idx) => `
            <div class="item-card">
                <div class="item-body">
                    <div class="item-name">${esc(item.nome)}</div>
                    ${item.link ? `<div class="item-sub"><a class="item-link" href="${esc(item.link)}" target="_blank" rel="noopener">${esc(item.link)}</a></div>` : ''}
                    ${item.obs ? `<div class="item-obs">${esc(item.obs)}</div>` : ''}
                </div>
                <button class="btn-delete" onclick="Central.remover('programas', ${idx})" title="Remover">🗑</button>
            </div>`,
    },
    historico: {
        campos: ['historico-data', 'historico-descricao', 'historico-responsavel'],
        montar: (campos) => ({
            data:         campos['historico-data'] || new Date().toISOString().slice(0, 10),
            descricao:    campos['historico-descricao'],
            responsavel:  campos['historico-responsavel'],
        }),
        validar: (d) => d.descricao,
        erroValidacao: 'Preencha a descrição.',
        renderItem: (item, idx) => `
            <div class="item-card">
                <div class="item-date">${formatarData(item.data)}</div>
                <div class="item-body">
                    <div class="item-name">${esc(item.descricao)}</div>
                    ${item.responsavel ? `<div class="item-sub">👤 ${esc(item.responsavel)}</div>` : ''}
                </div>
                <button class="btn-delete" onclick="Central.remover('historico', ${idx})" title="Remover">🗑</button>
            </div>`,
        ordenar: (itens) => [...itens].sort((a, b) => (b.data || '').localeCompare(a.data || '')),
    },
    links: {
        campos: ['links-nome', 'links-url', 'links-obs'],
        montar: (campos) => ({
            nome: campos['links-nome'],
            url:  campos['links-url'],
            obs:  campos['links-obs'],
        }),
        validar: (d) => d.nome && d.url,
        erroValidacao: 'Preencha nome e URL.',
        renderItem: (item, idx) => `
            <div class="item-card">
                <div class="item-body">
                    <div class="item-name">${esc(item.nome)}</div>
                    <div class="item-sub"><a class="item-link" href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.url)}</a></div>
                    ${item.obs ? `<div class="item-obs">${esc(item.obs)}</div>` : ''}
                </div>
                <button class="btn-delete" onclick="Central.remover('links', ${idx})" title="Remover">🗑</button>
            </div>`,
    },
};

// ── Estado em memória ─────────────────────────────────────────────────────────
const estado = { whatsapp: [], robos: [], programas: [], historico: [], links: [] };

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatarData(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}
function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), 2500);
}

// ── Firestore ─────────────────────────────────────────────────────────────────
async function carregar(secao) {
    const snap = await getDoc(doc(db, SECAO_DOC, secao));
    estado[secao] = snap.exists() ? (snap.data().itens || []) : [];
    renderLista(secao);
}

async function persistir(secao) {
    await setDoc(doc(db, SECAO_DOC, secao), {
        itens:       estado[secao],
        atualizadoEm: serverTimestamp(),
    });
}

// ── Renderização ──────────────────────────────────────────────────────────────
function renderLista(secao) {
    const cfg   = SECOES[secao];
    const lista = document.getElementById(`list-${secao}`);
    if (!lista) return;

    let itens = estado[secao];
    if (cfg.ordenar) itens = cfg.ordenar(itens);

    if (!itens.length) {
        lista.innerHTML = `<div class="empty">Nenhum item cadastrado ainda.</div>`;
        return;
    }
    lista.innerHTML = itens.map((item, idx) => cfg.renderItem(item, idx)).join('');
}

// ── API pública ───────────────────────────────────────────────────────────────
window.Central = {
    abrirForm(secao) {
        document.getElementById(`form-${secao}`)?.classList.remove('hidden');
        // Preencher data de hoje no histórico
        if (secao === 'historico') {
            const campo = document.getElementById('historico-data');
            if (campo && !campo.value) campo.value = new Date().toISOString().slice(0, 10);
        }
    },

    fecharForm(secao) {
        const form = document.getElementById(`form-${secao}`);
        if (!form) return;
        form.classList.add('hidden');
        SECOES[secao].campos.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    },

    async salvar(secao) {
        const cfg    = SECOES[secao];
        const campos = {};
        cfg.campos.forEach(id => {
            const el = document.getElementById(id);
            campos[id] = el ? el.value.trim() : '';
        });

        const dado = cfg.montar(campos);
        if (!cfg.validar(dado)) { toast(`⚠️ ${cfg.erroValidacao}`); return; }

        estado[secao].push(dado);
        try {
            await persistir(secao);
            renderLista(secao);
            Central.fecharForm(secao);
            toast('✅ Salvo');
        } catch (e) {
            estado[secao].pop();
            toast('❌ Erro ao salvar');
            console.error(e);
        }
    },

    async remover(secao, idx) {
        if (!confirm('Remover este item?')) return;
        const removido = estado[secao].splice(idx, 1)[0];
        try {
            await persistir(secao);
            renderLista(secao);
            toast('🗑 Removido');
        } catch (e) {
            estado[secao].splice(idx, 0, removido);
            toast('❌ Erro ao remover');
            console.error(e);
        }
    },
};

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
});

// ── Init: carrega todas as seções ─────────────────────────────────────────────
Object.keys(estado).forEach(secao => carregar(secao).catch(console.error));
