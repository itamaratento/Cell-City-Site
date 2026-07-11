#!/bin/bash
# Cell City Control Center — módulo Backup e Recuperação, camada
# "Listagem" (Fase 3).
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

# Listar Backups — reaproveita a MESMA listagem de
# scripts/backup/restore-backup.sh (nome/data/hora/branch/commit/descrição
# de cada tag manual-*/auto-slot-*), só que respondendo "0" (cancelar) na
# hora de escolher — mostra a lista e sai sem restaurar nada. Zero
# duplicação: nenhuma lógica de listagem foi reescrita aqui.
_bkp_listar() {
  echo "📋 Listar Backups"
  echo "──────────────────"
  printf '0\n' | bash "$REPO_DIR/scripts/backup/restore-backup.sh"
}

# Informações dos Backups — agregados que não existiam antes. Backups em
# Git (manual-*/auto-slot-*) não têm um "tamanho" comparável a um arquivo
# — reportado honestamente como não aplicável; o "espaço utilizado"
# mensurável de verdade é o dos backups locais do projeto (_BACKUPS/,
# criados por "Backup do Projeto").
_bkp_informacoes() {
  echo "ℹ️  Informações dos Backups"
  echo "────────────────────────────"
  # shellcheck source=/dev/null
  if ! source "$REPO_DIR/scripts/backup/config.sh" 2>/dev/null; then
    _cc_fail "Não foi possível carregar scripts/backup/config.sh"
    return
  fi

  local tags
  tags="$(git ls-remote --tags "$BACKUP_REPO_HTTPS" 2>/dev/null | awk '{print $2}' | sed 's#refs/tags/##' | grep -E '^(auto-slot-|manual-)' | grep -v '\^{}$')"
  if [ -z "$tags" ]; then
    echo "Nenhum backup (Git) encontrado em $BACKUP_REPO_HTTPS."
  else
    local total manuais automaticos mais_recente mais_antigo
    total=$(echo "$tags" | grep -c .)
    manuais=$(echo "$tags" | grep -c '^manual-' || true)
    automaticos=$(echo "$tags" | grep -c '^auto-slot-' || true)
    mais_recente=$(echo "$tags" | grep '^manual-' | sort | tail -1)
    mais_antigo=$(echo "$tags" | grep '^manual-' | sort | head -1)

    echo "Backups em Git (repositório de backup):"
    echo "  Total:              $total ($manuais manual(is), $automaticos automático(s)/slot)"
    echo "  Backup manual mais recente: ${mais_recente:-nenhum}"
    echo "  Backup manual mais antigo:  ${mais_antigo:-nenhum}"
    echo "  Espaço utilizado / maior backup: não aplicável — backups em Git são"
    echo "  commits/tags, não arquivos com tamanho individual comparável."
  fi

  echo ""
  echo "Backups locais do projeto (_BACKUPS/, criados por 'Backup do Projeto'):"
  if [ -d "$REPO_DIR/_BACKUPS" ]; then
    local qtd espaco maior
    qtd=$(find "$REPO_DIR/_BACKUPS" -maxdepth 1 -mindepth 1 -type d | wc -l)
    espaco=$(du -sh "$REPO_DIR/_BACKUPS" 2>/dev/null | cut -f1)
    maior=$(du -sh "$REPO_DIR"/_BACKUPS/*/ 2>/dev/null | sort -rh | head -1)
    echo "  Quantidade de slots: $qtd"
    echo "  Espaço utilizado:    ${espaco:-?}"
    echo "  Maior slot:          ${maior:-?}"
  else
    echo "  Nenhum backup de projeto rodado ainda nesta máquina."
  fi
}
