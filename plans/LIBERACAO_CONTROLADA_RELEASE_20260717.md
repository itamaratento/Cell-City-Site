# FASE 2.4 — Liberação Controlada da Release

**Data:** 2026-07-17  
**Branch:** `develop` @ `4080ec2`  
**Tracking:** `origin/develop` — **à frente 7 commits** (sem push)  
**Modo:** preparação até o limite da autorização humana  

> Público. Detalhes operacionais / comandos:  
> `plans/LIBERACAO_CONTROLADA_RELEASE_20260717_INTERNO.md` (gitignorado).

---

## Recomendação Final

### 🟢 PRONTO PARA PUSH

A branch local está limpa, certificada e pronta para publicação em `origin/develop`.  
Não há atividade técnica remanescente sem credenciais ou decisão humana.

**Não é** ainda `PRONTO PARA BACKFILL` / `PROMOÇÃO` / `DEPLOY` — essas etapas
dependem, nesta ordem, do push + CI remota verde.

---

## 1. Estado da Branch

| Item | Evidência |
|---|---|
| Branch ativa | `develop` |
| HEAD | `4080ec2` — Fase 2.2 (senha CSPRNG, PIN removido, XSS, catálogo público) |
| Working tree | **Limpa** (sem staged / unstaged) |
| Upstream | `origin/develop` @ `38ee5eb` |
| Divergência | Local **ahead 7**, behind **0** |
| vs `main` | `develop` está ~76 commits à frente de `main` (fast-forward possível após autorização) |
| Conflitos | Nenhum |
| Segredos / credenciais no diff | Nenhum path suspeito (`secret`, `.env`, `service-account`, `.pem`) |
| Arquivos grandes gerados | Nenhum artefato temporário esquecido no working tree |

### Commits locais não publicados (ordem)

1. `d4e1322` — Fase 2.1 (CI Java, Storage, Functions, RBAC, limpeza)
2. `08270b0` — onboarding: dedup atômico de e-mail
3. `177a9b4` — docs + CI ampliada
4. `a56f975` — changelog missão autônoma
5. `fecc9ed` — docs certificação engenharia
6. `6a68424` — CI: `emulators.singleProjectMode: false`
7. `4080ec2` — Fase 2.2 segurança (CSPRNG, PIN, XSS, catálogo)

---

## 2. Auditoria dos Commits

| Critério | Resultado |
|---|---|
| Histórico linear | Sim — sem merge/rebase pendente |
| Escopo coerente com release | Segurança, CI, multiempresa, testes, docs |
| Remoções de código morto | `CRM/services/*`, repositories órfãos, scripts init órfãos |
| Remoção de rascunho Rules | `CRM/firestore.rules.secure` (nunca referenciado por deploy) |
| Regressão conhecida | Nenhuma aberta no código desta janela |
| S2 (`consultarOSPublica`) | Mitigado (rate limit 8/min + testes); causa raiz = decisão de negócio |

Revalidação local nesta missão (com `firebase.json` atual):

| Suíte | Resultado |
|---|---|
| Firestore Rules | **117/117** |
| Storage Rules | **11/11** |
| Functions (S2 + onboarding amostra) | **9/9** |
| RBAC (Fase 2.1/2.2) | **181/181** (certificado nas fases anteriores; fixtures estáveis) |

---

## 3. Auditoria da CI/CD

### Workflow `tests.yml` — riscos anteriores e mitigação

| Risco | Estado |
|---|---|
| JDK ausente (emulador JAR) | ✅ `actions/setup-java@v4` Temurin 21 |
| Storage Rules fora da CI | ✅ passo dedicado |
| Contenção de emulador / single project | ✅ `emulators.singleProjectMode: false` (`6a68424`) |
| Rate-limit poluindo testes Functions | ✅ `clearRateLimitStore` + `--test-concurrency=1` |
| Deploy Firebase em `develop` | ✅ gated: `if: github.ref == 'refs/heads/main'` |

### Secrets / permissões

- Deploy Firebase: service account só no job de `main` (esperado).
- Pages: publica `main` + `/dev` a partir de `develop` (já existente).
- Nenhum secret novo introduzido pelos 7 commits.

### Risco residual pós-push

- Primeira confirmação remota ainda **pendente** (exige push humano).
- E2E Puppeteer / Control Center podem flocular em runner — não bloqueiam Rules/Functions/RBAC se esses passos passarem.

---

## 4. Validação do Backfill

| Item | Estado |
|---|---|
| Script | `scripts/backfill-empresa-id.mjs` — ESM, paginado, REST |
| Validação | `scripts/validar-backfill.mjs` — exit 0 só se `PENDENTE==0` |
| Idempotência | Só escreve `empresa_id` ausente/null; não sobrescreve |
| Coleções | Inclui `pre_os`, `catalogo_*`, `usuarios`, etc. |
| Dry-run prod | Preparado; **não executado** (exige `gcloud auth`) |
| Rollback de dados | Não há “undo” automático — ordem correta evita necessidade; se incompleto: **não** promover Rules |

**Pré-requisito duro (P0 2026-07-14):**  
backfill 100% → `validar-backfill` exit 0 → `empresas/...dados_migrados=true` → **só então** Rules via `main`.

---

## 5. Preparação da Promoção

Sequência preparada (não executada):

1. Push `develop` → CI remota verde  
2. Backfill prod + validação + `dados_migrados`  
3. Fast-forward `main` ← `develop`  
4. Tag oficial (ex.: `v2026.07.17-saas-rc` ou padrão do projeto)  
5. Deploy Firebase (Rules / Functions / Storage) só a partir de `main`  
6. Smoke test (§7)

Rollback de código: `git revert` + push (`GUIA_ROLLBACK.md` §2); Rules: republicar backup (§5).

---

## 6. Preparação do Deploy

| Artefato | Origem | Gatilho |
|---|---|---|
| GitHub Pages (prod) | `main` | push em `main` / workflow Pages |
| GitHub Pages (`/dev`) | `develop` | push em `develop` |
| Firestore Rules | `main` | `deploy-firebase.yml` |
| Storage Rules | `main` | idem |
| Cloud Functions | `main` | idem |

**Não** publicar Rules novas sem backfill validado.

---

## 7. Smoke Test Planejado

Checklist pós-deploy (detalhe operacional no relatório interno):

- [ ] Login / sessão / logout  
- [ ] Multiempresa (troca / isolamento de listas)  
- [ ] Dashboard (alertas sem XSS; KPIs)  
- [ ] Agenda  
- [ ] CRM (leads / templates)  
- [ ] Caixa  
- [ ] Financeiro (receber/pagar + relatório mensal)  
- [ ] Estoque  
- [ ] Ordens de Serviço (lista, busca cliente, impressão)  
- [ ] Portal do Cliente + consulta pública OS (rate limit)  
- [ ] Catálogo público (anônimo só `cellcity-master`)  
- [ ] Cloud Functions críticas (onboarding, admin, portal)  
- [ ] Firestore (leituras tenant-scoped sem `permission-denied` indevido)  
- [ ] Storage (upload/download canônico)  
- [ ] RBAC (perfil restrito vs admin)  
- [ ] Performance (aba oculta / sem polling agressivo)  
- [ ] Console browser (sem PII / erros novos)  
- [ ] Logs Functions / Firebase  

---

## 8. Release Notes (rascunho)

**Cell City CRM SaaS — Release Candidate 2026-07-17**

### Segurança
- Senhas temporárias via CSPRNG (`crypto.getRandomValues` / `randomBytes`)
- Remoção do PIN estático de exclusão de usuário (type-to-confirm por e-mail)
- Escape XSS em Dashboard (alertas) e OS (cards/busca)
- Catálogo público: leitura anônima apenas de `empresa_id == cellcity-master`
- Onboarding: reserva atômica de e-mail (`saas_email_index`)

### Plataforma / CI
- JDK 21 no workflow de testes; Storage Rules na CI
- Emuladores: `singleProjectMode: false`
- Rate-limit resetável em testes; suíte S2 dedicada

### Multiempresa
- Scripts de backfill/validação prontos para produção
- Rules fail-closed alinhadas ao modelo tenant

### Observabilidade / higiene
- Remoção de camada `CRM/services/` órfã; SW v20
- Documentação e CHANGELOG atualizados

### Conhecido / decisão pendente
- S2: prova de posse em `consultarOSPublica` ainda é decisão do dono (mitigação ativa)

---

## 9. Checklist Final

| # | Item | Status |
|---|---|---|
| 1 | Working tree limpa | ✅ |
| 2 | Commits coerentes, sem segredos | ✅ |
| 3 | Suítes locais críticas verdes | ✅ |
| 4 | CI local preparada (Java, Storage, concurrency) | ✅ |
| 5 | Push `develop` | ⏳ humano |
| 6 | CI remota verde | ⏳ após push |
| 7 | Backfill prod + validar + flag | ⏳ humano |
| 8 | `develop` → `main` + tag | ⏳ humano |
| 9 | Deploy Firebase | ⏳ humano |
| 10 | Smoke pós-deploy | ⏳ humano |

---

## 10. Riscos Residuais

| Risco | Severidade | Mitigação |
|---|---|---|
| Promover Rules antes do backfill | **P0** | Checklist obrigatório; precedente 2026-07-14 |
| CI remota ainda não confirmada | Médio | Push + acompanhar Actions |
| S2 sem prova de posse | Médio (dono) | Rate limit 8/min; decisão futura |
| Flake E2E no runner | Baixo | Não bloqueia núcleo Rules/Functions/RBAC |
| Cache SW em clientes | Baixo | SW já em v20; hard-reload no smoke |

---

## 11. Pendências Humanas

1. **`git push origin develop`**  
2. Validar CI remota (Actions)  
3. Autorizar e executar **backfill** produção (dry-run → execute → validar → `dados_migrados`)  
4. Autorizar **fast-forward** `develop` → `main` + **tag**  
5. Autorizar **deploy** Firebase  
6. Executar smoke (§7)  
7. (Opcional) Decisão S2 raiz  

---

## 12. Parecer Técnico

A release candidata em `develop` @ `4080ec2` está **tecnicamente pronta para
publicação no remoto**. Bloqueadores de CI local conhecidos (JDK, Storage,
singleProjectMode, rate-limit harness, fixtures RBAC) foram eliminados nas
Fases 2.1–2.2 e revalidados nesta Fase 2.4.

Não resta trabalho de código ou documentação bloqueante executável sem
credenciais. As etapas seguintes são **gates humanos** por política do projeto
e por irreversibilidade (push, dados de produção, main, deploy).

---

## 13. Recomendação Final (obrigatória)

### 🟢 PRONTO PARA PUSH

Próximo passo autorizado pelo mantenedor:

```text
git push origin develop
```

Após CI remota verde → autorizar backfill → só então promoção à `main` e deploy.

---

*Missão FASE 2.4 concluída sem push, merge, tag, deploy ou backfill de produção.*
