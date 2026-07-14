# Índices Compostos Firestore — Multiempresa (PS-2)

## Estrutura Padrão

Toda coleção com escopo por empresa precisa de índices compostos
para consultas que combinem `empresa_id` + outros campos.

### Índice Básico (TODAS as coleções tenant)
```
Coleção: *
Campos:
  1. empresa_id  — ASC/DESC
  2. createdAt   — DESC
```

### Índices Específicos por Coleção

| Coleção | Campos | Uso |
|---------|--------|-----|
| `os` | empresa_id ASC, status ASC, createdAt DESC | Filtrar OS por status |
| `os` | empresa_id ASC, phoneDigits ASC | Buscar OS por telefone |
| `os` | empresa_id ASC, createdAt DESC | Listar OS recentes |
| `caixa_lancamentos` | empresa_id ASC, tipo ASC, createdAt DESC | Filtrar receitas/despesas |
| `caixa_lancamentos` | empresa_id ASC, data ASC | Fechamento diário |
| `estoque_produtos` | empresa_id ASC, nome ASC | Catálogo da empresa |
| `estoque_produtos` | empresa_id ASC, quantidade ASC | Estoque baixo |
| `financeiro_pagar` | empresa_id ASC, status ASC, vencimento ASC | Contas a pagar |
| `financeiro_receber` | empresa_id ASC, status ASC, vencimento ASC | Contas a receber |
| `clientes` | empresa_id ASC, nome ASC | Busca por nome |
| `clientes` | empresa_id ASC, phoneDigits ASC | Busca por telefone |
| `agendamentos` | empresa_id ASC, data ASC, status ASC | Agenda por data |
| `agendamentos` | empresa_id ASC, telefoneDigits ASC | Agenda do cliente |
| `crm_leads` | empresa_id ASC, status ASC, createdAt DESC | Leads por status |
| `mensagens_portal` | empresa_id ASC, lida ASC, createdAt DESC | Mensagens não lidas |
| `portal_eventos` | empresa_id ASC, tipo ASC, createdAt DESC | Tracking por tipo |
| `avaliacoes` | empresa_id ASC, createdAt DESC | Avaliações recentes |
| `comandos` | empresa_id ASC, categoria ASC | Comandos por categoria |
| `informacoes` | empresa_id ASC, categoria ASC | Informações por categoria |
| `diario_registros` | empresa_id ASC, data DESC | Registros do diário |
| `posvenda_contatos` | empresa_id ASC, dataContato DESC | Contatos recentes |
| `fornecedor_compras` | empresa_id ASC, data DESC | Compras recentes |

## Formato firestore.indexes.json

```json
{
  "indexes": [
    {"collectionGroup": "os", "queryScope": "COLLECTION", "fields": [
      {"fieldPath": "empresa_id", "order": "ASCENDING"},
      {"fieldPath": "createdAt", "order": "DESCENDING"}
    ]},
    {"collectionGroup": "os", "queryScope": "COLLECTION", "fields": [
      {"fieldPath": "empresa_id", "order": "ASCENDING"},
      {"fieldPath": "status", "order": "ASCENDING"},
      {"fieldPath": "createdAt", "order": "DESCENDING"}
    ]},
    {"collectionGroup": "os", "queryScope": "COLLECTION", "fields": [
      {"fieldPath": "empresa_id", "order": "ASCENDING"},
      {"fieldPath": "phoneDigits", "order": "ASCENDING"}
    ]},
    {"collectionGroup": "caixa_lancamentos", "queryScope": "COLLECTION", "fields": [
      {"fieldPath": "empresa_id", "order": "ASCENDING"},
      {"fieldPath": "createdAt", "order": "DESCENDING"}
    ]},
    {"collectionGroup": "clientes", "queryScope": "COLLECTION", "fields": [
      {"fieldPath": "empresa_id", "order": "ASCENDING"},
      {"fieldPath": "nome", "order": "ASCENDING"}
    ]},
    {"collectionGroup": "clientes", "queryScope": "COLLECTION", "fields": [
      {"fieldPath": "empresa_id", "order": "ASCENDING"},
      {"fieldPath": "phoneDigits", "order": "ASCENDING"}
    ]},
    {"collectionGroup": "estoque_produtos", "queryScope": "COLLECTION", "fields": [
      {"fieldPath": "empresa_id", "order": "ASCENDING"},
      {"fieldPath": "nome", "order": "ASCENDING"}
    ]},
    {"collectionGroup": "financeiro_pagar", "queryScope": "COLLECTION", "fields": [
      {"fieldPath": "empresa_id", "order": "ASCENDING"},
      {"fieldPath": "status", "order": "ASCENDING"},
      {"fieldPath": "vencimento", "order": "ASCENDING"}
    ]},
    {"collectionGroup": "financeiro_receber", "queryScope": "COLLECTION", "fields": [
      {"fieldPath": "empresa_id", "order": "ASCENDING"},
      {"fieldPath": "status", "order": "ASCENDING"},
      {"fieldPath": "vencimento", "order": "ASCENDING"}
    ]},
    {"collectionGroup": "agendamentos", "queryScope": "COLLECTION", "fields": [
      {"fieldPath": "empresa_id", "order": "ASCENDING"},
      {"fieldPath": "data", "order": "ASCENDING"}
    ]},
    {"collectionGroup": "mensagens_portal", "queryScope": "COLLECTION", "fields": [
      {"fieldPath": "empresa_id", "order": "ASCENDING"},
      {"fieldPath": "lida", "order": "ASCENDING"},
      {"fieldPath": "createdAt", "order": "DESCENDING"}
    ]}
  ]
}
```

## Observações

1. Índices com `empresa_id ASC, createdAt DESC` são os mais comuns e
   devem ser criados primeiro — cobrem ~80% das queries padrão.

2. Índices com 3 campos (ex.: `empresa_id + status + createdAt`)
   são necessários quando a query usa where + orderBy em campos
   diferentes. O Firestore exige índice composto para isso.

3. Coleções do Portal do Cliente já têm índices existentes
   (telefoneDigits + createdAt). Adicionar empresa_id a esses
   índices requer re-criação.

4. Ativar índices no Firebase Console antes de migrar dados.
   A build de índices pode levar minutos em coleções grandes.
