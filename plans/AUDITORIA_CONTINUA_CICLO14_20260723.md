# Auditoria contínua ciclo 14 — modais + testes de paginação

**Data:** 2026-07-23 · **HEAD:** `7f4e705`  
**Justificativa:** UX além de toast (ciclo 13); checa se a suíte de testes protege a disciplina de `limit`.

**Modo:** somente leitura

---

## 1. Padrões de modal

| Padrão | Ocorrências (pages) |
|--------|--------------------:|
| `getElementById(*modal*)` | **106** |
| `openModal(` | **5** (só OS / `os-ui-utils`) |
| `HTMLDialogElement.showModal` | **2** |

**Descoberta:** modal “oficial” encapsulado existe só na OS; o resto é show/hide manual por id — outro clone estrutural (como toast), sem `shared/modal.js`.

Não há helper de modal em `CRM/shared/` com export dedicado (amostra).

---

## 2. Testes × cota

- `listarPaginado` coberto em `tests/rbac/repositories-api.test.mjs` (API da camada).
- **Nenhum** teste de integridade de página exige `limitTo` / proíbe `.list()` sem teto.
- Gap: a API está testada; a **convenção de uso nas pages não**.

---

## 3. Sem `data-toast`

Nenhum `data-toast` no CRM — unificação exigiria introduzir seletor novo ou mapa id→módulo.

---

## 4. Próxima frente

- Contar `closeModal` / backdrop / Escape key inconsistências.
- `functions/lib` vs `CRM/shared` duplicação de phone/planos.
- Revisar `seguranca-fase22` / integrity tests recentes (git status).
- Continuar sem repetir ciclos 1–14.
