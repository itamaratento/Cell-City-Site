#!/bin/bash
# Cell City Control Center — módulo Central de IAs, Documentação (Fase 10
# — CCC-F10-001, "Documentação": centraliza especificações/roadmap/
# pareceres/homologações/arquitetura/guias/documentos oficiais). Só
# enumera arquivos que já existem no repositório — nunca copia/duplica
# conteúdo, cada item aponta pro caminho real.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_cia_documentacao() {
  _cc_screen_title "DOCUMENTAÇÃO"
  _cc_screen_breadcrumb "Control Center › Central de IAs"
  _cc_box_blank

  _cc_box_text "Arquitetura e Roadmap:"
  _cc_box_text "  scripts/control-center/README.md"
  _cc_box_blank

  _cc_box_text "Pareceres e Homologações (docs/):"
  local arquivo encontrado=0
  for arquivo in "$CC_ROOT"/docs/*.md; do
    [ -e "$arquivo" ] || continue
    [ "$(basename "$arquivo")" = "README.md" ] && continue
    encontrado=1
    _cc_box_text "  scripts/control-center/docs/$(basename "$arquivo")"
  done
  [ "$encontrado" -eq 0 ] && _cc_box_text "  Nenhum ainda."
  _cc_box_blank

  _cc_box_text "Documentação por módulo:"
  local dir slug encontrado_modulo=0
  for dir in "$CC_ROOT"/modules/*/docs; do
    [ -d "$dir" ] || continue
    slug=$(basename "$(dirname "$dir")")
    for arquivo in "$dir"/*.md; do
      [ -e "$arquivo" ] || continue
      encontrado_modulo=1
      _cc_box_text "  $slug/docs/$(basename "$arquivo")"
    done
  done
  [ "$encontrado_modulo" -eq 0 ] && _cc_box_text "  Nenhuma ainda."

  local dir_extra
  dir_extra=$(_cc_cia_config_get "diretorio_documentos" "scripts/control-center/docs")
  if [ "$dir_extra" != "scripts/control-center/docs" ] && [ -d "$REPO_DIR/$dir_extra" ]; then
    _cc_box_blank
    _cc_box_text "Diretório adicional configurado ($dir_extra):"
    for arquivo in "$REPO_DIR/$dir_extra"/*.md; do
      [ -e "$arquivo" ] || continue
      _cc_box_text "  $(basename "$arquivo")"
    done
  fi

  _cc_box_blank
  _cc_box_close
  _cc_cia_log "Documentação consultada"
}
