#!/bin/bash
# Cell City Control Center — módulo Backup e Recuperação (Fase 3).
#
# Regra de ouro desta Sprint (mesmo princípio do módulo Release, Fase 2):
# ENVELOPAR o sistema de backup já existente e homologado
# (scripts/backup/*.sh, backup.sh, backup-dados.js), nunca reimplementar.
# Camadas (ver README.md, "Arquitetura de serviços"):
#   Interface    — este arquivo: só monta o submenu e despacha.
#   Backup       — lib/backup.sh (Manual/Automático/Firebase/Projeto/Config).
#   Recuperação  — lib/recuperacao.sh (Restaurar Backup).
#   Validação    — lib/validacao.sh (Validar Integridade).
#   Listagem     — lib/listagem.sh (Listar/Informações dos Backups).
#   Utilitários  — lib/utilitarios.sh (Limpeza de Backups).
set -uo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
# shellcheck disable=SC2034 # lido por lib/*.sh sourced depois (cross-file, invisivel ao shellcheck)
REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"

# shellcheck source=../../lib/common.sh
source "$CC_ROOT/lib/common.sh"
# shellcheck source=./lib/backup.sh
source "$MODULE_DIR/lib/backup.sh"
# shellcheck source=./lib/recuperacao.sh
source "$MODULE_DIR/lib/recuperacao.sh"
# shellcheck source=./lib/validacao.sh
source "$MODULE_DIR/lib/validacao.sh"
# shellcheck source=./lib/listagem.sh
source "$MODULE_DIR/lib/listagem.sh"
# shellcheck source=./lib/utilitarios.sh
source "$MODULE_DIR/lib/utilitarios.sh"

_cc_run_submenu "Backup e Recuperação" "Control Center › Backup e Recuperação" \
  "1|Backup Manual|_bkp_manual" \
  "2|Backup Automático|_bkp_automatico" \
  "3|Restaurar Backup|_bkp_restaurar" \
  "4|Listar Backups|_bkp_listar" \
  "5|Validar Integridade|_bkp_validar_integridade" \
  "6|Backup do Firebase|_bkp_firebase" \
  "7|Backup do Projeto|_bkp_projeto" \
  "8|Backup das Configurações|_bkp_configuracoes" \
  "9|Limpeza de Backups|_bkp_limpeza" \
  "10|Informações dos Backups|_bkp_informacoes"
