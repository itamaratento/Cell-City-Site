# Cell City Control Center

Documentação oficial da arquitetura. Este documento é a autoridade sobre
como o Control Center é organizado e como ele deve crescer — qualquer
Sprint futura que adicione um módulo ou uma versão nova do roadmap deve
seguir o que está descrito aqui.

## Objetivo

Centralizar toda a administração técnica do Cell City CRM em um único
ponto de entrada: o comando `cellcity`, executado no Terminal do Ubuntu.

O Control Center **não é uma aplicação web**. Não é hospedado no domínio,
não é acessado pelo navegador, não faz parte da interface usada pelos
clientes e nunca é publicado no GitHub Pages. É uma ferramenta de terminal,
usada exclusivamente pelos desenvolvedores do projeto.

Ele vive dentro do mesmo repositório do CRM (`Cell-City-Site`), versionado
normalmente pelo Git (acompanha `develop`, `main`, tags e o sistema oficial
de backup — ver `../../GUIA_ROLLBACK.md` e o backup de
`../../scripts/backup/`), mas em uma estrutura própria e totalmente isolada
do código do CRM (`../../CRM/`). Um problema no CRM não pode derrubar o
Control Center, e vice-versa.

## Arquitetura

```
CRM                 → usado pelos clientes (site + app do CRM).
Control Center       → usado exclusivamente pelos desenvolvedores,
                        via Terminal do Ubuntu.
```

```
scripts/control-center/
  core/            núcleo: menu principal e dispatch (core/menu.sh).
                   Não conhece a lógica interna de nenhum módulo — só
                   sabe o caminho do menu.sh de cada um.
  modules/         um módulo por pasta. Código 100% isolado — nenhum
                   módulo importa código de outro módulo.
  lib/             funções compartilhadas entre core/ e modules/
                   (lib/common.sh: cabeçalho, status, pausa, log).
  logs/            log de execução (control-center.log). Conteúdo
                   nunca versionado — só a estrutura (logs/.gitkeep).
  docs/            documentação específica de cada módulo, conforme
                   ganham funcionalidade real.
  config/          metadados e configuração do Control Center
                   (control-center.conf: versão, fase atual).
  plugins/         reservado para a Versão 3.0 (Automação Inteligente).
                   Vazio de propósito nesta Fase 1.
  README.md        este arquivo.
```

Fluxo de uma execução: `cellcity` (função em `~/.bashrc`) → chama
`core/menu.sh` → menu principal lê a opção escolhida → `core/menu.sh`
despacha para `modules/<módulo>/menu.sh` → módulo executa e devolve o
controle ao menu principal.

## Roadmap

**Versão 1.0 — Infraestrutura do Projeto** (esta Fase 1 cobre só a
estrutura + menu; itens abaixo entram em Fases seguintes da mesma versão)
- Desenvolvimento
- Release
- Backup
- Recuperação
- Banco de Dados
- Branches
- Diagnóstico

**Versão 2.0 — Administração dos Módulos**
Financeiro, Caixa, CRM, OS, Estoque, Dashboard, Portal Cliente, Garantias,
Compras, Fornecedores, Usuários, RBAC, Auditorias, Épicos, Performance,
Segurança.

**Versão 3.0 — Automação Inteligente**
Auditorias automáticas, monitoramento, health check automático, alertas,
relatórios inteligentes, assistente de recuperação.

**Versão 4.0 — Operação da Empresa**
Marketing, WhatsApp, Google Ads, financeiro da empresa, indicadores,
agenda, pós-venda, estatísticas.

**Versão 5.0 (reservada)** — sem escopo definido. A arquitetura desta Fase
1 (módulos isolados + core que só conhece caminhos) já foi desenhada para
não precisar de reorganização quando essa versão for planejada.

## Princípios

1. Arquitetura antes de funcionalidade — nenhuma decisão de estrutura deve
   precisar ser desfeita por uma versão futura.
2. Organização — um módulo por pasta, sem misturar código.
3. Segurança — o Control Center nunca deve ser um caminho alternativo para
   contornar as regras de proteção do CRM (`../../CLAUDE.md`).
4. Escalabilidade — crescer é sempre aditivo (nova pasta em `modules/`),
   nunca uma reescrita do núcleo.
5. Manutenibilidade — código simples, legível, documentado; nunca a
   solução mais rápida às custas de reorganizar depois.

A velocidade de desenvolvimento nunca deve comprometer estes princípios.

## Como adicionar um novo módulo

1. Criar a pasta `modules/<nome-do-modulo>/` com um `menu.sh` executável
   (`chmod +x`).
2. O `menu.sh` do módulo deve:
   - resolver seu próprio `CC_ROOT` (não depender de variáveis herdadas do
     processo pai — cada módulo tem que rodar isolado, mesmo chamado
     direto sem passar pelo `core/menu.sh`);
   - dar `source` em `lib/common.sh`;
   - usar `_cc_header`, `_cc_ok`/`_cc_fail`/`_cc_warn`, `_cc_pause` e
     `_cc_log` para manter a mesma UI e o mesmo padrão de log de todos os
     outros módulos.
3. Adicionar uma linha nova em `_cc_dispatch()` (`core/menu.sh`) e uma
   opção nova no texto do menu principal.
4. Nunca alterar a lógica de outro módulo para acomodar o novo.
5. Adicionar a estrutura correspondente em
   `tests/control-center/estrutura.test.mjs` (ver "Padrão de testes").

## Padrão de desenvolvimento

- Bash puro (`#!/bin/bash`, `set -uo pipefail`) — sem dependência de
  runtime externo, coerente com o restante do projeto (mesmo padrão de
  `scripts/release/release-center.sh` e `scripts/backup/*.sh`).
- Cada `menu.sh` de módulo é autossuficiente: recalcula `CC_ROOT` a partir
  do próprio caminho (`BASH_SOURCE[0]`), nunca assume que foi chamado só
  pelo `core/menu.sh`.
- Nenhum módulo importa/faz `source` de outro módulo. Só `lib/common.sh` é
  compartilhado.
- Módulo sem funcionalidade implementada ainda deve chamar
  `_cc_placeholder "<Nome do módulo>"` (ver `lib/common.sh`) — nunca deixar
  uma opção do menu principal sem destino.

## Padrão de menus

- Navegação exclusivamente por opções numéricas (`read -rp`), nunca por
  atalhos de letra.
- `0` sempre volta/sai — no menu principal, sai do Control Center; dentro
  de um módulo com submenu próprio, volta ao menu anterior.
- Cabeçalho padronizado via `_cc_header` (mesma borda `====` usada em
  todos os menus do projeto, incluindo o Release Center).
- Opção inválida nunca derruba o programa — só imprime aviso e reexibe o
  menu.

## Padrão de logs

- Toda ação relevante (abrir o Control Center, escolher uma opção, entrar
  em um módulo) grava uma linha em `logs/control-center.log` via
  `_cc_log "mensagem"`.
- Formato: `[YYYY-MM-DD HH:MM:SS] mensagem`.
- A pasta `logs/` acompanha o repositório (estrutura), mas o conteúdo
  (`*.log`) nunca é versionado — ver exceção dedicada em `../../.gitignore`
  (`!scripts/control-center/logs/`) que preserva só o `.gitkeep`.

## Padrão de testes

- Suíte automatizada em `../../tests/control-center/estrutura.test.mjs`
  (Node `node:test`, mesmo padrão de `tests/integrity/`), validando:
  - toda a árvore de pastas obrigatória existe;
  - todo módulo do menu principal tem um `menu.sh` executável;
  - sintaxe bash válida (`bash -n`) em todos os scripts do Control Center;
  - navegação completa do menu principal (opções 1 a 9 e saída pela
    opção 0) sem travar nem quebrar.
- Registrada em `../../.github/workflows/tests.yml`, junto das demais
  suítes do projeto.
- Verificação manual do comando `cellcity` (depende de `~/.bashrc`, fora
  do repositório) fica de fora da suíte automatizada — é homologada à mão
  antes de cada promoção que altere o Control Center.

## Padrão de documentação

- Este `README.md` é a referência única da arquitetura, do roadmap e dos
  princípios — atualizar aqui antes de começar uma Sprint que mude
  qualquer um dos três.
- Documentação específica de um módulo (quando ganhar funcionalidade real)
  vai em `docs/<nome-do-modulo>.md`, não neste arquivo.
- Toda decisão que precisar de contexto histórico (por que um módulo foi
  feito de um jeito específico) segue o mesmo padrão do resto do projeto:
  comentário no próprio código quando afeta manutenção futura, nunca em
  arquivo solto fora do controle de versão.
