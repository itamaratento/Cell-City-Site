# 🔍 FASE_4_LEVANTAMENTO.md — Evolução Funcional

> **Natureza deste documento:** levantamento e análise. Não contém implementação nem alterações de código, banco de dados ou Firestore Rules. Todos os achados abaixo foram verificados diretamente no código-fonte (não são suposições) por quatro auditorias somente-leitura paralelas em 2026-07-01, cobrindo os 35 módulos de `CRM/pages/`.
> Este documento é o detalhamento factual da seção "Fase 4 — Evolução Funcional" do [`MASTER_ROADMAP.md`](../MASTER_ROADMAP.md), complementado pelos planos técnicos já existentes em `plans/` (`FAVORITOS_INTELIGENTES.md`, `MELHORIAS_OS.md`, `MELHORIA_CONTINUAR_PAREI.md`, `REORDENAR_FAVORITOS_DND.md`, `fase2-portal-admin.md`, `fase2-sprint1-dashboard-rbac.md`). Onde os achados abaixo contradizem premissas do roadmap, isso está sinalizado explicitamente em **⚠️ Correção de premissa**.

---

## 0. Resumo executivo

O sistema tem **35 módulos** em `CRM/pages/`, dos quais:
- **28 estão funcionais e em produção** (com profundidade variável — de completos a "70% prontos").
- **4 são placeholders vazios ou quase vazios**: `automacao/`, `chat/`, `estrategia/` (sem nenhum arquivo de código) e `compras/` (só HTML estático "em desenvolvimento").
- **1 é só um sketch estático sem backend**: `auditoria/` — tem layout pronto, mas nenhuma coleta de log real, apesar de o sistema já ter uma coleção de auditoria funcionando (`auditoria_usuarios_permissoes`, da Fase 1) que não está sendo consumida por essa tela.
- **2 são ferramentas de diagnóstico/placeholder intencionais, não módulos de negócio**: `kernel-test/`, `em-breve/`.

Três premissas do `MASTER_ROADMAP.md` para a Fase 4 **não se confirmam** na auditoria:

1. **"Portal do Cliente: evolução dos módulos já existentes"** — o roadmap não registrava que o Painel Administrativo do Portal (`plans/fase2-portal-admin.md`) **já foi implementado**: `CRM/pages/portal-cliente/admin.html` e `admin.js` existem e cobrem Central (dashboard), Mensagens, Avaliações, Solicitações, Agendamentos, Estatísticas e Configurações. ⚠️ **Correção de premissa**: o item deixa de ser "a fazer" e passa a ser "manutenção/expansão" (ex.: exportação de relatórios, que ainda não existe).
2. **"WhatsApp CRM: novos templates e variáveis, histórico de envio por cliente"** — o módulo real que cumpre esse papel é `CRM/pages/crm-comercial/` (funil de vendas + leads), que já tem envio direto de WhatsApp e captura de lead, mas **não tem sistema de templates/variáveis reutilizáveis** nem histórico de envio consolidado — a funcionalidade descrita no roadmap ainda não existe, mas o módulo-alvo certo é este, não um módulo "WhatsApp CRM" isolado (que não existe como pasta própria).
3. **"Central de Módulos: curadoria do catálogo consolidado"** — o módulo já está completo e estável (busca, favoritos, persistência); não há trabalho pendente aqui além de pequenas melhorias de UX (contadores, badges de "novo").

Além disso, a auditoria encontrou um item de **alta prioridade não previsto no roadmap original**: o módulo `Auditoria` está 0% implementado (só front-end estático), enquanto o roadmap já promete, para a Fase 4, "relatórios de auditoria consolidados (usuários + financeiro + estoque)" — esse trabalho depende de **criar o backend do módulo do zero**, não de "consolidar" algo que já existe.

O sistema, hoje, tem **fluxos unidirecionais e ilhados**: CRM alimenta OS, mas OS não realimenta Caixa; Estoque não é atualizado automaticamente por vendas no Caixa; Financeiro não conversa com Caixa nem com Compras (que nem existe); Fornecedor já espelha Estoque Baixo mas não tem para onde mandar a compra. A maior parte do valor da Fase 4 está em **fechar esses ciclos de integração**, não em criar telas novas do zero.

---

## 1. Metodologia

Levantamento realizado por quatro auditorias somente-leitura paralelas em 2026-07-01, uma por grupo de módulos:
- **Grupo A** (negócio核心): `crm-comercial` (WhatsApp CRM/funil/chips), `clientes`, `os`, `acaodasemana` (Agenda), `minha-semana`, `dashboard`.
- **Grupo B** (financeiro/operacional): `financeiro`, `caixa`, `estoque`, `diario`, `compras`, `contas`, `fornecedor`.
- **Grupo C** (atendimento/administração): `portal-cliente`, `portal-tecnico` (+ subpastas), `pos-venda`, `usuarios-permissoes` (só pendências não-RBAC), `central-alertas`, `central-modulos`, `auditoria`.
- **Grupo D** (utilitários/secundários): `relatorios`, `campanhas`, `automacao`, `config`, `catalogo`, `central-informacoes`, `central-organizacao`, `central-comandos`, `chat`, `analise`, `estrategia`, `importar`, `autoatendimento`, `em-breve`, `kernel-test`.

Cada auditoria leu os arquivos `.js`/`.html` principais de cada módulo (não apenas metadados), citando arquivo:linha para achados concretos. RBAC/permissões operacionais foi propositalmente excluído do escopo (já coberto pelo levantamento da Fase 2/3). Nenhum arquivo de código, configuração ou regra foi alterado durante este levantamento.

---

## 2. Diagnóstico funcional do sistema — visão consolidada

| Módulo | Estado | Observação-chave |
|---|---|---|
| `os` | ✅ Completo, maduro | Motor mais robusto do sistema (~3800 linhas); maior superfície de melhorias por volume |
| `crm-comercial` | ✅ Completo | Funil + leads + chips; falta templates de mensagem reutilizáveis |
| `clientes` | ✅ Funcional, pequeno | Config de impressão/garantias; sem validação de upload/CNPJ |
| `acaodasemana` | ✅ Completo | Agenda/calendário com recorrência; falhas de validação (limite de caracteres não aplicado) |
| `minha-semana` | ✅ Funcional, simples | Sem edição inline, sem recorrência, isolado da Agenda |
| `dashboard` | ✅ Completo, complexo | ~3000 linhas, orquestra ~30 seções; ponto de maior risco de regressão do sistema |
| `financeiro` | ✅ Funcional | Contas a pagar/receber/fixas; sem relatório, sem integração com Caixa |
| `caixa` | ✅ Completo | Lançamentos + integração parcial com Estoque; sem integração com Financeiro |
| `estoque` | ✅ Funcional | Sem histórico de movimentação, sem previsão de ruptura |
| `diario` | ✅ Completo, pessoal | Bem estruturado; sem anexos, sem colaboração |
| `compras` | 🚫 Vazio (só HTML "em breve") | Único módulo "planejado" nos documentos do projeto que nunca foi codificado |
| `contas` | ✅ Funcional, simples | Cadastro de números/e-mails/chips; sem categorização nem validação de formato |
| `fornecedor` | ✅ Funcional | Já espelha Estoque Baixo; sem tabela de fornecedores de fato, sem ligação com Compras (que não existe) |
| `portal-cliente` | ✅ Completo (cliente + admin) | Painel admin já implementado — ver Resumo Executivo, item 1 |
| `portal-tecnico` | ⚠️ ~70% | Tutoriais/Soluções/Softwares prontos; Celulares/FRP/Firmwares são "em breve" |
| `pos-venda` | ✅ Completo | Bem testado (tem `RELATORIO_TESTES.md` próprio) |
| `usuarios-permissoes` | ⚠️ RBAC ok, pendências não-RBAC abertas | Último acesso e políticas de senha não implementados (pendências formais da Fase 1) |
| `central-alertas` | ✅ Completo | Agrega 5 fontes; sem notificação sonora/push |
| `central-modulos` | ✅ Completo | Sem trabalho pendente relevante |
| `auditoria` | 🚫 0% implementado | Só sketch HTML estático; nenhuma coleta de log real |
| `relatorios` | ✅ Completo, avançado | Painel de Meta & Evolução bem construído; se sobrepõe parcialmente com `analise` |
| `campanhas` | ✅ Completo | Aniversariantes/inativos/clientes; sem automação de envio |
| `automacao` | 🚫 Vazio (diretório sem arquivos) | Nome reservado, nunca implementado |
| `config` | ✅ Completo | PIN + Firebase Auth; sem 2FA |
| `catalogo` | ✅ Completo | CRUD de produtos + catálogo público; upload de imagem é manual (URL, sem upload real) |
| `central-informacoes` | ✅ Completo, avançado | Biblioteca de comandos/senhas/documentos; criptografia é só ofuscação (não é segura de verdade) |
| `central-organizacao` | ✅ Funcional | Registro de contas/robôs/programas/histórico/links |
| `central-comandos` | ✅ Funcional | Biblioteca de comandos/prompts; possível sobreposição com `central-informacoes` |
| `chat` | 🚫 Vazio (arquivos existem mas vazios) | Nome reservado, nunca implementado |
| `analise` | ✅ Funcional | Dashboard analítico (mensal/semanal/anual); sobreposição com `relatorios` |
| `estrategia` | 🚫 Vazio (HTML 0 bytes) | Nome reservado, nunca implementado |
| `importar` | ✅ Funcional | Ferramenta de migração (Beepstart); sem deduplicação |
| `autoatendimento` | ✅ Funcional | Gestão de pré-OS; converte para OS |
| `em-breve` | ✅ Placeholder intencional | Template para módulos "em construção" — não é uma lacuna, é um padrão do projeto |
| `kernel-test` | ✅ Ferramenta de diagnóstico | Não é módulo de negócio; uso interno |

---

## 3. Funcionalidades incompletas/parciais mais relevantes (por módulo)

- **OS**: campo `valorCartao` existe mas sem lógica de desconto/parcelamento; status "aguardando peça" não integra com Estoque; checklist de entrada/saída sem foto vinculada por item; padrão de desbloqueio sem hash (armazenado em claro); impressão sem preview.
- **CRM-Comercial**: conversão Lead → OS funciona, mas sem sincronização bidirecional (OS entregue não atualiza `osConvertido` no lead); alertas de "sem retorno" sem regra de silêncio (pode repetir alerta já tratado); banco de leads sem template de mensagem de recontato.
- **Dashboard**: alertas não têm "marcar como lido" nem agrupamento por tipo; busca global sem paginação (risco de travar com muitos resultados); fechamento automático de Caixa via iframe invisível sem feedback ao usuário se falhar.
- **Financeiro**: sem relatório/exportação de nenhum tipo; sem projeção de fluxo de caixa; contas a receber sem categorização.
- **Caixa**: lembretes de pagamento sem integração confirmada com Financeiro; produto vinculado à venda não persiste se a página recarrega antes de salvar.
- **Estoque**: sem histórico de quem/quando alterou quantidade; sem previsão de ruptura; sem SKU/código de barras.
- **Fornecedor**: "Lista de Compras" e aba "Estoque Baixo" já existem e já se cruzam visualmente, mas não há módulo `Compras` para onde encaminhar a decisão de compra.
- **Portal do Cliente**: painel admin completo, mas sem exportação de relatórios (PDF/Excel); garantias com prazo fixo de 90 dias, sem suporte a prazos customizados por tipo de equipamento.
- **Usuários e Permissões**: sem rastreamento de último acesso (pendência formal da Fase 1); gerenciamento de senha limitado a reset por e-mail, sem política de expiração/força mínima.
- **Central de Alertas**: sem notificação sonora ou push — alertas novos aparecem apenas visualmente, sem chamar atenção ativa.
- **Catálogo**: upload de imagem é manual via URL — não há upload real de arquivo para o catálogo público.
- **Central de Informações**: a "criptografia" de senhas é ofuscação local (chave hardcoded), não é segura — risco de falsa sensação de segurança se usada para senhas reais sensíveis.

---

## 4. Recursos planejados que ainda não existem

- **Módulo Compras**: única funcionalidade "prometida" (inclusive com descrição própria no HTML placeholder) que nunca foi implementada — pedidos de peças, confirmação de recebimento, vínculo com Fornecedor e Estoque.
- **Templates de WhatsApp com variáveis + histórico de envio por cliente** (escopo do roadmap para "WhatsApp CRM", mapeado para `crm-comercial`).
- **Rastreamento de último acesso** e **políticas de senha** em Usuários e Permissões (pendências formais da Fase 1, ainda não atendidas).
- **Backend de Auditoria consolidada** (coleta de logs de OS, Financeiro, Estoque, Permissões numa única trilha navegável) — hoje só existe a auditoria isolada de `usuarios-permissoes`.
- **Módulos "em breve" dentro do Portal Técnico**: Celulares, FRP e Contas, Firmwares.
- **Automação/Chat/Estratégia**: pastas reservadas, sem nenhuma linha de código — não há evidência de que sejam compromissos formais do roadmap atual (nomes provavelmente reservados para iniciativas futuras da Fase 5, não da Fase 4).

---

## 5. Melhorias de usabilidade (UX/UI) mais relevantes

- **Paginação ausente** em listas que podem crescer sem limite: OS, leads do CRM, Estoque, Diário, busca global do Dashboard — risco real de travamento em volume alto (hoje mitigado só pelo volume ainda pequeno de dados).
- **Sem máscaras/validação de formato**: telefone (Contas, CRM), CNPJ (Clientes), e-mail (Contas) aceitam qualquer string.
- **Sem feedback de erro assíncrono** em vários pontos (fechamento automático de Caixa, upload de foto em OS, ViaCEP sem retry) — falhas silenciosas.
- **Ações destrutivas com baixa fricção**: senha de exclusão de pós-venda com só 2 dígitos; "Limpar Tudo" do Fornecedor com apenas 1 confirmação.
- **Edição inline ausente** em Financeiro e Minha Semana — qualquer alteração exige reabrir modal.
- **Modais longas em mobile** (Caixa, Fornecedor, OS) — layout não pensado para tela pequena em fluxos operacionais do dia a dia.

---

## 6. Integrações entre módulos que podem ser ampliadas

| Integração hoje ausente/parcial | Módulos | Valor de negócio |
|---|---|---|
| Venda no Caixa → baixa automática no Estoque | Caixa ↔ Estoque | Alto — hoje o vínculo existe só visualmente, quantidade não é debitada automaticamente |
| Conta paga/recebida no Financeiro ↔ lançamento no Caixa | Financeiro ↔ Caixa | Alto — hoje são dois registros manuais separados para o mesmo fato financeiro |
| OS entregue → conta a receber automática | OS ↔ Financeiro | Alto — hoje o faturamento de serviço depende de lançamento manual |
| Estoque baixo → item de compra (quando `Compras` existir) | Fornecedor ↔ Estoque ↔ Compras | Alto — Fornecedor já espelha estoque baixo, falta o próximo passo (não existe módulo Compras) |
| Lead do CRM → status sincronizado com OS gerada | CRM-Comercial ↔ OS | Médio-Alto — conversão existe, mas não é bidirecional |
| Avaliação ruim no Portal do Cliente → alerta automático | Portal do Cliente ↔ Central de Alertas | Médio — hoje avaliações aparecem no admin do Portal, mas não disparam alerta priorizado |
| Recontato de lead agendado → tarefa na Agenda | CRM-Comercial ↔ Ação da Semana | Médio — hoje é reconstruído manualmente pelo usuário |
| Tutoriais do Portal Técnico → sugestão por marca/modelo na OS | Portal Técnico ↔ OS | Médio — ambos já guardam marca/modelo, sem cruzamento |
| Auditoria consolidada de ações sensíveis (múltiplos módulos) | Auditoria ↔ todos os módulos críticos | Alto para governança — hoje só Usuários/Permissões tem trilha de auditoria real |

---

## 7. Relatórios gerenciais necessários (consolidado)

- **Financeiro**: demonstrativo mensal (receita/despesa/saldo), fluxo de caixa projetado (30/60/90 dias), análise por categoria de despesa, contas vencidas.
- **Caixa**: lucro por categoria, comparativo de período (semana/mês vs. anterior), ticket médio.
- **Estoque**: curva ABC de valor imobilizado, idade/rotatividade de estoque, valor total em estoque por categoria.
- **OS**: tempo médio por status, taxa de orçamento rejeitado, margem por tipo de serviço.
- **CRM-Comercial**: taxa de conversão por período/aparelho/serviço, motivos de perda agregados, tempo médio em cada status do funil.
- **Portal do Cliente**: taxa de aprovação de orçamento, motivos de recusa mais comuns, conversão agendamento → OS.
- **Pós-venda**: taxa de resposta por período, tempo médio até contato pós-entrega.
- **Usuários e Permissões**: matriz de permissões exportável, histórico de mudanças de permissão, usuários inativos há mais de 30 dias.
- **Auditoria** (depende de implementar o backend primeiro): timeline de ações por período, usuário mais ativo, detecção de padrões anômalos (ex.: muitas exclusões em curto intervalo).

---

## 8. Dashboards administrativos recomendados

- **Dashboard financeiro consolidado**: unir dados hoje espalhados entre Caixa, Financeiro e Relatórios (parcialmente sobrepostos) num único painel de saúde financeira.
- **Dashboard por perfil operacional**: o que cada perfil vê ao logar — item já citado no `MASTER_ROADMAP.md`, ainda sem correspondência de código.
- **Dashboard de auditoria/governança**: só possível após o backend do módulo Auditoria existir.
- **Dashboard de saúde do sistema**: expandir `kernel-test` (hoje é diagnóstico manual sob demanda) para um painel de monitoramento contínuo, alimentando alertas de degradação.
- **Consolidação Relatórios + Análise**: os dois módulos hoje analisam essencialmente os mesmos dados (`caixa_lancamentos`, `os`) com visualizações diferentes — vale decidir se ficam dois painéis complementares ou se um é descontinuado a favor do outro.

---

## 9. Recursos para administradores e gestores

- Rastreamento de último acesso por usuário (pendência formal da Fase 1).
- Políticas de senha (expiração, força mínima, histórico) em Usuários e Permissões.
- Exportação de relatórios (PDF/Excel) — hoje **nenhum módulo do sistema** tem essa capacidade, é uma lacuna transversal.
- Auditoria consolidada de ações sensíveis entre módulos (ver seção 4 e 6).
- Central de Alertas com notificação sonora/push para itens críticos.

---

## 10. Funcionalidades que agregam valor ao negócio (destaques)

1. **Fechar o ciclo Caixa ↔ Estoque ↔ Financeiro** — hoje a maior fonte de retrabalho manual e risco de dado desincronizado.
2. **Templates de WhatsApp com variáveis + histórico de envio** em `crm-comercial` — impacto direto em produtividade de atendimento e follow-up.
3. **Implementar o módulo Compras** — fecha o ciclo iniciado por Estoque Baixo (já existe em Fornecedor) e desbloqueia relatórios de custo de compra.
4. **Exportação de relatórios (PDF/Excel)** em pelo menos Financeiro e Portal do Cliente — hoje inexistente em qualquer módulo.
5. **Backend real do módulo Auditoria** — pré-requisito para qualquer relatório de auditoria consolidado prometido no roadmap.

---

## 11. Priorização (Alta, Média, Baixa)

### Alta prioridade
| Item | Módulos | Esforço estimado | Impacto |
|---|---|---|---|
| Integração Caixa → Estoque (baixa automática de quantidade na venda) | Caixa, Estoque | Médio | Alto — elimina divergência de estoque físico vs. sistema |
| Integração Financeiro ↔ Caixa (contas pagas/recebidas refletem em lançamento) | Financeiro, Caixa | Médio-Alto | Alto — elimina lançamento duplicado manual |
| Templates de WhatsApp com variáveis + histórico de envio | crm-comercial | Médio | Alto — item já formalmente previsto no roadmap |
| Rastreamento de último acesso + políticas de senha | usuarios-permissoes | Baixo-Médio | Alto — pendência formal já registrada desde a Fase 1 |
| Backend real do módulo Auditoria (coleta de logs consolidada) | auditoria (+ leitura em outros módulos) | Alto | Alto — pré-requisito de governança citado no roadmap |

### Média prioridade
| Item | Módulos | Esforço estimado | Impacto |
|---|---|---|---|
| Implementar módulo Compras (pedidos, recebimento, vínculo Fornecedor/Estoque) | compras, fornecedor, estoque | Alto | Médio-Alto — fecha ciclo já preparado por Fornecedor |
| Exportação de relatórios (PDF/Excel) — Financeiro e Portal do Cliente primeiro | financeiro, portal-cliente | Médio | Médio-Alto |
| OS entregue → conta a receber automática | os, financeiro | Médio | Médio-Alto |
| Sincronização bidirecional Lead (CRM) ↔ OS | crm-comercial, os | Médio | Médio |
| Central de Alertas: notificação sonora/push | central-alertas | Baixo-Médio | Médio |
| Avaliação ruim no Portal → alerta automático priorizado | portal-cliente, central-alertas | Baixo | Médio |
| Consolidar/decidir sobreposição Relatórios vs. Análise | relatorios, analise | Baixo (decisão) + Médio (execução) | Médio |

### Baixa prioridade
| Item | Módulos | Esforço estimado | Impacto |
|---|---|---|---|
| Upload real de imagem no Catálogo (hoje é só URL) | catalogo | Médio | Baixo-Médio |
| Categorização e validação de formato em Contas | contas | Baixo | Baixo |
| Edição inline em Financeiro e Minha Semana | financeiro, minha-semana | Baixo | Baixo |
| Criptografia real (não ofuscação) em Central de Informações | central-informacoes | Médio | Baixo (uso interno) mas relevante se guardar senhas sensíveis |
| Completar módulos "em breve" do Portal Técnico (Celulares, FRP, Firmwares) | portal-tecnico | Alto (é conteúdo, não só código) | Baixo-Médio |

---

## 12. Impacto para usuários e administradores

- **Técnicos/Atendimento**: maior ganho vem de fechar o ciclo OS → Estoque → Caixa (menos retrabalho de lançar a mesma informação em 3 lugares) e de templates de WhatsApp (menos tempo redigindo mensagens repetidas).
- **Financeiro/Gestão**: maior ganho vem de exportação de relatórios e da integração Financeiro ↔ Caixa (hoje decisões são tomadas sem visão consolidada automática).
- **Administradores/Donos**: maior ganho vem do backend de Auditoria (visibilidade real do que aconteceu no sistema) e do rastreamento de último acesso (segurança operacional).
- **Clientes finais**: o Portal já está maduro; o ganho marginal (exportação de relatórios do lado do cliente, prazos de garantia customizados) é menor comparado aos itens internos acima.

---

## 13. Dependências técnicas

- Todo item de integração entre módulos (seção 6 e 11) **depende da Fase 3 estar concluída** (conforme já registrado no `MASTER_ROADMAP.md`) — hoje o isolamento por `empresa_id` está presente em só 1 dos 37 módulos (achado da Fase 3), e propagar automações de escrita entre módulos sobre uma base de dados ainda inconsistente amplia o risco de erro, não reduz.
- O backend de Auditoria depende de decidir a fonte única de verdade para cada tipo de evento (ex.: reaproveitar padrão já usado em `auditoria_usuarios_permissoes` da Fase 1) antes de estender para OS/Financeiro/Estoque.
- Exportação de relatórios (PDF/Excel) é uma capacidade transversal — vale avaliar se é uma função utilitária compartilhada (`shared/`) reaproveitável por todos os módulos, em vez de implementada isoladamente em cada um.
- O módulo Compras, ao ser criado, deve nascer já integrado com Fornecedor e Estoque (que já têm a metade do fluxo pronta) — não faz sentido implementá-lo isolado e integrar depois.

---

## 14. Riscos técnicos observados

| Risco | Severidade | Detalhe |
|---|---|---|
| Ausência de paginação em listas que crescem (OS, leads, Estoque, Diário, busca global) | Média-Alta | Hoje mitigado pelo volume ainda pequeno de dados; qualquer integração que aumente automação de escrita deve vir acompanhada de paginação |
| Criptografia de senhas em Central de Informações é ofuscação, não segurança real | Média | Risco se o módulo for usado para guardar senhas de fato sensíveis (hoje é usado para senhas operacionais internas) |
| Padrão de desbloqueio de celular armazenado em claro (OS) | Média | Dado sensível de cliente sem hash/criptografia |
| Ações destrutivas com baixa fricção (senha de 2 dígitos em pós-venda, "Limpar Tudo" em Fornecedor) | Média | Risco de exclusão acidental de dados operacionais |
| Sobreposição não resolvida entre Relatórios e Análise | Baixa-Média | Não é bug, mas gera manutenção duplicada de lógica de agregação dos mesmos dados |
| Módulo Auditoria prometido no roadmap sem backend nenhum | Alta para governança | Qualquer decisão de negócio que dependa de "auditoria consolidada" (citada na Fase 4 do roadmap) não tem hoje nenhuma base de código para evoluir — é construção nova, não consolidação |

---

## 15. Ordem recomendada das implementações

**Pré-requisito para tudo:** Fase 3 (Consolidação da Arquitetura) concluída — sem isolamento de dados consistente, automações de escrita entre módulos (integrações da seção 6) amplificam risco em vez de reduzir, conforme o próprio `MASTER_ROADMAP.md` já prevê.

**Onda 1 — Fecha ciclos de dados já existentes (maior valor, menor invenção de tela nova):**
1. Integração Caixa → Estoque (baixa automática na venda).
2. Integração Financeiro ↔ Caixa (contas pagas/recebidas refletem em lançamento único).
3. OS entregue → conta a receber automática no Financeiro.

**Onda 2 — Pendências formais já registradas em fases anteriores:**
4. Rastreamento de último acesso + políticas de senha (Usuários e Permissões — pendência da Fase 1).
5. Templates de WhatsApp com variáveis + histórico de envio (`crm-comercial` — item já citado no roadmap da Fase 4).

**Onda 3 — Construção nova de maior esforço:**
6. Backend real do módulo Auditoria (pré-requisito de qualquer relatório de auditoria consolidado).
7. Módulo Compras (fecha o ciclo já preparado por Fornecedor/Estoque Baixo).

**Onda 4 — Capacidade transversal e itens de menor impacto:**
8. Exportação de relatórios (PDF/Excel), começando por Financeiro e Portal do Cliente.
9. Notificação sonora/push na Central de Alertas.
10. Itens de baixa prioridade da seção 11 (upload real de imagem no Catálogo, validação de formato em Contas, criptografia real em Central de Informações, conteúdo dos módulos "em breve" do Portal Técnico).

Cada onda deve seguir o mesmo processo de 8 etapas já validado nas Fases 1 e 2 (Planejamento → Implementação → Testes → Homologação → Correções → TECHDOC → Aprovação formal → Liberação), um módulo por vez, nunca integração simultânea — conforme constante permanente do `MASTER_ROADMAP.md`.

---

## Conclusão

O sistema tem uma base funcional ampla (28 de 35 módulos operacionais) e madura em pontos centrais (OS, Portal do Cliente, Central de Alertas, Diário, Relatórios). O maior ganho da Fase 4 não está em criar módulos novos do zero, mas em **conectar dados que hoje já existem em módulos isolados** (Caixa/Estoque/Financeiro/OS) e em **cumprir pendências formais já registradas** desde a Fase 1 (último acesso, políticas de senha) e no próprio roadmap da Fase 4 (templates de WhatsApp, auditoria consolidada). O único módulo verdadeiramente ausente e citado como funcionalidade prometida é `Compras`; `Automação`, `Chat` e `Estratégia` são pastas reservadas sem nenhuma evidência de compromisso formal para esta fase.

**Nenhuma alteração de código, configuração, banco de dados ou Firestore Rules foi realizada durante este levantamento.** Este documento aguarda aprovação formal antes de qualquer planejamento técnico detalhado ou implementação.
