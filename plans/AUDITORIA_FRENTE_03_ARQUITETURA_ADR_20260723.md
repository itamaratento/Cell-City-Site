# Frente 3 — Arquitetura (cross-check vs ADRs)

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Somente leitura**

---

## ADRs / docs de arquitetura encontrados

| Doc | Papel |
|-----|--------|
| `plans/ADR_AUTH_001_…` | **ACEITO** — Alt. A |
| `plans/CCC-V2.0-ARCH-001_…` (+ cópia v3) | Arquitetura oficial |
| `ENGINEERING.md` | Autoridade de engenharia (já alinhado ao ADR no checkpoint UX/docs) |

---

## Cross-check ADR-AUTH-001 × código

| Afirmação ADR | Evidência | Status |
|---------------|-----------|--------|
| Rules = auth + tenant/empresa (+ gates) | `temAcessoLiberado` / `empresa_id` nas Rules | ✓ |
| Matriz RBAC (visualizar/criar/…) na app | `permissoes.js` + gates nos módulos | ✓ |
| Rules **não** são a matriz operacional | Rules sem `podeVisualizar` / matriz por módulo | ✓ |
| BL-011 dívida consciente | documentado na certificação v3.2.0 | ✓ (doc) |

### Nuance (não contradição)

`functions/admin.js` autoriza com **`perfil` legado** (`admin` / `master_admin`), não `perfil_operacional_id`. Compatível com Alt. A (RBAC operacional na app; ação privilegiada no server usa perfil Auth legado). Vale registrar na Frente 18 (não-regressão) que CF admin **não** lê a matriz de `perfis_operacionais`.

### Repository Layer

16 `*.repository.js` — alinhado à ARCH (persistência via camada). Financeiro/Caixa ainda bypass (dívida já consolidada) — **gap de adesão**, não de ADR de auth.

---

## Próxima frente

→ **Frente 4 — Firestore modelo de dados**.
