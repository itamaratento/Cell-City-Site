# 📊 DECISAO_NEGOCIO_OS_FINANCEIRO.md — Momento do Reconhecimento da Receita da OS

> **Natureza deste documento:** estudo comparativo para apoiar uma decisão de negócio. Não contém implementação nem alterações de código, banco de dados ou Firestore Rules. As evidências técnicas citadas foram lidas diretamente do código-fonte em 2026-07-01 (arquivo:linha), no contexto da validação registrada em [`FASE_4_VALIDACAO.md`](FASE_4_VALIDACAO.md), seção 2.6.

---

## 0. Contexto — o que existe hoje (fato, não opção)

Antes de comparar as três opções, é preciso registrar com precisão o que o sistema **já faz hoje**, porque nenhuma das três opções parte de uma folha em branco — a Opção A já está parcialmente implementada, só que de um jeito frágil que nenhuma das opções deveria repetir.

- `saveOS()` (`CRM/pages/os/os.js:557-642`) cria a OS sempre com `status: 'recebido'` (linha 609) e captura o campo `valor` do formulário de intake (linha 560, campo `f-valor`).
- Logo depois de gravar a OS, `runAutomacoesOS(os)` é chamada **uma única vez, síncrona à criação** (linha 622). Dentro dela, um lançamento em `financeiro_receber` só é criado **se `valorTotal > 0` nesse exato momento** (linhas 675-689).
- **Consequência prática 1**: se o valor não é conhecido no intake (cenário comum — muitas OS entram como "recebido"/"em análise" sem orçamento fechado), **nenhuma conta a receber é criada**, nem depois, quando o orçamento é aprovado. `changeStatus()` (linha 1123) e `saveOSEdit()` (linha 1080, que é onde o valor normalmente seria preenchido ou corrigido após diagnóstico) **não chamam `runAutomacoesOS()` nem tocam em `financeiro_receber`** em nenhum ponto.
- **Consequência prática 2**: o campo `vencimento` do lançamento automático é gravado como a **data da criação da OS** (linha 680: `new Date().toISOString().slice(0,10)`). Como `financeiro.js:88` marca automaticamente como `vencido` qualquer item cujo `vencimento < hoje()`, **todo lançamento criado por esse mecanismo vira "vencido" no dia seguinte**, independentemente de o cliente ter tido qualquer prazo real de pagamento. Isso é um defeito estrutural do mecanismo atual, não uma característica de uma das opções — gera falso positivo de inadimplência por design.
- **Consequência prática 3**: se o orçamento for recusado (`orcamento_recusado`, status terminal) ou a OS for editada com valor diferente depois de criada, **não existe nenhum código que cancele, atualize ou remova** o lançamento em `financeiro_receber` já criado. Ele fica pendente/vencido para sempre, referente a um serviço que pode nunca ter sido prestado.
- **Consequência prática 4**: nenhum outro módulo lê `financeiro_receber` hoje — não há alerta na Central de Alertas, não aparece em Relatórios, não aparece em Análise, não aparece no Dashboard além do link do card do módulo (confirmado por busca em `central-alertas.js`, `relatorios.js`, `analise.js`, `dashboard.js`). Ou seja, o lançamento automático de hoje é **operacionalmente invisível** a menos que alguém abra o módulo Financeiro manualmente.
- **Consequência prática 5**: Caixa e Financeiro não têm nenhuma referência cruzada (confirmado na validação, seção 2.5) — marcar o lançamento como "recebido" no Financeiro é uma ação manual totalmente desconectada de o pagamento ter de fato entrado no Caixa.

Este é o ponto de partida real. As três opções abaixo devem ser entendidas como "como consertar/formalizar isso", não como três construções alternativas do zero.

---

## 1. Opção A — Gerar a conta a receber na criação da OS

### Fluxo operacional
Ao salvar uma nova OS com valor preenchido, o sistema grava imediatamente um lançamento em `financeiro_receber` com status `pendente`, vinculado ao `osId`. O valor reconhecido é o informado no intake — antes de qualquer diagnóstico técnico ou aprovação formal de orçamento pelo cliente.

### Impacto no Caixa
Nenhum automático — Caixa e Financeiro seguem sem qualquer sincronização (fato confirmado, seção 0). O recebimento real do dinheiro continua sendo um lançamento manual e independente em `caixa_lancamentos`.

### Impacto no Financeiro
Positivo em antecipação de visibilidade (o time financeiro vê "o que está para entrar" desde o primeiro dia da OS), mas negativo em confiabilidade: como o valor de intake é frequentemente uma estimativa (o defeito ainda não foi diagnosticado tecnicamente na etapa "recebido"), o valor no Financeiro pode divergir do valor final aprovado — e, como já registrado, hoje não há mecanismo de ajuste desse valor depois.

### Impacto no Estoque
Nenhum, direto ou indireto. OS não tem integração com Estoque hoje (confirmado na validação, achado da Fase 4) — a decisão sobre o momento de reconhecimento de receita não altera isso.

### Impacto nos relatórios
Nenhum hoje, porque nenhum relatório lê `financeiro_receber` (fato confirmado, seção 0). Se essa leitura vier a ser implementada (item já recomendado no levantamento da Fase 4 — "Dashboard financeiro consolidado"), a Opção A infla artificialmente o "a receber" com valores de OS que nunca terão orçamento aprovado (ainda em análise, ou que serão recusadas).

### Impacto na inadimplência
**Alto risco de falso positivo.** Como descrito na seção 0, o `vencimento` gravado na criação vira "vencido" já no dia seguinte, mesmo que o cliente ainda esteja aguardando o diagnóstico técnico ser concluído. Qualquer relatório de inadimplência construído sobre este dado hoje mostraria como "inadimplente" toda OS ainda em andamento — um problema sério se a Opção A for mantida sem correção do campo `vencimento`.

### Vantagens
- Visibilidade antecipada do volume de negócio em andamento.
- Já está parcialmente implementado — menor esforço de ajuste, se a decisão for mantê-la (corrigindo os defeitos da seção 0).
- Simples de entender operacionalmente ("toda OS com valor vira uma cobrança").

### Desvantagens
- Reconhece receita antes de haver qualquer compromisso do cliente (o orçamento pode ainda nem ter sido enviado).
- Sem tratamento de cancelamento/recusa de orçamento — gera lançamento "fantasma" que nunca deveria ter existido.
- Sem tratamento de reajuste de valor — lançamento pode ficar desatualizado em relação ao valor real acordado.
- Contamina qualquer relatório futuro de fluxo de caixa projetado com valores não confirmados.

### Riscos
- Ilusão de faturamento maior do que o real, se um gestor olhar `financeiro_receber` sem saber da fragilidade do dado.
- Falso positivo de inadimplência em escala (todo lançamento vence no dia seguinte à criação).
- Divergência silenciosa entre valor no Financeiro e valor real da OS após reajuste de orçamento.

### Complexidade técnica
Baixa para manter como está; **Média** para corrigir os defeitos estruturais (mover a criação do lançamento para o momento correto do fluxo, ajustar `vencimento` para uma data plausível, tratar edição/cancelamento).

### Compatibilidade com a arquitetura atual
Alta — é o que já existe, não exige nenhuma mudança de padrão (Firestore direto do client, sem Cloud Functions).

### Compatibilidade com futuras integrações
Baixa. Qualquer integração futura (dashboard financeiro consolidado, relatório de inadimplência real, sincronização Financeiro↔Caixa da Fase 4) herdaria os dados estruturalmente inconsistentes descritos na seção 0, exigindo limpeza retroativa antes de confiar nos números.

---

## 2. Opção B — Gerar a conta a receber somente na entrega/finalização da OS

### Fluxo operacional
Nenhum lançamento financeiro é criado durante a criação, diagnóstico ou aprovação do orçamento. Só quando `markDelivered()` (`os.js:1185`) é chamado — OS passa a `status: 'entregue'` — é que um lançamento em `financeiro_receber` seria gerado, com o valor final da OS (já consolidado, incluindo eventuais ajustes feitos via `saveOSEdit()` ao longo do processo).

### Impacto no Caixa
Mesma ausência de sincronização automática de hoje — a criação da conta a receber na entrega não implica lançamento automático em `caixa_lancamentos`; o recebimento efetivo continua sendo ação manual do operador de Caixa.

### Impacto no Financeiro
Alto ganho de confiabilidade — o valor reconhecido é o valor real e final do serviço prestado, sem risco de divergência por reajuste de orçamento. Reduz o volume de lançamentos "fantasma" (OS que nunca chegam a ser entregues não geram nada no Financeiro).

### Impacto no Estoque
Nenhum, direto — mesma observação da Opção A: OS não integra com Estoque hoje.

### Impacto nos relatórios
Positivo se/quando um relatório vier a consumir `financeiro_receber`: os valores refletiriam serviços de fato concluídos, sem ruído de orçamentos em andamento ou recusados.

### Impacto na inadimplência
Mais correto conceitualmente (a cobrança só existe quando o serviço foi de fato entregue — o cliente já tem o produto em mãos, então o prazo de pagamento tem sentido real), mas ainda depende de o campo `vencimento` ser definido com uma data plausível (não a data da entrega, a menos que o pagamento seja imediato — hoje o sistema não distingue "pago na entrega" de "a prazo").

### Vantagens
- Reconhece receita só quando há entrega efetiva de valor ao cliente — alinhado ao regime de competência mais conservador.
- Elimina o problema de "lançamento fantasma" de orçamento recusado, porque OS recusada (`orcamento_recusado`) nunca chega a `entregue`.
- Usa o valor final e já consolidado da OS, sem risco de divergência por reajuste.

### Desvantagens
- Perde visibilidade antecipada — o time financeiro só sabe do valor a receber quando o serviço já foi entregue, o que pode ser tarde para planejamento de fluxo de caixa (ex.: uma OS "em reparo" há 2 semanas com orçamento já aprovado representa receita comprometida que a Opção B esconde até a entrega).
- Se a OS for entregue sem que o técnico atualize o valor corretamente antes de clicar "Entregar", o lançamento herda um valor potencialmente desatualizado — mesmo risco de qualidade de dado que a Opção A tem, só que num ponto mais tardio.
- Não há hoje nenhum sinal de "orçamento aprovado, aguardando execução" no Financeiro — quem depende desse módulo para prever receita futura não teria nenhuma informação até a entrega.

### Riscos
- Subestimação do fluxo de caixa projetado (Financeiro não "vê" nada até a entrega, mesmo que o orçamento já esteja aprovado e o serviço em execução).
- Mesmo risco de "vencimento incorreto" da Opção A se a implementação repetir o padrão de gravar `vencimento = data de hoje` sem lógica de prazo real.

### Complexidade técnica
Baixa-Média — é essencialmente mover o gatilho de `saveOS()` (linha 622) para dentro de `markDelivered()` (linha 1185), removendo a chamada em `runAutomacoesOS()` na criação. Menor risco de regressão do que parece, porque a função `runAutomacoesOS()` já existe e só precisaria ser invocada em outro ponto do ciclo de vida — mas exige revisão cuidadosa do restante da automação hoje agrupada na mesma função (o lembrete de agenda +3 dias, linhas 649-672, que faz sentido continuar disparando na criação, não na entrega — ou seja, a função precisaria ser desmembrada, não só remapeada).

### Compatibilidade com a arquitetura atual
Alta — usa o mesmo padrão de escrita direta do client no Firestore, só muda o ponto de disparo.

### Compatibilidade com futuras integrações
Média-Alta — é compatível com uma futura integração OS→Caixa no momento da entrega (ex.: "OS entregue, gerar automaticamente também lançamento em Caixa se pagamento for à vista"), mas ainda não resolve a ausência de visão de receita futura comprometida (orçamentos aprovados aguardando execução), que é exatamente o que a Opção C endereça.

---

## 3. Opção C — Modelo híbrido (previsão na criação → confirmação na entrega)

### Fluxo operacional
Dois eventos, dois registros (ou um registro com dois estados bem definidos):
1. **OS criada** (ou, mais precisamente, **orçamento aprovado** — `status: 'orcamento_aprovado'`, não a criação bruta em `'recebido'`) → gera um lançamento em `financeiro_receber` com um status explícito de **previsão** (ex.: `status: 'previsto'`, distinto de `pendente`/`vencido`/`recebido` que já existem em `financeiro.js`).
2. **OS entregue** (`markDelivered()`) → o mesmo lançamento é **atualizado** (não duplicado) para status `pendente` (ou `recebido`, se o pagamento for confirmado no ato), com o valor final consolidado e um `vencimento` real a partir da data de entrega.
3. Se a OS for recusada ou cancelada antes da entrega, o lançamento em estado "previsto" é automaticamente removido ou marcado como `cancelado` — nunca vira uma cobrança real.

### Impacto no Caixa
Mesma ausência de sincronização automática das outras opções — mas a Opção C é a que melhor prepara o terreno para uma futura integração Caixa↔Financeiro (Fase 4, seção 2.5 da validação), porque o registro financeiro já nasce com um `osId` e um estado de ciclo de vida claro, facilitando reconciliação futura.

### Impacto no Financeiro
O mais rico das três: o time financeiro passa a enxergar tanto a receita **comprometida mas ainda não entregue** (útil para projeção de fluxo de caixa) quanto a receita **confirmada e cobrável** (só depois da entrega) — sem misturar as duas categorias, desde que a UI/relatórios do Financeiro distingam visualmente `previsto` de `pendente`/`recebido`.

### Impacto no Estoque
Nenhum direto, mesma observação das outras duas opções.

### Impacto nos relatórios
O mais favorável das três para o "Dashboard financeiro consolidado" já recomendado na Fase 4 (validação, seção 2.11): permite dois indicadores distintos — "receita prevista" (soma de `previsto`) e "receita confirmada" (soma de `pendente`/`recebido`) — sem exigir uma segunda estrutura de dados.

### Impacto na inadimplência
O mais correto conceitualmente: só entra no cálculo de inadimplência (vencido/atrasado) o que está no estado `pendente`/`recebido` com um `vencimento` real definido a partir da entrega — itens em `previsto` nunca deveriam contar como inadimplência, porque ainda não são uma cobrança formal ao cliente.

### Vantagens
- Combina o melhor das duas opções anteriores: visibilidade antecipada (Opção A) sem contaminar o indicador de inadimplência, e confiabilidade do valor final (Opção B).
- É o único modelo que trata explicitamente o caso de orçamento recusado/cancelado sem deixar lançamento órfão.
- Cria a base de dados mais adequada para as integrações já mapeadas como pendentes na Fase 4 (fluxo de caixa projetado, dashboard financeiro consolidado).

### Desvantagens
- É a opção de maior esforço de implementação das três — exige desmembrar `runAutomacoesOS()`, adicionar um novo estado (`previsto`) ao vocabulário do Financeiro (hoje `financeiro.js` só reconhece `pendente`/`vencido`/`pago`/`recebido`), e tratar o caminho de cancelamento/recusa.
- Introduz mais um estado para o time operacional aprender e para a UI do Financeiro exibir corretamente (risco de confusão se a UI não deixar claro visualmente o que é "previsão" vs. "cobrança real").

### Riscos
- Se o estado `previsto` não for bem diferenciado na UI do Financeiro, o time pode confundir receita prevista com receita garantida — mesmo risco de otimismo excessivo da Opção A, só que mitigável com boa UX (ao contrário da Opção A, aqui existe um campo para diferenciar).
- Maior superfície de código tocado (`os.js` em dois pontos do ciclo de vida + `financeiro.js` para reconhecer o novo estado) — mais pontos de possível regressão do que as Opções A ou B isoladas.

### Complexidade técnica
**Alta** — é a mais complexa das três, mas não desproporcionalmente: a maior parte do esforço é desmembrar corretamente `runAutomacoesOS()` (separar o lembrete de agenda, que deveria continuar na criação, da automação financeira, que passaria a ter dois pontos de disparo) e adicionar tratamento explícito do estado `previsto`/`cancelado` em `financeiro.js`.

### Compatibilidade com a arquitetura atual
Alta — continua usando o mesmo padrão (escrita direta do client no Firestore, sem Cloud Functions), só com um vocabulário de status um pouco mais rico.

### Compatibilidade com futuras integrações
**A mais alta das três.** É a única opção que already antecipa exatamente a estrutura de dado necessária para: (a) o "fluxo de caixa projetado" já recomendado na Fase 4 (a soma de `previsto` É a projeção); (b) a futura integração Financeiro↔Caixa (o `osId` e o ciclo de vida claro do lançamento facilita reconciliação); (c) um eventual relatório de taxa de conversão orçamento→entrega (compara quantos `previsto` viraram `pendente`/`recebido` vs. quantos foram cancelados).

---

## 4. Quadro comparativo resumido

| Critério | Opção A (criação) | Opção B (entrega) | Opção C (híbrido) |
|---|---|---|---|
| Visibilidade antecipada de receita | ✅ Alta (mas não confiável) | ❌ Nenhuma até a entrega | ✅ Alta e diferenciada |
| Confiabilidade do valor reconhecido | ❌ Baixa (pode ficar desatualizado) | ✅ Alta (valor final) | ✅ Alta (valor final na confirmação) |
| Risco de falso positivo de inadimplência | 🔴 Alto (estrutural, hoje) | 🟡 Médio (depende de `vencimento` correto) | 🟢 Baixo (estado `previsto` não conta) |
| Trata cancelamento/recusa de orçamento | ❌ Não | ✅ Sim (nunca chega a existir) | ✅ Sim (explícito) |
| Complexidade de implementação | 🟢 Baixa (já existe, precisa correção) | 🟡 Baixa-Média | 🔴 Alta |
| Compatibilidade com integrações futuras da Fase 4 | 🔴 Baixa | 🟡 Média-Alta | 🟢 Alta |
| Esforço de migração dos dados já existentes hoje | — (é o estado atual) | Baixo (descartar os lançamentos criados na criação, recriar na entrega das OS ainda abertas) | Médio (reclassificar lançamentos existentes como `previsto` ou `pendente` conforme status atual da OS) |

---

## 5. Recomendação

**Recomenda-se a Opção C (modelo híbrido)**, com uma ressalva importante sobre o ponto de disparo da "previsão": não deveria ser a criação bruta da OS (`status: 'recebido'`), e sim o momento em que o **orçamento é aprovado** (`status: 'orcamento_aprovado'`) — é o primeiro ponto do fluxo em que existe um compromisso real de valor entre cliente e loja. Isso evita repetir o defeito da Opção A de reconhecer receita sobre um valor ainda especulativo de intake, sem perder a vantagem de visibilidade antecipada que motiva o modelo híbrido.

### Justificativa

1. **É a única opção que resolve, ao mesmo tempo, os dois problemas reais já confirmados no código de hoje** (seção 0): o falso positivo estrutural de inadimplência (`vencimento` = data de criação) e o lançamento órfão de orçamento recusado. As Opções A e B resolvem só um dos dois problemas cada uma.
2. **É a que melhor aproveita o trabalho já mapeado como pendente na própria Fase 4** — o "Dashboard financeiro consolidado" (validação, seção 2.11) e a futura integração Financeiro↔Caixa (validação, seção 2.5) ambos se beneficiam diretamente de ter dois estados distintos (previsão vs. confirmação) desde já, em vez de precisar reconstruir essa distinção depois sobre uma base de dados já poluída.
3. **O maior esforço de implementação (complexidade Alta) é justificável** porque parte dele já seria necessário de qualquer forma para corrigir os defeitos estruturais da Opção A — não é um custo adicional puro, é o custo de fazer certo uma vez em vez de corrigir a Opção A hoje e ter que evoluir para o modelo híbrido depois, quando a Fase 4/5 exigir fluxo de caixa projetado.
4. **É a opção mais alinhada ao princípio já registrado no `MASTER_ROADMAP.md`** de que integrações de escrita automática entre módulos devem ser tratadas com o mesmo rigor de homologação da Fase 1/2 — o modelo híbrido, por ter estados explícitos (`previsto`/`pendente`/`cancelado`), é o mais auditável e o mais fácil de testar de forma isolada (dá para simular os três caminhos — aprovado→entregue, aprovado→recusado depois, nunca aprovado — como casos de teste discretos).

### Condição para a recomendação valer

Esta recomendação pressupõe que a implementação:
- Corrija o campo `vencimento` para refletir um prazo real de pagamento (não a data do evento que disparou o lançamento) — sem isso, mesmo a Opção C herda o risco de falso positivo de inadimplência.
- Trate explicitamente o caminho `orcamento_aprovado → orcamento_recusado` (hoje o fluxo permite estados terminais alternativos) e o caminho de OS excluída, cancelando o lançamento `previsto` correspondente.
- Seja implementada **depois** da decisão estar formalmente aprovada — este documento é só o estudo comparativo, não o planejamento técnico da mudança (que exigiria, seguindo o processo já validado do projeto, seu próprio ciclo de Planejamento → Implementação → Testes → Homologação → TECHDOC → Aprovação).

---

## Conclusão

As três opções foram avaliadas com base no comportamento real do código hoje, não em suposições. A Opção A já está parcialmente implementada e carrega dois defeitos estruturais confirmados (falso positivo de inadimplência por `vencimento` incorreto; lançamento órfão em caso de recusa de orçamento). A Opção B corrige esses dois problemas mas sacrifica visibilidade antecipada de receita. A Opção C combina as vantagens de ambas com maior complexidade de implementação, e é a recomendação deste estudo — com o ajuste de que o gatilho da "previsão" deveria ser a aprovação do orçamento, não a criação bruta da OS.

**Nenhuma alteração de código, configuração, banco de dados ou Firestore Rules foi realizada durante este estudo.** Este documento é exclusivamente uma análise comparativa para apoiar uma decisão de negócio; nenhuma implementação deve iniciar antes de uma aprovação formal explícita sobre qual opção adotar.
