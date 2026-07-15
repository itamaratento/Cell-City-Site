#!/bin/bash
# Cell City Control Center — módulo Banco de Dados, Integridade.
# CCC-F04-001 §9. Validação estrutural agregada: arquivos obrigatórios,
# consistência raiz×CRM/, cobertura de Rules e alcance do gcloud. Todo
# somente-leitura — nenhum arquivo é criado/alterado por esta checagem.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_cc_bd_integridade() {
  _cc_bd_init

  local arquivo
  for arquivo in firebase.json .firebaserc functions/index.js functions/package.json; do
    if [ -f "$REPO_DIR/$arquivo" ]; then
      _cc_bd_adicionar "ok" "Arquivo obrigatório" "$arquivo presente"
    else
      _cc_bd_adicionar "fail" "Arquivo obrigatório" "$arquivo ausente"
    fi
  done

  local rules_path indexes_path
  rules_path=$(_cc_bd_rules_path)
  indexes_path=$(_cc_bd_indexes_path)
  if [ -f "$rules_path" ]; then
    _cc_bd_adicionar "ok" "Rules (caminho de firebase.json)" "$rules_path"
  else
    _cc_bd_adicionar "fail" "Rules (caminho de firebase.json)" "$rules_path ausente"
  fi
  if [ -f "$indexes_path" ]; then
    _cc_bd_adicionar "ok" "Índices (caminho de firebase.json)" "$indexes_path"
  else
    _cc_bd_adicionar "fail" "Índices (caminho de firebase.json)" "$indexes_path ausente"
  fi

  # Consistência raiz×CRM/ — este projeto manteve cópias em ambos os
  # lugares em algum momento do histórico; só o caminho de firebase.json
  # é o oficial. Divergência aqui é sinal de arquivo esquecido.
  local raiz_rules="$REPO_DIR/firestore.rules" raiz_indexes="$REPO_DIR/firestore.indexes.json"
  if [ -f "$raiz_rules" ] && [ "$raiz_rules" != "$rules_path" ]; then
    if diff -q "$raiz_rules" "$rules_path" >/dev/null 2>&1; then
      _cc_bd_adicionar "ok" "firestore.rules na raiz" "idêntico ao oficial ($rules_path)"
    else
      _cc_bd_adicionar "warn" "firestore.rules na raiz" "diferente do oficial ($rules_path)" "Confirmar se é artefato obsoleto"
    fi
  fi
  if [ -f "$raiz_indexes" ] && [ "$raiz_indexes" != "$indexes_path" ]; then
    if diff -q "$raiz_indexes" "$indexes_path" >/dev/null 2>&1; then
      _cc_bd_adicionar "ok" "firestore.indexes.json na raiz" "idêntico ao oficial ($indexes_path)"
    else
      _cc_bd_adicionar "warn" "firestore.indexes.json na raiz" "diferente do oficial ($indexes_path)" "Confirmar se é artefato obsoleto"
    fi
  fi

  local total_colecoes sem_rules
  total_colecoes=$(_cc_bd_colecoes_conhecidas | grep -c . || true)
  sem_rules=$(_cc_bd_colecoes_conhecidas | while IFS= read -r n; do [ -z "$n" ] && continue; _cc_bd_colecao_tem_rule "$n" || echo "$n"; done | grep -c . || true)
  if [ "$sem_rules" -gt 0 ]; then
    _cc_bd_adicionar "warn" "Cobertura de Rules" "$sem_rules de $total_colecoes coleções conhecidas sem Rule" "Ver Coleções › Sem Rules"
  else
    _cc_bd_adicionar "ok" "Cobertura de Rules" "$total_colecoes de $total_colecoes coleções conhecidas com Rule"
  fi

  if _cc_bd_tem gcloud; then
    if _cc_bd_gcloud_autenticado; then
      _cc_bd_adicionar "ok" "gcloud" "instalado e autenticado — checagens ao vivo disponíveis"
    else
      _cc_bd_adicionar "warn" "gcloud" "instalado, sem conta autenticada — checagens ao vivo indisponíveis (rode gcloud auth login)"
    fi
  else
    _cc_bd_adicionar "warn" "gcloud" "não instalado — checagens ao vivo indisponíveis"
  fi

  _cc_bd_exibir_integridade
}

_cc_bd_exibir_integridade() {
  _cc_screen_title "INTEGRIDADE"
  _cc_screen_breadcrumb "Control Center › Banco de Dados"
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
  echo "Total: ${CC_BD_TOTAL:-0} · OK: ${CC_BD_OK:-0} · Avisos: ${CC_BD_WARN:-0} · Falhas: ${CC_BD_FAIL:-0}"
  echo "Resultado: $(_cc_bd_status_label "$(_cc_bd_classificar_integridade)")"
  echo "Tempo: $(_cc_bd_duracao)"
  _cc_log "Banco de Dados: Integridade verificada ($(_cc_bd_classificar_integridade))"
  # Sem _cc_pause aqui: chamada pelo item "6" do menu principal via
  # _cc_run_submenu (que já pausa) e também pelo item "5" de Ferramentas
  # ("Validar Estrutura Firebase"), cujo loop pausa explicitamente.
}
