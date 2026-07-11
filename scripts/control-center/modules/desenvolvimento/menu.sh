#!/bin/bash
# Cell City Control Center — módulo Desenvolvimento (Fase 2).
#
# Centraliza as operações do dia a dia do desenvolvimento do Cell City CRM.
# Camadas (ver README.md, "Arquitetura de serviços"):
#   Interface     — este arquivo: só monta o submenu e despacha.
#   Git (serviço) — lib/svc-git.sh, compartilhada com o módulo Release.
#   Status        — lib/status.sh (formata a saída do serviço de Git).
#   Comandos      — lib/comandos.sh (build/testes/lint/formatação/cache/deps).
#   Utilitários   — lib/utilitarios.sh (abrir diretório, info do ambiente).
# Nenhuma regra de negócio fica aqui — só chamadas às funções acima.
set -uo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"

# shellcheck source=../../lib/common.sh
source "$CC_ROOT/lib/common.sh"
# shellcheck source=../../lib/svc-git.sh
source "$CC_ROOT/lib/svc-git.sh"
# shellcheck source=./lib/status.sh
source "$MODULE_DIR/lib/status.sh"
# shellcheck source=./lib/comandos.sh
source "$MODULE_DIR/lib/comandos.sh"
# shellcheck source=./lib/utilitarios.sh
source "$MODULE_DIR/lib/utilitarios.sh"

_cc_run_submenu "Desenvolvimento" "Control Center › Desenvolvimento" \
  "1|Status do Projeto|_dev_status_projeto" \
  "2|Git Status|_dev_git_status" \
  "3|Git Diff|_dev_git_diff" \
  "4|Últimos Commits|_dev_git_log" \
  "5|Alterações Locais|_dev_alteracoes_locais" \
  "6|Build|_dev_build" \
  "7|Testes|_dev_testes" \
  "8|Lint|_dev_lint" \
  "9|Formatação|_dev_formatacao" \
  "10|Limpeza de Cache|_dev_limpeza_cache" \
  "11|Atualizar Dependências|_dev_atualizar_dependencias" \
  "12|Abrir Diretório do Projeto|_dev_abrir_diretorio" \
  "13|Informações do Ambiente|_dev_info_ambiente"
