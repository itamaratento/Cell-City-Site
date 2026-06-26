import {
    db, collection, getDocs, getDoc, doc, setDoc, updateDoc, query, orderBy, where, serverTimestamp
} from "../../scripts/firebase.js";
import { initModulo } from "../../shared/modulo-guard.js";
import { getEmpresaId } from "../../shared/tenant.js";

// ===== SOFT DELETE — registros logicamente excluídos =====
// Campo `ativo: false` + `deletedAt: timestamp` oculta da listagem
// mas preserva o documento no Firestore para futura restauração.

// ===== GLOBAL EXPOSURE =====
window.showTab = showTab;
window.filterHistorico = filterHistorico;
window.abrirConfiguracoes = abrirConfiguracoes;
window.fecharConfiguracoes = fecharConfiguracoes;
window.salvarConfiguracoes = salvarConfiguracoes;
window.editarAvaliacao = editarAvaliacao;
window.excluirContato = excluirContato;
window.editarAgendamentoPendente = editarAgendamentoPendente;
window.excluirAgendamentoPendente = excluirAgendamentoPendente;
window.enviarWppPosvenda = enviarWppPosvenda;

// ===== STATE =====
let pendentes = { 5: [], 15: [], 30: [] };
let historico = [];
let contatosFeitos = new Set();

// Mensagens PADRÃO — usadas sempre que o Firestore não tiver a mensagem do prazo
const MENSAGENS_PADRAO = {
    5: "Olá {{nome}}!\n\nA Cell City Informática agradece pela confiança.\n\nGostaríamos de saber se está tudo funcionando corretamente com seu {{modelo}} após o atendimento realizado.\n\nEstamos à disposição caso precise de qualquer suporte.",
    15: "Olá {{nome}}!\n\nEsperamos que esteja tudo perfeito com seu {{modelo}}.\n\nCaso tenha qualquer dúvida ou precise de suporte, a Cell City Informática está à disposição.",
    30: "Olá {{nome}}!\n\nJá faz um mês desde o atendimento do seu {{modelo}}.\n\nA Cell City Informática agradece pela confiança e está à disposição para qualquer manutenção ou suporte que precisar."
};

// Começa com os padrões; o Firestore só sobrescreve quando tiver mensagem cadastrada
let mensagensPosvenda = { ...MENSAGENS_PADRAO };

// Templates compartilhados do config/mensagens_whatsapp (pos_venda_5/15/30)
let mensagensWppShared = {};
// Rastreia quais OS/prazo tiveram WhatsApp enviado nessa sessão
const wppEnviados = new Set();

// ===== INIT =====
async function init() {
    // ── Guard SaaS: autenticação, licença e permissão do módulo ──
    console.log('[POS] Antes initModulo');
    let ctx;
    try {
        ctx = await initModulo('pos-venda');
        console.log('[POS] Depois initModulo:', ctx ? 'true' : 'false (bloqueou)');
    } catch (err) {
        console.log('[POS] Depois initModulo: LANÇOU EXCEÇÃO →', err.message);
        throw err;
    }
    if (!ctx) return;

    try {
        const eid = getEmpresaId();
        await Promise.all([carregarMensagensPosvenda(eid), carregarMensagensWppShared(eid)]);
        window.mensagensPosvenda = mensagensPosvenda;
        await loadData();
    } catch (err) {
        console.error('❌ Pós-venda: erro ao carregar dados', err);
        document.getElementById('pendentes-container').innerHTML =
            `<div class="empty-state"><div class="icon">⚠️</div><p>Erro ao carregar. Verifique a conexão.</p></div>`;
        return;
    }
    renderPendentes();
    renderHistorico();
    setupEventDelegation();
    focarDeepLink();
}

// ===== DEEP-LINK — foca um registro vindo do Painel de Alertas (sino) =====
// URL: ...pos-venda/index.html?osid=<osId>&prazo=<prazo>
function focarDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const osid = params.get('osid');
    if (!osid) return;
    const prazo = params.get('prazo');

    // Limpa a URL imediatamente para não re-focar em refresh.
    try { history.replaceState(null, '', window.location.pathname); } catch (e) {}

    const escSel = (s) => (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/"/g, '\\"');
    let card = prazo
        ? document.querySelector(`.pv-card[data-osid="${escSel(osid)}"][data-prazo="${escSel(prazo)}"]`)
        : null;
    if (!card) card = document.querySelector(`.pv-card[data-osid="${escSel(osid)}"]`);

    if (!card) {
        showToast('ℹ️ Registro não está mais nos pendentes (talvez já contatado).');
        return;
    }
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('pv-card-highlight');
    setTimeout(() => card.classList.remove('pv-card-highlight'), 4000);
}

// ===== CARREGAR DADOS =====
async function loadData() {
    // CORREÇÃO: OS são salvas na coleção "os", não "orders"
    const eid = getEmpresaId();
    let ordersSnap;
    try {
        ordersSnap = await getDocs(query(collection(db, "os"), where('empresa_id', '==', eid), orderBy("createdAt", "desc")));
    } catch {
        ordersSnap = await getDocs(query(collection(db, "os"), where('empresa_id', '==', eid)));
    }
    const contatosSnap = await getDocs(query(collection(db, "posvenda_contatos"), where('empresa_id', '==', eid)));

    const contatos = [];
    contatosSnap.forEach(d => {
        const data = d.data();
        // Filtra registros com soft delete — ativo: false são ocultados
        if (data.ativo === false) return;
        contatos.push({ id: d.id, ...data });
    });
    contatosFeitos = new Set(contatos.map(c => `${c.osId}_${c.prazo}`));

    const now = new Date();
    pendentes = { futuros: [], 5: [], 15: [], 30: [] };

    ordersSnap.forEach(d => {
        const os = { firestoreId: d.id, ...d.data() };
        if (os.status !== 'entregue') return;

        const deliveryDate = getDeliveryDate(os);
        if (!deliveryDate) return;

        const dias = calcDias(deliveryDate, now);
        const osId = os.id || os.firestoreId;

        // Futuros: entregue mas ainda não chegou em 5 dias
        if (dias < 5) {
            pendentes.futuros.push({ ...os, osId, dias, urgencia: 'futuro', prazo: 5 });
            return;
        }

        // Pendentes por prazo — mostra mesmo se passou do prazo (overdue)
        [5, 15, 30].forEach(prazo => {
            if (contatosFeitos.has(`${osId}_${prazo}`)) return;
            // Janela: de prazo até o próximo prazo - 1
            const proxPrazo = prazo === 5 ? 15 : prazo === 15 ? 30 : 999;
            if (dias < prazo || dias >= proxPrazo) return;

            const urgencia = dias <= prazo + 2 ? 'ok' : dias <= prazo + 5 ? 'atencao' : 'urgente';
            pendentes[prazo].push({ ...os, osId, dias, urgencia, prazo });
        });
    });

    historico = contatos.sort((a, b) => {
        const dateA = a.dataContato ? new Date(a.dataContato) : 0;
        const dateB = b.dataContato ? new Date(b.dataContato) : 0;
        return dateB - dateA;
    });
}

// ===== CARREGAR MENSAGENS POSVENDA (isolado por empresa_id) =====
// Estrutura: posvenda_mensagens/{empresaId}_{prazo} (ex: "cellcity-master_5")
async function carregarMensagensPosvenda(eid) {
    mensagensPosvenda = { ...MENSAGENS_PADRAO };
    try {
        const prazos = [5, 15, 30];
        const results = await Promise.all(
            prazos.map(p => getDoc(doc(db, "posvenda_mensagens", `${eid}_${p}`)))
        );
        results.forEach((snap, i) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.mensagem && data.mensagem.trim().length > 0) {
                    mensagensPosvenda[prazos[i]] = data.mensagem;
                }
            }
        });
        console.log('✅ Mensagens pós-venda carregadas:', mensagensPosvenda);
    } catch (err) {
        console.warn('⚠️ Erro ao buscar mensagens do Firestore. Usando padrão.', err);
    }
}

function getDeliveryDate(os) {
    if (Array.isArray(os.timeline)) {
        const entry = [...os.timeline].reverse().find(t => t.text === 'Entregue ao cliente');
        if (entry?.date) return entry.date;
    }
    const ua = os.updatedAt;
    if (!ua) return null;
    if (typeof ua === 'string') return ua;
    if (ua.toDate) return ua.toDate().toISOString();
    return null;
}

function calcDias(dateStr, now) {
    try {
        const d = new Date(dateStr);
        // Compara por dia de calendário local (não por períodos de 24h exatos)
        // Isso evita que OS entregues à noite apareçam 1 dia antes do prazo por causa do fuso UTC-3
        const day1 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const day2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return Math.round((day2 - day1) / 86400000);
    } catch { return 0; }
}

// ===== RENDERIZAR PENDENTES =====
function renderPendentes() {
    const totalAtivos = [5, 15, 30].reduce((s, p) => s + pendentes[p].length, 0);
    const totalFuturos = pendentes.futuros.length;

    [5, 15, 30].forEach(p => {
        const count = pendentes[p].length;
        const el = document.getElementById(`count-${p}`);
        const item = document.getElementById(`sum-${p}`);
        if (el) el.textContent = count;
        if (item) item.classList.toggle('has-pending', count > 0);
    });

    const badge = document.getElementById('tab-badge');
    if (badge) {
        badge.textContent = totalAtivos;
        badge.style.display = totalAtivos > 0 ? 'inline-flex' : 'none';
    }

    const container = document.getElementById('pendentes-container');
    let html = '';

    // AGENDAMENTOS FUTUROS (entregues < 5 dias)
    if (totalFuturos > 0) {
        html += `
        <div class="pv-grupo pv-grupo-futuros">
            <div class="pv-grupo-header">
                <span>📅 Agendamentos Futuros — Entregues recentemente</span>
                <span class="pv-grupo-badge">${totalFuturos}</span>
            </div>
            ${pendentes.futuros.map(os => buildCardFuturo(os)).join('')}
        </div>`;
    }

    if (totalAtivos === 0 && totalFuturos === 0) {
        container.innerHTML = `<div class="empty-state">
            <div class="icon">🎉</div>
            <p>Nenhum contato pendente!</p>
            <p>Todos os clientes foram atendidos.</p>
        </div>`;
        saveBadge(0);
        return;
    }

    const GRUPO_INFO = {
        5:  { emoji: '👋', desc: '5 dias — Satisfação do serviço' },
        15: { emoji: '🔍', desc: '15 dias — Acompanhamento' },
        30: { emoji: '⭐', desc: '30 dias — Fidelização' }
    };

    [5, 15, 30].forEach(prazo => {
        const grupo = pendentes[prazo];
        if (!grupo.length) return;
        const info = GRUPO_INFO[prazo];
        html += `
        <div class="pv-grupo">
            <div class="pv-grupo-header">
                <span>${info.emoji} ${info.desc}</span>
                <span class="pv-grupo-badge">${grupo.length}</span>
            </div>
            ${grupo.map(os => buildCard(os)).join('')}
        </div>`;
    });

    container.innerHTML = html;
    saveBadge(totalAtivos);
}

function buildCard(os) {
    const URGENCIA = {
        ok:      { cls: 'urg-ok',      label: '' },
        atencao: { cls: 'urg-atencao', label: '<div class="pv-urg-label">🟡 1 dia em atraso</div>' },
        urgente: { cls: 'urg-urgente', label: '<div class="pv-urg-label">🔴 Contato urgente</div>' }
    };
    const u = URGENCIA[os.urgencia] || URGENCIA.ok;

    return `
    <div class="pv-card ${u.cls}" data-osid="${esc(os.osId)}" data-prazo="${os.prazo}">
        <div class="pv-card-top">
            <div class="pv-card-info">
                <div class="pv-card-id">${esc(os.osId)}</div>
                <div class="pv-card-name">${esc(os.clientName)}</div>
                <div class="pv-card-model">${esc(os.model)}</div>
            </div>
            <div class="pv-card-days">
                <span class="days-num">${os.dias}</span>
                <span class="days-lbl">dias</span>
            </div>
        </div>
        ${u.label}
        <div class="pv-buttons-row">
            <button class="pv-wpp-btn" title="Enviar WhatsApp" style="background:#25D366;border:none;color:#000;font-weight:700;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;">💬 WhatsApp</button>
            <button class="pv-copy-phone-btn" title="V">📞 Telefone</button>
            <button class="pv-copy-btn" title="B">📋 Copiar</button>
            <button class="pv-copy-all-btn" title="N">📋 Tudo</button>
        </div>
        <div class="pv-wpp-indicator" style="font-size:11px;color:#eab308;min-height:14px;margin-top:2px;">${wppEnviados.has(`${os.osId}_${os.prazo}`) ? '🟢 Enviado' : ''}</div>
        <div class="pv-actions-row">
            <button class="pv-edit-btn" title="Editar agendamento">✏️ Editar</button>
            <button class="pv-delete-pendente-btn" title="Excluir agendamento">🗑️ Excluir</button>
        </div>
        <div class="pv-emoji-row">
            <button class="emoji-btn" data-emoji="😄" data-label="Muito satisfeito" title="Muito satisfeito">😄</button>
            <button class="emoji-btn" data-emoji="🙂" data-label="Satisfeito" title="Satisfeito">🙂</button>
            <button class="emoji-btn" data-emoji="😐" data-label="Neutro" title="Neutro">😐</button>
            <button class="emoji-btn" data-emoji="😟" data-label="Voltou com problema" title="Voltou com problema">😟</button>
            <button class="emoji-btn" data-emoji="📵" data-label="Não atendeu" title="Não atendeu">📵</button>
        </div>
    </div>`;
}

function buildCardFuturo(os) {
    const faltam = 5 - os.dias;
    return `
    <div class="pv-card pv-card-futuro" data-osid="${esc(os.osId)}" data-prazo="5">
        <div class="pv-card-top">
            <div class="pv-card-info">
                <div class="pv-card-id">${esc(os.osId)}</div>
                <div class="pv-card-name">${esc(os.clientName)}</div>
                <div class="pv-card-model">${esc(os.model)}</div>
            </div>
            <div class="pv-card-days">
                <span class="days-num">${faltam}</span>
                <span class="days-lbl">dias p/ contato</span>
            </div>
        </div>
        <div class="pv-urg-label" style="color:#6b7280;">⏳ Entregue há ${os.dias} dia${os.dias !== 1 ? 's' : ''} — aguardando prazo</div>
        <div class="pv-actions-row">
            <button class="pv-edit-btn" title="Editar agendamento">✏️ Editar</button>
            <button class="pv-delete-pendente-btn" title="Excluir agendamento">🗑️ Excluir</button>
        </div>
    </div>`;
}

// ===== RENDERIZAR HISTÓRICO =====
function renderHistorico(list) {
    const data = list !== undefined ? list : historico;
    const container = document.getElementById('historico-container');
    if (!data.length) {
        container.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>Nenhum contato registrado ainda</p></div>`;
        return;
    }
    container.innerHTML = data.map((c, i) => buildHistCard(c, i)).join('');
}

function buildHistCard(c, index) {
    const prazoLabel = { 5: '5 dias', 15: '15 dias', 30: '30 dias' }[c.prazo] || `${c.prazo} dias`;
    const data = c.dataContato
        ? new Date(c.dataContato).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        })
        : '';
    const dataAtualizacao = c.dataAtualizacao
        ? ' · Editado: ' + new Date(c.dataAtualizacao).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
          })
        : '';
    const historicoId = c.id || `${c.osId}_${c.prazo}`;
    return `
    <div class="pv-hist-card" data-historico-id="${esc(historicoId)}">
        <div class="pv-hist-top">
            <div>
                <div class="pv-card-name">${esc(c.clientName)}</div>
                <div class="pv-card-model">${esc(c.model)} · ${prazoLabel}</div>
                <div class="pv-card-id">${esc(c.osId)}</div>
            </div>
            <div class="pv-hist-emoji">
                ${c.emoji || ''}
                <button class="pv-hist-edit-btn" title="Editar avaliação">✏️</button>
                <button class="pv-hist-delete-btn" title="Excluir registro" data-id="${esc(historicoId)}">🗑️</button>
            </div>
        </div>
        <div class="pv-hist-footer">
            <span class="pv-hist-result">${esc(c.resultado)}</span>
            <span class="pv-hist-date">${data}${dataAtualizacao}</span>
        </div>
    </div>`;
}

// ===== COPIAR MENSAGEM =====
function copiarMensagem(prazo, nome, modelo) {
    let msg = mensagensPosvenda[prazo] || mensagensPosvenda[5];
    msg = msg.replace('{{nome}}', nome).replace('{{modelo}}', modelo);

    navigator.clipboard.writeText(msg).then(() => {
        showToast('✅ Mensagem copiada');
    }).catch(() => {
        showToast('❌ Erro ao copiar. Tente novamente.');
    });
}

// ===== COPIAR TELEFONE =====
function copiarTelefone(phone) {
    if (!phone || phone.trim() === '') {
        showToast('⚠️ Telefone não cadastrado');
        return;
    }

    navigator.clipboard.writeText(phone).then(() => {
        showToast('✅ Telefone copiado');
    }).catch(() => {
        showToast('❌ Erro ao copiar. Tente novamente.');
    });
}

// ===== COPIAR TUDO (NOME + TELEFONE + MENSAGEM) =====
function copiarTudo(prazo, nome, telefone, modelo) {
    if (!nome || !telefone) {
        showToast('⚠️ Dados incompletos');
        return;
    }

    let msg = mensagensPosvenda[prazo] || mensagensPosvenda[5];
    msg = msg.replace('{{nome}}', nome).replace('{{modelo}}', modelo);

    const textoCompleto = `${nome}\n${telefone}\n\n${msg}`;

    navigator.clipboard.writeText(textoCompleto).then(() => {
        showToast('✅ Telefone + mensagem copiados');
    }).catch(() => {
        showToast('❌ Erro ao copiar. Tente novamente.');
    });
}


// ===== EVENT DELEGATION =====
function setupEventDelegation() {
    // Pendentes
    const container = document.getElementById('pendentes-container');
    container.addEventListener('click', async (e) => {
        const card = e.target.closest('.pv-card');
        if (!card) return;

        const osId = card.dataset.osid;
        const prazo = parseInt(card.dataset.prazo);
        // Procura no prazo do card e também entre os "Agendamentos Futuros"
        // (cards futuros usam data-prazo="5" mas ficam em pendentes.futuros).
        const os = pendentes[prazo]?.find(o => o.osId === osId)
                || pendentes.futuros?.find(o => o.osId === osId);
        if (!os) return;

        if (e.target.closest('.pv-wpp-btn')) {
            enviarWppPosvenda(osId, prazo);
            return;
        }

        if (e.target.closest('.pv-copy-phone-btn')) {
            copiarTelefone(os.phone);
            return;
        }

        if (e.target.closest('.pv-copy-btn')) {
            copiarMensagem(prazo, os.clientName, os.model);
            return;
        }

        if (e.target.closest('.pv-view-msg-btn')) {
            verMensagem(prazo, os.clientName, os.model);
            return;
        }

        if (e.target.closest('.pv-copy-all-btn')) {
            copiarTudo(prazo, os.clientName, os.phone, os.model);
            return;
        }

        if (e.target.closest('.pv-edit-btn')) {
            editarAgendamentoPendente(os);
            return;
        }

        if (e.target.closest('.pv-delete-pendente-btn')) {
            excluirAgendamentoPendente(os);
            return;
        }

        const emojiBtn = e.target.closest('.emoji-btn');
        if (emojiBtn) {
            await registrarResultado(osId, os, prazo, emojiBtn.dataset.emoji, emojiBtn.dataset.label);
        }
    });

    // Histórico — botão editar avaliação
    const histContainer = document.getElementById('historico-container');
    histContainer.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.pv-hist-edit-btn');
        if (editBtn) {
            const card = editBtn.closest('.pv-hist-card');
            if (!card) return;
            const historicoId = card.dataset.historicoId;
            const contato = historico.find(c => (c.id || `${c.osId}_${c.prazo}`) === historicoId);
            if (contato) {
                editarAvaliacao(contato);
            }
            return;
        }

        // Botão excluir (soft delete)
        const deleteBtn = e.target.closest('.pv-hist-delete-btn');
        if (deleteBtn) {
            const card = deleteBtn.closest('.pv-hist-card');
            if (!card) return;
            const historicoId = deleteBtn.dataset.id;
            const contato = historico.find(c => (c.id || `${c.osId}_${c.prazo}`) === historicoId);
            if (contato) {
                abrirModalExclusao(contato);
            }
        }
    });
}

// ===== WHATSAPP (compartilhado, isolado por empresa_id) =====
// Cada empresa tem seu próprio doc: config/mensagens_whatsapp_{empresaId}
async function carregarMensagensWppShared(eid) {
    try {
        const snap = await getDoc(doc(db, 'config', `mensagens_whatsapp_${eid}`));
        if (!snap.exists()) return;
        const data = snap.data();
        [5, 15, 30].forEach(prazo => {
            const key = `pos_venda_${prazo}`;
            const val = data[key];
            if (!val) return;
            const texto = (typeof val === 'object' && val.texto) ? val.texto
                        : (typeof val === 'string' ? val : '');
            if (texto.trim()) mensagensWppShared[prazo] = texto;
        });
    } catch(e) {
        console.warn('WPP Pós-venda: usando mensagens locais', e);
    }
}

function _getMsgWppPosvenda(prazo, nome, modelo) {
    // Prioridade: templates WPP compartilhados > mensagensPosvenda > padrão
    const template = mensagensWppShared[prazo] || mensagensPosvenda[prazo] || mensagensPosvenda[5] || '';
    return template.replace(/\{\{nome\}\}/g, nome).replace(/\{\{modelo\}\}/g, modelo);
}

function enviarWppPosvenda(osId, prazo) {
    const os = pendentes[prazo]?.find(o => o.osId === osId)
             || pendentes.futuros?.find(o => o.osId === osId);
    if (!os) { showToast('⚠️ Dados não encontrados'); return; }
    const phone = (os.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) { showToast('⚠️ Telefone inválido ou não cadastrado'); return; }
    const mensagem = _getMsgWppPosvenda(prazo, os.clientName, os.model);
    const phoneWa = phone.startsWith('55') ? phone : `55${phone}`;
    window.open(`https://wa.me/${phoneWa}?text=${encodeURIComponent(mensagem)}`, 'whatsapp_crm');
    // Marca como enviado nessa sessão
    wppEnviados.add(`${osId}_${prazo}`);
    // Atualiza indicador visual no card
    const card = document.querySelector(`.pv-card[data-osid="${osId}"][data-prazo="${prazo}"]`);
    if (card) {
        const ind = card.querySelector('.pv-wpp-indicator');
        if (ind) ind.textContent = '🟢 Enviado';
    }
    showToast('✅ WhatsApp aberto! É só enviar ►');
}

// ===== REGISTRAR RESULTADO =====
async function registrarResultado(osId, os, prazo, emoji, resultado) {
    const key = `${osId}_${prazo}`;
    if (contatosFeitos.has(key)) return;

    const data = {
        osId,
        clientName: os.clientName || '',
        phone: os.phone || '',
        model: os.model || '',
        prazo,
        emoji,
        resultado,
        empresa_id: getEmpresaId(),
        dataContato: new Date().toISOString(),
        createdAt: serverTimestamp()
    };

    try {
        await setDoc(doc(db, "posvenda_contatos", key), data);
        contatosFeitos.add(key);
        pendentes[prazo] = pendentes[prazo].filter(o => o.osId !== osId);
        historico.unshift({ ...data, id: key });
        showToast(`${emoji} ${resultado} — registrado!`);
        renderPendentes();
    } catch (err) {
        console.error('❌ Erro ao registrar resultado:', err);
        showToast('❌ Erro ao salvar. Tente novamente.');
    }
}

// ===== EDITAR AVALIAÇÃO =====
function editarAvaliacao(contato) {
    const popover = document.createElement('div');
    popover.className = 'pv-edit-popover';
    popover.innerHTML = `
        <div class="pv-edit-content">
            <div class="pv-edit-header">
                <span>✏️ Editar Avaliação</span>
                <button class="pv-edit-close" onclick="this.closest('.pv-edit-popover').remove()">✕</button>
            </div>
            <div class="pv-edit-body">
                <div class="pv-edit-client">
                    <strong>${esc(contato.clientName)}</strong> — ${esc(contato.model)}
                    <span class="pv-edit-osid">${esc(contato.osId)}</span>
                </div>
                <p class="pv-edit-label">Selecione a nova avaliação:</p>
                <div class="pv-edit-emoji-row">
                    <button class="pv-edit-emoji-btn" data-emoji="😄" data-label="Muito satisfeito">
                        <span class="pv-edit-emoji-icon">😄</span>
                        <span class="pv-edit-emoji-label">Muito satisfeito</span>
                    </button>
                    <button class="pv-edit-emoji-btn" data-emoji="🙂" data-label="Satisfeito">
                        <span class="pv-edit-emoji-icon">🙂</span>
                        <span class="pv-edit-emoji-label">Satisfeito</span>
                    </button>
                    <button class="pv-edit-emoji-btn" data-emoji="😐" data-label="Neutro">
                        <span class="pv-edit-emoji-icon">😐</span>
                        <span class="pv-edit-emoji-label">Neutro</span>
                    </button>
                    <button class="pv-edit-emoji-btn" data-emoji="😟" data-label="Voltou com problema">
                        <span class="pv-edit-emoji-icon">😟</span>
                        <span class="pv-edit-emoji-label">Voltou c/ problema</span>
                    </button>
                    <button class="pv-edit-emoji-btn" data-emoji="📵" data-label="Não atendeu">
                        <span class="pv-edit-emoji-icon">📵</span>
                        <span class="pv-edit-emoji-label">Não atendeu</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Destacar a avaliação atual
    const currentEmoji = contato.emoji || '';
    popover.querySelectorAll('.pv-edit-emoji-btn').forEach(btn => {
        if (btn.dataset.emoji === currentEmoji) {
            btn.classList.add('current');
        }
        btn.addEventListener('click', async () => {
            const novoEmoji = btn.dataset.emoji;
            const novoResultado = btn.dataset.label;
            await atualizarAvaliacao(contato, novoEmoji, novoResultado);
            popover.remove();
        });
    });

    popover.addEventListener('click', (e) => {
        if (e.target === popover) popover.remove();
    });

    document.body.appendChild(popover);
}

async function atualizarAvaliacao(contato, novoEmoji, novoResultado) {
    const key = contato.id || `${contato.osId}_${contato.prazo}`;

    const updates = {
        emoji: novoEmoji,
        resultado: novoResultado,
        dataAtualizacao: new Date().toISOString(),
        updatedAt: serverTimestamp()
    };

    try {
        await updateDoc(doc(db, "posvenda_contatos", key), updates);

        // Atualizar in-memory
        const idx = historico.findIndex(c => (c.id || `${c.osId}_${c.prazo}`) === key);
        if (idx !== -1) {
            historico[idx].emoji = novoEmoji;
            historico[idx].resultado = novoResultado;
            historico[idx].dataAtualizacao = updates.dataAtualizacao;
        }

        showToast(`${novoEmoji} Avaliação atualizada para "${novoResultado}"`);
        renderHistorico();
    } catch (err) {
        console.error('❌ Erro ao atualizar avaliação:', err);
        showToast('❌ Erro ao atualizar. Tente novamente.');
    }
}

// ===== SOFT DELETE — EXCLUIR CONTATO =====
function abrirModalExclusao(contato) {
    const overlay = document.createElement('div');
    overlay.className = 'pv-delete-overlay';
    overlay.innerHTML = `
        <div class="pv-delete-modal">
            <div class="pv-delete-header">
                <span>🗑️ Excluir Registro</span>
            </div>
            <div class="pv-delete-body">
                <p>Deseja realmente excluir este registro de pós-venda?</p>
                <div class="pv-delete-info">
                    <div><strong>Cliente:</strong> ${esc(contato.clientName)}</div>
                    <div><strong>OS:</strong> ${esc(contato.osId)}</div>
                    <div><strong>Aparelho:</strong> ${esc(contato.model)}</div>
                </div>
                <p class="pv-delete-warning">Esta ação ocultará o registro da listagem principal.<br>O documento permanece no banco para futura restauração.</p>
            </div>
            <div class="pv-delete-footer">
                <button class="pv-delete-cancel-btn" onclick="this.closest('.pv-delete-overlay').remove()">Cancelar</button>
                <button class="pv-delete-confirm-btn" data-id="${esc(contato.id || contato.osId + '_' + contato.prazo)}">Sim, Excluir</button>
            </div>
        </div>
    `;

    // Confirma exclusão
    const confirmBtn = overlay.querySelector('.pv-delete-confirm-btn');
    confirmBtn.addEventListener('click', async () => {
        const key = confirmBtn.dataset.id;
        await excluirContato(key, contato);
        overlay.remove();
    });

    // Fecha ao clicar fora
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
}

async function excluirContato(key, contato) {
    try {
        // 🔒 Valida que o documento pertence à empresa atual antes de excluir
        const docRef = doc(db, "posvenda_contatos", key);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            showToast('⚠️ Registro não encontrado no banco.');
            return;
        }

        const docData = docSnap.data();
        const eid = getEmpresaId();

        if (docData.empresa_id && docData.empresa_id !== eid) {
            showToast('❌ Este registro não pertence à sua empresa.');
            return;
        }

        await updateDoc(docRef, {
            ativo: false,
            deletedAt: serverTimestamp()
        });

        historico = historico.filter(c => (c.id || `${c.osId}_${c.prazo}`) !== key);
        contatosFeitos.delete(key);

        showToast('🗑️ Registro excluído com sucesso');
        renderHistorico();
    } catch (err) {
        console.error('❌ Erro ao excluir registro:', err);
        showToast('❌ Erro ao excluir. Tente novamente.');
    }
}

// ===== EDITAR AGENDAMENTO PENDENTE =====
function editarAgendamentoPendente(os) {
    const overlay = document.createElement('div');
    overlay.className = 'pv-edit-pendente-overlay';
    overlay.innerHTML = `
        <div class="pv-edit-pendente-modal">
            <div class="pv-edit-pendente-header">
                <span>✏️ Editar Agendamento</span>
                <button class="pv-edit-pendente-close" onclick="this.closest('.pv-edit-pendente-overlay').remove()">✕</button>
            </div>
            <div class="pv-edit-pendente-body">
                <div class="pv-edit-pendente-field">
                    <label>OS</label>
                    <input type="text" value="${esc(os.osId)}" readonly class="pv-edit-pendente-readonly">
                </div>
                <div class="pv-edit-pendente-field">
                    <label>Cliente</label>
                    <input type="text" value="${esc(os.clientName)}" readonly class="pv-edit-pendente-readonly">
                </div>
                <div class="pv-edit-pendente-field">
                    <label>Aparelho</label>
                    <input type="text" value="${esc(os.model)}" readonly class="pv-edit-pendente-readonly">
                </div>
                <div class="pv-edit-pendente-field">
                    <label>Telefone</label>
                    <input type="text" id="pv-edit-phone" value="${esc(os.phone || '')}" placeholder="Telefone para contato">
                </div>
                <div class="pv-edit-pendente-field">
                    <label>Data do Agendamento</label>
                    <input type="date" id="pv-edit-date" value="${os.dataAgendamento || ''}">
                </div>
                <div class="pv-edit-pendente-field">
                    <label>Prazo de Contato</label>
                    <select id="pv-edit-prazo">
                        <option value="5" ${os.prazo === 5 ? 'selected' : ''}>5 dias — Satisfação</option>
                        <option value="15" ${os.prazo === 15 ? 'selected' : ''}>15 dias — Acompanhamento</option>
                        <option value="30" ${os.prazo === 30 ? 'selected' : ''}>30 dias — Fidelização</option>
                    </select>
                </div>
                <div class="pv-edit-pendente-field">
                    <label>Status</label>
                    <select id="pv-edit-status">
                        <option value="entregue" ${os.status === 'entregue' ? 'selected' : ''}>Entregue</option>
                        <option value="aguardando" ${os.status === 'aguardando' ? 'selected' : ''}>Aguardando</option>
                        <option value="andamento" ${os.status === 'andamento' ? 'selected' : ''}>Em Andamento</option>
                        <option value="finalizado" ${os.status === 'finalizado' ? 'selected' : ''}>Finalizado</option>
                    </select>
                </div>
                <div class="pv-edit-pendente-field">
                    <label>Observações</label>
                    <textarea id="pv-edit-obs" placeholder="Observações sobre o agendamento..." maxlength="500">${esc(os.observacoes || '')}</textarea>
                </div>
            </div>
            <div class="pv-edit-pendente-footer">
                <button class="pv-edit-pendente-cancel" onclick="this.closest('.pv-edit-pendente-overlay').remove()">Cancelar</button>
                <button class="pv-edit-pendente-save" data-osid="${esc(os.firestoreId || os.osId)}">Salvar Alterações</button>
            </div>
        </div>
    `;

    // Salvar
    const saveBtn = overlay.querySelector('.pv-edit-pendente-save');
    saveBtn.addEventListener('click', async () => {
        const osId = saveBtn.dataset.osid;
        const dataAgendamento = document.getElementById('pv-edit-date').value;
        const prazo = parseInt(document.getElementById('pv-edit-prazo').value);
        const status = document.getElementById('pv-edit-status').value;
        const observacoes = document.getElementById('pv-edit-obs').value.trim();
        const phone = document.getElementById('pv-edit-phone').value.trim();

        await salvarEdicaoAgendamento(osId, os, { dataAgendamento, prazo, status, observacoes, phone });
        overlay.remove();
    });

    // Fechar ao clicar fora
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
}

async function salvarEdicaoAgendamento(osId, osOriginal, updates) {
    try {
        const updateData = {};
        if (updates.dataAgendamento) updateData.dataAgendamento = updates.dataAgendamento;
        if (updates.observacoes !== undefined) updateData.observacoes = updates.observacoes;
        if (updates.status) updateData.status = updates.status;
        if (updates.phone !== undefined) updateData.phone = updates.phone;
        updateData.updatedAt = serverTimestamp();

        await updateDoc(doc(db, "os", osId), updateData);

        // Atualizar in-memory — atualiza em todos os arrays de prazo
        [5, 15, 30].forEach(p => {
            const idx = pendentes[p]?.findIndex(o => o.osId === osOriginal.osId);
            if (idx !== -1 && pendentes[p]?.[idx]) {
                if (updates.observacoes !== undefined) pendentes[p][idx].observacoes = updates.observacoes;
                if (updates.status) pendentes[p][idx].status = updates.status;
                if (updates.phone !== undefined) pendentes[p][idx].phone = updates.phone;
                if (updates.dataAgendamento) pendentes[p][idx].dataAgendamento = updates.dataAgendamento;
            }
        });

        showToast('✅ Agendamento atualizado com sucesso');
    } catch (err) {
        console.error('❌ Erro ao atualizar agendamento:', err);
        showToast('❌ Erro ao salvar. Tente novamente.');
    }
}

// ===== EXCLUIR AGENDAMENTO PENDENTE =====
function excluirAgendamentoPendente(os) {
    const overlay = document.createElement('div');
    overlay.className = 'pv-delete-pendente-overlay';
    overlay.innerHTML = `
        <div class="pv-delete-pendente-modal">
            <div class="pv-delete-pendente-header">
                <span>🗑️ Excluir Agendamento</span>
            </div>
            <div class="pv-delete-pendente-body">
                <div class="pv-delete-pendente-atencao">ATENÇÃO</div>
                <p>Deseja realmente excluir este agendamento de pós-venda?</p>
                <p class="pv-delete-pendente-irreversivel">Esta ação não poderá ser desfeita.</p>
                <div class="pv-delete-pendente-info">
                    <div><strong>Cliente:</strong> ${esc(os.clientName)}</div>
                    <div><strong>OS:</strong> ${esc(os.osId)}</div>
                    <div><strong>Aparelho:</strong> ${esc(os.model)}</div>
                    <div><strong>Prazo:</strong> ${os.prazo} dias</div>
                </div>
                <div class="pv-delete-pendente-senha">
                    <label>Digite a senha <strong>77</strong> para confirmar a exclusão:</label>
                    <input type="password" id="pv-delete-senha" inputmode="numeric" maxlength="2" placeholder="••" autocomplete="off">
                    <span class="pv-delete-senha-erro" id="pv-delete-senha-erro"></span>
                </div>
            </div>
            <div class="pv-delete-pendente-footer">
                <button class="pv-delete-pendente-cancel" onclick="this.closest('.pv-delete-pendente-overlay').remove()">Cancelar</button>
                <button class="pv-delete-pendente-confirm">Excluir</button>
            </div>
        </div>
    `;

    const confirmBtn = overlay.querySelector('.pv-delete-pendente-confirm');
    const senhaInput = overlay.querySelector('#pv-delete-senha');
    const erroEl = overlay.querySelector('#pv-delete-senha-erro');

    confirmBtn.addEventListener('click', async () => {
        // Confirmação obrigatória por senha 77 (mesmo padrão do módulo OS)
        if ((senhaInput?.value || '').trim() !== '77') {
            if (erroEl) erroEl.textContent = '❌ Senha incorreta. Exclusão cancelada.';
            senhaInput?.focus();
            senhaInput?.select();
            return;
        }
        await confirmarExclusaoPendente(os);
        overlay.remove();
    });

    // Enter confirma; limpar erro ao digitar
    senhaInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmBtn.click(); });
    senhaInput?.addEventListener('input', () => { if (erroEl) erroEl.textContent = ''; });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
    setTimeout(() => senhaInput?.focus(), 100);
}

async function confirmarExclusaoPendente(os) {
    const key = `${os.osId}_${os.prazo}`;
    const prazo = os.prazo;

    try {
        // Marca no Firestore como excluído (soft delete em posvenda_contatos)
        await setDoc(doc(db, "posvenda_contatos", key), {
            osId: os.osId,
            clientName: os.clientName || '',
            phone: os.phone || '',
            model: os.model || '',
            prazo: os.prazo,
            emoji: '🗑️',
            resultado: 'Excluído',
            dataContato: new Date().toISOString(),
            ativo: false,
            deletedAt: serverTimestamp(),
            createdAt: serverTimestamp()
        });

        // Remove da lista em memória (prazo ativo e/ou seção de futuros)
        contatosFeitos.add(key);
        pendentes[prazo] = pendentes[prazo].filter(o => o.osId !== os.osId);
        if (Array.isArray(pendentes.futuros)) {
            pendentes.futuros = pendentes.futuros.filter(o => o.osId !== os.osId);
        }

        showToast('🗑️ Agendamento excluído com sucesso');
        renderPendentes();
    } catch (err) {
        console.error('❌ Erro ao excluir agendamento:', err);
        showToast('❌ Erro ao excluir. Tente novamente.');
    }
}

// ===== TABS =====
function showTab(tab) {
    document.querySelectorAll('.pv-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pv-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById(`screen-${tab}`).classList.add('active');
    if (tab === 'historico') renderHistorico();
}

function filterHistorico() {
    const term = (document.getElementById('hist-search')?.value || '').toLowerCase();
    const filtered = term
        ? historico.filter(c =>
            (c.clientName || '').toLowerCase().includes(term) ||
            (c.osId || '').toLowerCase().includes(term) ||
            (c.model || '').toLowerCase().includes(term))
        : historico;
    renderHistorico(filtered);
}

// ===== UTILS =====
function saveBadge(count) {
    localStorage.setItem('pv_pending_count', count);
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== CONFIGURAÇÕES =====
function abrirConfiguracoes() {
    const overlay = document.getElementById('configOverlay');
    const modal = document.getElementById('configModal');

    // Carregar mensagens atuais
    document.getElementById('msg-5').value = mensagensPosvenda[5] || '';
    document.getElementById('msg-15').value = mensagensPosvenda[15] || '';
    document.getElementById('msg-30').value = mensagensPosvenda[30] || '';

    atualizarContadores();

    overlay.classList.add('active');
    modal.classList.add('active');
}

function fecharConfiguracoes(event) {
    if (event && event.target.id !== 'configOverlay') return;

    const overlay = document.getElementById('configOverlay');
    const modal = document.getElementById('configModal');

    overlay.classList.remove('active');
    modal.classList.remove('active');
}

async function salvarConfiguracoes() {
    const msg5 = document.getElementById('msg-5').value.trim();
    const msg15 = document.getElementById('msg-15').value.trim();
    const msg30 = document.getElementById('msg-30').value.trim();

    if (!msg5 || !msg15 || !msg30) {
        showToast('❌ Todas as mensagens são obrigatórias');
        return;
    }

    try {
        const eid = getEmpresaId();
        // 🔒 Usa doc ID composto com empresa_id para isolar por empresa
        await setDoc(doc(db, "posvenda_mensagens", `${eid}_5`), {
            mensagem: msg5, empresa_id: eid, updatedAt: new Date()
        }, { merge: true });
        await setDoc(doc(db, "posvenda_mensagens", `${eid}_15`), {
            mensagem: msg15, empresa_id: eid, updatedAt: new Date()
        }, { merge: true });
        await setDoc(doc(db, "posvenda_mensagens", `${eid}_30`), {
            mensagem: msg30, empresa_id: eid, updatedAt: new Date()
        }, { merge: true });

        mensagensPosvenda[5] = msg5;
        mensagensPosvenda[15] = msg15;
        mensagensPosvenda[30] = msg30;

        showToast('✅ Configurações salvas com sucesso');
        fecharConfiguracoes();
    } catch (err) {
        console.error('❌ Erro ao salvar configurações:', err);
        showToast('❌ Erro ao salvar. Tente novamente.');
    }
}

function atualizarContadores() {
    ['5', '15', '30'].forEach(prazo => {
        const textarea = document.getElementById(`msg-${prazo}`);
        const counter = document.getElementById(`count-${prazo}-chars`);
        if (textarea && counter) {
            counter.textContent = textarea.value.length;
            textarea.oninput = function() {
                counter.textContent = this.value.length;
            };
        }
    });
}

// ===== VER MENSAGEM =====
function verMensagem(prazo, nome, modelo) {
    let msg = mensagensPosvenda[prazo] || mensagensPosvenda[5];
    msg = msg.replace('{{nome}}', nome).replace('{{modelo}}', modelo);

    const popover = document.createElement('div');
    popover.className = 'pv-msg-popover';
    popover.innerHTML = `
        <div class="pv-msg-content">
            <div class="pv-msg-header">
                <span>👁 Visualizar Mensagem</span>
                <button class="pv-msg-close" onclick="this.closest('.pv-msg-popover').remove()">✕</button>
            </div>
            <div class="pv-msg-body">
                ${msg}
            </div>
            <div class="pv-msg-footer">
                <button class="pv-msg-copy-btn" onclick="navigator.clipboard.writeText('${msg.replace(/'/g, "\\'")}').then(() => { showToast('✅ Mensagem copiada'); this.closest('.pv-msg-popover').remove(); }).catch(() => showToast('❌ Erro ao copiar'))">📋 Copiar</button>
                <button class="pv-msg-close-btn" onclick="this.closest('.pv-msg-popover').remove()">✕ Fechar</button>
            </div>
        </div>
    `;

    document.body.appendChild(popover);

    popover.addEventListener('click', (e) => {
        if (e.target === popover) popover.remove();
    });
}

// ===== ATALHOS DE TECLADO =====
window.atalhos = atalhos;
function atalhos(event) {
    const key = event.key.toUpperCase();
    const activeElement = document.activeElement;
    const isInputFocused = activeElement.tagName === 'INPUT' ||
                          activeElement.tagName === 'TEXTAREA' ||
                          activeElement.contentEditable === 'true';

    if (isInputFocused) return;

    const cardAtivo = document.querySelector('.pv-card:hover');
    if (!cardAtivo) return;

    const osId = cardAtivo.dataset.osid;
    const prazo = parseInt(cardAtivo.dataset.prazo);
    const os = pendentes[prazo]?.find(o => o.osId === osId);

    if (!os) return;

    if (key === 'V') {
        event.preventDefault();
        copiarTelefone(os.phone);
    } else if (key === 'B') {
        event.preventDefault();
        copiarMensagem(prazo, os.clientName, os.model);
    } else if (key === 'N') {
        event.preventDefault();
        copiarTudo(prazo, os.clientName, os.phone, os.model);
    }
}

document.addEventListener('keydown', atalhos);

// ===== START =====
document.addEventListener('DOMContentLoaded', init);
