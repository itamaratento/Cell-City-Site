# Como cada Repository se conectaria ao SQL (planejamento, não implementado)

> Nenhum arquivo em `CRM/repositories/` foi alterado para produzir este documento. Descreve a forma proposta de adaptação, para quando (e se) uma migração real for autorizada.

## 1. Por que a Camada Repository já facilita isso

`CRM/repositories/base.repository.js` (`CRM/TECHDOC.md` §22.5) já expõe uma interface fixa e pequena — `getById`, `list`, `create`, `set`, `update`, `remove`, `onChange`, `newId`, `onDocChange` — consumida por 23 módulos migrados (piloto Chips + Fase 0/1). Nenhum desses módulos chama `collection()`/`doc()`/`getDocs()` do SDK do Firestore diretamente. Isso significa que uma implementação alternativa dessa mesma interface, back-ended por SQL, pode ser trocada **sem tocar nenhuma página/módulo consumidor** — exatamente o objetivo original da camada (`CRM/TECHDOC.md` §22.1).

## 2. Proposta: `createSqlRepository()`, mesma assinatura de `createRepository()`

```js
// CRM/repositories/base.repository.sql.js (proposto — não criado nesta entrega)
// Mesma interface de base.repository.js, back-end Postgres em vez de Firestore.
export function createSqlRepository(tableName, options = {}) {
  return {
    tableName,
    async getById(id) { /* SELECT * FROM <tableName> WHERE id = $1 */ },
    async list(opts) { /* SELECT ... WHERE/ORDER BY/LIMIT conforme opts, mesmo formato de opções */ },
    async create(data) { /* INSERT ... RETURNING id */ },
    async set(id, data, options) { /* INSERT ... ON CONFLICT (id) DO UPDATE (upsert = comportamento de setDoc) */ },
    async update(id, data) { /* UPDATE ... WHERE id = $1 */ },
    async remove(id) { /* DELETE ... WHERE id = $1 */ },
    onChange(callback, opts) { /* LISTEN/NOTIFY do Postgres, ou polling curto — ver §4 */ },
    newId() { /* gen_random_uuid() do lado do client, ou sequência — ver nota de PK abaixo */ },
    onDocChange(id, callback, onError) { /* LISTEN/NOTIFY filtrado por id */ }
  };
}
```

Cada `*.repository.js` existente ganharia (futuramente) uma variante que escolhe a implementação por configuração:

```js
// CRM/repositories/chips.repository.js (forma proposta, não aplicada)
import { createRepository } from './base.repository.js';
import { createSqlRepository } from './base.repository.sql.js';
import { backendAtivo } from './backend-config.js'; // 'firestore' | 'sql', por coleção

export const ChipsRepository = backendAtivo('chips_cadastros') === 'sql'
  ? createSqlRepository('chips_cadastros')
  : createRepository('chips_cadastros');
```

Isso viabiliza o "corte de leitura" da estratégia de migração (`sql/02_migracao_estrategia.md` §3, passo 7) como uma troca de configuração por coleção, sem deploy de código nas páginas consumidoras.

## 3. Diferenças que a interface precisa absorver (mesma "cara", semântica ligeiramente diferente)

| Método | Firestore hoje | SQL amanhã | Ajuste necessário |
|---|---|---|---|
| `newId()` | `doc(collection(db,'x')).id` — ID sem escrever | `gen_random_uuid()` no client, ou reservar via sequência | Nenhuma mudança de assinatura; `UUID` é só uma string do ponto de vista de quem chama |
| `onChange`/`onDocChange` | `onSnapshot`, push em tempo real nativo | Postgres não empurra mudanças por padrão | Duas opções: (a) `LISTEN/NOTIFY` + trigger em cada tabela migrada (mais próximo do comportamento atual, exige 1 trigger por tabela); (b) polling curto (mais simples, latência maior). Recomendação: (a) para tabelas hoje consumidas via `onChange` real (poucas — a maioria dos 23 módulos migrados usa `list()`/`getById()`, não listener) |
| `set(id, data, {merge:true})` | merge parcial nativo | `INSERT ... ON CONFLICT (id) DO UPDATE SET <campos>` (merge parcial via `EXCLUDED.<campo>` só nos campos informados) | Exige que o adapter monte o `ON CONFLICT` dinamicamente a partir das chaves de `data` — mecânico, testável |
| `list({where, orderByField, limitTo})` | `query()`+`where()`+`orderBy()`+`limit()` | `WHERE`/`ORDER BY`/`LIMIT` SQL equivalentes | Tradução 1:1 direta para os operadores já suportados (`==`, `!=`, `>`, `>=`, `<`, `<=`) — `array-contains` do Firestore não tem equivalente direto (nenhum uso real encontrado nos 23 módulos migrados, ver auditoria da Fase 1) |
| Regra de negócio hoje em Firestore Rules (ex.: `auditoria_usuarios_permissoes` — `allow update, delete: if false`) | Enforced pelas Rules, fora do Repository | Vira `TRIGGER` de banco (`BEFORE UPDATE OR DELETE ... RAISE EXCEPTION`) — ver nota em `sql/schema/08_config_auditoria.sql` | Regra de imutabilidade não pode ficar só "de boa vontade" na aplicação; precisa estar no schema, mesmo espírito de "nunca confiar só no client" já em vigor no projeto (mesma lição do BL-006) |

## 4. `onChange`/tempo real — o maior gap de paridade

Esta é a única característica do Firestore sem equivalente trivial em Postgres. Módulos que dependem de atualização em tempo real de múltiplos clientes simultâneos (ex.: Central de Alertas, `informacoes.js`/`comandos.js` com `onChange` de categorias) precisariam de:
- `LISTEN/NOTIFY` nativo do Postgres (mais simples, funciona bem para poucos clientes simultâneos — perfil atual do projeto, uma equipe interna pequena), **ou**
- Um serviço intermediário (ex.: um pequeno servidor WebSocket próprio, ou um produto gerenciado tipo Supabase Realtime se o Postgres for hospedado lá em vez de Cloud SQL puro).

**Recomendação para quando a migração for autorizada:** validar `LISTEN/NOTIFY` no piloto (Onda 1 da estratégia de migração) antes de assumir que resolve para todos os casos — é a única peça desta modelagem sem precedente já testado no projeto.

## 5. O que não muda em nenhum cenário

- `CRM/scripts/kernel.js` (importa o SDK do Firestore direto do CDN para autenticação) fica **fora** de qualquer adaptação — Autenticação continua no Firebase Auth independentemente do banco de dados escolhido para as coleções de negócio. Nenhuma migração de banco implica migrar autenticação.
- Cloud Functions (`functions/index.js`, Admin SDK) — mesma observação: hoje fora do escopo da Camada Repository (`CRM/TECHDOC.md` §22.8), continuariam fora até uma decisão própria e separada.
