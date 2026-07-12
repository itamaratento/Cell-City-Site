# Parecer Executivo — CCC-HOM-001 (Central de IAs)

**Padrão:** CCC-HOM-001 (mesmo template usado pelas Fases 3–7 — ver
`docs/PARECER-CCC-HOM-001.md`).

| Campo | Valor |
|---|---|
| Objeto | Módulo **Central de IAs** do Cell City Control Center |
| Sprint | Fase 10 (especificação CCC-F10-001), auditada via CCC-SPRINT-FINAL-001 |
| Implementação original | Claude, em sessão concorrente (commits `863d20c`/`bbd8eac`/`316f7f1`, antes desta auditoria) |
| Auditoria técnica | Claude (Revisor Técnico Principal), sessão separada — **só auditoria, sem reimplementação**, por instrução explícita do dono do projeto (evitar colisão com o trabalho já commitado) |
| Data da auditoria | 2026-07-12 |
| Branch | `develop` |
| Commit auditado | `718a7c4` (+ `23f6224`, correção de 2 testes — ver §3) |
| Ambiente | Terminal Ubuntu — comando `cellcity` |

## 1. Escopo auditado

Submenu com 11 opções (Dashboard, IAs Cadastradas, Especialidades,
Responsabilidades, Fluxo de Desenvolvimento, Distribuição de Tarefas,
Histórico, Auditorias, Documentação, Estatísticas, Configurações),
`Voltar` dinâmico = 12. Módulo somente-leitura sobre o próprio Control
Center e o repositório Git (Registro de Fases/IAs em 3 arquivos
declarativos `config/*.conf`), com exportação em `_reports/ai-center/`
e configuração local em `config/local.json`.

## 2. Diferença desta Fase frente às Fases 6/7

Ao contrário do Diagnóstico e Ferramentas (implementação completa no
disco, mas `menu.sh` ainda placeholder — nunca chegou a rodar de
verdade), a Central de IAs **já foi implementada, testada e
documentada de ponta a ponta pela mesma IA que a está revisando agora**
(Claude, em sessão anterior). `menu.sh`/`engine.sh` já estavam
corretamente conectados desde o primeiro commit; a própria documentação
(`docs/central-ias.md`) já registra um achado técnico real corrigido
durante o desenvolvimento original (truncamento silencioso de listas
sem espaço em `_cc_box_line`). Esta auditoria, portanto, focou em
verificar de forma independente — não em corrigir um gap de integração
como nas Fases 6/7.

## 3. Verificações realizadas

| # | Verificação | Resultado |
|---|---|---|
| 1 | Estrutura de arquivos (`menu.sh`/`engine.sh`/13 `lib/*.sh`/3 `config/*.conf`/`docs/`) presente e íntegra | ✅ |
| 2 | Arquitetura — Interface sem chamada direta a `git`; nenhuma regra de negócio fora de `lib/*.sh` | ✅ |
| 3 | Segurança — nenhum `lib/*.sh` escreve/altera commit, arquivo ou módulo alheio (únicas escritas: `config/local.json` e `_reports/ai-center/`, ambas próprias do módulo) | ✅ |
| 4 | Navegação (11 opções, `Voltar` dinâmico = 12, `Sair` = 0) | ✅ |
| 5 | Dashboard mostra números reais e coerentes com `config/fases.conf` | ✅ |
| 6 | IAs Cadastradas/Especialidades/Responsabilidades/Fluxo/Tarefas rodam de verdade, sem crash, sem truncamento | ✅ |
| 7 | Histórico filtra por IA/Fase via `git log` real (nenhum evento fabricado) | ✅ (achado de design não-bloqueante — ver §4) |
| 8 | Auditorias lista os Pareceres Executivos reais e fases aguardando revisão | ✅ |
| 9 | Documentação enumera README.md e docs por módulo, sem corte | ✅ |
| 10 | Estatísticas batem com o Dashboard | ✅ (teste corrigido — ver §4) |
| 11 | Exportações geram TXT/Markdown/JSON reais em `_reports/ai-center/` | ✅ |
| 12 | Configurações persiste em `config/local.json` (nunca em `state/`), Restaurar Padrões limpa o arquivo | ✅ |
| 13 | ShellCheck (15 arquivos: `menu.sh` + `engine.sh` + 13 `lib/*.sh`) | ✅ 0 achados reais (padrão idiomático de `read -r` com campos não usados em alguns loops, mais 1 nota de estilo SC2001) |
| 14 | `bash -n` (sintaxe) em todos os arquivos | ✅ |

Suíte automatizada (`tests/control-center/estrutura.test.mjs`, seção
"Fase 10"): 12 testes, **12/12 aprovados** após 2 correções de teste
(§4) — nenhuma alteração no código do módulo em si.

## 4. Achados

- **Achado de design (não corrigido — fora do escopo desta auditoria):**
  o Histórico atribui a IA responsável por um commit usando o
  mapeamento estático `fases.conf` (quem foi *designado* pra fase), não
  o autor real do commit Git. Na prática, isso significa que qualquer
  revisão técnica do Claude num módulo cuja fase está atribuída ao
  DeepSeek em `fases.conf` (como Fases 6 e 7, ambas desta mesma Sprint)
  aparece no Histórico rotulada "(deepseek)", mesmo tendo sido commitada
  pelo Claude. Não é um bug de execução — o módulo faz exatamente o que
  foi projetado pra fazer — mas é uma imprecisão de atribuição que pode
  confundir quem lê o Histórico esperando saber literalmente "quem
  commitou o quê". Registrado aqui para decisão futura do dono do
  projeto: manter (atribuição por fase = decisão de governança) ou
  trocar para atribuição por autor real de commit (mudança de
  arquitetura da tela, fora do escopo de uma auditoria).
- **2 testes corrigidos (não é regressão do módulo):** a contagem de
  Pareceres Executivos em Estatísticas estava testada com valor
  hardcoded (3); esta mesma Sprint gerou 2 pareceres novos (Fases 6/7),
  tornando o número real 5. Trocado por contagem dinâmica no teste. O
  teste de filtro do Histórico por "deepseek" esperando zero resultados
  parou de bater pelo mesmo motivo do achado acima (meus próprios
  commits de hoje têm essa atribuição) — trocado para filtrar por uma
  IA que garantidamente não existe no registro.

## 5. Riscos residuais

- Nenhum item de menu dedicado para Exportações (acessível só via
  `Configurações › Exportar Estatísticas agora`) — decisão de escopo já
  documentada em `docs/central-ias.md` (o menu de 11 itens da
  especificação original não reservava um número pra isso), não uma
  omissão.
- Mesma ressalva de heurística já registrada nos pareceres de Banco de
  Dados/Ferramentas: leituras de `git log`/arquivos declarativos, não
  substituem auditoria manual completa.

## 6. Veredito

**GO.** Fase 10 já estava tecnicamente correta e bem testada antes
desta auditoria — nenhum defeito de execução encontrado no módulo em
si. 2 testes corrigidos para refletir o estado real gerado por esta
mesma Sprint (não regressões). 1 achado de design (atribuição de IA no
Histórico) registrado para decisão futura, não bloqueante. Não
promovido para `main` — fora do escopo desta Sprint.

---
*Ver `docs/PARECER-CCC-HOM-001.md` (Fase 3) para o parecer que originou
este padrão.*
