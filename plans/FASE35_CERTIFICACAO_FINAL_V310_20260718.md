# FASE 3.5 — CERTIFICAÇÃO FINAL DA RELEASE v3.1.0 (2026-07-18)

Execução do roteiro de certificação enviado pelo operador, adaptado ao ambiente (Firebase CLI não instalado → gcloud/REST; checklist interativo → smoke test automatizado no nível da consulta, padrão de homologação sem browser do projeto). Complementa `plans/FASE35_VERIFICACAO_POS_DEPLOY_20260718.md`.

## Linha do tempo do desbloqueio

1. Relatório da Fase 3.5 (manhã de 07-18) identificou: Rules ✅ e Functions ✅ em prod (deploy externo de 07-18 ~00:31–00:39Z), **índices ausentes** (11 do arquivo + 5 fora do arquivo, corrigidos em `bb4905d`).
2. Operador autorizou e executou o deploy dos índices (roteiro Fase 3.5); os 16 novos índices entraram em `CREATING`.
3. Esta sessão monitorou a criação: **todos READY às 08:28 (-03)**. Comando de criação idempotente confirmou 19/19 do arquivo presentes, zero falhas.

## Evidências da certificação

### [1–2/6] Índices
- **23 índices compostos, 23 READY** (19 do `CRM/firestore.indexes.json` + 4 legados pré-v3.1.0, inofensivos). Nenhum CREATING/NEEDS_REPAIR.

### [3/6] Smoke test (runQuery REST, tenant `cellcity-master`, sem exibir dados)
**9/9 consultas aceitas** — exatamente as combinações que as telas emitem:

| Tela | Consulta | Resultado |
|---|---|---|
| Pós-venda | os · empresa_id== · createdAt desc | ✅ (1 doc) |
| Autoatendimento | pre_os · empresa_id== · criadoEm desc | ✅ (1 doc) |
| Catálogo Admin | catalogo_produtos · empresa_id== · ordem asc | ✅ (coleção vazia) |
| Central de Comandos | comandos · empresa_id== · criadoEm desc | ✅ (1 doc) |
| Central de Informações | informacoes · empresa_id== · criadoEm desc | ✅ (1 doc) |
| Central de Alertas | avaliacoes · empresa_id== · createdAt desc limit 5 | ✅ (coleção vazia) |
| Chips | chips_cadastros · empresa_id== · criadoEm desc | ✅ (coleção vazia) |
| Clientes ordenado | clientes · empresa_id== · nome asc | ✅ aceita (ver ressalva R1) |
| Estoque ordenado | estoque_produtos · empresa_id== · nome asc | ✅ (1 doc) |

Backfill verificado por agregação: `clientes` 35/35 docs com `empresa_id == cellcity-master`. Coleções vazias são legitimamente vazias (count total = 0), não filtro falhando.

### [4/6] Cloud Functions
**16/16 ACTIVE** (todas com updateTime de 07-18 ~00:39Z, incluindo `saasOnboardingCriarEmpresa`). Rules já certificadas byte-idênticas na verificação da manhã.

## [5–6/6] RESULTADO

- ✅ FIRESTORE RULES (byte-idêntico à v3.1.0)
- ✅ FIRESTORE INDEXES (23/23 READY)
- ✅ CLOUD FUNCTIONS (16/16 ACTIVE)
- ✅ SMOKE TEST (9/9 consultas)

### 🎉 RELEASE v3.1.0 CERTIFICADA — incidente dos índices ENCERRADO

## Ressalvas e pendências

- **R1 — Divergência de schema em `clientes`**: os documentos usam campos em inglês (`name`, `phone`, `phoneDigits`), mas o índice do arquivo e o `INDICES_MULTIEMPRESA.md` assumem `nome`. Qualquer consulta futura `orderBy('nome')` (ex.: `listarPaginado`) retornará **vazio** — o orderBy exclui docs sem o campo. Nenhuma tela atual é afetada (listagem ordena client-side). Decidir: alinhar índice/documentação para `name` ou migrar os dados (migração = gatilho que exige autorização).
- **P1 — `FIREBASE_SA_KEY`**: segue não configurado; o CI continua incapaz de deployar Firebase. Os deploys desta release saíram por fora do pipeline.
- **P2 — Validar um deploy completo via CI/CD** após configurar o secret (workflow_dispatch na main).
- **P3 — Fix de CI da main** (Fase 3.4 §1b): validado, aguardando autorização para reaplicar.
