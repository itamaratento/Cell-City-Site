# 🗺️ PLANO DIRETOR — PRÓXIMA FASE DO CELL CITY CRM (2026-07-04)

> **Natureza deste documento:** consolidação de planejamento. Não é uma nova auditoria — reúne, organiza e prioriza o que já foi levantado em `plans/AUDITORIA_GERAL_20260704.md` e `plans/AUDITORIA_EXECUTIVA_GERAL_20260704.md`, complementado por verificação direta de `git`, `plans/`, `MASTER_ROADMAP.md`, `PROXIMA_ETAPA.md` e `GUIA_MANUTENCAO.md` nesta sessão. **Nenhum código, branch, tag ou documento existente foi alterado ou excluído para produzir este plano.**
> Achados de segurança com detalhe explorável continuam redigidos aqui (mesma política dos dois relatórios de origem) — o registro técnico completo está em `plans/AUDITORIA_GERAL_20260704_INTERNO.md` (arquivo local, `.gitignore`d, nunca publicado). Este arquivo, como todo `plans/`, é publicado ao vivo no site institucional via GitHub Pages — **antes de publicar (commit/push), o dono do projeto deve revisar este documento.**
> Convenção de prioridade: 🔴 Crítica · 🟠 Alta · 🟡 Média · 🟢 Baixa.
> Este documento **não altera** `MASTER_ROADMAP.md` nem `PROXIMA_ETAPA.md` — por decisão explícita registrada na Etapa 2, respeitando a própria regra desses arquivos ("Modo Somente Leitura" em tarefa de diagnóstico/auditoria/análise, `PROXIMA_ETAPA.md` §"Modo Somente Leitura").

---

## ETAPA 1 — Estado Consolidado do Sistema

### 1.1 Visão geral

Sistema amplo, sem build step (HTML + ES modules nativos sobre Firebase): ~35 diretórios de módulo em `CRM/pages/`, ~45 mil linhas de JS, ~59 coleções Firestore de nível raiz + 3 caminhos de subcoleção. Cultura de documentação e homologação formal desde 2026-07-01 (`TECHDOC.md`, processo de 8 etapas, sistema de backup/rollback de código) — disciplina recente, que não cobre retroativamente todo o histórico do sistema.

**Situação em uma frase:** o núcleo operacional (OS, Caixa, Estoque, Financeiro, CRM Comercial, Dashboard) funciona e é usado no dia a dia; a segurança/RBAC está evoluindo ativamente (saga de correções sérias resolvida em produção em 2026-07-04); mas **há um risco crítico de exposição de dados reais de clientes ainda sem correção**, 3 módulos que aparentam funcionar e não funcionam, e zero suíte de testes automatizados persistente.

### 1.2 Percentual aproximado de conclusão

| Categoria | Quantidade | % do total (~35 módulos) |
|---|---|---|
| ✅ Concluído/homologado | 3 | ~9% |
| ✅ Funcional (uso real, sem pendência bloqueante) | ~18 | ~51% |
| ⚠️ Funcional com risco/pendência relevante | ~4 | ~11% |
| 🔴 Quebrado por bug/regra (aparenta funcionar, não funciona) | 3 (+ risco não confirmado no Portal) | ~9%+ |
| ⚪ Não iniciado / placeholder | 6 | ~17% |
| 🔧 Utilitário interno (fora da contagem de produto) | 1 (`kernel-test`) | — |

Lendo como métrica única: **o sistema está ~60% funcional na prática**, mas boa parte desse funcional carrega dívida de segurança/qualidade — RBAC granular em só 5 de 35 módulos (~14%), paginação em ~6%, zero teste automatizado persistente.

### 1.3 Módulos concluídos/homologados (3)

| Módulo | Referência |
|---|---|
| 🔐 Usuários e Permissões | `TECHDOC.md` §6, `MASTER_ROADMAP.md` Fase 1 |
| Central de Alertas | `TECHDOC.md` §3 |
| Dashboard (refatorado, 10 arquivos) | `TECHDOC.md` §15 |

### 1.4 Módulos/frentes em desenvolvimento

| Frente | Status | Observação |
|---|---|---|
| RBAC Fase 2 — Sprint 1 (Dashboard) | ✅ Aprovado 2026-07-02 | — |
| RBAC Fase 2 — Sprint 2 (CRM + Agenda) | ✅ Aprovado 2026-07-02 | tag `sprint2-rbac-crm-agenda-aprovado` |
| RBAC Fase 2 — Sprint 3 (Estoque + Caixa) | 🔵 Implementado + testado (12/12 jsdom) | **Aguardando homologação manual desde 2026-07-02** (2 dias) |
| RBAC Fase 2 — Sprint 4 (Financeiro) | ⚪ Não iniciado | bloqueado pela ordem oficial até Sprint 3 aprovado |
| RBAC Fase 2 — Sprint 5 (OS) | ⚪ Não iniciado | maior dependência cruzada, tratar como integração crítica |

### 1.5 Módulos pendentes (quebrados ou não iniciados)

| Módulo | Status | Causa/observação |
|---|---|---|
| `portal-cliente` (admin) | 🔴 Risco crítico | Painel admin sem gate de autenticação; ver Riscos §1.7 — detalhe técnico só no registro interno |
| `analise` | 🔴 Quebrado | `fetch()` REST sem token contra coleção que exige auth — dado sempre vazio, falha silenciosa |
| `catalogo` | 🔴 Quebrado | Vitrine pública nunca autentica, mas a regra exige auth; `catalogo_config` sem regra nenhuma |
| `central-organizacao` | 🔴 Quebrado | Coleção `central_organizacao` sem regra Firestore — nega tudo |
| `compras` | ⚪ Não iniciado | Placeholder puro; sobreposição conceitual com `fornecedor` (decidir antes de desenvolver qualquer um) |
| `chat` | ⚪ Não iniciado | Órfão, 3 arquivos de 0 bytes |
| `estrategia` | ⚪ Não iniciado | Órfão, 3 arquivos de 0 bytes |
| `automacao` | ⚪ Não iniciado | Pasta vazia; colide de nome com `central-organizacao` (exibida como "Central Automação") |
| `auditoria` | ⚪ Não iniciado | Mockup "em breve", sem lógica |
| `em-breve` | ⚪ Placeholder de sistema | Fallback intencional |

### 1.6 Débitos técnicos consolidados

Fonte cruzada: `AUDITORIA_GERAL_20260704.md` §4 (35 itens) + `GUIA_MANUTENCAO.md` §5 (18 itens, alguns já superados pela saga de segurança de 07-03/07-04 — ver nota em Etapa 2). Consolidado e deduplicado abaixo, por área:

**Infraestrutura/ambientes**
- Backend Firebase único para MAIN e DEVELOP — separação planejada, freeze de infraestrutura em vigor desde 2026-07-02 (`plans/SEPARACAO_AMBIENTES_DEV_PROD.md`).
- `firestore.rules`/`firestore.indexes.json` duplicados (raiz obsoleta vs. `CRM/` real) + variantes soltas `.BACKUP_2026-07-01`/`.secure` dentro de `CRM/`.
- `_BACKUPS/`, `plans/` e `CLAUDE.md` rastreados no git e publicados ao vivo no GitHub Pages (raiz **e** `/dev`) — confirmado nesta sessão: o workflow `deploy-pages.yml` faz `rsync` de toda a árvore de cada branch (exceto `.git`/`.github`), sem nenhuma exclusão de `_BACKUPS`/`plans`/`CLAUDE.md`.
- `firebase.json` ainda tem seção `hosting` apesar de o Firebase Hosting ser proibido.
- `localStorage` compartilhado entre `/` e `/dev` (mesma origem).
- 74 arquivos com paths absolutos `/CRM/` levantados em 2026-07-02 — só ~6 corrigidos (H-006, H-009 e adjacentes); resto sem revisão. Pelo menos 1 caso adicional já identificado e não corrigido (`dashboard-alarme-os.js::abrirJanelaFlutuante`, "H-010 em potencial").
- `backup-dados.js` (backup de **dados**) não cobre `usuarios`, `perfis_operacionais`, `auditoria_usuarios_permissoes` e outras coleções pós-RBAC — distinto do backup de **código** (git), que é maduro.

**Banco de dados**
- 9 coleções de nível raiz sem regra Firestore (`alertas_usuario`, `auditoria_saas`, `backup_logs`, `catalogo_config`, `central_organizacao`, `chips_cadastros`, `contas_numeros`, `diario_eventos`, `notificacoes_saas`) + 2 subcoleções sem regra com impacto funcional provável (`financeiro_categorias/{id}/itens`, `usuarios/{uid}/portal-tecnico/{id}`).
- 2 índices compostos faltando com evidência de falha real já ocorrida (`avaliacoes`, `mensagens_portal`, ambos por `telefoneDigits + createdAt`); 2 índices existentes órfãos (não usados por nenhuma query atual).
- Coleção `produtos` legada (substituída por `estoque_produtos`, mantida só como fallback); 6 blocos `match` mortos em `firestore.rules`.
- Coleção `config` genérica demais (7+ documentos de propósitos distintos); 4 coleções `categorias_*` fragmentadas por módulo.

**Aplicação**
- RBAC granular (`shared/permissoes.js`) só em 5 de ~35 módulos; `initModulo()` do kernel também inconsistente fora do RBAC (`clientes`, `financeiro`, `fornecedor`, `diario`, `importar`, todo `portal-tecnico`).
- Duplicação de lógica de negócio Caixa↔Estoque (recálculo de custo médio divergente); duas cadeias de automação sem gate de permissão no destino (Caixa↔Estoque já documentada; **OS→Agenda + OS→Financeiro**, achado novo da auditoria, via `runAutomacoesOS()`).
- 4 mecanismos distintos de identidade coexistindo (`kernel.js`, `firebase-secondary.js`, `shared/session.js`, sessão anônima do Portal).
- `shared/tenant.js` código morto (multiempresa revertido em 2026-06-27), ainda no repositório.
- `os/auth.js` código morto (import quebrado); `analise.js` com import morto e arquivo-lixo órfão de 0 bytes.
- Condição de corrida na coluna "Perfil" da aba Usuários (`renderUsuarios()` não reage ao listener de `perfis`); card da Agenda no Dashboard não ocultado pelo RBAC; iframe de fechamento automático do Caixa dispara sem efeito a cada carga do Dashboard.
- `central-organizacao`: campos de e-mail/senha de WhatsApp descartados silenciosamente ao salvar (bug real, não limitação).
- 7 módulos funcionais fora do catálogo `TODOS_MODULOS` (não favoritáveis); catálogo com 1 entrada duplicada (`impressora`=`config`).
- `importar.js` dispara escrita em massa em produção (incl. `caixa_lancamentos`) sem confirmação e sem RBAC.
- Doc órfão `usuarios/{uid}` do usuário de teste `eu@cellcity.com.br` (Auth já deletado) — limpeza pendente desde 2026-07-02.

**Desempenho**
- Zero paginação/`limit()` na quase totalidade dos módulos de negócio (só o Portal do Cliente usa de forma consistente).
- 3 pollers de 30s/3min sem pausa em aba oculta (Central de Alertas, Dashboard ×2); ~28 listeners `onSnapshot`, pelo menos 3 sem guarda contra duplicação.
- Full-scan da coleção inteira em `estoque.js::descontarEstoque()` a cada venda no Caixa, só para achar 1 produto — trocar por `getDoc()` direto é a "vitória rápida" mais clara identificada.
- `shared/listener-manager.js` pronto desde o recovery de 27/06, zero módulos usando.
- `temAcessoLiberado()` já ativo em produção soma +1 leitura por operação em ~45 coleções — amplifica proporcionalmente todos os pollers/full-scans existentes; produção migrou de Spark para Blaze em 2026-07-04, então o teto de cota deixou de travar o sistema, mas o custo direto substitui o risco de indisponibilidade.

**Arquivos temporários/backup soltos (confirmado nesta sessão, mais extenso do que a auditoria original listou)**
- Busca por `*.backup*`/`*BACKUP*`/`*CORROMPIDO*` em `CRM/` retornou **~40 arquivos e 2 diretórios inteiros de backup** espalhados por `shared/`, `pages/dashboard/`, `pages/caixa/`, `pages/os/`, `pages/crm-comercial/`, `pages/acaodasemana/`, `pages/estoque/`, `pages/central-informacoes/`, `pages/central-comandos/`, `pages/portal-tecnico/` — todos rastreados no git e, portanto, publicados ao vivo junto com o resto de `CRM/`. Detalhe completo na Etapa 5.

### 1.7 Riscos identificados (ranking por severidade)

1. 🔴 **Exposição crítica de dados reais de clientes** associada ao fluxo OS/Portal do Cliente — achado novo da auditoria de 2026-07-04, ainda sem correção. Mecanismo técnico redigido nesta cópia pública; detalhe completo em `plans/AUDITORIA_GERAL_20260704_INTERNO.md`. **Prioridade 0 do projeto.**
2. 🟠 Segredo/chave hardcoded no código-fonte protegendo senhas reais (Central de Informações) — mesma chave para todos os usuários.
3. 🟠 PIN da loja (`config`) gravado e cacheado em texto puro, apesar do nome sugerir hash.
4. 🟠 `_BACKUPS/`, `plans/` e `CLAUDE.md` publicados ao vivo no site institucional — confirmado nesta sessão via inspeção do workflow de deploy; inclui ~40 arquivos de backup de código antigo e toda a documentação interna de planejamento/risco.
5. 🟠 Achado de segurança de infraestrutura envolvendo credencial de deploy (SA key exposta no histórico do git, nunca rotacionada) — decisão/execução fora do escopo de código, no console GCP do dono.
6. 🟡 Sessões anônimas do Portal podem, em tese, listar `avaliacoes`/`mensagens_portal` de outros clientes (regra não restringe por dono do documento).
7. 🟡 RBAC granular só em 5/35 módulos — autorização por função depende quase toda de Firestore Rules binárias (tem conta liberada ou não).
8. 🟡 Backend Firebase único compartilhado entre MAIN e DEVELOP — qualquer teste em DEV consome cota/afeta dados de produção; freeze de infraestrutura em vigor até separação formal.
9. 🟢 Custo Blaze crescente por amplificação de leitura não tratada no código (nenhuma das 7 fases do plano de otimização de performance foi implementada).

### 1.8 Oportunidades de melhoria

- Extrair a lógica de custo médio/baixa de estoque para um único ponto compartilhado entre Caixa e Estoque, eliminando a duplicação divergente.
- Adotar `shared/listener-manager.js` (já existe, zero uso) para eliminar listeners duplicados.
- Trocar o full-scan de `descontarEstoque()` por `getDoc()` direto — baixo risco, alto retorno.
- Consolidar a coleção `config` genérica e as 4 `categorias_*` fragmentadas em esquemas únicos com campo `modulo`.
- Remover código morto confirmado (`shared/tenant.js`, `os/auth.js`, imports/arquivos órfãos de `analise.js`) após confirmação de que nada depende dele.
- Introduzir paginação/`limit()` nos módulos de maior volume de leitura (Relatórios, OS, Caixa) — maior alavanca de redução de custo Blaze.
- Formalizar o backup de **dados** (`backup-dados.js`) para cobrir as coleções pós-RBAC, hoje só cobertas pelo backup de código.

---

## ETAPA 2 — Revisão da Documentação

### 2.1 Documentação corrente (não precisa de ação)

| Documento | Papel | Situação |
|---|---|---|
| `CRM/TECHDOC.md` | Documentação técnica oficial | ✅ 995 linhas, 16 seções, única fonte 100% atualizada (última alteração 2026-07-04 19:37) |
| `plans/AUDITORIA_GERAL_20260704.md` + `_INTERNO.md` | Auditoria de origem | ✅ Corrente, base deste plano |
| `plans/AUDITORIA_EXECUTIVA_GERAL_20260704.md` | Auditoria complementar | ✅ Corrente, base deste plano |
| `GUIA_OPERACAO_AMBIENTES.md`, `GUIA_ROLLBACK.md`, `GUIA_MANUTENCAO.md` | Guias operacionais | ✅ Válidos como referência; ver nota 2.3 sobre 1 item potencialmente superado |
| `HISTORICO_PROJETO.md` | Histórico acumulativo | ✅ Referência histórica, manter — nunca sobrescrever, só adicionar |
| `plans/BACKLOG.md` (BL-001 a BL-006) | Backlog formal | ✅ Ativo — BL-006 já corrigida/aceita; demais em aberto |
| `plans/fase2-sprint1/2/3-*-rbac.md`, `PLANO_ACAO_RISCOS_CRITICOS_INTERNO.md (interno, não versionado desde 2026-07-06)`, `EXECUCAO_RISCOS_CRITICOS_INTERNO.md (interno, não versionado desde 2026-07-06)`, `VALIDACAO_FUNCIONAL_RISCOS.md`, `CONFERENCIA_FINAL_COLECOES.md`, `ENCERRAMENTO_AUDITORIA.md`, `SEPARACAO_AMBIENTES_DEV_PROD.md`, `HOMOLOGACAO_SEPARACAO_AMBIENTES.md`, `PLANO_OTIMIZACAO_PERFORMANCE_20260703.md`, `RELATORIO_COTA_FIRESTORE_20260702.md`, `FASE_3_*`, `FASE_4_*` | Ciclo de segurança/ambientes/RBAC 2026-07-02/03 | ✅ Ainda válidos como registro histórico e plano em aberto — **manter como estão** |

### 2.2 Documentos desatualizados — **recomendação, sem alteração nesta entrega**

| Documento | Problema | Recomendação |
|---|---|---|
| `MASTER_ROADMAP.md` | Sem atualização desde 2026-07-02; não reflete a saga de segurança, Cloud Functions, backup, refatoração do Dashboard nem H-009 de 2026-07-04 | Refresh formal como **tarefa própria** (não incluída nesta entrega — ver nota abaixo) |
| `PROXIMA_ETAPA.md` | Mesma desatualização; é a fonte oficial de "onde paramos" e hoje está incorreta | Idem — refresh formal como tarefa própria |

> **Por que não atualizei estes dois arquivos agora:** `PROXIMA_ETAPA.md` define sua própria regra — *"Modo Somente Leitura: se a solicitação for diagnóstico, auditoria, investigação, relatório ou análise: NÃO atualizar arquivos de continuidade, apenas ler e usar as informações"*. Esta entrega é exatamente esse tipo de tarefa (consolidação de auditoria, "não iniciar novos módulos"). Recomendo tratar o refresh de `MASTER_ROADMAP.md`/`PROXIMA_ETAPA.md` como o primeiro item de execução após este plano ser aprovado — ver Etapa 3, item "Refresh dos documentos de continuidade".

### 2.3 Divergência a verificar entre documentos

- `GUIA_MANUTENCAO.md` §5, item 9 registra *"`kernel.js` assume `perfil='admin'` por padrão para UID sem doc `usuarios/{uid}`"* como dívida técnica aberta. A memória do projeto e o `TECHDOC.md` §6.12-6.14 indicam que a escalada de privilégio via `usuarios/{uid}` (BL-006) foi corrigida e aceita em 2026-07-03. Os timestamps dos dois arquivos são próximos e não permitem confirmar automaticamente qual está certo. **Recomendação:** ao atualizar `GUIA_MANUTENCAO.md`, confirmar no código atual (`kernel.js`) se esse item ainda procede e remover/atualizar a entrada se já estiver superado pela correção do BL-006.

### 2.4 Documentos potencialmente obsoletos (plans/, de 2026-06-10)

Anteriores ao rollback de 2026-06-27 que reverteu o experimento multiempresa — podem descrever arquitetura que não existe mais:

| Documento | Recomendação |
|---|---|
| `plans/FAVORITOS_INTELIGENTES.md` | Revisar relevância antes de reaproveitar; se a arquitetura descrita não existe mais, mover para uma pasta de arquivo histórico (não excluir) |
| `plans/MELHORIAS_OS.md` | Idem |
| `plans/MELHORIA_CONTINUAR_PAREI.md` | Idem |
| `plans/REORDENAR_FAVORITOS_DND.md` | Idem |
| `plans/fase2-portal-admin.md` | Idem — nome sugere relação direta com o risco crítico do Portal (Etapa 1, item 1.7-1); vale revisar primeiro por esse motivo |

**Recomendação geral:** não excluir nenhum destes 5. Criar (em tarefa própria, com autorização) uma subpasta `plans/_HISTORICO/` ou adicionar um cabeçalho de aviso ("⚠️ Documento anterior ao rollback de 2026-06-27 — não usar como referência de arquitetura atual") em cada um, preservando-os como registro histórico.

### 2.5 Duplicação de arquivos de configuração

- `firestore.rules` / `firestore.indexes.json` da raiz do repo (obsoletos, sem a correção de segurança de 07-04) vs. `CRM/firestore.rules` / `CRM/firestore.indexes.json` (fonte real, usada em deploy) — confirmado nesta sessão via `find`.
- Variantes soltas adicionais dentro de `CRM/`: `firestore.rules.BACKUP_2026-07-01`, `firestore.rules.secure`; na raiz: `firestore.rules.backup`, `firestore.rules.backup_saas_2026-06-24`.
- **Recomendação:** remover as cópias da raiz e as variantes soltas dentro de `CRM/` (mantendo só `CRM/firestore.rules`/`CRM/firestore.indexes.json` como fonte única) — mas isso toca um arquivo adjacente a Firestore Rules, então segue a regra do `CLAUDE.md` §1 (autorização explícita antes de alterar). Não removido nesta entrega, só recomendado.

### 2.6 Registro interno — reafirmação de política

`plans/AUDITORIA_GERAL_20260704_INTERNO.md` deve permanecer com sufixo `_INTERNO.md`, fora do git (`.gitignore` linha 79), nunca publicado. Nenhum novo conteúdo sensível foi criado nesta consolidação — apenas referenciado.

---

## ETAPA 3 — Plano Oficial de Desenvolvimento (Roadmap)

| # | Item | Objetivo | Dependências | Complexidade | Esforço | Benefício operacional | Critério de aceite | Prioridade |
|---|---|---|---|---|---|---|---|---|
| 0 | Segurança Portal do Cliente / OS pública | Eliminar exposição de dados reais de clientes (achado crítico registrado no topo de `AUDITORIA_GERAL_20260704.md`) | Decisão do dono sobre desenho do gate; toca Auth + Rules | Alta | Médio | Elimina o único incidente ativo de dados reais expostos | Controle de acesso reforçado no painel admin e nas regras de leitura associadas ao fluxo, validado nos 3 perfis (cliente legítimo, painel autenticado, visitante anônimo), sem regressão — detalhe técnico do estado atual só no registro interno | 🔴 P0 |
| 1 | Homologação formal Sprint 3 RBAC (Estoque+Caixa) | Aprovar em produção o que já está implementado e testado | Nenhuma | Baixa | Baixo | Destrava Sprint 4/5 do roadmap oficial | Zero regressão nos 12/12 cenários já cobertos pelo `jsdom`, validado em navegador real; aprovação registrada no TECHDOC §7.3 | 🔴 P0 (alternativa de menor esforço ao item 0) |
| 2 | Sprint 4 RBAC — Financeiro | Fechar lacuna de autorização no módulo financeiro | Item 1 aprovado | Média-Alta | Médio-Alto | Controle de acesso em aprovações/exclusões financeiras | `shared/permissoes.js` integrado; TECHDOC §7.4; zero regressão, auditoria funcionando | 🟠 P1 |
| 3 | Correção dos 3 módulos quebrados (Análise, Catálogo, Central de Organização) | Restaurar funcionalidade que aparenta existir e não entrega valor | Nenhuma entre si | Baixa-Média por módulo | Baixo-Médio | Recupera 3 módulos hoje inúteis silenciosamente | Cada módulo lê/grava dado real em produção (não mais vazio ou negado) | 🟠 P1 |
| 4 | Regra para as 2 subcoleções sem proteção (`financeiro_categorias/itens`, `portal-tecnico`) | Corrigir possível quebra parcial de Financeiro/Portal Técnico | Nenhuma | Baixa | Baixo | Elimina risco funcional silencioso | Regra publicada em `CRM/firestore.rules`, testada via emulador antes do deploy | 🟠 P1 |
| 5 | Sprint 5 RBAC — OS | Fechar a Fase 2 do roadmap oficial no módulo mais sensível | Sprints 1-4 aprovados | Alta | Alto | Controle de acesso no núcleo do negócio (maior volume de dados) | `shared/permissoes.js` integrado; atenção a `runAutomacoesOS()` não vazar para módulos sem permissão; TECHDOC §7.5 | 🟠 P1 |
| 6 | Remover chave de criptografia hardcoded / PIN em texto puro | Proteger dados de senha reais | Decisão do dono sobre migração de dados já gravados/criptografados | Média | Médio | Elimina exposição de senha real a qualquer leitor do código | Chave não mais hardcoded; PIN armazenado com hash real | 🟠 P1 |
| 7 | Limpar publicação de `_BACKUPS`/`plans`/`CLAUDE.md` no site ao vivo | Parar de publicar material interno/histórico no site institucional | Nenhuma | Baixa-Média | Baixo-Médio | Remove informação operacional interna do público | Deploy publica só o necessário; `_BACKUPS` e `CLAUDE.md` fora do artefato do GitHub Pages | 🟠 P1 |
| 8 | Avaliar rotação da SA key exposta no histórico do git | Eliminar credencial de deploy comprometida | Provedor (Google Cloud) | Baixa (ação), depende do GCP | — | Remove risco de acesso não autorizado à infraestrutura | Nova chave gerada, antiga revogada, confirmado no console GCP | 🟠 P1 |
| 9 | Sincronizar/remover `firestore.rules`/`indexes.json` órfãos da raiz + variantes `.backup`/`.secure` | Eliminar risco de editar/auditar o arquivo errado | Autorização (toca área adjacente a Rules) | Baixa | Baixo | Fonte única de verdade para Rules/Índices | Só `CRM/firestore.rules`/`CRM/firestore.indexes.json` restantes | 🟡 P2 |
| 10 | Refresh dos documentos de continuidade (`MASTER_ROADMAP.md`, `PROXIMA_ETAPA.md`) | Realinhar a fonte oficial de "onde paramos" com a realidade de 07-04 | Este plano aprovado | Baixa | Baixo | Continuidade entre sessões deixa de depender só do TECHDOC | Ambos os arquivos refletem estado real (RBAC, Cloud Functions, backup, Dashboard, H-009) | 🟡 P2 |
| 11 | Vitórias rápidas de desempenho (full-scan `descontarEstoque`, pollers sem pausa, adoção de `listener-manager.js`) | Reduzir amplificação de leitura crescente em custo Blaze | Nenhuma | Baixa-Média | Baixo-Médio | Redução de custo direto, sem mudança de comportamento visível | Full-scan substituído por `getDoc()`; pollers pausam em aba oculta; ao menos 1 módulo usando `listener-manager.js` | 🟡 P2 |
| 12 | Decidir destino de `compras` vs. `fornecedor` | Evitar retrabalho antes de desenvolver qualquer um | Decisão do dono | — | — (decisão) | Escopo claro para o próximo módulo de estoque/compras | Decisão registrada em TECHDOC/BACKLOG | 🟡 P2 |
| 13 | Introduzir 1ª suíte de testes automatizados persistente | Detectar regressão automaticamente | Nenhuma técnica; decisão do dono sobre investir agora | Média | Médio | Reduz dependência de teste manual a cada alteração | Ver Etapa 4 (estratégia detalhada) | 🟡 P2 |
| 14 | Higiene de repositório (branches, tags, arquivos de backup soltos) | Reduzir ruído e risco de confusão no repositório | Confirmação do dono por item | Baixa | Baixo | Repositório mais legível e seguro | Ver Etapa 5 (lista detalhada, nada excluído automaticamente) | 🟢 P3 |

---

## ETAPA 4 — Plano de Qualidade

**Escopo desta etapa: só estratégia documentada, nenhuma implementação.**

### 4.1 Situação atual

- **Cobertura de testes automatizados persistente: zero.** Nenhum arquivo `*.test.js`/`*.spec.js` em toda a árvore (fora de `node_modules`/`_BACKUPS`); nenhuma configuração de test runner no `package.json` raiz.
- **Método real de verificação usado até hoje:** harness `jsdom` temporário — instalado como devDependency, roda o código real dos módulos contra Firebase mockado, e é removido na mesma sessão (método já validado, ver [[feedback-homologacao-sem-browser]]). Funciona bem por sprint, mas não é reexecutável automaticamente nem roda em CI.
- **CI configurado:** só 1 workflow (`deploy-pages.yml`), que publica no GitHub Pages — não há verificação automática a cada push.
- **Testes de Firestore Rules:** já usados formalmente na Fase 1 (`@firebase/rules-unit-testing` + emulador local, 18/18 casos antes do deploy) — método validado, mas não repetido de forma persistente nos sprints seguintes.

### 4.2 Áreas críticas sem teste automatizado persistente

Coincide com o `CLAUDE.md` §5 (verificação manual obrigatória a cada alteração): **Login, Dashboard, CRM, Ordem de Serviço, Caixa, Estoque, Financeiro, Portal do Cliente**.

### 4.3 Fluxos mais sensíveis (por impacto de falha)

| Fluxo | Por que é sensível |
|---|---|
| Login / Autenticação / RBAC | Ponto único de entrada; falha aqui bloqueia ou libera acesso indevido a todo o resto |
| Ordem de Serviço / Portal do Cliente | Dado real de terceiros; já é o item de maior risco ativo do projeto |
| Caixa / Financeiro | Dinheiro real; erro silencioso tem custo financeiro direto |
| Estoque (via Caixa) | Baixa automática nunca bloqueada por permissão — decisão de produto já confirmada, mas amplia o raio de um bug de cálculo |

### 4.4 Sintomas concretos da falta de teste de regressão

- Os 3 módulos quebrados (Análise, Catálogo, Central de Organização) só foram encontrados porque a auditoria leu o código manualmente — nenhum alarme automático os sinalizou.
- Sprint 3 do RBAC (Estoque+Caixa) tem 12/12 cenários aprovados no harness `jsdom` desde 02/07, mas é o item de "qualidade pendente" mais antigo em aberto — precisa de repetição manual em navegador real porque o harness não persiste.

### 4.5 Estratégia recomendada (documentar agora, decidir quando implementar)

Abordagem incremental, reaproveitando os dois métodos já validados no projeto em vez de introduzir uma ferramenta nova:

1. **Fase A — Persistir o harness `jsdom` já validado.** Em vez de descartá-lo a cada sprint, promovê-lo a uma suíte fixa (`tests/` ou similar) reexecutável com 1 comando, começando pelos cenários que já existem para Sprint 1-3 do RBAC (não são casos novos, são os mesmos já escritos e aprovados — só deixam de ser descartados).
2. **Fase B — Persistir os testes de Firestore Rules.** Mesma lógica para `@firebase/rules-unit-testing`: os 18 casos da Fase 1 já existiram uma vez; recriá-los como suíte fixa cobre o componente mais crítico do sistema (Rules) com o menor esforço relativo, porque o padrão já está validado.
3. **Fase C — CI mínimo.** Um segundo workflow (separado de `deploy-pages.yml`, que só publica) rodando `npm test` a cada push/PR — não precisa bloquear o deploy no início, só dar visibilidade de regressão.
4. **Fase D — Expandir cobertura por módulo, seguindo a mesma ordem "um módulo por vez" já em vigor** — cada novo sprint RBAC (Financeiro, OS) já nasce com teste persistente, em vez de ad-hoc.

Nenhuma fase acima está sendo iniciada nesta entrega — é a estratégia recomendada, para decisão do dono sobre quando entrar no roadmap (ver Etapa 3, item 13).

---

## ETAPA 5 — Organização do Repositório

**Nada foi excluído. Lista de levantamento + recomendação, para decisão do dono.**

### 5.1 Branches locais

| Branch | Situação verificada agora | Recomendação |
|---|---|---|
| `main` | Ativa, `HEAD` atual, working tree limpa | Manter |
| `develop` | Ativa, árvore idêntica a `main` (confirmado via diff vazio) | Manter |
| `refactor-dashboard-modular` | Conteúdo já absorvido em `develop`/`main` (refatoração do Dashboard já mergeada e documentada em TECHDOC §15) | Candidata a remoção, após confirmação do dono |
| `fix-h009-iframe-caixa-dev-path` | Commit já presente em `develop`/`main`, correção documentada em TECHDOC §16 | Candidata a remoção, após confirmação do dono |
| `fase5-env-config`, `fix-bl006-usuarios-escalada`, `fix-h002-favoritos-sw`, `fix-h003-login-redirect`, `fix-h004-gate-dev`, `fix-h005-config-login`, `fix-h006-rbac-guards`, `fix-h008-kernel-import-path` | Correspondem a itens que o TECHDOC já documenta como corrigidos e promovidos (H-002 a H-008, BL-006, Fase 5 ambiente). Squash merge altera o hash, então o diff literal contra `develop`/`main` não fica vazio — **não é possível confirmar 100% automaticamente que nada ficou pendente** | Revisão rápida do dono por branch (comparar contra a seção correspondente do TECHDOC) antes de apagar; fortes candidatas, não confirmadas |

**Comando de remoção sugerido, só após confirmação individual** (não executado aqui): `git branch -d <nome>` (não `-D`, para que o git recuse caso detecte trabalho não mesclado).

### 5.2 Branches remotas

`git branch -a` mostra só `origin/main` e `origin/develop` — nenhuma branch de feature foi empurrada para o remoto. **Nada a limpar remotamente.**

### 5.3 Tags

| Tag(s) | Origem | Recomendação |
|---|---|---|
| `v2026.07.03-2029` … `v2026.07.04-1931` (versionamento semântico) | Sistema oficial `subir-ok` | Manter permanentemente — são o histórico de versão de produção |
| `fase-1` | Marco de fase | Manter (marco histórico nomeado) |
| `pre-*-merge` (7 tags: `pre-fase5-merge`, `pre-h002/h003/h004/h005/h006/h008-merge`, `pre-bl006-merge`) | Backup automático pré-merge de cada correção | Candidatas a remoção **em par com a branch correspondente** (5.1) — só depois de confirmado que a correção está integrada e documentada no TECHDOC |
| `backup-main-pre-promocao`, `backup-develop-pre-sync` | Backups pontuais de sincronização/promoção já concluída | Candidatas a remoção, mesma lógica acima |
| `sprint2-rbac-crm-agenda-aprovado` | Tag de restauração de um sprint já aprovado e em produção | Manter — é referência formal citada no `MASTER_ROADMAP.md` |
| `manual-2026-07-04_13-10-59-*`, `manual-2026-07-04_13-30-26-*`, `auto-slot-A` | Tags internas do sistema oficial de backup, que vazaram para `origin` do Cell-City-Site por engano (já registrado na memória do projeto: fix do `--follow-tags` aplicado ao script, mas tags antigas seguem no remoto) | Remoção manual pendente — decisão do dono, conforme já registrado |

**Nenhuma tag de versão (`v2026.*`) deve ser removida.**

### 5.4 Arquivos temporários / backups soltos em produção

Confirmado nesta sessão via busca direta em `CRM/` (mais extenso do que o item 16 da auditoria original havia listado) — **todos rastreados no git e publicados ao vivo** junto com o resto do site:

- **Diretórios inteiros de backup dentro de páginas ativas:** `CRM/pages/dashboard/BACKUP_REDESIGN_PAINEL_2026-06-14/` (com subarquivos próprios), `CRM/pages/dashboard/BACKUP_SITE_BTN_ICONE_2026-06-14/`, `CRM/pages/dashboard/BACKUP_UNIF_ALERTAS_2026-06-14/`, `CRM/pages/dashboard/BACKUP_ENV_INDICATOR_2026-07-01/`, `CRM/pages/dashboard/BACKUP_SITE_BTN_2026-06-14/`, `CRM/pages/dashboard/BACKUP_RBAC_DASHBOARD_2026-07-01/`, `CRM/shared/BACKUP_SITE_BTN_ICONE_2026-06-14/`, `CRM/shared/BACKUP_SITE_BTN_2026-06-14/`.
- **~30 arquivos individuais** com sufixo `.backup-*`/`.BACKUP_*`/`.bak-*` em `shared/` (favoritos, sidebar, brand-header, central-modulos ×2 cada), `pages/os/` (2, incl. um marcado `CORROMPIDO`), `pages/dashboard/` (4), `pages/caixa/` (1), `pages/crm-comercial/` (5), `pages/acaodasemana/` (2), `pages/estoque/` (1), `pages/central-informacoes/` (2), `pages/central-comandos/` (1), `pages/portal-tecnico/solucoes-tecnicas/` (1).
- **Duplicatas de `firestore.rules`** já cobertas na Etapa 2.5.

**Recomendação:** este material é redundante em relação ao sistema oficial de backup (git + tags + `Cell-City-Backup`, já maduro) e à disciplina do próprio `CLAUDE.md` §1 ("sempre criar backup antes de alterar arquivo crítico") — hoje esse princípio gera arquivos soltos que ficam publicados no site ao vivo. Sugestão: mover o conteúdo relevante para o sistema oficial de backup (se ainda não estiver coberto por alguma tag/slot já existente) e remover os arquivos do working tree, como tarefa própria e isolada — não parte desta consolidação.

### 5.5 Documentação candidata a arquivamento

Já detalhado na Etapa 2.4 — os 5 documentos de `plans/` de 2026-06-10, anteriores ao rollback do multiempresa.

---

## ETAPA 6 — Priorização

1. **Qual módulo deve ser desenvolvido primeiro?** Estritamente falando, nenhum módulo novo — o primeiro item da fila é **decidir e corrigir a exposição do Portal do Cliente/OS pública** (dado real de terceiro exposto agora). Alternativa de menor esforço, se o dono preferir destravar o roadmap primeiro: **homologar formalmente o Sprint 3 do RBAC** (Estoque+Caixa), que já está pronto e testado.
2. **Qual módulo traz maior retorno operacional?** Caixa e Estoque (uso diário constante, ligados à venda) e Ordens de Serviço (núcleo do negócio, maior volume de dados) — já concluídos/funcionais, o retorno adicional vem de fechar RBAC e segurança neles, não de desenvolvê-los do zero.
3. **Qual módulo apresenta maior risco?** Portal do Cliente / fluxo de OS pública — único item com dado real de cliente exposto publicamente hoje.
4. **Qual módulo está mais próximo de ser concluído?** Estoque + Caixa (Sprint 3 do RBAC) — implementado, testado automaticamente (12/12), só falta homologação manual e aprovação formal.
5. **Qual sequência completa de desenvolvimento é recomendada?**
   1. Segurança do Portal/OS (item 0 da Etapa 3) — ou, na ordem alternativa de menor esforço, homologação do Sprint 3 primeiro;
   2. Homologação Sprint 3 RBAC;
   3. Sprint 4 RBAC (Financeiro);
   4. Correção dos 3 módulos quebrados (Análise, Catálogo, Central de Organização);
   5. Sprint 5 RBAC (OS);
   6. Higiene de segurança restante (chave hardcoded, PIN em texto puro, publicação de `_BACKUPS`/`plans`, SA key);
   7. Fase 3 do `MASTER_ROADMAP.md` (Consolidação da Arquitetura), já prevista para depois do RBAC completo.

---

## ETAPA 7 — Plano da Próxima Sprint (proposta, aguardando autorização)

**Módulo/item escolhido — recomendação primária:** Sprint 0 — Segurança do Portal do Cliente / exposição de dados da OS.
**Alternativa, se o dono preferir o menor esforço primeiro:** Homologação formal do Sprint 3 RBAC (Estoque+Caixa) — nesse caso, os itens abaixo se aplicam a essa homologação em vez da correção de segurança.

> Este plano de sprint é uma **proposta**, não uma execução. Por envolver Login/Autenticação/Permissões, exige autorização explícita antes de qualquer implementação, conforme `CLAUDE.md` §1 e o congelamento de escopo vigente ([[feedback-modo-producao-congelamento]]).

### Escopo
Corrigir o achado crítico registrado no topo de `AUDITORIA_GERAL_20260704.md` (exposição associada ao fluxo OS/Portal do Cliente), reforçando o controle de acesso ao painel administrativo do Portal e às regras de leitura associadas — sem quebrar o fluxo legítimo do cliente final (que precisa acessar sua própria OS sem login tradicional). O mecanismo exato do problema está apenas no registro interno (`plans/AUDITORIA_GERAL_20260704_INTERNO.md`); esta seção descreve só o resultado esperado.

### Objetivos
- Fechar o acesso administrativo do Portal atrás de autenticação real.
- Restringir a leitura dos dados de OS pelo Portal ao estritamente necessário (cliente dono do documento, ou painel autenticado) — sem regredir o autoatendimento.
- Não alterar comportamento visível para o cliente legítimo.

### Entregas
- Gate de autenticação em `portal-cliente/admin.js`/`admin.html`.
- Regra de Firestore revisada para `os/{osId}` (e documentos relacionados consumidos por `garantia.html`, se aplicável).
- Atualização do `CRM/TECHDOC.md` (nova seção, seguindo o padrão das seções §6.12-6.14 e §16).

### Critérios de aceite
- Painel admin do Portal exige login válido — testado com tentativa de acesso anônimo (deve falhar).
- Cliente legítimo continua acessando sua própria OS sem regressão.
- Visitante anônimo não consegue mais ler dados de OS de terceiros.
- Testes de Firestore Rules via emulador (`@firebase/rules-unit-testing`) cobrindo os 3 perfis, antes do deploy.
- Zero erro de console, zero regressão nos fluxos já documentados no TECHDOC.

### Estratégia de homologação
Repetir o padrão já validado nos sprints RBAC anteriores: harness `jsdom`/emulador local para os 3 perfis (cliente legítimo, painel autenticado, visitante anônimo) → verificação do release ativo das Rules via `firebaserules.googleapis.com` (não só o Console) → homologação manual em navegador real → aprovação formal do dono → só então promoção a produção.

### Documentação necessária
- Nova seção no `TECHDOC.md` (padrão já estabelecido).
- Registro no `plans/BACKLOG.md` como item concluído, se aplicável.
- Atualização do `MASTER_ROADMAP.md`/`PROXIMA_ETAPA.md` junto com o refresh geral (Etapa 3, item 10).

---

## RELATÓRIO FINAL

**Situação geral do projeto:** o Cell City CRM é um sistema amplo e majoritariamente funcional no dia a dia (~60% funcional na prática), com disciplina de processo formal recente (desde 2026-07-01) que ainda não cobre retroativamente todo o histórico. `main` e `develop` estão sincronizadas; ambientes DEV/PROD (rota) separados e estáveis desde 2026-07-03; backend Firebase ainda único entre os dois, com freeze de infraestrutura em vigor.

**Estado dos módulos:** 3 concluídos/homologados (Usuários e Permissões, Central de Alertas, Dashboard); ~18 funcionais sem pendência bloqueante; ~4 funcionais com risco relevante; 3 quebrados por incompatibilidade regra×código (Análise, Catálogo, Central de Organização); 6 não iniciados; RBAC Fase 2 com 2 de 5 sprints aprovados e o terceiro pronto, aguardando só homologação manual.

**Estado da documentação:** `TECHDOC.md` é a única fonte 100% corrente; `MASTER_ROADMAP.md` e `PROXIMA_ETAPA.md` estão desatualizados desde 2026-07-02 e precisam de um refresh formal (não feito nesta entrega, por respeito à própria regra de "modo somente leitura" desses arquivos em tarefas de auditoria/análise); 5 documentos de `plans/` são candidatos a arquivamento histórico; há duplicação de arquivos de configuração (`firestore.rules`/`indexes.json`) entre raiz e `CRM/`.

**Estado do repositório:** confirmado nesta sessão que `_BACKUPS/`, `plans/` e `CLAUDE.md` são publicados ao vivo no site institucional (raiz e `/dev`) sem nenhuma exclusão no workflow de deploy — incluindo ~40 arquivos de backup de código solto dentro de `CRM/`, rastreados desde antes da disciplina atual. 9 branches locais são candidatas a remoção (nenhuma remota); várias tags de backup/pré-merge podem ser removidas em conjunto com suas branches, após confirmação individual do dono. Nada foi excluído nesta entrega.

**Maior risco:** exposição pública de dados reais de clientes via OS/Portal do Cliente — não corrigido, prioridade 0.

**Maior oportunidade de curto prazo:** homologar o Sprint 3 do RBAC (já pronto, só falta aprovação) — destrava o resto do roadmap de permissões com o menor esforço da lista.

**Lacuna estrutural mais relevante:** zero suíte de testes automatizados persistente — toda verificação até hoje foi manual ou via harness `jsdom` descartável. Estratégia de introdução documentada na Etapa 4, sem implementação nesta entrega.

**Ranking definitivo das prioridades:** ver Etapa 6.

**Recomendação formal do próximo módulo/item a ser desenvolvido:** tratar a exposição do Portal do Cliente/OS pública (Sprint 0, Etapa 7) como a próxima ação do projeto, por ser o único item com dado real de terceiro exposto agora — com a homologação do Sprint 3 do RBAC como alternativa de menor esforço caso o dono prefira destravar o roadmap de permissões primeiro. Ambas respeitam a metodologia vigente de "um módulo/item por vez, ciclo completo antes do próximo". A decisão final de qual dos dois inicia primeiro é do dono do projeto.

---

*Consolidação conduzida em 2026-07-04. Fontes: `plans/AUDITORIA_GERAL_20260704.md`, `plans/AUDITORIA_EXECUTIVA_GERAL_20260704.md`, leitura direta de `CRM/TECHDOC.md`, `MASTER_ROADMAP.md`, `PROXIMA_ETAPA.md`, `GUIA_MANUTENCAO.md`, `plans/BACKLOG.md`, `.gitignore`, `.github/workflows/deploy-pages.yml`, e verificação direta via `git branch`/`git tag`/`git diff`/`find` nesta sessão. Nenhum arquivo de código, configuração, branch ou tag foi alterado ou excluído para produzir este documento.*
