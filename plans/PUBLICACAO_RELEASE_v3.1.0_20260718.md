# FASE 3.6 — Publicação Oficial da Release v3.1.0

**Data:** 2026-07-18  
**Classificação:** 🟡 **RELEASE PUBLICADA COM RESSALVAS**

---

## Release

| Item | Valor |
|---|---|
| Tag | `v3.1.0` |
| Commit | `b7e260db0ccfda2a285111e82997a1aeaf83f6cb` |
| Branch publicada | `origin/main` (= tag) |
| Projeto Firebase | `cellcity-crm` |
| `dados_migrados` | **`true`** (confirmado) |

---

## Workflow

| Item | Valor |
|---|---|
| `workflow_dispatch` | ❌ **não executado** — ambiente sem token GitHub (`gh`/API 401) |
| Caminho usado | Deploy híbrido documentado no projeto: **API Rules (owner)** + **CLI Functions (SA)** + **API Indexes/Storage** |
| Run Actions | n/a (substituído por publicação direta) |

Motivo: secret `FIREBASE_SA_KEY` no Actions ainda não validável daqui; SA local sem `firebaserules.admin` / `firebasestorage.defaultBucket.get` para CLI completa.

---

## Deploy

| Artefato | Resultado | Evidência |
|---|---|---|
| **Firestore Rules** | ✅ | Release `965a56e8-…` @ `2026-07-18T00:37:10Z` — **CONTENT_MATCH True** |
| **Storage Rules** | ✅ | Release `firebase.storage/cellcity-crm.firebasestorage.app` → `7eb2ad80-…` @ `2026-07-18T11:23:35Z` — **ST_MATCH True** |
| **Firestore Indexes** | ⚠️ | 19+ índices criados via API; **vários ainda `CREATING`** (build assíncrono). Contagem gcloud ≈ 23 (inclui em criação) vs 14 no JSON local (alguns já existiam / campos `__name__`) |
| **Cloud Functions** | ✅ | 16 funções southamerica-east1 atualizadas/criadas @ ~`2026-07-18T00:39Z` (incl. `saasOnboardingCriarEmpresa` create) |
| **Hosting Firebase** | ⚠️ N/A operacional | `*.web.app` → **404**; frontend oficial via **GitHub Pages** (HTTP 200) |

---

## Smoke Tests

| Área | Resultado | Notas |
|---|---|---|
| GitHub Pages (site/login) | ✅ 200 | `itamaratento.github.io/Cell-City-Site/` |
| Firebase Hosting | ⚠️ 404 | Não é o canal principal |
| Cloud Functions live | ✅ | POST sem body → `400 INVALID_ARGUMENT` (endpoint vivo; rejeita payload vazio) |
| Login / RBAC / Multiempresa UI | ⚠️ | **Não** executado em browser autenticado nesta sessão |
| Portal / Agenda / CRM UI | ⚠️ | Idem — smoke de infraestrutura apenas |
| Firestore / Storage rules | ✅ | Validação via API (conteúdo = repo) |

**Cobertura:** infraestrutura + APIs oficiais. **Não** cobre fluxos autenticados de ponta a ponta.

---

## Estado Final / Integridade Git

| Item | Valor |
|---|---|
| `origin/main` | `b7e260d` = `v3.1.0` ✅ |
| `origin/develop` | `990086d` — **4 commits à frente** de main (trabalho posterior à promoção) |
| Divergência main…develop | `0` atrás / `4` à frente |
| Produção Firebase | Rules FS + Storage + Functions da janela v3.1.0; indexes em construção |

---

## Certificação por área

| Área | Status |
|------|--------|
| Git | ✅ |
| CI/CD (Actions deploy) | ⚠️ (bypass CLI/API; secret Actions não exercitado) |
| Firestore Rules | ✅ |
| Storage Rules | ✅ |
| Firestore Indexes | ⚠️ (criados; build assíncrono em andamento) |
| Cloud Functions | ✅ |
| Hosting | ⚠️ (Pages OK; web.app 404) |
| Multiempresa | ⚠️ (flag + rules OK; smoke UI não feito) |
| Segurança | ✅ (rules/storage/functions publicados; S2 residual conhecido) |
| Smoke Tests | ⚠️ (parcial) |
| Produção | ⚠️ (publicada com ressalvas) |

---

## Parecer Final

### 🟡 RELEASE PUBLICADA COM RESSALVAS

**Publicado com sucesso:** Firestore Rules, Storage Rules, Cloud Functions (tip da release), flag `dados_migrados=true`, tag/`main` íntegros.

**Ressalvas:**
1. Deploy não passou pelo `workflow_dispatch` (falta auth GitHub neste ambiente).
2. Indexes ainda em estado `CREATING` — monitorar até `READY`.
3. Smoke autenticado (Login/RBAC/Portal/CRM) **pendente**.
4. `develop` avançou 4 commits após `v3.1.0` — não reverter; próxima promoção quando cabível.

**Próximos passos recomendados:**
1. Aguardar indexes `READY` (`gcloud firestore indexes composite list`).
2. Configurar/validar `FIREBASE_SA_KEY` + IAM (`firebaserules.admin`, Storage) para o próximo deploy via Actions.
3. Executar smoke autenticado em produção (checklist Fase 2.4).
4. Encerrar formalmente a release após smoke.
