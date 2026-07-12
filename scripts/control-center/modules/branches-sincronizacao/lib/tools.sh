#!/bin/bash
# Cell City Control Center — módulo Branches e Sincronização, camada
# "Ferramentas" (Fase 5). Todas as ações são só leitura (nenhuma altera o
# repositório) — ver README.md, "Segurança": Ferramentas Git nunca é um
# atalho pra ação destrutiva sem passar por Gerenciar Branches/Stash.
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_brs_tool_branches_mergeadas() {
  echo "🔍 Branches Já Mergeadas em 'main' (candidatas a limpeza)"
  echo "───────────────────────────────────────────────────────────"
  local achadas
  achadas="$(git -C "$REPO_DIR" branch --merged main --format='%(refname:short)' | grep -vE '^(develop|main)$')"
  if [ -z "$achadas" ]; then
    echo "  (nenhuma)"
  else
    echo "  ${achadas//$'\n'/$'\n  '}"
  fi
}

_brs_tool_sem_upstream() {
  echo "🔍 Branches Locais Sem Upstream"
  echo "─────────────────────────────────"
  local encontrou=0 branch upstream
  while IFS= read -r branch; do
    upstream="$(git -C "$REPO_DIR" rev-parse --abbrev-ref --symbolic-full-name "$branch@{u}" 2>/dev/null)"
    if [ -z "$upstream" ]; then
      echo "  - $branch"
      encontrou=1
    fi
  done < <(git -C "$REPO_DIR" branch --list --format='%(refname:short)')
  [ "$encontrou" -eq 0 ] && echo "  (nenhuma — todas as branches locais têm upstream)"
}

_brs_tool_tags_orfas() {
  echo "🔍 Localizar Tags Órfãs"
  echo "─────────────────────────"
  _brs_tags_orfas
}

_brs_tool_conflitos() {
  echo "⚠️  Conflitos Pendentes"
  echo "────────────────────────"
  if [ -f "$REPO_DIR/.git/MERGE_HEAD" ]; then
    _cc_warn "Merge em andamento — possíveis conflitos pendentes:"
    git -C "$REPO_DIR" diff --name-only --diff-filter=U
  elif git -C "$REPO_DIR" status --porcelain | grep -qE '^(UU|AA|DD) '; then
    _cc_warn "Arquivos com conflito de merge encontrados:"
    git -C "$REPO_DIR" status --porcelain | grep -E '^(UU|AA|DD) '
  else
    _cc_ok "Nenhum conflito pendente."
  fi
}

_brs_tool_validar_config() {
  echo "⚙️  Validar Configuração Git"
  echo "──────────────────────────────"
  local nome email url
  nome="$(git -C "$REPO_DIR" config user.name 2>/dev/null)"
  email="$(git -C "$REPO_DIR" config user.email 2>/dev/null)"
  url="$(git -C "$REPO_DIR" remote get-url origin 2>/dev/null)"
  if [ -n "$nome" ]; then _cc_ok "user.name: $nome"; else _cc_fail "user.name não configurado."; fi
  if [ -n "$email" ]; then _cc_ok "user.email: $email"; else _cc_fail "user.email não configurado."; fi
  if [ -n "$url" ]; then _cc_ok "remote origin: $url"; else _cc_fail "remote origin não configurado."; fi
}

_brs_tool_gitignore() {
  echo "📄 Verificar .gitignore"
  echo "─────────────────────────"
  if [ -f "$REPO_DIR/.gitignore" ]; then
    _cc_ok ".gitignore encontrado."
    if grep -q 'scripts/control-center/logs' "$REPO_DIR/.gitignore"; then
      _cc_ok "Exceção de logs/ do Control Center presente."
    else
      _cc_warn "Não encontrei a exceção de scripts/control-center/logs/ no .gitignore."
    fi
  else
    _cc_fail ".gitignore não encontrado na raiz do repositório."
  fi
}

_brs_tool_config_atual() {
  echo "🛠️  Configuração Git Atual (--local)"
  echo "───────────────────────────────────────"
  git -C "$REPO_DIR" config --local --list
}

_brs_ferramentas_git() {
  while true; do
    echo "🧰 Ferramentas Git"
    echo "───────────────────"
    echo "  1) Localizar branches órfãs/mergeadas"
    echo "  2) Localizar branches sem upstream"
    echo "  3) Localizar tags órfãs"
    echo "  4) Verificar conflitos pendentes"
    echo "  5) Validar configuração Git"
    echo "  6) Verificar .gitignore"
    echo "  7) Mostrar configuração atual (git config)"
    echo "  0) Voltar"
    read -rp "Opção: " opcao
    echo ""
    case "$opcao" in
      1) _brs_tool_branches_mergeadas ;;
      2) _brs_tool_sem_upstream ;;
      3) _brs_tool_tags_orfas ;;
      4) _brs_tool_conflitos ;;
      5) _brs_tool_validar_config ;;
      6) _brs_tool_gitignore ;;
      7) _brs_tool_config_atual ;;
      0) return ;;
      *) echo "Opção inválida." ;;
    esac
    echo ""
  done
}
