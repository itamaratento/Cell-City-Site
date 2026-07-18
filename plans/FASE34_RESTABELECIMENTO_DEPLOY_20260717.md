# FASE 3.4 — Restabelecimento do Deploy Firebase (v3.1.0) — Diagnóstico e Preparação

**Data:** 2026-07-17/18
**Natureza:** Etapas 1–2 da missão (diagnóstico + auditoria). Etapas 3–7 **bloqueadas** aguardando operador.
**Classificação parcial:** 🟡 **DEPLOY AINDA BLOQUEADO — AGUARDANDO CONFIGURAÇÃO DO SECRET**

---

## Release

| Item | Valor |
|---|---|
| Tag | `v3.1.0` (anotada) |
| Commit | `b7e260db0ccfda2a285111e82997a1aeaf83f6cb` |
| Branch | `main` = tag (verificado por `rev-parse v3.1.0^{commit}`) |
| develop | `ae5b02c` (= `b7e260d` + docs de release preservados) |

---

## ETAPA 1 — Diagnóstico (evidência própria, via API pública do GitHub)

### 1a. Workflow de deploy — causa única confirmada

| Campo | Evidência |
|---|---|
| Run | **29623002802** · `Deploy Firebase (rules + indexes + functions)` |
| Evento | push em `main` @ `b7e260d`, 2026-07-18T00:24Z |
| Conclusão | failure em ~8s |
| Step falho | **3 — Autenticar no GCP via service account** (`google-github-actions/auth@v2`) |
| Erro | `must specify exactly one of "workload_identity_provider" or "credentials_json"` — input vazio ⇒ secret `FIREBASE_SA_KEY` ausente/vazio |
| Steps 4–9 | todos **skipped** — nenhum outro erro no workflow de deploy |

✅ **Confirmado tecnicamente: a única causa da falha do deploy é o secret `FIREBASE_SA_KEY` ausente.** Coincide integralmente com o diagnóstico da Fase 3.3 (`plans/DIAGNOSTICO_DEPLOY_FIREBASE_20260717.md`).

### 1b. ⚠️ Falha ADICIONAL encontrada (fora do workflow de deploy) — documentada por exigência da missão

O workflow **Testes automatizados também falhou na `main`** @ `b7e260d` (run **29623002786**), embora o MESMO commit tenha passado 100% na `develop` (run 29622955215).

- **Step falho:** "Testes do Control Center (estrutura, menus, dispatch — Fase 1)".
- **Causa raiz (provada por reprodução local):** `scripts/control-center/modules/branches-sincronizacao/lib/compare.sh:13` — rodando na `main`, a branch de comparação default é `develop`; o checkout da CI num push da `main` só materializa `refs/heads/main` (o step "Materializar branch main local" cobre apenas o caso espelhado, fix `fb57b47`). Sem `refs/heads/develop`, Comparar Branches falha com "Branch 'develop' não encontrada" e o assert `Commits exclusivos de 'develop'` (estrutura.test.mjs:683) quebra.
- **Reprodução:** clone local simulando o checkout da CI (só `main` local) → teste falha exatamente como na CI. Materializando `develop` (`git branch --track develop origin/develop`) → **passa 1/1**. Suíte completa `estrutura.test.mjs` no repo real: **94/94 pass**.
- **Impacto:** não bloqueia o deploy Firebase (workflows independentes, sem `needs:`); não indica defeito no produto (mesma árvore verde na develop). É artefato do harness de CI, mesma classe do fix `fb57b47`, no sentido espelhado.

**Fix mínimo proposto (validado, NÃO aplicado — aguarda autorização):** materializar ambas as branches, no teste (autossuficiente) e/ou no step do workflow:

```
# estrutura.test.mjs (trecho do teste Comparar Branches) — laço sobre ['main','develop']:
#   se refs/heads/<b> não existe → git branch --track <b> origin/<b>
# tests.yml (step Materializar) — mesmo laço em shell.
```

Uma aplicação preliminar deste fix foi feita e validada nesta sessão, mas foi **apagada pelo reset externo** (ver Incidente abaixo) e um sinal do ambiente indicou a reversão do `tests.yml` como intencional — por isso a reaplicação fica explicitamente condicionada à autorização do dono.

---

## ETAPA 2 — Auditoria da configuração (sem modificar arquivos)

| Item | Verificação própria | Status |
|---|---|---|
| `deploy-firebase.yml` | secret `FIREBASE_SA_KEY` → `credentials_json` (padrão correto); gate `if: github.ref == 'refs/heads/main'`; `workflow_dispatch` disponível | ✅ |
| Ordem de deploy | Auth → CLI → Firestore Rules → Indexes → Storage Rules → Functions → validação via `firebaserules.googleapis.com` | ✅ |
| Projeto alvo | `--project cellcity-crm` em todos os passos | ✅ |
| `.firebaserc` | default `cellcity-crm`; alias `dev` → `cellcity-crm-dev` | ✅ |
| `firebase.json` | rules `CRM/firestore.rules`, indexes, `storage.rules`, functions nodejs20 | ✅ |
| Hosting | **não deployado pelo workflow** (só rules/indexes/storage/functions) — respeita a regra "hosting só GitHub Pages" | ✅ |
| Arquivos-alvo rastreados no git | firestore.rules, indexes, storage.rules, firebase.json | ✅ |

**Nenhuma alteração de workflow é necessária para desbloquear o deploy** — falta apenas o secret.

---

## ⚠️ RISCO ATIVO — janela de inconsistência em produção

O **Deploy Pages da `main` @ `b7e260d` teve sucesso** (run 29623002810): o site de produção **já serve o código v3.1.0**, enquanto Rules/Indexes/Functions do Firebase continuam **pré-v3.1.0**. Consequências até o deploy sair:

- Rules antigas (mais permissivas — sem os fixes A1/A2/pre_os) continuam ativas;
- Código novo pode invocar Cloud Functions/comportamentos ainda não publicados (ex.: onboarding SaaS).

**Quanto antes o secret for configurado e o deploy reexecutado, menor a janela.**

---

## INCIDENTE — reset externo recorreu durante esta sessão (2026-07-17/18)

Durante a execução da suíte de testes local, **todas as modificações rastreadas do working tree foram apagadas** (padrão conhecido, recorrente desde 2026-07-12): a atualização Fase 3.2 do `PROXIMA_ETAPA.md` (sessão da promoção) e os fixes preliminares de CI desta sessão. Arquivos não rastreados sobreviveram e foram **imediatamente commitados** (`ae5b02c`): `plans/PROMOCAO_MAIN_20260717.md` e `plans/DIAGNOSTICO_DEPLOY_FIREBASE_20260717.md`. O estado do `PROXIMA_ETAPA.md` foi restaurado a partir do conteúdo lido nesta sessão antes do reset.

---

## AÇÕES DO OPERADOR (ordem rígida — Etapas 3–7 dependem disto)

1. **Configurar o secret** `FIREBASE_SA_KEY` — GitHub → `itamaratento/Cell-City-Site` → Settings → Secrets and variables → Actions. Conteúdo: JSON da service account de deploy de produção (`cellcity-crm`). Não gerar SA/chave nova se já houver operacional.
2. **Disparar o deploy**: Actions → "Deploy Firebase (rules + indexes + functions)" → **Run workflow** na `main` (ou re-run do 29623002802). *Esta máquina não tem `gh` autenticado — se preferir que eu dispare e acompanhe, instalar/autenticar o `gh` CLI ou autorizar acesso à API.*
3. **Autorizar** a reaplicação do fix de CI (item 1b) na `develop`.
4. Após o deploy: eu executo validação pós-deploy (ruleset ativo via API, Functions, Indexes), smoke tests e certificação final (Etapas 5–7).

---

## Parecer parcial

### 🟡 DEPLOY AINDA BLOQUEADO

Causa única no workflow de deploy: secret ausente (confirmada com evidência própria). Configuração de deploy auditada e correta. Falha adicional de CI na `main` diagnosticada, reproduzida e com fix validado aguardando autorização. Janela de inconsistência Pages×Firebase **ativa** — priorizar o secret.
