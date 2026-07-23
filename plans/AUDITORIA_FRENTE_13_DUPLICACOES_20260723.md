# Frente 13 — Duplicações (além de devPrefix / toast IDs / comandos↔info)

**Data:** 2026-07-23 · **HEAD:** `7f4e705` · **Somente leitura**

---

## Achados novos

1. **`formatarData` local ×5** (central-org, financeiro, contas, campanhas, comandos) enquanto `shared/date-utils.js` já exporta `formatDate*` — adoção incompleta.

2. **`toast()` corpo quase idêntico ×4** (central-alertas, diario, estoque, fornecedor) — além dos `showToast` já mapeados.

3. **Espelhos deliberados** (manter sync manual): `phone-utils` ↔ `functions/lib/phone.js`; `saas-planos` ↔ `functions/lib/saas-planos.js` (features alinhadas na auditoria anterior).

4. Pares satélite (chips/entrada, catalogo/público, dashboard-*) = **split modular**, não clone acidental — fora do escopo de “dedup forçado”.

---

Não reabre clone Comandos↔Informações (≥95%) nem 19 toast IDs.
