#!/bin/bash
# Cell City Control Center — módulo Configurações, Validação e Persistência
# (Fase 11, CCC-F11-001). Confirma que config/local.json é JSON válido e
# que o ciclo escrever→ler realmente persiste (requisito CCC-SPRINT-FINAL-001,
# "Toda configuração deverá ser persistida").
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"

_cc_cfg_validacao() {
  _cc_screen_title "VALIDAÇÃO E PERSISTÊNCIA"
  _cc_screen_breadcrumb "Control Center › Configurações › Validação"
  _cc_box_blank
  _cc_box_line "Arquivo : $CC_CFG_CONFIG_FILE"
  _cc_box_blank

  if ! _cc_cfg_tem jq; then
    _cc_fail "jq não está instalado — configurações não podem ser lidas/gravadas."
    _cc_box_blank
    return
  fi

  if [ ! -f "$CC_CFG_CONFIG_FILE" ]; then
    _cc_box_text "Arquivo ainda não existe — será criado com os valores"
    _cc_box_text "padrão na primeira alteração (comportamento esperado,"
    _cc_box_text "mesmo princípio do módulo Banco de Dados)."
  elif jq -e . "$CC_CFG_CONFIG_FILE" >/dev/null 2>&1; then
    _cc_ok "config/local.json é JSON válido."
  else
    _cc_fail "config/local.json existe mas não é JSON válido."
    _cc_box_text "Use \"Reset seguro\" (Importar/Exportar) para restaurar."
  fi

  echo ""
  echo "Testando ciclo de persistência (escrever → ler)..."
  local marcador
  marcador="teste-$(date '+%s')"
  _cc_cfg_config_set "_validacao_teste" "$marcador"
  local lido
  lido=$(_cc_cfg_config_get "_validacao_teste" "")
  if [ "$lido" = "$marcador" ]; then
    _cc_ok "Persistência confirmada — valor gravado foi lido de volta corretamente."
  else
    _cc_fail "Persistência falhou — valor gravado não bateu na leitura."
  fi
  # Remove a chave de teste (não usa _cc_cfg_config_set "" pra não deixar
  # a chave presente com valor vazio — jq del() limpa de verdade).
  local atual
  atual=$(_cc_cfg_config_ler)
  echo "$atual" | jq 'del(._validacao_teste)' > "$CC_CFG_CONFIG_FILE.tmp" \
    && mv "$CC_CFG_CONFIG_FILE.tmp" "$CC_CFG_CONFIG_FILE"

  _cc_box_blank
}
