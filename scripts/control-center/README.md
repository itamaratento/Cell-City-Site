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
  lib/             funções compartilhadas entre core/ e modules/ — ver
                   "Componentes de UX" logo abaixo pra cada arquivo.
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

## Componentes de UX (Fase 1.2)

A UX é uma camada separada da lógica de negócio (`core/menu.sh` e cada
`modules/<slug>/menu.sh` só chamam estes componentes, nunca desenham nada
na mão). Cada arquivo de `lib/` tem uma responsabilidade só:

| Arquivo             | Componente                        | Responsabilidade |
|---------------------|------------------------------------|-------------------|
| `ui-colors.sh`      | Cores                              | Detecta suporte a ANSI uma vez por processo (`tput colors`, `NO_COLOR`, `[ -t 1 ]`) e expõe `_CC_C_VERDE`/`_CC_C_AMARELO`/`_CC_C_VERMELHO`/`_CC_C_CIANO`/`_CC_C_NEGRITO`/`_CC_C_RESET` — vazias quando não há suporte, nunca quebra. |
| `ui-box.sh`         | Boxes                              | Moldura em caixa (bordas, item, texto, centralização), responsiva ao terminal, consciente de sequências ANSI ao calcular alinhamento (ver "Padrão de menus"). |
| `ui-status.sh`      | Status                             | Lê o estado real do Git (`_cc_git_branch`, `_cc_projeto_status_label`) pro bloco Projeto/Branch/Status do menu principal. |
| `ui-screen.sh`      | Cabeçalho / Rodapé / Menus         | Composição de tela: `_cc_screen_title` (título+subtítulo), `_cc_screen_status_block` (Projeto/Branch/Status), `_cc_screen_breadcrumb` (localização atual), `_cc_screen_footer` (mensagem de ajuda + borda final), `_cc_run_submenu` (Fase 2 — motor genérico de submenu com itens numerados + Voltar/Sair, ver "Arquitetura de serviços"). |
| `ui-widgets.sh`     | Mensagens / Barras / Confirmações  | `_cc_confirm` (pergunta sim/não) e `_cc_bar` (barra de progresso textual). Usados desde a Fase 2 pelos módulos Desenvolvimento/Release em toda ação destrutiva/irreversível. `_cc_ok`/`_cc_fail`/`_cc_warn` (em `common.sh`) seguem sendo o componente de "Mensagens" de status, sempre fora de uma caixa. |
| `svc-git.sh`        | Serviço de Git (Fase 2)            | `_cc_svc_git_status_verbose`/`_diff`/`_log`/`_arquivos_alterados_count`/`_workspace_limpo`/`_ultimo_commit`/`_branch_reconhecida` — compartilhado pelos módulos Desenvolvimento e Release (nenhum dos dois duplica lógica de Git). Complementa `ui-status.sh` (que já cobre branch/rótulo colorido do menu principal). |
| `common.sh`         | Ponto único de entrada             | `source "$CC_ROOT/lib/common.sh"` já carrega todos os arquivos acima (exceto `svc-git.sh`, opcional — ver "Arquitetura de serviços"), transitivamente. Também tem `_cc_log`, `_cc_pause` e `_cc_placeholder`. |
| `plugin-loader.sh`  | —                                   | Carregamento de `plugins/*/plugin.sh` (ver Roadmap, Versão 3.0). |

## Arquitetura de serviços (Fase 2)

A partir da Fase 2 ("Desenvolvimento + Release"), todo módulo com
funcionalidade real segue uma separação estrita entre Interface e Serviço
— "nenhuma regra de negócio na camada visual":

```
modules/<slug>/
  menu.sh          Interface: só monta o submenu (via _cc_run_submenu,
                   ver lib/ui-screen.sh) e aponta cada item pra uma
                   função de serviço. Nunca roda git/npm/comando direto.
  lib/
    <arquivo>.sh   Serviço(s): a lógica de verdade, uma responsabilidade
                   por arquivo. Recebe REPO_DIR (definido pelo menu.sh do
                   módulo, mesmo padrão de CC_ROOT).
```

- `modules/desenvolvimento/lib/status.sh` — Status do Projeto/Git Status/
  Diff/Log/Alterações Locais (formata a saída de `lib/svc-git.sh`).
- `modules/desenvolvimento/lib/comandos.sh` — Comandos: Build/Testes/Lint/
  Formatação/Cache/Dependências.
- `modules/desenvolvimento/lib/utilitarios.sh` — Utilitários: Abrir
  Diretório do Projeto/Informações do Ambiente.
- `modules/release/lib/release.sh` — Release: validações (branch/
  workspace), changelog/histórico, e as delegações abaixo.

**Regra de ouro do módulo Release: envelopar, nunca reimplementar.** Este
projeto já tinha, antes da Fase 2, um pipeline de release maduro e testado
(`subir` → `release` → `subir-ok`, mais `rollback` — ver `../../.bashrc` e
`scripts/release/`). O módulo Release do Control Center **não** cria uma
segunda forma de fazer tag/push/promoção/rollback — cada ação do menu
delega pro mecanismo que já existe:

| Ação no menu                  | Delega para |
|--------------------------------|-------------|
| Executar Testes                | `scripts/release/release-center.sh` (opção 2, não-interativo) |
| Build Final                    | `scripts/release/validar-deploy.sh` (script próprio, chamado direto) |
| Checklist de Release           | `scripts/release/release-center.sh` (opção 3, não-interativo) |
| Enviar Alterações              | função `subir` de `~/.bashrc` (via `bash -i -c`, única forma de reusar uma função de bashrc a partir de um script) |
| Criar Tag e Publicar           | função `subir-ok` de `~/.bashrc` (idem — preserva 100% dos gates: homologação obrigatória, backup, versionamento semântico, fast-forward pra main) |
| Rollback de Produção           | `scripts/release/rollback.sh` (script próprio) |

`subir`/`subir-ok` não têm script próprio no repositório (só existem como
função de `~/.bashrc`) — por isso são as únicas duas ações que dependem de
`bash -i -c` para serem chamadas a partir de um módulo. Se a função não
existir no `~/.bashrc` de quem roda, o módulo avisa em vez de falhar
silenciosamente. Validar Branch/Validar Workspace Limpo/Gerar Changelog/
Histórico de Releases são leitura pura (não existiam como comando
separado antes) — só essas são "novas" de verdade.

**Módulo Backup e Recuperação (Fase 3)** — mesma regra de ouro. Este
projeto já tinha, antes da Fase 3, o Sistema Oficial de Backup
(`scripts/backup/*.sh`, mais `backup.sh` e `backup-dados.js` na raiz —
ver `../../GUIA_ROLLBACK.md`). Camadas: `lib/backup.sh` (Backup),
`lib/recuperacao.sh` (Recuperação), `lib/validacao.sh` (Validação),
`lib/listagem.sh` (Listagem), `lib/utilitarios.sh` (Utilitários).

| Ação no menu              | Delega para |
|----------------------------|-------------|
| Backup Manual               | `scripts/backup/backup-manual.sh` (commit + push pro repo Cell-City-Backup, tag `manual-<timestamp>`) |
| Backup Automático            | `scripts/backup/backup-automatic.sh` (normalmente só roda via GitHub Actions semanal — rodar manualmente força a rotação do slot) |
| Restaurar Backup             | `scripts/backup/restore-backup.sh` (cria branch local `restore/<data>-<tag>`, nunca toca em develop/main) |
| Listar Backups               | o mesmo `restore-backup.sh`, respondendo "0" (cancelar) — mostra a lista sem restaurar nada |
| Backup do Firebase           | `backup-dados.js` (raiz do repo — export Firestore → JSON; ambiente sempre explícito, dev ou prod, nunca auto-detectado) |
| Backup do Projeto            | `backup.sh` (raiz do repo — rsync rotativo de 2 slots por tipo: diário/semanal/mensal/grande) |

Validar Integridade/Backup das Configurações/Informações dos Backups/
Limpeza de Backups são novos (não existia uma checagem de integridade,
um backup só de configs, ou uma limpeza de backups manuais antes desta
Sprint) — cada um é read-only ou de escopo estreito o suficiente pra não
ser "um novo sistema de backup" (ver "Restrições" desta Sprint no
histórico do projeto). Limpeza nunca remove `auto-slot-*` (rotacionam
sozinhos) nem o backup manual mais recente.

**Achado de segurança desta Sprint:** `backup-manual.sh` faz `git add .`
e commita/publica QUALQUER alteração pendente no working tree, sem
distinguir de quem é — em um checkout com sessões concorrentes (comum
neste projeto, ver [[feedback-concorrencia-sessoes-checkout]] na memória),
isso poderia commitar/publicar trabalho alheio em andamento sem intenção.
`_bkp_manual` detecta working tree sujo e pede confirmação explícita
antes de delegar — o script original não foi alterado.

**Módulo Banco de Dados (Fase 4 — padrão CCC-F04-001)** — administração
somente-leitura do Firestore/Firebase. Camadas: `lib/status.sh` (Status
do Banco), `lib/collections.sh` (Coleções), `lib/indexes.sh` (Índices),
`lib/rules.sh` (Firestore Rules), `lib/functions.sh` (Cloud Functions),
`lib/integrity.sh` (Integridade), `lib/statistics.sh` (Estatísticas),
`lib/export.sh` (Exportações), `lib/config.sh` (Configurações locais do
módulo, em `config/local.json` — escopo isolado, fora do schema de
`state/`).

**Princípio: nenhuma escrita.** Toda checagem ao vivo usa só `gcloud`
(`describe`/`list`) ou GET em `firebaserules.googleapis.com` — nunca
`firebase deploy`, nunca Admin SDK com permissão de escrita. Publicar
Rules/índices/Functions continua sendo exclusivamente `firebase deploy`,
fora deste módulo. Ambiente sempre explícito (mesmo princípio do Backup
e Recuperação) — nenhuma ação deduz sozinha se é `dev` ou `prod`.

Coleções conhecidas vêm da união dos blocos `match` de topo em
`CRM/firestore.rules` (caminho lido de `firebase.json`, nunca hardcoded)
com a lista já cadastrada em `backup-dados.js`. "Coleções órfãs" e
"Rules não utilizadas" são heurísticas por `grep` estático em `CRM/` e
`functions/` — sinalizam candidatos, não substituem revisão manual.
"Documentos"/"uso aproximado" não são mensuráveis sem Admin SDK com
Application Default Credentials (não configuradas por padrão) ou Cloud
Billing API — reportados como indisponíveis, nunca estimados.

**Achados reais desta Sprint:** `firestore.indexes.json` existe na raiz
do repositório, diferente do arquivo oficial (`CRM/firestore.indexes.json`,
usado por `firebase.json`) — provável artefato desatualizado (`firestore.rules`
na raiz, por outro lado, está idêntico ao oficial). 4 índices publicados
em `dev` não estão declarados no arquivo local. 3 blocos de Rules com
`allow ...: if true`, todos documentados no próprio arquivo como acesso
público intencional e estreito (`config`, `pre_os`, `catalogo_config`).

**Módulo Branches e Sincronização (Fase 5)** — mesma regra de ouro:
nenhuma lógica de tag/push/merge/promoção é reimplementada aqui, isso
continua sendo papel exclusivo do módulo Release (`subir`/`subir-ok`/
`rollback`). Diferente de Release/Backup, não havia nenhum script prévio
de branch/stash/sincronização no projeto pra envelopar — as ações abaixo
são novas de propósito, mas de escopo estreito (leitura + ações pontuais
de branch/stash sempre com confirmação, nunca em `develop`/`main`).
Camadas: `lib/status.sh` (Status do Repositório/Branch Atual), `lib/
branches.sh` (Gerenciar Branches: listar/alternar/criar/excluir),
`lib/sync.sh` (Sincronização: `git fetch` + divergências + orientação),
`lib/compare.sh` (Comparar Branches), `lib/history.sh` (Histórico),
`lib/tags.sh` (Tags, inclusive órfãs local×remoto), `lib/stash.sh`
(Stash), `lib/integrity.sh` (Integridade Git), `lib/statistics.sh`
(Estatísticas), `lib/export.sh` (Exportações TXT/Markdown/JSON em
`_reports/git/`, mesmo padrão de `modules/banco-dados/lib/export.sh`),
`lib/tools.sh` (Ferramentas Git, só leitura) e `lib/config.sh`
(Configurações — `branches.conf` próprio do módulo, nunca altera `git
config` global nem `config/control-center.conf`). Documentação completa
em `docs/branches-sincronizacao.md` (inclui a justificativa formal de o
módulo não ter `engine.sh` — ver auditoria CCC-F05-AUD-002).

Auditoria técnica CCC-F05-AUD-002 (2026-07-12) corrigiu 2 desvios frente
à especificação original CCC-F05-001: Exportação (não existia — corrigida
com `lib/export.sh`) e Logs de detalhe por operação (o framework
`_cc_run_submenu` já registrava toda seleção de menu genericamente; esta
auditoria acrescentou `_cc_log` com branch/commit/resultado em cada tela
e mutação, reaproveitando `_cc_log()` — nenhum sistema de log novo). Ver
parecer atualizado.

| Ação                                    | Comportamento |
|------------------------------------------|----------------|
| Sincronização                            | só `git fetch --all --prune` (leitura) + relatório de ahead/behind; nunca `pull`/`push` — publicar é sempre "Release › Enviar Alterações/Criar Tag e Publicar" |
| Excluir Branch Local                     | bloqueia incondicionalmente `develop`/`main` e a branch atual, mesmo com confirmação |
| Alternar/Criar Branch                    | pedem nome (Enter cancela) + `_cc_confirm` antes de qualquer `git checkout`/`git branch` |
| Aplicar/Remover Stash                    | sempre pedem `_cc_confirm`; nunca aplicam/removem automaticamente |
| Exportação                               | TXT/Markdown/JSON somente-leitura, sempre em `_reports/git/` (não versionado) |
| Status/Branch Atual/Histórico/Tags/Comparar/Integridade/Estatísticas/Ferramentas Git | 100% leitura, sem exceção |

"Última sincronização" (Status do Repositório/Estatísticas) é lida do
mtime de `.git/FETCH_HEAD`, não de `state/sincronizacao.json` — nenhum
módulo desta versão (Release/Backup incluídos) ainda escreve nos arquivos
de `state/`, e um módulo novo divergir sozinho desse padrão criaria uma
inconsistência maior do que vale a pena nesta Sprint (ver `state/README.md`).

**Módulo Central de IAs (Fase 10 — padrão CCC-F10-001)** — centro de
organização/documentação/acompanhamento das IAs do projeto, somente
leitura. Camadas: `lib/utils.sh` (Registro de Fases/IAs/Fluxo + config
local), `lib/dashboard.sh` (Dashboard das IAs), `lib/agents.sh` (IAs
Cadastradas), `lib/skills.sh` (Especialidades), `lib/responsibilities.sh`
(Responsabilidades), `lib/workflow.sh` (Fluxo de Desenvolvimento),
`lib/tasks.sh` (Distribuição de Tarefas — só organização, nenhum
gerenciamento automático), `lib/history.sh` (Histórico, via `git log`
real), `lib/audit.sh` (Auditorias, via `docs/PARECER-*.md` reais),
`lib/documentation.sh` (Documentação), `lib/statistics.sh`
(Estatísticas), `lib/export.sh` (Exportações), `lib/config.sh`
(Configurações locais do módulo, em `config/local.json` — mesmo escopo
isolado do Banco de Dados). Detalhe completo em
`modules/central-ias/docs/central-ias.md`.

**Princípio: nenhuma fase/IA/estágio hardcoded em `lib/*.sh`.** Fonte
única em `modules/central-ias/config/{fases,registry,workflow}.conf`
(mesmo espírito de `config/modules.conf`) — atualizar uma fase é só
editar uma linha lá. O estado REAL de cada módulo (implementado/
placeholder/ausente) nunca é assumido a partir do status declarado —
é verificado ao vivo contra `modules/<slug>/menu.sh` a cada consulta
(Dashboard classifica `CRITICO` se um módulo declarado `CONCLUIDA`
não bater com a realidade).

**Achado real desta Sprint:** uma lista unida só por `,`/`→` (sem
espaço) vira, pro word-wrap de `_cc_box_text`, uma "palavra" única sem
ponto de quebra — o trecho que não cabe na largura da caixa é cortado
silenciosamente por `_cc_box_line`. Corrigido usando sempre separador
**+ espaço** (`", "`/`"→ "`) — vale pra qualquer módulo futuro que monte
uma lista dinâmica pra exibir dentro da caixa.

## Fluxo de inicialização

Toda execução de `cellcity` segue sempre a mesma sequência, em
`core/menu.sh`:

1. Resolve `CC_ROOT` e `REPO_DIR` a partir do próprio caminho do script
   (nunca depende do diretório de onde `cellcity` foi chamado).
2. Carrega `lib/common.sh` (que já traz todos os componentes de UX — ver
   "Componentes de UX") e `lib/plugin-loader.sh`.
3. Carrega `config/control-center.conf` (Fase atual) e lê `VERSION`
   (versão semver).
4. Carrega o Manifesto (`config/modules.conf`) para dentro de arrays —
   é dali que o menu principal e o dispatch são montados, nunca hardcoded.
5. Roda `_cc_load_plugins` (varre `plugins/*/plugin.sh`; sem nenhum
   plugin instalado, não faz nada).
6. Registra o boot em `logs/control-center.log` e entra no loop do menu:
   `_cc_screen_title` (título+versão) → `_cc_screen_status_block` (lê
   `REPO_DIR` via Git: branch atual e se o working tree está limpo) →
   itens do Manifesto → `_cc_screen_footer` (mensagem de ajuda).
7. A cada opção escolhida: grava no log, localiza o módulo correspondente
   no Manifesto e executa `modules/<slug>/menu.sh`; ao retornar, reexibe o
   menu principal. `0` sempre sai.

## Roadmap

Roadmap Oficial completo: documento CCC-ROADMAP-001 (11 fases). Status
por fase (ver responsabilidade das IAs logo abaixo):

**Versão 1.0 — Infraestrutura do Projeto**
- ✅ Fase 1 — Estrutura Base, UX e Arquitetura (Claude)
- ✅ Fase 2 — Desenvolvimento e Release (Claude — envelopa `subir`/`release`/`subir-ok`/`rollback`)
- ✅ Fase 3 — Backup e Recuperação (Claude)
- ✅ Fase 4 — Banco de Dados (Claude — CCC-F04-001)
- ✅ Fase 5 — Branches e Sincronização (Claude — inspeção/comparação/`fetch`, nunca `pull`/`push`/`merge`)
- 🔵 Fase 6 — Diagnóstico e Health Check (DeepSeek — implementada, aguardando revisão técnica)
- 🔵 Fase 7 — Ferramentas, Auditorias e Relatórios (DeepSeek — implementada, aguardando revisão técnica)
- ⬜ Fase 8 — Polimento Final, Testes e Certificação (Claude — não iniciada)
- 🔵 Fase 9 — Manutenção e Higienização (DeepSeek — implementada, aguardando revisão técnica)
- ✅ Fase 10 — Central de IAs (Claude — CCC-F10-001)
- ⬜ Fase 11 — Configurações (Claude — não iniciada)

Plano de execução do CCC-ROADMAP-001: Fase 10 → Fase 11 → revisar
Fase 6 → revisar Fase 7 → revisar Fase 9 → executar Fase 8 → auditoria
final → ShellCheck geral → testes automatizados → testes de regressão →
Parecer Executivo CCC-HOM-001 → Release 1.0.

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
   - dar `source` em `lib/common.sh` (que já carrega todos os componentes
     de UX transitivamente — ver "Componentes de UX");
   - se ainda não tem funcionalidade real, chamar só
     `_cc_placeholder "<Nome do módulo>"`;
   - quando ganhar um submenu de verdade, chamar `_cc_run_submenu "<Título>"
     "Control Center › <Nome>" "1|Rótulo|_funcao" "2|Rótulo|_funcao" ...`
     (ver `lib/ui-screen.sh` e "Arquitetura de serviços") — nunca montar o
     loop de menu na mão; cada `_funcao` mora na camada de Serviço
     (`modules/<slug>/lib/*.sh`), nunca dentro de `menu.sh`;
   - usar `_cc_confirm "<pergunta>"` antes de qualquer ação destrutiva/
     irreversível, e `_cc_bar` pra qualquer operação longa que valha
     mostrar progresso (`lib/ui-widgets.sh`);
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
  só com os componentes de `lib/ui-box.sh` e `lib/ui-screen.sh` — moldura
  em caixa (`╔═╗`/`║`/`╚═╝`), título centralizado, item numerado com `►`,
  rodapé com `0` sempre presente. Nunca um `echo` cru de borda, nunca uma
  tela com layout diferente da outra.
- Toda tela tem, na mesma ordem: cabeçalho (título + subtítulo) →
  bloco de contexto (status Projeto/Branch/Status no menu principal;
  breadcrumb "Control Center › <tela atual>" nas telas de módulo) → corpo
  (itens de menu ou texto) → rodapé (mensagem de ajuda + borda final).
  Nenhuma tela pula uma dessas seções.
- Responsivo: a largura da caixa se adapta ao terminal (`tput cols`), com
  teto de 56 colunas de conteúdo (não deixa a caixa virar uma linha só de
  bordas num terminal enorme) e piso de 30 (nunca fica ilegível). Terminais
  menores que ~34 colunas são um caso extremo fora de alcance — não são o
  uso normal do Terminal do Ubuntu.
- Navegação exclusivamente por opções numéricas (`read -rp`), nunca por
  atalhos de letra.
- `0` sempre sai do Control Center inteiro, em qualquer tela. Dentro de um
  submenu com opções reais (via `_cc_run_submenu`), "Voltar" é sempre o
  número seguinte ao último item real — nunca um número fixo como `9`:
  um módulo com 13 opções (ex.: Desenvolvimento) tem "Voltar" em `14`, um
  com 5 tem em `6`. Isso evita colidir com módulos que crescem além de 8
  itens. Telas sem opções próprias (placeholder) têm só `0 ► Voltar`.
- Nenhum emoji dentro da caixa (✅/❌/⚠️/🚧) — emoji ocupa 2 colunas visuais
  em terminais reais mas só 1 posição em `${#string}`, o que desalinharia
  a borda direita. Status com emoji (`_cc_ok`/`_cc_fail`/`_cc_warn`)
  continua existindo, mas sempre fora de uma caixa — mesmo padrão que
  `scripts/release/release-center.sh` já usa pros seus checks.
- Cor ANSI (`lib/ui-colors.sh`) é permitida dentro da caixa (ex.: o valor
  do "Status"). `_cc_box_line`/`_cc_box_line_center` medem o texto pelo
  comprimento *visível* (descontando as sequências de escape), nunca por
  `${#texto}` cru — do contrário a borda direita desalinha. Sem suporte a
  cor no terminal, as variáveis de cor ficam vazias e a tela sai idêntica,
  só sem cor — nunca quebra.
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
  - o menu principal exibe o bloco Projeto/Branch/Status e as telas de
    módulo exibem o breadcrumb;
  - todas as linhas de uma mesma caixa saem com a mesma largura visível
    (alinhamento correto mesmo com texto colorido dentro — ver "Padrão de
    menus");
  - a caixa se adapta de verdade a um `COLUMNS` estreito e a um largo;
  - `_cc_confirm`/`_cc_bar` (`lib/ui-widgets.sh`) se comportam
    corretamente nos limites (0%, 100%, resposta vazia);
  - navegação completa do menu principal (opções 1 a 9 e saída pela
    opção 0) sem travar nem quebrar;
  - módulos Desenvolvimento e Release (Fase 2): submenu com "Voltar"
    dinâmico, ações de leitura (status/branch/workspace/changelog/
    histórico) retornam dado real do Git, ações destrutivas (cache,
    dependências, subir, subir-ok, rollback) pedem confirmação antes de
    executar e cancelam de verdade quando a resposta é "não";
  - módulo Backup e Recuperação (Fase 3): as 6 delegações pro Sistema
    Oficial de Backup são estáticas (grep — nunca executa
    push/commit/force-push real durante o teste, pra não sujar o
    repositório de backup compartilhado a cada rodada de CI); ações
    destrutivas (backup manual com working tree sujo, automático,
    restaurar, limpeza) cancelam de verdade sem tocar em git; Validar
    Integridade/Listar/Informações rodam de verdade (são leitura).
  - módulo Branches e Sincronização (Fase 5): grep confirma a regra de
    ouro (nenhum `git tag`/`push origin main`/`merge` reimplementado, só
    `fetch`); Status/Branch Atual/Histórico/Tags/Comparar/Integridade/
    Estatísticas/Ferramentas Git rodam de verdade (são leitura); Alternar/
    Criar/Excluir Branch cancelam sem nome informado e Excluir nunca
    remove `develop`/`main`; Aplicar/Remover Stash usam um stash real e
    descartável (criado e removido pelo próprio teste) pra provar que
    cancelam sem tocar nele; Configurações cancela edição sem alterar
    `branches.conf`.
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
