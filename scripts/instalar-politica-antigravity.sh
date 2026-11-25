#!/usr/bin/env bash
# Instala/atualiza a política central Cell City como regra global do Antigravity.
# Fonte oficial: branch develop do repositório Cell-City-Site.
# Não sobrescreve AGENTS.md/GEMINI.md globais nem outras regras do usuário.
set -Eeuo pipefail
umask 077

REPO="itamaratento/Cell-City-Site"
BRANCH="develop"
SOURCE="https://raw.githubusercontent.com/${REPO}/${BRANCH}/docs/AGENT_POLICY.md"
RULES_DIR="${HOME}/.gemini/config/rules"
DEST="${RULES_DIR}/cellcity-agent-policy.md"

command -v curl >/dev/null 2>&1 || {
  echo "ERRO: curl não encontrado. Instale curl e execute novamente." >&2
  exit 2
}
mkdir -p "$RULES_DIR"
TMP="$(mktemp "${RULES_DIR}/.cellcity-agent-policy.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

curl --fail --location --silent --show-error "$SOURCE" -o "$TMP"

if ! grep -q '^# Política Central de Agentes — Cell City' "$TMP"; then
  echo "ERRO: o conteúdo recebido não parece ser a política oficial. Arquivo existente preservado." >&2
  exit 3
fi

{
  printf '%s\n' '---' 'trigger: always_on' 'description: "Política global Cell City: Antigravity coordena; DP/DeepSeek programa; autonomia, limites e relatórios."' '---' ''
  printf '%s\n' '> Fonte oficial: https://github.com/itamaratento/Cell-City-Site/blob/develop/docs/AGENT_POLICY.md'
  printf '%s\n' '> Atualizado por scripts/instalar-politica-antigravity.sh.'
  printf '\n'
  cat "$TMP"
} > "${TMP}.rule"

mv "${TMP}.rule" "$DEST"
rm -f "$TMP"
trap - EXIT

echo "Política Cell City instalada/atualizada:"
echo "$DEST"
echo "Fonte: $SOURCE"
echo "Escopo: global no Antigravity (regra always_on)."
echo "Nenhum outro arquivo global foi sobrescrito."
