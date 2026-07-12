#!/bin/bash
# Cell City Control Center — módulo Configurações (Fase 11, CCC-F11-001).
# Interface: monta o submenu, dispara leitura de status (engine.sh) e
# preferências locais — nenhuma regra de negócio mora aqui.
#
# Escopo desta Fase: somente leitura sobre Backup/Git/Firebase/Banco de
# Dados (nunca reimplementa a lógica real desses módulos) + preferências
# locais deste módulo (tema/logs/exportação), sempre persistidas em
# config/local.json — nunca em state/ (mesmo princípio já usado em
# modules/banco-dados).
#
# Isolamento: este script não depende de core/menu.sh para funcionar — pode
# ser chamado direto (scripts/control-center/modules/configuracoes/menu.sh),
# recalcula seu próprio CC_ROOT e carrega só a lib/common.sh compartilhada.
set -uo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"

# shellcheck source=../../lib/common.sh
source "$CC_ROOT/lib/common.sh"
# shellcheck source=./engine.sh
source "$MODULE_DIR/engine.sh"

_cc_run_submenu "Configurações" "Control Center › Configurações" \
  "1|Configuração Geral|_cc_cfg_geral" \
  "2|Tema e Aparência|_cc_cfg_tema" \
  "3|Logs|_cc_cfg_logs" \
  "4|Status do Backup|_cc_cfg_status_backup" \
  "5|Status do Git|_cc_cfg_status_git" \
  "6|Status do Firebase|_cc_cfg_status_firebase" \
  "7|Status do Banco de Dados|_cc_cfg_status_banco" \
  "8|Exportações|_cc_cfg_exportacao" \
  "9|Ambiente e Diagnóstico|_cc_cfg_ambiente" \
  "10|Validação e Persistência|_cc_cfg_validacao" \
  "11|Importar / Exportar / Reset|_cc_cfg_importexport"
