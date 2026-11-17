/**
 * Entrada por texto — cola uma frase e preenche a Nova OS.
 * Ex.: "Maria, 62 99999-9999, A10, não liga, troca de tela, senha 111"
 * Puro: sem DOM/Firestore.
 */

import { sugerirCategoriaPorModelo } from './mensagem-criacao.js';

const RE_PHONE = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[\s-]?\d{4}/;
const RE_SENHA = /^(?:senha|pin|pwd|password)\s*[:=]?\s*(.+)$/i;
const RE_SENHA_INLINE = /(?:senha|pin)\s*[:=]?\s*(\S+)/i;
const RE_SO_DIGITOS = /^\d{4,8}$/;
const RE_MODELO = /^(?:iphone|galaxy|samsung|xiaomi|redmi|motorola|moto|poco|realme|oppo|vivo|asus|lg|nokia|huawei|honor|infinix|tecno|a\d{1,2}(?:s|e|c)?|m\d{1,2}|g\d{1,2}|note\s*\d+|ipad|macbook|notebook|dell|lenovo|acer|epson|brother|canon|hp)\b/i;

function soDigitos(s) {
  return String(s || '').replace(/\D/g, '');
}

function pareceTelefone(token) {
  const d = soDigitos(token);
  return d.length >= 10 && d.length <= 13;
}

function extrairSenhaDoToken(token) {
  const t = String(token || '').trim();
  const m = RE_SENHA.exec(t);
  if (m) return m[1].trim();
  return null;
}

function pareceNome(token) {
  const t = String(token || '').trim();
  if (!t || pareceTelefone(t) || RE_SENHA.test(t) || RE_SO_DIGITOS.test(t)) return false;
  // Maioria letras / espaços (aceita acentos)
  const letters = (t.match(/[\p{L}\s'.-]/gu) || []).join('');
  return letters.length >= Math.min(2, t.length) && /[\p{L}]{2,}/u.test(t);
}

function pareceModelo(token) {
  const t = String(token || '').trim();
  if (!t || pareceTelefone(t) || RE_SENHA.test(t)) return false;
  if (RE_MODELO.test(t)) return true;
  // Códigos curtos tipo A10, A03S, Moto G54
  if (/^[A-Za-z]{1,4}\s?\d{1,4}[A-Za-z]?$/i.test(t)) return true;
  return false;
}

/**
 * @param {string} texto
 * @returns {{
 *   nome: string,
 *   telefone: string,
 *   modelo: string,
 *   defeito: string,
 *   senha: string,
 *   categoria: 'celular'|'notebook'|'impressora'|null,
 *   camposPreenchidos: string[],
 * }}
 */
export function parseEntradaTextoOS(texto) {
  const raw = String(texto || '').trim();
  const empty = {
    nome: '',
    telefone: '',
    modelo: '',
    defeito: '',
    senha: '',
    categoria: null,
    camposPreenchidos: [],
  };
  if (!raw) return empty;

  // Preferir vírgula; senão ponto-e-vírgula; senão quebras de linha
  let parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) {
    parts = raw.split(/[;\n]+/).map(s => s.trim()).filter(Boolean);
  }
  if (parts.length === 1) {
    // Frase única: tentar achar telefone/senha inline
    parts = [raw];
  }

  let nome = '';
  let telefone = '';
  let modelo = '';
  let senha = '';
  const resto = [];

  // Passada 1: classificar tokens claros
  const usados = new Set();
  parts.forEach((p, i) => {
    const senhaTok = extrairSenhaDoToken(p);
    if (senhaTok != null) {
      senha = senhaTok;
      usados.add(i);
      return;
    }
    if (pareceTelefone(p)) {
      telefone = p.replace(/\s+/g, ' ').trim();
      usados.add(i);
      return;
    }
  });

  // Senha inline no texto bruto se não achou
  if (!senha) {
    const m = RE_SENHA_INLINE.exec(raw);
    if (m) senha = m[1].trim();
  }

  // Nome: primeiro token “nome”
  for (let i = 0; i < parts.length; i++) {
    if (usados.has(i)) continue;
    if (pareceNome(parts[i])) {
      nome = parts[i];
      usados.add(i);
      break;
    }
  }

  // Modelo: primeiro que parece modelo
  for (let i = 0; i < parts.length; i++) {
    if (usados.has(i)) continue;
    if (pareceModelo(parts[i])) {
      modelo = parts[i];
      usados.add(i);
      break;
    }
  }

  // Se não achou modelo, segundo token após nome/telefone costuma ser o aparelho
  if (!modelo) {
    for (let i = 0; i < parts.length; i++) {
      if (usados.has(i)) continue;
      const p = parts[i];
      if (RE_SO_DIGITOS.test(p) && !senha) {
        // PIN solto no fim → senha
        continue;
      }
      if (!pareceNome(p) || i > 0) {
        modelo = p;
        usados.add(i);
        break;
      }
    }
  }

  // PIN solto (só dígitos) não usado → senha
  if (!senha) {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (usados.has(i)) continue;
      if (RE_SO_DIGITOS.test(parts[i])) {
        senha = parts[i];
        usados.add(i);
        break;
      }
    }
  }

  for (let i = 0; i < parts.length; i++) {
    if (usados.has(i)) continue;
    resto.push(parts[i]);
  }

  let defeito = resto.join(', ').trim();
  // Remover “senha X” residual do defeito
  if (defeito) {
    defeito = defeito.replace(RE_SENHA_INLINE, '').replace(/^,\s*|,\s*$/g, '').trim();
  }

  const categoria =
    sugerirCategoriaPorModelo(modelo) ||
    sugerirCategoriaPorModelo(defeito) ||
    (modelo || defeito ? 'celular' : null);

  const camposPreenchidos = [];
  if (nome) camposPreenchidos.push('nome');
  if (telefone) camposPreenchidos.push('telefone');
  if (modelo) camposPreenchidos.push('modelo');
  if (defeito) camposPreenchidos.push('defeito');
  if (senha) camposPreenchidos.push('senha');
  if (categoria) camposPreenchidos.push('categoria');

  return { nome, telefone, modelo, defeito, senha, categoria, camposPreenchidos };
}

/**
 * Aplica o resultado nos campos do formulário Nova OS (DOM).
 * @param {ReturnType<typeof parseEntradaTextoOS>} parsed
 * @param {Document} [doc]
 */
export function aplicarEntradaTextoNoForm(parsed, doc = document) {
  if (!parsed) return;
  const set = (id, val) => {
    const el = doc.getElementById(id);
    if (el && val != null && String(val) !== '') el.value = String(val);
  };
  set('f-nome', parsed.nome);
  set('f-telefone', parsed.telefone);
  set('f-modelo', parsed.modelo);
  set('f-defeito', parsed.defeito);
  set('f-senha', parsed.senha);
  if (parsed.categoria) {
    const sel = doc.getElementById('f-category-select');
    if (sel) sel.value = parsed.categoria;
  }
}
