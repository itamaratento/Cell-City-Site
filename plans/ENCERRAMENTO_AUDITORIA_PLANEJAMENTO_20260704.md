# 🏁 ENCERRAMENTO DA FASE DE AUDITORIA E PLANEJAMENTO (2026-07-04)

> **Natureza deste documento:** encerramento formal do ciclo de auditoria/planejamento aberto em 2026-07-04 (`AUDITORIA_GERAL_20260704.md` → `AUDITORIA_EXECUTIVA_GERAL_20260704.md` → `PLANO_DIRETOR_PROXIMA_FASE_20260704.md`). Confere consistência entre os documentos estratégicos, revisa a segurança do que será publicado, define oficialmente a ordem das próximas sprints, classifica a documentação do projeto e prepara — sem implementar — a próxima sprint. Nenhuma funcionalidade nova foi implementada para produzir este documento.
> Achados de segurança com detalhe explorável seguem redigidos aqui — ver `plans/AUDITORIA_GERAL_20260704_INTERNO.md` (arquivo local, `.gitignore`d, nunca publicado) para o registro técnico completo.

---

## ETAPA 1 — Revisão Final da Documentação Estratégica

Documentos revisados: `CRM/TECHDOC.md`, `MASTER_ROADMAP.md`, `PROXIMA_ETAPA.md`, `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md`.

### 1.1 Consistência entre os documentos

| Ponto verificado | Resultado |
|---|---|
| Estado do RBAC (Fase 2) | ✅ Consistente nos 4 documentos: Sprint 1/2 aprovados, Sprint 3 implementado e aguardando homologação manual, Sprint 4/5 não iniciados |
| Estado de ambientes DEV/PROD | ✅ Consistente: frontend separado (2026-07-01/03), backend Firebase ainda único, freeze de infraestrutura em vigor |
| Cota Firestore | ⚠️ **Divergência encontrada e corrigida nesta etapa** — `PROXIMA_ETAPA.md` (não atualizado desde 07-02) ainda registrava a cota Spark como risco ativo diário; `TECHDOC.md` §14 e as auditorias de 07-04 confirmam que a produção já migrou para Blaze em 2026-07-04 (junto com a criação das Cloud Functions). Corrigido na Etapa "Preparação"/atualização de `PROXIMA_ETAPA.md` abaixo. |
| Prioridade do próximo passo | ⚠️ **Divergência de redação, não de fato** — `MASTER_ROADMAP.md` (parágrafo final, texto de 07-02) ainda apontava a homologação do Sprint 3 como "o próximo passo formalmente autorizado", sem mencionar o achado crítico do Portal/OS (posterior, de 07-04). `PLANO_DIRETOR_PROXIMA_FASE_20260704.md` já cobre isso corretamente. `MASTER_ROADMAP.md` foi atualizado nesta etapa para refletir a nova prioridade (ver Etapa 3). |
| Isolamento `empresa_id` / multiempresa | 🔴 **Inconsistência estrutural encontrada** — `MASTER_ROADMAP.md` Fases 3 e 6 descrevem um trabalho pendente de "completar o isolamento por `empresa_id`" e tratam a infraestrutura multiempresa (`shared/tenant.js`, Central SaaS) como parcialmente ativa e "restaurada em 2026-06-27". As duas auditorias de 07-04 confirmam o oposto: o multiempresa foi **revertido** (não restaurado) no rollback de 2026-06-27, o sistema é single-tenant, e `shared/tenant.js` é código morto sem nenhum módulo importando. Esse trecho do Master Roadmap descreve uma arquitetura que não existe mais no código atual. **Não reescrito nesta etapa** (redesenhar a Fase 3/6 é uma decisão de arquitetura de longo prazo, fora do escopo de "encerrar a auditoria") — sinalizado com aviso explícito dentro do próprio `MASTER_ROADMAP.md` (ver Etapa 3) e registrado aqui como pendência para revisão dedicada. |
| Módulos concluídos/quebrados/pendentes | ✅ Consistente entre as 3 auditorias e este encerramento |

### 1.2 Prioridades

Alinhadas entre os 4 documentos após a atualização desta etapa: Sprint 0 (segurança Portal/OS) e homologação do Sprint 3 do RBAC são os dois itens que disputam "o que vem primeiro"; todo o resto do roadmap (`MASTER_ROADMAP.md` Fases 3-6) continua atrás da conclusão da Fase 2.

### 1.3 Estado dos módulos e marcos

Sem divergência nova em relação ao já consolidado em `PLANO_DIRETOR_PROXIMA_FASE_20260704.md` Etapa 1. Os marcos M1-M6 de `MASTER_ROADMAP.md` continuam válidos como visão de longo prazo; nenhum marco foi alcançado ou invalidado desde a última revisão.

---

## ETAPA 2 — Revisão de Segurança da Documentação Pública

Escopo: os 2 documentos ainda não commitados (`plans/AUDITORIA_EXECUTIVA_GERAL_20260704.md`, `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md`) — `plans/AUDITORIA_GERAL_20260704.md` já está commitado e publicado desde antes desta sessão, não pode ser revisado antes da publicação (já ocorreu), só citado como referência.

### Achados desta revisão

- **`AUDITORIA_EXECUTIVA_GERAL_20260704.md`**: mantém a política de redação já estabelecida (mecanismo técnico do achado crítico redigido, remete ao registro interno). Nenhum caminho interno, credencial, ou detalhe explorável novo encontrado. **Aprovado para publicação sem alteração.**
- **`PLANO_DIRETOR_PROXIMA_FASE_20260704.md`**: encontrados **2 trechos que confirmavam, de forma mais explícita do que a auditoria de origem permitia, o mecanismo atual da falha do Portal/OS** — a tabela de roadmap (item 0) e a seção de preparação da próxima sprint descreviam textualmente que "a leitura de `os/{osId}` hoje é irrestrita"/"expõe dados sensíveis a qualquer visitante". Isso é mais específico do que o "categoria/impacto, sem o como" que a própria auditoria original definiu como política. **Corrigido nesta sessão** (antes de qualquer commit): ambos os trechos foram reescritos para descrever só o resultado esperado, remetendo o estado atual ao registro interno. Nenhum outro trecho do documento (débitos técnicos, riscos, organização do repositório) foi considerado sensível o suficiente para redação — o nível de detalhe usado (nomes de coleções sem regra, nomes de arquivo de backup) já é equivalente ao que a própria `AUDITORIA_GERAL_20260704.md` (já pública) expõe, então não constitui informação nova exploravel.
- **Estratégias de mitigação**: revisadas com o mesmo critério — descrever *que* um gate de autenticação será adicionado é normal e não differential (é o desfecho esperado, visível de qualquer forma após o deploy); o que foi removido foi a confirmação explícita de *como* a falha se comporta hoje.

### Conclusão da Etapa 2

**Os dois documentos estão aptos para commit/publicação após as correções acima.** Nenhuma credencial, chave, caminho de exploração ou informação operacional sensível nova foi encontrada além do que as duas auditorias originais já haviam decidido publicar.

---

## ETAPA 3 — Consolidação do Roadmap

**A partir deste documento, a ordem abaixo passa a ser a referência oficial para o desenvolvimento**, substituindo a recomendação em aberto ("a decisão final é do dono") que os 3 documentos anteriores deixaram registrada.

### 3.1 Ordem oficial das próximas sprints

| Ordem | Sprint/Item | Prioridade | Dependências | Critério de aceite (resumo) |
|---|---|---|---|---|
| **1** | Segurança do Portal do Cliente / OS pública | 🔴 P0 | Nenhuma técnica; autorização do dono (toca Auth+Rules, `CLAUDE.md` §1) | Ver Etapa 6 |
| 2 | Homologação formal do Sprint 3 RBAC (Estoque+Caixa) | 🔴 P0 | Nenhuma | 12/12 cenários `jsdom` revalidados em navegador real; aprovação registrada em TECHDOC §7.3 |
| 3 | Sprint 4 RBAC — Financeiro | 🟠 P1 | Item 2 aprovado | `shared/permissoes.js` integrado; TECHDOC §7.4 |
| 4 | Correção dos 3 módulos quebrados (Análise, Catálogo, Central de Organização) | 🟠 P1 | Nenhuma entre si | Cada módulo volta a ler/gravar dado real |
| 5 | Regra para as 2 subcoleções sem proteção | 🟠 P1 | Nenhuma | Regra publicada e testada via emulador |
| 6 | Sprint 5 RBAC — OS | 🟠 P1 | Itens 2-3 aprovados | TECHDOC §7.5, atenção a `runAutomacoesOS()` |
| 7 | Higiene de segurança restante (chave hardcoded, PIN texto puro, publicação de `_BACKUPS`/`plans`, SA key) | 🟠 P1 | Nenhuma entre si | Ver `PLANO_DIRETOR` Etapa 3, itens 6-9 |
| 8 | Fase 3 do `MASTER_ROADMAP.md` (Consolidação da Arquitetura) | 🟡 P2 | Itens 1-6 concluídos | Ver ressalva de revisão na Etapa 1.1 acima — Fase 3 precisa de revisão de escopo antes de iniciar (empresa_id/multiempresa desatualizado) |

**Por que o item 1 vem antes do item 2**, decisão explícita desta etapa (antes deixada em aberto): dado real de cliente exposto publicamente é um incidente ativo, não uma pendência de processo — supera em urgência qualquer item que só destrave roadmap interno, mesmo sendo de menor esforço. Esta é a definição oficial; a homologação do Sprint 3 (item 2) continua como o item de menor esforço/maior desbloqueio da fila, e pode ser conduzida em paralelo por não competir pelos mesmos componentes críticos (Sprint 3 é Estoque/Caixa; o item 1 é Auth/Portal) — desde que a regra do projeto de "nunca mais de 1 módulo por vez" seja interpretada aqui como "1 módulo de *negócio* por vez", já que a correção de segurança do item 1 não é, em si, um módulo de produto novo.

### 3.2 Marcos desta fase

- **M0 (novo):** Sprint 1 (segurança Portal/OS) aprovada e em produção → elimina o único incidente ativo de dados reais expostos.
- Os marcos M1-M6 já existentes em `MASTER_ROADMAP.md` continuam válidos e não foram alterados.

---

## ETAPA 4 — Organização da Documentação

**Nenhum arquivo foi excluído nesta etapa.** Classificação recomendada, para decisão/execução futura do dono.

### 4.1 Oficiais (referência ativa de estado/processo)

| Documento | Papel |
|---|---|
| `CRM/TECHDOC.md` | Documentação técnica corrente |
| `MASTER_ROADMAP.md` | Roadmap de longo prazo (Fases 1-6) — atualizado nesta etapa |
| `PROXIMA_ETAPA.md` | Estado imediato/continuidade entre sessões — atualizado nesta etapa |
| `CLAUDE.md` | Regras permanentes de desenvolvimento |
| `HISTORICO_PROJETO.md` | Ledger acumulativo (nunca reescrever, só adicionar) |
| `GUIA_OPERACAO_AMBIENTES.md`, `GUIA_ROLLBACK.md`, `GUIA_MANUTENCAO.md` | Guias operacionais |
| `README.md` | Mínimo, ativo |
| `plans/AUDITORIA_GERAL_20260704.md`, `plans/AUDITORIA_EXECUTIVA_GERAL_20260704.md`, `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md`, este documento | Ciclo de auditoria/planejamento corrente |
| `plans/AUDITORIA_CONTINUA.md` | Log de auditoria automática por commit (mecanismo próprio, distinto deste ciclo manual — não tocado) |
| `plans/BACKLOG.md` (BL-001 a BL-005 abertos; BL-006 corrigida) | Backlog formal ativo |
| `plans/SEPARACAO_AMBIENTES_DEV_PROD.md`, `plans/HOMOLOGACAO_SEPARACAO_AMBIENTES.md` | Plano de separação de backend, aguardando autorização — ainda não executado |
| `plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md` | Plano de performance, ainda não implementado |
| `plans/fase2-sprint3-estoque-caixa-rbac.md` | Sprint ainda ativo (aguardando homologação) |
| `plans/RELATORIO_COTA_FIRESTORE_20260702.md` | Recomendação já executada (migração para Blaze em 07-04) — manter como registro da decisão, mas sem ação pendente |
| `plans/DECISAO_NEGOCIO_OS_FINANCEIRO.md` | Estudo de apoio a decisão de negócio — status da decisão não confirmado nesta consolidação; recomenda-se checar com o dono se já foi decidido, para reclassificar como Histórico se sim |

### 4.2 Históricos (registro de ciclo concluído, manter como está)

`plans/CONFERENCIA_FINAL_COLECOES.md`, `plans/ENCERRAMENTO_AUDITORIA.md`, `plans/EXECUCAO_RISCOS_CRITICOS_INTERNO.md (interno, não versionado desde 2026-07-06)`, `plans/PLANO_ACAO_RISCOS_CRITICOS_INTERNO.md (interno, não versionado desde 2026-07-06)`, `plans/VALIDACAO_FUNCIONAL_RISCOS.md`, `plans/FASE_3_LEVANTAMENTO.md`, `plans/FASE_3_VALIDACAO.md`, `plans/FASE_4_LEVANTAMENTO.md`, `plans/FASE_4_VALIDACAO.md`, `plans/FASE2_PRONTIDAO_SEPARACAO_AMBIENTES.md`, `plans/REFATORACAO_DASHBOARD_ETAPA1_MAPA.md`, `plans/fase2-sprint1-dashboard-rbac.md`, `plans/fase2-sprint2-crm-agenda-rbac.md`, `6_INSTRUCOES_INTEGRACAO_CRM.md` (já autoetiquetado), `ARQUITETURA_PORTAL_CLIENTE.md` (design pré-implementação; Portal já existe e está documentado no TECHDOC), `AUTOATENDIMENTO_IMPLEMENTACAO.md`, `SUMARIO_ARQUIVOS_GERADOS.md`.

### 4.3 Arquivados (candidatos a mover para pasta histórica ou receber banner de aviso — recomendação, sem ação)

`plans/FAVORITOS_INTELIGENTES.md`, `plans/MELHORIAS_OS.md`, `plans/MELHORIA_CONTINUAR_PAREI.md`, `plans/REORDENAR_FAVORITOS_DND.md`, `plans/fase2-portal-admin.md` (todos de 2026-06-10, anteriores ao rollback do multiempresa — já recomendado em `PLANO_DIRETOR` Etapa 2.4).
`5_INSTRUCOES_DEPLOY_GITHUB_FIREBASE.md` — candidato adicional identificado nesta etapa: título e escopo (deploy via Firebase Hosting) colidem com a proibição atual do Firebase Hosting; recomenda-se o mesmo banner de aviso já aplicado a `6_INSTRUCOES_INTEGRACAO_CRM.md`, apontando para `GUIA_OPERACAO_AMBIENTES.md`.

### 4.4 Internos (nunca publicados)

`plans/AUDITORIA_GERAL_20260704_INTERNO.md` — único arquivo desta categoria confirmado nesta sessão (`.gitignore` linha 79, convenção `_INTERNO.md`).

---

## ETAPA 5 — Aprovação do Planejamento (Relatório Final)

- ✅ **A fase de auditoria está encerrada.** As três frentes de levantamento (`AUDITORIA_GERAL_20260704.md`, `AUDITORIA_EXECUTIVA_GERAL_20260704.md`, `PLANO_DIRETOR_PROXIMA_FASE_20260704.md`) e esta consolidação final não deixam nenhuma pergunta de auditoria em aberto — as únicas pendências restantes são de **execução** (corrigir, homologar, decidir), não de **investigação**.
- ✅ **A documentação estratégica está consistente**, com 2 divergências reais encontradas e corrigidas nesta etapa (cota Firestore desatualizada em `PROXIMA_ETAPA.md`; prioridade do próximo passo desatualizada em `MASTER_ROADMAP.md`) e 1 inconsistência estrutural sinalizada, mas deliberadamente não resolvida agora por exigir decisão de arquitetura própria (empresa_id/multiempresa em `MASTER_ROADMAP.md` Fases 3/6 — ver Etapa 1.1).
- ✅ **O roadmap está atualizado** — `MASTER_ROADMAP.md` e `PROXIMA_ETAPA.md` refletem o estado de 2026-07-04 (ver Etapas 3 e "Preparação" abaixo).
- **Recomendação da próxima sprint:** Sprint 1 = Segurança do Portal do Cliente/OS pública (ver Etapa 3.1 e Etapa 6). É a definição oficial deste encerramento — a alternativa de menor esforço (homologação do Sprint 3 RBAC) deixa de ser apresentada como opção equivalente e passa a ser o item 2 da fila oficial, podendo correr em paralelo por não compartilhar componentes críticos.
- **Riscos remanescentes:** os mesmos 9 riscos ranqueados em `PLANO_DIRETOR_PROXIMA_FASE_20260704.md` §1.7 continuam válidos e não foram alterados por este encerramento — a exposição do Portal/OS continua sendo o risco 🔴 de maior severidade até a Sprint 1 ser concluída.
- **Pendências conhecidas:** as 15 linhas do roadmap oficial (Etapa 3.1) mais a revisão de escopo da Fase 3 do `MASTER_ROADMAP.md` (empresa_id/multiempresa) mais a organização do repositório detalhada em `PLANO_DIRETOR` Etapa 5 (branches, tags, arquivos de backup soltos).

**Declaração de encerramento:** com as correções aplicadas nesta etapa (redação de segurança do `PLANO_DIRETOR`, atualização de `MASTER_ROADMAP.md`/`PROXIMA_ETAPA.md`, registro em `HISTORICO_PROJETO.md`), **a fase de auditoria e planejamento está formalmente encerrada.** O projeto está apto para iniciar a Sprint 1, mediante autorização explícita do dono para o item que toca Auth/Rules (`CLAUDE.md` §1) — este documento prepara a sprint (Etapa 6), não a inicia.

---

## ETAPA 6 — Preparação da Próxima Sprint (Sprint 1 — não iniciada)

> Reaproveita e formaliza o conteúdo já redigido em `PLANO_DIRETOR_PROXIMA_FASE_20260704.md` Etapa 7, agora como a definição oficial (não mais uma proposta com duas alternativas equivalentes). **Nenhuma implementação foi iniciada.**

**Objetivo da sprint:** eliminar a exposição de dados reais de clientes associada ao fluxo OS/Portal do Cliente (achado crítico de `AUDITORIA_GERAL_20260704.md`), sem regredir o autoatendimento do cliente legítimo.

**Escopo:** reforçar o controle de acesso ao painel administrativo do Portal do Cliente e às regras de leitura associadas ao fluxo de OS consumido pelo Portal. O mecanismo exato da falha está apenas no registro interno; esta preparação trata só do resultado esperado.

**Entregas previstas:**
- Gate de autenticação real no painel administrativo do Portal.
- Regra de Firestore revisada para os documentos de OS lidos pelo Portal (e por `garantia.html`, se aplicável).
- Nova seção no `CRM/TECHDOC.md`, seguindo o padrão já usado em §6.12-6.14 e §16.

**Critérios de aceite:**
- Painel admin do Portal exige login válido — acesso anônimo deve falhar.
- Cliente legítimo continua acessando sua própria OS sem regressão no autoatendimento.
- Testes de Firestore Rules via emulador (`@firebase/rules-unit-testing`) cobrindo os 3 perfis (cliente legítimo, painel autenticado, visitante anônimo) antes do deploy.
- Zero erro de console, zero regressão nos fluxos já documentados no TECHDOC.

**Estratégia de testes:** harness/emulador local reproduzindo os 3 perfis de acesso, seguindo o mesmo padrão `jsdom`+mocks já validado nos sprints de RBAC anteriores.

**Estratégia de homologação:** testes no emulador → verificação do release ativo das Rules via `firebaserules.googleapis.com` (nunca só o Console, regra permanente desde a Fase 1) → homologação manual em navegador real → aprovação formal do dono → só então promoção a produção, seguindo o processo de 8 etapas já padronizado no projeto.

**Autorização necessária para iniciar:** esta sprint toca Autenticação e Firestore Rules — por `CLAUDE.md` §1, requer autorização explícita do dono antes de qualquer alteração de código. Este documento prepara e recomenda; não substitui essa autorização.

---

## Resultado desta etapa

- ✅ Documentação estratégica consolidada (`TECHDOC.md`, `MASTER_ROADMAP.md`, `PROXIMA_ETAPA.md`, `PLANO_DIRETOR_PROXIMA_FASE_20260704.md` revisados e alinhados).
- ✅ Roadmap oficial atualizado e com ordem de sprints definida (Etapa 3.1).
- ✅ Plano diretor aprovável (pendente só da leitura/aprovação formal do dono, conforme Etapa 5).
- ✅ Prioridades definidas, sem ambiguidade remanescente sobre "o que vem primeiro".
- ✅ Documentação pública revisada quanto a segurança antes do commit (Etapa 2).
- ✅ Projeto preparado para iniciar a Sprint 1 de forma organizada e rastreável, mediante autorização.

---

*Encerramento conduzido em 2026-07-04. Nenhum código, Firestore Rule, branch ou tag foi alterado. Alterações nesta etapa: redação de 2 trechos em `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md` (ainda não commitado), atualização de `MASTER_ROADMAP.md` e `PROXIMA_ETAPA.md`, novo registro em `HISTORICO_PROJETO.md`, e este documento.*
