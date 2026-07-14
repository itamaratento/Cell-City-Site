#!/bin/bash
# Cell City Control Center — módulo Branches e Sincronização, camada
# "Sincronização" (Fase 5). Só busca atualizações (git fetch) e orienta —
# nunca faz pull/push/merge por aqui. Publicar/promover continua sendo
# papel exclusivo do módulo Release, que já envelopa subir/subir-ok (ver
# README.md, "Regra de ouro" — mesmo princípio das Fases 2 e 3).
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_brs_sincronizacao() {
  echo "🔄 Sincronização"
  echo "─────────────────"
  echo "Buscando atualizações do remote (git fetch --all --prune)..."
  local fetch_log
  fetch_log=$(mktemp /tmp/cellcity-branches-fetch-XXXXXX)
  if git -C "$REPO_DIR" fetch --all --prune >"$fetch_log" 2>&1; then
    _cc_ok "Fetch concluído."
  else
    _cc_fail "Fetch falhou — ver $fetch_log"
    _cc_log "Branches e Sincronização: Sincronização — fetch falhou"
    return
  fi

  echo ""
  local info upstream ahead behind
  info="$(_brs_upstream_info)"
  IFS='|' read -r upstream ahead behind <<< "$info"
  if [ -z "$upstream" ]; then
    _cc_warn "Branch atual sem upstream configurado — nada pra comparar."
    _cc_log "Branches e Sincronização: Sincronização — fetch ok, sem upstream configurado"
    return
  fi

  echo "Upstream: $upstream"
  echo "Ahead   : $ahead commit(s) local(is) não publicados"
  echo "Behind  : $behind commit(s) remoto(s) não baixados"
  echo ""
  if [ "$ahead" = "0" ] && [ "$behind" = "0" ]; then
    _cc_ok "Sincronizado — nada a fazer."
  else
    [ "$behind" != "0" ] && _cc_warn "Precisa atualizar: sua branch está atrás do upstream (dê um 'git pull' local)."
    [ "$ahead" != "0" ] && _cc_warn "Precisa publicar: use Release › Enviar Alterações (subir) ou Criar Tag e Publicar (subir-ok)."
  fi
  _cc_log "Branches e Sincronização: Sincronização — fetch ok (upstream=$upstream, ahead=$ahead, behind=$behind)"
}
