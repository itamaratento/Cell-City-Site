# 🗂️ PROXIMA_ETAPA.md — MEMÓRIA DO PROJETO (ESTADO ATUAL)

> ⚠️ Leia este arquivo antes de qualquer alteração.
> Para histórico completo, consulte [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md).

---

## 📌 REGRA PERMANENTE DE CONTINUIDADE

### Comando Padrão de Abertura de Sessão

Se o usuário enviar apenas **`CC`** ou **`CONTINUAR`**:

1. **Ler** [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md)
2. **Ler** [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md) apenas se necessário
3. **Gerar relatório** contendo: onde paramos, concluído, em andamento, pendente, próxima tarefa, riscos
4. ❌ **Não alterar arquivos** · ❌ **Não fazer deploy** · ⏳ **Aguardar aprovação**

*(Regras completas de continuidade permanecem inalteradas — ver commit anterior.)*

---

## ✅ ESTADO ATUAL (2026-07-21) — RELEASE v3.2.0 EM PRODUÇÃO · BL-008 CORRIGIDO

Relatório: [`plans/FASE43_HOMOLOGACAO_20260719.md`](plans/FASE43_HOMOLOGACAO_20260719.md) (release) · `CRM/TECHDOC.md` §47–48.

**Classificação:** 🟢 **v3.2.0 HOMOLOGADA E EM PRODUÇÃO**

### Concluído desde a seção anterior (2026-07-18 → 2026-07-21)

- Promoção `develop` → `main` autorizada e concluída; tag `v3.2.0` = `d650464`; `main` avançou +1 commit (`0ec12c0`, evidência do CI arquivada).
- Deploy Firebase via CI **100% verde pela 1ª vez** (WIF, sem chave de service account no GitHub) — Rules/Functions endurecidas (LGPD `cpfMascarado`, RBAC fail-closed, rate-limit S2) já em produção.
- Smoke autenticado em DEV (harness oficial, Chrome headless real): ✅ login/dashboard/central de alertas/cache/multiaba, @ commit `878f141`.
- **BL-008 corrigido** (2026-07-21, commit `d5c38b7`): parser do harness `homologar-performance` reconhecia só o reporter "spec" e reprovava RBAC/Polling gating com `NaN pass/NaN fail` mesmo 100% passando; agora aceita TAP também. Bônus corrigido junto: `audit.mjs` cortava o 1º caractere do 1º arquivo listado no relatório. Ver TECHDOC §48.

### Backlog remanescente

| Item | Status |
|------|--------|
| BL-007 — nodejs22 (Cloud Functions) | ⏳ prazo 2026-10-30; mexe em CF, exige autorização explícita do dono |
| BL-008 — parser do harness (TAP vs spec) | ✅ corrigido 2026-07-21 |
| BL-009 — bucket Firebase Storage (exige Blaze) | ⏳ decisão administrativa do dono (custo) |
| BL-010 — ruleset GitHub / bypass da deploy key (Cell-City-Backup) | ⏳ ação manual do dono no GitHub UI |

### Verificação adicional feita nesta sessão (2026-07-21, pós-BL-008)

Auditoria de IAM (somente leitura) da Service Account
`firebase-adminsdk-fbsvc@cellcity-crm-dev.iam.gserviceaccount.com`:
**nenhum defeito encontrado** — roles de projeto
(`iam.serviceAccountTokenCreator`, `firebaseauth.admin`,
`firebase.admin`, `firebase.sdkAdminServiceAgent`) e APIs
(`iamcredentials`, `identitytoolkit`, `securetoken`, `iam`) todas
presentes/habilitadas. Confirmado empiricamente: harness rodado com
navegador real duas vezes, perfis `admin` e `tecnico` — login,
Dashboard, Firestore (11 e 31 requisições respectivamente) e RBAC OK
nos dois, zero erro de console. `Firestore Rules`/`Cloud Functions
(Portal)` continuam ❌ **só nesta máquina local**, por `ENOSPC`
(limite de inotify watchers) — mesmo bloqueio de ambiente já
documentado em 2026-07-16 (ver seção "Sprint 3" abaixo), não é IAM nem
regressão de código; a mesma suíte já passa em CI.

RBAC runtime multi-perfil em navegador (6 perfis, leitura/escrita/
fail-closed) **não foi construído como harness novo** nesta sessão —
contrariaria o padrão já estabelecido do projeto de homologar RBAC via
jsdom/mocks (não Puppeteer), e seria escopo novo não solicitado.
A suíte automatizada `tests/rbac` (181/181) já cobre isso; os dois
perfis testados em navegador real acima são evidência adicional, não
substituição desse padrão.

### Próxima ação

Nenhuma pendência técnica bloqueante identificada para a v3.2.0. Itens
restantes (BL-007/009/010) dependem de decisão ou ação do dono.


### Histórico — FASE 4.2 (2026-07-18): COMMIT+PUSH+WIF OK · DEPLOY MAIN PENDENTE

Relatório: [`plans/FASE42_COMMIT_PUSH_WIF_20260718.md`](plans/FASE42_COMMIT_PUSH_WIF_20260718.md). Classificação na época: 🟡 CERTIFICADA COM RESSALVAS (commit `7633558`, WIF 5/5 bindings, deploy main ainda bloqueado por Auto-review). Todos os bloqueios dessa seção foram resolvidos nas Fases 4.2/4.3 seguintes — ver seção "ESTADO ATUAL" acima.


### Histórico recente — thread SaaS Onboarding/Admin (não sobrescreve o acima; não auditado nesta sessão de 2026-07-21)

A seção abaixo (2026-07-16) permanece como histórico da integração Sprint 3/4.

Duas frentes trabalharam em paralelo em 2026-07-16 sobre a mesma
`develop` (histórico linear, sem merge/branch divergente): esta frente
(Sprint 3 Onboarding → Sprint 4 Admin SaaS) e a frente concorrente
(F1.4 Certificação Técnica → docs de pendências pós-Sprint 3/F1.4). Os
4 commits (`1ed998d`, `ae14b4d`, `b72ff7d`, `9016354`) foram lidos,
auditados e certificados em conjunto — nenhum conflito de arquivo,
nenhuma sobreposição de escopo, nenhuma regressão. Relatório completo:
[`plans/CERTIFICACAO_INTEGRACAO_20260716.md`](plans/CERTIFICACAO_INTEGRACAO_20260716.md).

**Esta seção é agora a única linha oficial de evolução para o SaaS
Onboarding/Admin — substitui qualquer leitura isolada dos relatórios
de sprint individuais para fins de "onde paramos".**

### Sprint 4 — Admin SaaS: aprovação de empresas pendentes ✅

Não havia plano formal de "Sprint 4 SaaS" em nenhum documento — escopo
derivado de evidência de código: `functions/saas.js` (Sprint 3) já
prometia "o operador aprova no `saas-admin`", promessa nunca
implementada até agora. Ver TECHDOC §45 para o raciocínio completo.

| Item | Status |
|------|--------|
| `saas-admin.js` extraído do HTML (mesmo padrão do onboarding) | ✅ |
| Fluxo Aprovar (cria usuário admin + `status` → ativo/trial) | ✅ |
| Fluxo Rejeitar (`status` → rejeitada) | ✅ |
| `saas-auditoria.js` (logAcao) — primeiro consumidor real | ✅ |
| Testes `tests/rbac/saas-admin.test.mjs` 6/6 | ✅ |
| Arquitetura 6/6 · Integridade 14/14 · Catálogo 17/17 | ✅ |
| RBAC | 🟡 179/181 (2 pré-existentes, mesmas de sempre) |

Relatório completo: [`plans/SPRINT4_RELATORIO_FINAL.md`](plans/SPRINT4_RELATORIO_FINAL.md) · TECHDOC §45

### Sprint 3 — Onboarding SaaS ✅

| Item | Status |
|------|--------|
| Wizard 3 passos (`saas-onboarding.js`) | ✅ |
| Integração `saas-planos.js` | ✅ |
| Validações compartilhadas | ✅ |
| CF `saasOnboardingCriarEmpresa` + provisionamento | ✅ |
| `FLAGS.SAAS_ONBOARDING_ATIVO: true` | ✅ |
| Testes onboarding 10/10 | ✅ |
| Homologação client-side do wizard (Chrome headless real) | ✅ 6/6 cenários, 0 erros — ver `plans/PENDENCIAS_SPRINT3_20260716.md` |
| `ARQUITETURA.md` §2.1/§6 (Portal 8 arquivos-irmãos) | ✅ Corrigido — ver `plans/PENDENCIAS_SPRINT3_20260716.md` |
| CF tests emulador (`tests/functions/saas-onboarding.test.mjs`) | ⏳ Ainda não executado. Reexecução tentada na certificação de integração (2026-07-16, sessão seguinte): processo órfão do emulador matado, porta 8080 liberada, mas `ENOSPC` (inotify) voltou a ocorrer mesmo com `fs.inotify.max_user_watches=65536` (padrão) — bloqueio de ambiente confirmado 2x independentes (não é contenção de porta). Exige investigação de nível de sistema (fora do escopo autônomo) ou execução em CI. Ver `plans/CERTIFICACAO_INTEGRACAO_20260716.md` |

Relatório completo: [`plans/SPRINT3_ONBOARDING_RELATORIO.md`](plans/SPRINT3_ONBOARDING_RELATORIO.md) · [`plans/PENDENCIAS_SPRINT3_20260716.md`](plans/PENDENCIAS_SPRINT3_20260716.md) · TECHDOC §43

### F1.4 — Certificação Técnica Final (frente concorrente) ✅

Revisão técnica independente da Sprint 1 F1.4 (app-config em 20
páginas) e do fechamento da divisão do Portal do Cliente (P2.2):
corrigiu imports mortos residuais, reconfirmou os 88 membros do objeto
`Portal` e homologou em Chrome headless real. Veredito: aprovado para
integração. Nenhuma sobreposição de arquivo com Sprint 3/4 SaaS.
Relatório completo: [`plans/F1_4_CERTIFICACAO_FINAL.md`](plans/F1_4_CERTIFICACAO_FINAL.md) · TECHDOC §44

### Sprints anteriores (SaaS)

| Sprint | Entrega | Status |
|--------|---------|--------|
| Sprint 0 | Certificação encerramento | ✅ |
| Sprint 1 | Arquitetura (F1.1–F1.4, app-config, kernel) | ✅ |
| Sprint 2 | Portal split (P2.2) | ✅ |

---

## 🚦 PRÓXIMA TAREFA RECOMENDADA

**A certificação de integração (2026-07-16) recomenda formalmente ao
dono, como próxima etapa oficial, uma entre estas opções — nenhuma foi
iniciada por decisão explícita do usuário ("não abrir nova Sprint,
não criar novo roadmap" nesta missão):**

1. **Homologação manual** do fluxo completo em `/dev/`: onboarding → aprovação no `saas-admin` → login do admin criado (única etapa client-side ainda não exercida ponta-a-ponta com Cloud Function real).
2. Executar `tests/functions/saas-onboarding.test.mjs` e `tests/firestore-rules/*` em CI ou máquina sem contenção de `inotify` — bloqueio de ambiente confirmado 2x, não é código (ver `plans/CERTIFICACAO_INTEGRACAO_20260716.md`).
3. Decisão do dono sobre promoção SaaS e backfill produção (PROD-001..003, PS6) — segue bloqueada pelo incidente de 2026-07-14.
4. **Próxima Sprint SaaS** (se houver) — aguarda novo plano formal do dono ou nova evidência de dependência não resolvida no código, mesmo critério usado nas Sprints 3/4.

---

## ⚠️ RISCOS ATUAIS

- 🔴 SaaS multiempresa **não promovido a produção** (decisão pós-incidente 2026-07-14 permanece).
- 🟡 Senha temporária do admin criado na aprovação não passa pela política de senha (`politicas_senha`) usada em Usuários e Permissões — só mínimo de 6 caracteres (ver TECHDOC §45, "fora de escopo").
- 🟡 `tests/functions/saas-onboarding.test.mjs` e `tests/firestore-rules/*` (Cloud Function + Rules contra Firestore real) permanecem não executados nesta máquina por limitação de ambiente (`ENOSPC` inotify) — lógica coberta indiretamente por testes puros (validação, RBAC), mas sem verificação contra Firestore real.
- 🟢 Sprints 1–4 e F1.4 intactas; zero regressão, zero conflito arquitetural entre as duas frentes — ver `plans/CERTIFICACAO_INTEGRACAO_20260716.md`.

---

## ⚠️ ITENS PENDENTES (herdados)

| Item | Desbloqueio |
|------|-------------|
| P2.2-A migração de páginas (merge) | Outra frente |
| `financeiro-relatorio.test.mjs` (2 falhas pré-existentes, agora em `known-issues.json`) | Item separado |
| `tests/functions/saas-onboarding.test.mjs` + `tests/firestore-rules/*` (ambiente) | CI ou máquina livre de contenção de `inotify` |
| PS5-003 verificação de e-mail no onboarding | Decisão de negócio |
| PROD-001..003 backfill/deploy SaaS produção | Autorização do dono |
| Política de senha na conta criada por aprovação (`saas-admin`) | Decisão de negócio (baixa prioridade) |

---

*Seção acima (PRÓXIMA TAREFA RECOMENDADA / RISCOS ATUAIS / ITENS PENDENTES): última atualização 2026-07-16 — Integração e certificação das frentes Sprint 3/4 SaaS + F1.4 concluída. Nenhuma nova funcionalidade, Sprint ou roadmap aberto nesta missão (por instrução explícita). Thread SaaS não revisitado na atualização de 2026-07-21 (ver "ESTADO ATUAL" no topo do arquivo, que é sobre a linha Fase 4/v3.2.0 — thread independente).*

*Estado geral do arquivo atualizado em 2026-07-21 — ver "ESTADO ATUAL" no topo: release v3.2.0 em produção, BL-008 corrigido, IAM DEV auditado sem defeito encontrado.*
