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

## 6. Veredito

**APROVADO para `develop`.** Não promovido para `main` — fora do escopo
desta Sprint, seguindo o mesmo critério das Fases 2–4.

---
*Ver `docs/PARECER-CCC-HOM-001.md` (Fase 3) para o parecer que originou
este padrão.*
