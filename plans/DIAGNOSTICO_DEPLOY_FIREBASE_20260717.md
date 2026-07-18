# FASE 3.3 — Diagnóstico do Deploy Firebase (v3.1.0)

**Data:** 2026-07-17  
**Natureza:** auditoria exclusiva — nenhum secret, workflow, chave ou deploy alterado  
**Classificação:** 🟡 **DEPLOY BLOQUEADO**

---

## Release

| Item | Valor |
|---|---|
| Tag | `v3.1.0` |
| Commit | `b7e260db0ccfda2a285111e82997a1aeaf83f6cb` |
| Branch | `main` (= `develop` = `origin/main`) |
| Estado | Promoção Git **concluída**; artefatos Firebase **não** publicados por este run |

---

## ETAPA 1 — Análise do workflow

| Campo | Evidência |
|---|---|
| Workflow | `Deploy Firebase (rules + indexes + functions)` |
| Path | `.github/workflows/deploy-firebase.yml` |
| Run ID | **29623002802** |
| URL | https://github.com/itamaratento/Cell-City-Site/actions/runs/29623002802 |
| Evento | `push` em `main` |
| Head SHA | `b7e260d…` |
| Job | `deploy` (id `88021644128`) |
| Conclusão | **failure** |
| Janela | 2026-07-18T00:24:06Z → 00:24:14Z (~8s) |

### Steps

| # | Step | Resultado |
|---|---|---|
| 1 | Set up job | success |
| 2 | Checkout | success |
| **3** | **Autenticar no GCP via service account** | **failure** ← interrupção |
| 4 | Setup Firebase CLI | skipped |
| 5 | Deploy Firestore Rules | skipped |
| 6 | Deploy Firestore Indexes | skipped |
| 7 | Deploy Storage Rules | skipped |
| 8 | Deploy Cloud Functions | skipped |
| 9 | Validar deploy das Rules (via API) | skipped |

### Mensagem completa da falha (annotation)

```text
google-github-actions/auth failed with: the GitHub Action workflow must
specify exactly one of "workload_identity_provider" or "credentials_json"!
If you are specifying input values via GitHub secrets, ensure the secret
is being injected into the environment. By default, secrets are not passed
to workflows triggered from forks, including Dependabot.
```

Stack trace: **não há** — falha síncrona da action `google-github-actions/auth@v2` na validação de inputs, antes de qualquer chamada GCP/Firebase.

Warning paralelo (não bloqueante): Node.js 20 deprecated no runner (actions forçadas a Node 24).

---

## ETAPA 2 — Causa raiz

### Diagnóstico

**Secret inexistente ou vazio** (não injetado em `credentials_json`).

| Hipótese | Evidência | Conclusão |
|---|---|---|
| Secret inexistente / vazio | Action exige `credentials_json` **ou** WIF; o workflow passa `secrets.FIREBASE_SA_KEY`; se o secret estiver ausente/vazio, o input fica efetivamente vazio → exatamente o erro acima | **Causa raiz** |
| Nome incorreto | Workflow usa `FIREBASE_SA_KEY`; docs históricos do projeto usam o mesmo nome | Nome coerente; problema é ausência de valor |
| Secret inválido (JSON malformado) | Falha ocorreria *depois* de aceitar o input (auth/GCP). Aqui a action rejeita *antes* por input ausente | Descartado nesta falha |
| Permissões IAM insuficientes | Nenhum token obtido; deploy nem iniciou | Descartado nesta falha |
| Workflow incorreto (gate/ordem) | Job rodou só em `main` (`if: github.ref == refs/heads/main`); paths dispararam corretamente no ff | Workflow estruturalmente OK |
| Outro | Comentário no próprio YAML (L6–8) e certificação Sprint 0: *“FIREBASE_SA_KEY nunca foi configurado”* — pipeline **nunca** fez deploy real via Actions | Confirma dívida operacional pré-existente |

**Justificativa técnica:** `google-github-actions/auth@v2` trata string vazia / secret não definido como “nenhum dos dois modos de auth configurados”. Interrupção no step 3 impede qualquer `firebase deploy`.

---

## ETAPA 3 — Auditoria do workflow (sem modificar)

| Item | Avaliação |
|---|---|
| Secret esperado | `secrets.FIREBASE_SA_KEY` |
| Uso | `credentials_json: ${{ secrets.FIREBASE_SA_KEY }}` — padrão correto |
| Auth | `google-github-actions/auth@v2` — adequado para JSON de SA |
| Gate produção | `if: github.ref == 'refs/heads/main'` — correto (mitigação P0 2026-07-14) |
| Projeto alvo | `--project cellcity-crm` em todos os deploys |
| Ordem | Auth → CLI → rules → indexes → storage → functions → validação API — coerente |
| Paths trigger | rules, indexes, firebase.json, storage.rules, functions/** — ok |
| Compatibilidade | Alinha com `.firebaserc` default `cellcity-crm` e `firebase.json` (rules em `CRM/`, storage, functions nodejs20) |

**Não** é necessário alterar o workflow para desbloquear — falta o secret no GitHub.

---

## ETAPA 4 — Auditoria do repositório

| Artefato | Projeto / destino | Status |
|---|---|---|
| `.firebaserc` | default `cellcity-crm`, alias `dev` → `cellcity-crm-dev` | ✅ |
| `firebase.json` | rules `CRM/firestore.rules`, indexes, `storage.rules`, functions | ✅ |
| Workflow deploy | `--project cellcity-crm` | ✅ |
| Docs (TECHDOC, Sprint0, PRODUCAO_READINESS) | Produção = `cellcity-crm`; secret `FIREBASE_SA_KEY` documentado como nunca configurado | ✅ coerente |
| Scripts locais | Deploy histórico via `sa-key.json` / API owner (fora do Actions) | ℹ️ caminho manual paralelo |

---

## ETAPA 5 — Service Account (sem revelar credenciais)

| Item | Informação |
|---|---|
| Nome do secret GitHub | **`FIREBASE_SA_KEY`** |
| Tipo | JSON de **Service Account** GCP (conteúdo completo do arquivo de chave), injetado em `credentials_json` |
| Não gerar | Novas SAs / novas chaves nesta fase (proibido) |
| Serviços dependentes do workflow | Firestore Rules, Firestore Indexes, Storage Rules, Cloud Functions; validação via `firebaserules.googleapis.com` + `gcloud auth print-access-token` pós-auth |
| Permissões mínimas típicas (referência) | Papéis que permitam `firebase deploy` dos alvos acima no projeto `cellcity-crm` (ex.: Firebase Admin / combinação Rules + Functions + Storage conforme política IAM do projeto). Histórico interno menciona limitações de `firebaserules.admin` em SAs antigas — validar no Console após configurar o secret |

---

## ETAPA 6 — Plano de correção

1. **O que corrigir**  
   Criar/preencher o secret de repositório `FIREBASE_SA_KEY` com o JSON válido da service account de deploy de produção (chave já existente e rotacionada no GCP, se aplicável — **não** gerar chave nova nesta fase se já houver SA operacional).

2. **Onde**  
   GitHub → `itamaratento/Cell-City-Site` → Settings → Secrets and variables → Actions → `FIREBASE_SA_KEY`.

3. **Quem**  
   Operador com acesso admin ao repositório GitHub **e** acesso IAM ao projeto GCP `cellcity-crm` (dono / DevOps).

4. **Como validar a correção**  
   - Secret listado no GitHub (valor nunca exibido).  
   - Reexecutar o workflow (abaixo).  
   - Step “Autenticar no GCP” = **success**.  
   - Steps de deploy Rules/Indexes/Storage/Functions = **success**.  
   - Step “Validar deploy das Rules (via API)” imprime ruleset ativo ≠ N/A.

5. **Como reexecutar**  
   - Preferível: Actions → `Deploy Firebase` → **Run workflow** (`workflow_dispatch`) na branch `main`; **ou**  
   - Re-run do job falho `29623002802` (só útil após o secret existir); **ou**  
   - Push trivial em path monitorado (evitar — preferir `workflow_dispatch`).

---

## ETAPA 7 — Riscos

| Tema | Situação |
|---|---|
| Impacto da falha | CI de deploy de produção **não** publicou a release Firebase da v3.1.0 |
| O que **NÃO** foi publicado | Firestore Rules novas, Indexes, Storage Rules, Cloud Functions do tip `b7e260d` / `v3.1.0` |
| O que continua em produção | Artefatos Firebase **anteriores** (pré-v3.1.0); GitHub Pages pode já servir código de `main` (workflow Pages separado) |
| Risco usuários | Código em Pages/`main` pode esperar Rules/Functions mais novas do que as ativas no Firebase → inconsistência potencial (ex.: multiempresa, portal). Backfill + `dados_migrados=true` já estão no banco; Rules novas ainda não |
| Precedente | Mesmo bloqueio conhecido desde Sprint 0 — não é regressão introduzida pelo ff |

---

## Parecer

### 🟡 DEPLOY BLOQUEADO

**Motivo:** secret GitHub `FIREBASE_SA_KEY` ausente ou vazio; autenticação GCP interrompe o job antes de qualquer deploy.  
O workflow e o apontamento para `cellcity-crm` estão corretos.  
Após o operador configurar o secret, o ambiente fica apto a **reexecutar** o deploy (fase seguinte).

### 🟢 PRONTO PARA REEXECUTAR O DEPLOY — **somente após** o operador configurar `FIREBASE_SA_KEY`.

*Nesta fase: sem criação de SA, sem gerar chaves, sem alterar secrets, sem modificar workflows, sem deploy, sem smoke.*
