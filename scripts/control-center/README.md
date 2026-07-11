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
  VERSION          versão semver do Control Center (fonte única — ver
                   "Fluxo de inicialização"). Ex.: 1.0.0-alpha.
  core/            núcleo: menu principal e dispatch (core/menu.sh).
                   Não conhece nenhum módulo por nome — o menu inteiro é
                   carregado do Manifesto (config/modules.conf).
  modules/         um módulo por pasta. Código 100% isolado — nenhum
                   módulo importa código de outro módulo.
  lib/             funções compartilhadas entre core/ e modules/
                   (common.sh: status, pausa, placeholder e log;
                   ui-box.sh: moldura padrão de todo menu/submenu;
                   plugin-loader.sh: carregamento de plugins/).
  state/           Estado do Sistema: um .json por rotina (release,
                   backup, homologação, restauração, health check,
                   sincronização) registrando a última execução de cada
                   uma. Nesta Fase 1.1 só o schema existe (campos null) —
                   nenhum módulo escreve neles ainda (ver state/README.md).
  logs/            log de execução (control-center.log). Conteúdo
                   nunca versionado — só a estrutura (logs/.gitkeep).
  docs/            documentação específica de cada módulo, conforme
                   ganham funcionalidade real.
  config/          config/control-center.conf (fase atual) e
                   config/modules.conf (Manifesto Oficial dos Módulos).
  plugins/         reservado para a Versão 3.0 (Automação Inteligente).
                   Vazio de propósito, mas já com o Plugin Loader pronto
                   (lib/plugin-loader.sh) — ver plugins/README.md.
  README.md        este arquivo.
```

## Fluxo de inicialização

Toda execução de `cellcity` segue sempre a mesma sequência, em
`core/menu.sh`:

1. Resolve `CC_ROOT` a partir do próprio caminho do script (nunca depende
   do diretório de onde `cellcity` foi chamado).
2. Carrega `lib/common.sh` (UI/log) e `lib/plugin-loader.sh`.
3. Carrega `config/control-center.conf` (Fase atual) e lê `VERSION`
   (versão semver).
4. Carrega o Manifesto (`config/modules.conf`) para dentro de arrays —
   é dali que o menu principal e o dispatch são montados, nunca hardcoded.
5. Roda `_cc_load_plugins` (varre `plugins/*/plugin.sh`; sem nenhum
   plugin instalado, não faz nada).
6. Registra o boot em `logs/control-center.log` e entra no loop do menu.
7. A cada opção escolhida: grava no log, localiza o módulo correspondente
   no Manifesto e executa `modules/<slug>/menu.sh`; ao retornar, reexibe o
   menu principal. `0` sempre sai.

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
   - dar `source` em `lib/common.sh` (que já carrega `lib/ui-box.sh`
     transitivamente);
   - se ainda não tem funcionalidade real, chamar só
     `_cc_placeholder "<Nome do módulo>"`;
   - quando ganhar um submenu de verdade, montar a tela só com as funções
     de `lib/ui-box.sh` (`_cc_box_top`/`_cc_box_line_center`/`_cc_box_sep`/
     `_cc_box_item`/`_cc_box_blank`/`_cc_box_bottom`) — nunca `echo` cru
     de borda, pra não fugir do padrão visual (ver "Padrão de menus");
     rodapé com `9 ► Voltar` + `0 ► Sair` quando o submenu tiver navegação
     própria (só `0 ► Sair`/`0 ► Voltar` quando não tiver).
   - usar `_cc_ok`/`_cc_fail`/`_cc_warn` (fora da caixa, nunca dentro) e
     `_cc_log` para manter o mesmo padrão de status e de log de todos os
     outros módulos.
3. Adicionar uma linha nova em `config/modules.conf` (o Manifesto) — nunca
   em `core/menu.sh`, que não conhece nenhum módulo por nome.
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

Padronização visual obrigatória desde a Fase 1.1 ("Ajuste de Arquitetura —
Padronização dos Menus e Submenus") — nenhuma tela nova pode fugir disto,
em nenhuma fase futura:

- Toda tela (menu principal, submenu de módulo, placeholder) é desenhada
  só com as funções de `lib/ui-box.sh` — moldura em caixa (`╔═╗`/`║`/`╚═╝`),
  título centralizado, item numerado com `►`, rodapé com `0` sempre
  presente. Nunca um `echo` cru de borda, nunca uma tela com layout
  diferente da outra.
- Responsivo: a largura da caixa se adapta ao terminal (`tput cols`), com
  teto de 56 colunas de conteúdo (não deixa a caixa virar uma linha só de
  bordas num terminal enorme) e piso de 30 (nunca fica ilegível). Terminais
  menores que ~34 colunas são um caso extremo fora de alcance — não são o
  uso normal do Terminal do Ubuntu.
- Navegação exclusivamente por opções numéricas (`read -rp`), nunca por
  atalhos de letra.
- `0` sempre volta/sai — no menu principal, sai do Control Center; dentro
  de um submenu de módulo, `9 ► Voltar` retorna ao menu anterior e
  `0 ► Sair` sai do Control Center inteiro (mesma convenção nos dois
  níveis). Telas sem opções próprias (placeholder) têm só `0 ► Voltar`.
- Nenhum emoji dentro da caixa (✅/❌/⚠️/🚧) — emoji ocupa 2 colunas visuais
  em terminais reais mas só 1 posição em `${#string}`, o que desalinharia
  a borda direita. Status com emoji (`_cc_ok`/`_cc_fail`/`_cc_warn`)
  continua existindo, mas sempre fora de uma caixa — mesmo padrão que
  `scripts/release/release-center.sh` já usa pros seus checks.
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
  - toda a árvore de pastas obrigatória existe (incluindo `state/`);
  - `VERSION` existe e tem formato semver (com sufixo opcional tipo
    `-alpha`), e o menu principal exibe essa versão;
  - o Manifesto (`config/modules.conf`) tem as 9 entradas esperadas e
    `core/menu.sh` não tem nenhum módulo hardcoded;
  - os 6 arquivos de `state/` existem com o schema esperado (campos null);
  - todo módulo do menu principal tem um `menu.sh` executável;
  - sintaxe bash válida (`bash -n`) em todos os scripts do Control Center;
  - toda tela usa a moldura de `lib/ui-box.sh` (bordas `╔`/`║`/`╚`
    presentes, sem `echo` cru de `====`);
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
