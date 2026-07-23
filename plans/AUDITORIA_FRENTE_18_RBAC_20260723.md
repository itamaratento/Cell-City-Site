# Frente 18 — RBAC (não-regressão ADR-AUTH-001)

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Somente leitura**

## Checks

| Check | Resultado |
|-------|-----------|
| Rules sem matriz `podeVisualizar` | ✓ |
| Rules com tenant/`temAcessoLiberado` | ✓ |
| 29 páginas com `initModulo` + `carregarPermissoes` | ✓ padrão majoritário |
| Só `initModulo`: `saas-admin`, `usuarios-permissoes` | esperado (master/admin) |
| 37 testes RBAC na CI | ✓ |
| CF `excluirUsuarioAdmin` usa `perfil` legado | nuance já na Frente 3 — **não regressão** da Alt. A |

**Veredito:** sem regressão detectada vs ADR-AUTH-001 Alt. A.
