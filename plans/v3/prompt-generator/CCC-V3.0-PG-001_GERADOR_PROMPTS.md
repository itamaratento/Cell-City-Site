```
======================================================================
CELL CITY CRM
VERSÃO 3.0 — GERADOR DE PROMPTS PARA IA

DOCUMENTO CCC-V3.0-PG-001
ARQUITETURA DO GERADOR DE PROMPTS V3
======================================================================
```

# GERADOR DE PROMPTS PARA IA V3 — Prompt Generator

## 1. Objetivo

Gerar automaticamente prompts técnicos para IA contendo todo o contexto
necessário do projeto: arquivos, logs, erros, testes, stack traces,
dependências, objetivo e restrições.

## 2. Arquitetura

```
scripts/prompt-generator/
├── generator.sh                # Orquestrador principal
├── VERSION
├── README.md
├── core/
│   ├── context-builder.sh      # Montagem do contexto
│   ├── prompt-formatter.sh     # Formatação do prompt
│   └── output-manager.sh       # Saída (arquivo, stdout, clipboard)
├── collectors/                 # Coletores de contexto
│   ├── collect-files.sh        # Anexar arquivos
│   ├── collect-logs.sh         # Anexar logs
│   ├── collect-errors.sh       # Anexar erros
│   ├── collect-tests.sh        # Anexar testes
│   ├── collect-stacktrace.sh   # Anexar stack trace
│   ├── collect-deps.sh         # Anexar dependências
│   ├── collect-goal.sh         # Objetivo da tarefa
│   ├── collect-constraints.sh  # Restrições
│   └── collect-state.sh        # Estado do sistema
├── templates/                  # Templates de prompt
│   ├── default.md              # Template padrão
│   ├── debug.md                # Template para debug
│   ├── review.md               # Template para revisão
│   ├── architecture.md         # Template para arquitetura
│   └── custom.md               # Template personalizado
├── lib/
│   ├── utils.sh                # Utilitários
│   ├── anexos.sh               # Gerenciamento de anexos
│   └── format.sh               # Formatação
└── state/
    └── last-prompt.json        # Último prompt gerado
```

## 3. Formato do Prompt

### 3.1 Estrutura do Prompt

```markdown
# CONTEXTO DO PROJETO — CELL CITY CRM

## MISSÃO
{objetivo da tarefa}

## RESTRIÇÕES
- {restricao 1}
- {restricao 2}

## ESTADO DO SISTEMA
- Versão: {versao}
- Branch: {branch}
- Ambiente: {ambiente}
- Último commit: {commit}
- Status: {status}

## ARQUIVOS RELEVANTES
{lista de arquivos com caminho relativo}

## LOGS
{logs relevantes}

## ERROS
{erros encontrados}

## TESTES
{resultados de testes}

## STACK TRACE
{stack trace se aplicável}

## DEPENDÊNCIAS
{dependências relevantes}

---
Prompt gerado automaticamente em {timestamp}
```

### 3.2 Template Padrão

```markdown
# CONTEXTO DO PROJETO — CELL CITY CRM

## MISSÃO
{{MISSION}}

## RESTRIÇÕES
- Não alterar Firestore
- Não alterar Rules
- Não alterar banco
- Manter compatibilidade com V2
- Seguir padrão MPA + ES Modules
- Zero build step
- Zero bundler

## ESTADO DO SISTEMA
- Versão: {{VERSION}}
- Branch: {{BRANCH}}
- Ambiente: {{ENV}}
- Commit: {{COMMIT}}
- Workspace: {{WORKSPACE_STATUS}}

## {{FILE_SECTION}}

## {{LOG_SECTION}}

## {{ERROR_SECTION}}

## {{TEST_SECTION}}

## {{STACKTRACE_SECTION}}

## {{DEPS_SECTION}}

---
Gerado por Prompt Generator V3 em {{TIMESTAMP}}
```

## 4. Coletores

### 4.1 collect-files.sh
- Aceita lista de caminhos relativos ou globs
- Lê o conteúdo dos arquivos
- Formata como blocos de código
- Opção: incluir linha, linha final, ou seção

### 4.2 collect-logs.sh
- Últimas N linhas de logs do monitoring
- Filtra por nível (error, warning, etc.)
- Filtra por módulo/componente
- Limits de tamanho para não exceder contexto

### 4.3 collect-errors.sh
- Últimos erros do log do Control Center
- Erros de build
- Erros de teste
- Falhas de health check

### 4.4 collect-tests.sh
- Resultados da última execução de testes
- Suítes: RBAC, Rules, Functions, Performance, Integrity
- Resumo: pass/fail, total, cobertura

### 4.5 collect-stacktrace.sh
- Captura stack trace de erro específico
- Aceita arquivo de log como entrada
- Extrai trace formatado

### 4.6 collect-deps.sh
- Lê package.json (root, functions, CRM)
- Lista dependências e versões
- Verifica discrepâncias

### 4.7 collect-goal.sh
- Prompt interativo ou argumento
- Define o objetivo da tarefa

### 4.8 collect-constraints.sh
- Restrições fixas do projeto (CLAUDE.md)
- Restrições adicionais passadas como argumento

### 4.9 collect-state.sh
- Estado do Health Engine (`state/health-check.json`)
- Último diagnóstico (`state/last-diagnostic.json`)
- Informações do ambiente

## 5. Modos de Geração

| Modo | Comando | O que inclui |
|---|---|---|
| Rápido | `generator.sh --quick` | Apenas estado + objetivo |
| Padrão | `generator.sh` | Estado + objetivo + arquivos |
| Debug | `generator.sh --debug` | Tudo + logs + erros + stacktrace |
| Revisão | `generator.sh --review` | Estado + testes + arquivos alterados |
| Arquitetura | `generator.sh --arch` | Estado + estrutura + dependências |

## 6. Saída

| Formato | Destino | Comando |
|---|---|---|
| Arquivo | `prompts/prompt-{timestamp}.md` | `--file` |
| Stdout | Terminal | `--stdout` |
| Clipboard | Área de transferência | `--clip` (se xclip disponível) |

## 7. Integração com Control Center

O Prompt Generator é acessível como módulo do Control Center via
plugin-loader. Usa dados do Health Engine, Monitoring e Diagnostic
Engine para montar o contexto automaticamente.

## 8. Exemplo de Uso

```bash
# Gerar prompt para revisão de código
generator.sh --review \
  --files "CRM/pages/os/os.js" \
  --goal "Revisar segurança do módulo OS" \
  --file

# Gerar prompt para debug
generator.sh --debug \
  --error "logs/error.log" \
  --goal "Diagnosticar erro de permissão" \
  --stdout

# Gerar prompt rápido com estado atual
generator.sh --quick \
  --goal "Qual o próximo passo recomendado?" \
  --clip
```
