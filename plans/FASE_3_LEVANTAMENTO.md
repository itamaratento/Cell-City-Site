# 🔍 FASE 3 — LEVANTAMENTO TÉCNICO (Consolidação da Arquitetura)

> **Natureza deste documento:** levantamento e análise. Nenhum arquivo de código, configuração, Firestore Rules ou banco de dados foi alterado na produção deste documento — apenas leitura. Ver confirmação explícita ao final.
> Detalha e verifica factualmente a seção "Fase 3" do [`../MASTER_ROADMAP.md`](../MASTER_ROADMAP.md). Onde os achados contradizem premissas do roadmap, isso está sinalizado como **⚠️ Correção de premissa**.

---

## 1. Resumo executivo

A Fase 3 foi planejada em cima de três premissas que esta auditoria **não confirma no código atual**:

1. **"Vários módulos não têm `empresa_id`"** — na prática, **apenas 1 de 37 módulos** (`caixa`) tem isolamento por `empresa_id`. Os outros 36 não têm nenhum. Não é uma cauda de exceções, é a regra.
2. **"Padronizar para `shared/modulo-guard.js`"** — esse arquivo **não existe** na árvore ativa (só sobrevive em snapshots de `_BACKUPS/`). O padrão real de inicialização hoje é `initModulo()` em `CRM/scripts/kernel.js`, usado por apenas 12 dos 28 módulos com JS de página.
3. **"Chips, garantias, venda-rápida" como módulos de menor risco para começar** — `garantias` e `venda-rapida` **não existem** no código atual (existiam só num catálogo removido no rollback de 2026-06-27). `chips` não é módulo próprio, é um arquivo dentro de `crm-comercial/`.

Além disso, a auditoria encontrou dois riscos que não estavam no radar do roadmap original:
- Uma **chave de service account do Firebase em texto puro** (`sa-key.json`) na raiz do projeto (não commitada, mas presente em disco).
- Uma **divergência real** entre `firestore.rules` (raiz) e `CRM/firestore.rules` (o arquivo efetivamente deployado) — o arquivo da raiz protege coleções que não existem no arquivo em produção.

Não há React nem qualquer framework de UI neste projeto (confirmado durante a leitura da árvore de arquivos) — é HTML/CSS/JS puro com módulos ES nativos, sem build step. Os itens do escopo original referentes a "hooks" e "componentes React" foram reinterpretados para os equivalentes reais do projeto: módulos utilitários em `shared/*.js` e listeners Firestore.

O objetivo central da Fase 3 continua válido, mas o ponto de partida é mais amplo do que o roadmap estimava, e a lista de "módulos de menor risco para começar o rollout" precisa ser reescrita com módulos que de fato existem.

---

## 2. Diagnóstico da arquitetura atual

- **Sem build step**: HTML/CSS/JS puro, módulos ES nativos (`import`/`export`), sem framework de UI.
- Duas árvores principais de aplicação dentro do repositório:
  - **Raiz `Cell-City-Site/`** — site institucional + Portal do Cliente + scripts Node auxiliares (`backup-server.js`, `apply-cors.js`) + único `package.json` do projeto (`firebase@12.14.0`, `firebase-admin@14.1.0`).
  - **`CRM/`** — sistema de gestão interno, **sem `package.json` próprio** (consistente com "sem build step"), com 37 subpastas em `CRM/pages/` (uma por módulo de negócio) + `CRM/shared/` (utilitários compartilhados: sessão, sidebar, favoritos, tenant, listeners) + `CRM/scripts/kernel.js` (autenticação, sessão e contexto do usuário logado).
- **`_runtime_audit/`** — terceiro projeto Node, independente, com `package.json` próprio (`firebase@^10.8.0`, **2 versões major atrás** da raiz) contendo scripts de auditoria antigos (`homolog-refs.js`, `homolog-handlers.js`, `inspect-phones.js`).
- **`_BACKUPS/`** — 27.759 arquivos, 862 MB, snapshots históricos intencionais de recuperação de incidentes (fora do escopo de limpeza — é a rede de segurança do projeto, não dívida técnica).
- **Autenticação/sessão**: gerenciada centralmente por `CRM/scripts/kernel.js`, que expõe `initModulo()` (aguarda `onAuthStateChanged`, redireciona para login se não autenticado) — mas esse padrão só é adotado por 12 dos 28 módulos de página.
- **Multiempresa (`empresa_id`)**: existe uma fonte de dados dedicada (`shared/tenant.js`, com `getEmpresaId()`/`isMasterAdmin()`) totalmente funcional, mas **não importada por nenhum módulo**. O único módulo com isolamento real (`caixa`) usa um mecanismo paralelo mais simples, `ctx.empresaId` vindo do próprio `kernel.js`.
- **Firestore Rules**: dois arquivos de regra divergentes no repositório (raiz e `CRM/`), com apenas o de `CRM/` efetivamente apontado pelo `firebase.json` de deploy.

## 3. Inventário dos problemas encontrados

### 3.1 Componentes/módulos duplicados ou com responsabilidade sobreposta
- **Catálogo de módulos**: hoje só existe **um** catálogo ativo, `CRM/shared/central-modulos.js` (`RAW_MODULOS`/`TODOS_MODULOS`, 25 módulos). O catálogo concorrente citado no roadmap (`MODULOS_CATALOGO` em `pages/saas/saas.js`) **não existe mais** — removido no rollback de 2026-06-27, só sobrevive em `_BACKUPS/`. ⚠️ **Correção de premissa**: essa duplicação já não existe; pode sair do escopo da Fase 3.
- **Fonte de `empresa_id`**: duas fontes concorrentes e não integradas — `shared/tenant.js` (completo, mas não usado) vs `ctx.empresaId` de `kernel.js` (usado só por `caixa.js`).
- **Firestore Rules**: `firestore.rules` (raiz, 403 linhas) e `CRM/firestore.rules` (309 linhas, o deployado) divergiram como versões paralelas, não como cópias idênticas — ver risco em 3.6.

### 3.2 Utilitários/serviços passíveis de unificação (equivalente a "hooks" neste projeto sem framework)
- **Inicialização de módulo** (`initModulo()` de `kernel.js`) — usado por 12/28 módulos; os outros 16 inicializam via `DOMContentLoaded` puro, sem nenhuma checagem de sessão no JS (dependem só de uma flag `localStorage` visual/anti-flash).
- **Listeners Firestore** (`shared/listener-manager.js`) — API pronta (registro, cancelamento em lote, cleanup automático em `pagehide`), mas **zero chamadores**. Os 32 pontos de `onSnapshot(` do sistema são todos diretos, sem gestão de ciclo de vida centralizada.

### 3.3 Código legado, experimental ou não utilizado
- `shared/modulo-guard.js` — não existe na árvore ativa; referência no `MASTER_ROADMAP.md` está desatualizada.
- `shared/listener-manager.js` — construído, nunca conectado (ver 3.2).
- `setup.html`, `migration.html`, `homolog.html` citados no roadmap como páginas a remover — **não existem** em `CRM/pages/` nem na raiz do CRM. ⚠️ **Correção de premissa**: nada a remover aqui.
- Pasta órfã `BACKUP_POSVENDA_SAAS_FIX_2026-06-26/` na raiz — zero referências em qualquer outro arquivo do projeto.
- Arquivo acidental `how --stat --summary 3dac68a` na raiz — saída de um comando git redirecionado por engano para um arquivo.
- 5 arquivos de teste triviais na raiz (`teste-credencial.txt`, `teste-final.txt`, `teste-github.txt`, `teste-subir.txt`, `teste_git.txt`).
- Arquivos numerados da raiz (`1_INDEX_MENU_ATUALIZADO.html`, `2_AUTOATENDIMENTO.html`, `3_CONSULTAR_OS.html`, `4_FIREBASE.JSON`), de 2026-06-10, mesma data do bulk import inicial — possível sobreposição com páginas equivalentes já existentes no CRM.
- `CRM/firestore.rules.secure` — rascunho antigo (2026-06-10), não referenciado pelo `firebase.json`.

### 3.4 Dívida técnica (backups manuais soltos, fora de `_BACKUPS/`)

**33 arquivos + 3 pastas de backup** espalhados pelo código ativo, em vez de depender do git:

| Local | Quantidade | Observação |
|---|---|---|
| Raiz do projeto | 3 arquivos | `firebase.json.bak_catalogo_2026-06-12`, `firestore.rules.backup`, `firestore.rules.backup_saas_2026-06-24` |
| `CRM/` raiz | 2 arquivos | `manifest.json.BACKUP_ENV_PERSIST_2026-07-01`, `firestore.rules.BACKUP_2026-07-01` |
| `CRM/shared/` | 14 arquivos + 2 pastas | `favoritos.js` tem **5 backups**, `brand-header.js` tem **6** (4 soltos + 2 em pastas) — os arquivos mais retrabalhados do projeto |
| `CRM/pages/*/` | 11 arquivos + 1 pasta (com subpasta aninhada) | inclui `dashboard/BACKUP_REDESIGN_PAINEL_2026-06-14/`, backup dentro de backup |

O backup mais recente de todo o inventário é de **hoje às 22:00** (`dashboard.js.backup-antes-revert-RBAC-adhoc-2026-07-01`) — a prática de backup manual em vez de commit/branch git segue ativa, inclusive durante a Fase 2 em andamento.

### 3.5 Padrões de código inconsistentes
- Gate de sessão: 12/28 módulos usam `initModulo()`, 16/28 não usam nada além de uma flag visual `localStorage`.
- Listeners Firestore: 32/32 usam `onSnapshot` cru, 0 usam `listener-manager.js`.
- `empresa_id`: 1/37 módulos filtra por `empresa_id`, 36/37 não filtram.

### 3.6 Riscos técnicos

| Risco | Severidade | Detalhe |
|---|---|---|
| Chave de service account em texto puro (`sa-key.json`) na raiz | **Alta** | Não commitada (está no `.gitignore`), mas é segredo vivo em disco local. Recomenda-se rotacionar e mover para fora do diretório do projeto. |
| Divergência entre `firestore.rules` (raiz) e `CRM/firestore.rules` (deployado) | **Alta** | O arquivo da raiz protege coleções (`portal_eventos`, `crm_leads`, `lancamentos_caixa`, `fornecedores`, `estoque_movimentacoes` etc.) que **não existem** no arquivo efetivamente deployado. Se essas coleções forem usadas por módulos ativos, podem estar sem regra de segurança correspondente no arquivo real — **precisa verificação dedicada**, fora do escopo deste levantamento. |
| Isolamento `empresa_id` em apenas 1/37 módulos | **Crítica para o objetivo da própria Fase 3** | Sem isso, o sistema não suporta multiempresa real hoje — maior divergência frente à estimativa original do roadmap. |
| 16/28 módulos sem checagem de sessão no próprio JS | **Média** | Depende inteiramente das Firestore Rules como única barreira; qualquer lacuna nas Rules fica sem segunda camada de defesa no client. |
| Prática contínua de backups manuais (`.backup-*`) em vez de git | **Média** | Confirmado ativo até hoje (22:00). Risco de perder rastreio da versão "real" de um arquivo — `favoritos.js` e `brand-header.js` já têm 5–6 cópias cada. |
| `listener-manager.js` construído e nunca adotado | **Baixa-Média** | Não é bug hoje, mas é dívida arquitetural: ou se adota nos 32 pontos, ou se remove para não confundir desenvolvedores futuros. |

### 3.7 Gargalos de desempenho (Firebase/Firestore — não há React neste projeto)
- **32 listeners `onSnapshot` sem gestão de ciclo de vida centralizada**: risco de listeners não cancelados ao navegar entre páginas, aumentando leituras/custo do Firestore ao longo do tempo. `listener-manager.js` foi construído exatamente para isso após o Recovery de 2026-06-27, mas nunca foi conectado.
- **Ausência de filtro `empresa_id`** em 36 módulos: hoje não é problema de performance (empresa única em produção), mas se uma segunda empresa for onboardada antes da Fase 3, queries sem filtro no client tendem a trazer o volume total da coleção, dependendo só da Rule `isMaster()` como filtro — o custo cresce proporcionalmente ao total de empresas, não à empresa do usuário logado.

### 3.8 Dependências desatualizadas ou desnecessárias
- Raiz: `firebase@12.14.0`, `firebase-admin@14.1.0` — versões instaladas coincidem com o `package.json`. `npm outdated` **não pôde ser executado** neste ambiente de auditoria (`npm`/`node` indisponíveis no sandbox) — recomenda-se rodar manualmente.
- `_runtime_audit/package.json`: `firebase@^10.8.0` — 2 major versions atrás da raiz. Se esses scripts ainda leem/escrevem no mesmo Firestore de produção, há risco de comportamento divergente entre SDKs.
- `CRM/` não tem `package.json` — esperado, não é lacuna (confirma "sem build step").
- Nenhuma referência real a `node_modules/` em código servido ao navegador — os únicos matches são regex de exclusão de diretório em scripts de auditoria, não imports reais.

---

## 4. Classificação por prioridade, esforço e impacto

| # | Item | Prioridade | Esforço | Impacto |
|---|---|---|---|---|
| 1 | Rotacionar/proteger `sa-key.json` | **Alta** | Baixo | Alto (segurança) |
| 2 | Reconciliar `firestore.rules` (raiz) vs `CRM/firestore.rules` | **Alta** | Médio | Alto (pode revelar coleções sem proteção) |
| 3 | Corrigir bug de "Perfil" travado em "—" (`usuarios-permissoes.js`) | **Alta** | Baixo | Médio-Alto (pendência formal da Fase 1) |
| 4 | Corrigir premissas do `MASTER_ROADMAP.md` (catálogo duplicado, `modulo-guard.js`, módulos inexistentes) | **Alta** | Baixo | Alto (evita retrabalho de planejamento) |
| 5 | Consolidar fonte única de `empresa_id` (`tenant.js` vs `kernel.js`) | **Média** | Médio | Médio-Alto |
| 6 | Padronizar `initModulo()` nos 16 módulos sem gate de sessão | **Média** | Médio-Alto | Alto (consistência/segurança) |
| 7 | Adotar `listener-manager.js` nos 32 pontos de `onSnapshot`, ou remover | **Média** | Médio | Médio (performance/memory) |
| 8 | Limpar 33 arquivos + 3 pastas de backup soltos fora de `_BACKUPS/` | **Média** | Baixo | Médio (higiene/clareza) |
| 9 | Rollout de `empresa_id` módulo a módulo (36 módulos restantes) | **Alta** (mas depende de 5 e 6) | Muito alto | Crítico (objetivo central da Fase 3) |
| 10 | Organizar raiz do projeto (docs/, arquivos de teste, pasta órfã, arquivo de erro git) | **Baixa** | Baixo | Baixo |
| 11 | Rodar `npm outdated`, avaliar upgrade de dependências e destino de `_runtime_audit/` | **Baixa** | Baixo | Baixo |

## 5. Dependências entre tarefas

- **Item 9 (rollout de `empresa_id`) depende de 5** (fonte única definida) **e de 6** (gate de sessão padronizado) — propagar `empresa_id` sem antes resolver qual fonte é oficial repetiria a inconsistência atual em escala.
- **Item 2 (reconciliar Firestore Rules) deveria anteceder o item 9** — não faz sentido isolar dados por `empresa_id` em coleções cuja regra de segurança ainda não está clara/consolidada.
- **Item 4 (corrigir o roadmap) não depende de nada e deveria ser feito primeiro** — evita que o planejamento de sprints futuros continue partindo de premissas já invalidadas por este documento.
- **Itens 1, 3, 8, 10, 11 são independentes entre si** e podem ser executados em paralelo, a qualquer momento, sem esperar decisões arquiteturais maiores.
- **Item 7 (listener-manager) é independente de `empresa_id`**, mas faz sentido combiná-lo com o item 6 (padronização de inicialização), já que ambos tocam o boilerplate de topo de cada módulo.
- Todo o bloco de prioridade Alta/Média (itens 1–8) é pré-requisito conceitual do item 9, que é o entregável que efetivamente cumpre o objetivo descrito na Fase 3 do `MASTER_ROADMAP.md`.

## 6. Recomendações técnicas

1. Tratar os itens 1–4 (segurança da chave, Rules divergentes, bug de perfil, correção do roadmap) como uma "Fase 3.0" de acertos pontuais, sem esperar o encerramento formal da Fase 2 — são de baixo risco de regressão e não tocam módulos de negócio em produção.
2. Antes de iniciar o rollout de `empresa_id`, formalizar por escrito (mesmo que numa seção nova deste documento ou do roadmap) qual é a fonte oficial: `shared/tenant.js` ou o mecanismo de `kernel.js`. Dado que `tenant.js` já tem API mais completa (`isMasterAdmin()`, `hasModulo()`), a recomendação técnica é migrar `caixa.js` para `tenant.js` em vez do caminho inverso, para não manter dois padrões.
3. Ao padronizar `initModulo()`, aproveitar o mesmo PR/commit para trocar `onSnapshot` cru por `listener-manager.js` nos módulos tocados — evita duas rodadas de edição no mesmo arquivo.
4. Reescrever a lista de "módulos de menor risco para começar" do roadmap: como `garantias`, `venda-rapida` e `chips` (como módulo próprio) não existem, sugerem-se como ponto de partida real `catalogo`, `acaodasemana` e `estrategia` — módulos mais simples e isolados hoje existentes — antes dos de maior superfície (`clientes`, `crm-comercial`, `central-alertas`, `financeiro`, `os`).
5. Manter o processo de 8 etapas já validado na Fase 2 (Planejamento → Implementação → Testes → Homologação → Correções → TECHDOC → Aprovação → Liberação) para cada módulo do rollout de `empresa_id` — não há motivo para relaxar esse processo na Fase 3.
6. Tratar a limpeza de backups soltos (item 8) como parte do mesmo commit que padroniza cada módulo, não como uma tarefa isolada de "faxina" — reduz o risco de a limpeza acontecer separada do contexto que a justifica.

## 7. Roadmap sugerido para execução da Fase 3

**Curto prazo (Fase 3.0 — acertos pontuais, podem começar já, independente do fim da Fase 2):**
- Rotacionar/proteger `sa-key.json`.
- Investigar e reconciliar `firestore.rules` (raiz) vs `CRM/firestore.rules`.
- Corrigir o bug de "Perfil" travado em "—".
- Atualizar `MASTER_ROADMAP.md` com as correções de premissa deste levantamento.

**Médio prazo (Fase 3.1 — base arquitetural, pré-requisito do rollout em massa):**
- Definir e migrar para a fonte única de `empresa_id`.
- Padronizar `initModulo()` nos 16 módulos pendentes, já combinando com a adoção de `listener-manager.js`.
- Limpar os 33 arquivos + 3 pastas de backup soltos fora de `_BACKUPS/`.

**Médio-longo prazo (Fase 3.2 — objetivo central da Fase 3):**
- Rollout de `empresa_id` módulo a módulo, na ordem revisada (`catalogo`, `acaodasemana`, `estrategia` → demais módulos → `clientes`/`crm-comercial`/`central-alertas`/`financeiro`/`os` por último), seguindo o processo de 8 etapas da Fase 2.

**Longo prazo (Fase 3.3 — organização final, sem risco funcional):**
- Organizar a raiz do projeto (mover documentação histórica para `docs/`, remover arquivos de teste, remover pasta órfã e arquivo de erro de comando git).
- Rodar `npm outdated` e avaliar upgrade de dependências; decidir o destino de `_runtime_audit/` (manter atualizado ou arquivar).

---

## Metodologia

Levantamento realizado por duas auditorias somente-leitura independentes e paralelas em 2026-07-01, cobrindo: grep/análise de `empresa_id` e `initModulo()` em todos os módulos de `CRM/pages/`; leitura de `shared/tenant.js`, `shared/listener-manager.js`, `shared/central-modulos.js`, `CRM/scripts/kernel.js`; inventário de arquivos de backup fora de `_BACKUPS/`; comparação de `firestore.rules` (raiz) vs `CRM/firestore.rules`; e inspeção de `package.json` em todas as subpastas do projeto.

## ✅ Confirmação de que nenhuma alteração foi realizada

Durante este levantamento **nenhum arquivo de código-fonte, configuração, Firestore Rules ou banco de dados foi modificado, criado ou removido**, com uma única exceção: a criação deste próprio documento de análise (`plans/FASE_3_LEVANTAMENTO.md`). Nenhuma refatoração foi executada. O `MASTER_ROADMAP.md` e todos os demais arquivos do projeto permanecem exatamente como estavam antes deste levantamento.
