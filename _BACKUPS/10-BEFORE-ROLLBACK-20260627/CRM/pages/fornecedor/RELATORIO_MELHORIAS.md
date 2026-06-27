# 📋 MELHORIAS SOLICITADAS – MÓDULO FORNECEDOR

**Data:** 17/06/2026  
**Solicitante:** Cell City Informática  
**Módulo atual:** `CRM/pages/fornecedor/`  
**Coleções Firestore atuais:** `fornecedor_compras`, `fornecedor_tendencias`, `estoque_produtos`  
**Objetivo:** Transformar a "Lista de Compras" em um **CRM completo de Fornecedores**

---

## 1. 🏢 Cadastro Completo de Fornecedores

### Problema
Atualmente a tela "Fornecedor" funciona apenas como lista de compras. Não há cadastro de fornecedores.

### Solução
Criar uma **nova coleção Firestore** `fornecedores` com a seguinte estrutura:

```javascript
// Coleção: fornecedores/{autoId}
{
  nome: "Viper Eletrônicos",          // Nome do contato/fornecedor
  empresa: "Viper Distribuidora",      // Nome da empresa (opcional)
  telefone1: "62984363148",            // Telefone 1 (somente dígitos)
  telefone2: "62985296617",            // Telefone 2 (somente dígitos, opcional)
  whatsapp: "62984363148",             // WhatsApp (pode ser diferente)
  instagram: "@viper_eletronicos1",    // Instagram (opcional)
  site: "https://...",                 // Site (opcional)
  endereco: "Camelódromo Campinas 2 Stand 190",  // Endereço
  cidade: "Goiânia - GO",             // Cidade
  obs: "Distribuidor de peças e acessórios",     // Observações
  favorito: true,                      // ⭐ true/false
  criadoEm: Timestamp,
  atualizadoEm: Timestamp
}
```

### Campos do formulário
| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome do Fornecedor | text | ✅ Sim |
| Nome da Empresa | text | ❌ Opcional |
| Telefone 1 | tel (mascara) | ✅ Sim |
| Telefone 2 | tel | ❌ Opcional |
| WhatsApp | tel | ❌ Opcional |
| Instagram | text | ❌ Opcional |
| Site | url | ❌ Opcional |
| Endereço | text | ❌ Opcional |
| Cidade | text | ❌ Opcional |
| Observações | textarea | ❌ Opcional |

---

## 2. 🗑 Botão Remover Item na Lista de Compras

### Problema
Na Lista de Compras atual existem os botões:
- ✅ **Comprado** (remove o item)
- ✅ **Feita** (marca como concluída)

Mas **não existe** um botão explícito de exclusão. O "Comprado" remove, mas a ação não é clara para o usuário.

### Solução
Adicionar um botão **🗑 Excluir** em cada card da lista de compras:

```
[✏️ Editar] [🗑 Excluir] [✅ Feita]
```

- **🗑 Excluir** → Exibe confirmação: *"Tem certeza que deseja excluir este item?"*
- Só remove após confirmação do usuário
- Utilizar o ícone 🗑 ou o símbolo de lixeira (🗑️)

---

## 3. 🎨 Melhorar Layout da Lista de Compras

### Problema
Botões atuais estão pequenos e pouco visíveis. Cards são compactos demais.

### Solução

**Layout sugerido para cada card:**
```
┌─────────────────────────────────────────────┐
│ 📱 Cabo USB-C 2m                        🟡 │
│ Qtd: 5 · Fornecedor: Viper                 │
│                                             │
│ [✏️ Editar] [🗑 Excluir] [✅ Feita]          │
└─────────────────────────────────────────────┘
```

### Especificações visuais
| Item | Atual | Novo |
|------|-------|------|
| Altura do card | ~60px | ~90-100px |
| Fonte do nome | 14px | 16px |
| Padding | 12px 14px | 16px 18px |
| Border-radius | 10px | 14px |
| Espaçamento entre botões | 8px | 10px |
| Background do card | rgba(255,255,255,0.02) | rgba(20,24,22,0.8) |

### Cores sugeridas para botões
| Botão | Cor | Fundo | Borda |
|-------|-----|-------|-------|
| 🟢 Comprado | `#00e676` | `rgba(0,200,83,0.12)` | `rgba(0,200,83,0.3)` |
| 🟡 Pendente/Feita | `#fbbf24` | `rgba(251,191,36,0.12)` | `rgba(251,191,36,0.3)` |
| 🔵 Editar | `#60a5fa` | `rgba(96,165,250,0.1)` | `rgba(96,165,250,0.25)` |
| 🔴 Excluir | `#f87171` | `rgba(248,113,113,0.1)` | `rgba(248,113,113,0.25)` |

---

## 4. 🃏 Card de Fornecedor

### Problema
Não existe visualização de fornecedores cadastrados.

### Solução
Criar cards estilizados para cada fornecedor:

```
┌─────────────────────────────────────────┐
│ 🏢 VIPER ELETRÔNICOS               ⭐ │
│ 📞 (62) 98436-3148                     │
│ 📞 (62) 98529-6617                     │
│ 📷 @viper_eletronicos1                 │
│ 📍 Camelódromo Campinas 2              │
│                                         │
│ [🌐 Abrir Site] [💬 WhatsApp] [📋 Compras] │
│ [✏️ Editar] [🗑 Excluir]                 │
└─────────────────────────────────────────┘
```

### Funcionalidades do card
- Avatar/baseado nas iniciais do fornecedor (igual ao padrão do CRM)
- Ícone/emoji personalizado por fornecedor
- Botão **🌐 Abrir Site** → abre o site em nova aba
- Botão **💬 WhatsApp** → link direto `https://wa.me/5562xxxxxxxx`
- Botão **📋 Ver Lista de Compras** → filtra os itens de compra deste fornecedor
- Botão **✏️ Editar** → abre formulário de edição
- Botão **🗑 Excluir** → remove com confirmação
- **⭐ Favorito** → estrela dourada/preenchida

---

## 5. 🔍 Pesquisa de Fornecedor

### Problema
Não há busca para localizar fornecedores.

### Solução
Adicionar campo de busca no topo da lista de fornecedores:

```
🔍 Buscar fornecedor...
```

### Critérios de busca (deve pesquisar em)
1. Nome do fornecedor
2. Nome da empresa
3. Telefone (qualquer um)
4. Instagram
5. Cidade

### Funcionalidade
- Busca em tempo real (conforme digita)
- Filtra a lista exibida
- Se não encontrar, mostrar "Nenhum fornecedor encontrado"
- Dica: usar o mesmo padrão de `cat-search-wrap` da Central de Organização

---

## 6. ⭐ Favoritos

### Problema
Não há como destacar fornecedores importantes.

### Solução
Adicionar estrela ⭐ em cada card de fornecedor:

```
⭐ Viper Eletrônicos
⭐ Cícero Acessórios  
⭐ Importadora Goiás
```

### Regras
- Campo `favorito: true/false` no Firestore
- Fornecedores favoritos aparecem **primeiro** na lista
- Estrela dourada/preenchida quando favorito, vazia quando não
- Ordenação: favoritos primeiro, depois ordem alfabética

---

## 7. 💬 Link Direto para WhatsApp

### Problema
Para contatar um fornecedor é preciso copiar o número manualmente.

### Solução
Adicionar botão **💬 WhatsApp** em cada card de fornecedor:

```javascript
// Ao clicar, abrir:
window.open(`https://wa.me/55${whatsapp}`, '_blank');
```

- Usar o número de WhatsApp cadastrado (se houver)
- Fallback para Telefone 1 se WhatsApp não estiver preenchido
- Abrir em nova aba
- Exemplo: `https://wa.me/5562984363148`

---

## 8. 📊 Dashboard de Compras

### Problema
Não há visão geral do status das compras e fornecedores.

### Solução
Criar um dashboard no topo do módulo com 4 cards estatísticos:

```
┌──────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ 📦       │ │ ✅       │ │ 🏢       │ │ ⭐       │ │
│ │    12    │ │    45    │ │     8    │ │     3    │ │
│ │ Pendentes│ │ Comprados│ │  Forn.   │ │ Favoritos│ │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└──────────────────────────────────────────────────────┘
```

### Estatísticas
1. **📦 Itens Pendentes** → Total de itens na lista de compras não comprados
2. **✅ Itens Comprados** → Total de itens já comprados/marcados como feitos
3. **🏢 Total de Fornecedores** → Quantidade de fornecedores cadastrados
4. **⭐ Favoritos** → Quantidade de fornecedores marcados como favoritos

---

## 📂 Estrutura Final do Módulo

### Abas
| Aba | Conteúdo |
|-----|----------|
| 🏢 **Fornecedores** | Lista de fornecedores cadastrados (NOVO) |
| 🛒 **Lista de Compras** | Lista de compras atual (MELHORADO) |
| ⚠️ **Estoque Baixo** | Itens com estoque crítico (EXISTENTE) |
| 📈 **Mercado** | Tendências de mercado (EXISTENTE) |

### Novas Coleções Firestore
```javascript
fornecedores/{id}  // Cadastro de fornecedores (NOVA)
fornecedor_compras/{id}  // Lista de compras (EXISTENTE)
fornecedor_tendencias/{id}  // Tendências (EXISTENTE)
estoque_produtos/{id}  // Estoque (EXISTENTE)
```

---

## 🎯 Resultado Esperado

O módulo deixará de ser apenas uma lista de compras e passará a ser um **verdadeiro CRM de fornecedores**, armazenando:

- ✅ Contatos completos (telefone, WhatsApp, Instagram)
- ✅ Endereço e localização
- ✅ Observações e histórico
- ✅ Favoritos (⭐)
- ✅ Acesso rápido ao WhatsApp
- ✅ Estatísticas do dashboard
- ✅ Integração com a lista de compras

Facilitando localizar rapidamente qualquer distribuidor quando precisar fazer reposição de estoque.

---

## 🔗 Dependências e Referências

### Sistemas existentes para参考
- **Central de Organização** (`CRM/pages/central-organizacao/`) — cadastro com formulários, cards, busca, cores
- **Módulo OS** (`CRM/pages/os/`) — estrutura de cards com avatar, badges
- **Favoritos global** (`CRM/shared/favoritos.js`) — sistema de `cc-favoritos-changed` e Firestore

### Scripts compartilhados
- `CRM/shared/brand-header.js` — barra superior
- `CRM/shared/favoritos.js` — sistema de favoritos (já importado)
- `CRM/scripts/firebase.js` — Firestore SDK
- `CRM/shared/session.js` — identificação de usuário

---

*Relatório gerado em 17/06/2026 — Cell City Informática*
