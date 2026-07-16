# Sprint 3 — Onboarding SaaS — Relatório Técnico (2026-07-16)

**Branch:** `develop`  
**Escopo:** Onboarding self-service multiempresa (kickoff SaaS pós-Sprints 0–2)

---

## 1. Resumo executivo

A Sprint 3 consolidou o onboarding SaaS herdado das fases PS-5/PS-6 no padrão
arquitetural estabelecido nas Sprints 1 (app-config, kernel, planos) e 2
(split de módulos). O wizard 3 passos foi extraído para módulo dedicado,
integrado ao catálogo `saas-planos.js`, com validações compartilhadas e
provisionamento inicial (`modulos_ativos`, `feature_flags`) na Cloud Function.
A flag `SAAS_ONBOARDING_ATIVO` foi ativada (kickoff documentado na F1.2).

**Não havia documento `plans/SPRINT3_*` prévio** — escopo derivado de
PS4_PS5, PS6_CERTIFICACAO_FINAL, SPRINT1_F12 (kickoff SaaS) e ordem
Sprint 0 → 1 → 2 → 3 registrada em SPRINT0_CERTIFICACAO_ENCERRAMENTO.

---

## 2. Divergências documentais registradas

| Documento | Sprint 3 significa | Status |
|-----------|-------------------|--------|
| Ordem SaaS 2026-07-16 (Sprint 0 cert.) | Sprint 3 = Onboarding | **Escopo desta entrega** |
| `MASTER_ROADMAP.md` / TECHDOC §7.3 | Sprint 3 = RBAC Estoque+Caixa | Numeração legada (Fase 2 RBAC, já concluída 2026-07-08) |
| `PLANO_DIRETOR_EVOLUCAO_2026_INTERNO.md` (07-15) | Single-tenant; remover SaaS | **Revertido** pela ordem Sprint 1 SaaS (07-16) |

---

## 3. Objetivo e entregas

| Entrega | Status |
|---------|--------|
| Wizard 3 passos (empresa → plano → confirmação) | ✅ |
| Criação de documento `empresas/` via CF | ✅ (PS-6, aprimorado) |
| Integração catálogo de planos | ✅ |
| Provisionamento `modulos_ativos` + `feature_flags` | ✅ |
| Validações client + server | ✅ |
| Feature flag `SAAS_ONBOARDING_ATIVO` | ✅ `true` |
| Criação usuário admin no wizard | ❌ Fora de escopo (PS-6) |
| Verificação de e-mail | ❌ Adiada (PS5-003) |

---

## 4. Arquivos criados

| Arquivo | Finalidade |
|---------|-----------|
| `CRM/pages/saas-onboarding/saas-onboarding.js` | Lógica do wizard |
| `CRM/shared/saas-onboarding-validacao.js` | Validações compartilhadas |
| `functions/lib/saas-planos.js` | Espelho CJS do catálogo de planos |
| `tests/onboarding/saas-onboarding-validacao.test.mjs` | 10 testes unitários |
| `tests/functions/saas-onboarding.test.mjs` | 5 testes da CF (emulador) |
| `plans/SPRINT3_ONBOARDING_RELATORIO.md` | Este relatório |

## 5. Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `CRM/pages/saas-onboarding/index.html` | HTML fino + bootstrap CF inline |
| `functions/saas.js` | Provisionamento por plano; validação WhatsApp |
| `CRM/shared/app-config.js` | `SAAS_ONBOARDING_ATIVO: true` |
| `tests/infra/app-config-estabilizacao.test.mjs` | Assert da flag atualizada |
| `CRM/shared/modulos.catalogo.json` | Regenerado (novo `.js` do onboarding) |
| `CRM/TECHDOC.md` | §43 |
| `PROXIMA_ETAPA.md` | Estado atual |

---

## 6. Dependências Sprint 2

Sprint 2 (Portal split — `plans/SPRINT2_PORTAL_SPLIT_20260716.md`) **concluída**.
Nenhum bloqueio técnico encontrado.

---

## 7. Testes executados

| Suíte | Resultado |
|-------|-----------|
| `tests/onboarding/saas-onboarding-validacao.test.mjs` | **10/10** |
| `npm run auditar-arquitetura` | **6/6** |
| `npm run validar-infra-app-config` | **12/12** |
| `tests/integrity/integridade.test.mjs` | **14/14** |
| `npm run testar-central-modulos` | **17/17** |
| RBAC (`tests/rbac`) | **173/175** (2 pré-existentes em `financeiro-relatorio`) |
| `tests/functions/saas-onboarding.test.mjs` | **Não executado** — bloqueio de ambiente (ver §11) |

---

## 8. Plano de rollback

1. Reverter commit único da Sprint 3.
2. Redefinir `FLAGS.SAAS_ONBOARDING_ATIVO: false` se necessário desativar cadastro público.
3. Cloud Function: versão anterior grava `modulos_ativos: null` — compatível com empresas já criadas (campos extras são ignorados pelo client legado).

---

## 9. Riscos e pendências

| Item | Severidade |
|------|------------|
| SaaS multiempresa ainda não promovido a produção (incidente 2026-07-14) | Alta operacional |
| CF tests não rodados nesta sessão (bloqueio de ambiente — ver §11) | Média |
| Sincronização manual client/server em `saas-planos` | Baixa |
| PS5-003 verificação de e-mail | Baixa (adiada) |
| Sprint 4+ SaaS (ex.: saas-admin evoluído, billing) | Fora de escopo |

## 10. Bloqueio técnico real — emulador Firestore local

Ao tentar executar `tests/functions/saas-onboarding.test.mjs` (Cloud Function,
depende do Emulador Firestore via `firebase emulators:exec`), duas tentativas
falharam por causas distintas, já diagnosticadas nesta sessão:

1. Porta 8080 ocupada por um emulador Firestore **órfão** de sessão anterior
   (processo Java, ~3h22 de execução, sem CLI pai ativo — mesmo padrão de
   "sessões concorrentes" já registrado na memória do projeto). Encerrado
   com segurança (`kill`) — não afeta nenhum dado, é um processo local de
   teste, não produção.
2. Com a porta livre, o emulador falhou de novo, agora por
   **`ENOSPC: System limit for number of file watchers reached`**
   (`firebase-debug.log`) ao tentar observar `CRM/firestore.rules` via
   `chokidar`. É um limite do **kernel da máquina local**
   (`fs.inotify.max_user_watches`, hoje em 65536, já consumido por
   IDEs/navegador abertos na mesma sessão desktop) — não é um defeito do
   código da Sprint 3, nem do repositório, nem específico deste teste (afeta
   qualquer suíte que use `firebase emulators:exec` nesta máquina agora).

**Ação tomada:** elevar `fs.inotify.max_user_watches` exige `sudo`
(mudança de configuração de kernel, fora do escopo de código de uma
sprint) — não executado autonomamente por decisão deliberada, mesmo
tendo a permissão de sandbox disponível. Fica registrado como bloqueio
de ambiente para decisão do dono (ex.: `sudo sysctl -w
fs.inotify.max_user_watches=524288`, não persistente, ou fechar
IDEs/abas ociosas antes de rodar a suíte).

**Impacto no restante da sprint:** nenhum. Todas as demais suítes (10/10
onboarding, 6/6 arquitetura, 12/12 infra, 14/14 integridade, 17/17
catálogo, 173/175 RBAC) rodam sem depender do emulador Firestore e foram
executadas com sucesso nesta sessão. A lógica testada por
`saas-onboarding.test.mjs` (validação, dedup, provisionamento por plano)
já está coberta indiretamente pelos testes unitários de
`saas-onboarding-validacao.test.mjs`; o teste da CF cobre especificamente
a integração com o Firestore real (dedup via `where`, escrita de
`saas_eventos`), que fica pendente de reexecução quando o ambiente local
tiver watchers disponíveis ou em CI (onde este limite não costuma ser
um problema).

---

## 11. Próximos passos recomendados

1. Homologação manual do wizard em `/dev/CRM/pages/saas-onboarding/`.
2. Executar `tests/functions/saas-onboarding.test.mjs` após liberar `fs.inotify.max_user_watches` (ver §10) — decisão/execução do dono, ou em CI.
3. Decisão do dono sobre promoção SaaS e backfill produção (PROD-001..003, PS6).
4. Sprint 4 SaaS: evolução do console `saas-admin` (aprovação de empresas pendentes) — **somente após plano formal**.

---

*Relatório emitido em 2026-07-16 — Sprint 3 Onboarding SaaS.*
