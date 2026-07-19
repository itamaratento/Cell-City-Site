# FASE 4.3 — Primeiro deploy CI real + guard de Storage (2026-07-19)

**Sessão:** continuação autônoma da Fase 4.2 (domingo, 2026-07-19).
**Branch:** develop @ `2a28615` (main @ `7a5ae9c`).

## Objetivo

Retomar as pendências da Fase 4.2: validar bindings WIF, acompanhar o
primeiro deploy Firebase via CI na main, validar o backup de domingo e
destravar o que estivesse quebrado.

## O que foi verificado (sem alteração)

| Item | Resultado |
|---|---|
| Bindings IAM `github-deploy` | ✅ 5/5 (4 no projeto + `workloadIdentityUser` na SA) — operador rodou o script |
| Fixes de segurança Fase 4.1 | ✅ COMMITADOS (`7633558`) e promovidos a main (`7a5ae9c`, push 15:15 UTC) |
| Deploy Firestore Rules via CI | ✅ **PRIMEIRO da história** — run 29692486024, release 15:16:26 UTC |
| Firestore prod vs repo | ✅ ruleset `814b1076` == `CRM/firestore.rules` @ 7a5ae9c **byte a byte** |
| Deploy Firestore Indexes via CI | ✅ mesmo run |
| Testes automatizados na main @ 7a5ae9c | ✅ success |
| Backup cron domingo (D05) | ✅ 5 runs hoje (cron `0 */3 * * 0`, por design), todos success |
| Smoke anônimo Rules prod | ✅ `clientes`/`usuarios`/`pre_os`/`ordens_servico`/`chips_cadastros` list ⇒ 403; `catalogo_config` get público ⇒ permitido (404 = doc `geral` inexistente, vitrine curada — D07, não é regressão) |

## Problema encontrado

O passo **Deploy Storage Rules** falhou (`Firebase Storage has not been
set up`) e derrubou o job, **pulando o Deploy Cloud Functions**. Causa
confirmada via API `firebasestorage`: **não existe NENHUM bucket
vinculado ao Firebase Storage** (`buckets` ⇒ `{}`, `defaultBucket` ⇒ 404;
`gcloud storage buckets list` só mostra buckets internos do GCF). Os
releases de `storage.rules` criados via REST em 07-18 apontam para um
bucket inexistente — são inócuos.

Implicações:
- O achado de leitura pública em Storage (A2) **nunca teve exposição
  real em prod**: não há bucket nem arquivos.
- Criar o bucket hoje exige plano **Blaze** (política Firebase desde
  out/2024) → decisão de custo do DONO.
- As Cloud Functions em prod estão **desatualizadas**: `functions/os.js`
  e `functions/lib/rate-limit.js` (fix S2, rate-limit 5/min) mudaram em
  `7633558` e o deploy foi pulado.

## Alteração realizada

- **Arquivo:** `.github/workflows/deploy-firebase.yml` (commit `2a28615`, develop)
- **Mudança:** guard no passo Deploy Storage Rules — consulta a API
  `firebasestorage`; sem bucket vinculado, pula com aviso (exit 0) em vez
  de derrubar o job. Quando o dono configurar o Storage, o passo volta a
  deployar sozinho, já com o `storage.rules` endurecido.
- **Módulos afetados:** somente CI/CD. Nenhuma Rule, Function ou código
  de aplicação alterado.
- **Riscos:** baixo. O guard é read-only; pior caso = comportamento
  idêntico ao atual (falha do passo).

## Pendências (gatilhos do dono/operador)

1. **Promover develop→main** (`2a28615`, squash conforme regra) → dispara
   o Deploy Firebase corrigido → **Cloud Functions (fix S2) vão a prod**.
2. **Decidir Firebase Storage:** configurar (exige Blaze) ou manter sem
   bucket (sem exposição; guard mantém CI verde).
3. Smoke autenticado + matriz RBAC em prod (exige credenciais dos
   usuários de homologação).
4. Opcional: bypass da deploy key no ruleset de tags do Cell-City-Backup
   (item de UI, não-fatal).
