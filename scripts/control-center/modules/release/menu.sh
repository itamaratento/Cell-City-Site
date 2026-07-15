#!/bin/bash
# Cell City Control Center — módulo Release (Fase 2).
#
# Envelopa o pipeline oficial já existente (subir → release → subir-ok,
# mais rollback) — nunca reimplementa tag/push/promoção. Ver
# lib/release.sh para a justificativa completa e README.md, "Arquitetura
# de serviços".
#   Interface — este arquivo: só monta o submenu e despacha.
#   Git (serviço) — lib/svc-git.sh, compartilhada com o módulo Desenvolvimento.
#   Release (serviço) — lib/release.sh (validações + delegações).
set -uo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CC_ROOT="$(cd "$MODULE_DIR/../.." && pwd)"
# shellcheck disable=SC2034 # lido por lib/*.sh sourced depois (cross-file, invisivel ao shellcheck)
REPO_DIR="$(cd "$CC_ROOT/../.." && pwd)"

# shellcheck source=../../lib/common.sh
source "$CC_ROOT/lib/common.sh"
# shellcheck source=../../lib/svc-git.sh
source "$CC_ROOT/lib/svc-git.sh"
# shellcheck source=./lib/release.sh
source "$MODULE_DIR/lib/release.sh"

_cc_run_submenu "Release" "Control Center › Release" \
  "1|Validar Branch|_rel_validar_branch" \
  "2|Validar Workspace Limpo|_rel_validar_workspace" \
  "3|Gerar Changelog|_rel_gerar_changelog" \
  "4|Executar Testes|_rel_executar_testes" \
  "5|Build Final|_rel_build_final" \
  "6|Checklist de Release|_rel_checklist" \
  "7|Histórico de Releases|_rel_historico" \
  "8|Enviar Alterações (subir)|_rel_subir" \
  "9|Criar Tag e Publicar (subir-ok)|_rel_criar_tag_e_publicar" \
  "10|Rollback de Produção|_rel_rollback"
