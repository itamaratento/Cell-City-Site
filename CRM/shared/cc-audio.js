/**
 * cc-audio.js — Cell City Gestão Empresarial
 * Módulo centralizado de áudio e log de eventos sonoros/notificações.
 *
 * TODOS os sons e notificações do sistema devem passar por aqui.
 * - Controla permissões por categoria
 * - Registra log auditável
 * - Impede sons duplicados dentro do cooldown
 */

const LS_CONFIG = 'cc_config_sons';
const LS_LOG    = 'cc_eventos_log';
const LOG_MAX   = 300;

// ── Config padrão ─────────────────────────────────────────────────────────────
function _lerConfig() {
    try { return JSON.parse(localStorage.getItem(LS_CONFIG) || '{}'); }
    catch { return {}; }
}

export function ccSonsHabilitados(categoria = 'geral') {
    // Verificar chave global do botão do header (controle primário do usuário)
    if (localStorage.getItem('cc_sons_sistema') !== 'true') return false;
    // Verificar config detalhada por categoria
    const cfg = _lerConfig();
    if (cfg.sonsSistema === false) return false;
    if (categoria && cfg[categoria] === false) return false;
    return true;
}

// ── Log de eventos ────────────────────────────────────────────────────────────
export function ccLog(origem, evento, tipo = 'info', detalhe = '', extra = {}) {
    const entry = {
        ts:      new Date().toISOString(),
        origem,
        evento,
        tipo,    // 'som' | 'notificacao' | 'firestore' | 'bloqueado' | 'cooldown' | 'sistema'
        arquivo: extra.arquivo || '',
        status:  extra.status  || (tipo === 'som' ? 'EXECUTADO' : tipo === 'bloqueado' ? 'BLOQUEADO' : tipo === 'cooldown' ? 'COOLDOWN' : ''),
        motivo:  extra.motivo  || detalhe,
    };
    try {
        const log = JSON.parse(localStorage.getItem(LS_LOG) || '[]');
        log.unshift(entry);
        if (log.length > LOG_MAX) log.length = LOG_MAX;
        localStorage.setItem(LS_LOG, JSON.stringify(log));
    } catch {}
    if (tipo === 'som') {
        console.log(
            `%c[SOM] ${new Date().toLocaleTimeString('pt-BR')} | ${origem} | ${evento}`,
            'color:#fbbf24;font-weight:bold'
        );
    }
    return entry;
}

export function ccLerLog() {
    try { return JSON.parse(localStorage.getItem(LS_LOG) || '[]'); }
    catch { return []; }
}

export function ccLimparLog() {
    localStorage.removeItem(LS_LOG);
}

// ── Cooldown anti-spam ────────────────────────────────────────────────────────
// Impede que o mesmo som toque mais de uma vez dentro do intervalo (ms)
const _cooldowns = {};
function _podeTocadNow(chave, intervaloMs = 5 * 60 * 1000) {
    const agora = Date.now();
    if (_cooldowns[chave] && agora - _cooldowns[chave] < intervaloMs) return false;
    _cooldowns[chave] = agora;
    return true;
}

// ── Tocador de áudio ─────────────────────────────────────────────────────────
function _oscilar(params) {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx  = new Ctx();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = params.type || 'sine';
        osc.frequency.setValueAtTime(params.freq || 880, ctx.currentTime);
        if (params.freqEnd) osc.frequency.exponentialRampToValueAtTime(params.freqEnd, ctx.currentTime + (params.dur || 0.3));
        const _uVol = Math.max(0, Math.min(1, parseFloat(localStorage.getItem('cc_sons_volume') || '0.7')));
        gain.gain.setValueAtTime((params.vol || 0.18) * _uVol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (params.dur || 0.3));
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + (params.dur || 0.3) + 0.01);
        osc.onended = () => { try { ctx.close(); } catch {} };
    } catch {}
}

/**
 * Toca um som categorizado, com log e cooldown.
 * @param {string} categoria  - 'alertas' | 'agenda' | 'os' | 'sistema' | 'geral'
 * @param {string} origem     - Nome do módulo (para log)
 * @param {string} evento     - Descrição do evento (para log)
 * @param {object} opcoes     - { chave, cooldownMs, tipo, freq, freqEnd, dur, vol, beeps }
 */
export function ccTocarSom(categoria, origem, evento, opcoes = {}) {
    const arquivo = opcoes.arquivo || `AudioContext — ${opcoes.tipo === 'beeps' ? 'beeps' : 'sine'}`;
    const chave   = opcoes.chave || `${categoria}_${evento}`;
    const cooldown = opcoes.cooldownMs ?? (5 * 60 * 1000);

    // 1. Verificar permissão
    if (!ccSonsHabilitados(categoria)) {
        ccLog(origem, evento, 'bloqueado', '', {
            arquivo,
            status: 'BLOQUEADO',
            motivo: `Categoria "${categoria}" desabilitada (cc_config_sons)`,
        });
        return false;
    }

    // 2. Cooldown anti-spam
    if (cooldown > 0 && !_podeTocadNow(chave, cooldown)) {
        ccLog(origem, evento, 'cooldown', '', {
            arquivo,
            status: 'COOLDOWN',
            motivo: `Aguardando ${Math.round(cooldown / 60000)}min entre repetições`,
        });
        return false;
    }

    // 3. Registrar execução no log
    ccLog(origem, evento, 'som', '', { arquivo, status: 'EXECUTADO' });

    // 4. Tocar
    const tipo = opcoes.tipo || 'alerta';
    if (tipo === 'beeps' && opcoes.beeps) {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return false;
            const ctx = new Ctx();
            opcoes.beeps.forEach(([freq, start, dur]) => {
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.type = 'square'; osc.frequency.value = freq;
                const _bVol = Math.max(0, Math.min(1, parseFloat(localStorage.getItem('cc_sons_volume') || '0.7')));
                gain.gain.setValueAtTime((opcoes.vol || 0.2) * _bVol, ctx.currentTime + start);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime + start + dur + 0.01);
            });
        } catch {}
    } else {
        _oscilar({
            freq:    opcoes.freq    || 880,
            freqEnd: opcoes.freqEnd || null,
            dur:     opcoes.dur     || 0.3,
            vol:     opcoes.vol     || 0.18,
            type:    opcoes.oscType || 'sine',
        });
    }
    return true;
}

/**
 * Registra (e opcionalmente exibe) notificação do browser.
 */
export function ccNotificacao(titulo, body, origem, evento) {
    ccLog(origem, evento || titulo, 'notificacao', body);
    if (!ccSonsHabilitados('notificacoes')) return false;
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    try { new Notification(titulo, { body, icon: '/CRM/assets/logo.png' }); return true; }
    catch { return false; }
}

/**
 * Registra evento Firestore (onSnapshot, update, etc.)
 */
export function ccLogFirestore(colecao, evento, detalhe = '') {
    ccLog(`Firestore / ${colecao}`, evento, 'firestore', detalhe);
}

// ── Salvar / ler config ───────────────────────────────────────────────────────
export function ccSalvarConfigSons(cfg) {
    try { localStorage.setItem(LS_CONFIG, JSON.stringify(cfg)); } catch {}
}
export function ccLerConfigSons() { return _lerConfig(); }
