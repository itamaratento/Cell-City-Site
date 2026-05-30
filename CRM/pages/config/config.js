import { db, doc, getDoc, setDoc, serverTimestamp } from "../../scripts/firebase.js";

window.pinPress     = pinPress;
window.pinDelete    = pinDelete;
window.pinNovoPress = pinNovoPress;
window.pinNovoDelete = pinNovoDelete;
window.showScreen   = showScreen;
window.sair         = sair;

const PIN_DOC   = doc(db, "config", "pin");
const PIN_CACHE = "cc_pin_hash";
const SESSION_KEY = "cc_acesso";

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
    } else {
        showScreen('login');
        document.getElementById('btn-alterar').style.display = 'none';
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

document.addEventListener('DOMContentLoaded', init);
