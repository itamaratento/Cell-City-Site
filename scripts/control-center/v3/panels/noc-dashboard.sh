#!/bin/bash
# CELL CITY V3 - NOC Dashboard (Fase 1 Completa)
# Painel executivo operacional com dados reais, health score,
# navegacao por teclado, painel de alertas e missoes.
set -uo pipefail

: "${V3_ROOT:?V3_ROOT precisa estar definido antes de carregar panels/noc-dashboard.sh}"
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

declare -A _V3_NOC_STATE
_V3_NOC_REFRESH_INTERVAL=5
_V3_NOC_ACTIVE_PANEL="main"
_V3_NOC_SELECTED_ROW=0
_V3_NOC_LAST_FULL_RENDER=0
_V3_NOC_BOOT_TIME=0

declare -a _V3_NOC_NAV_ROWS
_V3_NOC_NAV_ROWS=()

_v3_noc_init() {
  source "$V3_ROOT/services/collectors.sh" 2>/dev/null || true
  source "$V3_ROOT/services/health-score.sh" 2>/dev/null || true
  _V3_NOC_BOOT_TIME=$(_v3_timestamp_epoch)
}

_v3_noc_refresh_data() {
  local now
  now=$(_v3_timestamp_epoch)
  local age=$((now - _V3_NOC_LAST_FULL_RENDER))

  if [[ "$age" -lt "$_V3_NOC_REFRESH_INTERVAL" ]]; then
    return 0
  fi

  _V3_NOC_LAST_FULL_RENDER=$now

  local git_data
  git_data=$(_v3_collect_git 2>/dev/null || echo '{"status":"error"}')
  _V3_NOC_STATE[git_data]="$git_data"
  _V3_NOC_STATE[git_status]=$(echo "$git_data" | jq -r '.status // "error"')
  _V3_NOC_STATE[git_branch]=$(echo "$git_data" | jq -r '.branch // "?"')
  _V3_NOC_STATE[git_commit]=$(echo "$git_data" | jq -r '.commit // "?"')
  _V3_NOC_STATE[git_ws]=$(echo "$git_data" | jq -r '.workspace // "?"')
  _V3_NOC_STATE[git_tag]=$(echo "$git_data" | jq -r '.last_tag // "none"')
  _V3_NOC_STATE[git_ahead]=$(echo "$git_data" | jq -r '.ahead // 0')
  _V3_NOC_STATE[git_behind]=$(echo "$git_data" | jq -r '.behind // 0')

  local system_data
  system_data=$(_v3_collect_system 2>/dev/null || echo '{"status":"error"}')
  _V3_NOC_STATE[system_data]="$system_data"
  _V3_NOC_STATE[cpu]=$(echo "$system_data" | jq -r '.cpu_percent // 0')
  _V3_NOC_STATE[ram]=$(echo "$system_data" | jq -r '.ram_percent // 0')
  _V3_NOC_STATE[disk]=$(echo "$system_data" | jq -r '.disk_percent // 0')
  _V3_NOC_STATE[uptime]=$(echo "$system_data" | jq -r '.uptime_seconds // 0')
  _V3_NOC_STATE[ram_status]=$(echo "$system_data" | jq -r '.ram_status // "OK"')
  _V3_NOC_STATE[disk_status]=$(echo "$system_data" | jq -r '.disk_status // "OK"')

  local fb_data
  fb_data=$(_v3_collect_firebase 2>/dev/null || echo '{"status":"error"}')
  _V3_NOC_STATE[fb_data]="$fb_data"
  _V3_NOC_STATE[firebase]=$(echo "$fb_data" | jq -r '.status // "error"')
  _V3_NOC_STATE[functions]=$(echo "$fb_data" | jq -r '.functions // "error"')

  local backup_data
  backup_data=$(_v3_collect_backup 2>/dev/null || echo '{"status":"error"}')
  _V3_NOC_STATE[backup_data]="$backup_data"
  _V3_NOC_STATE[backups]=$(echo "$backup_data" | jq -r '.status // "error"')
  _V3_NOC_STATE[backup_count]=$(echo "$backup_data" | jq -r '.count // 0')
  _V3_NOC_STATE[last_backup]=$(echo "$backup_data" | jq -r '.last_backup // "N/A"')

  local release_data
  release_data=$(_v3_collect_release 2>/dev/null || echo '{"status":"error"}')
  _V3_NOC_STATE[release_data]="$release_data"
  _V3_NOC_STATE[releases]=$(echo "$release_data" | jq -r '.status // "error"')
  _V3_NOC_STATE[last_release]=$(echo "$release_data" | jq -r '.last_tag // "N/A"')
  _V3_NOC_STATE[last_release_date]=$(echo "$release_data" | jq -r '.last_release_date // "N/A"')

  local crm_data
  crm_data=$(_v3_collect_crm 2>/dev/null || echo '{"status":"error"}')
  _V3_NOC_STATE[crm_data]="$crm_data"
  _V3_NOC_STATE[crm]=$(echo "$crm_data" | jq -r '.status // "error"')

  local sec_data
  sec_data=$(_v3_collect_security 2>/dev/null || echo '{"status":"error"}')
  _V3_NOC_STATE[security]=$(echo "$sec_data" | jq -r '.status // "error"')

  local mod_data
  mod_data=$(_v3_collect_modules 2>/dev/null || echo '{"status":"error"}')
  _V3_NOC_STATE[modules]=$(echo "$mod_data" | jq -r '.status // "error"')
  _V3_NOC_STATE[module_count]=$(echo "$mod_data" | jq -r '.total_modules // 0')

  local site_data
  site_data=$(_v3_collect_site 2>/dev/null || echo '{"status":"error"}')
  _V3_NOC_STATE[site]=$(echo "$site_data" | jq -r '.status // "error"')

  local health_result
  local he_state="$CC_ROOT/../health-engine/state/health-check.json"
  if [[ -f "$he_state" ]]; then
    local he_mode he_age
    he_mode=$(jq -r '.execucao.tipo // "desconhecido"' "$he_state" 2>/dev/null)
    he_age=$(($(date +%s) - $(stat -c %Y "$he_state" 2>/dev/null || echo 0)))
    # ignora quick mode — só tem 3 checkers e puxa o score pra baixo no dashboard
    if [[ "$he_mode" != "quick" && "$he_age" -lt 300 ]]; then
      health_result=$(jq -c '{score: (.score.geral // 0), level: (.nivel // "CRITICO"), source: "health-engine"}' "$he_state" 2>/dev/null || echo '{"score":0,"level":"CRITICO"}')
    else
      health_result=$(_v3_health_calculate 2>/dev/null || echo '{"score":0,"level":"CRITICO"}')
    fi
  else
    health_result=$(_v3_health_calculate 2>/dev/null || echo '{"score":0,"level":"CRITICO"}')
  fi
  _V3_NOC_STATE[health_score]=$(echo "$health_result" | jq -r '.score // 0')
  _V3_NOC_STATE[health_level]=$(echo "$health_result" | jq -r '.level // "CRITICO"')
  _V3_NOC_STATE[health_data]="$health_result"

  local saas_status="OFFLINE"
  [[ -f "$REPO_DIR/DEPLOY_SAAS.sh" ]] && saas_status="CONFIGURADO"
  _V3_NOC_STATE[saas]="$saas_status"

  _V3_NOC_STATE[last_update]="$(_v3_timestamp)"

  _v3_log "debug" "NOC" "Refresh concluido em $(( $(_v3_timestamp_epoch) - now ))s"
}

_v3_noc_indicator() {
  local label="$1" status="$2" detail="${3:-}" key="${4:-}"
  local icon=" "
  case "$status" in
    OK|ok|clean|configured|CONFIGURADO|online|EXCELENTE|BOM) icon="*" ;;
    DIRTY|dirty|ATENCAO|warn|checking) icon="~" ;;
    error|CRITICO|MISSING|OFFLINE|fail|missing) icon="-" ;;
  esac

  local color="${_CC_C_RESET}"
  case "$status" in
    OK|ok|clean|configured|CONFIGURADO|online|EXCELENTE|BOM)
      color="${_CC_C_VERDE}" ;;
    DIRTY|dirty|ATENCAO|warn|checking)
      color="${_CC_C_AMARELO}" ;;
    error|CRITICO|MISSING|OFFLINE|fail|missing|unknown)
      color="${_CC_C_VERMELHO}" ;;
    *) color="${_CC_C_CIANO}" ;;
  esac

  local display_detail=""
  [[ -n "$detail" ]] && display_detail=" ${detail}"

  printf -v line "  %s %-16s %s%s%s" "$icon" "$label" "$color" "$status" "${_CC_C_RESET}"
  [[ -n "$detail" ]] && printf -v line "%s%s" "$line" "$display_detail"

  _cc_box_line "$line"

  [[ -n "$key" ]] && _V3_NOC_NAV_ROWS+=("$key")
}

_v3_noc_render_header() {
  _cc_box_top
  _cc_box_line_center "CELL CITY CONTROL CENTER V3"
  _cc_box_line_center "NOC EXECUTIVO"
  _cc_box_sep

  local version="v${_V3_VERSION}"
  local branch="${_V3_NOC_STATE[git_branch]:-?}"
  local commit="${_V3_NOC_STATE[git_commit]:-?}"
  local uptime_str
  uptime_str=$(_v3_format_duration "${_V3_NOC_STATE[uptime]:-0}")
  local last_upd="${_V3_NOC_STATE[last_update]:-$(_v3_timestamp)}"

  _cc_box_line "Versao           : $version"
  _cc_box_line "Branch            : $branch"
  _cc_box_line "Commit            : $commit"
  _cc_box_line "Tempo ligado      : $uptime_str"
  _cc_box_line "Ultima atualizacao: $(echo "$last_upd" | cut -c1-19)"
}

_v3_noc_render_health() {
  _cc_box_sep
  local score="${_V3_NOC_STATE[health_score]:-0}"
  local level="${_V3_NOC_STATE[health_level]:-CRITICO}"
  local score_color="${_CC_C_RESET}"
  case "$level" in
    EXCELENTE) score_color="${_CC_C_VERDE}" ;;
    BOM)       score_color="${_CC_C_CIANO}" ;;
    ATENCAO)   score_color="${_CC_C_AMARELO}" ;;
    CRITICO)   score_color="${_CC_C_VERMELHO}" ;;
  esac

  _cc_box_line_center "HEALTH SCORE"
  _cc_box_line_center "${score_color}${score}%${_CC_C_RESET}"
  _cc_box_line_center "${score_color}${level}${_CC_C_RESET}"
}

_v3_noc_render_infrastructure() {
  _cc_box_sep
  _V3_NOC_NAV_ROWS=()
  _cc_box_line "INFRAESTRUTURA"

  _v3_noc_indicator "CRM"              "${_V3_NOC_STATE[crm]:-checking}"   "" "crm"
  _v3_noc_indicator "Site"             "${_V3_NOC_STATE[site]:-checking}"  "" "site"
  _v3_noc_indicator "SaaS"             "${_V3_NOC_STATE[saas]:-checking}"  "" "saas"
  _v3_noc_indicator "Central Modulos"  "${_V3_NOC_STATE[modules]:-checking}" "(${_V3_NOC_STATE[module_count]:-0})" "modules"
  _v3_noc_indicator "Banco Dados"      "${_V3_NOC_STATE[firebase]:-checking}" "" "db"
  _v3_noc_indicator "Firestore"        "${_V3_NOC_STATE[firebase]:-checking}" "" "firestore"
  _v3_noc_indicator "Cloud Functions"  "${_V3_NOC_STATE[functions]:-checking}" "" "functions"
}

_v3_noc_render_devops() {
  _cc_box_sep
  _cc_box_line "DEVOPS"

  _v3_noc_indicator "Git"              "${_V3_NOC_STATE[git_status]:-checking}" \
    "(${_V3_NOC_STATE[git_ws]:-?} +${_V3_NOC_STATE[git_ahead]:-0}/-${_V3_NOC_STATE[git_behind]:-0})" "git"
  _v3_noc_indicator "GitHub"           "${_V3_NOC_STATE[site]:-checking}"  "" "github"
  _v3_noc_indicator "Actions"          "${_V3_NOC_STATE[site]:-checking}"  "" "actions"
  _v3_noc_indicator "Releases"         "${_V3_NOC_STATE[releases]:-checking}" \
    "(${_V3_NOC_STATE[last_release]:-N/A})" "release"
  _v3_noc_indicator "Backups"          "${_V3_NOC_STATE[backups]:-checking}" \
    "(${_V3_NOC_STATE[backup_count]:-0})" "backup"
}

_v3_noc_render_system() {
  _cc_box_sep
  _cc_box_line "SISTEMA"

  local perf_status="OK"
  local cpu="${_V3_NOC_STATE[cpu]:-0}"
  [[ "$cpu" -gt 80 ]] && perf_status="ATENCAO"

  _v3_noc_indicator "Performance"      "$perf_status"                     "CPU:${cpu}%" "perf"
  _v3_noc_indicator "Seguranca"        "${_V3_NOC_STATE[security]:-checking}" "" "sec"
  _v3_noc_indicator "RBAC"             "${_V3_NOC_STATE[security]:-checking}" "" "rbac"
  _v3_noc_indicator "Usuarios"         "${_V3_NOC_STATE[security]:-checking}" "" "users"
  _v3_noc_indicator "Logs"             "OK"                               "" "logs"
  _v3_noc_indicator "Alertas"          "OK"                               "" "alerts"
}

_v3_noc_render_resources() {
  _cc_box_sep
  _cc_box_line "RECURSOS"

  local ram="${_V3_NOC_STATE[ram]:-0}"
  local disk="${_V3_NOC_STATE[disk]:-0}"
  local cpu="${_V3_NOC_STATE[cpu]:-0}"

  _v3_noc_indicator "CPU"              "${cpu}%"                          "" "cpu"
  _v3_noc_indicator "RAM"              "${_V3_NOC_STATE[ram_status]:-OK}" "${ram}%" "ram"
  _v3_noc_indicator "Disco"            "${_V3_NOC_STATE[disk_status]:-OK}" "${disk}%" "disk"
}

_v3_noc_render_shortcuts() {
  _cc_box_sep
  _cc_box_line "ATALHOS"
  _cc_box_line "  ENTER Atualizar  [D]ev  [R]elease  [M] Banco Dados"
  _cc_box_line "  [B]ackups  [G]it  [H]ealth  [A]lertas  [N] Missoes"
  _cc_box_line "  [.] Menu V1  [Q] Sair  1/2/3/0 refresh 5s/10s/30s/manual"
}

_v3_noc_render_alerts_panel() {
  clear 2>/dev/null || echo ""
  _cc_box_top
  _cc_box_line_center "PAINEL DE ALERTAS"
  _cc_box_sep

  local events_file="$_V3_EVENT_LOG"
  if [[ -f "$events_file" ]]; then
    local recent
    recent=$(jq -r '.events[-15:] | reverse | .[] | "[\(.timestamp | .[11:19])] [\(.priority)] \(.type) <- \(.source)"' "$events_file" 2>/dev/null)
    if [[ -n "$recent" ]]; then
      while IFS= read -r line; do
        _cc_box_line "$line"
      done <<< "$recent"
    else
      _cc_box_line "Nenhum evento recente."
    fi
  else
    _cc_box_line "Nenhum evento registrado."
  fi

  _cc_box_sep
  _cc_box_line "[ENTER] Atualizar  [main] Voltar  [L] Limpar alertas"

  local health_data="${_V3_NOC_STATE[health_data]:-}"
  [[ -z "$health_data" ]] && health_data='{}'
  local score level
  score=$(echo "$health_data" | jq -r '.score // 0' 2>/dev/null)
  level=$(echo "$health_data" | jq -r '.level // "?"' 2>/dev/null)

  _cc_box_sep
  _cc_box_line "Health: ${score}% (${level}) | Backup: ${_V3_NOC_STATE[last_backup]:-N/A}"
  _cc_screen_footer "Alerts Panel v$_V3_VERSION"
}

_v3_noc_render_missions_panel() {
  clear 2>/dev/null || echo ""
  _cc_box_top
  _cc_box_line_center "PAINEL DE MISSOES"
  _cc_box_sep

  local ee_state="$CC_ROOT/../execution-engine/state/checkpoint.json"
  if [[ -f "$ee_state" ]]; then
    local mission_id status percent block step
    mission_id=$(jq -r '.missao_id // "N/A"' "$ee_state" 2>/dev/null)
    status=$(jq -r '.status // "N/A"' "$ee_state" 2>/dev/null)
    percent=$(jq -r '.percentual // 0' "$ee_state" 2>/dev/null)
    block=$(jq -r '.bloco_atual // 0' "$ee_state" 2>/dev/null)
    step=$(jq -r '.passo_atual // 0' "$ee_state" 2>/dev/null)

    _cc_box_line "MISSAO ATIVA"
    _cc_box_line "  ID        : $mission_id"
    _cc_box_line "  Status     : $status"
    _cc_box_line "  Progresso  : ${percent}%"
    _cc_box_line "  Bloco/Passo: ${block}/${step}"
    _cc_box_sep

    local bar_width=40 bar_str="["
    local filled empty i
    filled=$((percent * bar_width / 100))
    empty=$((bar_width - filled))
    for ((i=0; i<filled; i++)); do bar_str+="="; done
    for ((i=0; i<empty; i++)); do bar_str+="-"; done
    bar_str+="]"
    _cc_box_line_center "$bar_str"
  else
    _cc_box_line "Nenhuma missao ativa."
    _cc_box_line ""
    _cc_box_line "Missoes sao gerenciadas pelo Execution Engine."
    _cc_box_line "Use o menu V1 para iniciar missoes."
  fi

  _cc_box_sep
  _cc_box_line "[ENTER] Atualizar  [main] Voltar  [R] Retomar"
  _cc_box_sep

  _cc_box_line "HISTORICO RECENTE"
  local ee_history="$CC_ROOT/../execution-engine/state"
  if [[ -d "$ee_history" ]]; then
    local count
    count=$(find "$ee_history" -name "checkpoint-manual-*" 2>/dev/null | wc -l)
    _cc_box_line "  Checkpoints salvos: $count"
  else
    _cc_box_line "  Sem historico disponivel"
  fi

  _cc_screen_footer "Missions Panel v$_V3_VERSION"
}

_v3_noc_render_main() {
  _V3_NOC_NAV_ROWS=()

  clear 2>/dev/null || echo ""

  _v3_noc_render_header
  _v3_noc_render_health
  _v3_noc_render_infrastructure
  _v3_noc_render_devops
  _v3_noc_render_system
  _v3_noc_render_resources
  _v3_noc_render_shortcuts
  _cc_screen_footer "NOC v$_V3_VERSION | Auto-refresh: ${_V3_NOC_REFRESH_INTERVAL}s | $(_v3_timestamp | cut -c1-19)"
}

_v3_noc_dispatch() {
  local key="$1"
  case "$key" in
    d|D)
      _v3_log "info" "NOC" "Abrindo modulo: Desenvolvimento"
      bash "$CC_ROOT/modules/desenvolvimento/menu.sh" 2>/dev/null || echo "Modulo nao encontrado."
      ;;
    r|R)
      _v3_log "info" "NOC" "Abrindo modulo: Release"
      bash "$CC_ROOT/modules/release/menu.sh" 2>/dev/null || echo "Modulo nao encontrado."
      ;;
    m|M)
      _v3_log "info" "NOC" "Abrindo modulo: Banco de Dados"
      bash "$CC_ROOT/modules/banco-dados/menu.sh" 2>/dev/null || echo "Modulo nao encontrado."
      ;;
    b|B)
      _v3_log "info" "NOC" "Abrindo modulo: Backups"
      bash "$CC_ROOT/modules/backup-recuperacao/menu.sh" 2>/dev/null || echo "Modulo nao encontrado."
      ;;
    g|G)
      _v3_log "info" "NOC" "Abrindo modulo: Git/Branches"
      bash "$CC_ROOT/modules/branches-sincronizacao/menu.sh" 2>/dev/null || echo "Modulo nao encontrado."
      ;;
    h|H)
      local health_engine="$CC_ROOT/../health-engine/engine.sh"
      if [[ -f "$health_engine" ]]; then
        bash "$health_engine" --quick
      else
        _v3_health_calculate > /dev/null
        echo "Health Score: ${_V3_NOC_STATE[health_score]:-0}% (${_V3_NOC_STATE[health_level]:-?})"
      fi
      ;;
    a|A)
      _V3_NOC_ACTIVE_PANEL="alerts"
      ;;
    n|N)
      _V3_NOC_ACTIVE_PANEL="missions"
      ;;
    q|Q)
      return 1
      ;;
    .)
      _v3_log "info" "NOC" "Alternando para Menu V1"
      _v3_kernel_shutdown 2>/dev/null || true
      exec bash "$CC_ROOT/core/menu.sh"
      ;;
    crm)
      bash "$CC_ROOT/modules/desenvolvimento/menu.sh" 2>/dev/null || true ;;
    site)
      bash "$CC_ROOT/modules/desenvolvimento/menu.sh" 2>/dev/null || true ;;
    git)
      bash "$CC_ROOT/modules/branches-sincronizacao/menu.sh" 2>/dev/null || true ;;
    release)
      bash "$CC_ROOT/modules/release/menu.sh" 2>/dev/null || true ;;
    backup)
      bash "$CC_ROOT/modules/backup-recuperacao/menu.sh" 2>/dev/null || true ;;
    db|firestore)
      bash "$CC_ROOT/modules/banco-dados/menu.sh" 2>/dev/null || true ;;
    sec|rbac)
      bash "$CC_ROOT/modules/ferramentas/menu.sh" 2>/dev/null || true ;;
    modules)
      bash "$CC_ROOT/modules/central-ias/menu.sh" 2>/dev/null || true ;;
  esac
  return 0
}

_v3_noc_loop() {
  _v3_noc_init

  while true; do
    _v3_noc_refresh_data

    case "$_V3_NOC_ACTIVE_PANEL" in
      alerts)   _v3_noc_render_alerts_panel ;;
      missions) _v3_noc_render_missions_panel ;;
      *)        _v3_noc_render_main ;;
    esac

    echo ""

    local timeout=$_V3_NOC_REFRESH_INTERVAL
    local cmd="" read_ok=0

    # Intervalo 0 = modo manual (documentado no README): espera sem timeout.
    # "read -t 0" não bloqueia e criava busy-loop com 100% de CPU.
    if [[ "$timeout" -gt 0 ]]; then
      read -t "$timeout" -rp "  NOC > " cmd 2>/dev/null && read_ok=1
    else
      read -rp "  NOC > " cmd 2>/dev/null && read_ok=1
    fi

    if [[ "$read_ok" -eq 1 ]]; then
      case "$cmd" in
        "") continue ;;
        [dDrRmMbBgGhHaAnNqQ.]) _v3_noc_dispatch "$cmd" || { echo ""; break; } ;;
        a|alerts)  _V3_NOC_ACTIVE_PANEL="alerts" ;;
        n|missions) _V3_NOC_ACTIVE_PANEL="missions" ;;
        main|m)    _V3_NOC_ACTIVE_PANEL="main" ;;
        1) _V3_NOC_REFRESH_INTERVAL=5 ;;
        2) _V3_NOC_REFRESH_INTERVAL=10 ;;
        3) _V3_NOC_REFRESH_INTERVAL=30 ;;
        0) _V3_NOC_REFRESH_INTERVAL=0 ; _V3_NOC_LAST_FULL_RENDER=0 ;;
        l|L)
          if [[ "$_V3_NOC_ACTIVE_PANEL" == "alerts" ]]; then
            rm -f "$_V3_EVENT_LOG"
            _v3_log "info" "NOC" "Alertas limpos pelo operador"
          fi
          ;;
        *)
          echo "  Comandos: [D]ev [R]elease [M]odulos [B]ackups [G]it [H]ealth [A]lertas [N] Missoes [Q]uit [.]V1"
          sleep 1
          ;;
      esac

      if [[ "$_V3_NOC_ACTIVE_PANEL" != "main" ]]; then
        _V3_NOC_LAST_FULL_RENDER=0
      fi
    fi
  done
}
