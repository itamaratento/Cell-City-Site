/* ============================================================
   NOVA DESPESA — tela exclusiva de cadastro/edição
   Reutiliza o layout de entrada.css (CRM → Novo Cliente)
   ============================================================ */
import {
    db, collection, getDocs, doc, getDoc, setDoc, serverTimestamp
} from '../../scripts/firebase.js';
import { logAudit } from '../../shared/auditoria.js';

const COL_DESPESAS = 'financeiro_despesas';
const COL_CATS     = 'financeiro_cat_despesas';
const COL_CENTROS  = 'financeiro_centros_custo';

const $ = id => document.getElementById(id);
const hoje = () => new Date().toISOString().slice(0, 10);

/* ── Categorias padrão ─────────────────────────────────────── */
const CATS_PADRAO = [
    { id: '_alimentacao', nome: 'Alimentação',    icone: '🍔' },
    { id: '_combustivel', nome: 'Combustível',    icone: '⛽' },
    { id: '_limpeza',     nome: 'Limpeza',        icone: '🧹' },
    { id: '_mercadorias', nome: 'Mercadorias',    icone: '📦' },
    { id: '_estrutura',   nome: 'Estrutura',      icone: '🏗️' },
    { id: '_tecnologia',  nome: 'Tecnologia',     icone: '💻' },
    { id: '_marketing',   nome: 'Marketing',      icone: '📢' },
    { id: '_transporte',  nome: 'Transporte',     icone: '🚗' },
    { id: '_adm',         nome: 'Administrativo', icone: '📋' },
    { id: '_outros',      nome: 'Outros',         icone: '💡' },
];
const CENTROS_PADRAO = [
    { id: '_assistencia', nome: 'Assistência Técnica', icone: '🔧' },
    { id: '_loja',        nome: 'Loja',                icone: '🏪' },
    { id: '_informatica', nome: 'Informática',         icone: '💻' },
    { id: '_pessoal',     nome: 'Pessoal',             icone: '👥' },
];

/* ── Estado ────────────────────────────────────────────────── */
let catsCustom    = [];
let centrosCustom = [];
let editandoId    = null;
let dadosOriginais = null;
let quickModalCtx  = null;
let _toastTimer    = null;

/* ── Toast ─────────────────────────────────────────────────── */
function toast(msg) {
    const el = $('nd-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ── Navegação ─────────────────────────────────────────────── */
function voltar() {
    window.location.href = '/CRM/pages/despesas/';
}

/* ── Selects ───────────────────────────────────────────────── */
function popularCategorias(valorAtual = '') {
    const sel = $('nd-categoria');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Categoria —</option>';
    [...CATS_PADRAO, ...catsCustom].forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.icone} ${c.nome}`;
        sel.appendChild(o);
    });
    if (valorAtual) sel.value = valorAtual;
}

function popularCentros(valorAtual = '') {
    const sel = $('nd-centro');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Centro de Custo (opcional) —</option>';
    [...CENTROS_PADRAO, ...centrosCustom].forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.icone} ${c.nome}`;
        sel.appendChild(o);
    });
    if (valorAtual) sel.value = valorAtual;
}

/* ── Carregar ──────────────────────────────────────────────── */
async function carregar() {
    const params = new URLSearchParams(location.search);
    editandoId = params.get('id') || null;

    try {
        const [snapC, snapCt] = await Promise.all([
            getDocs(collection(db, COL_CATS)),
            getDocs(collection(db, COL_CENTROS)),
        ]);
        catsCustom    = [];
        centrosCustom = [];
        snapC.forEach(d  => catsCustom.push({ id: d.id, ...d.data() }));
        snapCt.forEach(d => centrosCustom.push({ id: d.id, ...d.data() }));
    } catch { /* usa apenas as categorias padrão */ }

    popularCategorias();
    popularCentros();

    if (editandoId) {
        $('nd-titulo').textContent    = '✏️ Editar Despesa';
        $('nd-btn-salvar').textContent = 'Atualizar';
        try {
            const snap = await getDoc(doc(db, COL_DESPESAS, editandoId));
            if (snap.exists()) {
                dadosOriginais = snap.data();
                const d = dadosOriginais;
                $('nd-descricao').value = d.descricao || '';
                popularCategorias(d.categoria || '');
                $('nd-valor').value     = d.valor     || '';
                $('nd-data').value      = d.data      || hoje();
                $('nd-tipo').value      = d.tipo      || 'empresarial';
                $('nd-pagamento').value = d.pagamento || 'dinheiro';
                popularCentros(d.centro || '');
                $('nd-obs').value       = d.obs       || '';
                if (d.recorrente) {
                    $('nd-recorrente').checked = true;
                    $('nd-frequencia-wrap').style.display = '';
                    $('nd-frequencia').value = d.frequencia || 'mensal';
                }
            }
        } catch { toast('⚠ Erro ao carregar despesa.'); }
    } else {
        $('nd-data').value = hoje();
        setTimeout(() => $('nd-descricao')?.focus(), 100);
    }
}

/* ── Salvar ────────────────────────────────────────────────── */
async function salvar(e) {
    e && e.preventDefault();

    const descricao = $('nd-descricao')?.value.trim();
    const valor     = Number($('nd-valor')?.value) || 0;
    const data      = $('nd-data')?.value;
    const categoria = $('nd-categoria')?.value;

    if (!descricao) { toast('⚠ Informe a descrição.');     $('nd-descricao')?.focus();  return; }
    if (!valor)     { toast('⚠ Informe o valor.');         $('nd-valor')?.focus();      return; }
    if (!data)      { toast('⚠ Informe a data.');          $('nd-data')?.focus();       return; }
    if (!categoria) { toast('⚠ Selecione a categoria.');   $('nd-categoria')?.focus();  return; }

    const btn = $('nd-btn-salvar');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const isRecorrente = !!$('nd-recorrente')?.checked;
    const id = editandoId || `dsp_${Date.now()}`;

    const despesa = {
        descricao,
        valor,
        data,
        categoria,
        tipo:          $('nd-tipo')?.value        || 'empresarial',
        pagamento:     $('nd-pagamento')?.value   || 'dinheiro',
        centro:        $('nd-centro')?.value      || '',
        obs:           $('nd-obs')?.value.trim()  || '',
        recorrente:    isRecorrente,
        frequencia:    isRecorrente ? ($('nd-frequencia')?.value || 'mensal') : '',
        ultimaGeracao: isRecorrente ? (data || hoje()) : '',
        anexos:        dadosOriginais?.anexos     || [],
        atualizadoEm:  serverTimestamp(),
    };
    if (!editandoId) despesa.criadoEm = serverTimestamp();

    try {
        await setDoc(doc(db, COL_DESPESAS, id), despesa);
        await logAudit({
            modulo:    'despesas',
            acao:      editandoId ? 'edicao' : 'criacao',
            id,
            antes:     dadosOriginais || null,
            depois:    despesa,
            descricao,
        });
        toast(editandoId ? '✏️ Despesa atualizada!' : '✅ Despesa registrada!');
        setTimeout(voltar, 900);
    } catch (err) {
        console.error(err);
        toast('⚠ Erro ao salvar. Tente novamente.');
        btn.disabled = false;
        btn.textContent = editandoId ? 'Atualizar' : 'Salvar';
    }
}

/* ── Modal: nova categoria / novo centro ──────────────────── */
function abrirModalQuick(ctx) {
    quickModalCtx = ctx;
    $('nd-modal-titulo').textContent = ctx === 'categoria' ? 'Nova Categoria' : 'Novo Centro de Custo';
    $('nd-quick-nome').value  = '';
    $('nd-quick-icone').value = '';
    $('nd-modal-quick').style.display = 'flex';
    setTimeout(() => $('nd-quick-nome')?.focus(), 50);
}

async function salvarModalQuick() {
    const nome  = $('nd-quick-nome')?.value.trim();
    const icone = $('nd-quick-icone')?.value.trim() || '💡';
    if (!nome) { $('nd-quick-nome')?.focus(); return; }

    if (quickModalCtx === 'categoria') {
        const id = `cat_${Date.now()}`;
        await setDoc(doc(db, COL_CATS, id), { nome, icone, criadoEm: serverTimestamp() });
        catsCustom.push({ id, nome, icone });
        const catAtual = $('nd-categoria').value;
        popularCategorias(catAtual);
        $('nd-categoria').value = id;
        toast('✅ Categoria criada!');
    } else {
        const id = `ctr_${Date.now()}`;
        await setDoc(doc(db, COL_CENTROS, id), { nome, icone, criadoEm: serverTimestamp() });
        centrosCustom.push({ id, nome, icone });
        const centroAtual = $('nd-centro').value;
        popularCentros(centroAtual);
        $('nd-centro').value = id;
        toast('✅ Centro de custo criado!');
    }
    $('nd-modal-quick').style.display = 'none';
}

/* ── Event listeners ───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    carregar();

    $('nd-btn-voltar')?.addEventListener('click', voltar);
    $('nd-btn-cancelar')?.addEventListener('click', voltar);
    $('nd-form')?.addEventListener('submit', salvar);

    $('nd-recorrente')?.addEventListener('change', e => {
        $('nd-frequencia-wrap').style.display = e.target.checked ? '' : 'none';
    });

    $('nd-btn-nova-cat')?.addEventListener('click', () => abrirModalQuick('categoria'));
    $('nd-btn-novo-centro')?.addEventListener('click', () => abrirModalQuick('centro'));

    $('nd-modal-cancel')?.addEventListener('click', () => {
        $('nd-modal-quick').style.display = 'none';
    });
    $('nd-modal-ok')?.addEventListener('click', salvarModalQuick);

    $('nd-quick-nome')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); salvarModalQuick(); }
    });
});
