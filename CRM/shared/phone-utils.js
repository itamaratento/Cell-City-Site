/* ============================================================
   PHONE-UTILS — fonte única de verdade para telefone no CRM
   ------------------------------------------------------------
   Problema que este módulo resolve: cada tela (os.js, portal.js,
   crm-comercial, importar.js) tinha sua própria função de máscara,
   e a de os.js montava sempre "(XX) XXXXX-XXXX" (5-4) mesmo quando
   o número só tinha 10 dígitos — gerando máscaras quebradas tipo
   "(61) 91071-912" que nenhuma consulta do Portal conseguia casar.

   Regra única a partir de agora:
   - `phoneDigits` (só dígitos, 10 ou 11) é o campo CANÔNICO, usado
     em TODAS as consultas/joins/doc-IDs.
   - `phone` (com máscara) é só para EXIBIÇÃO — nunca usar em where()
     ou como doc-ID novamente.
   ============================================================ */

// Máscara "ao vivo" (progressiva) — usada em inputs, enquanto o usuário
// ainda está digitando. NÃO insere o 9º dígito automaticamente: só
// ajusta o agrupamento (4-4 até 10 dígitos, 5-4 ao completar o 11º).
export function maskPhone(input) {
  const d = String(input == null ? '' : input).replace(/\D/g, '').slice(0, 11);
  if (d.length > 10) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length > 6)  return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length > 2)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length > 0)  return `(${d}`;
  return d;
}

// Dígitos canônicos — usar ao SALVAR (não durante a digitação), nunca
// durante o `oninput` do formulário. Remove tudo que não é dígito,
// tira o "55" de DDI se sobrar 12/13 dígitos, e — só quando o número
// tem exatamente 10 dígitos e a parte local começa em 6-9 (faixa
// exclusiva de celular no Brasil desde 2016, fixo nunca começa aí) —
// insere o 9º dígito que ficou faltando.
export function normalizePhoneDigits(input) {
  let d = String(input == null ? '' : input).replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 10 && /^[6-9]/.test(d.slice(2))) {
    d = d.slice(0, 2) + '9' + d.slice(2);
  }
  return d.slice(0, 11);
}

// Atalho: dígitos canônicos + máscara correspondente, para gravar os
// dois campos (`phone` e `phoneDigits`) de uma vez ao salvar um registro.
export function canonicalizePhone(input) {
  const phoneDigits = normalizePhoneDigits(input);
  return { phone: maskPhone(phoneDigits), phoneDigits };
}

// Usado SOMENTE pelo script de migração de dados legados, para localizar
// registros antigos gravados com máscara/contagem de dígitos divergente
// (antes da padronização). Não usar em código novo — consultas novas
// devem comparar `phoneDigits` diretamente, sem precisar de variantes.
export function legacyPhoneVariants(input) {
  const raw = String(input == null ? '' : input).replace(/\D/g, '');
  if (raw.length < 8) return [];
  const variants = new Set();
  const add = (d) => { if (d && d.length >= 8) { variants.add(d); variants.add(maskPhone(d)); } };
  add(raw);
  add(normalizePhoneDigits(raw));
  if (raw.length === 11 && raw[2] === '9') add(raw.slice(0, 2) + raw.slice(3));
  else if (raw.length === 10) add(raw.slice(0, 2) + '9' + raw.slice(2));
  return [...variants];
}
