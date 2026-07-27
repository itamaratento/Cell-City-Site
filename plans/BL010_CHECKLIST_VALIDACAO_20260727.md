# BL-010 — Validação documental: bypass deploy key (Cell-City-Backup)

**Data:** 2026-07-27  
**Status:** 📋 Checklist validado em documentação — **nenhuma ação executada no GitHub**  
**Origem:** D05 (Fase 4.1); BACKLOG BL-010; `plans/FILA_B_PREPARACAO_20260721.md` §15

---

## Contexto

O workflow `backup-weekly.yml` espelha o repositório para **Cell-City-Backup** via **deploy key** (`secrets.BACKUP_DEPLOY_KEY`).

A proteção de **tags** no repo de backup impede a deploy key de criar/espelhar tags. Workaround atual: slots de backup como **branches** (funcional). Backups semanais têm histórico recente **verde** — item **não-fatal**.

Plano free do GitHub: rulesets de tags **não** são alteráveis de forma confiável via API → ação é **UI manual** do admin.

---

## Checklist da Deploy Key (procedimento — não executar agora)

### Pré-requisitos
- [ ] Acesso admin ao repositório **Cell-City-Backup**
- [ ] Identificar a deploy key usada pelo secret `BACKUP_DEPLOY_KEY` (Settings → Deploy keys no backup repo, ou documentação interna da chave)
- [ ] Confirmar que `backup-weekly.yml` em `main` (cron só dispara na branch padrão) — ver comentário no workflow

### Bypass no ruleset de tags
1. [ ] GitHub → **Cell-City-Backup** → Settings → Rules → Rulesets (tags)
2. [ ] Abrir o ruleset que bloqueia criação de tags
3. [ ] Em bypass list: adicionar a **deploy key** (ou o actor correspondente)
4. [ ] Salvar

### Validação pós-ação (quando o dono executar)
5. [ ] Disparar `workflow_dispatch` do Backup Semanal **ou** aguardar domingo
6. [ ] Critério de aceite: backup espelha **tag** (ex. `v3.2.0`), não apenas branch de slot
7. [ ] Registrar evidência em `plans/` ou PROXIMA (commit docs)

---

## Documentação no monorepo (conferida)

| Artefato | Conteúdo |
|----------|----------|
| `plans/BACKLOG.md` BL-010 | Ação UI + aceite |
| `plans/FILA_B_PREPARACAO_20260721.md` §15 / Script Mestre | Passos e aceite |
| `.github/workflows/backup-weekly.yml` | Checkout develop, SSH deploy key, script backup |
| Escopo | **Fora** deste monorepo alterar o backup repo via código |

---

## Procedimento de backup (resumo)

1. Workflow agenda/domingo ou `workflow_dispatch`
2. Checkout `develop` (scripts de backup)
3. Configura SSH com `BACKUP_DEPLOY_KEY`
4. Executa script de backup (espelho para Cell-City-Backup)
5. Não altera `main`/`develop` do monorepo; não faz deploy de produto

---

## Procedimento de restauração (resumo documental)

Restauração **não** é automática neste item. Em incidente:

1. Identificar tag ou branch de slot no **Cell-City-Backup**
2. Clonar/fetch do backup
3. Comparar com monorepo (`git diff` / checkout pontual de arquivos)
4. Restaurar só o necessário com autorização; **nunca** force-push em `main` sem processo de Revisão Técnica

BL-010 **não** muda o procedimento de restauração — só melhora fidelidade do espelho de **tags**.

---

## Parecer

| Aspecto | Avaliação |
|---------|-----------|
| Severidade atual | Baixa (backups OK via branches) |
| Urgência | Baixa |
| Bloqueia Sprint 4? | Não |
| Ação nesta sessão | Nenhuma no GitHub |
| Próximo passo | Dono admin executa checklist UI (~minutos) |

**Validação documental:** ✅ checklist e docs consistentes.  
**Validação operacional:** ⏳ pendente ação humana no GitHub.
