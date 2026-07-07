# Auditoria Final e Aceite Técnico — Preparação para SQL (2026-07-07)

> Auditoria de encerramento da fase de Preparação para SQL (`sql/00-03_*.md`, `sql/schema/*.sql`, entregue mais cedo nesta mesma sessão). Objetivo: validar que todos os artefatos são consistentes entre si, completos, e emitir o parecer técnico definitivo. **Nenhuma migração foi executada. Nenhum banco SQL foi instalado. Nenhum código funcional do CRM foi alterado.**

---

## 1. Inconsistências encontradas e corrigidas

Todas as inconsistências abaixo foram **corrigidas nesta mesma auditoria**, antes do commit — nenhuma ficou pendente sem justificativa.

| # | Inconsistência | Onde | Correção aplicada |
|---|---|---|---|
| 1 | **7 das 58 coleções da Camada Repository sem tabela SQL** — `acoes_semana`, `historico_diario`, `historico_semanal`, `historico_mensal`, `resumo_live`, `posvenda_rastreamento`, `produtos` têm `createRepository()` (sem consumidor de código) mas não tinham tabela correspondente | Repository Layer → SQL | Adicionadas 7 tabelas mínimas (só PK, sem campos — não há dado real a modelar, zero consumidor). Ver §2 abaixo para o porquê de serem mínimas, não completas. |
| 2 | **3 relacionamentos 1:1 declarados no DER sem `UNIQUE` na FK correspondente** (`os.crm_lead_id`, `os.pre_os_id`, `os.solicitacao_id`) — sem a `UNIQUE`, o schema só garantiria N:1, não o 1:1 que o próprio diagrama já afirmava | `sql/01_der_mestre.md` vs. `sql/schema/01,05,07_*.sql` | `ALTER TABLE ... ADD CONSTRAINT uq_... UNIQUE (...)` adicionado nas 3 colunas + `crm_leads.pre_os_id` (mesma classe de problema) |
| 3 | **Migração `informacoes ↔ comandos` (v1) com o mesmo problema** — `comandos.migrado_de` e `informacoes.migracao_destino_id` sem `UNIQUE`, apesar do DER já declarar `|o--o|` (1:1) | `sql/schema/02_conhecimento_organizacao.sql` | `UNIQUE` adicionado nas duas colunas |
| 4 | **Relacionamento `usuarios↔empresas` duplicado no DER** — declarado duas vezes, uma vez em cada direção (`USUARIOS }o--\|\| EMPRESAS` e `EMPRESAS \|\|--o{ USUARIOS`), renderizaria como duas arestas sobrepostas no diagrama | `sql/01_der_mestre.md` | Removida a duplicata (mantida a versão agrupada com as demais relações de `EMPRESAS`) |
| 5 | **Ordem de carga dos arquivos `.sql` incorreta** (domínio 06 antes do 05, quando na verdade 05 precisa vir antes por causa de um `ALTER TABLE` em 06 que depende de uma tabela criada em 05) | `sql/README.md` + comentários em `05_posvenda_agenda_portal.sql` | Corrigido para ordem puramente numérica (01→08) — **já corrigido na entrega original, antes desta auditoria**, mantido aqui só como registro |
| 6 | **Contagem de tabelas desatualizada em 6 documentos** após a correção do item 1 (75 → 82) | `sql/00_visao_geral.md`, `sql/01_der_mestre.md`, `MASTER_ROADMAP.md`, `PROXIMA_ETAPA.md`, `CRM/TECHDOC.md` (linha nova, entradas históricas preservadas como registro do estado na época) | Todas as menções de contagem corrigidas para 82 tabelas / cobertura 58/58 repositories, exceto entradas de histórico (`HISTORICO_PROJETO.md`, tabela de "Histórico de Entregas" do TECHDOC), que são registro **append-only** do que foi entregue naquele commit específico — não reescritas, só complementadas com uma entrada nova |

## 2. Por que as 7 tabelas legadas são mínimas, não completas

Diferente das 54 coleções ativas (campos extraídos com evidência real de código consumidor), as 7 coleções legadas **não têm nenhum consumidor de código hoje** — não há linha de JS para ler e confirmar campos reais. Modelar campos "por suposição" seria inventar schema sem evidência, o oposto do método usado no resto desta preparação (toda a modelagem ativa foi extraída de `COLECOES_FIRESTORE.md`, que por sua vez foi extraído de código real). A tabela mínima (só PK) fecha a paridade 1:1 pedida — cobre "existe uma tabela para esta coleção" sem fabricar dado que não pode ser verificado.

## 3. Conferência cruzada — resultado por item

### 3.1 DER (entidades, relacionamentos, cardinalidades, consistência lógica)
- **Entidades:** todas as entidades do diagrama (`sql/01_der_mestre.md`) correspondem a tabelas reais criadas em `sql/schema/*.sql` — conferido nome a nome.
- **Relacionamentos:** 62 no total, todos com alvo de `REFERENCES` existente (checagem automatizada, resultado vazio = sem FK órfã).
- **Cardinalidades:** 3 inconsistências reais encontradas e corrigidas (itens 2 e 3 da tabela acima) — a notação do diagrama (`\|\|--o\|`) já estava certa, era a `UNIQUE` do DDL que faltava para o schema *aplicar* o que o diagrama *declarava*.
- **Consistência lógica:** 1 duplicata encontrada e removida (item 4).

### 3.2 Arquivos DDL
- `CREATE TABLE`: 82, todas com `PRIMARY KEY` (checagem automatizada por tabela, 0 exceções).
- `FK`: 62, 100% resolvidas (nenhum alvo inexistente).
- `UNIQUE`: revisadas e corrigidas onde a cardinalidade exigia (§3.1).
- `CHECK`: 31 tabelas com enum fechado — amostragem manual confirmou que os valores permitidos batem com os documentados em `COLECOES_FIRESTORE.md` (ex.: `os.status`, `crm_leads.status`).
- Índices: presentes nas colunas de filtro/ordenação mais óbvias (datas, status, FKs de alto volume) — não é uma lista exaustiva de todo índice que uma implementação real precisaria, é a base já identificável nesta fase de planejamento.
- Ordem de criação/dependências: reconferida nesta auditoria simulando manualmente a resolução de cada `REFERENCES`/`ALTER TABLE` arquivo a arquivo — ordem puramente numérica (01→08) confirmada correta, sem dependência circular.

### 3.3 Repository Layer → SQL
- 58/58 coleções da Camada Repository (`CRM/repositories/*.repository.js`) têm tabela SQL correspondente — **100%**, após a correção do item 1.
- 2 correspondências não são 1:1 por nome, mas são intencionais e documentadas: `central_organizacao` → `central_organizacao_secoes` (+ itens), `config` → 5 tabelas tipadas + 1 fallback genérico.

### 3.4 `COLECOES_FIRESTORE.md` (cobertura, nomes, campos, relacionamentos)
- 54 coleções ativas — todas modeladas, nomes conferidos.
- Campos — amostragem em `os` (44 campos) confirmada campo a campo contra a tabela SQL (incluindo os 5 arrays, todos como tabela-filha correta).
- Relacionamentos — os relacionamentos descritos em `COLECOES_FIRESTORE.md` §22 ("Resumo de Relacionamentos entre Coleções") batem com as FKs do modelo SQL, incluindo a migração `comandos↔informacoes` e as referências de `usuarios` (uid) às 5 tabelas satélite.

### 3.5 Estratégia de migração
- Ordem das 7 ondas: coerente com o princípio "um módulo por vez" já em vigor no projeto; núcleo (OS/Clientes) e identidade (Usuários/Auth) corretamente posicionados por último.
- Rollback: por onda, nunca do projeto inteiro — coerente com a coexistência descrita.
- Sincronização: Cloud Function de gatilho, mesmo padrão já usado em produção (`functions/index.js`) — não é uma tecnologia nova para o projeto.
- Adapter: `createSqlRepository()` com a mesma assinatura de `createRepository()` — coerente com a Camada Repository já existente; gap de `onChange`/tempo real corretamente identificado como a maior incógnita, não minimizado.
- Riscos: registrados por onda e por decisão (ex.: `LISTEN/NOTIFY` não testado).
- **Ajuste feito nesta auditoria:** nota adicionada explicitando que as 7 tabelas legadas ficam fora de todas as ondas (nada a migrar).

### 3.6 Documentação (coerência entre TECHDOC, MASTER_ROADMAP, HISTORICO_PROJETO, PROXIMA_ETAPA, sql/README.md e demais docs SQL)
- Todas as contagens (82 tabelas, 62 relacionamentos, 58/58 repositories) agora consistentes em todos os documentos vivos (`MASTER_ROADMAP.md`, `PROXIMA_ETAPA.md`, `CRM/TECHDOC.md` §23, `sql/00_visao_geral.md`, `sql/01_der_mestre.md`).
- Documentos de histórico (`HISTORICO_PROJETO.md`, tabela "Histórico de Entregas" do TECHDOC) preservados como registro da época, com uma entrada nova documentando a correção — sem reescrever o passado, mesma convenção já em vigor no projeto.
- Referências cruzadas entre os arquivos de `sql/` conferidas (todas resolvem para um arquivo existente).

## 4. Riscos remanescentes

- Nenhum teste de execução real do DDL contra um Postgres de verdade (fora do escopo autorizado — exigiria instalar um banco).
- `LISTEN/NOTIFY` (estratégia de tempo real) permanece não validado na prática — maior incógnita técnica do plano, já registrada.
- As 7 tabelas legadas mínimas não têm schema de campos real — se algum dia ganharem consumidor, precisam de modelagem própria antes de qualquer uso.
- Índices do DDL cobrem os casos óbvios identificados nesta fase de planejamento, não uma análise de performance de query real (não há banco rodando para medir).

## 5. Pendências restantes

Nenhuma pendência **bloqueante** para o aceite desta fase. Pendências **para uma eventual migração futura** (já listadas em `CRM/TECHDOC.md` §23.4, sem mudança nesta auditoria): teste real do DDL, validação de `LISTEN/NOTIFY`, revisão de tipos se o banco escolhido mudar.

## 6. Parecer técnico final

**A preparação para SQL está tecnicamente concluída e pronta para iniciar uma futura implementação, permanecendo a migração real fora do escopo desta fase.**

**Classificação: ✅ APROVADA.**

Justificativa: todas as inconsistências encontradas nesta auditoria (7 no total — 1 gap de cobertura, 4 problemas de cardinalidade/duplicata no DER, 1 erro de ordem de carga já corrigido antes desta auditoria, 1 falta de sincronização de contagem entre documentos) foram corrigidas nesta mesma sessão, antes de qualquer commit. Nenhuma inconsistência estrutural (dado real perdido, FK órfã, dependência circular, contradição irreconciliável entre documentos) foi encontrada em nenhum momento — todas eram desvios de precisão/consistência corrigíveis dentro do próprio material, não falhas de arquitetura.

---

## Confirmação

Nenhuma migração foi executada. Nenhum banco SQL foi instalado. Nenhum ORM foi adicionado. Nenhuma alteração em produção, Firestore Rules, Cloud Functions ou Repository Layer funcional ocorreu para produzir esta auditoria — só correções em arquivos de planejamento/documentação (`sql/*.md`, `sql/schema/*.sql`) e nos 4 documentos de continuidade do projeto.
