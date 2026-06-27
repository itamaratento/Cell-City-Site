import { db, doc, getDoc, setDoc, serverTimestamp } from "../../scripts/firebase.js";

window.handleLogoUpload = handleLogoUpload;
window.removeLogo = removeLogo;
window.addGarantia = addGarantia;
window.removeGarantia = removeGarantia;
window.saveConfig = saveConfig;

const CONFIG_DOC = doc(db, "config", "impressao");
const CACHE_KEY = "cc_config_impressao";

const DEFAULT_LOJA = { nome: 'Cell City Informática', endereco: 'Rua 6.455, Setor Central - Goiânia', whatsapp: '(62) 98160-5863', cnpj: '' };
const DEFAULT_GARANTIAS = [
    { id: 1, nome: "Geral 90 dias", texto: "Este serviço possui garantia de 90 (noventa) dias contados a partir da data de entrega, conforme o Código de Defesa do Consumidor. A garantia cobre exclusivamente o defeito descrito nesta ordem de serviço.", padrao: false },
    { id: 2, nome: "Tela", texto: "A troca de tela possui garantia de 90 dias contra defeitos de fabricação. Não cobre danos por queda, impacto, pressão ou exposição a líquidos após a entrega.", padrao: true },
    { id: 3, nome: "Conector de carga", texto: "O conector de carga possui garantia de 90 dias. Não cobre mau uso, força excessiva ou danos causados por líquidos.", padrao: false },
    { id: 4, nome: "Celular molhado", texto: "Aparelhos com dano por líquido não possuem garantia, pois o resultado depende do grau de oxidação interna. O serviço cobre apenas a limpeza e tentativa de recuperação.", padrao: false },
    { id: 5, nome: "Notebook", texto: "O serviço em notebook possui garantia de 90 dias sobre o defeito descrito. Não cobre danos físicos ou problemas de software após a entrega.", padrao: false },
    { id: 6, nome: "Impressora", texto: "O serviço em impressora possui garantia de 90 dias sobre o defeito descrito. Não inclui consumíveis como tinta, toner ou papel.", padrao: false }
];

let config = { loja: DEFAULT_LOJA, logo: '', garantias: [] };
let nextId = 200;

async function init() {
    try {
        const snap = await getDoc(CONFIG_DOC);
        config = snap.exists() ? snap.data() : { loja: DEFAULT_LOJA, logo: '', garantias: DEFAULT_GARANTIAS };
    } catch {
        const cached = localStorage.getItem(CACHE_KEY);
        config = cached ? JSON.parse(cached) : { loja: DEFAULT_LOJA, logo: '', garantias: DEFAULT_GARANTIAS };
    }
    renderLoja();
    renderLogo();
    renderGarantias();
}

function renderLoja() {
    const l = config.loja || DEFAULT_LOJA;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('loja-nome', l.nome);
    set('loja-endereco', l.endereco);
    set('loja-whatsapp', l.whatsapp);
    set('loja-cnpj', l.cnpj);
}

function syncLoja() {
    config.loja = {
        nome:     document.getElementById('loja-nome')?.value || '',
        endereco: document.getElementById('loja-endereco')?.value || '',
        whatsapp: document.getElementById('loja-whatsapp')?.value || '',
        cnpj:     document.getElementById('loja-cnpj')?.value || ''
    };
}

function renderLogo() {
    const preview = document.getElementById('logo-preview');
    const btnDel  = document.getElementById('btn-remove-logo');
    if (!preview) return;
    if (config.logo) {
        preview.innerHTML = `<img src="${config.logo}" alt="Logo">`;
        if (btnDel) btnDel.style.display = 'inline-flex';
    } else {
        preview.innerHTML = `<span class="g-logo-empty">Sem logo</span>`;
        if (btnDel) btnDel.style.display = 'none';
    }
}

function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500000) { showToast('⚠️ Imagem muito grande. Máx 500kb.'); return; }
    const reader = new FileReader();
    reader.onload = ev => { config.logo = ev.target.result; renderLogo(); showToast('✅ Logo carregada — salve para confirmar'); };
    reader.readAsDataURL(file);
}

function removeLogo() { config.logo = ''; renderLogo(); }

function renderGarantias() {
    const list = document.getElementById('garantias-list');
    if (!list) return;
    if (!config.garantias || !config.garantias.length) {
        list.innerHTML = `<p style="color:var(--text3);font-size:13px;text-align:center;padding:20px 0">Nenhum modelo cadastrado</p>`;
        return;
    }
    list.innerHTML = config.garantias.map(g => `
    <div class="g-modelo" id="gm-${g.id}">
        <div class="g-modelo-header">
            <input class="g-modelo-nome" type="text" value="${esc(g.nome)}" placeholder="Nome do modelo">
            <label class="g-padrao-label" title="Padrão na impressão">
                <input type="checkbox" ${g.padrao ? 'checked' : ''}>
                <span class="g-padrao-txt">Padrão</span>
            </label>
            <button class="g-btn-excluir" onclick="removeGarantia(${g.id})" title="Excluir">🗑️</button>
        </div>
        <textarea class="g-modelo-texto" rows="3" placeholder="Texto do termo de garantia...">${esc(g.texto)}</textarea>
    </div>`).join('');
}

function addGarantia() {
    const id = nextId++;
    if (!config.garantias) config.garantias = [];
    syncGarantias();
    config.garantias.push({ id, nome: 'Novo modelo', texto: '', padrao: false });
    renderGarantias();
    document.getElementById(`gm-${id}`)?.scrollIntoView({ behavior: 'smooth' });
    document.querySelector(`#gm-${id} .g-modelo-nome`)?.focus();
}

function removeGarantia(id) {
    syncGarantias();
    config.garantias = config.garantias.filter(g => g.id !== id);
    renderGarantias();
}

function syncGarantias() {
    if (!config.garantias) return;
    config.garantias.forEach(g => {
        const el = document.getElementById(`gm-${g.id}`);
        if (!el) return;
        const nome  = el.querySelector('.g-modelo-nome');
        const texto = el.querySelector('.g-modelo-texto');
        const pad   = el.querySelector('input[type=checkbox]');
        if (nome)  g.nome   = nome.value;
        if (texto) g.texto  = texto.value;
        if (pad)   g.padrao = pad.checked;
    });
}

async function saveConfig() {
    syncLoja();
    syncGarantias();
    const btn = document.getElementById('btn-save');
    btn.textContent = '⏳ Salvando...';
    btn.disabled = true;
    try {
        const data = { loja: config.loja, logo: config.logo || '', garantias: config.garantias || [], updatedAt: serverTimestamp() };
        await setDoc(CONFIG_DOC, data);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ loja: data.loja, logo: data.logo, garantias: data.garantias }));
        showToast('✅ Configurações salvas!');
    } catch (err) {
        console.error(err);
        showToast('❌ Erro ao salvar. Verifique a conexão.');
    } finally {
        btn.textContent = '💾 Salvar Configurações';
        btn.disabled = false;
    }
}

function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
function showToast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3500); }

document.addEventListener('DOMContentLoaded', init);
