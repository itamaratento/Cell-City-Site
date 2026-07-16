# 📄 RELATÓRIO TÉCNICO — Sprint 1 (Kernel SaaS), Fase 1.3.1

**Correção Pós-Auditoria do Kernel — Cell City CRM**

| | |
|---|---|
| Data | 2026-07-16 |
| Sprint | Sprint 1 — Kernel SaaS |
| Fase | 1.3.1 — Correção pós-auditoria (exclusiva, sem outras fases) |
| Escopo | Achados da auditoria técnica da Fase 1.3 — CI, documentação, testes, timers |
| Branch | `cursor/kernel-consolidation-phase-1-3-d9b9` |
| Base | Fase 1.3 (`plans/RELATORIO_TECNICO_KERNEL_FASE_1_3.md`) |

---

## 1. Resumo

A auditoria técnica da Fase 1.3 identificou um **YAML inválido** que
impedia a CI de executar qualquer step, lacunas de documentação sobre
exceções deliberadas ao boot único, timers órfãos em `initModulo()`/
`getCtxAsync()`, import morto nos testes e ausência de cobertura para
timeout real e falha de `setDoc` no primeiro acesso.

Esta Fase corrigiu **exclusivamente** esses achados, com alterações
mínimas e sem mudança de comportamento funcional, API pública ou regras
de negócio.

## 2. Arquivos alterados

| Arquivo | Linhas (+/−) | Motivo |
|---|---|---|
| `.github/workflows/tests.yml` | 1/1 | Aspas no `name` do step — YAML válido |
| `CRM/scripts/kernel.js` | +6/−2 | `clearTimeout` após `Promise.race` |
| `CRM/scripts/KERNEL.md` | +24/−14 | Listener one-shot, `catalogo-publico`, testes |
| `tests/kernel/kernel.test.mjs` | +48/−1 | Import morto, +3 testes |
| `tests/kernel/mocks/firestore-mock.js` | +11/0 | Mock de falha de `setDoc` |
| `CRM/TECHDOC.md` | +§37 | Registro oficial da Fase 1.3.1 |
| `PROXIMA_ETAPA.md` | bloco aditivo | Registro da entrega |
| `plans/RELATORIO_KERNEL_FASE_1_3_1.md` | novo | Este relatório |

**Total estimado de linhas alteradas no código/CI/testes:** ~82 inserções,
~18 remoções (5 arquivos de execução + 3 de documentação).

## 3. Problemas corrigidos

### CRÍTICO — CI (`tests.yml`)

- **Problema:** `name: Testes do Kernel (Sprint 1 — Fase 1.3: boot, …)` —
  o `:` após `1.3` era interpretado como separador YAML de mapping,
  invalidando o workflow (run falhava em 0s, nenhum step executado).
- **Correção:** `name` entre aspas duplas; removido `:` redundante após
  `1.3` no texto do step.
- **Validação:** `python3 -c "import yaml; yaml.safe_load(...)"` → OK.

### MÉDIO — Documentação (`KERNEL.md`)

- **Problema:** §2 afirmava "único listener" sem distinguir o listener
  **persistente** do Kernel do listener **one-shot** em `firebase.js`.
- **Correção:** §2 reescrito; §6 expandido de 3 para 5 exceções:
  `firebase.js` (`authReady`), `session.js`, `firebase-secondary.js`,
  `catalogo-publico.js`, `portal-cliente/*`.

### MÉDIO — Timers (`kernel.js`)

- **Problema:** `setTimeout` em `Promise.race` nunca era cancelado quando
  `_ready` resolvia primeiro — timers órfãos (~10s × N chamadas).
- **Correção:** `let timeoutId` + `clearTimeout(timeoutId)` após o race.
- **Garantia:** mesma API, mesmo retorno, mesmo fluxo — apenas limpeza de
  recurso; confirmado pelos 27 testes existentes + novos de timeout.

### MÉDIO/BAIXO — Testes (`tests/kernel/`)

- Removido import morto `beforeEach`.
- +2 testes de timeout com `mock.timers` (`initModulo`, `getCtxAsync`).
- +1 teste edge case: falha de `setDoc` no primeiro acesso (fail-safe).
- Suíte: **24 → 27 testes**, todos verdes; duração ~160ms (vs ~10s+ antes
  da limpeza de timers em cenários de timeout).

## 4. Testes

| Suíte | Resultado | Relação com esta Fase |
|---|---|---|
| `tests/kernel/` | **27/27 ✅** | Direta — +3 testes, import limpo |
| `tests/rbac/` | 164/166 | Indireta — kernel mockado; 2 falhas pré-existentes (`financeiro-relatorio`) |
| `tests/integrity/` | 13/14 | Sem relação — falha por `rsync` ausente no ambiente |
| `tests/control-center/` | 91/94 | Sem relação — 3 falhas por branch/git do ambiente |

**Cobertura do Kernel:** boot único, auth, tenant, permissões, login/logout,
timeout real, fail-safe de leitura e escrita Firestore, smoke test ponta a
ponta, ausência de exports mortos (`getEmail`, `AUTH_FLAG`).

## 5. Re-auditoria (Fase 6)

| Verificação | Resultado |
|---|---|
| Código morto em `kernel.js` | ✅ Nenhum (`getEmail`/`AUTH_FLAG` removidos na 1.3) |
| Imports mortos em `tests/kernel/` | ✅ `beforeEach` removido |
| Exports mortos | ✅ 11 funções públicas, todas com consumidores |
| Listener duplicado no Kernel | ✅ Um único `onAuthStateChanged` persistente |
| Exceções documentadas | ✅ §6 com 5 casos deliberados |
| Timer leak | ✅ `clearTimeout` aplicado |
| Regressão funcional | ✅ Nenhuma detectada nas suítes executadas |

**Achados da auditoria original não corrigidos nesta Fase (fora do escopo):**

- CI: step Firestore Rules falha por Java &lt; 21 nos runners GitHub Actions.
- `diario.js::salvar()` reinvoca boot completo.
- `brand-header.js` listener `kernel-ready` sem `{ once: true }`.

## 6. Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| `clearTimeout` com `timeoutId` undefined se race resolver sync | Baixo | Guard `if (timeoutId)` antes de limpar |
| MockTimers experimental no Node | Baixo | Testes isolados com `finally { mock.timers.reset() }` |
| CI Firestore Rules ainda bloqueia steps seguintes | Médio | Pré-existente; fora do escopo 1.3.1 — requer Java 21+ no workflow |
| Falhas RBAC/Integridade/CC pré-existentes | Baixo | Confirmadas idênticas antes desta Fase; não causadas pelas alterações |

## 7. Conclusão

A Fase 1.3.1 cumpre o mandato da auditoria: CI parseável, documentação
precisa sobre exceções deliberadas, timers limpos sem alterar comportamento,
e suíte do Kernel ampliada para 27 testes verdes.

**Recomendação:** **aprovado para merge** na branch de feature, desde que
a revisão técnica confirme que as falhas pré-existentes (RBAC financeiro,
`rsync`, Control Center git) permanecem fora do escopo desta entrega.

Commit local gerado nesta Fase — **sem push e sem PR**, conforme instrução
da Sprint.
