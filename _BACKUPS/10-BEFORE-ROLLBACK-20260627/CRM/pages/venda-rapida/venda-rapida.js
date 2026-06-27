import {
    db, collection, addDoc, getDocs, doc, updateDoc,
    serverTimestamp, query, where, orderBy
} from "../../scripts/firebase.js";

const COL_LANCAMENTOS = 'caixa_lancamentos';
const COL_ESTOQUE     = 'estoque_produtos';

let produtoAtual = null;
let qrScanner    = null;
let toastTimer   = null;

// ── elementos ──────────────────────────────────────────────────────────
const codigoEl      = document.getElementById('vr-codigo');
const resultadoEl   = document.getElementById('vr-resultado');
const prodCardEl    = document.getElementById('vr-produto-card');
const prodNomeEl    = document.getElementById('vr-produto-nome');
const prodPrecoEl   = document.getElementById('vr-produto-preco');
const prodEstoqueEl = document.getElementById('vr-produto-estoque');
const prodCodEl     = document.getElementById('vr-produto-cod');
const prodCatEl     = document.getElementById('vr-produto-categoria');
const pagamentoEl   = document.getElementById('vr-pagamento');
const sucessoEl     = document.getElementById('vr-sucesso');
const erroEl        = document.getElementById('vr-erro');
const erroIconEl    = document.getElementById('vr-erro-icon');
const erroMsgEl     = document.getElementById('vr-erro-msg');
const histListaEl   = document.getElementById('vr-historico-lista');
const histTotalEl   = document.getElementById('vr-historico-total');
const toastEl       = document.getElementById('vr-toast');
const confirmCheck  = document.getElementById('vr-confirmar-check');
const cameraBtn     = document.getElementById('vr-camera-btn');
const cameraArea    = document.getElementById('vr-camera-area');
const cameraClose   = document.getElementById('vr-camera-close');

// ── toast ──────────────────────────────────────────────────────────────
function toast(msg, dur = 2200) {
    toastEl.textContent = msg;
    toastEl.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), dur);
}

// ── estrutura temporal (espelha caixa.js) ─────────────────────────────
function criarEstruturaTemporal() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dia = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const mes = `${now.getFullYear()}-${pad(now.getMonth()+1)}`;
    const semana = (() => {
        const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const day = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - day);
        const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - ys) / 86400000) + 1) / 7);
    })();
    return {
        dataISO:    now.toISOString(),
        dia,
        mes,
        ano:        String(now.getFullYear()),
        horario:    `${pad(now.getHours())}:${pad(now.getMinutes())}`,
        semana,
        diaSemana:  now.getDay(),
        diaMes:     now.getDate(),
        mesNumero:  now.getMonth() + 1,
        timezone:   Intl.DateTimeFormat().resolvedOptions().timeZone
    };
}

// ── buscar produto por código de barras ───────────────────────────────
async function buscarProduto(codigo) {
    try {
        const snap = await getDocs(collection(db, COL_ESTOQUE));
        let encontrado = null;
        snap.forEach(d => {
            const data = d.data();
            if (data.codigoBarras === codigo) encontrado = { id: d.id, ...data };
        });
        return encontrado;
    } catch {
        return null;
    }
}

// ── mostrar/esconder seções ───────────────────────────────────────────
function mostrarEstado(estado) {
    prodCardEl.style.display  = 'none';
    pagamentoEl.style.display = 'none';
    sucessoEl.style.display   = 'none';
    erroEl.style.display      = 'none';
    resultadoEl.style.display = 'block';

    if (estado === 'produto')   { prodCardEl.style.display  = 'block'; pagamentoEl.style.display = 'block'; }
    if (estado === 'sucesso')   { sucessoEl.style.display   = 'block'; }
    if (estado === 'erro')      { erroEl.style.display      = 'block'; }
    if (estado === 'oculto')    { resultadoEl.style.display = 'none'; }
}

// ── processar código escaneado ────────────────────────────────────────
async function processarCodigo(codigo) {
    if (!codigo) return;
    codigoEl.value = '';
    mostrarEstado('oculto');
    produtoAtual = null;

    const prod = await buscarProduto(codigo);

    if (!prod) {
        erroIconEl.textContent = '🔍';
        erroMsgEl.textContent  = `Código "${codigo}" não encontrado no estoque.`;
        mostrarEstado('erro');
        setTimeout(limpar, 2500);
        return;
    }

    if (prod.quantidade <= 0) {
        erroIconEl.textContent = '🚫';
        erroMsgEl.textContent  = `"${prod.nome}" está sem estoque!`;
        mostrarEstado('erro');
        setTimeout(limpar, 2500);
        return;
    }

    produtoAtual = prod;

    const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const qtdBaixa = prod.quantidade <= (prod.quantidadeMinima || 1);

    prodCatEl.textContent     = prod.categoria || '';
    prodNomeEl.textContent    = prod.nome || prod.description || '—';
    prodPrecoEl.textContent   = fmt(prod.venda);
    prodEstoqueEl.textContent = `${prod.quantidade} em estoque${qtdBaixa ? ' ⚠️ baixo' : ''}`;
    prodEstoqueEl.className   = 'vr-produto-estoque' + (qtdBaixa ? ' baixo' : '');
    prodCodEl.textContent     = prod.codigoBarras || '';

    mostrarEstado('produto');
}

// ── finalizar venda ───────────────────────────────────────────────────
async function finalizarVenda(formaPagamento) {
    if (!produtoAtual) return;
    const prod = produtoAtual;

    if (confirmCheck.checked) {
        const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const ok = confirm(`Confirmar venda?\n\n${prod.nome}\n${fmt(prod.venda)}\nPagamento: ${formaPagamento.toUpperCase()}`);
        if (!ok) return;
    }

    try {
        const t = criarEstruturaTemporal();
        const valor = Number(prod.venda || 0);
        const custo = Number(prod.custo || 0);
        const lucro = valor - custo;

        // Salva em caixa_lancamentos (mesmo formato do Caixa)
        await addDoc(collection(db, COL_LANCAMENTOS), {
            tipo:          'entrada',
            descricao:     prod.nome || prod.description || '',
            categoria:     prod.categoria || '',
            valor,
            custo,
            lucro,
            formaPagamento,
            status:        'ativo',
            produtoId:     prod.id,
            source:        'venda_rapida',
            version:       '1.0',
            createdBy:     'operador',
            createdAt:     serverTimestamp(),
            createdAtISO:  t.dataISO,
            updatedAt:     serverTimestamp(),
            updatedAtISO:  t.dataISO,
            dataISO:       t.dataISO,
            dia:           t.dia,
            mes:           t.mes,
            ano:           t.ano,
            semana:        t.semana,
            horario:       t.horario,
            diaSemana:     t.diaSemana,
            diaMes:        t.diaMes,
            mesNumero:     t.mesNumero,
            timezone:      t.timezone,
            editHistory:   [],
            editCount:     0
        });

        // Decrementa estoque
        const novaQty = Math.max((prod.quantidade || 0) - 1, 0);
        await updateDoc(doc(db, COL_ESTOQUE, prod.id), {
            quantidade:   novaQty,
            atualizadoEm: serverTimestamp()
        });

        // Sucesso
        const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('vr-sucesso-info').textContent =
            `${prod.nome} · ${fmt(valor)} · ${formaPagamento.toUpperCase()}`;
        mostrarEstado('sucesso');
        produtoAtual = null;
        await carregarHistorico();
        setTimeout(limpar, 2800);

    } catch (e) {
        toast('⚠️ Erro ao registrar venda. Tente novamente.');
    }
}

// ── limpar para próxima venda ─────────────────────────────────────────
function limpar() {
    produtoAtual = null;
    codigoEl.value = '';
    mostrarEstado('oculto');
    codigoEl.focus();
}

// ── histórico do dia ──────────────────────────────────────────────────
async function carregarHistorico() {
    try {
        const hoje = new Date();
        const pad = n => String(n).padStart(2, '0');
        const diaKey = `${hoje.getFullYear()}-${pad(hoje.getMonth()+1)}-${pad(hoje.getDate())}`;

        const q = query(
            collection(db, COL_LANCAMENTOS),
            where('dia', '==', diaKey),
            where('source', '==', 'venda_rapida')
        );
        const snap = await getDocs(q);
        const vendas = [];
        snap.forEach(d => vendas.push({ id: d.id, ...d.data() }));
        vendas.sort((a, b) => (b.createdAtISO || '').localeCompare(a.createdAtISO || ''));

        const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const total = vendas.reduce((s, v) => s + (v.valor || 0), 0);

        histTotalEl.textContent = vendas.length ? `${vendas.length} venda${vendas.length>1?'s':''} · ${fmt(total)}` : '';

        if (!vendas.length) {
            histListaEl.innerHTML = '<div class="vr-historico-empty">Nenhuma venda ainda hoje.</div>';
            return;
        }

        const FORMA_ICON = { pix: '💚', dinheiro: '💵', debito: '💳', credito: '💰' };

        histListaEl.innerHTML = vendas.map(v => `
            <div class="vr-hist-item">
                <span class="vr-hist-forma">${FORMA_ICON[v.formaPagamento] || '💰'}</span>
                <span class="vr-hist-nome">${v.descricao || '—'}</span>
                <span class="vr-hist-horario">${v.horario || ''}</span>
                <span class="vr-hist-valor">${fmt(v.valor)}</span>
            </div>
        `).join('');

    } catch {
        histListaEl.innerHTML = '<div class="vr-historico-empty">Erro ao carregar histórico.</div>';
    }
}

// ── câmera ────────────────────────────────────────────────────────────
function abrirCamera() {
    if (typeof Html5Qrcode === 'undefined') {
        toast('⚠️ Biblioteca de câmera não carregada. Verifique a conexão.');
        return;
    }
    cameraArea.style.display = 'block';
    cameraBtn.style.display  = 'none';
    qrScanner = new Html5Qrcode('vr-camera-reader');
    qrScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 120 } },
        (codigo) => {
            fecharCamera();
            processarCodigo(codigo.trim());
        }
    ).catch(() => {
        toast('⚠️ Câmera não disponível ou permissão negada.');
        fecharCamera();
    });
}

function fecharCamera() {
    if (qrScanner) {
        qrScanner.stop().catch(() => {});
        qrScanner = null;
    }
    cameraArea.style.display = 'none';
    cameraBtn.style.display  = '';
    codigoEl.focus();
}

// ── eventos ───────────────────────────────────────────────────────────
codigoEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        const codigo = codigoEl.value.trim();
        if (codigo) processarCodigo(codigo);
    }
});

// Leitor USB: envia código rapidamente + Enter. Também captura pela mudança do input.
let inputTimer = null;
codigoEl.addEventListener('input', () => {
    clearTimeout(inputTimer);
    const val = codigoEl.value.trim();
    // Se o código já tem mais de 5 chars, aguarda 300ms sem digitação (padrão de leitor USB)
    if (val.length >= 6) {
        inputTimer = setTimeout(() => {
            const codigo = codigoEl.value.trim();
            if (codigo) processarCodigo(codigo);
        }, 300);
    }
});

document.querySelectorAll('.vr-pag-btn').forEach(btn => {
    btn.addEventListener('click', () => finalizarVenda(btn.dataset.forma));
});

cameraBtn.addEventListener('click', abrirCamera);
cameraClose.addEventListener('click', fecharCamera);

// ── init ──────────────────────────────────────────────────────────────
codigoEl.focus();
carregarHistorico();
