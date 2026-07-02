# ✅ FASE_4_VALIDACAO.md — Validação Técnica do Levantamento da Fase 4

> **Natureza deste documento:** validação e conferência. Não contém implementação nem alterações de código, banco de dados ou Firestore Rules. Todas as afirmações abaixo foram reverificadas de forma independente e cética — quatro auditorias somente-leitura, cada uma lendo o código-fonte de novo (arquivo:linha), sem confiar no relatório anterior — em 2026-07-01.
> Este documento é a segunda camada de verificação sobre [`FASE_4_LEVANTAMENTO.md`](FASE_4_LEVANTAMENTO.md) (não editado por este processo). Onde a validação encontrou imprecisão ou nuance relevante no levantamento original, isso está sinalizado em **⚠️ Correção de premissa**.

---

## 0. Resumo executivo

Das afirmações centrais do levantamento original, a esmagadora maioria foi **confirmada integralmente** por leitura direta do código. A validação encontrou **5 correções de premissa** relevantes — nenhuma delas invalida a direção geral do levantamento, mas mudam a natureza de algumas recomendações (de "criar do zero" para "ajustar o que já existe"):

1. **Caixa → Estoque já debita quantidade automaticamente na venda** (`caixa.js:683-697, 767-790`). O levantamento original dizia que a integração era só visual, sem debitação. Isso está errado: a debitação existe e funciona. O problema real é outro — o produto vinculado à venda vive só em memória (`_produtoVinculado`, `caixa.js:29`) e se perde se a página recarregar antes de salvar. É um risco de UX/perda de dado, não uma integração ausente.
2. **OS já gera conta a receber automaticamente** (`os.js:674-689`, escreve em `financeiro_receber`), mas isso acontece **na criação da OS**, não na entrega (`markDelivered()`, `os.js:1185`, não toca em Financeiro). O levantamento dizia "OS entregue não gera conta a receber" como se não houvesse nenhuma integração — na verdade a integração existe, só está no ponto errado do ciclo de vida da OS, e há uma decisão de negócio pendente (reconhecer receita na criação/orçamento aprovado vs. na entrega).
3. **O padrão de desbloqueio Android é armazenado em texto puro no Firestore** (`os.js:616-617`, array de índices sem hash). O levantamento classificava isso como risco **Média** na tabela de riscos; a validação eleva para **Crítica** — é dado sensível de cliente sem qualquer proteção.
4. **`Análise` não lê a coleção `os`**, só `caixa_lancamentos` (`analise.js:19`). O levantamento dizia que Relatórios e Análise processavam "essencialmente os mesmos dados (`os`, `caixa_lancamentos`)" — na prática são complementares (Relatórios cruza OS+Caixa em tempo real; Análise é só histórico financeiro), não uma sobreposição total.
5. **A sobreposição Central de Comandos ↔ Central de Informações já tem migração formal em andamento** (`comandos.js:18-99`, migração v1 com soft-delete e marcador `migracao:'comandos_v1'`). O levantamento tratava isso como um problema em aberto; na prática já é um processo de refatoração planejado, só falta confirmar se foi executado em produção.

Nenhuma afirmação central do levantamento foi refutada. O documento original é factualmente sólido; as correções acima refinam a causa raiz de alguns itens e mudam o esforço/abordagem recomendados, não a prioridade geral.

---

## 1. Metodologia

Quatro auditorias somente-leitura paralelas, mesma divisão de grupos do levantamento original (A: negócio core; B: financeiro/operacional; C: atendimento/administração; D: utilitários/dashboards). Cada auditor leu `plans/FASE_4_LEVANTAMENTO.md` primeiro, depois releu o código-fonte de forma independente — sem aceitar as conclusões anteriores por padrão — produzindo veredito (CONFIRMADO / PARCIALMENTE CONFIRMADO / NÃO CONFIRMADO / CORREÇÃO NECESSÁRIA), evidência arquivo:linha, dependências, prioridade (Crítica/Alta/Média/Baixa), esforço e impacto para cada afirmação relevante. Nenhum arquivo de código, configuração, dado ou regra foi alterado durante esta validação.

---

## 2. Validação item a item

### 2.1 Estado dos 35 módulos do CRM

**Veredito: CONFIRMADO.** As quatro auditorias, cobrindo os 35 módulos de forma independente, reproduziram a mesma contagem do levantamento: 28 módulos funcionais em profundidade variável, 4 vazios/quase vazios, 1 sem backend, 2 ferramentas de diagnóstico/placeholder. Nenhum módulo foi encontrado em estado diferente do relatado.

### 2.2 Módulos vazios — Compras, Automação, Chat, Estratégia

**Veredito: CONFIRMADO com uma distinção.** `Compras` é diferente dos outros três: tem 1 arquivo (`index.html`, 80 linhas) com conteúdo estático descrevendo a funcionalidade planejada ("🚧 Em desenvolvimento — Etapa futura", linha 45) — não é uma pasta vazia, é um placeholder com intenção documentada. `Automação` não tem nenhum arquivo (`ls -la` retorna só `.`/`..`). `Chat` e `Estratégia` têm os 3 arquivos do padrão (`.html`/`.js`/`.css`) mas todos com 0 bytes — confirmado por `wc -l`.
- **Dependências**: nenhuma entre si; `Compras` depende de `Fornecedor`/`Estoque` (já prontos) para fazer sentido.
- **Prioridade**: Compras = Média (fecha um ciclo já preparado); Automação/Chat/Estratégia = Baixa (não há evidência de compromisso formal do roadmap para eles nesta fase).
- **Esforço**: Compras = Alto (2-3 sprints: modelagem de coleção, CRUD, integração com Estoque/Fornecedor, relatórios); os outros três não têm esforço estimável até haver decisão de escopo.
- **Válido pós-Fase 3?** Sim, para os quatro — nenhum depende de `empresa_id` para ser iniciado, mas deve nascer com isolamento correto se implementado após a Fase 3.

### 2.3 Situação do módulo Auditoria

**Veredito: CONFIRMADO INTEGRALMENTE.** `CRM/pages/auditoria/` contém só `index.html` com badge "🚧 Em desenvolvimento — Etapa futura" (linha 48) e uma tabela de exemplo estática — zero JavaScript, zero leitura de Firestore. A única coleta de auditoria real do sistema é `auditoria_usuarios_permissoes`, escrita exclusivamente por `usuarios-permissoes.js` — grep recursivo confirmou que nenhum outro módulo escreve em coleção de auditoria alguma.
- **Dependências**: decisão de arquitetura (reaproveitar o padrão de `auditoria_usuarios_permissoes` ou criar um novo formato consolidado); identificar quais eventos de OS/Financeiro/Estoque/Caixa devem ser coletados.
- **Prioridade**: **Crítica** (elevada de Alta no levantamento original) — o roadmap já promete "relatórios de auditoria consolidados" para a Fase 4, mas o pré-requisito (o backend) não existe; qualquer compromisso de entrega nesse item depende de construir do zero, não de consolidar algo existente.
- **Esforço**: Alto (2-3 sprints — novo backend + listeners em múltiplos módulos + UI de filtro/busca/paginação).
- **Impacto**: nulo para usuário final; alto para administrador/gestor (hoje não há trilha de auditoria fora de Usuários e Permissões); médio para arquitetura (não é inovação, é replicar um padrão já validado).
- **Válido pós-Fase 3?** Sim, mas recomenda-se desenhar a coleção já pensando em filtro por `empresa_id`, mesmo que a Fase 3 ainda não tenha concluído a padronização.

### 2.4 Integração Caixa ↔ Estoque

**Veredito: ⚠️ CORREÇÃO DE PREMISSA — PARCIALMENTE CONFIRMADO.** Ao contrário do que o levantamento original afirmava ("a quantidade NÃO é debitada automaticamente"), a debitação **é automática e funciona**: `caixa.js:767-790` (`_executarSalvamento()`) chama `descontarEstoqueLocal()` (`caixa.js:683-697`) sempre que o lançamento é do tipo entrada/serviço e há produto vinculado, escrevendo a nova quantidade direto no Firestore. O problema real, que o levantamento não isolou corretamente, é de outra natureza: o estado do produto vinculado (`_produtoVinculado`, `caixa.js:29`) vive só em memória do formulário — se a página recarrega ou trava antes do usuário clicar "Salvar", o vínculo (e a debitação) se perde silenciosamente, sem qualquer autosave ou recuperação.
- **Dependências**: nenhuma — a correção (autosave do formulário) é isolada do restante do sistema.
- **Prioridade**: **Alta** — não porque falte integração, mas porque a integração existente é frágil a um cenário comum (recarregar página, fechar aba sem querer).
- **Esforço**: Baixo-Médio (autosave em `localStorage`/`sessionStorage` com restore ao carregar: ~1-2 dias).
- **Impacto**: usuário final ganha confiabilidade na entrada de venda; arquitetura ganha um padrão de autosave reaproveitável em outros formulários (Financeiro, Estoque).
- **Válido pós-Fase 3?** Sim, independente.

### 2.5 Integração Financeiro ↔ Caixa

**Veredito: CONFIRMADO.** Nenhuma referência cruzada encontrada — grep de "financeiro" em `caixa.js` e de "caixa" em `financeiro.js` retornou zero resultados. As coleções são inteiramente separadas (`caixa_lancamentos` vs. `financeiro_pagar`/`financeiro_fixas`/`financeiro_receber`), sem função de reconciliação, sem alerta de divergência.
- **Dependências**: **depende da Fase 3 estar concluída** — sincronizar escrita entre dois módulos sobre uma base de `empresa_id` ainda inconsistente (hoje isolado em só 1 de 37 módulos, achado da Fase 3) amplia o risco de dado cruzado entre contextos errados.
- **Prioridade**: Alta.
- **Esforço**: Médio-Alto (design de arquitetura de sincronização + implementação + testes de reconciliação: ~1,5 sprint).
- **Impacto**: alto para usuário financeiro (elimina lançamento duplicado manual); alto para gestão (visão única de fluxo de caixa).
- **Válido pós-Fase 3?** **Não antes** — este é o único item, entre os validados, cuja implementação deveria explicitamente esperar a conclusão da Fase 3, conforme o próprio `MASTER_ROADMAP.md` já previa.

### 2.6 Fluxo OS → Financeiro

**Veredito: ⚠️ CORREÇÃO DE PREMISSA — PARCIALMENTE CONFIRMADO.** O levantamento original dizia "OS entregue não gera conta a receber automática no Financeiro", dando a entender que não existe nenhuma integração. Na verdade, `os.js:674-689` já escreve automaticamente em `financeiro_receber` quando o valor da OS é definido — mas isso ocorre **na criação/registro do valor da OS**, não na entrega. A função `markDelivered()` (`os.js:1185`) só muda o status para "entregue" e registra timeline; não toca em Financeiro. Ou seja: a integração existe, mas o gatilho está no ponto errado do ciclo de vida se a intenção de negócio for reconhecer receita só na entrega.
- **Dependências**: decisão de negócio explícita — reconhecer a conta a receber (a) na criação/orçamento aprovado (comportamento atual), (b) na entrega, ou (c) híbrido (pendente ao criar, confirmada na entrega). Sem essa decisão, qualquer alteração de código é prematura.
- **Prioridade**: Alta — mas o primeiro passo é uma decisão de negócio, não uma tarefa técnica.
- **Esforço**: Médio, condicionado à decisão acima (mover ou complementar o gatilho é simples; o esforço real está em tratar OS editadas/cancelamentos que já geraram conta).
- **Impacto**: alto para gestão financeira (hoje o valor gerado na criação pode não corresponder ao valor final se a OS for reajustada antes da entrega).
- **Válido pós-Fase 3?** Sim, independente — mas a decisão de negócio deveria ser tomada antes de qualquer planejamento técnico detalhado.

### 2.7 CRM Comercial (templates, histórico, variáveis)

**Veredito: CONFIRMADO.** `crm.js:855-864` (`abrirWhatsApp()`) monta uma mensagem fixa, sem sistema de templates nem variáveis reutilizáveis. O único "histórico" existente (`chips.js:10,27-37`) rastreia mudanças de status de cadastro de chip, não envios de mensagem. Nenhuma ocorrência de "template", "modelo de mensagem" ou "historico_envio" em `crm-comercial/`.
- **Dependências**: nenhuma bloqueante — pode ser implementado isoladamente (CRUD de templates + nova coleção `crm_mensagens_enviadas`).
- **Prioridade**: Alta — item já citado explicitamente no `MASTER_ROADMAP.md` para a Fase 4.
- **Esforço**: Médio (CRUD de templates + integração em `abrirWhatsApp()` + registro de envio).
- **Impacto**: alto para produtividade de atendimento (menos tempo redigindo mensagens repetidas) e para gestão (histórico de contato por cliente).
- **Válido pós-Fase 3?** Sim, independente.

### 2.8 Portal do Cliente

**Veredito: CONFIRMADO INTEGRALMENTE.** `admin.html` (6.371 bytes), `admin.js` (59.792 bytes) e `admin.css` (28.097 bytes) existem e implementam exatamente as 7 seções descritas no levantamento (`renderCentral()`, `renderMensagens()`, `renderAvaliacoes()`, `renderSolicitacoes()`, `renderAgendamentos()`, `renderConfig()`, `renderEstatisticas()` — todas confirmadas por linha em `admin.js`). O Dashboard já roteia o card "Portal do Cliente" para `admin.html`, não para o login do cliente (`dashboard.js:1717`). ⚠️ Isso confirma a correção de premissa já registrada no levantamento original em relação ao `MASTER_ROADMAP.md` (que tratava esse painel como pendente).
- **Prioridade das pendências restantes**: Média (exportação de PDF/Excel, prazos de garantia customizáveis por tipo de equipamento).
- **Esforço**: Baixo (é manutenção/expansão sobre uma base já pronta, não construção nova).
- **Válido pós-Fase 3?** Sim.

### 2.9 Portal Técnico

**Veredito: CONFIRMADO.** Confirmado por leitura direta: `Celulares`, `FRP e Contas` e `Firmwares` chamam `ptEmBreve()` (`index.html:71,79,95`), que só exibe um toast, sem modal de conteúdo. `Tutoriais`, `Solucoes Tecnicas`, `Softwares` e `Central do Projeto` navegam para arquivos reais com conteúdo estruturado (tamanhos confirmados: 45.552 / 39.333 / 22.240 bytes respectivamente).
- **Prioridade**: Baixa — os três "em breve" são claramente sinalizados como tal, não é uma funcionalidade quebrada, é conteúdo ainda não produzido.
- **Esforço**: Alto, mas majoritariamente de **conteúdo técnico**, não de código (esquemas, procedimentos por marca/modelo).
- **Válido pós-Fase 3?** Sim, sem dependência.

### 2.10 Central de Módulos

**Veredito: CONFIRMADO.** Busca funcional (`index.html:113`), favoritos com persistência dupla localStorage + Firestore (`shared/central-modulos.js`, `toggleFavorito()` grava em `usuarios/{uid}/preferencias/modulos`), catálogo com 26 módulos incluindo a rota correta para `portal-cliente/admin.html`. Nenhum item de trabalho pendente relevante além de melhorias cosméticas (contadores, badge de "novo").
- **Prioridade**: Baixa.
- **Esforço**: Baixo.
- **Válido pós-Fase 3?** Sim, sem dependência.

### 2.11 Dashboards e relatórios

**Veredito: PARCIALMENTE CONFIRMADO, com viabilidade desigual entre as recomendações.**
- **Dashboard financeiro consolidado**: viável — `Relatórios` já cruza Caixa+OS em tempo real; faltaria só incluir as coleções de Financeiro (`financeiro_pagar/receber/fixas`), hoje não lidas por nenhum painel analítico. Esforço Médio.
- **Dashboard por perfil operacional**: parcialmente viável — o `kernel.js`/`ctx.perfil` já existe e é acessível (confirmado em `kernel-test/modulo-test.html:298-306`), mas nenhum módulo hoje filtra conteúdo por perfil fora do RBAC do Dashboard (Fase 2 Sprint 1). Esforço Médio-Alto.
- **Dashboard de auditoria/governança**: **bloqueado** — depende diretamente do backend de Auditoria (seção 2.3) não existir ainda. Não pode ser priorizado antes desse pré-requisito.
- **Dashboard de saúde do sistema (expandir kernel-test)**: viável — `kernel-test` hoje é 100% ad-hoc/sob demanda, sem persistência histórica (confirmado, zero coleção `kernel_test_history` ou similar); expandir para monitoramento contínuo exigiria criar uma coleção `system_health` e um agendador. Esforço Médio.
- **Consolidação Relatórios + Análise**: ⚠️ correção de premissa (ver seção 0, item 4) — não é sobreposição total, é complementaridade (Relatórios = gestão operacional em tempo real; Análise = inteligência histórica multi-ano, só financeira). A decisão de consolidar ou não é de UX, não de dados duplicados. Esforço Baixo se optar por unificar a navegação.
- **Válido pós-Fase 3?** Sim para os quatro primeiros; o dashboard de auditoria continua bloqueado até o item 2.3 ser resolvido, independentemente da Fase 3.

### 2.12 Demais recomendações do documento — achados adicionais da validação

- **Padrão de desbloqueio Android em texto puro** (`os.js:616-617`): confirmado, **reclassificado de Média para Crítica** — é dado sensível de cliente armazenado sem hash. Esforço de correção é baixo (hash + salt ao salvar).
- **Central de Informações — "criptografia" é ofuscação real, com chave hardcoded exposta no client** (`informacoes.js:27`, `CRIPTOGRAFIA_KEY = 'cellcity-2026'`): confirmado. Risco é baixo enquanto o uso for disciplinado a senhas operacionais internas (Wi-Fi, painéis), mas alto se alguém passar a guardar ali credenciais sensíveis (bancárias, FTP) — recomenda-se um aviso visual explícito no módulo, não necessariamente reescrever a criptografia agora.
- **Sobreposição Central de Comandos ↔ Central de Informações**: ⚠️ correção de premissa — já existe migração formal v1 em `comandos.js:18-99` (soft-delete com marcador `migracao:'comandos_v1'`), não é um problema em aberto. Recomenda-se apenas confirmar se a migração já rodou em produção antes de descontinuar o suporte a `tipo:'comando'` em `central-informacoes`.
- **Campanhas — escopo real**: confirmado que o "envio" é 100% manual via link `wa.me/` (`campanhas.js:100`); não há fila, agendamento ou log de entrega. O módulo é de segmentação/preparação, não de automação de envio — alinhado ao levantamento original, mas com escopo mais estreito do que o nome sugere.
- **Status "aguardando peça" (OS) sem integração com Estoque**: confirmado; reclassificado como **Alta** (originalmente já era Alta no levantamento) — impacto de negócio real (técnico depende de lembrar manualmente).
- **Conversão Lead → OS não bidirecional**: confirmado (`crm.js:887` só atualiza `osConvertido` na criação da OS; nada retorna do lado da OS).
- **Impressão de OS sem preview**: confirmado (`os.js:1770`).
- **Minha Semana isolada da Agenda, sem recorrência, sem edição inline**: confirmado — coleções inteiramente separadas (`tarefas_semana` vs. `agenda`).
- **Busca global do Dashboard sem paginação**: confirmado, com limite hardcoded de 6 resultados por categoria (`dashboard.js:1447`) — hoje evita travamento (corta resultado em vez de listar tudo), mas esconde resultados sem indicar que há mais.
- **Fechamento automático de Caixa via iframe sem feedback ao usuário**: confirmado (`dashboard.js:146-157`) — falha é só logada no console, invisível para quem está usando o sistema.
- **Alertas sem "marcar como lido"**: confirmado, zero ocorrência de campo `lido`/`read` em qualquer coleção de alerta.

---

## 3. Correções de premissa (consolidado)

| # | Premissa original | Correção validada | Efeito na recomendação |
|---|---|---|---|
| 1 | Caixa não debita Estoque automaticamente | Debita automaticamente; o problema é perda de estado do formulário sem autosave | Recomendação muda de "criar integração" para "corrigir fragilidade de UX" — esforço menor |
| 2 | OS entregue não gera conta a receber (nenhuma integração) | Conta a receber já é gerada, mas na criação da OS, não na entrega | Recomendação muda de "criar integração" para "decisão de negócio sobre o ponto do gatilho" |
| 3 | Padrão de desbloqueio em claro é risco Médio | É risco Crítico (dado sensível sem qualquer proteção) | Prioridade elevada; deve entrar antes na fila de correções |
| 4 | Relatórios e Análise processam "essencialmente os mesmos dados" | Análise só lê `caixa_lancamentos`; não lê `os` — são complementares, não sobrepostos | Decisão de consolidação é de UX/navegação, não de eliminação de lógica duplicada |
| 5 | Sobreposição Central de Comandos ↔ Central de Informações é problema em aberto | Já existe migração v1 formal, com soft-delete | Ação recomendada muda de "resolver sobreposição" para "confirmar execução da migração já escrita" |

---

## 4. Riscos identificados (atualizado pela validação)

| Risco | Severidade | Observação da validação |
|---|---|---|
| Padrão de desbloqueio Android armazenado em texto puro | **Crítica** (elevado de Média) | Dado sensível de cliente sem hash/salt; correção é de baixo esforço |
| Backend de Auditoria inexistente, mas prometido no roadmap da Fase 4 | **Crítica** | Bloqueia qualquer dashboard de auditoria/governança até ser construído |
| Perda de vínculo produto↔venda no Caixa sem autosave | Alta | Pode causar debitação de estoque perdida silenciosamente se a página recarregar |
| Ausência de sincronização Financeiro ↔ Caixa | Alta | Confirmado sem nenhuma referência cruzada; depende da Fase 3 para ser resolvido com segurança |
| Chave de "criptografia" hardcoded e exposta no client (Central de Informações) | Média | Risco cresce se o módulo passar a guardar senhas de fato sensíveis |
| Ausência de paginação na busca global do Dashboard | Média | Hoje mitigado por limite hardcoded (corta resultado), mas esconde itens sem indicar |
| Fechamento automático de Caixa sem feedback de falha ao usuário | Média | Falha só aparece no console; usuário não percebe |
| Módulo Compras nunca implementado | Média | Fornecedor já prepara o terreno (Estoque Baixo), mas não há para onde encaminhar a decisão de compra |

---

## 5. Dependências técnicas (consolidado)

- **Bloqueio explícito pela Fase 3**: apenas a integração **Financeiro ↔ Caixa** deveria formalmente esperar a conclusão da Fase 3 (isolamento `empresa_id`), conforme já previsto no `MASTER_ROADMAP.md` e reconfirmado nesta validação. Os demais itens (Caixa→Estoque, OS→Financeiro, templates de WhatsApp, Auditoria, correção do padrão Android) são tecnicamente independentes da Fase 3, mas devem nascer já respeitando `empresa_id` se implementados em paralelo ou depois dela.
- **Decisão de negócio pendente antes de qualquer trabalho técnico**: o ponto exato do ciclo de vida da OS em que a conta a receber deve ser reconhecida (criação/orçamento aprovado vs. entrega vs. híbrido) — sem essa decisão, qualquer ajuste de código no fluxo OS→Financeiro é prematuro.
- **Pré-requisito de Auditoria**: qualquer dashboard de auditoria/governança depende do backend de Auditoria existir primeiro — não há atalho.
- **Autosave do Caixa** e **hash do padrão Android** não têm dependência externa — podem ser corrigidos isoladamente e a qualquer momento.

---

## 6. Ordem recomendada de implementação (roadmap refinado)

A ordem original do levantamento (seção 15 de `FASE_4_LEVANTAMENTO.md`) permanece válida em espírito, mas é refinada aqui para refletir as correções de premissa — em particular, dois itens sobem de posição por serem correções pontuais de baixo esforço e alto risco/valor, e a integração OS→Financeiro passa a exigir uma decisão de negócio antes da etapa técnica.

**Onda 0 — Correções pontuais de segurança/risco, sem dependência de nada (fazer primeiro, esforço baixo):**
1. Hash + salt no padrão de desbloqueio Android (`os.js`) — risco Crítica, esforço baixo.
2. Autosave do vínculo produto↔venda no Caixa (`caixa.js`) — risco Alto, esforço baixo-médio.

**Onda 1 — Decisão de negócio + ajuste de gatilho (depende de decisão, não de código):**
3. Definir o ponto do ciclo de vida da OS em que a conta a receber deve ser reconhecida, e então ajustar o gatilho já existente em `os.js:674-689` / `markDelivered()` conforme a decisão.

**Onda 2 — Fecha ciclos de dados que já dependem da Fase 3:**
4. Integração Financeiro ↔ Caixa (só após Fase 3 concluída).

**Onda 3 — Pendências formais já registradas em fases anteriores e no roadmap da Fase 4:**
5. Rastreamento de último acesso + políticas de senha (Usuários e Permissões — confirmado ausente, UI já sinaliza "não habilitado nesta fase").
6. Templates de WhatsApp com variáveis + histórico de envio (`crm-comercial`).

**Onda 4 — Construção nova de maior esforço:**
7. Backend real do módulo Auditoria (pré-requisito de qualquer dashboard de auditoria/governança).
8. Módulo Compras (fecha o ciclo já preparado por Fornecedor/Estoque Baixo).

**Onda 5 — Capacidade transversal e itens de menor impacto:**
9. Exportação de relatórios (PDF/Excel), começando por Financeiro e Portal do Cliente.
10. Dashboard financeiro consolidado (expandir `Relatórios` para incluir Financeiro) e dashboard de saúde do sistema (expandir `kernel-test`).
11. Notificação sonora/push na Central de Alertas; aviso visual sobre a natureza real da "criptografia" em Central de Informações; confirmação de execução da migração v1 em Central de Comandos.
12. Itens de baixa prioridade já listados no levantamento original (upload real de imagem no Catálogo, validação de formato em Contas, conteúdo dos módulos "em breve" do Portal Técnico).

Cada onda continua seguindo o processo de 8 etapas já validado nas Fases 1 e 2 (Planejamento → Implementação → Testes → Homologação → Correções → TECHDOC → Aprovação formal → Liberação), um módulo por vez.

---

## Conclusão

O levantamento original (`FASE_4_LEVANTAMENTO.md`) é **factualmente sólido** — a validação confirmou a esmagadora maioria das afirmações por leitura direta e independente do código. As 5 correções de premissa encontradas (seção 3) não mudam a direção estratégica da Fase 4, mas refinam a causa raiz de dois itens importantes (Caixa↔Estoque e OS→Financeiro, que têm mais integração do que se pensava, só que malformada ou no ponto errado do ciclo) e elevam a prioridade de um risco de segurança real (padrão de desbloqueio em texto puro).

**Nenhuma alteração de código, configuração, banco de dados ou Firestore Rules foi realizada durante esta validação.** O único arquivo criado foi este próprio documento. `plans/FASE_4_LEVANTAMENTO.md` não foi editado, conforme instruído.
