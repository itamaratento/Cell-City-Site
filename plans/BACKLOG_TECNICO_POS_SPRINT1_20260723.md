# Backlog técnico — pós Sprint 1 Fundação SaaS (2026-07-23)

Itens **não bloqueantes** da conclusão da Sprint 1. Registrados para tratamento na etapa apropriada (governança / infra / próxima autorização).

| ID | Item | Severidade | Bloqueia Sprint 1? | Tratamento |
|----|------|------------|--------------------|------------|
| BT-S1-01 | Fechar PR #1 no GitHub com comentário de “superseded por `a524551`” | Média (governança) | Não | `gh` CLI **ausente**; instalação via `apt` bloqueada pela política do ambiente — **ação manual do dono** em https://github.com/itamaratento/Cell-City-Site/pull/1 |
| BT-S1-02 | Integrity completa (`rsync` simulado) hangou neste runner | Baixa | Não | Mitigado: CI remota **success** em `1b55878` e `fb67aa7` |
| BT-S1-03 | Unificar `shared/session.js` ao Kernel | Baixa | Não | Fora de escopo F1.3 explícito — Sprint própria |
| BT-S1-04 | Centralizar literal `'cc_kernel_v1'` nos HTMLs | Baixa | Não | Fora de escopo F1.3 — Sprint própria |
| BT-S1-05 | Relatórios untracked `plans/AUDITORIA_*` da espera | Higiene | Não | Commit documental separado se o dono quiser arquivar |

## Entrega confirmada nesta continuidade

- Commit `a524551` / `1b55878` / `fb67aa7` em `origin/develop`.
- Kernel 27/27 + CI **success** ([30027932174](https://github.com/itamaratento/Cell-City-Site/actions/runs/30027932174), [30028533346](https://github.com/itamaratento/Cell-City-Site/actions/runs/30028533346)).
- F1.1–F1.4: **completos**. Sprint 1 **ENCERRADA**.
