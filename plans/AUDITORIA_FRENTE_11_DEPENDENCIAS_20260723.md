# Frente 11 — Dependências

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Somente leitura**  
`npm outdated` falhou (proxy registry) — versões lidas dos **lockfiles**.

---

## Lockfile (resolvido)

| Pacote | Onde | Versão |
|--------|------|--------|
| `firebase` | raiz | 12.14.0 |
| `firebase-admin` | raiz (dev) | **14.1.0** |
| `firebase-tools` | raiz | 15.22.4 |
| `firebase-admin` | functions | **12.7.0** |
| `firebase-functions` | functions | 6.6.0 |
| engines.node | functions | **20** (BL-007) |

## Achados

1. **Drift major** `firebase-admin` 14 (tooling) vs 12.7 (runtime CF) — risco de APIs divergentes em scripts locais vs produção.  
2. GHA warning Node 20 deprecated (panorama CI) + engines 20 = mesma frente BL-007.  
3. Suítes de teste: deps mínimas (`jsdom`, `@firebase/rules-unit-testing`).  
4. Árvore de deps do produto é **enxuta** (positivo).

---

## Frente 12

Consolidação já em `plans/DIVIDA_TECNICA_CONSOLIDADA_ESPERA_20260723.md` — esta passagem só acrescenta DT de deps/admin drift se ainda não listado (DT-35).
