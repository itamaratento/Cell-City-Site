# Sprint Futura — Simplificação do Cadastro de Clientes

> ⚠️ **NÃO EXECUTAR AGORA.**
> Esta Sprint deve ser executada APENAS após homologação operacional completa
> e confirmação de que os campos não são utilizados no dia a dia.

---

## Comparação Legado × Novo — Endereço

| Campo | Existia no Legado? | Existe no Novo? | Uso operacional estimado | Decisão |
|-------|-------------------|-----------------|--------------------------|---------|
| CEP | ❌ (não existia) | ✅ 7 campos estruturados | Baixo — raramente necessário para reparo | **Ocultar** (colapsado em "Mais endereço") |
| Rua (street) | ❌ (texto livre único) | ✅ | Baixo — necessário apenas para retirada ou NFe | **Ocultar** |
| Número (number) | ❌ | ✅ | Baixo | **Ocultar** |
| Complemento (complement) | ❌ | ✅ | Muito baixo | **Ocultar** |
| Bairro (neighborhood) | ❌ | ✅ | Muito baixo | **Ocultar** |
| Cidade (city) | ❌ | ✅ | Muito baixo | **Ocultar** |
| Estado (state) | ❌ | ✅ | Muito baixo | **Ocultar** |
| Endereço (texto livre único) | ✅ | ❌ (substituído) | Médio | **Restaurar** como campo único opcional |

### Observações

1. O sistema legado possuía **UM único campo** de texto livre chamado `endereco`.
2. O sistema novo expandiu para **SETE campos** estruturados (CEP, Rua, Número, Complemento, Bairro, Cidade, Estado).
3. Para uma assistência técnica de celulares, o endereço completo raramente é necessário — o cliente deixa o aparelho e retorna para buscar.
4. A expansão para 7 campos aumentou a complexidade do formulário sem ganho operacional comprovado.

---

## Plano de Simplificação

### Fase 1 — UI (não altera banco nem compatibilidade)

1. Substituir os 7 campos de endereço por **UM campo de texto livre** `f-endereco` no formulário de cliente, mantendo a mesma label "📍 Endereço".
2. Os 7 campos originais (cep, street, number, complement, neighborhood, city, state) **continuam sendo gravados no Firestore** quando houver valor — apenas a interface exibe um campo único.
3. No `saveFullClient`, mapear o valor do campo único para `{ endereco: valor }` em vez de popular os 7 campos.

### Fase 2 — Exibição no detalhe (UI apenas)

1. Substituir a exibição estruturada de endereço no `showClientDetail` por:
   - Se `client.endereco` existir, exibir o texto livre.
   - Fallback: exibir os campos estruturados antigos concatenados (para compatibilidade com dados existentes).

### Fase 3 — CEP lookup (manter funcionalidade)

1. O botão de busca de CEP pode ser mantido como funcionalidade auxiliar, mas preenche o campo único de endereço com o resultado formatado em vez de popular 7 campos.

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Dados existentes com endereço estruturado ficam invisíveis | Alta | Médio | Fallback no `showClientDetail` para exibir campos antigos concatenados |
| Operação precisa de endereço completo (NFe/serviço de delivery) | Baixa | Alto | Manter toggle "Endereço completo" que revela os 7 campos |
| Cliente reclama de perder dados após simplificação | Média | Baixo | Dados permanecem no Firestore, apenas UI muda |

---

## Critério para execução

Executar esta Sprint somente se, após pelo menos 30 dias de uso real:

1. Nenhum atendimento dependeu dos campos de endereço estruturado.
2. Nenhuma NFe ou nota fiscal foi emitida usando endereço do cliente.
3. Os técnicos confirmarem que endereço não é necessário na ficha.

Se qualquer um dos critérios acima for atendido, iniciar a simplificação.

---

## Esforço estimado

| Tarefa | Esforço |
|--------|---------|
| Substituir 7 inputs por 1 input no formulário | ~30 min |
| Ajustar saveFullClient para gravar campo único | ~15 min |
| Ajustar showClientDetail para exibir campo único + fallback | ~15 min |
| Manter CEP lookup com preenchimento formatado | ~15 min |
| Testes | ~30 min |
| **Total** | **~2 horas** |

Nenhuma alteração arquitetural, de banco, Rules, Functions ou compatibilidade retroativa.
