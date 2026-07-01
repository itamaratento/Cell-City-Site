# CELL CITY - REGRAS PERMANENTES DE DESENVOLVIMENTO

## Objetivo
Manter a estabilidade do sistema, reduzir custos de desenvolvimento, evitar retrabalho e preservar módulos críticos.

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

## 9. Regra principal

A prioridade máxima é preservar a estabilidade do Cell City.

É preferível não implementar uma funcionalidade do que colocar em risco módulos que já estão funcionando.
