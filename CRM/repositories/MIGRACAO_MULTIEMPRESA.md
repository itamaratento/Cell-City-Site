# Estratégia de Migração — Dados Multiempresa (PS-2)

## Objetivo

Adicionar o campo `empresa_id` em todos os documentos das coleções
de dados existentes, sem interromper a operação.

## Pré-requisitos

- [ ] Índices compostos criados no Firestore (ver `INDICES_MULTIEMPRESA.md`)
- [ ] Firestore Rules atualizadas com `mesmaEmpresaRead/Write` (PS-1)
- [ ] `cellcity-master` registrado como empresa na coleção `empresas`
- [ ] Backup completo do Firestore antes de iniciar

## Ordem das Coleções

### Fase 1 — Catálogos e Domínios (baixo risco)
1. `categorias_caixa`
2. `categorias_produtos`
3. `financeiro_categorias`
4. `categorias_comandos`
5. `categorias_informacoes`

### Fase 2 — Dados Operacionais (risco médio)
6. `os`
7. `clientes`
8. `caixa_lancamentos`
9. `estoque_produtos`
10. `produtos`
11. `catalogo_produtos`

### Fase 3 — Financeiro (risco médio)
12. `financeiro_pagar`
13. `financeiro_receber`
14. `financeiro_fixas`
15. `lembretes_pagamento`

### Fase 4 — CRM e Atendimento (risco médio)
16. `crm_leads`
17. `contas_numeros`
18. `chips_cadastros`
19. `agendamentos`
20. `mensagens_portal`
21. `avaliacoes`

### Fase 5 — Pós-Venda e Histórico (risco baixo)
22. `posvenda_contatos`
23. `posvenda_mensagens`
24. `posvenda_rastreamento`
25. `diario_registros`
26. `diario_eventos`
27. `tarefas_semana`
28. `agenda`
29. `acoes_semana`

### Fase 6 — Suporte e Config (risco baixo)
30. `comandos`
31. `informacoes`
32. `central_organizacao`
33. `portal_eventos`
34. `fornecedor_compras`
35. `fornecedor_tendencias`
36. `catalogo_config`

### Fase 7 — Agregações (risco baixo)
37. `historico_diario`
38. `historico_mensal`
39. `historico_semanal`
40. `vendas_importadas`
41. `resumo_live`
42. `alertas_usuario`
43. `central_alertas_status`
44. `solicitacoes_diagnostico`
45. `pre_os`

## Script de Migração (por coleção)

```javascript
// scripts/backfill-empresa-id.js
import { db } from '../CRM/scripts/firebase.js';

const COLLECTIONS = [
  'os', 'clientes', 'caixa_lancamentos', /* ... */
];
const BATCH_SIZE = 500;

async function backfillColecao(nomeColecao) {
  const snap = await db.collection(nomeColecao)
    .where('empresa_id', '==', null)
    .limit(BATCH_SIZE)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  snap.forEach(doc => {
    batch.update(doc.ref, { empresa_id: 'cellcity-master' });
  });
  await batch.commit();
  return snap.size;
}
```

## Rollback

1. Restaurar backup do Firestore (ver `GUIA_ROLLBACK.md`)
2. Reverter o código dos repositories para `createRepository`
3. Reverter as Firestore Rules (remover `mesmaEmpresaRead/Write`)

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Timeout em lotes grandes (>500 docs) | Média | Alto | Usar batch de 500 docs por vez |
| Consumo de cota de escrita | Alta | Médio | Agendar fora do horário comercial |
| Documentos órfãos sem empresa_id | Baixa | Alto | Validar antes de aplicar `mesmaEmpresaWrite` |
| Regra `mesmaEmpresaWrite` rejeita documentos sem empresa_id | Média | Alto | Só aplicar regra APÓS backfill completo |
| Performance degradada durante migração | Média | Médio | Executar em horário de baixo movimento |

## Impacto

- **Tempo estimado:** ~30-60 min para 50k documentos (batches de 500)
- **Leituras extras:** 1 por documento na verificação
- **Escritas:** 1 por documento (atualização do campo)
- **Custo Blaze:** ~$0.01/1000 escritas → ~$0.50 para 50k documentos
