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

## ✅ ESTADO ATUAL (2026-07-16) — SPRINT 3 ONBOARDING SaaS CONCLUÍDA

### Sprint 3 — Onboarding SaaS ✅

| Item | Status |
|------|--------|
| Wizard 3 passos (`saas-onboarding.js`) | ✅ |
| Integração `saas-planos.js` | ✅ |
| Validações compartilhadas | ✅ |
| CF `saasOnboardingCriarEmpresa` + provisionamento | ✅ |
| `FLAGS.SAAS_ONBOARDING_ATIVO: true` | ✅ |
| Testes onboarding 10/10 | ✅ |
| Arquitetura 6/6 · Integridade 14/14 · Catálogo 17/17 | ✅ |
| RBAC | 🟡 173/175 (2 pré-existentes) |
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

1. **Homologação manual** do onboarding em `/dev/CRM/pages/saas-onboarding/` (fluxo completo + aprovação no `saas-admin`).
2. Executar `tests/functions/saas-onboarding.test.mjs` após elevar `fs.inotify.max_user_watches` (requer `sudo` — decisão/execução do dono) ou em CI.
3. **Sprint 4 SaaS** — aguarda plano formal (provável: evolução `saas-admin` / fluxo de aprovação) — **não iniciar sem documentação**.

---

## ⚠️ RISCOS ATUAIS

- 🔴 SaaS multiempresa **não promovido a produção** (decisão pós-incidente 2026-07-14 permanece).
- 🟡 Divergência de nomenclatura Sprint 3 (RBAC legado vs SaaS) — usar ordem SaaS 07-16 como referência para onboarding.
- 🟢 Sprints 1–2 intactas; zero regressão detectada nas suítes executadas.

---

## ⚠️ ITENS PENDENTES (herdados)

| Item | Desbloqueio |
|------|-------------|
| P2.2-A migração de páginas (merge) | Outra frente |
| `financeiro-relatorio.test.mjs` (2 falhas) | Item separado |
| PS5-003 verificação de e-mail no onboarding | Decisão de negócio |
| PROD-001..003 backfill/deploy SaaS produção | Autorização do dono |

---

*Última atualização: 2026-07-16 — Sprint 3 Onboarding SaaS concluída.*
