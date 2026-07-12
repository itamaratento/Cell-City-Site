# Branches e Sincronização

Módulo de inspeção, comparação e sincronização de branches do Cell City
CRM — CELL CITY CONTROL CENTER, Fase 5 (padrão CCC-F05-001). Documentação
criada pela auditoria CCC-F05-AUD-002, que também corrigiu os desvios
descritos na seção "Correções desta auditoria" abaixo.

## Arquitetura

```
modules/branches-sincronizacao/
  menu.sh              — Interface: submenu via _cc_run_submenu, dispatch.
                          Nenhuma chamada a git — só monta o menu e despacha.
  branches.conf         — Configurações do módulo (remote padrão, branch
                           principal/desenvolvimento, verbosidade, timeout).
  lib/
    status.sh           — Status do Repositório / Branch Atual.
    branches.sh         — Gerenciar Branches: listar/alternar/criar/excluir.
    sync.sh              — Sincronização: git fetch + divergências.
    compare.sh           — Comparar Branches.
    history.sh           — Histórico.
    tags.sh               — Tags (locais/remotas/órfãs).
    stash.sh              — Stash: listar/visualizar/aplicar/remover.
    integrity.sh          — Integridade Git (fsck + validações estruturais).
    statistics.sh         — Estatísticas.
    export.sh             — Exportações TXT/Markdown/JSON em _reports/git/.
    config.sh             — Configurações locais do módulo (branches.conf).
  docs/
    branches-sincronizacao.md — Esta documentação.
```

Sem `engine.sh`: ver "Decisão arquitetural — sem engine.sh" abaixo.

## Princípio arquitetural: envelopar, nunca reimplementar

Nenhuma lógica de tag/push/merge/promoção é criada neste módulo — publicar/
promover continua sendo exclusivamente o módulo Release (`subir`/
`subir-ok`/`rollback`, Fase 2). Sincronização faz só `git fetch` (leitura).
As únicas ações que escrevem no repositório (Alternar/Criar/Excluir Branch,
Aplicar/Remover Stash) têm escopo estreito, sempre com confirmação
explícita, e Excluir Branch bloqueia incondicionalmente `develop`/`main`.

## Decisão arquitetural — sem `engine.sh`

A auditoria CCC-F05-AUD-002 (Correção 1) reavaliou explicitamente a
ausência de `engine.sh`. Levantamento dos 5 módulos já homologados no
Control Center: **Banco de Dados** é o único que usa `engine.sh` (10
arquivos em `lib/`, arquivo só de orquestração — `source` de cada um).
**Backup e Recuperação, Desenvolvimento e Release** não usam — `menu.sh`
dá `source` direto em cada `lib/*.sh`, mesmo padrão adotado aqui.

Não existe, portanto, uma arquitetura oficial que exija `engine.sh` em
todo módulo — ele é uma opção válida quando o número de arquivos em
`lib/` (10+) justifica um orquestrador próprio. Com 12 arquivos em
`lib/branches-sincronizacao` (após esta auditoria), o módulo está no
limiar onde `engine.sh` passaria a ajudar; decisão desta auditoria:
**manter o padrão atual** (source direto em `menu.sh`, mesmo de 3 dos 5
módulos existentes) para não introduzir uma camada de indireção sem
ganho funcional nem alterar a arquitetura homologada além do escopo da
Correção 3/4 (Exportação/Logs). Reavaliar se o módulo crescer além disso.

## Exportação

Reaproveita o padrão homologado em `modules/banco-dados/lib/export.sh`
(mesma estrutura de menu, mesmos 3 formatos). Gera relatório com Data,
Hora, Branch, Commit, Autor, Status (saída completa de `_brs_status_repositorio`)
e Resultado (SAUDÁVEL/ATENÇÃO/CRÍTICO), sempre em `_reports/git/` (pasta
já ignorada globalmente pelo `.gitignore` da raiz, nunca versionada).

## Logs

Toda seleção de menu já é registrada genericamente pelo framework
(`_cc_run_submenu`, em `lib/ui-screen.sh`: `"Submenu 'X': opção N (func)"`).
Esta auditoria (Correção 4) acrescentou `_cc_log` com o detalhe que o
framework não captura — branch, commit, resultado da operação — em cada
tela de leitura (Status/Branch Atual/Sincronização/Comparação/Histórico/
Tags/Integridade/Estatísticas/Exportação) e nas mutações (Alternar/Criar/
Excluir Branch, Aplicar/Remover Stash, edição de Configurações), sempre
reaproveitando `_cc_log()` de `lib/common.sh` — nenhum sistema de log novo.

## Menus

### Principal
```
5 ► Branches e Sincronização
  1 ► Status do Repositório
  2 ► Branch Atual
  3 ► Gerenciar Branches
  4 ► Sincronização
  5 ► Comparar Branches
  6 ► Histórico
  7 ► Tags
  8 ► Stash
  9 ► Integridade Git
  10 ► Estatísticas
  11 ► Exportação
  12 ► Ferramentas Git
  13 ► Configurações
  14 ► Voltar
  0 ► Sair
```

### Gerenciar Branches
```
1 ► Listar branches locais
2 ► Listar branches remotas
3 ► Branch padrão / protegida
4 ► Alternar branch
5 ► Criar branch
6 ► Excluir branch local
0 ► Voltar
```

### Stash
```
1 ► Listar stashes
2 ► Visualizar conteúdo
3 ► Aplicar stash
4 ► Remover stash
0 ► Voltar
```

### Exportação
```
1 ► Exportar Relatório (TXT)
2 ► Exportar Relatório (Markdown)
3 ► Exportar Relatório (JSON)
0 ► Voltar
```

## Desvio registrado frente à CCC-F05-001 (mantido intencionalmente)

A especificação original listava "Branches Locais" e "Branches Remotas"
como itens separados do menu principal; a implementação os uniu em um
único "Gerenciar Branches" (com um terceiro sub-item, "Branch padrão/
protegida", que a spec não previa) e adicionou "Estatísticas" como item
próprio. Nenhuma funcionalidade da spec foi perdida — é reorganização,
não omissão. Ver parecer executivo (`docs/PARECER-CCC-HOM-001-BRANCHES-SINCRONIZACAO.md`)
para o registro formal desta decisão.
