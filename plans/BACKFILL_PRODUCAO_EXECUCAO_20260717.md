# Backfill Produção — Execução Autorizada 2026-07-17

**Projeto:** `cellcity-crm`  
**Modo:** `--execute` + `validar-backfill`  
**Classificação:** 🟢 Backfill concluído com sucesso

---

## Pré-condições

- Dry-run prévio: 4 pendentes, 0 erros
- Re-check dry-run imediato: 4 pendentes, 0 erros → prosseguiu
- PITR ativo; export JSON parcial conhecido (ressalva anterior)

## Backfill

| Campo | Valor |
|---|---|
| Comando | `node scripts/backfill-empresa-id.mjs --project prod --execute` |
| Resultado | **Sucesso** |
| Exit | `0` |
| Duração | ~8 s |
| Escaneados | 1.243 |
| Já corretos | 1.239 |
| Corrigidos | **4** |
| OUTRO empresa_id | 0 |
| Falhas | **0** |

Coleções: `os` (1), `clientes` (1), `estoque_produtos` (1), `agenda` (1)

## Validação

| Campo | Valor |
|---|---|
| Comando | `node scripts/validar-backfill.mjs --project prod` |
| Exit | **0** |
| Pendentes | **0** |
| Divergentes | **0** |
| Erros | **0** |

## Flag `dados_migrados` (atualização Fase 2.9)

- Leitura Firestore REST `empresas/cellcity-master`: **`dados_migrados = true`**
  (desde `2026-07-14T20:01:18Z`). Nenhuma escrita necessária nesta fase.

## Não executado (aguardando autorização)

- merge `develop` → `main`
- tag
- deploy Firebase / Rules
- smoke tests
