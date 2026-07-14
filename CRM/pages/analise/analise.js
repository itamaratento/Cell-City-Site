import { db, collection, getDocs, query } from "../../scripts/firebase.js";
import { initModulo } from '../../scripts/kernel.js';
import { carregarPermissoes, podeVisualizar } from '../../shared/permissoes.js';
import { injectTenantFilter } from '../../shared/tenant-query.js';

// ── Estado
let todos       = [];
let anoTopo     = new Date().getFullYear();
let periodo     = 'mensal';
let mesFiltrado = null; // null = todos os meses; número 1-12 = mês selecionado

const MESES   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_L = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const fmtBRL  = v => `R$ ${Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
const fmtK    = v => { const n=Number(v||0); return Math.abs(n)>=1000?`R$ ${(n/1000).toFixed(1)}k`:`R$ ${Math.round(n)}`; };

// ── Firestore: lê todos os lançamentos
async function carregar() {
    const snap = await getDocs(query(collection(db, 'caixa_lancamentos'), ...injectTenantFilter([])));
    todos = snap.docs.map(d => {
        const data = d.data();
        return {
            ano:     Number(data.ano || 0),
            mes:     String(data.mes || ''),
            dataISO: String(data.dataISO || ''),
            lucro:   Number(data.lucro || 0),
        };
    });
}

// ── Semana ISO
function weekNum(dateStr) {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 4 - (d.getDay()||7));
    const jan1 = new Date(d.getFullYear(),0,1);
    return Math.ceil((((d-jan1)/86400000)+1)/7);
}

// ── Agrega dados por período
function agregar(ano) {
    const data = todos.filter(i => i.ano === ano);

    if (periodo === 'mensal') {
        const vals = new Array(12).fill(0);
        data.forEach(i => {
            const m = parseInt((i.mes||'').split('-')[1]) - 1;
            if (m >= 0 && m < 12) vals[m] += i.lucro;
        });
        return { labels: MESES, vals };
    }

    if (periodo === 'semanal') {
        const map = {};
        data.forEach(i => {
            if (!i.dataISO) return;
            // Filtrar por mês se selecionado
            if (mesFiltrado !== null) {
                const mes = new Date(i.dataISO).getMonth() + 1;
                if (mes !== mesFiltrado) return;
            }
            const w = weekNum(i.dataISO);
            if (w > 0) map[w] = (map[w]||0) + i.lucro;
        });
        const semanas = Object.keys(map).map(Number).sort((a,b)=>a-b);
        return { labels: semanas.map(w=>`S${w}`), vals: semanas.map(w=>map[w]) };
    }

    // anual — mostra os anos com dados
    const porAno = {};
    todos.forEach(i => { if (i.ano) porAno[i.ano] = (porAno[i.ano]||0) + i.lucro; });
    const anos = Object.keys(porAno).map(Number).sort();
    return { labels: anos.map(String), vals: anos.map(a=>porAno[a]) };
}

// ── Desenha gráfico de barras no canvas
function desenhar(canvasId, { labels, vals }, corPrimaria) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const DPR = window.devicePixelRatio || 1;
    const W   = canvas.parentElement.clientWidth;
    const H   = 160;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR);
    ctx.clearRect(0,0,W,H);

    if (!vals.length) return;

    const PL=44, PR=8, PT=18, PB=22;
    const cW = W-PL-PR, cH = H-PT-PB;
    const max   = Math.max(...vals, 1);
    const n     = labels.length;
    const slot  = cW / n;
    const BW    = Math.max(3, Math.floor(slot * 0.55));
    const offset = (slot - BW) / 2;

    // Linhas de grade + eixo Y
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i=0; i<=4; i++) {
        const y = PT + (cH/4)*i;
        ctx.beginPath(); ctx.moveTo(PL,y); ctx.lineTo(PL+cW,y); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.font = `9px Inter,sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(fmtK(max*(1-i/4)), PL-4, y+3);
    }

    // Barras
    vals.forEach((val, i) => {
        const x  = PL + i*slot + offset;
        const bH = Math.max(2, (Math.max(val,0)/max)*cH);
        const y  = PT + cH - bH;

        const grad = ctx.createLinearGradient(0, y, 0, y+bH);
        grad.addColorStop(0, corPrimaria);
        grad.addColorStop(1, corPrimaria.replace(/[\d.]+\)$/, '0.15)'));
        ctx.fillStyle = grad;

        const r = Math.min(4, bH/2);
        ctx.beginPath();
        ctx.moveTo(x+r,y); ctx.lineTo(x+BW-r,y);
        ctx.quadraticCurveTo(x+BW,y,x+BW,y+r);
        ctx.lineTo(x+BW,y+bH); ctx.lineTo(x,y+bH);
        ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
        ctx.closePath(); ctx.fill();

        // Label eixo X
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = `8px Inter,sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(labels[i], x+BW/2, H-PB+14);

        // Valor acima da barra
        if (val > 0) {
            ctx.fillStyle = corPrimaria.replace(/[\d.]+\)$/, '0.9)');
            ctx.font = `bold 8px Inter,sans-serif`;
            ctx.fillText(fmtK(val), x+BW/2, y-3);
        }
    });
}

// ── Renderiza os dois gráficos
function renderGraficos() {
    const anoBaixo = anoTopo - 1;

    // Labels
    document.getElementById('an-label-topo').textContent  = anoTopo;
    document.getElementById('an-label-baixo').textContent = anoBaixo;

    // Gráfico topo (ano selecionado) — verde
    const dadosTopo = agregar(anoTopo);
    desenhar('an-chart-topo', dadosTopo, 'rgba(52,211,153,1)');
    const totalTopo = dadosTopo.vals.reduce((s,v)=>s+v,0);
    document.getElementById('an-subtotal-topo').textContent =
        totalTopo > 0 ? `Total: ${fmtBRL(totalTopo)}` : 'Sem dados';

    // Gráfico baixo (ano anterior) — azul
    // Para mensal/semanal: usar os mesmos labels do topo para alinhar eixos
    let dadosBaixo;
    if (periodo === 'anual') {
        dadosBaixo = agregar(anoBaixo);
    } else {
        // Forçar mesmos labels do topo para comparação visual
        const raw = agregar(anoBaixo);
        dadosBaixo = {
            labels: dadosTopo.labels,
            vals:   dadosTopo.labels.map((_, i) => raw.vals[i] ?? 0),
        };
    }
    desenhar('an-chart-baixo', dadosBaixo, 'rgba(96,165,250,1)');
    const totalBaixo = dadosBaixo.vals.reduce((s,v)=>s+v,0);
    document.getElementById('an-subtotal-baixo').textContent =
        totalBaixo > 0 ? `Total: ${fmtBRL(totalBaixo)}` : 'Sem dados';
}

// ══════════════════════════════════════
// RENDER: Tabs de ano (só anos com dados)
// ══════════════════════════════════════
function renderAnoTabs() {
    const anos = [...new Set(todos.map(i=>i.ano).filter(Boolean))].sort((a,b)=>b-a);
    document.getElementById('an-ano-tabs').innerHTML = anos.map(a =>
        `<div class="an-ano-tab${a===anoTopo?' active':''}" onclick="selecionarAno(${a})">${a}</div>`
    ).join('');
}

window.selecionarAno = function(ano) {
    anoTopo = ano;
    mesFiltrado = null;
    renderAnoTabs();
    renderMesFiltro();
    renderGraficos();
};

// ══════════════════════════════════════
// RENDER: Tabela comparativa anual
// ══════════════════════════════════════
function agruparMapa(anosExtras=[]) {
    const map = {};
    for (const a of anosExtras) map[a] = new Array(12).fill(0);
    todos.forEach(l => {
        if (!l.ano || !l.mes) return;
        const m = parseInt(l.mes.split('-')[1]) - 1;
        if (m < 0 || m > 11) return;
        if (!map[l.ano]) map[l.ano] = new Array(12).fill(0);
        map[l.ano][m] += l.lucro;
    });
    return map;
}

function renderTabela() {
    const anoAtualNum = new Date().getFullYear();
    const map  = agruparMapa([anoAtualNum - 1]);
    const anos = Object.keys(map).map(Number).sort();
    const maxPorMes = MESES.map((_,m) => Math.max(...anos.map(a=>map[a][m]||0)));

    let html = '<thead><tr><th class="an-th-ano">Ano</th>';
    MESES.forEach(m => html += `<th>${m}</th>`);
    html += '<th>Total</th></tr></thead><tbody>';

    for (const ano of anos) {
        const vals  = map[ano];
        const total = vals.reduce((s,v)=>s+v,0);
        const semDados = total === 0 && ano === anoAtualNum - 1;
        html += `<tr><td class="an-td-ano">${ano}${semDados?' <span class="an-tag-nd">sem dados</span>':''}</td>`;
        vals.forEach((v,m) => {
            const cls = v>0&&v===maxPorMes[m]?'an-td-best':v===0?'an-td-zero':'';
            html += `<td class="${cls}">${v===0?'—':fmtK(v)}</td>`;
        });
        html += `<td class="an-td-total${total===0?' an-td-zero':''}">${total===0?'—':fmtK(total)}</td></tr>`;
    }
    html += '</tbody>';
    document.getElementById('an-tabela').innerHTML = html;
}

// ══════════════════════════════════════
// RENDER: Ranking
// ══════════════════════════════════════
function renderRanking() {
    const map = agruparMapa();
    const flat = [];
    for (const [ano, vals] of Object.entries(map))
        vals.forEach((v,m) => { if(v>0) flat.push({ano:Number(ano),mes:m,valor:v}); });
    flat.sort((a,b) => b.valor-a.valor);

    const posClass = i => i===0?'gold':i===1?'silver':i===2?'bronze':'';
    const posIcon  = i => i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`;

    const top = flat.slice(0,10);
    if (!top.length) {
        document.getElementById('an-ranking').innerHTML = '<div class="an-empty">Sem dados de lucro ainda.</div>';
        return;
    }
    document.getElementById('an-ranking').innerHTML = top.map((item,i) => `
        <div class="an-rank-item">
            <div class="an-rank-pos ${posClass(i)}">${posIcon(i)}</div>
            <div class="an-rank-label">${MESES_L[item.mes]}</div>
            <div class="an-rank-ano">${item.ano}</div>
            <div class="an-rank-valor">${fmtBRL(item.valor)}</div>
        </div>`).join('');
}

// ══════════════════════════════════════
// FILTRO DE MÊS (modo Semanal)
// ══════════════════════════════════════
function renderMesFiltro() {
    const wrap  = document.getElementById('an-mes-filtro');
    const chips = document.getElementById('an-mes-chips');
    if (!wrap || !chips) return;

    if (periodo !== 'semanal') {
        wrap.style.display = 'none';
        return;
    }

    wrap.style.display = 'flex';

    // Quais meses têm dados no ano topo?
    const comDados = new Set(
        todos.filter(i => i.ano === anoTopo && i.dataISO)
             .map(i => new Date(i.dataISO).getMonth() + 1)
    );

    chips.innerHTML = `
        <button class="an-mes-chip${mesFiltrado===null?' active':''}" data-mes="null">Todos</button>
        ${MESES.map((m, i) => {
            const num = i + 1;
            const temDados = comDados.has(num);
            return `<button class="an-mes-chip${mesFiltrado===num?' active':''}${!temDados?' vazio':''}" data-mes="${num}">${m}</button>`;
        }).join('')}
    `;

    chips.querySelectorAll('.an-mes-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.mes;
            mesFiltrado = val === 'null' ? null : Number(val);
            renderMesFiltro();
            renderGraficos();
        });
    });
}

// ══════════════════════════════════════
// PERÍODO
// ══════════════════════════════════════
function setupPeriodoTabs() {
    document.querySelectorAll('.an-period-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.an-period-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            periodo = tab.dataset.period;
            mesFiltrado = null; // reset ao trocar período
            renderMesFiltro();
            renderGraficos();
        });
    });
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
async function init() {
    try {
        const ctx = await initModulo();
        if (!ctx) return;
        await carregarPermissoes(ctx);
        if (!podeVisualizar('analise')) {
            document.body.innerHTML = '<h2 style="text-align:center;margin-top:4rem;color:#ef4444">Acesso negado</h2>';
            return;
        }

        await carregar();
        anoTopo = new Date().getFullYear();

        document.getElementById('an-loading').style.display = 'none';
        document.getElementById('an-body').style.display    = 'block';

        setupPeriodoTabs();
        renderAnoTabs();
        renderMesFiltro();
        renderGraficos();
        renderTabela();
        renderRanking();
    } catch(e) {
        console.error('Análise:', e);
        document.getElementById('an-loading').innerHTML = '<span style="color:#ef4444">Erro ao carregar.</span>';
    }
}

document.addEventListener('DOMContentLoaded', init);
