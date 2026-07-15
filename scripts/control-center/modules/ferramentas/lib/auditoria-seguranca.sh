#!/bin/bash
# Cell City Control Center — módulo Ferramentas, Auditoria de Segurança.
# Verifica credenciais expostas, tokens, chaves, permissões inseguras,
# segredos em código e arquivos sensíveis.
set -uo pipefail

: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_PADROES_SEGREDOS=(
  "-----BEGIN RSA PRIVATE KEY-----"
  "-----BEGIN OPENSSH PRIVATE KEY-----"
  "-----BEGIN DSA PRIVATE KEY-----"
  "-----BEGIN EC PRIVATE KEY-----"
  "-----BEGIN PGP PRIVATE KEY BLOCK-----"
  "-----BEGIN CERTIFICATE-----"
  "AKIA[0-9A-Z]{16}"  # AWS AKID
  "sk_live_[0-9a-zA-Z]{24}"  # Stripe secret
  "sk-[0-9a-zA-Z]{24}"  # Stripe secret alt
  "ghp_[0-9a-zA-Z]{36}"  # GitHub PAT
  "gho_[0-9a-zA-Z]{36}"  # GitHub OAuth
  "xox[baprs]-[0-9a-zA-Z-]{10,}"  # Slack token
  "AIza[0-9A-Za-z_-]{35}"  # Firebase API key
)

_ARQUIVOS_SENSIVEIS=(
  "sa-key.json" "sa-key-dev.json" "service-account.json"
  ".env" ".env.production" ".env.development" ".env.local"
  "credentials.json" "credentials-dev.json"
  ".netrc" "netrc"
  "*.pem" "*.key" "*.p12" "*.pfx"
)

_cc_ferr_auditoria_seguranca() {
  _cc_ferr_aud_arquivos_sensiveis
  _cc_ferr_aud_credenciais_expostas
  _cc_ferr_aud_tokens
  _cc_ferr_aud_chaves_privadas
  _cc_ferr_aud_permissoes_inseguras
  _cc_ferr_aud_segredos_codigo
  _cc_ferr_aud_gitignore
}

_cc_ferr_aud_arquivos_sensiveis() {
  local encontrados=0 lista=""
  for padrao in "${_ARQUIVOS_SENSIVEIS[@]}"; do
    while IFS= read -r -d '' f; do
      encontrados=$((encontrados + 1))
      lista="${lista}$(basename "$f") "
    done < <(find "$REPO_DIR" -maxdepth 3 -name "$padrao" -type f -not -path '*/node_modules/*' -print0 2>/dev/null)
  done
  if [ "$encontrados" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Arquivos Sensíveis" "Nenhum arquivo sensível encontrado"
  else
    _cc_ferr_adicionar "fail" "Arquivos Sensíveis" "${encontrados} arquivo(s) sensível(is): ${lista}" "Arquivos de credenciais no repositório" "Vazamento de credenciais em caso de exposição do repositório" "Adicione ao .gitignore e remova do versionamento"
  fi
}

_cc_ferr_aud_credenciais_expostas() {
  local expostas=0
  while IFS= read -r -d '' f; do
    if grep -qI 'password\s*=\|senha\s*=\|PASSWORD\|SECRET_KEY\|api_key\s*=' "$f" 2>/dev/null; then
      expostas=$((expostas + 1))
    fi
  done < <(find "$REPO_DIR" -maxdepth 2 \( -name '*.sh' -o -name '*.js' -o -name '*.json' -o -name '*.env*' \) -type f -print0 2>/dev/null)
  if [ "$expostas" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Credenciais Expostas" "Nenhuma credencial aparente em texto claro"
  else
    _cc_ferr_adicionar "fail" "Credenciais Expostas" "${expostas} arquivo(s) com possíveis credenciais" "Credenciais hardcoded no código" "Vazamento de senhas e chaves" "Remova credenciais do código e use variáveis de ambiente"
  fi
}

_cc_ferr_aud_tokens() {
  local encontrados=0
  local padrao
  for padrao in "${_PADROES_SEGREDOS[@]:2:5}"; do
    while IFS= read -r -d '' f; do
      if grep -qP "$padrao" "$f" 2>/dev/null; then
        encontrados=$((encontrados + 1))
        break
      fi
    done < <(find "$REPO_DIR" -maxdepth 3 -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/_BACKUPS/*' -print0 2>/dev/null)
  done
  if [ "$encontrados" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Tokens" "Nenhum token conhecido encontrado"
  else
    _cc_ferr_adicionar "fail" "Tokens" "${encontrados} arquivo(s) com possíveis tokens" "Tokens de API expostos no repositório" "Risco de acesso indevido a serviços" "Revogue e remova os tokens do histórico"
  fi
}

_cc_ferr_aud_chaves_privadas() {
  local encontradas=0
  for padrao in "${_PADROES_SEGREDOS[@]:0:5}"; do
    while IFS= read -r -d '' f; do
      if grep -q "$padrao" "$f" 2>/dev/null; then
        encontradas=$((encontradas + 1))
        _cc_ferr_adicionar "fail" "Chaves Privadas" "$(basename "$f") contém chave privada" "Chave privada versionada no repositório" "Comprometimento total da segurança" "Remova a chave e rotacione imediatamente"
      fi
    done < <(find "$REPO_DIR" -maxdepth 3 -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/_BACKUPS/*' -print0 2>/dev/null)
  done
  if [ "$encontradas" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Chaves Privadas" "Nenhuma chave privada encontrada"
  fi
}

_cc_ferr_aud_permissoes_inseguras() {
  local inseguras=0
  while IFS= read -r -d '' f; do
    local perm
    perm=$(stat -c "%a" "$f" 2>/dev/null)
    if [ -n "$perm" ] && [ "${perm: -3}" = "777" ] || [ "${perm: -3}" = "755" ] && [ "${perm:0:1}" = "7" ]; then
      [ "$(basename "$f")" = "menu.sh" ] && continue
      inseguras=$((inseguras + 1))
    fi
  done < <(find "$REPO_DIR/scripts" -name '*.sh' -type f -print0 2>/dev/null)
  if [ "$inseguras" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Permissões Inseguras" "Permissões adequadas nos scripts"
  else
    _cc_ferr_adicionar "warn" "Permissões Inseguras" "${inseguras} script(s) com permissão 777" "Permissões excessivamente permissivas" "Risco de alteração acidental" "Corrija com: chmod 755 scripts/**/*.sh"
  fi
}

_cc_ferr_aud_segredos_codigo() {
  local segredos=0
  while IFS= read -r -d '' f; do
    if grep -qPI '(password|secret|token|api.?key|credential)\s*[:=]\s*["'"'"']' "$f" 2>/dev/null; then
      segredos=$((segredos + 1))
    fi
  done < <(find "$REPO_DIR" -maxdepth 2 \( -name '*.js' -o -name '*.py' -o -name '*.sh' -o -name '*.json' \) -type f -print0 2>/dev/null)
  if [ "$segredos" -eq 0 ]; then
    _cc_ferr_adicionar "ok" "Segredos em Código" "Nenhum segredo aparente em código"
  else
    _cc_ferr_adicionar "fail" "Segredos em Código" "${segredos} arquivo(s) com possíveis segredos" "Segredos hardcoded em arquivos de código" "Vazamento em caso de compartilhamento do código" "Use variáveis de ambiente ou gerenciador de segredos"
  fi
}

_cc_ferr_aud_gitignore() {
  if [ ! -f "$REPO_DIR/.gitignore" ]; then
    _cc_ferr_adicionar "fail" "Arquivos Ignorados" ".gitignore não encontrado" "Sem arquivo de exclusão" "Arquivos sensíveis podem ser versionados" "Crie um .gitignore adequado"
    return
  fi
  local protege_sa=0 protege_env=0 protege_node=0
  grep -q 'sa-key' "$REPO_DIR/.gitignore" 2>/dev/null && protege_sa=1
  grep -q '\.env' "$REPO_DIR/.gitignore" 2>/dev/null && protege_env=1
  grep -q 'node_modules' "$REPO_DIR/.gitignore" 2>/dev/null && protege_node=1
  local ausentes=""
  [ "$protege_sa" -eq 0 ] && ausentes="${ausentes}sa-key* "
  [ "$protege_env" -eq 0 ] && ausentes="${ausentes}.env* "
  [ "$protege_node" -eq 0 ] && ausentes="${ausentes}node_modules "
  if [ -z "$ausentes" ]; then
    _cc_ferr_adicionar "ok" "Arquivos Ignorados" ".gitignore presente e cobre itens críticos"
  else
    _cc_ferr_adicionar "warn" "Arquivos Ignorados" ".gitignore não cobre: ${ausentes}" "Arquivos importantes sem proteção no .gitignore" "Risco de versionamento acidental" "Adicione os padrões ausentes ao .gitignore"
  fi
}
