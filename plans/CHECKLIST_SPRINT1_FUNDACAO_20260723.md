# Checklist — Sprint 1 Fundação do SaaS (fechamento 2026-07-23)

**HEAD base:** `7f4e705` · **Branch:** `develop` · **Modo:** implementação autorizada

## Escopo da Sprint 1 (F1.1–F1.4)

| Fase | Conteúdo | Status em develop |
|------|----------|-------------------|
| F1.1 | Auditoria arquitetura (`auditar.mjs`) | ✅ pré-existente (§38) |
| F1.2 | `app-config.js` config global | ✅ pré-existente (§37) |
| F1.3 A2 | Auditor HTML + invariante 6 + ARQUITETURA §2.1 | ✅ pré-existente (§39 / A2) |
| F1.3 consolidação | `KERNEL.md` + `tests/kernel` + higiene + CI | ✅ **entregue nesta sessão** |
| F1.4 | Adoção app-config em 20 páginas | ✅ pré-existente + certificação |

## Gap fechado nesta sessão

- [x] NÃO mergear PR #1 (reverteria tenant)
- [x] Backup `_BACKUPS/15-PRE-KERNEL-FASE-1.3-DEVELOP-20260723/`
- [x] Remover `getEmail` / `AUTH_FLAG`
- [x] `clearTimeout` após Promise.race
- [x] `CRM/scripts/KERNEL.md` alinhado a PS-1/PS-2
- [x] `tests/kernel/` com mocks de tenant
- [x] Step CI Kernel (YAML válido + Java já no workflow)
- [x] TECHDOC §2 + §54
- [x] Testes: Kernel 27/27 · Arquitetura 6/6 · RBAC 181/181

## Fora de escopo (explícito F1.3)

- [ ] Unificar `shared/session.js` ao Kernel → BT-S1-03
- [ ] Centralizar literal `'cc_kernel_v1'` em ~34 HTMLs → BT-S1-04
- [x] Push `develop` (`a524551` → `origin/develop`) — feito 2026-07-23
- [ ] Fechar/reabrir PR #1 no GitHub → **BT-S1-01** (bloqueio de ferramenta: `gh` ausente; não bloqueia Sprint)

## Continuidade 2026-07-23 (modo contínuo)

- [x] Revalidar `tests/kernel` 27/27
- [x] Push remoto
- [x] Backlog técnico documentado (`plans/BACKLOG_TECNICO_POS_SPRINT1_20260723.md`)
- [x] Critério de encerramento Sprint 1: requisitos F1.1–F1.4 concluídos
