# Pacote cota Firestore + BL-007 (2026-07-23)

**Autorização:** continuidade automática pós–Sprint 1 (pacotes sem reautorização).

## DT-10…14 — tetos de leitura (hotspots)

Constante: `PAGINACAO.LIMITE_LISTA_PADRAO` (200) de `app-config.js`.

| Arquivo | Mudança |
|---------|---------|
| `financeiro/financeiro.js` | `limit(LIMITE_LISTA)` em carregar/reload/cats/fechamentos/itens |
| `central-alertas/central-alertas.js` | `limitTo` em Agenda/OS/Posvenda/Portal/Financeiro* |
| `dashboard/dashboard-alertas.js` | `limit` em agenda/os/posvenda/portal/prontos/orçamentos |
| `portal-cliente/admin.js` | `limit(200)` em `portal_eventos` (acesso/whatsapp/maps) |

**Ressalva:** teto 200 pode omitir registros antigos em bases grandes — aceitável como proteção de cota; paginação completa = DT-14 futuro.

## BL-007 — nodejs22

| Arquivo | Antes | Depois |
|---------|-------|--------|
| `functions/package.json` engines | 20 | **22** |
| `firebase.json` runtime | nodejs20 | **nodejs22** |
| `.github/workflows/tests.yml` | Node 20 | **Node 22** |

**Deploy:** o runtime em produção só muda no próximo deploy de Functions (CI/pipeline). Código/config prontos.

## Bloqueios objetivos (não executáveis aqui)

| Item | Motivo |
|------|--------|
| **BL-009** Storage/Blaze | Decisão de custo do dono (plano Blaze) |
| **BL-010** bypass deploy key | Ação manual na UI do GitHub (Cell-City-Backup) |

## Testes

- `node --check` nos JS alterados
- Suíte estática `tests/integrity/cota-limites.test.mjs` (nova)
- CI develop após push
