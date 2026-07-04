# Configuração compartilhada do Sistema Oficial de Backup — Cell City
# Usado por backup-manual.sh, backup-automatic.sh e restore-backup.sh.
# Não altera main/develop; define apenas para onde e como o backup é enviado.

BACKUP_REPO_HTTPS="https://github.com/itamaratento/Cell-City-Backup.git"
BACKUP_REPO_SSH="git@github.com:itamaratento/Cell-City-Backup.git"

# Branches espelhadas integralmente no repositório de backup a cada execução.
PROTECTED_BRANCHES=(main develop)

# Slots de rotação do backup automático semanal (Semana1->A, Semana2->B, Semana3->C, Semana4->substitui A, ...).
BACKUP_SLOTS=(auto-slot-A auto-slot-B auto-slot-C)
