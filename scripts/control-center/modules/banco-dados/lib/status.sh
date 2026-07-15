#!/bin/bash
# Cell City Control Center — módulo Banco de Dados, Status do Banco.
# CCC-F04-001 §4. Somente leitura: describe do Firestore via gcloud
# (se disponível/autenticado) + contexto estático de firebase.json.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_bd_status() {
  local ambiente projeto
  ambiente=$(_cc_bd_escolher_ambiente) || { echo "Cancelado."; return; }
  projeto=$(_cc_bd_projeto_id "$ambiente")

  _cc_bd_init

  local database_id regiao colecoes_count
  database_id=$(_cc_bd_database_id)
  regiao=$(_cc_bd_regiao)
  colecoes_count=$(_cc_bd_colecoes_conhecidas | wc -l | tr -d ' ')

  _cc_bd_info "Projeto Firebase ativo: $projeto"
  _cc_bd_info "Ambiente: $ambiente"
  _cc_bd_info "Database ID: $database_id"
  _cc_bd_info "Região: $regiao"
  _cc_bd_info "Número de coleções (conhecidas): $colecoes_count"
  _cc_bd_info "Número estimado de documentos: não disponível (requer Admin SDK/ADC — ver Configurações)"

  local ultima_sync="não disponível"
  if [ -f "$CC_ROOT/logs/control-center.log" ]; then
    ultima_sync=$(grep "Banco de Dados" "$CC_ROOT/logs/control-center.log" 2>/dev/null | tail -1 | grep -oP '^\[\K[^\]]+' || echo "não disponível")
  fi
  _cc_bd_info "Última sincronização (log local): $ultima_sync"

  if _cc_bd_gcloud_autenticado; then
    local saida
    if saida=$(_cc_bd_gcloud_json "$projeto" firestore databases describe --database="$database_id"); then
      local create_time state
      create_time=$(echo "$saida" | jq -r '.createTime // "?"' 2>/dev/null)
      state=$(echo "$saida" | jq -r '.deleteProtectionState // "?"' 2>/dev/null)
      _cc_bd_adicionar "ok" "Firestore acessível (gcloud)" "criado em $create_time · proteção contra exclusão: $state"
    else
      _cc_bd_adicionar "warn" "Firestore via gcloud" "$CC_BD_GCLOUD_ERRO"
    fi
  else
    _cc_bd_adicionar "warn" "gcloud" "não autenticado — status limitado ao que os arquivos locais informam"
  fi

  if [ -f "$REPO_DIR/firebase.json" ]; then
    _cc_bd_adicionar "ok" "firebase.json" "presente"
  else
    _cc_bd_adicionar "fail" "firebase.json" "ausente"
  fi
  if [ -f "$REPO_DIR/.firebaserc" ]; then
    _cc_bd_adicionar "ok" ".firebaserc" "presente"
  else
    _cc_bd_adicionar "fail" ".firebaserc" "ausente"
  fi

  _cc_bd_exibir_status "STATUS DO BANCO"
}

_cc_bd_exibir_status() {
  local titulo="$1"
  _cc_screen_title "$titulo"
  _cc_screen_breadcrumb "Control Center › Banco de Dados"
  _cc_box_blank
  for info in "${CC_BD_INFO[@]}"; do
    _cc_box_text "$info"
  done
  _cc_box_blank
  _cc_box_close
  echo ""
  local r
  for r in "${CC_BD_RESULTADOS[@]}"; do
    IFS='|' read -r status desc detalhes _sugestao <<< "$r"
    case "$status" in
      ok)   _cc_ok "$desc — $detalhes" ;;
      warn) _cc_warn "$desc — $detalhes" ;;
      fail) _cc_fail "$desc — $detalhes" ;;
    esac
  done
  echo ""
  echo "Estado geral: $(_cc_bd_status_label "$(_cc_bd_classificar_saude)")"
  echo "Tempo: $(_cc_bd_duracao)"
  _cc_log "Banco de Dados: Status do Banco consultado ($(_cc_bd_classificar_saude))"
  # Sem _cc_pause aqui: esta função só é chamada pelo item "1" do menu
  # principal via _cc_run_submenu, que já pausa depois de despachar (ver
  # lib/ui-screen.sh) — um _cc_pause aqui duplicaria o ENTER exigido.
}
