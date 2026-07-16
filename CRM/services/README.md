# Camada de Serviços — Cell City CRM

## Propósito

Centralizar regras de negócio, validações e formatações que antes estavam
espalhadas nos módulos de apresentação (CRM/pages/). Cada service:

- tem **uma responsabilidade** clara
- não depende de DOM (`document`, `window`)
- não depende de Firebase diretamente (recebe dados prontos)
- pode ser testado isoladamente (Node.js puro, sem jsdom)

## Padrão

```
CRM/services/
  os-status.service.js       — fluxo e labels de status de OS
  os-timeline.service.js     — eventos de timeline de OS
  os-financeiro.service.js   — cálculos financeiros relacionados a OS
  format.service.js          — formatação de CPF, CEP, telefone, CNPJ
  ... (novos services conforme migração)
```

## Como criar um novo service

1. Criar o arquivo em `CRM/services/<nome>.service.js`
2. Exportar funções puras (sem side effects, sem acesso a DOM)
3. Importar no módulo de página e substituir a lógica inline

## Próximos passos (P2)

- Migrar lógica de Caixa (cálculos de totais, fechamento)
- Migrar lógica de Financeiro (contas a pagar/receber)
- Migrar lógica de Estoque (cálculos de custo, margem)
- Adicionar testes unitários para cada service
