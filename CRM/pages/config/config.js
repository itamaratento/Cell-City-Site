import { db, doc, getDoc, setDoc, serverTimestamp } from "../../scripts/firebase.js";

window.pinPress          = pinPress;
window.pinDelete         = pinDelete;
window.pinNovoPress      = pinNovoPress;
window.pinNovoDelete     = pinNovoDelete;
window.showScreen        = showScreen;
window.sair              = sair;
window.entrarComDispositivo = entrarComDispositivo;
window.toggleDispositivo    = toggleDispositivo;

const PIN_DOC   = doc(db, "config", "pin");
const PIN_CACHE = "cc_pin_hash";
const SESSION_KEY = "cc_acesso";
const USAR_DISPOSITIVO_KEY = "cc_usar_dispositivo"; // preferência só neste aparelho

function dispositivoAtivado() {
    return localStorage.getItem(USAR_DISPOSITIVO_KEY) === '1';
}

let inputAtual = '';
let inputNovo  = '';
let etapaNovo  = 'digitar';
let pinConfirmBuffer = '';
let pinSalvo = '';
let tentativas = 0;

// ===== INIT =====
async function init() {
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
    }
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
    if (name === 'alterar') {
        document.getElementById('pin-novo-label').textContent = pinSalvo ? 'Digite o novo PIN' : 'Criar PIN de acesso';
    }
    if (name === 'logado') {
        sincronizarToggleDispositivo();
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

function sair() {
    sessionStorage.removeItem(SESSION_KEY);
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

async function registrarWebAuthn() {
    const cred = await navigator.credentials.create({
        publicKey: {
            challenge:  _randomBytes(32),
            rp:         { name: 'Cell City CRM', id: location.hostname },
            user:       { id: WA_USER_ID, name: 'celicity', displayName: 'Cell City' },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                residentKey: 'preferred',
            },
            timeout: 60000,
        }
    });
    localStorage.setItem(WA_CRED_KEY, _b64url(cred.rawId));
    return true;
}

async function autenticarWebAuthn() {
    const credId = localStorage.getItem(WA_CRED_KEY);
    const allowCreds = credId
        ? [{ type: 'public-key', id: _fromB64url(credId), transports: ['internal'] }]
        : [];

    await navigator.credentials.get({
        publicKey: {
            challenge:        _randomBytes(32),
            rpId:             location.hostname,
            allowCredentials: allowCreds,
            userVerification: 'required',
            timeout:          60000,
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
    try {
        await registrarWebAuthn();
        localStorage.setItem(USAR_DISPOSITIVO_KEY, '1');
    } catch (e) {
        localStorage.removeItem(USAR_DISPOSITIVO_KEY);
        localStorage.removeItem(WA_CRED_KEY);
        if (status) status.textContent = e.name === 'NotAllowedError'
            ? 'Cancelado. A opção continua desativada.'
            : 'Não foi possível ativar neste aparelho.';
        console.warn('Ativar dispositivo:', e);
    } finally {
        if (toggle) toggle.classList.remove('loading');
        sincronizarToggleDispositivo();
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

    try {
        const temCredencial = !!localStorage.getItem(WA_CRED_KEY);

        if (!temCredencial) {
            // Primeiro uso — registra a credencial do dispositivo
            await registrarWebAuthn();
        }

        // Autentica com o dispositivo
        await autenticarWebAuthn();

        // Sucesso — libera acesso
        sessionStorage.setItem(SESSION_KEY, 'ok');
        showScreen('logado');
        document.getElementById('btn-alterar').style.display = 'block';

    } catch (e) {
        if (e.name === 'NotAllowedError') {
            showError('pin-error', 'Autenticação cancelada.');
        } else if (e.name === 'InvalidStateError') {
            // Credencial inválida — remove e pede novo registro
            localStorage.removeItem(WA_CRED_KEY);
            showError('pin-error', 'Credencial expirada. Tente novamente.');
        } else {
            showError('pin-error', 'Use o PIN acima.');
            console.warn('WebAuthn:', e);
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', init);
