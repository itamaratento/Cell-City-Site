# 🔍 AUDITORIA EXECUTIVA GERAL — Cell City CRM (2026-07-04)

> Este documento **complementa** `plans/AUDITORIA_GERAL_20260704.md` (concluída às 21:10 do mesmo dia, por outra sessão de trabalho). Em vez de repetir o que já foi levantado e validado lá, este relatório referencia essas seções e foca no que o escopo anterior não cobriu em profundidade: branches, TECHDOC, `plans/`, Cloud Functions, PWA, uma Fase de Qualidade dedicada, e um Plano Diretor com esforço/marcos/critérios de aceite por item. Método: leitura direta de código, `git log`, TECHDOC.md e `plans/*.md`. Nenhum arquivo de código foi alterado.
> Convenção de prioridade: 🔴 Crítica · 🟠 Alta · 🟡 Média · 🟢 Baixa.
> Achados de segurança com detalhe explorável continuam redigidos aqui (mesma política do relatório anterior) — ver `plans/AUDITORIA_GERAL_20260704_INTERNO.md` para o registro técnico completo.

---

## Resumo Executivo

O núcleo do sistema (OS, Caixa, Estoque, Financeiro, CRM Comercial, Dashboard) está funcional e em uso real. `main` e `develop` estão **sincronizadas byte a byte** (árvore idêntica, só hashes de commit diferentes por causa do squash merge). O `TECHDOC.md` é a única fonte de estado 100% atualizada (995 linhas, 16 seções, última alteração hoje às 19:37). O sistema **não tem nenhuma suíte de testes automatizados persistente** — toda validação até hoje foi manual ou via harness `jsdom` temporário, descartado após o uso. O alerta crítico do Portal do Cliente/OS pública (ver relatório anterior) segue sem correção e continua sendo o item de maior risco do projeto.

---

## FASE 1 — Visão Geral

**Percentual aproximado de conclusão:** reaproveitando o levantamento do relatório anterior (§11.1) — ~9% concluído/homologado, ~51% funcional sem pendência bloqueante, ~11% funcional com risco relevante, ~9%+ quebrado por bug/regra, ~17% não iniciado. Lendo isso como uma única métrica: o sistema está **~60% funcional na prática**, mas boa parte desse funcional carrega dívida de segurança/qualidade (RBAC granular em só 5 de 35 módulos, zero teste automatizado, 3 módulos que aparentam funcionar mas não funcionam).

**Arquitetura atual:** sem build step (HTML + ES modules nativos), `scripts/kernel.js` como bootstrap central de autenticação, `shared/` para código transversal, Firebase/Firestore como único backend. Detalhe completo em `AUDITORIA_GERAL_20260704.md` §5 (Fase 4 — Arquitetura) — não repetido aqui.

**Situação do projeto:** single-tenant (multiempresa foi revertido em 2026-06-27, não está nos planos ativos). Separação DEV/PROD concluída e promovida em 2026-07-03. Metodologia vigente desde a auditoria de hoje: um módulo por vez, ciclo completo (requisitos → implementação → testes → homologação → TECHDOC → produção) antes de abrir o próximo.

**Estado das branches** (`git branch -a -v`, checado agora):

| Branch | HEAD | Situação |
|---|---|---|
| `main` (atual) | `7194a4b` | Sincronizada com `origin/main`, working tree limpa |
| `develop` | `30ca433` | Árvore idêntica a `main` (confirmado via `git diff main develop` vazio) |
| `refactor-dashboard-modular` | `a889fe4` | Conteúdo já absorvido em `develop`/`main` (refatoração do Dashboard já mergeada) — candidata a remoção |
| `fix-h009-iframe-caixa-dev-path` | `23fc15c` | Commit já presente em `develop`/`main` — candidata a remoção |
| `fase5-env-config`, `fix-bl006-usuarios-escalada`, `fix-h002-favoritos-sw`, `fix-h003-login-redirect`, `fix-h004-gate-dev`, `fix-h005-config-login`, `fix-h006-rbac-guards`, `fix-h008-kernel-import-path` | várias | Correspondem a itens que o TECHDOC já documenta como corrigidos e promovidos (H-002 a H-008, BL-006, Fase 5 ambiente). O diff bruto contra `develop` não é vazio (squash merge altera o hash e o diff literal), então não dá para confirmar 100% automaticamente que não sobrou nada pendente — recomenda-se revisão rápida do dono antes de apagar, mas são fortes candidatas a limpeza de branches locais órfãs. |

**TECHDOC.md:** 995 linhas, 16 seções (Arquitetura → Autenticação → Central de Alertas → Catálogo de Módulos → Template de Entrega → Usuários e Permissões → RBAC Fase 2 → Histórico → Ambientes → Backup → Restauração → Promoção → Versionamento → Cloud Functions → Refatoração Dashboard → H-009). Última alteração: hoje, 19:37, registrando a promoção do H-009. Confirma o achado do relatório anterior: é a **única** documentação de estado 100% corrente — `PROXIMA_ETAPA.md`/`MASTER_ROADMAP.md` seguem desatualizados desde 02/07.

**Situação de `plans/`** (29 arquivos):
- **Corrente/ativo (2026-07-04):** `AUDITORIA_GERAL_20260704.md` + `_INTERNO.md`, `REFATORACAO_DASHBOARD_ETAPA1_MAPA.md`, e este documento.
- **Ciclo de segurança/ambientes/RBAC (2026-07-02/03), ainda referenciado ativamente:** `BACKLOG.md`, `FASE_3_LEVANTAMENTO.md`/`_VALIDACAO.md`, `FASE_4_LEVANTAMENTO.md`/`_VALIDACAO.md`, `PLANO_ACAO_RISCOS_CRITICOS_INTERNO.md (interno, não versionado desde 2026-07-06)`, `EXECUCAO_RISCOS_CRITICOS_INTERNO.md (interno, não versionado desde 2026-07-06)`, `VALIDACAO_FUNCIONAL_RISCOS.md`, `CONFERENCIA_FINAL_COLECOES.md`, `ENCERRAMENTO_AUDITORIA.md`, `SEPARACAO_AMBIENTES_DEV_PROD.md`, `HOMOLOGACAO_SEPARACAO_AMBIENTES.md`, `PLANO_OTIMIZACAO_PERFORMANCE_20260703.md`, `RELATORIO_COTA_FIRESTORE_20260702.md`, `fase2-sprint1/2/3-*-rbac.md`. Todos ainda válidos como registro histórico/plano em aberto.
- **🟡 Potencialmente obsoletos (24 dias, de 2026-06-10 — anteriores ao rollback de 27/06 que apagou o multiempresa):** `FAVORITOS_INTELIGENTES.md`, `MELHORIAS_OS.md`, `MELHORIA_CONTINUAR_PAREI.md`, `REORDENAR_FAVORITOS_DND.md`, `fase2-portal-admin.md`. Recomenda-se revisar relevância antes de reaproveitar qualquer um — podem descrever arquitetura que não existe mais.

**Pendências técnicas:** já priorizadas e listadas por completo em `AUDITORIA_GERAL_20260704.md` §4 (35 itens, 🔴🟠🟡🟢) — não repetidas aqui.

---

## FASE 2 — Inventário Completo dos Módulos

A tabela completa dos ~35 módulos (nome, status, % aproximado, o que falta, dependências, bugs) está em `AUDITORIA_GERAL_20260704.md` §2 e não é repetida aqui para não divergir de uma única fonte. Complemento com os 2 itens que faltavam no escopo anterior:

**Cloud Functions:** primeira e única infraestrutura de backend do projeto (implementada 2026-07-04). 1 função ativa: `excluirUsuarioAdmin` (`functions/index.js`, ~70 linhas, `onCall`, região `southamerica-east1`, runtime `nodejs20`). Resolve uma limitação real do client SDK (não é possível excluir a conta de outro usuário sem a senha dele) — a checagem de quem pode excluir (perfil admin/master_admin, proteção do último admin) é replicada no servidor porque a function roda com Admin SDK e ignora as Firestore Rules. Sem testes automatizados. Nenhuma outra function existe.

**PWA:** `CRM/manifest.json` completo (nome, ícones 192/512/1024, `display: standalone`, atalhos para Caixa e Análise). Service Worker principal `CRM/sw.js` (90 linhas) implementa só os 3 eventos básicos (`install`, `activate`, `fetch`) — cache simples, sem estratégia de atualização em background. Um segundo SW dedicado (`pages/dashboard/sw-alarme.js`) cuida só do alarme de nova OS, com escopo de registro limitado ao próprio path (decisão já documentada, H-002, por limitação do GitHub Pages em customizar `Service-Worker-Allowed`). **Background Sync e Periodic Sync não estão implementados no código vivo** — as únicas referências a essas APIs encontradas na árvore estão dentro de pastas `BACKUP_*` (código morto, não carregado). O app é instalável como PWA, mas não tem sincronização em segundo plano.

---

## FASE 3 — Fluxos do Sistema

| Fluxo | Status | Observação |
|---|---|---|
| Cadastro de Cliente | ⚠️ Parcial/disperso | Sem tela própria; cliente é criado inline ao abrir uma OS, dentro de `os.js` — `pages/clientes/` é config de impressão, não CRUD de cliente |
| Venda | ✅ Completo | Ocorre dentro do Caixa (`caixa.js`); baixa de estoque automática na confirmação |
| Ordem de Serviço | ⚠️ Funcional, com risco crítico | Fluxo ponta a ponta completo, mas dado sensível exposto publicamente (ver Alerta do relatório anterior) e sem RBAC (Sprint 5 não iniciado) |
| Compra | ⚪ Não iniciado | `pages/compras/` é placeholder puro; sobreposição conceitual com Fornecedores, ainda não decidida |
| Entrada de Estoque | ⚠️ Parcial | Ajuste de estoque existe (`estoque.js`, movimentação +), mas não há um fluxo formal de "recebimento de compra" — depende do módulo Compras, que não existe |
| Baixa de Estoque | ✅ Completo (automática) | Disparada pela Venda no Caixa; por decisão de produto já confirmada, **nunca** é bloqueada por permissão (mesmo com estoque negado, a baixa ocorre) |
| Caixa | ✅ Funcional | RBAC (Sprint 3) aplicado; aguardando homologação manual desde 02/07 |
| Financeiro | ⚠️ Funcional, sem controle de acesso | Sem RBAC/`kernel.js`; subcoleção `itens` sem regra Firestore (risco de quebra parcial) |
| Garantias | ⚠️ Funcional, com risco | `garantia.html` (pública) consome o mesmo documento `os` exposto no Alerta |
| Pós-venda | ✅ Completo | `pos-venda.js` funcional, alimenta a Central de Alertas |
| Portal do Cliente | 🔴 Parcial, com risco crítico | Funcional para o cliente final; painel administrativo (`admin.html`) sem gate de autenticação — ver Alerta do relatório anterior |

---

## FASE 4 — Banco de Dados

Coberto integralmente em `AUDITORIA_GERAL_20260704.md` §7 (Fase 6): ~59 coleções de nível raiz + 3 subcoleções, 11 sem regra explícita, 3 índices compostos existentes (só 1 usado de fato), 2 índices faltando com falha real já ocorrida, 1 coleção legada (`produtos`), 6 blocos de regra mortos, duplicação `firestore.rules` raiz vs `CRM/`. Nenhum achado novo nesta passada.

---

## FASE 5 — Segurança

Coberto integralmente em `AUDITORIA_GERAL_20260704.md` §9 (Fase 8) + Alerta no topo daquele documento. Classificação de risco já feita lá (🔴 exposição do Portal/OS; 🟠 chave hardcoded, credencial de deploy, `_BACKUPS`/`plans` públicos; 🟡 sessões anônimas do Portal, RBAC granular parcial). Nenhum achado novo de segurança nesta passada — o `functions/index.js` revisado nesta rodada não introduz segredo novo (checagem de permissão feita contra o Firestore, sem chave hardcoded).

---

## FASE 6 — Arquitetura

Coberto integralmente em `AUDITORIA_GERAL_20260704.md` §5 (Fase 4): acoplamento por convenção (Caixa/Estoque duplicam lógica), 3 mecanismos de identidade coexistindo, `shared/tenant.js` morto, coleção `config` genérica demais, fragmentação de `categorias_*`. Nenhum achado novo.

---

## FASE 7 — Desempenho

Coberto em `AUDITORIA_GERAL_20260704.md` §10 (Fase 9): pollers de 30s sem pausa em aba oculta, zero paginação, full-scan do `descontarEstoque`, `listener-manager.js` sem adoção. Complemento desta passada:

- **Tempo de carregamento:** não instrumentado (sem métrica de Web Vitals, sem `performance.mark`) — não há dado real, só a inferência indireta de que múltiplos `<script>` sem bundler/minificação aumentam o número de requisições por página.
- **Service Worker / cache:** estratégia mínima (só os 3 eventos básicos) — não há invalidação de cache versionada além do que já está no arquivo; atualização do app depende do ciclo padrão do navegador para SW.
- **Background Sync / Periodic Sync:** inexistentes no código vivo (ver Fase 2) — não avaliados como oportunidade nesta auditoria porque nenhuma funcionalidade atual depende de sincronização offline; registrar como possível item de backlog futuro, não pendência.

---

## FASE 8 — Qualidade (seção nova, não coberta pelo relatório anterior)

- **Cobertura de testes automatizados: zero.** Busca por `*.test.js`/`*.spec.js` em toda a árvore (exceto `node_modules`/`_BACKUPS`) não retornou nenhum arquivo. Não há suíte de testes persistente, nem configuração de test runner no `package.json` raiz.
- **Método de verificação real usado até hoje:** harness `jsdom` temporário — instalado como devDependency, usado para rodar o código real dos módulos contra Firebase mockado, e **removido na mesma sessão** (ver [[feedback-homologacao-sem-browser]] nas memórias do projeto). Funciona bem para validação pontual por sprint, mas não é reexecutável automaticamente nem roda em CI — cada sprint reconstrói o harness do zero.
- **CI configurado:** só há 1 workflow (`deploy-pages.yml`), que publica no GitHub Pages — não há workflow de teste/verificação automática rodando a cada push.
- **Áreas críticas sem teste automatizado persistente** (as mesmas que o `CLAUDE.md` §5 lista como obrigatórias de verificar manualmente a cada alteração): Login, Dashboard, CRM, Ordem de Serviço, Caixa, Estoque, Financeiro, Portal do Cliente. Toda a garantia de qualidade dessas áreas depende de teste manual humano + harness ad-hoc quando existe.
- **Funcionalidade implementada e testada automaticamente, mas sem homologação formal:** Sprint 3 do RBAC (Estoque + Caixa) — 12/12 cenários passaram no harness `jsdom` em 02/07, e segue **2 dias depois** aguardando homologação manual em navegador real. É o item de "qualidade pendente" mais antigo em aberto no projeto.
- **Módulos que precisam de revisão dedicada** (sintoma direto de não ter teste de regressão): os 3 módulos quebrados por incompatibilidade regra×código (Análise, Catálogo, Central de Organização) — nenhum alarme automático os sinalizou; foram encontrados só porque a auditoria de hoje leu o código manualmente. O mesmo vale para as 2 subcoleções sem regra Firestore (`financeiro_categorias/itens`, `portal-tecnico`).

---

## FASE 9 — Ranking de Prioridades

1. **Qual módulo deve ser desenvolvido primeiro?** Não é bem "desenvolver" — é **decidir e corrigir** a exposição do Portal do Cliente/OS pública (dado real de terceiro exposto agora). Alternativa de menor esforço: homologar formalmente o Sprint 3 do RBAC, que já está pronto.
2. **Qual módulo está mais próximo da conclusão?** Estoque (RBAC aplicado, o mais limpo do lote, só falta homologação manual) — junto com Caixa, ambos do mesmo Sprint 3.
3. **Qual módulo gera maior impacto operacional?** Caixa e Estoque (uso diário constante, ligados à venda) e Ordens de Serviço (núcleo do negócio, maior volume de dados).
4. **Qual módulo apresenta maior risco?** Portal do Cliente / fluxo de OS pública — único item com dado real de cliente exposto publicamente hoje.
5. **Qual sequência de desenvolvimento é recomendada?** Reaproveitando o cronograma já proposto em `AUDITORIA_GERAL_20260704.md` §11.3: (0) segurança do Portal/OS → (1) homologação Sprint 3 → (2) Sprint 4 RBAC (Financeiro) → (3) correção dos 3 módulos quebrados → (4) Sprint 5 RBAC (OS) → (5) higiene de segurança restante → (6) Fase 3 do Master Roadmap (Consolidação da Arquitetura).
6. **Quais pendências devem ser resolvidas antes de iniciar novos módulos?** As 7 pendências 🔴 críticas listadas em `AUDITORIA_GERAL_20260704.md` §4 — em especial a exposição do Portal/OS e os 2 subcoleções sem regra Firestore (baixo esforço, alto risco de estarem quebrando funcionalidade agora).

---

## FASE 10 — Plano Diretor

| Item | Esforço estimado | Dependências | Marco de entrega | Critério de aceite |
|---|---|---|---|---|
| 0. Corrigir exposição Portal do Cliente / OS pública | Médio (toca Auth + Rules; exige planejamento) | Decisão do dono sobre desenho do gate; nenhuma dependência técnica externa | Gate de autenticação no painel admin do Portal + regra de acesso à `os/{osId}` revista | Painel admin exige login válido; leitura de OS deixa de ser `if true`; homologação em 3 perfis (cliente legítimo, painel autenticado, visitante anônimo) sem regressão |
| 1. Homologar e aprovar Sprint 3 do RBAC (Estoque+Caixa) | Baixo (só homologação manual, já implementado e testado) | Nenhuma | Aprovação formal registrada no TECHDOC §7.3 | Zero regressão nos cenários já cobertos pelo harness `jsdom` (12/12), validado agora em navegador real |
| 2. Sprint 4 do RBAC — Financeiro | Médio-Alto (módulo sensível: aprovações, exclusões, auditoria) | Item 1 aprovado (ordem oficial do roadmap) | `shared/permissoes.js` integrado a `financeiro.js` + TECHDOC §7.4 | Mesmo critério dos sprints anteriores: permissões corretas, zero regressão, zero erro de console/Rules, auditoria funcionando |
| 3. Corrigir os 3 módulos quebrados (Análise, Catálogo, Central de Organização) | Baixo-Médio por módulo (causa já identificada em cada caso) | Nenhuma entre si — podem ser 3 ciclos curtos independentes | Regra Firestore criada/corrigida + funcionalidade voltando a retornar dado real | Cada módulo lê/grava dado real em produção (não mais silenciosamente vazio ou 100% negado) |
| 4. Regra para as 2 subcoleções sem proteção (`financeiro_categorias/itens`, `portal-tecnico`) | Baixo | Nenhuma | Regra publicada em `CRM/firestore.rules` | Leitura/escrita autorizada para o perfil correto, testado via emulador antes do deploy |
| 5. Sprint 5 do RBAC — OS | Alto (maior dependência entre módulos; tratar como integração crítica) | Sprints 1-4 aprovados | `shared/permissoes.js` integrado a `os.js` + TECHDOC §7.5 | Mesmo critério dos sprints anteriores; atenção especial a `runAutomacoesOS()` (OS→Agenda, OS→Financeiro) não vazar para módulos sem permissão |
| 6. Introduzir 1ª suíte de testes automatizados persistente | Médio (decisão de ferramenta + escrever os primeiros casos) | Nenhuma técnica; decisão do dono sobre investir nisso agora ou depois | Test runner configurado + cobertura inicial dos módulos críticos do CLAUDE.md §5 | Suíte roda localmente com 1 comando e (idealmente) em CI a cada push |
| 7. Limpar branches locais órfãs (`fix-h00X-*`, `fase5-env-config`, `refactor-dashboard-modular`) | Baixo | Confirmação do dono de que nada ficou pendente em cada uma | Branches removidas | `git branch -a` reflete só branches ativas |

---

## Relatório Executivo Final

**Estado geral:** sistema amplo e majoritariamente funcional no dia a dia, com disciplina de processo recente (desde 01/07) que ainda não cobre retroativamente todo o histórico. `main`/`develop` sincronizadas, TECHDOC corrente, ambientes DEV/PROD separados e estáveis.

**Maior risco:** exposição pública de dados reais de clientes via OS/Portal do Cliente — não corrigido, prioridade 0 segundo ambos os relatórios.

**Maior oportunidade de curto prazo:** homologar o Sprint 3 do RBAC (já pronto, só falta aprovação) — destrava o resto do roadmap de permissões com o menor esforço da lista.

**Lacuna estrutural mais nova identificada nesta rodada:** zero suíte de testes automatizados persistente — toda verificação até hoje foi manual ou via harness descartável. Não é urgente (não é um dos 5 gatilhos de interrupção), mas é uma dívida que cresce a cada módulo novo sem detecção automática de regressão.

**Módulos concluídos/homologados:** Usuários e Permissões, Central de Alertas, Dashboard.
**Módulos pendentes de maior destaque:** Portal do Cliente (risco crítico), Sprint 3 RBAC (homologação), Análise/Catálogo/Central de Organização (quebrados), Compras (não iniciado, decisão pendente vs. Fornecedores).

**Ordem recomendada:** ver Fase 10 acima — segurança do Portal primeiro, depois RBAC na ordem oficial do roadmap, depois correções pontuais, depois Fase 3 do Master Roadmap.

Este documento e `AUDITORIA_GERAL_20260704.md` juntos formam a referência oficial de estado do projeto em 2026-07-04. Nenhum código foi alterado na produção destes dois relatórios.

---

*Complemento conduzido em 2026-07-04, ~21:30. Fontes: `git log`/`git branch`/`git diff` ao vivo, `CRM/TECHDOC.md`, `functions/index.js`, `CRM/manifest.json`, `CRM/sw.js`, busca por testes automatizados na árvore, e o relatório `AUDITORIA_GERAL_20260704.md` (mesmo dia, sessão anterior).*
