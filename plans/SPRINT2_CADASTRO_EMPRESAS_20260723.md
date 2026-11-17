# Sprint 2 — Cadastro de Empresas (Tenants) · 2026-07-23

## Numeração

| Série | Significado |
|-------|-------------|
| **Nova (operacional)** | S1 Fundação ✅ → **S2 Cadastro Empresas** → (futuro) S3 polish wizard / S4 usuários |
| **Legada SaaS no repo** | S2 Portal split · S3 Onboarding · S4 Admin aprovação — **já concluídas** |

Esta Sprint 2 **não** reconstrói o wizard nem a aprovação. Formaliza o cadastro de tenants e fecha gaps reais no CRUD / provisionamento.

## Objetivo

Garantir que toda empresa criada ou editada pelo operador (`saas-admin`) nasça com o mesmo contrato de plano que a Cloud Function `saasOnboardingCriarEmpresa`: `modulos_ativos` + `feature_flags`.

## Já existia (baseline)

- Wizard self-service + CF onboarding
- Aprovação/rejeição no `saas-admin`
- Catálogo `CRM/shared/saas-planos.js` + espelho em `functions/lib/saas-planos.js`
- Rules `master_admin` em `empresas`

## Gaps fechados nesta sprint

1. **Paridade de provisionamento no CRUD manual** — `salvar()` grava `modulos_ativos` / `feature_flags` via `provisionamentoPorPlano` (create e edit de plano).
2. **Espelho client** — `featureFlagsObject` + `provisionamentoPorPlano` em `CRM/shared/saas-planos.js` (sync manual com functions).
3. **Cota na listagem** — `orderBy('nome_fantasia')` + `limit(PAGINACAO.LIMITE_LISTA_PADRAO)`.
4. **Testes** — CRUD provisiona no harness RBAC; parity client↔functions no onboarding suite.
5. **Docs** — este plano + relatório de encerramento + `PROXIMA_ETAPA` / TECHDOC §55.

## Fora de escopo (deliberado)

- PS5-003 verificação de e-mail
- BL-009 Blaze / BL-010 GitHub Backup UI
- Promoção SaaS a produção / e-mail de boas-vindas
- Redesign do wizard (mapa: futura “nova S3”)
- Gestão de usuários/convites (mapa: futura “nova S4”)
- Campos CNPJ/billing / `config` global multi-tenant

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `CRM/shared/saas-planos.js` | `featureFlagsObject` + `provisionamentoPorPlano` |
| `CRM/pages/saas-admin/saas-admin.js` | provisionamento no `salvar`; limit na lista |
| `tests/rbac/saas-admin.test.mjs` | caso CRUD provisiona |
| `tests/onboarding/saas-onboarding-validacao.test.mjs` | parity client/functions |
| `_BACKUPS/18-PRE-SPRINT2-CADASTRO-20260723/` | backup pré-alteração |

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Edit de plano sobrescreve flags custom | Intencional nesta sprint — plano é fonte da verdade no CRUD |
| `orderBy(nome_fantasia)` exige índice | campo escalar simples; Firestore auto-index single-field |
| E2E onboard→approve / emulador CF | residual de ambiente (`ENOSPC`); não bloqueia código |
