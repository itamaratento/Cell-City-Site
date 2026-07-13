```
======================================================================
CELL CITY GESTÃO
VERSÃO 2.0

SPRINT 001
INICIALIZAÇÃO DA ARQUITETURA

IA RESPONSÁVEL:
Claude

FUNÇÃO NESTA SPRINT:
Arquiteto Principal da Sprint (papel excepcional, restrito a este
documento — ver nota de governança abaixo)

VERSÃO:
V2.0-INIT-001

MODO:
AUTÔNOMO — SOMENTE PLANEJAMENTO, ZERO ALTERAÇÃO DE CÓDIGO

DATA:
2026-07-12
======================================================================
```

> **Nota de governança.** Por `ENGINEERING.md`, Claude atua como **Revisor
> Técnico Principal** — não como arquiteto/estrategista do projeto. Este
> documento é uma exceção pontual, autorizada explicitamente pelo dono
> para esta Sprint 001, com escopo travado em **diagnóstico e proposta**.
> Nenhuma linha de código, Firestore Rule, índice ou configuração de
> infraestrutura foi alterada para produzi-lo. Toda a Seção 5 em diante é
> **proposta sujeita a aprovação do CTO (ChatGPT) e do dono** — não é
> decisão tomada.
>
> Este documento não teve uma missão de negócio pré-definida para a
> V2.0. Por instrução explícita do dono, a missão proposta no Capítulo 1
> foi **derivada exclusivamente da auditoria real do repositório**
> (Capítulos 2–3), não de suposições. Onde a evidência não permite
> concluir algo com segurança, isso está marcado como **em aberto**.

---

## Sumário

1. Missão da Sprint
2. Estado Atual do Projeto
3. Auditoria Técnica
4. Arquitetura Atual
5. Arquitetura Proposta (opções para decisão do CTO)
6. Plano de Migração
7. Análise de Riscos
8. Plano da Sprint 001
9. Documentação Obrigatória
10. Critérios de Encerramento

---

## 1. Missão da Sprint

### 1.1 O que esta Sprint 001 é

Produzir um diagnóstico verificável do estado real do Cell City Gestão
Operacional — código, arquitetura, dívida técnica, governança — e, a
partir dele, propor ao CTO e ao dono **para onde a V2.0 deveria olhar
primeiro**. Nenhuma decisão de arquitetura é tomada aqui; este documento
gera as opções e a evidência para que a decisão seja tomada por quem
tem mandato para tomá-la (ver `ENGINEERING.md`).

### 1.2 O que esta Sprint 001 não é

- Não é a especificação da V2.0.
- Não é um plano de implementação.
- Não altera `PROXIMA_ETAPA.md`, `HISTORICO_PROJETO.md` ou
  `MASTER_ROADMAP.md` — esses arquivos descrevem o estado atual
  homologado; este documento descreve uma proposta futura condicional.
- Não propõe reabrir SaaS multiempresa. Essa iniciativa já foi tentada e
  revertida (rollback de 2026-06-27, nunca refeita) e não há, até o
  momento desta auditoria, nenhum novo mandato de negócio registrado
  para retomá-la. Reabrir esse assunto exigiria decisão explícita do
  dono, fora do escopo desta Sprint.

### 1.3 Missão proposta para a V2.0 (a validar)

Como não havia briefing de negócio prévio, a missão abaixo foi
**derivada de três lacunas concretas e verificadas** durante a auditoria
(detalhadas no Capítulo 3):

1. **Duas arquiteturas paralelas no mesmo repositório, sem integração
   formal.** O CRM (produto entregue ao cliente: Firebase/Firestore,
   GitHub Pages, governado por `ENGINEERING.md`) e o Cell City Control
   Center (ferramenta interna de operação em bash, v1.0.0, 10 módulos,
   governança própria via documentos `CCC-*`) convivem no mesmo
   repositório, com o mesmo histórico de commits, mas **zero menção
   cruzada** em `MASTER_ROADMAP.md`, `PROXIMA_ETAPA.md` ou
   `ENGINEERING.md`.
2. **Dívida técnica crítica ainda sem correção**, cabeçalho de maior
   risco do projeto desde 2026-07-03 (chave de service account vazada e
   ainda ativa em produção) convivendo com uma dívida estrutural de
   cobertura de testes (27 de 34 módulos de `CRM/pages` sem nenhum teste
   automatizado).
3. **Documentos de continuidade desatualizados em relação ao git real.**
   `PROXIMA_ETAPA.md` — o arquivo que toda sessão nova deve ler antes de
   agir — tem sua última atualização registrada em 2026-07-10, mas o
   repositório já avançou mais de 30 commits desde então, incluindo a
   conclusão inteira do Control Center (Fases 4 a 11) sem nenhum
   registro nesse arquivo.

**Proposta de missão:** a V2.0 deveria começar por **consolidar o que já
existe** — unificar (ou documentar formalmente por que não unificar) a
governança dos dois sistemas, fechar a dívida crítica de segurança
pendente, e realinhar a documentação de continuidade ao estado real —
antes de qualquer nova camada de arquitetura ou funcionalidade. Isso é
uma proposta, não uma conclusão: o Capítulo 5 apresenta as opções
concretas para o CTO decidir.

---

## 2. Estado Atual do Projeto

Levantamento feito por leitura direta do repositório em
`/home/cellcity/Músicas/projetos/Cell-City-Site` (git, sem alterações),
em 2026-07-12.

### 2.1 Repositório e ambientes

| Item | Estado verificado |
|---|---|
| Repositório | `Cell-City-Site` (GitHub: `itamaratento/Cell-City-Site`) |
| `main` | `1c0c12e` |
| `develop` | `45a86a6` — **1 commit** à frente de `main` (`docs(control-center)`, sem código) |
| Working tree | limpo (sem alterações pendentes) |
| Produção | `https://www.cellcityinformatica.com.br/` via GitHub Pages, branch `main` |
| Homologação | `https://www.cellcityinformatica.com.br/dev/`, branch `develop` |
| Backend | Firebase **Blaze** desde 2026-07-04, dois projetos isolados: `cellcity-crm` (prod) / `cellcity-crm-dev` (dev) |
| Publicação | exclusivamente via `git push` + `deploy-pages.yml`. Firebase Hosting **proibido** ([[feedback-hosting-github-only]]) |

### 2.2 CRM — inventário de módulos

- **34 diretórios** em `CRM/pages/` — 32 operacionais + 2 placeholders
  reservados (`estrategia`, `em-breve`), consistente com o registro em
  `PROXIMA_ETAPA.md`.
- **Repository Layer:** 18 arquivos em `CRM/repositories/` (`base` +
  17 específicos: caixa, central-organizacao, central, chips, clientes,
  crm, diario, empresas, estoque, financeiro, fornecedor, os, portal,
  posvenda, produtos, sistema, usuarios). O `saas.repository.js` órfão
  (herança do multiempresa revertido) foi removido em 2026-07-10 —
  contagens anteriores de "20 repositórios" em registros mais antigos
  estão desatualizadas por esse motivo.
- **RBAC:** duas camadas convivendo intencionalmente — `perfil` legado
  (`kernel.js`) e `perfil_operacional_id` (matriz `perfis_operacionais`,
  ampliada de 9 para 25 gates gerenciáveis em 2026-07-11).
- **Testes:** 13 arquivos `*.test.js` no repositório (fora de
  `_BACKUPS/`), cobrindo RBAC, Firestore Rules, Cloud Functions,
  performance, observabilidade (integridade imports/refs/coleções×rules)
  e o backend do Portal do Cliente. Os números de "casos aprovados"
  citados no histórico (ex.: "RBAC 156/156") são asserções dentro dessas
  suítes, não arquivos adicionais — é importante não confundir as duas
  métricas.
- **CI:** 3 workflows (`deploy-pages.yml`, `tests.yml`,
  `backup-weekly.yml`).

### 2.3 Cell City Control Center — inventário

- Ferramenta de linha de comando (bash) em `scripts/control-center/`,
  **v1.0.0** (2026-07-12), certificada por `CCC-V1.0-FINAL-001` e
  homologada por `CCC-V1.0-RELEASE-001`.
- **10 módulos, zero placeholders:** Desenvolvimento, Release, Backup e
  Recuperação, Banco de Dados, Branches e Sincronização, Diagnóstico e
  Health Check, Ferramentas/Auditorias/Relatórios, Manutenção e
  Higienização, Central de IAs, Configurações.
- Governança própria: documentos `CCC-F0X-*`, `PARECER-CCC-HOM-*`,
  changelog e versão semântica isolados de `HISTORICO_PROJETO.md` e de
  `MASTER_ROADMAP.md`.
- **Não é servido ao cliente final** — roda localmente, fora do runtime
  do CRM. Não está sujeito, hoje, a nenhuma cláusula do `ENGINEERING.md`
  (que fala apenas de Kernel, Repository Layer, Firebase/Firestore,
  Cloud Functions, ES Modules, MPA).

### 2.4 Governança das IAs (vigente)

Confirmada em `ENGINEERING.md` v1.1 (adicionado ao repo em 2026-07-11,
commit `cd72795`): ChatGPT = CTO/estratégia (não desenvolve, não
revisa), Claude = Revisor Técnico Principal (audita, testa, aprova
`develop→main`, não define estratégia por iniciativa própria — daí a
nota de exceção no topo deste documento), DeepSeek = desenvolvimento em
`develop` (nunca promove para `main`).

---

## 3. Auditoria Técnica

Achados consolidados a partir de `GUIA_MANUTENCAO.md` §5 (revisão de
2026-07-06), `HISTORICO_PROJETO.md`, `PROXIMA_ETAPA.md` e leitura direta
do repositório em 2026-07-12. Cada item indica se foi **reverificado**
nesta auditoria ou se permanece com a data da última verificação
conhecida.

### 3.1 Crítico — sem correção

1. 🔴 **Chave de service account vazada em commit antigo (2026-06-25),
   confirmada ainda ATIVA em produção.** Repositório público, achado
   conhecido desde 2026-07-03, nunca rotacionada. Maior risco de
   segurança do projeto. Detalhe técnico e comando de remediação em
   `plans/AUDITORIA_GERAL_20260706_INTERNO.md` (gitignored — não
   reaberto neste documento por ser informação sensível). **Não
   reverificado nesta auditoria** (verificação exigiria acesso ao
   console GCP, fora do escopo de leitura de arquivos).

### 3.2 Infraestrutura / ambientes

2. `firestore.rules`/`firestore.indexes.json` da raiz divergem da fonte
   oficial `CRM/…` — confirmado presente em 2026-07-06, **não
   reverificado agora**.
3. `firebase.json` ainda contém seção `hosting`, apesar de o Hosting ser
   proibido — pendente de autorização para remoção.
4. `plans/`, `CLAUDE.md` e `CRM/pages/kernel-test/` seguem publicados ao
   vivo no GitHub Pages (`deploy-pages.yml` não os exclui do `rsync`).
   `_BACKUPS/` está gitignored e não é publicado.
5. `backup-dados.js` não exporta `usuarios`, `perfis_operacionais`,
   `auditoria_usuarios_permissoes` e outras coleções pós-RBAC.
6. 74 arquivos com paths absolutos `/CRM/` identificados originalmente;
   vários casos individuais corrigidos ponto a ponto (H-003 a H-009,
   `dashboard-alarme-os.js` em 2026-07-10) — **não confirmado se a lista
   completa foi zerada**.
7. `localStorage` compartilhado entre `/` (produção) e `/dev`
   (mesma origem) — não reverificado.

### 3.3 Aplicação

8. Condição de corrida na coluna "Perfil" da aba Usuários — pendência
   formal da Fase 2 do RBAC, não reverificada.
9. Card da Agenda ausente no Dashboard — ✅ **corrigido em 2026-07-10**
   (commit da correção do item, `RBAC_CARD_PARA_MODULO_ID` ampliado).
10. Módulo Análise possivelmente quebrado (`analise.js` não usa
    `initModulo()`/nenhum gate de auth) — confirmado em 2026-07-06, não
    reverificado desde então.
11. **4 coleções sem nenhuma Firestore Rule** (`alertas_usuario`,
    `chips_cadastros`, `diario_eventos`, `contas_numeros`) — sem
    catch-all, falham fechado (bug funcional, não vazamento).
12. Matriz RBAC gerenciável ampliada de 9 → 25 módulos em 2026-07-11 —
    ✅ resolve o achado antigo de "16 gates fail-open sem UI de gestão".
    Pendência residual: perfis já existentes no Firestore não têm
    entrada automática para os 16 módulos novos — continuam fail-open
    até ajuste manual do admin (comportamento conservador, esperado).
13. Código morto: `CRM/shared/tenant.js` e
    `CRM/shared/listener-manager.js` sem nenhum importador real;
    diretórios/arquivos `BACKUP_*` dentro do webroot (servidos por não
    haver build step). `saas.repository.js` já removido (2026-07-10).
14. **Cobertura de teste:** 27 de 34 módulos de `CRM/pages` sem nenhum
    teste automatizado (confirmado por contagem de arquivos `*.test.js`
    nesta auditoria — consistente com o registro de 2026-07-07). CI
    mínima existe e roda em push/PR, mas cobre só as suítes já escritas.
15. `os.list` aberto a qualquer sessão autenticada nas Firestore Rules —
    **decisão deliberada e documentada** (`CRM/TECHDOC.md` §19.5),
    pendência formal da Sprint 1b, não um bug esquecido.

### 3.4 Governança e documentação (achado novo desta auditoria)

16. **`PROXIMA_ETAPA.md` desatualizado.** Última atualização registrada:
    2026-07-10 ("Rules corrigidas ainda não deployadas" como próxima
    tarefa). O git log mostra 33+ commits depois disso — incluindo toda
    a construção e certificação do Control Center v1.0 (Fases 4–11) —
    sem nenhuma atualização desse arquivo. Como a regra permanente do
    projeto manda toda sessão nova ler `PROXIMA_ETAPA.md` primeiro,
    existe risco real de decisão tomada sobre uma foto desatualizada do
    projeto.
17. **Control Center sem cobertura de governança formal.** Não há
    nenhuma menção ao Control Center em `ENGINEERING.md`,
    `MASTER_ROADMAP.md` ou `PROXIMA_ETAPA.md`. Isso não é
    necessariamente um erro — pode ser uma decisão implícita correta
    (é uma ferramenta interna, não o produto) — mas não está
    **documentada como decisão**, o que a deixa sujeita a ser
    "descoberta" de novo em auditorias futuras, como aconteceu aqui.

### 3.5 Resumo por severidade

| Severidade | Quantidade | Exemplos |
|---|---|---|
| 🔴 Crítico, sem correção | 1 | Chave de service account vazada e ativa |
| 🟡 Infraestrutura pendente | 6 | Rules duplicadas, hosting proibido ainda configurado, publicação indevida de `plans/` |
| 🟡 Aplicação pendente | 5 | Análise possivelmente quebrado, 4 coleções sem Rule, condição de corrida |
| 🟢 Aplicação resolvida recentemente | 3 | Card Agenda, matriz RBAC 25 gates, `saas.repository.js` removido |
| 🟠 Governança/documentação | 2 (achado novo) | `PROXIMA_ETAPA.md` desatualizado, Control Center sem governança formal |

---

## 4. Arquitetura Atual

```
┌─────────────────────────────────────────────────────────────┐
│  Cell-City-Site (1 repositório git)                          │
│                                                               │
│  ┌───────────────────────────┐   ┌─────────────────────────┐ │
│  │   CRM (produto)           │   │  Control Center (interno)│ │
│  │   CRM/                    │   │  scripts/control-center/ │ │
│  │                           │   │                          │ │
│  │  MPA + ES Modules          │   │  CLI bash, 10 módulos    │ │
│  │  sem build step/bundler   │   │  roda local, fora do     │ │
│  │                           │   │  runtime do CRM          │ │
│  │  shared/ (kernel.js,      │   │                          │ │
│  │  firebase.js, permissoes  │   │  Governança própria:     │ │
│  │  .js, brand-header.js…)   │   │  docs CCC-*, VERSION,    │ │
│  │                           │   │  CHANGELOG próprios      │ │
│  │  Repository Layer         │   │                          │ │
│  │  (18 repos, factory       │   │  Envelopa: backup/       │ │
│  │  genérica) → Firestore    │   │  release/diagnóstico/    │ │
│  │                           │   │  branches (chama scripts │ │
│  │  RBAC 2 camadas:          │   │  já existentes do CRM)   │ │
│  │  perfil legado (kernel)   │   │                          │ │
│  │  + perfil_operacional_id  │   │                          │ │
│  │  (perfis_operacionais)    │   │                          │ │
│  │                           │   │                          │ │
│  │  34 módulos (32 op + 2    │   │                          │ │
│  │  placeholder)             │   │                          │ │
│  └──────────┬────────────────┘   └────────────┬─────────────┘ │
│             │                                  │               │
│             ▼                                  ▼               │
│   Firebase (Auth/Firestore/Storage/CF)   git/gh CLI, backups   │
│   2 projetos isolados: cellcity-crm      locais, Firebase CLI  │
│   (prod, Blaze) / cellcity-crm-dev (dev) (via gcloud)          │
└─────────────────────────────────────────────────────────────┘
             │
             ▼
   GitHub Pages (único hosting permitido)
   main → produção · develop → /dev/
```

Governança formal (`ENGINEERING.md`) cobre explicitamente apenas o lado
esquerdo do diagrama (CRM). O lado direito (Control Center) existe,
está em produção (v1.0.0) e compartilha o mesmo repositório e o mesmo
processo de release, mas não é mencionado nos documentos estratégicos.

---

## 5. Arquitetura Proposta (opções para decisão do CTO)

Nenhuma opção abaixo está decidida. São alternativas concretas,
derivadas diretamente dos achados do Capítulo 3, para o CTO (ChatGPT) e
o dono escolherem — ou rejeitarem todas em favor de outra direção que
só eles têm mandato para definir.

### 5.1 Sobre a relação CRM ↔ Control Center

- **Opção A — Unificar a governança.** Trazer o Control Center para
  dentro do `ENGINEERING.md`/`MASTER_ROADMAP.md` como um componente
  formal do projeto (ex.: nova seção "Ferramentas Internas"), com as
  mesmas regras de autorização para alterar componentes críticos.
  Vantagem: uma única fonte de verdade sobre tudo que existe no
  repositório. Custo: mais um documento estratégico para manter
  sincronizado.
- **Opção B — Manter separado, mas documentar a decisão.** Registrar
  explicitamente em `MASTER_ROADMAP.md` (ou em um novo
  `plans/DECISAO_GOVERNANCA_CONTROL_CENTER.md`) que o Control Center é
  deliberadamente independente por ser uma ferramenta interna sem
  impacto no produto entregue ao cliente. Vantagem: menor esforço,
  resolve o achado 3.4.17 sem reestruturar nada. Custo: nenhum, além do
  próprio documento de decisão.

### 5.2 Sobre a dívida técnica crítica

- **Pré-requisito recomendado, independente da opção 5.1 escolhida:**
  tratar a rotação da chave de service account vazada (achado 3.1.1)
  como item bloqueante antes de abrir qualquer sprint de arquitetura
  nova para a V2.0. É o único item classificado como crítico e ativo
  há mais de uma semana sem correção.

### 5.3 Sobre a documentação de continuidade

- Antes de abrir a Sprint 002 (execução da V2.0, qualquer que seja a
  direção escolhida), atualizar `PROXIMA_ETAPA.md` para refletir o
  estado real pós-Control-Center-v1.0, para que a V2.0 não nasça sobre
  uma foto de 2026-07-10.

### 5.4 Fora de escopo desta proposta

- SaaS/multiempresa: não reaberto (ver 1.2).
- Qualquer nova funcionalidade de produto para o cliente final: nenhuma
  foi levantada nesta auditoria porque nenhuma foi solicitada — a
  política vigente em `PROXIMA_ETAPA.md` §"POLÍTICA DE NOVOS
  DESENVOLVIMENTOS" já proíbe abrir sprints sem um dos três gatilhos
  (bug em uso, requisito de negócio, item de roadmap aprovado).

---

## 6. Plano de Migração

**Não escrito nesta Sprint 001.** Um plano de migração pressupõe uma
arquitetura-alvo já escolhida. Como o Capítulo 5 apresenta opções, e
não uma decisão, este capítulo fica proposto para a **Sprint 002**,
a ser aberta somente depois que o CTO/dono decidirem entre as opções de
5.1 (ou outra direção). Escrever um plano de migração agora seria
antecipar uma decisão que não é desta Sprint.

---

## 7. Análise de Riscos

| Risco | Estado | Impacto se não tratado |
|---|---|---|
| Chave de service account vazada segue ativa | 🔴 Crítico, aberto desde 2026-07-03 | Acesso administrativo total ao Firebase por terceiro, a qualquer momento |
| V2.0 iniciar sobre `PROXIMA_ETAPA.md` desatualizado | 🟠 Real, verificado nesta auditoria | Decisões de arquitetura tomadas sem considerar o Control Center v1.0 já em produção |
| Control Center evoluir sem as mesmas travas do `ENGINEERING.md` | 🟠 Real (achado novo) | Alterações em componentes críticos (ex. Release, Backup) sem o mesmo rigor de autorização exigido para o CRM |
| Reabrir dívida técnica antiga "de passagem" durante a V2.0 | 🟡 Mitigável | `GUIA_MANUTENCAO.md` já orienta: cada item de dívida exige processo formal próprio, não deve ser corrigido incidentalmente |
| Sessões concorrentes editando os mesmos documentos estratégicos | 🟡 Já ocorreu no passado ([[feedback-concorrencia-sessoes-checkout]]) | Colisão de edição em `PROXIMA_ETAPA.md`/`HISTORICO_PROJETO.md` se Sprint 002 rodar em paralelo a outra sessão |
| 27/34 módulos sem teste automatizado | 🟡 Estrutural, conhecido | Qualquer refatoração de arquitetura na V2.0 corre sem rede de segurança na maioria dos módulos |

---

## 8. Plano da Sprint 001

| Etapa | Status |
|---|---|
| Localizar o repositório e confirmar estado do git | ✅ Concluído |
| Inventariar módulos, Repository Layer, Control Center | ✅ Concluído |
| Auditar dívida técnica conhecida (`GUIA_MANUTENCAO.md`) e reconciliar com o git log atual | ✅ Concluído |
| Identificar lacunas de governança não documentadas | ✅ Concluído — achado 3.4 |
| Produzir a missão proposta da V2.0 a partir da evidência | ✅ Concluído — Capítulo 1.3 |
| Apresentar opções de arquitetura (não decidir) | ✅ Concluído — Capítulo 5 |
| Entregar este documento para leitura do dono/CTO | ✅ Este documento |
| Decisão do CTO/dono sobre as opções do Capítulo 5 | ⏳ Pendente — próxima ação |
| Abrir Sprint 002 (arquitetura definida + plano de migração) | ⏳ Bloqueado até a decisão acima |

---

## 9. Documentação Obrigatória

- Este documento vive em `plans/SPRINT_V2_INIT_001_INICIALIZACAO_ARQUITETURA.md`,
  seguindo a convenção já usada para planejamento pontual (ex.:
  `plans/PLANO_DIRETOR_PROXIMA_FASE_20260704.md`,
  `plans/SPRINT_1A_PLANO_IMPLANTACAO_PRODUCAO.md`).
- **Não altera** `PROXIMA_ETAPA.md`, `HISTORICO_PROJETO.md` ou
  `MASTER_ROADMAP.md` — esses continuam descrevendo o estado
  homologado atual. Uma vez que o CTO/dono decidam sobre o Capítulo 5,
  a referência a este documento deve ser adicionada ao
  `MASTER_ROADMAP.md` (mesmo padrão usado para os ciclos de auditoria
  anteriores), e só então `PROXIMA_ETAPA.md` deve ser atualizado com a
  nova tarefa decidida.
- Se a decisão envolver rotacionar a chave de service account (5.2),
  isso deve ser registrado como incidente de segurança formal — mesmo
  padrão já usado para o incidente de credencial encerrado anteriormente
  no projeto — e não apenas como uma linha de checklist.

---

## 10. Critérios de Encerramento

A Sprint 001 é considerada encerrada quando, **nesta ordem**:

1. O dono e/ou o CTO confirmarem que o diagnóstico dos Capítulos 2–4
   está correto e completo (ou apontarem o que falta).
2. Uma decisão explícita for tomada entre as opções do Capítulo 5.1
   (ou outra direção proposta por quem tem mandato de arquitetura).
3. A chave de service account vazada (3.1.1) for rotacionada, **ou** o
   risco de mantê-la ativa for formalmente aceito por escrito pelo
   dono — dado que segurança é um dos seis pilares do `ENGINEERING.md`
   e este é o único achado crítico sem correção.
4. Autorização explícita for dada para abrir a Sprint 002, já com a
   arquitetura-alvo definida e o plano de migração (Capítulo 6) como
   seu primeiro entregável.

Até que os quatro critérios acima sejam satisfeitos, nenhuma
implementação de V2.0 deve começar.
