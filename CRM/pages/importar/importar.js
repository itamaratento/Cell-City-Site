import {
    db, collection, doc, setDoc, getDocs, serverTimestamp
} from "../../scripts/firebase.js";

window.handleFile        = handleFile;
window.iniciarImportacao = iniciarImportacao;

const TIMEZONE = "America/Sao_Paulo";

let dadosNormalizados = null; // { categorias, clientes, produtos, vendas }
let erros = [];

// ===== ENCODING FIX =====
function fixEncoding(str) {
    if (!str || typeof str !== 'string') return str || '';
    return str
        .replace(/Ã©/g, 'é').replace(/Ã¨/g, 'è').replace(/Ã¢/g, 'â')
        .replace(/Ã£/g, 'ã').replace(/Ã§/g, 'ç').replace(/Ã³/g, 'ó')
        .replace(/Ã²/g, 'ò').replace(/Ãµ/g, 'õ').replace(/Ã´/g, 'ô')
        .replace(/Ã¡/g, 'á').replace(/Ã /g, 'à').replace(/Ã­/g, 'í')
        .replace(/Ã¼/g, 'ü').replace(/Ãº/g, 'ú').replace(/Ã±/g, 'ñ')
        .replace(/â€™/g, "'").replace(/â€œ/g, '"').replace(/â€/g, '"')
        .replace(/â€¢/g, '•').replace(/â€"/g, '–').replace(/â€"/g, '—');
}

function fixObj(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === 'string') out[k] = fixEncoding(v);
        else if (Array.isArray(v)) out[k] = v.map(i => typeof i === 'object' ? fixObj(i) : i);
        else if (typeof v === 'object' && v !== null) out[k] = fixObj(v);
        else out[k] = v;
    }
    return out;
}

// ===== TIMESTAMP =====
function tsToISO(ts) {
    if (!ts) return null;
    if (typeof ts === 'number') return new Date(ts).toISOString();
    if (typeof ts === 'string') return ts;
    return null;
}

// ===== NORMALIZAR: suporta flat array (Beepstart) e objeto com chaves =====
function normalizar(raw) {
    // Formato flat: array com collection_key em cada item
    if (Array.isArray(raw)) {
        return {
            categorias: raw.filter(i => i.collection_key === 'Categoria'),
            clientes:   raw.filter(i => i.collection_key === 'Cliente'),
            produtos:   raw.filter(i => i.collection_key === 'Produto'),
            vendas:     raw.filter(i => i.collection_key === 'Venda'),
        };
    }
    // Formato legado: objeto com chaves
    return {
        categorias: raw.categorias || raw.Categoria || [],
        clientes:   raw.clientes   || raw.Cliente   || [],
        produtos:   raw.produtos   || raw.Produto   || [],
        vendas:     raw.vendas     || raw.Venda     || [],
    };
}

// ===== LER ARQUIVO =====
function sanitizar(text) {
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
}

function tentarParse(text) {
    try {
        return JSON.parse(sanitizar(text));
    } catch (e) {
        console.warn('JSON.parse falhou:', e.message.slice(0, 120));
        return null;
    }
}

function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const filenameEl = document.getElementById('imp-filename');
    filenameEl.textContent = file.name;
    filenameEl.style.display = 'block';

    // Lê como bytes brutos — mais robusto para encoding misto
    const reader = new FileReader();
    reader.onload = (e) => {
        const buffer = e.target.result;

        let text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
        let parsed = tentarParse(text);
        console.log('UTF-8:', parsed ? '✅ ' + (Array.isArray(parsed) ? parsed.length + ' itens' : 'obj') : '❌');

        if (!parsed) {
            text   = new TextDecoder('windows-1252', { fatal: false }).decode(buffer);
            parsed = tentarParse(text);
            console.log('win-1252:', parsed ? '✅ ' + (Array.isArray(parsed) ? parsed.length + ' itens' : 'obj') : '❌');
        }

        if (parsed) {
            dadosNormalizados = normalizar(parsed);
            console.log('Normalizado:', dadosNormalizados.categorias.length, 'cats |',
                dadosNormalizados.clientes.length, 'clis |',
                dadosNormalizados.produtos.length, 'prods |',
                dadosNormalizados.vendas.length, 'vendas');
            mostrarPreview(dadosNormalizados);
        } else {
            alert('❌ Arquivo inválido. Verifique se é um JSON válido.');
        }
    };
    reader.readAsArrayBuffer(file);
}

function mostrarPreview({ categorias, clientes, produtos, vendas }) {
    const prodFiltrados  = produtos.filter(p => !p.archived);
    const vendasFiltradas = vendas.filter(v => !v.cancelada);
    const cliFiltrados   = clientes.filter(c => !c.archived);

    document.getElementById('prev-clientes').textContent   = cliFiltrados.length;
    document.getElementById('prev-produtos').textContent   = prodFiltrados.length;
    document.getElementById('prev-vendas').textContent     = vendasFiltradas.length;
    document.getElementById('prev-categorias').textContent = categorias.length;

    const ignoradosProd = produtos.length - prodFiltrados.length;
    const ignoradosVend = vendas.length   - vendasFiltradas.length;
    const ignoradosCli  = clientes.length - cliFiltrados.length;

    let filterText = '';
    if (ignoradosCli  > 0) filterText += `<span>${ignoradosCli} cliente(s) arquivado(s) serão ignorados.</span><br>`;
    if (ignoradosProd > 0) filterText += `<span>${ignoradosProd} produto(s) arquivado(s) serão ignorados.</span><br>`;
    if (ignoradosVend > 0) filterText += `<span>${ignoradosVend} venda(s) cancelada(s) serão ignoradas.</span>`;
    document.getElementById('imp-filter-info').innerHTML = filterText;

    document.getElementById('imp-preview').style.display   = 'block';
    document.getElementById('imp-btn-start').style.display = 'block';
}

// ===== IMPORTAÇÃO =====
async function iniciarImportacao() {
    if (!dadosNormalizados) return;

    erros = [];
    const btn = document.getElementById('imp-btn-start');
    btn.disabled = true;
    btn.textContent = '⏳ Importando...';

    document.getElementById('imp-progress-wrap').style.display = 'block';
    document.getElementById('imp-summary').style.display       = 'none';
    document.getElementById('imp-errors').style.display        = 'none';

    const stats = {
        clientesNovos: 0, clientesAtualizados: 0,
        produtosNovos: 0, produtosAtualizados: 0,
        vendasImportadas: 0, categoriasImportadas: 0
    };

    try {
        const { categorias, clientes, produtos, vendas } = dadosNormalizados;

        setProgresso(0, 'Importando categorias...');
        const catMap = await importarCategorias(categorias, stats);

        setProgresso(10, `Importando ${clientes.filter(c=>!c.archived).length} clientes...`);
        const clienteMap = await importarClientes(clientes.filter(c => !c.archived), stats);

        const prodFiltrados = produtos.filter(p => !p.archived);
        setProgresso(30, `Importando ${prodFiltrados.length} produtos...`);
        await importarProdutos(prodFiltrados, catMap, stats);

        const vendasFiltradas = vendas.filter(v => !v.cancelada);
        setProgresso(60, `Importando ${vendasFiltradas.length} vendas...`);
        await importarVendas(vendasFiltradas, clienteMap, stats);

        setProgresso(100, 'Concluído!');
        mostrarResumo(stats);

    } catch (err) {
        console.error('❌ Erro na importação:', err);
        erros.push('Erro crítico: ' + err.message);
        mostrarErros();
    }

    btn.disabled = false;
    btn.textContent = '▶ Importar novamente';
}

// ===== CATEGORIAS =====
async function importarCategorias(categorias, stats) {
    const catMap = {};
    for (const cat of categorias) {
        const fixed = fixObj(cat);
        const id   = String(fixed.id || Date.now());
        const nome = fixed.description || fixed.name || fixed.nome || `Categoria ${id}`;
        try {
            await setDoc(doc(db, "categorias_produtos", id), {
                id, nome, createdAt: serverTimestamp()
            }, { merge: true });
            catMap[id] = nome.trim();
            stats.categoriasImportadas++;
        } catch (e) { erros.push(`Categoria ${id}: ${e.message}`); }
    }
    return catMap;
}

// ===== CLIENTES =====
async function importarClientes(clientes, stats) {
    const clienteMap = {};

    const existentes = {};
    try {
        const snap = await getDocs(collection(db, "clients"));
        snap.forEach(d => {
            const data = d.data();
            if (data.phone) existentes[data.phone.replace(/\D/g, '')] = d.id;
        });
    } catch {}

    for (const cl of clientes) {
        const fixed = fixObj(cl);
        const nome  = (fixed.name || fixed.nome || '').trim();
        const fone  = (fixed.phone || fixed.telefone || '').replace(/\D/g, '');
        const idOrig = String(fixed.id || '');

        if (!nome && !fone) continue;

        const docId = fone && existentes[fone] ? existentes[fone] : doc(collection(db, "clients")).id;
        const isNovo = !existentes[fone];

        try {
            await setDoc(doc(db, "clients", docId), {
                id: docId, name: nome, phone: fone,
                importadoDe: 'beepstart', importadoEm: new Date().toISOString(),
                createdAt: serverTimestamp()
            }, { merge: true });

            clienteMap[idOrig] = docId;
            if (isNovo) { existentes[fone] = docId; stats.clientesNovos++; }
            else stats.clientesAtualizados++;
        } catch (e) { erros.push(`Cliente "${nome}": ${e.message}`); }
    }
    return clienteMap;
}

// ===== PRODUTOS =====
async function importarProdutos(produtos, catMap, stats) {
    const existentes = {};
    try {
        const snap = await getDocs(collection(db, "produtos"));
        snap.forEach(d => {
            const data = d.data();
            if (data.description) existentes[data.description.toLowerCase()] = d.id;
        });
    } catch {}

    let i = 0;
    for (const prod of produtos) {
        i++;
        if (i % 20 === 0) setProgresso(30 + Math.round((i / produtos.length) * 30), `Produtos: ${i}/${produtos.length}`);

        const fixed = fixObj(prod);
        const desc  = (fixed.description || fixed.descricao || fixed.nome || '').trim();
        const idOrig = String(fixed.id || '');
        const catId  = String(fixed.categoriaID || fixed.categoria_id || '');

        if (!desc) continue;

        const isNovo = !existentes[desc.toLowerCase()];
        const docId  = isNovo ? doc(collection(db, "produtos")).id : existentes[desc.toLowerCase()];

        try {
            await setDoc(doc(db, "produtos", docId), {
                id: docId,
                description: desc,
                custo:       parseFloat(fixed.custo    || fixed.cost  || 0),
                venda:       parseFloat(fixed.venda    || fixed.price || 0),
                categoria:   catMap[catId] || catId || '',
                categoriaID: catId,
                importadoDe: 'beepstart',
                createdAt:   serverTimestamp()
            }, { merge: true });

            if (isNovo) { existentes[desc.toLowerCase()] = docId; stats.produtosNovos++; }
            else stats.produtosAtualizados++;
        } catch (e) { erros.push(`Produto "${desc}": ${e.message}`); }
    }
}

// ===== VENDAS =====
async function importarVendas(vendas, clienteMap, stats) {
    let i = 0;
    for (const venda of vendas) {
        i++;
        if (i % 20 === 0) setProgresso(60 + Math.round((i / vendas.length) * 38), `Vendas: ${i}/${vendas.length}`);

        const fixed   = fixObj(venda);
        const idOrig  = String(fixed.id || '');
        const clienteId = clienteMap[String(fixed.clienteID || fixed.usuarioID || '')] || null;
        const dataISO = tsToISO(fixed.data || fixed.createdAt || fixed.date);
        const total   = parseFloat(fixed.total || fixed.valor || fixed.valorTotal || 0);

        try {
            // Registro histórico
            await setDoc(doc(db, "vendas_importadas", `beep_${idOrig}`), {
                id: `beep_${idOrig}`, idOriginal: idOrig,
                clienteId, dataISO, total,
                importadoDe: 'beepstart',
                createdAt: serverTimestamp()
            }, { merge: true });

            // Lançamento no Caixa (aparece no módulo e na Meta Semanal)
            if (dataISO && total > 0) {
                const dt  = new Date(dataISO);
                const pad = n => String(n).padStart(2, '0');
                const dia     = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
                const mes     = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}`;
                const horario = `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;

                await setDoc(doc(db, "caixa_lancamentos", `beep_venda_${idOrig}`), {
                    tipo: "entrada",
                    descricao: `Venda #${idOrig}`,
                    categoria: "Venda Beepstart",
                    valor: total,
                    custo: 0,
                    lucro: total,
                    dia, mes,
                    ano:        dt.getFullYear(),
                    dataISO,
                    horario,
                    diaSemana:  dt.getDay(),
                    diaMes:     dt.getDate(),
                    mesNumero:  dt.getMonth() + 1,
                    timezone:   TIMEZONE,
                    status:     "ativo",
                    importadoDe: "beepstart",
                    createdAt:  serverTimestamp()
                }, { merge: true });
            }

            stats.vendasImportadas++;
        } catch (e) { erros.push(`Venda #${idOrig}: ${e.message}`); }
    }
}

// ===== UI =====
function setProgresso(pct, label) {
    document.getElementById('imp-progress-bar').style.width   = pct + '%';
    document.getElementById('imp-progress-pct').textContent   = pct + '%';
    document.getElementById('imp-progress-label').textContent = label;
}

function mostrarResumo(stats) {
    const body = document.getElementById('imp-summary-body');
    body.innerHTML = `
        <div class="imp-summary-row"><span>Clientes novos</span><span class="imp-summary-val">${stats.clientesNovos}</span></div>
        <div class="imp-summary-row"><span>Clientes atualizados</span><span class="imp-summary-val">${stats.clientesAtualizados}</span></div>
        <div class="imp-summary-row"><span>Produtos novos</span><span class="imp-summary-val">${stats.produtosNovos}</span></div>
        <div class="imp-summary-row"><span>Produtos atualizados</span><span class="imp-summary-val">${stats.produtosAtualizados}</span></div>
        <div class="imp-summary-row"><span>Vendas importadas</span><span class="imp-summary-val">${stats.vendasImportadas}</span></div>
        <div class="imp-summary-row"><span>Categorias importadas</span><span class="imp-summary-val">${stats.categoriasImportadas}</span></div>`;
    document.getElementById('imp-summary').style.display = 'block';
    if (erros.length) mostrarErros();
}

function mostrarErros() {
    if (!erros.length) return;
    const body = document.getElementById('imp-errors-body');
    body.innerHTML = erros.slice(0, 20).map(e => `<div class="imp-error-item">• ${e}</div>`).join('');
    if (erros.length > 20) body.innerHTML += `<div class="imp-error-item">... e mais ${erros.length - 20} avisos.</div>`;
    document.getElementById('imp-errors').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {});
