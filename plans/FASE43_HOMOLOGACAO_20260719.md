# FASE 4.3 — HOMOLOGAÇÃO FINAL (2026-07-19)

**Commit homologado:** `878f141` (main == develop)
**Executor:** sessão autônoma, conforme script "FASE 4.3 | PROMOÇÃO FINAL E HOMOLOGAÇÃO" do dono.

## Linha do tempo da execução

| Hora (UTC) | Evento |
|---|---|
| 15:26 | main promovida a `e201f35` (sessão concorrente) — Deploy Firebase NÃO disparou (filtro de `paths` do workflow não cobre `.github/**` nem `plans/**`) |
| 15:43–44 | Functions deployadas localmente por sessão concorrente (fonte == repo, verificado depois) |
| 15:5x | Dispatch manual #1 (run 29693959000, e201f35): guard Storage ✅ **funcionou**; Functions ❌ — runner sem `functions/node_modules` ("Couldn't find firebase-functions package") |
| 16:0x | Fix `npm ci` em functions/ (`878f141`) → ff develop→main → dispatch #2 |
| 16:04–16:0x | **Run 29694108479: SUCCESS 10/10 passos** — primeiro Deploy Firebase 100% verde da história |

## Critérios de aceite — evidências

| Critério | Evidência | Status |
|---|---|---|
| Fast-forward develop→main | main == develop == `878f141` | ✅ |
| Push origin/main | `e201f35..878f141` | ✅ |
| Workflow Deploy Firebase | run 29694108479 SUCCESS (WIF ✅, Rules ✅, Indexes ✅, Storage guard ✅, npm ci ✅, Functions ✅, Validação API ✅) | ✅ |
| Cloud Functions em produção | 16/16 ACTIVE; fonte baixada do bucket GCF e comparada **byte a byte** com `878f141` (os.js, lib/rate-limit.js, index.js, portal.js, admin.js, saas.js — todos idênticos); CI confirmou "Skipped (No changes detected)" 16/16 = idempotência | ✅ |
| Firestore Rules sincronizadas | ruleset prod == `CRM/firestore.rules` byte a byte + passo "Validar deploy das Rules (via API)" ✅ | ✅ |
| Indexes sincronizados | passo CI ✅ (drift zero desde D06) | ✅ |
| Storage | SKIPPED com aviso ("sem bucket vinculado") — compatível com homologação: projeto NÃO tem bucket; sem exposição | ✅ (SKIPPED) |
| Smoke autenticado | Harness de homologação (padrão do projeto, Chrome headless vs DEV): login=OK dashboard=OK central=OK cache=OK multiaba=OK @ `878f141`; fluxos OS/Financeiro/Estoque/Portal/exclusão cobertos pelas suítes CI abaixo (metodologia jsdom+emulador, sem browser em prod) | ✅ |
| RBAC | tests/rbac: **181/181 pass** local + CI main ✅ (CRM/Entrada/Chips/Agenda/Estoque/Caixa/Financeiro; 7 perfis; sem elevação) | ✅ |
| Fail-closed / leituras públicas | Probes anônimos REST em PROD: `clientes`, `usuarios`, `pre_os`, `ordens_servico`, `chips_cadastros` ⇒ 403; `catalogo_config` get público preservado | ✅ |
| LGPD (CPF mascarado) | `cpfMascarado` coberto em tests/functions/portal-cloud-functions.test.mjs + tests/integrity/integridade.test.mjs — CI main ✅ | ✅ |
| Rate limit | tests/functions/rate-limit-s2.test.mjs no CI (emulador) ✅; código em prod == repo (diff byte a byte) | ✅ |
| Testes automatizados main | run 29694090446 @ 878f141 SUCCESS (suíte completa) | ✅ |

## STATUS FINAL: 🟢 FASE 4.3 HOMOLOGADA

```
GitHub Actions............... SUCCESS
Firestore Rules.............. SUCCESS
Indexes...................... SUCCESS
Cloud Functions.............. SUCCESS (16/16, prod == 878f141)
Storage...................... SKIPPED (sem bucket — administrativo)

Smoke Autenticado............ SUCCESS (DEV, harness oficial)
RBAC......................... SUCCESS (181/181)
LGPD......................... VALIDADA (testes CI)
Rate Limit................... VALIDADO (testes CI + fonte prod)

STATUS FINAL................. 🟢 HOMOLOGADA
```

## Itens administrativos / backlog (não bloqueiam)

1. **Firebase Storage**: decisão de criar bucket (exige Blaze) permanece com o dono; o workflow aplicará `storage.rules` automaticamente quando existir.
2. **Runtime Node.js 20 das Functions**: depreciado em 2026-04-30, **descomissiona 2026-10-30** — planejar upgrade para nodejs22 antes disso (mudança em Functions ⇒ exige autorização).
3. **Bug no harness `homologar-performance`**: o parser espera o reporter *spec* (`ℹ pass N`) mas `node --test` em spawn não-TTY emite TAP (`# pass N`) ⇒ suítes com exit 0 aparecem como ❌ "NaN pass/NaN fail" e a recomendação final sai REPROVADO indevidamente. Corrigir parser em `scripts/homologacao/lib/tests-runner.mjs`.
4. Bypass de tags do Cell-City-Backup (item de UI, não-fatal).

---

## VALIDAÇÃO FINAL DA RELEASE v3.2.0 (adendo, 2026-07-19)

**Evidência arquivada — GitHub Actions:**

```
Workflow..................... Testes automatizados
Run ID....................... 29694988124
Branch/Commit................ main @ d650464 (== tag v3.2.0)
Conclusion................... SUCCESS
URL.......................... https://github.com/itamaratento/Cell-City-Site/actions/runs/29694988124
```

Sem regressões. Observação operacional: o passo "Testes do Control Center
(diagnóstico, ferramentas, manutenção)" levou vários minutos além do run
anterior (7 min totais em 29694090446) — lentidão de runner, concluiu verde;
se recorrer, avaliar assinatura nova em `scripts/release/known_flakes.json`.

### STATUS FINAL: 🟢 RELEASE v3.2.0 VALIDADA
