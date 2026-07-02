# 🗺️ MASTER_ROADMAP.md — Cell City Gestão Operacional

> **Natureza deste documento:** planejamento e arquitetura. Não contém implementação, não altera código, banco de dados ou Firestore Rules.
> Referência estratégica para todas as decisões futuras de desenvolvimento, homologação e priorização.
> Para o estado operacional imediato, ver [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md). Para o histórico técnico detalhado, ver [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md) e [`CRM/TECHDOC.md`](CRM/TECHDOC.md).

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
3. **Sprint 3 — Estoque, Caixa** (atenção especial à integração entre os dois — movimentação de estoque via Caixa) — 🔵 **autorizado em 2026-07-02, em planejamento**
4. **Sprint 4 — Financeiro** (atenção redobrada a aprovações, exclusões e trilha de auditoria)
5. **Sprint 5 — OS** (por último — maior dependência cruzada com os demais módulos; tratar como integração crítica)

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

## Fase 3 — Consolidação da Arquitetura

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

**Status: ⚪ Planejada (visão de longo prazo)**

**Objetivo:** preparar o sistema para operar com mais robustez, segurança e (se necessário) mais de uma empresa/loja simultaneamente.

**Escopo:**
- **Segurança:** revisão completa de Firestore Rules após Fases 2-5, rotação de credenciais (`sa-key.json` hoje no repositório — avaliar migração para secret manager), auditoria de acesso consolidada.
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

A partir daqui, a execução segue de forma controlada: **Fase 2 (Sprint 1 — Dashboard) é o próximo passo formalmente autorizado**, seguindo o processo de 8 etapas já validado, e nenhuma fase posterior deve ser iniciada antes da aprovação formal da fase que a precede.

---

*Este documento é vivo: deve ser atualizado ao final de cada fase com o resultado real obtido, mantendo o mesmo espírito de [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md) — nunca apagar o que já foi decidido, apenas registrar a evolução.*
