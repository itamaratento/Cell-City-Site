# ⏪ GUIA DE ROLLBACK — Cell City CRM

> **Criado em:** 2026-07-02
> **Quando usar:** qualquer regressão, erro em produção ou entrega reprovada em homologação.
> **Princípio do projeto:** *nunca "corrigir em produção"* — regrediu, reverte para o último estado estável e investiga com calma.
> Documentos relacionados: [`GUIA_OPERACAO_AMBIENTES.md`](GUIA_OPERACAO_AMBIENTES.md) · [`GUIA_MANUTENCAO.md`](GUIA_MANUTENCAO.md) · [`CLAUDE.md`](CLAUDE.md)

---

## 1. Decisão rápida — que tipo de rollback?

| O que quebrou | Procedimento | Seção |
|---|---|---|
| Uma entrega recém-publicada (código) | `git revert` do(s) commit(s) + push | §2 |
| Um único módulo, alteração local ainda não commitada/publicada | Restaurar do backup local `BACKUP_*` do módulo | §3 |
| Estado geral do sistema (várias frentes, causa não isolada) | Voltar a uma **tag** ou snapshot de `_BACKUPS/` — com muito cuidado | §4 |
| Firestore Rules | Republicar o backup das rules + verificação via API | §5 |
| Dados do Firestore (documentos apagados/corrompidos) | Restauração manual a partir do JSON diário | §6 |

Em **todos** os casos, terminar com o checklist pós-rollback (§7).

---

## 2. Rollback de código publicado (preferencial: `git revert`)

A publicação é 100% git → GitHub Pages, então reverter código é reverter commits:

```bash
# 1. Identificar o(s) commit(s) da entrega
git log --oneline -10

# 2. Reverter (NÃO usar reset --hard em branch publicado)
git revert <hash>            # um commit
git revert <hash1>..<hash2>  # intervalo

# 3. Publicar a reversão
git push origin develop      # ou main, conforme o ambiente afetado
```

Por que `revert` e não `reset`: o revert preserva o histórico (regra do projeto: nunca apagar o que já foi decidido) e não exige force-push no branch publicado.

Depois do push:

1. Aguardar o workflow do Pages concluir (ver [`GUIA_OPERACAO_AMBIENTES.md`](GUIA_OPERACAO_AMBIENTES.md) §3).
2. **Bump do Service Worker se a entrega revertida tinha feito bump** (ou se arquivos cacheados mudaram): incrementar `CACHE` em [`CRM/sw.js`](CRM/sw.js) num commit próprio — senão usuários podem continuar servidos pelo código com defeito do cache.
3. Validar com hard-reload/aba anônima.

### Tags de marco (pontos seguros de retorno)

Entregas aprovadas ganham tag git (ex.: `sprint2-rbac-crm-agenda-aprovado`). Para comparar ou restaurar arquivos pontuais de um marco:

```bash
git tag -l                                  # listar marcos
git diff <tag> -- CRM/pages/<modulo>/       # o que mudou desde o marco
git checkout <tag> -- <caminho/arquivo>     # restaura arquivo específico do marco
```

Recomendação permanente: **criar tag antes de qualquer entrega de risco** (ex.: o plano de separação de ambientes prevê a tag `pre-separacao-ambientes` nos dois branches antes de publicar).

---

## 3. Rollback de um módulo isolado (backups locais)

Regra permanente do projeto: todo arquivo crítico alterado tem backup criado **antes** da mudança, na própria pasta do módulo — padrões de nome:

- `CRM/pages/<modulo>/BACKUP_<DESCRICAO>_<DATA>/` (pasta com cópia dos arquivos)
- `<arquivo>.BACKUP_<DATA>.js` ou `<arquivo>.js.backup-antes-<descricao>` (cópia lado a lado)

Procedimento:

```bash
# 1. Conferir o que existe
ls CRM/pages/<modulo>/ | grep -i backup

# 2. Restaurar por cópia (nunca mover/renomear o backup)
cp CRM/pages/<modulo>/BACKUP_X_2026-07-01/<arquivo>.js CRM/pages/<modulo>/<arquivo>.js

# 3. Se já estava publicado: commit + push da restauração (como no §2)
```

> Os backups locais são **cópias congeladas** — restaurá-los desfaz também qualquer correção posterior ao backup. Confira com `git log --oneline -- CRM/pages/<modulo>/` o que mais mudou no módulo desde a data do backup.

---

## 4. Rollback de estado geral (tags e `_BACKUPS/`) — usar com muito cuidado

Para regressões amplas sem causa isolada, existem snapshots completos:

- **Tags git** (preferível — ver §2).
- **`_BACKUPS/`** no repositório: snapshots numerados (`01-DIARIO` … `15-BASE-GITHUB-ESTAVEL-20260630`, etc.).
- **ZIPs semanais** em `~/Músicas/backups/` (rotina `cc-backup-codigo`, domingos 22:00) e `~/Backups/CellCity/` (script manual `backup.sh`).

### ⚠️ Lições de incidentes reais — leia antes de restaurar um snapshot

1. **Incidente 2026-06-27:** um rollback amplo **apagou toda a infraestrutura multiempresa** e o `TECHDOC.md` original; foi preciso restaurar do backup `10-BEFORE-ROLLBACK-20260627` e re-homologar 10 módulos. Moral: rollback de estado geral é a **última opção** — antes dele, tente reverter só os commits/módulos suspeitos.
2. **Incidente 2026-06-30:** cópias de snapshot que continham pastas `.git` aninhadas criaram **gitlinks órfãos** em `_BACKUPS/`, quebrando o checkout do GitHub Pages (site fora do ar). Moral: ao copiar um snapshot para dentro do repo, **excluir qualquer `.git` interno** (`rsync -a --exclude='.git'`) e conferir `git status` antes do push.

### Procedimento seguro

1. Criar um backup do estado ATUAL antes de restaurar qualquer coisa (nunca sobrescrever sem ponto de retorno): nova pasta em `_BACKUPS/` ou tag `pre-rollback-<data>`.
2. Restaurar **por cópia seletiva** a partir do snapshot (só as pastas afetadas), não por substituição total do working tree.
3. `git status` + `git diff --stat` para revisar exatamente o que a restauração mudou.
4. Commit descritivo (`Rollback: restaura X a partir de <snapshot> — motivo`) + push.
5. Checklist pós-rollback (§7) completo — um rollback amplo exige a bateria inteira de testes.

---

## 5. Rollback de Firestore Rules

Backups de rules ficam versionados na raiz/CRM (ex.: `firestore.rules.backup`, `firestore.rules.backup_saas_2026-06-24`) e no histórico git da fonte oficial `CRM/firestore.rules`.

```bash
# 1. Recuperar a versão boa (preferir o histórico git da fonte oficial)
git log --oneline -- CRM/firestore.rules
git checkout <hash-bom> -- CRM/firestore.rules

# 2. Redeploy
firebase deploy --only firestore:rules
```

3. **Verificação obrigatória via API** (`firebaserules.googleapis.com`) — o Console já confirmou "Publicar" sem efetivar o release (incidente 2026-07-01). Comandos prontos no [`GUIA_OPERACAO_AMBIENTES.md`](GUIA_OPERACAO_AMBIENTES.md) §5.2.
4. Testar leitura/escrita autenticada nos módulos afetados (uma regra errada derruba módulos inteiros silenciosamente).
5. Commit + push do arquivo restaurado (rules deployadas devem sempre corresponder ao que está versionado).

---

## 6. Restauração de dados do Firestore

**Não existe rollback automático de dados.** O que existe:

- **Export diário em JSON**: `~/Músicas/backups/dados/CellCity-dados-<data>.json` (rotina `cc-backup-dados`, 23:00; gerado por [`backup-dados.js`](backup-dados.js)).
- ⚠️ **Cobertura parcial**: a lista de coleções do script é fixa (21 coleções de negócio) e **não inclui** `usuarios`, `perfis_operacionais`, `auditoria_usuarios_permissoes` e outras coleções do RBAC/multiempresa. Dados dessas coleções hoje **não têm backup automático**.

Procedimento (manual, caso a caso):

1. Localizar o JSON da última data íntegra e extrair os documentos afetados.
2. Reimportar **apenas os documentos afetados** via Admin SDK (`sa-key.json`, Node via nvm) — nunca sobrescrever coleções inteiras sem diff prévio.
3. Registrar no relatório da ocorrência: o que foi restaurado, de qual data, e o que ficou irrecuperável (ex.: alterações feitas entre o backup e o incidente).
4. Atenção à cota Spark: uma reimportação grande consome cota de gravações/leituras da produção.

> Prevenção vale mais que rollback aqui: testes que criam dados devem usar dados descartáveis identificáveis (padrão QA) — ver [`GUIA_OPERACAO_AMBIENTES.md`](GUIA_OPERACAO_AMBIENTES.md) §1 enquanto o backend for compartilhado.

---

## 7. Checklist pós-rollback (obrigatório)

Conforme regra permanente do projeto ([`CLAUDE.md`](CLAUDE.md) §5), nenhum rollback está concluído sem verificar:

- [ ] Login
- [ ] Dashboard
- [ ] CRM
- [ ] Ordem de Serviço
- [ ] Caixa
- [ ] Estoque
- [ ] Financeiro
- [ ] Portal do Cliente
- [ ] Console do navegador sem erros novos
- [ ] Se Rules foram tocadas: release ativo conferido via API
- [ ] Se arquivos cacheados mudaram: bump do `sw.js` publicado e hard-reload validado

E documentar:

- [ ] Relatório da ocorrência no chat (o que quebrou, o que foi revertido, causa raiz se conhecida)
- [ ] [`PROXIMA_ETAPA.md`](PROXIMA_ETAPA.md) atualizado com o estado pós-rollback
- [ ] Registro em [`HISTORICO_PROJETO.md`](HISTORICO_PROJETO.md) (acumulativo — nunca apagar)
- [ ] [`CRM/TECHDOC.md`](CRM/TECHDOC.md) corrigido se a entrega revertida já tinha sido documentada
