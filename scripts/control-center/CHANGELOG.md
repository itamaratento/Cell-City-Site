# Changelog — Cell City Control Center

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/);
versionamento semântico ([VERSION](VERSION) é a fonte única da versão).

## [Não lançado]

### Corrigido
- Suíte de testes: 5 testes que pinavam o estado antigo do Registro de
  Fases (`fases.conf`) e o duplicado de `firestore.indexes.json` (removido
  em 5f9a64d) agora derivam as contagens do próprio `fases.conf`
  (revisão técnica da Fase 15, 2026-07-13).

### Contexto
- Fundação V3 entregue como overlay fora deste diretório (`scripts/*-engine`,
  `scripts/monitoring`, etc.) — os engines V3 serão plugáveis via
  `lib/plugin-loader.sh` (ADR-004 de `plans/v3/CCC-V3.0-ARCH-001`).

## [1.0.0] — 2026-07-12

Primeira versão completa. Encerra o Roadmap 1.0 (11 fases), certificada
pela CCC-V1.0-FINAL-001 e homologada para publicação pela
CCC-V1.0-RELEASE-001 (ver `docs/PARECER-CCC-HOM-001-V1.0.md`).

### Módulos (10, zero placeholders)

- **Desenvolvimento** (Fase 2) — status do projeto, git status/diff/log,
  build/testes/lint, limpeza de cache com confirmação.
- **Release** (Fase 2, v2.0 na Sprint de blindagem) — envelopa
  `subir`/`release`/`subir-ok`/`rollback` com auditoria ampliada,
  bloqueio de homologação e Pós-Deploy. Único caminho de publicação.
- **Backup e Recuperação** (Fase 3) — envelopa o Sistema Oficial de
  Backup (repo Cell-City-Backup): manual, automático, Firebase,
  restauração, integridade, limpeza com preservação do mais recente.
- **Banco de Dados** (Fase 4) — inspeção somente-leitura do
  Firestore/Firebase: coleções, índices (declarado × publicado), Rules
  (heurísticas + release ativo via API), Cloud Functions, exportações.
- **Branches e Sincronização** (Fase 5 + auditoria CCC-F05-AUD-002) —
  inspeção/comparação/fetch (nunca pull/push/merge), gerenciamento
  estreito de branches/stash com confirmação, exportações e logs.
- **Diagnóstico e Health Check** (Fase 6) — 45 verificações em 6
  categorias (sistema, projeto, git, node, firebase, ambiente),
  relatório técnico, estado em `state/health-check.json`.
- **Ferramentas, Auditorias e Relatórios** (Fase 7) — 6 auditorias
  (geral, segurança, git, firebase, node, bash), 6 relatórios,
  exportações, utilitários com confirmação.
- **Central de IAs** (Fase 10) — governança multi-IA somente-leitura:
  dashboard, registro de fases/IAs declarativo, responsabilidades,
  histórico via git log real, auditorias, estatísticas.
- **Configurações** (Fase 11) — status somente-leitura de
  Backup/Git/Firebase/Banco + preferências locais persistidas
  (`config/local.json`), validação de persistência, import/export/reset.
- **Manutenção e Higienização** (Fase 9) — scanner de
  órfãos/vazios/backups/logs/temporários, código morto, duplicados,
  dependências, limpeza assistida com dry-run, snapshot, `_trash/`
  recuperável, confirmação dupla e 17 checks de validação pré-execução.

### Framework

- Manifesto único de módulos (`config/modules.conf`) — menu principal
  nunca hardcoded.
- Componentes de UX compartilhados (`lib/ui-*.sh`): moldura responsiva
  (40–200 colunas, teto 60), cores ANSI com degradação, breadcrumb,
  rodapé, confirmação, submenu dinâmico (`Voltar` = N+1, `0` = Sair).
- Log central (`logs/control-center.log`), estado por módulo
  (`state/*.json`), exportações em `_reports/` (nunca versionadas).

### Corrigido durante a certificação (destaques)

- **Segurança (crítico, latente)**: lógica invertida de remoção na
  Manutenção — arquivo protegido seria excluído permanentemente;
  corrigida com defesa em profundidade (tudo vai para `_trash/`).
- **Framework**: EOF no stdin travava menu principal/submenus em loop
  infinito (causa real dos "ENOBUFS" da suíte).
- Fases 6/7: `menu.sh` placeholder desconectado do backend implementado;
  Fase 7 com "0=Voltar" divergente e Auditoria de Segurança travando
  (`node_modules` não excluído dos `find`).
- Fase 9 ausente do Manifesto (inacessível); persistência de estado das
  Fases 7/9 nunca implementada; teste dependente de locale inglês.

### Qualidade na certificação

158/158 testes automatizados; ShellCheck 0 erros em 104 scripts;
abertura em 0,14s (~9MB RSS); compatível com Ubuntu, Bash, Git, Node,
Firebase CLI, UTF-8, TERM=dumb e terminais de 40 a 200 colunas.

## [1.0.0-alpha] — 2026-07-11

Fases 1–5 e 10: estrutura base, UX do terminal, Manifesto, plugin
loader, Desenvolvimento/Release, Backup, Banco de Dados,
Branches e Sincronização, Central de IAs.
