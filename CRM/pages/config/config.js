import { initModulo } from '../../scripts/kernel.js';
import { carregarPermissoes, podeVisualizar } from '../../shared/permissoes.js';
import { serverTimestamp } from "../../firebase/client.js";
import { ConfigRepository as Config } from "../../repositories/sistema.repository.js";
import { getCtxAsync, logout } from "../../scripts/kernel.js";

window.pinPress          = pinPress;
window.pinDelete         = pinDelete;
window.pinNovoPress      = pinNovoPress;
window.pinNovoDelete     = pinNovoDelete;
window.showScreen        = showScreen;
window.sair              = sair;

const PIN_DOC_ID = "pin";
const PIN_CACHE = "cc_pin_hash";

// H-005 (homologação 2026-07-03): era fixo, sem prefixo /dev — mesmo
// critério de detecção já usado em brand-header.js/kernel.js/login.html.
const LOGIN_URL = ((p => (p === '/dev' || p.startsWith('/dev/')) ? '/dev' : '')(location.pathname)) + '/CRM/login.html';

let inputAtual = '';
let inputNovo  = '';
let etapaNovo  = 'digitar';
let pinConfirmBuffer = '';
let pinSalvo = '';
let tentativas = 0;

// ===== INIT =====
// Esta tela nunca autentica por si só — é só um atalho (PIN) sobre uma
// sessão Firebase já real, ou o painel de configurações (PIN/conta de
// sincronização) para quem já está autenticado. Sem sessão real, manda
// direto para o login de e-mail/senha (login.html → kernel.js).
async function init() {
    const timeout = (ms) => new Promise(r => setTimeout(r, ms));

    // Carrega o PIN salvo (cache local + Firestore, com fallback offline)
    try {
        const snap = await Promise.race([
            Config.getById(PIN_DOC_ID),
            timeout(5000).then(() => { throw new Error('timeout'); })
        ]);
        if (snap && snap.pin) {
            pinSalvo = snap.pin;
            localStorage.setItem(PIN_CACHE, pinSalvo);
        } else {
            localStorage.removeItem(PIN_CACHE);
            pinSalvo = '';
        }
    } catch {
        pinSalvo = localStorage.getItem(PIN_CACHE) || '';
    }

    const ctx = await getCtxAsync();
    if (!ctx) {
        window.location.replace(LOGIN_URL);
        return;
    }

    if (pinSalvo) {
        showScreen('pin');
    } else {
        mostrarLogado();
    }
}

function mostrarLogado() {
    showScreen('logado');
    const btnAlt = document.getElementById('btn-alterar');
    if (btnAlt) btnAlt.style.display = 'block';
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
}

// ===== PIN — DIGITAR =====
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
        await Config.set(PIN_DOC_ID, { pin, updatedAt: serverTimestamp() });
        localStorage.setItem(PIN_CACHE, pin);
        pinSalvo = pin;
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

window.redefinirPin = function() {
    localStorage.removeItem(PIN_CACHE);
    pinSalvo = '';
    tentativas = 0;
    document.getElementById('btn-redefinir').style.display = 'none';
    document.getElementById('pin-novo-label').textContent = 'Criar novo PIN';
    showScreen('alterar');
};

// ===== SAIR =====
// Logout real (Firebase) — encerra a sessão de verdade e redireciona
// para o login de e-mail/senha. O PIN local não é apagado: é uma
// configuração da loja, não da pessoa.
async function sair() {
    await logout();
}

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

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
    init();
});
