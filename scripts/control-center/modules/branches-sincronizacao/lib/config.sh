#!/bin/bash
# Cell City Control Center — módulo Branches e Sincronização, camada
# "Configurações" (Fase 5). Arquivo próprio do módulo (branches.conf, ao
# lado de menu.sh) — nada aqui altera configuração global do Git nem
# scripts/control-center/config/control-center.conf.
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"
: "${MODULE_DIR:?MODULE_DIR precisa estar definido}"

_brs_conf_arquivo() {
  echo "$MODULE_DIR/branches.conf"
}

_brs_conf_padrao() {
  cat <<'CONF'
REMOTE_PADRAO="origin"
BRANCH_PRINCIPAL="main"
BRANCH_DESENVOLVIMENTO="develop"
VERBOSIDADE="normal"
LOG_SINCRONIZACAO="on"
TIMEOUT_REDE="15"
CONF
}

_brs_conf_carregar() {
  local arquivo
  arquivo="$(_brs_conf_arquivo)"
  [ -f "$arquivo" ] || _brs_conf_padrao > "$arquivo"
  # shellcheck disable=SC1090
  source "$arquivo"
}

_brs_conf_mostrar() {
  echo "Remote padrão              : $REMOTE_PADRAO"
  echo "Branch principal           : $BRANCH_PRINCIPAL"
  echo "Branch de desenvolvimento  : $BRANCH_DESENVOLVIMENTO"
  echo "Verbosidade                : $VERBOSIDADE"
  echo "Log de sincronização       : $LOG_SINCRONIZACAO"
  echo "Timeout de rede (segundos) : $TIMEOUT_REDE"
}

_brs_conf_editar_campo() {
  local chave="$1" rotulo="$2" atual novo arquivo
  arquivo="$(_brs_conf_arquivo)"
  atual="${!chave}"
  read -rp "$rotulo (atual: $atual, Enter mantém): " novo
  if [ -z "$novo" ]; then
    echo "Mantido: $atual"
    return
  fi
  if ! _cc_confirm "Alterar $rotulo para '$novo'?"; then
    echo "Cancelado."
    return
  fi
  sed -i "s#^${chave}=.*#${chave}=\"${novo}\"#" "$arquivo"
  _cc_ok "$rotulo atualizado para '$novo'."
  _cc_log "Branches e Sincronização: Configurações — $rotulo alterado de '$atual' para '$novo'"
}

_brs_configuracoes() {
  _brs_conf_carregar
  _cc_log "Branches e Sincronização: Configurações acessadas"
  while true; do
    echo "⚙️  Configurações — Branches e Sincronização"
    echo "───────────────────────────────────────────"
    _brs_conf_mostrar
    echo ""
    echo "  1) Alterar remote padrão"
    echo "  2) Alterar branch principal"
    echo "  3) Alterar branch de desenvolvimento"
    echo "  4) Alterar verbosidade"
    echo "  5) Alterar log de sincronização"
    echo "  6) Alterar timeout de rede"
    echo "  0) Voltar"
    read -rp "Opção: " opcao
    echo ""
    case "$opcao" in
      1) _brs_conf_editar_campo REMOTE_PADRAO "Remote padrão" ;;
      2) _brs_conf_editar_campo BRANCH_PRINCIPAL "Branch principal" ;;
      3) _brs_conf_editar_campo BRANCH_DESENVOLVIMENTO "Branch de desenvolvimento" ;;
      4) _brs_conf_editar_campo VERBOSIDADE "Verbosidade" ;;
      5) _brs_conf_editar_campo LOG_SINCRONIZACAO "Log de sincronização" ;;
      6) _brs_conf_editar_campo TIMEOUT_REDE "Timeout de rede" ;;
      0) return ;;
      *) echo "Opção inválida." ;;
    esac
    _brs_conf_carregar
    echo ""
  done
}
