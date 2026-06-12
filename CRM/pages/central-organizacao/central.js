import { db, doc, getDoc, setDoc, serverTimestamp, authReady } from '../../scripts/firebase.js';

const SECAO_DOC = 'central_organizacao';

// ── Avatar ────────────────────────────────────────────────────────────────────
const _PAL = ['#2563eb','#7c3aed','#db2777','#dc2626','#d97706','#059669','#0891b2','#4f46e5','#9333ea','#0f766e','#b45309','#16a34a'];
function _hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function _initials(nome) {
    if (!nome) return '?';
    const caps = nome.match(/[A-Z]/g) || [];
    if (caps.length >= 2) return caps[0] + caps[caps.length - 1];
    const ws = nome.trim().split(/\s+/);
    if (ws.length >= 2) return (ws[0][0] + ws[ws.length - 1][0]).toUpperCase();
    return nome.slice(0, 2).toUpperCase();
}
function av(nome) {
    const bg = _PAL[_hash(nome || '') % _PAL.length];
    return `<div class="item-avatar" style="background:${bg}">${_initials(nome)}</div>`;
}

// ── Seções ────────────────────────────────────────────────────────────────────
const SECOES = {
    whatsapp: {
        campos: ['wpp-nome', 'wpp-numero', 'wpp-obs'],
        montar: (campos) => ({
            nome:   campos['wpp-nome'],
            numero: campos['wpp-numero'].replace(/\D/g, ''),
            obs:    campos['wpp-obs'],
        }),
        preencher: (item) => {
            document.getElementById('wpp-nome').value   = item.nome   || '';
            document.getElementById('wpp-numero').value = item.numero || '';
            document.getElementById('wpp-obs').value    = item.obs    || '';
        },
        validar: (d) => d.nome && d.numero,
        erroValidacao: 'Preencha nome e número.',
        renderItem: (item, idx) => `
            <div class="item-card">
                ${av(item.nome)}
                <div class="item-body">
                    <div class="item-name">${esc(item.nome)}</div>
                    <div class="item-sub">📞 ${esc(item.numero)}</div>
                    ${item.obs ? `<div class="item-obs">${esc(item.obs)}</div>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn-edit"   onclick="Central.editar('whatsapp',${idx})"  title="Editar">✏️</button>
                    <button class="btn-delete" onclick="Central.remover('whatsapp',${idx})" title="Remover">🗑️</button>
                </div>
            </div>`,
    },
    robos: {
        campos: ['robos-nome', 'robos-funcao', 'robos-obs'],
        montar: (campos) => ({
            nome:   campos['robos-nome'],
            funcao: campos['robos-funcao'],
            obs:    campos['robos-obs'],
        }),
        preencher: (item) => {
            document.getElementById('robos-nome').value   = item.nome   || '';
            document.getElementById('robos-funcao').value = item.funcao || '';
            document.getElementById('robos-obs').value    = item.obs    || '';
        },
        validar: (d) => d.nome,
        erroValidacao: 'Preencha o nome.',
        renderItem: (item, idx) => `
            <div class="item-card">
                ${av(item.nome)}
                <div class="item-body">
                    <div class="item-name">${esc(item.nome)}</div>
                    ${item.funcao ? `<div class="item-sub">🔧 ${esc(item.funcao)}</div>` : ''}
                    ${item.obs ? `<div class="item-obs">${esc(item.obs)}</div>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn-edit"   onclick="Central.editar('robos',${idx})"  title="Editar">✏️</button>
                    <button class="btn-delete" onclick="Central.remover('robos',${idx})" title="Remover">🗑️</button>
                </div>
            </div>`,
    },
    programas: {
        campos: ['programas-nome', 'programas-link', 'programas-obs'],
        montar: (campos) => ({
            nome: campos['programas-nome'],
            link: campos['programas-link'],
            obs:  campos['programas-obs'],
        }),
        preencher: (item) => {
            document.getElementById('programas-nome').value = item.nome || '';
            document.getElementById('programas-link').value = item.link || '';
            document.getElementById('programas-obs').value  = item.obs  || '';
        },
        validar: (d) => d.nome,
        erroValidacao: 'Preencha o nome.',
        renderItem: (item, idx) => `
            <div class="item-card">
                ${av(item.nome)}
                <div class="item-body">
                    <div class="item-name">${esc(item.nome)}</div>
                    ${item.link ? `<div class="item-sub"><a class="item-link" href="${esc(item.link)}" target="_blank" rel="noopener">${esc(item.link)}</a></div>` : ''}
                    ${item.obs ? `<div class="item-obs">${esc(item.obs)}</div>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn-edit"   onclick="Central.editar('programas',${idx})"  title="Editar">✏️</button>
                    <button class="btn-delete" onclick="Central.remover('programas',${idx})" title="Remover">🗑️</button>
                </div>
            </div>`,
    },
    historico: {
        campos: ['historico-data', 'historico-descricao', 'historico-responsavel'],
        montar: (campos) => ({
            data:        campos['historico-data'] || new Date().toISOString().slice(0, 10),
            descricao:   campos['historico-descricao'],
            responsavel: campos['historico-responsavel'],
        }),
        preencher: (item) => {
            document.getElementById('historico-data').value         = item.data        || '';
            document.getElementById('historico-descricao').value    = item.descricao   || '';
            document.getElementById('historico-responsavel').value  = item.responsavel || '';
        },
        validar: (d) => d.descricao,
        erroValidacao: 'Preencha a descrição.',
        renderItem: (item, idx) => `
            <div class="item-card">
                <div class="item-date">${formatarData(item.data)}</div>
                <div class="item-body">
                    <div class="item-name">${esc(item.descricao)}</div>
                    ${item.responsavel ? `<div class="item-sub">👤 ${esc(item.responsavel)}</div>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn-edit"   onclick="Central.editar('historico',${idx})"  title="Editar">✏️</button>
                    <button class="btn-delete" onclick="Central.remover('historico',${idx})" title="Remover">🗑️</button>
                </div>
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
        preencher: (item) => {
            document.getElementById('links-nome').value = item.nome || '';
            document.getElementById('links-url').value  = item.url  || '';
            document.getElementById('links-obs').value  = item.obs  || '';
        },
        validar: (d) => d.nome && d.url,
        erroValidacao: 'Preencha nome e URL.',
        renderItem: (item, idx) => `
            <div class="item-card">
                ${av(item.nome)}
                <div class="item-body">
                    <div class="item-name">${esc(item.nome)}</div>
                    <div class="item-sub"><a class="item-link" href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.url)}</a></div>
                    ${item.obs ? `<div class="item-obs">${esc(item.obs)}</div>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn-edit"   onclick="Central.editar('links',${idx})"  title="Editar">✏️</button>
                    <button class="btn-delete" onclick="Central.remover('links',${idx})" title="Remover">🗑️</button>
                </div>
            </div>`,
    },
};

// ── Estado ────────────────────────────────────────────────────────────────────
const estado = { whatsapp: [], robos: [], programas: [], historico: [], links: [], _edit: null };

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
        itens:        estado[secao],
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
        if (estado._edit?.secao === secao) estado._edit = null;
    },

    editar(secao, idx) {
        const item = estado[secao][idx];
        if (!item) return;
        estado._edit = { secao, idx };
        Central.abrirForm(secao);
        SECOES[secao].preencher(item);
        document.getElementById(`form-${secao}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

        const editando = estado._edit;
        if (editando && editando.secao === secao) {
            const anterior = estado[secao][editando.idx];
            estado[secao][editando.idx] = dado;
            estado._edit = null;
            try {
                await persistir(secao);
                renderLista(secao);
                Central.fecharForm(secao);
                toast('✅ Atualizado');
            } catch (e) {
                estado[secao][editando.idx] = anterior;
                toast('❌ Erro ao salvar');
                console.error(e);
            }
        } else {
            estado._edit = null;
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

    addEmailRow() {
        const c = document.getElementById('wpp-emails-container');
        if (!c) return;
        const row = document.createElement('div');
        row.className = 'field-row';
        row.innerHTML = `<input class="field" placeholder="E-mail (opcional)" maxlength="120" type="email"><button class="btn-add-row" type="button" onclick="this.parentElement.remove()" title="Remover">−</button>`;
        c.appendChild(row);
    },

    addSenhaRow() {
        const c = document.getElementById('wpp-senhas-container');
        if (!c) return;
        const row = document.createElement('div');
        row.className = 'field-row';
        row.innerHTML = `<input class="field" placeholder="Senha (opcional)" maxlength="120" type="text"><button class="btn-add-row" type="button" onclick="this.parentElement.remove()" title="Remover">−</button>`;
        c.appendChild(row);
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

// ── Init ──────────────────────────────────────────────────────────────────────
authReady.then(() => {
    Object.keys(estado).filter(k => k !== '_edit').forEach(secao => carregar(secao).catch(console.error));
});
