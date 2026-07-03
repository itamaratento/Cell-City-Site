// Anonimização determinística para o seed do ambiente DEV (Fase 3).
// Determinística = o mesmo valor original sempre vira o mesmo valor anonimizado,
// preservando relacionamentos entre coleções (ex.: clientes.name e os.clientName
// do mesmo cliente ficam consistentes entre si no DEV).
// Não reversível: usa hash (SHA-256 + salt), não apenas máscara/embaralhamento.
import { createHash } from 'crypto';
import { maskPhone, normalizePhoneDigits } from '../CRM/shared/phone-utils.js';

const SALT = 'cellcity-dev-seed-2026-07-03';

function hash(input) {
  return createHash('sha256').update(SALT + String(input)).digest('hex');
}

// Campos de telefone encontrados no levantamento da Fase 3 (2 convenções de nome
// coexistem no projeto: phone/phoneDigits em clientes+os; telefone/telefoneDigits
// em mensagens_portal/pendencias/crm_leads).
const CAMPOS_TELEFONE_DIGITS = ['phoneDigits', 'telefoneDigits'];
const CAMPOS_TELEFONE_MASCARA = ['phone', 'telefone'];
const CAMPOS_NOME = ['name', 'nome', 'clientName'];
// Dados de desbloqueio de aparelho — não é PII de cliente no sentido do pedido
// (sobrenome/telefone), mas é segredo real do cliente sem função nenhuma no DEV.
// Removidos por padrão; ver relatório de encerramento da Fase 3.
const CAMPOS_SEGREDO_APARELHO = ['password', 'senha', 'patternSequence', 'lockPhoto'];

export function telefoneAnonimizado(digitsOriginais) {
  const d = normalizePhoneDigits(digitsOriginais);
  if (!d) return d;
  const h = hash(d).replace(/[^0-9]/g, '');
  const local = (h + '00000000').slice(0, 8);
  return `619${local}`.slice(0, 11); // DDD fixo fictício (61) + 9 + 8 dígitos derivados do hash
}

export function nomeAnonimizado(nomeOriginal) {
  const partes = String(nomeOriginal ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return nomeOriginal;
  const primeiro = partes[0];
  if (partes.length === 1) return primeiro;
  const sufixo = hash(partes.slice(1).join(' ')).slice(0, 6);
  return `${primeiro} Anon${sufixo}`;
}

// Aplica a anonimização em qualquer documento, por nome de campo — não depende
// de mapear cada coleção manualmente, cobre denormalizações que eu não previ.
export function anonimizarDocumento(doc) {
  const out = { ...doc };
  for (const campo of CAMPOS_TELEFONE_DIGITS) {
    if (typeof out[campo] === 'string' && out[campo]) out[campo] = telefoneAnonimizado(out[campo]);
  }
  for (const campo of CAMPOS_TELEFONE_MASCARA) {
    if (typeof out[campo] === 'string' && out[campo]) out[campo] = maskPhone(telefoneAnonimizado(out[campo]));
  }
  for (const campo of CAMPOS_NOME) {
    if (typeof out[campo] === 'string' && out[campo]) out[campo] = nomeAnonimizado(out[campo]);
  }
  for (const campo of CAMPOS_SEGREDO_APARELHO) {
    if (campo in out) out[campo] = null;
  }
  return out;
}
