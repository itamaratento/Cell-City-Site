#!/bin/bash
# Cell City Control Center — módulo Branches e Sincronização, camada
# "Tags" (Fase 5). Leitura pura — complementa o "Histórico de Releases" já
# existente em lib/release.sh (que só olha tags LOCAIS vN.N.N) comparando
# também com o remoto e identificando tags órfãs nos dois sentidos.
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_brs_tags_locais() {
  git -C "$REPO_DIR" tag -l 'v*' --sort=-v:refname
}

_brs_tags_remotas() {
  git -C "$REPO_DIR" ls-remote --tags origin 2>/dev/null \
    | awk '{print $2}' | sed 's#refs/tags/##' | grep -v '\^{}' | sort -ru
}

# Compara tags locais x remotas nos dois sentidos. Aceita as duas listas já
# calculadas como parâmetro (evita recalcular quando quem chama já tem
# ambas — ver _brs_tags) ou recalcula sozinha quando chamada isolada (ver
# Ferramentas Git › Localizar Tags Órfãs).
_brs_tags_orfas() {
  local locais="${1:-$(_brs_tags_locais)}" remotas="${2:-$(_brs_tags_remotas)}"
  local so_locais so_remotas
  so_locais="$(comm -23 <(sort <<< "$locais") <(sort <<< "$remotas") 2>/dev/null | grep -v '^$')"
  so_remotas="$(comm -13 <(sort <<< "$locais") <(sort <<< "$remotas") 2>/dev/null | grep -v '^$')"

  echo "Tags órfãs (só locais, ainda não publicadas):"
  if [ -z "$so_locais" ]; then echo "  (nenhuma)"; else echo "  ${so_locais//$'\n'/$'\n  '}"; fi
  echo ""
  echo "Tags órfãs (só remotas, ainda não baixadas localmente):"
  if [ -z "$so_remotas" ]; then echo "  (nenhuma)"; else echo "  ${so_remotas//$'\n'/$'\n  '}"; fi
}

_brs_tags() {
  echo "🏷️  Tags"
  echo "─────────"
  local locais remotas
  locais="$(_brs_tags_locais)"
  remotas="$(_brs_tags_remotas)"

  echo "Tags locais:"
  if [ -z "$locais" ]; then
    echo "  (nenhuma)"
  else
    local tag data commit
    while IFS= read -r tag; do
      data="$(git -C "$REPO_DIR" log -1 --format=%ai "$tag" 2>/dev/null | cut -d' ' -f1)"
      commit="$(git -C "$REPO_DIR" rev-list -n1 "$tag" | cut -c1-8)"
      printf '  %-16s %-12s %s\n' "$tag" "${data:-?}" "$commit"
    done <<< "$locais"
  fi

  echo ""
  echo "Tags remotas (origin):"
  if [ -z "$remotas" ]; then
    echo "  (nenhuma ou sem conexão)"
  else
    echo "  ${remotas//$'\n'/$'\n  '}"
  fi

  echo ""
  _brs_tags_orfas "$locais" "$remotas"
}
