# Auditoria somente leitura — ciclo ESPERA CONTROLADA

**Data:** 2026-07-23  
**HEAD:** `7f4e705`  
**Modo:** leitura apenas — **nenhuma** alteração de código, docs oficiais, commit ou deploy  
**Autorização:** script “atividades não destrutivas” do proprietário

---

## Problemas encontrados

| ID | Problema | Prioridade | Arquivos |
|----|----------|------------|----------|
| P1 | Runtime CF ainda **nodejs20** (prazo descomissionamento 2026-10-30) | 🔴 Alta | `functions/package.json`, `firebase.json`, `.github/workflows/tests.yml` |
| P2 | Storage sem bucket (uploads OS/informações sem backend real) | 🟠 Alta (negócio) | `storage.rules`, `os-photo-storage.js`, `informacoes.js`, deploy guard |
| P3 | Leituras Firestore sem `limit()` em listas grandes (custo/cota) | 🟠 Alta | `financeiro.js`, `dashboard-busca.js`, `dashboard-alertas.js`, `dashboard-caixa.js`, `saas-admin.js`, `importar.js`, … |
| P4 | Detecção `/dev` ainda duplicada fora de `app-config.devPrefix()` | 🟡 Média | `dashboard-alarme-os.js`, `dashboard-caixa.js`, `config.js`, `impressao.js`, `brand-header.js`, `sidebar.js`, `kernel.js`, … |
| P5 | DEBUG temporário ainda no código de alertas | 🟡 Baixa | `dashboard-alertas.js` (~L118) |
| P6 | ~129 `console.log/debug` em CRM/pages+shared+functions | 🔵 Baixa | vários |
| P7 | `innerHTML` amplo (risco XSS se dados não escapados) | 🟡 Média | `saas-onboarding.js` (resumo), `central-alertas`, `caixa`, `compras`, … |
| P8 | Roadmap Sprint 0–12 (produto SaaS) **não versionado** | 🟡 Doc | — (só conversa) |
| P9 | `MASTER_ROADMAP.md` desatualizado vs v3.2.0 / ADR A | 🟡 Doc | `MASTER_ROADMAP.md` |
| P10 | BL-011 Rules ≠ matriz (dívida consciente ADR A) | 🟡 Consciente | `firestore.rules`, `permissoes.js` |

**Não encontrado neste ciclo:** `eval` / `new Function` em código de produto; senha temp SaaS já usa `crypto.getRandomValues` (corrigido).

---

## Riscos

| Risco | Impacto |
|-------|---------|
| Deploy CF bloqueado após out/2026 | Alto — BL-007 |
| Estouro de leituras Firestore (Spark/Blaze) | Alto — P3 |
| Feature Storage “morta” em prod | Médio — BL-009 |
| XSS residual em telas com `innerHTML` | Médio — revisar escape |
| Confusão de numeração Sprint (0–12 vs 0–4 repo) | Baixo/processo |

---

## Melhorias sugeridas (planos de correção — **não** executar sem auth)

1. **BL-007** — aplicar diff Node 22 (já draft em `FILA_B_PREPARACAO`).  
2. **BL-009** — decisão Blaze + bucket + smoke upload.  
3. **BL-010** — bypass deploy key (UI).  
4. **Backlog performance** — `limit()`/`where` em `getDocs` de dashboard/financeiro/saas-admin (alinhado BL-004/005).  
5. **Micro-fix** — migrar literais `/dev` restantes para `devPrefix()`/`URLS` (continuação F1.4).  
6. **Higiene** — remover DEBUG TEMPORÁRIO em `dashboard-alertas.js`.  
7. **Doc** — patch `MASTER_ROADMAP` + (se quiser) adotar Sprint 0–12 oficialmente.

---

## Evidências

- `npm`/PATH: auditar via `~/.nvm/.../node scripts/arquitetura/auditar.mjs` → **🟢 Arquitetura íntegra** (6/6).  
- Fan-in: kernel 41 · firebase 33 · permissoes 32 · app-config 29.  
- 27 módulos ainda com acesso direto Firestore (migração repository gradual).  
- `saas-onboarding` sem kernel (exceção documentada no audit).  
- BACKLOG aberto: BL-001…005, 007, 009–011 (006/008 fechados).

---

## Limite deste ciclo

Não foi possível reexecutar suíte RBAC/homologação completa aqui sem autorização e sem ambiente de testes completo (npm global ausente no PATH do sandbox; node nvm OK só para scripts pontuais). Próximo ciclo read-only pode focar: contagem exata de `getDocs` sem limit, amostra XSS escape, ou inventário de listeners sem unsubscribe.

---

## Ciclo 2 (mesmo dia) — Inventário exato P3: `getDocs` sem `limit()`

**Método:** grep de todas as chamadas `getDocs(` em `CRM/` e `functions/` (49 ocorrências), leitura de contexto de cada uma para confirmar presença/ausência de `limit()` na query. Somente leitura — nenhum arquivo de produto alterado.

**Resultado:** 41 de 49 chamadas não têm `limit()`. As 8 que já têm: `auditoria.js:107` (500), `chat.js:65-69` (200), `compras.js:30` (500), `compras.js:36` (200), `dashboard-alertas.js:530` (5).

**Achado mais relevante (novo, não estava no Ciclo 1): `portal_eventos` duplicado e sem corte por data**

- `CRM/pages/portal-cliente/admin.js:461-463` e `:1262-1266` — **mesma query** (`portal_eventos`, `tipo == 'acesso'`, sem `limit`, sem filtro de período) implementada em **duas funções diferentes** do mesmo arquivo. `portal_eventos` recebe 1 doc por acesso/clique de cliente ao Portal — é a coleção com maior taxa de crescimento do projeto (evento comportamental, não registro de negócio). Cada carregamento do painel de analytics do Portal lê o histórico **inteiro** da coleção (filtrado só por `tipo`, nunca por data), e faz isso duas vezes se ambas as funções rodam na mesma sessão.
- Mesmo padrão se repete para `tipo == 'clique_whatsapp'` e `tipo == 'clique_maps'` em `:483-484` e `:1335-1336` (mesma duplicação).
- Risco: é o candidato mais provável a estourar cota de leitura antes de qualquer outra coleção listada no Ciclo 1, porque cresce por interação do cliente final (fora do controle da equipe), não por operação interna.

**Outras coleções com leitura completa (sem `limit`, sem corte por data) recorrente em tela carregada com frequência:**

| Coleção | Arquivo:linha | Observação |
|---|---|---|
| `os` | `dashboard-busca.js:75`, `dashboard-alertas.js:363,577,611` | 3 leituras completas independentes por render do dashboard (busca + alertas concluído + alertas orçamento) |
| `caixa_lancamentos` | `analise.js:19`, `dashboard-caixa.js:67` | cresce por lançamento financeiro, sem filtro de período |
| `contas a pagar/fixas/receber` | `financeiro.js:68-70` | 3 leituras completas em `Promise.all` a cada abertura da tela |
| `posvenda_contatos` | `dashboard-alertas.js:364` | — |
| `agenda` | `dashboard-alertas.js:77` | — |
| `clientes`, `estoque_produtos`/`produtos` | `dashboard-busca.js:92,109-110`, `importar.js:224,276` | busca client-side após leitura completa |
| `_lixeira` (trash) | `cc-sync.js:78` | — |

**Menor risco (naturalmente pequenas ou escopadas):** `perfis_operacionais`, `usuarios` (por tenant), `fornecedor_compras`(tem limit), `templates` (CRM comercial), `catalogo_produtos` (single-tenant público), `saas-admin` (lista de empresas).

**Camada Repository:** `base.repository.js` e `base.repository.tenant.js` já suportam `limitTo` em `buildQuery({ limitTo })` — o mecanismo existe, mas é **opt-in por chamador**. Este ciclo não verificou quantos dos 19 repositórios/chamadores efetivamente passam `limitTo`; fica como item em aberto para um Ciclo 3.

**Nenhuma alteração de código feita.** Achados acima são insumo para quando P3/BL-004/BL-005 forem autorizados — não para execução agora.

---

## Ciclo 3 (mesmo dia) — Inventário de listeners `onSnapshot` sem unsubscribe

**Método:** grep de `onSnapshot(` em `CRM/` e `shared/` (16 arquivos, 30 chamadas), leitura de cada arquivo checando se o retorno (função de unsubscribe) é capturado e existe algum ponto de chamada dela. `ListenerManager` (citado em memória de infraestrutura de 2026-06-27) **não existe mais no código atual** — 0 referências.

**Seguem a regra do CLAUDE.md §9 ("sempre desinscrever"), com guarda antes de reassinar:** `caixa.js` (`_unsubLanc`/`_unsubLembretes`), `chat.js` (`unsubscribeMsgs`), `crm-comercial/crm.js` (`unsub`), `dashboard-ui.js` (`notaUnsub`), `shared/dock.js` (`notaUnsub`), `shared/central-modulos.js` (`_unsub`), `shared/favoritos.js` (`_unsub`), `shared/portal-sync.js` (array `unsubs` com `forEach(u => u())`), `portal-cliente/admin.js` (array `this.unsubscribers` com cleanup central), `dashboard-alarme-os.js` (`unsubscribeFirebase`/`unsubscribeOS`). `base.repository[.tenant].js` fazem `return onSnapshot(...)` — retornam a função corretamente para o chamador gerenciar (padrão correto na camada; não verificado nesta rodada se todo chamador realmente guarda e chama o retorno).

**Não capturam o retorno em lugar nenhum do arquivo (achado deste ciclo):**

| Arquivo | Listeners sem unsubscribe | Coleções |
|---|---|---|
| `usuarios-permissoes.js:373,381,395` | 3 | `usuarios`, `perfis_operacionais`, `auditoria_usuarios_permissoes` |
| `dashboard/dashboard-alertas-panel.js:387-403` (`start()`) | 5 | `os`, `posvenda_contatos`, `agendamentos`, `solicitacoes_diagnostico`, `pre_os` |
| `auditoria/auditoria.js:70` | 1 | (auditoria) |
| `dashboard/dashboard-alertas.js:25,50` | 2 | `agenda`(via `q`), `diario_registros` |

Total: 11 listeners sem qualquer mecanismo de cancelamento no arquivo onde nascem — se a função que os registra (`start()`/`boot()`/init) puder rodar mais de uma vez na mesma sessão de página (troca de aba dentro do dashboard, re-render, etc.), cada nova execução empilha listeners novos sem nunca fechar os antigos.

**Não verificado nesta rodada (em aberto para Ciclo 4, se autorizado):** se essas 4 telas são recarregadas via troca de página inteira (iframe reload — mataria os listeners de graça) ou se o container do dashboard mantém o JS vivo entre trocas de painel (listener realmente vaza). A resposta determina se isso é 🟡 teórico ou 🔴 ativo em produção; não afirmar severidade sem essa confirmação.

**Nenhuma alteração de código feita.**

---

## Ciclo 4 (mesmo dia) — Adoção real de `limitTo` na Repository Layer

**Objetivo:** fechar o item em aberto do Ciclo 2 — o quanto os 19 repositórios (`CRM/repositories/*.repository.js`, camada P2.3) realmente usam o `limitTo` que `buildQuery()` já suporta, e revisar de passagem os listeners registrados via `.onChange()` (mecanismo diferente do `onSnapshot()` direto já coberto no Ciclo 3).

**Evidências encontradas:**
- 19 repositórios confirmados em `CRM/repositories/`; API dupla (inglês legado `list/onChange/...` + português padronizado `listar/...`, ambas via `comApiPadrao()`).
- **27 chamadas de `.list()`** fora da própria camada (`CRM/pages/**`). Só **1 usa `limitTo`**: `central-alertas.js:157` (`Avaliacoes.list({ ..., limitTo: 5 })`). As outras 26 chamam sem `limitTo` — mesmo em coleções já identificadas como grandes/crescentes (`OS.list()`, `Clientes.list()`, `PosvendaContatos.list()`, `FinanceiroPagar/Receber/Fixas.list()`).
- **0 de 7 chamadas de `.onChange()`** (`CategoriasInformacoes`, `Informacoes`, `PreOS`, `Chips`, `Agenda`, `OS`, `CaixaLancamentos`) passam `limitTo`.
- **Achado novo (extensão do Ciclo 3):** de 7 `.onChange()`, 3 não capturam a função de unsubscribe em variável nenhuma — `acaodasemana.js:594` (`Agenda`), `relatorios.js:903` (`OS`), `relatorios.js:912` (`CaixaLancamentos`). Estes usam o wrapper da Repository Layer, não `onSnapshot()` direto, por isso não apareceram no grep do Ciclo 3 (que buscou só `onSnapshot(` literal). Total agora: **14 listeners sem unsubscribe** (11 do Ciclo 3 + 3 daqui).
- **Não migrado:** `listarPaginado()` (paginação real, keyset, já implementada em `base.repository.padrao.js` desde P2.3) tem **0 chamadas** em `CRM/pages/**` — existe na camada mas nenhuma tela a usa ainda.

**Arquivos analisados:** `CRM/repositories/base.repository.js`, `base.repository.tenant.js`, `base.repository.padrao.js`, e os 19 arquivos `*.repository.js`; chamadores em `CRM/pages/{contas,central-alertas,estoque,diario,autoatendimento,catalogo,os,fornecedor,central-comandos,pos-venda,campanhas,central-informacoes,crm-comercial,acaodasemana,relatorios}`.

**Riscos:**
- O mecanismo de proteção (`limitTo`, `listarPaginado`) existe e funciona (comprovado pelo único uso real, `Avaliacoes`), mas não é convenção seguida — cada nova tela migrada para a Repository Layer tende a repetir `.list()` sem limite por herdar o padrão majoritário do próprio repo, não por falta de ferramenta.
- `relatorios.js` (`OS.onChange`, `CaixaLancamentos.onChange`) é especialmente sensível: relatórios tendem a ficar abertos mais tempo na tela, e ambas as coleções já são apontadas como grandes/crescentes nos Ciclos 1-2.

**Recomendações (não executar sem autorização):**
1. Quando P3/BL-004/BL-005 forem autorizados, tratar isso como o mesmo backlog do Ciclo 2 — a causa raiz é uma só (falta de convenção de limite por leitura), só que espalhada em duas camadas (getDocs direto + Repository Layer).
2. Somar os 3 listeners novos (`acaodasemana.js`, `relatorios.js` ×2) ao inventário de 11 do Ciclo 3 antes de qualquer correção de listener — não tratar como achados separados.
3. Avaliar se `listarPaginado()` (já pronta, 0 adoção) resolve várias das 26 chamadas de `.list()` sem limite de uma vez, em vez de adicionar `limitTo` caso a caso.

**Pendências:** não verificado se as coleções por trás de `Estoque`, `Produtos`, `FornecedorCompras`, `FornecedorTendencias` têm tamanho relevante (podem ser pequenas por natureza — poucas dezenas/centenas de itens — e portanto de risco baixo mesmo sem `limitTo`); este ciclo não tem acesso a contagem real de documentos em produção (somente leitura de código-fonte).

**Sugestão do próximo ciclo:** amostra de escape XSS em `innerHTML` (P7 do Ciclo 1 — `saas-onboarding.js`, `central-alertas`, `caixa`, `compras`) — verificar quais interpolam dado vindo do Firestore sem `esc()`/equivalente, já que é o único item de segurança do Ciclo 1 ainda sem detalhamento.

**Nenhuma alteração de código feita.**

---

## Ciclo 5 (mesmo dia) — Amostra de escape XSS (P7 do Ciclo 1)

**Objetivo:** verificar, nos 4 arquivos apontados pelo P7 do Ciclo 1, quais interpolações de `innerHTML` usam dado vindo do Firestore sem escape.

**Evidências encontradas (22 ocorrências de `innerHTML` revisadas nos 4 arquivos):**
- `central-alertas.js` — **consistente**: importa `escHtml as escapeHtml` de `shared/sanitize.js` e usa em toda interpolação dinâmica (`title`, `sub`, `detail`, `clientName`, `os.id`, descrição de conta vencida).
- `compras.js` — **consistente**: `esc()` (mesmo helper) aplicado em `c.descricao`, `nomeForn`, `f.descricao/nome` — 100% dos campos vindos do Firestore.
- `saas-onboarding.js` — **consistente**: `escHtml()` no resumo do onboarding (dado do próprio formulário do usuário); os demais `innerHTML` do arquivo (seletor de planos, texto de preço) usam só a constante estática `PLANOS`, sem dado externo — **P7 do Ciclo 1 pode ser considerado não-issue para este arquivo** após checagem direta.
- `caixa.js` — **quase consistente, 1 gap real**: usa `esc()` corretamente em `l.descricao`, `l.categoria`, `l.obs`, `l.fornecedor`, `p.nome` (6 ocorrências). **Exceção:** `carregarCategorias()` (~linha 87) monta `<option value="${c.nome}">${c.nome}</option>` **sem** `esc()` — e `c.nome` vem da coleção Firestore `categorias_caixa` (`COL_CATEGORIAS`), que aceita nome livre digitado pelo usuário via `prompt()` em `novaCategoria()` (~linha 98). É o único ponto dos 4 arquivos que quebra o padrão de escaping já seguido no resto do mesmo arquivo — o helper `esc` já está importado nesse arquivo, só não foi usado nessa linha.

**Nota de exploitabilidade (para não superestimar):** por estar dentro de `<option>`/`<select>`, o vetor de execução é mais restrito que um `innerHTML` genérico em `<div>` — navegadores isolam boa parte do conteúdo de `<select>`. Ainda assim, um nome de categoria com `"` quebra o atributo `value="..."`, o que é uma inconsistência real de código, não só cosmética.

**Também notado, severidade teórica muito baixa (sem recomendação de ação):** `l.id` e `p.id` (Firestore push IDs, opacos e auto-gerados) são interpolados sem escape em `onclick="...('${l.id}')"` e `data-id="${p.id}"` no mesmo `caixa.js` — risco desprezível porque o valor não é digitável pelo usuário.

**Arquivos analisados:** `saas-onboarding.js`, `central-alertas.js`, `caixa.js`, `compras.js` — as 22 ocorrências de `innerHTML` dos 4 arquivos, uma a uma.

**Riscos:** 1 gap real (caixa.js, nome de categoria), severidade baixa-média, escopo de 1 linha.

**Recomendações (não executar sem autorização):** aplicar `esc()` — já importado no mesmo arquivo — em `c.nome` na renderização das `<option>` de categoria em `caixa.js`. Fix de 1 linha, mesmo padrão já usado 6× no arquivo; sem risco de regressão.

**Pendências:** nenhuma — os 4 arquivos do P7 foram totalmente revisados.

**Sugestão do próximo ciclo:** P4 (`/dev` duplicado fora de `app-config.devPrefix()`) ou P6 (~129 `console.log`/`debug` em produção) — ambos baixa prioridade mas rápidos de inventariar exatamente, fechando o restante dos itens do Ciclo 1 que ainda não têm lista de arquivos/linhas.

**Nenhuma alteração de código feita.**

---

## Ciclo 6 (mesmo dia) — Fecha P4 e P6 do Ciclo 1

**Objetivo:** dar lista exata de arquivos/linhas para os dois itens do Ciclo 1 que ainda não tinham detalhamento (P4 — `/dev` duplicado; P6 — `console.log` em produção), e checar de passagem se algum `console.log` expõe dado sensível (reincidência do achado crítico "log de senha" da Auditoria Técnica Independente de 2026-07-17, já corrigido na época).

**Evidências encontradas:**
- **P6 (sensível):** 0 ocorrências de `console.log/debug/warn` contendo `senha|password|token|secret|chave|apikey` em `CRM/`, `shared/`, `functions/`. **A correção de 2026-07-17 não regrediu.**
- **P4:** confirmados **11 pontos** em **10 arquivos** reimplementando literalmente a mesma expressão de `app-config.js:62` (`devPrefix()`):
  `p === '/dev' || p.startsWith('/dev/')` (ou variação equivalente com `location.pathname`) — `impressao.js:41`, `brand-header.js:10,28` (2×, uma para prefixo/URL e outra para nome de branch — não é a mesma duplicação, é lógica correlata), `favoritos.js:26`, `scripts/kernel.js:49`, `dashboard-caixa.js:33`, `sw-alarme.js:11`, `shared/env-config.js:39`, `dashboard-alarme-os.js:720`, `config/config.js:17`, `shared/sidebar.js:21`.
  Todos os 11 são **exatamente** a mesma condição, byte a byte, comparada com `devPrefix()` — não há motivo funcional para a duplicação na maioria dos casos.
  **Exceção que merece nota:** `dashboard/sw-alarme.js` é um **Service Worker** — dependendo de como é registrado, pode não conseguir importar `app-config.js` como módulo ES normal; a duplicação ali pode ser necessária, não só dívida técnica. Não verificado neste ciclo (checar `type: 'module'` no registro do SW antes de propor fix ali).

**Arquivos analisados:** os 10 arquivos acima + `app-config.js` (fonte da verdade).

**Riscos:** nenhum risco de segurança — é dívida de manutenção (se a regra de detecção de `/dev` mudar um dia, 10-11 lugares precisam ser atualizados manualmente em vez de 1).

**Recomendações (não executar sem autorização):** migrar os 9-10 pontos fora do Service Worker para `import { devPrefix } from '.../app-config.js'` — mesmo escopo que a Fase F1.4 já em andamento (memória: "20 páginas p/ app-config", 2026-07-16), ou seja, isso é continuação natural de um trabalho já iniciado, não uma frente nova.

**Pendências:** confirmar se `sw-alarme.js` pode importar módulos ES (depende do `registration` do Service Worker) antes de incluir esse arquivo na migração.

**Sugestão do próximo ciclo:** com P1-P10 do Ciclo 1 agora todos detalhados (P1/P2/P5/P8/P9/P10 já estavam claros desde o Ciclo 1; P3 nos Ciclos 2+4; P4 e P6 aqui; P7 no Ciclo 5), o próximo ciclo pode: (a) abrir uma frente nova fora da lista original — ex. revisão de Firestore Rules vs. matriz de permissões (P10/BL-011, já sinalizado como "dívida consciente" mas nunca detalhado linha a linha), ou (b) considerar o backlog de leitura deste dia esgotado e voltar ao texto fixo de ESPERA CONTROLADA até autorização de execução.

**Nenhuma alteração de código feita.**

---

## Ciclo 7 (mesmo dia) — Verificação de drift: `firestore.rules` vs. ADR-AUTH-001

**Objetivo:** o Ciclo 6 sugeriu "revisão de Rules vs. matriz de permissões" para P10/BL-011 — antes de tratar isso como frente nova, conferi `plans/ADR_AUTH_001_MODELO_AUTORIZACAO_20260721.md` e essa pergunta **já está formalmente decidida e ACEITA** (2026-07-21): Rules = auth+tenant, matriz de permissões = camada de aplicação, por decisão consciente (Alternativa A), não bug. Reabrir esse debate seria repetir uma auditoria já concluída, contra a regra "não repetir auditorias já concluídas sem justificativa". Em vez disso, este ciclo faz algo genuinamente novo e não coberto pelo ADR: **checar se `CRM/firestore.rules` ainda corresponde, 2 dias depois, à linha de base que o ADR aceitou** — verificação de drift, não relitígio da decisão.

**Evidências encontradas:**
- `CRM/firestore.rules` tem **64 blocos `match`** de coleção; **todos têm pelo menos uma regra `allow` explícita** — 0 coleção órfã sem Rule (fecha em definitivo o achado de "10 coleções sem Rule" da auditoria de 2026-07-01/03).
- **~50 dos 64 blocos** seguem exatamente o padrão aceito pelo ADR: `allow read: if request.auth != null && temAcessoLiberado() && mesmaEmpresaRead();` — byte a byte idêntico entre coleções, sem variação estranha.
- **Exceções, todas justificadas e documentadas no próprio arquivo** (nenhuma parece descuido):
  - `os/{osId}`: `get` fechado (`if false`) desde Sprint 1a (07-05) — leitura de doc único só via Cloud Function pública com allowlist de campos.
  - `config/{docId}`: `get` público só para `docId in ['impressao','horarios']` (config de impressão/horário, não sensível); resto exige auth+tenant.
  - `metadata/{docId}`: sem `mesmaEmpresaRead()` — é coleção global (contador `counter`), não por empresa; `write` restrito a admin/master_admin exceto o contador.
  - `alarme_config`, `central_alertas_status`, `favoritos_usuarios`, `usuarios/{uid}/preferencias`, `_diagnostico_temp`: chave por `request.auth.uid == docId` — doc pessoal, não tenant (correto, é por usuário).
  - `catalogo_produtos`, `catalogo_config`: leitura pública (`get: if true` / condição sem auth) — catálogo é a página pública sem login, coerente com `catalogo-publico.js` já visto no Ciclo 2.
  - `orders/{docId}`, `clients/{docId}`: `allow read, write: if false` — nomes em inglês, aparentam coleções legadas/órfãs, **bloqueadas por completo**. Postura correta (nega tudo) se realmente não usadas.
- Não encontrada nenhuma coleção com `if true` irrestrito em dado de negócio (o único `if true` remanescente é `catalogo_config` get, que é intencionalmente público).

**Arquivos analisados:** `CRM/firestore.rules` (808 linhas, íntegro) contra `plans/ADR_AUTH_001_MODELO_AUTORIZACAO_20260721.md`.

**Riscos:** nenhum novo. Confirma que a baseline aceita em 07-21 não sofreu drift em 2 dias.

**Recomendações:** nenhuma ação — este ciclo é uma confirmação negativa (nada errado encontrado), não um achado acionável. Único ponto de curiosidade, não risco: confirmar se `orders`/`clients` são mesmo mortas (grep de uso) antes de um dia decidir removê-las do arquivo — limpeza cosmética, não segurança.

**Pendências:** nenhuma.

**Sugestão do próximo ciclo:** o backlog de leitura originado do Ciclo 1 (P1-P10) está agora integralmente detalhado, e a verificação de drift de Rules não achou nada novo. Não identifico mais itens de auditoria pendentes sem começar a especular sobre frentes não solicitadas (o que a regra 6 do protocolo veda). Ponto natural para o dono revisar os achados acumulados (Ciclos 1-7) antes de abrir uma frente nova.

**Nenhuma alteração de código feita.**

---

## Ciclo 8 (mesmo dia) — Checkpoint 1 de "PROTOCOLO DE CONTINUIDADE AUTOMÁTICA" (20 frentes): Segurança + Cloud Functions + Performance/assets + Arquitetura

**Objetivo:** dono forneceu lista ordenada de 20 frentes de auditoria; primeiro checkpoint (frentes 1, 2, 3, 5 da lista — Segurança, Performance, Arquitetura, Cloud Functions), evitando repetir o que os Ciclos 1-7 já cobriram (RBAC/ADR-AUTH-001 já fechado no Ciclo 7; XSS já fechado no Ciclo 5; getDocs/listeners já fechados nos Ciclos 2-4).

### Frente 1 + 5 — Segurança e Cloud Functions

**Evidências:**
- Nenhum segredo real hardcoded encontrado. As duas ocorrências de `apiKey` em `env-config.js` são a chave pública do Firebase Web SDK (não é credencial secreta por design — segurança do Firebase depende das Rules, não de esconder essa chave). Nenhuma service account key (`BEGIN PRIVATE KEY`) presente no working tree atual; `.gitignore` cobre `.env`/`sa-key.json` (o vazamento histórico de sa-key já registrado em auditorias anteriores é sobre o passado, não uma reincidência aqui).
- As 4 Cloud Functions (`admin.js`, `os.js`, `portal.js`, `saas.js`, 15 functions no total) são notavelmente bem escritas: checagem de auth+perfil+tenant em `excluirUsuarioAdmin`; whitelist explícita de campos públicos (`OS_CAMPOS_PUBLICOS`, `CAMPOS_POR_COLECAO_PORTAL`) com CPF mascarado (LGPD, Fase 4.1); rate limiting (`aplicarRateLimit`) em toda function pública; validação de input em todas; reserva atômica de e-mail no onboarding SaaS (`saas_email_index` com `.create()`, corrige corrida do dedup). Nenhuma vulnerabilidade nova encontrada nas Functions.
- **Achado real (novo):** rate limiter (`functions/lib/rate-limit.js`) é **in-memory por instância**, não distribuído — o próprio código já documenta essa limitação e cita App Check como melhoria futura (P1). Não é uma vulnerabilidade nova, é uma lacuna já conhecida e transparente no código; incluído aqui só para constar no quadro consolidado de segurança.
- **Achado real (novo, mais relevante deste checkpoint):** `CRM/pages/central-informacoes/informacoes-crypto.js` criptografa senhas armazenadas no módulo "Central de Informações" com AES (CryptoJS) usando uma **chave estática hardcoded no bundle JS do cliente** (`CRIPTOGRAFIA_KEY = 'cellcity-2026'`). O próprio comentário do código já admite: *"não é seguro, apenas ofuscação"* — não é uma vulnerabilidade escondida, é uma limitação conhecida pelos próprios desenvolvedores. Relevante mesmo assim porque, combinado com o ADR-AUTH-001 (Rules = auth+tenant, sem RBAC por campo/coleção — Ciclo 7), **qualquer funcionário autenticado e não-pendente da empresa** (não só quem tem permissão de ver a Central de Informações na UI) consegue ler `informacoes.senhaOculta` no Firestore e descriptografar com a mesma chave pública do bundle — a "criptografia" não impede acesso por perfil, só esconde de quem olha o console do Firestore sem rodar o código.
- **Achado real (novo, supply-chain, achado via checagem de assets):** dois scripts carregados de CDN externo (`cdnjs.cloudflare.com/.../crypto-js@4.1.1` e `cdn.jsdelivr.net/npm/chart.js@4.4.0`) **sem atributo `integrity` (SRI)** — se o CDN for comprometido ou houver MITM, o script executa com acesso total ao DOM/`localStorage`/tokens da página, em telas que lidam com senha armazenada (`central-informacoes`) e dados financeiros (`relatorios`).

**Arquivos analisados:** `functions/{admin,os,portal,saas}.js`, `functions/lib/rate-limit.js`, `CRM/shared/env-config.js`, `CRM/pages/central-informacoes/informacoes-crypto.js`, `.gitignore`, `CRM/pages/{central-informacoes,relatorios}/index.html`.

---

## Ciclo 9 (mesmo dia) — Checkpoint 2: Firestore (modelo de dados) + Front-end (qualidade)

### Frente 4 — Firestore, modelo de dados

**Objetivo:** ir além de Rules (já no Ciclo 7) — modelo de dados/schema.

**Evidência:** já existe auditoria completa e específica sobre isso —
`plans/FASE39_ENCERRAMENTO_V310_MODELO_DADOS_CICD_20260718.md` (70
coleções inventariadas, "tri-padrão" PT/EN/misto mapeado campo a
campo) — e a decisão formal já foi tomada em
`plans/DECISOES_FASE39_V310_20260718.md` (D01, **APROVADO** 2026-07-18):
português camelCase é o padrão oficial, campos legados EN (`os`,
`clientes`) continuam suportados sem migração em massa, estratégia
Expand→Compatibilidade→Contract para o futuro. **Minha própria memória
estava desatualizada** (dizia "recomendação PT aguarda aprovação" —
já não é o caso desde 07-18; corrigido no índice de memória).

**Recomendação:** não reabrir este tema — é decisão fechada, não
"dívida sem detalhamento" como P10/RBAC antes do Ciclo 7. Repetir a
auditoria de schema seria exatamente o tipo de trabalho redundante que
o protocolo veda.

**Nenhuma alteração de código feita.**

### Frente 6 — Front-end, qualidade geral (além do XSS do Ciclo 5)

**Objetivo:** heurística de qualidade — blocos `catch` vazios (padrão
clássico de erro engolido silenciosamente).

**Evidências:** 48 blocos `catch {}` (sem corpo) em `CRM/`+`shared/`.
Amostra verificada nos arquivos mais críticos:
- **Benignos (verificados, não é achado):** todos os 6 em `os.js`, e os
  de `caixa.js`/`central-modulos.js`/`favoritos.js` envolvem leitura
  de `localStorage`/DOM opcional, com valor padrão **já declarado antes**
  do `try` — falha silenciosa não tem efeito visível nem perda de dado
  real. Checado para não inflar um heurística genérica em achado falso.
- **Achado real:** `financeiro.js:397`, função `recarregar(col)` — o
  `catch {}` envolve a chamada de rede `getDocs()` que recarrega
  contas a pagar/fixas/receber. Se a leitura falhar (rede, permissão,
  cota), a função **não loga nem avisa o usuário** — a tela continua
  mostrando os dados antigos em memória, sem qualquer sinal de que a
  atualização falhou. `recarregar()` é chamada em 5 pontos (linhas 332,
  352, 373, 603, 1007), pelo menos 3 deles logo **após salvar um
  lançamento** — cenário real: usuário paga uma conta, o `recarregar`
  pós-salvamento falha silenciosamente, e a tela continua mostrando a
  conta como "em aberto" sem indicar erro algum.

**Arquivos analisados:** os 16 arquivos com `catch {}` identificados
pelo grep; leitura detalhada de `os.js` (6 ocorrências), `caixa.js`,
`financeiro.js`, `central-modulos.js`, `favoritos.js`, `comandos.js`.

**Riscos:** achado de `financeiro.js` é módulo financeiro — falha
silenciosa pode levar a decisão de negócio (ex.: reprocessar um
pagamento) baseada em tela desatualizada sem o usuário saber.

**Recomendações (não executar sem autorização):** em `recarregar()`,
trocar `catch {}` por, no mínimo, `console.error` + toast de erro
visível ao usuário (mesmo padrão de tratamento de erro já usado em
outras partes do próprio `financeiro.js`, ex. os `.catch(e => ...)`
vistos no Ciclo 4 em `central-alertas.js`). Fix pequeno e localizado,
sem risco de regressão.

**Pendências:** não inventariados os outros ~40 `catch {}` fora da
amostra checada (arquivos menos críticos) — não presumir que são todos
benignos como a amostra, mas também não presumir que são todos como o
de `financeiro.js`; ficaria para um Ciclo futuro se o dono quiser.

**Nenhuma alteração de código feita.**

---

## Ciclo 10 (mesmo dia) — Checkpoint 3: UX (estático) + Documentação

### Frente 7 — UX (limitação declarada: sem browser neste ambiente)

**Objetivo:** o que dá para avaliar por leitura estática de HTML/CSS,
sem poder interagir de fato com a interface — análise de fluxo real
(estados de carregamento, responsividade visual, feedback de clique)
fica fora do alcance deste ciclo por falta de ferramenta, não por
escolha.

**Evidências:**
- `viewport` presente nas 36/36 páginas (`CRM/pages/*/index.html`) —
  base responsiva OK.
- 6 de 14 tags `<img>` do projeto sem `alt` — todas em `os.js`: fotos
  de padrão/senha de desbloqueio do aparelho, fotos da OS, logo de
  impressão. São conteúdo real (não decorativo), então a ausência de
  `alt` importa para leitor de tela — achado pequeno, plausível de
  baixa prioridade num CRM interno B2B (não é produto público), mas
  real.
- 257 `<input>` em telas de formulário — não verificado (fora do
  escopo estático viável) se todos têm `<label for>`/`aria-label`
  correspondente; contagem bruta não permite concluir nada sozinha.

**Riscos:** baixo — acessibilidade em ferramenta interna de uso diário
pela equipe, não vitrine pública.

**Recomendações:** nenhuma ação — item de baixa prioridade, mencionar
apenas para registro.

**Pendências:** avaliação real de UX (fluxo, responsividade em
dispositivo, feedback de interação) requer browser/dispositivo, não
disponível neste ambiente somente-leitura.

### Frente 8 — Documentação

**Objetivo:** checar atualidade/integridade dos documentos-guia
listados no `README.md`, além do que o Ciclo 1 já achou
(`MASTER_ROADMAP.md` desatualizado, P9 — não repetido aqui).

**Evidências:**
- Todos os 11 links de documentos citados no `README.md` apontam para
  arquivos que **realmente existem** (`CLAUDE.md`, `PROXIMA_ETAPA.md`,
  `CRM/TECHDOC.md`, `MASTER_ROADMAP.md`, `GUIA_OPERACAO_AMBIENTES.md`,
  `GUIA_ROLLBACK.md`, `GUIA_MANUTENCAO.md`, `HISTORICO_PROJETO.md`,
  `CHANGELOG.md`, 2 relatórios em `plans/`) — nenhum link quebrado.
- `CRM/TECHDOC.md` (276KB) foi editado pela última vez em 2026-07-21
  ("governança da baseline v3.2.0") — razoavelmente atual (2 dias).
- `ENGINEERING.md` não editado desde 2026-07-13 (10 dias) — checado se
  ficou contraditório com o ADR-AUTH-001 (2026-07-21, mais recente):
  ele só lista "RBAC" e "Firestore Rules (auditoria)" como
  responsabilidades do papel de Revisão Técnica — continua correto
  mesmo após o ADR (a responsabilidade de auditar continua existindo;
  o ADR só esclareceu a relação Rules×matriz). **Não é uma
  contradição, verificado e descartado.**

**Riscos:** nenhum novo — `MASTER_ROADMAP.md` desatualizado já é P9
do Ciclo 1, não duplicado aqui.

**Recomendações:** nenhuma ação nova além da já registrada no Ciclo 1.

**Pendências:** nenhuma.

**Nenhuma alteração de código feita.**

---

## Ciclo 11 (mesmo dia) — Checkpoint 4: Testes (execução real) + CI/CD

### Frente 9 — Testes (única frente deste dia em que a suíte foi de fato executada, não só lida)

**Objetivo:** medir estado real dos testes, não só contar arquivos.

**Correção de memória:** a cifra "~2601 arquivos de teste" (memória de
Fila B, 07-21) estava **errada por contagem** — quase tudo era
`node_modules` vendorizado dentro de `tests/{firestore-rules,storage-
rules}/node_modules/@firebase/...` (o próprio SDK do Firebase carrega
milhares de arquivos de teste internos). O projeto tem, de fato,
**55 arquivos de teste reais** (`*.test.*` fora de `node_modules`).

**Execução (node v22.23.1 via nvm, binário direto — `node`/`npm` não
estão no PATH deste sandbox):**

| Suíte | Resultado |
|---|---|
| `tests/rbac/*` (37 arquivos — precisa `--import ./register-loader.mjs`, não só `node --test`) | ✅ **181/181** |
| `tests/infra` | ✅ 12/12 |
| `tests/onboarding` | ✅ 10/10 |
| `tests/control-center/diagnostico` | ✅ 21/21 |
| `tests/control-center/ferramentas` | ✅ 25/25 (precisa >20s) |
| `tests/performance` | ✅ 4/4 |
| `tests/functions/rate-limit-s2` | ✅ 4/4 |
| `tests/integrity` (2 arquivos) | ✅ 14/14 + 12/12 |
| `tests/os/mensagem-finalizado` | ✅ 9/9 |
| **Total confirmado passando** | **✅ 292/292, 0 falha real** |
| `tests/firestore-rules` (2 arq., 123 testes) | ⚠️ precisa emulador Firestore rodando (`firebase emulators:exec`) — confirmado pelo erro real, não suposição |
| `tests/storage-rules` (15 testes) | ⚠️ mesma causa (emulador) |
| `tests/e2e/basic-structure` (9 testes) | ⚠️ precisa servidor local em `localhost:8099` + browser headless — confirmado pelo erro (`ERR_CONNECTION_REFUSED`) |
| `tests/functions/saas-onboarding` (5 testes) | ⚠️ precisa credenciais reais do Google Cloud (Application Default Credentials) — confirmado pelo erro |
| `tests/control-center/estrutura`, `tests/functions/portal-cloud-functions` | ❓ não concluíram nem em 45s — inconclusivo, não travado em falha nem em sucesso confirmado |
| `tests/control-center/v3/phase1.test.sh` | não é arquivo Node (`.sh`) — minha invocação (`node --test`) não é a forma certa de rodá-lo; falso negativo do meu método, não do teste |

**Achado de processo (não é bug de produto):** rodar `node --test
tests/rbac/*.test.mjs` direto (sem o loader) faz **todos** os 181
testes RBAC falharem com `ERR_UNSUPPORTED_ESM_URL_SCHEME` — parece uma
regressão grave até se ler `tests/rbac/package.json`, que documenta a
forma certa de invocar (`node --import ./register-loader.mjs --test
*.test.mjs`, executado de dentro de `tests/rbac/`). Registrado aqui
porque é fácil outra pessoa (ou IA) repetir esse falso alarme.

**Riscos:** nenhum novo — os 292 testes que rodam neste sandbox
confirmam RBAC, infra, onboarding, integridade, e Control Center
íntegros hoje. Os que precisam de emulador/servidor/credenciais não
puderam ser avaliados aqui, mas isso já era conhecido (Ciclo 1).

**Recomendações:** nenhuma ação — resultado é validação positiva, não
achado de defeito.

### Frente 10 — CI/CD

**Objetivo:** conferir se as decisões D03/D05 (Fase 3.9, aprovadas
07-18) sobre pipeline seguem implementadas, sem reabrir a auditoria
completa de modelo de dados/CI já feita naquela fase.

**Evidências:**
- `deploy-firebase.yml` usa `workload_identity_provider` — **D03
  confirmado em vigor** (WIF, sem `FIREBASE_SA_KEY`); nenhum dos 4
  workflows (`backup-weekly`, `deploy-firebase`, `deploy-pages`,
  `tests`) referencia SA key/credencial JSON.
- `backup-weekly.yml`: `cron: '0 */3 * * 0'` — roda a cada 3h aos
  domingos (UTC) — **D05 confirmado em vigor**.
- `tests.yml` ainda em nodejs20 — já é P1/BL-007 do Ciclo 1, não
  duplicado aqui.

**Riscos:** nenhum novo.

**Recomendações:** nenhuma ação nova.

**Pendências:** não verificado o histórico de execuções reais no
GitHub (não tenho acesso a `gh` neste ciclo) — checagem foi só
estática (conteúdo do YAML), não confirma que a última run passou.

**Nenhuma alteração de código feita.**

---

## Ciclo 12 (mesmo dia) — Checkpoint 5: Dependências + Dívida Técnica (consolidação)

### Frente 11 — Dependências

**Objetivo:** `npm outdated` + `npm audit` real (rede disponível neste
sandbox, diferente de node/npm no PATH — precisou do binário nvm
direto de novo).

**Evidências — versões:** nada dramático — `firebase` 12.14.0→12.16.0,
`firebase-admin` (raiz) 14.1.0→14.2.0, `firebase-tools`
15.22.4→15.24.0 (patches menores); único salto de major é
`puppeteer-core` 24→25 (devDependency de teste e2e).

**Evidências — `npm audit`:**
- **Raiz (`package.json`):** 16 vulnerabilidades (1 low, 12 moderate,
  3 high) — **100% dentro da árvore do `firebase-tools`**
  (devDependency, CLI local/CI, não roda em produção nem é exposta à
  internet). A cadeia real é `uuid` (bounds check ausente) → `gaxios`/
  `teeny-request` → `@google-cloud/storage` → `firebase-admin`/
  `firebase-tools`; mais duas isoladas: `brace-expansion` (ReDoS) e
  `fast-uri`/`fast-xml-parser`/`protobufjs`/`@opentelemetry/core`
  (DoS/parsing), todas em dependências de build/CLI.
- **`functions/` (roda em produção, Cloud Functions):** 10
  vulnerabilidades (1 low, 8 moderate, **1 high** —
  `fast-xml-parser`, DoS via DOCTYPE). Mesma árvore
  (`@google-cloud/firestore`/`storage` → `google-gax`/`teeny-request`
  → `uuid`). **Verificado (grep):** nenhum código deste projeto
  (`functions/` nem `CRM/`) chama `fast-xml-parser`, `DOMParser` ou
  processa XML diretamente — a superfície vulnerável só é alcançável
  se o próprio SDK do Google (`google-gax`) processar XML
  internamente, fora do controle/uso ativo deste código. Não é uma
  vulnerabilidade "morta" (ainda vale corrigir via patch), mas também
  não é uma rota de ataque óbvia via lógica de negócio deste projeto.

**Riscos:** baixo-médio — nenhuma dependência vulnerável é chamada
diretamente pelo código de negócio; risco real é de higiene de
supply-chain (não corrigir por muito tempo aumenta a superfície se um
dia alguma dessas libs virar caminho de dado externo).

**Recomendações (não executar sem autorização):** `npm audit fix`
(sem `--force`) resolve os itens que não quebram compatibilidade;
`--force` sobe `firebase-tools` para uma versão com breaking change —
avaliar separadamente, não é fix de rotina.

**Pendências:** nenhuma.

### Frente 12 — Dívida técnica (consolidação, não investigação nova)

**Objetivo:** juntar os achados de dívida técnica dos Ciclos 1-12 num
só lugar, sem reabrir nada.

| Item | Prioridade | Ciclo de origem |
|---|---|---|
| CF em nodejs20 (prazo 2026-10-30) | 🔴 Alta | 1 (P1) |
| `portal_eventos` sem corte de data, duplicado, sem TTL | 🟠 Alta | 2, Ciclo8-CF |
| 41/49 `getDocs` sem `limit()` | 🟠 Alta | 2 |
| 14 listeners sem unsubscribe | 🟡 Média | 3, 4 |
| Repository Layer: `limitTo` quase não adotado (1/27) | 🟡 Média | 4 |
| `caixa.js`: categoria sem `esc()` (XSS) | 🟡 Média | 5 |
| `informacoes-crypto.js`: chave AES hardcoded | 🟡 Média (dado sensível) | 8 |
| CDN sem SRI (`crypto-js`, `chart.js`) | 🟡 Média | 8 |
| `financeiro.js recarregar()`: erro engolido silenciosamente | 🟡 Baixa-Média | 9 |
| 11 duplicações de `devPrefix()` | 🟡 Baixa | 1 (P4), 6 |
| ~129 `console.log` em produção | 🔵 Baixa | 1 (P6) |
| 6 `<img>` sem `alt` | 🔵 Baixa | 10 |
| 16+10 vulnerabilidades npm (transitivas, não usadas diretamente) | 🔵 Baixa | 11 |
| Storage sem bucket configurado | 🟠 Alta (negócio) | 1 (P2) |
| Rules/RBAC — decisão consciente, não é dívida "esquecida" | ✅ Fechado | 7 (ADR-AUTH-001) |
| Modelo de dados PT×EN — decisão consciente (D01) | ✅ Fechado | 4 |

**Nenhuma alteração de código feita.**

---

## Ciclo 13 (mesmo dia) — Checkpoint 6: Duplicações + Código morto

### Frente 13 — Duplicações (além de `devPrefix()`, já no Ciclo 6)

**Objetivo:** duplicação de lógica de UI comum entre páginas.

**Evidências:** `function toast(msg)` está **reimplementada de forma
independente em 14 arquivos** (`central.js`, `informacoes-ui-utils.js`,
`contas.js`, `central-alertas.js`, `acaodasemana.js`, `financeiro.js`,
`usuarios-permissoes.js`, `fornecedor.js`, `chat.js`, `campanhas.js`,
`comandos.js`, `compras.js`, `estoque.js`, `diario.js`) — não existe
versão compartilhada em `CRM/shared/`. Já **divergiu** entre si: 
`compras.js` usa classe CSS `show` + 2500ms; `estoque.js`/`diario.js`
usam `visivel` + 2200ms — mesmo padrão, duas convenções diferentes.
Lado positivo: todas usam `textContent` (não `innerHTML`), então a
duplicação não introduziu inconsistência de segurança, só de
manutenção/UX (durações e nomes de classe diferentes entre telas).
`fmtData` duplicada em 5 arquivos (não detalhado a fundo, mesmo
padrão provável).

**Riscos:** baixo (cosmético — não achado de segurança), mas cresce o
custo de qualquer mudança futura no padrão de toast (14 lugares a
tocar em vez de 1).

**Recomendações (não executar sem autorização):** extrair para
`CRM/shared/toast.js` (ou incorporar ao `sanitize.js`/utilitário já
existente), padronizando duração e nome de classe — mudança de baixo
risco, mas toca 14 arquivos, então não é "fix de 1 linha" como os
achados anteriores.

**Pendências:** `fmtData` (5 arquivos) não comparada em detalhe.

### Frente 14 — Código morto

**Objetivo:** módulos `shared/` sem nenhuma referência (arquivo órfão).

**Evidências:** checados todos os arquivos de `CRM/shared/*.js` contra
o resto do repositório (import/`<script src>`) — **nenhum órfão
encontrado**. Resultado limpo, sem achado (registrado porque a
verificação foi feita, não porque haveria algo errado — evita "loop
de auditoria genérica" nesta frente).

**Riscos:** nenhum.

**Recomendações:** nenhuma.

**Pendências:** não verificado no nível de função individual dentro de
arquivos grandes (ex.: função interna nunca chamada dentro do próprio
arquivo) — escopo maior que o proporcional para este checkpoint; nem
verificado se existe página inteira (`CRM/pages/*/`) órfã sem link na
navegação — ficaria para um Ciclo futuro se o dono quiser.

**Nenhuma alteração de código feita.**

---

## Ciclo 14 (mesmo dia) — Checkpoint 7: Logging + Observabilidade

### Frente 15 — Logging (além da contagem P6 do Ciclo 1/6)

**Objetivo:** não só contar `console.*`, mas checar disciplina — nível,
gate de debug, consistência.

**Evidências:** 402 chamadas `console.*` no front-end (`CRM/`+`shared/`,
sem contar `functions/`): 132 `log`, 161 `warn`, 106 `error`, 0
`debug`/`info` — convenção informal de 3 níveis, mas nenhuma
infraestrutura de log level real. A Repository Layer (P2.3) tem um
gate próprio (`localStorage cc_repo_debug`, visto no Ciclo 12 do
código-fonte) — mas isso **não existe fora dela**: os 132 `console.log`
de página (`caixa.js`, `os.js` etc.) rodam **incondicionalmente em
produção**, visíveis a qualquer usuário que abra o DevTools. Já
verificado no Ciclo 8 (Frente 1) que nenhum contém senha/token —
aqui o achado é disciplina/observabilidade, não vazamento.

**Riscos:** baixo — não é vazamento de segredo, é ruído de console em
produção e ausência de controle central de verbosidade.

**Recomendações:** nenhuma ação urgente; se um dia adotar log
estruturado, o padrão já existe pronto na Repository Layer
(`cc_repo_debug`) para reaproveitar em vez de inventar um novo.

### Frente 16 — Observabilidade

**Objetivo:** existe algum mecanismo de captura de erro/monitoramento
em produção, além dos `console.error` locais?

**Evidências:**
- **Nenhum serviço de observabilidade de terceiros** (Sentry,
  LogRocket, Datadog, New Relic, Bugsnag, Rollbar) integrado —
  confirmado por grep, os únicos "hits" eram falsos positivos
  (substring `scrollbar`).
- **Nenhum handler global** (`window.onerror` /
  `unhandledrejection`) em nenhuma página — um erro JS não tratado
  em produção **não é registrado em lugar nenhum**; some no console
  do navegador do próprio usuário, sem chegar à equipe a menos que
  o usuário reporte manualmente.
- `scripts/control-center/state/health-check.json` (Control Center,
  Roadmap v3.0) existe como estrutura mas está vazio
  (`timestamp: null, status: null`) — não é uma modificação desta
  sessão (diff contra HEAD vazio, apesar de aparecer como "modified"
  no `git status` inicial do dia); é um artefato de health-check
  ainda não populado por nenhuma execução real.

**Riscos:** médio — não é uma vulnerabilidade, mas significa que bugs
em produção só são descobertos se o usuário reclamar; não há alerta
automático de erro/quebra de fluxo.

**Recomendações (não executar sem autorização):** avaliar um handler
global mínimo (`window.addEventListener('error', ...)` +
`unhandledrejection`) que ao menos grave em uma coleção
`erros_cliente` (Firestore, já tem padrão de escrita simples no
projeto) — não precisa de serviço pago de terceiro para o primeiro
passo.

**Pendências:** nenhuma.

**Nenhuma alteração de código feita.**

**Riscos:** o achado de `informacoes-crypto.js` é o mais concreto do checkpoint — dado sensível (senhas de sistemas/equipamentos usadas pela equipe) com proteção real mais fraca do que a palavra "criptografia" sugere ao usuário. SRI ausente é risco de cadeia de suprimento, severidade baixa-média (depende de CDN de terceiro confiável historicamente, mas sem mitigação própria).

**Recomendações (não executar sem autorização):** (1) considerar `integrity`+`crossorigin` nos 2 `<script src=cdn...>`, ou hospedar os arquivos localmente (ambos são libs pequenas, sem motivo técnico forte para depender de CDN externo); (2) se a Central de Informações guarda credenciais realmente sensíveis (não só notas internas), avaliar mover a criptografia para o servidor (Cloud Function, chave fora do bundle) — mudança de arquitetura, não é fix de 1 linha como os achados de Ciclos anteriores.

**Pendências:** não avaliado se "informações" armazena tipicamente senhas de baixa sensibilidade (ex.: senha de impressora) ou credenciais críticas (ex.: acesso a painel de banco/fornecedor) — isso muda a prioridade real do achado; não dá para saber só pelo código.

### Frente 2 — Performance (ângulo novo: carregamento de assets/scripts)

**Evidências:** 34 de 36 páginas (`CRM/pages/*/index.html`) já usam `defer` ou `type="module"` (as 2 exceções — `estrategia`, `em-breve` — parecem páginas de baixo tráfego/institucionais). Nenhum bundler/CDN de framework pesado carregado (projeto é vanilla JS por decisão de arquitetura, já documentado). O achado relevante desta frente foi de segurança (SRI ausente), já reportado acima — não achei problema de performance pura adicional além do que os Ciclos 2-4 (leitura Firestore/listeners) já cobriram.

### Frente 3 — Arquitetura (cross-check rápido)

**Evidência positiva (não é um problema — registro de avanço real):** memória de 2026-07-16 registrava ~209 acessos diretos a `collection(db, ...)` fora da Repository Layer; contagem agora (`grep -rn "collection(db," CRM/pages CRM/shared`) dá **85** — queda real de ~60% desde então, migração P2.3 avançou de fato. Não há achado novo de arquitetura além do que Ciclos 2-4 e a própria trilha de ADRs (CCC-V2.0-ARCH-001, ADR-AUTH-001) já documentam; aprofundar exigiria reler os ~31KB do documento de arquitetura oficial contra o código atual, desproporcional para este checkpoint.

**Nenhuma alteração de código feita.**
