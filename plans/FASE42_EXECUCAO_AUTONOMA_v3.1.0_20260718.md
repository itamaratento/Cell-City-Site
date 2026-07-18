# FASE 4.2 — Execução Autônoma Completa — Release v3.1.0

**Data:** 2026-07-18  
**Branch local:** `develop` @ `c9a0660` (= `origin/develop`)  
**main / tag:** `b7e260d` / `v3.1.0`  
**Parecer:** 🟡 **CERTIFICADA COM RESSALVAS** — FASE 4.2 **não** eleva para SEM RESSALVAS

> Produção **não** foi modificada. Commit/push/deploy **não** executados (bloqueios reais + regra de autorização).  
> Tudo o que era verificável localmente/remotamente sem escrever em produção foi executado.

### Adendo (continuidade 2026-07-18 ~13:30)

| Item | Evidência | Status |
|------|-----------|--------|
| Testes `develop` @ `c9a0660` | [run 29647424338](https://github.com/itamaratento/Cell-City-Site/actions/runs/29647424338) | ✅ **success** (já não in_progress) |
| Deploy Pages `develop` | run 29647424337 | ✅ success |
| IAM WIF `github-deploy@…` | `gcloud projects get-iam-policy` sem roles; SA policy `null` | ❌ **0/5 bindings** — confirma bloqueio D03 |
| Working tree segurança | 16 modified + plans untracked | ainda **sem commit** |

---

## 1. Relatório técnico por etapa

### ETAPA 1 — Working tree

| Item | Evidência | Resultado |
|------|-----------|-----------|
| Branch | `develop...origin/develop` sync em `c9a0660` | OK |
| Alterações pendentes | 16 modified + 7 untracked `plans/*` | **Pendentes de commit** |
| Conflitos | `rg` sem `<<<<<<<` | Nenhum |
| `sa-key.json` | presente, `.gitignore:87`, não tracked | OK (risco local só) |
| Temporários | sem `.tmp`/`.bak` relevantes no escopo | OK |
| `firestore.indexes.json` | HEAD já com **23** (commit `58b17b5`) | OK no repo develop |

**Escopo do working tree (segurança FASE 4.1 ainda não commitada):**  
`CRM/firestore.rules`, `storage.rules`, `functions/os.js`, `functions/lib/rate-limit.js`, `CRM/shared/permissoes.js`, `CRM/garantia.html`, `CRM/pages/portal-cliente/portal-os.js`, testes associados, `CHANGELOG.md`, `PROXIMA_ETAPA.md`, plans de release.

---

### ETAPA 2 — Revalidação funcional (código + emulador)

| Área | Evidência | Resultado |
|------|-----------|-----------|
| Firestore Rules | emulador `tests/firestore-rules` | **121/121 PASS** |
| Storage Rules | emulador `tests/storage-rules` | **14/14 PASS** |
| LGPD / OS pública | `consultarOSPublica: CPF mascarado…` | **PASS** |
| Rate limit Portal | `rate-limit-s2` (limite 5) | **PASS** |
| Segurança Fase 2.2 | `seguranca-fase22` | **12/12** (no lote 16 c/ rate-limit) |
| Cloud Functions (prod estado) | `gcloud functions list` | **16 ACTIVE** |
| RBAC código | `permissoes.js` fail-closed (`_rbacAtivo`) | OK no WT |
| Portal/CRM/Dashboard HTTP | smoke público paths 200 | OK (sem sessão) |

Smoke autenticado / RBAC runtime: **não executável** (sem credencial admin).

---

### ETAPA 3 — Revisão de artefatos / regressões

| Arquivo | Achado |
|---------|--------|
| `CRM/firestore.rules` | config whitelist; pre_os+empresa_id; metadata restrito — **OK** |
| `storage.rules` | sem `read: if true` em OS — **OK** |
| `CRM/firestore.indexes.json` | 23 no HEAD develop — **OK** |
| `firebase.json` | paths Rules/Indexes/Storage/Functions coerentes — **OK** |
| `.github/workflows/deploy-firebase.yml` | WIF OIDC (D03); gate `main`-only — **OK** |
| Residual público intencional | `catalogo_config` `allow get: if true` (catálogo) — documentado |
| Residual público controlado | `config` get só `impressao`/`horarios`; `pre_os` create com `empresa_id` |

Sem regressão detectada nos testes de Rules/Storage após as mudanças.

---

### ETAPA 4 — Auditoria de segurança (repassagem)

| Tema | Status | Evidência |
|------|--------|-----------|
| Coleções públicas indevidas | Mitigado (config/pre_os); `catalogo_config` get público permanece | rules + testes |
| Storage OS | Auth+tenant no WT; **prod ainda com rules antigas** | ST_PROD_MATCH_LOCAL=**False** |
| LGPD CPF | Removido da whitelist no WT; **prod Functions ainda antigas** | FS/FN MATCH local≠prod |
| Enumeração OS | Rate 5/min no WT; PoP opaco backlog | rate-limit.js |
| RBAC | Fail-closed UI; Rules = tenant floor | permissoes.js |
| Multiempresa | `mesmaEmpresa*` intacto | rules tests 121 |
| Segredos | `sa-key.json` gitignored; WIF no workflow (sem FIREBASE_SA_KEY) | .gitignore + yml |
| Auth pipeline | WIF **80%** — **5 bindings IAM pendentes** | `plans/FASE41_EXECUCAO_DECISOES_20260718.md` |

---

### ETAPA 5 — Drift develop / main / produção

| Camada | develop | main / v3.1.0 | Produção |
|--------|---------|---------------|----------|
| Git | `c9a0660` (**14 commits** à frente de main: `0 14` left-right após fetch) | `b7e260d` | — |
| Índices JSON | **23** | **14** (tag) | **23 READY** |
| Firestore Rules | WT ≠ prod (correções locais) | tag antiga | `965a56e8…` (pré-correção 4.1) |
| Storage Rules | WT ≠ prod | tag antiga | `7eb2ad80…` (ainda read público OS) |
| Functions | 16 no código | tag | **16 ACTIVE** (código **sem** cpfMascarado até deploy) |

**Drift crítico operacional:** correções de segurança existem só no working tree; produção e `main` **não** as contêm. Índices: prod alinhada ao JSON de **develop** (23); **main** atrasada.

---

### ETAPA 6 — CI/CD

| Item | Evidência | Status |
|------|-----------|--------|
| WIF no workflow | `deploy-firebase.yml` OIDC + SA `github-deploy@…` | Código OK |
| Bindings IAM WIF | Script `scripts/infra/wif-conceder-papeis.sh` **não executado** (exige operador owner) | 🟡 **Bloqueio** |
| Deploy Firebase `main` | Último run `b7e260d` = **failure** (era SA key; agora WIF ainda sem IAM) | ❌ |
| Testes `main` | Historicamente failure Control Center; D04 em develop corrige materialização | 🟡 até promover |
| Testes `develop` @ `c9a0660` | run `29647424338` — **in_progress** no momento da coleta | ⏳ |
| Deploy Pages develop | `c9a0660` **success** | ✅ |
| `gh` / token | ausentes neste ambiente | Bloqueia dispatch autenticado |
| Backup weekly | `BACKUP_DEPLOY_KEY`; fixes D05 em develop | Parcial |

---

### ETAPA 7 — Preparação de commit (**não executado**)

**Proposta de mensagem:**

```
fix(security): FASE 4.1 — Rules/Storage/LGPD/RBAC fail-closed + rate OS 5/min

Fecha leituras públicas indevidas (config whitelist, Storage OS auth+tenant),
remove CPF da projeção pública (cpfMascarado), endurece pre_os/metadata e
permissoes.js fail-closed. Testes Rules/Storage/LGPD atualizados.
```

**Arquivos a incluir:** os 16 modified + plans de certificação desejados.  
**Não commitado:** falta autorização explícita de commit (regra do projeto / user rule).

---

### ETAPA 8 — Preparação de deploy (**não executado**)

Pré-requisitos:

| # | Pré-requisito | Estado |
|---|---------------|--------|
| 1 | Commit + push develop das correções | ❌ pendente auth |
| 2 | `bash scripts/infra/wif-conceder-papeis.sh` (5 bindings) | ❌ pendente operador |
| 3 | Fast-forward develop → main (autorizado) | ❌ |
| 4 | Push main dispara Deploy Firebase (WIF) | ❌ depende 2+3 |
| 5 | CONTENT_MATCH pós-deploy | ❌ |

**Bloqueio explícito:** “Não modificar produção sem autorização explícita.”

---

### ETAPA 9 — Smoke possível

| Teste | Resultado | Evidência |
|-------|-----------|-----------|
| Login HTML | 200 | curl domínio público |
| Dashboard/OS/Portal shells | 200 | curl |
| Garantia / catálogo | 200 | curl |
| `consultarOSPublica` vazio | 400 “Informe o número da OS.” | POST |
| `excluirUsuarioAdmin` | 401 “É preciso estar logado.” | POST |
| Login autenticado / módulos / RBAC | **NÃO EXECUTADO** | sem credencial |

---

### ETAPA 10 — Revisão do próprio trabalho

- Confirmado: testes Rules/Storage/LGPD reexecutados nesta sessão (não só herdados).  
- Confirmado: prod Rules/Storage **divergem** do WT (esperado sem deploy).  
- Confirmado: WIF avançou no repo (D03) mas IAM bindings ainda bloqueiam pipeline.  
- Omissão consciente: não conceder IAM / não commit / não deploy sem auth.  
- Melhoria futura: `publicToken`, CF config, Claims RBAC (backlog).

---

## 2. Lista de evidências

1. `git status` / `git diff --stat` — 16 files, +229/−112  
2. Emulador Firestore Rules — 121 pass (FASE 4.2)  
3. Emulador Storage Rules — 14 pass  
4. `consultarOSPublica: CPF mascarado` — pass  
5. `rate-limit-s2` + `seguranca-fase22` — pass  
6. `gcloud` — 23 indexes READY; 16 Functions ACTIVE  
7. Rules API — FS/ST CONTENT_MATCH local = **False** (correções não publicadas)  
8. Actions — Pages develop success; Deploy Firebase main failure histórico; Tests develop in_progress `29647424338`  
9. `plans/FASE41_EXECUCAO_DECISOES_20260718.md` — WIF 80%, IAM pendente  
10. Smoke HTTP público — 6 paths 200 + 2 CF respostas esperadas  

---

## 3. Riscos remanescentes

| ID | Sev | Risco |
|----|-----|-------|
| P1 | **ALTO** | Produção ainda com Storage OS público + CPF em Functions + config get amplo (até deploy das correções) |
| P2 | **ALTO** | Pipeline deploy bloqueado sem bindings IAM WIF |
| P3 | **MÉDIO** | Correções só no WT — risco de perda se não commitadas |
| P4 | **MÉDIO** | `main` 14 commits atrás; CI main historicamente vermelha até promover D04 |
| P5 | **MÉDIO** | Smoke/RBAC autenticado não feitos |
| P6 | **BAIXO** | `catalogo_config` get público (produto) |
| P7 | **BAIXO** | `sa-key.json` local (gitignored) |

---

## 4. Pendências / bloqueios reais

| Bloqueio | Por quê | Impacto | O que falta |
|----------|---------|---------|-------------|
| Commit | Sem autorização explícita de commit nesta sessão | Correções não entram no remoto | “Autorizo commit” |
| Push develop | Depende do commit | CI não valida o lote de segurança | push após commit |
| IAM WIF (5 bindings) | Script exige operador owner; sandbox/política | Deploy Actions impossível | `scripts/infra/wif-conceder-papeis.sh` |
| Deploy produção | Proibido sem auth explícita + WIF incompleto | Prod continua com rules antigas | auth + WIF + promote main |
| Smoke autenticado | Sem credencial admin | Não fecha gate SEM RESSALVAS | credencial ou checklist humano |
| `gh` token | Ausente | Sem workflow_dispatch autenticado | token ou UI GitHub |

---

## 5. Recomendação final

1. **Autorizar commit** do lote de segurança + docs plans.  
2. Push `develop` → aguardar Tests verdes.  
3. Operador: `bash scripts/infra/wif-conceder-papeis.sh`.  
4. Autorizar ff `develop` → `main` (dispara Deploy Firebase via WIF).  
5. Confirmar CONTENT_MATCH + Functions com `cpfMascarado`.  
6. Smoke autenticado + RBAC.  
7. Só então emitir 🟢.

---

## 6. Parecer da release

```
🟡 RELEASE v3.1.0 — CERTIFICADA COM RESSALVAS
```

**FASE 4.2 (autônoma):** validações possíveis **concluídas**.  
**Não** há evidência de deploy das correções nem pipeline verde de produção nem smoke autenticado — portanto **não** se declara SEM RESSALVAS.

**Próximo marco operacional:** desbloquear commit + IAM WIF + promoção main (com autorização humana).

---

*FASE 4.2 — execução autônoma 2026-07-18. Sem commit, sem push, sem alteração de produção, sem IAM bindings.*
