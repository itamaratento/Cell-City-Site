# CHANGELOG

Histórico resumido das mudanças relevantes do Cell City CRM SaaS.
O histórico completo permanece em `git log` e nos relatórios de `plans/`.

## [Unreleased] — 2026-07-17 (Fase 2.1)

### Fixed
- CI: workflow `tests.yml` passa a instalar JDK 21 (`actions/setup-java`) — causa raiz da falha 100% no passo Firestore Rules (emulador exige Java).
- Storage Rules: `empresaDoUsuario()` null-safe; suíte A2 certificada (11/11) com `--project` alinhado ao harness.
- Cloud Functions (Portal): reset do rate-limit entre testes — elimina falso negativo por `resource-exhausted`.
- RBAC Relatório Mensal: fixtures com datas no último dia do mês — deixa de quebrar após o dia 15 por reclassificação `pendente→vencido`.
- Firestore Rules: `alarme_config` exige `request.auth.uid == docId` (+ `temAcessoLiberado()`).
- Pós-venda / alertas: `getDeliveryDate` centralizado em `date-utils.js` (sem falso positivo quando status ≠ entregue).

### Added
- `tests/storage-rules/` na CI.
- `tests/functions/rate-limit-s2.test.mjs` — certifica o limite dedicado de `consultarOSPublica` (mitigação S2).

### Notes
- Backfill de produção **não** executado (requer autorização humana).
- Push/`develop→main`/deploy produção **não** executados nesta fase.
