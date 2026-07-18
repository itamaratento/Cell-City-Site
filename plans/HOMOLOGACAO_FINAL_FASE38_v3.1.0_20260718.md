# FASE 3.8 — Homologação Final e Encerramento v3.1.0

**Data:** 2026-07-18  
**Projeto:** `cellcity-crm`  
**Tag / main:** `v3.1.0` @ `b7e260d`  
**develop:** `2fe6973` (5 commits à frente de `main`)  
**Parecer:** 🟡 **RELEASE CERTIFICADA COM RESSALVAS**

> Objetivo desta fase: elevar para **CERTIFICADA SEM RESSALVAS**.  
> **Não atingido** — faltam gates que exigem credencial humana e configuração de secret no GitHub.

---

## 1. Resumo executivo

A infraestrutura da release permanece **estável e alinhada ao repositório** (Rules FS/Storage, 16 Functions ACTIVE, 23/23 índices READY, `dados_migrados=true`). Superfícies públicas HTTP respondem 200 nos paths corretos; o gate de autenticação redireciona dashboard → login sem sessão.

**Não executáveis nesta sessão (bloqueio humano):**

| Pendência | Motivo |
|---|---|
| Smoke autenticado (Fases 1–8 do roteiro) | Sem credenciais de administrador de produção |
| Matriz RBAC por perfil | Idem |
| `FIREBASE_SA_KEY` / WIF + deploy Actions verde | Secret GitHub + IAM — operador |
| Fast-forward `develop` → `main` | Exige autorização explícita (5 commits docs/índices) |

Portanto o status permanece **COM RESSALVAS**. Declaração **SEM RESSALVAS** seria falsa.

---

## 2. Escopo validado (automático / read-only)

### 2.1 Infraestrutura Firebase

| Item | Resultado | Evidência |
|---|---|---|
| Firestore Rules | ✅ PASS | Release `965a56e8…` · CONTENT_MATCH com `CRM/firestore.rules` |
| Storage Rules | ✅ PASS | Release `7eb2ad80…` · ST_MATCH com `storage.rules` |
| Índices compostos | ✅ PASS | **23 READY** · 0 CREATING/NEEDS_REPAIR/ERROR |
| Cloud Functions | ✅ PASS | **16/16 ACTIVE** (`southamerica-east1`) |
| `empresas/cellcity-master.dados_migrados` | ✅ PASS | `true` |
| Tag `v3.1.0` | ✅ PASS | aponta `b7e260d` = `origin/main` |

### 2.2 Smoke HTTP público (paths corretos)

Arquitetura CRM = páginas em `CRM/pages/<módulo>/index.html` (não `CRM/dashboard.html`).

| Path | HTTP |
|---|---|
| `/CRM/login.html` | 200 |
| `/CRM/index.html` | 200 |
| `/CRM/pages/dashboard/index.html` | 200 (shell; sem sessão → redirect login) |
| `/CRM/pages/os/index.html` | 200 |
| `/CRM/pages/estoque/index.html` | 200 |
| `/CRM/pages/financeiro/index.html` | 200 |
| `/CRM/pages/caixa/index.html` | 200 |
| `/CRM/pages/clientes/index.html` | 200 |
| `/CRM/pages/portal-cliente/index.html` | 200 |
| `/CRM/pages/portal-tecnico/index.html` | 200 |
| `/CRM/pages/autoatendimento/index.html` | 200 |
| `/CRM/pages/usuarios-permissoes/index.html` | 200 |
| `/CRM/pages/config/index.html` | 200 |
| `/CRM/garantia.html` | 200 |
| `/catalogo.html` | 200 |
| `/CRM/pages/catalogo/public/index.html` | 200 |

Browser: formulário de login carregado em `http://www.cellcityinformatica.com.br/CRM/login.html`.  
Acesso a `/CRM/pages/dashboard/index.html` sem sessão → **redirect para login** (gate OK).

### 2.3 Cloud Functions (amostra prévia + revalidação de estado)

| Função | Comportamento observado |
|---|---|
| `consultarOSPublica` | 400 / “Informe o número da OS.” (validação de negócio) |
| `excluirUsuarioAdmin` | 401 / “É preciso estar logado.” |
| Listagem gcloud | 16 ACTIVE |

### 2.4 Logs (últimas ~24h)

ERRORs `cloud_run_revision` com `Invalid request, unable to process` correlacionáveis a POSTs de smoke sem envelope callable válido — **esperado**, não indicam outage.  
ERRORs `datastore_database` / `audited_resource` próximos ao deploy de Storage (já notados na Fase 3.7) — monitorar; sem incidente de serviço reportado.

### 2.5 Testes locais de segurança

`tests/integrity/seguranca-fase22.test.mjs` → **12/12 pass**.

### 2.6 GitHub Actions

| Branch | Workflow | Resultado |
|---|---|---|
| `main` @ `b7e260d` | Deploy Pages | ✅ success |
| `main` @ `b7e260d` | Deploy Firebase | ❌ failure (auth / `FIREBASE_SA_KEY`) |
| `main` @ `b7e260d` | Testes automatizados | ❌ failure (Control Center — Fase 1) |
| `develop` @ `2fe6973` | Testes + Pages | ✅ success |
| `develop` | Deploy Firebase | skipped (gate `main`-only — correto) |

---

## 3. Homologação funcional autenticada (Fases 1–8)

| Fase | Escopo | Status |
|---|---|---|
| 1 Login / sessão / perfil / tenant | Admin | ❌ **NÃO EXECUTADO** — sem credencial |
| 2 Dashboard | KPIs, cards, gráficos | ❌ pendente sessão |
| 3 OS | CRUD, fechar/reabrir, anexos | ❌ |
| 4 Estoque | CRUD, entrada/saída | ❌ |
| 5 Financeiro / Caixa | Fluxo, fechamento | ❌ |
| 6 CRM | Clientes, leads, WhatsApp… | ❌ |
| 7 Portais | Cliente / técnico / autoatendimento (fluxo autenticado) | ❌ (HTML público 200 apenas) |
| 8 Administração / RBAC | Usuários, perfis, empresas | ❌ |

**Registro formal:** FALHOU (por bloqueio de acesso), não por defeito comprovado em runtime autenticado.

---

## 4. Firestore / Storage / Segurança (Fases 9–10, 13)

| Critério | Status |
|---|---|
| Índices READY (mitiga Missing index) | ✅ |
| Rules publicadas e CONTENT_MATCH | ✅ |
| Consultas autenticadas sem FAILED_PRECONDITION / PERMISSION_DENIED inesperado | ⚠️ **não exercitadas** |
| Upload/Download Storage autenticado | ⚠️ **não exercitado** |
| Tenant isolation / escalada de privilégio em sessão real | ⚠️ **não exercitado** |
| RBAC por perfil em UI | ⚠️ **não exercitado** |

Suíte estática de segurança Fase 2.2: ✅ 12/12.

---

## 5. Pipeline / CI/CD (Fases 14–15)

| Item | Status | Plano |
|---|---|---|
| Secret `FIREBASE_SA_KEY` (ou WIF) | ❌ ausente | Operador: Settings → Secrets → Actions |
| IAM da SA (`firebase.rules`, Storage, Functions) | ⚠️ historicamente insuficiente para CLI completa | Ampliar papéis antes do próximo `workflow_dispatch` |
| Deploy automatizado Rules+Indexes+Storage+Functions | ❌ último run main = failure | Após secret: `workflow_dispatch` em `deploy-firebase.yml` na `main` |
| Evidência de sucesso Actions | ❌ | Anexar run URL verde |

Publicação atual da v3.1.0 foi **híbrida** (REST/CLI local) — válida operacionalmente, **não** fecha o critério “pipeline Actions validado”.

---

## 6. Git (Fase 16)

| Item | Estado |
|---|---|
| `origin/main` | `b7e260d` = tag `v3.1.0` |
| `origin/develop` | `2fe6973` — **5 commits à frente** |
| Conteúdo à frente | Docs de release + `CRM/firestore.indexes.json` (índices já aplicados em prod via API) |
| Fast-forward develop→main | **Não executado** (sem autorização nesta fase) |
| Nova tag | **Não** — sem alteração de código de produto além do já tagueado; índices já em produção |

---

## 7. Critérios “SEM RESSALVAS” — checklist

| Critério | Atendido? |
|---|---|
| Todos os índices READY | ✅ |
| Smoke autenticado aprovado | ❌ |
| RBAC aprovado | ❌ |
| Cloud Functions aprovadas (estado + amostra HTTP) | ✅ parcial (estado + validação pública) |
| Storage aprovado (uso autenticado) | ❌ |
| Firestore aprovado (uso autenticado) | ❌ parcial (rules/indexes OK) |
| Pipeline GitHub Actions validado | ❌ |
| Deploy automatizado com sucesso | ❌ |
| Sem erros críticos de produção | ✅ (ERRORs de smoke esperado) |
| Sem consultas quebradas (runtime autenticado) | ❌ não provado |
| Sem falhas de autenticação/autorização (runtime) | ❌ não provado |

**Resultado:** critérios incompletos → **não** declarar SEM RESSALVAS.

---

## 8. Ressalvas remanescentes e plano de eliminação

### R1 — Smoke autenticado + RBAC (bloqueia SEM RESSALVAS)

**Plano:** operador fornece credencial admin (e opcionalmente técnico/atendente) **somente para esta sessão**, ou executa o checklist no browser e devolve evidências (screenshots / “PASSOU” por módulo). Agente completa Fases 1–8 e registra.

### R2 — `FIREBASE_SA_KEY` / WIF + IAM

**Plano:**

1. Criar/ajustar SA no GCP com papéis para Rules, Indexes, Storage, Functions.  
2. Colar JSON em `FIREBASE_SA_KEY` (GitHub → Secrets).  
3. `workflow_dispatch` → `Deploy Firebase` na `main`.  
4. Confirmar run verde + CONTENT_MATCH pós-deploy.

### R3 — CI Testes na `main` vermelho (Control Center)

`develop` verde; `main` @ tag falha no job Control Center. Não invalida a publicação híbrida, mas impede “pipeline saudável na main”.  
**Plano:** inspecionar log do run `29623002786`, corrigir em `develop`, promover.

### R4 — Sync `develop` → `main` (docs + indexes JSON)

**Plano:** após R1–R3 (ou com autorização isolada): fast-forward dos 5 commits; **sem** nova tag de produto se só docs/índices já publicados.

### R5 — (opcional, não bloqueante desta certificação) S2 `consultarOSPublica`

Proof-of-possession na raiz — pendência de segurança conhecida; rate limit já mitiga.

---

## 9. Parecer técnico final

### 🟡 RELEASE v3.1.0 — CERTIFICADA COM RESSALVAS

**Aprovado para operação** no eixo infraestrutura Firebase já publicado.  
**Não** certificado sem ressalvas: faltam smoke autenticado, RBAC em sessão, e pipeline Actions de deploy.

| Área | Status |
|------|--------|
| Firestore Rules | ✅ |
| Storage Rules | ✅ |
| Functions (16 ACTIVE) | ✅ |
| Indexes (23 READY) | ✅ |
| Smoke público / gate login | ✅ |
| Smoke autenticado | ❌ |
| RBAC runtime | ❌ |
| GitHub Actions deploy | ❌ |
| CI Testes na main | ❌ |
| Release | 🟡 |

---

## 10. Próximas ações (ordem sugerida)

1. **Humano:** enviar credencial admin de homologação **ou** executar Fases 1–8 e reportar.  
2. **Humano:** configurar `FIREBASE_SA_KEY` (ou WIF) + IAM.  
3. **Agente/humano:** `workflow_dispatch` Deploy Firebase → evidência verde.  
4. **Agente:** diagnosticar/fixar falha Control Center na `main`.  
5. **Humano autoriza:** ff `develop` → `main` dos commits de docs/índices.  
6. Reemitir parecer → só então 🟢 **CERTIFICADA SEM RESSALVAS**.

---

*FASE 3.8 — evidências 2026-07-18. Sem alteração de secrets, sem merge/main/tag, sem deploy Firebase nesta fase.*
