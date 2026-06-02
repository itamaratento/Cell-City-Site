# 🔍 VERIFICAÇÃO — Carregamento de Mensagens Pós-venda

## ⚠️ IMPORTANTE

As mensagens **NÃO aparecem visualmente** nos cards. Elas são carregadas **internamente** no JavaScript e usadas quando você clica nos botões.

**Fluxo:**
1. ✅ Mensagens carregadas do Firestore (background)
2. ✅ Armazenadas em `window.mensagensPosvenda`
3. ✅ Usadas quando você clica em "Copiar Mensagem" ou "Copiar Tudo"

---

## 🔧 PASSO A PASSO — VERIFICAÇÃO

### PASSO 1: Inicializar Mensagens (se não fez ainda)

1. Abra o Pós-venda
2. Abra o Console (F12 → Console)
3. Cole este comando:

```javascript
import('./CRM/scripts/init-posvenda-mensagens.js').then(m => m.inicializarMensagensPosvenda());
```

4. Pressione Enter
5. Você deve ver 3 mensagens:
   - ✅ Mensagem para 5 dias criada
   - ✅ Mensagem para 15 dias criada
   - ✅ Mensagem para 30 dias criada
   - ✅ Inicialização concluída!

**Se isso não aparecer → PROBLEMA 1 (ver abaixo)**

---

### PASSO 2: Verificar Firestore

1. Abra [Firebase Console](https://console.firebase.google.com)
2. Selecione projeto `cellcity-crm`
3. Vá para **Firestore Database**
4. Procure coleção **`posvenda_mensagens`**
5. Deve ter 3 documentos com IDs:
   - `5`
   - `15`
   - `30`
6. Cada um deve ter campo `mensagem` com texto

**Se não encontrar → PROBLEMA 1 (executar init)**

---

### PASSO 3: Verificar Carregamento no JavaScript

1. Abra Pós-venda (CRM → Pós-venda)
2. Abra Console (F12 → Console)
3. Digite:

```javascript
window.mensagensPosvenda
```

4. Você deve ver um objeto com 3 propriedades:

```javascript
{
  5: "Olá {{nome}}, como está o funcionamento...",
  15: "Olá {{nome}}, estamos com uma oferta especial...",
  30: "Olá {{nome}}, sua garantia está perto do fim..."
}
```

**Se mostrar `undefined` → PROBLEMA 2 (ver abaixo)**

**Se mostrar `{ 5: '', 15: '', 30: '' }` (vazio) → PROBLEMA 1**

---

### PASSO 4: Testar Botão "Copiar Mensagem"

1. Na aba Pós-venda, localize um cliente pendente
2. Clique no botão **💬 Mensagem**
3. Você deve ver toast: **"✅ Mensagem copiada"**
4. Abra um editor de texto e pressione Ctrl+V
5. Você deve ver a mensagem completa com nome e modelo substituídos

**Exemplo do que deve colar:**
```
Olá João Silva, como está o funcionamento do iPhone 12? Precisa de ajuda?
```

**Se não colar nada ou colar vazio → PROBLEMA 3 (ver abaixo)**

---

### PASSO 5: Testar Atalho "N" (Copiar Tudo)

1. Passe o mouse sobre um cliente (card em hover)
2. Pressione a tecla **N**
3. Você deve ver toast: **"✅ Telefone + mensagem copiados"**
4. Abra um editor de texto e pressione Ctrl+V
5. Você deve ver:

```
João Silva
(62) 98111-1111

Olá João Silva, como está o funcionamento do iPhone 12? Precisa de ajuda?
```

**Se não funcionar → PROBLEMA 2 ou 4 (ver abaixo)**

---

## 🔴 PROBLEMAS E SOLUÇÕES

### PROBLEMA 1: Mensagens não foram criadas no Firestore

**Sintomas:**
- Firebase Console mostra coleção vazia
- Console JavaScript mostra `undefined` ou valores vazios

**Solução:**
1. Abra Pós-venda
2. Abra Console (F12)
3. Execute:
```javascript
import('./CRM/scripts/init-posvenda-mensagens.js').then(m => m.inicializarMensagensPosvenda());
```
4. Aguarde as 3 mensagens de sucesso
5. Recarregue a página (F5)

---

### PROBLEMA 2: Mensagens não carregam no JavaScript

**Sintomas:**
- Firebase Console tem dados
- Mas `window.mensagensPosvenda` é `undefined`
- Botões não funcionam

**Solução:**
1. Recarregue a página (F5)
2. Aguarde 2-3 segundos
3. Verifique novamente: `window.mensagensPosvenda`
4. Se continuar undefined, verifique Console (F12 → Console) para erros

---

### PROBLEMA 3: Copiar Mensagem copia vazio

**Sintomas:**
- Toast mostra "✅ Mensagem copiada"
- Mas clipboard fica vazio

**Solução:**
1. Verifique `window.mensagensPosvenda` (PASSO 3)
2. Se estiver vazio, execute init novamente (PROBLEMA 1)
3. Se estiver OK, pode ser erro de substituição de placeholders

---

### PROBLEMA 4: Atalhos (V, B, N) não funcionam

**Sintomas:**
- Clico em botões e funciona
- Mas atalhos de teclado não respondem

**Solução:**
1. Verifique se está com mouse sobre o card (hover)
2. Verifique se não está focado em um input
3. Recarregue a página (F5)
4. Teste novamente

---

## 🧪 TESTE AUTOMÁTICO

Abra este arquivo no browser para teste automático:

```
http://localhost:5000/CRM/pages/pos-venda/DEBUG_MENSAGENS.html
```

Clique em **"▶️ Testar Carregamento de Mensagens"** para diagnóstico automático.

---

## ✅ CHECKLIST FINAL

Todos os itens abaixo devem estar ✅:

- [ ] Firestore tem coleção `posvenda_mensagens`
- [ ] Coleção tem 3 documentos (5, 15, 30)
- [ ] Cada documento tem campo `mensagem` preenchido
- [ ] `window.mensagensPosvenda` tem 3 propriedades
- [ ] Cada propriedade tem texto (não vazio)
- [ ] Botão "Copiar Mensagem" funciona
- [ ] Atalho "N" funciona
- [ ] Toast mostra confirmação
- [ ] Clipboard recebe dados

**Se todos os itens estão ✅ → TUDO OK!**

---

## 📞 SUPORTE

Se ainda tiver problemas:

1. Compartilhe a saída do teste automático (DEBUG_MENSAGENS.html)
2. Compartilhe os logs do Console (F12 → Console)
3. Compartilhe screenshot do Firebase Console mostrando os dados

