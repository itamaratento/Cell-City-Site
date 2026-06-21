/* ============================================================
   EXPORTAR — Cell City CRM
   Exportação de dados: CSV, JSON, impressão PDF.
   Uso:
     import { exportarCSV, exportarJSON, imprimirTabela } from '../shared/exportar.js';
   ============================================================ */

/**
 * Exporta array de objetos como CSV.
 * @param {Object[]} dados     — array de registros
 * @param {string[]} colunas   — chaves a incluir (ex: ['descricao','valor','data'])
 * @param {Object}   cabecalhos — mapa chave→rótulo (ex: {valor: 'Valor (R$)'})
 * @param {string}   nomeArq   — nome do arquivo sem extensão
 */
export function exportarCSV(dados, colunas, cabecalhos = {}, nomeArq = 'exportacao') {
    const esc = v => {
        const s = String(v === null || v === undefined ? '' : v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const header = colunas.map(c => esc(cabecalhos[c] || c)).join(',');
    const linhas = dados.map(row =>
        colunas.map(c => esc(row[c])).join(',')
    );

    const csv     = [header, ...linhas].join('\n');
    const blob    = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = `${nomeArq}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Exporta como JSON.
 */
export function exportarJSON(dados, nomeArq = 'exportacao') {
    const json = JSON.stringify(dados, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${nomeArq}_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Abre janela de impressão com uma tabela HTML — gera PDF nativo via Ctrl+P.
 * @param {Object[]} dados
 * @param {string[]} colunas
 * @param {Object}   cabecalhos
 * @param {string}   titulo
 */
export function imprimirTabela(dados, colunas, cabecalhos = {}, titulo = 'Relatório') {
    const linhas = dados.map(row =>
        `<tr>${colunas.map(c => `<td>${row[c] ?? ''}</td>`).join('')}</tr>`
    ).join('');

    const html = `<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8">
    <title>${titulo}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; }
      h1 { font-size: 16px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #f0f0f0; font-weight: bold; }
      tr:nth-child(even) { background: #f9f9f9; }
      .meta { color: #666; margin-bottom: 8px; font-size: 11px; }
    </style>
    </head><body>
    <h1>${titulo}</h1>
    <p class="meta">Gerado em: ${new Date().toLocaleString('pt-BR')} — Cell City CRM</p>
    <table>
      <thead><tr>${colunas.map(c => `<th>${cabecalhos[c] || c}</th>`).join('')}</tr></thead>
      <tbody>${linhas}</tbody>
    </table>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para imprimir.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
}

/**
 * Mostra o seletor de formato e executa a exportação.
 * Uso: mostrarMenuExportar(dados, colunas, cabecalhos, 'despesas')
 */
export function mostrarMenuExportar(dados, colunas, cabecalhos, nomeArq) {
    if (!dados.length) { alert('Nenhum dado para exportar.'); return; }

    // Cria mini-dropdown inline
    const existente = document.getElementById('_cc_export_menu');
    if (existente) existente.remove();

    const menu = document.createElement('div');
    menu.id = '_cc_export_menu';
    menu.style.cssText = `
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        background:#1a1d23; border:1px solid #2a2d35; border-radius:12px;
        padding:16px; z-index:9999; min-width:200px; box-shadow:0 8px 32px rgba(0,0,0,0.5);
    `;
    menu.innerHTML = `
        <div style="font-size:13px;font-weight:700;color:#f1f3f5;margin-bottom:12px">📤 Exportar como…</div>
        <button id="_exp_csv"  style="${_btnStyle('var(--cell-green, #00c853)')}">📊 CSV (Excel)</button>
        <button id="_exp_json" style="${_btnStyle('#29b6f6')}">📄 JSON</button>
        <button id="_exp_pdf"  style="${_btnStyle('#ff9800')}">🖨️ PDF (Imprimir)</button>
        <button id="_exp_fechar" style="${_btnStyle('#555')}">✕ Cancelar</button>
    `;
    document.body.appendChild(menu);

    document.getElementById('_exp_csv').onclick  = () => { exportarCSV(dados, colunas, cabecalhos, nomeArq); menu.remove(); };
    document.getElementById('_exp_json').onclick = () => { exportarJSON(dados, nomeArq); menu.remove(); };
    document.getElementById('_exp_pdf').onclick  = () => { imprimirTabela(dados, colunas, cabecalhos, nomeArq); menu.remove(); };
    document.getElementById('_exp_fechar').onclick = () => menu.remove();
}

function _btnStyle(cor) {
    return `display:block;width:100%;margin-bottom:8px;padding:9px 14px;border:none;border-radius:8px;
    background:${cor};color:#000;font-weight:600;font-size:13px;cursor:pointer;text-align:left;`;
}
