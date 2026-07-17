# 📁 Catálogo Completo de Coleções Firestore — Cell City CRM

> **Última atualização:** 2026-07-07 — revisão técnica completa (ver nota abaixo).
> **Propósito:** Documento mestre de todas as coleções do Firestore usadas no sistema Cell City CRM.
> **Convenção:** Nomes em `código` são os literais usados nas chamadas `collection(db, '...')` / `doc(db, '...', id)`, seja o literal inline ou por meio de uma constante local (ex.: `const COL = 'comandos'`).

> **Nota da revisão de 2026-07-07:** o documento (criado em julho/2026, autoria não registrada) cobria 29 coleções ativas. Uma auditoria cruzando `CRM/repositories/*.repository.js` (58 coleções mapeadas na camada Repository, incluindo Fase 0/1 ainda só em `develop`), `firestore.rules` e busca por literais/constantes em todo o código-fonte (`main` + `develop`, excluindo `_BACKUPS/` e pastas `BACKUP_*`) encontrou **25 coleções ativas não documentadas** (24 na primeira passada + `gdrive_backup`, reclassificada de "órfã" para "ativa" numa segunda passada — ver §18 e §21.2). Nenhum código ou regra foi alterado nesta revisão — só a documentação. Seções novas ou com adições estão marcadas com 🆕.
>
> **Correção de 2026-07-07 (mesmo dia, sessão de continuação):** a primeira passada desta revisão tinha analisado o `firestore.rules` da **raiz** do repositório (arquivo duplicado, nunca deployado, abandonado desde 2026-07-01 — ver `plans/RESOLUCAO_DUPLICIDADE_FIRESTORE_RULES_20260707.md`) para a seção de "regras órfãs", em vez do arquivo real (`CRM/firestore.rules`). Corrigido: só **2 coleções** (`clients`, `orders`) são órfãs de fato no arquivo deployado — ver §21.2.

---

## Índice
1. [Módulo OS (Ordem de Serviço)](#1-módulo-os-ordem-de-serviço)
2. [Módulo CRM Comercial](#2-módulo-crm-comercial)
3. [Módulo Central de Comandos / Informações 🆕](#3-módulo-central-de-comandos--informações-)
4. [Módulo Central de Organização 🆕](#4-módulo-central-de-organização-)
5. [Módulo Caixa / Financeiro](#5-módulo-caixa--financeiro)
6. [Módulo Estoque](#6-módulo-estoque)
7. [Módulo Catálogo de Produtos 🆕](#7-módulo-catálogo-de-produtos-)
8. [Módulo Fornecedor](#8-módulo-fornecedor)
9. [Módulo Pós-Venda](#9-módulo-pós-venda)
10. [Módulo Agenda / Ação da Semana / Minha Semana](#10-módulo-agenda--ação-da-semana--minha-semana)
11. [Módulo Portal do Cliente](#11-módulo-portal-do-cliente)
12. [Módulo Usuários / Permissões / Preferências](#12-módulo-usuários--permissões--preferências)
13. [Módulo Empresas (Multiempresa / Tenant) 🆕](#13-módulo-empresas-multiempresa--tenant-)
14. [Módulo Alertas / Central de Alertas](#14-módulo-alertas--central-de-alertas)
15. [Módulo Diário](#15-módulo-diário)
16. [Módulo Autoatendimento / Pré-OS](#16-módulo-autoatendimento--pré-os)
17. [Módulo Importação de Vendas 🆕](#17-módulo-importação-de-vendas-)
18. [Sincronização e Backup (Google Drive) 🆕](#18-sincronização-e-backup-google-drive-)
19. [Configurações do Sistema](#19-configurações-do-sistema)
20. [Auditoria e Logs](#20-auditoria-e-logs)
21. [Coleções Legadas / Em Desuso](#21-coleções-legadas--em-desuso)
22. [Resumo de Relacionamentos entre Coleções](#22-resumo-de-relacionamentos-entre-coleções)

---

## 1. Módulo OS (Ordem de Serviço)

### `os`
**Document ID:** `OS-XXXX` (ex: `OS-0001`)

Coleção principal de Ordens de Serviço. Cada documento representa uma OS completa.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | Identificador único (ex: `OS-0001`) |
| `category` | `string` | Categoria: `celular`, `notebook`, `impressora` |
| `clientName` | `string` | Nome do cliente |
| `phone` | `string` | Telefone formatado (ex: `(62) 98160-5863`) |
| `phoneDigits` | `string` | Telefone canônico (apenas dígitos) |
| `cpf` | `string?` | CPF do cliente |
| `cep` | `string?` | CEP |
| `endereco` | `string?` | Endereço |
| `numero` | `string?` | Número |
| `complemento` | `string?` | Complemento |
| `bairro` | `string?` | Bairro |
| `cidade` | `string?` | Cidade |
| `estado` | `string?` | Estado (UF) |
| `brand` | `string?` | Marca do aparelho |
| `model` | `string` | Modelo do aparelho |
| `imei` | `string?` | IMEI / Nº de série (campo antigo) |
| `imei1` | `string?` | IMEI 1 |
| `imei2` | `string?` | IMEI 2 |
| `defect` | `string` | Defeito relatado |
| `valor` | `number` | Valor à vista/PIX (R$) |
| `valorCartao` | `number` | Valor cartão (R$) |
| `observations` | `string?` | Observações gerais |
| `obsRapida` | `string?` | Observação rápida (máx 100 caracteres) |
| `technicalObservation` | `string?` | Observação técnica interna |
| `internalObservation` | `string?` | Observação interna (equipe) |
| `password` | `string?` | Senha do aparelho |
| `lockType` | `string?` | Tipo de bloqueio: `Numerica`, `Padrao`, `Biometria`, `Face ID`, `Digital` |
| `lockPhoto` | `string?` | URL da foto do bloqueio (Storage ou Base64) |
| `patternSequence` | `array<number>?` | Sequência do padrão Android (ex: `[0, 3, 4, 7]`) |
| `photos` | `array<string>` | URLs das fotos (Storage ou Base64) |
| `technician` | `string?` | Técnico responsável |
| `status` | `string` | Status atual: `recebido`, `em_analise`, `orcamento_enviado`, `orcamento_aprovado`, `orcamento_recusado`, `em_reparo`, `testes_finais`, `concluido`, `entregue` |
| `entryChecklist` | `array<number>` | Índices marcados no checklist de entrada |
| `exitChecklist` | `array<number>` | Índices marcados no checklist de saída |
| `prazoGarantia` | `number` | Prazo de garantia em dias (padrão: 90) |
| `garantiaId` | `string?` | ID do modelo de garantia |
| `orc1Desc` | `string?` | Descrição do Orçamento 1 |
| `orc1Valor` | `number` | Valor do Orçamento 1 |
| `orc2Desc` | `string?` | Descrição do Orçamento 2 |
| `orc2Valor` | `number` | Valor do Orçamento 2 |
| `orcamentoResposta` | `string?` | Resposta do cliente: `aprovado`, `recusado` |
| `orcamentoDataResposta` | `string?` | Data da resposta |
| `orcamentoHoraResposta` | `string?` | Hora da resposta |
| `orcamentoEscolhido` | `string?` | Opção escolhida: `1` ou `2` |
| `orcamentoObs` | `string?` | Observação do cliente na resposta |
| `orcamentoOrigem` | `string?` | Origem da resposta: `whatsapp`, `portal` |
| `timeline` | `array<object>` | Linha do tempo: `[{ date: ISO, text: string }]` |
| `relatorioTecnico` | `object?` | Relatório técnico (`{ defeitoInformado, diagnostico, solucaoAplicada, observacoes, status, data, tecnico, exibirPortal }`) |
| `createdAt` | `string (ISO)` | Data de criação |
| `updatedAt` | `string (ISO)` | Data da última atualização |
| `deliveredAt` | `string (ISO)?` | Data de entrega |
| `origem` | `string?` | Origem: `presencial`, `portal` |
| `solicitacaoId` | `string?` | ID da solicitação do portal (se origem for portal) |
| `crmLeadId` | `string?` | ID do lead do CRM (se convertido de lead) |
| `preOsId` | `string?` | ID da Pré-OS |
| `osConvertido` | `boolean?` | Se foi convertido de lead |
| `osConvertidoEm` | `timestamp?` | Quando foi convertido |

---

### `clientes`
**Document ID:** `phoneDigits` (ex: `62981605863`)

Base unificada de clientes compartilhada entre OS e CRM Comercial.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `name` | `string` | Nome do cliente |
| `phone` | `string` | Telefone formatado |
| `phoneDigits` | `string` | Telefone canônico (apenas dígitos) |
| `cpf` | `string` | CPF |
| `email` | `string` | E-mail |
| `endereco` | `string` | Endereço |
| `obsCliente` | `string` | Observações do cliente |
| `history` | `array<string>` | Lista de IDs de OS do cliente |
| `crmLeads` | `array<string>` | Lista de IDs de leads do CRM |
| `createdAt` | `string (ISO)` | Data de criação |
| `origem` | `string` | Origem: `crm`, `os`, `portal` |
| `atualizadoEm` | `timestamp?` | Última atualização |

---

### `metadata`
**Document ID:** `counter` (config)

Metadados do sistema.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `value` | `number` | Contador sequencial de OS |

---

## 2. Módulo CRM Comercial

### `crm_leads`
**Document ID:** Auto-generated

Leads do funil de vendas CRM.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | `string` | Nome do cliente |
| `telefone` | `string` | Telefone |
| `aparelho` | `string?` | Aparelho / Produto |
| `servico` | `string?` | Serviço solicitado |
| `valor` | `number?` | Valor informado |
| `obs` | `string?` | Observações |
| `status` | `string` | Status: `novo_contato`, `orcamento_enviado`, `aguardando_resposta`, `negociacao`, `fechado`, `pre_os`, `perdido` |
| `lockType` | `string?` | Tipo de bloqueio |
| `senha` | `string?` | Senha numérica |
| `patternSequence` | `array<number>?` | Sequência do padrão Android |
| `motivoPerda` | `string?` | Motivo da perda: `achou_caro`, `fara_depois`, `sem_dinheiro`, `concorrente`, `sem_resposta`, `desistiu`, `outro` |
| `preOsId` | `string?` | ID da Pré-OS gerada |
| `osConvertido` | `boolean?` | Se foi convertido em OS |
| `osConvertidoEm` | `timestamp?` | Data da conversão |
| `criadoEm` | `timestamp` | Data de criação |
| `atualizadoEm` | `timestamp` | Data da última atualização |

### 🆕 `crm_templates`
**Document ID:** Auto-generated

Templates de mensagem WhatsApp reutilizáveis para leads do CRM Comercial
(`CRM/pages/crm-comercial/crm.js`). Achado da auditoria técnica independente
2026-07-17: coleção com Rule real (`CRM/firestore.rules`) e consumidor ativo,
mas nunca tinha entrado nesta documentação.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | `string` | Nome do template (exibido na UI) |
| `texto` | `string` | Corpo da mensagem, com placeholders `{nome}`, `{aparelho}`, `{servico}`, `{valor}`, `{tel}`, `{obs}` |

### `chips_cadastros`
**Document ID:** Auto-generated

Cadastros de chip (TIM, Vivo, Claro, etc.).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `operadora` | `string` | Operadora |
| `nome` | `string` | Nome do cliente |
| `cpf` | `string` | CPF |
| `estadoCpf` | `string?` | Estado do CPF |
| `dataNascimento` | `string?` | Data de nascimento |
| `telefone` | `string?` | Telefone de contato |
| `status` | `string` | Status: `novo_cadastro`, `dados_coletados`, `aguardando_ativacao`, `ativado`, `erro_cadastro`, `cliente_nao_retornou`, `finalizado` |
| `numeroGerado` | `string?` | Número gerado |
| `obs` | `string?` | Observações |
| `historico` | `array<object>` | Histórico de ações: `[{ acao, data }]` |
| `criadoEm` | `timestamp` | Data de criação |
| `atualizadoEm` | `timestamp` | Data da última atualização |

### 🆕 `contas_numeros`
**Document ID:** Auto-generated

Cadastro de linhas/números de contato da empresa (módulo "Contas", `CRM/pages/contas/contas.js`). Migrado para `ContasNumerosRepository` (`crm.repository.js`) na Fase 1 da Camada Repository.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | `string` | Identificação da linha/conta |
| `numero` | `string` | Número/telefone da conta |
| `criadoEm` | `timestamp` | Data de criação |

---

## 3. Módulo Central de Comandos / Informações 🆕

Módulos irmãos (`CRM/pages/central-comandos/`, `CRM/pages/central-informacoes/`), ativos em produção desde antes da Camada Repository — não estavam neste catálogo.

### `comandos`
**Document ID:** Auto-generated

Comandos/atalhos reutilizáveis (ex.: prompts, scripts, textos padrão) organizados em blocos.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | Espelha o ID do documento |
| `titulo` | `string` | Título do comando |
| `categoria` | `string` | Categoria (ver `categorias_comandos` + lista padrão fixa no código) |
| `blocos` | `array<string>` | Blocos de conteúdo do comando |
| `conteudo` | `string` | `blocos.join('\n\n---\n\n')` — mantido por compatibilidade |
| `favorito` | `boolean?` | Se está marcado como favorito |
| `criadoEm` / `criadoEmISO` | `timestamp` / `string` | Data de criação |
| `atualizadoEm` / `atualizadoEmISO` | `timestamp` / `string` | Última atualização |
| `migradoDe` | `string?` | ID do doc de `informacoes` de origem (ver migração abaixo) |

**Migração interna (`executarMigracao()`, executa uma única vez, controlada por `config/migracao_comandos_v1`):** registros de `informacoes` com `tipo:'comando'` são copiados para `comandos` (campo `conteudo` → `blocos: [conteudo]`); o original em `informacoes` **não é apagado**, só recebe `migracao:'comandos_v1'` + `migracaoDestinoId` como marcador de soft-delete.

### `categorias_comandos`
**Document ID:** Auto-generated

Categorias customizadas de comandos (além da lista padrão fixa no código: CRM, Claude, Programação, Financeiro, Marketing, Instagram, WhatsApp, Igreja, Outros).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | Espelha o ID do documento |
| `nome` | `string` | Nome da categoria |
| `criadoEm` / `criadoEmISO` | `timestamp` / `string` | Data de criação |

### `informacoes`
**Document ID:** Auto-generated

Base de conhecimento / textos informativos (tutoriais, respostas padrão, etc.), incluindo os registros ainda não migrados para `comandos` (`tipo:'comando'`, ver acima).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | Espelha o ID do documento |
| `titulo` | `string` | Título |
| `tipo` | `string?` | Ex.: `comando` (usado só pela migração para `comandos`) |
| `conteudo` | `string?` | Conteúdo |
| `favorito` | `boolean?` | Se está marcado como favorito |
| `criadoEm` / `criadoEmISO` | `timestamp` / `string` | Data de criação |
| `atualizadoEm` / `atualizadoEmISO` | `timestamp` / `string` | Última atualização |
| `migracao` | `string?` | `'comandos_v1'` quando já migrado para `comandos` |
| `migracaoDestinoId` | `string?` | ID do doc criado em `comandos` |
| `migracaoEm` | `timestamp?` | Quando a migração ocorreu |

### `categorias_informacoes`
**Document ID:** Auto-generated

Categorias customizadas de informações, mesmo padrão de `categorias_comandos`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | `string` | Nome da categoria |

---

## 4. Módulo Central de Organização 🆕

### `central_organizacao`
**Document ID:** nome da seção (ex.: `comandos-rapidos`)

Um documento por "seção" de uma lista organizável na página `CRM/pages/central-organizacao/`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `itens` | `array` | Itens da seção, ordem definida pela UI |
| `atualizadoEm` | `timestamp` | Última atualização |

---

## 5. Módulo Caixa / Financeiro

### `caixa_lancamentos`
**Document ID:** Auto-generated

Lançamentos financeiros do caixa.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tipo` | `string` | Tipo: `entrada`, `saida`, `servico` |
| `descricao` | `string` | Descrição do lançamento |
| `categoria` | `string` | Categoria (ex: `Vendas`, `Fornecedores`) |
| `valor` | `number` | Valor bruto |
| `custo` | `number` | Custo (para calcular lucro) |
| `lucro` | `number` | Lucro líquido (calculado) |
| `data` | `string` | Data (YYYY-MM-DD) |
| `dataISO` | `string` | Data em ISO |
| `ano` | `number` | Ano |
| `obs` | `string?` | Observações |
| `empresa_id` | `string?` | ID da empresa (multi-tenancy) |
| `criadoEm` | `timestamp` | Data de criação |
| `atualizadoEm` | `timestamp?` | Data da última atualização |

### `categorias_caixa`
**Document ID:** Nome da categoria (ex: `Vendas`)

Categorias de lançamento do caixa.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | `string` | Nome da categoria |
| `tipo` | `string` | Tipo: `entrada`, `saida`, `servico` |
| `status` | `string` | Status: `ativo`, `inativo` |
| `empresa_id` | `string?` | ID da empresa |
| `criadoEm` | `timestamp` | Data de criação |

### `lembretes_pagamento`
**Document ID:** Auto-generated

Lembretes de contas a pagar.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `fornecedor` | `string` | Nome do fornecedor |
| `descricao` | `string` | Descrição |
| `quantidade` | `number` | Quantidade |
| `valor` | `number` | Valor |
| `vencimento` | `string?` | Data de vencimento |
| `observacao` | `string?` | Observação |
| `empresa_id` | `string?` | ID da empresa |
| `criadoEm` | `timestamp` | Data de criação |

### `financeiro_receber`
**Document ID:** Auto-generated (ex: `os_OS-0001_...`) ou manual (ver `financeiro.js`)

Contas a receber (gerado automaticamente ao criar OS com valor, e também gerenciável manualmente em `CRM/pages/financeiro/`).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `descricao` | `string` | Descrição |
| `vencimento` | `string` | Data de vencimento |
| `valor` | `number` | Valor |
| `status` | `string` | Status: `pendente`, `pago` |
| `obs` | `string?` | Observações |
| `origem` | `string?` | Origem: `os` (quando gerado automaticamente) |
| `osId` | `string?` | ID da OS vinculada |
| `atualizadoEm` | `timestamp` | Última atualização |

### 🆕 `financeiro_pagar`
**Document ID:** `pag_<timestamp>` ou o ID em edição

Contas a pagar, módulo `CRM/pages/financeiro/financeiro.js`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `descricao` | `string` | Descrição |
| `categoria` | `string` | Categoria (ver `financeiro_categorias`) |
| `vencimento` | `string` | Data de vencimento |
| `valor` | `number` | Valor |
| `status` | `string` | Status (ex.: `pendente`, `pago` — mesmo padrão de `financeiro_receber`) |
| `obs` | `string?` | Observações |
| `atualizadoEm` | `timestamp` | Última atualização |

### 🆕 `financeiro_fixas`
**Document ID:** manual (mesmo padrão de `financeiro_pagar`)

Despesas fixas recorrentes, mesmo módulo `financeiro.js`. Estrutura análoga a `financeiro_pagar` (não há criação automática — só CRUD manual).

### 🆕 `financeiro_categorias`
**Document ID:** Auto-generated

Categorias customizadas do módulo Financeiro (distintas de `categorias_caixa`, que é do Caixa).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | `string` | Nome da categoria |

---

## 6. Módulo Estoque

### `estoque_produtos`
**Document ID:** Auto-generated (ou `prod_<timestamp>` ao salvar manualmente)

Produtos em estoque.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | `string` | Nome do produto |
| `categoria` | `string?` | Categoria (ex: `Cabo`, `Capinha`, `Película`) |
| `quantidade` | `number` | Quantidade atual |
| `quantidadeMinima` | `number` | Quantidade mínima (alerta) |
| `valorCusto` / `custo` | `number` | Valor de custo |
| `valorVenda` / `venda` | `number` | Valor de venda |
| `fornecedor` | `string?` | Fornecedor |
| `codigoBarras` | `string?` | Código de barras |
| `descricao` | `string?` | Descrição adicional |
| `atualizadoEm` | `timestamp` | Última atualização |

> Se `estoque_produtos` estiver vazia, `estoque.js` faz fallback de leitura em `produtos` (ver §21 — coleção legada mantida só para esse fallback).

---

## 7. Módulo Catálogo de Produtos 🆕

Catálogo público de produtos (`CRM/pages/catalogo/catalogo.js`), migrado para a Camada Repository na Fase 1 (`produtos.repository.js`).

### `catalogo_produtos`
**Document ID:** Auto-generated

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | `string` | Nome do produto |
| `ordem` | `number` | Ordem de exibição |
| `precoPromo` | `number?` | Preço promocional (`null` se ausente) |
| `ativo` | `boolean?` | Se está visível no catálogo (default `true`) |
| `criadoEm` / `atualizadoEm` | `timestamp` | Datas de criação/atualização |

### `catalogo_config`
**Document ID:** `geral`

Configuração geral do catálogo (contato, mensagem padrão).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `whatsapp` | `string` | WhatsApp de contato |
| `mensagemTemplate` | `string` | Template de mensagem para o cliente |

---

## 8. Módulo Fornecedor

### `fornecedor_compras`
**Document ID:** Auto-generated (ex: `compra_...`)

Lista de compras a fazer.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | `string` | Nome do item |
| `quantidade` | `number` | Quantidade |
| `urgencia` | `string` | Urgência: `alta`, `media`, `baixa` |
| `obs` | `string?` | Observações |
| `status` | `string?` | Status: `feita` |
| `atualizadoEm` | `timestamp` | Última atualização |

### `fornecedor_tendencias`
**Document ID:** Auto-generated (ex: `tend_...`)

Tendências de mercado observadas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `produto` | `string` | Nome do produto |
| `tendencia` | `string` | Tendência: `crescendo`, `estavel`, `caindo` |
| `prio` | `string` | Prioridade: `alta`, `media`, `baixa` |
| `obs` | `string?` | Observações |
| `criadoEm` | `timestamp` | Data de criação |

---

## 9. Módulo Pós-Venda

### `posvenda_contatos`
**Document ID:** `${osId}_${prazo}` (ex: `OS-0001_5`)

Controles de contato pós-venda.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `osId` | `string` | ID da OS |
| `clientName` | `string` | Nome do cliente |
| `phone` | `string` | Telefone |
| `model` | `string?` | Modelo do aparelho |
| `prazo` | `number` | Dias após entrega: `5`, `15`, `30` |
| `emoji` | `string?` | Emoji da satisfação |
| `resultado` | `string?` | Resultado do contato |
| `dataContato` | `string?` | Data do contato |
| `createdAt` | `string?` | Data de criação |
| `updatedAt` | `string?` | Data de atualização |
| `dataAtualizacao` | `string?` | Data de alteração |
| `ativo` | `boolean?` | Se está ativo |
| `deletedAt` | `string?` | Data de exclusão |

### `posvenda_mensagens`
**Document ID:** `"5"`, `"15"`, `"30"` (prazo em dias)

Templates de mensagem para cada prazo de pós-venda.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `mensagem` | `string` | Template da mensagem |
| `updatedAt` | `string?` | Última atualização |

---

## 10. Módulo Agenda / Ação da Semana / Minha Semana

### `agenda`
**Document ID:** Data ISO (ex: `2026-07-17`)

Notas e compromissos diários da agenda.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `data` | `string` | Data (YYYY-MM-DD) |
| `notas` | `array<object>` | `[{ texto: string, concluido: boolean }]` |
| `cor` | `string` | Cor: `amarelo`, `verde`, `azul`, `vermelho` |
| `alertaHora` | `string?` | Hora do alerta (HH:MM) |
| `alertaDashboard` | `boolean` | Se deve exibir alerta no Dashboard |
| `recorrencia` | `string` | Recorrência: `nenhuma`, `semanal`, `mensal`, `anual` |
| `recorrenciaExcluir` | `array<string>` | Datas excluídas da recorrência |
| `recorrenciaPararEm` | `string` | Data para parar a recorrência |
| `textoCor` | `string` | Cor do texto: `preto`, `branco` |
| `atualizadoEm` | `timestamp` | Última atualização |

### `agendamentos`
**Document ID:** Auto-generated

Agendamentos de atendimento (Portal do Cliente).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | `string` | Nome do cliente |
| `telefone` | `string` | Telefone |
| `email` | `string?` | E-mail |
| `modeloAparelho` | `string?` | Modelo do aparelho |
| `defeito` | `string?` | Defeito |
| `dataPreferida` | `string?` | Data preferida |
| `periodo` | `string?` | Período: `manha`, `tarde` |
| `observacoes` | `string?` | Observações |
| `status` | `string` | Status: `aguardando`, `confirmado`, `cancelado`, `concluido` |
| `criadoEm` | `timestamp?` | Data de criação |
| `atualizadoEm` | `timestamp?` | Última atualização |
| `origem` | `string?` | Origem: `portal`, `presencial` |
| `createdAt` | `string?` | Data de criação (formato string) |

### 🆕 `tarefas_semana`
**Document ID:** `uid` (Firebase Auth UID)

Tarefas do módulo "Minha Semana" (`CRM/pages/minha-semana/`) — um documento por usuário, observado em tempo real (`onSnapshot` de doc único).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tarefas` | `array<object>` | Lista de tarefas: `[{ texto, prioridade: 'alta'\|'media'\|'baixa', dia }]` |
| `atualizadoEm` | `timestamp` | Última atualização |

---

## 11. Módulo Portal do Cliente

### `mensagens_portal`
**Document ID:** Auto-generated

Mensagens enviadas por clientes pelo Portal.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `clientName` / `nome` | `string` | Nome do cliente |
| `phone` | `string` | Telefone |
| `texto` | `string` | Mensagem |
| `lida` | `boolean` | Se foi lida pela equipe |
| `createdAt` | `timestamp?` | Data de envio |

### `avaliacoes`
**Document ID:** Auto-generated

Avaliações (notas e feedback) de clientes.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nota` | `number?` | Nota (1-5) |
| `comentario` | `string?` | Comentário |
| `clientName` / `nome` | `string` | Nome do cliente |
| `osId` | `string?` | ID da OS |
| `createdAt` | `timestamp?` | Data de criação |

### `solicitacoes_diagnostico`
**Document ID:** Auto-generated

Solicitações de diagnóstico do Portal/Autoatendimento.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `status` | `string` | Status: `pendente`, `convertido`, `respondido` |
| `osId` | `string?` | ID da OS gerada |
| `respondido` | `boolean?` | Se foi respondido |
| `atualizadoEm` | `string?` | Última atualização |

### 🆕 `portal_eventos`
**Document ID:** Auto-generated

Analytics de eventos do Portal do Cliente (acessos, cliques). **Escrita hoje só via Cloud Function** (`functions/index.js`, `admin.firestore().collection('portal_eventos').add(...)`) desde a Sprint 1b (2026-07-06) — o Portal público não fala mais direto com o Firestore para isso. Lido pela tela de analytics do admin (`CRM/pages/portal-cliente/admin.js`).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tipo` | `string` | Tipo do evento: `acesso`, `clique_whatsapp`, `clique_maps`, entre outros |
| `telefone` | `string` | Telefone mascarado (`maskPhoneServer`) |
| `clientName` | `string?` | Nome do cliente, se disponível |
| `createdAt` | `timestamp` | Gerado no servidor (`FieldValue.serverTimestamp()`) |

---

## 12. Módulo Usuários / Permissões / Preferências

### `usuarios`
**Document ID:** `uid` (Firebase Auth UID)

Cadastro de usuários do sistema.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome_exibicao` | `string` | Nome de exibição |
| `email` | `string` | E-mail |
| `perfil` | `string` | Perfil legado: `admin`, `master_admin`, `usuario`, `tecnico` |
| `perfil_operacional_id` | `string?` | ID do perfil operacional (RBAC Fase 2) |
| `status` | `string` | Status: `ativo`, `inativo` |
| `setor` | `string?` | Setor |
| `telefone` | `string?` | Telefone |
| `observacao` | `string?` | Observação |
| `conta_padrao` | `boolean?` | Se é conta padrão |
| `criado_por` | `string?` | UID de quem criou |
| `ultima_alteracao` | `timestamp?` | Última alteração |
| `createdAt` | `timestamp?` | Data de criação |
| `empresa_id` | `string?` | ID da empresa (ver §13 — usado por `tenant.js` na resolução do tenant) |

### `perfis_operacionais`
**Document ID:** Slug (ex: `tecnico`, `vendedor`)

Perfis operacionais para RBAC (Fase 2).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | `string` | Nome do perfil |
| `descricao` | `string?` | Descrição |
| `sistema` | `boolean?` | Se é perfil do sistema |
| `ativo` | `boolean` | Se está ativo |
| `permissoes` | `object` | Matriz de permissões: `{ moduloId: { visualizar, criar, editar, excluir, aprovar } }` |
| `criadoEm` | `timestamp?` | Data de criação |
| `criadoPor` | `string?` | UID do criador |
| `atualizadoEm` | `timestamp?` | Última atualização |

### 🆕 `favoritos_usuarios`
**Document ID:** `uid`

Favoritos/atalhos do usuário (Central de Módulos + menu), observado em tempo real (`CRM/shared/favoritos.js`).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `itens` | `array<string>` | URLs/IDs favoritados (URLs relativas — `favoritos.js` normaliza para não vazar de MAIN↔DEVELOP) |
| `atualizadoEm` | `timestamp` | Última atualização |

### 🆕 `notas_usuarios`
**Document ID:** `uid`

Bloco de notas pessoal do usuário no Dashboard (`dashboard-ui.js`), observado em tempo real.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `conteudo` | `string` | Texto da nota |

> Existem também preferências por usuário guardadas em **subcoleção** `usuarios/{uid}/preferencias/*` (layout, módulos favoritos, home) — não são uma coleção de 1º nível, por isso não têm seção própria aqui. Ver `[[project-preferencias-layout]]`/`[[project-central-modulos]]` no histórico do projeto.

---

## 13. Módulo Empresas (Multiempresa / Tenant) 🆕

### `empresas`
**Document ID:** `empresa_id` (ex: `cellcity-master`)

Vestígio da iniciativa SaaS Multiempresa (revertida em 2026-06-27, nunca refeita — sistema atual é single-tenant). **Ainda é lida em tempo real de execução por `CRM/shared/tenant.js`** a cada resolução de contexto de sessão, com fallback universal para o tenant único `cellcity-master` quando o documento não influencia nenhuma UI real hoje (não há mais tela de gestão de múltiplas empresas).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `status` | `string` | `ativo`, `bloqueado`, `cancelado`, `arquivado` |
| `data_vencimento` | `timestamp?` | Vencimento de licença (bloqueia acesso se expirado) |
| `plano` | `string?` | Chave do plano (mapeada para uma tabela fixa `PLANOS` no código) |
| `modulos_ativos` | `array<string>?` | Módulos liberados (fallback: módulos do plano) |
| `feature_flags` | `object?` | Flags de funcionalidade por empresa |

**Observação de arquitetura:** esta é a única coleção do catálogo cujo *código consumidor* (`tenant.js`) ainda reflete um modelo multiempresa que o produto não usa mais operacionalmente — vale revisitar se deve ser simplificado (remover a leitura) ou mantido como estava, numa decisão de arquitetura separada (fora do escopo desta revisão documental).

---

## 14. Módulo Alertas / Central de Alertas

### `alertas_usuario`
**Document ID:** ID único (ex: `crm_lead123_2d`, `crm_recontato_lead123_30d_2026-08-01`)

Alertas gerados automaticamente ou manualmente.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | ID único do alerta |
| `titulo` | `string` | Título do alerta |
| `descricao` | `string` | Descrição |
| `tipo` | `string` | Tipo: `lembrete`, `os`, `crm_remarketing` |
| `prioridade` | `string` | Prioridade: `alta`, `media`, `baixa` |
| `data` | `string` | Data (YYYY-MM-DD) |
| `hora` | `string` | Hora (HH:MM) |
| `status` | `string` | Status: `pendente`, `concluido` |
| `repeticao` | `string` | Repetição: `nenhuma`, `diaria`, `semanal`, `mensal` |
| `customDias` | `number?` | Dias personalizados |
| `link` | `string?` | Link para redirecionamento |
| `origem` | `string` | Origem: `crm`, `crm_remarketing`, `os` |
| `leadId` | `string?` | ID do lead relacionado |
| `osId` | `string?` | ID da OS relacionada |
| `criadoEmISO` | `string` | Data de criação (ISO) |
| `criadoEm` | `timestamp?` | Timestamp de criação |
| `atualizadoEmISO` | `string?` | Última atualização (ISO) |
| `atualizadoEm` | `timestamp?` | Última atualização (timestamp) |

### 🆕 `central_alertas_status`
**Document ID:** `uid`

Status de leitura dos alertas por usuário (`CRM/pages/central-alertas/`), observado em tempo real via doc único.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `itens` | `object` | Mapa `{ alertaId: { status: 'lido', em: ISO } }` |
| `atualizadoEm` | `timestamp` | Última atualização |

### 🆕 `alarme_config`
**Document ID:** `uid`

Configuração de alarme sonoro de OS novas por usuário (`CRM/pages/dashboard/dashboard-alarme-os.js` + `sw-alarme.js`, este último via REST direto no Service Worker).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| *(campos de config do alarme)* | | Config do alarme definida pela UI (som, ativo/inativo, horários) |
| `ultimaAtualizacao` | `object` | `{ timestamp, dispositivo (user agent truncado), seuUserId }` — rastreio de sincronização entre dispositivos |

---

## 15. Módulo Diário

### `diario_registros`
**Document ID:** Auto-generated

Registros de revisão do diário.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `dataRevisao` | `string?` | Data da revisão (YYYY-MM-DD) |
| `status` | `string?` | Status: `pendente`, `concluido`, `arquivado` |
| *(outros campos conforme implementação)* | | |

### 🆕 `diario_eventos`
**Document ID:** Auto-generated

Linha do tempo (histórico de eventos) de cada registro do Diário — criado/editado/status/favorito/arquivado/restaurado/excluído.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `registroId` | `string` | ID do registro em `diario_registros` |
| `registroTitulo` | `string` | Título do registro no momento do evento |
| `categoria` | `string?` | Categoria do registro |
| `tipo` | `string` | Tipo do evento: `criado`, `status`, `favorito`, `arquivado`, `restaurado`, `excluido` |
| `descricao` | `string?` | Descrição livre do evento (ex.: transição de status) |
| `em` | `timestamp` | Quando o evento ocorreu |

---

## 16. Módulo Autoatendimento / Pré-OS

### `pre_os`
**Document ID:** Auto-generated

Pré-Ordens de Serviço (do autoatendimento / portal / `abrir-atendimento.html` público).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | `string?` | Nome do cliente |
| `telefone` | `string?` | Telefone |
| `status` | `string` | Status: `AGUARDANDO_CONVERSAO`, `CONVERTIDA` |
| `osId` | `string?` | ID da OS convertida |
| `atualizadoEm` | `string?` | Última atualização |

---

## 17. Módulo Importação de Vendas 🆕

Importação de vendas de uma plataforma externa ("Beep") — `CRM/pages/importar/importar.js`.

### `vendas_importadas`
**Document ID:** `beep_<idOriginal>`

Registro histórico de cada venda já importada (evita reimportar o mesmo registro).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | Espelha o ID do documento |
| `idOriginal` | `string` | ID na plataforma de origem |
| `clienteId` | `string?` | ID do cliente mapeado (`clientes`), se encontrado |
| `dataISO` | `string` | Data da venda |
| `total` | `number` | Valor total |
| `importadoDe` | `string` | Origem: `beepstart` |
| `createdAt` | `timestamp` | Data da importação |

> Cada venda importada com `total > 0` também gera um lançamento em `caixa_lancamentos` (ver §22 — Relacionamentos).

### 🆕 `categorias_produtos`
**Document ID:** manual/derivado

Categorias usadas na importação de produtos/vendas (**não** é a mesma coisa que `categorias_caixa` ou `categorias_comandos`). Repository preparado (`ProdutosRepository`/`CategoriasProdutosRepository` em `produtos.repository.js`), mas ainda sem consumidor migrado — o único uso real hoje é via SDK direto em `importar.js`.

---

## 18. Sincronização e Backup (Google Drive) 🆕

Núcleo compartilhado de sincronização CRM ↔ Google Drive (`CRM/shared/cc-sync.js`), usado hoje pelo Diário e preparado para outros módulos (Tutoriais, Soluções Técnicas).

### `cc_lixeira`
**Document ID:** derivado de `modulo` + `registroId`

Itens excluídos (retenção de 30 dias, `RETENCAO_DIAS`), com snapshot completo para permitir restauração.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `modulo` | `string` | Módulo de origem (ex.: `diario`) |
| `registroId` | `string` | ID do registro original |
| `titulo` | `string` | Título/identificação amigável |
| `registro` | `object` | Snapshot completo do registro, para restaurar |
| `backupDriveId` / `backupDriveLink` | `string?` | Referência ao backup no Google Drive, se houver |
| `apelido` | `string` | Apelido do dispositivo que excluiu (não há login nominal nesse fluxo — auth anônima) |
| `excluidoEm` / `excluidoEmTs` | `string (ISO)` / `timestamp` | Quando foi excluído |

### `cc_gdrive_logs`
**Document ID:** Auto-generated

Log de auditoria das operações de sincronização com o Drive.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `acao` | `string` | `exclusao`, `exclusao_definitiva`, `restauracao`, `reenvio`, entre outros |
| `modulo` | `string?` | Módulo relacionado |

### 🆕 `gdrive_backup`
**Document ID:** `_credenciais` (global) ou `{moduleKey}` (um por módulo)

Credenciais OAuth do Google Drive (documento global `_credenciais`) e configuração de sincronização por módulo. Implementado em `CRM/shared/gdrive-backup.js`, consumido por `CRM/pages/diario/diario-gdrive.js` → `diario.js` (Diário). Corrigido nesta revisão (2026-07-07) — auditorias anteriores tinham classificado esta coleção como órfã por engano: o acesso usa `doc(db, ...CREDS_DOC)` com um array (`['gdrive_backup', '_credenciais']`), padrão que não aparece em buscas por `collection(db,'gdrive_backup')`/`doc(db,'gdrive_backup',...)` como as demais coleções deste catálogo. Ver `plans/AUDITORIA_FIRESTORE_RULES_ORFAS_20260707.md` §2.3 para o diagnóstico completo.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `clientId` | `string` | ID do cliente OAuth (documento `_credenciais`) |
| `atualizadoEm` | `timestamp` | Última atualização das credenciais |
| `ultimaSync` | `string?` | Última sincronização (documento por módulo) |

---

## 19. Configurações do Sistema

### `config`
**Document ID:** Chave de configuração

Configurações gerais do sistema — cada documento é uma chave/tela diferente (ex.: `impressao`, `pin`, `migracao_comandos_v1`, `crm_pre_os_counter`).

| Sub-documento | Campos | Descrição |
|---------------|--------|-----------|
| `crm_pre_os_counter` | `{ ultimo: number }` | Contador sequencial de Pré-OS |
| `impressao` | `{ loja, logo, garantias }` | Configuração de impressão de recibo (módulo Clientes) |
| `pin` | `{ pin, updatedAt }` | PIN de acesso rápido (módulo Config) |
| `migracao_comandos_v1` | `{ concluida, executadaEm, migrados, ignorados, erros, log }` | Flag + relatório da migração `informacoes`→`comandos` (ver §3) |
| *(outros)* | | Configurações diversas, um documento por chave |

> **`_diagnostico_temp`** (`CRM/pages/kernel-test/index.html`) não é uma coleção de dados de negócio — é usada só como alvo de um teste de leitura/escrita de conectividade (ping) na página interna de diagnóstico do kernel. Citada aqui só para constar no catálogo.

---

## 20. Auditoria e Logs

### `auditoria_usuarios_permissoes`
**Document ID:** Auto-generated

Log de alterações em usuários e permissões.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `acao` | `string` | Ação: `usuario_excluido`, `perfil_criado`, etc. |
| `admin_uid` | `string` | UID do administrador |
| `admin_nome` | `string` | Nome do administrador |
| `alvo_uid` | `string?` | UID do alvo |
| `alvo_nome` | `string?` | Nome do alvo |
| `detalhes` | `object?` | Detalhes adicionais |
| `timestamp` | `timestamp` | Timestamp da ação |

### `auditoria_saas`
**Document ID:** Auto-generated

Auditoria de ações no sistema SAAS.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `empresa_id` | `string` | ID da empresa |
| `usuario_id` | `string` | ID do usuário |
| *(outros campos)* | | |

### 🆕 `saas_eventos`
**Document ID:** `onboard_{empresaId}` (onboarding) ou auto-generated

Trilha de eventos do ciclo de vida SaaS — hoje só o evento de onboarding
(`functions/saas.js::saasOnboardingCriarEmpresa`). Achado da auditoria
técnica independente 2026-07-17: Rule real (`CRM/firestore.rules`,
tenant-scoped) e consumidor ativo, mas nunca tinha entrado nesta
documentação (não confundir com `saas_events`/`notificacoes_saas`, abaixo).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tipo` | `string` | Tipo do evento: `onboarding` |
| `empresa_id` | `string` | ID da empresa |
| `detalhes` | `object` | Payload do evento (varia por `tipo`) |
| `criadoEm` | `timestamp` | Data do evento |

### 🆕 `saas_email_index`
**Document ID:** o próprio e-mail de contato (ex.: `contato@empresa.com`)

Índice de reserva atômica de e-mail — só existe para impedir a corrida
(TOCTOU) do dedup de `saasOnboardingCriarEmpresa`: duas requisições
concorrentes com o mesmo e-mail não podem mais criar 2 empresas, porque
a segunda falha ao tentar `create()` num documento que a primeira já
reservou. Escrito e lido só pela Cloud Function (Admin SDK, sem Rule —
não é acessado pelo client).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `empresa_id` | `string` | ID da empresa que reservou este e-mail |
| `criadoEm` | `timestamp` | Data da reserva |

### `notificacoes_saas`
**Document ID:** Auto-generated

⚠️ **Código morto, confirmado na auditoria técnica independente 2026-07-17**
— sem Rule no arquivo deployado (`CRM/firestore.rules`) e sem nenhum
importador vivo (só era referenciada pelo antigo `CRM/shared/tenant.js`,
já removido). Diferente das demais coleções desta seção, esta não tem
proteção nenhuma se algum código voltar a escrevê-la sem revisar as Rules
primeiro. Mantida aqui só como registro histórico do schema — não usar
como referência para código novo.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tipo` | `string` | Tipo: `licenca_vencida` |
| `empresa_id` | `string` | ID da empresa |
| *(outros campos)* | | |

### `backup_logs`
**Document ID:** Auto-generated

Logs de backups realizados.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tipo` | `string` | Tipo de backup |
| `slot` | `string` | Slot do backup |
| `dataISO` | `string` | Data em ISO |
| *(outros campos)* | | |

---

## 21. Coleções Legadas / Em Desuso

### 21.1 Com repository preparado na Camada Repository, mas **zero consumidor** (nem UI, nem SDK direto)

Estas têm um `createRepository(...)` já escrito (preparação para fases futuras — ver `CRM/TECHDOC.md` §19), mas nenhum código hoje (`main` nem `develop`) lê ou escreve nelas.

| Coleção | Status | Observação |
|---------|--------|------------|
| `estoque` | ❌ Inativa | A coleção real é `estoque_produtos`. Regra no Firestore Rules está órfã. Só aparece em cópias de backup do Dashboard (`BACKUP_REDESIGN_PAINEL_2026-06-14/`). |
| `historico_diario` | ❌ Inativa | Nenhuma ocorrência em código ativo |
| `historico_semanal` | ❌ Inativa | Nenhuma ocorrência em código ativo |
| `historico_mensal` | ❌ Inativa | Nenhuma ocorrência em código ativo |
| `resumo_live` | ❌ Inativa | Nenhuma ocorrência em código ativo |
| `acoes_semana` | ❌ Inativa | Nenhuma ocorrência em código ativo |
| `posvenda_rastreamento` | ❌ Inativa | Nenhuma ocorrência em código ativo |
| `produtos` | ⚠️ Fallback | Usada como fallback em `dashboard-busca.js` **e** em `estoque.js` (Fase 1) se `estoque_produtos` estiver vazia |

### 21.2 Regras realmente órfãs no arquivo deployado (`CRM/firestore.rules`)

> **Correção (2026-07-07):** a versão original desta seção (mesmo dia, revisão anterior) tinha sido montada cruzando o `firestore.rules` da **raiz** do repositório — um arquivo duplicado, nunca deployado, abandonado desde 2026-07-01 (ver `plans/RESOLUCAO_DUPLICIDADE_FIRESTORE_RULES_20260707.md` para o diagnóstico completo). Isso produziu uma lista de "26 regras órfãs" que na verdade não existem no arquivo real (`CRM/firestore.rules`, o único referenciado por `firebase.json` e usado em todo deploy). A tabela abaixo substitui a anterior.

Cruzando `CRM/firestore.rules` (63 caminhos) contra todo o código-fonte ativo (`main`+`develop`, excluindo `_BACKUPS/`, incluindo padrões indiretos como constantes locais e `doc(db, ...array)`), só **2 coleções** têm regra real e nenhum código consumidor:

| Coleção | Regra | Origem | Risco de remoção | Recomendação |
|---------|-------|--------|-------------------|--------------|
| `clients` | `allow read, write: if false;` (bloco "BLOQUEADO: Coleções legadas") | Presente desde o primeiro commit do projeto (2026-06-10); comentário em `CRM/scripts/firebase.js` confirma "coleção legada que nenhuma página usa" | Baixo — já é `if false`, remover a regra não muda nenhum comportamento | Segura para remover (requer autorização de alteração de Firestore Rules) |
| `orders` | `allow read, write: if false;` (idem) | Idem — nome anterior a `os` | Baixo | Idem |

Detalhamento completo (caminho exato da rule, confiança da origem, dependências) em `plans/AUDITORIA_FIRESTORE_RULES_ORFAS_20260707.md`.

**`gdrive_backup` foi removida desta lista** — investigação mais profunda encontrou consumidor real (`CRM/shared/gdrive-backup.js`, via padrão `doc(db, ...array)`); documentada agora em §18.

**As demais 23 coleções da lista anterior** (`assinaturas`, `auditoria_logs`, `automacao_execucoes`, `automacao_logs`, `backup_historico`, `categorias_wpp`, `chat_historico`, `configuracoes`, `diario_metas`, `encomendas`, `estoque_config`, `estoque_movimentacoes`, `financeiro_cat_despesas`, `fornecedores`, `historico_alertas`, `lancamentos_caixa`, `lixeira`, `monitoramento`, `pendencias`, `preferencias_sistema`, `robo_atividade`, `tarefas_robo`, `teste_caixa`) **não têm regra nenhuma no arquivo deployado** — só existiam no `firestore.rules` da raiz (duplicado, não usado). Não são risco de segurança nem pendência de limpeza de regras; a pendência real é decidir o destino do arquivo duplicado da raiz (ver `plans/RESOLUCAO_DUPLICIDADE_FIRESTORE_RULES_20260707.md` §5-6 para o plano de remoção preparado, ainda não executado).

**Nenhuma alteração foi feita em `firestore.rules` (nenhum dos dois arquivos) nesta revisão.**

---

## 22. Resumo de Relacionamentos entre Coleções

```
clientes (phoneDigits)
  ├── history[] ──────────────► os (id)
  └── crmLeads[] ────────────► crm_leads (auto-id)

os (id)
  ├── clientName/phone ──────► clientes (phoneDigits)
  ├── garantiaId ────────────► [config local: garantias]
  ├── crmLeadId ─────────────► crm_leads (auto-id)
  └── preOsId ───────────────► pre_os (auto-id)

crm_leads (auto-id)
  └── telefone ──────────────► clientes (phoneDigits)

caixa_lancamentos (auto-id)
  ├── categoria ─────────────► categorias_caixa (nome)
  └── descricao ─────────────► estoque_produtos (nome) [autocomplete]

vendas_importadas (beep_id) 🆕
  └── gera lançamento ───────► caixa_lancamentos (auto-id) [quando total > 0]

financeiro_receber / financeiro_pagar 🆕 (auto-id / manual)
  ├── categoria (pagar) ─────► financeiro_categorias (auto-id) 🆕
  └── osId (receber) ────────► os (id)

posvenda_contatos (osId_prazo)
  └── osId ──────────────────► os (id)

pre_os (auto-id)
  └── osId ──────────────────► os (id) [quando convertida]

solicitacoes_diagnostico (auto-id)
  └── osId ──────────────────► os (id) [quando convertida]

alertas_usuario (id)
  ├── leadId ────────────────► crm_leads (auto-id)
  └── osId ──────────────────► os (id)

avaliacoes (auto-id)
  └── osId ──────────────────► os (id)

comandos (auto-id) 🆕
  ├── categoria ─────────────► categorias_comandos (nome) [+ lista fixa no código]
  └── migradoDe ─────────────► informacoes (auto-id) [migração v1]

informacoes (auto-id) 🆕
  ├── categoria ─────────────► categorias_informacoes (nome) [+ lista fixa no código]
  └── migracaoDestinoId ─────► comandos (auto-id) [migração v1]

usuarios (uid)
  ├── perfil_operacional_id ─► perfis_operacionais (slug)
  ├── empresa_id ────────────► empresas (empresa_id) 🆕 [resolução de tenant, fallback single-tenant]
  ├── (uid) ─────────────────► favoritos_usuarios/{uid} 🆕
  ├── (uid) ─────────────────► notas_usuarios/{uid} 🆕
  ├── (uid) ─────────────────► tarefas_semana/{uid} 🆕
  ├── (uid) ─────────────────► central_alertas_status/{uid} 🆕
  └── (uid) ─────────────────► alarme_config/{uid} 🆕

diario_registros (auto-id)
  └── (id) ──────────────────► diario_eventos.registroId 🆕 [linha do tempo]

cc_lixeira (modulo+registroId) 🆕
  └── modulo/registroId ─────► coleção original do módulo (snapshot preservado em `registro`)

portal_eventos (auto-id) 🆕
  └── telefone ──────────────► clientes (phoneDigits) [não é FK formal, é analytics]

agenda (data ISO)
  └── (data vinculada a OS via texto da nota)
```

---

## 🔍 Como identificar novas coleções

Ao analisar código ou adicionar novas funcionalidades:

1. **Busque no código**: `grep -rn "collection(db, '" --include="*.js" --include="*.html"` **e também** `grep -rnE "const [A-Z_]+\s*=\s*'[a-z_]+'"` — muitos módulos guardam o nome da coleção numa constante (`const COL = 'comandos'`) em vez de escrever o literal direto na chamada, o que passa batido numa busca só pelo literal inline.
2. **Confira a Camada Repository**: `grep -n "createRepository(" CRM/repositories/*.repository.js` lista hoje 58 coleções mapeadas (Fase 0/1 inclusive, algumas ainda só em `develop`) — nem todas têm um consumidor de UI ainda (ver §21.1); tê-las mapeadas não significa que já estejam documentadas aqui.
3. **Verifique as regras**: `firestore.rules` pode conter coleções referenciadas que já não têm código nenhum — não presuma que uma regra existente corresponde a uso ativo (ver §21.2).
4. **Verifique as Cloud Functions**: `grep -rn "\.collection(" functions/*.js` — algumas coleções (ex.: `portal_eventos`) só são escritas hoje pelo backend (Admin SDK), não pelo cliente.
5. **Evite duplicação**: verifique neste documento se a coleção já existe antes de criar uma nova.
6. **Padrão de nome**: use `snake_case` e prefixo do módulo (ex: `fornecedor_`, `caixa_`, `estoque_`).

---

## 22. Adendo — Revisão 2026-07-10 (release v2026.07.10) 🆕

Quatro coleções entraram com as Sprints 10/13/15 e a aba Cadastro do
Fornecedor, todas **sem rule** até a revisão técnica de 2026-07-10
(TECHDOC §30.1), que adicionou o padrão `temAcessoLiberado()`.
⚠️ Deploy das rules nos projetos `cellcity-crm` (PROD) e
`cellcity-crm-dev` (DEV) ainda pendente.

### `chat_mensagens`
**Document ID:** Auto-generated · **Módulo:** Chat interno (Sprint 15) — **DESATIVADO em 2026-07-10** (TECHDOC §31; código/rules/coleção preservados)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `de` / `para` | `string` | UIDs remetente/destinatário |
| `participantes` | `array<string>` | UIDs para query com `array-contains` |
| `texto` | `string` | Conteúdo da mensagem |
| `criadoEm` | `timestamp` | Envio (serverTimestamp) |

Rule: leitura/criação com `temAcessoLiberado()`; `update`/`delete` negados (mensagens imutáveis).

### `compras_pedidos`
**Document ID:** Auto-generated · **Módulo:** Compras (Sprint 13) + botão "estoque baixo → compras" do Fornecedor. Pedidos de compra (item, quantidade, fornecedor, status).

### `financeiro_fechamentos`
**Document ID:** `AAAA-MM` (um doc por mês) · **Módulo:** Financeiro — Fechamento Mensal Automático (Sprint 10). Snapshot mensal de receitas/despesas/saldo.

### `fornecedores_cadastro`
**Document ID:** Auto-generated · **Módulo:** Fornecedor, aba Cadastro (CRUD completo). Dados cadastrais de fornecedores (nome, contato, observações).
