# Frentes 9–10 — Testes + CI/CD (delta)

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Somente leitura**  
**Motivo:** checkpoint Ciclo 10 (UX+docs) → seguir Testes e CI/CD; CI panorama/RCA já feitos — aqui só **gaps novos**.

---

## Frente 9 — Testes

### Inventário

| Pasta | Arquivos `*.test.*` | Na CI? |
|-------|--------------------:|:------:|
| `tests/rbac/` | 37 | ✓ `npm test` |
| `tests/control-center/` | 4 | ✓ |
| `tests/functions/` | 3 | ✓ emulador |
| `tests/integrity/` | 2 | ✓ explícito |
| `tests/firestore-rules/` | 2 | ✓ |
| `tests/storage-rules/` | 1 | ✓ |
| `tests/performance/` | 1 | ✓ |
| `tests/e2e/` | 1 | ✓ Puppeteer |
| `tests/onboarding/` | 1 | ✓ |
| `tests/infra/` | 1 | ✓ via `npm run validar-infra-app-config` |
| **`tests/os/`** | **1** | **✗ NÃO** |
| `tests/saas-admin/` | **0** (dir vazio) | — |
| `tests/kernel/` | só no PR #1 | ✗ develop |

**Total:** 54 arquivos de teste no develop; **1 suíte órfã de CI:** `tests/os/mensagem-finalizado.test.mjs` (mensagem WhatsApp OS finalizada — garantia/portal/emojis).

### Achados

1. Cobertura CI das suítes locais está **alta** (~53/54).  
2. Lacuna real: teste de OS finalizado **existe e não roda na CI**.  
3. `tests/saas-admin/` vazio — pasta residual sem valor.  
4. Suíte Kernel continua só no draft PR #1 (já RCA’d).  
5. RBAC concentra 37/54 arquivos — forte em gates; fraco em lógica de negócio (financeiro/cálculos etc. fora do escopo RBAC).

---

## Frente 10 — CI/CD (apenas delta vs panorama/RCA)

Já documentado: Java 21, 4 workflows, Pages `/dev`, backup cron, PR #1, warning Node 20.

### Delta desta frente

| Item | Severidade |
|------|------------|
| `mensagem-finalizado.test.mjs` fora do `tests.yml` | Baixa–média (regressão de template WhatsApp sem rede) |
| Nenhum `timeout-minutes` nos jobs longos (CC shell) | Baixa (comentário no YAML admite ~10 min) |
| `tests/saas-admin/` vazio | Ruído |
| E2E Puppeteer na CI (Chrome) — depende do runner ter browser | Já operacional (HEAD verde); risco de flakiness não reauditorado |

Não reabre RCA PR #1 nem inventário de workflows.

---

## Próxima frente automática

→ **Frente 1 — Segurança** (segredos hardcoded + auth Cloud Functions), ainda não nesta fila de 20.
