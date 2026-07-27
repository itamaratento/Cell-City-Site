# 🗂️ PROXIMA_ETAPA.md — MEMÓRIA DO PROJETO (ESTADO ATUAL)

> ⚠️ Leia este arquivo antes de qualquer alteração.
> Para histórico completo, consulte [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md).

---

## 📌 REGRA PERMANENTE DE CONTINUIDADE

### Comando Padrão de Abertura de Sessão

Se o usuário enviar apenas **`CC`** ou **`CONTINUAR`**:

1. **Ler** [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md)
2. **Ler** [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md) apenas se necessário
3. **Gerar relatório** contendo: onde paramos, concluído, em andamento, pendente, próxima tarefa, riscos
4. ❌ **Não alterar arquivos** · ❌ **Não fazer deploy** · ⏳ **Aguardar aprovação**

*(Regras completas de continuidade permanecem inalteradas — ver commit anterior.)*

---

## ⏳ ESTADO ATUAL (2026-07-27) — Sprint 4 PLANEJADA (sem implementação)

**Última atividade:** levantamento técnico S4 usuários/convites + pareceres BL-009/BL-010 (read-only / docs).  
**Plano S4:** [`plans/SPRINT4_USUARIOS_CONVITES_PLANO.md`](plans/SPRINT4_USUARIOS_CONVITES_PLANO.md)  
**BL-009 parecer:** [`plans/BL009_PARECER_TECNICO_20260727.md`](plans/BL009_PARECER_TECNICO_20260727.md)  
**BL-010 checklist:** [`plans/BL010_CHECKLIST_VALIDACAO_20260727.md`](plans/BL010_CHECKLIST_VALIDACAO_20260727.md)

**Baseline:** `9b11e82` · CI Testes + Pages ✅ · **nenhuma implementação de S4 iniciada**

### Inventário aberto

| Item | Nota |
|------|------|
| **Sprint 4** usuários/convites | 📋 plano pronto — **aguarda F0 (decisões produto) + auth Rules/CF** |
| **BL-007** nodejs22 | ✅ deploy DEV/PROD |
| **BL-009** Storage/Blaze | ⛔ decisão de custo — parecer 2026-07-27 |
| **BL-010** bypass deploy key | ⛔ ação manual GitHub UI — checklist validado em docs |
| E2E / emulador CF | residual de ambiente |
| IAM Logging SA prod | residual opcional |
| `CRM/git-info.json` local | artefato regenerável (sujo no working tree; não é conflito) |

---

## Histórico — BL-007 deploy Node.js 22 CONCLUÍDO (2026-07-25)

**Entrega:** 16 Cloud Functions DEV+PROD em **nodejs22**; smoke HTTP OK.  
**Relatório:** [`plans/BL007_DEPLOY_ENCERRAMENTO_20260725.md`](plans/BL007_DEPLOY_ENCERRAMENTO_20260725.md)

---

## Histórico — Sprint 3 Polish do Wizard CONCLUÍDA (2026-07-25)

**Entrega:** Enter avança passo, foco automático, região de erro acessível, `aria-current`, `maxlength` nativo.  
**Relatório:** [`plans/SPRINT3_POLISH_WIZARD_20260725.md`](plans/SPRINT3_POLISH_WIZARD_20260725.md)

---

## Histórico — Sprint 2 Cadastro de Empresas CONCLUÍDA (2026-07-23)

**Entrega:** paridade de provisionamento plano→módulos/flags no CRUD `saas-admin` + limit na lista + docs/testes.  
**Relatórios:** [`plans/SPRINT2_CADASTRO_EMPRESAS_20260723.md`](plans/SPRINT2_CADASTRO_EMPRESAS_20260723.md) · [`plans/SPRINT2_CADASTRO_EMPRESAS_ENCERRAMENTO_20260723.md`](plans/SPRINT2_CADASTRO_EMPRESAS_ENCERRAMENTO_20260723.md)

---

## Histórico — Continuidade pós–S1: cota + BL-007 (2026-07-23)

**Entrega:** tetos `limit`/`limitTo` + config **nodejs22**.  
**Relatório:** [`plans/PACOTE_COTA_BL007_20260723.md`](plans/PACOTE_COTA_BL007_20260723.md)

---

## Histórico — Pacote P1 segurança DT-20/DT-22 (2026-07-23)

**Entrega:** XSS `startOSForClient` + alerta legado `pronto`.  
**Relatório:** [`plans/PACOTE_P1_DT20_DT22_20260723.md`](plans/PACOTE_P1_DT20_DT22_20260723.md)

---

## Histórico — Sprint 1 Fundação SaaS CONCLUÍDA (2026-07-23)

**Autorização:** execução integral da Sprint 1 (Fundação do SaaS).  
**Entrega:** fechamento F1.3 consolidação do Kernel em `develop` (PR #1 fechado como superseded).  
**Relatório:** [`plans/SPRINT1_FUNDACAO_SAAS_ENCERRAMENTO_20260723.md`](plans/SPRINT1_FUNDACAO_SAAS_ENCERRAMENTO_20260723.md)

| Fase Sprint 1 | Status |
|---------------|--------|
| F1.1 Arquitetura | ✅ |
| F1.2 app-config | ✅ |
| F1.3 Auditor (A2) + consolidação Kernel/docs/testes/CI | ✅ |
| F1.4 Adoção páginas | ✅ |

**Baseline funcional certificada (v3.2.0):** `b663a13`.

### Inventário aberto (fora da Sprint 1)

| Item | Nota |
|------|------|
| BL-007 nodejs22 | ✅ config 2026-07-23 (deploy CF pendente) |
| BL-009 Storage/Blaze | decisão de custo |
| BL-010 bypass deploy key backup | ação manual GitHub |
| PR #1 draft Kernel | ✅ fechado 2026-07-23 |
| Migração legados `perfil_operacional_id` | opcional |

---

## Histórico — ESTADO (2026-07-21) — ESPERA CONTROLADA · GOVERNANÇA DE BASELINE

Governança: [`plans/GOVERNANCA_BASELINE_V320_20260721.md`](plans/GOVERNANCA_BASELINE_V320_20260721.md) · Abertura: [`plans/CICLO_ABERTURA_POS_V320_20260721.md`](plans/CICLO_ABERTURA_POS_V320_20260721.md) · Certificação: [`plans/CERTIFICACAO_ETAPA64_RELEASE_V320_20260721.md`](plans/CERTIFICACAO_ETAPA64_RELEASE_V320_20260721.md)

| Referência | Commit | Uso |
|------------|--------|-----|
| **Baseline Funcional Certificada** | **`b663a13`** | Certificação / código / ADR / critérios da v3.2.0 |
| **HEAD Documental** | **`ce2e725`** | Docs 6.4 + abertura do ciclo (sem impacto funcional) |

**Release:** v3.2.0 · 🟡 Homologada com ressalvas · ADR-AUTH-001 **Alternativa A** · BL-011 dívida consciente · **6.2-B não aberta**  
**Desenvolvimento:** ⏸ espera controlada · próximo ciclo **não iniciado** *(histórico — supersedido pela autorização Sprint 1 em 2026-07-23)*

### Congelamento

| Item | Status |
|------|--------|
| Homologação funcional 6.x | ✅ encerrada |
| Diff `b663a13`→`ce2e725` | ✅ só documentação |
| Próximo ciclo | ⏳ aguarda backlog + autorização |

### Inventário aberto (fora da homologação)

| Item | Nota |
|------|------|
| BL-007 nodejs22 | prazo 2026-10-30; exige auth CF |
| BL-009 Storage/Blaze | decisão de custo |
| BL-010 bypass deploy key backup | ação manual GitHub |
| Migração legados `perfil_operacional_id` | opcional |
| Revisão ADR / 6.2-B | eventual; exige auth Rules |

### Próxima ação

1. Dono escolhe **um** backlog e autoriza explicitamente.  
2. Só então: Script Mestre da iniciativa (doc própria; não reutilizar scripts 6.x sem revisão).  
3. Em auditorias: “certificado?” → `b663a13` · “HEAD documental?” → `ce2e725`.  
4. Até lá: **proibido** código · Rules · CF · IAM · deploy · merge · tag · alterar ADR.

### Histórico — FASE 4.2 (2026-07-18): COMMIT+PUSH+WIF OK · DEPLOY MAIN PENDENTE

Relatório: [`plans/FASE42_COMMIT_PUSH_WIF_20260718.md`](plans/FASE42_COMMIT_PUSH_WIF_20260718.md). Classificação na época: 🟡 CERTIFICADA COM RESSALVAS (commit `7633558`, WIF 5/5 bindings, deploy main ainda bloqueado por Auto-review). Todos os bloqueios dessa seção foram resolvidos nas Fases 4.2/4.3 seguintes — ver seção "ESTADO ATUAL" acima.


### Histórico recente — thread SaaS Onboarding/Admin (não sobrescreve o acima; não auditado nesta sessão de 2026-07-21)

A seção abaixo (2026-07-16) permanece como histórico da integração Sprint 3/4.

Duas frentes trabalharam em paralelo em 2026-07-16 sobre a mesma
`develop` (histórico linear, sem merge/branch divergente): esta frente
(Sprint 3 Onboarding → Sprint 4 Admin SaaS) e a frente concorrente
(F1.4 Certificação Técnica → docs de pendências pós-Sprint 3/F1.4). Os
4 commits (`1ed998d`, `ae14b4d`, `b72ff7d`, `9016354`) foram lidos,
auditados e certificados em conjunto — nenhum conflito de arquivo,
nenhuma sobreposição de escopo, nenhuma regressão. Relatório completo:
[`plans/CERTIFICACAO_INTEGRACAO_20260716.md`](plans/CERTIFICACAO_INTEGRACAO_20260716.md).

**Esta seção é agora a única linha oficial de evolução para o SaaS
Onboarding/Admin — substitui qualquer leitura isolada dos relatórios
de sprint individuais para fins de "onde paramos".**

### Sprint 4 — Admin SaaS: aprovação de empresas pendentes ✅

Não havia plano formal de "Sprint 4 SaaS" em nenhum documento — escopo
derivado de evidência de código: `functions/saas.js` (Sprint 3) já
prometia "o operador aprova no `saas-admin`", promessa nunca
implementada até agora. Ver TECHDOC §45 para o raciocínio completo.

| Item | Status |
|------|--------|
| `saas-admin.js` extraído do HTML (mesmo padrão do onboarding) | ✅ |
| Fluxo Aprovar (cria usuário admin + `status` → ativo/trial) | ✅ |
| Fluxo Rejeitar (`status` → rejeitada) | ✅ |
| `saas-auditoria.js` (logAcao) — primeiro consumidor real | ✅ |
| Testes `tests/rbac/saas-admin.test.mjs` 6/6 | ✅ |
| Arquitetura 6/6 · Integridade 14/14 · Catálogo 17/17 | ✅ |
| RBAC | 🟡 179/181 (2 pré-existentes, mesmas de sempre) |

Relatório completo: [`plans/SPRINT4_RELATORIO_FINAL.md`](plans/SPRINT4_RELATORIO_FINAL.md) · TECHDOC §45

### Sprint 3 — Onboarding SaaS ✅

| Item | Status |
|------|--------|
| Wizard 3 passos (`saas-onboarding.js`) | ✅ |
| Integração `saas-planos.js` | ✅ |
| Validações compartilhadas | ✅ |
| CF `saasOnboardingCriarEmpresa` + provisionamento | ✅ |
| `FLAGS.SAAS_ONBOARDING_ATIVO: true` | ✅ |
| Testes onboarding 10/10 | ✅ |
| Homologação client-side do wizard (Chrome headless real) | ✅ 6/6 cenários, 0 erros — ver `plans/PENDENCIAS_SPRINT3_20260716.md` |
| `ARQUITETURA.md` §2.1/§6 (Portal 8 arquivos-irmãos) | ✅ Corrigido — ver `plans/PENDENCIAS_SPRINT3_20260716.md` |
| CF tests emulador (`tests/functions/saas-onboarding.test.mjs`) | ⏳ Ainda não executado. Reexecução tentada na certificação de integração (2026-07-16, sessão seguinte): processo órfão do emulador matado, porta 8080 liberada, mas `ENOSPC` (inotify) voltou a ocorrer mesmo com `fs.inotify.max_user_watches=65536` (padrão) — bloqueio de ambiente confirmado 2x independentes (não é contenção de porta). Exige investigação de nível de sistema (fora do escopo autônomo) ou execução em CI. Ver `plans/CERTIFICACAO_INTEGRACAO_20260716.md` |

Relatório completo: [`plans/SPRINT3_ONBOARDING_RELATORIO.md`](plans/SPRINT3_ONBOARDING_RELATORIO.md) · [`plans/PENDENCIAS_SPRINT3_20260716.md`](plans/PENDENCIAS_SPRINT3_20260716.md) · TECHDOC §43

### F1.4 — Certificação Técnica Final (frente concorrente) ✅

Revisão técnica independente da Sprint 1 F1.4 (app-config em 20
páginas) e do fechamento da divisão do Portal do Cliente (P2.2):
corrigiu imports mortos residuais, reconfirmou os 88 membros do objeto
`Portal` e homologou em Chrome headless real. Veredito: aprovado para
integração. Nenhuma sobreposição de arquivo com Sprint 3/4 SaaS.
Relatório completo: [`plans/F1_4_CERTIFICACAO_FINAL.md`](plans/F1_4_CERTIFICACAO_FINAL.md) · TECHDOC §44

### Sprints anteriores (SaaS)

| Sprint | Entrega | Status |
|--------|---------|--------|
| Sprint 0 | Certificação encerramento | ✅ |
| Sprint 1 | Arquitetura (F1.1–F1.4, app-config, kernel) | ✅ |
| Sprint 2 | Portal split (P2.2) | ✅ |

---

## 🚦 PRÓXIMA TAREFA RECOMENDADA

**A certificação de integração (2026-07-16) recomenda formalmente ao
dono, como próxima etapa oficial, uma entre estas opções — nenhuma foi
iniciada por decisão explícita do usuário ("não abrir nova Sprint,
não criar novo roadmap" nesta missão):**

1. **Homologação manual** do fluxo completo em `/dev/`: onboarding → aprovação no `saas-admin` → login do admin criado (única etapa client-side ainda não exercida ponta-a-ponta com Cloud Function real).
2. Executar `tests/functions/saas-onboarding.test.mjs` e `tests/firestore-rules/*` em CI ou máquina sem contenção de `inotify` — bloqueio de ambiente confirmado 2x, não é código (ver `plans/CERTIFICACAO_INTEGRACAO_20260716.md`).
3. Decisão do dono sobre promoção SaaS e backfill produção (PROD-001..003, PS6) — segue bloqueada pelo incidente de 2026-07-14.
4. **Próxima Sprint SaaS** (se houver) — aguarda novo plano formal do dono ou nova evidência de dependência não resolvida no código, mesmo critério usado nas Sprints 3/4.

---

## ⚠️ RISCOS ATUAIS

- 🔴 SaaS multiempresa **não promovido a produção** (decisão pós-incidente 2026-07-14 permanece).
- 🟡 Senha temporária do admin criado na aprovação não passa pela política de senha (`politicas_senha`) usada em Usuários e Permissões — só mínimo de 6 caracteres (ver TECHDOC §45, "fora de escopo").
- 🟡 `tests/functions/saas-onboarding.test.mjs` e `tests/firestore-rules/*` (Cloud Function + Rules contra Firestore real) permanecem não executados nesta máquina por limitação de ambiente (`ENOSPC` inotify) — lógica coberta indiretamente por testes puros (validação, RBAC), mas sem verificação contra Firestore real.
- 🟢 Sprints 1–4 e F1.4 intactas; zero regressão, zero conflito arquitetural entre as duas frentes — ver `plans/CERTIFICACAO_INTEGRACAO_20260716.md`.

---

## ⚠️ ITENS PENDENTES (herdados)

| Item | Desbloqueio |
|------|-------------|
| P2.2-A migração de páginas (merge) | Outra frente |
| `financeiro-relatorio.test.mjs` (2 falhas pré-existentes, agora em `known-issues.json`) | Item separado |
| `tests/functions/saas-onboarding.test.mjs` + `tests/firestore-rules/*` (ambiente) | CI ou máquina livre de contenção de `inotify` |
| PS5-003 verificação de e-mail no onboarding | Decisão de negócio |
| PROD-001..003 backfill/deploy SaaS produção | Autorização do dono |
| Política de senha na conta criada por aprovação (`saas-admin`) | Decisão de negócio (baixa prioridade) |

---

*Seção acima (PRÓXIMA TAREFA RECOMENDADA / RISCOS ATUAIS / ITENS PENDENTES): última atualização 2026-07-16 — Integração e certificação das frentes Sprint 3/4 SaaS + F1.4 concluída. Nenhuma nova funcionalidade, Sprint ou roadmap aberto nesta missão (por instrução explícita). Thread SaaS não revisitado na atualização de 2026-07-21 (ver "ESTADO ATUAL" no topo do arquivo, que é sobre a linha Fase 4/v3.2.0 — thread independente).*

*Estado geral do arquivo atualizado em 2026-07-21 — ver "ESTADO ATUAL" no topo: release v3.2.0 em produção, BL-008 corrigido, IAM DEV auditado sem defeito encontrado.*
