# Frente 15 — Logging

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Somente leitura**  
**Motivo:** pós Frente 14; ângulo = política de log, tags, silêncio — não só contagem.

---

## Inventário client (`CRM/**/*.js`)

| Nível | Ocorrências |
|-------|------------:|
| `console.warn` | 161 |
| `console.log` | 132 |
| `console.error` | 106 |
| **Total** | **399** |

**Hotspots:** `dashboard-alarme-os.js` (65), `sw-alarme.js` (34), `os.js` (32), portal (24+22).

**Tags frequentes:** `[Portal]` (52), `[CAIXA]`, `[Alertas]`, `[Admin]` — convenção informal, sem logger central.

**Fachada `LOGS.debugAtivo` / `cc_repo_debug`:** só `app-config` + `base.repository.padrao` — telemetria de produto **não** passa por ela.

**Catch vazio `{}`:** ~50 · **catch com return silencioso:** ~20 — erros engolidos sem log.

---

## Cloud Functions

**Zero** `console.*` / `functions.logger` em `functions/**/*.js` nesta varredura — falhas sobem como `HttpsError`; diagnóstico em produção depende só do que o runtime captura em uncaught. Lacuna de observabilidade server-side (ponte p/ Frente 16).

---

## Achados

1. Logging = **console cru**, concentrado em alarme OS / portal.  
2. `LOGS` do app-config quase sem adoção (coerente c/ código morto TEMPOS).  
3. CF sem logs explícitos.  
4. Muitos `catch` silenciosos — risco de falha invisível.

Sem proposta de implementação.

---

## Próxima frente automática

→ **Frente 16 — Observabilidade**
