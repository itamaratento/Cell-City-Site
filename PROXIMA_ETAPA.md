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

## ✅ ESTADO ATUAL (2026-07-16) — SPRINT 4 ADMIN SaaS (APROVAÇÃO) CONCLUÍDA

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
| CF tests emulador | ⏳ Bloqueio de ambiente: `ENOSPC` inotify watchers (exige `sudo`) — testes escritos, não executados. Ver `plans/SPRINT3_ONBOARDING_RELATORIO.md` §10 |

Relatório completo: [`plans/SPRINT3_ONBOARDING_RELATORIO.md`](plans/SPRINT3_ONBOARDING_RELATORIO.md) · TECHDOC §43

### Sprints anteriores (SaaS)

| Sprint | Entrega | Status |
|--------|---------|--------|
| Sprint 0 | Certificação encerramento | ✅ |
| Sprint 1 | Arquitetura (F1.1–F1.4, app-config, kernel) | ✅ |
| Sprint 2 | Portal split (P2.2) | ✅ |

---

## 🚦 PRÓXIMA TAREFA RECOMENDADA

1. **Homologação manual** do fluxo completo em `/dev/`: onboarding → aprovação no `saas-admin` → login do admin criado.
2. Executar `tests/functions/saas-onboarding.test.mjs` após elevar `fs.inotify.max_user_watches` (requer `sudo` — decisão/execução do dono) ou em CI.
3. Decisão do dono sobre promoção SaaS e backfill produção (PROD-001..003, PS6) — segue bloqueada pelo incidente de 2026-07-14.
4. **Sprint 5 SaaS** (se houver) — aguarda novo plano formal ou nova evidência de dependência não resolvida no código, mesmo critério usado nesta sprint.

---

## ⚠️ RISCOS ATUAIS

- 🔴 SaaS multiempresa **não promovido a produção** (decisão pós-incidente 2026-07-14 permanece).
- 🟡 Senha temporária do admin criado na aprovação não passa pela política de senha (`politicas_senha`) usada em Usuários e Permissões — só mínimo de 6 caracteres (ver TECHDOC §45, "fora de escopo").
- 🟢 Sprints 1–3 intactas; zero regressão detectada nas suítes executadas (179/181, mesmas 2 falhas pré-existentes).

---

## ⚠️ ITENS PENDENTES (herdados)

| Item | Desbloqueio |
|------|-------------|
| P2.2-A migração de páginas (merge) | Outra frente |
| `financeiro-relatorio.test.mjs` (2 falhas) | Item separado |
| PS5-003 verificação de e-mail no onboarding | Decisão de negócio |
| PROD-001..003 backfill/deploy SaaS produção | Autorização do dono |
| Política de senha na conta criada por aprovação (`saas-admin`) | Decisão de negócio (baixa prioridade) |

---

*Última atualização: 2026-07-16 — Sprint 4 Admin SaaS (aprovação de empresas pendentes) concluída.*
