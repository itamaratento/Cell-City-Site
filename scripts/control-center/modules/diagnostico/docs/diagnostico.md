# Diagnóstico e Health Check

Módulo de verificação automática da integridade do ambiente de desenvolvimento
do Cell City CRM.

## Arquitetura

```
modules/diagnostico/
  menu.sh         — Interface (submenus, exibição de resultados, navegação)
  engine.sh       — Orquestrador (carrega libs, coordena execução)
  lib/
    utils.sh      — Utilitários (contadores, timestamps, classificação, estado)
    sistema.sh    — Verificações do Sistema Operacional
    projeto.sh    — Verificações da Estrutura do Projeto
    git.sh        — Verificações do Git
    node.sh       — Verificações do Node.js
    firebase.sh   — Verificações do Firebase
    ambiente.sh   — Verificações do Ambiente (ferramentas)
    relatorio.sh  — Geração de Relatórios Técnicos
  docs/
    diagnostico.md — Esta documentação
```

### Separação de camadas

- **Interface** (`menu.sh`): submenus, chamadas de diagnóstico, exibição —
  nenhuma regra de verificação.
- **Orquestrador** (`engine.sh`): carrega as libs de verificação, coordena
  execução completa ou por categoria, salva estado.
- **Verificações** (`lib/*.sh`): cada arquivo contém verificações de uma área
  específica — funções independentes que chamam `_cc_diag_adicionar()` para
  registrar resultados.
- **Relatórios** (`lib/relatorio.sh`): consome os resultados e gera relatórios
  formatados com os componentes de UX do Control Center.
- **Utilitários** (`lib/utils.sh`): contadores, timestamps, classificação,
  persistência de estado.

## Fluxo do Diagnóstico

1. Inicialização: `_cc_diag_init()` zera contadores e registra timestamp.
2. Execução: cada função de verificação chama `_cc_diag_adicionar()` com
   status (ok/warn/fail), descrição, detalhes, causa provável, impacto e
   sugestão de correção.
3. Classificação: `_cc_diag_classificar()` define o status geral:
   - `OK` — zero falhas e zero avisos
   - `ATENÇÃO` — zero falhas, um ou mais avisos
   - `CRÍTICO` — uma ou mais falhas
4. Persistência: `_cc_diag_salvar_estado()` salva o resumo em
   `state/health-check.json`.
5. Exibição: `menu.sh` exibe resultados inline (com emoji) para cada
   verificação, seguido de um resumo em caixa.

## Itens Verificados

### Sistema (lib/sistema.sh — 10 verificações)
- Sistema Operacional
- Distribuição Linux
- Versão do Ubuntu
- Kernel
- Espaço em Disco (df)
- Memória RAM (free)
- Uso de CPU (nproc + uptime)
- Processos em Execução (ps aux)
- Permissões de Arquivos
- Variáveis de Ambiente
- Relógio do Sistema

### Projeto (lib/projeto.sh — 7 verificações)
- Estrutura do Projeto (diretório raiz)
- Arquivos Obrigatórios (package.json, firebase.json, etc.)
- Diretórios Obrigatórios (CRM, scripts, css, js, etc.)
- Permissões de Scripts (.sh executáveis)
- Links Simbólicos (quebrados)
- Dependências (node_modules)
- Integridade dos Scripts (bash -n)

### Git (lib/git.sh — 7 verificações)
- Branch Atual
- Workspace Limpo
- Arquivos Modificados
- Arquivos Não Versionados
- Commits Pendentes (ahead)
- Divergência com Origin (ahead/behind)
- Estado do Repositório (stashes)

### Node (lib/node.sh — 6 verificações)
- Node.js (versão)
- npm (versão)
- package.json (estrutura)
- package-lock.json (presença)
- node_modules (pacotes instalados)
- Scripts Disponíveis (npm scripts)

### Firebase (lib/firebase.sh — 8 verificações)
- Firebase CLI (instalado)
- Firebase Login (autenticado)
- Projeto Ativo (.firebaserc)
- Firestore (rules + indexes)
- Firebase Rules (firestore.rules + storage.rules)
- Firebase Indexes (firestore.indexes.json)
- Firebase Hosting (configurado em firebase.json)
- Cloud Functions (diretório functions)

### Ambiente (lib/ambiente.sh — 8 verificações)
- Git
- Bash
- Curl
- Wget
- Python
- Docker (quando instalado)
- Java (quando necessário)
- Ferramentas do Projeto (firebase, node, npm, npx)

## Tratamento de Erros

Toda falha registra:
- **Descrição**: o que foi verificado
- **Causa provável**: por que a verificação falhou
- **Impacto**: como afeta o desenvolvimento/publicação
- **Sugestão de correção**: como resolver

Nenhuma falha interrompe o diagnóstico — todas as verificações são executadas
independentemente, e o relatório final consolida tudo.

## Dependências

- Bash 4+
- Git (para verificações de repositório)
- Node.js (para verificações npm/node)
- Firebase CLI (para verificações Firebase)
- Utilitários padrão Linux: uname, df, free, ps, date, nproc, uptime
