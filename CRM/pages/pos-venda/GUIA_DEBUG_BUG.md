# 🔴 GUIA DE DEBUG — Bug "Copiar Mensagem"

## ⚠️ PROBLEMA

Ao clicar em **💬 Copiar Mensagem**, o sistema copia apenas:
```
Marivalda
(62) XXXXX-XXXX
```

Em vez de copiar a mensagem completa:
```
Olá Marivalda!

A Cell City Informática agradece pela confiança...
[mensagem completa]
```

---

## 🔍 COMO DEBUGAR

### TESTE 1: Diagnóstico Automático Completo

**Arquivo:** `DIAGNOSTICO_BUG.html`

1. Abra no browser:
   ```
   http://localhost:5000/CRM/pages/pos-venda/DIAGNOSTICO_BUG.html
   ```

2. Aguarde o carregamento automático

3. Você verá 5 seções:
   - ✅ **1. Firestore** — existem documentos com mensagens?
   - ✅ **2. JavaScript** — as mensagens foram carregadas?
   - ✅ **3. Função** — a função copiarMensagem funciona?
   - ✅ **4. Teste Prático** — o botão está acessível?
   - ✅ **5. Resumo Final** — tudo OK ou há problema?

4. **Procure por linhas ❌ (erro)**

---

### TESTE 2: Teste Real do Clipboard

**Arquivo:** `TEST_CLIPBOARD.html`

1. Abra no browser:
   ```
   http://localhost:5000/CRM/pages/pos-venda/TEST_CLIPBOARD.html
   ```

2. Clique em **"▶️ Simular Clique no Botão 💬 Copiar"**
   - Mostra exatamente o que DEVERIA ser copiado

3. Clique em **"▶️ Clicar em 💬 Copiar (primeiro card)"**
   - Clica automaticamente no botão real
   - Cole na textarea para ver o que foi copiado

4. Compare:
   - **Esperado:** Mensagem completa
   - **Recebido:** O que realmente foi copiado

---

### TESTE 3: Console do Browser (Manual)

1. Abra a página de **Pós-venda** (normal)

2. Abra **DevTools** (F12 → Console)

3. Cole este código:

```javascript
// Verificar Firestore
console.log('=== FIRESTORE ===');
console.log(window.mensagensPosvenda);

// Verificar função
console.log('\n=== FUNÇÃO ===');
if (window.pendentes[5] && window.pendentes[5].length > 0) {
    const os = window.pendentes[5][0];
    const msg = window.mensagensPosvenda[5];
    const processed = msg.replace('{{nome}}', os.clientName).replace('{{modelo}}', os.model);
    
    console.log('OS:', os.osId);
    console.log('Cliente:', os.clientName);
    console.log('Mensagem processada:', processed);
}
```

4. Observar o que aparece

---

## 🔴 POSSÍVEIS CAUSAS

### CAUSA 1: Mensagens não foram criadas no Firestore

**Sintoma:** 
- Firestore vazio ou documentos sem dados
- `window.mensagensPosvenda` = `{ 5: '', 15: '', 30: '' }`

**Solução:**
```javascript
import('./CRM/scripts/init-posvenda-mensagens.js').then(m => m.inicializarMensagensPosvenda());
```

---

### CAUSA 2: Função copiarMensagem está recebendo dados errados

**Sintoma:**
- Firestore tem dados
- `window.mensagensPosvenda` está OK
- Mas função recebe mensagem vazia

**Verificação:**
Adicione log à função no console:

```javascript
// Simular clique
const card = document.querySelector('.pv-card');
const prazo = parseInt(card.dataset.prazo);
const os = window.pendentes[prazo].find(o => o.osId === card.dataset.osid);

console.log('Prazo:', prazo);
console.log('OS:', os);
console.log('Mensagem raw:', window.mensagensPosvenda[prazo]);
console.log('Mensagem processada:', 
    window.mensagensPosvenda[prazo]
        .replace('{{nome}}', os.clientName)
        .replace('{{modelo}}', os.model)
);
```

---

### CAUSA 3: Botão está chamando função errada

**Sintoma:**
- Copia apenas nome + telefone (dados do card)
- Não copia mensagem

**Verificação:**
Verifique o HTML do botão no DevTools:

1. Abra DevTools (F12)
2. Clique em "Inspecionar elemento" (ou Ctrl+Shift+C)
3. Clique no botão 💬 Copiar
4. Procure por: `class="pv-copy-btn"`
5. Verifique se tem `onclick` atribuído incorretamente

**Possível erro no código:**
Se o código tiver algo assim está ERRADO:
```javascript
// ❌ ERRADO - copia apenas nome + telefone
let texto = `${nome}\n${phone}`;
navigator.clipboard.writeText(texto);
```

**Correto deve ser:**
```javascript
// ✅ CORRETO - copia a mensagem completa
let msg = mensagensPosvenda[prazo];
msg = msg.replace('{{nome}}', nome).replace('{{modelo}}', modelo);
navigator.clipboard.writeText(msg);
```

---

### CAUSA 4: Estrutura de dados diferente

**Sintoma:**
- Mensagens foram criadas mas com campo diferente

**Verificação:**
No Firebase Console:
1. Vá para Firestore Database
2. Abra coleção `posvenda_mensagens`
3. Clique em documento `5`
4. **Procure pelo nome do campo**
   - Deve ser exatamente: `mensagem`
   - NÃO deve ser: `mensagem5`, `msg`, `text`, etc.

---

## 📋 CHECKLIST DE DEBUG

Execute nesta ordem:

- [ ] **Teste 1:** Abra `DIAGNOSTICO_BUG.html`
  - [ ] Firestore: ✅ ou ❌?
  - [ ] JavaScript: ✅ ou ❌?
  - [ ] Função: ✅ ou ❌?

- [ ] **Teste 2:** Abra `TEST_CLIPBOARD.html`
  - [ ] Simular: mostra mensagem completa?
  - [ ] Real: o que foi copiado?
  - [ ] Compare: esperado vs recebido

- [ ] **Verificação Manual:** Console
  - [ ] `window.mensagensPosvenda` tem dados?
  - [ ] Dados não estão vazios?
  - [ ] Função consegue substituir {{nome}}?

---

## 📸 INFORMAÇÕES PARA RELATAR

Se encontrar o erro, compartilhe:

1. **Screenshot de DIAGNOSTICO_BUG.html**
   - Todas as 5 seções

2. **Output do console** (F12 → Console)
   - O que aparece quando executa os logs

3. **Screenshot do Firebase Console**
   - Mostrando a coleção `posvenda_mensagens`
   - Mostrando os documentos e campos

---

## 🆘 PRÓXIMOS PASSOS

1. **Execute os testes acima**
2. **Identifique qual linha está ❌**
3. **Compartilhe os resultados**
4. Eu vou analisar e **corrigir o bug**

---

**Data:** 2026-06-02  
**Bug Identificado:** Copiar Mensagem copia apenas cliente  
**Criticidade:** 🔴 ALTA — bloqueia funcionalidade principal
