#!/bin/bash
# Cell City Control Center — módulo Desenvolvimento, camada "Utilitários"
# (Fase 2): abrir diretório do projeto e informações do ambiente.
: "${CC_ROOT:?CC_ROOT precisa estar definido}"
: "${REPO_DIR:?REPO_DIR precisa estar definido}"

# Um processo filho (este script) nunca consegue mudar o diretório do
# shell interativo que chamou `cellcity` — só imprime o caminho (e copia
# pra área de transferência se houver um utilitário disponível), nunca
# finge que "abriu" algo que não pode.
_dev_abrir_diretorio() {
  echo "📁 Diretório do projeto:"
  echo "   $REPO_DIR"
  echo ""
  echo "   Este terminal não muda de diretório sozinho — copie o caminho"
  echo "   acima ou rode: cd \"$REPO_DIR\""
  if command -v xclip >/dev/null 2>&1; then
    printf '%s' "$REPO_DIR" | xclip -selection clipboard 2>/dev/null && echo "   (copiado pra área de transferência via xclip)"
  elif command -v wl-copy >/dev/null 2>&1; then
    printf '%s' "$REPO_DIR" | wl-copy 2>/dev/null && echo "   (copiado pra área de transferência via wl-copy)"
  fi
}

_dev_info_ambiente() {
  echo "🖥️  Informações do Ambiente"
  echo "───────────────────────────"
  echo "SO            : $(uname -sr)"
  echo "Usuário       : $(whoami)"
  echo "Node          : $(command -v node >/dev/null 2>&1 && node --version || echo 'não encontrado no PATH atual')"
  echo "npm           : $(command -v npm >/dev/null 2>&1 && npm --version || echo 'não encontrado no PATH atual')"
  echo "Git           : $(git --version 2>/dev/null | sed 's/git version //')"
  echo "Repositório   : $REPO_DIR"
  if [ -f "$REPO_DIR/.firebaserc" ]; then
    echo "Firebase prod : $(grep -oE '"default":\s*"[^"]+"' "$REPO_DIR/.firebaserc" | cut -d'"' -f4)"
    echo "Firebase dev  : $(grep -oE '"dev":\s*"[^"]+"' "$REPO_DIR/.firebaserc" | cut -d'"' -f4)"
  fi
}
