#!/bin/bash
# Cell City Control Center — módulo Banco de Dados, Índices.
# CCC-F04-001 §6. Compara o arquivo declarado (firestore.indexes.json,
# caminho lido de firebase.json) com os índices realmente publicados
# (gcloud firestore indexes composite list, somente leitura). Nunca
# modifica índice nenhum — `firebase deploy --only firestore:indexes`
# continua sendo a única forma de publicar, fora deste módulo.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

# Assinatura estável de um índice composto: collectionGroup + campos
# ordenados, pra comparar declarado × publicado sem depender de "name"
# (o "name" só existe no lado publicado). O Firestore sempre acrescenta
# um campo __name__ implícito (mesma direção do último campo com "order")
# quando ele não é declarado explicitamente — o arquivo local costuma
# omitir esse campo, mas o `gcloud` sempre devolve ele explícito. Sem essa
# normalização, todo índice que omite __name__ no arquivo apareceria
# incorretamente como "ausente" mesmo já publicado (bug real encontrado
# na homologação manual desta Fase — ver Parecer Executivo).
_cc_bd_indice_assinatura() {
  # stdin: um índice em JSON (jq -c)
  jq -c '
    (.fields | map(select(.fieldPath == "__name__")) | length > 0) as $tem_name
    | (.fields | map(select(.order != null)) | if length > 0 then .[-1].order else "ASCENDING" end) as $ordem_name
    | {
        collectionGroup,
        fields: (
          (.fields | map({fieldPath, order, arrayConfig}))
          + (if $tem_name then [] else [{fieldPath: "__name__", order: $ordem_name, arrayConfig: null}] end)
        )
      }
  ' 2>/dev/null
}

_cc_bd_indices_declarados() {
  local arquivo
  arquivo=$(_cc_bd_indexes_path)
  [ -f "$arquivo" ] && _cc_bd_tem jq || return
  jq -c '.indexes[]?' "$arquivo" 2>/dev/null | while IFS= read -r idx; do
    echo "$idx" | _cc_bd_indice_assinatura
  done
}

_cc_bd_indices_publicados() {
  local projeto="$1" saida
  saida=$(_cc_bd_gcloud_json "$projeto" firestore indexes composite list) || return 1
  # gcloud não devolve "collectionGroup" no nível raiz do item — só dentro
  # de "name" (.../collectionGroups/<grupo>/indexes/<id>). Extrai antes de
  # aplicar a mesma assinatura usada no lado declarado.
  echo "$saida" | jq -c '.[]? | .collectionGroup = (.name | split("/") | .[5])' 2>/dev/null | while IFS= read -r idx; do
    echo "$idx" | _cc_bd_indice_assinatura
  done
}

_cc_bd_indices() {
  local ambiente projeto
  ambiente=$(_cc_bd_escolher_ambiente) || { echo "Cancelado."; return; }
  projeto=$(_cc_bd_projeto_id "$ambiente")

  _cc_bd_init

  local arquivo_declarado arquivo_raiz
  arquivo_declarado=$(_cc_bd_indexes_path)
  if [ ! -f "$arquivo_declarado" ]; then
    _cc_bd_adicionar "fail" "Arquivo de índices" "$arquivo_declarado não encontrado"
  else
    _cc_bd_adicionar "ok" "Arquivo de índices" "$arquivo_declarado"
  fi

  # Achado real deste projeto: existe firestore.indexes.json na raiz do
  # repositório, diferente do arquivo oficial (CRM/firestore.indexes.json)
  # usado por firebase.json — provável artefato desatualizado.
  arquivo_raiz="$REPO_DIR/firestore.indexes.json"
  if [ -f "$arquivo_raiz" ] && [ "$arquivo_raiz" != "$arquivo_declarado" ] && ! diff -q "$arquivo_raiz" "$arquivo_declarado" >/dev/null 2>&1; then
    _cc_bd_adicionar "warn" "Arquivo duplicado" "$arquivo_raiz existe e é diferente do arquivo oficial ($arquivo_declarado)" "Confirmar se é artefato obsoleto e removê-lo"
  fi

  if ! _cc_bd_gcloud_autenticado; then
    _cc_bd_adicionar "warn" "gcloud" "não autenticado — só é possível validar o arquivo local"
    _cc_bd_exibir_indices
    return
  fi

  local declarados publicados
  declarados=$(_cc_bd_indices_declarados | sort -u)
  if ! publicados=$(_cc_bd_indices_publicados "$projeto" | sort -u); then
    _cc_bd_adicionar "warn" "Índices publicados ($ambiente)" "$CC_BD_GCLOUD_ERRO"
    _cc_bd_exibir_indices
    return
  fi

  local total_decl total_pub ausentes_count redundantes_count
  total_decl=$(echo "$declarados" | grep -c . || true)
  total_pub=$(echo "$publicados" | grep -c . || true)
  _cc_bd_adicionar "ok" "Índices declarados" "$total_decl"
  _cc_bd_adicionar "ok" "Índices publicados ($ambiente)" "$total_pub"

  ausentes_count=$(comm -23 <(echo "$declarados") <(echo "$publicados") | grep -c . || true)
  redundantes_count=$(comm -13 <(echo "$declarados") <(echo "$publicados") | grep -c . || true)

  if [ "$ausentes_count" -gt 0 ]; then
    _cc_bd_adicionar "warn" "Índices ausentes" "$ausentes_count declarados no arquivo mas não publicados em $ambiente" "Publicar com firebase deploy --only firestore:indexes (fora deste módulo)"
  else
    _cc_bd_adicionar "ok" "Índices ausentes" "0"
  fi

  if [ "$redundantes_count" -gt 0 ]; then
    _cc_bd_adicionar "warn" "Índices redundantes" "$redundantes_count publicados em $ambiente mas não estão no arquivo declarado" "Confirmar se ainda são usados; senão, remover do projeto"
  else
    _cc_bd_adicionar "ok" "Índices redundantes" "0"
  fi

  local invalidos
  invalidos=$(_cc_bd_gcloud_json "$projeto" firestore indexes composite list 2>/dev/null | jq '[.[] | select(.state != "READY")] | length' 2>/dev/null)
  if [ -n "${invalidos:-}" ] && [ "$invalidos" -gt 0 ] 2>/dev/null; then
    _cc_bd_adicionar "warn" "Índices em estado não READY" "$invalidos (CREATING/ERROR/NEEDS_REPAIR)"
  fi

  _cc_bd_exibir_indices
}

# Atalho de Ferramentas (CCC-F04-001 §12) — heurística leve: índice
# declarado para uma collectionGroup que nem aparece na lista de coleções
# conhecidas (Rules ∪ backup-dados.js) é candidato a não utilizado. Não
# analisa queries reais do código (exigiria parser JS) — por isso "candidato".
_cc_bd_indices_nao_utilizados_listar() {
  _cc_bd_init
  local arquivo grupo
  arquivo=$(_cc_bd_indexes_path)
  if [ ! -f "$arquivo" ] || ! _cc_bd_tem jq; then
    _cc_bd_info "Arquivo de índices indisponível ou jq ausente."
    _cc_bd_exibir_resultados_simples "ÍNDICES POSSIVELMENTE NÃO UTILIZADOS" "Candidatos por collectionGroup desconhecida"
    return
  fi
  while IFS= read -r grupo; do
    [ -z "$grupo" ] && continue
    if _cc_bd_colecoes_conhecidas | grep -qx "$grupo"; then
      _cc_bd_adicionar "ok" "$grupo" "collectionGroup conhecida"
    else
      _cc_bd_adicionar "warn" "$grupo" "collectionGroup não está em Rules nem em backup-dados.js" "Confirmar se a coleção ainda existe antes de remover o índice"
    fi
  done < <(jq -r '.indexes[]?.collectionGroup' "$arquivo" 2>/dev/null | sort -u)
  _cc_bd_exibir_resultados_simples "ÍNDICES POSSIVELMENTE NÃO UTILIZADOS" "Candidatos por collectionGroup desconhecida (heurística — não analisa queries reais)"
}

_cc_bd_exibir_indices() {
  _cc_screen_title "ÍNDICES"
  _cc_screen_breadcrumb "Control Center › Banco de Dados"
  _cc_box_blank
  _cc_box_text "Relatório gerado — nenhum índice foi criado, removido ou publicado."
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
  _cc_log "Banco de Dados: Índices consultado ($(_cc_bd_classificar_integridade))"
  # Sem _cc_pause aqui: chamada só pelo item "3" do menu principal via
  # _cc_run_submenu, que já pausa depois de despachar (lib/ui-screen.sh).
}
