import { db, collection, getDocs, getDoc, doc, setDoc } from '../../scripts/firebase.js';

// ===== DEFAULTS =====
const CATEGORIAS_OS = [
    { tipo: 'primeiro_contato',   emoji: '📋', label: 'Primeiro Contato' },
    { tipo: 'orcamento',          emoji: '💰', label: 'Orçamento' },
    { tipo: 'orcamento_aprovado', emoji: '✅', label: 'Orçamento Aprovado' },
    { tipo: 'orcamento_recusado', emoji: '❌', label: 'Orçamento Recusado' },
    { tipo: 'aguardando_peca',    emoji: '⏳', label: 'Aguardando Peça' },
    { tipo: 'em_reparo',          emoji: '🔧', label: 'Em Reparo' },
    { tipo: 'servico_concluido',  emoji: '🎉', label: 'Serviço Concluído' },
    { tipo: 'pronto_retirada',    emoji: '📦', label: 'Pronto p/ Retirada' },
    { tipo: 'lembrete_retirada',  emoji: '🔔', label: 'Lembrete de Retirada' },
];

const CATEGORIAS_PV = [
    { tipo: 'pos_venda_5',  emoji: '📅', label: 'Pós-venda 5 Dias',  prazo: 5 },
    { tipo: 'pos_venda_15', emoji: '📅', label: 'Pós-venda 15 Dias', prazo: 15 },
    { tipo: 'pos_venda_30', emoji: '📅', label: 'Pós-venda 30 Dias', prazo: 30 },
];

const PADRAO_OS = {
    primeiro_contato:   `Olá, {{nome}}! 👋\n\nSua OS foi aberta e está disponível para acompanhamento.\n\n📋 OS Nº {{os}}\n\n🔗 Portal do Cliente:\n{{link_portal}}\n\n📱 Use o telefone cadastrado para acessar o portal.\n\nAgradecemos pela confiança!\nCell City Informática`,
    orcamento:          `Olá, {{nome}}! 👋\n\nO orçamento do seu {{modelo}} está pronto.\n\n📋 OS Nº {{os}}\n💰 Valor: {{valor}}\n\nAguardamos sua aprovação para prosseguir com o serviço.\n\nQualquer dúvida, estamos à disposição!\nCell City Informática`,
    orcamento_aprovado: `Olá, {{nome}}! ✅\n\nÓtimo! O orçamento do seu {{modelo}} foi aprovado.\n\nJá iniciamos o serviço e avisaremos assim que estiver concluído.\n\nCell City Informática`,
    orcamento_recusado: `Olá, {{nome}}! 📋\n\nEntendemos sua decisão.\n\nSeu {{modelo}} está disponível para retirada quando preferir.\n\n📋 OS Nº {{os}}\n\nCell City Informática`,
    aguardando_peca:    `Olá, {{nome}}! ⏳\n\nEstamos aguardando a chegada da peça para o seu {{modelo}}.\n\n📋 OS Nº {{os}}\n\nAssim que a peça chegar, iniciaremos o reparo imediatamente!\n\nCell City Informática`,
    em_reparo:          `Olá, {{nome}}! 🔧\n\nSeu {{modelo}} está em reparo.\n\n📋 OS Nº {{os}}\n\nEstamos trabalhando para finalizar o mais rápido possível!\n\nCell City Informática`,
    servico_concluido:  `Olá, {{nome}}! 🎉\n\nÓtimas notícias! O serviço do seu {{modelo}} foi concluído com sucesso.\n\n📋 OS Nº {{os}}\n\nEstamos à sua disposição!\nCell City Informática`,
    pronto_retirada:    `Olá, {{nome}}! 📦\n\nSeu {{modelo}} está pronto para retirada!\n\n📋 OS Nº {{os}}\n\nEstamos aguardando sua visita.\n\nCell City Informática`,
    lembrete_retirada:  `Olá, {{nome}}! 🔔\n\nSeu {{modelo}} está aguardando retirada há alguns dias.\n\n📋 OS Nº {{os}}\n\nQualquer dúvida, estamos à disposição!\nCell City Informática`,
};

const PADRAO_PV = {
    pos_venda_5:  `Olá, {{nome}}! 😊\n\nPassaram 5 dias desde que você retirou seu {{modelo}} aqui da Cell City.\n\nComo está funcionando tudo? Qualquer dúvida, estamos à disposição!\n\nCell City Informática`,
    pos_venda_15: `Olá, {{nome}}! 👋\n\nEsperamos que seu {{modelo}} esteja funcionando perfeitamente!\n\nTemos ofertas especiais para clientes Cell City. Gostaria de saber mais?\n\nCell City Informática`,
    pos_venda_30: `Olá, {{nome}}! 🔔\n\nJá faz 30 dias desde o serviço no seu {{modelo}}.\n\nLembre-se que sua garantia está vigente. Qualquer problema, fale conosco!\n\nCell City Informática`,
};

// ===== ESTADO =====
let templatesOS = { ...PADRAO_OS };
let templatesPV = { ...PADRAO_PV };
let abaAtual = 'templates';

// ===== INIT =====
async function init() {
    await carregarTemplates();
    renderTabs();
    mostrarAba('templates');
}

async function carregarTemplates() {
    try {
        const snap = await getDoc(doc(db, 'config', 'mensagens_whatsapp'));
        if (!snap.exists()) return;
        const data = snap.data();
        CATEGORIAS_OS.forEach(c => {
            const val = data[c.tipo];
            const texto = typeof val === 'object' ? val.texto : val;
            if (texto && texto.trim()) templatesOS[c.tipo] = texto;
        });
        CATEGORIAS_PV.forEach(c => {
            const val = data[c.tipo];
            const texto = typeof val === 'object' ? val.texto : val;
            if (texto && texto.trim()) templatesPV[c.tipo] = texto;
        });
    } catch(e) {
        console.warn('mensagens-wpp: usando padrões', e);
    }
}

// ===== RENDER =====
function renderTabs() {
    const tabs = document.getElementById('tabs');
    tabs.innerHTML = `
        <button class="tab-btn ${abaAtual === 'templates' ? 'active' : ''}" onclick="mostrarAba('templates')">⚙️ Templates</button>
        <button class="tab-btn ${abaAtual === 'historico' ? 'active' : ''}" onclick="mostrarAba('historico')">📜 Histórico</button>
    `;
}

window.mostrarAba = function(aba) {
    abaAtual = aba;
    renderTabs();
    if (aba === 'templates') renderTemplates();
    else renderHistorico();
};

function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderTemplates() {
    const content = document.getElementById('content');

    const camposOS = CATEGORIAS_OS.map(c => `
        <div class="tpl-item">
            <label class="tpl-label">${c.emoji} ${c.label}</label>
            <textarea id="tpl-${c.tipo}" class="tpl-textarea" rows="4">${esc(templatesOS[c.tipo] || PADRAO_OS[c.tipo] || '')}</textarea>
        </div>
    `).join('');

    const camposPV = CATEGORIAS_PV.map(c => `
        <div class="tpl-item">
            <label class="tpl-label">${c.emoji} ${c.label}</label>
            <textarea id="tpl-${c.tipo}" class="tpl-textarea" rows="3">${esc(templatesPV[c.tipo] || PADRAO_PV[c.tipo] || '')}</textarea>
        </div>
    `).join('');

    content.innerHTML = `
        <div class="vars-bar">
            <span class="vars-title">Variáveis disponíveis:</span>
            <span class="var-chip">{{nome}}</span>
            <span class="var-chip">{{modelo}}</span>
            <span class="var-chip">{{os}}</span>
            <span class="var-chip">{{valor}}</span>
            <span class="var-chip">{{defeito}}</span>
            <span class="var-chip">{{status}}</span>
            <span class="var-chip">{{telefone}}</span>
            <span class="var-chip">{{data}}</span>
            <span class="var-chip">{{link_portal}}</span>
        </div>

        <div class="section-title">📋 Mensagens da Ordem de Serviço</div>
        ${camposOS}

        <div class="section-title" style="margin-top:24px;">🔄 Mensagens de Pós-Venda</div>
        ${camposPV}

        <div class="action-bar">
            <button class="btn-restaurar" onclick="restaurarPadrao()">↩️ Restaurar Padrão</button>
            <button class="btn-salvar" onclick="salvarTemplates()">💾 Salvar</button>
        </div>
    `;
}

window.salvarTemplates = async function() {
    const btn = document.querySelector('.btn-salvar');
    btn.textContent = '⏳ Salvando...';
    btn.disabled = true;

    const payload = { updatedAt: new Date().toISOString() };

    CATEGORIAS_OS.forEach(c => {
        const el = document.getElementById(`tpl-${c.tipo}`);
        const texto = el ? el.value.trim() : '';
        payload[c.tipo] = { nome: c.label, texto, padrao: PADRAO_OS[c.tipo] || texto, ativo: true };
        templatesOS[c.tipo] = texto;
    });

    CATEGORIAS_PV.forEach(c => {
        const el = document.getElementById(`tpl-${c.tipo}`);
        const texto = el ? el.value.trim() : '';
        payload[c.tipo] = { nome: c.label, texto, padrao: PADRAO_PV[c.tipo] || texto, ativo: true };
        templatesPV[c.tipo] = texto;
    });

    try {
        await setDoc(doc(db, 'config', 'mensagens_whatsapp'), payload);
        showToast('✅ Mensagens salvas!');
    } catch(e) {
        showToast('❌ Erro ao salvar');
        console.error(e);
    }
    btn.textContent = '💾 Salvar';
    btn.disabled = false;
};

window.restaurarPadrao = function() {
    if (!confirm('Restaurar todos os textos para o padrão? As edições serão perdidas.')) return;
    CATEGORIAS_OS.forEach(c => {
        const el = document.getElementById(`tpl-${c.tipo}`);
        if (el) el.value = PADRAO_OS[c.tipo] || '';
    });
    CATEGORIAS_PV.forEach(c => {
        const el = document.getElementById(`tpl-${c.tipo}`);
        if (el) el.value = PADRAO_PV[c.tipo] || '';
    });
    showToast('↩️ Padrão restaurado. Clique em Salvar para confirmar.');
};

// ===== HISTÓRICO =====
async function renderHistorico() {
    const content = document.getElementById('content');
    content.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);">⏳ Carregando histórico...</div>`;

    try {
        const snap = await getDocs(collection(db, 'os'));
        const entradas = [];
        snap.forEach(d => {
            const os = d.data();
            (os.wppHistorico || []).forEach(h => {
                entradas.push({
                    ts: h.ts || '',
                    data: h.data || '',
                    hora: h.hora || '',
                    tipo: h.tipo || '',
                    label: h.label || h.tipo || '',
                    osId: os.id || d.id,
                    cliente: os.clientName || '—',
                    modelo: os.model || '—',
                });
            });
        });

        entradas.sort((a, b) => {
            if (a.ts && b.ts) return b.ts.localeCompare(a.ts);
            return (b.data + b.hora).localeCompare(a.data + a.hora);
        });

        if (entradas.length === 0) {
            content.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text3);">📭 Nenhum WhatsApp enviado ainda.</div>`;
            return;
        }

        const linhas = entradas.slice(0, 100).map(e => `
            <tr>
                <td>${e.data} ${e.hora}</td>
                <td>${e.cliente}</td>
                <td style="color:var(--text3);font-size:12px;">${e.osId}</td>
                <td>${e.modelo}</td>
                <td><span class="hist-badge">${e.label}</span></td>
            </tr>
        `).join('');

        content.innerHTML = `
            <div class="hist-count">${entradas.length} envio${entradas.length !== 1 ? 's' : ''} registrado${entradas.length !== 1 ? 's' : ''}</div>
            <div class="table-wrap">
                <table class="hist-table">
                    <thead>
                        <tr>
                            <th>Data / Hora</th>
                            <th>Cliente</th>
                            <th>OS</th>
                            <th>Modelo</th>
                            <th>Tipo</th>
                        </tr>
                    </thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>
        `;
    } catch(e) {
        content.innerHTML = `<div style="text-align:center;padding:40px;color:var(--red);">❌ Erro ao carregar histórico.</div>`;
        console.error(e);
    }
}

// ===== TOAST =====
function showToast(msg) {
    let t = document.getElementById('wpp-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'wpp-toast';
        t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1c1f1d;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:10px 20px;border-radius:12px;font-size:14px;z-index:9999;transition:opacity 0.3s;';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

init();
