# PLANO DE OTIMIZAÇÃO DE PERFORMANCE — Cell City CRM

**Data:** 2026-07-03 · **Terminal 5 — Performance** · **Método:** auditoria somente-leitura do código (nenhuma alteração feita)
**Complementa:** `plans/RELATORIO_COTA_FIRESTORE_20260702.md` (diagnóstico de cota) — este documento localiza a amplificação **no código** e define o plano de correção.

---

## 1. Resumo executivo

O consumo medido (picos de ~43–45 mil leituras/hora com banco de ~580 documentos) é explicado por **quatro padrões estruturais**, todos confirmados no código:

1. **Polling agressivo de coleções inteiras** — Central de Alertas e Dashboard releem `os`, `posvenda_contatos`, `agenda` e `mensagens_portal` completos a cada **30 segundos**, sem pausar com a aba oculta.
2. **Cache Firestore apenas em memória** — `scripts/firebase.js` usa `getFirestore()` padrão. Como o CRM é multi-página (cada módulo é um HTML), **toda navegação zera o cache** e refaz todas as leituras do servidor.
3. **Leituras de coleção inteira sem `limit()`/filtro** — 20+ pontos leem coleções completas; não existe **nenhuma** paginação por cursor (`startAfter`) no sistema.
4. **Listeners sem gestão** — o `shared/listener-manager.js` existe desde o recovery de 27/06 mas é importado por **zero módulos**; há `onSnapshot` anônimos nunca cancelados e um listener da coleção `os` inteira usado só para detectar OS nova.

Meta do plano: sair de 50–250k leituras/dia para **~3–8k/dia** (folga de ~10× dentro do free tier), em 7 fases incrementais, 1 módulo por vez, respeitando o CLAUDE.md.

## 2. Censo de dados (backup 03/07/2026 02:00)

| Coleção | Docs | Coleção | Docs |
|---|---|---|---|
| caixa_lancamentos | **361** | estoque_produtos | 28 |
| posvenda_contatos | 52 | categorias_caixa | 15 |
| financeiro_pagar | 36 | config | 9 |
| clientes | 35 | fornecedor_compras | 6 |
| os | 33 | financeiro_fixas | 5 |

**Total no backup: 580.** ⚠️ **Fora do backup (tamanho desconhecido):** `agenda` (1 doc/dia — pode ter centenas), `diario_registros`, `pre_os`, `mensagens_portal`, `avaliacoes`, `agendamentos`, `portal_eventos` (cresce sem limite — 1 doc por acesso/clique no Portal). Medir na Fase 0.

## 3. Hotspots confirmados (arquivo:linha)

### 3.1 Pollers (maior consumo — explica os picos noturnos)

| # | Local | Padrão | Custo estimado |
|---|---|---|---|
| H1 | `CRM/pages/central-alertas/central-alertas.js:16,783` | `setInterval(carregar, 30000)` + `focus` → getDocs de `os` inteira (170), `posvenda_contatos` inteira (171), `mensagens_portal` não-lidas (172), `avaliacoes` (173) **+ `agenda` inteira (82)** | ≥ (33+52+5+A) × 120/h ≈ **11–45k leituras/h por aba aberta** (A = docs da agenda). Sem pausa com aba oculta — deixada aberta à noite, consome sozinha a cota diária. Bate com os picos medidos de 01/07 à noite. |
| H2 | `CRM/pages/dashboard/dashboard.js:540-556` | Card "Ação da Semana": `_lerAgenda()` → `getDocs(agenda)` inteira a cada **30 s** + a cada `focus` (`:379`) | 120×A/h por aba de Dashboard |
| H3 | `CRM/pages/dashboard/dashboard.js:1182` | `setInterval(atualizarAlertas, 180000)` → `gerarAlertas()` relê `os` inteira (680), `posvenda_contatos` inteira (681), `mensagens_portal` (808), `avaliacoes` (846), `os` concluído (894), `os` orçamento (928) | ~95–150 × 20/h ≈ **2–3k/h** por aba |
| H4 | `CRM/pages/dashboard/sw-alarme.js:230` | Sync alarmes com Firestore a cada 5 min (REST, `:171`) | baixo (1 doc), OK manter |

### 3.2 Leituras de coleção inteira por abertura de tela

| # | Local | O que lê | Custo/abertura |
|---|---|---|---|
| H5 | `dashboard.js:244` | `caixa_lancamentos` **inteira** (361 docs) só para somar lucro da semana atual vs. anos anteriores | **361** |
| H6 | `dashboard.js:2469` | `onSnapshot` na coleção `os` **inteira** só para detectar OS nova (alarme sonoro) | 33 + realtime |
| H7 | `dashboard.js:352` | `onSnapshot(diario_registros)` inteira, anônimo (nunca cancelado) | D + realtime |
| H8 | `pages/os/os.js:443-447` | `os` + `clientes` + `metadata` inteiras; repete em navegação interna (`:479`, `:2415`) | ~70 × 2–3 por sessão |
| H9 | `pages/relatorios/relatorios.js:896,905` | `onSnapshot` de `os` inteira **e** `caixa_lancamentos` inteira | ~394 |
| H10 | `pages/analise/analise.js:19` | REST `caixa_lancamentos?pageSize=300` — baixa a coleção inteira via REST (endpoint hardcoded, fora do SDK/cache) | ~361 |
| H11 | `pages/financeiro/financeiro.js:62-64,375-384` | `financeiro_pagar`+`fixas`+`receber` inteiras no boot; `recarregar()` relê a coleção inteira após **cada** gravação | ~41 + 36/gravação |
| H12 | `pages/financeiro/financeiro.js:480-485` | **N+1**: lê `financeiro_cat_despesas` e depois a subcoleção `itens` de **cada** categoria em loop | 1 + N queries |
| H13 | `pages/estoque/estoque.js:356` | `descontarEstoque(produtoId)` lê a coleção **inteira** (28 docs) para achar 1 produto — chamado pelo Caixa a **cada venda** | 28 → deveria ser **1** (`getDoc`) |
| H14 | `pages/caixa/caixa.js:616` | Caixa lê `estoque_produtos` inteira (picker de produtos) | 28 |
| H15 | `pages/caixa/caixa.js:123-128` | Período "todos": listener de `caixa_lancamentos` inteira (361). Padrão é "hoje" (OK), mas 1 clique custa 361 | 361 |
| H16 | `pages/pos-venda/posvenda.js:85-90` | `os` inteira + `posvenda_contatos` inteira | ~85 |
| H17 | `pages/portal-cliente/admin.js:461-484,1262-1335` | `portal_eventos` **inteira** por tipo, em 2 lugares — coleção cresce sem limite | cresce para sempre |
| H18 | `pages/autoatendimento/autoatendimento.js:37,51` | getDocs + `onSnapshot` de `pre_os` inteira, `orderBy criadoEm` sem `limit` | P + realtime |
| H19 | `pages/catalogo/public/catalogo-publico.js:67` | Página **pública**: `catalogo_produtos` inteira por visita anônima | por visitante |
| H20 | `dashboard.js:1378-1413` | Busca global: `os`+`clientes`+`estoque_produtos` inteiras (tem cache de 60 s — mitigado, mas ainda ~96/uso) | ~96 |

### 3.3 Infraestrutura de cache e listeners

- **`CRM/scripts/firebase.js:39`** — `getFirestore(app)` sem `persistentLocalCache` (IndexedDB). Cache morre a cada navegação entre módulos (arquitetura multi-página). *Arquivo protegido — mudança exige autorização + backup + TECHDOC.*
- **`CRM/sw.js`** — correto: não cacheia Firestore, network-first para assets. Sem ação necessária.
- **`shared/listener-manager.js`** — pronto e correto, **0 módulos usam**. Listeners anônimos sem unsubscribe: `dashboard.js:327` (pre_os), `dashboard.js:352` (diario_registros), `relatorios.js:896,905`.
- **Caches locais que já funcionam bem** (manter como referência de padrão): `tenant.js` (sessionStorage), `favoritos.js`/`central-modulos.js`/`sidebar.js`/`dock.js` (localStorage + listener de 1 doc — custo mínimo).

### 3.4 Queries, índices e paginação

- **Paginação: inexistente.** Nenhum `startAfter`/`startAt` no código. `limit()` em só 9 pontos.
- **Índices** (`firestore.indexes.json`): 3 compostos, cobrem Caixa/lembretes/mensagens. Novas queries por data/status (Fase 3) vão exigir novos índices compostos — criar junto.
- **Filtro de tenant:** `dashboard.js`, `central-alertas.js`, `os.js`, `estoque.js`, `financeiro.js` têm **zero** referências a `empresa_id` — leem dados de todos os tenants. Hoje o custo é igual (1 empresa), mas cada empresa nova **multiplica** as leituras de todas as outras. Alinhar com o plano SaaS.

## 4. Plano de otimização — 7 fases

> Regras: 1 módulo por vez, backup antes de arquivo crítico, testes obrigatórios do CLAUDE.md §5 após cada fase, relatório de entrega por fase.

### Fase 0 — Medição (sem código, ~1h)
1. Contar docs de `agenda`, `diario_registros`, `pre_os`, `portal_eventos`, `mensagens_portal`, `avaliacoes`, `agendamentos` (Admin SDK, leitura única).
2. Console Firestore → aba Uso: registrar leituras/h abrindo cada módulo isoladamente (baseline por módulo).
3. Critério de sucesso das fases: repetir a medição após cada fase.

### Fase 1 — Estancar os pollers (maior impacto, menor risco) 🔴
- **H1** Central de Alertas: (a) pausar `setInterval` quando `document.hidden`; (b) subir `REFRESH_MS` de 30 s → 300 s; (c) trocar os `getDocs` repetidos por `onSnapshot` registrados no ListenerManager (o realtime elimina o polling). Qualquer uma das três já corta >80% do módulo.
- **H2** Dashboard/agenda: ler agenda 1× no boot + `onSnapshot`; como cada dia é 1 doc, consultar só o intervalo relevante (docs de hoje ± janela) em vez da coleção inteira.
- **H3** Dashboard/alertas: mesmo tratamento (listeners ou intervalo ≥ 10 min + pausa com aba oculta).
- **Impacto estimado: −70 a −90% do consumo total.** Risco: baixo (timers e handlers locais aos módulos).

### Fase 2 — Cache persistente do Firestore 🔴 (arquivo protegido)
- `scripts/firebase.js`: trocar `getFirestore(app)` por `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })` (disponível no SDK 10.8).
- Efeito: navegações e reaberturas servem do IndexedDB; listeners reconectam por *resume token* pagando só os deltas. Ataca a amplificação por navegação em **todos** os módulos de uma vez.
- Pré-requisitos: autorização explícita, backup do arquivo, TECHDOC, teste em múltiplas abas (multi-tab manager) e nos 8 módulos do checklist.
- **Impacto estimado: −50 a −80% das leituras por navegação.** Risco: médio (arquivo global) — mitigado por rollback simples (1 linha).

### Fase 3 — Escopo de queries (módulo a módulo) 🟠
| Item | Correção |
|---|---|
| H5 meta semanal | Query por `dataISO >= início da semana` + doc agregado `agregados/meta_semanal` (histórico de anos anteriores gravado 1×) → 361 → ~20 leituras |
| H13 descontarEstoque | `getDoc(doc(db, COL, produtoId))` → 28 → 1 leitura por venda |
| H6 alarme OS nova | Listener com `query(os, orderBy('createdAt','desc'), limit(1))` → 33 → 1 |
| H8 os.js | Carregar só OS ativas (`status` ∉ finais ou `createdAt` ≥ 90 dias); arquivo sob demanda; `metadata/counter` via `getDoc` direto |
| H9 relatórios | `getDocs` por intervalo de datas escolhido, sem listener permanente; períodos históricos via doc agregado |
| H10 análise | Migrar REST → SDK (herda cache da Fase 2) + range de datas |
| H11 financeiro | `recarregar()` atualiza o array local com o doc salvo, sem relê da coleção |
| H12 financeiro N+1 | Itens como array dentro do doc da categoria (15 docs → 1) ou `collectionGroup` única |
| H16 pós-venda | `where status == 'entregue'` + janela de datas |
| H17 portal_eventos | Contadores agregados (`agregados/portal_stats`, incrementados na gravação) em vez de varrer a coleção; TTL/arquivamento dos eventos antigos |
| H18/H19 públicas | `limit(50)` no autoatendimento; catálogo público com `limit` + doc agregado de vitrine |
- **Impacto: −60 a −90% nos módulos tocados.** Risco: médio-baixo, isolado por módulo. Criar índices compostos junto de cada query nova.

### Fase 4 — Higiene de listeners 🟡
- Adotar `ListenerManager` nos 12+ arquivos com `onSnapshot` (registro + `unregisterAll` no `pagehide`).
- Corrigir listeners anônimos nunca cancelados: `dashboard.js:327,352`, `relatorios.js:896,905`.
- Padrão: 1 listener por dado por página; proibir `getDocs` periódico onde já há listener.

### Fase 5 — Paginação 🟡
- Cursor `startAfter` + `limit(50)` nos históricos: Caixa "todos" (H15), arquivo de OS, clientes, listas do Portal Admin (já têm `limit(100)`, falta cursor), extratos do Financeiro.

### Fase 6 — Agregados e contadores 🟢
- Doc(s) `agregados/*` mantidos na gravação (ou Cloud Function no futuro) para os cards do Dashboard; alternativa pontual: `getCountFromServer()` (1 leitura por 1000 entradas de índice) para contagens por status.
- Dashboard passa de ~500–600 leituras/abertura para **~10–20**.

### Fase 7 — Infraestrutura (paralelo, decisões do proprietário) 🟢
- **Blaze + orçamento R$ 30 + alertas** (já recomendado no relatório de 02/07) — elimina o bloqueio enquanto as fases rodam.
- **Separação DEV/PROD** (plano em análise) — tira o desenvolvimento da cota de produção.
- **Alerta contínuo**: leituras > 100k/dia → e-mail; revisão mensal da aba Uso.
- Alinhar filtro `empresa_id` nos módulos sem tenant (seção 3.4) com o roadmap SaaS.

## 5. Projeção de resultado

| Cenário | Leituras/dia (est.) |
|---|---|
| Hoje (medido) | 50–250k (estoura a cota) |
| Após Fase 1 | ~15–40k |
| Após Fases 1+2 | ~8–15k |
| Após Fases 1–6 | **~3–8k** (folga ≥ 6× no free tier) |

## 6. Riscos e pendências

- Tamanho real de `agenda`/`portal_eventos` desconhecido (fora do backup) — Fase 0 resolve; se `agenda` for grande, H1/H2 são ainda mais críticos.
- `firebase.js` é protegido: Fase 2 só com autorização explícita (CLAUDE.md §1).
- Persistência IndexedDB exige teste multi-abas (o CRM abre módulos em abas/iframes).
- Novas queries por data/status exigem índices compostos novos — criar e publicar junto (verificar release via API, conforme processo já validado).
- Nenhum código foi alterado nesta auditoria.

## 7. Atualização (2026-07-07) — tentativa de execução da Fase 0/Fase 1

Reconfirmado por leitura direta do código (não só do plano): o hotspot principal segue presente e intocado — `CRM/pages/dashboard/dashboard-alertas.js:247` ainda tem `setInterval(verificar, 30000)`; `shared/listener-manager.js` segue com 0 importadores reais. Nenhuma das duas mudou desde 03/07.

**Fase 0 (medição):** o censo de dados do §2 já tinha sido feito em 03/07 (Admin SDK, leitura única contra o backup). A parte pendente — medir o tamanho real de `agenda`/`portal_eventos`/etc. ("fora do backup") — exigiria uma nova consulta ao Firestore real (DEV ou produção); não executada nesta sessão por estar fora do escopo autorizado (o escopo desta rodada é trabalho em `develop`/git, não acesso a banco de dados ao vivo).

**Fase 1 (estancar pollers):** **não executada.** Os 3 hotspots (H1/H2/H3) exigem alterar `dashboard-alertas.js` e módulos do Dashboard — `CLAUDE.md` §1 exige autorização explícita e específica para qualquer alteração em Dashboard, e as mudanças propostas (subir `REFRESH_MS` de 30s→300s, pausar com aba oculta, trocar `getDocs` por `onSnapshot`) são mudanças reais de comportamento de atualização de dados, não puramente estruturais — não se enquadram no "não modificar comportamento funcional" desta rodada. Recomendação: tratar a Fase 1 como sua própria sprint, com autorização explícita nomeando o Dashboard, seguindo o processo de 8 etapas já usado nas Sprints de RBAC.
