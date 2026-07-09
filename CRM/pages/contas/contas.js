import { initModulo } from '../../scripts/kernel.js';
import { carregarPermissoes, podeVisualizar, podeCriar, podeEditar, podeExcluir } from '../../shared/permissoes.js';
import { serverTimestamp } from '../../firebase/client.js';
import { ContasNumerosRepository as Contas } from '../../repositories/crm.repository.js';

const COL = 'contas_numeros';

// ── Estado ────────────────────────────────────────────────────────────────────
let _todas = [];
let _atual  = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatarData(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), 2500);
}

function mostrarView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $(id).classList.add('active');
    window.scrollTo(0, 0);
}

// ── Firestore ─────────────────────────────────────────────────────────────────
async function carregar() {
    _todas = await Contas.list();
    _todas.sort((a, b) => {
        const ta = a.criadoEm?.seconds || 0;
        const tb = b.criadoEm?.seconds || 0;
        return tb - ta;
    });
    renderLista();
}

// ── Renderização ──────────────────────────────────────────────────────────────
function renderLista() {
    const busca = ($('search-input').value || '').toLowerCase().trim();
    const lista = _todas.filter(c => {
        return !busca ||
            (c.nome    || '').toLowerCase().includes(busca) ||
            (c.numero  || '').toLowerCase().includes(busca) ||
            (c.email   || '').toLowerCase().includes(busca);
    });

    const el = $('lista');
    if (!lista.length) {
        el.innerHTML = '<div class="empty">Nenhuma conta encontrada.</div>';
        return;
    }

    el.innerHTML = lista.map(c => `
        <div class="conta-card" onclick="Contas.abrirDetalhe('${c.id}')">
            <div class="conta-card-nome">${esc(c.nome)}</div>
            <div class="conta-card-info">
                ${c.numero   ? `📱 ${esc(c.numero)}<br>` : ''}
                ${c.whatsapp ? `💬 ${esc(c.whatsapp)}<br>` : ''}
                ${c.email    ? `✉ ${esc(c.email)}<br>` : ''}
                ${c.funcao   ? `💼 ${esc(c.funcao)}<br>` : ''}
                ${c.obs      ? `📝 ${esc(c.obs)}` : ''}
            </div>
            <div class="conta-card-data">📅 Cadastrado em ${formatarData(c.criadoEm)}</div>
        </div>`).join('');
}

function renderDetalhe(c) {
    $('det-nome').textContent = c.nome || '—';
    const linhas = [
        { label: 'Número',          val: c.numero,   dest: true  },
        { label: 'Chip',            val: c.chip,     dest: false },
        { label: 'Operadora',       val: c.operadora,dest: false },
        { label: 'WhatsApp',        val: c.whatsapp, dest: true  },
        { label: 'E-mail vinculado',val: c.email,    dest: true  },
        { label: 'Perfil vinculado',val: c.perfil,   dest: false },
        { label: 'Função',          val: c.funcao,   dest: false },
        { label: 'Observação',      val: c.obs,      dest: false },
        { label: 'Cadastrado em',   val: formatarData(c.criadoEm), dest: false },
    ];
    $('detalhe-body').innerHTML = linhas
        .filter(l => l.val)
        .map(l => `
            <div class="det-row">
                <span class="det-label">${l.label}</span>
                <span class="det-val ${l.dest ? 'destaque' : ''}">${esc(l.val)}</span>
            </div>`).join('');
}

// ── API pública ───────────────────────────────────────────────────────────────
window.Contas = {

    filtrar() {
        renderLista();
    },

    voltarLista() {
        _atual = null;
        mostrarView('view-lista');
    },

    abrirNovo() {
        if (!podeCriar('contas')) { toast('Acesso negado'); return; }
        _atual = null;
        $('form-titulo').textContent = 'Nova Conta';
        $('form-id').value = '';
        ['nome','numero','chip','operadora','whatsapp','email','perfil','funcao','obs'].forEach(f => {
            const el = $('f-' + f);
            if (el) el.value = '';
        });
        mostrarView('view-form');
        $('f-nome').focus();
    },

    abrirDetalhe(id) {
        const c = _todas.find(x => x.id === id);
        if (!c) return;
        _atual = c;
        renderDetalhe(c);
        const editBtn = document.querySelector('.edit-btn');
        const exclBtn = document.querySelector('.btn-excluir');
        if (editBtn) editBtn.style.display = podeEditar('contas') ? '' : 'none';
        if (exclBtn) exclBtn.style.display = podeExcluir('contas') ? '' : 'none';
        mostrarView('view-detalhe');
    },

    abrirEdicao() {
        if (!podeEditar('contas')) { toast('Acesso negado'); return; }
        if (!_atual) return;
        $('form-titulo').textContent = 'Editar';
        $('form-id').value       = _atual.id;
        $('f-nome').value        = _atual.nome      || '';
        $('f-numero').value      = _atual.numero    || '';
        $('f-chip').value        = _atual.chip      || '';
        $('f-operadora').value   = _atual.operadora || '';
        $('f-whatsapp').value    = _atual.whatsapp  || '';
        $('f-email').value       = _atual.email     || '';
        $('f-perfil').value      = _atual.perfil    || '';
        $('f-funcao').value      = _atual.funcao    || '';
        $('f-obs').value         = _atual.obs       || '';
        mostrarView('view-form');
        $('f-nome').focus();
    },

    async salvar() {
        const id = $('form-id').value;
        if (id && !podeEditar('contas')) { toast('Acesso negado'); return; }
        if (!id && !podeCriar('contas')) { toast('Acesso negado'); return; }
        const nome = $('f-nome').value.trim();
        if (!nome) { toast('⚠️ Preencha o nome.'); return; }

        const dados = {
            nome,
            numero:    $('f-numero').value.trim(),
            chip:      $('f-chip').value.trim(),
            operadora: $('f-operadora').value.trim(),
            whatsapp:  $('f-whatsapp').value.trim(),
            email:     $('f-email').value.trim(),
            perfil:    $('f-perfil').value.trim(),
            funcao:    $('f-funcao').value.trim(),
            obs:       $('f-obs').value.trim(),
            atualizadoEm: serverTimestamp(),
        };

        try {
            if (id) {
                await Contas.update(id, dados);
                toast('✅ Atualizado');
            } else {
                dados.criadoEm = serverTimestamp();
                await Contas.create(dados);
                toast('✅ Salvo');
            }
            await carregar();
            mostrarView('view-lista');
        } catch (e) {
            toast('❌ Erro ao salvar');
            console.error(e);
        }
    },

    async excluir() {
        if (!podeExcluir('contas')) { toast('Acesso negado'); return; }
        if (!_atual) return;
        if (!confirm(`Excluir "${_atual.nome}"?`)) return;
        try {
            await Contas.remove(_atual.id);
            toast('🗑 Excluído');
            await carregar();
            mostrarView('view-lista');
        } catch (e) {
            toast('❌ Erro ao excluir');
            console.error(e);
        }
    },
};

// ── Init ──────────────────────────────────────────────────────────────────────
initModulo().then(async (ctx) => {
    if (!ctx) return;
    await carregarPermissoes(ctx);
    if (!podeVisualizar('contas')) {
        document.body.innerHTML = '<h2 style="text-align:center;margin-top:4rem;color:#ef4444">Acesso negado</h2>';
        return;
    }
    const addBtn = document.querySelector('.add-btn');
    if (addBtn) addBtn.style.display = podeCriar('contas') ? '' : 'none';
    carregar().catch(console.error);
});
