# Configurações (Fase 11 — CCC-F11-001)

Painel central de status e preferências do CELL CITY CONTROL CENTER.

## Escopo — só leitura + preferências locais

Decisão de escopo confirmada com o dono do projeto antes da
implementação (CCC-SPRINT-FINAL-001): este módulo **nunca** altera o
comportamento real de Backup, Git, Firebase ou Banco de Dados — só
mostra o status atual (lido dos mesmos arquivos/comandos que os módulos
reais usam) e aponta para o módulo correto quando uma ação de verdade é
necessária. As únicas escritas deste módulo são as suas próprias
preferências locais, sempre em `config/local.json` — nunca em `state/`
nem em nenhum arquivo de outro módulo. Mesmo princípio de "envelopar,
nunca reimplementar" usado em toda a Sprint CCC-SPRINT-FINAL-001.

## Arquitetura

```
modules/configuracoes/
  menu.sh              — Interface: submenu via _cc_run_submenu, dispatch.
  engine.sh            — Orquestrador: só carrega lib/*.sh.
  lib/
    utils.sh           — Persistência em config/local.json via jq (mesmo
                          padrão de modules/banco-dados/lib/utils.sh).
    geral.sh           — Configuração Geral (overview) + Tema (preferência).
    logs.sh            — Preferências de log + visualização do log real.
    status.sh          — Status somente-leitura de Backup/Git/Firebase/
                          Banco de Dados.
    ambiente.sh        — Resumo do último health-check real (Diagnóstico).
    exportacao.sh       — Exportações TXT/Markdown/JSON das preferências.
    validacao.sh        — Valida JSON + testa o ciclo de persistência.
    importexport.sh     — Backup/restauração do próprio local.json + Reset seguro.
  config/
    local.json          — Preferências (gitignorado, nunca dado de negócio).
  docs/
    configuracoes.md     — Esta documentação.
```

## Menu

```
9 ► Configurações
  1 ► Configuração Geral
  2 ► Tema e Aparência
  3 ► Logs
  4 ► Status do Backup
  5 ► Status do Git
  6 ► Status do Firebase
  7 ► Status do Banco de Dados
  8 ► Exportações
  9 ► Ambiente e Diagnóstico
  10 ► Validação e Persistência
  11 ► Importar / Exportar / Reset
  12 ► Voltar
  0 ► Sair
```

## Preferências persistidas (config/local.json)

| Chave | Padrão | Efeito |
|---|---|---|
| `tema_cores` | `on` | Informativa — ainda não lida por `lib/ui-colors.sh` (preparatória, mesmo caso de `branches.conf` na Fase 5). |
| `logs_verbosidade` | `normal` | Informativa — exibida na tela de Logs. |
| `logs_retencao_dias` | `30` | Informativa. |
| `exportacao_diretorio` | `_reports/configuracoes` | Usada de verdade pelas telas de Exportação/Backup deste módulo. |
| `exportacao_formato_padrao` | `txt` | Informativa. |

## Segurança

Nenhuma tela escreve em arquivo de outro módulo, em `state/` ou executa
comando que altere Git/Firebase/Backup/Banco de Dados. "Reset seguro"
(único item potencialmente destrutivo, e só sobre o próprio
`config/local.json`) sempre pede `_cc_confirm`. Importação de backup
valida o arquivo como JSON antes de aplicar e também exige confirmação.
