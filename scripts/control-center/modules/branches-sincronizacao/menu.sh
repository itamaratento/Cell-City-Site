#!/bin/bash
# Cell City Control Center — módulo Branches e Sincronização (Fase 5).
#
# Centraliza inspeção, comparação e sincronização de branches do Cell City
# CRM. Camadas (ver README.md, "Arquitetura de serviços"):
#   Interface     — este arquivo: só monta o submenu e despacha.
#   Git (serviço) — lib/svc-git.sh, compartilhada com Desenvolvimento/Release.
#   Status        — lib/status.sh (Status do Repositório/Branch Atual).
#   Branches      — lib/branches.sh (listar/alternar/criar/excluir).
#   Sincronização — lib/sync.sh (fetch + divergências + orientação).
#   Comparação    — lib/compare.sh (Comparar Branches).
#   Histórico     — lib/history.sh.
#   Tags          — lib/tags.sh.
#   Stash         — lib/stash.sh.
#   Integridade   — lib/integrity.sh.
#   Estatísticas  — lib/statistics.sh.
#   Ferramentas   — lib/tools.sh.
#   Configurações — lib/config.sh (branches.conf próprio do módulo).
#
# Regra de ouro desta Sprint (mesma das Fases 2 e 3): envelopar, nunca
# reimplementar. Nenhuma ação de tag/push/merge/promoção é criada aqui —
# publicar/promover continua sendo o módulo Release (subir/subir-ok/
# rollback). Este módulo só inspeciona, compara e busca atualizações
# (fetch), mais ações pontuais de branch/stash que não existiam no projeto
# antes desta Sprint (não havia nenhum script de sincronização de branch).
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
# shellcheck source=./lib/branches.sh
source "$MODULE_DIR/lib/branches.sh"
# shellcheck source=./lib/sync.sh
source "$MODULE_DIR/lib/sync.sh"
# shellcheck source=./lib/compare.sh
source "$MODULE_DIR/lib/compare.sh"
# shellcheck source=./lib/history.sh
source "$MODULE_DIR/lib/history.sh"
# shellcheck source=./lib/tags.sh
source "$MODULE_DIR/lib/tags.sh"
# shellcheck source=./lib/stash.sh
source "$MODULE_DIR/lib/stash.sh"
# shellcheck source=./lib/integrity.sh
source "$MODULE_DIR/lib/integrity.sh"
# shellcheck source=./lib/statistics.sh
source "$MODULE_DIR/lib/statistics.sh"
# shellcheck source=./lib/tools.sh
source "$MODULE_DIR/lib/tools.sh"
# shellcheck source=./lib/config.sh
source "$MODULE_DIR/lib/config.sh"

_cc_run_submenu "Branches e Sincronização" "Control Center › Branches e Sincronização" \
  "1|Status do Repositório|_brs_status_repositorio" \
  "2|Branch Atual|_brs_branch_atual" \
  "3|Gerenciar Branches|_brs_gerenciar_branches" \
  "4|Sincronização|_brs_sincronizacao" \
  "5|Comparar Branches|_brs_comparar_branches" \
  "6|Histórico|_brs_historico" \
  "7|Tags|_brs_tags" \
  "8|Stash|_brs_stash" \
  "9|Integridade Git|_brs_integridade_git" \
  "10|Estatísticas|_brs_estatisticas" \
  "11|Ferramentas Git|_brs_ferramentas_git" \
  "12|Configurações|_brs_configuracoes"
