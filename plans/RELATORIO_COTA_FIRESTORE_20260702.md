# RELATÓRIO TÉCNICO — Cota do Firestore em Produção (cellcity-crm)

**Data:** 2026-07-02 (~14:00 BRT)
**Método:** somente leitura — Admin SDK, APIs `serviceusage` e `monitoring` (token do proprietário já credenciado no gcloud local), teste ponta-a-ponta simulando cliente real. Nenhuma configuração foi alterada e nenhuma API foi habilitada.

---

## 1. O projeto está no plano Spark?

**Sim, com altíssima confiança (3 evidências independentes):**

1. **Comportamento de bloqueio:** leituras retornam `429 RESOURCE_EXHAUSTED` de forma persistente ao atingir o limite gratuito. No plano Blaze não existe bloqueio — o excedente é cobrado. O bloqueio duro é comportamento exclusivo do Spark.
2. **Limites efetivos = free tier:** a API `serviceusage` mostra os limites ativos do projeto exatamente nos valores do plano gratuito: 50.000 leituras/dia, 20.000 gravações/dia, 20.000 exclusões/dia.
3. **Cloud Billing API nunca habilitada** no projeto (`SERVICE_DISABLED` desde sempre) — consistente com projeto que nunca teve conta de faturamento vinculada.

*Confirmação visual final (10 segundos): rodapé do menu lateral do console Firebase exibe "Spark" ou "Blaze".*

## 2. O erro foi causado pelo limite diário de leituras?

**Sim.** Dados do Cloud Monitoring (janela de cota: 04:00 BRT → 04:00 BRT):

| Cota (dia) | Limite free | Uso 01/07 | Uso 02/07 (até 13:48 BRT) |
|---|---|---|---|
| **Leituras** | 50.000 | **59.915 (estourou)** | **50.448 (estourou ~13:15 BRT)** |
| Gravações | 20.000 | 122 (0,6%) | 108 (0,5%) |
| Exclusões | 20.000 | 41 (0,2%) | 9 (0%) |

Somente a cota de **leituras** estourou — gravações e exclusões estão a <1% do limite. O estouro de hoje coincide exatamente com o primeiro erro observado (13:20 BRT). **Ontem (01/07) a cota também estourou**, provavelmente no fim da noite.

## 3. Consumo atual

- **Banco de dados minúsculo: ~578 documentos, 0,32 MB** (censo do backup de 02/07 02:00 UTC). Armazenamento a 0,03% do 1 GiB gratuito.
- **Backup noturno é irrelevante:** `cc-backup-dados.timer` (systemd, 23:00 BRT diário) lê ~578 docs = ~1,2% da cota diária.
- **O consumo vem do próprio CRM em uso:** contador `document/read_count` registra 10.000–20.000 leituras/hora em horário comercial, com picos de **42.958/h e 45.413/h** (01/07 à noite) — mais de 400 mil leituras de documentos em 48h.

**Diagnóstico central — amplificação de leitura:** com 578 documentos no banco, 43 mil leituras/hora significam o equivalente a ~74 varreduras completas do banco por hora. O padrão indica módulos recarregando coleções inteiras a cada navegação/refresh e/ou listeners sem cache — não é volume de dados nem de usuários, é padrão de consulta.

## 4. Impacto efetivo em produção

**Medido ponta-a-ponta** (login anônimo + leitura REST, o mesmo caminho do site): o Auth funciona normalmente, mas **toda leitura do Firestore retorna HTTP 429**. Na prática:

- CRM inteiro sem dados (Dashboard, OS, Caixa, Estoque, Financeiro…) — o usuário loga e vê telas vazias/erros.
- Páginas públicas de clientes finais (Portal do Cliente, Consultar OS, Autoatendimento, Catálogo) também sem dados.
- Bloqueio de hoje: **~13:15 BRT até ~04:00 BRT de 03/07** (reset diário à meia-noite, horário do Pacífico). Enquanto o consumo não mudar, **o estouro tende a se repetir todo dia, cada vez mais cedo**.

## 5. Migração para Blaze — custo estimado

Preço base do Firestore (região São Paulo pode ter acréscimo de ~50–100%; confirmar tabela regional no console): leituras US$ 0,06/100k, gravações US$ 0,18/100k, armazenamento a partir de US$ 0,108/GB·mês. **No Blaze o free tier diário continua valendo** (primeiras 50k leituras/dia grátis); só o excedente é cobrado.

| Cenário | Leituras/mês | Custo estimado |
|---|---|---|
| Uso típico atual (~50–100k/dia) | 1,5–3 M | **R$ 0 a ~R$ 10/mês** |
| Pior caso medido (~250k/dia, com os picos de amplificação) | 7,5 M | **~R$ 20 a R$ 45/mês** |
| Após otimização das leituras | < 1,5 M | **R$ 0** (volta ao free tier) |

Gravações, exclusões, armazenamento (0,32 MB) e tráfego: R$ 0 em qualquer cenário — tudo dentro do free tier com folga de 100×.

## 6. Alertas de orçamento recomendados (junto com o upgrade)

1. **Orçamento** de R$ 30/mês na conta de faturamento, com alertas em 50%, 90% e 100% (Billing → Orçamentos e alertas).
2. **Alerta de uso** no Cloud Monitoring: leituras Firestore > 100.000/dia → e-mail (detecta nova amplificação antes de virar custo).
3. Revisão mensal do gráfico de uso (console Firestore → aba Uso) no primeiro mês.

## 7. Otimizações para reduzir leituras (independem do plano)

Em ordem de impacto:

1. **Investigar a amplificação** (prioridade): medir leituras por módulo em teste controlado (aba Uso do console + navegação módulo a módulo). Suspeitos típicos: coleções inteiras recarregadas a cada troca de página, auto-refresh de dashboard, listeners recriados sem desligar os anteriores. Os picos de 43k/h de 01/07 à noite merecem correlação com o que estava aberto no momento.
2. **Cache local persistente** do Firestore (`persistentLocalCache`/IndexedDB) no `firebase.js` — re-leituras passam a ser servidas do cache local. *Arquivo protegido: só com autorização e TECHDOC.*
3. **`limit()` + paginação** nas listagens (hoje várias telas baixam a coleção inteira).
4. **Reuso de listeners** via ListenerManager (já existe desde o recovery de 27/06) em todos os módulos, com desligamento ao sair da tela.
5. A **separação DEV/PROD** (plano em análise) tira os testes de desenvolvimento da cota de produção.

## 8. Recomendação

1. **Curto prazo (hoje):** upgrade para **Blaze** com os alertas da seção 6 — elimina o bloqueio diário por ~R$ 0–45/mês. É a única ação que resolve o travamento de produção imediatamente. *(Ação do proprietário no console; não será executada por mim — bloqueio de alterações de infraestrutura em vigor.)*
2. **Médio prazo:** auditoria de amplificação de leitura (seção 7.1) — item candidato ao backlog formal.
3. O estouro **vai se repetir amanhã** se nada mudar: consumo típico já opera na casa do limite diário.
