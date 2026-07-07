# sql/ — Preparação para migração SQL (planejamento, 2026-07-07)

> **Nenhum banco SQL foi instalado. Nenhum dado foi migrado. O Firestore continua sendo o banco oficial do projeto.** Este diretório é só modelagem e documentação — ver `sql/00_visao_geral.md` §1 para o porquê.

## Navegação

| Arquivo | Conteúdo |
|---|---|
| [`00_visao_geral.md`](00_visao_geral.md) | Motivação, banco escolhido (PostgreSQL) e justificativa, decisões de modelagem (arrays vs. JSONB), o que o modelo não assume |
| [`01_der_mestre.md`](01_der_mestre.md) | Diagrama entidade-relacionamento (Mermaid) das entidades centrais e relações entre domínios |
| [`02_migracao_estrategia.md`](02_migracao_estrategia.md) | Estratégia completa de migração: ondas, ordem, rollback, coexistência, sincronização, testes, homologação |
| [`03_repository_adapter.md`](03_repository_adapter.md) | Como cada `CRM/repositories/*.repository.js` se conectaria ao SQL no futuro, sem alterar páginas consumidoras |
| [`schema/01_core_os_clientes_crm.sql`](schema/01_core_os_clientes_crm.sql) | OS, Clientes, CRM Comercial (Leads, Chips, Contas) |
| [`schema/02_conhecimento_organizacao.sql`](schema/02_conhecimento_organizacao.sql) | Central de Comandos/Informações, Central de Organização |
| [`schema/03_financeiro_caixa.sql`](schema/03_financeiro_caixa.sql) | Caixa, Financeiro (a pagar/receber/fixas) |
| [`schema/04_estoque_catalogo_fornecedor.sql`](schema/04_estoque_catalogo_fornecedor.sql) | Estoque, Catálogo de Produtos, Fornecedor |
| [`schema/05_posvenda_agenda_portal.sql`](schema/05_posvenda_agenda_portal.sql) | Pós-Venda, Agenda/Ação da Semana/Minha Semana, Portal do Cliente |
| [`schema/06_usuarios_empresas_alertas.sql`](schema/06_usuarios_empresas_alertas.sql) | Usuários/Permissões, Empresas (Tenant), Alertas |
| [`schema/07_diario_autoatendimento_importacao_sync.sql`](schema/07_diario_autoatendimento_importacao_sync.sql) | Diário, Pré-OS, Importação de Vendas, Sincronização/Backup (Drive) |
| [`schema/08_config_auditoria.sql`](schema/08_config_auditoria.sql) | Configurações do Sistema, Auditoria e Logs |

## Como aplicar os schemas (só para teste local em ambiente descartável — nunca em produção)

```bash
# ordem numérica simples — cada arquivo só referencia (via REFERENCES
# inline ou ALTER TABLE) tabelas de arquivos de número igual ou menor.
psql -f schema/01_core_os_clientes_crm.sql
psql -f schema/02_conhecimento_organizacao.sql
psql -f schema/03_financeiro_caixa.sql
psql -f schema/04_estoque_catalogo_fornecedor.sql
psql -f schema/05_posvenda_agenda_portal.sql
psql -f schema/06_usuarios_empresas_alertas.sql
psql -f schema/07_diario_autoatendimento_importacao_sync.sql
psql -f schema/08_config_auditoria.sql
```

## Fonte de verdade

Todo campo, tipo e relacionamento documentado aqui foi extraído de [`COLECOES_FIRESTORE.md`](../COLECOES_FIRESTORE.md) (raiz do repositório), revisado e corrigido em 2026-07-07. Qualquer divergência futura entre o Firestore real e este modelo deve ser resolvida atualizando primeiro o catálogo, depois o schema — nunca o inverso.
