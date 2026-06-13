// Homologação: detecta funções chamadas em handlers inline (onclick, oninput, etc.)
// que NÃO estão definidas em nenhum JS ativo do módulo + shared + scripts globais.
// Classe do bug escapeHtml (usado mas inexistente). Triagem manual depois.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function walk(dir, ext, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/^(node_modules|\.git|_runtime_audit)$/i.test(e.name)) continue;
      if (/^(BACKUP|_backup)/i.test(e.name)) continue;
      walk(full, ext, acc);
    } else if (e.isFile() && e.name.toLowerCase().endsWith(ext) && !/OLD/i.test(e.name)) {
      acc.push(full);
    }
  }
  return acc;
}

// Junta TODO o JS ativo do CRM como "universo de definições" (scripts são globais no browser)
const allJs = walk(path.join(ROOT, 'CRM'), '.js');
const jsBlob = allJs.map(f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } }).join('\n');

// Builtins / globais do browser e libs que não queremos sinalizar
const KNOWN = new Set(['if','for','while','switch','return','function','typeof','catch','do','else',
  'alert','confirm','prompt','setTimeout','setInterval','clearTimeout','parseInt','parseFloat',
  'console','window','document','JSON','Math','Number','String','Array','Object','Date','Boolean',
  'encodeURIComponent','decodeURIComponent','requestAnimationFrame','fetch','Promise','event','this']);

function isDefined(name) {
  // function name(  |  name = function/( arrow )  |  name:  (método de objeto)  |  window.name  |  const/let/var name
  const patterns = [
    new RegExp('function\\s+' + name + '\\b'),
    new RegExp('\\b' + name + '\\s*[:=]\\s*(async\\s*)?(function|\\()'),
    new RegExp('\\b(const|let|var)\\s+' + name + '\\b'),
    new RegExp('window\\.' + name + '\\b'),
    new RegExp('\\b' + name + '\\s*\\([^)]*\\)\\s*\\{'), // método shorthand  name(args){
  ];
  return patterns.some(re => re.test(jsBlob));
}

const htmls = walk(path.join(ROOT, 'CRM'), '.html');
const handlerRe = /on[a-z]+\s*=\s*["']([^"']+)["']/gi;
// captura nome de função no início do handler: "nome(" ou "window.X" etc.
const callRe = /([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;

const missing = {};
for (const html of htmls) {
  const content = fs.readFileSync(html, 'utf8');
  let h;
  while ((h = handlerRe.exec(content)) !== null) {
    const code = h[1];
    let c;
    while ((c = callRe.exec(code)) !== null) {
      const name = c[1];
      if (KNOWN.has(name)) continue;
      // ignora chamadas de método (precedidas por '.')
      const idx = c.index;
      if (idx > 0 && code[idx - 1] === '.') continue;
      if (!isDefined(name)) {
        const rel = path.relative(ROOT, html);
        (missing[name] = missing[name] || new Set()).add(rel);
      }
    }
  }
}

const out = Object.entries(missing).map(([k, v]) => ({ funcao: k, usadaEm: [...v] }));
console.log(`Handlers inline com função possivelmente indefinida: ${out.length}`);
console.log(JSON.stringify(out, null, 2));
