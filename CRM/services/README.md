# services/

Camada reservada para lógica de negócio que orquestra **múltiplos** repositórios
numa mesma operação (ex.: uma venda que debita `estoque.repository.js` e lança
em `caixa.repository.js`). Vazia por enquanto — nenhum módulo migrado até aqui
(piloto Chips) precisa de orquestração entre entidades. Passa a receber arquivos
`*.service.js` quando um módulo migrado de fato precisar disso.
