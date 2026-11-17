# Frente 5 — Cloud Functions (delta)

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Somente leitura**  
**Motivo:** auth já na Frente 1 — aqui superfície, rate-limit, testes, runtime.

---

## Superfície

**16** callables exportadas em `functions/index.js` (1 admin + 2 OS + 12 portal + 1 saas). Todas referenciadas no client (inventário anterior).

- Runtime: **Node 20** (`engines`) — BL-007.  
- Região: `REGIAO` compartilhada.  
- Rate limit: portal + saas + OS pública; **`excluirUsuarioAdmin` sem `aplicarRateLimit`** (mitigado por auth admin — aceitável; brute force de UIDs ainda teoricamente possível se sessão admin vazada).

Rate-limit é **in-memory** (não global entre instâncias) — limitação documentada no próprio `lib/rate-limit.js`.

---

## Testes

| Suíte | Cobertura |
|-------|-----------|
| `portal-cloud-functions.test.mjs` | Ampla (mensagens, agenda, orçamento, CPF mascarado…) |
| `saas-onboarding.test.mjs` | Onboarding |
| `rate-limit-s2.test.mjs` | Limites consulta OS |
| Teste dedicado `excluirUsuarioAdmin` | **Não visto** na pasta functions |

---

## Próxima frente

→ **Frente 6 — Front-end (qualidade geral)**.
