import { db, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "../../scripts/firebase.js";

// ===== CONFIG & STATE =====
const COLLECTION_TX = "caixa_lancamentos";
const COLLECTION_CAT = "categorias_caixa";
let allTx = []; // Master list from Firestore
let currentPeriod = 'week'; // Default filter
let customStart = null, customEnd = null;
let unsubscribeTx = null, unsubscribeCat = null;

const CAT_TYPE_MAP = {
    "Venda": "entrada", "Serviço": "entrada",
    "Fornecedor": "saida", "Compra de peças": "saida", "Aluguel": "saida",
    "Água": "saida", "Luz": "saida", "Internet": "saida", "Telefone": "saida",
    "Gasolina": "saida", "Mercado": "saida", "Despesa geral": "saida", "Outros": "saida"
};

const DEFAULT_CATS = {
    entrada: ["Venda", "Serviço"],
    saida: ["Fornecedor", "Compra de peças", "Aluguel", "Água", "Luz", "Internet", "Telefone", "Gasolina", "Mercado", "Despesa geral", "Outros"]
};

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// ===== UTILS =====
const fmt = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const safeDate = (ts) => new Date(ts?.toDate?.() || ts || Date.now());

function showToast(msg, type = "info") {
    const t = document.getElementById("toast");
    t.textContent = msg; t.style.borderColor = type === "error" ? "var(--red)" : "var(--green)";
    t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2500);
}
function updateStatus(connected) {
    const el = document.getElementById("connection-status");
    el.textContent = connected ? "✅ ONLINE" : "⏳ CONECTANDO...";
    el.classList.toggle("connected", connected);
}

// ===== CATEGORIAS =====
function loadCategories() {
    let cats = { entrada: [...DEFAULT_CATS.entrada], saida: [...DEFAULT_CATS.saida] };
    const q = query(collection(db, COLLECTION_CAT), orderBy("createdAt", "desc"));
    unsubscribeCat = onSnapshot(q, (snap) => {
        snap.forEach(d => { const data = d.data(); if (!cats[data.type].includes(data.nome)) cats[data.type].push(data.nome); });
        handleTypeChange(cats);
    });
}

function handleTypeChange(cats = null) {
    const typeEl = document.getElementById("tx-type");
    const catEl = document.getElementById("tx-category");
    const currentCat = catEl.value;
    const activeCats = cats || { entrada: [...DEFAULT_CATS.entrada], saida: [...DEFAULT_CATS.saida] };
    
    catEl.innerHTML = "";
    (activeCats[typeEl.value] || []).forEach(c => { const o = document.createElement("option"); o.value = c; o.textContent = c; catEl.appendChild(o); });
    if ([...catEl.options].some(o => o.value === currentCat)) catEl.value = currentCat;
    
    // Auto-type set
    const autoType = CAT_TYPE_MAP[catEl.value];
    if (autoType) { typeEl.value = autoType; handleTypeChange(null); }
}

// Inline Category Form Logic
const btnAdd = document.getElementById("btn-add-cat");
const inlineForm = document.getElementById("cat-inline-form");
const newCatInput = document.getElementById("new-cat-input");
if (btnAdd) {
    btnAdd.addEventListener("click", () => { inlineForm.classList.toggle("active"); if(inlineForm.classList.contains("active")) newCatInput.focus(); });
    document.getElementById("btn-cancel-cat").addEventListener("click", () => inlineForm.classList.remove("active"));
    document.getElementById("btn-save-cat").addEventListener("click", async () => {
        const nome = newCatInput.value.trim(); const type = document.getElementById("tx-type").value;
        if (!nome) return showToast("⚠️ Digite um nome", "error");
        try {
            await addDoc(collection(db, COLLECTION_CAT), { nome, type, createdAt: serverTimestamp() });
            showToast("✅ Categoria adicionada"); inlineForm.classList.remove("active");
        } catch(e) { showToast("❌ Erro ao salvar", "error"); }
    });
}

// ===== PESQUISA & FILTROS INTELIGENTES =====
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

document.getElementById("search-input").addEventListener("input", debounce(applyFilters, 200));

document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentPeriod = btn.dataset.period;
        
        // Toggle custom date picker
        const customWrap = document.getElementById("custom-dates-wrapper");
        if (currentPeriod === 'custom') {
            customWrap.classList.add("visible");
            // Default to current month if empty
            if(!customStart) {
                const today = new Date();
                const d = today.toISOString().split('T')[0];
                customStart = d; customEnd = d;
                document.getElementById("date-start").value = d;
                document.getElementById("date-end").value = d;
            }
        } else {
            customWrap.classList.remove("visible");
        }
        applyFilters();
    });
});

document.getElementById("date-start").addEventListener("change", (e) => { customStart = e.target.value; applyFilters(); });
document.getElementById("date-end").addEventListener("change", (e) => { customEnd = e.target.value; applyFilters(); });

function applyFilters() {
    let result = [...allTx];

    // 1. Filter by Period (Date)
    const now = new Date(); const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    result = result.filter(tx => {
        const txDate = safeDate(tx.timestamp);
        if (currentPeriod === 'today') return txDate >= todayStart;
        if (currentPeriod === 'week') {
            const day = now.getDay() || 7; const weekStart = new Date(todayStart); weekStart.setDate(now.getDate() - (day - 1));
            return txDate >= weekStart;
        }
        if (currentPeriod === 'month') {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            return txDate >= monthStart;
        }
        if (currentPeriod === 'custom' && customStart && customEnd) {
            const s = new Date(customStart); const e = new Date(customEnd); e.setHours(23,59,59,999);
            return txDate >= s && txDate <= e;
        }
        return true;
    });

    // 2. Filter by Search (Text/Number)
    const q = document.getElementById("search-input").value.toLowerCase().trim();
    if (q) {
        result = result.filter(tx => {
            // Search Text (Description, Category)
            if ((tx.description||'').toLowerCase().includes(q)) return true;
            if ((tx.category||'').toLowerCase().includes(q)) return true;
            if ((tx.type||'').toLowerCase().includes(q)) return true;
            
            // Search Value (Convert number to string)
            if (tx.recebido && String(tx.recebido).replace('.',',').includes(q)) return true;
            if (tx.lucro && String(tx.lucro).replace('.',',').includes(q)) return true;
            
            // Search Month Name
            const m = MONTH_NAMES[safeDate(tx.timestamp).getMonth()].toLowerCase();
            if (m.includes(q)) return true;
            
            return false;
        });
    }

    renderList(result); updateTotals(result);
}

// ===== RENDERIZAÇÃO =====
function loadTransactions() {
    if (unsubscribeTx) unsubscribeTx();
    const q = query(collection(db, COLLECTION_TX), orderBy("serverTimestamp", "desc"));
    unsubscribeTx = onSnapshot(q, (snap) => {
        allTx = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateStatus(true); applyFilters(); // Re-apply current filters/sort on new data
    }, () => updateStatus(false));
}

function renderList(list) {
    const el = document.getElementById("tx-list"); document.getElementById("tx-count").textContent = `${list.length} itens`;
    if (!el) return;
    if (!list.length) { el.innerHTML = `<div class="empty-state">Nenhum lançamento encontrado para este filtro.</div>`; return; }
    
    el.innerHTML = list.map(tx => `
        <div class="tx-card ${tx.type}">
            <div class="tx-info">
                <div class="tx-tags">
                    <span class="tag ${tx.type}">${tx.type === 'entrada' ? '🟢 Entrada' : '🔴 Saída'}</span>
                    <span class="tag cat">${tx.category}</span>
                </div>
                <div class="tx-desc">${tx.description}</div>
                <div class="tx-details">
                    <span>Custo: R$ ${fmt(tx.custo)}</span>
                    <span>Lucro: R$ ${fmt(tx.lucro)}</span>
                    <span>${safeDate(tx.timestamp).toLocaleDateString('pt-BR')}</span>
                </div>
            </div>
            <div class="tx-values">
                <div class="tx-recebido">${tx.type==='entrada'?'+':'-'} R$ ${fmt(tx.recebido)}</div>
            </div>
            <button class="btn-delete" onclick="window.deleteTransaction('${tx.id}')">🗑️</button>
        </div>`).join("");
}

function updateTotals(list) {
    let ent = 0, sai = 0, luc = 0;
    list.forEach(t => { t.type==='entrada' ? ent += t.recebido : sai += t.recebido; luc += t.lucro; });
    document.getElementById("total-entradas").textContent = fmt(ent);
    document.getElementById("total-saidas").textContent = fmt(sai);
    document.getElementById("total-lucro").textContent = fmt(luc);
    const bal = document.getElementById("saldo-geral");
    bal.textContent = fmt(ent - sai); bal.style.color = (ent - sai) >= 0 ? "var(--blue)" : "var(--red)";
}

// ===== AÇÕES =====
function calcLucro() {
    const r = parseFloat(document.getElementById("tx-recebido").value)||0;
    const c = parseFloat(document.getElementById("tx-custo").value)||0;
    document.getElementById("tx-lucro").value = `R$ ${fmt(r-c)}`;
}
async function saveTransaction(e) {
    e.preventDefault(); const btn = document.getElementById("save-btn");
    const type = document.getElementById("tx-type").value;
    const desc = document.getElementById("tx-desc").value.trim();
    const r = parseFloat(document.getElementById("tx-recebido").value);
    const c = parseFloat(document.getElementById("tx-custo").value)||0;
    if (!desc || r<=0) return showToast("⚠️ Campos inválidos", "error");
    
    btn.disabled = true; btn.textContent = "⏳ SALVANDO...";
    try {
        await addDoc(collection(db, COLLECTION_TX), {
            type, category: document.getElementById("tx-category").value, description: desc,
            recebido: r, custo: c, lucro: type==='saida' ? -r : r-c,
            serverTimestamp: serverTimestamp(), timestamp: new Date().toISOString()
        });
        showToast("✅ Lançamento salvo com sucesso");
        document.getElementById("tx-form").reset(); document.getElementById("tx-lucro").value = "R$ 0,00";
        handleTypeChange(); // Reset category select based on type
    } catch(err) { showToast("❌ Falha ao salvar", "error"); }
    finally { btn.disabled = false; btn.textContent = "💾 SALVAR LANÇAMENTO"; }
}

window.deleteTransaction = async (id) => {
    if (!confirm("Excluir lançamento?")) return;
    try { await deleteDoc(doc(db, COLLECTION_TX, id)); showToast("🗑️ Removido com sucesso"); } 
    catch(e) { showToast("❌ Erro ao excluir", "error"); }
};

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("tx-type").addEventListener("change", () => handleTypeChange(null));
    document.getElementById("tx-category").addEventListener("change", () => handleTypeChange(null));
    document.getElementById("tx-form").addEventListener("submit", saveTransaction);
    ["tx-recebido", "tx-custo"].forEach(id => document.getElementById(id).addEventListener("input", calcLucro));
    
    loadCategories(); loadTransactions();
    console.log("✅ Caixa V4 Inicializado. Consulta e Pesquisa Inteligentes Ativas.");
});