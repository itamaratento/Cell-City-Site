#!/bin/bash
# Cell City Control Center — módulo Banco de Dados, utilitários compartilhados.
# Contadores, classificação, formatação e acesso a config do Firebase
# (firebase.json/.firebaserc) e ao gcloud. Nenhuma regra de negócio de
# inspeção mora aqui — só coleta de contexto e formatação (mesmo princípio
# de modules/ferramentas/lib/utils.sh).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido antes de carregar lib/utils.sh}"
: "${REPO_DIR:?REPO_DIR precisa estar definido antes de carregar lib/utils.sh}"
: "${MODULE_DIR:?MODULE_DIR precisa estar definido antes de carregar lib/utils.sh}"

CC_BD_CONFIG_FILE="$MODULE_DIR/config/local.json"
CC_BD_TIMEOUT="${CC_BD_TIMEOUT:-15}"

_cc_bd_init() {
  CC_BD_RESULTADOS=()
  CC_BD_INFO=()
  CC_BD_TOTAL=0
  CC_BD_OK=0
  CC_BD_WARN=0
  CC_BD_FAIL=0
  CC_BD_INICIO_EPOCA=$(date '+%s' 2>/dev/null || echo "0")
  _cc_log "Banco de Dados: rotina iniciada"
}

_cc_bd_adicionar() {
  local status="$1" descricao="$2" detalhes="${3:-}" sugestao="${4:-}"
  CC_BD_RESULTADOS+=("${status}|${descricao}|${detalhes}|${sugestao}")
  CC_BD_TOTAL=$((CC_BD_TOTAL + 1))
  case "$status" in
    ok)   CC_BD_OK=$((CC_BD_OK + 1)) ;;
    warn) CC_BD_WARN=$((CC_BD_WARN + 1)) ;;
    fail) CC_BD_FAIL=$((CC_BD_FAIL + 1)) ;;
  esac
}

_cc_bd_info() {
  CC_BD_INFO+=("$1")
}

_cc_bd_duracao() {
  local agora diff minutos segundos
  agora=$(date '+%s' 2>/dev/null || echo "0")
  [ "$agora" = "0" ] && echo "0s" && return
  [ "${CC_BD_INICIO_EPOCA:-0}" = "0" ] && echo "0s" && return
  diff=$((agora - CC_BD_INICIO_EPOCA))
  minutos=$((diff / 60))
  segundos=$((diff % 60))
  [ "$minutos" -gt 0 ] && echo "${minutos}m${segundos}s" || echo "${segundos}s"
}

# Duas escalas de rótulo — a mesma contagem de fail/warn, vocabulário
# diferente conforme a seção do menu (ver CCC-F04-001 §4 "Status do Banco"
# vs §9 "Integridade").
_cc_bd_classificar_saude() {
  if [ "${CC_BD_FAIL:-0}" -gt 0 ]; then
    echo "CRITICO"
  elif [ "${CC_BD_WARN:-0}" -gt 0 ]; then
    echo "ATENCAO"
  else
    echo "SAUDAVEL"
  fi
}

_cc_bd_classificar_integridade() {
  if [ "${CC_BD_FAIL:-0}" -gt 0 ]; then
    echo "ERRO"
  elif [ "${CC_BD_WARN:-0}" -gt 0 ]; then
    echo "WARNING"
  else
    echo "OK"
  fi
}

_cc_bd_status_label() {
  case "$1" in
    ok|OK)         printf '%sOK%s' "$_CC_C_VERDE" "$_CC_C_RESET" ;;
    warn|WARNING)  printf '%sWARNING%s' "$_CC_C_AMARELO" "$_CC_C_RESET" ;;
    fail|ERRO)     printf '%sERRO%s' "$_CC_C_VERMELHO" "$_CC_C_RESET" ;;
    SAUDAVEL)      printf '%sSAUDÁVEL%s' "$_CC_C_VERDE" "$_CC_C_RESET" ;;
    ATENCAO)       printf '%sATENÇÃO%s' "$_CC_C_AMARELO" "$_CC_C_RESET" ;;
    CRITICO)       printf '%sCRÍTICO%s' "$_CC_C_VERMELHO" "$_CC_C_RESET" ;;
    *)             echo "$1" ;;
  esac
}

# --- Config do Firebase (firebase.json / .firebaserc) --------------------
# Fonte única — nunca hardcoda caminho de rules/indexes: lê de firebase.json,
# igual ao projeto real está configurado (evita o desalinhamento raiz×CRM/
# encontrado em módulos/ferramentas/lib/auditoria-firebase.sh, que assume
# firestore.rules na raiz).

_cc_bd_tem() { command -v "$1" >/dev/null 2>&1; }

_cc_bd_firebase_json_valido() {
  [ -f "$REPO_DIR/firebase.json" ] && jq -e . "$REPO_DIR/firebase.json" >/dev/null 2>&1
}

_cc_bd_rules_path() {
  local rel
  if _cc_bd_tem jq && _cc_bd_firebase_json_valido; then
    rel=$(jq -r '.firestore.rules // empty' "$REPO_DIR/firebase.json" 2>/dev/null)
  fi
  [ -z "${rel:-}" ] && rel="firestore.rules"
  echo "$REPO_DIR/$rel"
}

_cc_bd_indexes_path() {
  local rel
  if _cc_bd_tem jq && _cc_bd_firebase_json_valido; then
    rel=$(jq -r '.firestore.indexes // empty' "$REPO_DIR/firebase.json" 2>/dev/null)
  fi
  [ -z "${rel:-}" ] && rel="firestore.indexes.json"
  echo "$REPO_DIR/$rel"
}

_cc_bd_regiao() {
  local reg
  if _cc_bd_tem jq && _cc_bd_firebase_json_valido; then
    reg=$(jq -r '.firestore.location // empty' "$REPO_DIR/firebase.json" 2>/dev/null)
  fi
  [ -z "${reg:-}" ] && reg="desconhecida"
  echo "$reg"
}

_cc_bd_database_id() {
  local id
  if _cc_bd_tem jq && _cc_bd_firebase_json_valido; then
    id=$(jq -r '.firestore.database // empty' "$REPO_DIR/firebase.json" 2>/dev/null)
  fi
  [ -z "${id:-}" ] && id="(default)"
  echo "$id"
}

# Projeto Firebase por ambiente — nunca autodetectado (mesmo princípio do
# módulo Backup e Recuperação: ambiente sempre explícito). Lê de
# .firebaserc; cai para os IDs conhecidos do projeto só se o arquivo faltar
# ou for inválido (nunca falha silenciosamente).
_cc_bd_projeto_id() {
  local ambiente="$1" id
  if _cc_bd_tem jq && [ -f "$REPO_DIR/.firebaserc" ] && jq -e . "$REPO_DIR/.firebaserc" >/dev/null 2>&1; then
    case "$ambiente" in
      prod) id=$(jq -r '.projects.default // empty' "$REPO_DIR/.firebaserc" 2>/dev/null) ;;
      dev)  id=$(jq -r '.projects.dev // empty' "$REPO_DIR/.firebaserc" 2>/dev/null) ;;
    esac
  fi
  if [ -z "${id:-}" ]; then
    case "$ambiente" in
      prod) id="cellcity-crm" ;;
      dev)  id="cellcity-crm-dev" ;;
    esac
  fi
  echo "$id"
}

# Pergunta o ambiente (nunca assume) — mesmo padrão de interação de
# modules/backup-recuperacao/lib/backup.sh (_bkp_firebase). Ecoa "" e
# devolve status != 0 quando cancelado, pro chamador decidir o que fazer.
_cc_bd_escolher_ambiente() {
  echo "Ambiente:" >&2
  echo "  1) dev  (projeto de desenvolvimento)" >&2
  echo "  2) prod (projeto de produção)" >&2
  read -rp "Escolha (1/2, qualquer outra tecla cancela): " amb
  case "$amb" in
    1) echo "dev" ;;
    2) echo "prod" ;;
    *) return 1 ;;
  esac
}

# --- gcloud (somente leitura) ---------------------------------------------
# Nenhuma chamada desta função escreve/publica nada — só describe/list.
# Timeout defensivo (CC_BD_TIMEOUT) pra nunca travar o menu esperando rede.
CC_BD_GCLOUD_ERRO=""

_cc_bd_gcloud_json() {
  local projeto="$1"; shift
  CC_BD_GCLOUD_ERRO=""
  if ! _cc_bd_tem gcloud; then
    CC_BD_GCLOUD_ERRO="gcloud não está instalado neste ambiente"
    return 1
  fi
  local saida
  if ! saida=$(timeout "${CC_BD_TIMEOUT}s" gcloud "$@" "--project=$projeto" --format=json 2>&1); then
    CC_BD_GCLOUD_ERRO=$(echo "$saida" | head -3 | tr '\n' ' ')
    [ -z "$CC_BD_GCLOUD_ERRO" ] && CC_BD_GCLOUD_ERRO="gcloud falhou (timeout ou sem autenticação)"
    return 1
  fi
  echo "$saida"
}

_cc_bd_gcloud_autenticado() {
  _cc_bd_tem gcloud || return 1
  local conta
  conta=$(timeout "${CC_BD_TIMEOUT}s" gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null)
  [ -n "$conta" ]
}

# --- Config local do módulo (config/local.json) ---------------------------
# Escopo isolado deste módulo — nunca usa scripts/control-center/state/
# (schema fechado de 6 rotinas já existentes, ver README.md "Arquitetura" —
# Banco de Dados não fazia parte dessa lista original e o arquivo está sob
# edição concorrente de outra sessão nesta mesma Sprint).
_cc_bd_config_default() {
  cat <<'EOF'
{
  "ambiente_padrao": null,
  "diretorio_exportacao": "_reports/database",
  "verbosidade": "normal",
  "timeout_segundos": 15
}
EOF
}

_cc_bd_config_ler() {
  if [ -f "$CC_BD_CONFIG_FILE" ] && _cc_bd_tem jq && jq -e . "$CC_BD_CONFIG_FILE" >/dev/null 2>&1; then
    cat "$CC_BD_CONFIG_FILE"
  else
    _cc_bd_config_default
  fi
}

_cc_bd_config_get() {
  local chave="$1" padrao="${2:-}"
  local valor
  valor=$(_cc_bd_config_ler | jq -r --arg k "$chave" '.[$k] // empty' 2>/dev/null)
  [ -z "$valor" ] && valor="$padrao"
  echo "$valor"
}

# --- Menu "Ferramentas" (CCC-F04-001 §12) ---------------------------------
# Só dispatch — cada opção chama uma função de serviço já definida em
# collections.sh/rules.sh/indexes.sh/functions.sh/integrity.sh. Nenhuma
# regra de auditoria mora aqui.
_cc_bd_menu_ferramentas() {
  local opcao
  while true; do
    _cc_screen_title "FERRAMENTAS"
    _cc_screen_breadcrumb "Control Center › Banco de Dados › Ferramentas"
    _cc_box_blank
    _cc_box_item "1" "Localizar Coleções Vazias"
    _cc_box_item "2" "Localizar Rules não utilizadas"
    _cc_box_item "3" "Localizar Índices não utilizados"
    _cc_box_item "4" "Localizar Functions órfãs"
    _cc_box_item "5" "Validar Estrutura Firebase"
    _cc_box_blank
    _cc_box_item "0" "Voltar"
    _cc_screen_footer "Somente leitura · 0 volta"
    read -rp "Opção: " opcao
    case "$opcao" in
      1) _cc_bd_colecoes_vazias; _cc_pause ;;
      2) _cc_bd_rules_nao_utilizadas_listar; _cc_pause ;;
      3) _cc_bd_indices_nao_utilizados_listar; _cc_pause ;;
      4) _cc_bd_functions_orfas_listar; _cc_pause ;;
      5) _cc_bd_integridade; _cc_pause ;;
      0) break ;;
      *) echo "Opção inválida." ;;
    esac
  done
}

_cc_bd_config_set() {
  local chave="$1" valor="$2"
  mkdir -p "$(dirname "$CC_BD_CONFIG_FILE")"
  local atual
  atual=$(_cc_bd_config_ler)
  echo "$atual" | jq --arg k "$chave" --arg v "$valor" '.[$k] = $v' > "$CC_BD_CONFIG_FILE.tmp" && mv "$CC_BD_CONFIG_FILE.tmp" "$CC_BD_CONFIG_FILE"
}
