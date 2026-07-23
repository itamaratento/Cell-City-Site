# Backlog técnico — pós Sprint 1 Fundação SaaS (2026-07-23)

Itens **não bloqueantes** da conclusão da Sprint 1. Registrados para tratamento na etapa apropriada (governança / infra / próxima autorização).

| ID | Item | Severidade | Bloqueia Sprint 1? | Tratamento |
|----|------|------------|--------------------|------------|
| BT-S1-01 | Fechar PR #1 no GitHub com comentário de “superseded por `a524551`” | Média (governança) | Não | `gh` CLI **ausente** neste ambiente — ação manual do dono ou instalar `gh` + auth |
| BT-S1-02 | Integrity completa (`rsync` simulado) hangou neste runner | Baixa | Não | Suíte parcial (HTML/coleções/catálogo) OK; CI remota deve validar no push `a524551` |
| BT-S1-03 | Unificar `shared/session.js` ao Kernel | Baixa | Não | Fora de escopo F1.3 explícito — Sprint própria |
| BT-S1-04 | Centralizar literal `'cc_kernel_v1'` nos HTMLs | Baixa | Não | Fora de escopo F1.3 — Sprint própria |
| BT-S1-05 | Relatórios untracked `plans/AUDITORIA_*` da espera | Higiene | Não | Commit documental separado se o dono quiser arquivar |

## Entrega confirmada nesta continuidade

- Commit `a524551` **pushado** para `origin/develop` (`7f4e705..a524551`).
- Kernel 27/27 revalidado antes do push.
- F1.1–F1.4 requisitos funcionais/documentais da Sprint 1: **completos**.
