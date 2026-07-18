# Índices Compostos Firestore — Multiempresa

> **Revisão 2026-07-18 (Fase 3.9):** este documento passou a refletir os
> índices **realmente deployados** em produção (`cellcity-crm`), verificados
> via API nesta data. A versão anterior era aspiracional (PS-2) e listava
> índices que nunca existiram. A fonte da verdade declarativa é
> `CRM/firestore.indexes.json`; este arquivo é o espelho documentado dela.

## Estado real em produção (23 índices, todos READY em 2026-07-18)

### 19 índices declarados em `CRM/firestore.indexes.json`

| Coleção | Campos | Uso real |
|---------|--------|----------|
| `os` | empresa_id ASC, createdAt DESC | Pós-venda (posvenda.js) |
| `pre_os` | empresa_id ASC, criadoEm DESC | Autoatendimento (list + listener) |
| `clientes` | empresa_id ASC, **nome** ASC | ⚠️ **R1**: dados usam `name` (EN) — índice aponta p/ campo inexistente; nenhuma tela consulta assim hoje. Decisão pendente (Fase 3.9): trocar p/ `name` ou migrar dados |
| `estoque_produtos` | empresa_id ASC, nome ASC | listagem ordenada |
| `caixa_lancamentos` | empresa_id ASC, data DESC (+__name__ DESC) | Caixa (desde 2026-06-28) |
| `catalogo_produtos` | empresa_id ASC, ordem ASC | Catálogo admin |
| `comandos` | empresa_id ASC, criadoEm DESC | Central de Comandos |
| `informacoes` | empresa_id ASC, criadoEm DESC | Central de Informações |
| `chips_cadastros` | empresa_id ASC, criadoEm DESC | Chips (listener) |
| `avaliacoes` | empresa_id ASC, createdAt DESC | Central de Alertas |
| `crm_leads` | empresa_id ASC, criadoEm DESC | CRM Comercial |
| `mensagens_portal` | empresa_id ASC, createdAt DESC | Portal/mensagens |
| `mensagens_portal` | telefone ASC, createdAt DESC | CFs do Portal (por telefone) |
| `solicitacoes_diagnostico` | empresa_id ASC, createdAt DESC | Portal/diagnóstico |
| `agendamentos` | empresa_id ASC, createdAt DESC | Portal/agendamentos |
| `auditoria_usuarios_permissoes` | empresa_id ASC, timestamp DESC | Auditoria RBAC |
| `usuarios` | empresa_id ASC, nome_exibicao ASC | Gestão de usuários |
| `chat_mensagens` | participantes CONTAINS, empresa_id ASC, criadoEm DESC | Chat interno |
| `lembretes_pagamento` | empresa_id ASC, createdAt ASC | Financeiro |

### 4 índices legados pré-v3.1.0 (existem em prod, fora do arquivo — inofensivos)

| Coleção | Campos |
|---------|--------|
| `portal_eventos` | tipo ASC, createdAt ASC |
| `portal_eventos` | tipo ASC, createdAt DESC |
| `avaliacoes` | telefone ASC, createdAt DESC |
| `catalogo_produtos` | ativo ASC, ordem ASC |

## Regras de manutenção

1. **Toda consulta nova** de repositório tenant que combine o filtro
   automático `empresa_id` com `orderBy` **exige** índice composto —
   adicionar ao `CRM/firestore.indexes.json` ANTES do merge (lição do
   incidente de índices de 2026-07-18: 7 telas quebraram em produção
   por índices ausentes).
2. O campo do `orderBy` deve **existir nos documentos** — o Firestore
   exclui docs sem o campo (caso R1/clientes). Conferir o schema real
   da coleção, não a documentação.
3. Deploy: `firebase deploy --only firestore:indexes --project cellcity-crm`
   (ou workflow "Deploy Firebase" na main, quando o CI tiver credencial).
   Criação é assíncrona (estado CREATING → READY, minutos por índice).
4. Histórico aspiracional (índices por status/vencimento/phoneDigits etc.)
   foi movido para o planejamento — criar somente quando a consulta
   correspondente existir no código, junto com a entrada no arquivo.
