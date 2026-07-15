#!/bin/bash
# Cell City Control Center — módulo Desenvolvimento, camada "Comandos"
# (Fase 2). Build/Testes/Lint/Formatação/Cache/Dependências. Nada aqui é
# inventado: cada função reflete o que o projeto realmente tem hoje — se
# uma ferramenta não está configurada (Lint/Formatação, por exemplo),
# a função diz isso em vez de fingir que existe.
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_carregar_node_dev() {
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm use --lts >/dev/null 2>&1
}

# Este projeto não tem build step (site estático, sem bundler — ver
# CLAUDE.md/README raiz). O "artefato de build" real é o resultado do
# rsync do deploy, validado em scripts/release/validar-deploy.sh — mesmo
# script usado pelo módulo Release ("Build Final"), não duplicado aqui.
_dev_build() {
  echo "ℹ️  Este projeto não tem build step (sem bundler/transpilação)."
  echo "   O artefato publicado é o resultado direto do rsync do deploy."
  echo "   Para validar esse artefato, use Release › Build Final (mesmo"
  echo "   mecanismo, scripts/release/validar-deploy.sh)."
}

# Suíte rápida do dia a dia — RBAC + Integridade + Performance (Node puro,
# sem emulador, ~1 min). A suíte COMPLETA de release (que também roda
# Firestore Rules e Cloud Functions em emulador) é responsabilidade do
# módulo Release ("Executar Testes"), que já envelopa
# scripts/release/release-center.sh — não duplicado aqui.
_dev_testes() {
  echo "🧪 Testes rápidos (RBAC + Integridade + Performance + Control Center)"
  echo "────────────────────────────────────────────────────────────────────"
  _carregar_node_dev
  local falhas=0
  if (cd "$REPO_DIR/tests/rbac" && npm test) >/tmp/cellcity-dev-testes-rbac.log 2>&1; then
    _cc_ok "RBAC verde"
  else
    _cc_fail "RBAC falhou — ver /tmp/cellcity-dev-testes-rbac.log"
    falhas=$((falhas+1))
  fi
  if (cd "$REPO_DIR" && node --test tests/integrity/integridade.test.mjs) >/tmp/cellcity-dev-testes-integridade.log 2>&1; then
    _cc_ok "Integridade verde"
  else
    _cc_fail "Integridade falhou — ver /tmp/cellcity-dev-testes-integridade.log"
    falhas=$((falhas+1))
  fi
  if (cd "$REPO_DIR" && node --test tests/performance/polling-gating.test.mjs) >/tmp/cellcity-dev-testes-performance.log 2>&1; then
    _cc_ok "Performance verde"
  else
    _cc_fail "Performance falhou — ver /tmp/cellcity-dev-testes-performance.log"
    falhas=$((falhas+1))
  fi
  if (cd "$REPO_DIR" && node --test tests/control-center/estrutura.test.mjs) >/tmp/cellcity-dev-testes-cc.log 2>&1; then
    _cc_ok "Control Center verde"
  else
    _cc_fail "Control Center falhou — ver /tmp/cellcity-dev-testes-cc.log"
    falhas=$((falhas+1))
  fi
  echo ""
  if [ "$falhas" -eq 0 ]; then echo "✅ Testes rápidos: tudo verde."; else echo "❌ $falhas suíte(s) falharam."; fi
  echo "Para a suíte completa (Firestore Rules + Cloud Functions + auditoria de deploy), use Release › Executar Testes."
}

# Sem ESLint/Prettier configurado neste projeto — reportar honestamente
# em vez de fingir que um lint/format existe.
_dev_lint() {
  if [ -f "$REPO_DIR/.eslintrc.json" ] || [ -f "$REPO_DIR/.eslintrc.js" ] || [ -f "$REPO_DIR/eslint.config.js" ]; then
    echo "Configuração de ESLint encontrada, mas nenhum runner foi definido para chamar aqui ainda."
  else
    echo "ℹ️  Lint não configurado neste projeto (sem ESLint no repositório atual)."
  fi
}

_dev_formatacao() {
  if [ -f "$REPO_DIR/.prettierrc" ] || [ -f "$REPO_DIR/.prettierrc.json" ]; then
    echo "Configuração de Prettier encontrada, mas nenhum runner foi definido para chamar aqui ainda."
  else
    echo "ℹ️  Formatação automática não configurada neste projeto (sem Prettier no repositório atual)."
  fi
}

# Só limpa caches regeráveis e já conhecidos (cache do Firebase CLI e logs
# de debug soltos na raiz/tests) — nunca node_modules, nunca nada versionado.
_dev_limpeza_cache() {
  local alvos=("$REPO_DIR/.firebase" "$REPO_DIR/firestore-debug.log")
  local encontrados=()
  local alvo
  for alvo in "${alvos[@]}"; do
    [ -e "$alvo" ] && encontrados+=("$alvo")
  done
  mapfile -t debug_logs < <(find "$REPO_DIR/tests" -maxdepth 2 -name "firestore-debug.log" 2>/dev/null)
  encontrados+=("${debug_logs[@]}")

  if [ "${#encontrados[@]}" -eq 0 ]; then
    echo "Nada para limpar — nenhum cache/log de debug conhecido encontrado."
    return
  fi
  echo "Itens a remover:"
  printf '  - %s\n' "${encontrados[@]}"
  if _cc_confirm "Remover os itens acima?"; then
    for alvo in "${encontrados[@]}"; do
      [[ "$alvo" == "$REPO_DIR"* ]] && rm -rf "$alvo"
    done
    _cc_ok "Cache limpo (${#encontrados[@]} item(ns))."
  else
    echo "Cancelado."
  fi
}

# npm update só na raiz (não recursivo em functions/tests/*, pra manter o
# escopo mínimo) — atualiza dentro do que o package.json já permite
# (respeitando ^/~), nunca instala major novo sem pedir.
_dev_atualizar_dependencias() {
  echo "Isto roda 'npm update' na raiz do repositório (respeitando os"
  echo "intervalos de versão do package.json — não instala major novo)."
  if _cc_confirm "Continuar?"; then
    _carregar_node_dev
    (cd "$REPO_DIR" && npm update)
  else
    echo "Cancelado."
  fi
}
