# 🔍 AUDITORIA GERAL DO PROJETO — Cell City CRM (2026-07-04)

> Auditoria de análise e documentação (não implementação), conforme solicitado. Método: leitura direta de código/config pelo condutor da auditoria + 4 agentes de pesquisa paralelos (só leitura), cruzados com `CRM/TECHDOC.md`, `plans/*.md` anteriores e `git log`. Nenhum arquivo de código foi alterado nesta auditoria.
> Convenção de prioridade usada: 🔴 Crítica · 🟠 Alta · 🟡 Média · 🟢 Baixa.
> **Nota sobre esta versão:** este documento é publicado ao vivo no site institucional (GitHub Pages serve `plans/` publicamente). Por isso, os achados de segurança que envolvem mecanismo de exploração, segredos ou credenciais foram **deliberadamente redigidos/omitidos** aqui — mantidos apenas como categoria/impacto, sem o "como". O detalhe técnico completo está em `plans/AUDITORIA_GERAL_20260704_INTERNO.md` (arquivo local, `.gitignore`d, nunca publicado).

---

## 🔴 ALERTA — achado crítico de segurança, detalhe técnico reservado

Durante a Fase 1/2 (inventário de módulos) foi identificada uma **exposição crítica de dados de clientes reais**, ligada ao fluxo de Ordens de Serviço / Portal do Cliente, ainda sem correção — não coberta pela saga de segurança já documentada em `TECHDOC.md` §6.12-6.14 (aquela tratava de outro vetor, escalada de privilégio via `usuarios/{uid}`).

**Os detalhes técnicos (mecanismo exato, arquivos, dados expostos) foram omitidos desta cópia de propósito**, porque este documento é publicado publicamente no site institucional — descrever o "como" tornaria a falha mais fácil de explorar antes de ser corrigida. O registro técnico completo está em `plans/AUDITORIA_GERAL_20260704_INTERNO.md` (arquivo local, fora do git, não publicado).

**Recomendação de tratamento:** prioridade 0, antes de qualquer novo módulo da nova metodologia — a correção envolve Firestore Rules e Autenticação (componentes protegidos pelo `CLAUDE.md`), exige autorização explícita e planejamento cuidadoso, o mesmo processo já usado nas correções de §6.12-6.14. Não corrigido nesta auditoria (fora do escopo pedido: analisar e documentar).

---

## 1. Resumo Executivo

O Cell City CRM é um sistema amplo (~35 módulos em `CRM/pages/`, ~45 mil linhas de JS, ~59 coleções Firestore), construído sem build step (HTML + ES modules nativos) sobre Firebase. O projeto tem uma cultura de documentação e homologação incomum para o tamanho da equipe (TECHDOC.md de quase 1000 linhas, processo formal de 8 etapas, sistema de backup e rollback dedicados) — mas essa disciplina é recente (desde 2026-07-01) e não cobre retroativamente boa parte do sistema mais antigo.

**Situação real, em uma frase:** o núcleo operacional (OS, Caixa, Estoque, Financeiro, CRM Comercial, Dashboard) funciona e é usado no dia a dia, o processo de segurança/RBAC está ativamente evoluindo (com uma saga de correções sérias já resolvida em produção em 2026-07-04), mas a auditoria encontrou **três módulos com bug que provavelmente os deixa não-funcionais agora** (Análise, Catálogo público, Central de Organização/Automação), **duas subcoleções sem regra Firestore** (podem estar quebrando parte do Financeiro e do Portal Técnico), e o alerta crítico acima (Portal do Cliente/OS público).

- **Módulos de negócio funcionais ou parcialmente funcionais:** ~24 de ~35.
- **Módulos aparentemente quebrados por incompatibilidade de regra/código** (acham que funcionam, não funcionam): 3 (Análise, Catálogo, Central de Organização) + risco não confirmado no Portal do Cliente.
- **Não iniciados / placeholder:** 6 (Compras, Chat, Estratégia, Automação, Auditoria, Em Breve).
- **Utilitário interno (não é módulo de produto):** kernel-test.
- **RBAC (Fase 2 do roadmap oficial):** 2 de 5 sprints aprovados formalmente (Dashboard, CRM+Agenda); Sprint 3 (Estoque+Caixa) implementado e testado automaticamente, mas **ainda aguardando homologação manual** desde 2026-07-02; Sprints 4 (Financeiro) e 5 (OS) não iniciados.
- **Documentação de estado do projeto está desalinhada**: `PROXIMA_ETAPA.md` e `MASTER_ROADMAP.md` (fonte "oficial" de estado) não foram atualizados desde 2026-07-02 — não refletem nada do que aconteceu em 2026-07-04 (a saga de segurança inteira, Cloud Functions, sistema de backup, refatoração do Dashboard, H-009). Só o `CRM/TECHDOC.md` está atualizado.

---

## 2. Fase 1 — Inventário Geral de Módulos

Tabela consolidada dos ~35 diretórios em `CRM/pages/` (módulos já cobertos em detalhe pelo `TECHDOC.md` — Central de Alertas, Usuários e Permissões, Dashboard — estão resumidos; o levantamento de código completo desses três está no próprio TECHDOC, seções 3, 6 e 15).

| Módulo | Arquivos principais | Status | Observação-chave |
|---|---|---|---|
| `dashboard` | 10 arquivos (refatorado 2026-07-04) | ✅ Concluído | Ver TECHDOC §15. RBAC Sprint 1 aplicado (visualizar). |
| `os` | `os.js` 2442L, `auth.js` (morto) | ✅ Funcional | Núcleo do sistema; sem RBAC (Sprint 5 não iniciado); dados sensíveis expostos publicamente (ver Alerta) |
| `caixa` | `caixa.js` 813L | ✅ Funcional | RBAC Sprint 3 aplicado; homologação manual pendente |
| `estoque` | `estoque.js` 373L | ✅ Funcional | RBAC Sprint 3 aplicado; mais limpo do lote |
| `financeiro` | `financeiro.js` 707L | ⚠️ Funcional sem controle de acesso | Sem `kernel.js`/RBAC; subcoleção `itens` sem regra Firestore (provável quebra parcial) |
| `clientes` | `clientes.js` 181L | ⚠️ Funcional, mas mal nomeado | Na verdade é "Config. de Impressão"; CRUD real de clientes vive em `os.js` |
| `crm-comercial` | `crm.js`, `chips.js`, `entrada.js`, `chips-entrada.js` | ✅ Funcional | RBAC Sprint 2 aplicado; mistura 2 funis (leads + chips) sob 1 permissão |
| `acaodasemana` (Agenda) | `acaodasemana.js` 905L | ✅ Funcional | RBAC Sprint 2 aplicado (regra AND) |
| `compras` | só `index.html` | ⚪ Não iniciado | Placeholder puro; sobreposição conceitual com `fornecedor` |
| `fornecedor` | `fornecedor.js` 314L | ⚠️ Parcialmente funcional | Aba "Compras" sem integração real com Estoque |
| `contas` | `contas.js` 203L | ✅ Funcional | CRUD simples, sem RBAC |
| `relatorios` | `relatorios.js` 920L | ✅ Funcional | Único módulo de BI; `onSnapshot` sem filtro em 2 coleções inteiras |
| `portal-cliente` | `portal.js` 2375L, `admin.js` 1409L | 🔴 Risco crítico | Ver Alerta no topo |
| `portal-tecnico` | 4 sub-hubs (`softwares`, `solucoes-tecnicas`, `tutorials`, `central-projeto`) | ✅ Funcional | Sem RBAC/`kernel.js`; leitura completa de `os` a cada busca |
| `pos-venda` | `posvenda.js` 1062L | ✅ Funcional | Fonte de dados da Central de Alertas |
| `diario` | `diario.js` 866L + `diario-gdrive.js` | ✅ Funcional | Isolado por design; backup no Google Drive |
| `importar` | `importar.js` 403L | ✅ Funcional (utilitário) | Sem `confirm()` antes de escrita em massa; sem RBAC |
| `usuarios-permissoes` | 4 arquivos | ✅ Concluído/Homologado | Ver TECHDOC §6 (saga completa) |
| `central-alertas` | 3 arquivos | ✅ Concluído/Homologado | Ver TECHDOC §3 |
| `central-modulos` | wrapper + `shared/central-modulos.js` | ✅ Funcional | Catálogo com 2 entradas duplicadas (`impressora`=`config`) e 7 módulos reais fora do catálogo |
| `central-comandos` | `comandos.js` 669L | ✅ Funcional | Sem `initModulo()`; backup morto no diretório |
| `central-informacoes` | `informacoes.js` 1474L | ⚠️ Funcional com risco | Chave de criptografia de senhas hardcoded no código-fonte (valor no registro interno) |
| `central-organizacao` | `central.js` 333L | 🔴 Quebrado | Coleção `central_organizacao` sem regra Firestore — nega tudo |
| `config` | `config.js` 224L | ⚠️ Parcialmente funcional | PIN da loja gravado/cacheado em texto puro |
| `chat` | 3 arquivos, todos 0 bytes | ⚪ Não iniciado | Órfão, não referenciado |
| `catalogo` | admin + `public/` | 🔴 Quebrado | `catalogo_config` sem regra; vitrine pública exige auth que nunca tem |
| `autoatendimento` | `autoatendimento.js` 333L | ✅ Funcional | Fluxo Pré-OS → OS completo |
| `campanhas` | `campanhas.js` 289L | ✅ Funcional (manual) | Nome sugere automação; é painel de apoio manual |
| `analise` | `analise.js` 355L | 🔴 Quebrado | `fetch()` REST sem token contra coleção que exige auth — dado sempre vazio, falha silenciosa |
| `estrategia` | 3 arquivos, todos 0 bytes | ⚪ Não iniciado | Órfão |
| `minha-semana` | `minha-semana.js` 158L | ✅ Funcional | Módulo mais alinhado ao padrão "oficial" |
| `auditoria` | só `index.html` (mockup) | ⚪ Não iniciado | Tela de "em breve", sem lógica |
| `automacao` | pasta vazia | ⚪ Não iniciado | Colisão de nome com `central-automacao` (=`central-organizacao`) e coleções descontinuadas |
| `em-breve` | `index.html` | ⚪ Placeholder de sistema | Fallback intencional de rotas não implementadas |
| `kernel-test` | 2 arquivos | 🔧 Utilitário interno | Ferramenta de QA do próprio `kernel.js`, não é módulo de produto |

---

## 3. Fase 2 — Funcionalidades (síntese)

O detalhamento funcional completo de cada módulo (o que faz, o que falta, limitações) está registrado por módulo na Fase 1 acima e nos relatórios de origem; os pontos que atravessam vários módulos:

- **CRUD de clientes real vive dentro de `os.js`**, não em `pages/clientes/` (que é config de impressão) — qualquer evolução de "gestão de clientes" precisa partir daí, não do diretório com esse nome.
- **Duas cadeias de automação entre módulos sem gate de permissão**: Caixa↔Estoque (já documentada no TECHDOC §7.3) e **OS→Agenda + OS→Financeiro** (`os.js::runAutomacoesOS()`, achado novo desta auditoria) — nenhuma das duas verifica se o usuário tem permissão no módulo de destino, só no de origem.
- **Duplicação de lógica de negócio**: `estoque.js` exporta funções pensadas para reuso pelo Caixa, mas `caixa.js` reimplementa a mesma lógica de forma independente e ligeiramente divergente (recalcula custo médio de formas diferentes).
- **`compras` (placeholder) sobrepõe conceitualmente com `fornecedor` (parcialmente implementado)** — definir isso antes de desenvolver qualquer um dos dois evita retrabalho.
- **RBAC granular (`shared/permissoes.js`) só existe em 5 dos ~35 módulos** (Dashboard, CRM Comercial, Agenda, Estoque, Caixa) — todo o resto depende só das Firestore Rules (na melhor hipótese `auth != null && temAcessoLiberado()`, sem checar perfil/função).
- **`initModulo()` (boot padrão do kernel) também é inconsistente** fora do RBAC: `clientes`, `financeiro`, `fornecedor`, `diario`, `importar` e todo `portal-tecnico` nunca chamam — dependem só do gate visual por `localStorage`, que o próprio `kernel.js` documenta como não sendo mecanismo de segurança.

---

## 4. Fase 3 — Pendências Técnicas (priorizadas)

### 🔴 Críticas

1. **Exposição crítica associada ao fluxo OS/Portal do Cliente** — ver Alerta no topo. Detalhe técnico no registro interno (não publicado).
2. **3 módulos aparentemente não-funcionais em produção** por incompatibilidade regra×código: `catalogo` (vitrine pública nunca autentica, mas a regra exige auth; `catalogo_config` sem regra nenhuma), `central-organizacao` (`central_organizacao` sem regra — nega tudo), `analise` (chamada REST sem token contra coleção que exige auth — sempre retorna vazio, silenciosamente).
3. **2 subcoleções sem regra Firestore, com impacto funcional provável**: `financeiro_categorias/{catId}/itens` (função "itens de categoria financeira" do módulo Financeiro) e `usuarios/{uid}/portal-tecnico/{docId}` (sincronização entre dispositivos do Portal Técnico).
4. **2 índices Firestore compostos faltando, com evidência de falha já ocorrida em produção** (o próprio código tem um workaround "se não tiver índice, tenta sem orderBy"): `avaliacoes` e `mensagens_portal`, ambos por `telefoneDigits + createdAt` — usados pelo Portal do Cliente.
5. **Segredo/chave hardcoded no código-fonte, usado para proteger senhas reais** no módulo Central de Informações — mesma chave para todos os usuários; o próprio comentário do código já reconhece "não é seguro, apenas ofuscação". Valor e localização exata no registro interno (não publicados aqui).
6. **PIN da loja (`config`) gravado e cacheado em texto puro**, apesar do nome da constante sugerir hash (`cc_pin_hash`).
7. **`importar.js` dispara escrita em massa em produção (incl. `caixa_lancamentos`) sem nenhuma confirmação** — um clique único, sem RBAC, grava dados financeiros.

### 🟠 Altas

8. **Duplicação de `firestore.rules`/`firestore.indexes.json`** entre a raiz do repo (obsoletos, sem a correção de segurança de 04/07) e `CRM/` (fonte real, usada em deploy) — risco de alguém editar/auditar o arquivo errado. Existem ainda mais 2 variantes soltas dentro de `CRM/` (`.BACKUP_2026-07-01`, `.secure`).
9. **9 coleções de nível raiz sem regra Firestore** (deny-by-default): `alertas_usuario`, `auditoria_saas`, `backup_logs`, `catalogo_config`, `central_organizacao`, `chips_cadastros`, `contas_numeros`, `diario_eventos`, `notificacoes_saas`. Duas delas (`auditoria_saas`, `notificacoes_saas`) falham dentro de um `catch{}` silencioso em `shared/tenant.js` — o app não trava, mas os registros nunca são gravados.
10. **`_BACKUPS/`, `plans/` e `CLAUDE.md` estão rastreados no git e são publicados no site ao vivo** via GitHub Pages — boa parte de tudo publicado em produção é material interno (histórico de decisões, código antigo). Recomenda-se revisar o que deveria sair do build publicado.
11. **Achado de segurança de infraestrutura envolvendo credencial de deploy** — consolidado no registro interno (não detalhado aqui por ser diretamente acionável); ver dono do projeto / registro completo.
12. **74 arquivos com paths absolutos `/CRM/`** (levantamento de 2026-07-02, `GUIA_MANUTENCAO.md` item 7) — no ambiente `/dev`, isso já causou 2 bugs reais confirmados e corrigidos (H-006, H-009) e pelo menos 1 mais encontrado e não corrigido (`dashboard-alarme-os.js::abrirJanelaFlutuante`, "H-010 em potencial"). A varredura original tinha 74 candidatos; só ~6 arquivos foram corrigidos até agora — a maioria segue sem revisão.
13. **Dado de desbloqueio do aparelho do cliente sem proteção adicional** no mesmo fluxo de OS do Alerta crítico — detalhe técnico no registro interno.
14. **`PROXIMA_ETAPA.md` e `MASTER_ROADMAP.md` desatualizados desde 2026-07-02** — não refletem a saga de segurança, Cloud Functions, backup, refatoração do Dashboard e H-009 de 2026-07-04. Ambos são, por design do próprio projeto, a fonte de verdade para "onde paramos" — hoje estão incorretos.
15. **Sprint 3 do RBAC (Estoque+Caixa) publicado em `develop` desde 2026-07-02 sem homologação manual/aprovação formal** — bloqueia o início do Sprint 4 (Financeiro) pela ordem oficial do roadmap.

### 🟡 Médias

16. **Backups de arquivo inteiro deixados soltos dentro de diretórios de produção** (fora do sistema oficial de backup): `os/os.js.backup-CORROMPIDO_2026-06-09`, `os/os.js.backup-EDITAR_OS_SECOES_2026-06-08`, `os/cell-City.code-workspace`, `central-comandos/comandos.js.backup-MIGRACAO-COMANDOS-2026-06-11`, `central-informacoes/*.backup-MIGRACAO-COMANDOS-2026-06-11` (×2, ~1274 linhas), `portal-tecnico/solucoes-tecnicas/BACKUP_PRE_GDRIVE_*.html`, `pos-venda/posvenda-test.html`.
17. **Coleção `produtos` confirmada legada**, substituída por `estoque_produtos`, mantida só como fallback (`estoque.js`, `dashboard-busca.js`) — candidata a remoção se a migração de dados antigos já foi concluída.
18. **6 blocos `match` "mortos" em `CRM/firestore.rules`** (`historico_diario`, `historico_semanal`, `historico_mensal`, `resumo_live`, `acoes_semana`, `estoque`) sem nenhuma referência em código ativo — resíduo de refactor anterior do Caixa.
19. **2 índices Firestore existentes mas não usados por nenhuma query atual** (`mensagens_portal` no campo errado — `telefone` em vez de `telefoneDigits`; `lembretes_pagamento` sem query correspondente).
20. **Duplicação funcional entre `central-comandos` e `central-informacoes`** — "Comando" pode ser criado em ambos, sem sincronização contínua após a migração inicial.
21. **7 módulos funcionais fora do catálogo `TODOS_MODULOS`** (não aparecem na Central de Módulos, não podem ser favoritados): `analise`, `campanhas`, `minha-semana`, `importar` (+ os já quebrados `catalogo`... verificar). Catálogo também tem entrada duplicada (`impressora`=`config`).
22. **Zero paginação/`limit()` em praticamente todo o sistema de negócio** (Fase 9 detalha) — só o Portal do Cliente usa `limit()` de forma consistente.
23. **Card da Agenda no Dashboard não é ocultado pelo RBAC** (`RBAC_CARD_PARA_MODULO_ID` sem entrada) — pendência já registrada no TECHDOC §7.2.
24. **Iframe de fechamento automático do Caixa dispara a cada carga do Dashboard sem nenhum efeito** (orquestrador removido em 30/06) — pendência já registrada no TECHDOC §7.3.
25. **`os/auth.js` é código morto** (import quebrado para um `./firebase.js` que não existe na pasta; nunca referenciado por `os.js`/`index.html`).
26. **`analise.js`** tem import morto (`doc, getDoc` nunca usados) e um arquivo-lixo órfão de 0 bytes (`CRM/pages/analise/analise`, sem extensão).
27. **`central-organizacao`**: campos dinâmicos de e-mail/senha de WhatsApp na UI são descartados silenciosamente ao salvar (não estão na lista de campos lida por `montar()`) — bug real, não apenas limitação.
28. **Doc órfão `usuarios/{uid}` do usuário de teste `eu@cellcity.com.br`** (Auth já deletado) — limpeza pendente desde 2026-07-02.
29. **`backup-dados.js` (export de dados Firestore) não cobre `usuarios`, `perfis_operacionais`, `auditoria_usuarios_permissoes`** e outras coleções pós-RBAC — diferente do sistema de backup de código (git) descrito no TECHDOC §10, que não cobre dados.

### 🟢 Baixas

30. `firebase.json` ainda tem seção `hosting` apesar de o Firebase Hosting ser proibido (resquício).
31. `localStorage` compartilhado entre `/` e `/dev` (mesma origem) — vaza estado de sessão/preferências entre ambientes.
32. Nomenclatura confusa: `central-organizacao` exibe título "Central Automação" na UI; 3 conceitos distintos usam a palavra "automação" no sistema (pasta vazia `automacao`, entrada de catálogo `central-automacao`, coleções descontinuadas `automacao_execucoes`/`automacao_logs`).
33. `crm-comercial` mistura funil comercial (leads) e funil de chips sob o mesmo `moduloId` de permissão — não dá para liberar RBAC de um sem o outro.
34. Tag de versão malformada gerada uma vez (`v2026.07.-1198`) — já corrigida (TECHDOC §14.6), mas indica que o script `subir-ok` "reforçado" pode não estar sempre carregado na sessão do terminal que promove.
35. 3 tags internas do sistema de backup vazaram para `origin` do Cell-City-Site por engano (`--follow-tags`) — já corrigido no script, tags antigas ainda presentes aguardando remoção manual (decisão do dono).

---

## 5. Fase 4 — Arquitetura

**Pontos fortes:**
- Padrão de módulo consistente na maioria dos casos (`pages/<nome>/{index.html,<nome>.js,<nome>.css}`), sem build step, o que mantém o projeto simples de navegar.
- `scripts/kernel.js` como ponto único de autenticação/bootstrap é uma boa decisão, quando usado (ver inconsistência de adoção, Fase 2/3).
- `shared/` bem estabelecido para código transversal (`brand-header`, `dock`, `favoritos`, `sidebar`, `permissoes`, `phone-utils`).
- Processo de entrega formal (8 etapas) e sistema de backup/rollback de **código** (git) são maduros e já testados de ponta a ponta.
- Refatoração do Dashboard (TECHDOC §15) é um bom exemplo de como reduzir acoplamento sem reescrever comportamento (padrão de mixin, migração mecânica).

**Fraquezas / oportunidades de simplificação:**
- **Acoplamento por convenção, não por import**: módulos que deveriam compartilhar lógica (Caixa/Estoque) a duplicam de forma independente e divergente, porque nenhum dos dois importa o outro.
- **Duas camadas de segurança que não se falam**: RBAC granular (`shared/permissoes.js`, 5 módulos) e gate de kernel (`temPermissao()`, 1 módulo) coexistem com ~29 módulos que não usam nenhum dos dois — a arquitetura de autorização está fragmentada em 3 categorias diferentes de proteção (ou nenhuma).
- **Múltiplos sistemas de identidade coexistindo**: `kernel.js` (Auth principal), `firebase-secondary.js` (Auth secundário, só Usuários e Permissões), `shared/session.js` (identidade paralela, só usado em `config`), sessão anônima do Portal — 4 mecanismos distintos de "quem é o usuário" no mesmo sistema.
- **`shared/tenant.js` é código morto/obsoleto** (sistema multiempresa revertido em 2026-06-27) mas continua no repositório — nenhum módulo auditado o importa mais, mas ainda é referenciado como "algo a evitar" em ferramentas de teste, confirmando que a equipe já sabe disso informalmente sem o código ter sido removido.
- **Coleção `config` genérica demais** — 1 coleção com pelo menos 7 documentos de propósitos completamente diferentes (`impressao`, `pin`, `horarios`, `dock_ordem`, `retorno_mensagens`, `migracao_comandos_v1`, `crm_pre_os_counter`), cada um com seu próprio formato implícito.
- **Fragmentação de esquema**: 4 coleções `categorias_*` separadas por módulo em vez de uma única `categorias` com campo `modulo`.
- **Nomenclatura de diretório não confiável** como documentação (`pages/clientes/` ≠ CRUD de clientes; `pages/compras/` sobrepõe `fornecedor`) — quem navega o código pelo nome da pasta é enganado em pelo menos 2 casos.

---

## 6. Fase 5 — Fluxos do Sistema

| Fluxo | Status | Observação |
|---|---|---|
| Login | ✅ Concluído | `kernel.js` + Firestore Rules; perfil inicial seguro (`pendente`) desde a correção de 04/07 |
| Dashboard | ✅ Concluído | Refatorado em 10 arquivos, RBAC de visualização aplicado |
| Clientes | ⚠️ Parcial/disperso | Sem tela dedicada; CRUD vive dentro de `os.js`; `pages/clientes/` é outra coisa |
| Ordens de Serviço | ⚠️ Funcional, com risco crítico | Fluxo completo, mas dado sensível exposto publicamente (Alerta) e sem RBAC |
| Caixa | ✅ Funcional | RBAC aplicado, aguardando homologação manual formal |
| Estoque | ✅ Funcional | RBAC aplicado; duplicação de lógica com Caixa |
| Produtos | ⚠️ Fragmentado | `estoque_produtos` (ativo) + `produtos` (legado/fallback) + `catalogo_produtos` (propósito distinto, quebrado) |
| Financeiro | ⚠️ Funcional sem controle de acesso | Sem RBAC/`kernel.js`; subcoleção `itens` provavelmente quebrada (sem regra) |
| Compras | ⚪ Não iniciado | Placeholder; sobreposto conceitualmente por `fornecedor` |
| Fornecedores | ⚠️ Parcial | CRUD de itens a comprar funciona; sem reposição automática de estoque |
| Garantias | ⚠️ Funcional, com risco | `garantia.html` (pública) consome o mesmo documento `os` exposto no Alerta |
| Relatórios | ✅ Funcional | Único módulo de BI; sem exportação, sem filtro de período nas queries |

---

## 7. Fase 6 — Banco de Dados

- **~59 coleções de nível raiz + 3 caminhos de subcoleção** em uso no código atual.
- **Nenhum catch-all** (`match /{document=**}`) em `CRM/firestore.rules` — toda coleção sem `match` explícito nega por padrão.
- **11 coleções/subcoleções sem regra explícita** (lista completa na Fase 3, itens 3 e 9).
- **3 índices compostos existentes**; só 1 (`caixa_lancamentos`) corresponde a uma query real; os outros 2 são órfãos.
- **2 índices faltando, com evidência de falha real já ocorrida** (`avaliacoes`, `mensagens_portal`, ambos por `telefoneDigits + createdAt`).
- **1 coleção legada confirmada** (`produtos`) e **6 blocos de regra mortos** no arquivo de rules.
- **Duplicação de arquivo de configuração**: `firestore.rules`/`firestore.indexes.json` da raiz vs. `CRM/` (fonte real) — ver Fase 3, item 8.

---

## 8. Fase 7 — Integrações

- **Firebase/Firestore**: único backend para MAIN e DEVELOP (separação planejada, freeze de infraestrutura em vigor desde 2026-07-02).
- **Authentication**: e-mail/senha (equipe, via `kernel.js`), Anonymous (Portal do Cliente), Google/e-mail-senha (`shared/session.js`, isolado em `config`). Ver Alerta no topo para uma limitação crítica associada a este fluxo (detalhe no registro interno).
- **Cloud Functions**: primeira infraestrutura de backend do projeto, implementada em 2026-07-04 (`excluirUsuarioAdmin`, Admin SDK) — produção migrada de Spark para Blaze na mesma ocasião.
- **Service Worker**: existe para cache do app e para o alarme de nova OS (`sw-alarme.js`); escopo de registro é limitado ao path do worker (GitHub Pages não permite `Service-Worker-Allowed` mais amplo) — decisão já tomada e documentada (H-002).
- **PWA**: não aprofundado nesta rodada (fora do escopo dos 4 agentes); recomenda-se checagem específica de manifest/instalável em uma auditoria futura, se relevante para o negócio.
- **Backup**: dois sistemas distintos e não integrados — backup de **código** (git, `Cell-City-Backup`, maduro e testado) e backup de **dados** (`backup-dados.js`, cobertura incompleta, não inclui coleções pós-RBAC).
- **APIs externas**: WhatsApp via link `wa.me` (sem API oficial), Google Drive (backup do Diário/Portal Técnico), CDN externa para `CryptoJS` (Central de Informações).

---

## 9. Fase 8 — Segurança

Resumo do estado atual (a saga completa de 2026-07-04 está em `CRM/TECHDOC.md` §6.12-6.14 e §12):

**Já corrigido e confirmado em produção:**
- Escalada de privilégio via autoprovisionamento de `usuarios/{uid}` (visitante virava `admin`/`master_admin` só se cadastrando) — eliminada, testada, promovida.
- Conta `pendente` sem acesso a dados de negócio reais — `temAcessoLiberado()` aplicado a ~45 coleções, **confirmado ativo em produção** (rastreado via `git log`, não só em DEV como uma leitura isolada do TECHDOC sugere).

**Ainda aberto, sem correção** (detalhes técnicos exploráveis omitidos desta cópia pública — ver registro interno):
- 🔴 Exposição crítica associada ao fluxo OS/Portal do Cliente (Alerta no topo — achado novo desta auditoria).
- 🟠 Segredo/chave hardcoded protegendo dados sensíveis (Central de Informações).
- 🟠 Credencial de configuração armazenada sem proteção adequada.
- 🟠 Achado de segurança de infraestrutura envolvendo credencial de deploy (ver registro interno).
- 🟠 `_BACKUPS`/`plans`/`CLAUDE.md` publicados no site ao vivo — informação operacional interna pública, recomenda-se revisão do que é publicado.
- 🟡 Sessões anônimas do Portal podem, em tese, listar `avaliacoes`/`mensagens_portal` de outros clientes (regra não restringe por dono do documento) — limitação já registrada, não corrigida.
- 🟡 RBAC granular só em 5/35 módulos — segurança de autorização por função depende quase toda das Firestore Rules (binário: tem conta liberada ou não tem; não diferencia perfil/função dentro de quem já tem acesso).

---

## 10. Fase 9 — Desempenho

(Relatório completo do agente incluído por referência; síntese abaixo.)

- **O enquadramento do problema mudou**: produção migrou de Spark (trava em 50k leituras/dia) para Blaze (sem teto, custo direto) em 2026-07-04. O padrão de amplificação de leitura **não mudou no código** — nenhuma das 7 fases do `PLANO_OTIMIZACAO_PERFORMANCE_20260703.md` foi implementada.
- **`temAcessoLiberado()` já está ativo em produção** e adiciona +1 leitura por operação nas ~45 coleções protegidas — decisão consciente do dono, mas amplifica proporcionalmente todos os pollers/full-scans existentes (ordem de grandeza: dezenas de milhares de leituras extras/dia).
- **3 pollers de 30s/3min continuam ativos**, sem pausa quando a aba fica em segundo plano (Central de Alertas, Dashboard ×2).
- **~28 listeners `onSnapshot` ativos**; pelo menos 3 sem nenhuma guarda contra duplicação (`relatorios.js` ×2, `dashboard-alertas.js` ×2, `acaodasemana.js`).
- **Zero paginação/`limit()`** na esmagadora maioria dos módulos de negócio; só o Portal do Cliente usa `limit()` de forma consistente.
- **Maior "vitória rápida" identificada**: `estoque.js::descontarEstoque()` faz full-scan da coleção inteira a cada venda no Caixa, só para achar 1 produto — trocar por `getDoc()` direto é baixo risco e alto retorno proporcional.
- `shared/listener-manager.js` (ferramenta pronta desde o recovery de 27/06) continua com **zero módulos usando**.

---

## 11. Fase 10 — Plano de Desenvolvimento

### 11.1 Situação geral do projeto

| Categoria | Quantidade aproximada | % do total (~35 módulos) |
|---|---|---|
| Concluído/homologado | 3 (Usuários e Permissões, Central de Alertas, Dashboard) | ~9% |
| Funcional (uso real, sem pendência bloqueante) | ~18 | ~51% |
| Funcional com risco/pendência relevante (RBAC ausente, dado sensível, etc.) | ~4 | ~11% |
| Quebrado por bug/regra (parece funcionar, não funciona) | 3 (Análise, Catálogo, Central de Organização) + risco não confirmado no Portal | ~9%+ |
| Não iniciado / placeholder | 6 (Compras, Chat, Estratégia, Automação, Auditoria, Em Breve) | ~17% |
| Utilitário interno (fora da contagem de produto) | 1 (kernel-test) | — |

**Leitura direta:** o sistema está mais avançado em amplitude (quase tudo tem algum código) do que em profundidade de segurança/qualidade (RBAC em 14% dos módulos, paginação em ~6%, 3 módulos ativamente quebrados sem que ninguém tenha percebido ainda porque falham em silêncio).

### 11.2 Ranking de prioridades (impacto × esforço)

| # | Item | Impacto | Esforço | Por quê primeiro/depois |
|---|---|---|---|---|
| 1 | Decidir e corrigir exposição do Portal do Cliente/OS pública | Crítico (dados reais de clientes expostos, painel operável por qualquer visitante) | Médio (toca Auth + Rules, exige planejamento cuidadoso p/ não quebrar o Portal legítimo) | Prioridade 0 — é dado real de terceiros exposto agora |
| 2 | Homologar e aprovar formalmente o Sprint 3 do RBAC (Estoque+Caixa) | Alto (destrava Sprint 4/5, já implementado e testado, só falta aprovação) | Baixo (só homologação manual) | Menor esforço/maior desbloqueio da lista |
| 3 | Investigar e corrigir os 3 módulos quebrados (Análise, Catálogo, Central de Organização) | Alto (funcionalidade que parece existir mas não entrega valor nenhum hoje) | Baixo-Médio (a causa já está identificada em cada caso — falta decidir a correção e criar/ajustar a regra) | Achado concreto, correção pontual e isolada por módulo |
| 4 | Adicionar regra às 2 subcoleções sem proteção (`financeiro_categorias/itens`, `portal-tecnico`) | Médio-Alto (pode estar quebrando parte do Financeiro e do Portal Técnico agora) | Baixo | Mudança pequena e isolada em Rules |
| 5 | Remover chave de criptografia hardcoded / PIN em texto puro | Alto (dado de senha real exposto a qualquer leitor do código-fonte) | Médio (decisão de negócio sobre como migrar dados já criptografados/gravados) | Depende de decisão do dono sobre criptografia real |
| 6 | Limpar `_BACKUPS`/`plans`/`CLAUDE.md` do que é publicado no site | Alto (informação interna sensível pública) | Baixo-Médio (ajustar `.gitignore`/workflow de publicação; decidir o que fazer com o histórico já público) | Não depende de nenhum outro item da lista |
| 7 | Avaliar rotação da SA key exposta no histórico do git | Alto | Depende do provedor (Google Cloud) | Fora do escopo de código; decisão/execução do dono no console GCP |
| 8 | Sincronizar/remover `firestore.rules`/`indexes.json` órfãos da raiz | Médio | Baixo | Rápido, remove risco de confusão futura |
| 9 | Atualizar `PROXIMA_ETAPA.md`/`MASTER_ROADMAP.md` | Médio (afeta continuidade entre sessões) | Baixo | Puramente documental |
| 10 | Continuar Fase 2 RBAC — Sprint 4 (Financeiro) e Sprint 5 (OS) | Alto (fecha a lacuna de autorização nos 2 módulos mais sensíveis: dinheiro e dados de cliente) | Médio-Alto | Só depois do item 2 (ordem oficial do roadmap) |
| 11 | Corrigir pollers de 30s/3min e o full-scan do `descontarEstoque` | Médio (custo Blaze crescente) | Baixo (o full-scan do estoque) a Médio (pollers) | Boa relação custo/benefício, sem dependência de outros itens |
| 12 | Decidir o destino de `compras` vs `fornecedor` antes de desenvolver qualquer um | Médio | — (decisão, não código) | Evita retrabalho ao decidir cedo |

### 11.3 Cronograma sugerido (respeitando a nova metodologia de "um módulo por vez")

Seguindo a diretriz definida pelo dono para depois desta auditoria (ciclo completo por módulo: requisitos → implementação → testes → TECHDOC → produção → só então o próximo), a sequência recomendada é:

1. **Módulo 0 (fora da fila normal, por gravidade): Segurança do Portal do Cliente + exposição de dados da OS.** Não é "um módulo de produto", mas trata-se de dado real de terceiros exposto — recomendo tratá-lo com o mesmo rigor formal (planejamento → decisão de negócio → correção → homologação → TECHDOC) antes de iniciar qualquer módulo novo.
2. **Homologação formal do Sprint 3 (Estoque+Caixa)** — já implementado, é só validar e aprovar; destrava o roadmap oficial de RBAC.
3. **Sprint 4 do RBAC — Financeiro** (ordem já definida no roadmap oficial, não pular).
4. **Correção pontual dos 3 módulos quebrados** (Análise, Catálogo, Central de Organização) — cada um é pequeno e isolado; pode ser tratado como 3 ciclos curtos e sequenciais, ou agrupado como "um módulo" se o dono preferir tratá-los como um único pacote de correções de regra.
5. **Sprint 5 do RBAC — OS** (fecha a Fase 2 inteira do roadmap oficial).
6. **Higiene de segurança restante** (chave de criptografia, PIN em texto puro, limpeza de `_BACKUPS`/`plans` públicos, SA key) — cada item pode virar seu próprio ciclo curto.
7. **Fase 3 do roadmap oficial (Consolidação da Arquitetura)** — só depois do RBAC completo, conforme já previsto no `MASTER_ROADMAP.md`.

### 11.4 Recomendação do próximo módulo

**Recomendo tratar primeiro a exposição do Portal do Cliente/OS pública (item 1), mesmo antes da homologação do Sprint 3**, porque é o único item desta lista com dado real de cliente exposto agora, para qualquer pessoa na internet — os demais são pendências de qualidade/processo, não incidente ativo. Se o dono preferir seguir a ordem "menor esforço primeiro", a **homologação do Sprint 3 (Estoque+Caixa)** é a alternativa: já está pronta, testada, e só falta a aprovação formal para destravar o resto do roadmap de RBAC.

Ambas as opções respeitam a nova regra de não abrir módulos em paralelo — a decisão de qual vem primeiro é do dono.

---

*Auditoria conduzida em 2026-07-04. Nenhum arquivo de código ou configuração foi alterado. Fontes: leitura direta de `CRM/`, `CRM/TECHDOC.md`, `plans/*.md` anteriores, `GUIA_MANUTENCAO.md`, `MASTER_ROADMAP.md`, `PROXIMA_ETAPA.md`, `git log`, e 4 agentes de pesquisa dedicados (módulos de negócio, módulos administrativos, banco de dados, desempenho).*
