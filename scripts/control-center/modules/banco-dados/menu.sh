#!/bin/bash
# Cell City Control Center — módulo Banco de Dados (Fase 4 — CCC-F04-001).
# Interface do usuário: submenu e navegação. Nenhuma regra de negócio —
# toda a lógica de inspeção mora em engine.sh e lib/ (ver README.md,
# "Arquitetura de serviços").
#
# Escopo desta Fase: somente leitura. Nenhuma opção deste módulo cria,
# altera, publica ou remove qualquer coleção, documento, Rule, índice ou
# Cloud Function — ver CCC-F04-001 §17 ("Segurança") e §23 ("Restrições").
set -uo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
# shellcheck disable=SC2034 # lido por lib/*.sh sourced depois (cross-file, invisivel ao shellcheck)
REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"

# shellcheck source=../../lib/common.sh
source "$CC_ROOT/lib/common.sh"
# shellcheck source=./engine.sh
source "$MODULE_DIR/engine.sh"

_cc_run_submenu "Banco de Dados" "Control Center › Banco de Dados" \
  "1|Status do Banco|_cc_bd_status" \
  "2|Coleções|_cc_bd_menu_colecoes" \
  "3|Índices|_cc_bd_indices" \
  "4|Firestore Rules|_cc_bd_rules" \
  "5|Cloud Functions|_cc_bd_functions" \
  "6|Integridade|_cc_bd_integridade" \
  "7|Estatísticas|_cc_bd_estatisticas" \
  "8|Exportações|_cc_bd_exportar" \
  "9|Ferramentas|_cc_bd_menu_ferramentas" \
  "10|Configurações|_cc_bd_configuracoes"
