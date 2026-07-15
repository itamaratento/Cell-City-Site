#!/usr/bin/env bash
###############################################################################
# CELL CITY
# SPRINT 0 - AUDITORIA TÉCNICA COMPLETA (READ-ONLY)
#
# NÃO ALTERA NADA
# NÃO FAZ COMMIT
# NÃO FAZ PUSH
# NÃO FAZ DEPLOY
# NÃO ALTERA FIREBASE
###############################################################################

set -euo pipefail

echo "============================================================"
echo "CELL CITY - SPRINT 0"
echo "AUDITORIA READ ONLY"
echo "============================================================"
echo

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT"

echo "Projeto:"
pwd
echo

###############################################################################
echo "FASE 1 - GIT"
###############################################################################

echo
echo "Branch:"
git branch --show-current || true

echo
echo "Status:"
git status --short --branch || true

echo
echo "Última Tag:"
git describe --tags --abbrev=0 2>/dev/null || echo "Sem tag"

echo
echo "Commits desde última tag:"
LASTTAG=$(git describe --tags --abbrev=0 2>/dev/null || true)

if [ -n "${LASTTAG:-}" ]; then
    git log "${LASTTAG}"..HEAD --oneline || true
else
    git log --oneline -20
fi

echo
echo "Histórico recente:"
git log --graph --decorate --oneline -20 || true

echo
echo "Diferenças develop x main:"
git diff --stat main..develop 2>/dev/null || echo "Branches não encontradas"

echo
echo "Workspace:"
git status

###############################################################################
echo
echo "FASE 2 - ESTRUTURA"
###############################################################################

dirs=(
CRM
functions
scripts
tests
docs
)

for d in "${dirs[@]}"; do
    echo
    echo "Diretório: $d"
    if [ -d "$d" ]; then
        echo "Arquivos:"
        find "$d" -type f -not -path "*/node_modules/*" | wc -l

        echo "Pastas:"
        find "$d" -type d -not -path "*/node_modules/*" | wc -l
    else
        echo "Não encontrado."
    fi
done

echo
echo "Módulos CRM:"
find CRM/pages -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l

echo
echo "Componentes:"
find CRM -iname "*component*" 2>/dev/null | wc -l

echo
echo "Páginas:"
find CRM/pages -name "*.html" 2>/dev/null | wc -l

echo
echo "Scripts JS:"
find . -name "*.js" -not -path "*/node_modules/*" -not -path "./_BACKUPS/*" -not -path "./.git/*" | wc -l

echo
echo "Scripts MJS:"
find . -name "*.mjs" -not -path "*/node_modules/*" -not -path "./_BACKUPS/*" -not -path "./.git/*" | wc -l

echo
echo "Cloud Functions:"
find functions -name "*.js" -not -path "*/node_modules/*" 2>/dev/null | wc -l

echo
echo "Documentação:"
find docs -type f 2>/dev/null | wc -l || true

###############################################################################
echo
echo "FASE 3 - SAAS"
###############################################################################

echo
echo "Tenant:"
grep -R "tenant" -n --exclude-dir=node_modules CRM functions scripts 2>/dev/null || true

echo
echo "RBAC:"
grep -R "rbac" -ni --exclude-dir=node_modules CRM functions scripts 2>/dev/null || true

echo
echo "empresa_id:"
grep -R "empresa_id" -n --exclude-dir=node_modules CRM functions scripts 2>/dev/null || true

echo
echo "Repositories:"
find . -iname "*repository*" -not -path "./node_modules/*" -not -path "*/node_modules/*" -not -path "./_BACKUPS/*" -not -path "./.git/*" 2>/dev/null

echo
echo "Providers:"
find . -iname "*provider*" -not -path "./node_modules/*" -not -path "*/node_modules/*" -not -path "./_BACKUPS/*" -not -path "./.git/*" 2>/dev/null

echo
echo "Services:"
find . -iname "*service*" -not -path "./node_modules/*" -not -path "*/node_modules/*" -not -path "./_BACKUPS/*" -not -path "./.git/*" 2>/dev/null

###############################################################################
echo
echo "FASE 4 - FIREBASE"
###############################################################################

for f in \
firebase.json \
firestore.rules \
firestore.indexes.json \
storage.rules \
functions/package.json
do
    echo
    echo "$f"

    if [ -f "$f" ]; then
        ls -lh "$f"
    else
        echo "Não encontrado"
    fi
done

###############################################################################
echo
echo "FASE 5 - SEGURANÇA"
###############################################################################

patterns=(
TODO
FIXME
console.log
debugger
AIza
PRIVATE_KEY
BEGIN\ PRIVATE\ KEY
serviceAccount
secret
password
token
)

for p in "${patterns[@]}"; do
    echo
    echo "===== $p ====="
    grep -RIn "$p" . \
        --exclude-dir=node_modules \
        --exclude-dir=.git \
        --exclude-dir=_BACKUPS \
        || true
done

###############################################################################
echo
echo "FASE 6 - QUALIDADE"
###############################################################################

echo
echo "20 maiores arquivos"

(find . -type f \
-not -path "./.git/*" \
-not -path "*/node_modules/*" \
-not -path "./_BACKUPS/*" \
-exec du -h {} + \
| sort -hr \
| head -20) || true

echo
echo "Arquivos >1000 linhas"

find . -type f \
-not -path "./.git/*" \
-not -path "*/node_modules/*" \
-not -path "./_BACKUPS/*" \
\( -name "*.js" \
-o -name "*.mjs" \
-o -name "*.html" \
-o -name "*.css" \) \
| while IFS= read -r f
do
    lines=$(wc -l < "$f")
    if [ "$lines" -gt 1000 ]; then
        echo "$lines $f"
    fi
done

###############################################################################
echo
echo "FASE 7 - TESTES"
###############################################################################

echo
echo "Suites:"
find tests -type f -not -path "*/node_modules/*" 2>/dev/null

echo
echo "Rules:"
find tests -iname "*rule*" -not -path "*/node_modules/*" 2>/dev/null

echo
echo "RBAC:"
find tests -iname "*rbac*" -not -path "*/node_modules/*" 2>/dev/null

echo
echo "Functions:"
find tests -iname "*function*" -not -path "*/node_modules/*" 2>/dev/null

echo
echo "Integrity:"
find tests -iname "*integrity*" -not -path "*/node_modules/*" 2>/dev/null

###############################################################################
echo
echo "FASE 8 - DOCUMENTAÇÃO"
###############################################################################

docs=(
README.md
ENGINEERING.md
MASTER_ROADMAP.md
PRODUCAO_READINESS.md
PS4_PS5_RELATORIO_FINAL.md
)

for d in "${docs[@]}"
do
    echo
    if [ -f "$d" ]; then
        echo "OK - $d"
    else
        echo "FALTANDO - $d"
    fi
done

###############################################################################
echo
echo "FASE 9 - PERFORMANCE"
###############################################################################

echo
echo "Consultas Firestore:"
grep -R "where(" --exclude-dir=node_modules CRM functions 2>/dev/null || true

echo
echo "orderBy:"
grep -R "orderBy(" --exclude-dir=node_modules CRM functions 2>/dev/null || true

echo
echo "limit:"
grep -R "limit(" --exclude-dir=node_modules CRM functions 2>/dev/null || true

echo
echo "getDocs:"
grep -R "getDocs(" --exclude-dir=node_modules CRM functions 2>/dev/null || true

###############################################################################
echo
echo "FASE 10 - ESTATÍSTICAS"
###############################################################################

EXCL=(-not -path "*/node_modules/*" -not -path "./_BACKUPS/*" -not -path "./.git/*")

echo
echo "JS:"
find . -name "*.js" "${EXCL[@]}" | wc -l

echo "MJS:"
find . -name "*.mjs" "${EXCL[@]}" | wc -l

echo "HTML:"
find . -name "*.html" "${EXCL[@]}" | wc -l

echo "CSS:"
find . -name "*.css" "${EXCL[@]}" | wc -l

echo "MD:"
find . -name "*.md" "${EXCL[@]}" | wc -l

echo
echo "Linhas totais de código:"
find . -type f \
"${EXCL[@]}" \
\( -name "*.js" -o -name "*.mjs" -o -name "*.html" -o -name "*.css" \) \
-print0 \
| xargs -0 cat \
| wc -l

echo
echo "============================================================"
echo "AUDITORIA FINALIZADA"
echo "Nenhum arquivo foi alterado."
echo "Nenhum commit foi realizado."
echo "Nenhum deploy foi realizado."
echo "============================================================"
