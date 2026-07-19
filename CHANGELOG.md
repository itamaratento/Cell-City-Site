# CHANGELOG

Histórico resumido das mudanças relevantes do Cell City CRM SaaS.
O histórico completo permanece em `git log` e nos relatórios de `plans/`.

## [v3.2.0] — 2026-07-19 (Fase 4 encerrada — segurança em produção + CI/CD Firebase operacional)

> Release que efetiva em produção os itens de segurança listados como
> `[Unreleased]` na Fase 4.1 (abaixo) e torna o pipeline de deploy
> totalmente operacional. Homologação: `plans/FASE43_HOMOLOGACAO_20260719.md`.

### Security
- Firestore Rules endurecidas da Fase 4.1 **deployadas em produção via CI** (ruleset == repo byte a byte; probes anônimos fail-closed; `catalogo_config` get público preservado).
- Cloud Functions com rate-limit S2 (5/min) **em produção** (16/16, fonte == repo).
- Confirmado que o achado A2 (Storage `read: if true`) nunca teve exposição real: o projeto não possui bucket Firebase Storage.

### Added
- Primeiro deploy Firebase 100% via CI da história do projeto (WIF, run 29694108479): Rules + Indexes + Functions + validação via API.
- Guard no passo de Storage do `deploy-firebase.yml`: sem bucket vinculado, pula com aviso; volta a deployar sozinho quando o bucket existir.
- Passo `npm ci` em `functions/` no workflow (CLI exige node_modules no runner).

### Fixed
- Deploy de Functions no CI falhava por dependências ausentes ("Couldn't find firebase-functions package").

### Notes
- Promoções docs/CI-only NÃO disparam o Deploy Firebase (filtro de `paths`); usar `workflow_dispatch` na main quando necessário.
- Backlog registrado: BL-007 (runtime nodejs22 até 2026-10-30), BL-008 (parser do harness), BL-009 (decisão bucket Storage/Blaze), BL-010 (tags do Cell-City-Backup).

## [Unreleased] — 2026-07-18 (Fase 4.1 — correção segurança pré-recertificação)

### Security
- Firestore: `config` get restrito a whitelist `impressao`/`horarios` (+ staff); `pre_os` create exige `empresa_id`; `metadata` write restrito.
- Storage: fotos de OS deixam de ser `read: if true` — exigem auth + mesma empresa.
- LGPD: CPF removido de `OS_CAMPOS_PUBLICOS`; público recebe `cpfMascarado`.
- RBAC UI: `permissoes.js` passa a fail-closed com perfil operacional ativo.
- Portal: rate `consulta_os_publica` 8→5/min (PoP opaco = médio prazo).

### Fixed
- `CRM/firestore.indexes.json` alinhado à produção (23 composites).

### Docs
- Relatório: `plans/CORRECAO_RECERTIFICACAO_FASE41_v3.1.0_20260718.md`.
- Parecer: **ainda COM RESSALVAS** até deploy + Actions + smoke.

### Notes
- Sem deploy/push/tag nesta fase.

## [Unreleased] — 2026-07-18 (Fase 4.0 — encerramento operacional v3.1.0)

### Docs
- Encerramento operacional: gates smoke autenticado e Deploy Actions permanecem dependência humana (sem credencial/`gh` neste ambiente).
- Parecer mantido: **CERTIFICADA COM RESSALVAS**.
- Relatório: `plans/ENCERRAMENTO_OPERACIONAL_FASE40_v3.1.0_20260718.md`.

### Notes
- Sem merge/`main`/tag/deploy/secret nesta fase.

## [Unreleased] — 2026-07-18 (Fase 3.8 — homologação final v3.1.0)

### Docs
- Homologação final: infra revalidada (Rules/Functions/23 índices READY); smoke HTTP público 16/16.
- Parecer: **CERTIFICADA COM RESSALVAS** — smoke autenticado, RBAC runtime e `FIREBASE_SA_KEY`/Actions deploy ainda pendentes.
- Relatório: `plans/HOMOLOGACAO_FINAL_FASE38_v3.1.0_20260718.md`.

### Notes
- Sem merge/`main`/tag/deploy/secret nesta fase.

## [Unreleased] — 2026-07-17 (Fase 2.9 — preparação promoção à main)

### Docs
- Gate pré-promoção: backfill validado, `dados_migrados=true` confirmado por leitura, CI remota verde em `a6c7a56`.
- Relatório: `plans/PREPARACAO_PROMOCAO_MAIN_20260717.md`.
- Recomendação: **PRONTO COM RESSALVAS** — local ahead de origin; push + CI no HEAD antes do ff `main`.

### Notes
- Sem merge/`main`/tag/deploy/smoke nesta fase.

## [Unreleased] — 2026-07-17 (Backfill produção)

### Ops
- Backfill `empresa_id` em `cellcity-crm`: 4 documentos corrigidos (`os`, `clientes`, `estoque_produtos`, `agenda`); `validar-backfill` exit 0.
- Relatório: `plans/BACKFILL_PRODUCAO_EXECUCAO_20260717.md`.

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
