// ===== LINK INTELIGENTE & MÚLTIPLAS TAREFAS DA AGENDA — Helpers puros =====
// 1. Lê parâmetros da URL via URLSearchParams (?date=2026-12-07, horario, titulo/compromisso, descricao, lembrete).
// 2. Modela cada tarefa do dia como um registro independente com horário, título, descrição, lembrete e conclusão próprios.
// 3. Ordena as tarefas cronologicamente sem sobrescrever registros existentes e mantendo total compatibilidade
//    com os alertas individuais do Dashboard e da Central de Alertas.

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function gerarIdTarefa() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return 'tsk_' + crypto.randomUUID().slice(0, 12);
  }
  return 'tsk_' + Date.now().toString(36) + '_' + String( performance?.now?.() || 0 ).replace('.', '').slice(0, 6);
}

/**
 * Higieniza texto preservando acentuação UTF-8 e pontuação.
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
 * Lê os parâmetros da query string (e hash opcional) usando URLSearchParams.
 */
export function lerLinkInteligente(searchString, fallbackDataIso = '', hashString = '') {
  const rawSearch = typeof searchString === 'string' ? searchString : '';
  const rawHash = typeof hashString === 'string' ? hashString.replace(/^#/, '').trim() : '';
  let params;
  try {
    params = new URLSearchParams(rawSearch);
  } catch {
    return { ativo: false, avisos: ['URL com parâmetros malformados.'] };
  }

  let pData = obterPrimeiroParam(params, ['date', 'data', 'dia', 'day', 'dt', 'd', 'selectedDate', 'dataSelecionada']);
  const pHora = obterPrimeiroParam(params, ['horario', 'hora', 'horário', 'time', 'hr', 'h', 'startTime', 'horaInicio']);
  const pTit  = obterPrimeiroParam(params, ['compromisso', 'titulo', 'título', 'title', 'evento', 'event', 'assunto', 'subject', 'tarefa', 'task', 'texto', 'text', 'nota', 'note', 'acao', 'ação', 'resumo']);
  const pDesc = obterPrimeiroParam(params, ['descricao', 'descrição', 'desc', 'description', 'obs', 'observacao', 'observação', 'detalhes', 'details']);
  const pLemb = obterPrimeiroParam(params, ['lembrete', 'alerta', 'reminder', 'aviso', 'notificacao', 'notificação']);

  if (!pData.presente && rawHash) {
    if (rawHash.includes('=')) {
      try {
        const hParams = new URLSearchParams(rawHash);
        const hData = obterPrimeiroParam(hParams, ['date', 'data', 'dia', 'day', 'dt', 'd']);
        if (hData.presente) pData = hData;
      } catch { /* ignora hash inválido */ }
    } else {
      try {
        const dec = decodeURIComponent(rawHash);
        if (parseDataParam(dec).valido) pData = { presente: true, valor: dec };
      } catch { /* ignora URI malformada */ }
    }
  }

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

  const temDadosEvento = resHora.valido || Boolean(titulo) || Boolean(descricao) || (resLemb.valido && !resLemb.vazio);
  const temConteudoValido = resData.valido || temDadosEvento;
  if (!temConteudoValido) {
    return {
      ativo: false,
      avisos: avisos.length ? avisos : ['Os parâmetros informados no link estão vazios ou inválidos.'],
    };
  }

  const dataIso = resData.valido ? resData.iso : (fallbackDataIso || '');
  return {
    ativo: true,
    somenteData: resData.valido && !temDadosEvento,
    temDadosEvento,
    dataIso,
    dataBr: dataIso ? isoParaBr(dataIso) : '',
    dataValidaNoLink: resData.valido,
    horario,
    titulo,
    descricao,
    lembrete: resLemb.valido ? resLemb.texto : '',
    horaAlerta: resLemb.valido && resLemb.ativarDashboard ? (resLemb.horaAlerta || horario) : (horario || ''),
    ativarAlertaDashboard: Boolean(resLemb.valido && resLemb.ativarDashboard) || (Boolean(horario) && resLemb.texto !== 'Sem lembrete'),
    avisos,
  };
}

/**
 * Monta o texto canônico de uma única linha para o objeto da tarefa.
 * Mantém "HH:MM Título" no início quando o alerta está ativo para que o Dashboard,
 * a Central de Alertas, a busca e os chips do calendário tratem cada tarefa de forma individual.
 */
export function montarTextoCanonicoTarefa({ hora = '', titulo = '', descricao = '', alertaAtivo = true } = {}) {
  const hRes = parseHorarioParam(hora);
  const horaLimpa = hRes.valido ? hRes.hora : '';
  const titLimpo = limparTextoSeguro(titulo, { multilinhas: false, max: 200 });
  const descLimpa = limparTextoSeguro(descricao, { multilinhas: false, max: 500 });

  let cabeca = '';
  if (horaLimpa && titLimpo) {
    cabeca = alertaAtivo === false ? `[${horaLimpa}] ${titLimpo}` : `${horaLimpa} ${titLimpo}`;
  } else if (titLimpo) {
    cabeca = titLimpo;
  } else if (horaLimpa) {
    cabeca = alertaAtivo === false ? `[${horaLimpa}] Compromisso` : `${horaLimpa} Compromisso`;
  }

  if (descLimpa && cabeca) return `${cabeca} — ${descLimpa}`;
  return cabeca || descLimpa;
}

/**
 * Cria um registro independente de tarefa com horário, título, descrição, lembrete e conclusão próprios.
 */
export function criarRegistroTarefa({
  id = '',
  hora = '',
  horario = '',
  titulo = '',
  descricao = '',
  lembrete = '',
  cor = 'verde',
  concluido = false,
} = {}) {
  const hRes = parseHorarioParam(hora || horario);
  const horaLimpa = hRes.valido ? hRes.hora : '';
  const titLimpo = limparTextoSeguro(titulo, { multilinhas: false, max: 200 });
  const descLimpa = limparTextoSeguro(descricao, { multilinhas: true, max: 1000 });
  const lRes = parseLembreteParam(lembrete, horaLimpa);
  const lembreteTexto = lRes.valido ? lRes.texto : limparTextoSeguro(lembrete, { max: 160 });
  const desativadoExplicito = lRes.valido && !lRes.vazio && !lRes.ativarDashboard;
  const alertaAtivo = !desativadoExplicito && (Boolean(horaLimpa) || Boolean(lRes.ativarDashboard));
  const horaAlerta = alertaAtivo ? (lRes.horaAlerta || horaLimpa || '') : '';
  const texto = montarTextoCanonicoTarefa({
    hora: horaLimpa,
    titulo: titLimpo,
    descricao: descLimpa,
    alertaAtivo,
  });

  return {
    id: id || gerarIdTarefa(),
    hora: horaLimpa,
    titulo: titLimpo || (horaLimpa ? 'Compromisso' : ''),
    descricao: descLimpa,
    lembrete: lembreteTexto,
    horaAlerta,
    alertaAtivo,
    cor: cor || 'verde',
    concluido: Boolean(concluido),
    texto,
  };
}

/**
 * Normaliza de forma não destrutiva registros já existentes no Firestore (estruturados ou legados).
 */
export function normalizarRegistroTarefa(raw, corPadrao = 'verde') {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return null;
    raw = { texto: t, cor: corPadrao, concluido: false };
  }

  // Registro já estruturado (possui campos próprios de tarefa)
  if (typeof raw.titulo === 'string' && (raw.id || raw.hora !== undefined || raw.descricao !== undefined || raw.lembrete !== undefined)) {
    const horaRes = parseHorarioParam(raw.hora || '');
    const horaLimpa = horaRes.valido ? horaRes.hora : '';
    const alertaAtivo = raw.alertaAtivo !== undefined ? Boolean(raw.alertaAtivo) : Boolean(horaLimpa);
    const lRes = parseLembreteParam(raw.lembrete || '', horaLimpa);
    const horaAlerta = raw.horaAlerta !== undefined
      ? String(raw.horaAlerta || '')
      : (alertaAtivo ? (lRes.horaAlerta || horaLimpa || '') : '');
    const texto = String(raw.texto || '').trim() || montarTextoCanonicoTarefa({
      hora: horaLimpa,
      titulo: raw.titulo,
      descricao: raw.descricao || '',
      alertaAtivo,
    });
    if (!texto) return null;
    return {
      id: raw.id || gerarIdTarefa(),
      hora: horaLimpa,
      titulo: raw.titulo || texto,
      descricao: String(raw.descricao || ''),
      lembrete: String(raw.lembrete || ''),
      horaAlerta,
      alertaAtivo,
      cor: raw.cor || corPadrao,
      concluido: Boolean(raw.concluido),
      texto,
    };
  }

  // Registro legado ({ texto, cor, concluido }) — preserva texto original intacto
  const textoBruto = String(raw.texto || '').trim();
  if (!textoBruto) return null;
  const m = textoBruto.match(/^\s*(?:\[(\d{1,2}:\d{2})\]|(\d{1,2}:\d{2}))\s+([\s\S]*)$/);
  const silenciado = Boolean(m && m[1]);
  const horaCandidata = m ? (m[1] || m[2]) : '';
  const hRes = parseHorarioParam(horaCandidata);
  const horaLimpa = hRes.valido ? hRes.hora : '';
  const resto = m ? m[3].trim() : textoBruto;

  return {
    id: raw.id || gerarIdTarefa(),
    hora: horaLimpa,
    titulo: resto,
    descricao: '',
    lembrete: silenciado ? 'Sem lembrete' : '',
    horaAlerta: !silenciado && horaLimpa ? horaLimpa : '',
    alertaAtivo: !silenciado && Boolean(horaLimpa),
    cor: raw.cor || corPadrao,
    concluido: Boolean(raw.concluido),
    texto: textoBruto,
  };
}

/**
 * Extrai minutos desde 00:00 para ordenação cronológica; tarefas sem horário ficam ao final na ordem original.
 */
export function minutosCronologicosTarefa(tarefa) {
  if (!tarefa) return Number.POSITIVE_INFINITY;
  const hDireta = parseHorarioParam(tarefa.hora || '');
  if (hDireta.valido) {
    const [h, m] = hDireta.hora.split(':').map(Number);
    return h * 60 + m;
  }
  const mTxt = String(tarefa.texto || '').match(/^\s*\[?(\d{1,2}:\d{2})\]?\b/);
  if (mTxt) {
    const hTxt = parseHorarioParam(mTxt[1]);
    if (hTxt.valido) {
      const [h, m] = hTxt.hora.split(':').map(Number);
      return h * 60 + m;
    }
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * Ordena tarefas cronologicamente (08:00 -> 10:00 -> 14:00), preservando ordem relativa em empates.
 */
export function ordenarTarefasCronologicamente(lista) {
  return (lista || [])
    .map((item, idx) => ({ item, idx, min: minutosCronologicosTarefa(item) }))
    .sort((a, b) => (a.min - b.min) || (a.idx - b.idx))
    .map((x) => x.item);
}

/**
 * Compatibilidade para pré-visualização em linhas (1 linha canônica por tarefa).
 */
export function formatarLinhasEvento({ horario = '', titulo = '', descricao = '', lembrete = '' } = {}) {
  const reg = criarRegistroTarefa({ horario, titulo, descricao, lembrete });
  return reg.texto ? [reg.texto] : [];
}

function normalizarComparacao(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function assinaturaTarefa(t) {
  if (typeof t === 'string') {
    const n = normalizarRegistroTarefa(t);
    return n ? `${n.hora}|${normalizarComparacao(n.titulo)}` : '';
  }
  const hora = t?.hora || (String(t?.texto || '').match(/^\s*(\d{1,2}:\d{2})\b/)?.[1] || '');
  const hNorm = parseHorarioParam(hora).hora || '';
  const titBase = t?.titulo
    ? String(t.titulo).split(' — ')[0]
    : String(t?.texto || '').replace(/^\s*\[?\d{1,2}:\d{2}\]?\s*/, '').split(' — ')[0];
  return `${hNorm}|${normalizarComparacao(titBase)}`;
}

/**
 * Verifica se a tarefa já existe nas tarefas salvas do mesmo dia (evita duplicar em F5 / reabertura de link,
 * mas permite livremente quantas tarefas distintas forem necessárias no mesmo dia).
 */
export function tarefaJaExisteNoDia(tarefasExistentes, candidata, ignorarId = '') {
  if (!candidata) return false;
  const sigNova = assinaturaTarefa(candidata);
  const txtNovo = normalizarComparacao(typeof candidata === 'string' ? candidata : candidata.texto);
  if (!sigNova && !txtNovo) return false;

  return (tarefasExistentes || []).some((existente) => {
    if (ignorarId && existente?.id === ignorarId) return false;
    const txtExist = normalizarComparacao(typeof existente === 'string' ? existente : existente?.texto);
    if (txtNovo && txtExist === txtNovo) return true;
    const sigExist = assinaturaTarefa(existente);
    return Boolean(sigNova && sigNova !== '|' && sigExist === sigNova);
  });
}

export function eventoJaPresenteNasNotas(notasExistentes, linhasOuTarefa) {
  if (Array.isArray(linhasOuTarefa)) {
    if (linhasOuTarefa.length === 0) return false;
    return tarefaJaExisteNoDia(notasExistentes, linhasOuTarefa[0]);
  }
  return tarefaJaExisteNoDia(notasExistentes, linhasOuTarefa);
}

/**
 * Remove tarefas duplicadas dentro de uma mesma lista preservando a primeira ocorrência (ou a mais completa).
 */
export function deduplicarListaTarefas(lista) {
  const resultado = [];
  for (const item of (lista || [])) {
    const norm = normalizarRegistroTarefa(item);
    if (!norm) continue;
    const jaTemId = resultado.some((r) => r.id && norm.id && r.id === norm.id);
    if (jaTemId) continue;
    if (tarefaJaExisteNoDia(resultado, norm)) continue;
    resultado.push(norm);
  }
  return ordenarTarefasCronologicamente(resultado);
}

function extrairLinhaTarefaColada(linha) {
  let s = limparTextoSeguro(linha, { multilinhas: false, max: 300 });
  if (!s) return null;
  // Remove marcadores de lista e prefixo opcional "Tarefa N —"
  s = s.replace(/^[-•*▪▸]\s*/, '').replace(/^tarefa\s*\d+\s*[-—–:]\s*/i, '').trim();
  if (!s) return null;

  // Padrão "08:00 — Jogo do Grêmio" ou "08h00 - Jogo do Grêmio" ou "08:00 Jogo do Grêmio"
  const mInicio = s.match(/^(\d{1,2}(?::\d{2}|[hH]\d{0,2}))(?:\s*[-—–:]\s*|\s+)(.+)$/);
  if (mInicio) {
    const hRes = parseHorarioParam(mInicio[1]);
    if (hRes.valido) {
      return { horario: hRes.hora, titulo: mInicio[2].trim() };
    }
  }

  // Padrão inverso "Jogo do Grêmio — 08:00" ou "Jogo do Grêmio às 08:00"
  const mFim = s.match(/^(.+?)(?:\s*[-—–]\s*|\s+[àa]s\s+)(\d{1,2}(?::\d{2}|[hH]\d{0,2}))\.?$/i);
  if (mFim) {
    const hRes = parseHorarioParam(mFim[2]);
    if (hRes.valido) {
      return { horario: hRes.hora, titulo: mFim[1].trim() };
    }
  }

  return { horario: '', titulo: s };
}

/**
 * Interpreta texto colado pelo usuário (linha simples "08:00 — Jogo do Grêmio",
 * bloco estruturado do ChatGPT com Título/Data/Horário/Descrição/Lembrete,
 * ou lista de múltiplas tarefas).
 */
export function interpretarTextoColado(textoBruto) {
  const limpo = limparTextoSeguro(textoBruto, { multilinhas: true, max: 4000 });
  if (!limpo) return null;

  const linhas = limpo.split('\n').map((l) => l.trim()).filter(Boolean);
  if (linhas.length === 0) return null;

  // 1. Verifica se é um bloco estruturado Chave: Valor (ex.: gerado pelo ChatGPT)
  const campos = { titulo: '', dataIso: '', horario: '', descricao: '', lembrete: '' };
  let chavesReconhecidas = 0;
  for (const linha of linhas) {
    const kv = linha.replace(/^[-•*]\s*/, '').match(/^([A-Za-zÀ-ÿ\s]+?)\s*:\s*(.+)$/);
    if (!kv) continue;
    const chave = kv[1].trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const valor = kv[2].trim();
    if (['titulo', 'compromisso', 'evento', 'assunto', 'tarefa'].includes(chave)) {
      campos.titulo = valor;
      chavesReconhecidas++;
    } else if (['data', 'date', 'dia'].includes(chave)) {
      const d = parseDataParam(valor);
      if (d.valido) campos.dataIso = d.iso;
      chavesReconhecidas++;
    } else if (['horario', 'hora', 'time'].includes(chave)) {
      const h = parseHorarioParam(valor.replace(/\.$/, ''));
      if (h.valido) campos.horario = h.hora;
      chavesReconhecidas++;
    } else if (['descricao', 'detalhes', 'observacao', 'obs'].includes(chave)) {
      campos.descricao = campos.descricao ? `${campos.descricao}\n${valor}` : valor;
      chavesReconhecidas++;
    } else if (['lembrete', 'alerta', 'aviso'].includes(chave)) {
      campos.lembrete = valor;
      chavesReconhecidas++;
    }
  }
  if (chavesReconhecidas >= 2 && (campos.titulo || campos.descricao)) {
    return { tipo: 'estruturada', ...campos };
  }

  // 2. Múltiplas linhas de tarefas coladas de uma vez
  if (linhas.length >= 2) {
    const extraidas = linhas.map(extrairLinhaTarefaColada).filter((x) => x && x.titulo);
    if (extraidas.length >= 2) {
      return { tipo: 'multiplas', tarefas: extraidas };
    }
  }

  // 3. Linha única (ex.: "08:00 — Jogo do Grêmio.")
  const unica = extrairLinhaTarefaColada(linhas[0]);
  if (unica && unica.titulo) {
    return {
      tipo: 'unica',
      dataIso: '',
      horario: unica.horario,
      titulo: unica.titulo,
      descricao: '',
      lembrete: '',
    };
  }

  return null;
}

/**
 * Adiciona uma nova tarefa ao dia sem sobrescrever as já existentes e mantendo ordem cronológica.
 */
export function adicionarOuAtualizarTarefaNoDia(tarefasExistentes, novaTarefa, { editarId = '' } = {}) {
  const atuais = (tarefasExistentes || [])
    .map((t) => normalizarRegistroTarefa(t))
    .filter(Boolean);

  const registro = normalizarRegistroTarefa(novaTarefa);
  if (!registro) return ordenarTarefasCronologicamente(atuais);

  let resultado;
  if (editarId) {
    let substituiu = false;
    resultado = atuais.map((t) => {
      if (t.id === editarId) {
        substituiu = true;
        return { ...registro, id: editarId };
      }
      return t;
    });
    if (!substituiu) resultado.push({ ...registro, id: editarId });
  } else if (tarefaJaExisteNoDia(atuais, registro)) {
    resultado = atuais;
  } else {
    resultado = [...atuais, registro];
  }

  return ordenarTarefasCronologicamente(resultado);
}

export function mesclarNotasComEvento(notasExistentes, linhasEvento) {
  const base = (notasExistentes || []).map((n) => normalizarRegistroTarefa(n)).filter(Boolean);
  if (!Array.isArray(linhasEvento) || linhasEvento.length === 0) {
    return ordenarTarefasCronologicamente(base).map((n) => n.texto);
  }
  const combinado = adicionarOuAtualizarTarefaNoDia(base, linhasEvento[0]);
  return combinado.map((n) => n.texto);
}

/**
 * Monta o resumo formatado do evento ou de todas as tarefas cronológicas do dia para o botão "Copiar".
 */
export function montarResumoEvento({
  titulo = '',
  dataIso = '',
  horario = '',
  descricao = '',
  lembrete = '',
  horaAlerta = '',
  tarefasDia = [],
  textoLivreDia = '',
} = {}) {
  const dataBr = dataIso ? isoParaBr(dataIso) : '';
  const tit = limparTextoSeguro(titulo, { max: 200 });
  const desc = limparTextoSeguro(descricao, { multilinhas: true, max: 1000 });
  const hRes = parseHorarioParam(horario);
  const hora = hRes.valido ? hRes.hora : '';
  const lemb = limparTextoSeguro(lembrete, { max: 160 });

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

  const ordenadas = ordenarTarefasCronologicamente(
    (tarefasDia || []).map((t) => normalizarRegistroTarefa(t)).filter(Boolean)
  );
  if (ordenadas.length > 0) {
    const linhas = [`📅 Compromissos de ${dataBr || 'hoje'} — Agenda Cell City`];
    ordenadas.forEach((t, idx) => {
      const prefixo = t.hora ? `${t.hora} — ` : '';
      const status = t.concluido ? ' [Concluído]' : '';
      linhas.push(`${idx + 1}. ${prefixo}${t.titulo}${status}`);
      if (t.descricao) linhas.push(`   Descrição: ${t.descricao}`);
      if (t.lembrete) {
        const suf = t.horaAlerta && t.horaAlerta !== t.hora ? ` (alerta às ${t.horaAlerta})` : '';
        linhas.push(`   Lembrete: ${t.lembrete}${suf}`);
      }
    });
    return linhas.join('\n');
  }

  const livre = limparTextoSeguro(textoLivreDia, { multilinhas: true, max: 4000 });
  if (!livre) return '';
  const linhas = ['📅 Anotações — Agenda Cell City'];
  if (dataBr) linhas.push(`Data: ${dataBr}`);
  if (horaAlerta) linhas.push(`Horário de alerta: ${horaAlerta}`);
  linhas.push('', livre);
  return linhas.join('\n');
}
