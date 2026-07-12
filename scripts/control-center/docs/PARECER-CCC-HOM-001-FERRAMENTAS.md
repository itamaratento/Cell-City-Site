# Parecer Executivo — CCC-HOM-001 (Ferramentas, Auditorias e Relatórios)

**Padrão:** CCC-HOM-001 (mesmo template usado pelas Fases 3–6 — ver
`docs/PARECER-CCC-HOM-001.md`).

| Campo | Valor |
|---|---|
| Objeto | Módulo **Ferramentas, Auditorias e Relatórios** do Cell City Control Center |
| Sprint | Fase 7 (especificação CCC-F07-FINAL), encerrada via CCC-SPRINT-FINAL-001 |
| Implementação original | DeepSeek (backend: `engine.sh` + 10 `lib/*.sh` + `docs/` + testes) |
| Revisão técnica | Claude (Revisor Técnico Principal) |
| Data | 2026-07-12 |
| Branch | `develop` |
| Commit | `977d1ad` |
| Ambiente | Terminal Ubuntu — comando `cellcity` |

## 1. Escopo homologado

Submenu com 9 opções (`1 ► Auditoria Geral` … `9 ► Utilitários`, `10 ►
Voltar`, `0 ► Sair`), acessível via `Control Center › Ferramentas`
(opção 7 do menu principal). 6 auditorias somente-leitura (Geral,
Segurança, Git, Firebase, Node, Bash — 40 verificações no total), 6
tipos de relatório formatado, exportação em 3 formatos (`_reports/`) e 5
utilitários (2 destrutivos, sempre com confirmação). Estado persistido em
`state/auditoria.json`.

## 2. Achados principais

### 2.1 Interface desconectada do backend (mesma classe da Fase 6)

`menu.sh` era o placeholder da Fase 1 — nunca chamava `engine.sh`.
Reescrito com `_cc_run_submenu`, orquestrando execução (`engine.sh`) e
exibição (novas funções `_cc_ferr_resumo`/`_cc_ferr_detalhado` em
`lib/utils.sh`, mesmo padrão visual do módulo Diagnóstico).

### 2.2 Inconsistência de UX — "0 = Voltar" só neste módulo

A documentação (`docs/ferramentas.md`) e a suíte de testes originais
especificavam o menu principal deste módulo com **"0 ► Voltar"** — mas em
**todos** os outros módulos do Control Center (Branches e Sincronização,
Banco de Dados, Diagnóstico), `0` sempre encerra o Control Center inteiro
e "Voltar" é o número dinâmico `N+1`, via `_cc_run_submenu`. Isso teria
criado uma inconsistência real de UX: o usuário pressiona `0` num módulo
e sai da ferramenta inteira, pressiona `0` neste módulo e só volta um
nível — comportamento imprevisível do mesmo atalho em telas diferentes.
**Corrigido** para usar `_cc_run_submenu` como todo o resto do projeto
(9 itens reais, Voltar dinâmico = 10, Sair = 0); `docs/ferramentas.md` e
`tests/control-center/ferramentas.test.mjs` atualizados de acordo.

### 2.3 Bug real de performance — Auditoria de Segurança travava

`_cc_ferr_aud_tokens` e `_cc_ferr_aud_chaves_privadas` faziam
`find "$REPO_DIR" -maxdepth 3 -type f` sem excluir `node_modules`/`.git`
— em execução real, isso varria e rodava `grep` em **milhares** de
arquivos de dependências de terceiros (confirmado: 4282 arquivos em
`maxdepth 3` sem exclusão vs. 736 excluindo `node_modules`/`.git`), 5
padrões × 2 funções, cada arquivo gerando um processo `grep` novo. Em
teste isolado, apenas 2 dos 5 padrões já ultrapassavam 8s sem terminar.
**Corrigido** com `-not -path '*/node_modules/*' -not -path '*/.git/*'
-not -path '*/_BACKUPS/*'` nas 4 buscas relevantes de
`lib/auditoria-seguranca.sh`. Tempo de execução real da Auditoria de
Segurança: de indeterminado (travava) para ~18s — aceitável para uma
ferramenta interativa, não otimizado além disso (fora do escopo desta
revisão, que corrige defeitos reais, não é um esforço de performance).

## 3. Verificações realizadas

| # | Verificação | Resultado |
|---|---|---|
| 1 | Estrutura de arquivos presente e íntegra | ✅ |
| 2 | Arquitetura — Interface/Orquestrador/Auditorias/Relatórios sem mistura de responsabilidades | ✅ |
| 3 | Navegação (9 opções, `Voltar` dinâmico = 10, `Sair` = 0, opção inválida não quebra) | ✅ (corrigido — ver §2.2) |
| 4 | 6 auditorias executam e exibem resultados reais (detalhado + resumo) | ✅ |
| 5 | Gerar Relatórios (6 tipos), Exportações (3 formatos), Utilitários (5 operações) navegam e retornam corretamente | ✅ |
| 6 | Operações destrutivas (Limpeza de Cache/Temporários) exigem `_cc_confirm` | ✅ |
| 7 | `state/auditoria.json` atualizado após auditoria | ✅ (corrigido — ver §4) |
| 8 | `engine.sh` tolera categoria inválida e chamada isolada sem quebrar | ✅ (corrigido — ver §4) |
| 9 | Segurança — nenhuma auditoria escreve/publica; utilitários destrutivos sempre confirmam | ✅ |
| 10 | Performance — Auditoria de Segurança não trava mais | ✅ (corrigido — ver §2.3) |
| 11 | ShellCheck (12 arquivos: `menu.sh` + `engine.sh` + 10 `lib/*.sh`) | ✅ 0 achados reais (19 notas de estilo, não corrigidas — ver §4) |
| 12 | `bash -n` (sintaxe) em todos os arquivos | ✅ |
| 13 | Compatibilidade Ubuntu — testado no terminal real via execução direta do módulo | ✅ |

Suíte automatizada (`tests/control-center/ferramentas.test.mjs`): 25
testes, **25/25 aprovados** após as correções desta revisão (muitos
nunca haviam sido executados contra uma implementação real — o
`menu.sh` original era placeholder — e várias sequências de input não
previam a pausa automática do `_cc_run_submenu` ao retornar de
Relatórios/Exportações/Utilitários; corrigidas).

## 4. Achados e ações

- **Corrigido:** `menu.sh` placeholder (§2.1).
- **Corrigido:** inconsistência "0 = Voltar" (§2.2).
- **Corrigido:** trava de performance na Auditoria de Segurança (§2.3).
- **Corrigido:** `engine.sh` sem fallback de `REPO_DIR` quando chamado
  isolado — mesmo defeito já corrigido na Fase 6, mesma correção aplicada.
- **Corrigido:** `CC_FERR_STATE` declarado mas nunca escrito —
  `state/auditoria.json` nunca era atualizado apesar do schema já
  existir no arquivo. Implementada `_cc_ferr_salvar_estado()`.
- **Corrigido:** `lib/*.sh` e `engine.sh` sem permissão de execução
  (`chmod +x`) — pego pela própria suíte de testes original.
- **Corrigido (ShellCheck real):** `SC2146` em `auditoria-geral.sh`
  (falta de agrupamento `\( \)` no `find` de arquivos órfãos fazia
  `-maxdepth`/`-print0` só valerem pro primeiro de 4 padrões — 3 deles
  buscavam a árvore inteira sem limite e sem null-termination correta);
  `SC2269` (self-assignment morto) em `auditoria-node.sh`.
- **Não corrigido (documentado, estilo):** 19 notas — `SC2227`
  (posição de `2>/dev/null` no `find`, sem impacto funcional), `SC2015`
  (`A && B || C`, seguro neste código porque `_cc_ferr_adicionar` nunca
  falha), `SC2012` (`ls` em vez de `find`, sem impacto neste projeto).
- **Observação não corrigida (não é defeito):** `_cc_ferr_adicionar`
  incrementa `CC_FERR_TOTAL` para status `"info"` (usado por
  `_cc_ferr_aud_git_nao_rastreados`) mas não incrementa nenhum dos 3
  contadores de classificação (ok/warn/fail) — o "Total" no resumo pode
  não bater exatamente com a soma de Aprovados+Avisos+Falhas quando há
  itens "info". Comportamento pré-existente, cosmético, não corrigido
  nesta revisão (não é um "problema real" no sentido de causar dado
  incorreto ou decisão errada — é só uma soma que não fecha visualmente).

## 5. Riscos residuais

- Auditoria de Segurança ainda leva ~18s em execução real — aceitável,
  mas se o repositório crescer significativamente pode valer a pena
  trocar o padrão `find + while + grep por arquivo` por `grep -rlP`
  (uma única invocação por padrão, não uma por arquivo) — não feito
  aqui por estar fora do escopo de "corrigir defeitos reais".
- As auditorias de segurança são heurísticas (regex/nome de arquivo) —
  não substituem revisão manual antes de expor o repositório
  publicamente (mesma ressalva já registrada no parecer de Banco de
  Dados/Fase 4 para suas heurísticas).

## 6. Veredito

**GO.** Fase 7 homologada para `develop`. Backend já estava
majoritariamente correto; interface reconectada; 1 inconsistência de UX
corrigida (alinhamento com o resto do projeto); 1 bug real de
performance corrigido (trava → ~18s); demais defeitos reais (REPO_DIR,
estado não persistido, permissões, ShellCheck) corrigidos; 25/25 testes
aprovados. Não promovido para `main` — fora do escopo desta Sprint.

---
*Ver `docs/PARECER-CCC-HOM-001.md` (Fase 3) para o parecer que originou
este padrão.*
