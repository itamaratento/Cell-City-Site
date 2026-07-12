#!/bin/bash
# Cell City Control Center — módulo Branches e Sincronização, Exportações
# (Fase 5, corrigido pela auditoria CCC-F05-AUD-002 §Correção 3). Mesmo
# padrão homologado em modules/banco-dados/lib/export.sh: TXT/Markdown/
# JSON, sempre em _reports/git/ (nunca versionado — .gitignore já ignora
# _reports/ na raiz). Reaproveita _brs_status_repositorio() (lib/status.sh)
# em vez de reconsultar o Git na mão — nenhuma lógica de leitura duplicada.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_brs_export_dir() {
  echo "$REPO_DIR/_reports/git"
}

_brs_exportar() {
  local opcao
  while true; do
    _cc_screen_title "EXPORTAÇÃO"
    _cc_screen_breadcrumb "Control Center › Branches e Sincronização › Exportação"
    _cc_box_blank
    _cc_box_item "1" "Exportar Relatório (TXT)"
    _cc_box_item "2" "Exportar Relatório (Markdown)"
    _cc_box_item "3" "Exportar Relatório (JSON)"
    _cc_box_blank
    _cc_box_item "0" "Voltar"
    _cc_screen_footer "Escolha o formato · 0 volta"
    read -rp "Opção: " opcao
    case "$opcao" in
      1) _brs_exportar_txt ;;
      2) _brs_exportar_md ;;
      3) _brs_exportar_json ;;
      0) break ;;
      *) echo "Opção inválida." ;;
    esac
  done
}

# Campos exigidos pela CCC-F05-001 (Exportação): Data, Hora, Branch,
# Commit, Autor, Status, Resumo, Resultado. Coletados uma vez e reusados
# pelos três formatos, sem duplicar leitura de Git.
_brs_export_coletar() {
  BRS_EXP_BRANCH="$(_cc_git_branch)"
  BRS_EXP_COMMIT="$(_cc_svc_git_ultimo_commit)"
  BRS_EXP_AUTOR="$(git -C "$REPO_DIR" log -1 --format='%an' 2>/dev/null)"
  BRS_EXP_STATUS="$(_brs_status_repositorio)"
  BRS_EXP_RESULTADO="$(awk -F': ' '/^Resultado:/{print $2}' <<< "$BRS_EXP_STATUS")"
}

_brs_exportar_txt() {
  _brs_export_coletar
  local dir filename timestamp
  timestamp=$(date '+%Y%m%d_%H%M%S')
  dir="$(_brs_export_dir)"
  mkdir -p "$dir"
  filename="$dir/branches-sincronizacao_${timestamp}.txt"
  {
    echo "=============================================="
    echo "CELL CITY CONTROL CENTER — BRANCHES E SINCRONIZAÇÃO"
    echo "Data: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=============================================="
    echo ""
    echo "Branch : $BRS_EXP_BRANCH"
    echo "Commit : $BRS_EXP_COMMIT"
    echo "Autor  : $BRS_EXP_AUTOR"
    echo ""
    echo "$BRS_EXP_STATUS"
    echo ""
    echo "Resultado: ${BRS_EXP_RESULTADO:-desconhecido}"
    echo ""
    echo "Relatório somente-leitura — gerado automaticamente."
  } > "$filename"
  _cc_ok "Relatório exportado: $filename"
  _cc_log "Branches e Sincronização: exportação TXT ($filename, resultado=${BRS_EXP_RESULTADO:-desconhecido})"
  _cc_pause
}

_brs_exportar_md() {
  _brs_export_coletar
  local dir filename timestamp
  timestamp=$(date '+%Y%m%d_%H%M%S')
  dir="$(_brs_export_dir)"
  mkdir -p "$dir"
  filename="$dir/branches-sincronizacao_${timestamp}.md"
  {
    echo "# Branches e Sincronização — Cell City Control Center"
    echo ""
    echo "**Data:** $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "| Campo | Valor |"
    echo "|---|---|"
    echo "| Branch | $BRS_EXP_BRANCH |"
    echo "| Commit | $BRS_EXP_COMMIT |"
    echo "| Autor | $BRS_EXP_AUTOR |"
    echo "| Resultado | ${BRS_EXP_RESULTADO:-desconhecido} |"
    echo ""
    echo "## Status do Repositório"
    echo ""
    echo '```'
    echo "$BRS_EXP_STATUS"
    echo '```'
    echo ""
    echo "---"
    echo "*Relatório somente-leitura, gerado automaticamente pelo Control Center.*"
  } > "$filename"
  _cc_ok "Relatório exportado: $filename"
  _cc_log "Branches e Sincronização: exportação MD ($filename, resultado=${BRS_EXP_RESULTADO:-desconhecido})"
  _cc_pause
}

_brs_exportar_json() {
  _brs_export_coletar
  local dir filename timestamp
  timestamp=$(date '+%Y%m%d_%H%M%S')
  dir="$(_brs_export_dir)"
  mkdir -p "$dir"
  filename="$dir/branches-sincronizacao_${timestamp}.json"
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg data "$(date --iso-8601=seconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')" \
          --arg branch "$BRS_EXP_BRANCH" \
          --arg commit "$BRS_EXP_COMMIT" \
          --arg autor "$BRS_EXP_AUTOR" \
          --arg resumo "$BRS_EXP_STATUS" \
          --arg resultado "${BRS_EXP_RESULTADO:-desconhecido}" \
          '{modulo: "Branches e Sincronização", data: $data, branch: $branch, commit: $commit, autor: $autor, resumo: $resumo, resultado: $resultado}' > "$filename" 2>/dev/null \
      || filename=""
  fi
  if [ -z "$filename" ] || [ ! -s "$filename" ]; then
    filename="$dir/branches-sincronizacao_${timestamp}.json"
    printf '{"modulo":"Branches e Sincronização","data":"%s","branch":"%s","commit":"%s","resultado":"%s"}\n' \
      "$(date '+%Y-%m-%d %H:%M:%S')" "$BRS_EXP_BRANCH" "$BRS_EXP_COMMIT" "${BRS_EXP_RESULTADO:-desconhecido}" > "$filename"
  fi
  _cc_ok "Relatório exportado: $filename"
  _cc_log "Branches e Sincronização: exportação JSON ($filename, resultado=${BRS_EXP_RESULTADO:-desconhecido})"
  _cc_pause
}
