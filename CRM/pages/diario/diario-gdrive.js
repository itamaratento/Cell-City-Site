// ============================================
//  DIÁRIO — adaptador do núcleo de backup do Drive
//  Núcleo: ../../shared/gdrive-backup.js (escopo drive, pasta por link)
//  Nome:  DIA-AAAA-MM-DD__Categoria__Subcategoria__Titulo.txt
//  Pasta: CELLCITY_BACKUP › Diario
// ============================================
import { criarBackup, slug } from "../../shared/gdrive-backup.js";

const DEFAULT_FOLDER_LINK = 'https://drive.google.com/drive/folders/15TAkHT8cKLcyW8lFWXqfTTAt3Ed0zhaz';

const CAT_NOME = {
    prioridades: 'Prioridades', futuro: 'Futuro', decisoes: 'Decisões', insights: 'Insights',
    metas: 'Metas', saude: 'Saúde', moradia: 'Moradia', familia: 'Família', documentos: 'Documentos'
};
const PRIO_NOME = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const STATUS_NOME = {
    pendente: 'Pendente', em_andamento: 'Em andamento', aguardando: 'Aguardando',
    concluido: 'Concluído', arquivado: 'Arquivado'
};

const pad = (n) => String(n).padStart(2, '0');
function dataDe(r) {
    const ts = r && r.criadoEm;
    let d = new Date();
    if (ts) {
        if (typeof ts.toMillis === 'function') d = new Date(ts.toMillis());
        else if (ts.seconds) d = new Date(ts.seconds * 1000);
        else { const t = new Date(ts); if (!isNaN(t.getTime())) d = t; }
    }
    return d;
}

function buildNomeBase(r) {
    const d = dataDe(r);
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const cat = slug(CAT_NOME[r.categoria] || r.categoria || 'Sem-categoria').slice(0, 40);
    const sub = slug(r.subcategoria || 'Geral').slice(0, 40);
    const titulo = slug(r.titulo).slice(0, 80).replace(/-+$/, '') || 'sem-titulo';
    return `DIA-${iso}__${cat}__${sub}__${titulo}`;
}
function buildConteudo(r) {
    const d = dataDe(r);
    const dataBr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const tags = Array.isArray(r.tags) ? r.tags.join(', ') : '';
    return [
        'TÍTULO:', r.titulo || '', '',
        'DATA:', dataBr, '',
        'CATEGORIA:', CAT_NOME[r.categoria] || r.categoria || '', '',
        'SUBCATEGORIA:', r.subcategoria || '-', '',
        'PRIORIDADE:', PRIO_NOME[r.prioridade] || r.prioridade || '', '',
        'STATUS:', STATUS_NOME[r.status] || r.status || '', '',
        'TAGS:', tags || '-', '',
        '---', '',
        'CONTEÚDO', '',
        r.conteudo || '', '',
        '---', ''
    ].join('\n');
}

const backup = criarBackup({
    moduleKey: 'diario',
    folderLabel: 'CELLCITY_BACKUP › Diario',
    defaultFolderLink: DEFAULT_FOLDER_LINK,
    buildNomeBase,
    buildConteudo
});

// API consumida por diario.js
export function backupConfigurado() { return backup.configurado(); }
export async function fazerBackup(registro) { return backup.backup(registro); }
export async function excluirArquivoDrive(fileId) { return backup.excluirArquivo(fileId); }
export async function existeArquivoDrive(fileId) { return backup.existeArquivo(fileId); }
export async function initGDrive() {
    await backup.initConfigUI({
        clientId: 'gd-client-id',
        folderLink: 'gd-folder-link',
        status: 'gd-status',
        ultimaSync: 'gd-ultima-sync',
        msg: 'gd-config-msg',
        btnSalvar: 'gd-btn-salvar-config',
        btnConectar: 'gd-btn-conectar',
        btnTestar: 'gd-btn-testar'
    });
}
