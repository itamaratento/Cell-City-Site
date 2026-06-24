/**
 * alertas-badge.js — Cell City CRM
 * Monitora alertas_usuario em tempo real e atualiza o sininho global
 * (badge vermelho + som) em qualquer página do sistema.
 */
import { db, auth } from '../scripts/firebase.js';
import {
    collection, query, where, onSnapshot,
} from '../scripts/firebase.js';
import { onAuthStateChanged } from '../scripts/firebase.js';

const COL       = 'alertas_usuario';
const LS_COUNT  = 'cc_alertas_badge_count';
const LS_IDS    = 'cc_alertas_badge_ids';
const CFG_KEY   = 'cc_alertas_config';
let   _unsub    = null;
let   _primeiraVez = true;

function _hoje() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function _agoraHHMM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function _tocarSom() {
    const cfg = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
    if (cfg.somGlobal === false) return;
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx  = new Ctx();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        const vol = parseFloat(localStorage.getItem('cc_sons_volume') || '0.7');
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2 * vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        ctx.resume().then(() => {
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.48);
            osc.onended = () => { try { ctx.close(); } catch {} };
        }).catch(() => {});
    } catch {}
}

function _emit(count, hasNew) {
    localStorage.setItem(LS_COUNT, String(count));

    // Atualiza título da aba: (3) Cell City CRM
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = count > 0 ? `(${count}) ${base}` : base;

    // Evento para brand-header.js
    window.dispatchEvent(new CustomEvent('cc-alertas-badge', {
        detail: { count, hasNew },
    }));

    if (hasNew && !_primeiraVez) {
        _tocarSom();
    }
    _primeiraVez = false;
}

function _iniciar(user) {
    if (_unsub) { _unsub(); _unsub = null; }
    if (!user) {
        localStorage.setItem(LS_COUNT, '0');
        window.dispatchEvent(new CustomEvent('cc-alertas-badge', { detail: { count: 0, hasNew: false } }));
        return;
    }

    const q = query(collection(db, COL), where('status', '==', 'pendente'));

    _unsub = onSnapshot(q, snap => {
        const hj = _hoje();
        const hm = _agoraHHMM();
        const dueIds = new Set();

        snap.forEach(d => {
            const a = d.data();
            const dataEf = a.data || '';
            // Vencido (data < hoje) OU vence hoje com hora <= agora
            if (dataEf < hj || (dataEf === hj && (a.hora || '00:00') <= hm)) {
                dueIds.add(d.id);
            }
        });

        const count = dueIds.size;
        const prevIds = new Set(JSON.parse(localStorage.getItem(LS_IDS) || '[]'));
        const hasNew  = [...dueIds].some(id => !prevIds.has(id));

        localStorage.setItem(LS_IDS, JSON.stringify([...dueIds]));
        _emit(count, hasNew);

    }, () => {
        // Firestore falhou → fallback para localStorage
        const saved = parseInt(localStorage.getItem(LS_COUNT) || '0', 10);
        _emit(saved, false);
    });
}

export function iniciarBadgeAlertas() {
    // Lê o cache imediatamente para mostrar o badge sem esperar Firebase
    const cached = parseInt(localStorage.getItem(LS_COUNT) || '0', 10);
    if (cached > 0) _emit(cached, false);

    onAuthStateChanged(auth, _iniciar);
}
