#!/bin/bash
# Cell City Control Center — módulo Banco de Dados, Coleções.
# CCC-F04-001 §5. Fonte da lista de coleções: união do que está declarado
# em CRM/firestore.rules (blocos `match` de topo, 4 espaços de indentação)
# com o que backup-dados.js já cataloga (script de backup homologado,
# ver README.md "Achado de segurança" da Sprint de Backup e Recuperação).
# Nunca lê/conta documentos reais aqui — isso exigiria Admin SDK/ADC (ver
# lib/utils.sh, "Número estimado de documentos") e sairia do escopo
# somente-leitura-de-baixo-custo desta Fase (CLAUDE.md §9).
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

# Nomes de coleção de topo declarados nas Rules (deduplicados).
_cc_bd_rules_colecoes() {
  local arquivo
  arquivo=$(_cc_bd_rules_path)
  [ -f "$arquivo" ] || return
  sed -n 's/^    match \/\([a-zA-Z0-9_]*\)\/.*$/\1/p' "$arquivo" | sort -u
}

# Padrões completos de match de topo (para detectar duplicidade exata —
# ver _cc_bd_regras_duplicadas em lib/rules.sh).
_cc_bd_rules_match_patterns() {
  local arquivo
  arquivo=$(_cc_bd_rules_path)
  [ -f "$arquivo" ] || return
  sed -n 's/^    match \(.*\) {$/\1/p' "$arquivo"
}

# Coleções catalogadas no script de backup oficial (backup-dados.js).
_cc_bd_backup_colecoes() {
  [ -f "$REPO_DIR/backup-dados.js" ] || return
  sed -n "/^const COLECOES/,/\];/p" "$REPO_DIR/backup-dados.js" \
    | grep -oE "'[a-zA-Z0-9_]+'" | tr -d "'"
}

_cc_bd_colecoes_conhecidas() {
  { _cc_bd_rules_colecoes; _cc_bd_backup_colecoes; } | sort -u | grep -v '^$'
}

_cc_bd_colecao_tem_rule() {
  local nome="$1"
  _cc_bd_rules_colecoes | grep -qx "$nome"
}

_cc_bd_colecao_no_backup() {
  local nome="$1"
  _cc_bd_backup_colecoes | grep -qx "$nome"
}

_cc_bd_colecao_indices_count() {
  local nome="$1" arquivo
  arquivo=$(_cc_bd_indexes_path)
  if [ ! -f "$arquivo" ] || ! _cc_bd_tem jq; then
    echo 0
    return
  fi
  jq --arg c "$nome" '[.indexes[]? | select(.collectionGroup == $c)] | length' "$arquivo" 2>/dev/null || echo 0
}

# Referência estática no código real (CRM/) — heurística: não garante
# 100% (grep, não um parser JS), mas é o único jeito de checar "coleção
# órfã" sem rodar o app. Nunca declara "órfã" como certeza — só como
# achado a confirmar manualmente (ver CCC-F04-001 §18, "nunca falsos
# positivos apresentados como fato").
_cc_bd_colecao_referenciada_no_codigo() {
  local nome="$1"
  grep -rqE "collection\([^)]*['\"]${nome}['\"]|\.collection\(['\"]${nome}['\"]\)|collectionGroup\(['\"]${nome}['\"]\)" \
    --include="*.js" --include="*.mjs" \
    "$REPO_DIR/CRM" "$REPO_DIR/functions" 2>/dev/null
}

_cc_bd_listar_colecoes() {
  _cc_bd_init
  local nome tem_rule tem_backup indices
  while IFS= read -r nome; do
    [ -z "$nome" ] && continue
    tem_rule="não"; _cc_bd_colecao_tem_rule "$nome" && tem_rule="sim"
    tem_backup="não"; _cc_bd_colecao_no_backup "$nome" && tem_backup="sim"
    indices=$(_cc_bd_colecao_indices_count "$nome")
    if [ "$tem_rule" = "sim" ]; then
      _cc_bd_adicionar "ok" "$nome" "Rules: $tem_rule · Backup: $tem_backup · Índices: $indices"
    else
      _cc_bd_adicionar "warn" "$nome" "Rules: $tem_rule · Backup: $tem_backup · Índices: $indices" "Adicionar bloco match para esta coleção"
    fi
  done < <(_cc_bd_colecoes_conhecidas)
  _cc_bd_exibir_resultados_simples "COLEÇÕES" "Coleções conhecidas (declaradas em Rules ∪ backup-dados.js)"
}

_cc_bd_colecoes_sem_rules() {
  _cc_bd_init
  local nome
  while IFS= read -r nome; do
    [ -z "$nome" ] && continue
    if ! _cc_bd_colecao_tem_rule "$nome"; then
      _cc_bd_adicionar "warn" "$nome" "sem bloco match em $(basename "$(_cc_bd_rules_path)")" "Revisar cobertura de Rules desta coleção"
    fi
  done < <(_cc_bd_colecoes_conhecidas)
  if [ "${CC_BD_TOTAL:-0}" -eq 0 ]; then
    _cc_bd_info "Nenhuma coleção conhecida sem Rules."
  fi
  _cc_bd_exibir_resultados_simples "COLEÇÕES SEM RULES" "Coleções conhecidas que não têm bloco match em Rules"
}

_cc_bd_colecoes_orfas() {
  _cc_bd_init
  _cc_bd_info "Heurística por grep em CRM/ e functions/ — confirmar manualmente antes de remover qualquer coleção."
  local nome
  while IFS= read -r nome; do
    [ -z "$nome" ] && continue
    if ! _cc_bd_colecao_referenciada_no_codigo "$nome"; then
      _cc_bd_adicionar "warn" "$nome" "nenhuma referência estática encontrada no código" "Confirmar manualmente antes de considerar remover"
    else
      _cc_bd_adicionar "ok" "$nome" "referenciada no código"
    fi
  done < <(_cc_bd_colecoes_conhecidas)
  _cc_bd_exibir_resultados_simples "COLEÇÕES ÓRFÃS (candidatas)" "Coleções sem referência estática encontrada em CRM/ ou functions/"
}

_cc_bd_colecoes_duplicadas() {
  _cc_bd_init
  local padrao contagem
  while IFS= read -r padrao; do
    [ -z "$padrao" ] && continue
    contagem=$(_cc_bd_rules_match_patterns | grep -Fxc "$padrao")
    if [ "$contagem" -gt 1 ]; then
      _cc_bd_adicionar "warn" "$padrao" "declarado $contagem vezes em Rules" "Consolidar em um único bloco match"
    fi
  done < <(_cc_bd_rules_match_patterns | sort -u)
  if [ "${CC_BD_TOTAL:-0}" -eq 0 ]; then
    _cc_bd_info "Nenhum padrão de match duplicado encontrado em Rules."
  fi
  _cc_bd_exibir_resultados_simples "COLEÇÕES/PADRÕES DUPLICADOS" "Blocos match com o mesmo caminho declarados mais de uma vez"
}

_cc_bd_colecoes_vazias() {
  _cc_bd_init
  _cc_bd_info "Não disponível: contar documentos exige Admin SDK com credenciais (ADC) — ver Configurações."
  _cc_bd_info "gcloud não oferece leitura de documentos Firestore, só administração (databases/índices/backups)."
  _cc_bd_exibir_resultados_simples "COLEÇÕES VAZIAS" "Requer Application Default Credentials"
}

_cc_bd_menu_colecoes() {
  local opcao
  while true; do
    _cc_screen_title "COLEÇÕES"
    _cc_screen_breadcrumb "Control Center › Banco de Dados › Coleções"
    _cc_box_blank
    _cc_box_item "1" "Listar Coleções"
    _cc_box_item "2" "Localizar Coleções sem Rules"
    _cc_box_item "3" "Localizar Coleções Vazias"
    _cc_box_item "4" "Localizar Coleções Órfãs"
    _cc_box_item "5" "Localizar Coleções Duplicadas"
    _cc_box_blank
    _cc_box_item "0" "Voltar"
    _cc_screen_footer "Somente leitura · 0 volta"
    read -rp "Opção: " opcao
    case "$opcao" in
      1) _cc_bd_listar_colecoes; _cc_pause ;;
      2) _cc_bd_colecoes_sem_rules; _cc_pause ;;
      3) _cc_bd_colecoes_vazias; _cc_pause ;;
      4) _cc_bd_colecoes_orfas; _cc_pause ;;
      5) _cc_bd_colecoes_duplicadas; _cc_pause ;;
      0) break ;;
      *) echo "Opção inválida." ;;
    esac
  done
}

_cc_bd_exibir_resultados_simples() {
  local titulo="$1" subtitulo="$2"
  _cc_screen_title "$titulo"
  _cc_screen_breadcrumb "Control Center › Banco de Dados"
  _cc_box_blank
  _cc_box_text "$subtitulo"
  _cc_box_blank
  _cc_box_close
  echo ""
  local info r
  for info in "${CC_BD_INFO[@]:-}"; do
    [ -n "$info" ] && _cc_ok "$info"
  done
  for r in "${CC_BD_RESULTADOS[@]:-}"; do
    [ -z "$r" ] && continue
    IFS='|' read -r status desc detalhes sugestao <<< "$r"
    case "$status" in
      ok)   _cc_ok "$desc — $detalhes" ;;
      warn) _cc_warn "$desc — $detalhes${sugestao:+ (sugestão: $sugestao)}" ;;
      fail) _cc_fail "$desc — $detalhes${sugestao:+ (sugestão: $sugestao)}" ;;
    esac
  done
  echo ""
  echo "Total: ${CC_BD_TOTAL:-0} · OK: ${CC_BD_OK:-0} · Avisos: ${CC_BD_WARN:-0} · Falhas: ${CC_BD_FAIL:-0}"
  _cc_log "Banco de Dados: $titulo consultado (${CC_BD_TOTAL:-0} itens)"
  # Sem _cc_pause aqui: só é chamada a partir dos loops _cc_bd_menu_colecoes
  # e _cc_bd_menu_ferramentas, que pausam explicitamente após cada despacho.
}
