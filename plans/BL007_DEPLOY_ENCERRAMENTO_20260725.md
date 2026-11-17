# BL-007 — Deploy runtime Node.js 22 · Encerramento 2026-07-25

**Status:** ✅ CONCLUÍDO (config já em `develop` desde `9beab31`; **runtime publicado** em DEV e PROD nesta sessão)  
**Autorização:** continuidade explícita do dono — “Caso esteja tudo aprovado: Iniciar BL-007” + publicar todas as Cloud Functions para Node.js 22.  
**Backup pré-deploy:** `_BACKUPS/19-PRE-BL007-DEPLOY-20260725/` (`firebase.json`, `functions/package.json`, `tests.yml`)

## Pré-condições (já no repo)

| Arquivo | Valor |
|---------|-------|
| `functions/package.json` engines | `"node": "22"` |
| `firebase.json` functions.runtime | `nodejs22` |
| `.github/workflows/tests.yml` | Node 22 |
| Teste estático | `tests/integrity/cota-limites.test.mjs` (assert BL-007) |

## Deploy executado

| Ambiente | Projeto | Resultado |
|----------|---------|-----------|
| DEV | `cellcity-crm-dev` | 16/16 atualizadas → **Node.js 22 (2nd Gen)** |
| PROD | `cellcity-crm` | 16/16 atualizadas → **Node.js 22 (2nd Gen)** |

Funções: `excluirUsuarioAdmin`, `consultarOSPublica`, `consultarOSPorTelefonePublica`, 12× `portal*`, `saasOnboardingCriarEmpresa`.

## Verificação de runtime (amostra `gcloud functions describe`)

Todas amostradas: `buildConfig.runtime=nodejs22` · `state=ACTIVE`

- DEV: `saasOnboardingCriarEmpresa`, `portalObterNomeCliente`, `consultarOSPublica`, `excluirUsuarioAdmin`, `portalListarHorariosOcupados`
- PROD: mesmas + `portalEnviarMensagem`

## Smoke tests (HTTP callable Gen2)

| Função | DEV | PROD | Observação |
|--------|-----|------|------------|
| `portalObterNomeCliente` | HTTP 200 `{"result":{"name":""}}` | HTTP 200 idem | telefone fictício |
| `consultarOSPublica` | HTTP 404 `OS não encontrada` | HTTP 404 idem | ID fictício — comportamento esperado |
| `portalListarHorariosOcupados` | HTTP 200 `ocupados:[]` | HTTP 200 idem | data futura |

## Logs

- DEV: `gcloud logging read` (15 min, severity≥ERROR) — sem erros retornados.
- PROD: SA `firebase-adminsdk-fbsvc@cellcity-crm` **sem permissão** em Cloud Logging (`PERMISSION_DENIED`). Residual de IAM — **não** indica falha de runtime; smoke HTTP cobriu o caminho crítico.

## Testes locais pós-deploy

- `tests/integrity/cota-limites.test.mjs` — 5/5 (inclui assert BL-007)
- `node --check functions/index.js` + `functions/saas.js` — OK
- (sessão anterior) onboarding + saas-admin — verdes

## Avisos do CLI (não bloqueantes)

Firebase CLI avisou `firebase-functions` desatualizado (`^6` instalado). **Não** feito bump nesta entrega — fora do escopo mínimo do BL-007 (só runtime); breaking changes possíveis.

## Rollback

1. Reverter `engines`/`runtime` para nodejs20 **ou** redeploy a partir do commit pré-`9beab31` com `firebase.json` nodejs20.
2. `firebase deploy --only functions --project <dev|prod>`.
3. Gen2 mantém revisões no Cloud Run.

## Escopo deliberadamente fora

- Bump de `firebase-functions` / `firebase-admin`
- Alteração de lógica das functions
- BL-009 / BL-010
- Correção de IAM de Logging da SA de produção

## Arquivos desta entrega (docs)

- Este relatório
- `PROXIMA_ETAPA.md` · `plans/BACKLOG.md` · `CRM/TECHDOC.md` §57
