#!/bin/bash
# Cell City Control Center — módulo Banco de Dados, Cloud Functions.
# CCC-F04-001 §8. Cruza o que está declarado em functions/index.js (exports
# reais do código) com o que está publicado (gcloud functions list, somente
# leitura). Nunca publica/remove Function nenhuma — isso é escopo exclusivo
# de `firebase deploy --only functions`, fora deste módulo.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_bd_functions_declaradas() {
  [ -f "$REPO_DIR/functions/index.js" ] || return
  grep -oE "^exports\.[a-zA-Z0-9_]+" "$REPO_DIR/functions/index.js" 2>/dev/null | sed 's/^exports\.//' | sort -u
}

_cc_bd_functions_runtime_declarado() {
  if _cc_bd_tem jq && _cc_bd_firebase_json_valido; then
    jq -r '.functions[0].runtime // empty' "$REPO_DIR/firebase.json" 2>/dev/null
  fi
}

_cc_bd_functions_publicadas() {
  local projeto="$1"
  _cc_bd_gcloud_json "$projeto" functions list \
    | jq -c '.[]? | {name: (.name | split("/") | last), state, runtime: .buildConfig.runtime, region: (.name | split("/")[3]), updateTime}' 2>/dev/null
}

_cc_bd_functions() {
  local ambiente projeto
  ambiente=$(_cc_bd_escolher_ambiente) || { echo "Cancelado."; return; }
  projeto=$(_cc_bd_projeto_id "$ambiente")

  _cc_bd_init

  local declaradas runtime_declarado
  declaradas=$(_cc_bd_functions_declaradas)
  runtime_declarado=$(_cc_bd_functions_runtime_declarado)
  local qtd_declaradas
  qtd_declaradas=$(echo "$declaradas" | grep -c . || true)
  _cc_bd_adicionar "ok" "Functions declaradas (functions/index.js)" "$qtd_declaradas · runtime configurado: ${runtime_declarado:-desconhecido}"

  if ! _cc_bd_tem gcloud; then
    _cc_bd_adicionar "warn" "gcloud" "não instalado — não é possível consultar o estado publicado"
    _cc_bd_exibir_functions "$declaradas" ""
    return
  fi
  if ! _cc_bd_gcloud_autenticado; then
    _cc_bd_adicionar "warn" "gcloud" "não autenticado — não é possível consultar o estado publicado"
    _cc_bd_exibir_functions "$declaradas" ""
    return
  fi

  local publicadas
  if ! publicadas=$(_cc_bd_functions_publicadas "$projeto"); then
    _cc_bd_adicionar "warn" "Functions publicadas ($ambiente)" "$CC_BD_GCLOUD_ERRO"
    _cc_bd_exibir_functions "$declaradas" ""
    return
  fi

  local qtd_publicadas
  qtd_publicadas=$(echo "$publicadas" | grep -c . || true)
  _cc_bd_adicionar "ok" "Functions publicadas ($ambiente)" "$qtd_publicadas"

  local nome_pub estado_pub runtime_pub
  while IFS= read -r linha; do
    [ -z "$linha" ] && continue
    nome_pub=$(echo "$linha" | jq -r '.name')
    estado_pub=$(echo "$linha" | jq -r '.state')
    runtime_pub=$(echo "$linha" | jq -r '.runtime')
    if ! echo "$declaradas" | grep -qx "$nome_pub"; then
      _cc_bd_adicionar "warn" "$nome_pub" "publicada em $ambiente mas não encontrada em functions/index.js" "Confirmar se é obsoleta antes de remover"
      continue
    fi
    if [ "$estado_pub" != "ACTIVE" ]; then
      _cc_bd_adicionar "warn" "$nome_pub" "estado $estado_pub (esperado ACTIVE)"
    elif [ -n "$runtime_declarado" ] && [ "$runtime_pub" != "$runtime_declarado" ]; then
      _cc_bd_adicionar "warn" "$nome_pub" "runtime publicado $runtime_pub difere do configurado ($runtime_declarado)"
    else
      _cc_bd_adicionar "ok" "$nome_pub" "estado $estado_pub · runtime $runtime_pub"
    fi
  done <<< "$publicadas"

  local nome
  while IFS= read -r nome; do
    [ -z "$nome" ] && continue
    if ! echo "$publicadas" | jq -r '.name' 2>/dev/null | grep -qx "$nome"; then
      _cc_bd_adicionar "warn" "$nome" "declarada no código mas não publicada em $ambiente" "Rodar deploy se for esperado estar ativa neste ambiente"
    fi
  done <<< "$declaradas"

  _cc_bd_exibir_functions "$declaradas" "$publicadas"
}

# Atalho de Ferramentas (CCC-F04-001 §12) — só as publicadas sem
# correspondência em functions/index.js, sem rodar a bateria completa.
_cc_bd_functions_orfas_listar() {
  local ambiente projeto
  ambiente=$(_cc_bd_escolher_ambiente) || { echo "Cancelado."; return; }
  projeto=$(_cc_bd_projeto_id "$ambiente")

  _cc_bd_init
  if ! _cc_bd_gcloud_autenticado; then
    _cc_bd_adicionar "warn" "gcloud" "não autenticado — não é possível consultar Functions publicadas"
    _cc_bd_exibir_functions "" ""
    return
  fi

  local declaradas publicadas nome_pub
  declaradas=$(_cc_bd_functions_declaradas)
  if ! publicadas=$(_cc_bd_functions_publicadas "$projeto"); then
    _cc_bd_adicionar "warn" "Functions publicadas ($ambiente)" "$CC_BD_GCLOUD_ERRO"
    _cc_bd_exibir_functions "$declaradas" ""
    return
  fi
  while IFS= read -r linha; do
    [ -z "$linha" ] && continue
    nome_pub=$(echo "$linha" | jq -r '.name')
    if echo "$declaradas" | grep -qx "$nome_pub"; then
      _cc_bd_adicionar "ok" "$nome_pub" "declarada em functions/index.js"
    else
      _cc_bd_adicionar "warn" "$nome_pub" "publicada em $ambiente sem correspondência em functions/index.js" "Confirmar se é obsoleta antes de remover"
    fi
  done <<< "$publicadas"
  _cc_bd_exibir_functions "$declaradas" "$publicadas"
}

_cc_bd_exibir_functions() {
  _cc_screen_title "CLOUD FUNCTIONS"
  _cc_screen_breadcrumb "Control Center › Banco de Dados"
  _cc_box_blank
  _cc_box_text "Somente leitura — nenhuma Function foi publicada, removida ou alterada."
  _cc_box_blank
  _cc_box_close
  echo ""
  local r
  for r in "${CC_BD_RESULTADOS[@]:-}"; do
    [ -z "$r" ] && continue
    IFS='|' read -r status desc detalhes sugestao <<< "$r"
    case "$status" in
      ok)   _cc_ok "$desc — $detalhes" ;;
      warn) _cc_warn "$desc — $detalhes${sugestao:+ (sugestão: $sugestao)}" ;;
      fail) _cc_fail "$desc — $detalhes${sugestao:+ (sugestão: $sugestao)}" ;;
    esac
  done
  echo ""
  echo "Estado: $(_cc_bd_status_label "$(_cc_bd_classificar_integridade)")"
  _cc_log "Banco de Dados: Cloud Functions consultado ($(_cc_bd_classificar_integridade))"
  # Sem _cc_pause aqui: chamada pelo item "5" do menu principal via
  # _cc_run_submenu (que já pausa) e também pelo item "4" de Ferramentas
  # (_cc_bd_functions_orfas_listar), cujo loop pausa explicitamente.
}
