/* ============================================================
   KERNEL.JS — Autenticação, Sessão e Empresa
   Cell City Gestão Empresarial

   Responsabilidade: fornecer um único ponto de inicialização
   para todos os módulos. Nenhuma regra de negócio aqui.

   Uso padrão em todo módulo:
     import { initModulo } from '/CRM/scripts/kernel.js';

     const ctx = await initModulo();
     if (!ctx) return; // não autenticado → redirecionou para login

     // ctx.uid        — UID Firebase do usuário
     // ctx.email      — e-mail do usuário
     // ctx.nome       — nome de exibição
     // ctx.empresaId  — ID da empresa ativa
     // ctx.perfil     — perfil de acesso (admin, tecnico, atendente…)
   ============================================================ */

import { auth, db } from './firebase.js';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ── Configuração ──────────────────────────────────────────────
const LOGIN_URL     = '/CRM/login.html';
const EMPRESA_ID    = 'cellcity-master';   // empresa padrão (single-store)
const TIMEOUT_MS    = 10_000;              // 10s para resolver auth

// Chave no localStorage para evitar flash no gate HTML dos módulos.
// NÃO é o mecanismo de segurança — isso é papel do Firebase Auth.
const FLAG_AUTH     = 'cc_kernel_v1';

// ── Estado interno ────────────────────────────────────────────
let _ctx = null;
let _readyResolved = false;
let _resolveReady;
const _ready = new Promise(r => { _resolveReady = r; });

// ── Listener único de autenticação ────────────────────────────
// Roda uma única vez. Não criar outros onAuthStateChanged nos módulos.
onAuthStateChanged(auth, async (user) => {
    if (user && !user.isAnonymous) {
        try {
            _ctx = await _buildContext(user);
            localStorage.setItem(FLAG_AUTH, '1');
        } catch (e) {
            _log('ERRO ao construir contexto', e);
            _ctx = null;
            localStorage.removeItem(FLAG_AUTH);
        }
    } else {
        _ctx = null;
        localStorage.removeItem(FLAG_AUTH);
    }

    if (!_readyResolved) {
        _readyResolved = true;
        _resolveReady(_ctx);
    }
});

// ── Construção do contexto ─────────────────────────────────────
async function _buildContext(user) {
    let empresaId = EMPRESA_ID;
    let perfil    = 'admin';
    let nome      = user.displayName || user.email?.split('@')[0] || 'Usuário';

    try {
        const snap = await getDoc(doc(db, 'usuarios', user.uid));

        if (snap.exists()) {
            const d = snap.data();
            if (d.empresa_id) empresaId = d.empresa_id;
            if (d.perfil)     perfil    = d.perfil;
            if (d.nome)       nome      = d.nome;
        } else {
            // Primeiro acesso com este UID — cria documento base
            await setDoc(doc(db, 'usuarios', user.uid), {
                email:      user.email,
                nome,
                empresa_id: empresaId,
                perfil,
                createdAt:  serverTimestamp()
            });
            _log(`Documento usuarios/${user.uid} criado (primeiro acesso)`);
        }
    } catch (e) {
        _log('Não foi possível carregar perfil do Firestore — usando padrões', e);
        // Não lança: sistema funciona com os valores padrão
    }

    _log(`Contexto pronto: uid=${user.uid} empresa=${empresaId} perfil=${perfil}`);
    return { user, uid: user.uid, email: user.email, nome, empresaId, perfil };
}

// ── Utilitário de log ──────────────────────────────────────────
function _log(msg, err) {
    if (err) {
        console.error(`[KERNEL] ${msg}`, err.message || err);
    } else {
        console.log(`[KERNEL] ${msg}`);
    }
}

// =============================================================
// API PÚBLICA
// =============================================================

/**
 * Inicializa o módulo. Deve ser chamado no início de cada módulo.
 *
 * Aguarda a autenticação ser resolvida (até 10s).
 * Se o usuário não estiver autenticado, redireciona para login.html
 * e retorna null.
 *
 * @returns {Promise<Object|null>} contexto ou null
 */
export async function initModulo() {
    const ctx = await Promise.race([
        _ready,
        new Promise(r => setTimeout(() => r(null), TIMEOUT_MS))
    ]);

    if (!ctx) {
        _log('Sessão não encontrada — redirecionando para login');
        location.href = LOGIN_URL;
        return null;
    }

    return ctx;
}

/**
 * Realiza login com e-mail e senha.
 *
 * @param {string}  email
 * @param {string}  senha
 * @param {boolean} lembrar — true: sessão persiste após fechar o navegador
 * @returns {Promise<FirebaseUser>}
 * @throws  {FirebaseError} se credenciais inválidas ou erro de rede
 */
export async function login(email, senha, lembrar = false) {
    const persistencia = lembrar ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistencia);
    _log(`Login iniciado: ${email} | lembrar=${lembrar}`);
    const cred = await signInWithEmailAndPassword(auth, email, senha);
    _log(`Login bem-sucedido: ${cred.user.uid}`);
    return cred.user;
}

/**
 * Encerra a sessão e redireciona para login.html.
 */
export async function logout() {
    _log('Logout iniciado');
    await signOut(auth);
    localStorage.removeItem(FLAG_AUTH);
    _ctx = null;
    location.href = LOGIN_URL;
}

// ── Getters síncronos ──────────────────────────────────────────
// Usar somente APÓS initModulo() ter retornado.

/** Contexto completo do usuário atual (síncrono — use após initModulo()). */
export const getCtx = () => _ctx;

/**
 * Aguarda o contexto ser resolvido sem redirecionar para login.
 * Use em páginas de diagnóstico ou onde o redirect não é desejado.
 * @returns {Promise<Object|null>}
 */
export async function getCtxAsync() {
    await Promise.race([_ready, new Promise(r => setTimeout(r, TIMEOUT_MS))]);
    return _ctx;
}

/** Objeto FirebaseUser ou null. */
export const getUser = () => _ctx?.user ?? null;

/** UID do usuário ou null. */
export const getUid = () => _ctx?.uid ?? null;

/** E-mail do usuário ou string vazia. */
export const getEmail = () => _ctx?.email ?? '';

/** Nome de exibição do usuário. */
export const getNome = () => _ctx?.nome ?? '';

/** Perfil de acesso: 'admin' | 'tecnico' | 'atendente' | … */
export const getPerfil = () => _ctx?.perfil ?? '';

/**
 * ID da empresa ativa.
 * Lança Error se chamado antes de initModulo() resolver.
 */
export function getEmpresaId() {
    if (!_ctx) {
        const e = new Error('[KERNEL] getEmpresaId() chamado antes de initModulo() resolver.');
        console.error(e);
        throw e;
    }
    return _ctx.empresaId;
}

/**
 * Verifica se o usuário tem ao menos o nível de acesso informado.
 *
 * Hierarquia: master_admin > admin > gerente > tecnico > atendente
 *
 * @param {string} perfilMinimo
 * @returns {boolean}
 */
export function temPermissao(perfilMinimo) {
    const NIVEL = {
        master_admin: 100,
        admin:         80,
        gerente:       60,
        tecnico:       40,
        atendente:     20
    };
    const atual  = NIVEL[_ctx?.perfil] ?? 0;
    const minimo = NIVEL[perfilMinimo]  ?? 999;
    return atual >= minimo;
}

// ── Chave de gate (uso interno dos módulos) ────────────────────
// O gate HTML de cada módulo pode verificar esta chave para evitar
// flash de conteúdo antes do redirect. A segurança real está no
// Firebase Auth — esta flag é apenas UX.
export const AUTH_FLAG = FLAG_AUTH;
