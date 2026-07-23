# Script ESPERA v2.0 — varredura da fila de continuidade

**Data:** 2026-07-23 · **HEAD develop:** `7f4e705` (2026-07-21)  
**Modo:** somente leitura · implementação bloqueada

---

## Checklist da fila (1–20)

| # | Fonte | Inspecionado? | Achado novo nesta passagem |
|---|-------|:-------------:|----------------------------|
| 1 | Arquivos novos | ✓ | Só artefatos de auditoria untracked + noise `git-info`/`health-check` |
| 2 | Commits recentes | ✓ | Sem commit novo desde `7f4e705`; develop **+13** vs `origin/main` (docs/gov + BL-008) |
| 3 | Branches | ✓ | **12 locals** não mergeadas (legado H-00x); **remoto órfão** `cursor/kernel-consolidation-phase-1-3-d9b9` |
| 4 | Pull Requests | ✓ | **PR #1 OPEN DRAFT** — Kernel Fase 1.3 (ver §A) |
| 5 | Issues | ✓ | **0 issues** (só o PR #1 na API) |
| 6 | ADRs | ✓ | ADR-AUTH-001 ACEITO (Alt. A); sem ADR novo pós-HEAD |
| 7 | Roadmaps | ✓ | `MASTER_ROADMAP` stale vs `PROXIMA_ETAPA` (já ciclos 11+) |
| 8 | Testes | ✓ | **`tests/kernel/` ausente em develop**; existe só no PR #1 |
| 9 | Logs | ✓ | CC health **CRITICO** local (19/07); Rules consult falhou 18/07; sem log novo pós-HEAD |
| 10 | Cloud Functions | ✓ | engines **nodejs 20** (BL-007); callables todas referenciadas (ciclo 9) |
| 11 | Firestore | ✓ | dual `createdAt`/`criadoEm` (ciclos 8–9); sem acesso live a dados |
| 12 | Regras | ✓ | 23 índices ↔ Rules já auditados; sem diff Rules pós-HEAD |
| 13 | Índices | ✓ | 23 composites; `orderBy('nome_fantasia')` saas-admin sem composite dedicado (single-field OK) |
| 14 | Dependências | ✓ | `firebase-admin` **^14** (raiz) vs **^12.6** (functions); CI Node 20 |
| 15 | Código morto | ✓ | `getEmail`/`AUTH_FLAG` ainda em develop; PR remove — **não mergeado** |
| 16 | Duplicações | ✓ | toast/modal/formatarData/comandos↔info (ciclos 2–18) |
| 17 | Performance | ✓ | `.list` 97% sem limit; portal_eventos unbounded (ciclos 5–7) |
| 18 | Segurança | ✓ | XSS `startOSForClient`; fase22 12/12; alerta `pronto` (ciclos 10–16) |
| 19 | UX/a11y | ✓ | Escape raro; 19 toast IDs; 0 aria-live (ciclos 13–18) |
| 20 | Documentação | ✓ | Drift MASTER; untracked audits; PR docs Kernel fora de develop |

---

## §A — Achado principal desta passagem: PR #1 órfão

| Campo | Valor |
|-------|--------|
| URL | https://github.com/itamaratento/Cell-City-Site/pull/1 |
| Estado | **open · draft · não mergeado** |
| Base | **`main`** (não `develop`) |
| Head | `cursor/kernel-consolidation-phase-1-3-d9b9` @ `5afc65d` |
| Atualizado | 2026-07-16 (antes do congelamento v3.2.0 / Fila B) |
| Reviews | 0 |
| Delta | +1362 / −15 · 6 commits |

Conteúdo relevante **fora** de `develop`:
- suíte `tests/kernel/` completa
- `CRM/scripts/KERNEL.md` + TECHDOC §36
- limpeza timeout `clearTimeout` em `initModulo`/`getCtxAsync`
- remoção `getEmail` + `AUTH_FLAG` (ainda presentes em develop — **0 consumidores** no grep de pages)

**Risco de governança:** PR aponta para `main` enquanto a linha viva é `develop` (+13 commits docs/fix). Merge direto na main **furaria** o fluxo develop→main da espera controlada.

**CI do head:** check run `test` → **failure**  
https://github.com/itamaratento/Cell-City-Site/actions/runs/29530875942/job/87730610479

**Merge simulado → develop (2026-07-23):**
- Auto-merge: `.github/workflows/tests.yml`, `CRM/scripts/kernel.js`
- **Conflito de conteúdo:** `CRM/TECHDOC.md`, `PROXIMA_ETAPA.md`
- Adições limpas: árvore `tests/kernel/**`, `KERNEL.md`, relatórios Fase 1.3

**Dívida:** suíte Kernel e hardening de timeout ficaram **presos no draft** — develop não tem `tests/kernel/`.

**Código morto confirmado em develop:** `getEmail` / `AUTH_FLAG` sem import externo; gates HTML usam literal `cc_kernel_v1` (via `STORAGE_KEYS.KERNEL_GATE` / inline).

---

## §B — develop × main

- `origin/develop` está **13 commits à frente** de `origin/main` (0 atrás).
- Conteúdo: governança v3.2.0, Fila B, BL-008 harness TAP — majoritariamente docs + 1 fix de teste.
- Promoção develop→main **não autorizada** neste modo.

---

## §C — Dependências / runtime

| Item | Evidência |
|------|-----------|
| BL-007 | `functions/package.json` → `"node": "20"`; CI `node-version: "20"` |
| Admin SDK | raiz `^14.1.0` vs functions `^12.6.0` — drift de major entre toolchains |
| Logs CC | último health completo **CRITICO** 37/48 (estado working tree sujo, não commitado) |

---

## §D — O que NÃO é “universo esgotado”

Enquanto o PR #1 permanecer open/draft e a suíte Kernel não estiver em develop, existe **evidência externa viva** (GitHub) exigindo acompanhamento — não o texto de encerramento do script.

Próximas análises justificáveis (ainda sem implementar):
1. Rebase-simulado PR #1 → develop (diff de conflito com Fila B / TECHDOC).
2. Confirmar CI do draft PR (checks) via API.
3. Consolidar backlog único (cota + XSS + PR Kernel + BL-007 + docs).
4. Comparar `getEmail`/`AUTH_FLAG` consumidores em HTML clássico (não só `.js`).

---

## Estado

**ESPERA CONTROLADA** — implementação bloqueada.  
Fila 1–20 inspecionada nesta sessão; **nova evidência:** PR #1 draft Kernel não integrada.
