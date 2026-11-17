# Panorama CI/CD (continuidade pós-RCA PR #1)

**Motivo:** após RCA do PR #1, mapear workflows e runs recentes — frente ainda não coberta nos ciclos 1–18.  
**Data:** 2026-07-23 · **HEAD develop:** `7f4e705` (CI test **success**)

---

## Workflows

| Arquivo | Gatilho | Nota |
|---------|---------|------|
| `tests.yml` | push main/develop, PR | Node 20 + **Java 21** (develop); verde no HEAD |
| `deploy-firebase.yml` | push paths rules/indexes/functions; **job só se `main`** | develop → job skipped (gate anti-incidente P0) |
| `deploy-pages.yml` | push main/develop | publica main + `/dev`; sucesso no HEAD |
| `backup-weekly.yml` | cron `0 */3 * * 0` (domingo UTC) + dispatch | idempotente; checkout `develop` |

---

## Achados

1. **RCA PR #1** → ver `RCA_CI_PR1_KERNEL_20260723.md` (falta Java no workflow do head).
2. **Node 20 deprecated no runner GHA** — warning mesmo em runs **success** de develop (`actions/checkout|setup-node|setup-java` forçados p/ Node 24). Relacionado a BL-007 / prazo Actions; não quebra hoje.
3. **Backup 19/07:** 8× `success` no domingo — **esperado** (cron a cada 3h). Dom 12/07: várias `failure` (era pré-D05/BL-010; último schedule 19/07 verde).
4. **Deploy Firebase** em develop com path match → workflow pode aparecer, job **skipped** (`if: main`). Último deploy real: `workflow_dispatch` main 19/07 success.

---

## Não é problema inventado

Multiplicidade de backups no domingo não é anomalia — está no comentário do próprio workflow.
