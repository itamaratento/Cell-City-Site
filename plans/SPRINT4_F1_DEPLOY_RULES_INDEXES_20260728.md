# Sprint 4 · Deploy Rules + Índices (pós-F1) · 2026-07-28

**Autorização:** continuidade (“sim” ao gate deploy Rules+índices DEV→PROD).  
**Não inclui:** Fase 2 (Cloud Functions), UI, aceite.

## Resultado

| Ambiente | Rules | Índices `convites` |
|----------|-------|---------------------|
| **DEV** (`cellcity-crm-dev`) | ✅ release idêntico ao `CRM/firestore.rules` (ruleset `0b404d7c-…`) | ✅ **2 READY** |
| **PROD** (`cellcity-crm`) | ✅ release idêntico (ruleset `90f4136d-aab6-46b4-b6fa-6b60264d81dd`) | ✅ **1 READY** + **1 CREATING** (segundo índice em construção) |

## Método

| Etapa | Método |
|-------|--------|
| DEV rules+indexes | `firebase deploy --only firestore:rules,firestore:indexes --project cellcity-crm-dev` (SA DEV) |
| PROD rules | API REST `firebaserules.googleapis.com` — create ruleset (SA PROD) + **PATCH release** com body `{ release: { name, rulesetName } }` (owner `itamaratento@gmail.com`; CLI `firebase deploy` falha 403 em `:test` — limitação conhecida da SA) |
| PROD indexes | `gcloud firestore indexes composite create` (um já existia; outro async CREATING) |

## Verificação

- DEV: `node _runtime_audit/verify-firestore-rules.mjs --project cellcity-crm-dev` → idêntico  
- PROD: GET release + compare byte-a-byte → idêntico; `match /convites` presente  

## Fora desta entrega

- Deploy Cloud Functions / F2  
- Alteração de UI  
- Push adicional (docs deste relatório — a commitar)

## Próximo gate

Aguardar índice PROD `CREATING` → `READY`, depois autorização para **S4 F2**.
