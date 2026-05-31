import {
    db, collection, getDocs, query, orderBy
} from "../../scripts/firebase.js";

let todosProdutos = [];

window.filtrar = filtrar;

async function carregarProdutos() {
    try {
        const snap = await getDocs(query(collection(db, "produtos"), orderBy("description")));
        todosProdutos = [];
        snap.forEach(d => todosProdutos.push(d.data()));
    } catch {
        // orderBy pode falhar se não houver índice; tenta sem ordenação
        const snap = await getDocs(collection(db, "produtos"));
        snap.forEach(d => todosProdutos.push(d.data()));
        todosProdutos.sort((a, b) => (a.description || '').localeCompare(b.description || '', 'pt-BR'));
    }

    document.getElementById('est-loading').style.display = 'none';
    renderizar(todosProdutos);
}

function renderizar(lista) {
    const listEl  = document.getElementById('est-list');
    const emptyEl = document.getElementById('est-empty');
    const countEl = document.getElementById('est-count');

    countEl.textContent = `${lista.length} produto${lista.length !== 1 ? 's' : ''}`;

    if (!lista.length) {
        listEl.style.display = 'none';
        emptyEl.style.display = 'flex';
        return;
    }

    emptyEl.style.display = 'none';
    listEl.style.display  = 'flex';

    const fmtBRL = v => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    listEl.innerHTML = lista.map(p => `
        <div class="est-card">
            <div class="est-card-name">${escHtml(p.description || '—')}</div>
            <div class="est-card-cat">${escHtml(p.categoria || 'Sem categoria')}</div>
            <div class="est-card-prices">
                <div class="est-card-venda">${fmtBRL(p.venda)}</div>
                ${p.custo ? `<div class="est-card-custo">Custo: ${fmtBRL(p.custo)}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function filtrar() {
    const q = (document.getElementById('est-search').value || '').toLowerCase().trim();
    if (!q) { renderizar(todosProdutos); return; }
    renderizar(todosProdutos.filter(p =>
        (p.description || '').toLowerCase().includes(q) ||
        (p.categoria   || '').toLowerCase().includes(q)
    ));
}

function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', carregarProdutos);
