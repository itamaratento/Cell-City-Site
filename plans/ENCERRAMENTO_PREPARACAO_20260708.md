# Encerramento da Preparação da Plataforma — 2026-07-08

> Registra o fechamento formal da fase de preparação do Cell City CRM e a transição para a fase de desenvolvimento funcional dos módulos. Não implementa, não refatora, não altera regra de negócio — só organiza e formaliza a transição.

---

## Etapa 1 — Revisão final

| Item | Confirmação |
|---|---|
| Auditoria GO concluída | Sim — `plans/AUDITORIA_GO_NOGO_20260708.md`, commit `7991211` |
| Bloqueador técnico aberto | Nenhum encontrado |
| Documentação sincronizada | Parcial na auditoria (MASTER_ROADMAP e o plano de performance estavam desatualizados) — corrigido nesta mesma entrega (Etapa 6 abaixo) |
| Branch `develop` íntegra | Sim — working tree limpo, `HEAD` = `7991211` |
| Testes obrigatórios | 114/115 (Rules 52/52, Cloud Functions 25/25, RBAC 33/34 — 1 falha pré-existente conhecida, Polling gating 4/4) |
| Homologações concluídas | Performance Fase 1+2 (navegador real), Camada Repository Fase 0+1 (48/48), Preparação SQL (aceite técnico) |

## Etapa 2 — Encerramento da preparação

**Objetivos atingidos:**
- Ambientes DEV/Produção separados por backend (`cellcity-crm` / `cellcity-crm-dev`), documentados e em produção.
- Segurança: BL-006 (escalada de privilégio) corrigida e aceita; Portal do Cliente migrado para Cloud Functions; credencial comprometida rotacionada e excluída definitivamente do IAM.
- RBAC: Sprints 1 (Dashboard) e 2 (CRM/Agenda) aprovados formalmente; Sprint 3 (Estoque+Caixa) tecnicamente pronto e re-homologado, aguardando só aprovação formal.
- Camada Repository (padrão de acesso a dados) entregue e homologada — 19 repositories, 22+ módulos migrados.
- Performance: Fase 1 (pollers) e Fase 2 (cache persistente do Firestore) homologadas em navegador real e enviadas a `origin/develop`.
- Preparação para uma eventual migração SQL futura: modelagem completa e auditada (82 tabelas), sem nenhuma migração real — só planejamento disponível.
- CI mínima ativa (4 suítes, a cada push/PR); processo de homologação automatizado (`npm run homologar-performance`).
- Backup oficial de código-fonte (semanal, automático) e processo de rollback documentado e testado.

**Principais melhorias entregues nesta fase:**
- Redução de leitura ao Firestore (polling espaçado 10-20× + cache persistente com IndexedDB).
- Eliminação de exposição pública de dados de clientes (OS/Portal).
- Base de dados repository-driven, reduzindo o custo de qualquer evolução futura de arquitetura de dados.
- Pipeline de homologação repetível, reduzindo o tempo/risco de cada entrega futura relacionada a performance.

**Riscos conhecidos (ver lista completa na Etapa 4):** nenhum classificado como bloqueador.

## Etapa 3 — Baseline técnica

Esta seção é a referência oficial de arquitetura para todas as próximas sprints. Cada item aponta para a fonte de verdade viva (não duplicada aqui, para não gerar drift de documentação):

| Área | Estado na baseline | Fonte de verdade |
|---|---|---|
| Arquitetura geral | Front-end estático (sem build step), 34 módulos em `CRM/pages/`, separação limpa Front-end/Cloud Functions/scripts operacionais | `CRM/TECHDOC.md` §1 |
| Firestore (estrutura) | ~57 coleções ativas documentadas, 3 índices compostos reais | `COLECOES_FIRESTORE.md`, `CRM/firestore.indexes.json` |
| Cloud Functions | 15 functions (`functions/index.js`), `HttpsError` tipado, deploy manual | `CRM/TECHDOC.md` §14, §19, §21 |
| RBAC | `perfis_operacionais` + matriz de permissões, fail-open na UI por design, segurança real via Rules | `CRM/TECHDOC.md` §6-7 |
| Firestore Rules | `CRM/firestore.rules` (arquivo real deployado) | `CRM/firestore.rules` |
| Performance | Fase 1 (pollers) + Fase 2 (cache persistente) concluídas; Fases 3-6 pendentes | `CRM/TECHDOC.md` §24-25, `plans/PLANO_OTIMIZACAO_PERFORMANCE_20260703.md` |
| Camada Repository | 19 `*.repository.js`, `CRM/firebase/client.js`, `CRM/services/` reservado para orquestração futura | `CRM/TECHDOC.md` §22 |
| Preparação SQL | Modelagem completa, auditada, não migrada | `sql/`, `CRM/TECHDOC.md` §23 |
| CI/CD | `.github/workflows/tests.yml` (4 suítes), `deploy-pages.yml` (site, automático), Cloud Functions (deploy manual) | `.github/workflows/` |
| Processo de homologação | `npm run homologar-performance` (auditoria + testes + navegador real + relatório) | `scripts/homologacao/README.md` |

## Etapa 4 — Registro único de pendências (todas não bloqueadoras)

### Operacionais
- Monitoramento/alertas de produção — hoje inexistente, sistema reativo.
- Orçamento e alerta de billing no plano Blaze — recomendado, não confirmado como configurado.
- Automação do deploy de Cloud Functions — hoje manual, sem gate de CI.
- Ampliação dos backups — backup de dados do Firestore cobre só 21 de ~57 coleções, sem redundância cloud.
- Ampliação dos testes automatizados — 27 de 34 módulos ainda sem nenhum teste.

### Técnicas
- Falha conhecida do Caixa (`tests/rbac/caixa.test.mjs` — "Caixa matriz total: tudo visível"), pré-existente, não relacionada a nenhuma entrega recente.
- Melhorias futuras de performance — Fases 3-6 do plano de otimização (escopo de queries, higiene de listeners, paginação, agregados).
- Demais dívidas técnicas aceitas: código morto confirmado (`shared/tenant.js`, `shared/listener-manager.js`), lixo commitado (pastas `BACKUP_*`, arquivos `.bak`), índices Firestore desalinhados, `firestore.rules` órfã na raiz, zero logging nas Cloud Functions, documentos de planejamento desatualizados (corrigido parcialmente nesta entrega).

**Todas marcadas como: não bloqueadoras.**

## Etapa 5 — Planejamento dos módulos

Dois fluxos de trabalho distintos, com critérios de dependência diferentes:

### Fluxo A — Conclusão da Fase 2 (RBAC), já em andamento
1. **Sprint 3 — Estoque + Caixa**: tecnicamente pronto e re-homologado (34/34), só falta aprovação formal do dono do projeto. **Ação imediata: decisão de aprovação, não trabalho técnico novo.**
2. **Sprint 4 — Financeiro**: só inicia após aprovação formal do Sprint 3. Atenção redobrada a aprovações, exclusões e trilha de auditoria (já sinalizado no roadmap).
3. **Sprint 5 — OS**: só inicia após Sprint 4 aprovado. Maior dependência cruzada com os demais módulos — tratar como integração crítica.

### Fluxo B — Fase 4 (Evolução Funcional), novo desenvolvimento de produto
Ordem recomendada (já mapeada em `MASTER_ROADMAP.md`, mantida aqui): **Financeiro** (Fase 9 — Central de Alertas Inteligentes; Fase 10 — Fechamento Mensal Automático; maior valor de negócio já mapeado) → **Usuários e Permissões** (pendências da Fase 1: rastreamento de acesso, permissões em tempo real, senha via Admin SDK) → **Portal do Cliente / WhatsApp CRM** → **Central de Módulos / Dashboards por perfil**.

**Nota de dependência — decisão recomendada, não uma alteração unilateral:** o `MASTER_ROADMAP.md` lista a Fase 3 (Consolidação da Arquitetura, escopo original de multiempresa) como pré-requisito formal da Fase 4, pelo motivo original de "evitar retrabalho em módulos sem `empresa_id` padronizado". Como o multiempresa foi revertido e o sistema opera hoje em regime single-tenant definitivo (não uma pendência, uma decisão já tomada), esse motivo original não se aplica mais tal como descrito. **Recomendação:** tratar a Fase 4 como liberada para iniciar sem esperar uma Fase 3 que hoje não tem escopo válido — mas essa é uma leitura de arquitetura, registrada aqui como recomendação; a decisão formal de dispensar a Fase 3 como pré-requisito cabe ao dono do projeto.

**Critérios de conclusão por módulo (ambos os fluxos):** ver Etapa 7 (critérios permanentes) — nenhum módulo novo será considerado concluído sem cumpri-los.

**Estratégia de homologação:** mesmo padrão já validado — testes automatizados antes de qualquer deploy, homologação funcional (jsdom ou navegador real conforme aplicável), verificação de regressão nos módulos obrigatórios do `CLAUDE.md` §5, atualização do TECHDOC, aprovação formal antes de promover para `main`.

## Etapa 6 — Atualização do roadmap

Aplicada diretamente em `MASTER_ROADMAP.md`: banner de encerramento da preparação, correção da seção "Infraestrutura de Ambientes DEV/PROD" (estava desatualizada, descrevia freeze ainda vigente), e nova seção de critérios permanentes (Etapa 7). Ver arquivo.

## Etapa 7 — Critérios permanentes para todas as próximas sprints

Registrados em `MASTER_ROADMAP.md` (nova seção) para ficarem visíveis a qualquer sessão futura. Resumo: testes automatizados, homologação, documentação, backup quando aplicável e atualização do histórico técnico são obrigatórios em toda entrega — nenhum módulo será considerado concluído sem isso.

## Etapa 8 — Relatório final

**Resumo da preparação:** ~5 dias de trabalho (2026-07-03 a 2026-07-08) cobrindo segurança (correção de vazamento crítico de dados e de credencial), separação de ambientes, RBAC (3 de 5 sprints), Camada Repository, performance (2 de 6 fases) e preparação (não execução) de uma eventual migração SQL futura.

**Principais entregas:** ver Etapa 2.

**Métricas consolidadas:**
- Testes automatizados: 114/115 (99,1%), 1 falha pré-existente conhecida.
- Cobertura de módulo: 7 de 34 módulos com teste de RBAC; 0 de 34 com teste funcional completo.
- Documentação: `CRM/TECHDOC.md` com 25 seções técnicas; `PROXIMA_ETAPA.md` mantido atualizado a cada sessão.
- Percentual estimado de prontidão da plataforma (auditoria Go/No-Go): ~85%.

**Riscos aceitos:** ver Etapa 4 — todos não bloqueadores, com dono e prioridade sugerida.

**Pendências operacionais:** ver Etapa 4.

**Baseline da plataforma:** ver Etapa 3.

## Decisão final

# **GO**

A preparação da plataforma é considerada encerrada. A infraestrutura encontra-se apta para suportar o desenvolvimento dos módulos. As pendências remanescentes não impedem o avanço do roadmap e serão tratadas em paralelo conforme prioridade.
