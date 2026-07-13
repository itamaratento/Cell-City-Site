```
======================================================================
CELL CITY GESTÃO
VERSÃO 2.0

DOCUMENTO CCC-V2.0-ARCH-001
ARQUITETURA OFICIAL DO SISTEMA DE GESTÃO CELL CITY V2.0

IA RESPONSÁVEL:
Claude

FUNÇÃO NESTA SPRINT:
Arquiteto Principal da Sprint V2.0 (papel escolhido pelo responsável do
projeto para esta Sprint, não cargo permanente — ver nota abaixo e
Seção 17)

MODO:
AUTÔNOMO — SOMENTE ARQUITETURA. ZERO CÓDIGO, ZERO BANCO, ZERO DEPLOY.

DATA:
2026-07-12

PRECEDIDO POR:
`plans/SPRINT_V2_INIT_001_INICIALIZACAO_ARQUITETURA.md` (V2.0-INIT-001)
======================================================================
```

> **Nota sobre a autoria deste documento.** Este é o segundo documento
> desta Sprint V2.0 em que quem responde pelo projeto escolhe uma IA
> para atuar na função de arquitetura — uma escolha **operacional**,
> feita Sprint a Sprint, não uma atribuição permanente de cargo (ver
> Seção 17, "Governança das Inteligências Artificiais", que passa a
> reger este ponto de forma vendor-neutra a partir deste documento).
> Quem revisar este documento depois — outra IA ou o próprio
> responsável do projeto — deve tratá-lo como uma proposta técnica, não
> como algo pré-aprovado pela função de estratégia só por ter sido
> produzido nesta Sprint.
>
> Este documento também **reabre formalmente** uma decisão anterior:
> o SaaS multiempresa foi implementado às pressas em 2026-06-24/25,
> causou instabilidade real em produção (autenticação duplicada, service
> worker derrubando sessões) e foi revertido por completo em
> 2026-06-27 ([[project-saas-multiempresa]], [[project-base-estavel-20260627]]).
> Isso não é tratado aqui como impedimento — o responsável do projeto
> pediu explicitamente para reabrir o assunto — mas como **lição a não
> repetir**: a Seção 8 trata SaaS como projeto novo, não como retomada
> do código antigo.

---

## Sumário

1. Missão
2. Relação com a INIT-001
3. Objetivos obrigatórios — checklist de cobertura
4. Inventário verificado (o que já existe vs. o que precisaria ser criado)
5. Arquitetura oficial proposta
6. Organização por grupos funcionais
7. Terminal Ubuntu — Control Center como console oficial
8. SaaS — arquitetura de preparação
9. Central de IA — decisão em aberto
10. Site Institucional
11. API
12. Governança unificada
13. Entregáveis
14. Restrições
15. Registro de decisões arquiteturais (ADR)
16. Roadmap técnico macro
17. Governança das Inteligências Artificiais
18. Critérios de encerramento

---

## 1. Missão

Definir, a partir dos achados verificados da INIT-001 e de um novo
levantamento direto do repositório, **uma arquitetura única e oficial**
para todo o ecossistema Cell City — não apenas o CRM — que passe a ser
a referência de todas as sprints futuras, incluindo uma eventual
comercialização como produto SaaS.

Este documento propõe. Não decide sozinho os pontos de maior peso de
negócio (SaaS, escopo da Central de IA) — esses ficam registrados como
ADRs pendentes de aprovação do CTO e do dono (Seção 15). Decide, sim,
a organização estrutural e a governança, por serem consequência direta
e técnica dos achados da INIT-001.

## 2. Relação com a INIT-001

A INIT-001 (Capítulo 5) apresentou duas lacunas centrais: (a) CRM e
Control Center são arquiteturas paralelas sem governança comum, e (b)
não havia mandato de negócio para tratar de SaaS. Este documento resolve
(a) diretamente (Seção 12) e trata (b) como mandato agora concedido
pelo dono, com a ressalva histórica da nota sobre a autoria deste
documento, acima.

O achado crítico da INIT-001 (chave de service account vazada e ativa)
**continua sem correção** e continua sendo pré-requisito bloqueante
antes de qualquer execução desta arquitetura (reafirmado na Seção 14).

## 3. Objetivos obrigatórios — checklist de cobertura

| Objetivo pedido | Onde é tratado neste documento |
|---|---|
| Ler a documentação existente e considerar a INIT-001 | Seções 2 e 4 |
| Definir arquitetura única para o ecossistema | Seção 5 |
| Eliminar arquiteturas paralelas | Seção 12 (governança unificada) |
| Definir governança | Seção 12 |
| Definir organização por grupos | Seção 6 |
| Definir manutenção/gerenciamento por grupos | Seção 6.3, Seção 7 |
| Definir preparação para SaaS | Seção 8 |
| Definir integração do Control Center | Seção 7 |
| Definir integração da Central de IA | Seção 9 |
| Definir integração do Site | Seção 10 |
| Definir integração do Portal do Cliente | Seção 6.2, Seção 11 |
| Definir integração da API | Seção 11 |

## 4. Inventário verificado

Antes de propor qualquer coisa, o que **já existe** no repositório
(verificado por leitura direta em 2026-07-12, não por suposição):

| Componente do diagrama pedido | Existe hoje? | Onde |
|---|---|---|
| **Sistema Web** (CRM) | ✅ Sim, maduro | `CRM/pages/` — 34 módulos (32 operacionais + 2 placeholder) |
| **Control Center** (Terminal Ubuntu) | ✅ Sim, v1.0.0 certificado | `scripts/control-center/` — 10 módulos |
| **Portal do Cliente** | ✅ Sim | `CRM/pages/portal-cliente/` — já é um módulo do Sistema Web, não um sistema separado |
| **Site Institucional** | ✅ Sim, e já é público | `index.html` + `catalogo.html` na **raiz** do repositório — landing page de marketing (SEO, Goiânia) e catálogo público, servidos no domínio raiz (`cellcityinformatica.com.br/`), fisicamente separados de `/CRM/` |
| **API** | ✅ Sim, mas só interna | `functions/index.js` (Firebase Cloud Functions) — hoje consumida só pelo próprio CRM/Portal, nunca exposta como API pública versionada |
| **Central de IA** | 🟡 Parcial | Existe **dentro** do Control Center (Fase 10, `scripts/control-center/modules/central-ias`) — é uma ferramenta de apoio à equipe de desenvolvimento (orquestra sessões de IA), **não** é uma capacidade voltada ao cliente final nem ao ecossistema como um todo |
| **SaaS multiempresa** | ❌ Não existe | Removido no rollback de 2026-06-27; `empresa_id` sobrevive só como campo vestigial em 2 arquivos (`kernel.js`, `caixa.js`), sem isolamento funcional |
| **Serviços Compartilhados** | ✅ Sim, já é o padrão do projeto | `CRM/shared/*` (kernel, firebase, permissoes, brand-header) + `CRM/repositories/*` (Repository Layer, 18 repositórios) |

**Conclusão do inventário:** a maior parte do diagrama pedido pelo dono
**já existe fisicamente** — o que falta não é construir esses seis
componentes do zero, é **reconhecê-los formalmente como componentes de
primeira classe** do ecossistema, unificar a governança entre eles, e
decidir o que fazer com as duas peças que de fato não existem hoje
(SaaS e uma Central de IA voltada ao ecossistema, não só ao Control
Center).

---

## 5. Arquitetura oficial proposta

```
CELL CITY GESTÃO — ARQUITETURA V2.0 (proposta)

├── Sistema Web  [existe — CRM/]
│     ├── Atendimento
│     ├── Comercial
│     ├── Financeiro
│     ├── Estoque
│     ├── Administração
│     ├── Infraestrutura
│     └── Inteligência
│
├── Control Center  [existe — scripts/control-center/, v1.0.0]
│     └── console oficial de administração (Seção 7)
│
├── Portal do Cliente  [existe — hoje é CRM/pages/portal-cliente/]
│     └── permanece fisicamente dentro do Sistema Web nesta fase;
│         reconhecido no diagrama por ser a superfície voltada ao
│         cliente final, com ciclo de vida próprio (Seção 6.2)
│
├── Site Institucional  [existe — index.html, catalogo.html na raiz]
│     └── Seção 10
│
├── API  [existe — functions/index.js]
│     └── Seção 11
│
├── Central de IA  [parcial — existe dentro do Control Center]
│     └── decisão em aberto, Seção 9
│
├── SaaS  [não existe — preparação, Seção 8]
│
└── Serviços Compartilhados  [existe — CRM/shared/, CRM/repositories/]
```

Diferença deliberada em relação ao diagrama sugerido pelo dono: o
Portal do Cliente é mostrado como um ramo próprio no diagrama (por ser
a superfície de maior exposição externa), mas **continua fisicamente
dentro do Sistema Web** — não há justificativa técnica hoje para
extraí-lo como projeto separado, e fazer isso sem motivo violaria a
regra do `ENGINEERING.md` ("não criar complexidade sem necessidade").
Se um dia precisar de ciclo de deploy independente (ex.: app mobile do
cliente), essa extração vira uma decisão técnica específica, não uma
consequência automática deste documento.

---

## 6. Organização por grupos funcionais

### 6.1 Os 7 grupos

Adotados exatamente como propostos pelo dono: **Atendimento, Comercial,
Financeiro, Estoque, Administração, Infraestrutura, Inteligência.**

### 6.2 Mapeamento de todos os 34 módulos do Sistema Web

Nenhum módulo fica sem grupo. Mapeamento proposto (sujeito a validação
do CTO — é uma leitura funcional, não uma verdade absoluta):

| Grupo | Módulos |
|---|---|
| **Atendimento** | Ordem de Serviço (`os`), Portal do Cliente (`portal-cliente`), Portal Técnico (`portal-tecnico`), Autoatendimento (`autoatendimento`), Pós-Venda (`pos-venda`), Chat (`chat`, hoje desativado), Garantia (`garantia.html`), Minha Semana (`minha-semana`) |
| **Comercial** | CRM Comercial (`crm-comercial`), Clientes (`clientes`), Catálogo (`catalogo`), Campanhas (`campanhas`), Ação da Semana (`acaodasemana`) |
| **Financeiro** | Financeiro (`financeiro`), Caixa (`caixa`), Contas (`contas`) |
| **Estoque** | Estoque (`estoque`), Compras (`compras`), Fornecedor (`fornecedor`) |
| **Administração** | Usuários e Permissões (`usuarios-permissoes`), Configurações (`config`), Auditoria (`auditoria`), Importar (`importar`), Diário (`diario`), Central de Informações (`central-informacoes`), Central de Organização (`central-organizacao`) |
| **Infraestrutura** | Central de Módulos (`central-modulos`), Central de Comandos (`central-comandos`), Central de Alertas (`central-alertas`), Kernel Test (`kernel-test`) |
| **Inteligência** | Dashboard (`dashboard`), Relatórios (`relatorios`), Análise (`analise`) |
| **Sem grupo definitivo (placeholders)** | Estratégia (`estrategia`), Em Breve (`em-breve`) — sem funcionalidade real ainda; grupo será decidido quando (e se) forem especificados |

### 6.3 Os 10 módulos do Control Center pelos mesmos grupos

O Control Center é um ramo próprio no diagrama (Seção 5), mas seus
módulos também respondem aos mesmos 7 grupos funcionais — isso mantém
uma taxonomia única em todo o ecossistema, em vez de duas classificações
concorrentes:

| Grupo | Módulos do Control Center |
|---|---|
| Infraestrutura | Desenvolvimento, Release, Backup e Recuperação, Banco de Dados, Branches e Sincronização, Diagnóstico e Health Check, Manutenção e Higienização |
| Administração | Ferramentas/Auditorias/Relatórios, Configurações |
| Inteligência | Central de IAs |

### 6.4 Regra de organização daqui em diante

Toda funcionalidade nova, em qualquer um dos 8 ramos do diagrama da
Seção 5, deve declarar seu grupo funcional antes de ser aceita como
sprint — mesmo critério do `ENGINEERING.md` de não criar módulos sem
propósito, agora com um lugar definido para encaixar esse propósito.

---

## 7. Terminal Ubuntu — Control Center como console oficial

O Control Center (`scripts/control-center/`, v1.0.0) já cumpre, hoje,
o papel de console oficial de administração — confirmado por
inventário, não por proposta:

| Capacidade pedida | Módulo do Control Center que já cobre |
|---|---|
| Navegação | `core/menu.sh` |
| Gerenciamento | Desenvolvimento, Configurações |
| Manutenção | Manutenção e Higienização |
| Backups | Backup e Recuperação (envelopa o Sistema Oficial de Backup, repo `Cell-City-Backup`) |
| Releases | Release (envelopa `subir`/`release`/`subir-ok`/`rollback`) |
| Testes | Diagnóstico e Health Check (45 verificações) |
| Diagnósticos | Diagnóstico e Health Check, Banco de Dados (inspeção somente-leitura de Firestore/Rules/Functions) |
| Monitoramento | Ferramentas, Auditorias e Relatórios |
| Integrações com IA | Central de IAs |

**O que falta não é construir — é formalizar:** a única lacuna real
(achado 3.4.17 da INIT-001) é que nada disso está sob a mesma
constituição do `ENGINEERING.md` que rege o Sistema Web. A Seção 12
resolve isso.

---

## 8. SaaS — arquitetura de preparação

Tratado aqui como **preparação de arquitetura**, não como plano de
implementação (proibido pela Seção 14). Três princípios não-negociáveis,
derivados diretamente do incidente de 2026-06-27:

1. **Projeto novo, não retomada.** Nenhum código do multiempresa antigo
   (`pages/saas/`, `modulo-guard.js`, `tenant.js`) deve ser reaproveitado
   como base — foi construído às pressas e causou instabilidade real em
   produção. Se algo dele sobreviver na versão nova, deve ser por
   reavaliação técnica explícita, não por atalho.
2. **Isolamento de dados como decisão de arquitetura, não como campo
   opcional.** O modelo anterior (`empresa_id` como campo em documentos
   já existentes, filtro aplicado por convenção) é exatamente o padrão
   que falhou — hoje sobrevive como campo vestigial em só 2 arquivos,
   sem isolamento funcional real em nenhuma coleção. Qualquer novo
   desenho precisa decidir isolamento (schema separado, prefixo de
   coleção, ou projeto Firebase por tenant) **antes** de tocar em
   qualquer módulo existente.
3. **RBAC como pré-requisito, não como trabalho paralelo.** A Fase 2 do
   RBAC (matriz `perfis_operacionais`) é a única camada de permissões
   granular que o projeto tem hoje. SaaS multiempresa sem essa camada
   madura seria repetir a mesma classe de erro do incidente anterior
   (a versão de 2026-06-24/25 foi construída antes de o RBAC existir).

**Dimensões que a arquitetura de SaaS precisará decidir** (sem decidir
agora, ver ADR-004 na Seção 15): isolamento de dados, planos/limites,
licenciamento, gestão de atualização por tenant, cobrança. Cada uma
exige um documento de arquitetura próprio quando o CTO/dono autorizarem
avançar — este documento apenas define os três princípios acima como
inegociáveis para qualquer proposta futura.

---

## 9. Central de IA — decisão em aberto

Existe uma ambiguidade real que este documento não resolve sozinho
porque é decisão de produto, não técnica:

- **Leitura A — permanece interna.** "Central de IA" continua sendo o
  módulo do Control Center (Fase 10): uma ferramenta de apoio à equipe
  de desenvolvimento, sem exposição ao cliente final.
- **Leitura B — vira capacidade do ecossistema.** "Central de IA" passa
  a ser um componente cross-cutting que atende também o Sistema Web e o
  Portal do Cliente (ex.: automações de atendimento, agentes que operam
  módulos do CRM, IA voltada ao cliente) — nesse caso deixa de ser
  módulo do Control Center e vira o ramo próprio mostrado no diagrama da
  Seção 5.

O diagrama pedido pelo dono lista "Central de IA" como ramo separado —
o que sugere a Leitura B — mas isso tem implicações de segurança e RBAC
relevantes (agentes de IA operando módulos de produção exigiriam gates
próprios) que merecem decisão explícita, não inferência. Registrado como
ADR-005 (Seção 15).

---

## 10. Site Institucional

Já existe e já está no ar: `index.html` (landing de marketing/SEO) e
`catalogo.html` (catálogo público), ambos na raiz do repositório,
servidos junto com o CRM no mesmo domínio (`cellcityinformatica.com.br/`
para o site, `/CRM/` para o sistema).

**Papel institucional (já cumprido hoje):** captação de clientes via SEO
local (Goiânia), vitrine do catálogo, ponto de entrada para quem ainda
não é cliente.

**Login:** não existe login no Site Institucional hoje — o login vive em
`CRM/login.html`. Proposta: manter essa separação. Misturar autenticação
no site institucional aumentaria a superfície de ataque de uma página
pública de marketing sem ganho correspondente.

**Planos/documentação pública:** só fazem sentido como seção do Site se
e quando o SaaS (Seção 8) avançar o suficiente para ter planos
comerciais reais para anunciar. Prematuro hoje.

---

## 11. API

Já existe: `functions/index.js` (Firebase Cloud Functions, ~25 funções
segundo o histórico do projeto), consumida hoje **só internamente**
pelo próprio Sistema Web e pelo Portal do Cliente — não há API pública
documentada, versionada ou com chaves de acesso para terceiros.

**Proposta:** não transformar em "API pública" agora. Não há hoje
nenhum consumidor externo real, e o `ENGINEERING.md` proíbe criar
capacidade sem necessidade. Se o SaaS (Seção 8) avançar e precisar de
integrações de terceiros (ex.: um parceiro de logística, um app
mobile), a decisão de expor uma API versionada, documentada e com chave
própria deve ser tomada naquele momento, como parte do desenho do SaaS
— não antecipada aqui sem consumidor.

---

## 12. Governança unificada

Resolve diretamente o achado 3.4.17 da INIT-001 (Control Center sem
nenhuma cobertura de governança formal).

**Proposta:** `ENGINEERING.md` passa a reger explicitamente todo o
diagrama da Seção 5, não apenas o Sistema Web. Na prática:

- A lista de "preservar" do `ENGINEERING.md` (Kernel, Repository Layer,
  Firebase, Firestore, Cloud Functions, ES Modules, MPA) ganha uma
  entrada equivalente para o Control Center: os módulos **Release** e
  **Banco de Dados** do Control Center tratam diretamente produção e
  Firestore Rules — devem ser tratados como componentes críticos,
  sujeitos às mesmas regras de autorização explícita que já valem para
  Login/Firebase/Rules no Sistema Web.
- O fluxo oficial de papéis (estratégia → implementação → revisão
  técnica → promoção — papéis exercidos por qualquer IA escolhida pelo
  responsável do projeto a cada Sprint, ver Seção 17) passa a valer
  também para mudanças no Control Center — hoje as sprints do Control
  Center têm pareceres próprios (`CCC-HOM-*`) que cumprem função
  equivalente à revisão técnica, mas não estão formalmente ligados ao
  processo do `ENGINEERING.md`.
- `MASTER_ROADMAP.md` e `PROXIMA_ETAPA.md` passam a citar o Control
  Center como parte do estado do projeto, para que a lacuna 3.4.16 da
  INIT-001 (documentação de continuidade desatualizada) não se repita
  especificamente por causa desse componente.

Esta seção é a única, além da INIT-001, que este documento trata como
**resolução direta** (não como opção em aberto) — porque decorre
tecnicamente do próprio achado da auditoria, não de uma escolha de
produto.

---

## 13. Entregáveis

- ✅ Arquitetura oficial (Seção 5).
- ✅ Diagrama (Seção 5).
- ✅ Estrutura de grupos funcionais + mapeamento completo dos 34+10
  módulos existentes (Seção 6).
- ✅ Papel do Control Center formalizado (Seção 7).
- ✅ Princípios de arquitetura para SaaS, sem plano detalhado (Seção 8).
- ✅ Decisão em aberto sobre Central de IA, registrada como ADR (Seção 9).
- ✅ Papel do Site Institucional e da API reconhecidos formalmente
  (Seções 10 e 11).
- ✅ Proposta de governança unificada (Seção 12).
- ✅ Registro de decisões arquiteturais — ADR (Seção 15).
- ✅ Roadmap técnico macro (Seção 16).
- ❌ Estrutura de diretórios físicos nova — deliberadamente **não**
  entregue: a Seção 6 organiza os módulos **logicamente** (mapeamento
  em tabela), sem mover um único arquivo. Reestruturação física de
  pastas é decisão de execução (Sprint futura), fora do escopo de um
  documento que a Seção 14 proíbe explicitamente de tocar em código.

---

## 14. Restrições

Reiteradas integralmente, como pedido:

- Proibido alterar código.
- Proibido alterar banco de dados.
- Proibido alterar produção.
- Proibido iniciar implementação.
- Proibido criar plano detalhado de migração (só o macro da Seção 16).

Nenhuma delas foi violada na produção deste documento — toda a
Seção 4 veio de leitura de arquivos, `find` e `grep`, sem escrita em
nenhum arquivo do produto.

**Pré-requisito adicional, herdado da INIT-001 e reafirmado aqui:** a
chave de service account vazada (achado crítico, INIT-001 §3.1.1)
continua sem correção. Nenhuma sprint de execução desta arquitetura
deveria começar antes de esse item ser resolvido ou formalmente aceito
por escrito — é o mesmo critério de encerramento já registrado na
INIT-001 e não muda por causa deste documento.

---

## 15. Registro de decisões arquiteturais (ADR)

Cada decisão vinculada a um objetivo de produto, como pedido pelo dono.

| ADR | Decisão | Justificativa técnica | Objetivo vinculado | Status |
|---|---|---|---|---|
| ADR-001 | Adotar os 7 grupos funcionais (Atendimento, Comercial, Financeiro, Estoque, Administração, Infraestrutura, Inteligência) como taxonomia única do ecossistema | Substitui classificações ad-hoc (ex.: tabela "Núcleo/Suporte/Gestão" do `PROXIMA_ETAPA.md`) por uma única fonte de verdade | Manutenção, organização | Proposto |
| ADR-002 | Unificar a governança do Control Center sob o `ENGINEERING.md` | Resolve achado 3.4.17 da INIT-001; Control Center já toca produção (Release, Banco de Dados) sem as mesmas travas do Sistema Web | Segurança, manutenção | Proposto |
| ADR-003 | Reconhecer Site Institucional e API como componentes de primeira classe do diagrama, sem alterá-los fisicamente agora | Ambos já existem e já cumprem seu papel; formalizar é documental, não estrutural | Manutenção, clareza arquitetural | Proposto |
| ADR-004 | SaaS multiempresa, se retomado, é projeto novo — proibido reaproveitar código do multiempresa de 2026-06-24/25 como base | Esse código causou instabilidade real em produção e foi revertido por completo; RBAC (pré-requisito) não existia quando foi construído | Escalabilidade, segurança, estabilidade | **Pendente de aprovação do CTO/dono antes de qualquer especificação detalhada** |
| ADR-005 | Escopo da "Central de IA": permanece interna ao Control Center (Leitura A) ou vira capacidade cross-cutting do ecossistema (Leitura B) | Tem implicação direta de RBAC/segurança se agentes de IA passarem a operar módulos de produção | Segurança, experiência do usuário | **Pendente de decisão explícita do CTO/dono** |
| ADR-006 | Reestruturação física de diretórios (mover arquivos para refletir os grupos da Seção 6) fica fora do escopo desta arquitetura | Documento é de definição, não de execução; mover arquivos é ação de código, proibida pela Seção 14 | Manutenção | Adiado para Sprint de execução |
| ADR-007 | Nenhuma implementação decorre automaticamente deste documento | Mesmo critério de encerramento da INIT-001: correção/aceite formal do achado crítico de segurança é pré-requisito | Segurança | Vigente |
| ADR-008 | Adotar governança de IA vendor-neutra (Seção 17): nenhuma IA tem cargo/autoridade/responsabilidade permanente neste documento; escolha da IA é decisão operacional por Sprint | Evita dependência de fornecedor específico; garante que a arquitetura sobreviva à troca de qualquer ferramenta de IA | Manutenção, continuidade, independência de fornecedor | **Proposto — conflita diretamente com `ENGINEERING.md` v1.1 vigente (papéis fixos por nome de IA); reconciliação entre os dois documentos é decisão pendente de quem responde pelo projeto (ver Seção 17.6)** |

---

## 16. Roadmap técnico macro

Macro, como pedido — sem detalhamento de tarefas, sem estimativas de
esforço, sem lista de arquivos a tocar (isso seria "plano detalhado de
migração", proibido pela Seção 14).

| Fase | Conteúdo | Depende de |
|---|---|---|
| **Fase A — Pré-requisito** | Rotação da chave de service account vazada (ou aceite formal do risco) + atualização de `PROXIMA_ETAPA.md` ao estado real | Nada — pode começar imediatamente |
| **Fase B — Governança unificada** | Formalizar ADR-002 e ADR-003: `ENGINEERING.md`/`MASTER_ROADMAP.md` passam a cobrir Control Center, Site e API | Fase A concluída |
| **Fase C — Organização lógica** | Adotar os 7 grupos (ADR-001) na documentação e nas próximas sprints, sem mover arquivos | Fase B aprovada |
| **Fase D — Decisão de Central de IA** | CTO/dono decidem entre Leitura A/B (ADR-005); se Leitura B, essa fase vira seu próprio documento de arquitetura | Fase B aprovada |
| **Fase E — SaaS greenfield** | Documento de arquitetura dedicado (isolamento de dados, planos, licenciamento), respeitando os 3 princípios da Seção 8 (ADR-004) | Fase B aprovada + RBAC Fase 2 formalmente encerrada |

Nenhuma fase acima tem data. A ordem reflete dependência técnica, não
prioridade de negócio — a prioridade é decisão de quem responde
estrategicamente pelo projeto.

---

## 17. Governança das Inteligências Artificiais

> Seção adicionada/revisada por script de correção do dono
> (2026-07-12), em três mensagens consecutivas reforçando o mesmo
> objetivo. Escopo desta revisão: só este documento
> (CCC-V2.0-ARCH-001). `ENGINEERING.md` não foi tocado — ver 17.6.

O Sistema de Gestão Cell City é independente de qualquer fornecedor,
modelo ou tecnologia específica de Inteligência Artificial. A
arquitetura pertence ao Sistema de Gestão, não às IAs utilizadas
durante seu desenvolvimento. As IAs são ferramentas de apoio ao
desenvolvimento; a governança pertence ao projeto.

### 17.1 Princípio geral

- Nenhuma IA possui função permanente dentro da arquitetura.
- Nenhuma IA possui cargo permanente.
- Nenhuma IA possui autoridade permanente.
- Nenhuma IA possui responsabilidade exclusiva.
- Nenhuma IA faz parte da arquitetura do Sistema.

Qualquer IA pode executar qualquer Sprint — arquitetura,
desenvolvimento, documentação, testes, revisão, homologação, auditoria,
manutenção, refatoração, planejamento, otimização — desde que siga
integralmente a documentação oficial do projeto. A IA designada para
uma Sprint executa todas as atividades necessárias para atingir os
objetivos definidos, respeitando apenas as restrições técnicas e de
segurança do projeto — nenhuma IA pode recusar uma atividade alegando
que ela "pertence" a outra IA em razão da documentação.

### 17.2 Critério de escolha

A escolha da IA utilizada em cada Sprint é uma decisão **operacional**,
não arquitetural, tomada exclusivamente por quem responde pelo projeto.
Cada Sprint pode utilizar uma IA, várias IAs, ou nenhuma IA.

### 17.3 Princípios obrigatórios

**Princípio 01.** A arquitetura do Sistema de Gestão Cell City deverá
permanecer independente de fornecedores e modelos de Inteligência
Artificial.

**Princípio 02.** A documentação oficial do projeto possui prioridade
sobre qualquer recomendação produzida por uma IA — nenhuma decisão
arquitetural é válida apenas por ter sido proposta por determinada IA;
toda decisão deve estar fundamentada em critérios de engenharia,
segurança, manutenção, escalabilidade e qualidade (os mesmos pilares já
exigidos pelo `ENGINEERING.md`, Seção "Pilares").

**Princípio 03.** Toda IA deverá seguir integralmente os padrões,
processos, documentação e critérios técnicos oficiais do projeto.

**Princípio 04.** As IAs são recursos de apoio ao desenvolvimento. A
arquitetura pertence ao Sistema, não a elas.

**Princípio 05.** A substituição de qualquer IA por outra, a qualquer
momento, não poderá exigir alteração da arquitetura do projeto.

**Princípio 06.** Nenhuma IA poderá recusar uma atividade alegando que
ela pertence a outra IA em razão da documentação do projeto. A IA
designada para uma Sprint deve executar todas as atividades necessárias
para atingir os objetivos definidos, respeitando apenas restrições
técnicas e de segurança — nunca uma restrição de "papel".

### 17.4 Compatibilidade futura

A arquitetura deve permanecer válida para qualquer modelo presente ou
futuro de IA — por exemplo Claude, ChatGPT, DeepSeek, Gemini, Grok,
Copilot, e quaisquer outros que venham a existir. Nenhum deles recebe
tratamento especial dentro da arquitetura.

### 17.5 Validação desta revisão

- ✅ Não existe, neste documento, dependência arquitetural de nenhuma IA
  específica.
- ✅ Não existe, neste documento, cargo, autoridade ou responsabilidade
  exclusiva atribuída a modelo de IA (as três menções que existiam —
  nota introdutória, fluxo de papéis da Seção 12 e ponto 1 dos
  critérios de encerramento — foram reescritas em linguagem neutra).
- ✅ Não existe hierarquia entre ferramentas de IA neste documento.
- ✅ Este documento permanece válido para qualquer tecnologia de IA
  atual ou futura.
- 🟡 **Ressalva feita de propósito, não escondida:** essa neutralidade
  vale para este documento. Ela **não** se estende automaticamente a
  `ENGINEERING.md` — ver 17.6.

### 17.6 Conflito conhecido com `ENGINEERING.md` — não resolvido aqui

`ENGINEERING.md` v1.1, vigente hoje, atribui papéis permanentes por
nome de IA (ChatGPT = CTO/Arquiteto-Chefe; Claude = Revisor Técnico
Principal — único que aprova releases e promove `develop→main`;
DeepSeek = desenvolvimento — nunca promove para `main`). Esta seção
contradiz esse modelo diretamente, e o Princípio 06 (17.3) torna a
contradição mais aguda: `ENGINEERING.md` reserva a aprovação de release
e a promoção `develop→main` a uma única IA por nome, exatamente o tipo
de "restrição de papel" que o Princípio 06 diz que nenhuma IA deve
respeitar. Isso não é um detalhe menor — é um gate de qualidade
operacional real (só uma revisão técnica dedicada aprova o que vai para
produção), não apenas uma preferência estilística de documentação.

A contradição fica **registrada**, não resolvida por conta própria: o
escopo pedido para esta e para as três revisões anteriores era sempre
só o CCC-V2.0-ARCH-001, e alterar `ENGINEERING.md` mudaria a governança
operacional do dia a dia do projeto — inclusive esse gate de qualidade
— não apenas a arquitetura. É uma decisão maior, que caberia a quem
responde pelo projeto autorizar separadamente e por escrito, ciente de
que remove (ou substitui por outro mecanismo) o único controle formal
que hoje impede que código não revisado chegue à produção.
`ENGINEERING.md` continua sendo a constituição operacional vigente até
essa reconciliação (ADR-008, Seção 15).

---

## 18. Critérios de encerramento

Este documento (CCC-V2.0-ARCH-001) é considerado encerrado quando:

1. Quem estiver exercendo a função de estratégia do projeto nesta
   Sprint revisar as decisões arquiteturais (Seção 15) como proposta
   técnica — não como algo pré-aprovado.
2. Quem responde pelo projeto se posicionar sobre os ADRs marcados como
   **pendentes** (ADR-004, ADR-005 e ADR-008) — os demais (ADR-001,
   002, 003, 006, 007) podem ser adotados por não envolverem decisão de
   negócio, apenas consequência técnica dos achados.
3. Os critérios de encerramento da INIT-001 continuarem sendo
   respeitados — em especial, nenhuma Fase B em diante (Seção 16) deve
   começar antes de tratar a chave de service account vazada.
4. Autorização explícita for dada para abrir a primeira sprint de
   execução (Fase A do roadmap macro).
