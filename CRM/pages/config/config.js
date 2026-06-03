import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp, authReady } from "../../scripts/firebase.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const auth = getAuth();

window.pinPress          = pinPress;
window.pinDelete         = pinDelete;
window.pinNovoPress      = pinNovoPress;
window.pinNovoDelete     = pinNovoDelete;
window.showScreen        = showScreen;
window.sair              = sair;
window.entrarComDispositivo = entrarComDispositivo;
<<<<<<< HEAD
window.fazerLogin        = fazerLogin;
window.criarAcesso       = criarAcesso;
window.desconectarTodos  = desconectarTodos;
window.removerDispositivo = removerDispositivo;
=======
window.toggleDispositivo    = toggleDispositivo;
>>>>>>> 3c2338f7dc2684ddb5f44deea6bb936ed74e7740

const PIN_DOC   = doc(db, "config", "pin");
const ACESSO_DOC = doc(db, "config", "acesso");
const PIN_CACHE = "cc_pin_hash";
const ACESSO_FLAG = "cc_acesso_set"; // flag local: acesso já foi configurado
const SESSION_KEY = "cc_acesso";
const USAR_DISPOSITIVO_KEY = "cc_usar_dispositivo"; // preferência só neste aparelho

function dispositivoAtivado() {
    return localStorage.getItem(USAR_DISPOSITIVO_KEY) === '1';
}

// Token de dispositivo (lembrar por 90 dias)
const DEV_ID_KEY    = "cc_dev_id";
const DEV_TOKEN_KEY = "cc_dev_token";
const DEV_DIAS      = 90;
const DEV_MS        = DEV_DIAS * 24 * 60 * 60 * 1000;

let acessoCfg = null; // { usuario, senhaHash, salt } carregado do Firestore

let inputAtual = '';
let inputNovo  = '';
let etapaNovo  = 'digitar';
let pinConfirmBuffer = '';
let pinSalvo = '';
let tentativas = 0;

// ===== INIT =====
async function init() {
    // Carrega o PIN (mantido — não removido)
    try {
        const snap = await getDoc(PIN_DOC);
        if (snap.exists() && snap.data().pin) {
            pinSalvo = snap.data().pin;
            localStorage.setItem(PIN_CACHE, pinSalvo);
        } else {
            localStorage.removeItem(PIN_CACHE);
            pinSalvo = '';
        }
    } catch {
        pinSalvo = localStorage.getItem(PIN_CACHE) || '';
    }

<<<<<<< HEAD
    // Carrega a configuração de acesso (usuário + senha)
    let leituraOk = true;
    try {
        const snap = await getDoc(ACESSO_DOC);
        acessoCfg = (snap.exists() && snap.data().usuario) ? snap.data() : null;
        if (acessoCfg) localStorage.setItem(ACESSO_FLAG, '1');
    } catch {
        leituraOk = false; // offline — não sabemos se existe
        acessoCfg = null;
=======
    if (!pinSalvo) {
        // Nunca configurou PIN — vai direto para criar
        document.getElementById('pin-novo-label').textContent = 'Criar PIN de acesso';
        showScreen('alterar');
    } else if (sessionStorage.getItem(SESSION_KEY) === 'ok') {
        // Já autenticado nesta sessão
        showScreen('logado');
        document.getElementById('btn-alterar').style.display = 'block';
        sincronizarToggleDispositivo();
    } else {
        showScreen('login');
        document.getElementById('btn-alterar').style.display = 'none';

        // Botão do dispositivo só aparece se a opção estiver ATIVADA e o navegador suportar
        if (window.PublicKeyCredential && dispositivoAtivado()) {
            const btn = document.getElementById('btn-device');
            if (btn) btn.style.display = 'flex';

            // Se já tem credencial registrada, autentica direto ao abrir
            if (localStorage.getItem(WA_CRED_KEY)) {
                entrarComDispositivo();
            }
        }
>>>>>>> 3c2338f7dc2684ddb5f44deea6bb936ed74e7740
    }

    // 1º uso: só mostra "criar acesso" se a leitura funcionou, o doc não existe
    // e nunca foi configurado antes (flag local evita sobrescrever offline).
    if (leituraOk && !acessoCfg && localStorage.getItem(ACESSO_FLAG) !== '1') {
        showScreen('criar-acesso');
        return;
    }

    // Já autenticado nesta sessão
    if (sessionStorage.getItem(SESSION_KEY) === 'ok') {
        signInAnonymously(auth).catch(() => {});
        mostrarLogado();
        return;
    }

    // Dispositivo lembrado? Tenta auto-login e vai direto ao Dashboard.
    if (await autoLoginDispositivo()) {
        sessionStorage.setItem(SESSION_KEY, 'ok');
        irParaDashboard();
        return;
    }

    // Caso contrário, tela de login (usuário + senha)
    showScreen('login');
}

function mostrarLogado() {
    showScreen('logado');
    const btnAlt = document.getElementById('btn-alterar');
    if (btnAlt) btnAlt.style.display = 'block';
}

function irParaDashboard() {
    window.location.href = '/CRM/pages/dashboard/index.html';
}

// ===== NAVEGAÇÃO =====
function showScreen(name) {
    document.querySelectorAll('.pin-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${name}`).classList.add('active');
    inputAtual = '';
    inputNovo  = '';
    etapaNovo  = 'digitar';
    pinConfirmBuffer = '';
    updateDots('pin-dots', 0);
    updateDots('pin-novo-dots', 0);
    clearError('pin-error');
    clearError('pin-novo-error');
    clearError('login-error');
    clearError('ca-error');
    if (name === 'alterar') {
        document.getElementById('pin-novo-label').textContent = pinSalvo ? 'Digite o novo PIN' : 'Criar PIN de acesso';
    }
<<<<<<< HEAD
    if (name === 'dispositivos') {
        listarDispositivos();
=======
    if (name === 'logado') {
        sincronizarToggleDispositivo();
>>>>>>> 3c2338f7dc2684ddb5f44deea6bb936ed74e7740
    }
}

// ===== LOGIN =====
function pinPress(d) {
    if (inputAtual.length >= 4) return;
    inputAtual += d;
    updateDots('pin-dots', inputAtual.length);
    clearError('pin-error');
    if (inputAtual.length === 4) setTimeout(verificarPin, 150);
}

function pinDelete() {
    inputAtual = inputAtual.slice(0, -1);
    updateDots('pin-dots', inputAtual.length);
    clearError('pin-error');
}

async function verificarPin() {
    if (inputAtual === pinSalvo) {
        tentativas = 0;
        sessionStorage.setItem(SESSION_KEY, 'ok');
        signInAnonymously(auth).catch(() => {});
        showScreen('logado');
        document.getElementById('btn-alterar').style.display = 'block';
    } else {
        tentativas++;
        showError('pin-error', `PIN incorreto${tentativas >= 3 ? ' — use Redefinir PIN abaixo' : ''}`);
        dotError('pin-dots');
        if (tentativas >= 3) {
            const btn = document.getElementById('btn-redefinir');
            if (btn) btn.style.display = 'block';
        }
        setTimeout(() => {
            inputAtual = '';
            updateDots('pin-dots', 0);
            clearError('pin-error');
        }, 800);
    }
}

// ===== CRIAR / ALTERAR PIN =====
function pinNovoPress(d) {
    if (inputNovo.length >= 4) return;
    inputNovo += d;
    updateDots('pin-novo-dots', inputNovo.length);
    clearError('pin-novo-error');
    if (inputNovo.length === 4) setTimeout(processarNovo, 150);
}

function pinNovoDelete() {
    inputNovo = inputNovo.slice(0, -1);
    updateDots('pin-novo-dots', inputNovo.length);
    clearError('pin-novo-error');
}

async function processarNovo() {
    if (etapaNovo === 'digitar') {
        pinConfirmBuffer = inputNovo;
        inputNovo = '';
        etapaNovo = 'confirmar';
        document.getElementById('pin-novo-label').textContent = 'Confirme o novo PIN';
        updateDots('pin-novo-dots', 0);
    } else {
        if (inputNovo === pinConfirmBuffer) {
            await salvarPin(inputNovo);
        } else {
            showError('pin-novo-error', 'PINs não conferem. Tente novamente.');
            dotError('pin-novo-dots');
            setTimeout(() => {
                inputNovo = '';
                pinConfirmBuffer = '';
                etapaNovo = 'digitar';
                document.getElementById('pin-novo-label').textContent = 'Digite o novo PIN';
                updateDots('pin-novo-dots', 0);
                clearError('pin-novo-error');
            }, 900);
        }
    }
}

async function salvarPin(pin) {
    try {
        await setDoc(PIN_DOC, { pin, updatedAt: serverTimestamp() });
        localStorage.setItem(PIN_CACHE, pin);
        pinSalvo = pin;
        sessionStorage.setItem(SESSION_KEY, 'ok');
        signInAnonymously(auth).catch(() => {});
        showScreen('logado');
        document.getElementById('btn-alterar').style.display = 'block';
    } catch (err) {
        console.error('❌ Erro ao salvar PIN:', err);
        showError('pin-novo-error', 'Erro ao salvar. Tente novamente.');
        inputNovo = '';
        etapaNovo = 'digitar';
        updateDots('pin-novo-dots', 0);
    }
}

async function sair() {
    sessionStorage.removeItem(SESSION_KEY);
    // Encerra o "lembrar" deste aparelho: remove o token local e o doc remoto,
    // senão o auto-login reconectaria sozinho no próximo carregamento.
    const id = localStorage.getItem(DEV_ID_KEY);
    _limparTokenLocal();
    if (id) {
        try { await authReady; await deleteDoc(doc(db, 'dispositivos', id)); } catch {}
    }
    showScreen('login');
    document.getElementById('btn-alterar').style.display = 'none';
}

window.redefinirPin = function() {
    localStorage.removeItem(PIN_CACHE);
    pinSalvo = '';
    tentativas = 0;
    document.getElementById('btn-redefinir').style.display = 'none';
    document.getElementById('pin-novo-label').textContent = 'Criar novo PIN';
    showScreen('alterar');
};

// ===== UTILS =====
function updateDots(id, count) {
    const dots = document.querySelectorAll(`#${id} .pin-dot`);
    dots.forEach((d, i) => {
        d.classList.toggle('filled', i < count);
        d.classList.remove('error');
    });
}

function dotError(id) {
    document.querySelectorAll(`#${id} .pin-dot`).forEach(d => {
        d.classList.remove('filled');
        d.classList.add('error');
    });
}

function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
}

function clearError(id) {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
}

// ═══════════════════════════════════════════
// ACESSO — Usuário + Senha (login principal)
// ═══════════════════════════════════════════

// SHA-256 → hex (para hash de senha e de token; nunca guarda texto puro)
async function _sha256hex(str) {
    const data = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function _randomToken() {
    const buf = new Uint8Array(32);
    crypto.getRandomValues(buf);
    return [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
}

// 1º uso: define usuário e senha
async function criarAcesso() {
    const u  = (document.getElementById('ca-user').value || '').trim().toLowerCase();
    const p  = document.getElementById('ca-pass').value || '';
    const p2 = document.getElementById('ca-pass2').value || '';

    if (u.length < 3)            return showError('ca-error', 'Usuário deve ter ao menos 3 caracteres.');
    if (p.length < 4)            return showError('ca-error', 'Senha deve ter ao menos 4 caracteres.');
    if (p !== p2)                return showError('ca-error', 'As senhas não conferem.');

    try {
        await authReady;
        const salt = _randomToken();
        const senhaHash = await _sha256hex(salt + p);
        const cfg = { usuario: u, senhaHash, salt, updatedAt: serverTimestamp() };
        await setDoc(ACESSO_DOC, cfg);
        acessoCfg = cfg;
        localStorage.setItem(ACESSO_FLAG, '1');
        sessionStorage.setItem(SESSION_KEY, 'ok');
        mostrarLogado();
    } catch (err) {
        console.error('Erro ao criar acesso:', err);
        showError('ca-error', 'Erro ao salvar. Tente novamente.');
    }
}

// Login com usuário + senha
async function fazerLogin() {
    const u = (document.getElementById('login-user').value || '').trim().toLowerCase();
    const p = document.getElementById('login-pass').value || '';
    const lembrar = document.getElementById('login-lembrar').checked;

    if (!u || !p) return showError('login-error', 'Preencha usuário e senha.');

    const btn = document.getElementById('btn-login');
    if (btn) btn.disabled = true;
    clearError('login-error');

    try {
        await authReady;
        // Recarrega config caso tenha mudado em outro dispositivo
        if (!acessoCfg) {
            const snap = await getDoc(ACESSO_DOC);
            acessoCfg = snap.exists() ? snap.data() : null;
        }
        if (!acessoCfg) { showError('login-error', 'Acesso não configurado.'); return; }

        const hash = await _sha256hex((acessoCfg.salt || '') + p);
        if (u !== acessoCfg.usuario || hash !== acessoCfg.senhaHash) {
            showError('login-error', 'Usuário ou senha incorretos.');
            return;
        }

        sessionStorage.setItem(SESSION_KEY, 'ok');

        if (lembrar) {
            await registrarDispositivo();
            irParaDashboard();
        } else {
            mostrarLogado();
        }
    } catch (err) {
        console.error('Erro no login:', err);
        showError('login-error', 'Erro ao entrar. Tente novamente.');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ═══════════════════════════════════════════
// DISPOSITIVOS LEMBRADOS (token 90 dias)
// ═══════════════════════════════════════════

// Nome amigável do aparelho a partir do User-Agent
function _nomeDispositivo() {
    const ua = navigator.userAgent || '';
    // Android: tenta extrair o modelo (ex.: "Moto G54", "SM-A155M")
    let m = ua.match(/Android[^;]*;\s*([^)]+?)(?:\s+Build|\))/i);
    if (m && m[1]) {
        let nome = m[1].replace(/;.*$/, '').trim();
        if (nome && !/^wv$/i.test(nome)) return nome.slice(0, 40);
    }
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua))   return 'iPad';
    if (/Windows/i.test(ua)) return 'PC Windows';
    if (/Macintosh/i.test(ua)) return 'Mac';
    if (/Linux/i.test(ua)) return 'PC Linux';
    return 'Dispositivo';
}

// Cria o token deste dispositivo e grava no Firestore (hash) + localStorage (segredo)
async function registrarDispositivo() {
    try {
        await authReady;
        const token = _randomToken();
        const id = _randomToken().slice(0, 20);
        const tokenHash = await _sha256hex(id + token);
        await setDoc(doc(db, 'dispositivos', id), {
            nome: _nomeDispositivo(),
            tokenHash,
            userAgent: navigator.userAgent || '',
            criadoEm: serverTimestamp(),
            expiraEm: Date.now() + DEV_MS,
            ultimoAcesso: serverTimestamp(),
        });
        localStorage.setItem(DEV_ID_KEY, id);
        localStorage.setItem(DEV_TOKEN_KEY, token);
    } catch (err) {
        console.warn('Não foi possível lembrar o dispositivo:', err);
    }
}

// Tenta autenticar pelo token salvo. Retorna true se válido.
async function autoLoginDispositivo() {
    const id = localStorage.getItem(DEV_ID_KEY);
    const token = localStorage.getItem(DEV_TOKEN_KEY);
    if (!id || !token) return false;

    try {
        await authReady;
        const snap = await getDoc(doc(db, 'dispositivos', id));
        if (!snap.exists()) { _limparTokenLocal(); return false; } // removido remotamente

        const d = snap.data();
        // Expirado?
        if (d.expiraEm && Date.now() > d.expiraEm) {
            await deleteDoc(doc(db, 'dispositivos', id)).catch(() => {});
            _limparTokenLocal();
            return false;
        }
        // Token confere?
        const hash = await _sha256hex(id + token);
        if (hash !== d.tokenHash) { _limparTokenLocal(); return false; }

        // Renova último acesso (e estende validade) sem bloquear o login
        updateDoc(doc(db, 'dispositivos', id), {
            ultimoAcesso: serverTimestamp(),
            expiraEm: Date.now() + DEV_MS,
        }).catch(() => {});
        return true;
    } catch (err) {
        console.warn('Auto-login indisponível (offline?):', err);
        return false;
    }
}

function _limparTokenLocal() {
    localStorage.removeItem(DEV_ID_KEY);
    localStorage.removeItem(DEV_TOKEN_KEY);
}

// Renderiza a lista de dispositivos autorizados
async function listarDispositivos() {
    const lista = document.getElementById('disp-lista');
    if (!lista) return;
    lista.innerHTML = '<div class="cc-dev-empty">Carregando…</div>';
    clearError('disp-error');

    try {
        await authReady;
        const snap = await getDocs(collection(db, 'dispositivos'));
        const meuId = localStorage.getItem(DEV_ID_KEY);
        const itens = [];
        snap.forEach(docu => itens.push({ id: docu.id, ...docu.data() }));

        if (itens.length === 0) {
            lista.innerHTML = '<div class="cc-dev-empty">Nenhum dispositivo lembrado.</div>';
            return;
        }

        itens.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
        lista.innerHTML = itens.map(it => {
            const atual = it.id === meuId;
            const exp = it.expiraEm ? new Date(it.expiraEm).toLocaleDateString('pt-BR') : '—';
            const nome = _escapeHtml(it.nome || 'Dispositivo');
            return `
                <div class="cc-dev-item${atual ? ' atual' : ''}">
                    <div class="cc-dev-info">
                        <div class="cc-dev-nome">${nome}${atual ? ' <span class="cc-dev-tag">• este aparelho</span>' : ''}</div>
                        <div class="cc-dev-meta">Expira em ${exp}</div>
                    </div>
                    <button class="cc-dev-x" title="Remover" onclick="removerDispositivo('${it.id}')">✕</button>
                </div>`;
        }).join('');
    } catch (err) {
        console.error('Erro ao listar dispositivos:', err);
        lista.innerHTML = '';
        showError('disp-error', 'Erro ao carregar dispositivos.');
    }
}

function _escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Remove um dispositivo (desconecta remotamente)
async function removerDispositivo(id) {
    try {
        await authReady;
        await deleteDoc(doc(db, 'dispositivos', id));
        if (id === localStorage.getItem(DEV_ID_KEY)) _limparTokenLocal();
        listarDispositivos();
    } catch (err) {
        console.error('Erro ao remover dispositivo:', err);
        showError('disp-error', 'Erro ao remover. Tente novamente.');
    }
}

// Desconecta TODOS os dispositivos
async function desconectarTodos() {
    if (!confirm('Desconectar todos os dispositivos? Todos precisarão entrar novamente com usuário e senha.')) return;
    try {
        await authReady;
        const snap = await getDocs(collection(db, 'dispositivos'));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'dispositivos', d.id)).catch(() => {})));
        _limparTokenLocal();
        listarDispositivos();
    } catch (err) {
        console.error('Erro ao desconectar todos:', err);
        showError('disp-error', 'Erro ao desconectar. Tente novamente.');
    }
}

// ═══════════════════════════════════════════
// WEBAUTHN — Senha/Digital/PIN do dispositivo
// ═══════════════════════════════════════════
const WA_CRED_KEY = 'cc_wa_credId';
const WA_USER_ID  = new TextEncoder().encode('cellcity-crm-user');

function _randomBytes(n) {
    const buf = new Uint8Array(n);
    crypto.getRandomValues(buf);
    return buf;
}

function _b64url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

function _fromB64url(str) {
    const b64 = str.replace(/-/g,'+').replace(/_/g,'/');
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// rp.id = exatamente o host atual (ponto 10). Para a passkey funcionar,
// o registro e a autenticação precisam ocorrer SEMPRE no mesmo domínio
// (ex.: www.cellcityinformatica.com.br). Não misture www / apex / web.app.
function _rpId() {
    return location.hostname;
}

// Detecta navegadores internos (WebView) de apps como Instagram, Facebook,
// etc. Neles o navigator.credentials.create() é bloqueado com NotAllowedError
// mesmo que isUserVerifyingPlatformAuthenticatorAvailable() retorne true.
function _navegadorInterno() {
    const ua = navigator.userAgent || '';
    return /(Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|MicroMessenger|GSA\/|musical_ly|Twitter|TikTok)/i.test(ua);
}

async function registrarWebAuthn() {
<<<<<<< HEAD
    const opts = {
=======
    // Se já existe uma credencial neste aparelho, exclui da criação para
    // evitar o "UnknownError / transient reason" em tentativas repetidas.
    const credExistente = localStorage.getItem(WA_CRED_KEY);
    const excludeCredentials = credExistente
        ? [{ type: 'public-key', id: _fromB64url(credExistente), transports: ['internal'] }]
        : [];

    const cred = await navigator.credentials.create({
>>>>>>> 3c2338f7dc2684ddb5f44deea6bb936ed74e7740
        publicKey: {
            challenge:  _randomBytes(32),
            rp:         { name: 'Cell City CRM', id: _rpId() },
            user:       { id: WA_USER_ID, name: 'cellcity', displayName: 'Cell City' },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
<<<<<<< HEAD
                // 'discouraged' = credencial vinculada ao aparelho (usa a
                // biometria/PIN/padrão da tela de bloqueio) e evita o fluxo
                // de passkey sincronizada do Google Password Manager, que é
                // onde muitos Android falham com NotAllowedError no registro.
                residentKey: 'discouraged',
            },
            timeout: 120000,
=======
                residentKey: 'discouraged',  // não precisamos de credencial residente — guardamos o credId nós mesmos
            },
            excludeCredentials,
            timeout: 60000,
>>>>>>> 3c2338f7dc2684ddb5f44deea6bb936ed74e7740
        }
    };
    console.log('[WebAuthn] create() opts:', JSON.parse(JSON.stringify(opts.publicKey, (k, v) =>
        v instanceof Uint8Array ? `Uint8Array(${v.length})` : v)));

    // Ponto 7: marca o instante imediatamente antes de abrir a janela nativa.
    console.log('[WebAuthn] >>> abrindo janela nativa do Android (create)…', Date.now());
    const cred = await navigator.credentials.create(opts);
    // Ponto 5: objeto completo retornado pelo navegador.
    console.log('[WebAuthn] <<< credencial criada:', cred, {
        id: cred && cred.id,
        type: cred && cred.type,
        authenticatorAttachment: cred && cred.authenticatorAttachment,
        rawIdLen: cred && cred.rawId && cred.rawId.byteLength,
    });
    localStorage.setItem(WA_CRED_KEY, _b64url(cred.rawId));
    return true;
}

async function autenticarWebAuthn() {
    const credId = localStorage.getItem(WA_CRED_KEY);
    // Sem 'transports' fixos: passkeys sincronizadas no Android usam
    // 'hybrid'/'internal'; restringir a 'internal' impede o uso.
    const allowCreds = credId
        ? [{ type: 'public-key', id: _fromB64url(credId) }]
        : [];

    await navigator.credentials.get({
        publicKey: {
            challenge:        _randomBytes(32),
            rpId:             _rpId(),
            allowCredentials: allowCreds,
            userVerification: 'required',
            timeout:          120000,
        }
    });
    return true;
}

// ===== TOGGLE "Usar senha do dispositivo" (tela Segurança) =====
function sincronizarToggleDispositivo() {
    const row    = document.getElementById('seg-device-row');
    const toggle = document.getElementById('seg-device-toggle');
    const status = document.getElementById('seg-device-status');
    if (!row || !toggle) return;

    // Só faz sentido se o navegador suportar autenticação do dispositivo
    if (!window.PublicKeyCredential) {
        row.style.display = 'none';
        return;
    }
    row.style.display = 'flex';

    const ativo = dispositivoAtivado();
    toggle.classList.toggle('on', ativo);
    if (status) status.textContent = ativo
        ? 'Ativado — entra com biometria/senha do aparelho.'
        : 'Desativado — usa o PIN do CRM.';
}

// ===== Painel de diagnóstico on-screen =====
function _diagReset() {
    const box = document.getElementById('seg-device-diag');
    if (box) { box.style.display = 'block'; box.innerHTML = '🔎 Diagnóstico WebAuthn\n'; }
}
function _diagLine(label, valor, classe) {
    const box = document.getElementById('seg-device-diag');
    if (!box) return;
    const cls = classe ? ` class="${classe}"` : '';
    const v = (valor === undefined || valor === null) ? '—' : String(valor);
    box.innerHTML += `<span${cls}>• ${label}: ${v}</span>\n`;
}

async function toggleDispositivo() {
    const toggle = document.getElementById('seg-device-toggle');
    const status = document.getElementById('seg-device-status');
    if (!window.PublicKeyCredential) {
        if (status) status.textContent = 'Seu navegador não suporta autenticação do dispositivo.';
        return;
    }

    if (dispositivoAtivado()) {
        // Desativar — volta a usar o PIN do CRM
        localStorage.removeItem(USAR_DISPOSITIVO_KEY);
        localStorage.removeItem(WA_CRED_KEY);
        sincronizarToggleDispositivo();
        return;
    }

    // Ativar — registra a credencial do aparelho agora para confirmar que funciona
    if (toggle) toggle.classList.add('loading');
    if (status) status.textContent = 'Confirme com a biometria/senha do aparelho...';

    // ── DIAGNÓSTICO ──
    let etapa = 'verificação';
    _diagReset();
    _diagLine('Domínio (rp.id)', location.hostname);
    const credAnterior = localStorage.getItem(WA_CRED_KEY);
    _diagLine('Credencial/passkey anterior', credAnterior ? 'SIM (já registrada neste app)' : 'não', credAnterior ? 'diag-ok' : '');

    try {
        // (1) Verificação — autenticador de plataforma disponível?
        let uvpaa = 'indisponível';
        try {
            uvpaa = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch (errUv) {
            uvpaa = `erro: ${errUv.name}`;
        }
        _diagLine('isUserVerifyingPlatformAuthenticatorAvailable()', uvpaa, uvpaa === true ? 'diag-ok' : 'diag-err');

        // (2) Registro
        etapa = 'registro';
        await registrarWebAuthn();
        _diagLine('Registro (credentials.create)', 'OK', 'diag-ok');

        localStorage.setItem(USAR_DISPOSITIVO_KEY, '1');
        if (toggle) toggle.classList.remove('loading');
        sincronizarToggleDispositivo();   // sucesso — atualiza o switch para "Ativado"
    } catch (e) {
        localStorage.removeItem(USAR_DISPOSITIVO_KEY);
        localStorage.removeItem(WA_CRED_KEY);
        console.warn('Ativar dispositivo:', e);
        if (toggle) {
            toggle.classList.remove('loading');
            toggle.classList.remove('on');
        }
        // Diagnóstico cru, sem agrupar casos
        _diagLine('Etapa que falhou', etapa, 'diag-err');
        _diagLine('e.name', e && e.name, 'diag-err');
        _diagLine('e.message', e && e.message, 'diag-err');

        if (status) {
            if (e.name === 'InvalidStateError')      status.textContent = 'Já existe uma passkey deste app neste aparelho. Use "Redefinir" ou remova a passkey antiga.';
            else if (e.name === 'NotAllowedError')   status.textContent = 'Não autorizado (cancelado, timeout ou conflito). Veja o diagnóstico abaixo.';
            else if (e.name === 'NotSupportedError') status.textContent = 'Este aparelho não tem biometria/PIN compatível.';
            else if (e.name === 'SecurityError')     status.textContent = 'Erro de segurança (domínio). Acesse pelo site oficial em HTTPS.';
            else status.textContent = `Falha na etapa de ${etapa}. Veja o diagnóstico abaixo.`;
        }
    }
}

async function entrarComDispositivo() {
    if (!window.PublicKeyCredential) {
        showError('pin-error', 'Seu navegador não suporta autenticação do dispositivo.');
        return;
    }

    const btn = document.getElementById('btn-device');
    if (btn) btn.disabled = true;
    clearError('pin-error');

    // Diagnóstico de ambiente (ponto 6 / 8) — visível também no Android.
    const standalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
    console.log('[WebAuthn] Ambiente:', {
        secureContext: window.isSecureContext,
        emIframe: window.top !== window.self,
        standalone,
        hostname: location.hostname,
        rpId: _rpId(),
        origin: location.origin,
        ua: navigator.userAgent,
    });

    if (!window.isSecureContext) {
        showError('pin-error', 'Conexão não segura (sem HTTPS). A senha do dispositivo exige HTTPS.');
        if (btn) btn.disabled = false;
        return;
    }

    if (_navegadorInterno()) {
        showError('pin-error', 'Abra no Chrome para usar a senha do dispositivo. No menu ⋮ toque em "Abrir no Chrome" (o navegador interno do app bloqueia a biometria).');
        if (btn) btn.disabled = false;
        return;
    }

    let etapa = 'registro';
    const t0 = Date.now();
    try {
        const temCredencial = !!localStorage.getItem(WA_CRED_KEY);

        if (!temCredencial) {
            // Primeiro uso — registra a credencial do dispositivo
            etapa = 'registro';
            await registrarWebAuthn();
        }

        // Autentica com o dispositivo
        etapa = 'autenticação';
        await autenticarWebAuthn();

        // Sucesso — libera acesso
        sessionStorage.setItem(SESSION_KEY, 'ok');
        signInAnonymously(auth).catch(() => {});
        showScreen('logado');
        document.getElementById('btn-alterar').style.display = 'block';

    } catch (e) {
        const ms = Date.now() - t0;
        // Falha em < 1.2s = a tela nativa do Android provavelmente NEM ABRIU
        // (problema de configuração/ambiente), não foi cancelamento do usuário.
        const naoAbriu = ms < 1200;

        // Capacidades reportadas pelo próprio Chrome (sem await ANTES do
        // create(), para não consumir o gesto do usuário). Isso revela se o
        // Android tem um autenticador de plataforma utilizável (Google Play
        // Services + conta Google + bloqueio de tela).
        let caps = null, condMediation = null;
        try {
            if (PublicKeyCredential.getClientCapabilities) {
                caps = await PublicKeyCredential.getClientCapabilities();
            }
            if (PublicKeyCredential.isConditionalMediationAvailable) {
                condMediation = await PublicKeyCredential.isConditionalMediationAvailable();
            }
        } catch (_) { /* navegador antigo */ }

        // Log COMPLETO do erro para diagnóstico (ponto 7 / 8).
        console.error(`[WebAuthn] Falhou na etapa "${etapa}" após ${ms}ms:`, {
            name: e && e.name,
            message: e && e.message,
            code: e && e.code,
            etapa,
            ms,
            telaNativaAbriu: !naoAbriu,
            clientCapabilities: caps,
            conditionalMediation: condMediation,
            rpId: _rpId(),
            hostname: location.hostname,
            origin: location.origin,
            tinhaCredencial: !!localStorage.getItem(WA_CRED_KEY),
            erro: e,
        });

        if (e.name === 'NotAllowedError') {
            if (etapa === 'autenticação') {
                // Passkey não encontrada para este rp.id (ex.: registrada em
                // outro domínio) — limpa para forçar novo registro na próxima.
                localStorage.removeItem(WA_CRED_KEY);
            }
            const dica = naoAbriu
                ? 'A tela do aparelho não abriu. Verifique se o aparelho tem conta Google ativa, bloqueio de tela (biometria/PIN/padrão) e o Google atualizado.'
                : 'Cancelado ou expirou. Toque novamente e confirme a biometria/PIN do aparelho.';
            showError('pin-error', `Falha no ${etapa}: ${dica}`);
        } else if (e.name === 'InvalidStateError') {
            showError('pin-error', 'Este dispositivo já está registrado. Toque novamente para entrar.');
        } else if (e.name === 'SecurityError') {
            showError('pin-error', `Domínio incompatível (rp.id="${_rpId()}"). Use o PIN acima.`);
        } else {
            showError('pin-error', `Erro (${e.name || 'desconhecido'}): ${e.message || ''}. Use o PIN acima.`);
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', init);
