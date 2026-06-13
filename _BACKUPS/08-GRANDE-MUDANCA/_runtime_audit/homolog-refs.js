// Homologação estática: verifica referências locais (script src / link href / img src)
// em todos os HTML ativos do projeto. Reporta arquivos referenciados que não existem.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORE = /(\\|\/)(BACKUP[^\\\/]*|node_modules|_runtime_audit)(\\|\/)/i;
const isOld = f => /OLD|backup/i.test(path.basename(f));

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/^(node_modules|\.git)$/i.test(e.name)) continue;
      if (/^BACKUP/i.test(e.name)) continue;
      walk(full, acc);
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) {
      if (IGNORE.test(full) || isOld(full)) continue;
      acc.push(full);
    }
  }
  return acc;
}

const htmls = walk(ROOT);
const attrRe = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
const problems = [];
let totalRefs = 0;

for (const html of htmls) {
  const dir = path.dirname(html);
  const content = fs.readFileSync(html, 'utf8');
  let m;
  while ((m = attrRe.exec(content)) !== null) {
    let ref = m[1].trim();
    // Ignora externos, âncoras, dados, mailto, tel, js handlers
    if (/^(https?:|data:|mailto:|tel:|#|javascript:|\/\/)/i.test(ref)) continue;
    if (ref === '' ) continue;
    // Só checa referências a arquivos com extensão (js/css/png/svg/ico/woff...)
    if (!/\.[a-z0-9]{2,5}([?#].*)?$/i.test(ref)) continue;
    // Só checa relativos (refs absolutas tipo /CRM/... dependem do host — anota à parte)
    const clean = ref.split('?')[0].split('#')[0];
    totalRefs++;
    let resolved;
    if (clean.startsWith('/')) {
      // absoluto a partir da raiz do projeto
      resolved = path.join(ROOT, clean);
    } else {
      resolved = path.resolve(dir, clean);
    }
    if (!fs.existsSync(resolved)) {
      problems.push({ html: path.relative(ROOT, html), ref, esperado: path.relative(ROOT, resolved) });
    }
  }
}

console.log(`HTMLs analisados: ${htmls.length} | referências locais checadas: ${totalRefs}`);
console.log(`Referências quebradas: ${problems.length}`);
if (problems.length) console.log(JSON.stringify(problems, null, 2));
