#!/bin/bash
# Cell City Control Center — módulo Configurações, utilitários compartilhados
# (Fase 11, CCC-F11-001). Persistência em config/local.json (via jq), mesmo
# padrão já homologado em modules/banco-dados/lib/utils.sh — escopo isolado
# deste módulo, nunca afeta outro módulo nem o Manifesto (config/modules.conf).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${MODULE_DIR:?MODULE_DIR precisa estar definido}"

CC_CFG_CONFIG_FILE="$MODULE_DIR/config/local.json"

_cc_cfg_tem() { command -v "$1" >/dev/null 2>&1; }

_cc_cfg_config_default() {
  cat <<'EOF'
{
  "tema_cores": "on",
  "logs_verbosidade": "normal",
  "logs_retencao_dias": 30,
  "exportacao_diretorio": "_reports/configuracoes",
  "exportacao_formato_padrao": "txt"
}
EOF
}

_cc_cfg_config_ler() {
  if [ -f "$CC_CFG_CONFIG_FILE" ] && _cc_cfg_tem jq && jq -e . "$CC_CFG_CONFIG_FILE" >/dev/null 2>&1; then
    cat "$CC_CFG_CONFIG_FILE"
  else
    _cc_cfg_config_default
  fi
}

_cc_cfg_config_get() {
  local chave="$1" padrao="${2:-}"
  local valor
  valor=$(_cc_cfg_config_ler | jq -r --arg k "$chave" '.[$k] // empty' 2>/dev/null)
  [ -z "$valor" ] && valor="$padrao"
  echo "$valor"
}

_cc_cfg_config_set() {
  local chave="$1" valor="$2"
  mkdir -p "$(dirname "$CC_CFG_CONFIG_FILE")"
  local atual
  atual=$(_cc_cfg_config_ler)
  echo "$atual" | jq --arg k "$chave" --arg v "$valor" '.[$k] = $v' > "$CC_CFG_CONFIG_FILE.tmp" \
    && mv "$CC_CFG_CONFIG_FILE.tmp" "$CC_CFG_CONFIG_FILE"
}
