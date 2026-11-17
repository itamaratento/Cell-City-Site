# Encerramento — Sprint 2 Cadastro de Empresas (Tenants) · 2026-07-23

**Status:** ✅ CONCLUÍDA (código + testes + docs)  
**Plano:** [`SPRINT2_CADASTRO_EMPRESAS_20260723.md`](SPRINT2_CADASTRO_EMPRESAS_20260723.md)  
**Branch:** `develop`  
**Backup:** `_BACKUPS/18-PRE-SPRINT2-CADASTRO-20260723/`

## Entrega

| Item | Resultado |
|------|-----------|
| Paridade CRUD ↔ CF onboarding (`modulos_ativos` / `feature_flags`) | ✅ |
| `provisionamentoPorPlano` no client (`saas-planos.js`) | ✅ |
| Lista `empresas` com `orderBy` + `limit` (cota) | ✅ |
| Testes RBAC saas-admin 7/7 | ✅ |
| Parity client↔functions nos testes onboarding | ✅ |
| Numeração operacional S2 documentada (≠ S2 Portal legado) | ✅ |

## Arquivos alterados

- `CRM/shared/saas-planos.js`
- `CRM/pages/saas-admin/saas-admin.js`
- `tests/rbac/saas-admin.test.mjs`
- `tests/onboarding/saas-onboarding-validacao.test.mjs`
- `plans/SPRINT2_CADASTRO_EMPRESAS_20260723.md` (este ciclo)
- `PROXIMA_ETAPA.md` / `CRM/TECHDOC.md` §55

## Testes

```bash
node --test tests/onboarding/saas-onboarding-validacao.test.mjs   # 11/11
cd tests/rbac && node --import ./register-loader.mjs --test saas-admin.test.mjs  # 7/7
```

## Residuais (não bloqueantes)

| Item | Nota |
|------|------|
| E2E onboard → approve → login | ambiente / ENOSPC |
| Emulador CF `saas-onboarding.test.mjs` | mesma restrição |
| BL-007 deploy Functions nodejs22 | config ok; falta deploy |
| BL-009 / BL-010 | decisão / ação externa |

## Próxima etapa sugerida

Aguardar autorização para **Sprint 3 (nova série)** — polish do wizard / UX onboarding — ou pacote pontual do inventário aberto (deploy BL-007, etc.).
