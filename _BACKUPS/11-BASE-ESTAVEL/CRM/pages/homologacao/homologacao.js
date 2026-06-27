/* ============================================================
   HOMOLOGAÇÃO DO SISTEMA — Cell City Gestão Empresarial
   Executa suítes de teste para validar integrações do CRM.
   Read-only: não grava dados de produção.
   ============================================================ */
import {
    db, collection, getDocs, query, limit, where
} from '../../scripts/firebase.js';

// ── Helpers de resultado ─────────────────────────────────────
const pass  = (msg) => ({ status: 'pass', msg });
const warn  = (msg) => ({ status: 'warn', msg });
const fail  = (msg) => ({ status: 'fail', msg });
const info  = (msg) => ({ status: 'info', msg });

// ── Suítes de Teste ──────────────────────────────────────────
const SUITES = [
  /* ── 1. COMPRA → ESTOQUE → FINANCEIRO ── */
  {
    id: 's1', icone: '🛒', titulo: 'Compra → Estoque → Financeiro',
    testes: [
      { id: 't1_1', nome: 'Compras cadastradas no sistema', run: async () => {
          const snap = await getDocs(collection(db, 'compras_financeiras'));
          if (!snap.size) return fail('Nenhuma compra encontrada — registre ao menos uma compra');
          return pass(`${snap.size} compra(s) encontrada(s)`);
      }},
      { id: 't1_2', nome: 'Compras com itens registrados', run: async () => {
          const snap = await getDocs(query(collection(db, 'compras_financeiras'), limit(10)));
          const ids = [];
          snap.forEach(d => ids.push(d.id));
          if (!ids.length) return info('Sem compras para verificar itens');
          let comItens = 0;
          const amostra = ids.slice(0, 5);
          for (const id of amostra) {
              const sub = await getDocs(collection(db, `compras_financeiras/${id}/itens`));
              if (!sub.empty) comItens++;
          }
          if (comItens === 0) return fail(`0/${amostra.length} compras têm itens — estoque não será atualizado automaticamente`);
          if (comItens < amostra.length) return warn(`${comItens}/${amostra.length} compras têm itens (amostra)`);
          return pass(`${comItens}/${amostra.length} compras da amostra têm itens`);
      }},
      { id: 't1_3', nome: 'Custo médio atualizado nos produtos', run: async () => {
          const snap = await getDocs(collection(db, 'estoque_produtos'));
          let total = 0, comCusto = 0;
          snap.forEach(d => { total++; if (Number(d.data().custo_medio) > 0) comCusto++; });
          if (!total) return warn('Nenhum produto em estoque');
          const pct = (comCusto / total) * 100;
          if (pct < 30) return warn(`${comCusto}/${total} produtos com custo_médio — compras podem não ter integrado com estoque`);
          return pass(`${comCusto}/${total} produtos com custo_médio calculado`);
      }},
      { id: 't1_4', nome: 'Quantidade em estoque > 0 após compras', run: async () => {
          const snap = await getDocs(collection(db, 'estoque_produtos'));
          let total = 0, comQtd = 0;
          snap.forEach(d => { total++; if (Number(d.data().quantidade) > 0) comQtd++; });
          if (!total) return warn('Nenhum produto cadastrado em estoque');
          if (comQtd === 0) return fail('Todos os produtos com quantidade = 0');
          return pass(`${comQtd}/${total} produtos com quantidade disponível`);
      }},
      { id: 't1_5', nome: 'Fornecedores vinculados às compras', run: async () => {
          const snap = await getDocs(query(collection(db, 'compras_financeiras'), limit(20)));
          let total = 0, semForn = 0;
          snap.forEach(d => { total++; if (!d.data().fornecedorNome && !d.data().fornecedorId) semForn++; });
          if (!total) return info('Sem compras para verificar fornecedores');
          if (semForn === total) return warn('Todas as compras sem fornecedor vinculado');
          if (semForn > 0) return warn(`${semForn}/${total} compras sem fornecedor`);
          return pass(`Todas as ${total} compras têm fornecedor vinculado`);
      }},
    ]
  },

  /* ── 2. VENDA → CAIXA → FINANCEIRO ── */
  {
    id: 's2', icone: '💰', titulo: 'Venda → Caixa → Financeiro',
    testes: [
      { id: 't2_1', nome: 'Lançamentos de entrada no Caixa', run: async () => {
          const snap = await getDocs(collection(db, 'caixa_lancamentos'));
          let entradas = 0;
          snap.forEach(d => { if (d.data().tipo === 'entrada') entradas++; });
          if (!entradas) return fail('Nenhuma entrada no caixa — registre vendas no módulo Caixa');
          return pass(`${entradas} lançamento(s) de entrada encontrado(s)`);
      }},
      { id: 't2_2', nome: 'CPV (custo do produto) preenchido', run: async () => {
          const snap = await getDocs(collection(db, 'caixa_lancamentos'));
          let entradas = 0, comCusto = 0;
          snap.forEach(d => {
              if (d.data().tipo === 'entrada') {
                  entradas++;
                  if (Number(d.data().custo) > 0) comCusto++;
              }
          });
          if (!entradas) return info('Sem entradas para verificar CPV');
          const pct = (comCusto / entradas) * 100;
          if (pct < 20) return warn(`Apenas ${comCusto}/${entradas} entradas têm CPV — margem pode estar incorreta`);
          if (pct < 70) return warn(`${comCusto}/${entradas} entradas com CPV (${pct.toFixed(0)}%)`);
          return pass(`${comCusto}/${entradas} entradas com CPV preenchido`);
      }},
      { id: 't2_3', nome: 'Lucro bruto calculável (Receita − CPV)', run: async () => {
          const snap = await getDocs(collection(db, 'caixa_lancamentos'));
          let receita = 0, cpv = 0;
          snap.forEach(d => {
              if (d.data().tipo === 'entrada') {
                  receita += Number(d.data().valor || 0);
                  cpv     += Number(d.data().custo  || 0);
              }
          });
          const fmt = v => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
          if (!receita) return fail('Receita total = R$0,00');
          if (!cpv) return warn(`Receita: ${fmt(receita)} | CPV: R$0,00 — sem custo registrado`);
          const lucro  = receita - cpv;
          const margem = (lucro / receita * 100).toFixed(1);
          return pass(`Receita: ${fmt(receita)} | CPV: ${fmt(cpv)} | Lucro: ${fmt(lucro)} | Margem: ${margem}%`);
      }},
      { id: 't2_4', nome: 'Resumo Live com dados do período atual', run: async () => {
          const snap = await getDocs(collection(db, 'resumo_live'));
          const ids = [];
          snap.forEach(d => ids.push(d.id));
          if (!ids.length) return warn('resumo_live vazio — sem lançamentos de caixa registrados');
          const comMes = ids.filter(id => id.startsWith('mes_')).length;
          return pass(`${ids.length} snapshot(s) em resumo_live (${comMes} mensal/is)`);
      }},
    ]
  },

  /* ── 3. DESPESA → FINANCEIRO ── */
  {
    id: 's3', icone: '💸', titulo: 'Despesa → Financeiro',
    testes: [
      { id: 't3_1', nome: 'Despesas cadastradas', run: async () => {
          const snap = await getDocs(collection(db, 'financeiro_despesas'));
          if (!snap.size) return warn('Nenhuma despesa cadastrada');
          return pass(`${snap.size} despesa(s) encontrada(s)`);
      }},
      { id: 't3_2', nome: 'Despesas com categoria definida', run: async () => {
          const snap = await getDocs(collection(db, 'financeiro_despesas'));
          let total = 0, comCat = 0;
          snap.forEach(d => { total++; if (d.data().categoria) comCat++; });
          if (!total) return info('Sem despesas para verificar');
          const pct = (comCat / total * 100).toFixed(0);
          if (comCat < total * 0.5) return warn(`${comCat}/${total} despesas com categoria (${pct}%)`);
          return pass(`${comCat}/${total} despesas com categoria (${pct}%)`);
      }},
      { id: 't3_3', nome: 'Categorias de despesa cadastradas', run: async () => {
          const snap = await getDocs(collection(db, 'financeiro_cat_despesas'));
          if (!snap.size) return warn('Nenhuma categoria de despesa criada — crie em Financeiro > Configurações');
          return pass(`${snap.size} categoria(s) de despesa disponível(is)`);
      }},
      { id: 't3_4', nome: 'Despesas com data preenchida', run: async () => {
          const snap = await getDocs(collection(db, 'financeiro_despesas'));
          let total = 0, semData = 0;
          snap.forEach(d => { total++; if (!d.data().data) semData++; });
          if (!total) return info('Sem despesas');
          if (semData > 0) return warn(`${semData}/${total} despesas sem data — não entram nos relatórios mensais`);
          return pass(`Todas as ${total} despesas têm data`);
      }},
      { id: 't3_5', nome: 'Despesas recorrentes configuradas', run: async () => {
          const snap = await getDocs(collection(db, 'financeiro_despesas'));
          let recorrentes = 0;
          snap.forEach(d => { if (d.data().recorrente) recorrentes++; });
          if (!recorrentes) return info('Nenhuma despesa recorrente (funcionalidade opcional)');
          return pass(`${recorrentes} despesa(s) recorrente(s) configurada(s)`);
      }},
    ]
  },

  /* ── 4. FECHAMENTO MENSAL ── */
  {
    id: 's4', icone: '📅', titulo: 'Fechamento Mensal Consolidado',
    testes: [
      { id: 't4_1', nome: 'Relatórios mensais gerados', run: async () => {
          const snap = await getDocs(collection(db, 'relatorio_mensal'));
          if (!snap.size) return warn('Nenhum fechamento mensal gerado — acesse Financeiro > Fechamento');
          return pass(`${snap.size} fechamento(s) mensal(is) registrado(s)`);
      }},
      { id: 't4_2', nome: 'Campos essenciais no último fechamento', run: async () => {
          const snap = await getDocs(collection(db, 'relatorio_mensal'));
          if (!snap.size) return info('Sem fechamentos para verificar campos');
          let ultimo = null;
          snap.forEach(d => {
              if (!ultimo || d.id > ultimo.id) ultimo = { id: d.id, ...d.data() };
          });
          const CAMPOS = ['receita', 'despesas', 'lucro', 'mesKey', 'geradoEmISO'];
          const faltando = CAMPOS.filter(c => ultimo[c] === undefined || ultimo[c] === null);
          if (faltando.length) return warn(`Campos ausentes no último fechamento: ${faltando.join(', ')}`);
          const fmt = v => Number(v).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
          return pass(`Último: ${ultimo.mesNome || ultimo.mesKey} | Receita: ${fmt(ultimo.receita)} | Lucro: ${fmt(ultimo.lucro)}`);
      }},
      { id: 't4_3', nome: 'Contas a Pagar com status correto', run: async () => {
          const snap = await getDocs(collection(db, 'financeiro_pagar'));
          let total = 0, comStatus = 0;
          snap.forEach(d => { total++; if (d.data().status) comStatus++; });
          if (!total) return info('Sem contas a pagar para verificar');
          if (comStatus < total) return warn(`${total - comStatus}/${total} contas sem campo status`);
          return pass(`${total} contas a pagar com status definido`);
      }},
      { id: 't4_4', nome: 'Contas a Receber com status correto', run: async () => {
          const snap = await getDocs(collection(db, 'financeiro_receber'));
          let total = 0, comStatus = 0;
          snap.forEach(d => { total++; if (d.data().status) comStatus++; });
          if (!total) return info('Sem contas a receber para verificar');
          if (comStatus < total) return warn(`${total - comStatus}/${total} contas sem campo status`);
          return pass(`${total} contas a receber com status definido`);
      }},
    ]
  },

  /* ── 5. AUDITORIA E LIXEIRA ── */
  {
    id: 's5', icone: '🔍', titulo: 'Auditoria e Lixeira',
    testes: [
      { id: 't5_1', nome: 'Logs de auditoria registrados', run: async () => {
          const snap = await getDocs(collection(db, 'auditoria_logs'));
          if (!snap.size) return warn('Nenhum log — use Excluir em Despesas ou Compras para gerar logs');
          return pass(`${snap.size} log(s) de auditoria encontrado(s)`);
      }},
      { id: 't5_2', nome: 'Diversidade de ações nos logs', run: async () => {
          const snap = await getDocs(collection(db, 'auditoria_logs'));
          const acoes = new Set();
          const modulos = new Set();
          snap.forEach(d => { acoes.add(d.data().acao); modulos.add(d.data().modulo); });
          if (!acoes.size) return info('Sem logs para analisar');
          return pass(`Ações: [${[...acoes].join(', ')}] | Módulos: [${[...modulos].join(', ')}]`);
      }},
      { id: 't5_3', nome: 'Coleção Lixeira acessível e estruturada', run: async () => {
          const snap = await getDocs(collection(db, 'lixeira'));
          const total = snap.size;
          let comCampos = 0;
          snap.forEach(d => {
              const dat = d.data();
              if (dat.colecaoOrigem && dat.idOriginal && dat.dados) comCampos++;
          });
          if (total === 0) return pass('Lixeira vazia (nenhum item excluído aguardando)');
          if (comCampos < total) return warn(`${total - comCampos}/${total} itens com estrutura incompleta`);
          return pass(`${total} item(s) na lixeira — todos com estrutura correta`);
      }},
      { id: 't5_4', nome: 'Auditoria cobre múltiplos módulos', run: async () => {
          const snap = await getDocs(collection(db, 'auditoria_logs'));
          const modulos = new Set();
          snap.forEach(d => { if (d.data().modulo) modulos.add(d.data().modulo); });
          if (modulos.size === 0) return info('Sem dados de módulos nos logs');
          if (modulos.size === 1) return warn(`Logs apenas do módulo: ${[...modulos][0]}`);
          return pass(`${modulos.size} módulo(s) com cobertura de auditoria`);
      }},
    ]
  },

  /* ── 6. VERIFICAÇÃO DE INTEGRIDADE ── */
  {
    id: 's6', icone: '🛡️', titulo: 'Verificação de Integridade',
    testes: [
      { id: 't6_1', nome: 'Produtos com preço de venda definido', run: async () => {
          const snap = await getDocs(collection(db, 'estoque_produtos'));
          let total = 0, semPreco = 0;
          snap.forEach(d => { total++; if (!Number(d.data().venda)) semPreco++; });
          if (!total) return info('Nenhum produto em estoque');
          if (semPreco === total) return fail(`Todos os ${total} produtos sem preço de venda`);
          if (semPreco > 0) return warn(`${semPreco}/${total} produtos sem preço de venda`);
          return pass(`Todos os ${total} produtos têm preço de venda`);
      }},
      { id: 't6_2', nome: 'Contas vencidas sem pagamento', run: async () => {
          const snap  = await getDocs(collection(db, 'financeiro_pagar'));
          const hoje  = new Date().toISOString().slice(0, 10);
          let vencidas = 0, valorTotal = 0;
          snap.forEach(d => {
              const dat = d.data();
              if (dat.status !== 'pago' && dat.vencimento && dat.vencimento < hoje) {
                  vencidas++;
                  valorTotal += Number(dat.valor || 0);
              }
          });
          if (!vencidas) return pass('Nenhuma conta a pagar vencida em aberto');
          const fmt = v => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
          return warn(`${vencidas} conta(s) vencida(s) — Total: ${fmt(valorTotal)}`);
      }},
      { id: 't6_3', nome: 'Despesas sem categoria', run: async () => {
          const snap = await getDocs(collection(db, 'financeiro_despesas'));
          let total = 0, semCat = 0;
          snap.forEach(d => { total++; if (!d.data().categoria) semCat++; });
          if (!semCat) return pass(`Todas as ${total} despesas têm categoria`);
          return warn(`${semCat}/${total} despesas sem categoria`);
      }},
      { id: 't6_4', nome: 'Lançamentos de Caixa com valor zero', run: async () => {
          const snap = await getDocs(collection(db, 'caixa_lancamentos'));
          let total = 0, semValor = 0;
          snap.forEach(d => { total++; if (!Number(d.data().valor)) semValor++; });
          if (!semValor) return pass(`Todos os ${total} lançamentos têm valor`);
          return warn(`${semValor}/${total} lançamentos com valor R$0,00 — possíveis registros incompletos`);
      }},
      { id: 't6_5', nome: 'Produtos com estoque abaixo do mínimo', run: async () => {
          const snap = await getDocs(collection(db, 'estoque_produtos'));
          let total = 0, baixo = 0;
          snap.forEach(d => {
              const dat = d.data();
              total++;
              const qty = Number(dat.quantidade || 0);
              const min = Number(dat.quantidadeMinima || 1);
              if (qty >= 0 && qty <= min) baixo++;
          });
          if (!baixo) return pass(`Todos os ${total} produtos acima do estoque mínimo`);
          return warn(`${baixo}/${total} produto(s) no ou abaixo do estoque mínimo`);
      }},
    ]
  },
];

// ── Estado global ────────────────────────────────────────────
let _running    = false;
let _resultados = {};

// ── Helpers DOM ──────────────────────────────────────────────
function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function $id(id)            { return document.getElementById(id); }
function setDot(id, status) { const e = $id(`dot-${id}`); if(e) e.className = `hom-test-dot hom-dot-${status}`; }
function setMsg(id, text)   { const e = $id(`msg-${id}`); if(e) e.textContent = text; }
function setProgSuite(id, pct, color) {
    const e = $id(`prog-${id}`);
    if (!e) return;
    e.style.width = pct + '%';
    if (color) e.style.background = color;
}
function setProgTotal(pct)  {
    const e = $id('hom-prog-bar');
    if (e) e.style.width = pct + '%';
}
function setBadge(id, status, label) {
    const e = $id(`badge-${id}`);
    if (!e) return;
    e.className = `hom-badge hom-badge-${status}`;
    e.textContent = label;
}
function openSuite(id) {
    const body  = $id(`body-${id}`);
    const arrow = $id(`arrow-${id}`);
    if (body)  body.style.display  = 'block';
    if (arrow) arrow.style.transform = 'rotate(180deg)';
}
function closeSuite(id) {
    const body  = $id(`body-${id}`);
    const arrow = $id(`arrow-${id}`);
    if (body)  body.style.display  = 'none';
    if (arrow) arrow.style.transform = '';
}

// ── Scoring ──────────────────────────────────────────────────
function calcScore(resultados) {
    if (!resultados.length) return 0;
    const pts = resultados.reduce((s, r) => {
        if (r.status === 'pass' || r.status === 'info') return s + 2;
        if (r.status === 'warn') return s + 1;
        return s;
    }, 0);
    return Math.round((pts / (resultados.length * 2)) * 100);
}

function getSuiteStatus(resultados) {
    if (resultados.some(r => r.status === 'fail'))  return 'fail';
    if (resultados.some(r => r.status === 'warn'))  return 'warn';
    return 'pass';
}

function getColor(status) {
    if (status === 'pass') return '#00c853';
    if (status === 'warn') return '#ffc107';
    if (status === 'fail') return '#ef5350';
    return '#6b7280';
}

function badgeLabel(status, score) {
    if (status === 'pass') return `✓ Aprovado (${score}%)`;
    if (status === 'warn') return `⚠ Atenção (${score}%)`;
    if (status === 'fail') return `✕ Falhou (${score}%)`;
    return '—';
}

// ── Render Inicial ───────────────────────────────────────────
function renderSuites() {
    const cont = $id('hom-suites');
    if (!cont) return;
    cont.innerHTML = SUITES.map((s, i) => `
        <div class="hom-suite" id="suite-${s.id}">
            <div class="hom-suite-hdr" onclick="homToggle('${s.id}')">
                <span class="hom-suite-icone">${s.icone}</span>
                <span class="hom-suite-titulo">${i + 1}. ${escHtml(s.titulo)}</span>
                <span class="hom-badge hom-badge-pending" id="badge-${s.id}">Aguardando</span>
                <span class="hom-suite-arrow" id="arrow-${s.id}">▾</span>
            </div>
            <div class="hom-suite-prog"><div class="hom-suite-prog-fill" id="prog-${s.id}"></div></div>
            <div class="hom-suite-body" id="body-${s.id}">
                ${s.testes.map(t => `
                <div class="hom-test" id="test-${t.id}">
                    <div class="hom-test-dot hom-dot-pending" id="dot-${t.id}"></div>
                    <div class="hom-test-body">
                        <div class="hom-test-nome">${escHtml(t.nome)}</div>
                        <div class="hom-test-msg" id="msg-${t.id}">—</div>
                    </div>
                </div>`).join('')}
            </div>
        </div>`).join('');
}

// ── Execução ─────────────────────────────────────────────────
window.homExecutarTudo = async function() {
    if (_running) return;
    _running    = true;
    _resultados = {};

    const btn = $id('hom-btn-run');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Executando...'; }

    // Reset UI
    SUITES.forEach(s => {
        setBadge(s.id, 'pending', 'Aguardando');
        setProgSuite(s.id, 0, '#6b7280');
        closeSuite(s.id);
        s.testes.forEach(t => { setDot(t.id, 'pending'); setMsg(t.id, '—'); });
    });
    const relEl = $id('hom-relatorio');
    if (relEl) relEl.style.display = 'none';
    const progWrap = $id('hom-prog-wrap');
    if (progWrap) progWrap.style.display = 'block';
    setProgTotal(0);

    let suitesDone = 0;

    for (const suite of SUITES) {
        openSuite(suite.id);
        setBadge(suite.id, 'running', 'Executando...');

        const testeResults = [];

        for (const teste of suite.testes) {
            setDot(teste.id, 'running');
            setMsg(teste.id, 'Verificando...');

            let resultado;
            try {
                resultado = await teste.run();
            } catch (e) {
                resultado = fail(`Erro inesperado: ${e.message || String(e)}`);
            }

            testeResults.push({ id: teste.id, resultado });
            setDot(teste.id, resultado.status);
            setMsg(teste.id, resultado.msg);
        }

        const resultados = testeResults.map(t => t.resultado);
        const score      = calcScore(resultados);
        const status     = getSuiteStatus(resultados);

        _resultados[suite.id] = { status, score, testes: testeResults };
        setBadge(suite.id, status, badgeLabel(status, score));
        setProgSuite(suite.id, score, getColor(status));

        suitesDone++;
        setProgTotal(Math.round((suitesDone / SUITES.length) * 100));
    }

    gerarRelatorio();

    if (btn) { btn.disabled = false; btn.textContent = '▶ Executar Novamente'; }
    _running = false;
};

window.homToggle = function(id) {
    const body = $id(`body-${id}`);
    const open = body && body.style.display !== 'none';
    if (open) closeSuite(id); else openSuite(id);
};

// ── Relatório Final ──────────────────────────────────────────
function gerarRelatorio() {
    const suites = SUITES.map(s => ({
        ...s,
        resultado: _resultados[s.id] || { status: 'pending', score: 0 }
    }));

    const scores     = suites.map(s => s.resultado.score);
    const totalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const aprovados   = suites.filter(s => s.resultado.status === 'pass');
    const comAtencao  = suites.filter(s => s.resultado.status === 'warn');
    const comFalhas   = suites.filter(s => s.resultado.status === 'fail');

    let nota, notaCor, notaSub;
    if (totalScore >= 85) {
        nota    = '🟢 Excelente';
        notaCor = '#00c853';
        notaSub = 'Sistema integrado e estável. Pronto para novos módulos e expansões.';
    } else if (totalScore >= 60) {
        nota    = '🟡 Atenção';
        notaCor = '#ffc107';
        notaSub = 'Pontos de atenção encontrados. Revise os avisos antes de expandir o CRM.';
    } else {
        nota    = '🔴 Crítico';
        notaCor = '#ef5350';
        notaSub = 'Problemas críticos detectados. Resolva as falhas antes de continuar.';
    }

    const statusIcon = (s) => ({ pass:'✅', warn:'⚠️', fail:'❌', pending:'⏳' }[s] || '—');

    const relEl = $id('hom-relatorio');
    if (!relEl) return;

    relEl.innerHTML = `
        <div class="hom-rel-titulo">📊 Relatório Final de Homologação</div>
        <div class="hom-rel-nota" style="color:${notaCor}">${nota}</div>
        <div class="hom-rel-score">Pontuação geral: <strong>${totalScore}/100</strong></div>
        <div class="hom-rel-sub">${escHtml(notaSub)}</div>

        <div class="hom-rel-grid">
            <div class="hom-rel-card">
                <div class="hom-rel-card-num" style="color:#00c853">${aprovados.length}</div>
                <div class="hom-rel-card-lbl">Módulos Aprovados</div>
            </div>
            <div class="hom-rel-card">
                <div class="hom-rel-card-num" style="color:#ffc107">${comAtencao.length}</div>
                <div class="hom-rel-card-lbl">Com Atenção</div>
            </div>
            <div class="hom-rel-card">
                <div class="hom-rel-card-num" style="color:#ef5350">${comFalhas.length}</div>
                <div class="hom-rel-card-lbl">Com Falhas</div>
            </div>
        </div>

        <hr class="hom-rel-sep">
        <div class="hom-rel-lbl">Resultado por Fluxo</div>
        <div class="hom-rel-lista">
            ${suites.map(s => {
                const r   = s.resultado;
                const col = getColor(r.status);
                return `<div class="hom-rel-item">
                    <span>${statusIcon(r.status)}</span>
                    <span class="hom-rel-item-titulo">${s.icone} ${escHtml(s.titulo)}</span>
                    <span class="hom-rel-item-score" style="color:${col}">${r.score}%</span>
                </div>`;
            }).join('')}
        </div>

        ${comFalhas.length + comAtencao.length > 0 ? `
        <hr class="hom-rel-sep">
        <div class="hom-rel-lbl">Integrações Pendentes / Problemas</div>
        <div class="hom-rel-lista">
            ${[...comFalhas, ...comAtencao].flatMap(s =>
                (s.resultado.testes || [])
                    .filter(t => t.resultado.status === 'fail' || t.resultado.status === 'warn')
                    .map(t => `<div class="hom-rel-item">
                        <span>${t.resultado.status === 'fail' ? '❌' : '⚠️'}</span>
                        <span class="hom-rel-item-titulo" style="font-size:12px">${escHtml(t.resultado.msg)}</span>
                    </div>`)
            ).join('')}
        </div>` : ''}
    `;

    relEl.style.display = 'block';
    setTimeout(() => relEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', renderSuites);
