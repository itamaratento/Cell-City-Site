# Ferramentas, Auditorias e Relatórios

Módulo de utilidades, auditorias técnicas e geração de relatórios
do CELL CITY CONTROL CENTER (Fase 7).

## Arquitetura

```
modules/ferramentas/
  menu.sh         — Interface (submenus, navegação, display)
  engine.sh       — Orquestrador (carrega libs, coordena execução)
  lib/
    utils.sh              — Utilitários compartilhados (contadores, classificação)
    auditoria-geral.sh    — Auditoria Geral (estrutura, arquivos, permissões)
    auditoria-seguranca.sh — Auditoria de Segurança (credenciais, tokens, chaves)
    auditoria-git.sh      — Auditoria Git (branch, commits, tags, conflitos)
    auditoria-firebase.sh — Auditoria Firebase (projeto, rules, indexes, hosting)
    auditoria-node.sh     — Auditoria Node (package.json, dependências, scripts)
    auditoria-bash.sh     — Auditoria Bash (sintaxe, permissões, duplicados)
    relatorios.sh         — Geração de relatórios (6 tipos)
    exportacao.sh         — Exportação (TXT, Markdown, JSON)
    utilitarios.sh        — Utilitários (cache, temporários, informações)
  docs/
    ferramentas.md — Esta documentação
```

## Menus

### Principal
```
7 ► Ferramentas, Auditorias e Relatórios
  1 ► Auditoria Geral
  2 ► Auditoria de Segurança
  3 ► Auditoria do Git
  4 ► Auditoria Firebase
  5 ► Auditoria Node
  6 ► Auditoria Bash
  7 ► Gerar Relatórios
  8 ► Exportações
  9 ► Utilitários
  10 ► Voltar
  0 ► Sair
```

`Voltar` é sempre `N+1` (dinâmico, via `_cc_run_submenu` — 9 itens reais
aqui, logo `10`); `0` sempre encerra o Control Center inteiro (nunca só
"volta"). Mesma convenção usada por todos os outros módulos do projeto
(Branches e Sincronização, Banco de Dados, Diagnóstico) — a revisão
técnica da Fase 7 corrigiu a implementação original (que usava um loop
próprio com "0 = Voltar") para manter essa consistência de UX em todo o
Control Center.

### Relatórios
```
1 ► Relatório Geral
2 ► Relatório Técnico
3 ► Relatório Executivo
4 ► Relatório de Auditoria
5 ► Relatório de Segurança
6 ► Relatório de Performance
9 ► Voltar
```

### Exportações
```
1 ► TXT
2 ► Markdown
3 ► JSON
9 ► Voltar
```

### Utilitários
```
1 ► Limpeza de Cache
2 ► Limpeza de Temporários
3 ► Atualização de Índices
4 ► Informações do Ambiente
5 ► Informações do Projeto
9 ► Voltar
```

## Fluxos

1. **Auditoria**: Menu → seleciona auditoria → executa verificações →
   exibe resultados → resumo → volta ao menu.
2. **Relatório**: Menu → Relatórios → seleciona tipo → exibe relatório
   formatado → volta.
3. **Exportação**: Menu → Exportações → seleciona formato → arquivo
   gerado em `_reports/` → confirmação → volta.
4. **Utilitários**: Menu → Utilitários → seleciona operação →
   (se destrutiva) confirmação → executa → resultado → volta.

## Segurança

Toda operação potencialmente destrutiva (limpeza de cache,
remoção de temporários) solicita confirmação explícita via
`_cc_confirm`. Nenhum arquivo do projeto é modificado sem
autorização do usuário.

## Dependências

- Bash 4+
- Git (para auditoria Git)
- Node.js/npm (para auditoria Node, opcional)
- Firebase CLI (para auditoria Firebase, opcional)
- Python 3 (para validação JSON, opcional)
- ShellCheck (para auditoria Bash, opcional)
