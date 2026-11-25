// ===== LINK INTELIGENTE DA AGENDA — Helpers puros de parsing, formatação e deduplicação =====
// Lê parâmetros da URL via URLSearchParams (data, horario, titulo, descricao, lembrete),
// valida formatos, preserva acentuação/caracteres especiais e evita duplicações.

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Higieniza texto vindo de parâmetros de URL preservando acentuação UTF-8 e pontuação.
 * Remove apenas caracteres de controle invisíveis.
 */
export function limparTextoSeguro(valor, { multilinhas = false, max = 1000 } = {}) {
  if (valor === null || valor === undefined) return '';
  let txt = String(valor)
    .replace(/\r\n?/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  if (!multilinhas) {
    txt = txt.replace(/\n+/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
  } else {
    txt = txt
      .split('\n')
      .map((linha) => linha.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return txt.length > max ? txt.slice(0, max).trim() : txt;
}

/**
 * Interpreta datas nos formatos DD/MM/AAAA, DD-MM-AAAA, DD.MM.AAAA ou AAAA-MM-DD / AAAA/MM/DD.
 * Rejeita datas inexistentes no calendário (ex.: 31/02/2026, 99/99/2026).
 */
export function parseDataParam(raw) {
  const limpo = limparTextoSeguro(raw, { max: 40 });
  if (!limpo) return { valido: false, vazio: true, iso: '', br: '' };

  let ano = 0;
  let mes = 0;
  let dia = 0;

  const mIso = limpo.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const mBr = limpo.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);

  if (mIso) {
    ano = Number(mIso[1]);
    mes = Number(mIso[2]);
    dia = Number(mIso[3]);
  } else if (mBr) {
    dia = Number(mBr[1]);
    mes = Number(mBr[2]);
    ano = Number(mBr[3]);
  } else {
    return { valido: false, vazio: false, iso: '', br: '', erro: 'Formato de data inválido' };
  }

  if (ano < 1970 || ano > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return { valido: false, vazio: false, iso: '', br: '', erro: 'Data fora do intervalo válido' };
  }

  const dt = new Date(ano, mes - 1, dia);
  if (dt.getFullYear() !== ano || dt.getMonth() !== mes - 1 || dt.getDate() !== dia) {
    return { valido: false, vazio: false, iso: '', br: '', erro: 'Data inexistente no calendário' };
  }

  const iso = `${ano}-${pad2(mes)}-${pad2(dia)}`;
  const br = `${pad2(dia)}/${pad2(mes)}/${ano}`;
  return { valido: true, vazio: false, iso, br, ano, mesIndex: mes - 1, dia };
}

/**
 * Converte data ISO (AAAA-MM-DD) para DD/MM/AAAA.
 */
export function isoParaBr(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}

/**
 * Interpreta horários nos formatos HH:MM, H:MM, HH:MM:SS, HHhMM ou HHh.
 */
export function parseHorarioParam(raw) {
  const limpo = limparTextoSeguro(raw, { max: 20 });
  if (!limpo) return { valido: false, vazio: true, hora: '' };

  let hh = -1;
  let mm = -1;

  const mDoisPontos = limpo.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  const mLetraH = limpo.match(/^(\d{1,2})[hH](\d{2})?$/);

  if (mDoisPontos) {
    hh = Number(mDoisPontos[1]);
    mm = Number(mDoisPontos[2]);
  } else if (mLetraH) {
    hh = Number(mLetraH[1]);
    mm = mLetraH[2] ? Number(mLetraH[2]) : 0;
  } else {
    return { valido: false, vazio: false, hora: '', erro: 'Formato de horário inválido' };
  }

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return { valido: false, vazio: false, hora: '', erro: 'Horário fora do intervalo 00:00–23:59' };
  }

  return { valido: true, vazio: false, hora: `${pad2(hh)}:${pad2(mm)}` };
}

/**
 * Subtrai `minutosAntes` de um horário HH:MM (limitado a 00:00 no mesmo dia).
 */
export function calcularHoraAntecedencia(horaEvento, minutosAntes) {
  const p = parseHorarioParam(horaEvento);
  if (!p.valido) return '';
  const [h, m] = p.hora.split(':').map(Number);
  const total = Math.max(0, (h * 60 + m) - Math.max(0, Number(minutosAntes) || 0));
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

/**
 * Interpreta o parâmetro `lembrete` (ex.: "30 minutos antes.", "30", "15min", "1 hora antes", "08:30", "na hora", "sem lembrete").
 */
export function parseLembreteParam(raw, horaEvento = '') {
  const limpo = limparTextoSeguro(raw, { max: 160 });
  if (!limpo) {
    return {
      vazio: true,
      valido: true,
      texto: '',
      minutosAntes: null,
      horaAlerta: '',
      ativarDashboard: false,
    };
  }

  // Desativação explícita
  if (/^(nenhum|sem|sem\s+lembrete|nao|não|off|false|desativado)\.?$/i.test(limpo)) {
    return {
      vazio: false,
      valido: true,
      texto: 'Sem lembrete',
      minutosAntes: null,
      horaAlerta: '',
      ativarDashboard: false,
    };
  }

  // No horário exato do compromisso
  if (/^(0|0\s*min(?:uto)?s?(?:\s+antes)?|na\s+hora|no\s+hor[aá]rio(?:\s+do\s+(?:evento|compromisso))?|pontualmente)\.?$/i.test(limpo)) {
    const horaValida = parseHorarioParam(horaEvento);
    return {
      vazio: false,
      valido: true,
      texto: limpo === '0' ? 'No horário do evento' : limpo,
      minutosAntes: 0,
      horaAlerta: horaValida.valido ? horaValida.hora : '',
      ativarDashboard: true,
    };
  }

  // Horário fixo informado diretamente no lembrete (ex.: "08:30")
  if (/^\d{1,2}:\d{2}$/.test(limpo)) {
    const h = parseHorarioParam(limpo);
    if (!h.valido) {
      return {
        vazio: false,
        valido: false,
        texto: '',
        minutosAntes: null,
        horaAlerta: '',
        ativarDashboard: false,
        erro: 'Horário de lembrete inválido',
      };
    }
    return {
      vazio: false,
      valido: true,
      texto: `Às ${h.hora}`,
      minutosAntes: null,
      horaAlerta: h.hora,
      ativarDashboard: true,
    };
  }

  // Número puro = minutos antes (ex.: "30")
  const mNumeroPuro = limpo.match(/^(\d{1,4})$/);
  if (mNumeroPuro) {
    const min = Number(mNumeroPuro[1]);
    if (min > 1440) {
      return {
        vazio: false,
        valido: false,
        texto: '',
        minutosAntes: null,
        horaAlerta: '',
        ativarDashboard: false,
        erro: 'Antecedência de lembrete inválida',
      };
    }
    const rotulo = min === 1 ? '1 minuto antes' : `${min} minutos antes`;
    return {
      vazio: false,
      valido: true,
      texto: rotulo,
      minutosAntes: min,
      horaAlerta: horaEvento ? calcularHoraAntecedencia(horaEvento, min) : '',
      ativarDashboard: true,
    };
  }

  // Expressão em minutos (ex.: "30 minutos antes.", "15min", "45 min antes")
  const mMinutos = limpo.match(/(\d{1,4})\s*(?:min(?:uto)?s?|m)\b/i);
  if (mMinutos) {
    const min = Number(mMinutos[1]);
    if (min <= 1440) {
      return {
        vazio: false,
        valido: true,
        texto: limpo,
        minutosAntes: min,
        horaAlerta: horaEvento ? calcularHoraAntecedencia(horaEvento, min) : '',
        ativarDashboard: true,
      };
    }
  }

  // Expressão em horas (ex.: "1 hora antes", "2 horas antes", "1h")
  const mHoras = limpo.match(/(\d{1,2})\s*(?:hora?s?|h)\b/i);
  if (mHoras) {
    const min = Number(mHoras[1]) * 60;
    if (min <= 1440) {
      return {
        vazio: false,
        valido: true,
        texto: limpo,
        minutosAntes: min,
        horaAlerta: horaEvento ? calcularHoraAntecedencia(horaEvento, min) : '',
        ativarDashboard: true,
      };
    }
  }

  // Texto livre descritivo de lembrete
  const horaEv = parseHorarioParam(horaEvento);
  return {
    vazio: false,
    valido: true,
    texto: limpo,
    minutosAntes: null,
    horaAlerta: horaEv.valido ? horaEv.hora : '',
    ativarDashboard: true,
  };
}

function obterPrimeiroParam(params, chaves) {
  for (const chave of chaves) {
    if (params.has(chave)) return { presente: true, valor: params.get(chave) };
  }
  // Fallback case-insensitive para links gerados com inicial maiúscula (ex.: ?Data=...&Titulo=...)
  const mapaLower = new Map();
  for (const [k, v] of params.entries()) {
    const kl = k.toLowerCase();
    if (!mapaLower.has(kl)) mapaLower.set(kl, v);
  }
  for (const chave of chaves) {
    const kl = chave.toLowerCase();
    if (mapaLower.has(kl)) return { presente: true, valor: mapaLower.get(kl) };
  }
  return { presente: false, valor: '' };
}

/**
 * Lê os parâmetros da query string usando URLSearchParams.
 * Parâmetros suportados (e aliases compatíveis):
 *  - data (date, dia)
 *  - horario (hora, horário, time)
 *  - titulo (título, title, evento, assunto)
 *  - descricao (descrição, desc, description, obs, detalhes)
 *  - lembrete (alerta, reminder, aviso)
 */
export function lerLinkInteligente(searchString, fallbackDataIso = '') {
  const rawSearch = typeof searchString === 'string' ? searchString : '';
  let params;
  try {
    params = new URLSearchParams(rawSearch);
  } catch {
    return { ativo: false, avisos: ['URL com parâmetros malformados.'] };
  }

  const pData = obterPrimeiroParam(params, ['data', 'date', 'dia']);
  const pHora = obterPrimeiroParam(params, ['horario', 'hora', 'horário', 'time']);
  const pTit  = obterPrimeiroParam(params, ['titulo', 'título', 'title', 'evento', 'assunto']);
  const pDesc = obterPrimeiroParam(params, ['descricao', 'descrição', 'desc', 'description', 'obs', 'detalhes']);
  const pLemb = obterPrimeiroParam(params, ['lembrete', 'alerta', 'reminder', 'aviso']);

  const temAlgumParam = pData.presente || pHora.presente || pTit.presente || pDesc.presente || pLemb.presente;
  if (!temAlgumParam) {
    return { ativo: false, avisos: [] };
  }

  const avisos = [];
  const resData = parseDataParam(pData.valor);
  if (pData.presente && !resData.vazio && !resData.valido) {
    avisos.push('Data inválida no link; exibindo a data atual.');
  }

  const resHora = parseHorarioParam(pHora.valor);
  if (pHora.presente && !resHora.vazio && !resHora.valido) {
    avisos.push('Horário inválido no link foi ignorado.');
  }

  const titulo = limparTextoSeguro(pTit.valor, { multilinhas: false, max: 200 });
  const descricao = limparTextoSeguro(pDesc.valor, { multilinhas: true, max: 1000 });

  const horario = resHora.valido ? resHora.hora : '';
  const resLemb = parseLembreteParam(pLemb.valor, horario);
  if (pLemb.presente && !resLemb.vazio && !resLemb.valido) {
    avisos.push('Lembrete inválido no link foi ignorado.');
  }

  const temConteudoValido = resData.valido || resHora.valido || Boolean(titulo) || Boolean(descricao) || (resLemb.valido && !resLemb.vazio);
  if (!temConteudoValido) {
    return {
      ativo: false,
      avisos: avisos.length ? avisos : ['Os parâmetros informados no link estão vazios ou inválidos.'],
    };
  }

  const dataIso = resData.valido ? resData.iso : (fallbackDataIso || '');
  return {
    ativo: true,
    dataIso,
    dataBr: dataIso ? isoParaBr(dataIso) : '',
    dataValidaNoLink: resData.valido,
    horario,
    titulo,
    descricao,
    lembrete: resLemb.valido ? resLemb.texto : '',
    horaAlerta: resLemb.valido && resLemb.ativarDashboard ? (resLemb.horaAlerta || horario) : (horario || ''),
    ativarAlertaDashboard: Boolean(resLemb.valido && resLemb.ativarDashboard) || (!resLemb.vazio && Boolean(horario) && resLemb.valido),
    avisos,
  };
}

/**
 * Converte os campos estruturados do evento nas linhas de anotação do bloco do dia.
 * Mantém o padrão "HH:MM Título" na 1ª linha para compatibilidade total com os
 * chips do calendário, busca e Central de Alertas do Dashboard.
 */
export function formatarLinhasEvento({ horario = '', titulo = '', descricao = '', lembrete = '' } = {}) {
  const hRes = parseHorarioParam(horario);
  const horaLimpa = hRes.valido ? hRes.hora : '';
  const titLimpo = limparTextoSeguro(titulo, { multilinhas: false, max: 200 });
  const descLimpa = limparTextoSeguro(descricao, { multilinhas: true, max: 1000 });
  const lembLimpo = limparTextoSeguro(lembrete, { multilinhas: false, max: 160 });

  const linhas = [];
  if (horaLimpa && titLimpo) {
    linhas.push(`${horaLimpa} ${titLimpo}`);
  } else if (titLimpo) {
    linhas.push(titLimpo);
  } else if (horaLimpa) {
    linhas.push(`${horaLimpa} Compromisso`);
  }

  if (descLimpa) {
    const partesDesc = descLimpa.split('\n').map((l) => l.trim()).filter(Boolean);
    partesDesc.forEach((parte, idx) => {
      if (idx === 0 && !/^descri[cç][aã]o\s*:/i.test(parte)) {
        linhas.push(`Descrição: ${parte}`);
      } else {
        linhas.push(parte);
      }
    });
  }

  if (lembLimpo && !/^sem\s+lembrete\.?$/i.test(lembLimpo)) {
    if (/^lembrete\s*:/i.test(lembLimpo)) {
      linhas.push(lembLimpo);
    } else {
      linhas.push(`Lembrete: ${lembLimpo}`);
    }
  }

  return linhas;
}

function normalizarLinhaComparacao(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Verifica se o evento já existe nas anotações salvas daquele dia (evita duplicação
 * ao recarregar a página ou reabrir o mesmo link após salvar).
 */
export function eventoJaPresenteNasNotas(notasExistentes, linhasEvento) {
  if (!Array.isArray(linhasEvento) || linhasEvento.length === 0) return false;
  const existentesNorm = new Set(
    (notasExistentes || [])
      .map((n) => normalizarLinhaComparacao(typeof n === 'string' ? n : n?.texto))
      .filter(Boolean)
  );
  if (existentesNorm.size === 0) return false;

  const principal = normalizarLinhaComparacao(linhasEvento[0]);
  return Boolean(principal) && existentesNorm.has(principal);
}

/**
 * Mescla anotações já existentes no dia com as linhas do novo evento, sem duplicar.
 */
export function mesclarNotasComEvento(notasExistentes, linhasEvento) {
  const base = (notasExistentes || [])
    .map((n) => (typeof n === 'string' ? n.trim() : String(n?.texto || '').trim()))
    .filter(Boolean);

  if (!Array.isArray(linhasEvento) || linhasEvento.length === 0) return base;
  if (eventoJaPresenteNasNotas(base, linhasEvento)) return base;

  return [...base, ...linhasEvento];
}

/**
 * Monta o resumo formatado do evento para o botão "Copiar evento".
 */
export function montarResumoEvento({
  titulo = '',
  dataIso = '',
  horario = '',
  descricao = '',
  lembrete = '',
  horaAlerta = '',
  textoLivreDia = '',
} = {}) {
  const dataBr = dataIso ? isoParaBr(dataIso) : '';
  const tit = limparTextoSeguro(titulo, { max: 200 });
  const desc = limparTextoSeguro(descricao, { multilinhas: true, max: 1000 });
  const hRes = parseHorarioParam(horario);
  const hora = hRes.valido ? hRes.hora : '';
  const lemb = limparTextoSeguro(lembrete, { max: 160 });

  // Se houver dados estruturados do formulário de evento
  if (tit || desc || lemb || hora) {
    const linhas = ['📅 Compromisso — Agenda Cell City'];
    if (tit) linhas.push(`Título: ${tit}`);
    if (dataBr) linhas.push(`Data: ${dataBr}`);
    if (hora) linhas.push(`Horário: ${hora}`);
    if (desc) linhas.push(`Descrição: ${desc}`);
    if (lemb) {
      const sufixoAlerta = horaAlerta && horaAlerta !== hora && !lemb.includes(horaAlerta)
        ? ` (alerta às ${horaAlerta})`
        : '';
      linhas.push(`Lembrete: ${lemb}${sufixoAlerta}`);
    }
    return linhas.join('\n');
  }

  // Fallback: cópia do bloco de notas do dia selecionado
  const livre = limparTextoSeguro(textoLivreDia, { multilinhas: true, max: 4000 });
  if (!livre) return '';
  const linhas = ['📅 Anotações — Agenda Cell City'];
  if (dataBr) linhas.push(`Data: ${dataBr}`);
  if (horaAlerta) linhas.push(`Horário de alerta: ${horaAlerta}`);
  linhas.push('', livre);
  return linhas.join('\n');
}
