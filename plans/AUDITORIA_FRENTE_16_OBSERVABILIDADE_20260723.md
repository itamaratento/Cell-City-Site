# Frente 16 — Observabilidade

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Somente leitura**

---

## O que existe

| Camada | Mecanismo |
|--------|-----------|
| Ops local | Control Center / Health Engine (`scripts/health-engine`, `health-check.json`) |
| Auditoria de negócio | `auditoria_usuarios_permissoes`, `auditoria_saas`, `saas_eventos`, `backup_logs` |
| Analytics portal | `portal_eventos` (acessos/cliques) — client |
| Offline/alarme | Service Worker `sw-alarme.js` (dashboard) + `CRM/sw.js` |
| CI | workflows verde/vermelho (sem APM) |

## O que não existe (evidência negativa)

- Sem Sentry / Datadog / GTM / `performance.mark` / `unhandledrejection` handler global no CRM.
- Sem `functions.logger` (Frente 15).
- OpenTelemetry só como **dependência transitiva** do lockfile CF — não instrumentado no código.

## Achado

Observabilidade = **auditoria Firestore + health shell + console**. Adequada a operação interna pequena; fraca para incidente em CF/produção (sem trilha estruturada).

---

## Próxima frente

→ **Frente 17 — LGPD**
