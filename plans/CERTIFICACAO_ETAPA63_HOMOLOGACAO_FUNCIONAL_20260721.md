# ETAPA 6.3 — Certificação Final da Homologação Funcional (v3.2.0)

**Data:** 2026-07-21
**Branch:** `develop` @ `093ce41` (working tree com alterações locais não commitadas até o fechamento desta etapa)
**Tag `v3.2.0`:** `d650464` · `main`: `0ec12c0`
**Modo:** reconciliação e auditoria — **nenhuma correção de código/Rules/Functions/IAM aplicada nesta etapa**
**Sessões envolvidas:** duas linhas de trabalho concorrentes sobre o mesmo working tree (uma via Claude Code, outra via Cursor/agente que se autodenomina "ChatGPT" nos relatórios que produziu) — reconciliadas aqui em um único parecer.

---

## 1. Resumo Executivo

A Release v3.2.0 está **em produção e estável na parte de infraestrutura**
(deploy Firebase via CI, Rules/Functions endurecidas, LGPD, rate-limit,
pipeline WIF) — isso permanece 🟢, sem mudança nesta etapa.

A **homologação funcional** (Etapas 5 e 6, iniciada a pedido do dono após o
BL-008) chegou a um veredito diferente do que um resumo anterior ("relatório
mestre") havia comunicado. Refazendo a conferência item a item:

- **Etapa 5 (Smoke autenticado DEV): 🟢 aprovada**, com evidência real e
  reproduzida 3x (perfis `admin`/`tecnico` por esta sessão, perfil `admin`
  novamente por evidência gerada de forma independente).
- **Etapa 6 (RBAC Runtime multi-perfil): 🔴 reprovada inicialmente**
  (reclassificada 🟢 após a decisão arquitetural do dono — ver §13), com
  evidência real — não por falha de infraestrutura, mas por um **achado de
  arquitetura pré-existente**: as Firestore Rules de várias coleções de
  negócio não verificam a matriz de `perfis_operacionais`
  (criar/editar/excluir/aprovar), só autenticação + conta ativa + mesma
  empresa. Isso não é uma regressão introduzida por esta release nem por
  este código novo — é uma característica do modelo atual, e a Etapa 6 foi
  a primeira vez que ela foi **medida e documentada** com evidência de
  navegador real.
- Uma afirmação anterior de que a causa raiz teria sido "contaminação de
  variáveis de ambiente apontando para produção" **não foi confirmada** por
  nenhuma evidência encontrada (ver §3.1) — não deve ser tratada como
  incidente real.

**Status oficial combinado (atualizado ETAPA 6.2-C):** 🟢 **modelo de
autorização = Alternativa A** (ADR-AUTH-001). B3/BL-011 reclassificados
como decisão arquitetural / dívida consciente. Produção intocada.
Critérios da ETAPA 6: UI+tenant; **não** exige matriz nas Rules.

---

## 2. Cronologia (Etapa C)

| Quando | Evento | Commit/Artefato |
|--------|--------|------------------|
| 2026-07-19 13:30 | Release v3.2.0 fechada (Fase 4 encerrada) | `d650464` (tag) |
| 2026-07-19 13:38 | Docs pós-CI verde arquivados | `0ec12c0` (HEAD de `main`) |
| 2026-07-21 07:51 | BL-008 corrigido (parser TAP/spec do harness + bug em `audit.mjs`) | `d5c38b7` |
| 2026-07-21 ~07:47–08:29 | Diagnóstico de IAM (leitura) + Smoke DEV real 2x (perfis `admin`, `tecnico`) — nenhum defeito de IAM encontrado | `evidencias/20260721-07*`, `evidencias/20260721-082*` |
| 2026-07-21 08:31 | `PROXIMA_ETAPA.md` atualizado com o estado pós-BL-008 | `093ce41` (commit, push feito) |
| 2026-07-21 08:31 | Smoke DEV real repetido de forma independente (perfil `admin`) por outra sessão | `evidencias/20260721-083049/` |
| 2026-07-21 08:39–08:44 | Rascunho de doc (nunca commitado) com narrativa de "contaminação de ambiente" | uncommitted (revertido nesta etapa) |
| 2026-07-21 08:42–08:47 | Harness novo de RBAC Runtime construído e executado (5 de 6 perfis) | `evidencias/etapa6-rbac-runtime-20260721-084209/` — veredito 🔴 REPROVADA |
| 2026-07-21 08:49–09:52 | Diagnóstico de remediação (Etapa 6.1): causa raiz de B1/B2/B3, 3 pacotes de correção propostos, nenhuma alteração aplicada | `evidencias/etapa61-remediacao-20260721/` |
| 2026-07-21 09:52–10:0x | Confirmação de estabilização do workspace (nenhum processo novo por 45s) | esta etapa |
| 2026-07-21 (agora) | Etapa 6.3 — reconciliação e certificação final | este documento |

Nenhum commit novo em `develop`/`main` além de `d5c38b7` e `093ce41` — todo o
trabalho de Etapa 6/6.1 está em arquivos não rastreados (`evidencias/`,
gitignored) e em edições locais não commitadas nos três documentos
(`TECHDOC.md`, `PROXIMA_ETAPA.md`), reconciliadas agora.

---

## 3. Achados — auditados individualmente (Etapa D)

Critério: cada item abaixo só é registrado como achado se houver evidência
verificável (log, código, screenshot ou JSON de resultado). Onde não há,
está marcado como **NÃO COMPROVADO**.

### 3.1 — "Contaminação de variáveis de ambiente apontando para produção" — **NÃO COMPROVADO**

Buscado em todos os logs, `browser.json`, `tests.json`, screenshots e
consoles de rede gerados nesta sessão (2026-07-21): nenhuma chamada real ao
projeto `cellcity-crm` (produção) foi encontrada; nenhum erro
`PERMISSION_DENIED`/projeto errado aparece em nenhum artefato. O único
lugar onde essa hipótese aparece é uma guarda defensiva
(`throw new Error('ABORT...')` se `GOOGLE_CLOUD_PROJECT` ≠
`cellcity-crm-dev`) adicionada por precaução ao script novo de RBAC Runtime
— e os logs mostram que essa guarda **nunca disparou** em nenhuma execução.
Conclusão: hipótese razoável como precaução de engenharia, mas **não é um
incidente confirmado**. Não deve constar como fato histórico em TECHDOC.

### 3.2 — IAM da Service Account DEV — **DESCARTADO como problema, com evidência**

- Roles de projeto (`iam.serviceAccountTokenCreator`, `firebaseauth.admin`,
  `firebase.admin`, `firebase.sdkAdminServiceAgent`) confirmadas via
  `gcloud projects get-iam-policy cellcity-crm-dev` (saída bruta arquivada
  nesta sessão).
- APIs (`iamcredentials`, `identitytoolkit`, `securetoken`, `iam`)
  confirmadas `ENABLED` via `gcloud services list`.
- `createCustomToken` funcionando: confirmado 3x em navegador real
  (`admin` x2, `tecnico` x1), zero erro de console, zero erro de IAM.

### 3.3 — Smoke autenticado DEV (Etapa 5) — **APROVADO, com evidência**

3 execuções reais e independentes (`evidencias/20260721-082854/`,
`evidencias/20260721-083049/`, mais uma anterior): login, Dashboard,
Central de Alertas, cache/offline/reconexão e multiaba todos ✅, com
screenshots. Não coberto pelo harness atual: logout explícito e escrita
controlada (ausência documentada, não falha).

### 3.4 — RBAC Runtime multi-perfil (Etapa 6) — **REPROVADO, com evidência**

Harness novo (`run-matriz.mjs`) testou 5 de 6 perfis em navegador real
contra `cellcity-crm-dev` (login OK nos 5, zero erro de console). Achados
confirmados por leitura direta dos dados brutos (`matriz-runtime.json`,
`inventario-perfis.json`) e do código-fonte, não apenas aceitos do
relatório de origem:

- **B1 — Perfil "Sem permissão" inexistente no DEV.** Confirmado:
  `perfis_operacionais` tem 7 registros (Administrador, Atendimento, Caixa,
  Comercial11, Estoque, Financeiro, Técnico), nenhum com matriz vazia/
  restrita. Criar um está fora do escopo autorizado desta etapa — o script
  corretamente pulou o teste em vez de fabricar a condição.
- **B2 — Gerente sem `perfil_operacional_id`.** Confirmado via
  `diagnostico-b1-b2.json`: usuário `cellcitygerente@gmail.com`
  (UID `w6s8K7bxTKShF2apJCK5zOZZ4Bi2`, criado 2026-07-03 na separação de
  ambientes) tem `perfil_operacional_id: null`. `CRM/shared/permissoes.js`
  trata ausência desse campo como fail-open (compatibilidade legada) —
  **classificação: erro de seed/migração de homologação, não bug de
  runtime**.
- **B3 — Firestore Rules não impõem a matriz operacional de CRUD.**
  **Verificado por leitura direta do código nesta sessão** (não apenas
  aceito do relatório):
  - [`CRM/firestore.rules:112-126`](../CRM/firestore.rules#L112-L126) — `create`/`update`/`delete`
    de `os` exigem só `temAcessoLiberado()` (linhas 18-21: usuário existe e
    `perfil != 'pendente'`) + mesma empresa.
  - Mesmo padrão (`auth + temAcessoLiberado + mesmaEmpresa*`) confirmado nas
    demais coleções de negócio citadas pela Etapa 6.1 (`financeiro_*`,
    `caixa_lancamentos`, `estoque_*`) — não re-verificado linha a linha por
    esta sessão, aceito com base na convenção de código já confirmada em
    `os` (mesmo autor/padrão de Rules, alta probabilidade de consistência,
    mas **recomenda-se confirmação explícita antes de qualquer correção**).
  - Evidência de exploração real: perfis Técnico/Atendente/Financeiro
    conseguiram `create`+`delete` de um documento de teste em `os` via
    client SDK, mesmo com a matriz de UI restringindo essas ações para
    alguns desses perfis.
  - **Não é regressão desta release** — é uma característica do modelo
    (Rules = tenant + auth; matriz = camada de UI) documentada
    implicitamente desde a Fase 2 (RBAC aplicado nos módulos), nunca
    formalizada como decisão consciente nem contestada até esta etapa.

### 3.5 — Observação adicional (não elevada a achado formal nesta etapa)

Nos dados brutos da Etapa 6 (`matriz-runtime.json`), o perfil Financeiro
(`cellcityfinanceiro@gmail.com`) acessou `/CRM/pages/usuarios-permissoes/`
com HTTP 200 e `hasGateMsg: false` (nenhuma mensagem de bloqueio na
página). Isso **pode** ser: (a) a página carrega mas restringe ações
sensíveis internamente via JS, o que seria o comportamento esperado; ou
(b) um gate de rota ausente para essa página. **Não investigado a fundo
nesta sessão** — recomienda-se checagem pontual antes de fechar B3
definitivamente, mas não bloqueia o parecer desta etapa.

---

## 4. Matriz de Riscos (Etapa E)

Classificação só onde há evidência desta sessão ou de sessões anteriores já
documentadas; áreas sem evidência nova ficam marcadas como tal (não
inventadas).

| Área | Classificação | Base |
|------|---------------|------|
| RBAC (matriz operacional × Rules) | 🔴 **ALTO** | §3.4 — B3, confirmado no código |
| Firestore Rules (tenant/auth) | 🟢 baixo | Isolamento de tenant e auth confirmados funcionando (Etapas 5/6) |
| IAM (Service Account DEV) | 🟢 baixo | §3.2 — descartado como problema |
| Deploy / Pipeline CI (WIF) | 🟢 baixo | Já homologado Fase 4.3, sem mudança nesta etapa |
| Cloud Functions | 🟢 baixo | 16/16 prod==repo (Fase 4.3), sem mudança nesta etapa |
| Storage | ⚪ não avaliado | Bucket não existe (BL-009), sem evidência nova |
| Rate Limit | 🟢 baixo | Endurecido na Fase 4.1, sem mudança nesta etapa |
| LGPD | 🟢 baixo | `cpfMascarado` endurecido na Fase 4.1, sem mudança nesta etapa |
| Portal do Cliente | ⚪ não avaliado nesta etapa | Sem evidência nova |
| Dashboard | 🟢 baixo | Testado 3x em navegador real, 0 erro de console |
| Financeiro | 🟡 **MÉDIO** | Mesmo padrão de Rules do achado B3 (não re-verificado linha a linha) |
| CRM / clientes | 🟡 **MÉDIO** | Idem — citado na Etapa 6.1, não re-verificado por esta sessão |
| OS (Ordens de Serviço) | 🔴 **ALTO** | B3 confirmado diretamente no código |
| Estoque | 🟡 **MÉDIO** | Mesmo padrão citado, não re-verificado |
| Agenda | ⚪ não avaliado nesta etapa | Sem evidência nova |
| Portal Técnico | ⚪ não avaliado nesta etapa | Sem evidência nova |

---

## 5. Firestore Rules — modelo esperado × implementado (Etapa F)

| Camada exigida | Implementada? | Evidência |
|-----------------|----------------|-----------|
| 1. Tenant Isolation | **SIM** | `mesmaEmpresaRead()`/`mesmaEmpresaCreate()`/`empresaImutavel()` presentes em todas as coleções de negócio revisadas |
| 2. Authentication | **SIM** | `request.auth != null` em todas as rules revisadas |
| 3. RBAC (perfil legado admin/master_admin) | **SIM** | `isMasterAdmin()` e checagens de `perfil` presentes em coleções administrativas (`usuarios`, `perfis_operacionais`) |
| 4. Perfil Operacional (`perfil_operacional_id`) | **NÃO** | Nenhuma rule revisada consulta `perfis_operacionais` ou `perfil_operacional_id` |
| 5. CRUD granular por módulo | **NÃO** | `create`/`update`/`delete` de `os` (e, por padrão consistente, `financeiro_*`/`caixa_*`/`estoque_*`) não diferenciam ação por perfil |
| 6. Matriz funcional completa (UI = Rules) | **PARCIAL/NÃO** | A matriz existe e funciona na UI (`permissoes.js`); não tem equivalente em Rules |

**Justificativa consolidada:** as Rules atuais implementam corretamente
autenticação, isolamento de tenant e o RBAC administrativo original
(perfil legado). O RBAC operacional granular (Fase 1-2, `perfis_operacionais`)
foi construído e aplicado na camada de aplicação (UI), mas nunca propagado
às Rules. Isso não é um bug de código introduzido recentemente — é uma
lacuna arquitetural presente desde a introdução da matriz operacional.

---

## 6. Decisão Arquitetural (Etapa G)

### Alternativa A — Rules = Tenant + Authentication; RBAC granular só na camada de aplicação (status quo)

- **Vantagens:** zero mudança de código/Rules; zero risco de regressão; Rules mais simples e baratas (menos `get()`); é o modelo já em produção hoje.
- **Desvantagens:** um usuário técnico com token válido pode contornar a UI e agir fora da matriz operacional via chamada direta ao Firestore (mesma classe do BL-006, já tratado como crítico quando encontrado em `usuarios/{uid}`).
- **Riscos:** dependente do perfil de ameaça aceito pelo dono — exige usuário autenticado da mesma empresa (não é acesso anônimo/cross-tenant), mas não impede abuso por um funcionário mal-intencionado ou uma sessão comprometida.
- **Impacto de adoção:** nenhum — é só formalizar por escrito o que já está implementado, fechando BL-011 como "aceito conscientemente" (pacote 6.2-C da Etapa 6.1).

### Alternativa B — Rules replicam a matriz operacional completa

- **Vantagens:** fecha o gap de segurança de forma definitiva; UI e backend passam a ser consistentes; alinhado ao princípio "Rules são a fonte real de verdade" já usado para justificar a correção do BL-006.
- **Desvantagens/Complexidade:** exige helper novo em Rules (`get(perfis_operacionais/{id}).data.permissoes.{modulo}.{acao}`) aplicado em toda coleção de negócio com CRUD por staff; aumenta o número de leituras (`get()`) por operação (custo Firestore, relevante dado o histórico de estouro de cota do projeto — Fase 3, 2026-07-02); risco de falso negativo (negar operação legítima) se a matriz estiver incompleta para algum perfil (ex.: o próprio caso do Gerente, B2).
- **Segurança:** a mais forte das três.
- **Impacto de adoção:** alto — mexe em `CRM/firestore.rules` (arquivo sensível, módulo crítico), exige testes completos no emulador antes de publicar, e autorização explícita do dono (mesmo processo formal do BL-006).

### Alternativa C — Modelo híbrido

- **Separar:** dados/coleções de baixo risco (leitura, configuração) continuam no modelo atual (tenant+auth); operações críticas (exclusão de OS, lançamentos financeiros, movimentação de estoque com valor) passam a checar a matriz; operações comuns (criar/editar rotineiro) permanecem no modelo atual.
- **Vantagens:** reduz o escopo de mudança e o custo de `get()` extra a só os pontos de maior risco; caminho incremental testável módulo a módulo (alinhado ao princípio "um módulo por vez" do projeto).
- **Desvantagens:** exige definir e documentar, por coleção/ação, qual é "crítica" — decisão de negócio, não só técnica.
- **Riscos:** menor que B, maior que A.

### Recomendação técnica (na época desta certificação)

**Alternativa C** era a recomendação técnica *ex ante*. O dono, via
**ETAPA 6.2-C**, formalizou **Alternativa A** — ver adendo §13.

---

## 7. Reconciliação Documental (Etapa H) — o que foi feito

- `PROXIMA_ETAPA.md`: seção "ESTADO ATUAL" reescrita para 2026-07-21,
  removendo a narrativa não comprovada de "contaminação de ambiente" e
  incorporando o veredito real da Etapa 6/6.1 (🔴 → pendente de decisão),
  com ponteiro para este documento. Histórico anterior (Fase 4.2, thread
  SaaS) preservado sem reescrita.
- `CRM/TECHDOC.md`: §48 (BL-008) mantido sem alteração; nova §49 aponta
  para este documento como registro oficial da Etapa 6/6.1/6.3.
- `plans/BACKLOG.md`: novo item **BL-011** registrado com o achado B3 (Rules
  × matriz), as 3 opções de correção da Etapa 6.1 e a recomendação técnica
  acima — sem nenhuma alteração de Rules aplicada.
- Nenhuma duplicação mantida: os relatórios brutos (`RELATORIO_ETAPA6.md`,
  `RELATORIO_ETAPA61.md`) permanecem como evidência primária em
  `evidencias/`; os documentos oficiais (`TECHDOC`/`PROXIMA_ETAPA`/
  `BACKLOG`) só referenciam e resumem, não copiam o conteúdo integral.

## 8. Consistência Global (Etapa I)

Nenhuma contradição encontrada entre código, evidências e documentação após
a reconciliação acima, com uma ressalva registrada explicitamente: o
"relatório mestre" recebido em texto (attribuído a "ChatGPT") havia
classificado a release como "🟡 evidências suficientes, sem pendências
bloqueantes" e o RBAC como "cobertura parcial com forte evidência
funcional" — uma leitura mais favorável do que o próprio veredito do
relatório técnico de origem (`RELATORIO_ETAPA6.md`: 🔴 REPROVADA). Esta
certificação adota o veredito do relatório técnico (evidência primária),
não o resumo em texto.

---

## 9. Status Oficial da Release

```
🟢 HOMOLOGAÇÃO FUNCIONAL CONCLUÍDA
Modelo de autorização documentado: Alternativa A (ETAPA 6.2-C / ADR-AUTH-001)
```

- Infraestrutura/deploy/pipeline/segurança de Rules (Fase 4): 🟢 concluído, em produção, sem mudança.
- Smoke autenticado DEV (Etapa 5): 🟢 aprovado.
- Dados DEV 6.2-A: 🟢 Sem permissão + Gerente vinculado.
- RBAC Runtime (Etapa 6 → 6.3): 🟢 aprovado sob os critérios oficiais do ADR — achado B3 **reclassificado** de bug para decisão arquitetural (Alternativa A); BL-011 = dívida consciente, não bloqueador.

Produção permanece **intocada** por esta certificação e pela 6.2-C
(documentação apenas).

---

## 10. Backlog (referência — ver `plans/BACKLOG.md` para o texto oficial)

| Item | Status |
|------|--------|
| BL-007 — nodejs22 (Cloud Functions) | ⏳ prazo 2026-10-30; exige autorização |
| BL-008 — parser do harness (TAP vs spec) | ✅ corrigido |
| BL-009 — bucket Firebase Storage (Blaze) | ⏳ decisão administrativa |
| BL-010 — ruleset GitHub / deploy key | ⏳ ação manual do dono |
| **BL-011 — Rules ≠ matriz operacional** | 🟡 ADR-AUTH-001 **Alternativa A** — dívida consciente; 6.2-B só com autorização |

---

## 11. Próximas Etapas

1. ~~Decisão BL-011 / 6.2-C~~ ✅ **Alternativa A** ([ADR-AUTH-001](ADR_AUTH_001_MODELO_AUTORIZACAO_20260721.md)).
2. ~~6.2-A~~ ✅ dados DEV provisionados.
3. (Opcional) Fechar formalmente 🟢 homologação funcional com critérios do ADR.
4. BL-007/009/010 — dono. **Não** abrir 6.2-B sem autorização de Rules.

---

## 12. Checklist Final

- [x] Workspace estabilizado antes da leitura (Etapa A)
- [x] Todas as evidências revisadas (Etapas B/C/D)
- [x] Cronologia consolidada
- [x] Documentação reconciliada (`TECHDOC`/`PROXIMA_ETAPA`/`BACKLOG`)
- [x] Firestore Rules avaliadas (com ressalva: `financeiro_*`/`caixa_*`/`estoque_*` aceitos por padrão de código, não relidos linha a linha)
- [x] Arquitetura documentada (3 alternativas + recomendação)
- [x] Riscos classificados (com áreas marcadas como não avaliadas, não inventadas)
- [x] Pendências identificadas (BL-011 + backlog existente)
- [x] Parecer emitido

**Nenhuma ação de deploy, merge, tag, alteração de Rules, Cloud Functions,
IAM ou produção foi executada ou autorizada por este documento.**

---

## 13. Adendo — ETAPA 6.2-C (2026-07-21)

**Decisão oficial do dono:** ☑ **Alternativa A**

Documento: [`ADR_AUTH_001_MODELO_AUTORIZACAO_20260721.md`](ADR_AUTH_001_MODELO_AUTORIZACAO_20260721.md) · TECHDOC §50 · evidência
`evidencias/etapa62c-decisao-arquitetural-20260721/`.

B3 / BL-011 = **decisão arquitetural documentada**, não bug bloqueador.
ETAPA 6.2-B **não** iniciada.
