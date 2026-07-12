# Manutenção e Higienização

Módulo de manutenção e higienização do Cell City CRM (Fase 9).

## Arquitetura

```
modules/manutencao/
  menu.sh        — Interface (submenu principal)
  engine.sh      — Orquestrador
  lib/
    utils.sh     — Utilitários compartilhados
    scanner.sh   — Scanner de arquivos órfãos, diretórios vazios, temporários
    codigo-morto.sh — Detecção de funções e scripts não utilizados
    duplicados.sh   — Detecção de scripts/funções/conteúdo duplicados
    dependencias.sh — Verificação de dependências não utilizadas/ausentes
    estrutura.sh    — Validação de estrutura e convenções
    gitignore.sh    — Verificação de proteções no .gitignore
    limpeza.sh      — Operações de limpeza (com confirmação)
    relatorio.sh    — Relatório de higienização
  docs/
    manutencao.md — Esta documentação
```

## Segurança

Nenhuma remoção é feita sem confirmação explícita.
Cache, temporários, logs e diretórios vazios são os únicos alvos de remoção.
