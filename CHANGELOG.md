# CHANGELOG

Histórico resumido das mudanças relevantes do Cell City CRM SaaS.
O histórico completo permanece em `git log` e nos relatórios de `plans/`.

## [Unreleased] — 2026-07-17 (Fase 2.3 — validação final pré-main)

### Fixed
- Cloud Functions: `portalCriarAgendamento` não validava o horário contra agendamentos existentes — a checagem de "horário ocupado" só existia do lado do cliente (`portalListarHorariosOcupados`), trivialmente contornável com uma chamada direta. Aplicado o mesmo filtro (data + status ativo, escopado por empresa) como barreira real do lado do servidor.
- CI: liga `tests/integrity/seguranca-fase22.test.mjs` (já existia no working tree, sem passo no workflow) ao `tests.yml`.

### Refactored (sem mudar comportamento)
- `functions/portal.js`: extraída `horariosOcupadosDaEmpresa()` — elimina a duplicação da query introduzida pelo fix acima.

### Docs
- `COLECOES_FIRESTORE.md` §19: novo achado 🟠 — a coleção `config` (impressão, horários, contador de Pré-OS) nunca foi migrada para um esquema por tenant; hoje compartilhada por todas as empresas da plataforma. Não corrigido (exige migração de esquema de doc ID + backfill, fora do escopo de um patch de Rules) — documentado para decisão de produto/arquitetura futura.
- Relatório: `plans/VALIDACAO_FINAL_PRE_MAIN_20260717.md`.

### Notes
- Rules certificadas nesta fase (117/117 Firestore, 11/11 Storage) contra o conteúdo atual de `CRM/firestore.rules`/`storage.rules` — nenhum dos dois arquivos mudou desde a certificação anterior (Fase 1.9), confirmado via `git log`; não repetida sem necessidade.
- Regressão completa: RBAC 181/181, integridade 14/14, segurança Fase 2.2 12/12, Cloud Functions do Portal 28/28 (3 novos), Control Center + onboarding + performance 108/108.
- Push/`develop→main`/deploy produção/tag oficial **não** executados nesta fase.

## [Unreleased] — 2026-07-17 (Fase 2.5 — acompanhamento pós-push)

### Fixed
- CI: teste Control Center cria `_BACKUPS/` se ausente (gitignored no checkout limpo).
- CI: `fetch-depth: 0` — histórico completo para Central de IAs / git log.
- CI: materializa branch local `main` a partir de `origin/main` (Comparar Branches).

### Docs
- Relatório: `plans/ACOMPANHAMENTO_LIBERACAO_20260717.md`.
- Recomendação: **CI APROVADA — PRONTO PARA BACKFILL** (`develop` @ `a6c7a56`).

### Notes
- Push `develop` concluído; CI remota verde; Pages `/dev` atualizado. Sem backfill / main / deploy Firebase.

## [Unreleased] — 2026-07-17 (Fase 2.4 — liberação controlada)

### Docs
- Preparação completa da liberação até o limite humano (push / backfill / main / deploy).
- Relatório: `plans/LIBERACAO_CONTROLADA_RELEASE_20260717.md`.
- Recomendação: **PRONTO PARA PUSH** (`develop` @ `4080ec2`, 7 commits locais).

### Notes
- Sem push, merge, tag, deploy ou backfill de produção nesta fase.

## [Unreleased] — 2026-07-17 (Fase 2.2 — certificação de release)

### Fixed
- Segurança: `gerarSenhaTemp()` em `usuarios-permissoes.js` usa `crypto.getRandomValues()` (mesmo padrão do saas-admin).
- Segurança: removido PIN estático `1056` da exclusão de usuário — confirmação passa a exigir digitar o e-mail do alvo (a CF `excluirUsuarioAdmin` continua sendo a barreira real).
- XSS: `escHtml` no modal de alertas do Dashboard e nos cards/busca de clientes em OS.
- Catálogo público: Rules permitem leitura anônima **somente** de `empresa_id == cellcity-master`; cliente filtra com `where`. Evita `permission-denied` e vazamento cross-tenant.
- Testes: `saas-onboarding` reseta rate-limit entre casos; 3 testes novos de `catalogo_produtos`.
- IDs de empresa no onboarding SaaS: `crypto.randomBytes` em vez de `Math.random`.

### Docs
- `PROXIMA_ETAPA.md` atualizado para o estado Fase 2.2.
- Relatório: `plans/CERTIFICACAO_RELEASE_FINAL_20260717.md`.

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
