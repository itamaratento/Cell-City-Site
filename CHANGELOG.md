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

## [Unreleased] — 2026-07-17 (missão autônoma de engenharia, complemento à Fase 2.1)

### Fixed
- Cloud Functions: corrida (TOCTOU) no dedup de e-mail de `saasOnboardingCriarEmpresa` — reserva atômica via `saas_email_index/{email}.create()` em vez de só query-then-write.
- Segurança: `gerarSenhaTemp()` (saas-admin) usa `crypto.getRandomValues()` em vez de `Math.random()`.
- Segurança: self-XSS no resumo do wizard de onboarding (`escHtml()` nos 4 campos interpolados).
- `getDeliveryDate`/`calcDias` centralizados também em `posvenda.js`, `dashboard-alertas.js`, `central-alertas.js` (consumindo `shared/date-utils.js`, mesma correção do item acima na Fase 2.1).
- `known-issues.json` esvaziado — as 3 falhas rastreadas (Caixa matriz, Relatório Mensal ×2) não reproduzem mais.

### Removed (código morto, zero importador confirmado)
- `CRM/repositories/ativar-filtros.js`, `tenant.repository.js`.
- `CRM/scripts/init-posvenda-mensagens.js`, `init-posvenda-rastreamento.js`.
- `CRM/firestore.rules.secure` (rascunho do 1º commit, nunca referenciado por deploy).
- `CRM/services/` inteira (camada órfã — migração-piloto nunca adotada; `os-status.service.js` já tinha divergido do fluxo de status real).
- `CRM/sw.js` → v20: remove os 4 arquivos de `services/` do precache (mesmo defeito que quebrou a instalação do v16).

### Added
- CI: 5 passos novos em `tests.yml` — validação de onboarding, `validar-infra-app-config`, catálogo de módulos, e2e básico, e as 3 suítes restantes do Control Center (diagnóstico/ferramentas/manutenção).
- `COLECOES_FIRESTORE.md`: documenta `crm_templates`, `saas_eventos`, `saas_email_index`; marca `notificacoes_saas` como código morto confirmado.
- `MASTER_ROADMAP.md`: corrige os 2 avisos (Fases 3/6) que descreviam o multiempresa como "revertido" — desatualizados desde a reconstrução de 2026-07-14/17.

### Notes
- Backfill de produção **não** executado (requer autorização humana).
- Push/`develop→main`/deploy produção **não** executados nesta fase.
- Relatório completo: `plans/MISSAO_AUTONOMA_ENGENHARIA_20260717.md`.
