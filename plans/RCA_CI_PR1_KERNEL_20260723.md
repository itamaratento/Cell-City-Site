# RCA — CI failure do PR #1 (Kernel Fase 1.3)

**Motivo desta atividade:** Script v2.0 / continuidade — falha de CI do PR #1 estava registrada sem causa raiz.  
**Data:** 2026-07-23 · **Sem implementação**

---

## Evidências

| Item | Valor |
|------|--------|
| PR | [#1](https://github.com/itamaratento/Cell-City-Site/pull/1) draft |
| Run | [29530875942](https://github.com/itamaratento/Cell-City-Site/actions/runs/29530875942) (2026-07-16) |
| Step que falhou | **Testes de Firestore Rules** |
| Duração do step | **~3 s** (20:11:16 → 20:11:19) |
| Steps seguintes | todos **skipped** (incl. Kernel — a suíte nova **nunca rodou** na CI) |
| Logs do job | API 403 (sem admin) — RCA por workflow + timings + annotations |

Annotation de failure: `Process completed with exit code 1` (sem stack).  
Annotation warning: Actions forçando Node 24 em `checkout`/`setup-node` (depreciação Node 20 no runner) — **não** é a causa dos 3 s.

---

## Causa raiz (alta confiança)

`tests/firestore-rules` executa:

```json
"test": "firebase emulators:exec --config ../../firebase.json --only firestore \"node --test …\""
```

Isso **exige JDK** no runner.

| Workflow | Tem `Configurar Java 21`? |
|----------|---------------------------|
| Branch do PR (`5afc65d`, 16/07) | **Não** |
| `develop` atual (`7f4e705`) | **Sim** (introduzido ~17/07, ex. `d4e1322` / hardening CI) |

Falha em ~3 s é compatível com abort imediato do `emulators:exec` sem Java — **não** com suíte Rules vermelha por regressão de rules (o PR não altera Rules).

---

## Implicações

1. O vermelho do PR **não invalida** o conteúdo Kernel (`tests/kernel/`, limpeza timeout) — a suíte Kernel foi **skipped**.
2. Rebase/reabertura contra `develop` herdaria o step Java → Rules tendem a passar pelo mesmo motivo que develop está **verde** (runs recentes `success` em `7f4e705`).
3. Conflitos docs (`TECHDOC` / `PROXIMA_ETAPA`) continuam sendo o único bloqueio de merge simulado (já mapeado).

---

## O que não foi inventado

Não há evidência de bug nas Rules causado pelo PR. Não se afirma “passará 100%” sem re-run — só que a falha observada é explicada pela ausência de Java no workflow daquele head.
