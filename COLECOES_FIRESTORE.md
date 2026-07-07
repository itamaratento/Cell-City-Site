# 📁 Catálogo Completo de Coleções Firestore — Cell City CRM

> **Última atualização:** Julho 2026  
> **Propósito:** Documento mestre de todas as coleções do Firestore usadas no sistema Cell City CRM.  
> **Convenção:** Nomes em `código` são os literais usados nas chamadas `collection(db, '...')`.

---

## Índice
1. [Módulo OS (Ordem de Serviço)](#1-módulo-os-ordem-de-serviço)
2. [Módulo CRM Comercial](#2-módulo-crm-comercial)
3. [Módulo Caixa / Financeiro](#3-módulo-caixa--financeiro)
4. [Módulo Estoque](#4-módulo-estoque)
5. [Módulo Fornecedor](#5-módulo-fornecedor)
6. [Módulo Pós-Venda](#6-módulo-pós-venda)
7. [Módulo Agenda / Ação da Semana](#7-módulo-agenda--ação-da-semana)
8. [Módulo Portal do Cliente](#8-módulo-portal-do-cliente)
9. [Módulo Usuários / Permissões](#9-módulo-usuários--permissões)
10. [Módulo Alertas / Central de Alertas](#10-módulo-alertas--central-de-alertas)
11. [Módulo Diário](#11-módulo-diário)
12. [Módulo Autoatendimento / Pré-OS](#12-módulo-autoatendimento--pré-os)
13. [Configurações do Sistema](#13-configurações-do-sistema)
14. [Auditoria e Logs](#14-auditoria-e-logs)
15. [Coleções Legadas / Em Desuso](#15-coleções-legadas--em-desuso)
16. [Resumo de Relacionamentos entre Coleções](#16-resumo-de-relacionamentos-entre-coleções)

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

---

## 3. Módulo Caixa / Financeiro

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
**Document ID:** Auto-generated (ex: `os_OS-0001_...`)

Contas a receber (gerado automaticamente ao criar OS com valor).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `descricao` | `string` | Descrição |
| `vencimento` | `string` | Data de vencimento |
| `valor` | `number` | Valor |
| `status` | `string` | Status: `pendente`, `pago` |
| `obs` | `string?` | Observações |
| `origem` | `string` | Origem: `os` |
| `osId` | `string?` | ID da OS vinculada |
| `atualizadoEm` | `timestamp` | Última atualização |

---

## 4. Módulo Estoque

### `estoque_produtos`
**Document ID:** Auto-generated

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

---

## 5. Módulo Fornecedor

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

## 6. Módulo Pós-Venda

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

## 7. Módulo Agenda / Ação da Semana

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

---

## 8. Módulo Portal do Cliente

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

---

## 9. Módulo Usuários / Permissões

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

---

## 10. Módulo Alertas / Central de Alertas

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

---

## 11. Módulo Diário

### `diario_registros`
**Document ID:** Auto-generated

Registros de revisão do diário.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `dataRevisao` | `string?` | Data da revisão (YYYY-MM-DD) |
| `status` | `string?` | Status: `pendente`, `concluido`, `arquivado` |
| *(outros campos conforme implementação)* | | |

---

## 12. Módulo Autoatendimento / Pré-OS

### `pre_os`
**Document ID:** Auto-generated

Pré-Ordens de Serviço (do autoatendimento / portal).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `nome` | `string?` | Nome do cliente |
| `telefone` | `string?` | Telefone |
| `status` | `string` | Status: `AGUARDANDO_CONVERSAO`, `CONVERTIDA` |
| `osId` | `string?` | ID da OS convertida |
| `atualizadoEm` | `string?` | Última atualização |

---

## 13. Configurações do Sistema

### `config`
**Document ID:** Chave de configuração

Configurações gerais do sistema.

| Sub-documento | Campos | Descrição |
|---------------|--------|-----------|
| `crm_pre_os_counter` | `{ ultimo: number }` | Contador sequencial de Pré-OS |
| *(outros) | | Configurações diversas |

---

## 14. Auditoria e Logs

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

### `notificacoes_saas`
**Document ID:** Auto-generated

Notificações do sistema (ex: licença vencida).

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

## 15. Coleções Legadas / Em Desuso

Estas coleções **possuem regras no Firestore** mas **não são mais usadas** por código ativo. Foram identificadas durante auditoria de código e podem ser removidas em limpeza futura.

| Coleção | Status | Observação |
|---------|--------|------------|
| `estoque` | ❌ Inativa | A coleção real é `estoque_produtos`. Regra no Firestore Rules está órfã. |
| `historico_diario` | ❌ Inativa | Nenhuma ocorrência em código ativo |
| `historico_semanal` | ❌ Inativa | Nenhuma ocorrência em código ativo |
| `historico_mensal` | ❌ Inativa | Nenhuma ocorrência em código ativo |
| `resumo_live` | ❌ Inativa | Nenhuma ocorrência em código ativo |
| `acoes_semana` | ❌ Inativa | Nenhuma ocorrência em código ativo |
| `posvenda_rastreamento` | ❌ Inativa | Nenhuma ocorrência em código ativo |
| `produtos` | ⚠️ Fallback | Usada como fallback em `dashboard-busca.js` se `estoque_produtos` estiver vazia |

---

## 16. Resumo de Relacionamentos entre Coleções

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

financeiro_receber (auto-id)
  └── osId ──────────────────► os (id)

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

usuarios (uid)
  └── perfil_operacional_id ─► perfis_operacionais (slug)

agenda (data ISO)
  └── (data vinculada a OS via texto da nota)
```

---

## 🔍 Como identificar novas coleções

Ao analisar código ou adicionar novas funcionalidades:

1. **Busque no código**: `grep -r "collection(db, '" --include="*.js" --include="*.html"`
2. **Verifique as regras**: `firestore.rules` pode conter coleções referenciadas
3. **Evite duplicação**: Verifique neste documento se a coleção já existe
4. **Padrão de nome**: Use `snake_case` e prefixo do módulo (ex: `fornecedor_`, `caixa_`, `estoque_`)
