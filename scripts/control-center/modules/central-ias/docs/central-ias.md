# Central de IAs (Fase 10 — CCC-F10-001)

Centro unificado de organização, documentação e acompanhamento das
Inteligências Artificiais envolvidas no desenvolvimento do Cell City CRM
(ver `../../../../ENGINEERING.md`, autoridade de governança multi-IA do
projeto). Não executa nenhum modelo de IA — é só uma camada de leitura
sobre o Roadmap do Control Center e o próprio repositório Git.

## Segurança e escopo

Somente leitura, sem exceção sobre o repositório e os demais módulos:
nenhuma tela cria/altera/remove arquivo, commit ou módulo alheio. As
únicas escritas do módulo são as suas próprias (`config/local.json` —
Configurações — e `_reports/ai-center/` — Exportações), mesmo princípio
já usado em `modules/banco-dados`.

## Fonte única de dados

Três arquivos declarativos em `config/`, no mesmo espírito de
`../../config/modules.conf` (Manifesto Oficial dos Módulos) — nenhuma
tela de `lib/*.sh` hardcoda fase/IA/estágio, tudo lido daqui:

| Arquivo             | Conteúdo                                                       |
|---------------------|------------------------------------------------------------------|
| `fases.conf`        | `numero\|nome\|ia\|status\|modulos` — uma linha por fase do Roadmap |
| `registry.conf`     | `slug\|nome\|versao\|funcao\|especialidades` — uma linha por IA cadastrada |
| `workflow.conf`     | Uma linha por estágio do Fluxo de Desenvolvimento, em ordem       |

`status` em `fases.conf`: `CONCLUIDA` \| `AGUARDANDO_REVISAO` \|
`EM_IMPLEMENTACAO` \| `NAO_INICIADA`. `modulos`: slugs de `modules/`
separados por vírgula; `-` = infraestrutura/core (sem módulo próprio);
`*` = fase transversal (toda a plataforma, ex.: Fase 8 "Polimento
Final").

**Atualizar uma fase é só editar uma linha em `fases.conf`** (nunca em
`lib/*.sh`) — mesmo princípio de manutenção do Manifesto de módulos.

## Regras de derivação (não duplicar em nenhuma tela)

- **Estágio do Fluxo** (`lib/utils.sh:_cc_cia_estagio_atual`): mapeia o
  `status` de uma fase pro estágio de `workflow.conf` — `NAO_INICIADA`→
  Planejamento, `EM_IMPLEMENTACAO`→Implementação, `AGUARDANDO_REVISAO`→
  Auditoria, `CONCLUIDA`→Release.
- **Estado real do módulo** (`lib/utils.sh:_cc_cia_modulo_estado_real`):
  nunca confia cegamente no `status` declarado — verifica se
  `modules/<slug>/menu.sh` existe e se ainda chama `_cc_placeholder`
  (⇒ `AUSENTE`/`PLACEHOLDER`/`IMPLEMENTADO`). O Dashboard usa isto pra
  classificar saúde: `CRITICO` se uma fase `CONCLUIDA` tiver módulo
  ausente ou ainda placeholder (quebra de integridade entre o Registro
  e a realidade), `ATENCAO` se não há quebra mas existem fases
  `AGUARDANDO_REVISAO`, `SAUDAVEL` caso contrário.
- **Última atividade de uma IA** (`lib/utils.sh:_cc_cia_ia_ultima_atividade`):
  `git log` real sobre os módulos atribuídos a ela em `fases.conf` —
  nunca uma data estática que poderia ficar desatualizada.
- **Responsabilidades**: uma fase `AGUARDANDO_REVISAO` gera duas linhas
  (Implementação de quem construiu + Revisão Técnica de Claude, único
  Revisor Técnico Principal do projeto) — regra de derivação sobre
  `fases.conf`, nunca uma terceira fonte de dados.

## Achado real desta Sprint — truncamento silencioso de listas sem espaço

Ao testar as telas ao vivo: uma lista unida só por `,` ou `→` (sem
espaço) vira uma "palavra" única sem ponto de quebra pro word-wrap de
`_cc_box_text` — o trecho que ultrapassa a largura da caixa é cortado
silenciosamente por `_cc_box_line` (que corta texto sem aviso quando não
cabe, comportamento documentado em `../../lib/ui-box.sh`). Corrigido
juntando sempre com separador **+ espaço** (`", "`/`"→ "`), nunca só o
separador cru — dá ao word-wrap um ponto de quebra a cada item da
lista. Vale para qualquer módulo futuro que monte uma lista dinâmica
pra exibir dentro da caixa.

## Exportações

`Configurações › Exportar Estatísticas agora` (não há item de menu
dedicado — o menu de 11 itens do CCC-F10-001 não reserva um número só
pra isto) gera TXT/Markdown/JSON em `_reports/ai-center/` (diretório
configurável), sempre a partir da mesma coleta de `lib/statistics.sh`
— nunca duas fontes de números divergentes entre tela e exportação.

## Testes

Suíte em `../../../../tests/control-center/estrutura.test.mjs`, seção
"Fase 10 — Central de IAs" (mesmo padrão das Fases 3/4/5 — não um
arquivo `.test.mjs` separado).
