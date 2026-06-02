# 🔗 INSTRUÇÕES DE INTEGRAÇÃO COM O CRM

## 📋 VISÃO GERAL

O site agora possui dois novos links que redirecionam para funcionalidades do CRM:

```
Cliente acessa: https://www.cellcityinformatica.com.br/autoatendimento
                ↓ (redirecionamento transparente via firebase.json)
Sistema carrega: /autoatendimento.html
                ↓ (JavaScript redireciona para CRM)
CRM abre: /CRM/public/abrir-atendimento.html
```

---

## ✅ O QUE FUNCIONA AUTOMATICAMENTE

### 1. Banco de Dados Compartilhado

✅ **Firestore é compartilhado** entre site e CRM
- Ambos usam o mesmo projeto Firebase
- Coleção `pre_os` recebe dados de ambos
- Sem duplicação de dados

### 2. Autenticação

✅ **Mesmo Firebase Auth** para ambos
- Mesmas credenciais
- Mesmas regras de segurança
- Regras em `firestore.rules`

### 3. Fluxo de Dados

```
Cliente preenche formulário em /autoatendimento
         ↓
Dados são salvos em Firestore (coleção: pre_os)
         ↓
CRM vê o novo pré-OS em tempo real
         ↓
Técnico clica em "Converter em OS"
         ↓
OS é criada com os dados do pré-OS
```

---

## 🔐 SEGURANÇA - CAMINHOS OCULTOS

### URLs Públicas (Amigáveis)
```
https://www.cellcityinformatica.com.br/autoatendimento
https://www.cellcityinformatica.com.br/consultar-os
```

### URLs Internas (Ocultas)
```
/CRM/public/abrir-atendimento.html    ← Cliente NÃO vê isso
/CRM/pages/autoatendimento/           ← Cliente NÃO vê isso
```

### Como Funciona

```
firebase.json → Detecta /autoatendimento
           ↓
           → Serve /autoatendimento.html (página intermediária)
           ↓
           → JavaScript redireciona para /CRM/public/abrir-atendimento.html
           ↓
           → Cliente nunca vê caminho interno do CRM
```

---

## 🔄 FLUXO COMPLETO

### Fluxo 1: Cliente abre Autoatendimento via Site

```
1. Cliente clica em "📱 Abrir Atendimento" no site
   ↓
2. Link: /autoatendimento
   ↓
3. Firebase redireciona: /autoatendimento.html
   ↓
4. Página mostra spinner "Carregando..."
   ↓
5. JavaScript redireciona para: /CRM/public/abrir-atendimento.html
   ↓
6. Formulário de Autoatendimento aparece
   ↓
7. Cliente preenche dados (nome, whatsapp, aparelho, problema, etc)
   ↓
8. Clica em "ENVIAR"
   ↓
9. Dados são salvos no Firestore (coleção: pre_os)
```

### Fluxo 2: CRM recebe o pré-OS

```
1. Desenvolvedor/Técnico acessa: /CRM/pages/autoatendimento/index.html
   ↓
2. CRM carrega listener em tempo real do Firestore
   ↓
3. Novo pré-OS aparece na aba "Autoatendimento"
   ↓
4. Técnico clica em "CONVERTER EM OS"
   ↓
5. Dados são importados para formulário de criação de OS
   ↓
6. OS é criada com pré-preenchimento
   ↓
7. Técnico ajusta se necessário e salva
   ↓
8. OS entra no fluxo normal de atendimento
```

---

## 📊 BANCO DE DADOS - COLEÇÃO PRE_OS

### Estrutura de Documento

```javascript
{
  id: "PRE-20260602-001",
  cliente: {
    nome: "João Silva",
    whatsapp: "11999999999",
    cpf: "123.456.789-00"
  },
  aparelho: {
    marca: "iPhone",
    modelo: "13"
  },
  problema: "Tela com riscos",
  estado_aparelho: ["tela_quebrada", "sem_riscos"],
  acessorios: ["capa", "carregador"],
  origem_cliente: "google",
  senha: "1234",
  imei: "123456789012345",
  observacoes: "...",
  status: "AGUARDANDO_CONVERSAO",
  origem: "Autoatendimento",
  criadoEm: serverTimestamp(),
  criadoEmISO: "2026-06-02T14:30:00Z",
  osId: null
}
```

### Campos Importantes

| Campo | Origem | Descrição |
|-------|--------|-----------|
| `id` | Sistema | ID único do pré-OS |
| `cliente` | Formulário | Dados do cliente |
| `aparelho` | Formulário | Marca e modelo |
| `problema` | Formulário | Descrição do problema |
| `status` | Sistema | "AGUARDANDO_CONVERSAO" ou "CONVERTIDA" |
| `origem` | Sistema | "Autoatendimento" ou "CRM" |
| `osId` | Sistema | ID da OS quando convertida |

---

## 🛠️ CONFIGURAÇÕES NECESÁRIAS

### Nenhuma configuração adicional necessária!

✅ **Firestore está compartilhado** entre site e CRM
✅ **Regras de segurança** já estão configuradas (firestore.rules)
✅ **Coleção `pre_os`** já existe no Firestore
✅ **CRM módulo Autoatendimento** já está desenvolvido

---

## ⚡ VERIFICAR INTEGRAÇÃO

### Teste 1: Verificar Firestore

```
1. Acesse Firebase Console
2. Projeto: cellcity-crm
3. Firestore Database
4. Procure por coleção: pre_os
5. Deve existir e estar vazia (aguardando primeiros pré-OS)
```

### Teste 2: Verificar Firestore Rules

```
1. Firebase Console
2. Firestore Database → Rules
3. Deve conter regras para:
   - Leitura de pré_os
   - Escrita de pré_os
   - Status AGUARDANDO_CONVERSAO
```

### Teste 3: Pré-OS com sucesso

```
1. Acesse: https://www.cellcityinformatica.com.br/autoatendimento
2. Preencha o formulário
3. Clique em "ENVIAR"
4. Deve aparecer mensagem de sucesso
5. Verifique Firestore → pré-OS deve estar lá
6. Acesse CRM → aba Autoatendimento → deve aparecer
```

---

## 🚨 TROUBLESHOOTING

### Problema 1: Pré-OS não aparece no CRM

**Causa:** Firestore não está compartilhado ou regras bloqueiam escrita

**Solução:**
```
1. Verificar firebase.json no site e CRM (mesmo projeto)
2. Verificar firestore.rules (permissões para pré_os)
3. Limpar cache do navegador
4. Tentar novamente
```

### Problema 2: Redirecionamento não funciona

**Causa:** Cache do navegador ou JavaScript desabilitado

**Solução:**
```
1. Limpar cache (Ctrl+Shift+Delete)
2. Testar em modo incógnito
3. Verificar console do navegador (F12)
4. Verificar se /autoatendimento.html existe
```

### Problema 3: Dados não salvam no Firestore

**Causa:** Regras de firestore.rules bloqueiam ou autenticação falha

**Solução:**
```
1. Verificar se usuário está autenticado
2. Verificar firestore.rules
3. Testes de permissão em Firebase Console
4. Verificar logs de erro (Firebase Console → Functions)
```

---

## 📝 CHECKLIST DE INTEGRAÇÃO

- [ ] Arquivo `index.html` atualizado com menu novo
- [ ] Arquivo `autoatendimento.html` criado
- [ ] Arquivo `consultar-os.html` criado
- [ ] Arquivo `firebase.json` atualizado com rewrites
- [ ] Commit feito com mensagem descritiva
- [ ] Push para GitHub
- [ ] Deploy realizado (aguarde 3-5 minutos)
- [ ] Testes de URLs realizados:
  - [ ] /autoatendimento abre corretamente
  - [ ] /consultar-os abre corretamente
  - [ ] Menu buttons funcionam
- [ ] Formulário de Autoatendimento funciona:
  - [ ] Dados são salvos no Firestore
  - [ ] Aparecem no CRM
  - [ ] Conversão para OS funciona
- [ ] Nenhuma alteração no CRM existente
- [ ] Nenhuma alteração em Financeiro, Caixa, Lucro, Estoque, Garantias

---

## ✅ PRONTO PARA PRODUÇÃO

Após completar todos os testes, a integração está pronta!

```
https://www.cellcityinformatica.com.br/autoatendimento
                    ↓
        Formulário de Autoatendimento
                    ↓
        Dados salvos em Firestore
                    ↓
        CRM vê novo pré-OS
                    ↓
        Técnico converte em OS
                    ↓
        Fluxo normal de atendimento
```

---

**Data:** 2 de junho de 2026  
**Versão:** 1.0  
**Status:** Pronto para implementação
