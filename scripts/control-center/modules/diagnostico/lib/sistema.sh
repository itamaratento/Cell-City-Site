#!/bin/bash
# Cell City Control Center — módulo Diagnóstico, verificações do sistema
# operacional (SO, kernel, disco, memória, CPU, processos, permissões,
# variáveis de ambiente e relógio).
#
# Todas as funções retornam resultados via _cc_diag_adicionar() — nenhuma
# saída direta para o terminal.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/sistema.sh}"
: "${REPO_DIR:?REPO_DIR precisa estar definido antes de carregar lib/sistema.sh}"

_cc_diag_sistema() {
  _cc_diag_so
  _cc_diag_distribuicao
  _cc_diag_versao_ubuntu
  _cc_diag_kernel
  _cc_diag_espaco_disco
  _cc_diag_memoria_ram
  _cc_diag_cpu
  _cc_diag_processos
  _cc_diag_permissoes
  _cc_diag_variaveis_ambiente
  _cc_diag_relogio
}

_cc_diag_so() {
  local so
  so=$(uname -s 2>/dev/null)
  if [ "$so" = "Linux" ]; then
    _cc_diag_adicionar "ok" "Sistema Operacional" "GNU/Linux ($so)"
  else
    _cc_diag_adicionar "warn" "Sistema Operacional" "$so" "SO diferente do esperado" "Scripts do projeto assumem Linux" "Considere usar Ubuntu Linux"
  fi
}

_cc_diag_distribuicao() {
  local distro=""
  if [ -f /etc/os-release ]; then
    distro=$(grep -oP '^PRETTY_NAME="?\K[^"]+' /etc/os-release 2>/dev/null || grep '^ID=' /etc/os-release 2>/dev/null | cut -d= -f2)
  elif command -v lsb_release &>/dev/null; then
    distro=$(lsb_release -d 2>/dev/null | cut -f2-)
  fi
  if echo "$distro" | grep -qi "ubuntu"; then
    _cc_diag_adicionar "ok" "Distribuição Linux" "$distro"
  elif [ -n "$distro" ]; then
    _cc_diag_adicionar "warn" "Distribuição Linux" "$distro" "Distribuição não Ubuntu" "Ambiente homologado para Ubuntu" "Considere Ubuntu 22.04+"
  else
    _cc_diag_adicionar "warn" "Distribuição Linux" "Não detectada" "Não foi possível identificar a distribuição"
  fi
}

_cc_diag_versao_ubuntu() {
  local versao=""
  if [ -f /etc/os-release ]; then
    versao=$(grep -oP '^VERSION_ID="?\K[^"]+' /etc/os-release 2>/dev/null)
  elif command -v lsb_release &>/dev/null; then
    versao=$(lsb_release -r 2>/dev/null | cut -f2-)
  fi
  if [ -n "$versao" ]; then
    _cc_diag_adicionar "ok" "Versão do Ubuntu" "$versao"
  else
    _cc_diag_adicionar "warn" "Versão do Ubuntu" "Não detectada" "Não foi possível detectar a versão"
  fi
}

_cc_diag_kernel() {
  local kernel
  kernel=$(uname -r 2>/dev/null)
  if [ -n "$kernel" ]; then
    _cc_diag_adicionar "ok" "Kernel" "$kernel"
  else
    _cc_diag_adicionar "fail" "Kernel" "Não detectado" "Falha ao executar uname -r" "Impossível determinar versão do kernel" "Verifique a instalação do sistema"
  fi
}

_cc_diag_espaco_disco() {
  local usado
  if ! usado=$(df / --output=pcent 2>/dev/null | tail -1 | tr -d ' %'); then
    _cc_diag_adicionar "fail" "Espaço em Disco" "Não foi possível verificar" "Falha ao executar df" "Impossível monitorar espaço" "Verifique permissões do comando df"
    return
  fi
  if [ "$usado" -ge 90 ]; then
    _cc_diag_adicionar "fail" "Espaço em Disco" "${usado}% usado" "Disco quase cheio" "Risco de falhas em operações de arquivo" "Libere espaço ou aumente o disco"
  elif [ "$usado" -ge 75 ]; then
    _cc_diag_adicionar "warn" "Espaço em Disco" "${usado}% usado" "Uso elevado de disco" "Pode impactar performance" "Considere liberar espaço"
  else
    _cc_diag_adicionar "ok" "Espaço em Disco" "${usado}% usado"
  fi
}

_cc_diag_memoria_ram() {
  local total disponivel usado pct_livre
  if ! total=$(free -m 2>/dev/null | awk '/^[Mm]em/' | awk '{print $2}'); then
    _cc_diag_adicionar "fail" "Memória RAM" "Não foi possível verificar" "Falha ao executar free" "Impossível monitorar memória" "Verifique permissões do comando free"
    return
  fi
  [ -z "$total" ] && total=0
  disponivel=$(free -m 2>/dev/null | awk '/^[Mm]em/' | awk '{print $7}')
  if [ -z "$disponivel" ] || ! [[ "$disponivel" =~ ^[0-9]+$ ]]; then
    usado=$(free -m 2>/dev/null | awk '/^[Mm]em/' | awk '{print $3}')
    [ -n "$usado" ] && [[ "$usado" =~ ^[0-9]+$ ]] && disponivel=$((total - usado))
    [ -z "$disponivel" ] || ! [[ "$disponivel" =~ ^[0-9]+$ ]] && disponivel=0
  fi
  if [ "$total" -eq 0 ]; then
    _cc_diag_adicionar "warn" "Memória RAM" "Não foi possível obter valores"
    return
  fi
  pct_livre=$((disponivel * 100 / total))
  if [ "$pct_livre" -lt 10 ]; then
    _cc_diag_adicionar "fail" "Memória RAM" "${total}MB total, ${disponivel}MB livre (${pct_livre}%)" "Memória insuficiente" "Risco de travamentos e OOM" "Feche processos ou adicione RAM"
  elif [ "$pct_livre" -lt 25 ]; then
    _cc_diag_adicionar "warn" "Memória RAM" "${total}MB total, ${disponivel}MB livre (${pct_livre}%)" "Uso elevado de memória" "Pode impactar performance do sistema" "Considere fechar processos"
  else
    _cc_diag_adicionar "ok" "Memória RAM" "${total}MB total, ${disponivel}MB livre (${pct_livre}%)"
  fi
}

_cc_diag_cpu() {
  local nucleos carga
  nucleos=$(nproc 2>/dev/null || echo "0")
  carga=$(uptime 2>/dev/null | grep -oP 'load average:.*' | cut -d: -f2 | tr -d ' ' || echo "0.00 0.00 0.00")
  local carga_1m
  carga_1m=$(echo "$carga" | cut -d, -f1 | tr -d ' ')
  if [ "$nucleos" -gt 0 ] && [ -n "$carga_1m" ]; then
    local limite=$((nucleos * 2))
    local carga_int
    carga_int=${carga_1m%.*}
    carga_int=${carga_int:-0}
    if [ "$carga_int" -ge "$limite" ]; then
      _cc_diag_adicionar "warn" "Uso de CPU" "${nucleos} núcleos, carga: ${carga_1m}" "Carga elevada de CPU" "Pode impactar processos do projeto" "Verifique processos em execução"
    else
      _cc_diag_adicionar "ok" "Uso de CPU" "${nucleos} núcleos, carga: ${carga_1m}"
    fi
  else
    _cc_diag_adicionar "warn" "Uso de CPU" "Não foi possível medir"
  fi
}

_cc_diag_processos() {
  local total_proc usuarios_proc
  total_proc=$(ps aux 2>/dev/null | wc -l) || { _cc_diag_adicionar "warn" "Processos em Execução" "Não foi possível contar"; return; }
  usuarios_proc=$(ps aux 2>/dev/null | awk '{print $1}' | sort -u | wc -l)
  _cc_diag_adicionar "ok" "Processos em Execução" "${total_proc} processos, ${usuarios_proc} usuários"
}

_cc_diag_permissoes() {
  local problemas=0
  local dirs_para_verificar=("$REPO_DIR" "$REPO_DIR/scripts" "$REPO_DIR/CRM")
  for dir in "${dirs_para_verificar[@]}"; do
    if [ -d "$dir" ] && [ ! -r "$dir" ]; then
      _cc_diag_adicionar "fail" "Permissões de Arquivos" "Sem acesso de leitura: $dir" "Permissão inadequada" "Impossível acessar diretório crítico" "Execute chmod +r no diretório"
      problemas=$((problemas + 1))
    fi
  done
  if [ "$problemas" -eq 0 ]; then
    local permissoes
    permissoes=$(stat -c "%a" "$REPO_DIR" 2>/dev/null || echo "???")
    _cc_diag_adicionar "ok" "Permissões de Arquivos" "Diretórios críticos acessíveis (modo $permissoes)"
  fi
}

_cc_diag_variaveis_ambiente() {
  local vars_importantes=("HOME" "USER" "PATH" "SHELL")
  local ausentes=0
  for var in "${vars_importantes[@]}"; do
    if [ -z "${!var:-}" ]; then
      ausentes=$((ausentes + 1))
    fi
  done
  if [ "$ausentes" -eq 0 ]; then
    _cc_diag_adicionar "ok" "Variáveis de Ambiente" "Principais variáveis definidas"
  else
    _cc_diag_adicionar "warn" "Variáveis de Ambiente" "${ausentes} variáveis ausentes" "Variáveis de ambiente não definidas" "Podem afetar execução de scripts" "Verifique configuração do shell"
  fi
}

_cc_diag_relogio() {
  local data_hora ano
  data_hora=$(date '+%Y-%m-%d %H:%M:%S' 2>/dev/null)
  ano=$(date '+%Y' 2>/dev/null)
  if [ -n "$ano" ] && [ "$ano" -ge 2024 ] && [ "$ano" -le 2030 ]; then
    _cc_diag_adicionar "ok" "Relógio do Sistema" "$data_hora"
  elif [ -n "$ano" ]; then
    _cc_diag_adicionar "warn" "Relógio do Sistema" "$data_hora" "Ano fora do esperado" "Pode causar erros de timestamp e SSL" "Corrija a data do sistema"
  else
    _cc_diag_adicionar "fail" "Relógio do Sistema" "Não detectado" "Falha ao executar date" "Impossível verificar data" "Verifique o comando date"
  fi
}
