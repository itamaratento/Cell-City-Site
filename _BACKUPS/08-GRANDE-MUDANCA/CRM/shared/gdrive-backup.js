// ============================================================
//  NÚCLEO COMPARTILHADO — Backup automático no Google Drive
//  Usado por: Diário, Portal Técnico → Tutoriais, Soluções Técnicas
//
//  • OAuth via Google Identity Services — escopo `drive` (grava em pasta
//    existente informada por LINK, sem Picker/seleção manual).
//  • 1 conexão: o OAuth Client ID é GLOBAL (Firestore: gdrive_backup/_credenciais).
//  • Por módulo: link/ID da pasta + última sincronização
//    (Firestore: gdrive_backup/<moduleKey>).
//  • Nome do arquivo gerado automaticamente; dedup com sufixo __01, __02…
//  • Atualização usa o fileId já vinculado (não duplica).
//
//  ⚠ Pré-requisito (uma vez, no Google Cloud Console da conta dona das pastas):
//    1. Habilitar a Google Drive API.
//    2. Criar OAuth 2.0 Client ID (Web) com a origem do CRM autorizada.
//    Cole o Client ID na configuração de qualquer um dos módulos (vale p/ todos).
// ============================================================
import { db, doc, getDoc, setDoc, serverTimestamp } from "../scripts/firebase.js";

const SCOPE = 'https://www.googleapis.com/auth/drive';
const CREDS_DOC = ['gdrive_backup', '_credenciais'];

// ── Credenciais globais (1 conexão p/ todos os módulos) ───────────────
let creds = { clientId: '' };
let credsCarregadas = false;
let tokenClient = null;
let accessToken = null;
let tokenExpiraEm = 0;

// ── Utils exportados ──────────────────────────────────────────────────
export function slug(s) {
    return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sem-info';
}
export function extrairFolderId(linkOuId) {
    if (!linkOuId) return '';
    const m = String(linkOuId).match(/folders\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    const id = String(linkOuId).trim();
    return /^[a-zA-Z0-9_-]{10,}$/.test(id) ? id : '';
}

// ── Credenciais (Firestore) ───────────────────────────────────────────
async function carregarCreds() {
    if (credsCarregadas) return;
    try {
        const snap = await getDoc(doc(db, ...CREDS_DOC));
        if (snap.exists()) creds.clientId = snap.data().clientId || '';
    } catch (e) { console.warn('GDrive: erro ao carregar credenciais', e); }
    credsCarregadas = true;
}
async function salvarCreds() {
    try { await setDoc(doc(db, ...CREDS_DOC), { clientId: creds.clientId, atualizadoEm: serverTimestamp() }, { merge: true }); }
    catch (e) { console.warn('GDrive: erro ao salvar credenciais', e); }
}

// ── OAuth (Google Identity Services) ──────────────────────────────────
function gisDisponivel() { return !!(window.google && google.accounts && google.accounts.oauth2); }
function garantirTokenClient() {
    if (!gisDisponivel() || !creds.clientId) return false;
    if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({ client_id: creds.clientId, scope: SCOPE, callback: () => {} });
    }
    return true;
}
function pedirToken(prompt = '') {
    return new Promise((resolve, reject) => {
        if (!garantirTokenClient()) return reject(new Error('Google Identity indisponível ou Client ID ausente'));
        tokenClient.callback = (resp) => {
            if (resp && resp.access_token) {
                accessToken = resp.access_token;
                tokenExpiraEm = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000;
                resolve(accessToken);
            } else reject(new Error((resp && resp.error) || 'Falha ao obter token'));
        };
        try { tokenClient.requestAccessToken({ prompt }); } catch (e) { reject(e); }
    });
}
async function tokenValido() {
    if (accessToken && Date.now() < tokenExpiraEm) return accessToken;
    return pedirToken('');
}
function conectado() { return !!(accessToken && Date.now() < tokenExpiraEm); }

// ============================================================
//  FÁBRICA POR MÓDULO
//  opts = { moduleKey, folderLabel, defaultFolderLink,
//           buildNomeBase(record) -> string (sem .txt),
//           buildConteudo(record) -> string }
// ============================================================
export function criarBackup(opts) {
    const CFG_DOC = ['gdrive_backup', opts.moduleKey];
    let cfg = { folderId: '', folderLink: opts.defaultFolderLink || '', ultimaSync: null };
    let cfgCarregada = false;

    async function carregarCfg() {
        if (cfgCarregada) return;
        try {
            const snap = await getDoc(doc(db, ...CFG_DOC));
            if (snap.exists()) {
                const d = snap.data();
                cfg.folderLink = d.folderLink || cfg.folderLink;
                cfg.folderId = d.folderId || extrairFolderId(cfg.folderLink);
                cfg.ultimaSync = d.ultimaSync || null;
            } else if (cfg.folderLink) {
                cfg.folderId = extrairFolderId(cfg.folderLink);
            }
        } catch (e) { console.warn('GDrive[' + opts.moduleKey + ']: erro ao carregar config', e); }
        cfgCarregada = true;
    }
    async function salvarCfg() {
        try {
            await setDoc(doc(db, ...CFG_DOC), {
                folderId: cfg.folderId, folderLink: cfg.folderLink, atualizadoEm: serverTimestamp()
            }, { merge: true });
        } catch (e) { console.warn('GDrive[' + opts.moduleKey + ']: erro ao salvar config', e); }
    }
    async function salvarUltimaSync() {
        try { await setDoc(doc(db, ...CFG_DOC), { ultimaSync: cfg.ultimaSync }, { merge: true }); } catch {}
    }

    function configurado() { return !!(creds.clientId && cfg.folderId); }

    // ── Dedup: base.txt → base_v2.txt → base_v3.txt … ──
    async function nomeExiste(token, nome) {
        const q = `name = '${nome.replace(/'/g, "\\'")}' and '${cfg.folderId}' in parents and trashed = false`;
        try {
            const r = await fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id)&pageSize=1',
                { headers: { 'Authorization': 'Bearer ' + token } });
            if (!r.ok) return false;
            const data = await r.json();
            return (data.files || []).length > 0;
        } catch { return false; }
    }
    async function nomeFinal(token, base) {
        let nome = base + '.txt';
        if (!(await nomeExiste(token, nome))) return nome;
        for (let n = 2; n <= 99; n++) {
            const cand = `${base}_v${n}.txt`;
            if (!(await nomeExiste(token, cand))) return cand;
        }
        return `${base}_v${Date.now()}.txt`;
    }

    // ── Backup (cria ou atualiza). Retorna {ok, fileId, link, nome} | {ok:false, erro} ──
    async function backup(record) {
        if (!configurado()) return { ok: false, erro: 'Backup não configurado' };
        let token;
        try { token = await tokenValido(); } catch (e) { return { ok: false, erro: 'Sem autorização (' + (e.message || e) + ')' }; }

        const base = opts.buildNomeBase(record);
        const conteudo = opts.buildConteudo(record);
        const jaExiste = !!record.backupDriveId;
        let nome;
        try { nome = jaExiste ? (base + '.txt') : await nomeFinal(token, base); }
        catch { nome = base + '.txt'; }

        const boundary = 'cc_backup_' + Date.now();
        const delim = '\r\n--' + boundary + '\r\n';
        const fim = '\r\n--' + boundary + '--';
        const metadata = jaExiste
            ? { name: nome }
            : { name: nome, mimeType: 'text/plain', parents: [cfg.folderId] };
        const body =
            delim + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
            delim + 'Content-Type: text/plain; charset=UTF-8\r\n\r\n' + conteudo + fim;
        const url = jaExiste
            ? `https://www.googleapis.com/upload/drive/v3/files/${record.backupDriveId}?uploadType=multipart&fields=id,webViewLink`
            : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`;

        try {
            const resp = await fetch(url, {
                method: jaExiste ? 'PATCH' : 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + boundary },
                body
            });
            if (!resp.ok) {
                const t = await resp.text().catch(() => '');
                return { ok: false, erro: `HTTP ${resp.status} ${t.slice(0, 140)}` };
            }
            const data = await resp.json();
            cfg.ultimaSync = new Date().toISOString();
            atualizarUI();
            salvarUltimaSync();
            return { ok: true, fileId: data.id, link: data.webViewLink || cfg.folderLink, nome };
        } catch (e) {
            return { ok: false, erro: e.message || String(e) };
        }
    }

    // ── Excluir arquivo no Drive (exclusão em cascata vinda do CRM) ──
    //  Retorna {ok:true} também quando o arquivo já não existe (404) — o
    //  objetivo (não haver arquivo) já está cumprido.
    async function excluirArquivo(fileId) {
        if (!fileId) return { ok: true, jaAusente: true };
        let token;
        try { token = await tokenValido(); } catch (e) { return { ok: false, erro: 'Sem autorização (' + (e.message || e) + ')' }; }
        try {
            const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token }
            });
            if (r.ok || r.status === 404) return { ok: true, jaAusente: r.status === 404 };
            const t = await r.text().catch(() => '');
            return { ok: false, erro: `HTTP ${r.status} ${t.slice(0, 140)}` };
        } catch (e) { return { ok: false, erro: e.message || String(e) }; }
    }

    // ── Verificar existência no Drive (detecção de exclusão feita lá) ──
    //  Retorna {ok:true, existe:bool} | {ok:false, erro}. trashed conta como ausente.
    async function existeArquivo(fileId) {
        if (!fileId) return { ok: true, existe: false };
        let token;
        try { token = await tokenValido(); } catch (e) { return { ok: false, erro: 'Sem autorização (' + (e.message || e) + ')' }; }
        try {
            const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,trashed`,
                { headers: { 'Authorization': 'Bearer ' + token } });
            if (r.status === 404) return { ok: true, existe: false };
            if (!r.ok) return { ok: false, erro: 'HTTP ' + r.status };
            const d = await r.json();
            return { ok: true, existe: !d.trashed };
        } catch (e) { return { ok: false, erro: e.message || String(e) }; }
    }

    // ── Testar conexão (token + acesso à pasta) ──
    async function testarConexao() {
        if (!creds.clientId) return { ok: false, erro: 'Client ID não informado' };
        if (!cfg.folderId) return { ok: false, erro: 'Pasta não configurada' };
        let token;
        try { token = await pedirToken('consent'); } catch (e) { return { ok: false, erro: e.message || String(e) }; }
        try {
            const r = await fetch(`https://www.googleapis.com/drive/v3/files/${cfg.folderId}?fields=id,name`,
                { headers: { 'Authorization': 'Bearer ' + token } });
            if (!r.ok) return { ok: false, erro: 'HTTP ' + r.status + ' (pasta inacessível?)' };
            const d = await r.json();
            return { ok: true, nome: d.name };
        } catch (e) { return { ok: false, erro: e.message || String(e) }; }
    }

    // ── UI de configuração ──
    let UI = null; // { clientId, folderLink, status, ultimaSync, msg, btnSalvar, btnConectar, btnTestar }
    const $ = (id) => document.getElementById(id);
    function msg(t, erro) { if (UI && $(UI.msg)) { $(UI.msg).textContent = t; $(UI.msg).className = 'gd-msg' + (erro ? ' erro' : ' ok'); } }
    function fmt(iso) { if (!iso) return '—'; const d = new Date(iso); return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR'); }
    function statusTxt() {
        if (!creds.clientId) return '⚪ Client ID não informado';
        if (!cfg.folderId) return '🟡 Pasta não configurada';
        if (conectado()) return '🟢 Conectado';
        return '🟡 Configurado (não conectado nesta sessão)';
    }
    function atualizarUI() {
        if (!UI) return;
        if ($(UI.clientId)) $(UI.clientId).value = creds.clientId || '';
        if ($(UI.folderLink)) $(UI.folderLink).value = cfg.folderLink || '';
        if ($(UI.status)) $(UI.status).textContent = statusTxt();
        if ($(UI.ultimaSync)) $(UI.ultimaSync).textContent = fmt(cfg.ultimaSync);
    }

    async function initConfigUI(ids) {
        UI = ids;
        await carregarCreds();
        await carregarCfg();
        atualizarUI();

        $(ids.btnSalvar)?.addEventListener('click', async () => {
            creds.clientId = ($(ids.clientId)?.value || '').trim();
            const link = ($(ids.folderLink)?.value || '').trim();
            if (link) { cfg.folderLink = link; cfg.folderId = extrairFolderId(link); }
            tokenClient = null; // recriar com novo clientId
            await salvarCreds();
            await salvarCfg();
            atualizarUI();
            msg('✓ Configuração salva.');
        });
        $(ids.btnConectar)?.addEventListener('click', async () => {
            if (!creds.clientId) { msg('⚠ Informe o OAuth Client ID antes de conectar.', true); return; }
            try { await pedirToken('consent'); atualizarUI(); msg('🟢 Conectado ao Google Drive.'); }
            catch (e) { msg('⚠ Falha ao conectar: ' + (e.message || e), true); }
        });
        $(ids.btnTestar)?.addEventListener('click', async () => {
            msg('⏳ Testando conexão...');
            const r = await testarConexao();
            atualizarUI();
            if (r.ok) msg('✅ Conexão OK — pasta: ' + (r.nome || cfg.folderId));
            else msg('⚠ Falha no teste: ' + r.erro, true);
        });
    }

    return { carregarCfg, configurado, backup, excluirArquivo, existeArquivo, testarConexao, initConfigUI };
}
