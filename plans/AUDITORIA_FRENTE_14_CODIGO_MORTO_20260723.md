# Frente 14 — Código morto

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Somente leitura**  
**Estado:** ESPERA CONTROLADA

---

## Método

Varredura de exports em `CRM/shared`, símbolos do Kernel, pastas vazias e consumidores em `.js`/`.html`/`.mjs` (incl. testes).  
Heurística “código após `return`” gerou muitos **falsos positivos** (ASI / returns em callbacks) — **não** usada como evidência.

---

## A) Morto comprovado (0 consumidores de produto)

| Símbolo | Onde | Evidência |
|---------|------|-----------|
| `getEmail` | `kernel.js` | só definição |
| `AUTH_FLAG` | `kernel.js` | só definição (`FLAG_AUTH` interno ainda usado p/ localStorage) |
| `formatDateFull` | `date-utils.js` | só definição |
| `legacyPhoneVariants` | `phone-utils.js` | só definição |
| `getTenantName`, `onTenantChange` | `tenant-context.js` | só definição (+ comentário de uso) |
| `getMatrizAtual` | `permissoes.js` | só definição |
| `temModulo`, `temFeature`, `getModulosPorPlano`, `getFeatureFlags` | `saas-planos.js` | só definição/comentário; páginas usam outros caminhos |
| `TEMPOS` | `app-config.js` | só definição + teste infra (fachada sem runtime) |
| `listarLixeira`, `purgarLixeira`, `removerDaLixeira` | `cc-sync.js` | **nenhum** import externo |
| `COL_LOGS`, `RETENCAO_DIAS` | `cc-sync.js` | só definição / uso interno mínimo |

**Pasta vazia:** `tests/saas-admin/` — 0 arquivos.

---

## B) Legado / preparado (NÃO classificar como morto)

| Item | Classificação |
|------|----------------|
| `podeAprovar` | Export + mock RBAC; TECHDOC: sem efeito até Fase 4 — **API reservada** |
| `PAGINACAO` | Usado por `base.repository.padrao.js` (listarPaginado) — vivo na camada, pages não consomem |
| `loginEmail` / `loginGoogle` / `criarContaEmail` / `onUid` / `uidReady` | Usados em `config/index.html` — **falso positivo** se só varrer `.js` |
| `syncPortalKeys` | Usado em 4 HTML do portal-técnico |
| `setupDockReordering` | Chamado dentro de `dock.js` |
| `excluirEmCascata`, `detectarAusentes`, `enviarParaLixeira` | Vivos — portal-técnico + diario; lixeira via cascata |
| `FLAGS` / `LOGS` / `CACHE` / `AUDITORIA` | Algum uso real (onboarding, UP, relatorios, admin) |
| `mensagem-finalizado.js` | Importado por `os.js` + testes (teste fora da CI ≠ morto) |
| `PLANOS` (saas-planos) | Usado no onboarding; helpers `temModulo*` é que estão mortos |
| Suite Kernel no PR #1 | Não está em develop — **ausente**, não morto no tree atual |

---

## C) Resumo

| Categoria | Qtd aproximada |
|-----------|----------------:|
| Exports mortos comprovados (shared/kernel) | ~15–18 símbolos |
| Falsos positivos evitados | session*, syncPortalKeys, dock, cascata/lixeira parcial, PAGINACAO |
| Diretório stub | 1 (`tests/saas-admin`) |

Nenhuma remoção proposta (modo somente leitura).

---

## Próxima frente automática

→ **Frente 15 — Logging**
