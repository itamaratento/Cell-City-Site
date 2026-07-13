# CELL CITY - REGRAS PERMANENTES DE DESENVOLVIMENTO

> Revisão de 2026-07-12: Seção 0 tornada vendor-neutra, alinhada a
> `ENGINEERING.md` v1.2 e a `plans/CCC-V2.0-ARCH-001_ARQUITETURA_OFICIAL.md`
> §17. Nenhuma seção deste arquivo atribui cargo, autoridade ou
> exclusividade permanente a um modelo de IA específico — as instruções
> abaixo orientam o comportamento de **quem estiver executando** cada
> papel de Sprint, não uma identidade fixa.

## Objetivo
Manter a estabilidade do sistema, reduzir custos de desenvolvimento, evitar retrabalho e preservar módulos críticos.

## 0. Comportamento operacional por papel da Sprint

**IMPORTANTE:** antes de iniciar qualquer trabalho, considere o documento `ENGINEERING.md` (raiz do repositório) como a autoridade máxima do projeto. Todas as decisões de arquitetura, estratégia, fluxo de engenharia e papéis de Sprint estão definidas nele — inclusive o princípio de que nenhum papel é permanente nem vinculado a um modelo específico de IA (`ENGINEERING.md` §"Princípios sobre uso de IA").

**Antes de agir, confirme qual papel foi designado para esta Sprint** — Estratégia, Revisão Técnica ou Desenvolvimento (`ENGINEERING.md` §"Papéis de Engenharia"). Se não estiver claro, pergunte a quem responde pelo projeto em vez de presumir. As instruções abaixo detalham o comportamento esperado quando o papel designado for **Revisão Técnica** — o único papel que este arquivo descreve em detalhe operacional até hoje, por ser o mais praticado neste projeto; não é o único papel possível.

### Quando o papel designado for Revisão Técnica

Nessa função, não se cria estratégia do projeto nem se prioriza backlog. Quem exerce Revisão Técnica é responsável por:
- Revisar o código produzido (arquitetura, segurança, performance, regressões, cobertura de testes, documentação, RBAC).
- Revisar Firestore Rules (somente auditoria, salvo autorização).
- Revisar Cloud Functions (somente auditoria, salvo autorização).
- Validar a qualidade da branch `develop`.
- Corrigir defeitos encontrados durante a revisão.
- Executar toda a suíte de testes.
- Aprovar ou reprovar a release.
- Promover `develop` → `main` (fast-forward quando aplicável), criar tag oficial e emitir relatório técnico final.

Fora dessa função: não criar estratégia do projeto, não priorizar backlog, não criar funcionalidades sem necessidade, não alterar arquitetura por iniciativa própria, não gerenciar outras IAs, não alterar Kernel, não alterar Repository Layer, não alterar Firestore Rules sem autorização, não alterar Cloud Functions sem autorização.

**Processo de revisão** — sempre que receber um lote produzido por outra IA no papel de Desenvolvimento:
1. Ler o relatório da Sprint.
2. Revisar todos os commits.
3. Validar arquitetura, segurança e performance.
4. Procurar regressões.
5. Executar toda a suíte de testes.
6. Corrigir apenas problemas tecnicamente comprovados.
7. Atualizar somente a documentação necessária.
8. Emitir parecer técnico.

**Aprovação** — somente aprovar quando: nenhuma regressão encontrada; todos os testes aprovados; segurança validada; performance validada; documentação consistente; branch `develop` estável.

**Promoção** — somente após aprovação técnica: `develop` → `main`, criar tag, push, confirmar sincronização.

### Quando o papel designado for Desenvolvimento ou Estratégia

Este arquivo ainda não detalha instruções operacionais específicas para esses dois papéis — só para Revisão Técnica, por ser o único praticado até hoje por quem mantém este arquivo. Na ausência delas, seguir as responsabilidades já definidas em `ENGINEERING.md` §"Papéis de Engenharia" para o papel correspondente, mais as regras gerais das Seções 1–10 abaixo (que já são neutras quanto a quem executa).

**Regra principal desta seção:** independentemente do papel designado, o compromisso é garantir que apenas trabalho de qualidade avance de etapa — da Sprint até a produção. Se houver dúvida entre velocidade e qualidade, escolha qualidade.

## 1. Segurança

- Nunca alterar Login, Autenticação, Permissões, Dashboard ou Ferramentas sem autorização explícita.
- Qualquer alteração em módulo crítico deve ser previamente justificada.
- Sempre avaliar o impacto antes de modificar arquivos compartilhados.
- Arquivos protegidos — não alterar sem autorização explícita: `firebase.js`, `auth.js`, `config.js`, `global.css`.
- Proibido: renomear arquivos, mover pastas, alterar imports globais, trocar estrutura HTML, modificar o banco Firestore diretamente.
- Sempre criar uma cópia de backup antes de alterar qualquer arquivo crítico ou protegido.

## 2. Reaproveitamento

Antes de desenvolver qualquer funcionalidade:

- Procurar nos backups do projeto.
- Verificar se o recurso já existe.
- Informar se é possível reaproveitar total ou parcialmente.
- Somente criar do zero quando o reaproveitamento não for viável.

## 3. Planejamento obrigatório

Antes de iniciar qualquer tarefa apresentar:

- Objetivo da alteração.
- Arquivos que serão modificados.
- Módulos afetados.
- Possíveis riscos.
- Estratégia de implementação.

Nenhuma alteração deve começar sem essa análise.

## 4. Desenvolvimento

Priorizar módulos independentes.

Evitar alterar código já estável.

Não criar dependências desnecessárias.

Sempre manter compatibilidade com a arquitetura atual.

Permitido, sem necessidade de autorização prévia:
- alterar somente os componentes solicitados;
- criar funções novas e isoladas;
- adicionar comentários no código.

## 5. Testes

Após qualquer alteração verificar obrigatoriamente:

- Login
- Dashboard
- CRM
- Ordem de Serviço
- Caixa
- Estoque
- Financeiro
- Portal do Cliente

Nenhuma tarefa será considerada concluída sem esses testes.

## 6. Economia

Sempre escolher a solução com:

- menor tempo de desenvolvimento;
- menor custo;
- menor quantidade de alterações;
- menor risco.

## 7. Proteção do sistema

Nunca substituir grandes partes do sistema.

Nunca alterar mais de 1 módulo por vez (crítico ou não).

Sempre trabalhar de forma isolada.

## 8. Relatório

Ao finalizar cada tarefa informar:

- Arquivos alterados.
- Motivo das alterações.
- Testes realizados.
- Riscos encontrados.
- O que ficou pendente.

## 9. Eficiência de leitura/escrita Firebase

Regra permanente desde 2026-07-03, motivada por um esgotamento real de cota Firestore em produção (plano Spark) e pela criação do ambiente DEV no plano Blaze (pay-as-you-go, sem teto automático de gasto). Vale a partir de agora, em qualquer código novo — não depende do módulo de controle de cotas (BL-004/BL-005 no backlog).

Evitar obrigatoriamente:

**Firestore**
- Loops de leitura desnecessários.
- Consultas repetidas da mesma coleção quando o resultado já está disponível.
- Consultas sem `limit()`, paginação ou filtros quando aplicável.
- Listeners (`onSnapshot`) esquecidos ao sair da tela — sempre desinscrever.
- Atualizações contínuas (polling) sem necessidade — preferir listener a poll quando cabível.
- Escritas duplicadas.
- Exclusões em massa sem controle.

**Storage**
- Upload da mesma imagem várias vezes.
- Upload de imagens sem compressão.
- Downloads repetitivos do mesmo arquivo.
- Arquivos temporários esquecidos sem limpeza.

**Geral**
- Polling constante quando um listener resolve.
- Scripts automáticos rodando continuamente sem necessidade.
- Reconsultar dados já disponíveis em cache/memória.
- Operações em lote sem necessidade real.

## 10. Regra principal

A prioridade máxima é preservar a estabilidade do Cell City.

É preferível não implementar uma funcionalidade do que colocar em risco módulos que já estão funcionando.
