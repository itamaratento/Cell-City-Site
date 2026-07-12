#!/bin/bash
# Cell City Control Center — módulo Branches e Sincronização, camada
# "Integridade" (Fase 5). Leitura pura — mesmo espírito de
# lib/validacao.sh do módulo Backup e Recuperação (Fase 3), mas focada no
# estado do próprio repositório Git (não no sistema de backup).
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_brs_integridade_git() {
  echo "🔧 Integridade Git"
  echo "───────────────────"

  echo "Repositório acessível..."
  if git -C "$REPO_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    _cc_ok "Repositório Git válido em $REPO_DIR."
  else
    _cc_fail "Não é um repositório Git válido."
    return
  fi

  echo "HEAD válido..."
  if git -C "$REPO_DIR" rev-parse --verify -q HEAD >/dev/null; then
    _cc_ok "HEAD aponta pra um commit válido."
  else
    _cc_fail "HEAD inválido ou repositório sem commits."
  fi

  echo "Remote configurado..."
  local url
  url="$(git -C "$REPO_DIR" remote get-url origin 2>/dev/null)"
  if [ -n "$url" ]; then
    _cc_ok "origin configurado: $url"
  else
    _cc_fail "Nenhum remote 'origin' configurado."
  fi

  echo "Branch consistente..."
  local branch
  branch="$(_cc_git_branch)"
  if [ "$branch" = "desconhecida" ]; then
    _cc_fail "HEAD desanexado (detached) ou branch não identificável."
  elif _cc_svc_git_branch_reconhecida; then
    _cc_ok "Branch '$branch' reconhecida (develop/main)."
  else
    _cc_warn "Branch '$branch' fora do padrão develop/main."
  fi

  echo "Objetos íntegros (git fsck)..."
  if git -C "$REPO_DIR" fsck --no-dangling >/tmp/cellcity-branches-fsck.log 2>&1; then
    _cc_ok "git fsck não encontrou problemas."
  else
    _cc_fail "git fsck encontrou problemas — ver /tmp/cellcity-branches-fsck.log"
  fi

  echo "Referências válidas..."
  if [ "$branch" = "desconhecida" ] || git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/$branch"; then
    _cc_ok "Referências locais consistentes."
  else
    _cc_warn "Referência da branch atual não encontrada em refs/heads."
  fi

  echo "Workspace consistente..."
  if _cc_svc_git_workspace_limpo; then
    _cc_ok "Working tree limpo."
  else
    _cc_warn "Working tree com alterações pendentes ($(_cc_svc_git_arquivos_alterados_count) arquivo(s))."
  fi
}
