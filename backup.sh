#!/bin/bash
# ============================================================
#  CELL CITY CRM — Sistema de Backup Rotativo
#  Uso: ./backup.sh [diario|semanal|mensal|grande]
#  Padrão: diario
# ============================================================

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$ROOT/_BACKUPS"
STATE_FILE="$BACKUP_DIR/.backup_state"
LOG_FILE="$BACKUP_DIR/backup_log.txt"

TYPE="${1:-diario}"

# Normaliza o tipo
case "$TYPE" in
  diario|d|1)     TYPE="DIARIO" ;;
  semanal|s|2)    TYPE="SEMANAL" ;;
  mensal|m|3)     TYPE="MENSAL" ;;
  grande|g|4)     TYPE="GRANDE_MUDANCA" ;;
  *)
    echo "Tipo inválido: '$1'"
    echo "Uso: ./backup.sh [diario|semanal|mensal|grande]"
    exit 1
    ;;
esac

# Determina os dois slots do tipo e lê qual foi usado por último
case "$TYPE" in
  DIARIO)         SLOT_A="01-DIARIO"        ; SLOT_B="02-DIARIO"        ;;
  SEMANAL)        SLOT_A="03-SEMANAL"       ; SLOT_B="04-SEMANAL"       ;;
  MENSAL)         SLOT_A="05-MENSAL"        ; SLOT_B="06-MENSAL"        ;;
  GRANDE_MUDANCA) SLOT_A="07-GRANDE-MUDANCA"; SLOT_B="08-GRANDE-MUDANCA";;
esac

# Lê o último slot usado para este tipo (rotação alternada)
LAST_SLOT=""
if [ -f "$STATE_FILE" ]; then
  LAST_SLOT=$(grep "^${TYPE}=" "$STATE_FILE" 2>/dev/null | cut -d'=' -f2)
fi

if [ "$LAST_SLOT" = "$SLOT_A" ]; then
  SLOT="$SLOT_B"
else
  SLOT="$SLOT_A"
fi

DEST="$BACKUP_DIR/$SLOT"

# Limpa o slot e copia o CRM completo
rm -rf "$DEST"
mkdir -p "$DEST"
rsync -a --exclude='_BACKUPS' --exclude='.git' --exclude='node_modules' \
         --exclude='*.log' \
         "$ROOT/" "$DEST/"

# Calcula tamanho
TAMANHO=$(du -sh "$DEST" | cut -f1)

# Atualiza o estado de rotação
if [ -f "$STATE_FILE" ]; then
  # Remove a linha antiga deste tipo e adiciona a nova
  grep -v "^${TYPE}=" "$STATE_FILE" > "$STATE_FILE.tmp" 2>/dev/null || true
  mv "$STATE_FILE.tmp" "$STATE_FILE"
fi
echo "${TYPE}=${SLOT}" >> "$STATE_FILE"

# Registra no log
DATA=$(date '+%d/%m/%Y %H:%M')
{
  echo "----------------------------------------"
  echo "$DATA"
  echo "$TYPE"
  echo "$SLOT"
  echo "$TAMANHO"
} >> "$LOG_FILE"

echo "✅ Backup $TYPE concluído → $SLOT ($TAMANHO)"
