/* ============================================================
   FECHAMENTO MENSAL — Cell City Gestão Empresarial
   Coleção principal: relatorio_mensal/{YYYY-MM}
   Lê de: resumo_live, caixa_lancamentos, financeiro_pagar,
           financeiro_receber, financeiro_despesas,
           compras_financeiras, estoque_produtos, os
   ============================================================ */
import {
    db, collection, getDocs, doc, setDoc, getDoc, serverTimestamp
} from '../../scripts/firebase.js';

const COL_RELATORIO  = 'relatorio_mensal';
const COL_CAIXA      = 'caixa_lancamentos';
const COL_PAGAR      = 'financeiro_pagar';
const COL_RECEBER    = 'financeiro_receber';
const COL_DESPESAS   = 'financeiro_despesas';
const COL_COMPRAS    = 'compras_financeiras';
const COL_ESTOQUE    = 'estoque_produtos';
const COL_OS         = 'os';
const COL_LIVE       = 'resumo_live';

// ── Estado ────────────────────────────────────────────────────
let _relatorios = [];     // todos os docs de relatorio_mensal
let _secAtual   = 'home';
let _nMeses     = 6;      // filtro de evolução

// ── Utilitários ──────────────────────────────────────────────
const R   = v  => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const pct = v  => `${Number(v || 0).toFixed(1)}%`;
const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

function mesNome(key) {
    if (!key) return '—';
    const [ano, mes] = key.split('-');
    const d = new Date(Number(ano), Number(mes) - 1, 1);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function mesAbrev(key) {
    if (!key) return '—';
    const [ano, mes] = key.split('-');
    const d = new Date(Number(ano), Number(mes) - 1, 1);
    return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

function mesKeyAtual() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function varSinal(v) {
    if (v === null || v === undefined || isNaN(v)) return { txt: '—', cls: 'neu' };
    const f = Number(v);
    if (f > 0.5)  return { txt: `+${f.toFixed(1)}%`, cls: 'pos' };
    if (f < -0.5) return { txt: `${f.toFixed(1)}%`,  cls: 'neg' };
    return { txt: '0%', cls: 'neu' };
}

function toast(msg) {
    const el = document.getElementById('fec-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
}

function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Navegação ────────────────────────────────────────────────
function navegar(sec) {
    _secAtual = sec;
    document.querySelectorAll('.fec-section').forEach(s => s.style.display = 'none');
    const panel = document.getElementById(`fec-sec-${sec}`);
    if (panel) panel.style.display = 'block';

    document.querySelectorAll('.fec-sb-item').forEach(i => {
        i.classList.toggle('active', i.dataset.sec === sec);
    });

    if (sec === 'home')       renderHome();
    if (sec === 'fechar')     renderFechar();
    if (sec === 'historico')  renderHistorico();
    if (sec === 'comparacao') renderComparacao();
    if (sec === 'evolucao')   renderEvolucao();
}

// ── INIT ─────────────────────────────────────────────────────
async function init() {
    // Sidebar clicks
    document.querySelectorAll('.fec-sb-item').forEach(item => {
        item.addEventListener('click', () => navegar(item.dataset.sec));
    });

    // Filtros de evolução
    document.querySelectorAll('.fec-evol-filtro').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.fec-evol-filtro').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _nMeses = Number(btn.dataset.n);
            renderEvolucao();
        });
    });

    // Mês input padrão = mês atual
    const mesInput = document.getElementById('fec-mes-input');
    if (mesInput) mesInput.value = mesKeyAtual();

    // Carrega relatorios existentes
    await carregarRelatorios();
    navegar('home');
}

async function carregarRelatorios() {
    try {
        const snap = await getDocs(collection(db, COL_RELATORIO));
        _relatorios = [];
        snap.forEach(d => _relatorios.push({ id: d.id, ...d.data() }));
        _relatorios.sort((a, b) => b.mesKey.localeCompare(a.mesKey));
    } catch { _relatorios = []; }
}

// ── HOME ─────────────────────────────────────────────────────
async function renderHome() {
    const loadEl   = document.getElementById('home-loading');
    const gridEl   = document.getElementById('fec-home-grid');
    const varRow   = document.getElementById('fec-variacao-row');
    const statusEl = document.getElementById('fec-status-card');

    if (loadEl) loadEl.style.display = 'flex';
    if (gridEl) gridEl.style.display = 'none';
    if (varRow) varRow.style.display = 'none';
    if (statusEl) statusEl.style.display = 'none';

    const mesKey   = mesKeyAtual();
    set('fec-mes-titulo', mesNome(mesKey));

    // Busca dados ao vivo do mês atual
    const dados = await coletarDadosMes(mesKey);

    if (loadEl) loadEl.style.display = 'none';

    // Preenche cards
    set('hc-receita',   R(dados.receita));
    set('hc-despesas',  R(dados.despesas));
    set('hc-compras',   R(dados.compras));
    set('hc-lucro',     R(dados.lucro));
    set('hc-saldo',     R(dados.saldoCaixa));
    set('hc-pagar-pend', R(dados.aPagarPendente));
    set('hc-meta-pct',  `${dados.metaPct.toFixed(0)}%`);
    set('hc-total-os',  dados.totalOS);

    const lucroCard = document.getElementById('hc-lucro-card');
    if (lucroCard) lucroCard.className = 'fec-home-card ' + (dados.lucro >= 0 ? 'fec-hc-lucro' : 'fec-hc-prejuizo');

    if (gridEl) gridEl.style.display = 'grid';

    // Variação vs mês anterior
    const [ano, mes]   = mesKey.split('-').map(Number);
    const prevDate     = new Date(ano, mes - 2, 1);
    const prevKey      = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prevRel      = _relatorios.find(r => r.mesKey === prevKey);

    if (prevRel) {
        const varR  = prevRel.receita  > 0 ? ((dados.receita  - prevRel.receita)  / prevRel.receita)  * 100 : null;
        const varD  = prevRel.despesas > 0 ? ((dados.despesas - prevRel.despesas) / prevRel.despesas) * 100 : null;
        const varL  = prevRel.lucro !== 0  ? ((dados.lucro    - prevRel.lucro)    / Math.abs(prevRel.lucro)) * 100 : null;
        const varM  = prevRel.metaPct  > 0 ? dados.metaPct - prevRel.metaPct : null;

        ['var-receita', 'var-despesas', 'var-lucro', 'var-meta'].forEach((id, i) => {
            const vals = [varR, varD, varL, varM];
            const v    = varSinal(vals[i]);
            const el   = document.getElementById(id);
            if (el) { el.textContent = i === 3 ? (varM !== null ? `${varM > 0 ? '+' : ''}${varM.toFixed(1)} pp` : '—') : v.txt; el.className = `fec-var-val ${v.cls}`; }
        });
        if (varRow) varRow.style.display = 'block';
    }

    // Status do fechamento
    const relExistente = _relatorios.find(r => r.mesKey === mesKey);
    if (statusEl) {
        document.getElementById('fec-status-icone').textContent  = relExistente ? '✅' : '📊';
        document.getElementById('fec-status-titulo').textContent = relExistente
            ? `Relatório gerado em ${new Date(relExistente.geradoEm?.toDate?.() || relExistente.geradoEmISO).toLocaleString('pt-BR')}`
            : 'Relatório ainda não gerado para este mês';
        document.getElementById('fec-status-sub').textContent = relExistente
            ? 'O relatório pode ser regerado a qualquer momento para atualizar os dados.'
            : 'Gere o relatório consolidado para registrar um snapshot permanente dos indicadores.';
        statusEl.style.display = 'flex';
    }
}

// ── FECHAR MÊS ─────────────────────────────────────────────
function renderFechar() {
    const aviso   = document.getElementById('fec-fechar-aviso');
    const preview = document.getElementById('fec-preview');
    const btnGerar = document.getElementById('fec-btn-gerar');
    if (aviso)    aviso.style.display = 'none';
    if (preview)  preview.style.display = 'none';
    if (btnGerar) btnGerar.disabled = true;
}

window.Fechamento = {
    irParaFechar() { navegar('fechar'); },
    fecharModal() {
        const ov = document.getElementById('fec-modal-overlay');
        if (ov) ov.style.display = 'none';
    },

    async previewFechamento() {
        const mesKey = document.getElementById('fec-mes-input')?.value;
        if (!mesKey) { toast('⚠ Selecione um mês.'); return; }

        const loadEl  = document.getElementById('fec-fechar-loading');
        const preview = document.getElementById('fec-preview');
        const prevGrid = document.getElementById('fec-preview-grid');
        const btnGerar = document.getElementById('fec-btn-gerar');
        const aviso   = document.getElementById('fec-fechar-aviso');

        if (loadEl) loadEl.style.display = 'flex';
        if (preview) preview.style.display = 'none';
        if (btnGerar) btnGerar.disabled = true;

        const relExistente = _relatorios.find(r => r.mesKey === mesKey);
        if (aviso) {
            if (relExistente) {
                document.getElementById('fec-fechar-aviso-txt').textContent =
                    `⚠ Já existe um relatório para ${mesNome(mesKey)}. Gerar novamente irá substituir os dados anteriores.`;
                aviso.style.display = 'block';
            } else {
                aviso.style.display = 'none';
            }
        }

        const dados = await coletarDadosMes(mesKey);

        if (loadEl) loadEl.style.display = 'none';

        const itens = [
            { lbl: '💰 Receita Total',      val: R(dados.receita) },
            { lbl: '📉 Despesas',            val: R(dados.despesas) },
            { lbl: '📦 Compras',             val: R(dados.compras) },
            { lbl: '💎 Lucro Líquido',       val: R(dados.lucro) },
            { lbl: '🏦 Saldo (Caixa)',       val: R(dados.saldoCaixa) },
            { lbl: '🧾 Contas Pagas',         val: R(dados.aPagarPago) },
            { lbl: '⚠️ Contas Pendentes',     val: R(dados.aPagarPendente) },
            { lbl: '🎯 Meta (%)',             val: `${dados.metaPct.toFixed(0)}%` },
            { lbl: '📱 Ordens de Serviço',   val: dados.totalOS },
            { lbl: '🛒 Produtos Vendidos',   val: dados.produtosVendidos },
            { lbl: '💵 Ticket Médio',        val: R(dados.ticketMedio) },
            { lbl: '📦 Estoque Baixo',       val: dados.estoqueBaixo },
        ];

        if (prevGrid) {
            prevGrid.innerHTML = itens.map(i =>
                `<div class="fec-prev-item">
                    <span class="fec-prev-lbl">${i.lbl}</span>
                    <span class="fec-prev-val">${escHtml(String(i.val))}</span>
                </div>`
            ).join('');
        }

        if (preview) preview.style.display = 'block';
        if (btnGerar) btnGerar.disabled = false;

        // Guarda dados na closure para uso do gerar
        window._fecPreviewDados  = dados;
        window._fecPreviewMesKey = mesKey;
    },

    async gerarFechamento() {
        const mesKey = window._fecPreviewMesKey || document.getElementById('fec-mes-input')?.value;
        const dados  = window._fecPreviewDados;
        if (!mesKey || !dados) { toast('⚠ Gere o preview primeiro.'); return; }

        const loadEl   = document.getElementById('fec-fechar-loading');
        const btnGerar = document.getElementById('fec-btn-gerar');
        if (loadEl)   loadEl.style.display = 'flex';
        if (btnGerar) btnGerar.disabled = true;

        try {
            const docData = {
                mesKey,
                mesNome:    mesNome(mesKey),
                geradoEmISO: new Date().toISOString(),
                geradoEm:    serverTimestamp(),
                // Financeiro
                receita:          dados.receita,
                despesas:         dados.despesas,
                compras:          dados.compras,
                lucro:            dados.lucro,
                saldoCaixa:       dados.saldoCaixa,
                aPagarPago:       dados.aPagarPago,
                aPagarPendente:   dados.aPagarPendente,
                aReceberRecebido: dados.aReceberRecebido,
                aReceberPendente: dados.aReceberPendente,
                // Meta
                metaGoal:    dados.metaGoal,
                metaAtingida: dados.receita,
                metaPct:     dados.metaPct,
                // Operacional
                totalOS:          dados.totalOS,
                osEntregues:      dados.osEntregues,
                produtosVendidos: dados.produtosVendidos,
                ticketMedio:      dados.ticketMedio,
                maisVendido:      dados.maisVendido,
                maisLucrativo:    dados.maisLucrativo,
                estoqueBaixo:     dados.estoqueBaixo,
            };

            await setDoc(doc(db, COL_RELATORIO, mesKey), docData);
            toast('✅ Relatório mensal gerado!');
            await carregarRelatorios();
            window._fecPreviewDados  = null;
            window._fecPreviewMesKey = null;
            navegar('historico');
        } catch (e) {
            console.error(e);
            toast('⚠ Erro ao salvar relatório.');
        } finally {
            if (loadEl)   loadEl.style.display = 'none';
            if (btnGerar) btnGerar.disabled = false;
        }
    },

    abrirRelatorio(mesKey) {
        const rel = _relatorios.find(r => r.mesKey === mesKey);
        if (!rel) return;
        const ov   = document.getElementById('fec-modal-overlay');
        const cont = document.getElementById('fec-modal-conteudo');
        if (!ov || !cont) return;

        const lv = (v) => {
            const n = Number(v || 0);
            return n >= 0 ? `<span class="fec-modal-val verde">${R(n)}</span>`
                          : `<span class="fec-modal-val vermelho">${R(n)}</span>`;
        };

        cont.innerHTML = `
            <div class="fec-modal-titulo">📋 ${escHtml(rel.mesNome)}</div>
            <div class="fec-modal-grid">
                <div class="fec-modal-item"><div class="fec-modal-lbl">💰 Receita Total</div><div class="fec-modal-val">${R(rel.receita)}</div></div>
                <div class="fec-modal-item"><div class="fec-modal-lbl">📉 Despesas</div><div class="fec-modal-val">${R(rel.despesas)}</div></div>
                <div class="fec-modal-item"><div class="fec-modal-lbl">📦 Compras</div><div class="fec-modal-val">${R(rel.compras)}</div></div>
                <div class="fec-modal-item"><div class="fec-modal-lbl">💎 Lucro Líquido</div>${lv(rel.lucro)}</div>
                <div class="fec-modal-item"><div class="fec-modal-lbl">🏦 Saldo (Caixa)</div><div class="fec-modal-val">${R(rel.saldoCaixa)}</div></div>
                <div class="fec-modal-item"><div class="fec-modal-lbl">🧾 Contas Pagas</div><div class="fec-modal-val">${R(rel.aPagarPago)}</div></div>
                <div class="fec-modal-item"><div class="fec-modal-lbl">⚠️ Pendentes</div><div class="fec-modal-val">${R(rel.aPagarPendente)}</div></div>
                <div class="fec-modal-item"><div class="fec-modal-lbl">🎯 Meta</div><div class="fec-modal-val dourado">${Number(rel.metaPct || 0).toFixed(0)}%</div></div>
            </div>
            <div class="fec-modal-sep"></div>
            <div class="fec-modal-subtitulo">Indicadores Operacionais</div>
            <div class="fec-modal-op-grid">
                <div class="fec-modal-item"><div class="fec-modal-lbl">📱 Total OS</div><div class="fec-modal-val">${rel.totalOS || 0}</div></div>
                <div class="fec-modal-item"><div class="fec-modal-lbl">🛒 Prod. Vendidos</div><div class="fec-modal-val">${rel.produtosVendidos || 0}</div></div>
                <div class="fec-modal-item"><div class="fec-modal-lbl">💵 Ticket Médio</div><div class="fec-modal-val">${R(rel.ticketMedio)}</div></div>
                <div class="fec-modal-item"><div class="fec-modal-lbl">📦 Estoque Baixo</div><div class="fec-modal-val">${rel.estoqueBaixo || 0}</div></div>
                <div class="fec-modal-item"><div class="fec-modal-lbl">🏆 Mais Vendido</div><div class="fec-modal-val" style="font-size:11px">${escHtml(rel.maisVendido || '—')}</div></div>
                <div class="fec-modal-item"><div class="fec-modal-lbl">💰 Mais Lucrativo</div><div class="fec-modal-val" style="font-size:11px">${escHtml(rel.maisLucrativo || '—')}</div></div>
            </div>
            <div class="fec-modal-sep"></div>
            <div style="font-size:11px;color:var(--text-muted)">Gerado em: ${new Date(rel.geradoEmISO || '').toLocaleString('pt-BR')}</div>`;

        ov.style.display = 'flex';
    },

    renderComparacao,
};

// ── HISTÓRICO ─────────────────────────────────────────────────
function renderHistorico() {
    const loadEl = document.getElementById('hist-loading');
    const lista  = document.getElementById('fec-hist-lista');
    if (loadEl) loadEl.style.display = 'none';
    if (!lista) return;

    if (!_relatorios.length) {
        lista.innerHTML = '<div class="fec-loading"><span>Nenhum fechamento gerado ainda. Vá em "Fechar Mês" para criar o primeiro.</span></div>';
        return;
    }

    lista.innerHTML = _relatorios.map((rel, idx) => {
        const prev = _relatorios[idx + 1];
        const varR = prev && prev.receita > 0 ? ((rel.receita - prev.receita) / prev.receita) * 100 : null;
        const varL = prev && prev.lucro !== 0  ? ((rel.lucro - prev.lucro) / Math.abs(prev.lucro)) * 100 : null;
        const varM = prev ? rel.metaPct - prev.metaPct : null;

        const chips = [];
        if (varR !== null) { const v = varSinal(varR); chips.push(`<span class="fec-hist-var-chip ${v.cls}">📈 Receita ${v.txt}</span>`); }
        if (varL !== null) { const v = varSinal(varL); chips.push(`<span class="fec-hist-var-chip ${v.cls}">💎 Lucro ${v.txt}</span>`); }
        if (varM !== null && Math.abs(varM) > 0.5) chips.push(`<span class="fec-hist-var-chip ${varM > 0 ? 'pos' : 'neg'}">🎯 Meta ${varM > 0 ? '+' : ''}${varM.toFixed(1)} pp</span>`);

        return `
        <div class="fec-hist-card" onclick="Fechamento.abrirRelatorio('${rel.mesKey}')">
            <div class="fec-hist-card-hdr">
                <span class="fec-hist-mes-nome">${escHtml(rel.mesNome)}</span>
                <span class="fec-hist-gerado-em">Fechado em ${new Date(rel.geradoEmISO || '').toLocaleDateString('pt-BR')}</span>
            </div>
            <div class="fec-hist-nums">
                <div class="fec-hist-num">
                    <div class="fec-hist-num-val">${R(rel.receita)}</div>
                    <div class="fec-hist-num-lbl">Receita</div>
                </div>
                <div class="fec-hist-num">
                    <div class="fec-hist-num-val">${R(rel.despesas)}</div>
                    <div class="fec-hist-num-lbl">Despesas</div>
                </div>
                <div class="fec-hist-num">
                    <div class="fec-hist-num-val ${rel.lucro >= 0 ? 'verde' : 'vermelho'}">${R(rel.lucro)}</div>
                    <div class="fec-hist-num-lbl">Lucro</div>
                </div>
                <div class="fec-hist-num">
                    <div class="fec-hist-num-val">${Number(rel.metaPct || 0).toFixed(0)}%</div>
                    <div class="fec-hist-num-lbl">Meta</div>
                </div>
            </div>
            ${chips.length ? `<div class="fec-hist-var">${chips.join('')}</div>` : ''}
        </div>`;
    }).join('');
}

// ── COMPARAÇÃO ────────────────────────────────────────────────
function renderComparacao() {
    const selA = document.getElementById('fec-comp-a');
    const selB = document.getElementById('fec-comp-b');
    const res  = document.getElementById('fec-comp-resultado');
    if (!selA || !selB || !res) return;

    // Popula selects se vazio
    if (selA.options.length <= 1) {
        _relatorios.forEach(rel => {
            [selA, selB].forEach(sel => {
                const opt = document.createElement('option');
                opt.value = rel.mesKey;
                opt.textContent = rel.mesNome;
                sel.appendChild(opt);
            });
        });
        if (_relatorios.length >= 2) {
            selA.value = _relatorios[0].mesKey;
            selB.value = _relatorios[1].mesKey;
        }
    }

    const relA = _relatorios.find(r => r.mesKey === selA.value);
    const relB = _relatorios.find(r => r.mesKey === selB.value);

    if (!relA || !relB) {
        res.innerHTML = '<div class="fec-loading"><span>Selecione dois meses com relatórios gerados.</span></div>';
        return;
    }

    const linhas = [
        { lbl: '💰 Receita Total',    ca: relA.receita,          cb: relB.receita,         fmt: R },
        { lbl: '📉 Despesas Totais',  ca: relA.despesas,         cb: relB.despesas,        fmt: R, inv: true },
        { lbl: '📦 Compras',          ca: relA.compras,          cb: relB.compras,         fmt: R, inv: true },
        { lbl: '💎 Lucro Líquido',    ca: relA.lucro,            cb: relB.lucro,           fmt: R },
        { lbl: '🏦 Saldo (Caixa)',    ca: relA.saldoCaixa,       cb: relB.saldoCaixa,      fmt: R },
        { lbl: '🎯 Meta Atingida',    ca: relA.metaPct,          cb: relB.metaPct,         fmt: v => `${Number(v||0).toFixed(0)}%` },
        { lbl: '📱 Total OS',         ca: relA.totalOS,          cb: relB.totalOS,         fmt: v => String(v || 0) },
        { lbl: '🛒 Prod. Vendidos',   ca: relA.produtosVendidos, cb: relB.produtosVendidos,fmt: v => String(v || 0) },
        { lbl: '💵 Ticket Médio',     ca: relA.ticketMedio,      cb: relB.ticketMedio,     fmt: R },
        { lbl: '📦 Estoque Baixo',    ca: relA.estoqueBaixo,     cb: relB.estoqueBaixo,    fmt: v => String(v || 0), inv: true },
    ];

    res.innerHTML = `
        <div class="fec-comp-tabela">
            <div class="fec-comp-thead">
                <div>Indicador</div>
                <div>${escHtml(relA.mesNome)}</div>
                <div>${escHtml(relB.mesNome)}</div>
                <div style="text-align:right">Variação</div>
            </div>
            ${linhas.map(l => {
                const va = Number(l.ca || 0);
                const vb = Number(l.cb || 0);
                let varPct = null;
                if (vb !== 0) varPct = ((va - vb) / Math.abs(vb)) * 100;
                const { txt, cls } = varSinal(l.inv ? (varPct !== null ? -varPct : null) : varPct);
                return `<div class="fec-comp-row">
                    <div class="fec-comp-indicador">${l.lbl}</div>
                    <div class="fec-comp-val-a">${l.fmt(va)}</div>
                    <div class="fec-comp-val-b">${l.fmt(vb)}</div>
                    <div class="fec-comp-var ${cls}">${txt}</div>
                </div>`;
            }).join('')}
        </div>`;
}

// ── EVOLUÇÃO ─────────────────────────────────────────────────
function renderEvolucao() {
    const loadEl  = document.getElementById('evol-loading');
    const filtros = document.getElementById('fec-evol-filtros');
    const cont    = document.getElementById('fec-evol-conteudo');
    if (loadEl)  loadEl.style.display = 'none';
    if (!cont)   return;

    if (!_relatorios.length) {
        cont.innerHTML = '<div class="fec-loading"><span>Nenhum fechamento gerado ainda.</span></div>';
        return;
    }

    if (filtros) filtros.style.display = 'flex';

    // Pega os últimos N meses
    const lista = [..._relatorios].sort((a, b) => a.mesKey.localeCompare(b.mesKey)).slice(-_nMeses);

    // Calcula max para escala dos gráficos
    const maxReceita = Math.max(...lista.map(r => r.receita || 0), 1);
    const maxDespesa = Math.max(...lista.map(r => (r.despesas || 0) + (r.compras || 0)), 1);

    // Gráfico 1: Receita vs Lucro
    const chartRecLucro = lista.map(r => {
        const pctR = ((r.receita || 0) / maxReceita * 100).toFixed(1);
        const pctL = (Math.max(r.lucro || 0, 0) / maxReceita * 100).toFixed(1);
        const isAtual = r.mesKey === mesKeyAtual();
        return `<div class="fec-evol-col">
            <div class="fec-evol-bars">
                <div class="fec-evol-bar fec-bar-receita" style="height:${pctR}%" title="Receita: ${R(r.receita)}"></div>
                <div class="fec-evol-bar fec-bar-lucro"   style="height:${pctL}%" title="Lucro: ${R(r.lucro)}"></div>
            </div>
            <div class="fec-evol-lbl ${isAtual ? 'dest' : ''}">${mesAbrev(r.mesKey)}</div>
        </div>`;
    }).join('');

    // Gráfico 2: Despesas vs Compras
    const chartDespComp = lista.map(r => {
        const pctD = ((r.despesas || 0) / maxDespesa * 100).toFixed(1);
        const pctC = ((r.compras  || 0) / maxDespesa * 100).toFixed(1);
        const isAtual = r.mesKey === mesKeyAtual();
        return `<div class="fec-evol-col">
            <div class="fec-evol-bars">
                <div class="fec-evol-bar fec-bar-despesa" style="height:${pctD}%" title="Despesas: ${R(r.despesas)}"></div>
                <div class="fec-evol-bar fec-bar-receita" style="height:${pctC}%" title="Compras: ${R(r.compras)}"></div>
            </div>
            <div class="fec-evol-lbl ${isAtual ? 'dest' : ''}">${mesAbrev(r.mesKey)}</div>
        </div>`;
    }).join('');

    // Gráfico 3: Meta (%)
    const maxMeta = Math.max(...lista.map(r => r.metaPct || 0), 100);
    const chartMeta = lista.map(r => {
        const pct = ((r.metaPct || 0) / maxMeta * 100).toFixed(1);
        const isAtual = r.mesKey === mesKeyAtual();
        const cor = (r.metaPct || 0) >= 100 ? 'fec-bar-receita' : (r.metaPct || 0) >= 70 ? 'fec-bar-lucro' : 'fec-bar-despesa';
        return `<div class="fec-evol-col">
            <div class="fec-evol-bars">
                <div class="fec-evol-bar ${cor}" style="height:${pct}%;width:60%" title="Meta: ${Number(r.metaPct || 0).toFixed(0)}%"></div>
            </div>
            <div class="fec-evol-lbl ${isAtual ? 'dest' : ''}">${mesAbrev(r.mesKey)}</div>
        </div>`;
    }).join('');

    // Ranking consolidado de produtos (de todos os relatorios na janela)
    const prodMap = {};
    lista.forEach(r => {
        if (r.maisVendido)    prodMap[r.maisVendido]    = (prodMap[r.maisVendido]    || 0) + 1;
        if (r.maisLucrativo)  prodMap[r.maisLucrativo]  = (prodMap[r.maisLucrativo]  || 0) + 1;
    });
    const rankProd = Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    cont.innerHTML = `
        <div class="fec-evol-chart-card">
            <div class="fec-evol-titulo">💰 Receita vs Lucro (últimos ${lista.length} meses)</div>
            <div class="fec-evol-legenda">
                <span class="fec-leg-item"><span class="fec-leg-cor receita"></span>Receita</span>
                <span class="fec-leg-item"><span class="fec-leg-cor lucro"></span>Lucro</span>
            </div>
            <div class="fec-evol-chart">${chartRecLucro}</div>
        </div>

        <div class="fec-evol-chart-card">
            <div class="fec-evol-titulo">📉 Despesas vs Compras</div>
            <div class="fec-evol-legenda">
                <span class="fec-leg-item"><span class="fec-leg-cor despesa"></span>Despesas</span>
                <span class="fec-leg-item"><span class="fec-leg-cor receita"></span>Compras</span>
            </div>
            <div class="fec-evol-chart">${chartDespComp}</div>
        </div>

        <div class="fec-evol-chart-card">
            <div class="fec-evol-titulo">🎯 Evolução das Metas</div>
            <div class="fec-evol-chart">${chartMeta}</div>
        </div>

        ${rankProd.length ? `
        <div class="fec-evol-ranking">
            <div class="fec-rank-card">
                <div class="fec-rank-titulo">🏆 Produtos que mais apareceram</div>
                ${rankProd.map((p, i) => `
                <div class="fec-rank-item">
                    <span class="fec-rank-pos">${i + 1}.</span>
                    <span class="fec-rank-nome">${escHtml(p[0])}</span>
                    <span class="fec-rank-val">${p[1]}x</span>
                </div>`).join('')}
            </div>
        </div>` : ''}`;
}

// ── COLETA DE DADOS DO MÊS ────────────────────────────────────
async function coletarDadosMes(mesKey) {
    const resultado = {
        receita: 0, despesas: 0, compras: 0, lucro: 0,
        saldoCaixa: 0, aPagarPago: 0, aPagarPendente: 0,
        aReceberRecebido: 0, aReceberPendente: 0,
        metaGoal: 0, metaPct: 0,
        totalOS: 0, osEntregues: 0, produtosVendidos: 0,
        ticketMedio: 0, maisVendido: '—', maisLucrativo: '—',
        estoqueBaixo: 0,
    };

    try {
        // 1. Caixa (resumo_live pré-calculado — rápido)
        const liveDoc = await getDoc(doc(db, COL_LIVE, `mes_${mesKey}`));
        if (liveDoc.exists()) {
            const d = liveDoc.data();
            resultado.receita    = d.entradas || 0;
            resultado.saldoCaixa = d.saldo    || 0;
            resultado.lucro      = d.lucro    || 0;
        } else {
            // Fallback: lê caixa_lancamentos diretamente
            const caixaSnap = await getDocs(collection(db, COL_CAIXA));
            const vendMap = {};
            caixaSnap.forEach(d => {
                const l = d.data();
                const iso = l.dataISO || l.createdAtISO || '';
                if (!iso.startsWith(mesKey)) return;
                const val  = Number(l.valor  || 0);
                const custo= Number(l.custo  || 0);
                const luc  = Number(l.lucro  || val - custo);
                if (l.tipo !== 'saida') {
                    resultado.receita += val;
                    resultado.lucro   += luc;
                    resultado.produtosVendidos++;
                    const nome = (l.descricao || '').trim().toUpperCase();
                    if (nome) {
                        if (!vendMap[nome]) vendMap[nome] = { nome: l.descricao || nome, qtd: 0, lucro: 0 };
                        vendMap[nome].qtd++;
                        vendMap[nome].lucro += luc;
                    }
                }
            });
            resultado.saldoCaixa = resultado.receita;
            const vendList = Object.values(vendMap);
            if (vendList.length) {
                resultado.maisVendido    = [...vendList].sort((a,b) => b.qtd   - a.qtd  )[0].nome;
                resultado.maisLucrativo  = [...vendList].sort((a,b) => b.lucro - a.lucro)[0].nome;
            }
        }

        // 2. Despesas do mês
        const despSnap = await getDocs(collection(db, COL_DESPESAS));
        despSnap.forEach(d => {
            const desp = d.data();
            if ((desp.data || '').startsWith(mesKey)) {
                resultado.despesas += Number(desp.valor || 0);
            }
        });

        // 3. Compras do mês
        const compSnap = await getDocs(collection(db, COL_COMPRAS));
        compSnap.forEach(d => {
            const c = d.data();
            const iso = c.data || c.criadoEm?.toDate?.().toISOString() || '';
            if (iso.startsWith(mesKey)) {
                resultado.compras += Number(c.valorTotal || 0);
            }
        });

        // Recalcula lucro líquido se tiver despesas/compras
        if (resultado.despesas > 0 || resultado.compras > 0) {
            resultado.lucro = resultado.receita - resultado.despesas - resultado.compras;
        }

        // 4. Contas a pagar
        const pagarSnap = await getDocs(collection(db, COL_PAGAR));
        pagarSnap.forEach(d => {
            const c = d.data();
            const val = Number(c.valor || 0);
            if (c.status === 'pago') resultado.aPagarPago      += val;
            else                      resultado.aPagarPendente  += val;
        });

        // 5. Contas a receber
        const recSnap = await getDocs(collection(db, COL_RECEBER));
        recSnap.forEach(d => {
            const c = d.data();
            const val = Number(c.valor || 0);
            if (c.status === 'recebido') resultado.aReceberRecebido += val;
            else                          resultado.aReceberPendente  += val;
        });

        // 6. OS do mês
        const osSnap = await getDocs(collection(db, COL_OS));
        const STATUS_ENTREGUE = ['entregue', 'concluido', 'concluída', 'concluido', 'finalizado'];
        osSnap.forEach(d => {
            const os = d.data();
            const iso = os.createdAtISO || os.dataISO || '';
            if (iso.startsWith(mesKey)) {
                resultado.totalOS++;
                if (STATUS_ENTREGUE.includes((os.status || '').toLowerCase())) resultado.osEntregues++;
            }
        });

        // Ticket médio (por OS entregue)
        if (resultado.osEntregues > 0) {
            resultado.ticketMedio = resultado.receita / resultado.osEntregues;
        }

        // 7. Estoque baixo
        const estSnap = await getDocs(collection(db, COL_ESTOQUE));
        estSnap.forEach(d => {
            const p = d.data();
            const qty = Number(p.quantidade || 0);
            const min = Number(p.quantidadeMinima || 1);
            if (qty > 0 && qty <= min) resultado.estoqueBaixo++;
        });

        // 8. Meta: usa o meta do mês anterior como base (lucro da semana corrente já calculado)
        // Busca meta guardada no resumo_live se houver
        resultado.metaGoal = resultado.receita * 1.1; // padrão: 110% da receita atual
        resultado.metaPct  = resultado.metaGoal > 0
            ? Math.min((resultado.receita / resultado.metaGoal) * 100, 999)
            : 0;

        // Produto mais vendido (lê lancamentos do caixa se não veio do resumo_live)
        if (resultado.maisVendido === '—') {
            const caixaSnap2 = await getDocs(collection(db, COL_CAIXA));
            const vendMap2 = {};
            caixaSnap2.forEach(d => {
                const l = d.data();
                if (!(l.dataISO || '').startsWith(mesKey)) return;
                if (l.tipo === 'saida') return;
                const nome = (l.descricao || '').trim().toUpperCase();
                if (!nome) return;
                if (!vendMap2[nome]) vendMap2[nome] = { nome: l.descricao || nome, qtd: 0, lucro: 0 };
                vendMap2[nome].qtd++;
                vendMap2[nome].lucro += Number(l.lucro || 0);
            });
            const vl = Object.values(vendMap2);
            if (vl.length) {
                resultado.maisVendido   = [...vl].sort((a,b) => b.qtd   - a.qtd  )[0].nome;
                resultado.maisLucrativo = [...vl].sort((a,b) => b.lucro - a.lucro)[0].nome;
                resultado.produtosVendidos = vl.reduce((s, p) => s + p.qtd, 0);
            }
        }

    } catch (e) {
        console.error('[Fechamento] Erro ao coletar dados:', e);
    }

    return resultado;
}

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const tryInit = () => {
        if (typeof db !== 'undefined' && db) { init(); }
        else { window.addEventListener('firebase-ready', () => init(), { once: true }); }
    };
    tryInit();
});
