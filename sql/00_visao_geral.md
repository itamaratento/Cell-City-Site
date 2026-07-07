# Preparação para SQL — Visão Geral e Justificativas (2026-07-07)

> **Natureza deste documento e de todo o diretório `sql/`:** planejamento e modelagem. Nenhum banco SQL foi instalado, nenhum ORM foi adicionado, nenhum dado foi migrado, nenhuma linha de código funcional do CRM foi alterada. Segue a mesma diretriz permanente já registrada para esta iniciativa: "preparar não é migrar" (ver `CRM/TECHDOC.md` §22.1, memória do projeto `feedback-escopo-preparacao-arquitetura`).
> Pré-requisito de leitura: `COLECOES_FIRESTORE.md` (raiz) — catálogo completo das coleções Firestore, fonte única desta modelagem.

---

## 1. Por que agora, e por que só modelagem

A Camada Repository (`CRM/repositories/*.repository.js`, `CRM/TECHDOC.md` §22) já isola ~85% do acesso a dados do Firestore atrás de uma interface uniforme (`getById`, `list`, `create`, `set`, `update`, `remove`, `onChange`, `newId`, `onDocChange`). Essa camada reduz o custo de uma eventual migração futura de banco — mas até agora (`project-repository-layer-firestore-20260705`, memória do projeto) o preparatório "do lado do banco" continuava em 0%: nenhuma modelagem relacional, nenhum banco escolhido, nenhum script `.sql`. Esta entrega fecha essa lacuna **só no papel**: um destino relacional completo e documentado, para que uma decisão de migração futura (se e quando vier a ser tomada) comece de um projeto pronto, não de uma investigação do zero.

**Decisão explícita, redundante com o Firestore continuando oficial:** nada neste diretório está conectado a nenhum sistema em produção. `CRM/repositories/*.js` continua falando só com o Firestore. Este é, deliberadamente, um exercício de arquitetura em paralelo.

---

## 2. Banco SQL recomendado: PostgreSQL 15+ (Cloud SQL for PostgreSQL)

### 2.1 Alternativas consideradas

| Opção | Avaliação |
|---|---|
| **PostgreSQL** (Cloud SQL) | ✅ Recomendado — ver justificativa abaixo |
| MySQL / Cloud SQL for MySQL | Viável tecnicamente, mas sem vantagem sobre Postgres para este projeto e com suporte a JSON/array historicamente mais fraco (relevante — ver §3, vários campos do Firestore são arrays/objetos) |
| Firestore + BigQuery (mantendo NoSQL, só espelhando para analytics) | Resolve relatórios pesados sem migrar o operacional, mas não é "SQL relacional" no sentido pedido nesta tarefa (BigQuery não tem PK/FK/transação como um RDBMS) — mencionado aqui só para registrar que foi considerado e descartado como resposta a *esta* tarefa especificamente |
| SQLite | Sem caso de uso — é embarcado, não serve a múltiplos clientes concorrentes (CRM já hoje tem vários usuários simultâneos) |
| CockroachDB / bancos distribuídos | Overkill de operação para o volume atual do projeto (~45 mil linhas de JS, sistema de uma empresa só, sem indício de necessidade de escala horizontal) |

### 2.2 Por que PostgreSQL, especificamente

1. **Mesma nuvem do projeto.** O Firebase do Cell City já roda inteiramente no Google Cloud (`southamerica-east1`, confirmado em `CRM/firestore.indexes.json`/console). Cloud SQL for PostgreSQL é o caminho de menor atrito operacional: mesmo IAM, mesma VPC, mesmo faturamento consolidado, sem introduzir um segundo provedor de nuvem.
2. **JSONB nativo e maduro.** O Firestore é, por natureza, semiestruturado — vários campos são arrays de objeto (`os.timeline`, `os.photos`, `agenda.notas`) ou objetos de estrutura solta sem contrato formal nas Rules (`alarme_config.config`, `usuarios_preferencias.valor`). O suporte de JSONB do Postgres (indexável via GIN, consultável com operadores nativos) permite migrar esses campos sem forçar uma normalização completa no primeiro momento — ver §3 para onde isso foi de fato usado no modelo.
3. **Extensões relevantes já maduras.** `pg_trgm` (busca por nome/telefone parecida com o que `campanhas.js`/`clientes.js` já fazem no client hoje), `pgcrypto` (para hash de PIN, corrigindo o débito técnico atual de `config/pin` em texto puro — ver `sql/schema/08_config_auditoria.sql`).
4. **CHECK constraints expressivos.** Praticamente todo campo do Firestore com uma lista fixa de valores (`os.status`, `crm_leads.status`, etc.) hoje só é validado no client — no modelo relacional isso vira `CHECK` de banco, uma camada de integridade que o Firestore não tem hoje (Firestore Rules valida *acesso*, não *forma* do dado, salvo esforço manual em cada regra).
5. **Sem custo de licença, ecossistema de migração maduro** (pgloader, ferramentas de CDC como Debezium, relevantes para a estratégia de coexistência do §Migração).
6. **Já é a escolha "default" de outras iniciativas SQL adjacentes já mencionadas no projeto** (nenhuma bloqueante, mas os testes de Firestore Rules já usam Node — Postgres com driver `pg`/`postgres.js` mantém a mesma linguagem, sem exigir uma segunda stack de runtime).

---

## 3. Decisão de modelagem: arrays/objetos → tabela-filha vs. JSONB

O Firestore não distingue "lista de valores simples" de "lista de entidades" — os dois são só um array no documento. Na modelagem relacional, cada ocorrência foi decidida caso a caso:

**Viraram tabela-filha (com FK + `ordem`, ganhando índice e integridade real):**
- `os.photos`, `os.timeline`, `os.entryChecklist`, `os.exitChecklist`, `os.patternSequence`
- `agenda.notas`, `agenda.recorrenciaExcluir`
- `comandos.blocos`
- `chips_cadastros.historico`
- `favoritos_usuarios.itens`, `tarefas_semana.tarefas`
- `central_organizacao.itens`
- `crm_leads.patternSequence`

Critério: são listas de **entidades com identidade própria ou consultadas individualmente** (ex.: "a 3ª foto da OS", "o evento de timeline de tal data") — merecem linha própria, índice e (quando fizer sentido) constraint.

**Permaneceram JSONB (documento embutido, sem tabela própria):**
- `empresas.feature_flags` — conjunto dinâmico de flags booleanas, sem PK própria, sem necessidade de índice individual.
- `usuarios_preferencias.valor` — estrutura livre por `chave` (layout/módulos/home), definida só no código da UI, não num contrato de Rules — tabelar isso hoje seria inventar um contrato que não existe.
- `alarme_config.config` — mesma razão.
- `cc_lixeira.registro_snapshot` — é literalmente um snapshot de backup para restauração, não um dado a ser consultado por campo.
- `config_impressao.loja`/`.garantias`, `config_migracao_comandos_v1.log` — dados de exibição/relatório, sem consulta relacional own.

Critério inverso: estrutura **sem identidade própria, sem necessidade de consulta por sub-campo, ou puramente de exibição/snapshot**. Forçar uma tabela aqui adicionaria JOINs sem nenhum ganho de consulta real.

---

## 4. O que este modelo NÃO assume

- **Não assume que o sistema virou multiempresa de verdade.** `empresas`/`usuarios.empresa_id` foram modelados porque o campo existe no Firestore hoje (vestígio do SaaS revertido em 2026-06-27, ver `COLECOES_FIRESTORE.md` §13), não porque a modelagem esteja reabrindo essa decisão de produto. Nenhuma FK aqui é `NOT NULL` por causa disso.
- **Não assume que toda coleção documentada em `COLECOES_FIRESTORE.md` precisa de tabela.** As coleções da seção "Legadas/Em Desuso" (§21 — `estoque`, `historico_diario`, `historico_semanal`, `historico_mensal`, `resumo_live`, `acoes_semana`, `posvenda_rastreamento`, `produtos`, mais `clients`/`orders`) **não foram modeladas** — não têm consumidor de código hoje, modelar seria trabalho morto. Se algum dia ganharem consumidor real, entram numa revisão futura deste modelo.
- **Não decide a favor da migração.** Esta entrega não recomenda migrar agora — só garante que, se a decisão vier a ser tomada, o "quanto vai custar" deixa de ser uma incógnita.

---

## 5. Sumário quantitativo

| Métrica | Valor |
|---|---|
| Coleções Firestore ativas modeladas | 54 (todas as ativas de `COLECOES_FIRESTORE.md`, exceto a seção de legado) |
| Tabelas SQL resultantes | 75 |
| Tabelas-filhas de array/lista | 21 |
| Relacionamentos (FK) totais | 62 |
| Tabelas com CHECK de enum (paridade com validação hoje só no client) | 31 |
| Arquivos de schema (`sql/schema/*.sql`) | 8, organizados por domínio (mesma divisão de `COLECOES_FIRESTORE.md`) |

Ver `sql/01_der_mestre.md` para o diagrama, `sql/02_migracao_estrategia.md` para a estratégia de execução (não executada) e `sql/03_repository_adapter.md` para como cada `*.repository.js` se conectaria ao SQL no futuro.
