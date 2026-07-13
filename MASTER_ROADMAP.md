# 🗺️ MASTER_ROADMAP.md — Cell City Gestão Operacional

> **Natureza deste documento:** planejamento e arquitetura. Não contém implementação, não altera código, banco de dados ou Firestore Rules.
> Referência estratégica para todas as decisões futuras de desenvolvimento, homologação e priorização.
> Para o estado operacional imediato, ver [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md). Para o histórico técnico detalhado, ver [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md) e [`CRM/TECHDOC.md`](CRM/TECHDOC.md).
> Guias operacionais: [`GUIA_OPERACAO_AMBIENTES.md`](GUIA_OPERACAO_AMBIENTES.md) · [`GUIA_ROLLBACK.md`](GUIA_ROLLBACK.md) · [`GUIA_MANUTENCAO.md`](GUIA_MANUTENCAO.md).
> **Atualizado em 2026-07-08** — preparação da plataforma encerrada formalmente (auditoria Go/No-Go, veredito **GO**) e infraestrutura de ambientes DEV/PROD corrigida de "parcial" para "concluída" (estava desatualizada). Ver [`plans/AUDITORIA_GO_NOGO_20260708.md`](plans/AUDITORIA_GO_NOGO_20260708.md), [`plans/ENCERRAMENTO_PREPARACAO_20260708.md`](plans/ENCERRAMENTO_PREPARACAO_20260708.md) e a seção "Situação em 2026-07-08" abaixo. Ciclos anteriores: [`plans/AUDITORIA_GERAL_20260706.md`](plans/AUDITORIA_GERAL_20260706.md), [`plans/AUDITORIA_GERAL_20260704.md`](plans/AUDITORIA_GERAL_20260704.md), [`plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md`](plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md), [`plans/ENCERRAMENTO_AUDITORIA_PLANEJAMENTO_20260704.md`](plans/ENCERRAMENTO_AUDITORIA_PLANEJAMENTO_20260704.md).

---

## Objetivo

Consolidar em um único documento a evolução completa prevista do Cell City Gestão Operacional — do estado atual (Fase 1 concluída, Fase 2 em andamento) até a visão de longo prazo (automação, inteligência e escalabilidade). Cada fase futura só inicia após aprovação formal da fase anterior, seguindo o processo já validado na Fase 1: **Planejamento → Aprovação da arquitetura → Implementação isolada → Backups → Homologação → Atualização do TECHDOC → Encerramento formal.**

---

## Fase 1 — Infraestrutura de Usuários e Permissões

**Status: ✅ Concluída e homologada em 2026-07-01**

### Entregas realizadas
- Módulo `🔐 Usuários e Permissões` (`CRM/pages/usuarios-permissoes/`), integrado como módulo oficial (Central de Módulos + Sidebar), não como página isolada.
- Gestão de usuários (`usuarios/{uid}.perfil_operacional_id`).
- Perfis operacionais livres e configuráveis (`perfis_operacionais/{id}`), com 7 perfis seed: Administrador, Financeiro, Caixa, Estoque, Técnico, Comercial, Atendimento.
- Matriz de permissões por módulo (visualizar / criar / editar / excluir / aprovar).
- Auditoria imutável (`auditoria_usuarios_permissoes`, regra `allow update, delete: if false`).
- Firebase secundário isolado (`firebase-secondary.js`, app `usuarios-permissoes-secondary`) para criar contas e redefinir senhas sem derrubar a sessão do administrador logado.
- Convivência intencional de duas camadas de perfil: `usuarios/{uid}.perfil` (legado, usado por `kernel.js`/`temPermissao()`) e `usuarios/{uid}.perfil_operacional_id` (RBAC novo, ainda não aplicado aos módulos existentes — isso é o escopo da Fase 2).

### Homologação
- 9 seções de homologação, todas aprovadas.
- Testes de Firestore Rules automatizados com `@firebase/rules-unit-testing` + emulador local: 18/18 casos aprovados antes de qualquer deploy em produção.

### Incidentes encontrados
- **Crítico:** o release ativo do Firestore (`projects/cellcity-crm/releases/cloud.firestore`) permaneceu travado em uma versão de 2026-06-30 mesmo após o usuário confirmar "Publicar" no Console Firebase. Só foi diagnosticado consultando a API `firebaserules.googleapis.com` diretamente — o Console não refletia o estado real do release ativo.

### Correções
- Estabelecida regra permanente: toda alteração de Firestore Rules deve ser verificada via API (`firebaserules.googleapis.com`), nunca só pela confirmação visual do Console.

### Resultado final
- Módulo aprovado oficialmente e incorporado à arquitetura padrão do sistema.
- Pendências formalmente empurradas para a Fase 2 (nenhuma bloqueia o uso da Fase 1):
  1. Integração gradual do RBAC operacional nos módulos existentes.
  2. Bug de condição de corrida: coluna "Perfil" da aba Usuários pode ficar em "—" indefinidamente (`renderUsuarios()` não reage ao listener de `perfis`).
  3. Rastreamento de último acesso (não implementado).
  4. Evoluir gerenciamento de senha com Cloud Functions/Admin SDK (hoje exige senha atual ou e-mail de reset).
  5. Atualização de permissões em tempo real sem reload.

---

## Fase 2 — Integração Gradual do RBAC

**Status: 🔵 Em andamento (iniciada em 2026-07-01)**

**Objetivo:** aplicar a matriz de `perfis_operacionais` construída na Fase 1 aos módulos existentes do CRM, substituindo gradualmente as verificações do `perfil` legado, sem nunca integrar mais de um módulo por vez.

**Escopo:** leitura/gate de permissões (visualizar/criar/editar/excluir/aprovar) nos módulos de negócio já em produção. Não inclui redesenho visual nem novas funcionalidades — só controle de acesso.

**Módulos envolvidos e ordem oficial dos sprints:**
1. **Sprint 1 — Dashboard** (piloto; valida o padrão de integração antes de propagar) — ✅ **aprovado em 2026-07-02** (`CRM/TECHDOC.md` §7.1, `plans/fase2-sprint1-dashboard-rbac.md`)
2. **Sprint 2 — CRM, Agenda** — ✅ **aprovado em 2026-07-02** (`CRM/TECHDOC.md` §7.2, `plans/fase2-sprint2-crm-agenda-rbac.md`; tag de restauração `sprint2-rbac-crm-agenda-aprovado`)
3. **Sprint 3 — Estoque, Caixa** — ✅ **aprovado formalmente em 2026-07-08** (implementado 2026-07-02, re-homologado tecnicamente em 2026-07-07 com 34/34 cenários, zero regressão) (`CRM/TECHDOC.md` §7.3, `plans/fase2-sprint3-estoque-caixa-rbac.md`)
4. **Sprint 4 — Financeiro** — ✅ **aprovada formalmente em 2026-07-08** (testes automatizados 6/6 + suíte completa 39/40, zero regressão), integrada à baseline técnica (`CRM/TECHDOC.md` §7.4)
5. **Sprint 5 — OS** (por último — maior dependência cruzada com os demais módulos; tratar como integração crítica) — 🔵 **implementado e homologado em 2026-07-08** (testes automatizados 6/6 + suíte completa 45/46, zero regressão) — aguardando aprovação formal do usuário antes de promover a `main` (`CRM/TECHDOC.md` §7.5). Com esta sprint, a Fase 2 (RBAC) fica tecnicamente completa nos 5 sprints planejados.

**Estratégia de integração:** um módulo piloto por vez; cada sprint só inicia após aprovação formal do sprint anterior. Processo obrigatório de 8 etapas por módulo: Planejamento → Implementação → Testes unitários → Homologação → Correções → Atualização do TECHDOC → Aprovação formal → Liberação do módulo.

**Estratégia de rollback:** backup do módulo e da regra de Firestore afetada antes de cada sprint; qualquer regressão de permissão ou erro de Rules interrompe o sprint e reverte para o backup imediatamente anterior — nunca "corrigir em produção".

**Estratégia de homologação:** repetir o padrão rigoroso da Fase 1 — testes automatizados de Rules via emulador antes do deploy, verificação do release ativo via API (`firebaserules.googleapis.com`), zero erro de console, zero regressão funcional.

**Dependências:** Fase 1 (perfis operacionais e matriz de permissões) já concluída e é pré-requisito direto.

**Componentes críticos:** Firestore Rules, `kernel.js`, sistema de Login/Autenticação, sistema de Autorização/RBAC, `shared/permissoes.js` (a ser criado). Qualquer alteração nesses componentes exige homologação completa antes do deploy.

**Riscos:**
- Bloqueio indevido de acesso em produção se a matriz de permissões estiver incompleta para algum perfil.
- Regressão silenciosa se um módulo passar a depender do RBAC novo antes de todos os perfis existentes estarem mapeados.
- Acúmulo de duas fontes de verdade (`perfil` legado vs. `perfil_operacional_id`) durante a transição — risco de inconsistência se um módulo checar a fonte errada.

**Critérios de aprovação por sprint:** permissões funcionando corretamente, zero regressão, zero erro de console, zero erro de Firestore Rules, auditoria funcionando, TECHDOC atualizado, homologação formalmente aprovada.

**Estimativa de complexidade:** Alta — não pelo volume de código, mas pelo risco de regressão em módulos críticos já em produção e pela obrigatoriedade de homologação isolada por sprint.

**Ordem recomendada:** conforme sprints acima; não pular etapas (ex.: não iniciar Estoque/Caixa antes de CRM/Agenda estarem formalmente aprovados).

---

## Situação em 2026-07-04 — Auditoria Geral e Nova Prioridade

A auditoria geral de 2026-07-04 (`plans/AUDITORIA_GERAL_20260704.md` + `_EXECUTIVA_`) identificou um achado crítico não coberto pela saga de segurança anterior (§6.12-6.14 do TECHDOC): exposição de dados reais de clientes associada ao fluxo OS/Portal do Cliente. O detalhe técnico está redigido nos documentos públicos por política de segurança — ver `plans/AUDITORIA_GERAL_20260704_INTERNO.md` (interno, não publicado).

**Isso altera a ordem imediata de execução, sem alterar a estrutura de Fases abaixo:** a Fase 2 (RBAC) continua exatamente como estava — Sprint 3 pronto e aguardando homologação, Sprints 4/5 não iniciados — mas a correção do achado crítico do Portal/OS passa a ser o item 1 da fila, na frente até da homologação do Sprint 3, por se tratar de um incidente ativo (dado real exposto agora), não de uma pendência de processo. Ordem oficial completa, com critérios de aceite, em [`plans/ENCERRAMENTO_AUDITORIA_PLANEJAMENTO_20260704.md`](plans/ENCERRAMENTO_AUDITORIA_PLANEJAMENTO_20260704.md) Etapa 3.

A auditoria também confirmou que a produção migrou do plano Firebase Spark para Blaze em 2026-07-04 (junto com a criação das Cloud Functions) — o risco de cota diária esgotada, citado em versões anteriores de `PROXIMA_ETAPA.md`, não se aplica mais.

---

## Situação em 2026-07-06 — Sprints 1a e 1b concluídas; nova auditoria de preparação

O achado crítico do parágrafo acima (Portal do Cliente/OS pública) foi corrigido pela **Sprint 1a** (2026-07-05, homologada e promovida a `main`) e sua continuação natural, a **Sprint 1b** (2026-07-06, migração das 7 funcionalidades restantes do Portal para Cloud Functions), foi concluída e integrada em `develop` — ambas fora da numeração de Fases deste documento por terem sido tratadas como incidente de segurança + fechamento direto, não como parte da Fase 2 (RBAC). Detalhe completo em `CRM/TECHDOC.md` §17-19 e `HISTORICO_PROJETO.md`.

**A Fase 2 (RBAC) continua exatamente como estava em 2026-07-04**: Sprint 3 (Estoque+Caixa) implementado e verificado, ainda aguardando homologação manual e aprovação formal — nenhuma sprint de segurança bloqueou esse item, ele simplesmente não avançou.

Uma nova auditoria de preparação de sprint (`plans/AUDITORIA_GERAL_20260706.md`) identificou um achado crítico **novo e não relacionado** ao Portal: uma credencial administrativa (service account) vazada em commit antigo do repositório (público), confirmada ainda ativa em produção — conhecida desde 2026-07-03, nunca rotacionada. Detalhe técnico em `plans/AUDITORIA_GERAL_20260706_INTERNO.md` (interno, mesma política de segurança da Sprint 1). **Recomendação: tratar como item isolado e urgente, à frente de qualquer item de Fase abaixo** — é resposta a incidente ativo, não desenvolvimento de produto.

A mesma auditoria consolidou uma lista priorizada de dívida técnica (código morto confirmado, 4 coleções sem Firestore Rule, 9 módulos sem gate de permissão no client, zero cobertura de teste fora do Portal do Cliente, ausência de CI) — ver o documento para o detalhamento completo e a ordem técnica recomendada entre esses itens e a continuação da Fase 2.

---

## Situação em 2026-07-07 — Sprint 1b promovida a produção; hardening concluído; Camada Repository Fase 0+1; Sprint 3 RBAC re-homologada

Desde a situação de 2026-07-06 acima, os seguintes itens foram concluídos (detalhe completo em `CRM/TECHDOC.md` §20-22 e `HISTORICO_PROJETO.md`):

- **Credencial vazada (item urgente do parágrafo anterior): rotacionada e o incidente encerrado** — as 2 chaves comprometidas foram desabilitadas e excluídas definitivamente do IAM de produção; nenhuma credencial comprometida permanece ativa.
- **Hardening pós-auditoria**: Firestore Rules adicionadas para as coleções internas sem regra; `plans/`, `CLAUDE.md` e `kernel-test/` excluídos do deploy do GitHub Pages.
- **Sprint 1b promovida a `main`** (fast-forward `09b861a..cbe68c6`, tag `v2026.07.06-2226`) — Portal do Cliente 100% migrado para Cloud Functions, em produção real. Um quase-incidente (12 Cloud Functions do Portal ausentes em produção) foi encontrado e corrigido antes de declarar a promoção concluída.
- **Camada Repository — Fase 0 + Fase 1** (preparação arquitetural para uma eventual migração de banco futura, Firestore continua oficial): gap de 3 coleções sem repository fechado (Fase 0); 22 módulos de baixo risco migrados para o padrão Repository (Fase 1), incluindo `estoque.js`. Homologação funcional concluída (48/48 cenários). Integrado em `develop` via rebase (`origin/develop` estava 25 commits à frente devido à Sprint 1b/hardening) e publicado.
- **Sprint 3 do RBAC (Estoque+Caixa) re-homologada tecnicamente**: os 2 arquivos sofreram mudanças desde a verificação original de 02/07 (H-006: fix do prefixo `/dev`; Camada Repository: `estoque.js` migrado). Os 12 cenários do plano original foram re-executados contra o código atual — 34/34 asserções aprovadas, zero regressão. Aprovação formal do usuário continua pendente (ver `CRM/TECHDOC.md` §7.3).

**A Fase 2 (RBAC) permanece exatamente no mesmo ponto de decisão**: Sprint 3 tecnicamente pronta duas vezes (02/07 e 07/07), aguardando só a aprovação formal do dono do projeto para liberar o Sprint 4 (Financeiro). *(Atualização 2026-07-08: aprovação formal concedida — ver "Situação em 2026-07-08" acima.)*

---

## Situação em 2026-07-08 — Preparação encerrada; ✅ **PREPARAÇÃO CONCLUÍDA — GO**

**A fase de preparação da plataforma está formalmente encerrada.** Auditoria final de prontidão (`plans/AUDITORIA_GO_NOGO_20260708.md`) concluiu **GO** — nenhum bloqueador técnico para iniciar o desenvolvimento funcional dos módulos, ~85% de prontidão estimada (o restante é dívida operacional não bloqueadora: monitoramento, billing, backup de dados, cobertura de teste — ver detalhe no relatório e em `plans/ENCERRAMENTO_PREPARACAO_20260708.md`).

Concluído desde a situação de 2026-07-07: **Performance — Fase 1 (pollers espaçados + pausa por aba oculta) e Fase 2 (cache persistente do Firestore)**, homologadas em navegador real (Chrome, login e dados reais do DEV) e enviadas a `origin/develop` (`CRM/TECHDOC.md` §24-25). Processo de homologação de performance automatizado num comando único (`npm run homologar-performance`).

**A partir de agora, o esforço se concentra no desenvolvimento dos módulos** — dois fluxos, detalhados em `plans/ENCERRAMENTO_PREPARACAO_20260708.md` Etapa 5:
- **Fluxo A (continuação, já em andamento):** Fase 2 deste roadmap — Sprint 3 (Estoque+Caixa) ✅ **aprovado formalmente em 2026-07-08**, integrado à baseline técnica → **Sprint 4 (Financeiro) autorizada e em execução desde 2026-07-08, sob o Modo Acelerado Autônomo** (`feedback-modo-acelerado-autonomo` na memória do projeto) → Sprint 5 (OS).
- **Fluxo B (novo desenvolvimento):** Fase 4 deste roadmap (Evolução Funcional) — Financeiro (Fase 9/10) → Usuários e Permissões → Portal do Cliente/WhatsApp → Central de Módulos/Dashboards. *Nota: a Fase 4 lista a Fase 3 (Consolidação da Arquitetura/multiempresa) como pré-requisito formal; como o multiempresa foi revertido e o sistema é single-tenant definitivo, essa dependência provavelmente não se aplica mais tal como escrita — recomendação registrada em `plans/ENCERRAMENTO_PREPARACAO_20260708.md`, decisão formal cabe ao dono do projeto.*

Ver "Critérios Permanentes para Sprints" logo abaixo — obrigatórios para toda entrega de módulo a partir de agora.

---

## Critérios Permanentes para Sprints (a partir de 2026-07-08)

Nenhum módulo — do Fluxo A ou do Fluxo B acima — será considerado concluído sem:

1. **Testes automatizados** cobrindo o que foi alterado (mínimo: sintaxe + o gate de RBAC quando aplicável).
2. **Homologação** — funcional (jsdom ou equivalente) e, quando o módulo tocar UI crítica, em navegador real.
3. **Documentação** — `CRM/TECHDOC.md` atualizado com a entrega; `PROXIMA_ETAPA.md` refletindo o estado real ao fim da sessão.
4. **Backup**, quando a entrega tocar arquivo protegido ou crítico (`CLAUDE.md` §1).
5. **Atualização do histórico técnico** (`HISTORICO_PROJETO.md` e/ou tabela de `CRM/TECHDOC.md` §8).

Isso complementa, não substitui, as regras permanentes já em vigor no `CLAUDE.md` (1 módulo por vez, arquivos protegidos, checklist de testes manuais §5).

---

## Fase 3 — Consolidação da Arquitetura

> ⚠️ **Aviso da auditoria de 2026-07-04:** o escopo abaixo (isolamento por `empresa_id`, `shared/tenant.js`, Central SaaS) descreve uma arquitetura multiempresa que **não existe mais no código atual**. O experimento multiempresa foi **revertido** no rollback de 2026-06-27 (não restaurado — ver [[project-saas-multiempresa]] na memória do projeto) e o sistema opera hoje em regime single-tenant; `shared/tenant.js` é código morto, sem nenhum módulo importando (confirmado em `plans/AUDITORIA_GERAL_20260704.md` §5). **Esta Fase 3 precisa de uma revisão de escopo dedicada antes de ser iniciada** — não reescrita nesta consolidação por ser uma decisão de arquitetura de longo prazo, não uma correção de auditoria. Até essa revisão, tratar o conteúdo abaixo como desatualizado.

**Status: ⚪ Planejada**

**Objetivo:** eliminar a dívida técnica acumulada nos ciclos anteriores (rollback de multiempresa, migrações parciais, arquivos duplicados) e padronizar o acesso a dados multiempresa antes de construir novas funcionalidades sobre uma base inconsistente.

**Escopo:**
- Completar o isolamento por `empresa_id` nos módulos que ainda não o possuem: `clientes`, `central-alertas`, `central-informacoes`, `crm-comercial`, `catalogo`, `chips`, `garantias`, `venda-rapida`, `relatorios`, `acaodasemana` (hoje funcionam apenas via `isMaster()` nas Rules).
- Padronizar todos os módulos para usar `shared/modulo-guard.js` (`initModulo()`) em vez de inicializações ad-hoc.
- Centralizar o catálogo de módulos, hoje duplicado entre `saas.js` (`MODULOS_CATALOGO`) e `central-modulos.js`.
- Remover arquivos obsoletos de `shared/` (`.BACKUP*`, `.bak*`) e páginas substituídas (`setup.html`, `migration.html`, `homolog.html` — já cobertas pela Central SaaS).
- Corrigir o bug de condição de corrida da Fase 1 (coluna "Perfil" travada em "—").
- Avaliar performance de listeners Firestore (uso de `listener-manager.js` em todos os módulos, não só nos restaurados no Recovery de 2026-06-27).

**Módulos envolvidos:** todos os módulos de negócio existentes (não introduz módulos novos).

**Dependências:** Fase 2 concluída — não faz sentido padronizar guards de módulo enquanto o RBAC ainda está sendo integrado sprint a sprint sobre a base atual.

**Componentes críticos:** Firestore Rules (isolamento `empresa_id`), `shared/tenant.js`, `shared/modulo-guard.js`, `shared/listener-manager.js`.

**Riscos:**
- Repetição do incidente de 2026-06-27 (rollback que apagou toda a infraestrutura multiempresa) se a consolidação for feita sem backups intermediários por módulo.
- Migração de `empresa_id` em coleções com dados legados sem o campo pode quebrar leituras se a regra de transição for removida cedo demais.

**Critérios de aprovação:** 100% dos módulos de negócio com `empresa_id` íntegro, zero arquivo de backup solto em `shared/`, catálogo de módulos com fonte única, zero regressão nos testes de Fase 2.

**Estimativa de complexidade:** Média-Alta — trabalho extenso, mas de natureza mecânica e já mapeado (não é código novo, é padronização do que já existe).

**Ordem recomendada:** iniciar pelos módulos de menor risco (`chips`, `garantias`, `venda-rapida`) antes dos de maior superfície (`clientes`, `central-alertas`, `crm-comercial`).

---

## Fase 4 — Evolução Funcional

**Status: ⚪ Planejada**

**Objetivo:** entregar melhorias e novos recursos sobre uma base já consolidada (Fases 2 e 3), priorizando o que já está formalmente pendente nos módulos existentes.

**Escopo:**
- **Financeiro:** Fase 9 (Central de Alertas Inteligentes financeiros — vencimentos, fluxo de caixa projetado) e Fase 10 (Fechamento Mensal Automático); geração automática de despesas recorrentes; relatórios exportáveis (PDF/Excel).
- **Usuários e Permissões:** rastreamento de último acesso; atualização de permissões em tempo real sem reload; evolução de gerenciamento de senha via Cloud Functions/Admin SDK.
- **Portal do Cliente:** evolução dos módulos já existentes (OS, Garantias, Contato) com base no telefone canônico (`phoneDigits`) já estabilizado.
- **WhatsApp CRM:** novos templates e variáveis, histórico de envio por cliente.
- **Central de Módulos:** curadoria do catálogo consolidado na Fase 3, novos favoritos sugeridos por perfil de uso.
- **Recursos administrativos novos:** dashboards por perfil operacional (o que cada perfil vê ao logar), relatórios de auditoria consolidados (usuários + financeiro + estoque).

**Módulos envolvidos:** Financeiro, Usuários e Permissões, Portal do Cliente, WhatsApp CRM, Central de Módulos, Dashboard.

**Dependências:** Fase 3 concluída — evoluir funcionalidades sobre módulos ainda sem `empresa_id` padronizado geraria retrabalho.

**Componentes críticos:** nenhum item de Fase 4 deve tocar Login, Autenticação ou Rules diretamente; caso alguma melhoria exija isso, ela deve ser reclassificada como componente crítico e homologada como tal.

**Riscos:**
- Escopo tende a crescer (muitos "pendentes" acumulados) — risco de perder o princípio de "um módulo por vez".
- Relatórios exportáveis e dashboards por perfil dependem de dados consistentes de RBAC (Fase 2) e `empresa_id` (Fase 3); iniciar antes do tempo gera retrabalho.

**Critérios de aprovação:** cada entrega homologada isoladamente, sem regressão nos módulos testados obrigatoriamente (Login, Dashboard, CRM, OS, Caixa, Estoque, Financeiro, Portal do Cliente — conforme regra permanente do projeto).

**Estimativa de complexidade:** Média — funcionalidades incrementais sobre módulos já maduros, sem mudança estrutural.

**Ordem recomendada:** Financeiro (Fase 9/10, já mapeado e com maior valor de negócio) → Usuários e Permissões (pendências da Fase 1) → Portal do Cliente/WhatsApp → Central de Módulos/Dashboards.

---

## Fase 5 — Automação e Inteligência

**Status: ⚪ Planejada (visão de médio-longo prazo)**

**Objetivo:** reduzir trabalho manual e antecipar problemas operacionais usando os dados já estruturados nas fases anteriores (Financeiro, Estoque, Caixa, Alertas).

**Escopo:**
- Evolução da Central de Alertas para alertas verdadeiramente preditivos (ex.: projeção de ruptura de estoque, previsão de inadimplência) em vez de regras fixas de limiar.
- Sugestões inteligentes: reposição de estoque baseada em histórico de venda, sugestão de follow-up de pós-venda, priorização de OS por risco de atraso.
- Automação de processos recorrentes: geração automática de despesas fixas, fechamento mensal automático (Financeiro Fase 10), disparo automático de mensagens WhatsApp em marcos da OS (recebido/pronto/entregue).
- Avaliação de integrações externas futuras (ex.: NF-e, meios de pagamento, marketplaces) — apenas mapeamento de viabilidade, sem compromisso de implementação.

**Módulos envolvidos:** Central de Alertas, Financeiro, Estoque, WhatsApp CRM, Dashboard.

**Dependências:** Fase 4 concluída — automação e IA precisam de dados limpos e de funcionalidades manuais já validadas como corretas antes de serem automatizadas.

**Componentes críticos:** qualquer automação que escreva dados sem intervenção humana (ex.: fechamento mensal automático) é crítica por definição e exige plano de rollback e auditoria própria.

**Riscos:**
- Automação sobre dados inconsistentes (herdados de módulos ainda sem `empresa_id` completo) propaga erro em escala.
- Sugestões/IA mal calibradas geram desconfiança do usuário no sistema — recomenda-se lançar como sugestão opcional antes de qualquer ação automática.

**Critérios de aprovação:** toda automação nova roda primeiro em modo "sugestão"/"dry-run" homologado antes de ganhar permissão de escrita automática.

**Estimativa de complexidade:** Alta — não pelo volume, mas pela natureza nova (nenhum precedente similar já homologado no projeto).

**Ordem recomendada:** alertas preditivos → automações de escrita de baixo risco (despesas recorrentes) → automações de escrita de alto risco (fechamento mensal) → integrações externas.

---

## Fase 6 — Escalabilidade

> ⚠️ **Mesmo aviso da Fase 3 (auditoria de 2026-07-04):** o item "Multiempresa" do escopo abaixo descreve a infraestrutura `shared/tenant.js`/Central SaaS como "restaurada em 2026-06-27" — o que ocorreu de fato foi o **rollback que reverteu** essa infraestrutura nessa mesma data. O código correspondente é hoje código morto. Tratar como desatualizado até revisão dedicada (mesma pendência da Fase 3).

**Status: ⚪ Planejada (visão de longo prazo)**

**Objetivo:** preparar o sistema para operar com mais robustez, segurança e (se necessário) mais de uma empresa/loja simultaneamente.

**Escopo:**
- **Segurança:** revisão completa de Firestore Rules após Fases 2-5, rotação de credenciais (`sa-key.json` hoje no diretório de trabalho local, fora do git via `.gitignore` — avaliar migração para secret manager), auditoria de acesso consolidada.
- **APIs:** avaliar necessidade de uma camada de API própria (Cloud Functions) para operações que hoje dependem de escrita direta do client no Firestore (ex.: fechamento mensal automático da Fase 5).
- **Monitoramento:** observabilidade de erros em produção (hoje não há Sentry/logging centralizado), alertas de falha de Service Worker/sincronização.
- **Backup:** formalizar rotina de backup do Firestore (hoje os backups são manuais via `_BACKUPS/`), com retenção e teste periódico de restauração.
- **Multiempresa (se necessário):** a infraestrutura já existe parcialmente (`shared/tenant.js`, `shared/modulo-guard.js`, Central SaaS, isolamento por `empresa_id` em 10 módulos principais restaurado em 2026-06-27) mas opera hoje em modo single-tenant (`empresa_id = cellcity-master`). Retomar como multiempresa real só deve ocorrer se houver decisão de negócio explícita nesse sentido — não é um requisito técnico pendente.
- **Alta disponibilidade:** revisão do Service Worker (histórico de bugs de navegação/logout já corrigidos) e estratégia de cache offline.

**Módulos envolvidos:** infraestrutura transversal (Firestore Rules, `scripts/firebase.js`, `shared/tenant.js`, Service Worker, Central SaaS) — não módulos de negócio individuais.

**Dependências:** Fases 3, 4 e 5 concluídas. Escalabilidade sobre uma base ainda com dívida técnica ou automações não homologadas amplifica risco em vez de reduzir.

**Componentes críticos:** todos os itens desta fase são, por definição, componentes críticos (Rules, Auth, infraestrutura de backup/monitoramento). Nenhum deploy nesta fase deve ocorrer sem homologação completa e plano de rollback formal.

**Riscos:**
- Reintrodução de um cenário como o rollback de 2026-06-27 se a camada multiempresa for reativada sem o mesmo rigor de homologação já validado.
- Custo operacional (Cloud Functions, monitoramento pago) — decisão deve avaliar retorno antes de comprometer orçamento.

**Critérios de aprovação:** auditoria de segurança sem pendências, backup testado com restauração bem-sucedida, zero regressão nos módulos obrigatórios de teste do projeto.

**Estimativa de complexidade:** Alta — envolve infraestrutura, não só código de aplicação, e decisões de custo/negócio além do técnico.

**Ordem recomendada:** Segurança/Backup (mais barato, maior redução de risco) → Monitoramento → APIs (Cloud Functions) → Alta disponibilidade → Multiempresa real (somente sob demanda de negócio).

---

## Infraestrutura de Ambientes DEV/PROD (transversal às fases)

**Status: ✅ Concluída e em produção — backend separado desde 2026-07-03/04.** *(Corrigido em 2026-07-08 — esta seção ficou desatualizada por vários dias descrevendo um freeze que já havia sido superado; ver `plans/AUDITORIA_GO_NOGO_20260708.md` Etapa 8.)*

Esta frente não é uma fase do roadmap — é infraestrutura transversal que sustenta a homologação segura de todas as fases.

**Entregue:**
- Dois ambientes publicados a partir do mesmo GitHub Pages: 🟢 **MAIN** (branch `main` → raiz do domínio) e 🟠 **DEVELOP** (branch `develop` → `/dev`), montados pelo workflow `.github/workflows/deploy-pages.yml` a cada push em qualquer dos dois branches.
- Indicador/seletor de ambiente no cabeçalho padrão (`CRM/shared/brand-header.js`), com detecção pela URL e navegação bidirecional.
- **Backend separado por ambiente**: projeto `cellcity-crm-dev` exclusivo de desenvolvimento, seleção de config em runtime (`CRM/shared/env-config.js`, regra fail-safe: em dúvida, DEV, nunca produção). Testes no DEVELOP não tocam mais dados nem cota de produção.
- Produção migrada do plano Spark para Blaze (2026-07-04) — sem trava de cota diária.
- Documentação: `CRM/TECHDOC.md` §9 e [`GUIA_OPERACAO_AMBIENTES.md`](GUIA_OPERACAO_AMBIENTES.md), [`plans/SEPARACAO_AMBIENTES_DEV_PROD.md`](plans/SEPARACAO_AMBIENTES_DEV_PROD.md) (plano original executado).

**Pendência remanescente (não bloqueadora, ver `plans/AUDITORIA_GO_NOGO_20260708.md`):** billing do plano Blaze sem teto/alerta de gasto confirmado como configurado.

**Relação com as fases:** já não é mais pré-condição de nada — está concluída e disponível para todas as fases atuais e futuras.

---

## Preparação para SQL (transversal às fases, planejamento — 2026-07-05/07)

**Status: 🔵 Modelagem concluída (2026-07-07). Migração NÃO iniciada, NÃO recomendada nem agendada.**

Assim como a Infraestrutura de Ambientes acima, esta não é uma fase do roadmap — é uma preparação de arquitetura em paralelo, que não bloqueia nem depende de nenhuma das Fases 1-6. Objetivo: reduzir o custo de uma eventual migração futura de banco de dados, sem migrar nada agora.

**Já entregue:**
- Camada Repository (`CRM/repositories/`) isolando o acesso ao Firestore atrás de uma interface uniforme, com piloto + Fase 0 + Fase 1 homologados (23 módulos migrados, 48/48 cenários funcionais — ver `CRM/TECHDOC.md` §22).
- Modelagem relacional completa das 54 coleções ativas do Firestore + 7 tabelas legadas mínimas (paridade 1:1 com a Camada Repository): 82 tabelas, 62 relacionamentos, banco recomendado (PostgreSQL/Cloud SQL) com justificativa, DER, estratégia de migração em 7 ondas e plano de adaptação de cada Repository — tudo em `sql/` (novo diretório) e `CRM/TECHDOC.md` §23. Auditoria final (2026-07-07) emitiu parecer técnico **APROVADA** — ver `sql/04_auditoria_final.md`. Nenhum código, banco ou dado alterado para produzir isso.

**Explicitamente não incluído nesta preparação** (mesma diretriz permanente desde 2026-07-05): instalar um banco SQL, adicionar um ORM, migrar um único registro de dado real, ou alterar qualquer módulo funcional do CRM. O Firestore continua sendo o banco oficial até uma decisão de negócio explícita em contrário.

**Relação com as fases:** não bloqueia nenhuma Fase 1-6. Se uma migração futura vier a ser autorizada, a ordem recomendada (`sql/02_migracao_estrategia.md`) prioriza catálogos/domínios de baixo risco antes do núcleo (OS/Clientes) e da identidade/Auth — nunca antes das Fases de RBAC (2) estarem consolidadas, pelo mesmo motivo de sempre: não construir sobre uma base com dívida técnica ainda aberta.

---

## Roadmap Geral

### Linha do tempo recomendada

```
Fase 1  ✅ Concluída ────────────────────────────────────────
Fase 2  🔵 Em andamento (5 sprints sequenciais) ─────────────
Fase 3  ⚪ Planejada  ────────────────────────────────────────
Fase 4  ⚪ Planejada  ────────────────────────────────────────
Fase 5  ⚪ Planejada (médio-longo prazo) ─────────────────────
Fase 6  ⚪ Planejada (longo prazo) ───────────────────────────
```

### Ordem ideal das implementações
1. **Fase 2** até o Sprint 5 (OS) formalmente aprovado — nenhuma outra fase inicia antes disso.
2. **Fase 3** — consolidação, sem a qual toda automação/evolução futura herda a dívida técnica atual.
3. **Fase 4** — evolução funcional sobre base consolidada.
4. **Fase 5** — automação, só depois de processos manuais validados.
5. **Fase 6** — escalabilidade, avaliada continuamente mas implementada por último (custo/risco mais altos).

### Dependências entre fases
- Fase 2 depende só da Fase 1 (concluída).
- Fase 3 depende da Fase 2 concluída (RBAC estável antes de mexer em isolamento de dados).
- Fase 4 depende da Fase 3 concluída (dados/permissões consistentes antes de construir features em cima).
- Fase 5 depende da Fase 4 concluída (não automatizar processo que ainda não foi validado manualmente).
- Fase 6 depende das Fases 3-5 concluídas (escalar uma base com dívida técnica ou automação não homologada amplia o risco, não reduz).

### Marcos principais (Milestones)
- **M1:** Fase 2 — Sprint 1 (Dashboard) aprovado → valida o padrão de integração RBAC para os demais sprints.
- **M2:** Fase 2 concluída (Sprint 5 — OS aprovado) → RBAC operacional em 100% dos módulos.
- **M3:** Fase 3 concluída → 100% dos módulos com `empresa_id` íntegro e guard padronizado; zero dívida técnica conhecida.
- **M4:** Fase 4 — Financeiro Fase 9/10 entregues → primeiro ciclo de fechamento contábil semi-automatizado.
- **M5:** Fase 5 — primeira automação de escrita (ex.: despesas recorrentes) operando em produção sem incidente por 30 dias.
- **M6:** Fase 6 — auditoria de segurança e backup formal aprovados (independentemente de decisão sobre multiempresa real).

### Critérios para início e encerramento de cada fase
- **Início:** fase anterior formalmente aprovada (relatório de homologação registrado); TECHDOC atualizado refletindo o estado que a nova fase vai herdar.
- **Encerramento:** critérios de aprovação específicos da fase (detalhados em cada seção acima) atendidos; zero regressão nos módulos de teste obrigatório do projeto (Login, Dashboard, CRM, OS, Caixa, Estoque, Financeiro, Portal do Cliente); TECHDOC e este Master Roadmap atualizados com o resultado real.

---

## Visão Arquitetural

### Da Fase 1 à Fase 6 — a mesma base, camada por camada

O Cell City Gestão Operacional não muda de arquitetura a cada fase — ele **completa** a mesma arquitetura, uma camada de cada vez. Cada fase deste roadmap corresponde a uma camada específica do sistema, na ordem em que ela precisa amadurecer para sustentar a próxima:

```
Fase 1  →  Camada de IDENTIDADE E PERMISSÃO
            (usuarios, perfis_operacionais, matriz de permissões, auditoria imutável)

Fase 2  →  Camada de AUTORIZAÇÃO APLICADA
            (a matriz da Fase 1 passa a valer nos módulos reais, um por um)

Fase 3  →  Camada de DADOS CONSISTENTE
            (empresa_id íntegro em todos os módulos, guard único, catálogo único)

Fase 4  →  Camada de FUNCIONALIDADE
            (recursos novos construídos sobre dados e permissões já confiáveis)

Fase 5  →  Camada DE DECISÃO
            (o sistema passa a sugerir e, depois, a agir sozinho sobre os dados)

Fase 6  →  Camada DE OPERAÇÃO EM ESCALA
            (segurança, observabilidade, backup formal e, se preciso, multiempresa real)
```

Essa ordem não é arbitrária: nenhuma camada superior é confiável se a camada abaixo dela ainda está incompleta. Automatizar (Fase 5) sobre dados sem `empresa_id` íntegro (pendência da Fase 3) propagaria erro em escala; dar mais funcionalidades (Fase 4) a um RBAC parcialmente aplicado (Fase 2 incompleta) criaria brechas de acesso. O roadmap existe justamente para impedir que uma fase "avance" pulando a validação da anterior — o mesmo princípio que já orientou a Fase 1 (homologação formal antes de liberar) se repete em escala crescente até a Fase 6.

### Evolução da superfície técnica

- **Hoje (fim da Fase 1 / início da Fase 2):** identidade e permissão existem como infraestrutura isolada (`usuarios-permissoes/`), ainda não conectada às decisões de acesso dos módulos de negócio. O sistema opera, na prática, sob o `perfil` legado.
- **Ao fim da Fase 2:** toda decisão de acesso do sistema passa pela matriz de `perfis_operacionais`; o `perfil` legado deixa de ser a fonte de verdade ativa (podendo ser mantido apenas como campo histórico).
- **Ao fim da Fase 3:** não existe mais divergência entre módulos — todos usam `shared/modulo-guard.js`, todos têm `empresa_id` íntegro, o catálogo de módulos tem fonte única. É o ponto em que o sistema para de acumular dívida técnica de ciclos anteriores (rollback de 2026-06-27, migrações parciais, arquivos duplicados).
- **Ao fim da Fase 4:** o sistema tem paridade funcional com as pendências historicamente registradas em cada módulo (Financeiro, Usuários e Permissões, Portal do Cliente, WhatsApp CRM) — sem nenhuma dívida de escopo conhecida em aberto.
- **Ao fim da Fase 5:** parte do trabalho manual e repetitivo (alertas de limiar fixo, fechamento mensal, mensagens de marco de OS) passa a ter uma versão automatizada, sempre precedida por um modo "sugestão/dry-run" homologado.
- **Ao fim da Fase 6:** o sistema tem uma postura de produção madura — segurança auditada, backup testado e restaurável, observabilidade de erros — e a decisão sobre operar como multiempresa real (a infraestrutura já existe, hoje em modo single-tenant) passa a ser uma escolha de negócio, não uma limitação técnica.

### Constantes que atravessam todas as fases

Independentemente da fase, três princípios continuam valendo sem exceção, porque já se mostraram necessários na prática do projeto:
1. **Um módulo por vez**, nunca integração simultânea — é o que evita repetir o incidente do rollback de 2026-06-27.
2. **Verificação via API, nunca só pelo Console** — regra nascida do incidente do release travado de Firestore Rules na Fase 1, e que vale para qualquer configuração de infraestrutura daqui em diante.
3. **Backup antes, homologação depois, TECHDOC sempre** — o mesmo processo de 8 etapas validado na Fase 1 e replicado sprint a sprint na Fase 2 é o padrão de referência para todas as fases seguintes.

---

## Conclusão

Este Master Roadmap consolida, em um único documento oficial, a trajetória completa do Cell City Gestão Operacional: da infraestrutura de identidade e permissão já homologada na Fase 1, passando pela integração gradual do RBAC (Fase 2, em andamento), até a consolidação arquitetural, evolução funcional, automação e escalabilidade previstas para os próximos ciclos (Fases 3 a 6).

Ele não substitui os documentos operacionais existentes — [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md) continua sendo a referência do estado imediato, e [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md)/[`CRM/TECHDOC.md`](CRM/TECHDOC.md) continuam registrando o histórico técnico detalhado. O papel deste documento é outro: **garantir que nenhuma decisão futura de priorização seja tomada sem visibilidade do caminho inteiro**, e que cada fase só comece depois que a anterior tiver sido formalmente aprovada — nunca por atalho, nunca por pressa.

Nenhum código, banco de dados ou regra de Firestore foi alterado na elaboração deste roadmap. Ele é, por natureza, um documento de planejamento e arquitetura, e deve continuar sendo tratado como tal: atualizado ao fim de cada fase com o resultado real obtido, nunca reescrito para apagar decisões já tomadas.

A partir daqui, a execução segue de forma controlada *(atualizado em 2026-07-06 — ver "Situação em 2026-07-06" acima e a ordem completa/priorizada em `plans/AUDITORIA_GERAL_20260706.md`)*: o achado crítico do Portal do Cliente/OS pública foi corrigido (Sprints 1a e 1b, concluídas). **Um novo achado crítico não relacionado (credencial vazada ainda ativa) passa a ser o item mais urgente**, à frente da homologação do Sprint 3 (Estoque + Caixa) da Fase 2 — que continua pronta e aguardando esse passo, sem bloqueio técnico. Nenhuma fase posterior deve ser iniciada antes da aprovação formal da fase que a precede. A situação da cota do Firestore foi resolvida em 2026-07-04 (migração para o plano Blaze); a separação de backend DEV/PROD foi autorizada e concluída.

---

*Este documento é vivo: deve ser atualizado ao final de cada fase com o resultado real obtido, mantendo o mesmo espírito de [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md) — nunca apagar o que já foi decidido, apenas registrar a evolução.*


---

## Situação em 2026-07-13 — Fase 15: Revisão Técnica Final; V2 certificada; Fundação V3 homologada

- Fases 12–14 (refatoração global, arquitetura, performance) concluídas: escape HTML e datas centralizados em `CRM/shared/` (sanitize.js / date-utils.js), 2 repositórios órfãos removidos, SW expandido, catálogo V2 estável (34 módulos, 28 visíveis, score médio 95).
- **Fundação V3 entregue** (DeepSeek, `plans/v3/CCC-V3.0-ARCH-001`): 10 engines bash em `scripts/` (health, diagnostic, monitoring, observability, smart-panel, prompt-generator, automations, execution, integration, central-modulos-v3) como *overlay* — zero alteração na V2, zero Firestore, excluídos do deploy Pages.
- **Revisão independente (Fase 15)**: 5 correções aplicadas na V3 (timestamps, JSON inválido em metrics/module-center, `--category`, VERSION), 5 testes obsoletos do Control Center corrigidos, suítes completas **457/457**.
- Roadmap V3 (V3-F1 Fundação ✅ → V3-F12 Release): ver `plans/v3/CCC-V3.0-ARCH-001`, §8.
- Próximo marco: push/promoção (decisão do dono) e início da V3-F2 (Health Engine operacional).
