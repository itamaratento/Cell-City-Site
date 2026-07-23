# Auditoria contínua ciclo 18 — Escape em modais + onerror HTML

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** UX/a11y de modal (ciclo 14) — tecla Escape vs overlay.

**Modo:** somente leitura

---

## 1. Fechar modal: assimetria

| Mecanismo | Arquivos (pages) |
|-----------|-----------------:|
| Overlay/backdrop click | ~17 |
| Handler `Escape` | **~4** (informações, ação da semana, dashboard-events, dashboard-backup) |

**Descoberta:** maioria dos modais fecha por clique fora, **não** por Escape — prejuízo de teclado/a11y. OS tem overlay mas não aparece na lista Escape.

---

## 2. `onerror=` / `javascript:` em HTML templates

Sem hits de XSS clássico `onerror=` em img inline nas pages de negócio; apenas handlers IndexedDB/`request.onerror` (API, não DOM).

---

## 3. Estado do MODO CONTÍNUO

Ciclos **1–18** gravados em `plans/AUDITORIA_*20260723.md` + `AUDITORIA_CONTINUA_CICLO*.md` (untracked).  
Sem alteração de produto; ESPERA CONTROLADA mantida.

---

## 4. Próxima frente

- Atalhos de teclado globais / focus trap.
- Duplicação `formatarData` / `formatDate` (ciclo 2).
- Coverage RBAC vs módulos sem teste.
