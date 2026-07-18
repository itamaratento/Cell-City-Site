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

## ✅ ESTADO ATUAL (2026-07-18) — FASE 4.2 EXECUTADA (BLOQUEIOS EXTERNOS)

Execução autônoma completa do que era possível sem escrever em produção.
Relatório: [`plans/FASE42_EXECUCAO_AUTONOMA_v3.1.0_20260718.md`](plans/FASE42_EXECUCAO_AUTONOMA_v3.1.0_20260718.md).

**Classificação oficial:** 🟡 **CERTIFICADA COM RESSALVAS**  
(🟢 bloqueado: commit auth · IAM WIF · deploy · smoke autenticado)

### Validado nesta fase

- Rules 121/121 · Storage 14/14 · LGPD · rate-limit · smoke HTTP público
- Prod: 23 índices READY · 16 Functions ACTIVE
- Drift: WT≠prod (correções locais); develop `c9a0660` ≫ main `b7e260d` (14 commits)
- WIF no workflow (D03) mas **0/5 bindings IAM** na SA `github-deploy` (confirmado gcloud)
- CI develop @ `c9a0660`: Testes ✅ · Pages ✅

### Working tree

16 arquivos de segurança FASE 4.1 **não commitados** + plans untracked.

### Próxima ação humana (desbloqueio)

1. Autorizar **commit** (+ push develop) do lote de segurança  
2. Executar `scripts/infra/wif-conceder-papeis.sh` (5 bindings — SA hoje sem papéis)  
3. Autorizar ff develop→main / deploy  
4. Smoke autenticado → parecer 🟢 se critérios fecharem


### Histórico recente (não sobrescreve o acima)

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

*Última atualização: 2026-07-16 — Integração e certificação das frentes Sprint 3/4 SaaS + F1.4 concluída. Nenhuma nova funcionalidade, Sprint ou roadmap aberto nesta missão (por instrução explícita).*
