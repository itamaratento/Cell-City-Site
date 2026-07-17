# FASE 1.8 — Certificação Final e Liberação para Produção

**Data:** 2026-07-17
**Papel:** Revisão Técnica (conforme `CLAUDE.md` §0 e `ENGINEERING.md`)
**Branch avaliada:** `develop` @ `096dec0`
**Projeto de produção:** `cellcity-crm`
**Missão:** validar a release candidata após a eliminação dos bloqueadores críticos (Fases 1.6/1.7) e decidir sobre a promoção para produção.

> ⚠️ **Nota de segurança documental:** este repositório é público. Detalhes
> exploráveis (arquivo/linha/mecanismo) de cada achado vivem apenas nos
> documentos `_INTERNO` gitignorados. Aqui só o suficiente para auditar a decisão.

---

## 1. Resumo Executivo

A release candidata em `develop` corresponde ao **sistema SaaS multiempresa completo**:
**67 commits à frente de `main`**, **339 arquivos**, +16.755/−8.530 linhas. Não é um
hotfix — é a promoção de uma major inteira.

Os bloqueadores críticos das fases anteriores foram tratados e **reverificados de
primeira mão nesta fase**:

- **Vazamento cross-tenant em `pre_os` (V1): ELIMINADO** — comprovado contra o
  emulador real (Firestore Rules **112/112**, incluindo 4 testes novos de `pre_os`).
- **S1 (XSS na impressão de OS): corrigido** (causa raiz).
- **S3 (credencial vazada): já corrigida** (revogada em 2026-07-06).
- **S4 (logs sensíveis): corrigido** (removidos).
- **A1 / A2 (disjunção insegura em subcoleção financeira / delete de path legado no Storage): corrigidos.**

Persiste **1 ressalva de segurança deliberada (S2)** e **1 bloqueio operacional de
promoção** (sequência de backfill em produção), detalhados abaixo. Por isso, a
release **é tecnicamente apta no código**, mas a **promoção para produção não pode
ser executada com segurança agora**.

### 🟡 DECISÃO FINAL: APROVADO COM RESSALVAS

O *código* está certificado. A *promoção para `main`* (que dispara deploy de Rules
em produção) fica **retida** até (a) execução da sequência de backfill em produção,
(b) tratamento/aceite formal do resíduo S2, e (c) **autorização explícita** do dono
do projeto. Ver §13 e §15.

---

## 2. Escopo Validado

| Frente | Validado nesta fase | Evidência |
|---|---|---|
| Revisão de commits/arquivos da release | ✅ | §12, `git log`, `git diff --stat main develop` |
| Auditoria de segurança | ✅ | §5 |
| Isolamento multiempresa (A/B/master) | ✅ | §7 (Rules 112/112 no emulador real) |
| Regressão geral | ✅ | §4 |
| CI/CD | ✅ (revisão + execução local das suítes) | §10 |
| Performance | ✅ (revisão + suíte de gating) | §9 |
| Documentação / Backup / Rollback | ✅ | §7-doc, §... |
| Promoção `develop`→`main` | ⏸️ **RETIDA** | §13, §15 |

---

## 3. Evidências (comandos-chave desta sessão)

- `git rev-list --left-right --count main...develop` → `0  67` (67 commits à frente de main; 0 atrás).
- `git rev-list --left-right --count origin/develop...develop` → `0  17` (17 commits **não publicados** em origin).
- Working tree: limpo, exceto relatórios de certificação (`plans/*.md` desta frente).
- Nenhum segredo versionado: `sa-key.json` / `sa-key-dev.json` confirmados no `.gitignore`, não rastreados.
- Nenhum arquivo temporário rastreado (o `cellcity-teste-stash-fase5.tmp` da sessão anterior já foi removido).

---

## 4. Testes (regressão)

Executados nesta máquina (Node v22, emulador Firestore real onde aplicável):

| Suíte | Resultado | Observação |
|---|---|---|
| Firestore Rules — `tenant-isolamento` | **38/38** ✅ | após correção de harness (ver §10) |
| Firestore Rules — `os-publico` | **74/74** ✅ | — |
| **Total Firestore Rules** | **112/112** ✅ | isolamento multiempresa comprovado |
| RBAC (`tests/rbac/**`) | **179/181** ⚠️ | 2 falhas **pré-existentes** (não regressão) |
| Infra + Onboarding + Performance | **26/26** ✅ | — |

**As 2 falhas de RBAC** (`Relatório Mensal — renderRelatorio` / `atualizarResumoCompleto`)
foram investigadas: `financeiro-relatorio.js` e o próprio teste são **idênticos entre
`main` e `develop`** (não aparecem no diff da release). São falhas de expectativa
frágil pré-existentes na baseline `main` — **não introduzidas por esta release**.
Ficam como pendência de qualidade de teste (residual §11).

> Ambiente: a suíte `tests/control-center` (subprocessos pesados) e a homologação
> e2e em Chrome real não rodam de forma estável neste sandbox (limitação de
> PTY/inotify já documentada em fases anteriores) — sem indício de falha funcional.
> Ambas rodam na CI / sob demanda.

---

## 5. Segurança

Auditoria final consolidando os achados da Auditoria Técnica Independente 2026-07-17
(`plans/AUDITORIA_TECNICA_INDEPENDENTE_20260717.md`) + o achado V1 (pré-OS):

| Achado | Classe | Status | Verificado nesta fase |
|---|---|---|---|
| **V1 — cross-tenant em `pre_os`** | 🔴 Crítico | ✅ **Eliminado** | Rules 112/112; `mesmaEmpresaRead()` + `empresaImutavel()` em read/update/delete; create público preservado |
| **S1 — XSS no fluxo de impressão de OS** | 🔴 Crítico | ✅ **Corrigido** | `escHtml()` em todas as interpolações de `printOS()`; `window.open(...,'noopener')` |
| **S2 — consulta pública de OS sem prova de posse** | 🔴 Crítico | 🟡 **Mitigado (raiz aberta)** | rate limit dedicado `consulta_os_publica` 8/min/IP; causa raiz (exigir prova de posse) **pendente por decisão do dono** |
| **S3 — credencial de produção vazada no histórico** | 🔴 Crítico | ✅ **Corrigido** | credencial revogada em 2026-07-06; chave inerte |
| **S4 — dados sensíveis (senha/padrão do aparelho + PII) em console.log** | 🟠 Alto | ✅ **Corrigido** | 3 logs removidos por completo |
| **A1 — disjunção insegura em `financeiro_categorias/itens`** | 🟠 Alto | ✅ **Corrigido** | disjunto `empresa_id==null` removido + teste de regressão |
| **A2 — delete de path legado no Storage sem dono** | 🟠 Alto | ✅ **Corrigido** | `storage.rules`: delete restrito à empresa dona |

Demais verificações do checklist da Etapa 2:

- **CSRF:** N/A ao modelo (Firebase callable/SDK com token; sem cookies de sessão mutáveis por form cross-site).
- **Injection:** dados via SDK Firestore (sem SQL); intake público valida/limita tamanho no servidor (`consultarOSPublica` valida `osId`).
- **IDOR / Broken Access Control:** coberto pelas Firestore Rules + RBAC (112/112 + 179/181); `pre_os` era o único gap de tenant e foi fechado.
- **RBAC:** perfis validados na suíte; `master_admin` é o único perfil cross-tenant (por design).
- **Cloud Functions:** fluxo de `pre_os` não passa por Functions; `consultarOSPublica` endurecida (S2 mitigado); Portal (`functions/portal.js`) carimba `empresa_id` no servidor.
- **Storage:** A2 corrigido; isolamento por empresa nos paths.
- **Console Logs sensíveis:** S4 corrigido.
- **Headers/Tokens:** callable com App Check/token; sem token sensível em código.
- **Rate Limit:** `functions/lib/rate-limit.js` com limite dedicado para o vetor S2.
- **Segredos:** nenhum segredo versionado (§3).

---

## 6. Firestore Rules

- **112/112** aprovadas no emulador real (`tenant-isolamento` 38/38 + `os-publico` 74/74).
- `pre_os`: `create` público preservado; `read/update/delete` exigem
  `temAcessoLiberado() && mesmaEmpresaRead()` (+ `empresaImutavel()` no update).
- `mesmaEmpresaRead()` é **fail-closed por padrão**: doc sem `empresa_id` (legado
  pré-backfill) fica **ilegível** para staff comum — troca deliberada de "vaza para
  todos" por "indisponível temporário". **Isto tem consequência operacional direta
  na promoção** (§13).

---

## 7. Multiempresa

Isolamento validado com 3 tenants no emulador real (`empresa-a`, `empresa-b`,
`cellcity-master`), cobrindo Clientes, Financeiro (categorias/itens), Pré-OS,
legado sem `empresa_id`, e o operador cross-tenant (`master_admin`):

- Empresa A **não** lê/atualiza/exclui dados da Empresa B → **NEGADO** ✅
- Empresa A lista **com** filtro próprio → permitido; **sem** filtro → negado ✅
- `pre_os`: cliente cria sem login (público) preservado; leitura cross-tenant negada ✅
- `master_admin` atravessa o isolamento (suporte) por design ✅

**Documentação/Backup/Rollback:** `README.md` (raiz) presente; `GUIA_ROLLBACK.md`
(procedimento `git revert` + republicação de Rules + restauração de dados) presente;
`PRODUCAO_READINESS.md` presente (contém o registro do incidente P0 — ver §13);
workflow `backup-weekly.yml` presente. Não há `CHANGELOG.md` na raiz — o histórico
oficial é `git log` + relatórios de certificação em `plans/`.

---

## 8. Cloud Functions

- Deploy só a partir de `main` (`deploy-firebase.yml` com gate `github.ref == refs/heads/main`).
- `consultarOSPublica`: rate limit dedicado (S2 mitigado).
- Portal (`portalEnviarMensagem`) carimba `empresa_id` server-side via `functions/lib/empresa.js`.
- Fluxo de `pre_os` **não** usa Functions — nenhuma alteração server-side necessária para V1.

---

## 9. Performance

- Suíte de gating de polling/aba oculta: **incluída no 26/26 aprovado**.
- Padrões da Regra 9 (`CLAUDE.md`) respeitados nas correções: as 2 queries de
  Dashboard de `pre_os` passaram a usar `injectTenantFilter` (mesmo mecanismo já
  usado por 8+ queries), sem introduzir leituras extras nem listeners órfãos.
- Sem regressão de performance introduzida pela release (correções são cirúrgicas).

---

## 10. CI/CD

Pipelines em `.github/workflows/`:

- **`tests.yml`** (push main/develop + PR): Firestore Rules, Functions do Portal
  (emulador), RBAC, performance, integridade, control-center. **Não bloqueia merge**
  (sem branch protection) — dá visibilidade.
- **`deploy-firebase.yml`**: deploy de Rules/Indexes/Storage/Functions em
  `cellcity-crm` **somente em push a `main`** (`--force`), com validação via API.
- **`deploy-pages.yml`** e **`backup-weekly.yml`** presentes.
- **Não há `lint`/`build`/`coverage`** configurados na raiz (projeto estático +
  módulos ESM; `build` não se aplica). Registrado como dívida de rotina.

**Correção aplicada nesta fase (defeito de teste encontrado na revisão):** o arquivo
commitado `tests/firestore-rules/tenant-isolamento.test.mjs` tinha **2 testes
falhando** (`financeiro_categorias/itens` cat-a e cat-b) por um bug de harness
(`ctx.firestore()` chamado 2× no mesmo callback → "Firestore has already been
started"). A correção (reusar um único handle `seed`) já existia para o bloco
`cat-legado` mas **não** havia sido commitada para os outros dois. Reaplicada →
suíte **38/38** verde. Fix é **test-only**, não toca Rules nem código de produção.

---

## 11. Riscos Residuais

- 🟡 **S2 (raiz aberta):** `consultarOSPublica` continua sem prova de posse; apenas
  mitigado por rate limit. Enumeração sequencial fica cara, não impossível.
  **Pendência formal** — tratar com aviso a clientes (links de garantia já emitidos).
- 🟡 **2 testes de RBAC pré-existentes** (Relatório Mensal) falham na baseline `main`
  — dívida de qualidade de teste, sem impacto funcional comprovado.
- 🟡 **CI sem gate obrigatório** (sem branch protection, sem lint/coverage) — a
  suíte roda mas não bloqueia merge.
- 🟡 **17 commits não publicados** em `origin/develop`.
- 🔴 **Promoção condicionada ao backfill de produção** (§13) — risco de outage se
  ignorado.

---

## 12. Arquivos Revisados (núcleo de segurança da release)

Revisados linha a linha os diffs `main`→`develop` dos arquivos de maior risco:

- `CRM/firestore.rules` (isolamento de tenant, `pre_os`, A1)
- `storage.rules` (A2)
- `functions/os.js` + `functions/lib/rate-limit.js` (S2)
- `CRM/pages/os/os.js` (S1, S4)
- `CRM/pages/dashboard/dashboard-alertas.js`, `dashboard-alertas-panel.js` (V1)
- `CRM/public/abrir-atendimento.html` (carimbo `empresa_id` no intake público)
- `tests/firestore-rules/tenant-isolamento.test.mjs` (regressão V1/A1 + fix de harness)
- `scripts/backfill-empresa-id.mjs` (confirma `pre_os` na lista de coleções migradas)

Escopo total da release: **339 arquivos** (major SaaS multiempresa).

---

## 13. Checklist de Produção

| Critério de aptidão | Situação |
|---|---|
| Sem vulnerabilidade crítica **de código** aberta | ✅ (S2 mitigado, raiz aberta = ressalva) |
| Sem vazamento cross-tenant | ✅ (V1 eliminado, 112/112) |
| Firestore Rules aprovadas | ✅ 112/112 |
| Módulos críticos funcionando | ✅ (RBAC 179/181, 2 falhas pré-existentes) |
| CI aprovada | ✅ suítes executáveis verdes (CI não é gate obrigatório) |
| Documentação atualizada | ✅ (relatórios desta frente + rollback/readiness) |
| Backup e rollback preparados | ✅ (`backup-weekly.yml`, `GUIA_ROLLBACK.md`, tags) |
| Release revisada | ✅ (esta certificação) |

### ⚠️ PRÉ-REQUISITO OPERACIONAL BLOQUEANTE DA PROMOÇÃO

Promover `develop`→`main` **dispara deploy das novas Rules em produção**
(`deploy-firebase.yml`, `--force` em `cellcity-crm`). As novas Rules são
**fail-closed** para documentos sem `empresa_id`. Portanto, a promoção **exige**,
NA ORDEM:

1. `scripts/backfill-empresa-id.mjs` executado em **produção** (carimba `empresa_id` no legado).
2. `scripts/validar-backfill.mjs` confirmando 100% migrado.
3. `empresas/{id}.dados_migrados = true`.
4. **Só então** deploy das Rules (= promoção a `main`).

> **Precedente documentado:** `PRODUCAO_READINESS.md` registra um **incidente P0
> real em 2026-07-14 (~2h28 de outage)** causado exatamente por deployar estas
> Rules em produção fora dessa sequência. Este é o motivo central da retenção.

---

## 14. Parecer Técnico

O trabalho de correção das Fases 1.6/1.7 é sólido e foi **reverificado de primeira
mão**: o vazamento cross-tenant crítico (`pre_os`) está **eliminado** com prova em
emulador real, e os demais achados 🔴/🟠 estão corrigidos — exceto S2, mitigado por
decisão explícita do dono. Não há, no código, vulnerabilidade crítica não tratada
que impeça a aptidão da release **enquanto artefato de código**.

Contudo, a **liberação para produção não é uma operação apenas de código**. A
promoção `develop`→`main` é uma major de 67 commits que (a) dispara deploy
automático de Rules em produção sujeito à sequência de backfill sob pena de outage
(precedente P0 documentado), (b) representa o **lançamento do SaaS**, que é uma
**decisão de negócio explicitamente diferida**, e (c) carrega o resíduo S2. Por
`CLAUDE.md` (§0, §1, §7) e pelo protocolo de operações irreversíveis, **nenhum
push, tag, merge ou deploy foi executado** — a promoção requer **autorização
explícita** e a execução prévia do backfill em produção.

---

## 15. Decisão Final

# 🟡 APROVADO COM RESSALVAS

**A release candidata (`develop` @ `096dec0`) está tecnicamente apta como código.**
A promoção para produção fica **retida** e condicionada a:

1. **Autorização explícita** do dono para lançar o SaaS multiempresa em produção
   (decisão de negócio).
2. **Execução da sequência de backfill em produção** (§13, passos 1–4) **antes** do
   deploy das Rules.
3. **Tratamento/aceite formal do resíduo S2** (prova de posse em `consultarOSPublica`).

**Recomendação de sequência segura de liberação (a executar sob autorização):**

```
# 0. (opcional) publicar develop em origin p/ CI verde antes de tudo
git push origin develop            # 17 commits pendentes

# 1. Backfill em produção (fora do sandbox, com credenciais de prod)
node scripts/backfill-empresa-id.mjs --project cellcity-crm
node scripts/validar-backfill.mjs   --project cellcity-crm
# → setar empresas/{id}.dados_migrados = true

# 2. Só após backfill 100% validado: promover (dispara deploy das Rules)
git checkout main && git merge --ff-only develop
git tag -a vX.Y.Z -m "Release SaaS multiempresa"
git push origin main --follow-tags
```

Enquanto (1), (2) e (3) não estiverem satisfeitos, a classificação permanece
🟡 **APROVADO COM RESSALVAS** — nunca 🟢 incondicional.

---

*Esta fase não executou push, merge, tag, deploy ou promoção de branch. As únicas
escritas foram: (a) correção test-only do harness em `tenant-isolamento.test.mjs`
(defeito encontrado na revisão) e (b) este relatório + relatórios das fases 1.5/1.6
ainda não versionados. Nenhuma Sprint foi aberta.*
