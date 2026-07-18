# FASE 3.2 — Promoção Controlada para Main

**Data:** 2026-07-17  
**Classificação:** 🟡 PROMOÇÃO CONCLUÍDA COM RESSALVAS

---

## Git

| Item | Valor |
|---|---|
| Commit promovido | `b7e260d` |
| Branch | `main` (== `develop` == `origin/main` == `origin/develop`) |
| Hash final | `b7e260db0ccfda2a285111e82997a1aeaf83f6cb` |
| Tag | **`v3.1.0`** (anotada) |
| Descrição da tag | Cell City CRM SaaS v3.1.0 — Release 2026-07-17 (multiempresa/segurança, CI, backfill validado) |

## Promoção

| Item | Resultado |
|---|---|
| Higienização | Working tree já limpa (docs 3.1 já em `b7e260d`) |
| Sync | `main` e `develop` atualizados via fetch/pull |
| Commits à frente (pré-ff) | **93** (`0` atrás) |
| Fast-forward | ✅ `84977dc..b7e260d` (`--ff-only`) |
| Push `main` | ✅ |
| Push tag | ✅ `v3.1.0` |

## Validação

| Item | Valor |
|---|---|
| `main` / `origin/main` | idênticos `b7e260d` |
| `develop` / `origin/develop` | idênticos `b7e260d` |
| Divergência main…develop | **0 / 0** |
| Tag publicada | `v3.1.0` listada local e no remoto |

## Ressalva (efeito colateral do push em `main`)

O workflow **Deploy Firebase** disparou automaticamente e **falhou** no passo
de autenticação (run [29623002802](https://github.com/itamaratento/Cell-City-Site/actions/runs/29623002802)):

> `FIREBASE_SA_KEY` ausente / não injetado — `credentials_json` vazio.

**Nenhum** Rules/Functions/Storage foi deployado. Isso é bloqueio da **próxima
fase** (configurar o secret + reexecutar deploy), não uma falha do fast-forward.

## Próxima fase

1. Configurar `secrets.FIREBASE_SA_KEY` (se ainda ausente)
2. Deploy Firebase (Rules + Indexes + Storage + Functions) — `workflow_dispatch` ou novo push
3. Smoke tests
4. Encerramento oficial da release

### 🟡 PROMOÇÃO CONCLUÍDA COM RESSALVAS

*Git/tag OK. Deploy Firebase não concluído (secret ausente). Sem smoke nesta fase.*
