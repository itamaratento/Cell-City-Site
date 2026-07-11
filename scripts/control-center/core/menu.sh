#!/bin/bash
# Cell City Control Center — núcleo (Fase 1: estrutura + menu principal).
#
# Comando oficial: `cellcity` (função em ~/.bashrc que executa este arquivo).
# Uso direto (sem passar pelo bashrc): scripts/control-center/core/menu.sh
#
# Arquitetura (ver README.md em scripts/control-center/ para o documento
# completo): este arquivo só monta o menu principal e despacha pro módulo
# escolhido. Cada módulo é 100% isolado em modules/<nome>/menu.sh — core/
# nunca conhece a lógica interna de um módulo, só o caminho do arquivo.
# Crescer o Control Center (Versão 2.0 em diante) é só adicionar uma pasta
# nova em modules/ e uma linha no _cc_dispatch abaixo — nunca precisa
# reorganizar o que já existe.
set -uo pipefail

CORE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CC_ROOT="$(cd "$CORE_DIR/.." && pwd)"
MODULES_DIR="$CC_ROOT/modules"

# shellcheck source=../lib/common.sh
source "$CC_ROOT/lib/common.sh"
# shellcheck source=../config/control-center.conf
source "$CC_ROOT/config/control-center.conf"

_cc_dispatch() {
  case "$1" in
    1) bash "$MODULES_DIR/desenvolvimento/menu.sh" ;;
    2) bash "$MODULES_DIR/release/menu.sh" ;;
    3) bash "$MODULES_DIR/backup-recuperacao/menu.sh" ;;
    4) bash "$MODULES_DIR/banco-dados/menu.sh" ;;
    5) bash "$MODULES_DIR/branches-sincronizacao/menu.sh" ;;
    6) bash "$MODULES_DIR/diagnostico/menu.sh" ;;
    7) bash "$MODULES_DIR/ferramentas/menu.sh" ;;
    8) bash "$MODULES_DIR/central-ias/menu.sh" ;;
    9) bash "$MODULES_DIR/configuracoes/menu.sh" ;;
    *) echo "Opção inválida." ;;
  esac
}

_cc_log "Control Center iniciado (v$CC_VERSION, Fase $CC_FASE)"

while true; do
  echo ""
  echo "=========================================="
  echo "        CELL CITY CONTROL CENTER"
  echo "        v$CC_VERSION — Fase $CC_FASE"
  echo "=========================================="
  echo ""
  echo "1 - Desenvolvimento"
  echo "2 - Release"
  echo "3 - Backup e Recuperação"
  echo "4 - Banco de Dados"
  echo "5 - Branches e Sincronização"
  echo "6 - Diagnóstico"
  echo "7 - Ferramentas"
  echo "8 - Central das IAs"
  echo "9 - Configurações"
  echo ""
  echo "0 - Sair"
  echo ""
  echo "=========================================="
  read -rp "Escolha uma opção: " escolha
  if [ "$escolha" = "0" ]; then
    _cc_log "Control Center encerrado (opção 0)"
    echo "Saindo do Control Center."
    exit 0
  fi
  _cc_log "Opção selecionada: $escolha"
  _cc_dispatch "$escolha"
done
