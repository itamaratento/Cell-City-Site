# Frente 19 — Índices Firestore

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Somente leitura**  
**Delta:** inventário 23 composites já no panorama/D06 — aqui só `orderBy` × índice.

## Achados

- **23** índices compostos em `CRM/firestore.indexes.json`.
- Campos `orderBy` no client: `createdAt`, `criadoEm`, `data`, `nome_exibicao`, `nome_fantasia`, `ordem`, `timestamp`.
- Único `orderBy` **sem** aparecer em campo de composite: **`nome_fantasia`** (`saas-admin` lista empresas) — single-field costuma usar índice automático; não é falha comprovada sem erro de runtime.
- Dualidade `createdAt`/`criadoEm` nos índices (10 vs 6 menções) — coerente com modelo dual (Frente 4).

Sem evidência nova de drift 1:1 vs produção (export API fora de escopo somente-leitura local).
