#!/bin/bash
# Cell City Control Center — módulo Backup e Recuperação, camada "Backup"
# (Fase 3). Toda função aqui ENVELOPA um script já existente e homologado
# no projeto — nenhuma lógica de backup é reimplementada (ver README.md,
# "Regra de ouro" — mesmo princípio já aplicado ao módulo Release na
# Fase 2).
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

_carregar_node_bkp() {
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm use --lts >/dev/null 2>&1
}

# Backup Manual — envelopa scripts/backup/backup-manual.sh (commit +
# sincronização com o repositório de backup Cell-City-Backup, tag
# "manual-<timestamp>"). O próprio script já imprime data/hora, branch,
# commit, autor e status de sincronização — não duplicado aqui.
#
# Achado real desta Sprint: se o working tree tiver alterações pendentes
# (`git status --porcelain` não vazio — inclusive de OUTRA sessão rodando
# no mesmo checkout), backup-manual.sh faz `git add .` + commit + push
# delas TODAS, sem distinguir de quem são. Por isso, com alterações
# pendentes, este wrapper avisa explicitamente e pede confirmação — sem
# isso, "Backup Manual" poderia commitar/publicar trabalho alheio em
# andamento sem intenção.
_bkp_manual() {
  echo "🗄️  Backup Manual"
  echo "──────────────────"
  echo "Local do backup: repositório Cell-City-Backup (tag manual-<timestamp>)."
  if [ -n "$(git -C "$REPO_DIR" status --porcelain 2>/dev/null)" ]; then
    echo ""
    _cc_warn "Há alterações pendentes no working tree (possivelmente de outra sessão)."
    echo "backup-manual.sh vai commitar e enviar TODAS elas, sem distinguir origem."
    if ! _cc_confirm "Continuar mesmo assim?"; then
      echo "Cancelado."
      return
    fi
  fi
  echo ""
  bash "$REPO_DIR/scripts/backup/backup-manual.sh"
}

# Backup Automático — envelopa scripts/backup/backup-automatic.sh. Normalmente
# roda só via GitHub Actions semanal (.github/workflows/backup-weekly.yml);
# rodar aqui manualmente SOBRESCREVE (force-push) o slot de rotação da
# semana atual — por isso pede confirmação (ver README.md, "Segurança").
_bkp_automatico() {
  echo "🔁 Backup Automático (rotação semanal — auto-slot-A/B/C)"
  echo "──────────────────────────────────────────────────────────"
  echo "Isto força a rotação do slot semanal (mesmo mecanismo do"
  echo "GitHub Actions, .github/workflows/backup-weekly.yml), sobrescrevendo"
  echo "(force-push) a tag do slot que for usado."
  if ! _cc_confirm "Continuar?"; then
    echo "Cancelado."
    return
  fi
  bash "$REPO_DIR/scripts/backup/backup-automatic.sh"
}

# Backup do Firebase — envelopa backup-dados.js (export Firestore → JSON).
# Ambiente sempre explícito (nunca auto-detectado), mesmo princípio já
# adotado pelo próprio script ("operação consciente").
_bkp_firebase() {
  echo "🔥 Backup do Firebase (Firestore → JSON)"
  echo "──────────────────────────────────────────"
  echo "⚠️  Cobertura parcial: exporta só as 21 coleções de negócio já"
  echo "   cadastradas no script — usuarios/perfis_operacionais/auditoria"
  echo "   (RBAC) não têm backup automático (ver GUIA_ROLLBACK.md §6)."
  echo ""
  echo "Ambiente:"
  echo "  1) dev  (cellcity-crm-dev)"
  echo "  2) prod (cellcity-crm)"
  read -rp "Escolha (1/2, qualquer outra tecla cancela): " amb
  case "$amb" in
    1)
      _carregar_node_bkp
      (cd "$REPO_DIR" && node backup-dados.js --dev)
      ;;
    2)
      if _cc_confirm "Isto exporta dados REAIS de produção para um arquivo JSON local. Continuar?"; then
        _carregar_node_bkp
        (cd "$REPO_DIR" && node backup-dados.js --prod)
      else
        echo "Cancelado."
      fi
      ;;
    *) echo "Cancelado." ;;
  esac
}

# Backup do Projeto — envelopa backup.sh (raiz do repo): rsync rotativo
# (2 slots por tipo), já exclui .git/node_modules/*.log. Este projeto não
# tem pastas .cache/.tmp hoje — nada a excluir além do que o script já
# exclui. SOBRESCREVE (rm -rf + rsync) o slot mais antigo do tipo
# escolhido — pede confirmação.
_bkp_projeto() {
  echo "📦 Backup do Projeto (estrutura completa, exclui .git/node_modules/*.log)"
  echo "───────────────────────────────────────────────────────────────────────"
  echo "Tipo (rotação de 2 slots cada — sobrescreve o slot mais antigo do tipo):"
  echo "  1) Diário (padrão)   2) Semanal   3) Mensal   4) Grande mudança"
  read -rp "Escolha (Enter = Diário): " tipo
  local tipo_nome
  case "$tipo" in
    2) tipo_nome="semanal" ;;
    3) tipo_nome="mensal" ;;
    4) tipo_nome="grande" ;;
    *) tipo_nome="diario" ;;
  esac
  if ! _cc_confirm "Isto sobrescreve o slot de rotação mais antigo do tipo '$tipo_nome'. Continuar?"; then
    echo "Cancelado."
    return
  fi
  bash "$REPO_DIR/backup.sh" "$tipo_nome"
}

# Backup das Configurações — não existia antes (escopo estreito o
# suficiente pra não ser "um novo sistema de backup"): copia só os
# arquivos críticos de configuração pra uma pasta com timestamp, sem
# sobrescrever nada (cada execução cria uma pasta nova).
_bkp_configuracoes() {
  echo "⚙️  Backup das Configurações"
  echo "─────────────────────────────"
  local destino="$REPO_DIR/_BACKUPS/configuracoes-$(date +%Y-%m-%d_%H-%M-%S)"
  local arquivos=(
    ".firebaserc" "firebase.json" "firestore.rules" "firestore.indexes.json"
    "package.json" "CLAUDE.md" "ENGINEERING.md"
  )
  local pastas=("scripts/control-center/config" ".github/workflows")

  mkdir -p "$destino"
  local copiados=0
  local item
  for item in "${arquivos[@]}"; do
    if [ -f "$REPO_DIR/$item" ]; then
      cp "$REPO_DIR/$item" "$destino/" && copiados=$((copiados + 1))
    fi
  done
  for item in "${pastas[@]}"; do
    if [ -d "$REPO_DIR/$item" ]; then
      mkdir -p "$destino/$(dirname "$item")"
      cp -r "$REPO_DIR/$item" "$destino/$item" && copiados=$((copiados + 1))
    fi
  done

  local tamanho
  tamanho="$(du -sh "$destino" 2>/dev/null | cut -f1)"
  echo "Itens copiados: $copiados"
  echo "Destino:        $destino"
  echo "Tamanho:        ${tamanho:-?}"
  _cc_ok "Backup das configurações concluído."
}
