#!/bin/bash
# Cell City Control Center — módulo Banco de Dados, Firestore Rules.
# CCC-F04-001 §7. Só leitura: valida o arquivo local (heurística de
# sintaxe, permissões abertas, blocos duplicados/não referenciados) e,
# quando gcloud está autenticado, compara com o release realmente
# publicado via firebaserules.googleapis.com — mesma técnica já validada
# neste projeto (ver memória "feedback-firestore-rules-verify-api": o
# Console pode confirmar "Publicar" sem atualizar o release ativo).
# Nunca publica Rules — isso continua sendo só `firebase deploy`.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_bd_rules_sintaxe_ok() {
  local arquivo="$1" abre fecha
  grep -q "rules_version" "$arquivo" || return 1
  grep -q "service cloud.firestore" "$arquivo" || return 1
  abre=$(grep -o '{' "$arquivo" | wc -l)
  fecha=$(grep -o '}' "$arquivo" | wc -l)
  [ "$abre" -eq "$fecha" ]
}

_cc_bd_rules_permissoes_abertas() {
  local arquivo="$1"
  grep -nE "allow[^:]*:\s*if\s+true\s*;" "$arquivo" 2>/dev/null
}

# Compara o arquivo local com o release ativo (firebaserules.googleapis.com).
# Retorna 0 e ecoa "identico"/"diferente" em CC_BD_RULES_DRIFT; 1 se não foi
# possível comparar (rede/API/autenticação), com o motivo em CC_BD_GCLOUD_ERRO.
CC_BD_RULES_DRIFT=""

_cc_bd_rules_comparar_publicado() {
  local projeto="$1" arquivo_local="$2" token release_json ruleset_name ruleset_json publicado local_normalizado publicado_normalizado
  CC_BD_RULES_DRIFT=""
  _cc_bd_tem curl || { CC_BD_GCLOUD_ERRO="curl não disponível"; return 1; }
  _cc_bd_gcloud_autenticado || { CC_BD_GCLOUD_ERRO="gcloud não autenticado"; return 1; }
  token=$(timeout "${CC_BD_TIMEOUT}s" gcloud auth print-access-token 2>/dev/null)
  [ -n "$token" ] || { CC_BD_GCLOUD_ERRO="não foi possível obter access token"; return 1; }

  release_json=$(timeout "${CC_BD_TIMEOUT}s" curl -s \
    -H "Authorization: Bearer $token" -H "x-goog-user-project: $projeto" \
    "https://firebaserules.googleapis.com/v1/projects/${projeto}/releases/cloud.firestore" 2>/dev/null)
  ruleset_name=$(echo "$release_json" | jq -r '.rulesetName // empty' 2>/dev/null)
  if [ -z "$ruleset_name" ]; then
    CC_BD_GCLOUD_ERRO=$(echo "$release_json" | jq -r '.error.message // "resposta inesperada da API firebaserules"' 2>/dev/null)
    return 1
  fi

  ruleset_json=$(timeout "${CC_BD_TIMEOUT}s" curl -s \
    -H "Authorization: Bearer $token" -H "x-goog-user-project: $projeto" \
    "https://firebaserules.googleapis.com/v1/${ruleset_name}" 2>/dev/null)
  publicado=$(echo "$ruleset_json" | jq -r '.source.files[0].content // empty' 2>/dev/null)
  if [ -z "$publicado" ]; then
    CC_BD_GCLOUD_ERRO="não foi possível ler o conteúdo do ruleset publicado"
    return 1
  fi

  local_normalizado=$(tr -s '[:space:]' ' ' < "$arquivo_local")
  publicado_normalizado=$(echo "$publicado" | tr -s '[:space:]' ' ')
  if [ "$local_normalizado" = "$publicado_normalizado" ]; then
    CC_BD_RULES_DRIFT="identico"
  else
    CC_BD_RULES_DRIFT="diferente"
  fi
  return 0
}

_cc_bd_rules() {
  local ambiente projeto arquivo
  ambiente=$(_cc_bd_escolher_ambiente) || { echo "Cancelado."; return; }
  projeto=$(_cc_bd_projeto_id "$ambiente")
  arquivo=$(_cc_bd_rules_path)

  _cc_bd_init

  if [ ! -f "$arquivo" ]; then
    _cc_bd_adicionar "fail" "Arquivo de Rules" "$arquivo não encontrado"
    _cc_bd_exibir_rules
    return
  fi
  _cc_bd_adicionar "ok" "Arquivo de Rules" "$arquivo"

  if _cc_bd_rules_sintaxe_ok "$arquivo"; then
    _cc_bd_adicionar "ok" "Sintaxe (heurística)" "rules_version + service + chaves balanceadas"
  else
    _cc_bd_adicionar "fail" "Sintaxe (heurística)" "estrutura básica ausente ou chaves desbalanceadas" "Revisar o arquivo antes de publicar"
  fi

  local abertas
  abertas=$(_cc_bd_rules_permissoes_abertas "$arquivo")
  if [ -n "$abertas" ]; then
    local qtd linhas_detalhe
    qtd=$(echo "$abertas" | grep -c .)
    # Mostra a coleção de cada ocorrência (bloco match mais próximo acima da
    # linha) — sem isso, o achado só diz "3 linhas" e obriga a abrir o
    # arquivo pra saber se é um `get` público já revisado (ex.: config/,
    # pre_os/) ou um `read`/`write` irrestrito novo (muito mais grave).
    linhas_detalhe=$(echo "$abertas" | cut -d: -f1 | while IFS= read -r n; do
      local colecao trecho
      colecao=$(awk -v ate="$n" 'NR<=ate && /^    match \// {last=$0} END{print last}' "$arquivo" | sed -n 's/^    match \/\([a-zA-Z0-9_]*\)\/.*$/\1/p')
      trecho=$(sed -n "${n}p" "$arquivo" | sed 's/^[[:space:]]*//')
      echo "${colecao:-?}:${n} (${trecho})"
    done | paste -sd ';' -)
    _cc_bd_adicionar "fail" "Permissões abertas" "$qtd linha(s) com 'if true': $linhas_detalhe" "Revisar cada linha — achado crítico em auditorias anteriores deste projeto"
  else
    _cc_bd_adicionar "ok" "Permissões abertas" "nenhuma encontrada (heurística 'if true')"
  fi

  local duplicadas_qtd padrao contagem
  duplicadas_qtd=0
  while IFS= read -r padrao; do
    [ -z "$padrao" ] && continue
    contagem=$(_cc_bd_rules_match_patterns | grep -Fxc "$padrao")
    [ "$contagem" -gt 1 ] && duplicadas_qtd=$((duplicadas_qtd + 1))
  done < <(_cc_bd_rules_match_patterns | sort -u)
  if [ "$duplicadas_qtd" -gt 0 ]; then
    _cc_bd_adicionar "warn" "Regras duplicadas" "$duplicadas_qtd padrão(ões) de match repetido(s)" "Ver Coleções › Duplicadas para o detalhe"
  else
    _cc_bd_adicionar "ok" "Regras duplicadas" "0"
  fi

  local nao_utilizadas_qtd nome
  nao_utilizadas_qtd=0
  while IFS= read -r nome; do
    [ -z "$nome" ] && continue
    _cc_bd_colecao_referenciada_no_codigo "$nome" || nao_utilizadas_qtd=$((nao_utilizadas_qtd + 1))
  done < <(_cc_bd_rules_colecoes)
  if [ "$nao_utilizadas_qtd" -gt 0 ]; then
    _cc_bd_adicionar "warn" "Regras possivelmente não utilizadas" "$nao_utilizadas_qtd coleção(ões) com Rule sem referência estática no código" "Ver Coleções › Órfãs para o detalhe"
  else
    _cc_bd_adicionar "ok" "Regras possivelmente não utilizadas" "0"
  fi

  if _cc_bd_rules_comparar_publicado "$projeto" "$arquivo"; then
    if [ "$CC_BD_RULES_DRIFT" = "identico" ]; then
      _cc_bd_adicionar "ok" "Comparação com publicado ($ambiente)" "arquivo local é idêntico ao release ativo"
    else
      _cc_bd_adicionar "warn" "Comparação com publicado ($ambiente)" "arquivo local difere do release ativo" "Esperado em develop antes da promoção; confirmar se é intencional"
    fi
  else
    _cc_bd_adicionar "warn" "Comparação com publicado ($ambiente)" "$CC_BD_GCLOUD_ERRO"
  fi

  _cc_bd_exibir_rules
}

# Atalho de Ferramentas (CCC-F04-001 §12) — só as regras sem referência
# estática, sem rodar a bateria completa de _cc_bd_rules.
_cc_bd_rules_nao_utilizadas_listar() {
  _cc_bd_init
  local nome
  while IFS= read -r nome; do
    [ -z "$nome" ] && continue
    if _cc_bd_colecao_referenciada_no_codigo "$nome"; then
      _cc_bd_adicionar "ok" "$nome" "referenciada no código"
    else
      _cc_bd_adicionar "warn" "$nome" "Rule sem referência estática encontrada" "Confirmar manualmente antes de remover a Rule"
    fi
  done < <(_cc_bd_rules_colecoes)
  _cc_bd_exibir_resultados_simples "RULES POSSIVELMENTE NÃO UTILIZADAS" "Coleções com bloco match em Rules mas sem referência estática em CRM/ ou functions/"
}

_cc_bd_exibir_rules() {
  _cc_screen_title "FIRESTORE RULES"
  _cc_screen_breadcrumb "Control Center › Banco de Dados"
  _cc_box_blank
  _cc_box_text "Somente leitura — nenhuma Rule foi publicada ou alterada."
  _cc_box_blank
  _cc_box_close
  echo ""
  local r
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
  echo "Estado: $(_cc_bd_status_label "$(_cc_bd_classificar_integridade)")"
  _cc_log "Banco de Dados: Firestore Rules consultado ($(_cc_bd_classificar_integridade))"
  # Sem _cc_pause aqui: chamada só pelo item "4" do menu principal via
  # _cc_run_submenu, que já pausa depois de despachar (lib/ui-screen.sh).
}
