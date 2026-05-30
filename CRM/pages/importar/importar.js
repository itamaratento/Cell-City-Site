import {
    db, collection, doc, setDoc, getDocs, query, where, serverTimestamp
} from "../../scripts/firebase.js";

window.handleFile       = handleFile;
window.iniciarImportacao = iniciarImportacao;

let dadosParseados = null;
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

// ===== LER ARQUIVO =====
function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const filenameEl = document.getElementById('imp-filename');
    filenameEl.textContent = file.name;
    filenameEl.style.display = 'block';

    const reader = new FileReader();
    reader.onload = (e) => {
        let text = e.target.result;
        try {
            const raw = JSON.parse(text);
            dadosParseados = raw;
            mostrarPreview(raw);
        } catch {
            // Tentar latin-1
            const reader2 = new FileReader();
            reader2.onload = (e2) => {
                try {
                    dadosParseados = JSON.parse(e2.target.result);
                    mostrarPreview(dadosParseados);
                } catch (err) {
                    alert('❌ Arquivo inválido. Verifique se é um JSON válido.\n' + err.message);
                }
            };
            reader2.readAsText(file, 'windows-1252');
        }
    };
    reader.readAsText(file, 'UTF-8');
}

function mostrarPreview(raw) {
    const clientes  = (raw.clientes  || []).length;
    const produtos  = (raw.produtos  || []).filter(p => !p.archived).length;
    const vendas    = (raw.vendas    || []).filter(v => !v.cancelada).length;
    const categorias = (raw.categorias || []).length;

    const totalProdutos = (raw.produtos || []).length;
    const totalVendas   = (raw.vendas   || []).length;
    const ignoradosProd = totalProdutos - produtos;
    const ignoradosVend = totalVendas   - vendas;

    document.getElementById('prev-clientes').textContent  = clientes;
    document.getElementById('prev-produtos').textContent  = produtos;
    document.getElementById('prev-vendas').textContent    = vendas;
    document.getElementById('prev-categorias').textContent = categorias;

    let filterText = '';
    if (ignoradosProd > 0) filterText += `<span>${ignoradosProd} produto(s) arquivado(s) serão ignorados.</span><br>`;
    if (ignoradosVend > 0) filterText += `<span>${ignoradosVend} venda(s) cancelada(s) serão ignoradas.</span>`;
    document.getElementById('imp-filter-info').innerHTML = filterText;

    document.getElementById('imp-preview').style.display  = 'block';
    document.getElementById('imp-btn-start').style.display = 'block';
}

// ===== IMPORTAÇÃO =====
async function iniciarImportacao() {
    if (!dadosParseados) return;

    erros = [];
    const btn = document.getElementById('imp-btn-start');
    btn.disabled = true;
    btn.textContent = '⏳ Importando...';

    document.getElementById('imp-progress-wrap').style.display = 'block';
    document.getElementById('imp-summary').style.display = 'none';
    document.getElementById('imp-errors').style.display = 'none';

    const stats = {
        clientesNovos: 0, clientesAtualizados: 0,
        produtosNovos: 0, produtosAtualizados: 0,
        vendasImportadas: 0, categoriasImportadas: 0
    };

    try {
        // 1. Categorias
        const categorias = dadosParseados.categorias || [];
        setProgresso(0, 'Importando categorias...', 0);
        const catMap = await importarCategorias(categorias, stats);

        // 2. Clientes
        const clientes = dadosParseados.clientes || [];
        setProgresso(10, `Importando ${clientes.length} clientes...`, 10);
        const clienteMap = await importarClientes(clientes, stats);

        // 3. Produtos
        const produtos = (dadosParseados.produtos || []).filter(p => !p.archived);
        setProgresso(30, `Importando ${produtos.length} produtos...`, 30);
        const produtoMap = await importarProdutos(produtos, catMap, stats);

        // 4. Vendas
        const vendas = (dadosParseados.vendas || []).filter(v => !v.cancelada);
        setProgresso(60, `Importando ${vendas.length} vendas...`, 60);
        await importarVendas(vendas, clienteMap, produtoMap, stats);

        setProgresso(100, 'Concluído!', 100);
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
        const id    = String(fixed.id || fixed.categoriaID || Date.now());
        const nome  = fixed.name || fixed.nome || fixed.description || `Categoria ${id}`;
        try {
            await setDoc(doc(db, "categorias_produtos", id), {
                id, nome, createdAt: serverTimestamp()
            }, { merge: true });
            catMap[id] = nome;
            stats.categoriasImportadas++;
        } catch (e) { erros.push(`Categoria ${id}: ${e.message}`); }
    }
    return catMap;
}

// ===== CLIENTES =====
async function importarClientes(clientes, stats) {
    const clienteMap = {};

    // Carregar existentes por telefone
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
        const nome  = fixed.name || fixed.nome || '';
        const fone  = (fixed.phone || fixed.telefone || '').replace(/\D/g, '');
        const idOrig = String(fixed.id || fixed.clienteID || '');

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
    const produtoMap = {};

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
        if (i % 20 === 0) setProgresso(30 + Math.round((i / produtos.length) * 30), `Produtos: ${i}/${produtos.length}`, 30 + Math.round((i / produtos.length) * 30));

        const fixed = fixObj(prod);
        const desc  = fixed.description || fixed.descricao || fixed.nome || '';
        const idOrig = String(fixed.id || '');
        const catId  = String(fixed.categoriaID || fixed.categoria_id || '');

        if (!desc) continue;

        const isNovo = !existentes[desc.toLowerCase()];
        const docId  = isNovo ? doc(collection(db, "produtos")).id : existentes[desc.toLowerCase()];

        try {
            await setDoc(doc(db, "produtos", docId), {
                id: docId,
                description: desc,
                custo:    parseFloat(fixed.custo    || fixed.cost  || 0),
                venda:    parseFloat(fixed.venda    || fixed.price || 0),
                categoria: catMap[catId] || catId || '',
                categoriaID: catId,
                importadoDe: 'beepstart',
                createdAt: serverTimestamp()
            }, { merge: true });

            produtoMap[idOrig] = docId;
            if (isNovo) { existentes[desc.toLowerCase()] = docId; stats.produtosNovos++; }
            else stats.produtosAtualizados++;
        } catch (e) { erros.push(`Produto "${desc}": ${e.message}`); }
    }
    return produtoMap;
}

// ===== VENDAS =====
async function importarVendas(vendas, clienteMap, produtoMap, stats) {
    let i = 0;
    for (const venda of vendas) {
        i++;
        if (i % 20 === 0) setProgresso(60 + Math.round((i / vendas.length) * 38), `Vendas: ${i}/${vendas.length}`, 60 + Math.round((i / vendas.length) * 38));

        const fixed = fixObj(venda);
        const idOrig   = String(fixed.id || '');
        const clienteId = clienteMap[String(fixed.clienteID || fixed.cliente_id || '')] || null;
        const dataISO  = tsToISO(fixed.data || fixed.createdAt || fixed.date);

        const itens = (fixed.itens || fixed.items || []).map(item => ({
            produtoId:   produtoMap[String(item.produtoID || item.produto_id || '')] || null,
            descricao:   fixEncoding(item.description || item.descricao || ''),
            quantidade:  parseFloat(item.quantidade || item.qty || item.quantity || 1),
            valorUnitario: parseFloat(item.valorUnitario || item.price || item.valor || 0),
            total:       parseFloat(item.total || item.subtotal || 0)
        }));

        const total = parseFloat(fixed.total || fixed.valor || fixed.valorTotal ||
            itens.reduce((s, it) => s + it.total, 0) || 0);

        try {
            const docId = `beep_${idOrig}`;
            await setDoc(doc(db, "vendas_importadas", docId), {
                id: docId, idOriginal: idOrig,
                clienteId, dataISO,
                total, itens,
                importadoDe: 'beepstart',
                createdAt: serverTimestamp()
            }, { merge: true });
            stats.vendasImportadas++;
        } catch (e) { erros.push(`Venda #${idOrig}: ${e.message}`); }
    }
}

// ===== UI =====
function setProgresso(pct, label, raw) {
    document.getElementById('imp-progress-bar').style.width  = pct + '%';
    document.getElementById('imp-progress-pct').textContent  = pct + '%';
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
