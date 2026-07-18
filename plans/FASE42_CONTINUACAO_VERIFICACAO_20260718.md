# FASE 4.2 — Continuação: Verificação Pós-Promoção + Validação do Backup

**Data:** 2026-07-18 ~14:10 (-03)
**Sessão:** continuação autônoma (sessão concorrente ativa detectada — push na main às 16:56 UTC)
**Estado de referência:** main == origin/main == develop == `f445973` · tag `v3.1.1`

---

## 1. Objetivo

Retomar a Fase 4.2 do ponto registrado na Fase 4.1: verificar bindings IAM do WIF, acompanhar o primeiro Deploy Firebase via CI, validar o fix D05 do backup antes do cron de domingo (07-19) e mapear o que falta para a certificação 🟢 SEM RESSALVAS.

## 2. Verificações executadas (somente leitura em produção)

| Item | Evidência | Resultado |
|---|---|---|
| Promoção develop→main | reflog + `git rev-list` (0/0 vs origin) | ✅ JÁ FEITA por sessão concorrente; tag `v3.1.1` = `f445973` no origin |
| Testes Actions main | run @ f445973 | ✅ **success** — fix D04 confirmado (primeira main verde) |
| Testes Actions develop | run @ f445973 | ✅ success |
| Deploy Pages main | run @ f445973 | ✅ success |
| **Deploy Firebase (1º via CI/WIF)** | run 29652951606 | ❌ **failure** no passo "Deploy Firestore Rules" |
| Bindings IAM `github-deploy` | `gcloud projects get-iam-policy` (19 bindings) | ❌ **0/5** — causa direta da falha do deploy. Auth WIF "passa" no CI porque a action só grava config de credencial |
| Reexecução do script de bindings | `wif-conceder-papeis.sh` | ❌ classificador do sandbox AINDA bloqueia `add-iam-policy-binding` → segue com o operador |
| Rules Firestore em produção | ruleset `965a56e8` via firebaserules API, diff byte a byte | **PROD == HEAD** (≠ working tree) |
| Rules Storage em produção | ruleset `7eb2ad80` | **PROD == HEAD** (≠ working tree) |
| Proteção de tags Cell-City-Backup | API rulesets (403 plano free) + API legada (404) | não inspecionável via API — item de UI do operador; não-fatal (slots são branches) |

## 3. Ações executadas

1. **Backup do working tree não commitado** (correções de segurança Fase 4.1: 16 modified + plans untracked, 25 arquivos + patch) → scratchpad da sessão, `backup-wt-1406/` + `working-tree-fase41-seguranca.patch`. Motivo: repo sofre reset externo recorrente; commit de Rules/CF exige autorização do dono.
2. **Dispatch manual do backup-weekly.yml** (main, HTTP 204) → run **29653330787 ✅ success**. Fix D05 VALIDADO — o cron de domingo 07-19 deve passar (primeiro sucesso após as 8 falhas W28).

## 4. Impacto e riscos

- **Nenhuma escrita em produção** nesta sessão (deploys, Rules, IAM e dados intocados; único efeito colateral: um backup novo no Cell-City-Backup).
- ✅ Risco afastado: como PROD == HEAD, o Deploy Firebase via CI, quando os bindings existirem, é **idempotente** — não reverte nada.
- 🔴 Risco ativo: as correções de segurança da Fase 4.1 (Rules `config` whitelist, `pre_os`+empresa_id, Storage auth por empresa, LGPD `cpfMascarado`, RBAC fail-closed, rate-limit 5/min) **não estão em produção** e existem apenas no working tree local, exposto ao reset externo. Mitigação aplicada: backup íntegro em scratchpad.

## 5. Pendências para 🟢 SEM RESSALVAS

1. **Operador:** rodar `scripts/infra/wif-conceder-papeis.sh` (5 bindings) → re-run do Deploy Firebase (run 29652951606) → conferir passo "Validar deploy das Rules (via API)".
2. **Dono:** autorizar commit + promoção + deploy das correções de segurança Fase 4.1 do working tree (gatilho Rules/CF).
3. Smoke autenticado completo + matriz RBAC por perfil (ressalvas da certificação Fase 3.7/4.1).
4. Opcional (UI): bypass da deploy key na proteção de tags do Cell-City-Backup (restaura espelho de tags; hoje vira só aviso no manifesto).

**TECHDOC:** memória `project-fase42-continuacao-20260718`; sequência de `plans/FASE41_EXECUCAO_DECISOES_20260718.md` e dos relatórios `*_v3.1.0_20260718.md` da sessão concorrente.
