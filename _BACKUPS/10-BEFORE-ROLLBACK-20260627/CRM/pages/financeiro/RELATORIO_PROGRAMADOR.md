# 📊 RELATÓRIO TÉCNICO — MÓDULO FINANCEIRO
## Cell City Gestão Empresarial — CRM
**Gerado em:** $(date '+%d/%m/%Y')
**Destinado a:** Programador / DevOps

---

## 📌 ÍNDICE

1. [Estrutura do Módulo](#1-estrutura-do-módulo)
2. [Arquitetura de Dados (Firestore)](#2-arquitetura-de-dados-firestore)
3. [Fluxo de Navegação](#3-fluxo-de-navegação)
4. [Funcionalidades Implementadas](#4-funcionalidades-implementadas)
5. [Problemas Críticos](#5-problemas-críticos)
6. [Melhorias Recomendadas](#6-melhorias-recomendadas)
7. [Checklist de Correção](#7-checklist-de-correção)
8. [Cronograma Estimado](#8-cronograma-estimado)

---

## 1. ESTRUTURA DO MÓDULO

```
Cell-City-Site/CRM/pages/financeiro/
├── index.html            # Estrutura HTML (sidebar + 8 seções)
├── financeiro.js         # Lógica principal (~1300 linhas, ES Module)
├── financeiro.css        # Estilos completos (~1100 linhas)
└── RELATORIO_FINANCEIRO.md  # Relatório anterior (auditoria)
```

### Dependências Externas

| Arquivo | Localização | Função |
|---------|-------------|--------|
| `firebase.js` | `CRM/scripts/firebase.js` | Conexão Firestore (db, getDocs, setDoc, etc.) |
| `brand-header.js` | `CRM/shared/brand-header.js` | Header do CRM |
| `sidebar.js` | `CRM/shared/sidebar.js` | Sidebar global |
| `dock.js` | `CRM/shared/dock.js` | Dock inferior (mobile) |
| `obs-expand.js` | `CRM/shared/obs-expand.js` | Expansão de observações |

### Módulos Financeiros Conectados

| Módulo | Caminho | Função |
|--------|---------|--------|
| 💰 Caixa | `CRM/pages/caixa/` | Lançamentos diários operacionais |
| 💸 Despesas | `CRM/pages/despesas/` | Despesas empresariais/pessoais |
| 📦 Compras | `CRM/pages/compras/` | Compras de mercadorias |
| 🏢 Fornecedores | `CRM/pages/fornecedor/` | Cadastro de fornecedores |
| 🔒 Fechamento | `CRM/pages/fechamento/` | Fechamento mensal |
| 📊 Análise | `CRM/pages/analise/` | Análise de dados |

---

## 2. ARQUITETURA DE DADOS (FIRESTORE)

### Coleções Utilizadas

| Coleção | Tipo Doc | Campos Principais | Registros |
|---------|----------|-------------------|-----------|
| `financeiro_pagar` | Individual | descricao, categoria, vencimento, valor, status, obs, fixaId, origem | CRUD |
| `financeiro_receber` | Individual | cliente, descricao, vencimento, valor, status, obs | CRUD |
| `financeiro_fixas` | Individual | descricao, categoria, recorrencia, data_inicio, valor, forma_pagamento, status, obs | CRUD |
| `financeiro_despesas` | Individual | descricao, categoria, valor, data, centro_custo, tipo, forma_pagamento, anexo | CRUD |
| `compras_financeiras` | Individual | fornecedorNome, valorTotal, data, status, itens[] | CRUD |
| `caixa_lancamentos` | Individual | dia, descricao, valor, custo, tipo(entrada/saida/servico), categoria | CRUD |
| `financeiro_metas` | **Documento único** `config` | faturamento_mensal, lucro_mensal, recebimentos_mensal, os_mensal | Singleton |
| `os` | Individual | status, cliente, servico, valor, createdAt, updatedAt | Leitura |

### Estrutura de Documentos

**financeiro_pagar / financeiro_receber:**
```js
{
  descricao: "Aluguel Loja",
  categoria: "Aluguel",          // Aluguel | Compras | Fornecedor | Serviços | ...
  vencimento: "2026-07-10",      // ISO date
  valor: 2500.00,                // Number
  status: "pendente",            // pendente | pago (pagar) / recebido (receber) | vencido
  obs: "Pagamento recorrente",
  fixaId: "fix_1718300000000",   // Se gerado por despesa fixa
  origem: "despesa_fixa",        // origem: despesa_fixa | compra | manual
  pagoEm: "2026-07-10",          // Preenchido ao marcar como pago
  atualizadoEm: Timestamp
}
```

**financeiro_fixas:**
```js
{
  descricao: "Internet Claro",
  categoria: "Internet",         // Aluguel | Internet | Energia | Água | Sistema | ...
  recorrencia: "mensal",         // mensal | quinzenal | semanal | anual
  data_inicio: "2026-01-15",     // Data base para calcular próximas ocorrências
  valor: 199.90,
  forma_pagamento: "PIX",        // Boleto | Débito Automático | PIX | Cartão | Dinheiro | TED/DOC
  status: "ativa",               // ativa | inativa
  obs: "",
  atualizadoEm: Timestamp
}
```

---

## 3. FLUXO DE NAVEGAÇÃO

```
[ HOME ]  ← Grid com blocos clicáveis
    │
    ├── 💰 Contas a Pagar    → Lista + Formulário CRUD
    ├── 💵 Contas a Receber  → Lista + Formulário CRUD
    ├── 📅 Despesas Fixas    → Dashboard + Alertas + Lista + CRUD
    ├── 📊 Resultado         → 8+3 Indicadores + Filtros Período
    ├── 📈 Fluxo de Caixa    → Cards + Breakdown + Timeline
    ├── 🎯 Dashboard         → 7 KPIs + 3 Gráficos Canvas + Categorias
    └── 🏆 Metas             → 4 Metas + Progresso + Projeção
```

### Sidebar Fixa (210px)
- Seções principais com contadores numéricos
- Links para módulos adjacentes (Despesas, Compras, Fornecedores, Fechamento)
- Mobile: sidebar vira drawer lateral (overlay + animação)

---

## 4. FUNCIONALIDADES IMPLEMENTADAS

### ✅ 4.1 Contas a Pagar
- **CRUD completo:** Criar, editar, excluir, marcar como pago
- **Status automático:** Calcula vencido comparando `vencimento` com `hoje()`
- **Filtros:** Todos, Pendentes, Vencidos, Pagos
- **Busca global:** Filtra por descricao, categoria, cliente, obs

### ✅ 4.2 Contas a Receber
- **CRUD completo** com campo cliente
- **Status:** pendente, vencido, recebido (com data `recebidoEm`)
- **Filtros e busca** idênticos ao Contas a Pagar

### ✅ 4.3 Despesas Fixas
- **CRUD completo** com 13 categorias e 6 formas de pagamento
- **4 recorrências:** mensal, quinzenal, semanal, anual
- **Dashboard:** Ativas, Total Mensal, Vencem 7 dias, Vencidas
- **Alertas automáticos:** Lista despesas vencidas e próximas
- **Geração automática de lançamentos:** Cria contas a pagar futuras
- **Regeneração inteligente:** Ao editar, remove pendentes antigos e recria

### ✅ 4.4 Resultado Financeiro
- **8 indicadores:** Receita, Despesas, Compras, A Pagar, A Receber, Fixas, Lucro Líquido, Saldo
- **3 indicadores de Produto:** CPV, Lucro Bruto, Margem Bruta
- **Períodos:** Hoje, Semana, Mês, Ano, Customizado
- **Alerta de vencidas:** Soma contas vencidas

### ✅ 4.5 Fluxo de Caixa Unificado
- **Consolida:** Caixa + Recebimentos + Despesas + Compras + Contas Pagas
- **Breakdown:** Barras comparativas por fonte
- **Timeline:** Até 80 movimentações ordenadas por data

### ✅ 4.6 Dashboard Executivo
- **7 KPIs** com delta percentual vs período anterior
- **3 gráficos Canvas puro:**
  - Barras: Receita vs Despesa (6 meses)
  - Linha: Evolução do Lucro (6 meses)
  - Barras: Fluxo diário do Caixa
- **Top 8 categorias de despesa**

### ✅ 4.7 Metas Financeiras
- **4 metas:** Faturamento, Lucro, Recebimentos, OS Concluídas
- **Barra de progresso** com cores (verde ≥100%, amarelo ≥75%, vermelho <75%)
- **Projeção mensal** baseada em ritmo atual (`realizado/dia * totalDias`)
- **Card na home** com barra resumo

---

## 5. PROBLEMAS CRÍTICOS

### 🔴 5.1 Dupla Contagem no Fluxo de Caixa

**Localização:** `financeiro.js` — função `renderFluxo()`

**Problema:** O Fluxo de Caixa soma valores de múltiplas fontes sem verificar se a mesma transação já foi contada em outra fonte.

```js
// Exemplo: Uma venda de R$100 registrada no Caixa
// PODE TER SIDO TAMBÉM registrada como Conta a Receber
// Resultado: R$200 contados como entrada, mas o real foi R$100

// Código atual (trecho):
const caixaEntradas = filtrarFluxo(dadosCaixa, 'dia')
    .filter(l => l.tipo === 'entrada' || l.tipo === 'servico');
const recebidas = filtrarFluxo(dadosReceber, 'vencimento')
    .filter(c => c.status === 'recebido');
// Se a venda do Caixa foi também recebida no Financeiro:
// → R$100 (Caixa) + R$100 (Receber) = R$200 ❌
```

**Solução proposta:**
```js
// 1. Adicionar campo `origem` em todos os lançamentos
// 2. No Fluxo, priorizar uma fonte (ex: Caixa) e excluir duplicatas nas outras
// 3. Ou criar um identificador único de transação (ex: `transacaoId`)
```

### 🔴 5.2 Carregamento Total sem Filtro

**Localização:** `financeiro.js` — função `carregar()`

**Problema:** Carrega TODOS os documentos de 6 coleções, sem qualquer filtro de data ou limite.

```js
const [sp, sf, sr, sd, sc, scx, sos] = await Promise.all([
    getDocs(collection(db, COL_PAGAR)),     // ∞ documentos
    getDocs(collection(db, COL_FIXAS)),     // ∞ documentos
    getDocs(collection(db, COL_RECEBER)),   // ∞ documentos
    getDocs(collection(db, COL_DESPESAS)),  // ∞ documentos
    getDocs(collection(db, COL_COMPRAS)),   // ∞ documentos
    getDocs(collection(db, COL_CAIXA)),     // ∞ documentos
    getDocs(collection(db, COL_OS)),        // ∞ documentos
]);
```

**Impacto:** 
- Consumo excessivo de banda
- Lentidão proporcional ao volume de dados
- Custo Firestore mais alto (lê docs desnecessários)

**Solução:**
```js
// Usar queries com filtro por data
const mesAtual = new Date().toISOString().slice(0, 7); // "2026-07"
const sp = await getDocs(query(
    collection(db, COL_PAGAR),
    where('vencimento', '>=', `${mesAtual}-01`),
    where('vencimento', '<=', `${mesAtual}-31`)
));
// Para "Todos", carregar sob demanda com paginação
```

### 🔴 5.3 Tratamento de Erros Inconsistente

**Localização:** Diversas funções assíncronas

```js
// ❌ Ruim: erro silencioso
} catch {
    dadosPagar = [];
}

// ✅ Bom: log + feedback
} catch (e) {
    console.error('[Financeiro] Erro ao carregar pagar:', e);
    toast('⚠ Erro ao carregar dados do servidor.');
}
```

### 🔴 5.4 Algoritmo de Recorrência Frágil

**Localização:** `calcularOcorrencias()` e `computarProximaOcorrencia()`

**Problemas:**
- Loops `while` com limite arbitrário (`guard < 500`)
- Não trata anos bissextos (29/fev)
- Pode gerar datas inválidas em edge cases

```js
// Exemplo: data_inicio = "2024-02-29" (ano bissexto)
// Próximo ano: "2025-02-29" → DATA INVÁLIDA! (2025 não é bissexto)
```

---

## 6. MELHORIAS RECOMENDADAS

### 🟡 6.1 Performance — Queries com Filtro

**Esforço:** 4-6h

Implementar filtro de data nas queries Firestore para carregar apenas dados relevantes.

```js
// shared/fin-utils.js (proposto)
export function queryMes(collectionName, campoData = 'vencimento') {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ultimoDia = new Date(ano, agora.getMonth() + 1, 0).getDate();
    
    return query(
        collection(db, collectionName),
        where(campoData, '>=', `${ano}-${mes}-01`),
        where(campoData, '<=', `${ano}-${mes}-${ultimoDia}`)
    );
}
```

### 🟡 6.2 Refatorar Código Compartilhado

**Esforço:** 6-8h

Criar módulos compartilhados para evitar duplicação entre `financeiro.js` e `despesas.js`:

```
CRM/shared/
├── fin-utils.js        # formatação (fmt, formatarData), helpers
├── fin-categorias.js   # CAT_ICON, CATEGORIAS_FINANCEIRO, etc.
└── fin-theme.css       # Variáveis CSS compartilhadas
```

### 🟡 6.3 Unificar Cálculo do Lucro

**Localização:** `renderResultado()`

**Atual:**
```js
const lucro = totalReceita - totalDespesas - totalCompras;
// Não inclui CPV (custo dos produtos vendidos via Caixa)
```

**Proposto:**
```js
const lucroLiquido = totalReceita + receitaCaixa 
                   - totalDespesas - totalCompras - cpvTotal;
```

### 🟡 6.4 UX Mobile — Formulários

**Problema:** Formulários em mobile ocupam tela cheia sem botão de fechar visível.

**Solução:** Adicionar botão ✕ no topo dos formulários em mobile.

```js
// No HTML, dentro de .fin-form:
<button class="fin-form-close" id="form-close">✕</button>

// No CSS:
.fin-form-close {
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 22px;
    cursor: pointer;
    display: none;
}
@media (max-width: 767px) {
    .fin-form-close { display: block; }
}
```

### 🟡 6.5 Paginação nas Listas

**Esforço:** 6-8h

Implementar paginação com Firestore `limit()` + `startAfter()`.

```js
const PAGE_SIZE = 20;
let lastDoc = null;

async function carregarPagina(collectionName, filters = []) {
    const constraints = [
        ...filters,
        orderBy('vencimento', 'asc'),
        limit(PAGE_SIZE + 1)
    ];
    if (lastDoc) constraints.push(startAfter(lastDoc));
    
    const q = query(collection(db, collectionName), ...constraints);
    const snapshot = await getDocs(q);
    
    const docs = [];
    snapshot.forEach(doc => {
        if (docs.length < PAGE_SIZE) docs.push({ id: doc.id, ...doc.data() });
        else lastDoc = doc;
    });
    
    return { docs, hasMore: snapshot.size > PAGE_SIZE };
}
```

### 🟡 6.6 Sincronização Caixa ↔ Financeiro

**Esforço:** 8-12h

Implementar sincronização bidirecional:
- Uma saída no Caixa com categoria financeira → criar registro em Contas a Pagar
- Uma conta paga no Financeiro → registrar entrada no Caixa (se aplicável)
- Evitar duplicidade com campo `syncId` e flag `origem`

---

## 7. CHECKLIST DE CORREÇÃO

### 🔴 Prioridade Máxima (faça agora)

- [ ] **7.1** Adicionar campo `origem` em todos os lançamentos do Financeiro
- [ ] **7.2** Corrigir `renderFluxo()` para evitar dupla contagem
- [ ] **7.3** Adicionar `console.error` em todos os `catch`
- [ ] **7.4** Adicionar feedback visual (toast) em todos os erros de carregamento

### 🟡 Prioridade Alta (faça nesta sprint)

- [ ] **7.5** Implementar queries com filtro de data nas 6 coleções
- [ ] **7.6** Extrair variáveis CSS para tema compartilhado
- [ ] **7.7** Criar `shared/fin-utils.js` com funções de formatação
- [ ] **7.8** Corrigir cálculo do Lucro Líquido (incluir CPV)

### 🟢 Prioridade Média (próxima sprint)

- [ ] **7.9** Implementar paginação nas listas
- [ ] **7.10** Adicionar botão ✕ nos formulários mobile
- [ ] **7.11** Corrigir algoritmo de recorrência (anos bissextos)
- [ ] **7.12** Implementar sincronização Caixa ↔ Financeiro
- [ ] **7.13** Adicionar exportação de relatório PDF

---

## 8. CRONOGRAMA ESTIMADO

| Tarefa | Esforço | Complexidade | Dependência |
|--------|---------|--------------|-------------|
| 7.1-7.4 Correções críticas | 6h | 🟢 Fácil | Nenhuma |
| 7.5 Queries com filtro | 6h | 🟡 Médio | Nenhuma |
| 7.6-7.7 Refactor compartilhado | 8h | 🟡 Médio | 7.5 |
| 7.8 Unificar Lucro | 2h | 🟢 Fácil | 7.5 |
| 7.9 Paginação | 8h | 🔴 Difícil | 7.5 |
| 7.10 UX Mobile | 2h | 🟢 Fácil | Nenhuma |
| 7.11 Recorrência | 3h | 🟡 Médio | Nenhuma |
| 7.12 Sincronização Caixa | 12h | 🔴 Difícil | 7.1, 7.5 |
| 7.13 Relatório PDF | 12h | 🔴 Difícil | 7.5 |

**Total estimado:** ~59 horas

---

## ARQUIVOS CRÍTICOS PARA REVISÃO

| Arquivo | Linhas Críticas | O que revisar |
|---------|-----------------|---------------|
| `financeiro.js` | `carregar()` L62-82 | Queries sem filtro |
| `financeiro.js` | `renderFluxo()` L520-600 | Dupla contagem |
| `financeiro.js` | `calcularOcorrencias()` L230-270 | Recorrência frágil |
| `financeiro.js` | `calcStatus()` L100-105 | Lógica de vencimento |
| `financeiro.js` | `renderResultado()` L400-500 | Cálculo do lucro |
| `firebase.js` | — | Verificar se exports estão corretos |
| `financeiro.css` | `:root` L1-20 | Variáveis duplicadas com `despesas.css` |
| `despesas.css` | `:root` | Mesmas variáveis, valores diferentes |

---

## COMANDOS ÚTEIS PARA DEBUG

```bash
# Verificar tamanho dos arquivos
ls -lh Cell-City-Site/CRM/pages/financeiro/

# Buscar por duplicação de CSS
grep -r "cell-green" Cell-City-Site/CRM/pages/ --include="*.css"

# Verificar coleções no Firestore (via Firebase Console)
# Ou via CLI:
firebase firestore:indexes

# Testar regras de segurança
firebase emulators:start --only firestore
```

---

> **Resumo para o programador:** O módulo financeiro está **funcional e maduro** (85% pronto), mas tem **3 problemas críticos**: dupla contagem no Fluxo de Caixa, carregamento sem filtro do Firestore e tratamento de erros inconsistente. Corrigir esses 3 itens já resolve 80% dos bugs reportados. O restante são melhorias de performance e UX.
