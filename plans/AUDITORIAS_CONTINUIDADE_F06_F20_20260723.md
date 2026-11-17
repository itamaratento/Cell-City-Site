# Auditorias continuidade — Frentes 6 a 20 (somente leitura)

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Pré-requisito:** F01–F05 em `AUDITORIAS_CONTINUIDADE_F01_F05_20260723.md`

---

## Frente 6 — Front-end ✅

| Achado | Pri |
|--------|-----|
| ~42 arquivos `CRM/pages/*/*.js` sem import `app-config` (inclui helpers/dashboard split) | 🟡 |
| ~31 arquivos já consomem `app-config` | 🟢 |
| Literais `/dev` em dashboard-caixa, impressao, config, alarme | 🟡 |
| DEBUG TEMPORÁRIO em `dashboard-alertas.js` | 🟡 |

---

## Frente 7 — UX ✅

| Achado | Pri |
|--------|-----|
| Padrão `empty-state` presente em várias telas (~6 arquivos JS) | 🟢 |
| Atributos `aria-`/`role=` raros (~8 arquivos) — acessibilidade fraca | 🟡 |
| Fluxos SaaS onboarding/admin com feedback visual OK por desenho | 🟢 parcial |

---

## Frente 8 — Documentação ✅

| Achado | Pri |
|--------|-----|
| `PROXIMA_ETAPA` / ADR A / FILA B / auditoria espera: coerentes | 🟢 |
| `MASTER_ROADMAP` defasado vs v3.2.0 | 🟡 |
| Roadmap Sprint 0–12 produto **não versionado** | 🟡 |
| HEAD Documental citado como `c64dae7` em PROXIMA; HEAD real `7f4e705` | 🟡 |

---

## Frente 9 — Testes ✅

| Suíte | Arquivos .mjs (aprox.) |
|-------|------------------------|
| rbac | 49 |
| firestore-rules | 47 |
| storage-rules | 46 |
| functions | 3 |
| saas-admin | 0 pasta dedicada (há teste em rbac) |
| e2e / performance / onboarding | 1 cada |

CI `tests.yml` roda `npm test` (Node 20). Emulador/ENOSPC já documentados como bloqueio ambiental histórico.

---

## Frente 10 — CI/CD ✅

| Workflow | Nota |
|----------|------|
| `tests.yml` | Node 20; suítes npm test |
| `deploy-firebase.yml` | Só `main`; WIF; guard Storage |
| `deploy-pages.yml` | Pages |
| `backup-weekly.yml` | Backup |

Gap: runner Node ≠ meta BL-007 (22); Storage deploy condicional.

---

## Frente 11 — Dependências ✅

| Pacote | Versão |
|--------|--------|
| Root `firebase` | ^12.14.0 |
| `firebase-admin` (dev) | ^14.1.0 |
| Functions `firebase-admin` | ^12.6 (lock 12.7) |
| Functions `firebase-functions` | ^6.0 (lock 6.6) |
| engines CF | **20** |

Sem audit npm audit executado neste ciclo (rede/npm PATH).

---

## Frente 12 — Dívida técnica ✅

Consolida: BL-001…005, 007, 009–011; queries sem limit; app-config parcial; repository parcial; Node 20; Storage; roadmap docs.

---

## Frente 13 — Duplicações ✅

| Tipo | Onde |
|------|------|
| Detecção `/dev` | kernel, brand-header, sidebar, env-config, páginas |
| getDocs full-scan | dashboard + financeiro |
| Numeração “Sprint” | MASTER vs PROXIMA SaaS vs conversa 0–12 |

---

## Frente 14 — Código morto ✅

| Achado | Nota |
|--------|------|
| Sem `*.BACKUP*` / `*.bak` em `CRM/` neste HEAD | 🟢 |
| `LOGS`/`CACHE`/`AUDITORIA` em app-config com adoção parcial | 🟡 já TECHDOC |
| Pasta `_runtime_audit/` / scripts seed | ferramentas locais, não “mortas” |

---

## Frente 15 — Logging ✅

~39 `console.*` só em shared + dashboard-alertas amostra; ~129 no CRM pages/shared/functions (ciclo anterior). DEBUG TEMPORÁRIO a remover.

---

## Frente 16 — Observabilidade ✅

Sem APM/Sentry no client auditado. Rate-limit CF em memória (não distribuído). Health engines V3 em `scripts/` (overlay). Gap: observabilidade prod limitada.

---

## Frente 17 — LGPD ✅

| Achado | Pri |
|--------|-----|
| Portal usa `cpfMascarado` em exibição OS | 🟢 |
| CRM chips/autoatendimento ainda podem mostrar CPF | 🟡 |
| Auditoria imutável usuários/permissoes | 🟢 |
| Coleções portal migradas para CF (menos PII no client) | 🟢 |

---

## Frente 18 — RBAC ✅

| Achado | Pri |
|--------|-----|
| UI via `permissoes.js` (~30 páginas) | 🟢 |
| Fail-open legado sem `perfil_operacional_id` | 🟡 |
| Rules sem matriz (ADR A / BL-011) | 🟡 consciente |
| Testes rbac amplos | 🟢 |

---

## Frente 19 — Índices ✅

`CRM/firestore.indexes.json`: **23** indexes compostos, 0 fieldOverrides. Adequação vs queries novas não revalidada query-a-query neste ciclo (sem emulador).

---

## Frente 20 — Oportunidades de melhoria ✅

1. Autorizar BL-007 (prazo).  
2. Autorizar decisão BL-009.  
3. Backlog `limit()` nos hotspots Firestore.  
4. Fechar cobertura `app-config` / remover DEBUG.  
5. Oficializar ou arquivar roadmap Sprint 0–12.  
6. Patch MASTER_ROADMAP + alinhar HEAD Documental em PROXIMA.  
7. Acessibilidade (aria) incremental.  
8. Observabilidade (erros client → log central).

---

## Encerramento da fila 1–20

Todas as frentes da ordem obrigatória foram **executadas ao menos uma vez** neste ciclo de continuidade (F01–F05 detalhadas; F06–F20 consolidadas).

Reexecução só com: novos commits, novos docs, nova falha de teste, ou solicitação explícita.
