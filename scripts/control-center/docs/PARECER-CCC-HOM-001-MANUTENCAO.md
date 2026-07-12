# Parecer Executivo — CCC-HOM-001 (Manutenção e Higienização)

**Padrão:** CCC-HOM-001 (mesmo template usado pelas Fases 3–11 — ver
`docs/PARECER-CCC-HOM-001.md`).

| Campo | Valor |
|---|---|
| Objeto | Módulo **Manutenção e Higienização** do Cell City Control Center |
| Sprint | Fase 9 (especificações CCC-F09-001/CCC-F09-FINAL), homologada via CCC-V1.0-FINAL-001 |
| Implementação original | DeepSeek (menu completo + `engine.sh` + 9 `lib/*.sh` + docs + testes) |
| Revisão técnica | Claude (Revisor Técnico Principal) |
| Data | 2026-07-12 |
| Branch | `develop` |
| Commits | `0334596` (módulo + correções), `17a2585`/`03224df` (framework/testes, compartilhados com a Fase 8) |
| Ambiente | Terminal Ubuntu — comando `cellcity` |

## 1. Escopo homologado

Menu com 11 opções (Análise Geral, Arquivos Órfãos, Código Morto,
Scripts Duplicados, Dependências, Estrutura, Auditoria do .gitignore,
Relatório de Higienização, Limpeza Assistida, Executar Plano de Limpeza,
Configurações; Voltar=12), acessível via `Control Center › Manutenção e
Higienização` (opção 10 do menu principal). Requisitos da especificação
verificados um a um:

| Requisito (CCC-F09-FINAL) | Estado |
|---|---|
| Scanner (órfãos, dirs vazios, backups, logs, temporários) | ✅ |
| Auditor (código morto, duplicados, dependências, estrutura, .gitignore) | ✅ |
| Dry-Run (simulação antes de qualquer remoção) | ✅ |
| Snapshot (JSON com branch/commit/plano antes da execução) | ✅ |
| Recovery / Trash (`_trash/` com timestamp, recuperável) | ✅ (corrigido — ver §2) |
| Logs (log de auditoria `logs/cleanup.log` com usuário/branch/commit/itens/resumo) | ✅ |
| Plano de Limpeza (aprovação item a item, RECOMENDACAO para protegidos) | ✅ |
| Confirmação Dupla | ✅ |
| 17 Checks de validação pré-execução (A1–A8 ambiente, S1–S5 segurança, I1–I4 integridade) | ✅ |
| Relatórios (classificação CRITICO/ALTO/MEDIO/BAIXO/INFORMATIVO, espaço recuperável) | ✅ |
| Documentação (`docs/manutencao.md`) | ✅ |
| Persistência de estado (`state/manutencao.json`) | ✅ (implementada nesta revisão — ver §2) |

## 2. Achados e correções

- **BUG CRÍTICO DE SEGURANÇA (latente, corrigido):** a lógica de remoção
  do Plano de Limpeza estava **invertida** — um arquivo protegido
  (`firebase.json`, `firestore.rules`, `package.json`, `.gitignore`…)
  recebia `rm -f` **permanente**, enquanto só o arquivo comum ia pra
  `_trash/`. O caminho era inalcançável nas condições atuais (a Limpeza
  Assistida nunca aprova item CRITICO e o check I2 cancela a execução
  com protegido no plano), mas bastava uma única mudança em qualquer
  dessas duas barreiras para um arquivo crítico ser destruído sem
  recuperação. Corrigido com defesa em profundidade: o loop de execução
  agora **recusa** protegidos incondicionalmente (log "BLOQUEADO") e
  **todo** arquivo removido vai pra `_trash/`. Simulação e mensagens de
  confirmação atualizadas para a semântica real (não existe mais remoção
  "irreversível").
- **Módulo não registrado no Manifesto** (`config/modules.conf`) —
  inacessível pelo menu principal do `cellcity` (mesma classe do gap de
  integração das Fases 6/7, em outro ponto). Registrado como
  `10|manutencao` — o teste original esperava o slot 9, que já pertencia
  ao módulo Configurações.
- **Espaço recuperado sempre 0B no log de auditoria** (`stat` executado
  após o `rm`). Corrigido: medido antes da remoção.
- **`state/manutencao.json` nunca era escrito** (`CC_MAN_STATE`
  declarado + stub morto `_cc_man_classificar_estado`). Implementada
  `_cc_man_salvar_estado`, chamada após cada análise e após o plano;
  stub morto removido.
- **`engine.sh` sem fallback de `REPO_DIR`** quando chamado isolado —
  mesmo defeito já corrigido nas Fases 6/7; mesma correção.
- **Acentuação ausente em todo o menu** (MANUTENCAO, Orfaos, "Opcao
  invalida"...) — única interface do projeto sem português correto;
  corrigida (as strings das libs já eram acentuadas — a divergência era
  só na casca).
- **EOF no loop próprio do menu** — `read` sem `|| break`, mesmo defeito
  do framework corrigido na Fase 8/certificação; protegido aqui também.
- **Suíte de testes escrita contra a especificação, não contra a
  implementação** (menu com numeração diferente, manifesto no slot
  errado) — realinhada, com um teste novo cobrindo especificamente a
  regra "execução nunca remove arquivo protegido".

## 3. Nota arquitetural — loop próprio em vez de `_cc_run_submenu`

Diferente dos demais módulos, o menu usa um loop customizado. Decisão
**aceita** nesta homologação: o fluxo encadeado da Análise Geral
(análise → relatório → limpeza assistida → simulação → plano) não cabe
no dispatch de um item por vez do `_cc_run_submenu`, e a numeração
segue a mesma convenção do resto do projeto (Voltar = N+1 = 12, 0 =
Sair). Registrado para que módulos futuros não usem este caso como
precedente sem justificativa equivalente.

## 4. Verificações

ShellCheck: 0 achados reais (SC2227/SC2015 de estilo, mesmos códigos já
documentados nas fases anteriores). `bash -n`: ok em todos os arquivos.
Testes: **18/18 aprovados**. Smoke manual: menu, auditoria de
.gitignore, persistência de estado — verificados no terminal real.

## 5. Veredito

**GO.** Fase 9 homologada para `develop`. A implementação original era
funcionalmente rica e cumpria a especificação; a revisão eliminou 1 bug
crítico latente de segurança, 1 gap de integração (Manifesto) e 5
defeitos menores. Não promovido para `main` — publicação é ato do
Release 1.0, fora do escopo.

---
*Ver `docs/PARECER-CCC-HOM-001.md` (Fase 3) para o parecer que originou
este padrão.*
