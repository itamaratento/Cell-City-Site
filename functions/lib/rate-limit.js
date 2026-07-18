/* ============================================================
   RATE LIMITER — in-memory sliding window

   Rate limiting (P0 2026-07-15): 15/16 funções são públicas (apenas
   phoneDigits como prova de identidade). O rate limiter abaixo reduz
   o risco de abuso automatizado — sem depender de SMS OTP ou outro
   fator externo. App Check completo exigiria SDK no frontend e está
   documentado como melhoria futura (P1).
   ============================================================ */
const { HttpsError } = require('firebase-functions/v2/https');

// Em runtime serverless (Cloud Functions), cada instância tem sua
// própria memória. Isto não é um rate limiter distribuído — na
// prática, requisições simultâneas podem ser distribuídas entre
// instâncias diferentes. Ainda assim, eleva o custo do abusador
// (cada nova instância precisa aquecer o cache) e bloqueia surtos
// dentro de uma mesma instância.
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minuto

function rateLimitKey(tipo, valor) {
  return `${tipo}:${valor}`;
}

function rateLimitCheck(tipo, valor, maxRequests) {
  if (!valor) return; // sem chave = sem rate limit (não deve ocorrer)
  const key = rateLimitKey(tipo, valor);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = [];
    rateLimitStore.set(key, entry);
  }

  // Remove timestamps fora da janela
  while (entry.length > 0 && entry[0] < windowStart) {
    entry.shift();
  }

  if (entry.length >= maxRequests) {
    const retryAfter = Math.ceil((entry[0] + RATE_LIMIT_WINDOW_MS - now) / 1000);
    throw new HttpsError('resource-exhausted',
      `Muitas requisições. Aguarde ${retryAfter}s antes de tentar novamente.`);
  }

  entry.push(now);

  // Limpeza periódica: a cada 100 chaves, varre o Map inteiro
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore) {
      while (v.length > 0 && v[0] < windowStart) v.shift();
      if (v.length === 0) rateLimitStore.delete(k);
    }
  }
}

// Limites por operação
const LIMITES = {
  leitura:   { ip: 60, telefone: 30 },   // consultas
  escrita:  { ip: 20, telefone: 10 },   // criar/responder
  evento:   { ip: 30, telefone: 15 },   // tracking só aceita 3 tipos
  // Resposta à Auditoria Técnica Independente 2026-07-17 (achado S2):
  // consultarOSPublica é a única function pública sem NENHUMA prova de
  // posse além do osId (sequencial/previsível) — o limite genérico de
  // 'leitura' (60/min/IP) permite raspar toda a base de OS em poucos
  // dias. Sem quebrar os links de garantia já emitidos (só têm ?id=,
  // decisão do dono de não exigir prova de posse adicional agora), o
  // limite específico abaixo eleva bastante o custo de uma enumeração
  // sequencial, mantendo folga confortável para o uso legítimo (cliente
  // abrindo a própria garantia, no máximo algumas vezes por minuto).
  consulta_os_publica: { ip: 5, telefone: 5 },
  // FASE 4.1: enumeração por osId sequencial — limite ainda mais baixo.
  // PoP forte / publicToken opaco = médio prazo (não quebra links ?id=).
};

function aplicarRateLimit(request, tipoOperacao) {
  // IP do caller (pode ser IPv4 ou IPv6)
  const ip = request.rawRequest?.ip
    || request.rawRequest?.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || 'unknown';

  const limites = LIMITES[tipoOperacao] || LIMITES.leitura;

  rateLimitCheck('ip', ip, limites.ip);

  // Se a requisição tem phoneDigits, aplica limite também por telefone
  const phoneDigits = request.data && request.data.phoneDigits;
  if (phoneDigits && typeof phoneDigits === 'string' && phoneDigits.length >= 10) {
    rateLimitCheck('tel', phoneDigits, limites.telefone);
  }
}

function clearRateLimitStore() {
  rateLimitStore.clear();
}

module.exports = { aplicarRateLimit, clearRateLimitStore, LIMITES };

