# Estratégia de Migração Firestore → SQL (planejamento, não executada)

> Este documento descreve **como a migração seria feita, se e quando autorizada** — nenhum passo abaixo foi executado. Segue o mesmo princípio de todas as fases já homologadas neste projeto: um módulo/coleção por vez, backup antes, homologação depois, nunca "corrigir em produção" (`CRM/TECHDOC.md`, `MASTER_ROADMAP.md` — "Constantes que atravessam todas as fases").

---

## 1. Princípio geral: coexistência, nunca corte seco

Em nenhum momento da migração o Firestore deixa de ser a fonte de verdade sem que o SQL já tenha sido validado como espelho fiel por um período de observação. A migração é dividida em **ondas por domínio** (mesma divisão de `sql/schema/*.sql`), nunca todas as 54 coleções de uma vez — o mesmo princípio de "um módulo por vez" já em vigor no projeto (`feedback-metodologia-um-modulo-por-vez`).

## 2. Ordem das ondas (por risco crescente, não por domínio)

| Onda | Coleções | Por que nessa posição |
|---|---|---|
| 1 — Piloto | `categorias_caixa`, `categorias_comandos`, `categorias_informacoes`, `categorias_produtos`, `financeiro_categorias` | Tabelas-catálogo puras, sem FK de entrada, sem regra de negócio complexa, zero risco de corromper um fluxo real se algo sair errado. Serve para validar a tubulação (dump → transformação → carga → verificação) antes de arriscar dado importante. |
| 2 — Domínios isolados de baixo tráfego | Diário (§07), Sincronização/Backup (§07), Configurações (§08), Auditoria (§08) | Poucas escritas por dia, sem cliente externo dependendo em tempo real (Portal não lê nenhuma dessas). |
| 3 — Domínios operacionais de médio risco | Estoque/Catálogo/Fornecedor (§04), Central de Comandos/Informações/Organização (§02), Agenda/Ação da Semana (parte de §05) | Uso diário pela equipe, mas sem exposição pública nem dependência financeira direta. |
| 4 — Domínios financeiros | Caixa/Financeiro (§03), Pós-venda (parte de §05) | Dado sensível (dinheiro), mas sem exposição pública — trocar de banco aqui exige o dobro do rigor de teste da Onda 3. |
| 5 — Núcleo do negócio | `os`, `clientes`, `crm_leads`, `pre_os` (§01) | Maior volume, maior acoplamento (quase todo domínio tem FK para `os`/`clientes`) — só migra depois que todas as ondas anteriores provaram o processo. |
| 6 — Identidade e acesso | `usuarios`, `perfis_operacionais`, `empresas`, tabelas satélite de usuário (§06) | Deliberadamente por último — é o componente crítico por definição (toca Autenticação/RBAC); qualquer migração aqui exige a mesma autorização explícita e homologação completa já exigidas hoje para qualquer mudança em Login/Auth (`CLAUDE.md` §1). |
| 7 — Portal do Cliente (`mensagens_portal`, `avaliacoes`, `solicitacoes_diagnostico`, `portal_eventos`, `agendamentos`) | Por último entre os domínios operacionais — é a única superfície com cliente externo em tempo real (sessão anônima); qualquer instabilidade aqui é visível ao cliente final, não só à equipe interna. |

## 3. Padrão de execução por onda (repetido a cada uma)

1. **Backup formal** do Firestore (coleções da onda) — reaproveita o sistema oficial de backup já existente no projeto (`CRM/TECHDOC.md` §10).
2. **Extração** via `_runtime_audit/list-prod-collections.mjs`-like script (Admin SDK, leitura em lote, nunca via client) para JSON.
3. **Transformação** (script Node dedicado, `sql/migracao/transformar-<dominio>.mjs` — a criar quando a migração for autorizada, não existe hoje) aplicando as decisões de `sql/schema/*.sql`: achatamento de objeto único, explosão de array em tabela-filha, geração de UUID para entidades sem ID legível.
4. **Carga** no Postgres via `COPY`/`INSERT` em transação única por onda (rollback automático se qualquer linha falhar constraint).
5. **Verificação de paridade**: contagem de linhas por tabela = contagem de documentos por coleção; checksum de uma amostra aleatória de registros (documento Firestore vs. linha(s) SQL reconstruída).
6. **Período de sombra (shadow read)**: a aplicação continua lendo/escrevendo só no Firestore; um job assíncrono replica cada escrita para o SQL (ver §5, Sincronização) por um período mínimo de 7 dias, sem nenhum consumo real do SQL ainda.
7. **Corte de leitura**: o Repository da onda passa a **ler** do SQL (ver `sql/03_repository_adapter.md`), mas ainda **escreve** nos dois (Firestore continua como fallback de escrita).
8. **Homologação completa** da onda migrada — mesmo checklist já em uso no projeto (zero regressão nos módulos obrigatórios de teste, `CLAUDE.md` §5), mais os testes específicos de paridade de dado.
9. **Corte de escrita**: só depois de N dias sem incidente no corte de leitura, a escrita também migra para o SQL como principal (Firestore passa a ser só espelho, depois é desligado para aquela coleção).
10. **Encerramento da onda**: Firestore Rules da coleção migrada podem ser removidas (com a mesma autorização explícita já exigida para qualquer alteração de Rules), documentação atualizada.

## 4. Rollback

- **Rollback é por onda, nunca do projeto inteiro** — cada onda só avança para o próximo passo depois que o anterior está estável; reverter significa voltar o Repository daquela onda para o modo "só Firestore" (é uma troca de configuração/flag, não uma operação destrutiva — ver `sql/03_repository_adapter.md` §3).
- Enquanto a onda estiver no passo 6-8 (leitura dupla ou leitura só-SQL com escrita dupla), o Firestore nunca deixa de receber a escrita — o rollback é instantâneo e sem perda de dado por construção.
- Só depois do passo 10 (Firestore desligado para aquela coleção) um rollback exigiria restaurar do backup formal do passo 1 — por isso o passo 10 só acontece após o maior período de observação de todo o processo.

## 5. Sincronização (coexistência ativa)

Abordagem recomendada: **Cloud Function de gatilho** (`onWrite`/`onCreate`/`onUpdate`/`onDelete` do Firestore, já é o mesmo mecanismo de Admin SDK que o projeto já usa em `functions/index.js`) escrevendo no Postgres a cada mudança da coleção em migração — um "outbox" natural, sem precisar de ferramenta de CDC externa (Debezium etc.) dado o volume atual do projeto. Reavaliar CDC dedicado só se o volume de escrita crescer muito além do atual.

## 6. Testes

- Reaproveita o padrão já validado no projeto (`_runtime_audit/`, `tests/firestore-rules/`, `tests/functions/`): suíte de paridade Firestore↔SQL por onda, rodada a cada passo do §3.
- Testes de CHECK/FK do schema (garantir que o schema em si rejeita dado inválido) — trivial de automatizar com `pgTAP` ou um script Node simples com `pg`.
- Testes de cada Repository adaptado (ver próximo documento) rodando os mesmos cenários já usados na homologação da Camada Repository original (`CRM/TECHDOC.md` §22.10 — 48 cenários reaproveitáveis como base).

## 7. Homologação

Mesmo processo formal de 8 etapas já em vigor no projeto para qualquer fase (Planejamento → Aprovação da arquitetura → Implementação isolada → Backups → Homologação → Atualização do TECHDOC → Encerramento formal), aplicado por onda. Nenhuma onda avança para a próxima sem aprovação formal da anterior — mesmo princípio que já rege as Fases do `MASTER_ROADMAP.md`.

## 8. Estimativa de esforço (ordem de grandeza, não um cronograma comprometido)

| Onda | Esforço relativo |
|---|---|
| 1 (piloto) | Baixo — valida o processo |
| 2-3 | Médio — mecânico, replica o padrão validado na Onda 1 |
| 4 | Médio-Alto — exige dupla checagem por ser dado financeiro |
| 5 | Alto — maior volume e acoplamento |
| 6 | Alto — componente crítico, mesma barra de autorização de Login/Auth |
| 7 | Médio-Alto — única com exposição pública em tempo real |

**Esta tabela não é um compromisso de prazo** — é só a ordenação de risco/esforço para uma decisão futura de priorização, coerente com o mesmo formato usado em `MASTER_ROADMAP.md` e `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md`.
