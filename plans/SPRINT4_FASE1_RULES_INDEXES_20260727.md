# Sprint 4 · Fase 1 — Firestore Rules + Índices (Convites)

**Data:** 2026-07-27  
**Status:** ✅ IMPLEMENTADA (código + testes) — **deploy Rules/índices em DEV/PROD não feito nesta fase** (aguarda autorização de publicação)  
**Baseline:** `3f19462` · F0 publicada (`121b2e7`)

## Escopo entregue

| Item | Resultado |
|------|-----------|
| Rules `match /convites/{id}` | ✅ leitura Admin/Owner tenant + master; create/update/delete client = `false` |
| Índices compostos | ✅ 2 índices (lista; email+status) |
| Testes emulador | ✅ `tests/firestore-rules/convites.test.mjs` 17/17; suíte completa 138/138 |
| Docs | ✅ TECHDOC §59 · PROXIMA · este relatório |
| Cloud Functions / UI / aceite | ❌ fora de escopo (F2+) |

## Decisões técnicas F1

1. **Escrita só Admin SDK** — alinhado ao plano F0; admin client não forja `token_hash`/`status`.
2. **Leitura** — `admin` mesma `empresa_id` ou `master_admin`; técnico/pendente/anônimo negados; lista exige filtro `empresa_id` (mesmo padrão PS-6).
3. **BL-006 intacto** — nenhuma alteração em `usuarios/{uid}`; regressão coberta nos testes F1.
4. **Índice `token_hash`** — não declarado (igualdade single-field é automática; CF fará lookup na F2).
5. **Deploy** — arquivo Rules no git; release ativo em nuvem **não** alterado até auth de publish.

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `CRM/firestore.rules` | bloco `convites` |
| `CRM/firestore.indexes.json` | 2 índices `convites` |
| `tests/firestore-rules/convites.test.mjs` | novo |
| `CRM/TECHDOC.md` | §59 |
| `PROXIMA_ETAPA.md` | estado F1 |
| `_BACKUPS/20-PRE-S4-F1-RULES-20260727/` | backup pré-alteração |

## Cobertura de testes (convites)

- Admin A lê próprio / nega B / lista filtrada / nega sem filtro  
- Técnico / pendente / anônimo negados  
- master lê cross-tenant  
- create/update/delete client negados (admin e master)  
- BL-006: self não escala perfil/empresa/status; campo não privilegiado OK  
- Smoke estático dos 2 índices no JSON  

## Riscos

| Risco | Nota |
|-------|------|
| Rules no git ≠ Rules em produção | Deploy Rules ainda necessário (auth) |
| Índices precisam `READY` antes de queries compostas em F3 | Deploy indexes no mesmo gate |
| Emulador local porta 8080 ocupada | CI usa `emulators:exec`; local validado com `FIRESTORE_EMULATOR_HOST` |

## Readiness F2

✅ Rules protegem a coleção conforme contrato F0.  
⏳ F2 pode implementar CF Admin SDK sem mudar o modelo de permissão client.  
⛔ F2 **não** inicia sem autorização explícita de Cloud Functions.
