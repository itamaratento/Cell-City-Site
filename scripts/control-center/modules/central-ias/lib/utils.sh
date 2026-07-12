#!/bin/bash
# Cell City Control Center — módulo Central de IAs, utilitários
# compartilhados (Fase 10 — CCC-F10-001). Leitura do Registro de Fases/
# IAs/Fluxo (config/*.conf, únicas fontes de verdade — nunca hardcoded em
# outro lib/*.sh) e config local do módulo (config/local.json, mesmo
# princípio isolado de modules/banco-dados/lib/utils.sh — nunca usa
# scripts/control-center/state/, schema fechado de 6 arquivos).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"
: "${MODULE_DIR:?MODULE_DIR precisa estar definido}"

CC_CIA_CONFIG_FILE="$MODULE_DIR/config/local.json"

_cc_cia_tem() { command -v "$1" >/dev/null 2>&1; }

# --- Registro de Fases (config/fases.conf) --------------------------------
# Cada linha: numero|nome|ia|status|modulos. Arquivo ausente não derruba o
# módulo — devolve lista vazia, cada tela mostra "nenhum registro" (ver
# README.md do módulo, "Tratamento de erros").
_cc_cia_fases() {
  local arquivo="$MODULE_DIR/config/fases.conf"
  [ -f "$arquivo" ] || return 0
  grep -vE '^[[:space:]]*(#|$)' "$arquivo"
}

_cc_cia_fase_campo() {
  local numero="$1" indice="$2"
  _cc_cia_fases | awk -F'|' -v n="$numero" -v i="$indice" '$1==n {print $i}'
}

# --- Registro de IAs (config/registry.conf) -------------------------------
_cc_cia_ias() {
  local arquivo="$MODULE_DIR/config/registry.conf"
  [ -f "$arquivo" ] || return 0
  grep -vE '^[[:space:]]*(#|$)' "$arquivo"
}

_cc_cia_ia_campo() {
  local slug="$1" indice="$2"
  _cc_cia_ias | awk -F'|' -v s="$slug" -v i="$indice" '$1==s {print $i}'
}

_cc_cia_ia_nome() { _cc_cia_ia_campo "$1" 2; }

# --- Fluxo de Desenvolvimento (config/workflow.conf) ----------------------
_cc_cia_estagios() {
  local arquivo="$MODULE_DIR/config/workflow.conf"
  [ -f "$arquivo" ] || return 0
  grep -vE '^[[:space:]]*(#|$)' "$arquivo"
}

# Mapeia o status de fases.conf pro estágio correspondente do Fluxo (CCC-
# F10-001, "Fluxo de Desenvolvimento") — única regra que traduz um pro
# outro, nunca duplicada em workflow.sh/dashboard.sh/tasks.sh.
_cc_cia_estagio_atual() {
  case "$1" in
    NAO_INICIADA)       echo "Planejamento" ;;
    EM_IMPLEMENTACAO)   echo "Implementação" ;;
    AGUARDANDO_REVISAO) echo "Auditoria" ;;
    CONCLUIDA)          echo "Release" ;;
    *)                  echo "?" ;;
  esac
}

_cc_cia_status_label() {
  case "$1" in
    CONCLUIDA)          printf '%sCONCLUÍDA%s' "$_CC_C_VERDE" "$_CC_C_RESET" ;;
    AGUARDANDO_REVISAO) printf '%sAGUARDANDO REVISÃO%s' "$_CC_C_AMARELO" "$_CC_C_RESET" ;;
    EM_IMPLEMENTACAO)   printf '%sEM IMPLEMENTAÇÃO%s' "$_CC_C_CIANO" "$_CC_C_RESET" ;;
    NAO_INICIADA)       printf '%sNÃO INICIADA%s' "$_CC_C_VERMELHO" "$_CC_C_RESET" ;;
    SAUDAVEL)           printf '%sSAUDÁVEL%s' "$_CC_C_VERDE" "$_CC_C_RESET" ;;
    ATENCAO)            printf '%sATENÇÃO%s' "$_CC_C_AMARELO" "$_CC_C_RESET" ;;
    CRITICO)            printf '%sCRÍTICO%s' "$_CC_C_VERMELHO" "$_CC_C_RESET" ;;
    *)                  echo "$1" ;;
  esac
}

# Estado REAL de um módulo no disco — nunca confia cegamente no status
# declarado em fases.conf (mesmo espírito da checagem manual já feita
# nesta sessão contra o Roadmap CCC-ROADMAP-001, ver memória do projeto).
# "-" e "*" (infra/transversal) não têm módulo próprio: N/A.
_cc_cia_modulo_estado_real() {
  local slug="$1" menu
  case "$slug" in
    -|'*') echo "N/A"; return ;;
  esac
  menu="$CC_ROOT/modules/$slug/menu.sh"
  if [ ! -f "$menu" ]; then
    echo "AUSENTE"
  elif grep -q '_cc_placeholder' "$menu"; then
    echo "PLACEHOLDER"
  else
    echo "IMPLEMENTADO"
  fi
}

# Última atividade real (git log) nos módulos atribuídos a uma IA — nunca
# estimada. Módulo ainda não commitado (comum nas Fases em andamento de
# outra sessão, ver feedback-concorrencia-sessoes-checkout) reporta isso
# explicitamente em vez de mentir uma data.
_cc_cia_ia_ultima_atividade() {
  local slug="$1" linha modulo caminhos=() data
  while IFS= read -r linha; do
    [ -z "$linha" ] && continue
    IFS=',' read -ra partes <<< "$linha"
    for modulo in "${partes[@]}"; do
      case "$modulo" in
        -|'*') continue ;;
      esac
      caminhos+=("scripts/control-center/modules/$modulo")
    done
  done < <(_cc_cia_fases | awk -F'|' -v s="$slug" '$3==s {print $5}')

  [ "${#caminhos[@]}" -eq 0 ] && { echo "sem módulo atribuído"; return; }
  data=$(git -C "$REPO_DIR" log -1 --format='%ar' -- "${caminhos[@]}" 2>/dev/null)
  [ -n "$data" ] && echo "$data" || echo "sem commit ainda (módulo não versionado)"
}

# --- Config local do módulo (config/local.json) ---------------------------
# Escopo isolado deste módulo — nunca em state/ (mesmo princípio de
# modules/banco-dados/lib/utils.sh). Arquivo gitignored (ver ../../../
# ../../.gitignore, mesma exceção usada pra qualquer módulo/config/local.json).
_cc_cia_config_default() {
  cat <<'EOF'
{
  "diretorio_documentos": "scripts/control-center/docs",
  "diretorio_relatorios": "_reports/ai-center",
  "verbosidade": "normal",
  "logs": "on",
  "formato_exportacao_padrao": "txt"
}
EOF
}

_cc_cia_config_ler() {
  if [ -f "$CC_CIA_CONFIG_FILE" ] && _cc_cia_tem jq && jq -e . "$CC_CIA_CONFIG_FILE" >/dev/null 2>&1; then
    cat "$CC_CIA_CONFIG_FILE"
  else
    _cc_cia_config_default
  fi
}

_cc_cia_config_get() {
  local chave="$1" padrao="${2:-}" valor
  valor=$(_cc_cia_config_ler | jq -r --arg k "$chave" '.[$k] // empty' 2>/dev/null)
  [ -z "$valor" ] && valor="$padrao"
  echo "$valor"
}

_cc_cia_config_set() {
  local chave="$1" valor="$2" atual
  mkdir -p "$(dirname "$CC_CIA_CONFIG_FILE")"
  atual=$(_cc_cia_config_ler)
  echo "$atual" | jq --arg k "$chave" --arg v "$valor" '.[$k] = $v' > "$CC_CIA_CONFIG_FILE.tmp" && mv "$CC_CIA_CONFIG_FILE.tmp" "$CC_CIA_CONFIG_FILE"
}

# Log condicionado à configuração "logs" (on/off) — única forma de desligar
# log neste módulo sem afetar _cc_log global (usado por todo o resto do
# Control Center).
_cc_cia_log() {
  [ "$(_cc_cia_config_get "logs" "on")" = "off" ] && return
  _cc_log "Central de IAs: $1"
}
