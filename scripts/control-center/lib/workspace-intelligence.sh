#!/bin/bash
# CELL CITY — Workspace Intelligence V2.2
# Biblioteca reutilizavel de analise inteligente do workspace.
# Classifica alteracoes, detecta dependencias, calcula impacto e decide.
#
# CLI: wi analisar | wi gate <contexto> | wi porque <arquivo>
# Doc: plans/CCC-RC-V2.2-WI-001_WORKSPACE_INTELLIGENCE_ARQUITETURA.md
set -uo pipefail

WI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$WI_DIR/../../" && pwd)"
readonly WI_DIR REPO_DIR

readonly WI_LOG_DIR="$REPO_DIR/logs/workspace-analysis"
readonly WI_CACHE_DIR="$WI_LOG_DIR/cache"
readonly WI_DEP_CONFIG="$WI_DIR/../config/wi-dependencias.conf"

declare -a WI_FILES=() WI_GROUPS=() WI_IMPACTS=() WI_REASONS=() WI_DEPS=()
WI_IMPACT_ORDER=("NULO" "BAIXO" "MEDIO" "ALTO" "CRITICO")
WI_BLOCK_THRESHOLD="MEDIO"

_wi_impact_value() {
  case "$1" in
    NULO)    echo 0 ;; BAIXO) echo 1 ;; MEDIO) echo 2 ;;
    ALTO)    echo 3 ;; CRITICO) echo 4 ;; *) echo 2 ;;
  esac
}

_wi_impact_worse() {
  local a="${1:-NULO}" b="${2:-NULO}" va vb
  va=$(_wi_impact_value "$a"); vb=$(_wi_impact_value "$b")
  [[ "$va" -ge "$vb" ]] && echo "$a" || echo "$b"
}

_wi_hash_state() {
  { git -C "$REPO_DIR" status --porcelain 2>/dev/null; git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null; } | sha1sum | awk '{print $1}'
}

_wi_cache_get() {
  local key="${1:-}" cache_file="$WI_CACHE_DIR/${1:-}.json"
  [[ -z "$key" ]] && return 1
  if [[ -f "$cache_file" ]]; then
    local age=$(($(date +%s) - $(stat -c %Y "$cache_file" 2>/dev/null || echo 0)))
    [[ "$age" -lt 60 ]] && cat "$cache_file"
  fi
}

_wi_cache_set() {
  local key="$1" data="$2"
  mkdir -p "$WI_CACHE_DIR"
  echo "$data" > "$WI_CACHE_DIR/$key.json"
}

_wi_log() {
  local stem="$1" json="$2" txt="$3"
  mkdir -p "$WI_LOG_DIR"
  local ts_part=$(date '+%Y%m%d-%H%M%S')
  local base="$WI_LOG_DIR/${ts_part}-${stem}"
  echo "$json" > "${base}.json"
  echo "$txt" > "${base}.txt"
  local files=$(find "$WI_LOG_DIR" -name "*.json" -type f 2>/dev/null | sort)
  local count=$(echo "$files" | wc -l)
  if [[ "$count" -gt 200 ]]; then
    local to_delete=$(echo "$files" | head -n $((count - 200)))
    while IFS= read -r f; do
      [[ -n "$f" ]] && rm -f "$f" "${f%.json}.txt"
    done <<< "$to_delete"
  fi
}

_wi_classify() {
  local path="$1"
  case "$path" in
    scripts/release/*|scripts/control-center/modules/release/*)
      echo "RELEASE CENTER|CRITICO|participa do fluxo da Release" ;;
    scripts/backup/*)
      echo "FERRAMENTAS|CRITICO|sistema de backup — critico para rollback" ;;
    firestore.rules*|storage.rules)
      echo "RULES|CRITICO|regras de seguranca do Firestore" ;;
    functions/*)
      echo "FUNCTIONS|CRITICO|Cloud Functions — participam do deploy" ;;
    tests/rbac/*|tests/firestore-rules/*|tests/functions/*|tests/integrity/*|tests/performance/*)
      echo "TESTES|CRITICO|suites da Release — afetam homologacao" ;;
    .github/*)
      echo "CONFIGURACAO|CRITICO|CI/workflow — afeta deploy" ;;
    package.json|package-lock.json|.gitignore|CNAME)
      echo "CONFIGURACAO|CRITICO|configuracao compartilhada do projeto" ;;
    scripts/*/state/*|logs/*|*.log)
      # Precisa vir ANTES de scripts/control-center/* e scripts/* — senão esses
      # padroes genericos capturam os arquivos de estado e classificam como
      # FERRAMENTAS|MEDIO, bloqueando release por churn de runtime.
      echo "RUNTIME|NULO|arquivos de runtime/log — nao versionados" ;;
    scripts/control-center/lib/workspace-intelligence.sh|scripts/control-center/config/*)
      echo "FERRAMENTAS|MEDIO|configuracao/guardiao do Release Center" ;;
    scripts/control-center/v3/*|scripts/control-center/modules/noc-v3/*|tests/control-center/v3/*|plans/v3/*)
      echo "CONTROL CENTER V3|NULO|nao participa do fluxo atual da Release" ;;
    scripts/control-center/*)
      echo "FERRAMENTAS|MEDIO|Control Center — ferramentas de desenvolvimento" ;;
    scripts/*)
      echo "FERRAMENTAS|MEDIO|scripts do projeto" ;;
    CRM/*)
      echo "CRM|ALTO|modulos do CRM — afetam homologacao" ;;
    saas/*)
      echo "SAAS|ALTO|modulo SaaS" ;;
    index.html|css/*|js/*|pages/*|imagens/*|assets/*|catalogo/*|celular/*|impressora/*|notebook/*|sistema/*|tracking/*|videos/*)
      echo "SITE|ALTO|paginas publicas do site — afetam homologacao" ;;
    tests/control-center/*)
      echo "TESTES|BAIXO|testes isolados do Control Center" ;;
    tests/*)
      echo "TESTES|MEDIO|suites de teste" ;;
    plans/*|docs/*|*.md)
      echo "DOCUMENTACAO|BAIXO|documentacao — nao participa do artefato" ;;
    *)
      echo "OUTROS|ALTO|arquivo desconhecido — default-deny" ;;
  esac
}

_wi_analyze_dependencies() {
  local file="$1" group="$2" impact="$3"
  local ival=$(_wi_impact_value "$impact")
  [[ "$ival" -le 1 ]] || { echo "[]"; return; }

  local deps="[]"

  if [[ -f "$WI_DEP_CONFIG" ]]; then
    local bn=$(basename "$file")
    if grep -qFx "$bn" "$WI_DEP_CONFIG" 2>/dev/null || grep -qFx "$file" "$WI_DEP_CONFIG" 2>/dev/null; then
      deps=$(echo "$deps" | jq '. + ["lista-curada"]')
    fi
  fi

  local bn=$(basename "$file")
  local rev_hits=$(grep -lF "$bn" "$REPO_DIR"/scripts/release/*.sh "$REPO_DIR"/scripts/control-center/modules/release/lib/*.sh 2>/dev/null || true)
  if [[ -n "$rev_hits" ]]; then
    local consumers=$(echo "$rev_hits" | while read -r hit; do echo "$(basename "$(dirname "$hit")")/$(basename "$hit")"; done | paste -sd, -)
    deps=$(echo "$deps" | jq --arg c "$consumers" '. + ["referenciado por: " + $c]')
  fi

  local content_refs=$(grep -ohP '(source\s+|\.\s|require\(|import\s)["\x27]?([^"'\''\s)]+)' "$REPO_DIR/$file" 2>/dev/null | grep -oP '[^"'\''()\s]+$' | sort -u | head -20 || true)
  for ref in $content_refs; do
    local ref_path="$REPO_DIR/$ref"
    ref_path=$(realpath "$ref_path" 2>/dev/null || echo "$ref_path")
    local ref_rel="${ref_path#$REPO_DIR/}"
    local ref_group ref_impact
    IFS='|' read -r ref_group ref_impact _ <<< "$(_wi_classify "$ref_rel" "M")"
    local riv=$(_wi_impact_value "${ref_impact:-NULO}")
    if [[ "$riv" -ge 3 ]]; then
      deps=$(echo "$deps" | jq --arg r "$ref_rel ($ref_group)" '. + ["dependencia-critica: " + $r]')
      break
    fi
  done

  echo "$deps"
}

_wi_analyze() {
  WI_FILES=(); WI_GROUPS=(); WI_IMPACTS=(); WI_REASONS=(); WI_DEPS=()

  local porcelain=$(git -C "$REPO_DIR" status --porcelain 2>/dev/null)
  if [[ -z "$porcelain" ]]; then
    echo '{"arquivos":[],"resumo":{"por_grupo":{}},"impacto_geral":"NULO"}'
    return 0
  fi

  local worst_impact="NULO"
  declare -A group_counts

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local status="${line:0:2}" path="${line:3}"
    [[ -z "$path" ]] && continue
    local path2=""
    if [[ "$status" == "R "* || "$status" == R* ]]; then
      path2="${path##* -> }"
      path="${path%% -> *}"
      path="${path#\"}"; path="${path%\"}"
      path2="${path2#\"}"; path2="${path2%\"}"
    fi

    local group impact reason
    IFS='|' read -r group impact reason <<< "$(_wi_classify "$path" "$(echo "$status" | xargs)")"

    if [[ -n "$path2" ]]; then
      local group2 impact2 reason2
      IFS='|' read -r group2 impact2 reason2 <<< "$(_wi_classify "$path2" "$(echo "$status" | xargs)")"
      impact=$(_wi_impact_worse "$impact" "$impact2")
      [[ "$impact" == "$impact2" ]] && { group="$group2"; reason="$reason2"; }
    fi

    local deps=$(_wi_analyze_dependencies "$path" "$group" "$impact")

    WI_FILES+=("$path")
    WI_GROUPS+=("$group")
    WI_IMPACTS+=("$impact")
    WI_REASONS+=("$reason")
    WI_DEPS+=("$deps")

    group_counts["$group"]=$((${group_counts["$group"]:-0} + 1))
    worst_impact=$(_wi_impact_worse "$worst_impact" "$impact")
  done <<< "$porcelain"

  local files_json="["
  for i in "${!WI_FILES[@]}"; do
    [[ "$i" -gt 0 ]] && files_json+=","
    files_json+=$(jq -n --arg p "${WI_FILES[$i]}" --arg g "${WI_GROUPS[$i]}" --arg imp "${WI_IMPACTS[$i]}" --arg mot "${WI_REASONS[$i]}" --argjson d "${WI_DEPS[$i]}" '{path:$p,grupo:$g,impacto:$imp,motivo:$mot,dependencias:$d}')
  done
  files_json+="]"

  local groups_json="{"
  local first=true
  for g in "${!group_counts[@]}"; do
    $first || groups_json+=","
    first=false
    groups_json+="\"$g\":${group_counts[$g]}"
  done
  groups_json+="}"

  jq -n --argjson f "$files_json" --argjson g "$groups_json" --arg imp "$worst_impact" '{arquivos:$f,resumo:{por_grupo:$g},impacto_geral:$imp}'
}

_wi_format_report() {
  local analysis="$1"
  echo "=================================================="
  echo " WORKSPACE ANALYZER — Release Center V2.2"
  echo "=================================================="
  local groups_order=("RELEASE CENTER" "RULES" "FUNCTIONS" "CRM" "SITE" "SAAS" "CONTROL CENTER V3" "TESTES" "DOCUMENTACAO" "FERRAMENTAS" "CONFIGURACAO" "RUNTIME" "OUTROS")
  for g in "${groups_order[@]}"; do
    local count=$(echo "$analysis" | jq -r ".resumo.por_grupo[\"$g\"] // 0")
    printf "  %-20s %s alteracoes\n" "$g" "$count"
  done
  echo "=================================================="
  local ig=$(echo "$analysis" | jq -r '.impacto_geral // "NULO"')
  echo "  Impacto Geral       $ig"
  local ival=$(_wi_impact_value "$ig")
  local decisao="Pode continuar."
  [[ "$ival" -ge 2 ]] && decisao="Bloquear."
  echo "  Decisao sugerida    $decisao"
  echo "=================================================="
  local n=$(echo "$analysis" | jq '.arquivos | length')
  if [[ "$n" -gt 0 ]]; then
    echo ""
    echo "Arquivos:"
    echo "$analysis" | jq -r '.arquivos[] | "  [\(.impacto)] \(.path) -> \(.grupo) — \(.motivo)"'
  fi
}

_wi_format_prompt() {
  local analysis="$1"
  echo ""
  echo "Foram encontradas alteracoes locais."
  echo ""
  local n=$(echo "$analysis" | jq '.arquivos | length')
  for ((i=0; i<n; i++)); do
    local grupo=$(echo "$analysis" | jq -r ".arquivos[$i].grupo")
    local impacto=$(echo "$analysis" | jq -r ".arquivos[$i].impacto")
    local motivo=$(echo "$analysis" | jq -r ".arquivos[$i].motivo")
    echo "  Projeto:  $grupo"
    echo "  Impacto:  $impacto"
    echo "  Motivo:   $motivo"
    echo ""
  done
  echo "  Essas alteracoes NAO fazem parte da Release atual."
  echo ""
  echo "  1 - Continuar"
  echo "  2 - Ver relatorio completo"
  echo "  3 - Cancelar"
}

_wi_prompt_decision() {
  local analysis="$1" contexto="$2"
  if [[ ! -t 0 ]]; then
    echo "stdin nao e um terminal — cancelando (fail closed)"
    return 2
  fi
  _wi_format_prompt "$analysis"
  local choice
  read -rp "  Escolha: " choice || choice="3"
  case "$choice" in
    1) return 0 ;;
    2) _wi_format_report "$analysis"; _wi_prompt_decision "$analysis" "$contexto"; return $? ;;
    3|"") return 2 ;;
    *) echo "Opcao invalida."; return 2 ;;
  esac
}

wi_analisar() {
  local format="${1:-txt}"
  [[ "$format" == "--json" ]] && format="json"
  local state_hash=$(_wi_hash_state)
  local analysis=$(_wi_cache_get "$state_hash")
  if [[ -z "$analysis" ]]; then
    local t0=$(date +%s%3N)
    analysis=$(_wi_analyze)
    local t1=$(date +%s%3N)
    _wi_cache_set "$state_hash" "$analysis"
  fi
  if [[ "$format" == "json" ]]; then
    echo "$analysis"
  else
    _wi_format_report "$analysis"
  fi
  local n=$(echo "$analysis" | jq '.arquivos | length')
  if [[ "$n" -gt 0 ]]; then
    local log_json=$(echo "$analysis" | jq --arg ts "$(date '+%Y-%m-%dT%H:%M:%S%:z')" --arg ctx "analisar" '. + {timestamp:$ts,contexto:$ctx,decisao:{resultado:"analise",por:"automatico"}}')
    local log_txt=$(_wi_format_report "$analysis")
    _wi_log "analisar" "$log_json" "$log_txt"
  fi
}

wi_gate() {
  local contexto="$1"
  local valid=(release-rapida release-completa release-turbo certificacao subir subir-ok homologacao)
  local is_valid=0
  for c in "${valid[@]}"; do [[ "$contexto" == "$c" ]] && is_valid=1; done
  [[ "$is_valid" -eq 0 ]] && { echo "Contexto desconhecido: $contexto" >&2; return 1; }

  local state_hash=$(_wi_hash_state)
  local analysis=$(_wi_cache_get "$state_hash")
  local t0=$(date +%s%3N)
  if [[ -z "$analysis" ]]; then
    t0=$(date +%s%3N)
    analysis=$(_wi_analyze)
    _wi_cache_set "$state_hash" "$analysis"
  fi

  local ig=$(echo "$analysis" | jq -r '.impacto_geral // "NULO"')
  local n=$(echo "$analysis" | jq '.arquivos | length')
  local ival=$(_wi_impact_value "$ig")

  local silent=0
  [[ "$contexto" == "homologacao" ]] && silent=1

  if [[ "$silent" -eq 1 ]]; then
    [[ "$ival" -le 1 ]] && return 0 || return 1
  fi

  if [[ "$ival" -ge 2 ]]; then
    echo ""
    echo "BLOQUEIO: Impacto $ig detectado no workspace."
    _wi_format_report "$analysis" | head -25
    echo ""
    echo "  Motivo: arquivos com impacto >= MEDIO nao podem ser publicados."
    echo "  Commit as alteracoes da release ou restaure os arquivos externos."
    local log_json=$(echo "$analysis" | jq --arg ts "$(date '+%Y-%m-%dT%H:%M:%S%:z')" --arg ctx "$contexto" '. + {timestamp:$ts,contexto:$ctx,decisao:{resultado:"bloquear",por:"automatico-bloqueio",justificativa:"impacto >= MEDIO"}}')
    _wi_log "gate-$contexto" "$log_json" "$(_wi_format_report "$analysis")"
    return 1
  fi

  if [[ "$n" -eq 0 ]]; then
    local log_json=$(echo "$analysis" | jq --arg ts "$(date '+%Y-%m-%dT%H:%M:%S%:z')" --arg ctx "$contexto" '. + {timestamp:$ts,contexto:$ctx,decisao:{resultado:"continuar",por:"automatico-limpo"}}')
    _wi_log "gate-$contexto" "$log_json" "Workspace limpo — sem analise necessaria ($contexto)"
    return 0
  fi

  local non_runtime=$(echo "$analysis" | jq '[.arquivos[] | select(.grupo != "RUNTIME")] | length')
  if [[ "$non_runtime" -eq 0 ]]; then
    echo ""
    echo "AVISO: arquivos de runtime/log detectados. Nao bloqueiam a Release."
    echo "  Dica: execute 'git restore' nesses arquivos antes de publicar."
    _wi_format_report "$analysis" | grep "RUNTIME" || true
    return 0
  fi

  if [[ "$contexto" == "subir" ]]; then
    local unique_groups=$(echo "$analysis" | jq '[.arquivos[].grupo] | unique | length')
    if [[ "$unique_groups" -le 1 ]]; then
      local log_json=$(echo "$analysis" | jq --arg ts "$(date '+%Y-%m-%dT%H:%M:%S%:z')" --arg ctx "$contexto" '. + {timestamp:$ts,contexto:$ctx,decisao:{resultado:"continuar",por:"automatico-limpo",justificativa:"grupo unico"}}')
      _wi_log "gate-$contexto" "$log_json" "subir — grupo unico ($contexto)"
      return 0
    fi
  fi

  _wi_prompt_decision "$analysis" "$contexto"
  local choice=$?
  local who="operador" result="cancelar"
  [[ "$choice" -eq 0 ]] && result="continuar"
  local log_json=$(echo "$analysis" | jq --arg ts "$(date '+%Y-%m-%dT%H:%M:%S%:z')" --arg ctx "$contexto" --arg res "$result" --arg who "$who" '. + {timestamp:$ts,contexto:$ctx,decisao:{resultado:$res,por:$who}}')
  _wi_log "gate-$contexto" "$log_json" "$(_wi_format_report "$analysis")"
  return "$choice"
}

wi_porque() {
  local file="$1"
  [[ -z "$file" ]] && { echo "Uso: wi porque <arquivo>" >&2; return 1; }
  local group impact reason
  IFS='|' read -r group impact reason <<< "$(_wi_classify "$file" "M")"
  local deps=$(_wi_analyze_dependencies "$file" "$group" "$impact")
  echo "Arquivo : $file"
  echo "Grupo   : $group"
  echo "Impacto : $impact"
  echo "Motivo  : $reason"
  local dep_count=$(echo "$deps" | jq 'length')
  if [[ "$dep_count" -gt 0 ]]; then
    echo "Dependencias detectadas:"
    echo "$deps" | jq -r '.[]' | while read -r dep; do echo "  - $dep"; done
  fi
  return 0
}

case "${1:-}" in
  analisar) wi_analisar "${2:-txt}" ;;
  gate)     wi_gate "${2:-}" ;;
  porque)   wi_porque "${2:-}" ;;
  --help|-h)
    echo "Workspace Intelligence V2.2"
    echo ""
    echo "Uso: wi <comando> [args]"
    echo ""
    echo "Comandos:"
    echo "  analisar [--json]     Analisa o workspace e gera relatorio"
    echo "  gate <contexto>        Decide se pode prosseguir (exit 0/1/2)"
    echo "  porque <arquivo>       Explica a classificacao de um arquivo"
    echo ""
    echo "Contextos de gate:"
    echo "  release-rapida, release-completa, release-turbo, certificacao"
    echo "  subir, subir-ok, homologacao"
    ;;
  *)
    echo "Workspace Intelligence V2.2"
    echo "Uso: wi <comando> [args]"
    echo "     wi analisar | wi gate <contexto> | wi porque <arquivo>"
    exit 1
    ;;
esac
