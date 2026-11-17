# Dívida técnica consolidada — ESPERA CONTROLADA (Script v2.0)

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Sem implementação**

Fonte: ciclos 1–18 + varredura fila 1–20 + PR/branches/índices/deps.

---

## P0 — Governança / integração presa

| ID | Item | Evidência | Auth necessária |
|----|------|-----------|-----------------|
| DT-01 | **PR #1 draft Kernel** aberto desde 2026-07-16, base=`main`, CI **failure**, 0 reviews | https://github.com/itamaratento/Cell-City-Site/pull/1 | Reabrir contra `develop` ou arquivar |
| DT-02 | Merge simulado PR→develop: conflito só em `TECHDOC.md` + `PROXIMA_ETAPA.md`; `kernel.js`/`tests.yml` auto-merge | `git merge --no-commit` | Resolver docs + trazer `tests/kernel/` |
| DT-03 | `develop` +13 commits vs `main` (não promovido) | `git rev-list` | Promoção formal |
| DT-04 | `MASTER_ROADMAP` desatualizado vs `PROXIMA_ETAPA` | ciclo 11 | Edição docs |

---

## P1 — Cota Firestore / performance

| ID | Item | Evidência |
|----|------|-----------|
| DT-10 | 97% `.list()` sem `limitTo` (28/29) | ciclo 7 |
| DT-11 | Financeiro 8× `getDocs` sem `limit`; bypass Repository | ciclos 1,4,5 |
| DT-12 | Central Alertas: `OS.list()` + 3× financeiro full | ciclo 6 |
| DT-13 | `portal_eventos` tracking sem limit (admin) | ciclo 5 |
| DT-14 | `listarPaginado` / `PAGINACAO`: 0 consumo em pages | ciclos 5–6 |
| DT-15 | BL-007 Functions ainda Node 20 | `functions/package.json` |

---

## P1 — Segurança / produto

| ID | Item | Evidência |
|----|------|-----------|
| DT-20 | XSS `startOSForClient('${phone}','${name}')` | ciclo 16 |
| DT-21 | fase22 não cobre interpolações cruas residuais em `os.js` | ciclo 15 |
| DT-22 | Alerta “não retirados” ignora status legado `pronto` | ciclos 10–12 |
| DT-23 | `STATUS_LEGACY` só rótulo — não canônica key | ciclo 12 |

---

## P2 — Padronização / UX / a11y

| ID | Item | Evidência |
|----|------|-----------|
| DT-30 | 19 IDs de toast; `showToast` clonado | ciclos 2,13 |
| DT-31 | Modais: 106 getElementById vs 5 `openModal`; Escape em ~4 files | ciclos 14,18 |
| DT-32 | 0 `aria-live` / `role=status` | ciclo 7 |
| DT-33 | Clone Comandos↔Informações ≥95% | ciclo 2 |
| DT-34 | Dual schema `createdAt`/`criadoEm`, `name`/`nome` | ciclos 8–9 |
| DT-35 | `firebase-admin` ^14 (raiz) vs ^12.6 (functions) | fila v2 |
| DT-36 | GHA: warning Node 20 deprecated (actions forçados p/ 24) em CI verde | panorama CI 2026-07-23 |
| DT-37 | PR #1 CI vermelho = ausência Java no workflow do head (não regressão Rules) | `RCA_CI_PR1_KERNEL_20260723.md` |

---

## P3 — Higiene

| ID | Item | Evidência |
|----|------|-----------|
| DT-40 | `getEmail` / `AUTH_FLAG` exportados sem consumidor (PR remove) | fila v2 |
| DT-41 | 12 branches locais legado não mergeadas | `git branch --no-merged` |
| DT-42 | Health-check local CRITICO (working tree) | logs CC 19/07 |
| DT-43 | Pastas pages sem suíte dedicada: dashboard, portal-cliente… | ciclo 8 |
| DT-44 | Artefatos auditoria untracked (este lote) | `git status` |

---

## Ordem sugerida (quando houver auth)

1. Decidir destino do **PR #1** (rebase→develop vs fechar).  
2. Pacote cota: `limitTo` em OS boot + central-alertas + financeiro (+ estender fase22 XSS).  
3. Correção alerta `pronto` + `startOSForClient` escape.  
4. BL-007 nodejs22 (FILA A).  
5. Padronização toast/modal (baixa urgência).

---

## Estado

ESPERA CONTROLADA. Lista pronta para autorização escopada — **não executar** sem pedido explícito do proprietário.
