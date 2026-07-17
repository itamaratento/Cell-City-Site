# Auditoria Técnica Independente — Cell City CRM SaaS (versão pública)

**Data:** 2026-07-17

> ⚠️ **Este documento é a versão redigida (sem detalhe explorável) do
> relatório completo.** Por conter, na versão integral, o mecanismo
> exato de exploração de vulnerabilidades ainda não corrigidas (e este
> repositório é público), a versão completa vive em
> `plans/AUDITORIA_TECNICA_INDEPENDENTE_20260717_INTERNO.md` — arquivo
> coberto pela exceção `plans/*_INTERNO.md` do `.gitignore`, **nunca
> commitado**. Convenção adotada desde 2026-07-04 para este tipo de
> achado (ver `CLAUDE.md`/histórico de auditorias de segurança do
> projeto). Esta versão pública lista apenas categoria + impacto de
> cada achado, sem o "como".

**Missão:** auditoria técnica independente, 100% leitura, executada em
paralelo a uma homologação operacional feita por outra ferramenta —
não repete os testes funcionais dela, busca o que eles não pegariam.
**Branch analisado:** `develop`, com comparação explícita contra `main`
(o que está publicado em produção) para cada achado com potencial
impacto real. Nenhuma alteração de código, Rules, config ou deploy foi
feita nesta missão.

---

## 1. Resumo Executivo

A arquitetura multiempresa (Rules, Cloud Functions, Repository layer,
tenant-context) está bem projetada, com defesa em profundidade real —
a isolação de tenant depende das Firestore Rules avaliadas no servidor,
não de filtro client-side. Não encontrei bypass de RBAC/tenant na
arquitetura corrente além de um achado pontual (ver §4).

Esta auditoria encontrou **4 achados 🔴 Críticos já ativos na produção
atual** (branch `main`, não apenas no SaaS ainda não promovido) — ver
§3 e §10 para categoria/impacto (detalhe técnico completo só na versão
`_INTERNO`). Nenhum dos 4 foi introduzido pelo trabalho recente de
SaaS: todos preexistem e afetam o CRM single-tenant já publicado em
`cellcityinformatica.com.br`. Nenhum seria encontrado por uma
homologação funcional com dados de exemplo bem-comportados.

Multiempresa/SaaS em si (branch `develop`, não promovido) está
consistente, com duas exceções pontuais que só importam se/quando o
SaaS for promovido (§4).

Documentação: `MASTER_ROADMAP.md` está desatualizado desde 2026-07-13
sobre o próprio estado do multiempresa (descreve como "revertido" algo
que foi reconstruído entre 07-14 e 07-16). `PROXIMA_ETAPA.md` está em
sincronia com o HEAD real.

---

## 2. Arquitetura

`npm run auditar-arquitetura` (ferramenta já existente, somente
leitura): 🟢 em todos os 6 eixos — zero import quebrado, zero
dependência circular, isolamento página→página respeitado,
inicializações do Firebase App restritas a pontos autorizados, imports
CDN restritos a allowlist, zero import absoluto fora do padrão.

Investigação manual complementar encontrou código morto já identificado
em auditorias anteriores mas nunca removido (dois arquivos de
repository multiempresa sem nenhum importador, dois scripts de seed de
uso único), uma camada `services/` inteira (4 arquivos) órfã — migração
começada e nunca concluída, com um dos arquivos órfãos já divergido da
lógica real em produção (risco concreto se a migração for retomada sem
revisão) —, e o maior módulo do repositório (`CRM/pages/os/os.js`,
~2700 linhas) contendo também a maior função isolada de todo o projeto
num arquivo irmão (~980 linhas numa única função, já documentada como
dívida técnica conhecida).

---

## 3. Segurança

Categorias dos 4 achados 🔴 Críticos confirmados ativos em produção
(`main`) — mecanismo exato de exploração, arquivos e linhas específicas
apenas na versão `_INTERNO`:

- **🔴 Execução de script não autorizada (XSS armazenado) num fluxo de
  impressão do módulo de Ordens de Serviço**, alimentável a partir de
  um formulário público sem login. Mesma categoria de vulnerabilidade
  que uma certificação anterior (2026-07-10) já havia corrigido em
  outros pontos do mesmo módulo — este ponto específico não foi
  coberto por aquele fix.
- **🔴 Exposição de dados pessoais (nome, CPF, telefone, descrição de
  defeito, valor) de qualquer Ordem de Serviço via uma função pública
  sem exigir prova de que quem pergunta é o dono do registro** —
  mitigado apenas por um limite de requisições por IP, insuficiente
  contra um atacante paciente ou distribuído. CPF é dado sensível sob a
  LGPD.
- **🔴 Uma credencial de service account de produção foi commitada no
  histórico do git de um repositório hoje público**, por uma janela de
  ~40 minutos antes de ser removida do working tree — mas permanece
  recuperável do histórico para sempre, a menos que o histórico tenha
  sido reescrito (sem evidência de que isso ocorreu). A credencial foi
  rotacionada desde então (confirmado); a revogação explícita da
  credencial antiga no provedor de nuvem não é verificável só pelo
  repositório — recomenda-se confirmação manual.
- **🔴 Dados sensíveis do cliente (incluindo uma credencial física do
  aparelho) sendo escritos no console do navegador** em produção, numa
  rotina que não passou pelo mesmo tratamento já aplicado pelo projeto
  a dezenas de casos equivalentes (processo `SEC-CONSOLE-001`, já
  rastreado antes desta auditoria).

**Verificado e considerado saudável:** CSRF não aplicável (nenhuma
sessão baseada em cookie no projeto); nenhum outro secret encontrado no
working tree atual além dos já conhecidos e corretamente gitignorados;
console do módulo `saas-admin` escapa HTML corretamente em todas as
interpolações revisadas; padrão de "Firebase secundário" para criar
conta de admin não expõe nenhuma credencial adicional; escalada de
privilégio historicamente conhecida (BL-006) confirmada corrigida;
nenhum uso de `eval`/`new Function` em todo o projeto.

**🟡 Observação menor:** geração de senha temporária do admin de
empresa aprovada usa um gerador de números pseudoaleatório não
criptográfico — correção simples, risco prático baixo.

---

## 4. Multiempresa

Escopo: `develop` (SaaS não promovido a `main`). Desenho geral sólido —
isolação ancorada nas Firestore Rules (avaliadas a partir do perfil
real do requisitante no servidor), não em filtro client-side, o que
resiste a falhas de inicialização do lado do cliente.

**Duas exceções pontuais, só relevantes se/quando o SaaS for
promovido:**
- 🟠 Uma subcoleção financeira mantém uma condição de acesso que o
  próprio arquivo de Rules, no mesmo commit, documenta ter removido
  deliberadamente de outro lugar por ser insegura — reintroduziria a
  mesma classe de vazamento cross-tenant que já foi corrigida em todo
  o resto do arquivo.
- 🟠 As regras de Storage para dois caminhos legados permitem exclusão
  por qualquer usuário autenticado, sem checar empresa nem status de
  aprovação — inconsistente com o padrão usado em todo o resto das
  regras do projeto.

Nenhum bypass de RBAC ou de isolamento de tenant além desses dois foi
encontrado. Nenhuma consulta sem filtro de tenant foi encontrada nos
repositórios revisados.

---

## 5. Firestore

Índices existentes cobrem as consultas compostas reais em uso; nenhuma
lacuna óbvia encontrada. Duas coleções ativas (ligadas a SaaS e a CRM
Comercial) têm Rule real mas não estão documentadas no catálogo de
coleções do projeto; uma coleção documentada como ativa não tem Rule
nenhuma — confirmado código morto (referenciada só por um módulo já
removido), mas o documento não sinaliza isso como faz para as demais
coleções legadas.

---

## 6. Cloud Functions

Pontos fortes confirmados: validação de entrada consistente em toda
function pública revisada; whitelisting de campos de saída (nenhuma
function devolve o documento inteiro); duas funções de resposta de
cliente exigem que o telefone do payload bata com o gravado no
documento antes de qualquer escrita; a function de exclusão de usuário
tem verificação de perfil, tenant-scoping e proteção contra excluir o
último admin da empresa.

Achado já coberto em §3 (função pública de OS sem prova de posse).
Duplicação deliberada e documentada de um helper de telefone entre
`functions/` e o código principal (limitação arquitetural do modelo
sem build step) — sem divergência hoje, mas sem teste que garanta que
continue assim.

---

## 7. Qualidade de Código

Achado mais concreto: uma função de cálculo de data de entrega (usada
para determinar se uma OS está em garantia) está duplicada em três
módulos do CRM; um quarto módulo tem uma versão corrigida (elimina um
falso positivo de garantia já documentado) que **não foi propagada**
para as outras três cópias — ou seja, o mesmo bug de falso positivo
provavelmente ainda ocorre em três dos quatro lugares que fazem esse
cálculo. Outras duplicações menores (sem bug divergente confirmado):
cálculo de semana ISO, validação/máscara de CPF, validação de e-mail,
máscara de CNPJ.

`console.log` em produção: ver achado de §3. Os demais casos
equivalentes já estão neutralizados pelo processo `SEC-CONSOLE-001`
existente (padrão frágil — depende de uma flag booleana não ser
revertida por engano numa depuração futura).

Nenhuma dependência não usada ou não declarada encontrada em nenhum
`package.json` do projeto.

---

## 8. Performance

Documentado, sem otimização (conforme escopo da missão): rate limiter
das Cloud Functions é em memória por instância, não distribuído (já
autodocumentado como limitação aceita); checagem de perfil custa uma
leitura extra do Firestore por operação em praticamente toda coleção
de negócio (custo aceito conscientemente); 27 módulos de página ainda
acessam o Firestore diretamente sem passar pela camada Repository
(migração em andamento); duas implementações paralelas da mesma lógica
de geração de alertas (Dashboard e Central de Alertas) significam que
toda mudança de regra precisa ser feita duas vezes.

---

## 9. Consistência Documental

`MASTER_ROADMAP.md` não foi atualizado desde 2026-07-13 e continua
descrevendo o multiempresa como revertido/código morto — verdade em
2026-07-04, quando o código antigo foi de fato removido, mas o SaaS foi
integralmente reconstruído entre 07-14 e 07-16 e está ativo em
`develop` com Rules, Cloud Functions e testes reais. Duas pendências
que o roadmap ainda lista como abertas (rastreamento de último acesso;
um bug de condição de corrida numa coluna de UI) já foram resolvidas no
código, sem atualização do documento. `PROXIMA_ETAPA.md`, em contraste,
está em sincronia com o HEAD real do git.

Um arquivo de Rules antigo e muito mais permissivo (primeiro commit do
repositório, nunca mais tocado, não referenciado por nenhum config de
deploy) segue no repositório apesar de já ter sido sinalizado como
"candidato a remoção" em pelo menos 4 documentos desde 2026-07-04 —
risco operacional próximo de zero (nada o referencia), mas dívida de
higiene nunca resolvida.

---

## 10. Riscos (consolidado)

| # | Categoria do risco | Severidade | Em produção hoje? |
|---|---|---|---|
| S1 | XSS armazenado num fluxo de impressão de OS | 🔴 Crítico | **Sim** |
| S2 | Função pública de consulta de OS sem prova de posse (enumeração de PII) | 🔴 Crítico | **Sim** |
| S3 | Credencial de produção no histórico git de repositório público | 🔴 Crítico | **Sim** (histórico é permanente) |
| S4 | Dado sensível do cliente (incl. credencial física) logado no console | 🔴 Crítico | **Sim** |
| A1 | Regra de Firestore com condição insegura numa subcoleção financeira | 🟠 Alto | Não (só `develop`) |
| A2 | Regra de Storage sem gate de tenant/perfil em paths legados | 🟠 Alto | Parcial* |
| M1 | Roadmap estratégico desatualizado sobre estado do multiempresa | 🟡 Médio | — |
| M2 | CI não cobre todas as suítes já certificadas manualmente | 🟡 Médio | — |
| M3 | Coleções SaaS não documentadas / coleção morta sem aviso no catálogo | 🟡 Médio | — |
| M4 | Senha temporária com PRNG não criptográfico | 🟡 Médio | Depende do SaaS estar ativo |
| M5 | Duplicação com bug divergente (cálculo de garantia) | 🟡 Médio | **Sim** |
| M6 | Camada de serviço órfã e já divergente da lógica real | 🟡 Médio | — |
| B1-B3 | Rascunho de Rules morto nunca removido; duplicação de helper de telefone; padrão de log frágil | 🟢 Baixo | — |

\* Storage não é versionado por branch da mesma forma que as Rules do
Firestore — a regra já está em vigor hoje, mas só é explorável de
forma cross-tenant quando existir mais de uma empresa real.

---

## 11. Recomendações

Ver versão `_INTERNO` para a lista completa com arquivo/linha exatos.
Em ordem de prioridade: (1) corrigir os 4 achados 🔴 antes de qualquer
outra coisa, independente de qualquer decisão sobre SaaS — nenhum é
causado pelo trabalho de multiempresa; (2) corrigir os 2 achados 🟠
antes de promover o SaaS a produção; (3) os itens 🟡/🟢 podem ser
tratados no ritmo normal de manutenção.

---

## 12. Parecer Técnico Final

**Arquitetura:** consistente. **Isolamento multiempresa:** confiável na
maior parte, com duas exceções pontuais e corrigíveis antes de
promoção. **Segurança:** 4 riscos críticos ativos na produção atual,
nenhum relacionado ao SaaS — ver versão `_INTERNO` para os detalhes que
permitem corrigi-los. **Regressões:** nenhuma nova além das já
conhecidas e rastreadas. **Pronto para produção:** o CRM já publicado
tem correções de segurança pendentes independentes de qualquer decisão
sobre SaaS; o SaaS multiempresa em si está arquiteturalmente pronto na
maior parte, mas não deveria ser promovido sem corrigir os 2 achados
🟠. **Sobre a homologação operacional paralela:** nenhum dos 4 achados
críticos seria encontrado por testes funcionais com dados de exemplo —
as duas auditorias são complementares, não substitutas uma da outra.

---

*Esta auditoria não alterou nenhum arquivo de código, configuração,
Rules ou documentação além da criação destes dois relatórios (esta
versão pública e a versão `_INTERNO` não commitada). Nenhuma correção
foi aplicada. Nenhuma Sprint foi aberta.*
