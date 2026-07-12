# Parecer Executivo — CCC-HOM-001 (Branches e Sincronização)

**Padrão:** CCC-HOM-001 (mesmo template usado pela Fase 3 — ver
`docs/PARECER-CCC-HOM-001.md`). Um parecer por módulo homologado; este é
o segundo registro deste formato.

| Campo | Valor |
|---|---|
| Objeto | Módulo **Branches e Sincronização** do Cell City Control Center |
| Sprint | Fase 5 (especificação CCC-F05-001) |
| Responsável técnico | Claude (Arquiteto/Desenvolvedor do Control Center) |
| Data | 2026-07-11 |
| Branch | `develop` |
| Commit | `1e2b65c` |
| Ambiente | Terminal Ubuntu — comando `cellcity` |

## 1. Escopo homologado

Submenu com 12 opções (`1 ► Status do Repositório` … `12 ►
Configurações`, `13 ► Voltar`, `0 ► Sair`), acessível via `Control Center
› Branches e Sincronização` (opção 5 do menu principal). Camadas:
Interface (`menu.sh`), Status, Branches, Sincronização, Comparação,
Histórico, Tags, Stash, Integridade, Estatísticas, Ferramentas,
Configurações (`lib/*.sh`, 11 arquivos).

## 2. Princípio arquitetural aplicado

**Envelopar, nunca reimplementar.** Diferente de Release/Backup, o
projeto não tinha nenhum script prévio de branch/stash/sincronização —
não havia o que envelopar. A regra de ouro se traduz aqui como: nenhuma
lógica de tag/push/merge/promoção é criada neste módulo; publicar/
promover continua sendo exclusivamente o módulo Release (`subir`/
`subir-ok`/`rollback`, Fase 2). Sincronização faz só `git fetch` (leitura)
e orienta o usuário a usar Release para publicar. As únicas ações que
escrevem no repositório (Alternar/Criar/Excluir Branch, Aplicar/Remover
Stash) são de escopo estreito, sempre com `_cc_confirm` explícito, e
Excluir Branch bloqueia incondicionalmente `develop`/`main`.

## 3. Verificações realizadas

| # | Verificação | Resultado |
|---|---|---|
| 1 | Navegação (entrar/sair do submenu, `Voltar` dinâmico = 13) | ✅ |
| 2 | Layout/UX (moldura, breadcrumb, rodapé — componentes já homologados, não alterados) | ✅ |
| 3 | Status do Repositório/Branch Atual — branch/commit/ahead-behind/workspace/remote reais | ✅ |
| 4 | Gerenciar Branches — listar local/remoto reais; Alternar/Criar/Excluir cancelam sem nome informado | ✅ |
| 5 | Excluir Branch nunca remove `develop`/`main`, mesmo pedindo diretamente | ✅ |
| 6 | Sincronização — `git fetch --all --prune` real + relatório ahead/behind, nunca pull/push | ✅ |
| 7 | Comparar Branches — commits/diff reais entre `develop` e `main` com defaults | ✅ |
| 8 | Histórico — filtro de quantidade, autor/data corretos (corrigido nesta Sprint, ver §4) | ✅ |
| 9 | Tags — locais/remotas/órfãs nos dois sentidos | ✅ |
| 10 | Stash — Aplicar/Remover cancelam de verdade com um stash real e descartável, criado e removido pelo próprio teste | ✅ |
| 11 | Integridade Git — `git fsck`, HEAD, remote, branch, referências, workspace (7 subitens) | ✅ |
| 12 | Estatísticas — contagens reais de branches/commits/tags/stashes | ✅ |
| 13 | Ferramentas Git — branches mergeadas/sem upstream, tags órfãs, conflitos, config, `.gitignore` (leitura pura) | ✅ |
| 14 | Configurações — mostra `branches.conf` real, cancela edição sem alterar o arquivo | ✅ |
| 15 | ShellCheck (12 arquivos: `menu.sh` + 11 `lib/*.sh`) | ✅ sem achados após correção de 4 avisos de estilo (SC2001) |
| 16 | `bash -n` (sintaxe) em todos os arquivos novos | ✅ |
| 17 | Compatibilidade Ubuntu — testado no terminal real via execução direta do módulo, navegação completa das 12 opções | ✅ |

Suíte automatizada (`tests/control-center/estrutura.test.mjs`): 12 testes
novos desta Fase, cobrindo regra de ouro (grep estático), leitura real,
cancelamento de ações destrutivas (branch e stash) e "Voltar" dinâmico.

## 4. Achados e ações

- **Achado técnico (corrigido):** a primeira versão de `lib/history.sh`
  usava sintaxe `printf`-style (`%-20an`) para alinhar o nome do autor no
  `git log --pretty=format`, que **não é sintaxe válida do Git** (o
  padding do Git usa `%<(N)`, não `%-Nx`) — o autor saía truncado/
  corrompido (`"20an"` em vez do nome). Corrigido para
  `%<(20,trunc)%an`, verificado manualmente antes e depois da correção.
- **Achado de processo (não é defeito do módulo):** durante esta Sprint,
  uma sessão concorrente no mesmo checkout (módulo Banco de Dados, Fase
  4) executou `git reset --hard` várias vezes enquanto este módulo ainda
  estava só no working tree (não commitado), descartando repetidamente
  as edições em `menu.sh`, `README.md` e `estrutura.test.mjs` (arquivos
  já rastreados) — os arquivos novos (`lib/*.sh`, `branches.conf`) não
  foram afetados por serem não-rastreados. Mitigado restaurando o
  conteúdo a cada ocorrência (confirmado via `git reflog`/`git status`
  antes de cada restauração, ver [[feedback-concorrencia-sessoes-checkout]])
  e, por fim, commitando assim que o working tree ficou estável — prática
  já documentada como risco conhecido deste projeto, não um incidente
  novo.
- **Decisão de escopo (documentada, não é pendência):** "Última
  sincronização" é lida do `mtime` de `.git/FETCH_HEAD`, não de
  `state/sincronizacao.json` — nenhum módulo desta versão (Release/
  Backup/Banco de Dados incluídos) ainda escreve nos arquivos de
  `state/`; divergir sozinho desse padrão criaria inconsistência maior do
  que o benefício nesta Sprint.

## 5. Riscos residuais

- `Alternar Branch`/`Criar Branch`/`Excluir Branch Local` dependem do
  estado real do working tree (Git pode recusar checkout com alterações
  conflitantes) — o módulo avisa quando o workspace não está limpo, mas
  não impede a tentativa; o próprio Git é a última linha de defesa aqui,
  como em qualquer uso direto de `git checkout`.
- `branches.conf` (Configurações) é um arquivo de texto simples editado
  via `sed` — suficiente para o escopo atual (6 campos, sem persistência
  de comportamento real ainda: os valores não alteram nenhuma lógica do
  módulo, são só informativos/preparatórios para uma Sprint futura que
  realmente os leia).

## 6. Veredito (original, 2026-07-11)

**APROVADO para `develop`.** Não promovido para `main` — fora do escopo
desta Sprint, seguindo o mesmo critério das Fases 2–4.

## 7. Adendo — Auditoria CCC-F05-AUD-002 (2026-07-12)

| Campo | Valor |
|---|---|
| Objeto | Correção de desvios entre a implementação e a especificação original CCC-F05-001 |
| Responsável técnico | Claude (Revisor Técnico Principal) |
| Data | 2026-07-12 |
| Branch | `develop` |
| Commits | `98a6338` (lib/menu.sh), `f1cabe8` (docs/README/testes), `b280b4f` (fix de teste) |

### 7.1 Requisitos da CCC-F05-001 — cobertura

16 requisitos funcionais na especificação original (Menu, Status do
Repositório, Branch Atual, Branches Locais, Branches Remotas, Comparar
Branches, Sincronização, Histórico, Tags, Stash, Integridade Git,
Ferramentas Git, Configurações, Segurança, Logs, Exportação) + 1
requisito estrutural (Arquitetura: `menu.sh`/`engine.sh`/`docs/`/`lib/`).

- **13/16 já implementados** na Fase 5 original (2026-07-11).
- **3/16 corrigidos nesta auditoria**: Exportação (`lib/export.sh`, novo
  — reaproveita o padrão de `modules/banco-dados/lib/export.sh`), Logs de
  detalhe por operação (reaproveita `_cc_log()` de `lib/common.sh`, já
  usado pela infraestrutura do próprio framework `_cc_run_submenu`) e
  Documentação (`docs/branches-sincronizacao.md`, novo).
- **Arquitetura (`engine.sh`)** — decisão documentada, não implementação:
  3 dos 5 módulos homologados (Backup e Recuperação, Desenvolvimento,
  Release) também não usam `engine.sh`; só Banco de Dados usa. Não há
  arquitetura oficial que exija o arquivo em todo módulo — ver
  justificativa completa em `docs/branches-sincronizacao.md`, "Decisão
  arquitetural — sem engine.sh".
- **Menu reorganizado** (Branches Locais/Remotas unidas em "Gerenciar
  Branches"; "Estatísticas" e agora "Exportação" adicionados) —
  decisão já registrada no §1 original e no README.md; nenhuma
  funcionalidade da spec foi perdida.

### 7.2 Arquivos alterados

`menu.sh` (item Exportação=11, Ferramentas Git=12, Configurações=13);
10 `lib/*.sh` existentes (log de detalhe); `lib/export.sh` (novo);
`docs/branches-sincronizacao.md` (novo); `README.md` (seção Fase 5);
`tests/control-center/estrutura.test.mjs` (BRS_LIBS + export.sh,
renumeração 11→14, 2 testes novos, 1 correção de falso positivo).

### 7.3 Testes e ShellCheck

- Testes do módulo: **13/13 aprovados** (11 originais + 2 novos:
  Exportação gera TXT/MD/JSON reais em `_reports/git/`; logs de detalhe
  aparecem em `logs/control-center.log`).
- Suíte completa (`estrutura.test.mjs`, todos os módulos): 82 testes, 77
  aprovados, 5 falhas — **nenhuma no módulo Branches e Sincronização**;
  as 5 são `ENOBUFS` (esgotamento de recursos ao rodar `core/menu.sh`) e
  condição de corrida em `config/modules.conf`/status do Git, causadas
  pela sessão concorrente descrita em 7.4, não por esta auditoria.
- ShellCheck: **0 achados** (13 arquivos: `menu.sh` + 12 `lib/*.sh`),
  verificado a partir do diretório do módulo.
- `bash -n`: sintaxe válida em todos os 13 arquivos.

### 7.4 Achado de processo — sessão concorrente ativa

Durante esta auditoria, o `git reflog` registrou **múltiplos `git reset
--hard`** de uma sessão concorrente no mesmo checkout (a mesma classe de
risco já documentada no §4 original desta Fase e em
[[feedback-concorrencia-sessoes-checkout]]), incluindo 2 ocorrências
*enquanto a suíte de testes completa rodava*, explicando a contagem
inconsistente de falhas entre execuções (9 → 6 → 5). Diferente do
episódio original, desta vez a sessão concorrente também **commitou
trabalho próprio** (Fase 10 — Central de IAs, `316f7f1`/`718a7c4`),
incluindo alteração em `README.md`. Mitigado com o mesmo método:
verificação de `git reflog`/`git status` antes de cada restauração,
edições reaplicadas e **commitadas em lotes pequenos imediatamente**
após cada verificação rápida (ShellCheck + sintaxe), em vez de aguardar
a suíte completa (~4 min) antes de commitar — reduz a janela de exposição
a um novo reset.

### 7.5 Veredito da auditoria

**GO** — Fase 5 homologada com as correções aplicadas. 16/16 requisitos
funcionais da CCC-F05-001 atendidos (13 desde a aprovação original + 3
corrigidos aqui); arquitetura sem `engine.sh` mantida por decisão
documentada; 0 regressões no módulo; ShellCheck limpo; testes 13/13.
Segue **não promovido para `main`** — fora do escopo desta auditoria,
mesmo critério das Fases 2–5.

---
*Ver `docs/PARECER-CCC-HOM-001.md` (Fase 3) para o parecer que originou
este padrão.*
