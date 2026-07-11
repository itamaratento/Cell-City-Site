#!/bin/bash
# Cell City Control Center — módulo Release, camada "Release" (Fase 2).
#
# Regra de ouro desta Sprint (confirmada com o dono antes de implementar):
# ENVELOPAR o pipeline já existente, nunca reimplementar. `subir`/`subir-ok`
# são funções de ~/.bashrc (fora do repositório, sem script próprio) — só
# dá pra reutilizá-las de verdade rodando um bash interativo que carregue o
# ~/.bashrc do usuário; por isso o `bash -i -c`. `release`/`rollback` têm
# script próprio no repositório e são chamados direto.
#
# Nenhuma lógica de tag/push/promoção/rollback é reimplementada aqui — só
# validações de leitura (branch/workspace) e geração de changelog, que não
# existiam antes em lugar nenhum.
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_rel_validar_branch() {
  local branch
  branch="$(_cc_git_branch)"
  echo "🌿 Validar Branch"
  echo "──────────────────"
  echo "Branch atual: $branch"
  if _cc_svc_git_branch_reconhecida; then
    _cc_ok "Branch reconhecida para release (develop/main)."
  else
    _cc_warn "Branch fora do padrão — 'subir'/'subir-ok' pedem confirmação extra fora de 'develop'."
  fi
}

_rel_validar_workspace() {
  echo "🧹 Validar Workspace Limpo"
  echo "───────────────────────────"
  if _cc_svc_git_workspace_limpo; then
    _cc_ok "Working tree limpo."
  else
    local total
    total="$(_cc_svc_git_arquivos_alterados_count)"
    _cc_warn "Working tree com $total arquivo(s) alterado(s):"
    git -C "$REPO_DIR" status --porcelain
  fi
}

# Changelog simples: commits desde a última tag semver até HEAD. Só leitura
# — nunca escreve arquivo sozinho (evita efeito colateral não pedido).
_rel_gerar_changelog() {
  echo "📝 Gerar Changelog"
  echo "───────────────────"
  local ultima_tag
  ultima_tag="$(git -C "$REPO_DIR" tag -l 'v*' --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)"
  if [ -z "$ultima_tag" ]; then
    echo "Nenhuma tag semver encontrada — listando todos os commits:"
    git -C "$REPO_DIR" log --oneline
    return
  fi
  echo "Desde $ultima_tag até HEAD:"
  echo ""
  git -C "$REPO_DIR" log --oneline "$ultima_tag"..HEAD
  local total
  total="$(git -C "$REPO_DIR" rev-list --count "$ultima_tag"..HEAD)"
  echo ""
  echo "$total commit(s) desde $ultima_tag."
}

_rel_historico() {
  echo "📚 Histórico de Releases"
  echo "─────────────────────────"
  local tags
  tags="$(git -C "$REPO_DIR" tag -l 'v*' --sort=-v:refname | head -10)"
  if [ -z "$tags" ]; then
    echo "Nenhuma release (tag vX.Y.Z) encontrada ainda."
    return
  fi
  echo "Últimas 10 versões:"
  echo ""
  local tag data commit
  while IFS= read -r tag; do
    data="$(git -C "$REPO_DIR" log -1 --format=%ai "$tag" 2>/dev/null | cut -d' ' -f1)"
    commit="$(git -C "$REPO_DIR" rev-list -n1 "$tag" | cut -c1-8)"
    printf '  %-16s %-12s %s\n' "$tag" "${data:-?}" "$commit"
  done <<< "$tags"
  echo ""
  echo "Histórico completo e mais detalhado: comando 'release' (opção 5)."
}

# Delegações — cada uma é uma chamada direta ao mecanismo já existente,
# sem reimplementar nada. Todas pedem confirmação explícita aqui (camada
# do Control Center) ANTES de entrar no fluxo, que por sua vez tem seus
# próprios prompts internos (dupla confiança deliberada — ver README.md,
# "Segurança").
_rel_executar_testes() {
  echo "🧪 Executar Testes (Release Completa via scripts/release/release-center.sh)"
  echo "────────────────────────────────────────────────────────────────────────"
  printf '2\n0\n' | bash "$REPO_DIR/scripts/release/release-center.sh"
}

_rel_build_final() {
  echo "🏗️  Build Final (validação do artefato de deploy)"
  echo "───────────────────────────────────────────────────"
  echo "Este projeto não tem build step — a validação real é o rsync"
  echo "simulado do deploy (scripts/release/validar-deploy.sh)."
  echo ""
  bash "$REPO_DIR/scripts/release/validar-deploy.sh"
}

_rel_checklist() {
  echo "✅ Checklist de Release (Certificação de Produção via release-center.sh)"
  echo "──────────────────────────────────────────────────────────────────────"
  printf '3\n0\n' | bash "$REPO_DIR/scripts/release/release-center.sh"
}

_rel_subir() {
  echo "📤 Enviar Alterações para Develop (subir)"
  echo "───────────────────────────────────────────"
  if ! _cc_confirm "Isto vai commitar e dar push em '$(_cc_git_branch)'. Continuar?"; then
    echo "Cancelado."
    return
  fi
  bash -i -c '
    cd "'"$REPO_DIR"'" || exit 1
    if type subir >/dev/null 2>&1; then subir; else
      echo "❌ Função subir() não encontrada em ~/.bashrc deste usuário."
      exit 1
    fi
  '
}

_rel_criar_tag_e_publicar() {
  echo "🏷️  Criar Tag e Publicar (subir-ok)"
  echo "─────────────────────────────────────"
  echo "Isto executa o fluxo oficial de promoção develop → main: exige"
  echo "homologação válida (Release Completa/Certificação), cria backup,"
  echo "pede a versão semântica e faz fast-forward pra main."
  if ! _cc_confirm "Continuar para o fluxo de publicação (subir-ok)?"; then
    echo "Cancelado."
    return
  fi
  bash -i -c '
    cd "'"$REPO_DIR"'" || exit 1
    if type subir-ok >/dev/null 2>&1; then subir-ok; else
      echo "❌ Função subir-ok() não encontrada em ~/.bashrc deste usuário."
      exit 1
    fi
  '
}

_rel_rollback() {
  echo "⏪ Rollback de Produção"
  echo "────────────────────────"
  if ! _cc_confirm "Isto restaura 'main' pra uma versão anterior (novo commit, sem force-push). Continuar?"; then
    echo "Cancelado."
    return
  fi
  bash "$REPO_DIR/scripts/release/rollback.sh"
}
