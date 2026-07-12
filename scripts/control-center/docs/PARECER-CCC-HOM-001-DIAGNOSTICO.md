# Parecer Executivo — CCC-HOM-001 (Diagnóstico e Health Check)

**Padrão:** CCC-HOM-001 (mesmo template usado pelas Fases 3–5 — ver
`docs/PARECER-CCC-HOM-001.md`).

| Campo | Valor |
|---|---|
| Objeto | Módulo **Diagnóstico e Health Check** do Cell City Control Center |
| Sprint | Fase 6 (especificação CCC-F06-001), encerrada via CCC-SPRINT-FINAL-001 |
| Implementação original | DeepSeek (backend: `engine.sh` + 8 `lib/*.sh` + `docs/` + testes) |
| Revisão técnica | Claude (Revisor Técnico Principal) |
| Data | 2026-07-12 |
| Branch | `develop` |
| Commit | `fa90a07` |
| Ambiente | Terminal Ubuntu — comando `cellcity` |

## 1. Escopo homologado

Submenu com 8 opções (`1 ► Executar Diagnóstico Completo` … `8 ►
Relatório Técnico Completo`, `9 ► Voltar`, `0 ► Sair`), acessível via
`Control Center › Diagnóstico` (opção 6 do menu principal). 45
verificações somente-leitura em 6 categorias: Sistema (11), Projeto (7),
Git (7), Node (6), Firebase (8), Ambiente (8). Cada verificação registra
status (ok/warn/fail), detalhes e — quando aplicável — causa provável,
impacto e sugestão de correção. Estado persistido em
`state/health-check.json`.

## 2. Achado principal — interface desconectada do backend

O backend (execução das 45 verificações, classificação, persistência de
estado, geração de relatório) já estava completo e testável
isoladamente. Mas `menu.sh` — a única porta de entrada do usuário — ainda
era o placeholder genérico da Fase 1 (`_cc_placeholder "Diagnóstico"`) e
nunca chamava `engine.sh`. Na prática, o módulo era 100% inacessível pelo
Control Center: qualquer usuário que abrisse "Diagnóstico" via `cellcity`
via `cellcity` só via a tela "Módulo em construção", nunca uma verificação
real. README.md já registrava isso corretamente como "implementada,
aguardando revisão técnica" — não era um achado surpreendente, é
exatamente o gap que esta revisão veio fechar.

**Correção:** `menu.sh` reescrito para montar o submenu real via
`_cc_run_submenu` e orquestrar execução (via `engine.sh`) + exibição (via
`lib/relatorio.sh`), sem nenhuma regra de verificação na interface — mesmo
princípio já documentado em `docs/diagnostico.md`, "Separação de
camadas" (que já previa esse desenho, só não estava implementado).

## 3. Verificações realizadas

| # | Verificação | Resultado |
|---|---|---|
| 1 | Estrutura de arquivos (`menu.sh`/`engine.sh`/`lib/*`/`docs/`) presente e íntegra | ✅ |
| 2 | Arquitetura — Interface/Orquestrador/Verificações/Relatório sem mistura de responsabilidades | ✅ |
| 3 | Navegação (9 opções, `Voltar` dinâmico = 9, `Sair` = 0, opção inválida não quebra) | ✅ |
| 4 | Diagnóstico Completo executa as 6 categorias e mostra resumo | ✅ |
| 5 | Cada categoria (Sistema/Projeto/Git/Node/Firebase/Ambiente) executa isoladamente e exibe resultados reais | ✅ |
| 6 | Relatório Técnico Completo exibe detalhado + resumo + recomendações + próximas ações | ✅ |
| 7 | `state/health-check.json` atualizado com todos os campos esperados após execução | ✅ |
| 8 | `engine.sh` tolera categoria inválida e chamada isolada (fora do `menu.sh`) sem quebrar | ✅ (corrigido — ver §4) |
| 9 | Segurança — todas as 45 verificações são somente-leitura; nenhuma escreve/instala/publica nada | ✅ |
| 10 | ShellCheck (10 arquivos: `menu.sh` + `engine.sh` + 8 `lib/*.sh`) | ✅ 0 achados reais (3 notas de estilo SC2012, não corrigidas — ver §4) |
| 11 | `bash -n` (sintaxe) em todos os arquivos | ✅ |
| 12 | Compatibilidade Ubuntu — testado no terminal real via execução direta do módulo | ✅ |

Suíte automatizada (`tests/control-center/diagnostico.test.mjs`): 21
testes, **21/21 aprovados** após as correções desta revisão.

## 4. Achados e ações

- **Achado técnico (corrigido):** `menu.sh` era o placeholder da Fase 1
  — ver §2.
- **Achado técnico (corrigido):** `engine.sh` computava `CC_ROOT` e
  `MODULE_DIR` como fallback quando chamado isoladamente, mas não
  `REPO_DIR` — quebrando `lib/sistema.sh` (que exige `REPO_DIR`) nesse
  cenário, e contradizendo o próprio comentário do arquivo ("Pode ser
  chamado isoladamente"). Corrigido com o mesmo padrão de fallback já
  usado para `CC_ROOT`/`MODULE_DIR`.
- **Achado de teste (corrigido):** `diagnostico.test.mjs` testava a
  presença do texto "CELL CITY CONTROL CENTER" num submenu de módulo —
  esse texto só aparece no menu raiz (`core/menu.sh`); nenhum módulo do
  projeto o exibe no próprio submenu (mesmo comportamento confirmado em
  `estrutura.test.mjs` para Branches e Sincronização/Banco de Dados/
  etc.). Corrigida para testar o título real do módulo.
- **ShellCheck (não corrigido, documentado):** 3 notas de nível `info`
  (SC2012, "use find em vez de ls" em `lib/node.sh`/`lib/projeto.sh`) —
  estilo, não afeta corretude no contexto real do projeto (sem nomes de
  arquivo com quebra de linha em `node_modules`/raiz do repo).
- **ShellCheck (corrigido):** 2 variáveis mortas (`SC2034` em
  `lib/sistema.sh`/`lib/firebase.sh`) e 2 redirecionamentos de `find`
  reposicionados (`SC2227` em `lib/projeto.sh`).

## 5. Riscos residuais

- `_cc_diag_firebase_login` depende de `firebase login:list`, que é
  local (lê cache de autenticação) mas pode ser lento/indisponível se o
  Firebase CLI não estiver instalado — já tratado com `2>/dev/null` e
  mensagem `warn`/`fail` apropriada, sem travar o diagnóstico.
- As 45 verificações não cobrem tudo (ex.: não valida se o `firebase.json`
  aponta pro diretório de hosting correto além da existência) — escopo
  suficiente para health-check, não para auditoria de segurança completa
  (isso é papel do módulo Ferramentas/Fase 7 e de auditorias dedicadas).

## 6. Veredito

**GO.** Fase 6 homologada para `develop`. Backend já estava correto;
interface reconectada; 2 defeitos reais corrigidos (menu.sh placeholder,
`engine.sh` sem fallback de `REPO_DIR`); 1 teste corrigido; ShellCheck
limpo (exceto estilo); 21/21 testes aprovados. Não promovido para
`main` — fora do escopo desta Sprint.

---
*Ver `docs/PARECER-CCC-HOM-001.md` (Fase 3) para o parecer que originou
este padrão.*
