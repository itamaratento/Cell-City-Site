import { db, doc, getDoc, setDoc, serverTimestamp, authReady, collection, addDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit } from '../../scripts/firebase.js';

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
            <div class="item-card item-card--hist">
                <div class="item-date">${formatarData(item.data)}</div>
                <div class="item-body">
                    <div class="item-name hist-descricao">${esc(item.descricao)}</div>
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
        campos: ['links-nome', 'links-categoria', 'links-usuario', 'links-url', 'links-obs'],
        montar: (campos) => ({
            nome:      campos['links-nome'],
            categoria: campos['links-categoria'],
            usuario:   campos['links-usuario'],
            senha:     document.getElementById('links-senha')?.value || '',
            url:       campos['links-url'],
            obs:       campos['links-obs'],
        }),
        preencher: (item) => {
            document.getElementById('links-nome').value      = item.nome      || '';
            document.getElementById('links-categoria').value = item.categoria || '';
            document.getElementById('links-usuario').value   = item.usuario   || '';
            document.getElementById('links-senha').value     = item.senha     || '';
            document.getElementById('links-url').value       = item.url       || '';
            document.getElementById('links-obs').value       = item.obs       || '';
        },
        onFechar: () => {
            const el  = document.getElementById('links-senha');
            const btn = document.getElementById('links-senha-toggle');
            if (el)  { el.value = ''; el.type = 'password'; }
            if (btn) btn.textContent = '👁';
        },
        validar: (d) => !!d.nome,
        erroValidacao: 'Preencha o nome.',
        filtrarExtra: (item) => !_linksCategoria || item.categoria === _linksCategoria,
        renderItem: (item, idx) => {
            const CAT_EMOJI = { Instagram:'📸', Facebook:'📘', Google:'🔍', Firebase:'🔥', WhatsApp:'💬', Hospedagem:'🌐', 'Domínio':'🏷️', 'E-mail':'✉️', IA:'🤖', Outros:'📂' };
            const catEmoji = item.categoria ? (CAT_EMOJI[item.categoria] || '📂') : '';
            return `
            <div class="item-card acesso-card">
                ${av(item.nome)}
                <div class="item-body">
                    ${item.categoria ? `<div class="acesso-cat-badge">${catEmoji} ${esc(item.categoria)}</div>` : ''}
                    <div class="item-name">${esc(item.nome)}</div>
                    ${item.usuario ? `
                    <div class="acesso-row">
                        <span class="acesso-lbl">👤</span>
                        <span class="acesso-val">${esc(item.usuario)}</span>
                        <button class="btn-acesso-copy" onclick="Central.copiarUsuario(${idx})" title="Copiar usuário">📋</button>
                    </div>` : ''}
                    ${item.senha ? `
                    <div class="acesso-row">
                        <span class="acesso-lbl">🔑</span>
                        <span class="acesso-val acesso-senha-text" id="senha-val-${idx}">••••••••</span>
                        <button class="btn-acesso-copy" onclick="Central.toggleSenhaCard(${idx})" id="senha-eye-${idx}" title="Mostrar/ocultar senha">👁</button>
                        <button class="btn-acesso-copy" onclick="Central.copiarSenha(${idx})" title="Copiar senha">📋</button>
                    </div>` : ''}
                    ${item.url ? `
                    <div class="acesso-row">
                        <span class="acesso-lbl">🌐</span>
                        <a class="item-link acesso-url-text" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.url)}</a>
                    </div>` : ''}
                    ${item.obs ? `<div class="item-obs">${esc(item.obs)}</div>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn-edit"   onclick="Central.editar('links',${idx})"  title="Editar">✏️</button>
                    <button class="btn-delete" onclick="Central.remover('links',${idx})" title="Remover">🗑️</button>
                </div>
            </div>`;
        },
    },
};

// ── Estado ────────────────────────────────────────────────────────────────────
const estado = { whatsapp: [], robos: [], programas: [], historico: [], links: [], _edit: null };
let _busca = '';
let _linksCategoria = '';

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function matchBusca(item) {
    if (!_busca) return true;
    const t = _busca.toLowerCase();
    return Object.values(item).some(v => typeof v === 'string' && v.toLowerCase().includes(t));
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
    const indexados = itens.map((item, idx) => ({ item, idx })).filter(({ item }) => matchBusca(item) && (!cfg.filtrarExtra || cfg.filtrarExtra(item)));
    if (!indexados.length) {
        lista.innerHTML = _busca
            ? `<div class="empty">Nenhum resultado para "<strong>${esc(_busca)}</strong>".</div>`
            : `<div class="empty">Nenhum item cadastrado ainda.</div>`;
        return;
    }
    lista.innerHTML = indexados.map(({ item, idx }) => cfg.renderItem(item, idx)).join('');
    atualizarHomeCards();
}

// ── API pública ───────────────────────────────────────────────────────────────
window.Central = {
    nav(secao) { navegarParaSecao(secao); },

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
        SECOES[secao].onFechar?.();
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

    filtrar(valor) {
        _busca = (valor || '').trim();
        const tabAtiva = document.querySelector('.tabs .tab.active')?.dataset.tab;
        if (tabAtiva && SECOES[tabAtiva]) renderLista(tabAtiva);
    },

    // ── Acessos: senha show/hide no formulário ────────────────────────────────
    toggleSenhaForm() {
        const el  = document.getElementById('links-senha');
        const btn = document.getElementById('links-senha-toggle');
        if (!el) return;
        const mostrar = el.type === 'password';
        el.type = mostrar ? 'text' : 'password';
        if (btn) btn.textContent = mostrar ? '🙈' : '👁';
    },

    // ── Acessos: senha show/hide no card ─────────────────────────────────────
    toggleSenhaCard(idx) {
        const valEl = document.getElementById(`senha-val-${idx}`);
        const eyeEl = document.getElementById(`senha-eye-${idx}`);
        const item  = estado.links[idx];
        if (!valEl || !item?.senha) return;
        const mostrando = valEl.dataset.mostrando === '1';
        valEl.textContent       = mostrando ? '••••••••' : item.senha;
        valEl.dataset.mostrando = mostrando ? '0' : '1';
        if (eyeEl) eyeEl.textContent = mostrando ? '👁' : '🙈';
    },

    // ── Acessos: copiar campos ────────────────────────────────────────────────
    copiarUsuario(idx) {
        const item = estado.links[idx];
        if (!item?.usuario) return;
        navigator.clipboard.writeText(item.usuario)
            .then(() => toast('📋 Usuário copiado'))
            .catch(() => toast('❌ Erro ao copiar'));
    },

    copiarSenha(idx) {
        const item = estado.links[idx];
        if (!item?.senha) return;
        navigator.clipboard.writeText(item.senha)
            .then(() => toast('📋 Senha copiada'))
            .catch(() => toast('❌ Erro ao copiar'));
    },

    // ── Acessos: filtro por categoria ─────────────────────────────────────────
    filtrarAcessos(categoria) {
        _linksCategoria = categoria;
        document.querySelectorAll('.acesso-cat-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.cat === categoria);
        });
        renderLista('links');
    },
};

// ── Navegação via Sidebar ─────────────────────────────────────────────────────
const SECOES_SEM_BUSCA = new Set(['home', 'monitoramento', 'notas', 'categorias', 'tarefas']);
const SECAO_TITULO = {
    home:          '🏠 Home',
    whatsapp:      '📱 WhatsApp',
    robos:         '🤖 Robôs & IA',
    programas:     '🛠️ Programas',
    historico:     '📜 Histórico',
    links:         '🔐 Acessos',
    monitoramento: '📊 Monitoramento',
    notas:         '📝 Notas',
    categorias:    '📁 Categorias',
    tarefas:       '✅ Tarefas',
};

function navegarParaSecao(secao) {
    // Atualiza sidebar
    document.querySelectorAll('.cat-sb-item').forEach(item => {
        item.classList.toggle('active', item.dataset.nav === secao);
    });
    // Atualiza painéis
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${secao}`)?.classList.add('active');

    // Breadcrumb
    const titulo = document.getElementById('cat-nav-titulo');
    if (titulo) titulo.textContent = SECAO_TITULO[secao] || secao;

    // Busca: limpa e mostra/oculta
    _busca = '';
    const buscaInput = document.getElementById('central-busca');
    const buscaWrap  = document.getElementById('central-busca-wrap');
    if (buscaInput) buscaInput.value = '';
    if (buscaWrap)  buscaWrap.style.display = SECOES_SEM_BUSCA.has(secao) ? 'none' : '';

    // Fecha sidebar mobile
    document.getElementById('cat-sidebar')?.classList.remove('open');
    document.getElementById('cat-sb-overlay')?.classList.remove('open');

    // Inicializa módulos especiais ao navegar
    if (secao === 'monitoramento') Monitoramento.init().catch(console.error);
    if (secao === 'notas')         Notas.init().catch(console.error);
    if (secao === 'tarefas')       Tarefas.init().catch(console.error);
}

// Cliques na sidebar
document.querySelectorAll('.cat-sb-item').forEach(item => {
    item.addEventListener('click', () => navegarParaSecao(item.dataset.nav));
});

// Toggle sidebar mobile
document.getElementById('cat-sb-open')?.addEventListener('click', () => {
    document.getElementById('cat-sidebar')?.classList.toggle('open');
    document.getElementById('cat-sb-overlay')?.classList.toggle('open');
});
document.getElementById('cat-sb-overlay')?.addEventListener('click', () => {
    document.getElementById('cat-sidebar')?.classList.remove('open');
    document.getElementById('cat-sb-overlay')?.classList.remove('open');
});

// ── Atualizar Home cards e sidebar counts ─────────────────────────────────────
function atualizarHomeCards() {
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const c = k => estado[k]?.length ?? '—';
    // Home grid counts
    setEl('hc-whatsapp',  c('whatsapp'));
    setEl('hc-robos',     c('robos'));
    setEl('hc-programas', c('programas'));
    setEl('hc-historico', c('historico'));
    setEl('hc-links',     c('links'));
    // Sidebar counts
    setEl('sb-count-whatsapp',  c('whatsapp'));
    setEl('sb-count-robos',     c('robos'));
    setEl('sb-count-programas', c('programas'));
    setEl('sb-count-historico', c('historico'));
    setEl('sb-count-links',     c('links'));
}

// ── Seção fixada (seção padrão ao abrir a página) ────────────────────────────
const ABA_FIXADA_KEY = 'cc_aba_fixada_central';

(function restaurarSecaoFixada() {
    const fixada = localStorage.getItem(ABA_FIXADA_KEY);
    navegarParaSecao(fixada && SECAO_TITULO[fixada] ? fixada : 'home');
})();

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO NOTAS
// Coleção: notas_projeto/{id}  →  {nome, cor, desc, notas:[{id,titulo,texto,dt}]}
// ══════════════════════════════════════════════════════════════════════════════

const NOTAS_COL = 'notas_projeto';
const NOTA_CORES = ['#2563eb','#7c3aed','#db2777','#dc2626','#d97706','#059669','#0891b2','#ea580c','#9333ea','#16a34a'];
const NOTA_SUGESTOES = ['Robô WhatsApp','CRM','Marketing','Projetos Tech','Ideias','Financeiro','Treinamentos','Outros'];

const notasState = {
    lista:      [],
    atual:      null,
    corSel:     NOTA_CORES[0],
    modalId:    null,
    filtro:     '',
    iniciado:   false,
};

// ── helpers ───────────────────────────────────────────────────────────────────
function notaEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function notaId()   { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function notaFmt(dt){ if(!dt) return ''; const d=new Date(dt); return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}); }

// ── Firestore ─────────────────────────────────────────────────────────────────
async function notasCarregar() {
    const snap = await getDocs(collection(db, NOTAS_COL));
    notasState.lista = snap.docs.map(d=>({id:d.id,...d.data()}));
    notasState.lista.sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt'));
}

async function notasUpdate(id, campos) {
    await updateDoc(doc(db, NOTAS_COL, id), campos);
}

// ── Render lista de projetos ──────────────────────────────────────────────────
function notasRenderLista() {
    const el = document.getElementById('notas-lista'); if (!el) return;
    const lista = notasState.lista;
    const sug = document.getElementById('notas-sugestoes');

    if (!lista.length) {
        el.innerHTML = '';
        if (sug) {
            sug.classList.remove('hidden');
            const chips = document.getElementById('notas-sug-chips');
            if (chips) chips.innerHTML = NOTA_SUGESTOES.map(s =>
                `<button class="cat-sug-chip" onclick="Notas.sugerir(${JSON.stringify(s)})">${notaEsc(s)}</button>`
            ).join('');
        }
        return;
    }
    if (sug) sug.classList.add('hidden');

    el.innerHTML = lista.map(p => {
        const total = (p.notas||[]).length;
        const ultima = (p.notas||[]).slice(-1)[0];
        const meta = ultima ? `Última nota: ${notaFmt(ultima.dt)}` : 'Sem notas ainda';
        return `<div class="nota-proj-card" onclick="Notas.abrirProj('${p.id}')">
            <div class="nota-proj-cor" style="background:${notaEsc(p.cor||'#059669')}"></div>
            <div class="nota-proj-info">
                <div class="nota-proj-nome">${notaEsc(p.nome)}</div>
                <div class="nota-proj-meta">${notaEsc(p.desc||'')}${p.desc?' · ':''}${notaEsc(meta)}</div>
            </div>
            <div class="nota-proj-count">${total} nota${total!==1?'s':''}</div>
            <div class="nota-proj-actions" onclick="event.stopPropagation()">
                <button class="cat-btn-sm" onclick="Notas.editarProj('${p.id}')" title="Editar">✏️</button>
                <button class="cat-btn-sm cat-btn-danger" onclick="Notas.excluirProj('${p.id}')" title="Excluir">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

// ── Render detalhe (notas do projeto) ────────────────────────────────────────
function notasRenderDetalhe() {
    const p   = notasState.atual; if (!p) return;
    const cor = p.cor || '#059669';

    const badge = document.getElementById('nota-proj-badge');
    const nome  = document.getElementById('nota-proj-nome');
    const desc  = document.getElementById('nota-proj-desc');
    if (badge) { badge.style.background = cor; }
    if (nome)  nome.textContent = p.nome || '';
    if (desc)  desc.textContent = p.desc || '';

    const filtro = notasState.filtro.toLowerCase();
    let notas = (p.notas || []).slice().reverse(); // mais recente primeiro
    if (filtro) notas = notas.filter(n =>
        (n.titulo||'').toLowerCase().includes(filtro) ||
        (n.texto||'').toLowerCase().includes(filtro)
    );

    const el = document.getElementById('notas-proj-lista'); if (!el) return;
    if (!notas.length) {
        el.innerHTML = `<div class="empty">${filtro ? 'Nenhuma nota encontrada.' : 'Nenhuma nota ainda. Clique em <strong>+ Nota</strong> para criar.'}</div>`;
        return;
    }

    el.innerHTML = notas.map(n => {
        const preview = (n.texto||'').slice(0,180);
        return `<div class="nota-card" style="border-left-color:${notaEsc(cor)}" onclick="Notas.abrirModal('${notaEsc(n.id)}')">
            <div class="nota-card-header">
                <div class="nota-card-titulo">${notaEsc(n.titulo||'Sem título')}</div>
                <div class="nota-card-data">${notaFmt(n.dt)}</div>
            </div>
            <div class="nota-card-preview">${notaEsc(preview)}${(n.texto||'').length>180?'…':''}</div>
        </div>`;
    }).join('');
}

// ── Paleta de cores do formulário ─────────────────────────────────────────────
function notasRenderPaleta(palId) {
    const el = document.getElementById(palId); if (!el) return;
    el.innerHTML = NOTA_CORES.map(c =>
        `<button type="button" class="cat-cor-btn${c===notasState.corSel?' ativa':''}"
            style="background:${c}" onclick="Notas._selectCor('${c}','${palId}')" title="${c}"></button>`
    ).join('');
}

// ── API pública ───────────────────────────────────────────────────────────────
window.Notas = {

    async init() {
        if (notasState.iniciado) { notasRenderLista(); return; }
        await notasCarregar();
        notasState.iniciado = true;
        notasRenderLista();
    },

    // ── Projetos ─────────────────────────────────────────────────────────────

    sugerir(nome) {
        document.getElementById('proj-nome').value = nome;
        Notas.abrirFormProj();
    },

    abrirFormProj(id) {
        notasState.corSel = NOTA_CORES[0];
        const editId = document.getElementById('proj-edit-id');
        const nome   = document.getElementById('proj-nome');
        const desc   = document.getElementById('proj-desc');
        if (id) {
            const p = notasState.lista.find(x=>x.id===id); if (!p) return;
            editId.value    = p.id;
            nome.value      = p.nome  || '';
            desc.value      = p.desc  || '';
            notasState.corSel = p.cor || NOTA_CORES[0];
        } else {
            editId.value = '';
            if (!nome.value) { nome.value=''; }
            if (desc) desc.value='';
        }
        notasRenderPaleta('proj-cor-palette');
        document.getElementById('form-proj').classList.remove('hidden');
        nome.focus();
    },

    fecharFormProj() {
        document.getElementById('form-proj').classList.add('hidden');
        document.getElementById('proj-edit-id').value = '';
        document.getElementById('proj-nome').value    = '';
        document.getElementById('proj-desc').value    = '';
    },

    async salvarProj() {
        const nome  = (document.getElementById('proj-nome').value||'').trim();
        const desc  = (document.getElementById('proj-desc')?.value||'').trim();
        const editId = document.getElementById('proj-edit-id').value;
        if (!nome) { alert('Informe o nome do projeto'); return; }

        const dados = { nome, desc, cor: notasState.corSel };
        try {
            if (editId) {
                await notasUpdate(editId, dados);
                const idx = notasState.lista.findIndex(x=>x.id===editId);
                if (idx>=0) notasState.lista[idx] = {...notasState.lista[idx],...dados};
                if (notasState.atual?.id===editId) notasState.atual = {...notasState.atual,...dados};
            } else {
                const ref = await addDoc(collection(db, NOTAS_COL), {...dados, notas:[], criadoEm:serverTimestamp()});
                notasState.lista.push({id:ref.id, notas:[], ...dados});
                notasState.lista.sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt'));
            }
            Notas.fecharFormProj();
            notasRenderLista();
        } catch(e) { toast('❌ Erro ao salvar projeto'); console.error(e); }
    },

    editarProj(id) {
        const pid = id || notasState.atual?.id; if (!pid) return;
        Notas.abrirFormProj(pid);
    },

    async excluirProj(id) {
        const pid = id || notasState.atual?.id; if (!pid) return;
        const p = notasState.lista.find(x=>x.id===pid); if (!p) return;
        if (!confirm(`Excluir projeto "${p.nome}" e todas as suas notas?`)) return;
        try {
            await deleteDoc(doc(db, NOTAS_COL, pid));
            notasState.lista = notasState.lista.filter(x=>x.id!==pid);
            if (notasState.atual?.id===pid) {
                notasState.atual = null;
                document.getElementById('notas-view-lista').style.display   = '';
                document.getElementById('notas-view-detalhe').style.display = 'none';
            }
            notasRenderLista();
            toast('✅ Projeto excluído');
        } catch(e) { toast('❌ Erro ao excluir'); console.error(e); }
    },

    // ── Navegação ─────────────────────────────────────────────────────────────

    abrirProj(id) {
        const p = notasState.lista.find(x=>x.id===id); if (!p) return;
        notasState.atual  = p;
        notasState.filtro = '';
        const busca = document.getElementById('notas-busca'); if (busca) busca.value='';
        document.getElementById('form-nota')?.classList.add('hidden');
        document.getElementById('form-proj')?.classList.add('hidden');
        document.getElementById('notas-view-lista').style.display   = 'none';
        document.getElementById('notas-view-detalhe').style.display = '';
        notasRenderDetalhe();
    },

    voltarLista() {
        notasState.atual  = null;
        notasState.filtro = '';
        document.getElementById('notas-view-lista').style.display   = '';
        document.getElementById('notas-view-detalhe').style.display = 'none';
        document.getElementById('form-nota')?.classList.add('hidden');
        notasRenderLista();
    },

    // ── Notas ────────────────────────────────────────────────────────────────

    abrirFormNota() {
        document.getElementById('nota-edit-id').value = '';
        document.getElementById('nota-titulo').value  = '';
        document.getElementById('nota-texto').value   = '';
        document.getElementById('form-nota').classList.remove('hidden');
        document.getElementById('nota-titulo').focus();
    },

    fecharFormNota() {
        document.getElementById('form-nota').classList.add('hidden');
    },

    async salvarNota() {
        const p      = notasState.atual; if (!p) return;
        const titulo = (document.getElementById('nota-titulo').value||'').trim();
        const texto  = (document.getElementById('nota-texto').value||'').trim();
        const editId = document.getElementById('nota-edit-id').value;
        if (!titulo) { alert('Informe o título da nota'); return; }

        const notas = [...(p.notas||[])];
        const hoje  = new Date().toISOString().slice(0,10);

        if (editId) {
            const idx = notas.findIndex(n=>n.id===editId);
            if (idx>=0) notas[idx] = {...notas[idx], titulo, texto, dt: hoje};
        } else {
            notas.push({ id: notaId(), titulo, texto, dt: hoje });
        }

        try {
            await notasUpdate(p.id, { notas, atualizadoEm: serverTimestamp() });
            p.notas = notas;
            Notas.fecharFormNota();
            notasRenderDetalhe();
            // Atualiza contador na lista
            const li = notasState.lista.find(x=>x.id===p.id);
            if (li) li.notas = notas;
        } catch(e) { toast('❌ Erro ao salvar nota'); console.error(e); }
    },

    // ── Modal de leitura/edição de nota ──────────────────────────────────────

    abrirModal(notaId) {
        const p = notasState.atual; if (!p) return;
        const n = (p.notas||[]).find(x=>x.id===notaId); if (!n) return;
        notasState.modalId = notaId;
        document.getElementById('nota-modal-titulo').value = n.titulo || '';
        document.getElementById('nota-modal-texto').value  = n.texto  || '';
        document.getElementById('nota-modal').classList.add('open');
        document.getElementById('nota-modal-titulo').focus();
    },

    fecharModal() {
        document.getElementById('nota-modal').classList.remove('open');
        notasState.modalId = null;
    },

    async salvarModal() {
        const p = notasState.atual; if (!p || !notasState.modalId) return;
        const titulo = (document.getElementById('nota-modal-titulo').value||'').trim();
        const texto  = (document.getElementById('nota-modal-texto').value||'').trim();
        if (!titulo) { alert('Informe o título'); return; }

        const notas = [...(p.notas||[])];
        const idx   = notas.findIndex(n=>n.id===notasState.modalId);
        if (idx<0) return;
        const hoje = new Date().toISOString().slice(0,10);
        notas[idx] = {...notas[idx], titulo, texto, dt: hoje};

        try {
            await notasUpdate(p.id, { notas, atualizadoEm: serverTimestamp() });
            p.notas = notas;
            const li = notasState.lista.find(x=>x.id===p.id);
            if (li) li.notas = notas;
            Notas.fecharModal();
            notasRenderDetalhe();
            toast('✅ Nota salva');
        } catch(e) { toast('❌ Erro ao salvar'); console.error(e); }
    },

    async excluirNota() {
        const p = notasState.atual; if (!p || !notasState.modalId) return;
        if (!confirm('Excluir esta nota?')) return;
        const notas = (p.notas||[]).filter(n=>n.id!==notasState.modalId);
        try {
            await notasUpdate(p.id, { notas, atualizadoEm: serverTimestamp() });
            p.notas = notas;
            const li = notasState.lista.find(x=>x.id===p.id);
            if (li) li.notas = notas;
            Notas.fecharModal();
            notasRenderDetalhe();
        } catch(e) { toast('❌ Erro ao excluir nota'); console.error(e); }
    },

    filtrar() {
        notasState.filtro = (document.getElementById('notas-busca')?.value||'');
        notasRenderDetalhe();
    },

    _selectCor(cor, palId) {
        notasState.corSel = cor;
        notasRenderPaleta(palId);
    },
};

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO MONITORAMENTO
// Lê em tempo real: config/robo_status (heartbeat do robô)
// Lê/escreve: config/robo_classificacao (palavras para classificar leads)
// Lê: robo_atividade (log de envios/respostas)
//
// CONTRATO DO ROBÔ — o robô deve escrever em Firestore:
//
// 1) config/robo_status (heartbeat a cada envio/30s):
//    { online:bool, wppConectado:bool, numeroPrincipal:string,
//      versao:string, ultimaSync:Timestamp,
//      enviadosHoje:number, recebidosHoje:number, erros:string[] }
//
// 2) robo_atividade/{autoId} (a cada evento):
//    { tipo:'envio'|'resposta'|'lead_quente'|'lead_morno'|'bloqueado'|'erro'|'inicio'|'pausa',
//      numero:string, catId:string, catNome:string, texto:string, ts:serverTimestamp() }
//
// 3) categorias_wpp/{catId} — atualiza o telefone na array:
//    campos: status, pontos, ultimoEnvio, ultimaResposta, totalEnviados, totalRespostas
//
// 4) categorias_wpp/{catId} — atualiza stats:
//    { 'stats.enviados': increment(1), 'stats.respostas': increment(1) }
//
// 5) Classificação (lida do Firestore por: getDoc config/robo_classificacao):
//    palavras_quentes[] → status='lead_quente', pontos+=15
//    palavras_mornos[]  → status='lead_morno',  pontos+=5
//    palavras_bloqueado[]→ status='bloqueado',   pontos-=50
//    (resposta sem match) → status='respondeu',  pontos+=5
// ══════════════════════════════════════════════════════════════════════════════

const monState = {
    palavrasQuente:   [],
    palavrasMorno:    [],
    palavrasBloqueado:[],
    pontos: { respondeu:5, lead_quente:15, lead_morno:5, lead_frio:-10, cliente:50, bloqueado:-50 },
    unsubStatus: null,
};

function monFmt(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('pt-BR',{ day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function monRenderStatus(data) {
    const badge  = document.getElementById('mon-badge');
    const syncEl = document.getElementById('mon-ultima-sync');
    const wppEl  = document.getElementById('mon-wpp');
    const numEl  = document.getElementById('mon-numero');
    const verEl  = document.getElementById('mon-versao');
    const envEl  = document.getElementById('mon-enviados');
    const recEl  = document.getElementById('mon-recebidos');
    const errEl  = document.getElementById('mon-erros');
    if (!data) {
        if (badge)  { badge.textContent='⚫ Sem dados'; badge.className='mon-badge'; }
        if (syncEl) syncEl.textContent='Robô nunca conectou ao CRM.';
        return;
    }
    const agoSec = data.ultimaSync ? (Date.now() - (data.ultimaSync.toDate?.() ?? new Date(data.ultimaSync)).getTime()) / 1000 : 999;
    const online = data.online && agoSec < 300;
    if (badge)  { badge.textContent = online ? '🟢 Online' : '🔴 Offline'; badge.className = `mon-badge ${online?'online':'offline'}`; }
    if (syncEl) syncEl.textContent  = `Última sync: ${monFmt(data.ultimaSync)}${!online && agoSec < 9999 ? ` (${Math.round(agoSec/60)} min atrás)` : ''}`;
    if (wppEl)  wppEl.textContent   = data.wppConectado ? '🟢 Conectado' : '🔴 Desconectado';
    if (numEl)  numEl.textContent   = data.numeroPrincipal || '—';
    if (verEl)  verEl.textContent   = data.versao || '—';
    if (envEl)  envEl.textContent   = data.enviadosHoje  || 0;
    if (recEl)  recEl.textContent   = data.recebidosHoje || 0;
    if (errEl)  errEl.textContent   = (data.erros || []).length;
}

function monRenderChips(tipo, lista) {
    const el = document.getElementById(`mon-chips-${tipo}`); if (!el) return;
    el.innerHTML = lista.map((p,i) =>
        `<span class="cat-tag-chip">${catEsc(p)}<button class="cat-tag-chip-x" onclick="Monitoramento._removeP('${tipo}',${i})">×</button></span>`
    ).join('');
}

function monRenderPontos() {
    const el = document.getElementById('mon-pontos-grid'); if (!el) return;
    const P = monState.pontos;
    const itens = [
        ['respondeu','💬 Respondeu',P.respondeu],
        ['lead_quente','🔥 Lead Quente',P.lead_quente],
        ['lead_morno','🌡️ Lead Morno',P.lead_morno],
        ['lead_frio','❄️ Lead Frio',P.lead_frio],
        ['cliente','⭐ Cliente',P.cliente],
        ['bloqueado','🔴 Bloqueado',P.bloqueado],
    ];
    el.innerHTML = itens.map(([k,lbl,v]) => {
        const pos = v > 0;
        return `<div class="mon-ponto-item">
            <span class="mon-ponto-lbl">${catEsc(lbl)}</span>
            <span class="mon-ponto-val ${pos?'mon-ponto-pos':'mon-ponto-neg'}">${pos?'+':''}${v}</span>
        </div>`;
    }).join('');
}

async function monCarregarClassificacao() {
    const snap = await getDoc(doc(db, 'config', 'robo_classificacao'));
    if (snap.exists()) {
        const d = snap.data();
        monState.palavrasQuente    = d.palavras_quentes   || [];
        monState.palavrasMorno     = d.palavras_mornos    || [];
        monState.palavrasBloqueado = d.palavras_bloqueado || [];
        if (d.pontos) monState.pontos = { ...monState.pontos, ...d.pontos };
    } else {
        // padrões iniciais
        monState.palavrasQuente    = ['quanto custa','valor','preço','orçamento','tenho interesse','pode explicar','como funciona','quero saber'];
        monState.palavrasMorno     = ['talvez','depois vejo','vou analisar','me chama depois','vou pensar','não sei'];
        monState.palavrasBloqueado = ['não tenho interesse','não quero','pare','remover','não quero receber','sair','stop','chega','cancela'];
    }
    monRenderChips('quente',   monState.palavrasQuente);
    monRenderChips('morno',    monState.palavrasMorno);
    monRenderChips('bloqueado',monState.palavrasBloqueado);
    monRenderPontos();
}

async function monCarregarAtividade() {
    const el = document.getElementById('mon-atividade'); if (!el) return;
    try {
        const snap = await getDocs(query(collection(db, 'robo_atividade'), orderBy('ts','desc'), limit(30)));
        if (snap.empty) {
            el.innerHTML = '<div class="empty">Nenhuma atividade registrada ainda.<br>O robô escreverá aqui automaticamente.</div>';
            return;
        }
        const ICON = { envio:'📤', resposta:'💬', lead_quente:'🔥', lead_morno:'🌡️', lead_frio:'❄️', bloqueado:'🔴', cliente:'⭐', erro:'❌', inicio:'▶️', pausa:'⏸️' };
        el.innerHTML = snap.docs.map(d => {
            const a = d.data();
            return `<div class="mon-ativ-item">
                <span class="mon-ativ-hora">${monFmt(a.ts)}</span>
                <span class="mon-ativ-tipo">${ICON[a.tipo] || '•'}</span>
                <div class="mon-ativ-desc">
                    ${a.numero?`<strong>${catEsc(a.numero)}</strong> `:''}
                    ${a.catNome?`<span class="mon-ativ-cat">[${catEsc(a.catNome)}]</span> `:''}
                    ${catEsc(a.texto || a.tipo || '')}
                </div>
            </div>`;
        }).join('');
    } catch(e) {
        el.innerHTML = '<div class="empty">Erro ao carregar atividade.</div>';
        console.error(e);
    }
}

window.Monitoramento = {

    _addP(tipo) {
        const input = document.getElementById(`mon-input-${tipo}`); if (!input) return;
        const p = input.value.trim().toLowerCase();
        if (!p) { input.value=''; return; }
        const arr = tipo==='quente' ? monState.palavrasQuente : tipo==='morno' ? monState.palavrasMorno : monState.palavrasBloqueado;
        if (!arr.includes(p)) { arr.push(p); monRenderChips(tipo,arr); }
        input.value = '';
    },

    _removeP(tipo, idx) {
        const arr = tipo==='quente' ? monState.palavrasQuente : tipo==='morno' ? monState.palavrasMorno : monState.palavrasBloqueado;
        arr.splice(idx,1);
        monRenderChips(tipo,arr);
    },

    async salvarClassificacao() {
        const dados = {
            palavras_quentes:   monState.palavrasQuente,
            palavras_mornos:    monState.palavrasMorno,
            palavras_bloqueado: monState.palavrasBloqueado,
            pontos:             monState.pontos,
            atualizadoEm:       serverTimestamp(),
        };
        try {
            await setDoc(doc(db,'config','robo_classificacao'), dados);
            toast('✅ Classificação salva — o robô lerá na próxima inicialização.');
        } catch(e) { toast('❌ Erro ao salvar'); console.error(e); }
    },

    async atualizarAtividade() { await monCarregarAtividade(); },

    async init() {
        await monCarregarClassificacao();
        await monCarregarAtividade();
        // listener em tempo real no status do robô
        if (!monState.unsubStatus) {
            monState.unsubStatus = onSnapshot(doc(db,'config','robo_status'), (snap) => {
                monRenderStatus(snap.exists() ? snap.data() : null);
            }, (e) => { console.error('Monitor onSnapshot:', e); monRenderStatus(null); });
        }
    },

    destroy() {
        if (monState.unsubStatus) { monState.unsubStatus(); monState.unsubStatus=null; }
    },
};

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO CATEGORIAS
// Coleção Firestore: categorias_wpp/{id}
// Campos: nome, descricao, cor, status, tags[], telefones[], mensagens[],
//         anotacoes[], campanhas[], stats{enviados,respostas,conversas,clientes}
// Telefone: {numero, status, pontos, obs, dataCadastro, ultimoEnvio, ultimaResposta, totalEnviados, totalRespostas}
// ══════════════════════════════════════════════════════════════════════════════

const CATS_COL = 'categorias_wpp';

const CAT_CORES = [
    '#2563eb','#7c3aed','#db2777','#dc2626','#d97706',
    '#059669','#0891b2','#ea580c','#9333ea','#16a34a',
];

const CAT_SUGESTOES = [
    'Advogados','Clínicas','Escritórios','Contabilidade',
    'Auto Escolas','Igrejas','Mercados','Farmácias','Outros',
];

const TEL_STATUS = {
    nunca_contatado: { emoji: '⬜', label: 'Nunca Contatado' },
    contatado:       { emoji: '📤', label: 'Contatado' },
    respondeu:       { emoji: '💬', label: 'Respondeu' },
    lead_quente:     { emoji: '🔥', label: 'Lead Quente' },
    lead_morno:      { emoji: '🌡️', label: 'Lead Morno' },
    lead_frio:       { emoji: '❄️', label: 'Lead Frio' },
    cliente:         { emoji: '⭐', label: 'Cliente' },
    bloqueado:       { emoji: '🔴', label: 'Bloqueado' },
    invalido:        { emoji: '⚫', label: 'Inválido' },
};

const MSG_STATUS = {
    rascunho:  { emoji: '✏️', label: 'Rascunho' },
    aprovada:  { emoji: '✅', label: 'Aprovada' },
    arquivada: { emoji: '📦', label: 'Arquivada' },
};

const CAMP_STATUS_MAP = {
    rascunho:  { emoji: '✏️', label: 'Rascunho' },
    ativa:     { emoji: '🚀', label: 'Ativa' },
    concluida: { emoji: '✅', label: 'Concluída' },
};

const catState = {
    lista:       [],
    atual:       null,
    corSel:      CAT_CORES[0],
    tagsDraft:   [],
    filtroStatus: '',
    filtroBusca:  '',
    modalTelIdx:  null,
};

function catEsc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function catFmt(iso) {
    if (!iso) return '—';
    const [y,m,d] = iso.slice(0,10).split('-');
    return `${d}/${m}/${y}`;
}

function hoje() { return new Date().toISOString().slice(0,10); }

// Normaliza telefone: retrocompatibilidade (dados antigos eram string)
function normTel(t) {
    if (typeof t === 'string') {
        return { numero: t, status: 'nunca_contatado', pontos: 0, obs: '', dataCadastro: '', ultimoEnvio: null, ultimaResposta: null, totalEnviados: 0, totalRespostas: 0 };
    }
    return {
        numero: t.numero || '',
        status: t.status || 'nunca_contatado',
        pontos: t.pontos || 0,
        obs: t.obs || '',
        dataCadastro: t.dataCadastro || '',
        ultimoEnvio: t.ultimoEnvio || null,
        ultimaResposta: t.ultimaResposta || null,
        totalEnviados: t.totalEnviados || 0,
        totalRespostas: t.totalRespostas || 0,
    };
}

// ── Listener em tempo real (ativo quando um detalhe está aberto) ──────────────
let catUnsubscribeDoc = null;

function catEscutarDoc(id) {
    if (catUnsubscribeDoc) { catUnsubscribeDoc(); catUnsubscribeDoc = null; }
    catUnsubscribeDoc = onSnapshot(doc(db, CATS_COL, id), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.telefones) data.telefones = data.telefones.map(normTel);
        const updated = { id: snap.id, ...data };
        const idx = catState.lista.findIndex(c => c.id === id);
        if (idx >= 0) catState.lista[idx] = updated;
        else catState.lista.push(updated);
        if (catState.atual?.id === id) {
            catState.atual = updated;
            catRenderDetalhe();
        }
        catRenderLista();
    }, (e) => console.error('catSnapshot:', e));
}

function catPararListener() {
    if (catUnsubscribeDoc) { catUnsubscribeDoc(); catUnsubscribeDoc = null; }
}

// ── Firestore ─────────────────────────────────────────────────────────────────
async function catCarregar() {
    const snap = await getDocs(collection(db, CATS_COL));
    catState.lista = snap.docs.map(d => {
        const data = d.data();
        if (data.telefones) data.telefones = data.telefones.map(normTel);
        return { id: d.id, ...data };
    });
    catState.lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
    catRenderLista();
}

async function catUpdate(id, campos) {
    await updateDoc(doc(db, CATS_COL, id), campos);
}

// ── Render lista ──────────────────────────────────────────────────────────────
function catRenderLista() {
    const el = document.getElementById('list-cats');
    if (!el) return;
    const busca = (catState.filtroBusca || '').toLowerCase().trim();
    let lista = catState.lista;
    if (busca) {
        lista = lista.filter(c => {
            if ((c.nome||'').toLowerCase().includes(busca)) return true;
            if ((c.descricao||'').toLowerCase().includes(busca)) return true;
            if ((c.tags||[]).some(t => t.toLowerCase().includes(busca))) return true;
            if ((c.telefones||[]).some(t => normTel(t).numero.includes(busca))) return true;
            if ((c.mensagens||[]).some(m => (m.titulo||'').toLowerCase().includes(busca) || (m.texto||'').toLowerCase().includes(busca))) return true;
            return false;
        });
    }
    if (!lista.length) {
        el.innerHTML = `<div class="empty">${busca ? 'Nenhuma categoria encontrada.' : 'Nenhuma categoria cadastrada.'}</div>`
            + (!busca ? `<div class="cat-sugestoes"><div class="cat-sug-titulo">Sugestões para começar</div><div class="cat-sug-chips">${CAT_SUGESTOES.map(s=>`<button class="cat-sug-chip" onclick="Categorias.sugerirCat('${catEsc(s)}')">${catEsc(s)}</button>`).join('')}</div></div>` : '');
        return;
    }
    el.innerHTML = lista.map(c => {
        const tels  = (c.telefones||[]).map(normTel);
        const nTel  = tels.length;
        const nHot  = tels.filter(t=>t.status==='lead_quente').length;
        const nMsg  = (c.mensagens||[]).length;
        const nAnot = (c.anotacoes||[]).length;
        const nCamp = (c.campanhas||[]).length;
        const cor   = c.cor || CAT_CORES[0];
        const tags  = (c.tags||[]).slice(0,3);
        return `<div class="cat-card${c.status==='inativa'?' inativa':''}" onclick="Categorias.abrirDetalhe('${catEsc(c.id)}')">
            <div class="cat-card-cor" style="background:${cor}1a;border:1px solid ${cor}44">📁</div>
            <div class="cat-card-body">
                <div class="cat-card-nome">${catEsc(c.nome)}${c.status==='inativa'?'<span class="cat-status-inativa">Inativa</span>':''}</div>
                ${c.descricao?`<div class="cat-card-desc">${catEsc(c.descricao)}</div>`:''}
                <div class="cat-card-counts">
                    <span>📞 ${nTel}</span>
                    ${nHot?`<span>🔥 ${nHot} quentes</span>`:''}
                    <span>💬 ${nMsg}</span>
                    ${nAnot?`<span>📝 ${nAnot}</span>`:''}
                    ${nCamp?`<span>🚀 ${nCamp}</span>`:''}
                </div>
                ${tags.length?`<div class="cat-card-tags">${tags.map(t=>`<span class="cat-card-tag">${catEsc(t)}</span>`).join('')}${(c.tags||[]).length>3?`<span class="cat-card-tag">+${(c.tags||[]).length-3}</span>`:''}</div>`:''}
            </div>
            <div class="cat-card-actions" onclick="event.stopPropagation()">
                <button class="btn-edit"   onclick="Categorias.editarCat('${catEsc(c.id)}')" title="Editar">✏️</button>
                <button class="btn-delete" onclick="Categorias.excluirCat('${catEsc(c.id)}')" title="Excluir">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

// ── Render detalhe ────────────────────────────────────────────────────────────
function catRenderDetalhe() {
    const c = catState.atual; if (!c) return;
    const cor = c.cor || CAT_CORES[0];
    const corEl = document.getElementById('cat-det-cor');
    if (corEl) { corEl.style.background = cor; corEl.style.boxShadow = `0 0 10px ${cor}`; }
    const nomeEl = document.getElementById('cat-det-nome');
    if (nomeEl) nomeEl.textContent = c.nome;
    const stEl = document.getElementById('cat-det-status');
    if (stEl) stEl.style.display = c.status === 'inativa' ? '' : 'none';
    const descEl = document.getElementById('cat-det-desc');
    if (descEl) descEl.textContent = c.descricao || '';
    const tagsEl = document.getElementById('cat-det-tags');
    if (tagsEl) tagsEl.innerHTML = (c.tags||[]).map(t=>`<span class="cat-tag-pill">${catEsc(t)}</span>`).join('');
    catRenderTelefones();
    catRenderMensagens();
    catRenderAnotacoes();
    catRenderCampanhas();
    catRenderStats();
}

function catRenderTelefones() {
    const c = catState.atual; if (!c) return;
    const countEl = document.getElementById('cat-tel-count');
    const listEl  = document.getElementById('list-cat-tel');
    if (!listEl) return;
    const todos    = (c.telefones||[]).map(normTel);
    const filtroBusca  = catState.filtroBusca && !catState.atual ? '' : (document.getElementById('cat-tel-busca')?.value || '').toLowerCase();
    const filtroStatus = catState.filtroStatus;
    const indexados = todos.map((t, i) => ({ ...t, _idx: i }));
    const lista = indexados.filter(t => {
        const matchBusca  = !filtroBusca  || t.numero.includes(filtroBusca);
        const matchStatus = !filtroStatus || t.status === filtroStatus;
        return matchBusca && matchStatus;
    });
    const nTotais = todos.length;
    const nFilt   = lista.length;
    if (countEl) countEl.textContent = filtroStatus || filtroBusca
        ? `${nFilt} de ${nTotais} telefone${nTotais!==1?'s':''}`
        : `${nTotais} telefone${nTotais!==1?'s':''}`;
    if (!lista.length) {
        listEl.innerHTML = `<div class="empty">${filtroStatus||filtroBusca ? 'Nenhum número neste filtro.' : 'Nenhum telefone cadastrado.'}</div>`;
        return;
    }
    listEl.innerHTML = lista.map(t => {
        const st = TEL_STATUS[t.status] || TEL_STATUS.nunca_contatado;
        const pontos = t.pontos || 0;
        const selectOpts = Object.entries(TEL_STATUS)
            .map(([k,v])=>`<option value="${k}"${k===t.status?' selected':''}>${v.emoji} ${v.label}</option>`).join('');
        return `<div class="cat-tel-item">
            <span class="cat-tel-numero" onclick="Categorias.abrirModalTel(${t._idx})" style="cursor:pointer" title="Ver detalhes">${catEsc(t.numero)}</span>
            ${pontos?`<span class="cat-tel-meta" title="Pontuação">${pontos>0?'+':''}${pontos}pts</span>`:''}
            <select class="cat-tel-select" onchange="Categorias.mudarStatusTel(${t._idx},this.value)" title="Status do lead">
                ${selectOpts}
            </select>
            <button class="btn-delete" onclick="Categorias.removerTel(${t._idx})" title="Remover">🗑️</button>
        </div>`;
    }).join('');
}

function catRenderMensagens() {
    const c = catState.atual; if (!c) return;
    const countEl = document.getElementById('cat-msg-count');
    const listEl  = document.getElementById('list-cat-msg');
    if (!listEl) return;
    const msgs = c.mensagens || [];
    if (countEl) countEl.textContent = `${msgs.length} mensagem${msgs.length!==1?'ns':''}`;
    if (!msgs.length) { listEl.innerHTML = '<div class="empty">Nenhuma mensagem cadastrada.</div>'; return; }
    listEl.innerHTML = msgs.map((m, idx) => {
        const st = MSG_STATUS[m.status] || MSG_STATUS.rascunho;
        return `<div class="cat-msg-card">
            <div class="cat-msg-header">
                <span class="cat-msg-titulo">💬 ${catEsc(m.titulo || `Mensagem ${idx+1}`)}</span>
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                    <span class="cat-msg-status-badge ${m.status==='aprovada'?'aprovada':m.status==='arquivada'?'arquivada':''}">${st.emoji} ${st.label}</span>
                    <div class="item-actions">
                        <button class="btn-edit"   onclick="Categorias.editarMsg(${idx})"   title="Editar">✏️</button>
                        <button class="btn-edit"   onclick="Categorias.duplicarMsg(${idx})" title="Duplicar" style="font-size:12px">📋</button>
                        <button class="btn-delete" onclick="Categorias.removerMsg(${idx})"  title="Remover">🗑️</button>
                    </div>
                </div>
            </div>
            <div class="cat-msg-texto">${catEsc(m.texto||'')}</div>
        </div>`;
    }).join('');
}

function catRenderAnotacoes() {
    const c = catState.atual; if (!c) return;
    const countEl = document.getElementById('cat-anot-count');
    const listEl  = document.getElementById('list-cat-anot');
    if (!listEl) return;
    const anots = c.anotacoes || [];
    if (countEl) countEl.textContent = `${anots.length} anotaç${anots.length!==1?'ões':'ão'}`;
    if (!anots.length) { listEl.innerHTML = '<div class="empty">Nenhuma anotação cadastrada.</div>'; return; }
    listEl.innerHTML = anots.map((a, idx) => `
        <div class="cat-anot-card">
            <div class="cat-anot-texto">${catEsc(a.texto||'')}</div>
            <div class="item-actions">
                <button class="btn-edit"   onclick="Categorias.editarAnot(${idx})"  title="Editar">✏️</button>
                <button class="btn-delete" onclick="Categorias.removerAnot(${idx})" title="Remover">🗑️</button>
            </div>
        </div>`).join('');
}

function catRenderCampanhas() {
    const c = catState.atual; if (!c) return;
    const countEl = document.getElementById('cat-camp-count');
    const listEl  = document.getElementById('list-cat-camp');
    if (!listEl) return;
    const camps = c.campanhas || [];
    if (countEl) countEl.textContent = `${camps.length} campanha${camps.length!==1?'s':''}`;
    if (!camps.length) { listEl.innerHTML = '<div class="empty">Nenhuma campanha cadastrada.</div>'; return; }
    listEl.innerHTML = camps.map((camp, idx) => {
        const st = CAMP_STATUS_MAP[camp.status] || CAMP_STATUS_MAP.rascunho;
        return `<div class="cat-camp-card">
            <div class="cat-camp-info">
                <div class="cat-camp-nome">🚀 ${catEsc(camp.nome)}</div>
                ${camp.criadoEm?`<div class="cat-camp-data">${catFmt(camp.criadoEm)}</div>`:''}
            </div>
            <span class="cat-camp-status ${camp.status==='ativa'?'ativa':camp.status==='concluida'?'concluida':''}">${st.emoji} ${st.label}</span>
            <div class="item-actions">
                <button class="btn-edit"   onclick="Categorias.editarCamp(${idx})"  title="Editar">✏️</button>
                <button class="btn-delete" onclick="Categorias.removerCamp(${idx})" title="Remover">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

function catRenderStats() {
    const c = catState.atual; if (!c) return;
    const el = document.getElementById('cat-stats-grid');
    if (!el) return;
    const tels = (c.telefones||[]).map(normTel);
    const nTel = tels.length;
    const byStatus = (st) => tels.filter(t=>t.status===st).length;
    const nQuente  = byStatus('lead_quente');
    const nMorno   = byStatus('lead_morno');
    const nFrio    = byStatus('lead_frio');
    const nCliente = byStatus('cliente');
    const nResp    = byStatus('respondeu');
    const nMsg     = (c.mensagens||[]).filter(m=>m.status==='aprovada').length;
    const nCamp    = (c.campanhas||[]).length;
    const stats    = c.stats || {};
    const enviados  = stats.enviados  || 0;
    const respostas = stats.respostas || 0;
    const taxa = enviados > 0 ? ((respostas/enviados)*100).toFixed(1)+'%' : '—';
    const itens = [
        { valor: nTel,     label: 'Telefones',     emoji: '📞' },
        { valor: nQuente,  label: 'Leads Quentes', emoji: '🔥' },
        { valor: nMorno,   label: 'Leads Mornos',  emoji: '🌡️' },
        { valor: nFrio,    label: 'Leads Frios',   emoji: '❄️' },
        { valor: nResp,    label: 'Responderam',   emoji: '💬' },
        { valor: nCliente, label: 'Clientes',       emoji: '⭐' },
        { valor: nMsg,     label: 'Msg Aprovadas',  emoji: '✅' },
        { valor: nCamp,    label: 'Campanhas',      emoji: '🚀' },
        { valor: enviados, label: 'Enviados',       emoji: '📤' },
        { valor: taxa,     label: 'Taxa Resposta',  emoji: '📊' },
    ];
    el.innerHTML = itens.map(s => `
        <div class="cat-stat-card">
            <div class="cat-stat-valor">${catEsc(String(s.valor))}</div>
            <div class="cat-stat-label">${s.emoji} ${catEsc(s.label)}</div>
        </div>`).join('');
}

// ── Paleta de cores ───────────────────────────────────────────────────────────
function catRenderCores(sel) {
    const el = document.getElementById('cat-cores'); if (!el) return;
    el.innerHTML = CAT_CORES.map(c =>
        `<button type="button" class="cat-cor-btn${c===sel?' ativa':''}" style="background:${c}" title="${c}"
            onclick="Categorias._selectCor('${c}')"></button>`
    ).join('');
}

function catRenderTagsDraft() {
    const el = document.getElementById('cat-f-tags-chips'); if (!el) return;
    el.innerHTML = catState.tagsDraft.map((t,i) =>
        `<span class="cat-tag-chip">${catEsc(t)}<button class="cat-tag-chip-x" onclick="Categorias._removeTag(${i})" title="Remover">×</button></span>`
    ).join('');
}

// ── Modal detalhe do telefone ─────────────────────────────────────────────────
function catRenderModalTel(idx) {
    const c = catState.atual; if (!c) return;
    const t = normTel((c.telefones||[])[idx]);
    if (!t.numero) return;
    const modal = document.getElementById('cat-tel-modal');
    const numEl = document.getElementById('cat-tel-modal-num');
    const bodyEl = document.getElementById('cat-tel-modal-body');
    if (numEl) numEl.textContent = t.numero;
    const st = TEL_STATUS[t.status] || TEL_STATUS.nunca_contatado;
    const selectOpts = Object.entries(TEL_STATUS)
        .map(([k,v])=>`<option value="${k}"${k===t.status?' selected':''}>${v.emoji} ${v.label}</option>`).join('');
    if (bodyEl) bodyEl.innerHTML = `
        <div class="cat-tel-modal-row"><span class="cat-tel-modal-lbl">Categoria</span><span>${catEsc(c.nome)}</span></div>
        <div class="cat-tel-modal-row">
            <span class="cat-tel-modal-lbl">Status</span>
            <select class="cat-tel-select" onchange="Categorias.mudarStatusTel(${idx},this.value)">
                ${selectOpts}
            </select>
        </div>
        <div class="cat-tel-modal-row"><span class="cat-tel-modal-lbl">Pontuação</span><span>${t.pontos>0?'+':''}${t.pontos} pts</span></div>
        <div class="cat-tel-modal-row"><span class="cat-tel-modal-lbl">Data de Cadastro</span><span>${catFmt(t.dataCadastro)}</span></div>
        <div class="cat-tel-modal-row"><span class="cat-tel-modal-lbl">Último Envio</span><span>${catFmt(t.ultimoEnvio)}</span></div>
        <div class="cat-tel-modal-row"><span class="cat-tel-modal-lbl">Última Resposta</span><span>${catFmt(t.ultimaResposta)}</span></div>
        <div class="cat-tel-modal-row"><span class="cat-tel-modal-lbl">Total Enviados</span><span>${t.totalEnviados}</span></div>
        <div class="cat-tel-modal-row"><span class="cat-tel-modal-lbl">Total Respostas</span><span>${t.totalRespostas}</span></div>
        <div class="cat-tel-modal-row" style="flex-direction:column;gap:6px">
            <span class="cat-tel-modal-lbl">Observação</span>
            <textarea class="field cat-textarea" id="modal-tel-obs" rows="3" maxlength="200"
                placeholder="Anotação sobre este contato...">${catEsc(t.obs||'')}</textarea>
        </div>`;
    if (modal) modal.classList.add('open');
    catState.modalTelIdx = idx;
}

// ── API pública ───────────────────────────────────────────────────────────────
window.Categorias = {

    _selectCor(cor) { catState.corSel = cor; catRenderCores(cor); },

    _addTag() {
        const input = document.getElementById('cat-f-tag-input');
        if (!input) return;
        const tag = input.value.trim();
        if (!tag || catState.tagsDraft.includes(tag)) { input.value = ''; return; }
        catState.tagsDraft.push(tag);
        input.value = '';
        catRenderTagsDraft();
    },

    _removeTag(idx) { catState.tagsDraft.splice(idx,1); catRenderTagsDraft(); },

    pesquisar(v) { catState.filtroBusca = v; catRenderLista(); },

    // ── Categoria CRUD ──────────────────────────────────────────────────────────

    abrirFormCat(id) {
        const form = document.getElementById('form-cat'); if (!form) return;
        document.getElementById('cat-f-id').value = id || '';
        if (id) {
            const c = catState.lista.find(x=>x.id===id);
            if (c) {
                document.getElementById('cat-f-nome').value   = c.nome       || '';
                document.getElementById('cat-f-desc').value   = c.descricao  || '';
                document.getElementById('cat-f-status').value = c.status     || 'ativa';
                catState.corSel    = c.cor   || CAT_CORES[0];
                catState.tagsDraft = [...(c.tags||[])];
            }
        } else {
            document.getElementById('cat-f-nome').value   = '';
            document.getElementById('cat-f-desc').value   = '';
            document.getElementById('cat-f-status').value = 'ativa';
            catState.corSel    = CAT_CORES[0];
            catState.tagsDraft = [];
        }
        catRenderCores(catState.corSel);
        catRenderTagsDraft();
        form.classList.remove('hidden');
        document.getElementById('cat-f-nome')?.focus();
    },

    fecharFormCat() {
        document.getElementById('form-cat')?.classList.add('hidden');
        catState.tagsDraft = [];
    },

    async salvarCat() {
        const nome   = document.getElementById('cat-f-nome').value.trim();
        const desc   = document.getElementById('cat-f-desc').value.trim();
        const status = document.getElementById('cat-f-status').value;
        const cor    = catState.corSel || CAT_CORES[0];
        const tags   = [...catState.tagsDraft];
        const id     = document.getElementById('cat-f-id').value;
        if (!nome) { toast('⚠️ Preencha o nome.'); return; }
        const dados  = { nome, descricao: desc, cor, status, tags };
        try {
            if (id) {
                await catUpdate(id, dados);
                const idx = catState.lista.findIndex(c=>c.id===id);
                if (idx>=0) Object.assign(catState.lista[idx], dados);
                toast('✅ Categoria atualizada');
            } else {
                const docData = { ...dados, telefones:[], mensagens:[], anotacoes:[], campanhas:[], stats:{enviados:0,respostas:0,conversas:0,clientes:0}, criadoEm: serverTimestamp() };
                const ref = await addDoc(collection(db, CATS_COL), docData);
                catState.lista.push({ id: ref.id, ...docData });
                catState.lista.sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt'));
                toast('✅ Categoria criada');
            }
            this.fecharFormCat();
            catRenderLista();
        } catch(e) { toast('❌ Erro ao salvar'); console.error(e); }
    },

    editarCat(id) { this.abrirFormCat(id); },

    async excluirCat(id) {
        const c = catState.lista.find(x=>x.id===id);
        if (!confirm(`Excluir a categoria "${c?.nome}"?\nTodos os dados serão removidos.`)) return;
        try {
            await deleteDoc(doc(db, CATS_COL, id));
            catState.lista = catState.lista.filter(x=>x.id!==id);
            toast('🗑 Categoria excluída');
            catRenderLista();
        } catch(e) { toast('❌ Erro ao excluir'); console.error(e); }
    },

    sugerirCat(nome) { this.abrirFormCat(); document.getElementById('cat-f-nome').value = nome; },

    // ── Navegação ───────────────────────────────────────────────────────────────

    abrirDetalhe(id) {
        const c = catState.lista.find(x=>x.id===id); if (!c) return;
        catState.atual        = c;
        catState.filtroStatus = '';
        catState.filtroBusca  = '';
        document.getElementById('cat-view-lista').style.display   = 'none';
        document.getElementById('cat-view-detalhe').style.display = '';
        document.querySelectorAll('.cat-sub-tab').forEach((b,i)   => b.classList.toggle('active', i===0));
        document.querySelectorAll('.cat-sub-panel').forEach((p,i) => p.classList.toggle('active', i===0));
        ['form-tel','form-importar','form-msg','form-anot','form-camp'].forEach(fid => document.getElementById(fid)?.classList.add('hidden'));
        const busca = document.getElementById('cat-tel-busca');
        if (busca) busca.value = '';
        document.querySelectorAll('.cat-tel-filtro').forEach(b=>b.classList.toggle('active', b.dataset.status===''));
        catRenderDetalhe();
        catEscutarDoc(id); // listener em tempo real — robô atualiza, CRM reflete automaticamente
    },

    voltarLista() {
        catPararListener();
        catState.atual        = null;
        catState.filtroStatus = '';
        document.getElementById('cat-view-lista').style.display   = '';
        document.getElementById('cat-view-detalhe').style.display = 'none';
    },

    // ── Telefones ───────────────────────────────────────────────────────────────

    filtrarStatus(s) {
        catState.filtroStatus = s;
        document.querySelectorAll('.cat-tel-filtro').forEach(b=>b.classList.toggle('active', b.dataset.status===s));
        catRenderTelefones();
    },

    filtrarBusca(v) {
        catRenderTelefones();
    },

    abrirFormTel() {
        document.getElementById('form-tel')?.classList.remove('hidden');
        document.getElementById('tel-f-numero')?.focus();
    },

    fecharFormTel() {
        document.getElementById('form-tel')?.classList.add('hidden');
        const num = document.getElementById('tel-f-numero'); if(num) num.value='';
        const st  = document.getElementById('tel-f-status'); if(st)  st.value='nunca_contatado';
        const obs = document.getElementById('tel-f-obs');    if(obs) obs.value='';
    },

    async salvarTel() {
        const c   = catState.atual;
        const num = (document.getElementById('tel-f-numero')?.value||'').replace(/\D/g,'');
        const st  = document.getElementById('tel-f-status')?.value || 'nunca_contatado';
        const obs = (document.getElementById('tel-f-obs')?.value||'').trim();
        if (!num) { toast('⚠️ Digite o número.'); return; }
        const tels = (c.telefones||[]).map(normTel);
        if (tels.some(t=>t.numero===num)) { toast('⚠️ Número já cadastrado.'); return; }
        const novo = { numero:num, status:st, pontos:0, obs, dataCadastro:hoje(), ultimoEnvio:null, ultimaResposta:null, totalEnviados:0, totalRespostas:0 };
        c.telefones = [...tels, novo];
        try {
            await catUpdate(c.id, { telefones: c.telefones });
            toast('✅ Telefone adicionado');
            this.fecharFormTel();
            catRenderTelefones(); catRenderStats();
        } catch(e) { c.telefones=tels; toast('❌ Erro ao salvar'); console.error(e); }
    },

    async mudarStatusTel(idx, novoStatus) {
        const c = catState.atual;
        const tels = (c.telefones||[]).map(normTel);
        if (!tels[idx]) return;
        const ant = tels[idx].status;
        tels[idx] = { ...tels[idx], status: novoStatus };
        c.telefones = tels;
        try {
            await catUpdate(c.id, { telefones: tels });
            catRenderTelefones(); catRenderStats();
            // re-render modal if open
            if (catState.modalTelIdx === idx) catRenderModalTel(idx);
        } catch(e) { tels[idx].status=ant; c.telefones=tels; toast('❌ Erro ao atualizar'); console.error(e); }
    },

    async removerTel(idx) {
        const c = catState.atual;
        const tels = (c.telefones||[]).map(normTel);
        const removido = tels.splice(idx,1)[0];
        c.telefones = tels;
        try {
            await catUpdate(c.id, { telefones: tels });
            toast('🗑 Telefone removido');
            catRenderTelefones(); catRenderStats();
        } catch(e) { tels.splice(idx,0,removido); c.telefones=tels; toast('❌ Erro ao remover'); console.error(e); }
    },

    toggleImportar() {
        const el = document.getElementById('form-importar'); if (!el) return;
        el.classList.contains('hidden') ? (el.classList.remove('hidden'), document.getElementById('importar-lista')?.focus()) : el.classList.add('hidden');
    },

    fecharImportar() {
        document.getElementById('form-importar')?.classList.add('hidden');
        const el = document.getElementById('importar-lista'); if(el) el.value='';
    },

    async importarTelefones() {
        const c   = catState.atual;
        const raw = document.getElementById('importar-lista')?.value || '';
        const tels = (c.telefones||[]).map(normTel);
        const nums  = new Set(tels.map(t=>t.numero));
        const novos = raw.split('\n')
            .map(l=>l.replace(/\D/g,''))
            .filter(n=>n.length>=8 && !nums.has(n))
            .map(n=>({ numero:n, status:'nunca_contatado', pontos:0, obs:'', dataCadastro:hoje(), ultimoEnvio:null, ultimaResposta:null, totalEnviados:0, totalRespostas:0 }));
        if (!novos.length) { toast('⚠️ Nenhum número novo encontrado.'); return; }
        const novaLista = [...tels, ...novos];
        c.telefones = novaLista;
        try {
            await catUpdate(c.id, { telefones: novaLista });
            toast(`✅ ${novos.length} número${novos.length!==1?'s':''} importado${novos.length!==1?'s':''}`);
            this.fecharImportar();
            catRenderTelefones(); catRenderStats();
        } catch(e) { c.telefones=tels; toast('❌ Erro ao importar'); console.error(e); }
    },

    // ── Modal detalhe do telefone ─────────────────────────────────────────────

    abrirModalTel(idx) { catRenderModalTel(idx); },

    fecharModalTel() {
        document.getElementById('cat-tel-modal')?.classList.remove('open');
        catState.modalTelIdx = null;
    },

    async salvarObsTel() {
        const idx = catState.modalTelIdx;
        if (idx === null) return;
        const c    = catState.atual;
        const tels = (c.telefones||[]).map(normTel);
        if (!tels[idx]) return;
        const obs = (document.getElementById('modal-tel-obs')?.value||'').trim();
        const ant = tels[idx].obs;
        tels[idx] = { ...tels[idx], obs };
        c.telefones = tels;
        try {
            await catUpdate(c.id, { telefones: tels });
            toast('✅ Observação salva');
            this.fecharModalTel();
            catRenderTelefones();
        } catch(e) { tels[idx].obs=ant; c.telefones=tels; toast('❌ Erro ao salvar'); console.error(e); }
    },

    // ── Mensagens ───────────────────────────────────────────────────────────────

    abrirFormMsg(idx) {
        const form = document.getElementById('form-msg'); if (!form) return;
        const idxEl = document.getElementById('msg-f-idx');
        if (idx !== undefined) {
            const m = (catState.atual?.mensagens||[])[idx];
            if (m) {
                document.getElementById('msg-f-titulo').value = m.titulo || '';
                document.getElementById('msg-f-texto').value  = m.texto  || '';
                document.getElementById('msg-f-status').value = m.status || 'rascunho';
                if (idxEl) idxEl.value = idx;
            }
        } else {
            document.getElementById('msg-f-titulo').value = '';
            document.getElementById('msg-f-texto').value  = '';
            document.getElementById('msg-f-status').value = 'rascunho';
            if (idxEl) idxEl.value = '';
        }
        form.classList.remove('hidden');
        document.getElementById('msg-f-titulo')?.focus();
    },

    fecharFormMsg() {
        document.getElementById('form-msg')?.classList.add('hidden');
        const el = document.getElementById('msg-f-idx'); if(el) el.value='';
    },

    async salvarMsg() {
        const c      = catState.atual;
        const titulo = (document.getElementById('msg-f-titulo')?.value||'').trim();
        const texto  = (document.getElementById('msg-f-texto')?.value ||'').trim();
        const status = document.getElementById('msg-f-status')?.value || 'rascunho';
        const idxStr = document.getElementById('msg-f-idx')?.value;
        if (!titulo || !texto) { toast('⚠️ Preencha título e mensagem.'); return; }
        const nova = { titulo, texto, status };
        const msgs = [...(c.mensagens||[])];
        const editIdx = idxStr!=='' && idxStr!==undefined ? parseInt(idxStr) : NaN;
        if (!isNaN(editIdx)) { msgs[editIdx]=nova; } else { msgs.push(nova); }
        const ant = c.mensagens;
        c.mensagens = msgs;
        try {
            await catUpdate(c.id, { mensagens: msgs });
            toast(`✅ Mensagem ${!isNaN(editIdx)?'atualizada':'salva'}`);
            this.fecharFormMsg(); catRenderMensagens(); catRenderStats();
        } catch(e) { c.mensagens=ant; toast('❌ Erro ao salvar'); console.error(e); }
    },

    editarMsg(idx) { this.abrirFormMsg(idx); },

    async duplicarMsg(idx) {
        const c = catState.atual;
        const m = (c.mensagens||[])[idx]; if (!m) return;
        const nova = { ...m, titulo: m.titulo+' (cópia)', status:'rascunho' };
        c.mensagens = [...(c.mensagens||[]), nova];
        try {
            await catUpdate(c.id, { mensagens: c.mensagens });
            toast('📋 Mensagem duplicada'); catRenderMensagens();
        } catch(e) { c.mensagens.pop(); toast('❌ Erro ao duplicar'); console.error(e); }
    },

    async removerMsg(idx) {
        if (!confirm('Remover esta mensagem?')) return;
        const c = catState.atual;
        const ant = [...c.mensagens];
        c.mensagens.splice(idx,1);
        try {
            await catUpdate(c.id, { mensagens: c.mensagens });
            toast('🗑 Mensagem removida'); catRenderMensagens(); catRenderStats();
        } catch(e) { c.mensagens=ant; toast('❌ Erro ao remover'); console.error(e); }
    },

    // ── Anotações ───────────────────────────────────────────────────────────────

    abrirFormAnot(idx) {
        const form = document.getElementById('form-anot'); if (!form) return;
        const idxEl = document.getElementById('anot-f-idx');
        if (idx !== undefined) {
            const a = (catState.atual?.anotacoes||[])[idx];
            if (a) {
                document.getElementById('anot-f-texto').value = a.texto || '';
                if (idxEl) idxEl.value = idx;
            }
        } else {
            document.getElementById('anot-f-texto').value = '';
            if (idxEl) idxEl.value = '';
        }
        form.classList.remove('hidden');
        document.getElementById('anot-f-texto')?.focus();
    },

    fecharFormAnot() {
        document.getElementById('form-anot')?.classList.add('hidden');
        const idxEl = document.getElementById('anot-f-idx'); if(idxEl) idxEl.value='';
        const txt   = document.getElementById('anot-f-texto'); if(txt) txt.value='';
    },

    async salvarAnot() {
        const c      = catState.atual;
        const texto  = (document.getElementById('anot-f-texto')?.value||'').trim();
        const idxStr = document.getElementById('anot-f-idx')?.value;
        if (!texto) { toast('⚠️ Digite a anotação.'); return; }
        const nova = { texto };
        const anots = [...(c.anotacoes||[])];
        const editIdx = idxStr!=='' && idxStr!==undefined ? parseInt(idxStr) : NaN;
        if (!isNaN(editIdx)) { anots[editIdx]=nova; } else { anots.push(nova); }
        const ant = c.anotacoes;
        c.anotacoes = anots;
        try {
            await catUpdate(c.id, { anotacoes: anots });
            toast(`✅ Anotação ${!isNaN(editIdx)?'atualizada':'salva'}`);
            this.fecharFormAnot(); catRenderAnotacoes();
        } catch(e) { c.anotacoes=ant; toast('❌ Erro ao salvar'); console.error(e); }
    },

    editarAnot(idx) { this.abrirFormAnot(idx); },

    async removerAnot(idx) {
        if (!confirm('Remover esta anotação?')) return;
        const c = catState.atual;
        const ant = [...c.anotacoes];
        c.anotacoes.splice(idx,1);
        try {
            await catUpdate(c.id, { anotacoes: c.anotacoes });
            toast('🗑 Anotação removida'); catRenderAnotacoes();
        } catch(e) { c.anotacoes=ant; toast('❌ Erro ao remover'); console.error(e); }
    },

    // ── Campanhas ───────────────────────────────────────────────────────────────

    abrirFormCamp(idx) {
        const form = document.getElementById('form-camp'); if (!form) return;
        const idxEl = document.getElementById('camp-f-idx');
        if (idx !== undefined) {
            const camp = (catState.atual?.campanhas||[])[idx];
            if (camp) {
                document.getElementById('camp-f-nome').value   = camp.nome   || '';
                document.getElementById('camp-f-status').value = camp.status || 'rascunho';
                if (idxEl) idxEl.value = idx;
            }
        } else {
            document.getElementById('camp-f-nome').value   = '';
            document.getElementById('camp-f-status').value = 'rascunho';
            if (idxEl) idxEl.value = '';
        }
        form.classList.remove('hidden');
        document.getElementById('camp-f-nome')?.focus();
    },

    fecharFormCamp() {
        document.getElementById('form-camp')?.classList.add('hidden');
        const el = document.getElementById('camp-f-idx'); if(el) el.value='';
        const nm = document.getElementById('camp-f-nome'); if(nm) nm.value='';
    },

    async salvarCamp() {
        const c      = catState.atual;
        const nome   = (document.getElementById('camp-f-nome')?.value||'').trim();
        const status = document.getElementById('camp-f-status')?.value || 'rascunho';
        const idxStr = document.getElementById('camp-f-idx')?.value;
        if (!nome) { toast('⚠️ Preencha o nome da campanha.'); return; }
        const camps = [...(c.campanhas||[])];
        const editIdx = idxStr!=='' && idxStr!==undefined ? parseInt(idxStr) : NaN;
        if (!isNaN(editIdx)) {
            camps[editIdx] = { ...camps[editIdx], nome, status };
        } else {
            camps.push({ nome, status, criadoEm: hoje(), stats:{ enviados:0, respostas:0 } });
        }
        const ant = c.campanhas;
        c.campanhas = camps;
        try {
            await catUpdate(c.id, { campanhas: camps });
            toast(`✅ Campanha ${!isNaN(editIdx)?'atualizada':'criada'}`);
            this.fecharFormCamp(); catRenderCampanhas();
        } catch(e) { c.campanhas=ant; toast('❌ Erro ao salvar'); console.error(e); }
    },

    editarCamp(idx) { this.abrirFormCamp(idx); },

    async removerCamp(idx) {
        if (!confirm('Remover esta campanha?')) return;
        const c = catState.atual;
        const ant = [...c.campanhas];
        c.campanhas.splice(idx,1);
        try {
            await catUpdate(c.id, { campanhas: c.campanhas });
            toast('🗑 Campanha removida'); catRenderCampanhas();
        } catch(e) { c.campanhas=ant; toast('❌ Erro ao remover'); console.error(e); }
    },

    // ── Init ────────────────────────────────────────────────────────────────────

    async init() {
        document.querySelectorAll('.cat-sub-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cat-sub-tab').forEach(b  => b.classList.remove('active'));
                document.querySelectorAll('.cat-sub-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`cat-sub-${btn.dataset.subtab}`)?.classList.add('active');
            });
        });
        await catCarregar();
    },
};

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO TAREFAS
// Coleção: tarefas_robo/{roboSlug}  →  {roboNome, tarefas:[{id,nome,descricao,
//   recorrencia,criadoEm,status,concluidoEm,historico:[{dt}]}]}
// ══════════════════════════════════════════════════════════════════════════════

const TAR_COL = 'tarefas_robo';

const tarState = {
    robos:       [],
    roboAtual:   null,   // { slug, nome, tarefas:[] }
    editId:      null,
    histAberto:  false,
    modo:        'individual',   // 'individual' | 'lote'
    selecionando: false,
    selecionados: new Set(),
};

function tarSlug(nome) {
    return (nome || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').slice(0, 50);
}

function tarId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function tarFmt(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) + ' ' +
               d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    } catch { return '—'; }
}

function tarFmtData(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
}

function tarHoje() { return new Date().toISOString().slice(0, 10); }

function tarGetWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function tarPrecisaReset(t) {
    if (t.status !== 'concluida' || !t.concluidoEm || !t.recorrencia || t.recorrencia === 'nenhuma') return false;
    const hoje   = tarHoje();
    const concDt = t.concluidoEm.slice(0, 10);
    if (t.recorrencia === 'diaria')  return concDt < hoje;
    if (t.recorrencia === 'semanal') {
        const h = new Date(hoje + 'T12:00:00');
        const c = new Date(concDt + 'T12:00:00');
        return tarGetWeek(h) !== tarGetWeek(c) || h.getFullYear() !== c.getFullYear();
    }
    if (t.recorrencia === 'mensal') return concDt.slice(0, 7) < hoje.slice(0, 7);
    return false;
}

async function tarCarregarRobos() {
    const snap = await getDoc(doc(db, 'central_organizacao', 'robos'));
    tarState.robos = snap.exists() ? (snap.data().itens || []) : [];
}

async function tarCarregarTarefas(roboNome) {
    const slug = tarSlug(roboNome);
    const snap = await getDoc(doc(db, TAR_COL, slug));
    const tarefas = snap.exists() ? (snap.data().tarefas || []) : [];
    let mudou = false;
    tarefas.forEach(t => {
        if (tarPrecisaReset(t)) { t.status = 'pendente'; t.concluidoEm = null; mudou = true; }
    });
    if (mudou) await tarPersistir(slug, roboNome, tarefas);
    return tarefas;
}

async function tarPersistir(slug, roboNome, tarefas) {
    await setDoc(doc(db, TAR_COL, slug), { roboNome, tarefas, atualizadoEm: serverTimestamp() });
}

// ── Render ────────────────────────────────────────────────────────────────────

function tarRenderRobos() {
    const el = document.getElementById('tar-robos-lista'); if (!el) return;
    const robos = tarState.robos;
    if (!robos.length) {
        el.innerHTML = `<div class="empty">Nenhum robô cadastrado.<br>Adicione robôs na aba <strong>🤖 Robôs & IA</strong> primeiro.</div>`;
        return;
    }
    el.innerHTML = robos.map((r, i) => `
        <div class="tar-robo-card" onclick="Tarefas.abrirRobo(${i})">
            ${av(r.nome)}
            <div class="tar-robo-card-info">
                <div class="tar-robo-card-nome">${esc(r.nome)}</div>
                <div class="tar-robo-card-meta">${r.funcao ? esc(r.funcao) : 'Sem função definida'}</div>
            </div>
            <span class="tar-robo-card-badge" id="tar-badge-${i}">...</span>
        </div>`).join('');

    // Carrega badges de progresso em paralelo
    robos.forEach(async (r, i) => {
        try {
            const snap = await getDoc(doc(db, TAR_COL, tarSlug(r.nome)));
            const tarefas = snap.exists() ? (snap.data().tarefas || []) : [];
            const total = tarefas.length;
            const conc  = tarefas.filter(t => t.status === 'concluida').length;
            const badge = document.getElementById(`tar-badge-${i}`);
            if (!badge) return;
            if (!total) { badge.textContent = 'Sem tarefas'; return; }
            badge.textContent = `${conc}/${total}`;
            if (conc === total) badge.classList.add('concluido');
        } catch { const b = document.getElementById(`tar-badge-${i}`); if (b) b.textContent = '—'; }
    });
}

function tarRenderProgresso(tarefas) {
    const total = tarefas.length;
    const conc  = tarefas.filter(t => t.status === 'concluida').length;
    const pct   = total ? Math.round(conc / total * 100) : 0;
    const label = document.getElementById('tar-progresso-label');
    const fill  = document.getElementById('tar-progresso-fill');
    if (label) label.textContent = total
        ? `${conc} de ${total} tarefa${total !== 1 ? 's' : ''} concluída${conc !== 1 ? 's' : ''}`
        : 'Nenhuma tarefa cadastrada';
    if (fill) {
        fill.style.width = pct + '%';
        fill.className   = 'tar-progresso-fill' + (pct === 100 && total ? ' completo' : '');
    }
}

const TAR_REC = {
    diaria:  { label: '📅 Diária',   cls: 'diaria'  },
    semanal: { label: '📆 Semanal',  cls: 'semanal' },
    mensal:  { label: '🗓️ Mensal',   cls: 'mensal'  },
};

function tarRenderTarefas(tarefas) {
    const pendEl = document.getElementById('tar-lista-pendentes');
    const concEl = document.getElementById('tar-lista-concluidas');
    if (!pendEl || !concEl) return;

    const renderItem = t => {
        const rec  = TAR_REC[t.recorrencia];
        const conc = t.status === 'concluida';
        const sel  = tarState.selecionando && tarState.selecionados.has(t.id);
        const leftCtrl = tarState.selecionando
            ? `<input type="checkbox" class="tar-sel-checkbox" ${sel ? 'checked' : ''}
                   onchange="Tarefas.toggleSel('${t.id}',this.checked)">`
            : `<button class="tar-item-check" onclick="Tarefas.toggle('${t.id}')"
                   title="${conc ? 'Marcar como pendente' : 'Marcar como concluída'}">${conc ? '✓' : ''}</button>`;
        return `<div class="tar-item${conc ? ' concluida' : ''}${sel ? ' selecionada' : ''}" data-id="${t.id}">
            ${leftCtrl}
            <div class="tar-item-body">
                <div class="tar-item-nome">${esc(t.nome)}</div>
                ${t.descricao ? `<div class="tar-item-desc">${esc(t.descricao)}</div>` : ''}
                <div class="tar-item-meta">
                    ${rec ? `<span class="tar-item-badge ${rec.cls}">${rec.label}</span>` : ''}
                    <span>Criada ${tarFmtData(t.criadoEm)}</span>
                    ${conc && t.concluidoEm ? `<span>✓ ${tarFmt(t.concluidoEm)}</span>` : ''}
                </div>
            </div>
            ${tarState.selecionando ? '' : `
            <div class="tar-item-actions">
                <button class="btn-edit"   onclick="Tarefas.editar('${t.id}')"  title="Editar">✏️</button>
                <button class="btn-delete" onclick="Tarefas.remover('${t.id}')" title="Remover">🗑️</button>
            </div>`}
        </div>`;
    };

    const pendentes  = tarefas.filter(t => t.status !== 'concluida');
    const concluidas = tarefas.filter(t => t.status === 'concluida');

    pendEl.innerHTML = pendentes.length
        ? pendentes.map(renderItem).join('')
        : `<div style="color:var(--text3);font-size:13px;padding:12px 0 4px;text-align:center">🎉 Tudo concluído hoje!</div>`;

    concEl.innerHTML = concluidas.length
        ? concluidas.map(renderItem).join('')
        : `<div style="color:var(--text3);font-size:12px;padding:6px 0">Nenhuma tarefa concluída ainda.</div>`;

    tarRenderProgresso(tarefas);
}

function tarRenderHistorico(tarefas) {
    const el = document.getElementById('tar-historico'); if (!el) return;
    const entries = [];
    tarefas.forEach(t => (t.historico || []).forEach(h => entries.push({ nome: t.nome, dt: h.dt, rec: t.recorrencia })));
    entries.sort((a, b) => (b.dt || '').localeCompare(a.dt || ''));
    const top = entries.slice(0, 60);
    if (!top.length) {
        el.innerHTML = `<div class="empty" style="padding:24px">Nenhuma conclusão registrada ainda.</div>`;
        return;
    }
    const recBadge = r => {
        if (!r || r === 'nenhuma') return '';
        const cls = r === 'semanal' ? ' semanal' : r === 'mensal' ? ' mensal' : '';
        return `<span class="tar-hist-rec${cls}">${r}</span>`;
    };
    el.innerHTML = top.map(e => `
        <div class="tar-hist-item">
            <span class="tar-hist-nome">${esc(e.nome)}</span>
            ${recBadge(e.rec)}
            <span class="tar-hist-dt">✓ ${tarFmt(e.dt)}</span>
        </div>`).join('');
}

// ── API pública ───────────────────────────────────────────────────────────────

window.Tarefas = {

    async init() {
        await tarCarregarRobos();
        if (tarState.roboAtual) {
            const tarefas = await tarCarregarTarefas(tarState.roboAtual.nome);
            tarState.roboAtual.tarefas = tarefas;
            document.getElementById('tar-view-robos').style.display  = 'none';
            document.getElementById('tar-view-painel').style.display = '';
            document.getElementById('tar-robo-nome').textContent     = '🤖 ' + tarState.roboAtual.nome;
            tarRenderTarefas(tarefas);
        } else {
            document.getElementById('tar-view-robos').style.display  = '';
            document.getElementById('tar-view-painel').style.display = 'none';
            tarRenderRobos();
        }
    },

    async abrirRobo(idx) {
        const r = tarState.robos[idx]; if (!r) return;
        const tarefas = await tarCarregarTarefas(r.nome);
        tarState.roboAtual   = { slug: tarSlug(r.nome), nome: r.nome, tarefas };
        tarState.editId      = null;
        tarState.histAberto  = false;
        document.getElementById('tar-view-robos').style.display  = 'none';
        document.getElementById('tar-view-painel').style.display = '';
        document.getElementById('tar-robo-nome').textContent     = '🤖 ' + r.nome;
        document.getElementById('form-tarefas')?.classList.add('hidden');
        const histEl  = document.getElementById('tar-historico');
        const histBtn = document.getElementById('tar-btn-historico');
        if (histEl)  histEl.style.display = 'none';
        if (histBtn) histBtn.textContent  = 'Ver histórico';
        tarRenderTarefas(tarefas);
    },

    voltarRobos() {
        tarState.roboAtual = null;
        document.getElementById('tar-view-painel').style.display = 'none';
        document.getElementById('tar-view-robos').style.display  = '';
        tarRenderRobos();
    },

    setModo(modo) {
        tarState.modo = modo;
        const isLote = modo === 'lote';
        document.getElementById('tar-campos-individual').style.display = isLote ? 'none' : '';
        document.getElementById('tar-campos-lote').style.display       = isLote ? '' : 'none';
        document.getElementById('tar-modo-btn-individual')?.classList.toggle('active', !isLote);
        document.getElementById('tar-modo-btn-lote')?.classList.toggle('active',  isLote);
        setTimeout(() => {
            (isLote
                ? document.getElementById('tar-f-lote')
                : document.getElementById('tar-f-nome')
            )?.focus();
        }, 50);
    },

    abrirForm() {
        tarState.editId = null;
        document.getElementById('tar-edit-id').value       = '';
        document.getElementById('tar-f-nome').value        = '';
        document.getElementById('tar-f-desc').value        = '';
        document.getElementById('tar-f-lote').value        = '';
        document.getElementById('tar-f-recorrencia').value = 'nenhuma';
        document.getElementById('tar-modo-toggle').style.display = '';
        document.getElementById('form-tarefas').classList.remove('hidden');
        Tarefas.setModo('individual');
    },

    fecharForm() {
        document.getElementById('form-tarefas').classList.add('hidden');
        tarState.editId = null;
        tarState.modo   = 'individual';
    },

    editar(id) {
        const r = tarState.roboAtual; if (!r) return;
        const t = r.tarefas.find(x => x.id === id); if (!t) return;
        tarState.editId = id;
        document.getElementById('tar-edit-id').value       = id;
        document.getElementById('tar-f-nome').value        = t.nome        || '';
        document.getElementById('tar-f-desc').value        = t.descricao   || '';
        document.getElementById('tar-f-recorrencia').value = t.recorrencia || 'nenhuma';
        // Ao editar, esconde o toggle (modo fixo individual)
        document.getElementById('tar-modo-toggle').style.display = 'none';
        Tarefas.setModo('individual');
        document.getElementById('form-tarefas').classList.remove('hidden');
        document.getElementById('tar-f-nome').focus();
        document.getElementById('form-tarefas').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    async salvar() {
        const r   = tarState.roboAtual; if (!r) return;
        const rec = document.getElementById('tar-f-recorrencia').value || 'nenhuma';

        // ── Modo lote ──
        if (tarState.modo === 'lote') {
            const texto = document.getElementById('tar-f-lote').value || '';
            const nomes = texto.split('\n').map(l => l.trim()).filter(Boolean);
            if (!nomes.length) { toast('⚠️ Digite ao menos uma tarefa'); return; }
            const tarefas = [...r.tarefas];
            const hoje    = tarHoje();
            nomes.forEach(nome => tarefas.push({
                id: tarId(), nome, descricao: '', recorrencia: rec,
                criadoEm: hoje, status: 'pendente', concluidoEm: null, historico: [],
            }));
            try {
                await tarPersistir(r.slug, r.nome, tarefas);
                r.tarefas = tarefas;
                tarRenderTarefas(tarefas);
                Tarefas.fecharForm();
                toast(`✅ ${nomes.length} tarefa${nomes.length !== 1 ? 's' : ''} criada${nomes.length !== 1 ? 's' : ''}!`);
            } catch(e) { toast('❌ Erro ao salvar tarefas'); console.error(e); }
            return;
        }

        // ── Modo individual ──
        const nome = (document.getElementById('tar-f-nome').value || '').trim();
        if (!nome) { toast('⚠️ Informe o nome da tarefa'); return; }
        const desc    = (document.getElementById('tar-f-desc').value || '').trim();
        const tarefas = [...r.tarefas];
        if (tarState.editId) {
            const idx = tarefas.findIndex(x => x.id === tarState.editId);
            if (idx >= 0) tarefas[idx] = { ...tarefas[idx], nome, descricao: desc, recorrencia: rec };
        } else {
            tarefas.push({
                id: tarId(), nome, descricao: desc, recorrencia: rec,
                criadoEm: tarHoje(), status: 'pendente', concluidoEm: null, historico: [],
            });
        }
        try {
            await tarPersistir(r.slug, r.nome, tarefas);
            r.tarefas = tarefas;
            tarRenderTarefas(tarefas);
            Tarefas.fecharForm();
            toast(tarState.editId ? '✅ Tarefa atualizada' : '✅ Tarefa criada');
        } catch(e) { toast('❌ Erro ao salvar tarefa'); console.error(e); }
    },

    async toggle(id) {
        const r = tarState.roboAtual; if (!r) return;
        const tarefas = [...r.tarefas];
        const idx = tarefas.findIndex(x => x.id === id); if (idx < 0) return;
        const t   = { ...tarefas[idx] };
        const agora = new Date().toISOString();
        if (t.status === 'pendente') {
            t.status      = 'concluida';
            t.concluidoEm = agora;
            t.historico   = [...(t.historico || []), { dt: agora }];
        } else {
            t.status      = 'pendente';
            t.concluidoEm = null;
        }
        tarefas[idx] = t;
        try {
            await tarPersistir(r.slug, r.nome, tarefas);
            r.tarefas = tarefas;
            tarRenderTarefas(tarefas);
            if (t.status === 'concluida') toast('✅ Tarefa concluída!');
        } catch(e) { toast('❌ Erro ao salvar'); console.error(e); }
    },

    async remover(id) {
        if (!confirm('Remover esta tarefa?')) return;
        const r = tarState.roboAtual; if (!r) return;
        const tarefas = r.tarefas.filter(x => x.id !== id);
        try {
            await tarPersistir(r.slug, r.nome, tarefas);
            r.tarefas = tarefas;
            tarRenderTarefas(tarefas);
            toast('🗑 Tarefa removida');
        } catch(e) { toast('❌ Erro ao remover'); console.error(e); }
    },

    toggleHistorico() {
        tarState.histAberto = !tarState.histAberto;
        const el  = document.getElementById('tar-historico');
        const btn = document.getElementById('tar-btn-historico');
        if (tarState.histAberto) {
            if (el)  el.style.display = '';
            if (btn) btn.textContent  = 'Ocultar histórico';
            tarRenderHistorico(tarState.roboAtual?.tarefas || []);
        } else {
            if (el)  el.style.display = 'none';
            if (btn) btn.textContent  = 'Ver histórico';
        }
    },

    // ── Excluir todas ────────────────────────────────────────────────────
    async excluirTodas() {
        const r = tarState.roboAtual;
        if (!r || !r.tarefas.length) { toast('Nenhuma tarefa para excluir'); return; }
        const ok = confirm(`Excluir todas as ${r.tarefas.length} tarefa(s) de "${r.nome}"? Esta ação não pode ser desfeita.`);
        if (!ok) return;
        r.tarefas = [];
        try {
            await tarPersistir(r);
            tarRenderPainel();
            toast('🗑️ Todas as tarefas excluídas');
        } catch(e) { toast('❌ Erro ao excluir'); console.error(e); }
    },

    // ── Marcar todas como concluídas ─────────────────────────────────────
    async marcarTodas() {
        const r = tarState.roboAtual;
        if (!r || !r.tarefas.length) { toast('Nenhuma tarefa para marcar'); return; }
        const pendentes = r.tarefas.filter(t => t.status !== 'concluida');
        if (!pendentes.length) { toast('Todas já estão concluídas'); return; }
        const agora = new Date().toISOString();
        pendentes.forEach(t => {
            t.status      = 'concluida';
            t.concluidoEm = agora;
            if (!t.historico) t.historico = [];
            t.historico.unshift({ dt: agora });
        });
        try {
            await tarPersistir(r);
            tarRenderPainel();
            toast(`☑️ ${pendentes.length} tarefa(s) marcadas como concluídas`);
        } catch(e) { toast('❌ Erro ao salvar'); console.error(e); }
    },

    // ── Modo seleção ─────────────────────────────────────────────────────
    toggleSelecionar() {
        tarState.selecionando = !tarState.selecionando;
        tarState.selecionados.clear();
        const bar = document.getElementById('tar-sel-bar');
        const btn = document.getElementById('tar-btn-selecionar');
        if (tarState.selecionando) {
            bar?.classList.remove('hidden');
            if (btn) { btn.textContent = '☑ Selecionando'; btn.classList.add('ativo'); }
        } else {
            bar?.classList.add('hidden');
            if (btn) { btn.textContent = '☐ Selecionar'; btn.classList.remove('ativo'); }
        }
        tarRenderTarefas(tarState.roboAtual?.tarefas || []);
        tarState.selecionando && Tarefas._updateSelBar();
    },

    toggleSel(id, checked) {
        if (checked) tarState.selecionados.add(id);
        else         tarState.selecionados.delete(id);
        const item = document.querySelector(`.tar-item[data-id="${id}"]`);
        if (item) item.classList.toggle('selecionada', checked);
        Tarefas._updateSelBar();
    },

    selTodos() {
        const tarefas = tarState.roboAtual?.tarefas || [];
        tarefas.forEach(t => tarState.selecionados.add(t.id));
        tarRenderTarefas(tarefas);
        Tarefas._updateSelBar();
    },

    async marcarSelecionados() {
        const r = tarState.roboAtual;
        if (!r || !tarState.selecionados.size) { toast('Nenhuma tarefa selecionada'); return; }
        const agora = new Date().toISOString();
        let cnt = 0;
        r.tarefas.forEach(t => {
            if (tarState.selecionados.has(t.id) && t.status !== 'concluida') {
                t.status = 'concluida'; t.concluidoEm = agora;
                if (!t.historico) t.historico = [];
                t.historico.unshift({ dt: agora });
                cnt++;
            }
        });
        try {
            await tarPersistir(r);
            tarState.selecionados.clear();
            Tarefas.toggleSelecionar();
            toast(`☑️ ${cnt} tarefa(s) marcadas como concluídas`);
        } catch(e) { toast('❌ Erro ao salvar'); console.error(e); }
    },

    async excluirSelecionados() {
        const r = tarState.roboAtual;
        if (!r || !tarState.selecionados.size) { toast('Nenhuma tarefa selecionada'); return; }
        const n = tarState.selecionados.size;
        const ok = confirm(`Excluir ${n} tarefa(s) selecionada(s)? Esta ação não pode ser desfeita.`);
        if (!ok) return;
        r.tarefas = r.tarefas.filter(t => !tarState.selecionados.has(t.id));
        try {
            await tarPersistir(r);
            tarState.selecionados.clear();
            Tarefas.toggleSelecionar();
            toast(`🗑️ ${n} tarefa(s) excluídas`);
        } catch(e) { toast('❌ Erro ao excluir'); console.error(e); }
    },

    _updateSelBar() {
        const n   = tarState.selecionados.size;
        const el  = document.getElementById('tar-sel-count');
        if (el) el.textContent = `${n} selecionada${n !== 1 ? 's' : ''}`;
    },
};

// ── Init ──────────────────────────────────────────────────────────────────────
authReady.then(() => {
    Object.keys(estado).filter(k => k !== '_edit').forEach(secao => carregar(secao).catch(console.error));
    Categorias.init().catch(console.error);
});
