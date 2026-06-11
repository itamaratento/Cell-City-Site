import { db, collection, getDocs, getDoc, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from "../../scripts/firebase.js";

// ===== EXPOSIÇÃO GLOBAL =====
window.handleLockPhoto = handleLockPhoto;
window.removeLockPhoto = removeLockPhoto;
window.showScreen = showScreen;
window.goBack = goBack;
window.updateChecklistItem = updateChecklistItem;
window.handlePhotos = handlePhotos;
window.removePhoto = removePhoto;
window.viewPhoto = viewPhoto;
window.startOS = startOS;
window.saveOS = saveOS;
window.saveTechObservation = saveTechObservation;
window.showList = showList;
window.toggleFav = toggleFav;
window.filterList = filterList;
window.openDetail = openDetail;
window.changeStatus = changeStatus;
window.addObservation = addObservation;
window.addPhotoToOS = addPhotoToOS;
window.markDelivered = markDelivered;
window.openClientFromOS = openClientFromOS;
window.deleteOS = deleteOS;
window.deleteClient = deleteClient;
window.editClient = editClient;
window.saveClientEdit = saveClientEdit;
window.toggleOSEdit = toggleOSEdit;
window.saveOSEdit = saveOSEdit;
window.saveObservation = saveObservation;
window.shareWhatsApp = shareWhatsApp;
window.printOS = printOS;
window.sendWarrantyWhatsApp = sendWarrantyWhatsApp;
window.copyWarrantyToClipboard = copyWarrantyToClipboard;
window.generateWarrantyLink = generateWarrantyLink;
window.searchClients = searchClients;
window.showClientDetail = showClientDetail;
window.startOSForClient = startOSForClient;
window.globalSearch = globalSearch;
window.closeModal = closeModal;
window.openGlobalSearch = openGlobalSearch;
window.openPhotoBank = openPhotoBank;
window.toggleLockType = toggleLockType;
window.openPatternModal = openPatternModal;
window.closePatternModal = closePatternModal;
window.clearPatternCanvas = clearPatternCanvas;
window.savePattern = savePattern;
window.showPatternDrawing = showPatternDrawing;
window.showPatternSequence = showPatternSequence;
window.clearPattern = clearPattern;
window.showOSPatternDrawing = showOSPatternDrawing;
window.showOSPatternSequence = showOSPatternSequence;
window.saveInternalObservation = saveInternalObservation;
window.toggleClientManagement = toggleClientManagement;
window.saveFullClient = saveFullClient;
window.setClientRating = setClientRating;
window.addClientTag = addClientTag;
window.removeClientTag = removeClientTag;
window.toggleClientPassword = toggleClientPassword;
window.fetchCEP = fetchCEP;
window.openWhatsApp = openWhatsApp;
window.editClientFromDetail = editClientFromDetail;
window.togglePasswordVisibility = togglePasswordVisibility;
window.copyPasswordToClipboard = copyPasswordToClipboard;
window.toggleRelatorioTecnico = toggleRelatorioTecnico;
window.copyMessageToClipboard = copyMessageToClipboard;

function toggleRelatorioTecnico() {
    const body = document.getElementById('rel-tec-body');
    const btn = document.getElementById('rel-tec-toggle');
    if (!body) return;
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    if (btn) btn.textContent = open ? '📖 Abrir Relatório' : '📕 Recolher Relatório';
}

// ===== BANCO DE FOTOS EXTERNO =====
const DRIVE_FOLDER_ID = ''; 
const DRIVE_FOLDER_URL = DRIVE_FOLDER_ID ? `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}` : 'https://drive.google.com/drive/my-drive';
const DRIVE_PACKAGE = 'com.google.android.apps.docs';

function getPlatform() {
    const ua = navigator.userAgent || navigator.vendor || '';
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
    return 'desktop';
}

function openPhotoBank() {
    const platform = getPlatform();
    if (platform === 'android') {
        const intentUrl = `intent://drive.google.com${DRIVE_FOLDER_ID ? `/drive/folders/${DRIVE_FOLDER_ID}` : '/drive/my-drive'}#Intent;scheme=https;package=${DRIVE_PACKAGE};S.browser_fallback_url=${encodeURIComponent(DRIVE_FOLDER_URL)};end`;
        window.location.href = intentUrl;
        showToast('📸 Abrindo Banco de Fotos...');
    } else {
        window.open(DRIVE_FOLDER_URL, '_blank', 'noopener,noreferrer');
        showToast('📸 Banco de Fotos aberto em nova aba');
    }
}

// ===== PATTERN LOCK =====
window.tempPatternSequence = null;
let patternSequence = [], patternCanvas = null, patternCtx = null, patternPoints = [], isDrawing = false, currentPath = [];

function initPatternCanvas() {
    patternCanvas = document.getElementById('pattern-canvas');
    if (!patternCanvas) return;
    patternCtx = patternCanvas.getContext('2d');
    const canvasSize = 300, padding = 50, spacing = (canvasSize - 2 * padding) / 2;
    patternPoints = [];
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            patternPoints.push({ x: padding + col * spacing, y: padding + row * spacing, index: row * 3 + col });
        }
    }
    drawPatternDots();
    patternCanvas.addEventListener('mousedown', startDrawingPattern);
    patternCanvas.addEventListener('mousemove', drawPattern);
    patternCanvas.addEventListener('mouseup', stopDrawingPattern);
    patternCanvas.addEventListener('mouseout', stopDrawingPattern);
    patternCanvas.addEventListener('touchstart', e => { e.preventDefault(); startDrawingPattern(getTouchEvent(e)); });
    patternCanvas.addEventListener('touchmove', e => { e.preventDefault(); drawPattern(getTouchEvent(e)); });
    patternCanvas.addEventListener('touchend', e => { e.preventDefault(); stopDrawingPattern(); });
}

function getTouchEvent(e) {
    const r = patternCanvas.getBoundingClientRect();
    return { offsetX: e.touches[0].clientX - r.left, offsetY: e.touches[0].clientY - r.top };
}

function startDrawingPattern(e) {
    isDrawing = true; currentPath = []; patternSequence = [];
    const p = getClosestPoint(e.offsetX, e.offsetY);
    if (p) { currentPath.push(p); patternSequence.push(p.index); drawPatternDots(); }
}

function drawPattern(e) {
    if (!isDrawing) return;
    const p = getClosestPoint(e.offsetX, e.offsetY);
    if (p && !currentPath.includes(p)) { currentPath.push(p); patternSequence.push(p.index); drawPatternDots(); }
}

function stopDrawingPattern() {
    if (!isDrawing) return;
    isDrawing = false;
    if (patternSequence.length < 2) {
        showToast('⚠️ Conecte pelo menos 2 pontos');
        patternSequence = []; currentPath = []; drawPatternDots();
    }
}

function getClosestPoint(x, y) {
    let c = null, m = Infinity;
    for (const p of patternPoints) {
        const d = Math.sqrt(Math.pow(x - p.x, 2) + Math.pow(y - p.y, 2));
        if (d < 25 && d < m) { m = d; c = p; }
    }
    return c;
}

function drawPatternDots() {
    patternCtx.clearRect(0, 0, patternCanvas.width, patternCanvas.height);
    if (currentPath.length > 1) {
        patternCtx.strokeStyle = '#00C853'; patternCtx.lineWidth = 3;
        patternCtx.lineCap = 'round'; patternCtx.lineJoin = 'round';
        patternCtx.shadowBlur = 10; patternCtx.shadowColor = 'rgba(0, 200, 83, 0.5)';
        patternCtx.beginPath();
        patternCtx.moveTo(currentPath[0].x, currentPath[0].y);
        for (let i = 1; i < currentPath.length; i++) patternCtx.lineTo(currentPath[i].x, currentPath[i].y);
        patternCtx.stroke(); patternCtx.shadowBlur = 0;
    }
    for (const p of patternPoints) {
        const conn = currentPath.includes(p), last = p === currentPath[currentPath.length - 1];
        patternCtx.beginPath();
        patternCtx.arc(p.x, p.y, conn ? 14 : 10, 0, Math.PI * 2);
        if (last) { patternCtx.fillStyle = '#00E676'; patternCtx.shadowBlur = 15; patternCtx.shadowColor = 'rgba(0, 200, 83, 0.6)'; }
        else if (conn) { patternCtx.fillStyle = '#00C853'; patternCtx.shadowBlur = 8; patternCtx.shadowColor = 'rgba(0, 200, 83, 0.4)'; }
        else { patternCtx.fillStyle = '#6b7280'; patternCtx.shadowBlur = 0; }
        patternCtx.fill(); patternCtx.shadowBlur = 0;
    }
}

function openPatternModal() {
    document.getElementById('pattern-overlay').style.display = 'flex';
    document.getElementById('pattern-canvas-container').style.display = 'block';
    document.getElementById('pattern-preview-container').style.display = 'none';
    setTimeout(() => { initPatternCanvas(); patternSequence = []; currentPath = []; drawPatternDots(); }, 100);
}

function closePatternModal(e) {
    if (e && e.target.id !== 'pattern-overlay' && !e.target.closest('button')) return;
    document.getElementById('pattern-overlay').style.display = 'none';
}

function clearPatternCanvas() { patternSequence = []; currentPath = []; drawPatternDots(); }

function savePattern() {
    if (patternSequence.length < 4) { showToast('⚠️ O padrão deve ter pelo menos 4 pontos'); return; }
    window.tempPatternSequence = [...patternSequence];
    const s = document.getElementById('pattern-summary'); if (s) s.style.display = 'block';
    closePatternModal(); showToast('✅ Padrão registrado');
    window.markUnsaved();
}

function renderPatternOnCanvas(id, seq) {
    const cv = document.getElementById(id); if (!cv) return;
    const ctx = cv.getContext('2d');
    const sz = 300, pd = 50, sp = (sz - 2 * pd) / 2;
    const pts = [];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            pts.push({ x: pd + c * sp, y: pd + r * sp, index: r * 3 + c });
        }
    }
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (seq.length > 1) {
        ctx.strokeStyle = '#00C853'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(0, 200, 83, 0.5)';
        ctx.beginPath();
        ctx.moveTo(pts[seq[0]].x, pts[seq[0]].y);
        for (let i = 1; i < seq.length; i++) ctx.lineTo(pts[seq[i]].x, pts[seq[i]].y);
        ctx.stroke(); ctx.shadowBlur = 0;
    }
    for (const p of pts) {
        const conn = seq.includes(p.index), last = p.index === seq[seq.length - 1];
        ctx.beginPath();
        ctx.arc(p.x, p.y, conn ? 14 : 10, 0, Math.PI * 2);
        if (last) { ctx.fillStyle = '#00E676'; ctx.shadowBlur = 15; ctx.shadowColor = 'rgba(0, 200, 83, 0.6)'; }
        else if (conn) { ctx.fillStyle = '#00C853'; ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(0, 200, 83, 0.4)'; }
        else { ctx.fillStyle = '#6b7280'; ctx.shadowBlur = 0; }
        ctx.fill(); ctx.shadowBlur = 0;
    }
}

function showPatternDrawing() {
    if (!window.tempPatternSequence || !window.tempPatternSequence.length) { showToast('⚠️ Nenhum padrão registrado'); return; }
    document.getElementById('pattern-overlay').style.display = 'flex';
    document.getElementById('pattern-canvas-container').style.display = 'none';
    document.getElementById('pattern-preview-container').style.display = 'block';
    setTimeout(() => renderPatternOnCanvas('pattern-preview-canvas', window.tempPatternSequence), 100);
}

function showPatternSequence() {
    if (!window.tempPatternSequence || !window.tempPatternSequence.length) { showToast('⚠️ Nenhum padrão registrado'); return; }
    const seq = window.tempPatternSequence.map(i => i + 1).join(' → ');
    openModal(`<div class="modal-handle"></div><h3 style="font-size:16px;font-weight:700;margin-bottom:16px;color:var(--text);text-align:center;">🔢 Sequência do Padrão</h3><div style="background:var(--surface2);padding:20px;border-radius:var(--radius);text-align:center;margin-bottom:16px;"><div style="font-size:24px;font-weight:800;color:var(--green-light);font-family:var(--font-mono);">${seq}</div><div style="font-size:12px;color:var(--text3);margin-top:8px;">${window.tempPatternSequence.length} pontos conectados</div></div><button type="button" onclick="closeModal()" style="width:100%;padding:12px;background:var(--green-primary);border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;color:#000;font-weight:700;">Fechar</button>`);
}

function clearPattern() {
    if (!confirm('Deseja limpar o padrão registrado?')) return;
    window.tempPatternSequence = null;
    const s = document.getElementById('pattern-summary'); if (s) s.style.display = 'none';
    showToast('🗑️ Padrão removido');
    window.markUnsaved();
}

function toggleLockType() {
    const lt = document.getElementById('lock-type').value;
    const ps = document.getElementById('pattern-section');
    const lp = document.getElementById('lock-photo-section');
    const si = document.getElementById('f-senha');
    if (lt === 'Padrao') {
        if (ps) ps.style.display = 'block';
        if (lp) lp.style.display = 'none';
        if (si) { si.disabled = true; si.value = ''; }
    } else if (lt === 'Numerica' || lt === 'Biometria' || lt === 'Face ID' || lt === 'Digital') {
        if (ps) ps.style.display = 'none';
        if (lp) lp.style.display = 'block';
        if (si) si.disabled = false;
    } else {
        if (ps) ps.style.display = 'none';
        if (lp) lp.style.display = 'none';
        if (si) { si.disabled = true; si.value = ''; }
    }
}

function showOSPatternDrawing(osId) {
    const os = DB.getOS().find(o => o.id === osId);
    if (!os || !os.patternSequence || !os.patternSequence.length) { showToast('⚠️ Nenhum padrão registrado'); return; }
    document.getElementById('pattern-overlay').style.display = 'flex';
    document.getElementById('pattern-canvas-container').style.display = 'none';
    document.getElementById('pattern-preview-container').style.display = 'block';
    setTimeout(() => renderPatternOnCanvas('pattern-preview-canvas', os.patternSequence), 100);
}

function showOSPatternSequence(osId) {
    const os = DB.getOS().find(o => o.id === osId);
    if (!os || !os.patternSequence || !os.patternSequence.length) { showToast('⚠️ Nenhum padrão registrado'); return; }
    const seq = os.patternSequence.map(i => i + 1).join(' → ');
    openModal(`<div class="modal-handle"></div><h3 style="font-size:16px;font-weight:700;margin-bottom:16px;color:var(--text);text-align:center;">🔢 Sequência do Padrão</h3><div style="background:var(--surface2);padding:20px;border-radius:var(--radius);text-align:center;margin-bottom:16px;"><div style="font-size:24px;font-weight:800;color:var(--green-light);font-family:var(--font-mono);">${seq}</div><div style="font-size:12px;color:var(--text3);margin-top:8px;">${os.patternSequence.length} pontos conectados</div></div><button type="button" onclick="closeModal()" style="width:100%;padding:12px;background:var(--green-primary);border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;color:#000;font-weight:700;">Fechar</button>`);
}

// ===== STATE & AUTO-SAVE =====
let currentOS = null, currentCategory = '', tempPhotos = [], currentLockPhoto = null;
let screenHistory = [], currentListFilter = '', currentClientPhone = '', appInitialized = false;
let hasUnsavedChanges = false;

function updateSaveUI() {
    const el = document.getElementById('save-status');
    if (!el) return;
    el.innerHTML = hasUnsavedChanges
        ? `<span style="color:#f59e0b;font-size:12px;font-weight:600;">⚠️ Alterações não salvas</span>`
        : `<span style="color:#22c55e;font-size:12px;font-weight:600;">✅ Tudo salvo</span>`;
}

window.markUnsaved = () => { hasUnsavedChanges = true; updateSaveUI(); };
window.markSaved = () => { hasUnsavedChanges = false; updateSaveUI(); };
window.addEventListener('beforeunload', e => { if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; } });

function guardNavigation(callback) {
    if (hasUnsavedChanges && !confirm('Existem alterações não salvas. Deseja sair mesmo assim?')) return false;
    callback(); return true;
}

// ===== DATA LAYER =====
let localOS = [];
let localClients = [];
let localCounter = 0;

const DB = {
    getOS() { return localOS; },
    async addOS(osData) { localOS.unshift(osData); await setDoc(doc(db, "os", osData.id), osData); },
    async updateOS(osData) { const idx = localOS.findIndex(o => o.id === osData.id); if (idx >= 0) localOS[idx] = osData; await updateDoc(doc(db, "os", osData.id), osData); },
    async deleteOS(id) { localOS = localOS.filter(o => o.id !== id); await deleteDoc(doc(db, "os", id)); },
    getClients() { return localClients; },
    async saveClient(clientData) { const idx = localClients.findIndex(c => c.phone === clientData.phone); if (idx >= 0) localClients[idx] = clientData; else localClients.push(clientData); await setDoc(doc(db, "clientes", clientData.phone), clientData); },
    getCounter() { return localCounter; },
    async incCounter() { localCounter++; await setDoc(doc(db, "metadata", "counter"), { value: localCounter }); return localCounter; },
    async loadFromFirestore() {
        try {
            localOS = []; localClients = []; localCounter = 0;
            const osSnap = await getDocs(collection(db, "os"));
            localOS = osSnap.docs.map(d => d.data()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const clientSnap = await getDocs(collection(db, "clientes"));
            localClients = clientSnap.docs.map(d => d.data());
            const counterSnap = await getDocs(collection(db, "metadata"));
            counterSnap.forEach(d => { if (d.id === "counter") localCounter = d.data().value || 0; });
        } catch (e) { console.error("Erro ao carregar do Firestore:", e); }
    }
};

// ===== LOCK PHOTO =====
function handleLockPhoto(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        const img = new Image();
        img.onload = function() {
            const c = document.createElement('canvas'); const max = 450; let w = img.width, h = img.height;
            if (w > max || h > max) w > h ? (h = h * max / w, w = max) : (w = w * max / h, h = max);
            c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
            currentLockPhoto = c.toDataURL('image/jpeg', 0.75);
            const p = document.getElementById('lock-photo-preview');
            if (p) p.innerHTML = `<div style="position:relative;display:inline-block;animation:fadeIn 0.2s ease;"><img src="${currentLockPhoto}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--green-primary);cursor:pointer;" onclick="viewPhoto('${currentLockPhoto}')"><button onclick="removeLockPhoto()" style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;background:var(--red);color:white;border:none;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button></div>`;
        }; img.src = ev.target.result;
    }; reader.readAsDataURL(file); event.target.value = '';
}

function removeLockPhoto() { currentLockPhoto = null; ['lock-photo', 'lock-photo-camera'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); const p = document.getElementById('lock-photo-preview'); if (p) p.innerHTML = ''; }

// ===== NAVIGATION =====
async function showScreen(id) {
    guardNavigation(async () => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById('screen-' + id);
        if (!target) return console.warn(`Tela ${id} não encontrada`);
        target.classList.add('active');
        if (id === 'home') { screenHistory = []; window.markSaved(); window.tempPatternSequence = null; await DB.loadFromFirestore(); updateStats(); }
        else { if (!screenHistory.includes(id)) screenHistory.push(id); }
        const osBtn = document.getElementById('btn-os-home'); if (osBtn) osBtn.style.display = id === 'home' ? 'none' : 'block';
        
        // Título central do menu superior.
        const titleEl = document.getElementById('headerTitle');
        const titles = { home: 'Nova O.S.', pesquisar: 'Pesquisar', 'client-detail': 'Detalhes do Cliente' };
        if (titleEl) { 
            titleEl.textContent = titles[id] || ''; 
            if (id === 'clientes') { renderClients(); salvarUltimaTela('clientes', 'Clientes', '', '#fav-clientes'); }
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function goBack() { guardNavigation(() => { screenHistory.pop(); showScreen(screenHistory.length > 0 ? screenHistory[screenHistory.length - 1] : 'home'); }); }

// ===== UTILS =====
function formatPhone(v) { v = v.replace(/\D/g, ''); if (v.length > 11) v = v.slice(0, 11); return v.length > 6 ? `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}` : v.length > 2 ? `(${v.slice(0,2)}) ${v.slice(2)}` : v.length > 0 ? `(${v}` : v; }
function getCategoryLabel(cat) { return { celular: '📱 Celular', notebook: '💻 Notebook', impressora: '🖨️ Impressora' }[cat] || cat; }
function getCategoryIcon(cat) { return { celular: '📱', notebook: '💻', impressora: '🖨️' }[cat] || ''; }
// ===== FLUXO DE STATUS (9 etapas — padrão Cell City) =====
const STATUS_FLOW = [
    { key: 'recebido',             label: 'Recebido',             color: 'var(--blue)' },
    { key: 'em_analise',           label: 'Em análise',           color: 'var(--blue)' },
    { key: 'orcamento_enviado',    label: 'Orçamento enviado',    color: 'var(--yellow)' },
    { key: 'orcamento_aprovado',   label: 'Orçamento aprovado',   color: 'var(--green)' },
    { key: 'orcamento_recusado',   label: 'Orçamento recusado',   color: 'var(--red)' },
    { key: 'em_reparo',            label: 'Em reparo',            color: 'var(--orange)' },
    { key: 'testes_finais',        label: 'Testes finais',        color: '#a78bfa' },
    { key: 'concluido',            label: 'Concluído',            color: 'var(--green)' },
    { key: 'entregue',             label: 'Entregue',             color: 'var(--text3)' }
];
// Mapeia status antigos (OS já gravadas) para os rótulos novos, sem migração forçada.
const STATUS_LEGACY = {
    aguardando_peca:       'Aguardando peça',
    orcamento:             'Orçamento enviado',
    pronto:                'Concluído',
    devolvido_orcamento:   'Orçamento recusado',
    aguardando_aprovacao:  'Orçamento enviado',
    aprovado:              'Orçamento aprovado'
};
// Status que encerram a OS (saem de "em andamento").
const STATUS_TERMINAIS = ['entregue', 'orcamento_recusado', 'devolvido_orcamento'];

function getStatusLabel(status) {
    const found = STATUS_FLOW.find(s => s.key === status);
    if (found) return found.label;
    return STATUS_LEGACY[status] || status || '';
}
function formatDate(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''; }
function formatDateShort(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''; }

// ===== STATS =====
function updateStats() {
    const orders = DB.getOS(); const andamento = orders.filter(o => !STATUS_TERMINAIS.includes(o.status)).length; const finalizados = orders.filter(o => STATUS_TERMINAIS.includes(o.status)).length;
    const bar = document.getElementById('statsBar'); if (bar) bar.innerHTML = `<div class="stat-chip"><span class="num">${orders.length}</span><span class="stat-label">Total</span></div><div class="stat-chip"><span class="num">${andamento}</span><span class="stat-label">Em andamento</span></div><div class="stat-chip"><span class="num">${finalizados}</span><span class="stat-label">Finalizados</span></div>`;
    ['andamento', 'finalizados'].forEach(type => { const el = document.getElementById(`badge-${type}`); if (!el) return; el.style.display = (type === 'andamento' ? andamento : finalizados) > 0 ? 'flex' : 'none'; el.textContent = type === 'andamento' ? andamento : finalizados; });
}

// ===== CHECKLIST & PHOTOS =====
function getChecklistTemplate(cat) { const b = ['Tela / Display','Câmera frontal','Câmera traseira','Botões / Teclado','Carregador / Bateria','Wi-Fi / Bluetooth','Alto-falante','Microfone']; return cat === 'celular' ? [...b, 'Slot SIM/SD', 'Sensor de proximidade', 'Leitor digital'] : cat === 'notebook' ? [...b, 'Trackpad', 'Portas USB', 'Leitor de cartão', 'Webcam'] : cat === 'impressora' ? ['Cabeçote de impressão','Cartuchos / Toner','Bandeja de papel','Conexão USB/Wi-Fi','Display/Painel','Rolos de alimentação'] : b; }

function renderChecklist(cid, items, key, checked = []) { const c = document.getElementById(cid); if (!c) return; c.innerHTML = items.map((item, i) => `<div class="checklist-item"><input type="checkbox" id="${key}-${i}" ${checked.includes(i) ? 'checked' : ''} onchange="updateChecklistItem('${key}', ${i}, this.checked)"><label for="${key}-${i}" style="cursor:pointer;flex:1">${item}</label></div>`).join(''); }

async function updateChecklistItem(type, index, value) { if (!currentOS) return; const key = type === 'entry' ? 'entryChecklist' : 'exitChecklist'; if (!currentOS[key]) currentOS[key] = []; value ? !currentOS[key].includes(index) && currentOS[key].push(index) : currentOS[key] = currentOS[key].filter(i => i !== index); await saveCurrentOS(); }

function handlePhotos(e) { const files = e.target.files; if (!files) return; for (let f of files) { const r = new FileReader(); r.onload = function(ev) { const img = new Image(); img.onload = function() { const c = document.createElement('canvas'); const max = 800; let w = img.width, h = img.height; if (w > max || h > max) w > h ? (h = h * max / w, w = max) : (w = w * max / h, h = max); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); tempPhotos.push(c.toDataURL('image/jpeg', 0.7)); renderPhotoPreview(); }; img.src = ev.target.result; }; r.readAsDataURL(f); } e.target.value = ''; }

function renderPhotoPreview() { const c = document.getElementById('photo-preview'); if (!c) return; c.innerHTML = tempPhotos.map((p, i) => `<div class="photo-thumb-wrap"><img class="photo-thumb" src="${p}" onclick="viewPhoto('${p}')"><button class="photo-remove" onclick="removePhoto(${i})">✕</button></div>`).join(''); }
function removePhoto(i) { tempPhotos.splice(i, 1); renderPhotoPreview(); }
function viewPhoto(src) { openModal(`<div class="modal-handle"></div><img src="${src}" style="width:100%;border-radius:8px;">`); }

// ===== CREATE OS =====
function startOS(cat) { currentCategory = cat; tempPhotos = []; currentLockPhoto = null; window.tempPatternSequence = null; ['f-nome','f-telefone','f-cpf','f-cep','f-endereco','f-numero','f-complemento','f-bairro','f-cidade','f-estado','f-marca','f-modelo','f-imei','f-defeito','f-valor','f-valor-cartao','f-tecnico','f-senha','f-obs'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); const gEl = document.getElementById('f-garantia'); if (gEl) gEl.value = '90'; const gSel = document.getElementById('f-garantia-modelo'); if (gSel) gSel.value = ''; const lock = document.getElementById('lock-type'); if(lock) { lock.value = 'Numerica'; toggleLockType(); } ['lock-photo','lock-photo-camera'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); const prev = document.getElementById('lock-photo-preview'); if(prev) prev.innerHTML = ''; const pprev = document.getElementById('photo-preview'); if(pprev) pprev.innerHTML = ''; const summary = document.getElementById('pattern-summary'); if(summary) summary.style.display = 'none'; renderChecklist('entry-checklist', getChecklistTemplate(cat), 'entry', []); window.markSaved(); showScreen('form'); }

async function saveOS() {
    const getVal = id => document.getElementById(id)?.value.trim() || '';
    const [nome, telefone, marca, modelo, imei, defeito, tecnico, senha, obs, lockType, cpf, cep, endereco, numero, complemento, bairro, cidade, estado] = ['f-nome','f-telefone','f-marca','f-modelo','f-imei','f-defeito','f-tecnico','f-senha','f-obs','lock-type','f-cpf','f-cep','f-endereco','f-numero','f-complemento','f-bairro','f-cidade','f-estado'].map(getVal);
    const valor = parseFloat((document.getElementById('f-valor')?.value || '').replace(',', '.')) || 0;
    const valorCartao = parseFloat((document.getElementById('f-valor-cartao')?.value || '').replace(',', '.')) || 0;
    const garantiaDias = parseInt(document.getElementById('f-garantia')?.value, 10) || 90;
    const garantiaId = document.getElementById('f-garantia-modelo')?.value || '';
    const imei1 = (document.getElementById('f-imei1')?.value || '').trim();
    const imei2 = (document.getElementById('f-imei2')?.value || '').trim();
    // Orçamento 1 e Orçamento 2
    const orc1Desc = (document.getElementById('f-orc1-desc')?.value || '').trim();
    const orc1Valor = parseFloat((document.getElementById('f-orc1-valor')?.value || '').replace(',', '.')) || 0;
    const orc2Desc = (document.getElementById('f-orc2-desc')?.value || '').trim();
    const orc2Valor = parseFloat((document.getElementById('f-orc2-valor')?.value || '').replace(',', '.')) || 0;
    if (!nome || !telefone || !modelo || !defeito) return showToast('⚠️ Preencha todos os campos obrigatórios');
    if (lockType === 'Padrao' && (!window.tempPatternSequence || window.tempPatternSequence.length < 4)) {
        return showToast('⚠️ Registre um padrão com pelo menos 4 pontos');
    }
    const entryChecked = getChecklistTemplate(currentCategory).map((_, i) => document.getElementById(`entry-${i}`)?.checked ? i : -1).filter(i => i !== -1);
    const num = await DB.incCounter(); const osId = `OS-${String(num).padStart(4, '0')}`;
    const os = {
        id: osId, category: currentCategory, clientName: nome, phone: telefone, cpf: cpf || null, cep: cep || null, endereco: endereco || null, numero: numero || null, complemento: complemento || null, bairro: bairro || null, cidade: cidade || null, estado: estado || null, brand: marca, model: modelo, imei, defect: defeito, valor, valorCartao, technician: tecnico, observations: obs, technicalObservation: "",
        internalObservation: "", password: lockType === 'Padrao' ? '' : senha, lockType, lockPhoto: currentLockPhoto, photos: tempPhotos, entryChecklist: entryChecked, exitChecklist: [], status: 'recebido', prazoGarantia: garantiaDias, garantiaId: garantiaId || null, imei1: imei1 || null, imei2: imei2 || null,
        orc1Desc: orc1Desc || null, orc1Valor: orc1Valor || 0, orc2Desc: orc2Desc || null, orc2Valor: orc2Valor || 0,
        timeline: [{ date: new Date().toISOString(), text: `O.S. criada — ${getCategoryLabel(currentCategory)}` }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        origem: portalOSPendente ? 'portal' : 'presencial', solicitacaoId: portalOSPendente || null
    };
    if (lockType === 'Padrao' && window.tempPatternSequence && window.tempPatternSequence.length > 0) {
        os.patternSequence = window.tempPatternSequence;
    }
    await DB.addOS(os); await updateClientHistory(telefone, nome, osId);
    runAutomacoesOS(os);
    if (preOSPendente) {
        try {
            await updateDoc(doc(db, 'pre_os', preOSPendente), { status: 'CONVERTIDA', osId, atualizadoEm: new Date().toISOString() });
            console.log('✅ [Conversão] Pré-OS', preOSPendente, 'marcada como CONVERTIDA e vinculada a', osId);
        } catch (e) {
            console.warn('⚠️ [Conversão] OS criada, mas não foi possível marcar a Pré-OS como convertida:', e);
        }
        preOSPendente = null;
    }
    if (portalOSPendente) {
        try {
            await updateDoc(doc(db, 'solicitacoes_diagnostico', portalOSPendente), { status: 'convertido', osId, respondido: true, atualizadoEm: new Date().toISOString() });
            console.log('✅ [Portal] Solicitação de diagnóstico', portalOSPendente, 'marcada como convertida e vinculada a', osId);
        } catch (e) {
            console.warn('⚠️ [Portal] OS criada, mas não foi possível marcar a solicitação como convertida:', e);
        }
        portalOSPendente = null;
    }
    showToast(`✅ ${osId} criada com sucesso!`); window.markSaved(); showScreen('home');
}

async function updateClientHistory(phone, name, osId) { let c = DB.getClients().find(cl => cl.phone === phone); if (c) { !c.history.includes(osId) && c.history.push(osId); c.name = name; } else { c = { name, phone, history: [osId], createdAt: new Date().toISOString() }; } await DB.saveClient(c); }

// ===== AUTOMAÇÃO: INFRAESTRUTURA DE LOGS (FASE 1-B) =====

// Grava um registro em automacao_logs e, se status='executado',
// marca o flag de deduplicação em automacao_execucoes.
async function registrarAutomacao({ automationId, osId, cliente, telefone, status, detalhes, erro }) {
    const logId = `${automationId}_${osId}_${Date.now()}`;
    try {
        await setDoc(doc(db, 'automacao_logs', logId), {
            automationId,
            osId,
            cliente:     cliente  || '',
            telefone:    (telefone || '').replace(/\D/g, ''),
            status,                           // 'executado' | 'erro' | 'ignorado'
            executadoEm: serverTimestamp(),
            detalhes:    detalhes || null,
            erro:        erro     || null
        });
        // Flag de deduplicação — ID estável para consulta O(1) por jaExecutouAutomacao
        if (status === 'executado') {
            await setDoc(doc(db, 'automacao_execucoes', `${automationId}_${osId}`), {
                automationId,
                osId,
                executadoEm: serverTimestamp()
            });
        }
    } catch (e) {
        console.warn(`⚠️ [Automação] Log "${automationId}/${osId}" não gravado:`, e);
    }
}

// Verifica se uma automação já foi executada com sucesso para esta OS.
// Retorna true → não executar novamente. Retorna false → executar.
// Em caso de erro de leitura, retorna false (fail-open: melhor executar duas vezes que não executar).
async function jaExecutouAutomacao(automationId, osId) {
    try {
        const snap = await getDoc(doc(db, 'automacao_execucoes', `${automationId}_${osId}`));
        return snap.exists();
    } catch (e) {
        console.warn(`⚠️ [Automação] jaExecutouAutomacao falhou — permitindo execução:`, e);
        return false;
    }
}

// ===== AUTOMAÇÃO: ENTRADA DE OS =====
async function runAutomacoesOS(os) {
    // ── WhatsApp de entrada ────────────────────────────────────────────────────
    if (!(await jaExecutouAutomacao('entrada_os', os.id))) {
        const msg = `*Cell City — Entrada de aparelho* ✅\n\n📋 *${os.id}*\n👤 ${os.clientName}\n📱 ${[os.brand, os.model].filter(Boolean).join(' ')}\n🔧 ${os.defect}\n📅 ${formatDate(os.createdAt)}\n\nSeu aparelho foi recebido e já está em análise. Te avisamos quando estiver pronto! 😊`;
        window.open(`https://wa.me/55${(os.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
        await registrarAutomacao({
            automationId: 'entrada_os',
            osId:         os.id,
            cliente:      os.clientName,
            telefone:     os.phone,
            status:       'executado',
            detalhes:     msg,
            erro:         null
        });
    }

    // ── Lembrete de retorno na agenda (+3 dias) ────────────────────────────────
    try {
        const dataRetorno = new Date();
        dataRetorno.setDate(dataRetorno.getDate() + 3);
        const dataKey = dataRetorno.toISOString().slice(0, 10);
        const agRef = doc(db, 'agenda', dataKey);
        const snap = await getDoc(agRef);
        const notasExist = snap.exists() ? (snap.data().notas || []) : [];
        const textoNote = `09:00 🔔 Retorno OS: ${os.id} — ${os.clientName} (${[os.brand, os.model].filter(Boolean).join(' ')})`;
        if (!notasExist.some(n => (n.texto || n) === textoNote)) {
            const base = snap.exists() ? snap.data() : {};
            await setDoc(agRef, {
                data:                dataKey,
                notas:               [...notasExist, { texto: textoNote, concluido: false }],
                cor:                 base.cor || 'amarelo',
                alertaHora:          base.alertaHora || '09:00',
                alertaDashboard:     true,
                recorrencia:         base.recorrencia || '',
                recorrenciaExcluir:  base.recorrenciaExcluir || [],
                recorrenciaPararEm:  base.recorrenciaPararEm || '',
                textoCor:            base.textoCor || 'preto',
                atualizadoEm:        serverTimestamp()
            });
        }
    } catch (e) { console.warn('⚠️ [Automação] Lembrete não criado:', e); }

    // ── Registro no financeiro (só se houver valor) ────────────────────────────
    const valorTotal = (os.valor || 0) + (os.valorCartao || 0);
    if (valorTotal > 0) {
        try {
            await setDoc(doc(db, 'financeiro_receber', `os_${os.id}_${Date.now()}`), {
                descricao:  `${os.id} — ${os.clientName} (${[os.brand, os.model].filter(Boolean).join(' ')})`,
                vencimento: new Date().toISOString().slice(0, 10),
                valor:      valorTotal,
                status:     'pendente',
                obs:        'OS criada automaticamente',
                origem:     'os',
                osId:       os.id,
                atualizadoEm: serverTimestamp()
            });
        } catch (e) { console.warn('⚠️ [Automação] Financeiro não registrado:', e); }
    }
}

// ===== AUTOMAÇÃO: PRONTO PARA RETIRADA =====
async function runAutomacaoConcluido(os) {
    if (await jaExecutouAutomacao('pronto_retirada', os.id)) return;
    const msg = `*Cell City — Aparelho Pronto!* ✅\n\n📋 *${os.id}*\n👤 ${os.clientName}\n📱 ${[os.brand, os.model].filter(Boolean).join(' ')}\n\nSeu aparelho está pronto para retirada.\nAguardamos você na loja! 😊`;
    window.open(`https://wa.me/55${(os.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    await registrarAutomacao({
        automationId: 'pronto_retirada',
        osId:         os.id,
        cliente:      os.clientName,
        telefone:     os.phone,
        status:       'executado',
        detalhes:     msg,
        erro:         null
    });
}

// ===== LISTS =====
function showList(filter) {
    currentListFilter = filter; renderList(); showScreen('list');
    if (filter === 'andamento') salvarUltimaTela('andamento', 'Em Andamento', '', '#fav-andamento');
    else if (filter === 'finalizados') salvarUltimaTela('finalizados', 'Finalizados', '', '#fav-finalizados');
}

// ===== CONTINUAR DE ONDE PAREI (registro da última tela — localStorage, sem Firestore) =====
const ULTIMA_TELA_KEY = 'cc_ultima_tela';
function salvarUltimaTela(view, label, sub, hash) {
    try {
        localStorage.setItem(ULTIMA_TELA_KEY, JSON.stringify({
            modulo: 'os', view, label, sub: sub || '', hash,
            url: '/CRM/pages/os/index.html' + hash, ts: Date.now()
        }));
    } catch {}
}
// Deep-link para reabrir uma OS específica: #os-<id>
function getHashOS() { const m = (location.hash || '').match(/^#os-(.+)$/); return m ? decodeURIComponent(m[1]) : ''; }

// ===== FAVORITOS DAS VISÕES (atalho de abertura direta) =====
const FAV_KEY = 'cc_os_fav';
function getFav() { return localStorage.getItem(FAV_KEY) || ''; }
function openFav(view) {
    if (view === 'clientes') showScreen('clientes');
    else if (view === 'andamento' || view === 'finalizados') showList(view);
}
// Deep-link da barra de favoritos: #fav-andamento / #fav-finalizados / #fav-clientes
function getHashView() {
    const h = (location.hash || '').replace('#', '');
    return { 'fav-andamento': 'andamento', 'fav-finalizados': 'finalizados', 'fav-clientes': 'clientes' }[h] || '';
}
function toggleFav(view, event) {
    if (event) event.stopPropagation();
    const atual = getFav();
    if (atual === view) { localStorage.removeItem(FAV_KEY); showToast('Favorito removido'); }
    else { localStorage.setItem(FAV_KEY, view); showToast('⭐ Esta visão abrirá direto'); }
    updateFavStars();
}
function updateFavStars() {
    const fav = getFav();
    document.querySelectorAll('.fav-star').forEach(btn => {
        const isFav = btn.dataset.fav === fav;
        btn.textContent = isFav ? '★' : '☆';
        btn.classList.toggle('active', isFav);
        btn.title = isFav ? 'Abre direto aqui (clique para remover)' : 'Favoritar para abrir direto';
    });
}

function ensureMenuTitle() {
    const titleEl = document.getElementById('headerTitle');
    if (titleEl && !titleEl.textContent.trim()) titleEl.textContent = 'Nova O.S.';
}

function renderList() {
    const orders = DB.getOS(); const s = (document.getElementById('list-search')?.value || '').toLowerCase();
    const isFinal = currentListFilter === 'finalizados';
    let filtered = isFinal ? orders.filter(o => STATUS_TERMINAIS.includes(o.status)) : orders.filter(o => !STATUS_TERMINAIS.includes(o.status));
    if (s) filtered = filtered.filter(o => (o.clientName||'').toLowerCase().includes(s) || (o.phone||'').includes(s) || (o.id||'').toLowerCase().includes(s) || (o.model||'').toLowerCase().includes(s));
    const c = document.getElementById('os-list'); if (!c) return;
    if (filtered.length === 0) { c.innerHTML = `<div class="empty-state"><div class="icon">${isFinal ? '✅' : '🔧'}</div><p>${s ? 'Nenhum resultado encontrado' : 'Nenhuma O.S. nesta categoria'}</p></div>`; return; }
    c.innerHTML = filtered.map(os => {
        const d = os.defect || '';
        const entregaInfo = os.status === 'entregue' ? `<div style="font-size:11px;color:#22c55e;margin-top:4px;font-weight:600;">📅 Entregue em: ${formatDate(os.updatedAt)}</div>` : '';
        return `<div class="os-card" onclick="openDetail('${os.id||''}')"><div class="os-card-header"><span class="os-card-id">${os.id||''}</span><span class="os-card-status status-${(os.status||'').replace(/ /g, '_')}">${getStatusLabel(os.status)}</span></div><div class="os-card-name">${os.clientName||''}</div><div class="os-card-info">${os.model||''} — ${d.substring(0, 45)}${d.length > 45 ? '...' : ''}</div>${entregaInfo}<div class="os-card-footer"><span class="os-card-date">${formatDate(os.createdAt)}</span><span class="os-card-category">${getCategoryIcon(os.category)} ${(getCategoryLabel(os.category) || '').replace(/^.+\s/, '')}</span><button onclick="event.stopPropagation(); deleteOS('${os.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;margin-left:6px;opacity:0.7;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">🗑️</button></div></div>`;
    }).join('');
}

function filterList() { renderList(); }

// ===== DETAIL =====
function openDetail(osId) { currentOS = DB.getOS().find(o => o.id === osId); if (currentOS) { renderDetail(); showScreen('detail'); salvarUltimaTela('detail', 'OS ' + currentOS.id, getStatusLabel(currentOS.status || ''), '#os-' + currentOS.id); } }

function renderDetail() {
    const os = currentOS; const c = document.getElementById('detail-content'); if (!os) return;
    hasUnsavedChanges = false;
    const statuses = STATUS_FLOW;
    const clients = DB.getClients(); const client = clients.find(cl => cl.phone === os.phone);
    let html = `<div id="save-status" style="margin:8px 0 12px; display:flex; justify-content:space-between; align-items:center;"></div>`;
    const garantiaModelo = _getSelectedWarranty(os);
    const garantiaNome = garantiaModelo ? garantiaModelo.nome : '';
    const garantiaHtml = garantiaNome
        ? `🛡️ Garantia: ${os.prazoGarantia ?? 90} dias — ${garantiaNome}`
        : `🛡️ Garantia: ${os.prazoGarantia ?? 90} dias`;
    html += `<div class="detail-header" style="position:relative;padding-bottom:28px;overflow:hidden;"><button onclick="toggleOSEdit()" style="position:absolute;top:8px;right:8px;background:var(--surface3);border:1px solid var(--border);padding:6px 10px;border-radius:var(--radius-sm);cursor:pointer;font-size:12px;outline:none;">✏️ Editar O.S.</button><div class="detail-header-top"><div class="detail-os-id" style="display:inline-flex;align-items:center;gap:8px;">${os.id}<button onclick="copyMessageToClipboard()" title="Copiar mensagem para WhatsApp" style="background:var(--green-primary);border:none;padding:4px 10px;border-radius:var(--radius-sm);cursor:pointer;font-size:11px;font-weight:700;color:#000;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;">📋 Copiar</button></div><span class="os-card-status status-${(os.status||'').replace(/ /g, '_')}">${getStatusLabel(os.status)}</span></div><div class="detail-client">${os.clientName} ${os.password ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#fbbf24;background:rgba(251,191,36,0.1);padding:2px 8px;border-radius:100px;">🔒 ${os.password}</span>` : ''}</div><div style="font-size:13px;color:var(--text2);margin-top:4px;">📞 ${os.phone}</div>${os.cpf ? `<div style="font-size:13px;color:var(--text2);margin-top:2px;">🆔 CPF: ${os.cpf}</div>` : ''}${os.cep || os.endereco || os.bairro || os.cidade || os.estado ? `<div style="font-size:13px;color:var(--text2);margin-top:2px;">📍 ${[os.endereco, os.numero].filter(Boolean).join(', ')}${os.complemento ? ` - ${os.complemento}` : ''}${os.bairro ? `<br>${os.bairro}` : ''}${os.cidade || os.estado ? `<br>${[os.cidade, os.estado].filter(Boolean).join(' - ')}` : ''}${os.cep ? `<br>CEP: ${os.cep}` : ''}</div>` : ''}<div style="font-size:13px;color:var(--text2);margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">📦 ${getCategoryIcon(os.category)} ${[os.brand, os.model].filter(Boolean).join(' ')}</div>${os.imei ? `<div style="font-size:12px;color:var(--text3);margin-top:4px;">🔢 IMEI: ${os.imei}</div>` : ''}${os.imei1 ? `<div style="font-size:12px;color:var(--text3);margin-top:4px;">🔢 IMEI 1: ${os.imei1}</div>` : ''}${os.imei2 ? `<div style="font-size:12px;color:var(--text3);margin-top:4px;">🔢 IMEI 2: ${os.imei2}</div>` : ''}<div style="font-size:13px;color:var(--text2);margin-top:4px;">${os.defect || ''}</div>${(os.valor || os.valorCartao || os.technician) ? `<div style="font-size:13px;color:var(--text2);margin-top:6px;">${os.valor ? `💰 À vista/PIX: R$ ${Number(os.valor).toFixed(2)}` : ''}${os.valor && os.valorCartao ? '<br>' : ''}${os.valorCartao ? `💳 Cartão: R$ ${Number(os.valorCartao).toFixed(2)}` : ''}${(os.valor || os.valorCartao) && os.technician ? '<br>' : ''}${os.technician ? `🛠️ ${os.technician}` : ''}</div>` : ''}<div style="font-size:12px;color:var(--text3);margin-top:4px;">${garantiaHtml}</div></div>`;
    
    html += `<div style="clear:both;height:24px;"></div>`;
    
    // Destaque: resposta do cliente ao orçamento (Consulta OS / Portal do Cliente). Somente leitura.
    const _orcResp = os.orcamentoResposta || (os.status === 'orcamento_aprovado' ? 'aprovado' : (os.status === 'orcamento_recusado' ? 'recusado' : ''));
    if (_orcResp === 'aprovado' || _orcResp === 'recusado') {
        const _aprov = _orcResp === 'aprovado';
        const _cor = _aprov ? 'var(--green, #00C853)' : 'var(--red, #ef4444)';
        const _bg = _aprov ? 'rgba(0,200,83,0.12)' : 'rgba(239,68,68,0.12)';
        const _txt = _aprov ? '✅ ORÇAMENTO APROVADO PELO CLIENTE' : '❌ ORÇAMENTO RECUSADO PELO CLIENTE';
        const _meta = [];
        if (os.orcamentoDataResposta) _meta.push('Data: ' + os.orcamentoDataResposta);
        if (os.orcamentoHoraResposta) _meta.push('Hora: ' + os.orcamentoHoraResposta);
        if (os.orcamentoOrigem) _meta.push('Origem: ' + os.orcamentoOrigem);
        html += `<div style="background:${_bg};border:1px solid ${_cor};border-radius:var(--radius);padding:14px;margin-bottom:16px;"><div style="font-weight:800;color:${_cor};font-size:14px;">${_txt}</div>${_meta.length ? `<div style="font-size:12px;color:var(--text2);margin-top:6px;line-height:1.7;">${_meta.join(' &nbsp;•&nbsp; ')}</div>` : ''}`;
        // Mostra qual opção de orçamento foi escolhida
        if (os.orcamentoEscolhido) {
            const escNome = os.orcamentoEscolhido === '1' ? 'Orçamento 1' : (os.orcamentoEscolhido === '2' ? 'Orçamento 2' : 'Opção ' + os.orcamentoEscolhido);
            html += `<div style="font-size:12px;color:var(--text2);margin-top:6px;">🔹 Opção escolhida: <strong>${escNome}</strong></div>`;
        }
        if (os.orcamentoObs) {
            html += `<div style="font-size:12px;color:var(--text2);margin-top:2px;">💬 Obs. do cliente: "${os.orcamentoObs}"</div>`;
        }
        html += `</div>`;
    }

    // ===== SEÇÃO DEDICADA: ORÇAMENTO =====
    html += `<div class="form-section" style="border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:16px;background:var(--surface2);">`;
    html += `<div class="form-section-title" style="margin-bottom:10px;">💰 Orçamento</div>`;
    const temOrc1 = os.orc1Desc || os.orc1Valor;
    const temOrc2 = os.orc2Desc || os.orc2Valor;
    if (temOrc1) {
        html += `<div style="padding:10px;background:var(--surface3);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;">`;
        html += `<div style="font-weight:700;font-size:14px;color:var(--green-light);margin-bottom:4px;">Orçamento 1</div>`;
        if (os.orc1Desc) html += `<div style="font-size:13px;color:var(--text2);margin-bottom:2px;">${os.orc1Desc}</div>`;
        if (os.orc1Valor) html += `<div style="font-size:15px;font-weight:800;color:var(--text);">R$ ${Number(os.orc1Valor).toFixed(2)}</div>`;
        html += `</div>`;
    }
    if (temOrc2) {
        html += `<div style="padding:10px;background:var(--surface3);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;">`;
        html += `<div style="font-weight:700;font-size:14px;color:var(--green-light);margin-bottom:4px;">Orçamento 2</div>`;
        if (os.orc2Desc) html += `<div style="font-size:13px;color:var(--text2);margin-bottom:2px;">${os.orc2Desc}</div>`;
        if (os.orc2Valor) html += `<div style="font-size:15px;font-weight:800;color:var(--text);">R$ ${Number(os.orc2Valor).toFixed(2)}</div>`;
        html += `</div>`;
    }
    if (!temOrc1 && !temOrc2) {
        html += `<div style="font-size:13px;color:var(--text3);padding:8px 0;">Nenhum orçamento cadastrado.</div>`;
    }
    html += `</div>`;

    html += `<div class="form-section"><div class="form-section-title">📋 Observação Interna</div><div class="form-group"><textarea id="internal-observation" rows="5" oninput="window.markUnsaved()" placeholder="Digite observações internas da assistência técnica..." style="width:100%;padding:12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:inherit;font-size:14px;resize:vertical;min-height:120px;" onfocus="this.style.borderColor='var(--green-primary)'" onblur="this.style.borderColor='var(--border)'">${os.internalObservation || ''}</textarea></div><div class="detail-actions" style="margin-top:8px;"><button class="btn btn-success" onclick="saveInternalObservation()">💾 Salvar Observação</button></div></div>`;

    if (os.patternSequence && os.patternSequence.length > 0) {
        html += `<div class="form-section"><div class="form-section-title">📱 Senha Padrão Android</div><div style="background:var(--surface2);padding:14px;border:1px solid var(--border);border-radius:var(--radius);"><div style="font-size:12px;color:var(--text2);margin-bottom:10px;"><strong>✅ Padrão registrado</strong> (${os.patternSequence.length} pontos)</div><div style="display:flex;gap:6px;flex-wrap:wrap;"><button onclick="showOSPatternDrawing('${os.id}')" style="flex:1;padding:8px;background:var(--surface3);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:11px;color:var(--text);">👁️ Ver desenho</button><button onclick="showOSPatternSequence('${os.id}')" style="flex:1;padding:8px;background:var(--surface3);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:11px;color:var(--text);">🔢 Ver sequência</button></div></div></div>`;
    }
    
    html += `<div class="form-section"><div class="form-section-title">Alterar Status</div><div class="status-selector">${statuses.map(s => `<div class="status-option ${os.status === s.key ? 'selected' : ''}" onclick="changeStatus('${s.key}')"><span class="dot" style="background:${s.color}"></span>${s.label}</div>`).join('')}</div></div>`;
    
    html += `<div class="checklist-section"><div class="checklist-title">📋 Checklist de Entrada</div>${renderChecklistHTML('entry', getChecklistTemplate(os.category), os.entryChecklist||[], true)}</div><div class="checklist-section"><div class="checklist-title">✅ Checklist de Saída</div>${renderChecklistHTML('exit', getChecklistTemplate(os.category), os.exitChecklist||[], false)}</div>`;
    
    if (os.lockPhoto || os.lockType || os.password) {
        let lockBlock = `<div class="form-section"><div class="form-section-title">🔒 Senha/Padrão</div><div style="margin-top:8px;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);">`;
        if (os.lockType) lockBlock += `<span style="font-size:12px;color:var(--text2)">Tipo: <strong style="color:var(--text)">${getLockTypeLabel(os.lockType)}</strong></span>`;
        if (os.password) lockBlock += `<span style="font-size:12px;color:var(--text2);margin-left:10px;">Senha: <strong style="color:var(--yellow)">${os.password}</strong></span>`;
        if (os.lockPhoto) lockBlock += `<br><img src="${os.lockPhoto}" style="width:100%;max-width:280px;height:auto;border-radius:8px;border:1px solid var(--border);cursor:pointer;margin-top:8px;" onclick="viewPhoto('${os.lockPhoto}')"><p style="font-size:10px;color:var(--text3);margin-top:6px;">Toque para ampliar</p>`;
        lockBlock += `</div></div>`;
        html += lockBlock;
    }
    
    if (os.photos?.length > 0) html += `<div class="form-section"><div class="form-section-title">📷 Fotos (${os.photos.length})</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">${os.photos.map(p => `<img src="${p}" style="width:90px;height:90px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer;" onclick="viewPhoto('${p}')">`).join('')}</div><div class="premium-upload" onclick="addPhotoToOS()" style="margin-top:8px"><div class="icon">➕</div><p>Adicionar mais fotos</p></div></div>`;
    
    html += `<div class="form-section"><div class="form-section-title">📝 Observações</div><textarea id="os-observations" rows="4" oninput="window.markUnsaved()" style="width:100%;padding:12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:inherit;font-size:14px;resize:vertical;" onfocus="this.style.borderColor='var(--green-primary)'" onblur="this.style.borderColor='var(--border)'">${os.observations || ''}</textarea><div style="display:flex;gap:8px;margin-top:8px;"><button onclick="saveObservation()" style="flex:1;padding:10px;background:var(--green-primary);color:#000;border:none;border-radius:var(--radius-sm);font-weight:800;cursor:pointer;">💾 Salvar</button></div></div>`;
    
    html += `<div class="form-section"><div class="form-section-title">🛠️ Obs. Técnica (Interna)</div><textarea id="os-tech-obs" rows="3" oninput="window.markUnsaved()" style="width:100%;padding:12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:inherit;font-size:14px;resize:vertical;" onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--border)'">${os.technicalObservation || ''}</textarea><div style="display:flex;gap:8px;margin-top:8px;"><button onclick="saveTechObservation()" style="flex:1;padding:10px;background:var(--blue);color:#fff;border:none;border-radius:var(--radius-sm);font-weight:800;cursor:pointer;">💾 Salvar Técnica</button></div></div>`;
    
    // ===== RELATÓRIO TÉCNICO (vinculado pela tela Soluções Técnicas — somente leitura) =====
    const rel = os.relatorioTecnico;
    if (rel && (rel.defeitoInformado || rel.diagnostico || rel.solucaoAplicada || rel.observacoes)) {
        const relStatus = rel.status || '';
        const relCls = /não|nao/i.test(relStatus) ? '#ff8080' : (/resolv|conclu/i.test(relStatus) ? '#00E676' : 'var(--text2)');
        const relData = (rel.data && /^\d{4}-\d{2}-\d{2}$/.test(rel.data)) ? rel.data.split('-').reverse().join('/') : (rel.data || '');
        const portalTag = rel.exibirPortal ? `<span style="font-size:11px;color:#00E676;background:rgba(0,200,83,0.12);border:1px solid rgba(0,200,83,0.35);border-radius:100px;padding:2px 8px;">🌐 No Portal</span>` : `<span style="font-size:11px;color:var(--text3);background:var(--surface3);border:1px solid var(--border);border-radius:100px;padding:2px 8px;">🔒 Interno</span>`;
        const secoesRel = [
            ['🗣️ Defeito informado pelo cliente', rel.defeitoInformado],
            ['🔍 Diagnóstico técnico', rel.diagnostico],
            ['🛠️ Solução aplicada', rel.solucaoAplicada],
            ['📌 Observações', rel.observacoes]
        ].filter(s => s[1]).map(s => `<div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;color:var(--green-light);margin-bottom:4px;">${s[0]}</div><div style="font-size:14px;color:var(--text);line-height:1.6;white-space:pre-wrap;">${s[1]}</div></div>`).join('');
        html += `<div class="form-section" style="border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:20px;background:var(--surface2);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                <div class="form-section-title" style="margin:0;">📋 Relatório Técnico</div>${portalTag}
            </div>
            <div style="font-size:13px;color:var(--text2);margin-bottom:10px;">${[os.brand, os.model].filter(Boolean).join(' ')}${relData ? ' • 📅 ' + relData : ''}${relStatus ? ` • <strong style="color:${relCls};">${relStatus}</strong>` : ''}${rel.tecnico ? ' • 🛠️ ' + rel.tecnico : ''}</div>
            <button id="rel-tec-toggle" onclick="toggleRelatorioTecnico()" style="background:var(--surface3);border:1px solid var(--border);color:var(--text);padding:8px 14px;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;font-weight:600;">📖 Abrir Relatório</button>
            <div id="rel-tec-body" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">${secoesRel}</div>
        </div>`;
    }

    html += `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:20px;"><div class="form-section-title" style="margin-bottom:8px;">📜 Histórico</div>${(os.timeline||[]).map(t => `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--text2);"><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">${formatDate(t.date)}</div><div>${t.text || ''}</div></div>`).join('')}</div>`;
    
    if (client?.history.length > 1) {
        const otherOS = client.history.filter(h => h !== os.id);
        html += `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:20px;"><div class="form-section-title" style="margin-bottom:8px;">📂 Histórico do Cliente</div>${otherOS.map(hId => { const h = DB.getOS().find(o => o.id === hId); return h ? `<div onclick="openDetail('${h.id}')" style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;cursor:pointer;"><div><div style="font-size:12px;font-weight:800;color:var(--green-light);">${h.id}</div><div style="font-size:11px;color:var(--text3);">${h.model} — ${formatDateShort(h.createdAt)}</div></div><span class="os-card-status status-${(h.status||'').replace(/ /g, '_')}">${getStatusLabel(h.status)}</span></div>` : ''; }).join('')}</div>`;
    }
    
    const aguardandoAprov = os.status === 'orcamento_enviado' || os.status === 'orcamento';
    const _acaoBtn = aguardandoAprov ? `<button class="btn" onclick="markOrcamentoDevolvido()" style="background:#a78bfa;color:#000;font-weight:800;">📋 Devolver Aparelho</button>` : (!STATUS_TERMINAIS.includes(os.status) ? `<button class="btn btn-success" onclick="markDelivered()">📦 Entregue</button>` : '');
    html += `<div class="detail-actions">${_acaoBtn}<button class="btn btn-secondary" onclick="openClientFromOS()">Ver Cliente</button></div><button class="btn btn-ghost" onclick="printOS()" style="color:var(--text2)">🖨️ Imprimir</button><button class="btn btn-ghost" onclick="generateWarrantyLink()" style="color:#2196F3">🔗 Link Garantia</button><button class="btn btn-ghost" onclick="copyWarrantyToClipboard()" style="color:#FF9800">📋 Copiar Garantia</button><button class="btn btn-ghost" onclick="sendWarrantyWhatsApp()" style="color:#25D366">📩 Enviar Garantia</button><button class="btn btn-ghost" onclick="shareWhatsApp()" style="color:var(--green)">💬 WhatsApp</button><button class="btn btn-ghost" onclick="deleteOS('${os.id}')" style="color:var(--red)">🗑️ Excluir OS</button>`;
    c.innerHTML = html;
    updateSaveUI();
}

async function toggleOSEdit() {
    if (!currentOS) return;
    const os = currentOS;
    const c = document.getElementById('detail-content');
    const header = c.querySelector('.detail-header');
    const catLabel = getCategoryLabel(os.category);
    header.innerHTML = `
<button onclick="renderDetail()" style="margin-bottom:12px;background:var(--surface3);border:1px solid var(--border);padding:6px 10px;border-radius:var(--radius-sm);cursor:pointer;font-size:12px;">↩️ Cancelar Edição</button>
<div style="display:flex;flex-direction:column;gap:10px;margin-top:12px;">

<div class="form-section-title" style="margin-top:6px;">👤 Dados do Cliente</div>

<label style="font-size:12px;color:var(--text2);">Nome do Cliente</label>
<input id="edit-os-name" value="${os.clientName||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

<label style="font-size:12px;color:var(--text2);">Telefone</label>
<input id="edit-os-phone" value="${os.phone||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

<label style="font-size:12px;color:var(--text2);">CPF <span style="color:var(--text3);font-weight:400;">(opcional)</span></label>
<input id="edit-os-cpf" value="${os.cpf||''}" maxlength="14" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="cpfMask(this);window.markUnsaved()">

<div class="form-section-title" style="margin-top:14px;">📱 Dados do Aparelho</div>

<label style="font-size:12px;color:var(--text2);">Marca</label>
<input id="edit-os-brand" value="${os.brand||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

<label style="font-size:12px;color:var(--text2);">Modelo do Aparelho</label>
<input id="edit-os-model" value="${os.model||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

<label style="font-size:12px;color:var(--text2);">IMEI 1</label>
<input id="edit-os-imei1" maxlength="15" inputmode="numeric" value="${os.imei1||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

<label style="font-size:12px;color:var(--text2);">IMEI 2</label>
<input id="edit-os-imei2" maxlength="15" inputmode="numeric" value="${os.imei2||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

<div class="form-section-title" style="margin-top:14px;">🛠️ Serviço</div>

<label style="font-size:12px;color:var(--text2);">Defeito relatado</label>
<textarea id="edit-os-defect" rows="3" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:inherit;font-size:14px;resize:vertical;" oninput="window.markUnsaved()">${os.defect||''}</textarea>

<label style="font-size:12px;color:var(--text2);">Valor (à vista / PIX) - R$</label>
<input id="edit-os-valor" type="number" step="0.01" min="0" value="${os.valor||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

<label style="font-size:12px;color:var(--text2);">Valor (Cartão) - R$</label>
<input id="edit-os-valor-cartao" type="number" step="0.01" min="0" value="${os.valorCartao||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

<label style="font-size:12px;color:var(--text2);">Técnico responsável</label>
<input id="edit-os-tecnico" value="${os.technician||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

<div class="form-section-title" style="margin-top:14px;">🛡️ Garantia</div>

<label style="font-size:12px;color:var(--text2);">Prazo de garantia (dias)</label>
<input id="edit-os-garantia" type="number" min="0" step="1" value="${os.prazoGarantia ?? 90}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

<label style="font-size:12px;color:var(--text2);">Modelo de Garantia</label>
<select id="edit-os-garantia-modelo" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" onchange="window.markUnsaved()"></select>

<div class="form-section-title" style="margin-top:14px;">🔒 Segurança</div>

<label style="font-size:12px;color:var(--text2);">Senha do aparelho</label>
<input id="edit-os-password" value="${os.password||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

<div class="form-section-title" style="margin-top:14px;">📝 Observações</div>

<label style="font-size:12px;color:var(--text2);">Observações</label>
<textarea id="edit-os-observations" rows="3" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:inherit;font-size:14px;resize:vertical;" oninput="window.markUnsaved()">${os.observations||''}</textarea>

<div class="form-section-title" style="margin-top:14px;">💰 Orçamentos</div>

<label style="font-size:12px;color:var(--text2);">Orçamento 1 — Descrição</label>
<textarea id="edit-os-orc1-desc" rows="2" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:inherit;font-size:14px;resize:vertical;" oninput="window.markUnsaved()">${os.orc1Desc||''}</textarea>

<label style="font-size:12px;color:var(--text2);">Orçamento 1 — Valor (R$)</label>
<input id="edit-os-orc1-valor" type="number" step="0.01" min="0" value="${os.orc1Valor||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

<label style="font-size:12px;color:var(--text2);">Orçamento 2 — Descrição</label>
<textarea id="edit-os-orc2-desc" rows="2" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:inherit;font-size:14px;resize:vertical;" oninput="window.markUnsaved()">${os.orc2Desc||''}</textarea>

<label style="font-size:12px;color:var(--text2);">Orçamento 2 — Valor (R$)</label>
<input id="edit-os-orc2-valor" type="number" step="0.01" min="0" value="${os.orc2Valor||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

</div>

<!-- ===== Seção recolhível: Endereço do Cliente (inicia recolhida) ===== -->
<div class="form-section accordion collapsed" style="margin-top:16px;">
  <button type="button" class="form-section-title accordion-header" onclick="toggleAccordion(this)" aria-expanded="false"><span>📍 Endereço do Cliente</span><span class="accordion-arrow">▶</span></button>
  <div class="accordion-content"><div class="accordion-content-inner">
    <div style="display:flex;flex-direction:column;gap:10px;padding-top:4px;">
      <label style="font-size:12px;color:var(--text2);">CEP <span style="color:var(--text3);font-weight:400;">(opcional)</span></label>
      <input id="edit-os-cep" value="${os.cep||''}" maxlength="9" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="cepMask(this);window.markUnsaved()" onblur="buscarCEP(this.value)">

      <label style="font-size:12px;color:var(--text2);">Endereço <span style="color:var(--text3);font-weight:400;">(opcional)</span></label>
      <input id="edit-os-endereco" value="${os.endereco||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

      <div style="display:flex;gap:8px;">
        <div style="flex:2;">
          <label style="font-size:12px;color:var(--text2);">Número</label>
          <input id="edit-os-numero" value="${os.numero||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);width:100%;box-sizing:border-box;" oninput="window.markUnsaved()">
        </div>
        <div style="flex:1;">
          <label style="font-size:12px;color:var(--text2);">Complemento</label>
          <input id="edit-os-complemento" value="${os.complemento||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);width:100%;box-sizing:border-box;" oninput="window.markUnsaved()">
        </div>
      </div>

      <label style="font-size:12px;color:var(--text2);">Bairro <span style="color:var(--text3);font-weight:400;">(opcional)</span></label>
      <input id="edit-os-bairro" value="${os.bairro||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">

      <div style="display:flex;gap:8px;">
        <div style="flex:1;">
          <label style="font-size:12px;color:var(--text2);">Cidade <span style="color:var(--text3);font-weight:400;">(opcional)</span></label>
          <input id="edit-os-cidade" value="${os.cidade||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);width:100%;box-sizing:border-box;" oninput="window.markUnsaved()">
        </div>
        <div style="flex:0 0 70px;">
          <label style="font-size:12px;color:var(--text2);">UF</label>
          <input id="edit-os-estado" value="${os.estado||''}" maxlength="2" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);width:100%;box-sizing:border-box;" oninput="window.markUnsaved()">
        </div>
      </div>
    </div>
  </div></div>
</div>

<!-- ===== Seção recolhível: Dados Avançados (inicia recolhida) ===== -->
<div class="form-section accordion collapsed" style="margin-top:10px;">
  <button type="button" class="form-section-title accordion-header" onclick="toggleAccordion(this)" aria-expanded="false"><span>🔧 Dados Avançados</span><span class="accordion-arrow">▶</span></button>
  <div class="accordion-content"><div class="accordion-content-inner">
    <div style="display:flex;flex-direction:column;gap:10px;padding-top:4px;">
      <label style="font-size:12px;color:var(--text2);">IMEI / Nº de série</label>
      <input id="edit-os-imei" value="${os.imei||''}" style="padding:10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">
    </div>
  </div></div>
</div>

<button onclick="saveOSEdit()" style="margin-top:14px;width:100%;padding:14px;background:linear-gradient(135deg,var(--green-primary),var(--green-dark));color:white;font-weight:700;font-size:15px;border:none;border-radius:var(--radius);cursor:pointer;">💾 Salvar Alterações</button>`;
    // Garante que as configurações de garantia estejam carregadas do Firestore
    await _fetchWarrantyConfigFromFirestore();
    // Popula o select de modelo de garantia com as opções configuradas
    _populateWarrantySelect('edit-os-garantia-modelo', os.garantiaId);
    window.markUnsaved();
}

async function saveOSEdit() {
    const n = document.getElementById('edit-os-name').value.trim();
    const p = document.getElementById('edit-os-phone').value.trim();
    const cpf = document.getElementById('edit-os-cpf')?.value.trim() || '';
    const m = document.getElementById('edit-os-model').value.trim();
    const brand = document.getElementById('edit-os-brand')?.value.trim() || '';
    const imei = document.getElementById('edit-os-imei')?.value.trim() || '';
    const defect = document.getElementById('edit-os-defect')?.value.trim() || '';
    const tecnico = document.getElementById('edit-os-tecnico')?.value.trim() || '';
    const imei1 = document.getElementById('edit-os-imei1')?.value.trim() || '';
    const imei2 = document.getElementById('edit-os-imei2')?.value.trim() || '';
    const valor = parseFloat((document.getElementById('edit-os-valor')?.value || '').replace(',', '.')) || 0;
    const valorCartao = parseFloat((document.getElementById('edit-os-valor-cartao')?.value || '').replace(',', '.')) || 0;
    const prazoGarantia = parseInt(document.getElementById('edit-os-garantia')?.value, 10) || 90;
    const garantiaId = document.getElementById('edit-os-garantia-modelo')?.value || '';
    const password = document.getElementById('edit-os-password')?.value.trim() || '';
    const observations = document.getElementById('edit-os-observations')?.value.trim() || '';
    // Orçamento 1 e Orçamento 2 (edição)
    const editOrc1Desc = (document.getElementById('edit-os-orc1-desc')?.value || '').trim();
    const editOrc1Valor = parseFloat((document.getElementById('edit-os-orc1-valor')?.value || '').replace(',', '.')) || 0;
    const editOrc2Desc = (document.getElementById('edit-os-orc2-desc')?.value || '').trim();
    const editOrc2Valor = parseFloat((document.getElementById('edit-os-orc2-valor')?.value || '').replace(',', '.')) || 0;
    const cep = document.getElementById('edit-os-cep')?.value.trim() || '';
    const endereco = document.getElementById('edit-os-endereco')?.value.trim() || '';
    const numero = document.getElementById('edit-os-numero')?.value.trim() || '';
    const complemento = document.getElementById('edit-os-complemento')?.value.trim() || '';
    const bairro = document.getElementById('edit-os-bairro')?.value.trim() || '';
    const cidade = document.getElementById('edit-os-cidade')?.value.trim() || '';
    const estado = document.getElementById('edit-os-estado')?.value.trim() || '';
    if (!n || !p || !m) return showToast("⚠️ Preencha todos os campos");
    try {
        const updates = { clientName: n, phone: p, cpf: cpf || null, cep: cep || null, endereco: endereco || null, numero: numero || null, complemento: complemento || null, bairro: bairro || null, cidade: cidade || null, estado: estado || null, brand, model: m, imei, defect, technician: tecnico, valor, valorCartao, prazoGarantia, garantiaId: garantiaId || null, imei1: imei1 || null, imei2: imei2 || null, password, observations, orc1Desc: editOrc1Desc || null, orc1Valor: editOrc1Valor || 0, orc2Desc: editOrc2Desc || null, orc2Valor: editOrc2Valor || 0, updatedAt: new Date().toISOString() };
        await updateDoc(doc(db, "os", currentOS.id), updates);
        Object.assign(currentOS, updates);
        const idx = localOS.findIndex(o => o.id === currentOS.id);
        if (idx >= 0) localOS[idx] = { ...currentOS };
        showToast("✅ OS Atualizada!"); window.markSaved(); renderDetail();
    } catch (e) { console.error(e); showToast("Erro ao salvar"); }
}

function renderChecklistHTML(key, items, checked, readonly) { return items.map((item, i) => `<div class="checklist-item"><input type="checkbox" ${checked.includes(i) ? 'checked' : ''} ${readonly ? 'disabled' : `onchange="updateChecklistItem('${key}', ${i}, this.checked)"`}><label style="cursor:${readonly ? 'default' : 'pointer'};flex:1">${item}</label></div>`).join(''); }

async function changeStatus(newStatus) { if (!currentOS) return; window.markUnsaved(); const old = currentOS.status; currentOS.status = newStatus; currentOS.updatedAt = new Date().toISOString(); currentOS.timeline.push({ date: new Date().toISOString(), text: `Status: ${getStatusLabel(old)} → ${getStatusLabel(newStatus)}` }); await saveCurrentOS(); if (newStatus === 'concluido') runAutomacaoConcluido(currentOS); renderDetail(); showToast(`✅ ${getStatusLabel(newStatus)}`); window.markSaved(); }

async function saveObservation() { const t = document.getElementById('os-observations').value; if (!currentOS) return; currentOS.observations = t; await updateDoc(doc(db, "os", currentOS.id), { observations: t, updatedAt: new Date().toISOString() }); showToast("✅ Observações salvas."); window.markSaved(); }

async function saveTechObservation() { const t = document.getElementById('os-tech-obs').value; if (!currentOS) return; currentOS.technicalObservation = t; await updateDoc(doc(db, "os", currentOS.id), { technicalObservation: t, updatedAt: new Date().toISOString() }); showToast("🛠️ Nota técnica salva."); window.markSaved(); }

async function saveInternalObservation() {
    const observation = document.getElementById('internal-observation')?.value?.trim() || '';
    if (!currentOS) return;
    currentOS.internalObservation = observation;
    currentOS.updatedAt = new Date().toISOString();
    try {
        await updateDoc(doc(db, "os", currentOS.id), { internalObservation: observation, updatedAt: currentOS.updatedAt });
        const idx = localOS.findIndex(o => o.id === currentOS.id);
        if (idx >= 0) localOS[idx] = { ...currentOS };
        showToast('✅ Observação interna salva');
        window.markSaved();
    } catch (e) {
        console.error("Erro ao salvar observação interna:", e);
        showToast("❌ Erro ao salvar.");
    }
}

function addObservation() { const input = document.getElementById('obs-input'); const text = input?.value.trim(); if (!text || !currentOS) return; currentOS.timeline.push({ date: new Date().toISOString(), text: `Nota: ${text}` }); currentOS.updatedAt = new Date().toISOString(); saveCurrentOS(); renderDetail(); showToast('📝 Adicionada'); input.value = ''; window.markSaved(); }

function addPhotoToOS() { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = true; input.onchange = function(e) { for (let f of e.target.files) { const r = new FileReader(); r.onload = function(ev) { const img = new Image(); img.onload = async function() { const c = document.createElement('canvas'); const max = 800; let w = img.width, h = img.height; if(w > max || h > max) w > h ? (h = h * max / w, w = max) : (w = w * max / h, h = max); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); currentOS.photos.push(c.toDataURL('image/jpeg', 0.7)); await saveCurrentOS(); renderDetail(); showToast('📷 Adicionada'); window.markSaved(); }; img.src = ev.target.result; }; r.readAsDataURL(f); } }; input.click(); }

async function markDelivered() { if(!currentOS) return; window.markUnsaved(); currentOS.status='entregue'; currentOS.updatedAt=new Date().toISOString(); currentOS.timeline.push({date:new Date().toISOString(),text:'Entregue ao cliente'}); await saveCurrentOS(); renderDetail(); showToast('✅ Entregue'); window.markSaved(); }
async function markOrcamentoDevolvido() { if(!currentOS) return; window.markUnsaved(); currentOS.status='devolvido_orcamento'; currentOS.updatedAt=new Date().toISOString(); currentOS.timeline.push({date:new Date().toISOString(),text:'Aparelho devolvido — Orçamento (sem serviço)'}); await saveCurrentOS(); updateStats(); renderDetail(); showToast('📋 Aparelho devolvido'); window.markSaved(); }
window.markOrcamentoDevolvido = markOrcamentoDevolvido;

function openClientFromOS() { if(currentOS) { currentClientPhone=currentOS.phone; showClientDetail(currentOS.phone); } }

async function saveCurrentOS() { if (!currentOS) return; await DB.updateOS(currentOS); }

async function deleteOS(id) { const c = prompt("Digite 77 para confirmar a exclusão"); if (c !== "77") { alert("Exclusão cancelada."); return; } try { await deleteDoc(doc(db, "os", id)); localOS = localOS.filter(o => o.id !== id); updateStats(); renderList(); showToast("🗑️ OS excluída."); window.markSaved(); } catch(e) { console.error(e); alert("Erro ao excluir."); } }

function shareWhatsApp() { if(!currentOS) return; const os=currentOS; const text=`*Cell City - O.S.*\n📋 ${os.id}\n👤 ${os.clientName}\n📱 ${os.model}\n🔧 ${os.defect}\nStatus: ${getStatusLabel(os.status)}\n📅 ${formatDate(os.createdAt)}`; window.open(`https://wa.me/${(os.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(text)}`, '_blank'); }

/**
 * Retorna o label legível para o tipo de bloqueio
 */
function getLockTypeLabel(type) {
    const map = {
        'Numerica': 'Senha',
        'Padrao': 'Padrão',
        'Biometria': 'Biometria',
        'Face ID': 'Face ID',
        'Digital': 'Digital',
        'Sem senha': 'Sem bloqueio'
    };
    return map[type] || type || 'Não informado';
}

function _getWarrantyModels() {
    let cfg = { garantias: [] };
    try { const c = localStorage.getItem('cc_config_impressao'); if (c) cfg = JSON.parse(c); } catch {}
    return Array.isArray(cfg.garantias) ? cfg.garantias : [];
}

function _getSelectedWarranty(os) {
    const garantias = _getWarrantyModels();
    if (garantias.length === 0) return null;
    // Se a OS tem um garantiaId específico, usa ele
    // Usa == (loose equality) para evitar incompatibilidade entre número e string
    if (os.garantiaId) {
        const found = garantias.find(g => g.id == os.garantiaId);
        if (found) return found;
    }
    // Fallback: modelo padrão configurado
    return garantias.find(g => g.padrao) || garantias[0] || null;
}

function _populateWarrantySelect(selectId, selectedId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const garantias = _getWarrantyModels();
    sel.innerHTML = '<option value="">Padrão (configurado no sistema)</option>';
    garantias.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.nome;
        // Usa == (loose equality) para evitar incompatibilidade entre número e string
        if (selectedId != null && g.id == selectedId) opt.selected = true;
        sel.appendChild(opt);
    });
}

/**
 * Tenta carregar configuração de garantias do Firestore como fallback
 * quando o localStorage não tem dados. Se encontrar, sincroniza para localStorage.
 */
async function _fetchWarrantyConfigFromFirestore() {
    try {
        const configDocRef = doc(db, "config", "impressao");
        const configDoc = await getDoc(configDocRef);
        if (configDoc.exists()) {
            const data = configDoc.data();
            if (Array.isArray(data.garantias) && data.garantias.length > 0) {
                // Sincroniza para localStorage para uso futuro
                localStorage.setItem('cc_config_impressao', JSON.stringify(data));
                return data;
            }
        }
    } catch (e) {
        console.warn('⚠️ [Garantia] Não foi possível buscar config do Firestore:', e);
    }
    return null;
}

/**
 * Gera o texto completo da garantia para a OS atual.
 * Tenta localStorage primeiro, depois Firestore como fallback.
 */
async function _getWarrantyText() {
    if (!currentOS) return null;
    const os = currentOS;
    let cfg = null;
    try { const c = localStorage.getItem('cc_config_impressao'); if (c) cfg = JSON.parse(c); } catch {}
    if (!cfg || !Array.isArray(cfg.garantias) || cfg.garantias.length === 0) {
        cfg = await _fetchWarrantyConfigFromFirestore();
        if (!cfg) return null;
    }
    // Recria garantias array local para _getSelectedWarranty funcionar
    // (como _getSelectedWarranty é síncrono e lê de _getWarrantyModels,
    //  precisamos garantir que o localStorage foi atualizado)
    const garantias = Array.isArray(cfg.garantias) ? cfg.garantias : [];
    if (garantias.length === 0) return null;
    const garantia = garantias.find(g => g.id == os.garantiaId) || garantias.find(g => g.padrao) || garantias[0];
    if (!garantia) return null;
    const lojaNome = (cfg.loja?.nome || 'CELL CITY').toUpperCase();
    const createdDate = formatDate(os.createdAt).split(' ')[0];
    return `${lojaNome}\n\nOS: ${os.id}\nData: ${createdDate}\nEquipamento: ${os.model}\nServiço: ${os.defect || 'Não especificado'}\n\nGARANTIA\n\n${garantia.texto}\n\nObrigado pela preferência.`;
}

async function copyWarrantyToClipboard() {
    const text = await _getWarrantyText();
    if (!text) { showToast('⚠️ Nenhuma garantia disponível'); return; }
    navigator.clipboard.writeText(text).then(() => {
        showToast('✅ Garantia copiada para a área de transferência');
    }).catch(() => {
        showToast('❌ Erro ao copiar');
    });
}

/**
 * Copia mensagem de acompanhamento da OS para o cliente via clipboard.
 * Monta o texto com primeiro nome do cliente, número da OS e link do portal.
 * Não abre WhatsApp, apenas copia a mensagem pronta.
 */
function copyMessageToClipboard() {
    if (!currentOS) return;
    const os = currentOS;
    
    // Extrai o primeiro nome do cliente
    const fullName = os.clientName || '';
    const firstName = fullName.split(' ')[0] || 'Cliente';
    
    // Monta a mensagem conforme especificação
    const message = 'Olá, ' + firstName + '! 👋\n\n' +
        'Sua Ordem de Serviço já foi aberta e está disponível para acompanhamento.\n\n' +
        '📋 OS Nº ' + os.id + '\n\n' +
        'Você pode acompanhar o andamento do serviço, consultar informações e verificar atualizações através do Portal do Cliente da Cell City.\n\n' +
        '🔗 https://www.cellcityinformatica.com.br/CRM/pages/portal-cliente/index.html\n\n' +
        '📱 Utilize o número de telefone cadastrado na ordem de serviço para acessar o portal.\n\n' +
        'Agradecemos pela confiança em nosso trabalho. Qualquer dúvida, estamos à disposição.\n\n' +
        'Cell City Informática';
    
    // Copia para a área de transferência
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(message).then(function () {
            showToast('✅ Mensagem copiada com sucesso!');
        }).catch(function () {
            fallbackCopyMessage(message);
        });
    } else {
        fallbackCopyMessage(message);
    }
}

function fallbackCopyMessage(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('✅ Mensagem copiada com sucesso!');
    } catch (e) {
        showToast('❌ Erro ao copiar mensagem');
    }
    document.body.removeChild(textarea);
}

async function generateWarrantyLink() {
    if (!currentOS) return;
    const os = currentOS;
    let cfg = null;
    try { const c = localStorage.getItem('cc_config_impressao'); if (c) cfg = JSON.parse(c); } catch {}
    let garantias = cfg ? (Array.isArray(cfg.garantias) ? cfg.garantias : []) : [];
    if (garantias.length === 0) {
        cfg = await _fetchWarrantyConfigFromFirestore();
        garantias = cfg ? (Array.isArray(cfg.garantias) ? cfg.garantias : []) : [];
    }
    if (garantias.length === 0) { showToast('⚠️ Nenhuma garantia disponível'); return; }
    const garantia = garantias.find(g => g.id == os.garantiaId) || garantias.find(g => g.padrao) || garantias[0];
    if (!garantia) { showToast('⚠️ Nenhuma garantia disponível'); return; }
    const baseUrl = window.location.origin + '/CRM/garantia?id=' + os.id;
    navigator.clipboard.writeText(baseUrl).then(() => {
        showToast('✅ Link copiado para compartilhar!');
    }).catch(() => {
        showToast('❌ Erro ao copiar link');
    });
}

async function sendWarrantyWhatsApp() {
    if (!currentOS) return;
    const os = currentOS;
    let cfg = null;
    try { const c = localStorage.getItem('cc_config_impressao'); if (c) cfg = JSON.parse(c); } catch {}
    let garantias = cfg ? (Array.isArray(cfg.garantias) ? cfg.garantias : []) : [];
    if (garantias.length === 0) {
        cfg = await _fetchWarrantyConfigFromFirestore();
        garantias = cfg ? (Array.isArray(cfg.garantias) ? cfg.garantias : []) : [];
    }
    if (garantias.length === 0) { showToast('⚠️ Nenhuma garantia disponível'); return; }
    const garantia = garantias.find(g => g.id == os.garantiaId) || garantias.find(g => g.padrao) || garantias[0];
    if (!garantia) { showToast('⚠️ Nenhuma garantia disponível'); return; }
    const lojaNome = (cfg.loja?.nome || 'CELL CITY').toUpperCase();
    const createdDate = formatDate(os.createdAt).split(' ')[0];
    const text = `*${lojaNome}*\n\nOS: ${os.id}\nData: ${createdDate}\nEquipamento: ${os.model}\nServiço: ${os.defect || 'Não especificado'}\n\n*GARANTIA*\n\n${garantia.texto}\n\nObrigado pela preferência.`;
    window.open(`https://wa.me/${(os.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(text)}`, '_blank');
    showToast('📲 Abrindo WhatsApp...');
}

function printOS() {
    if (!currentOS) return;
    const os = currentOS;
    let cfg = { logo: '', garantias: [] };
    try { const c = localStorage.getItem('cc_config_impressao'); if (c) cfg = JSON.parse(c); } catch {}
    const garantias = Array.isArray(cfg.garantias) ? cfg.garantias : [];
    const checksHtml = garantias.length ? `
        <div style="margin-bottom:16px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#00E676;margin-bottom:10px">Termos de Garantia</div>
            <div style="display:flex;flex-direction:column;gap:8px">
                ${garantias.map(g => `
                <label style="display:flex;align-items:center;gap:10px;padding:10px;background:#1c1f1d;border:1px solid rgba(255,255,255,0.08);border-radius:10px;cursor:pointer">
                    <input type="checkbox" class="print-gar-chk" data-id="${g.id}" ${(os.garantiaId && g.id === os.garantiaId) || (!os.garantiaId && g.padrao) ? 'checked' : ''} style="width:18px;height:18px;accent-color:#00C853;cursor:pointer;flex-shrink:0">
                    <span style="font-size:13px;color:#d1d5db">${g.nome}</span>
                </label>`).join('')}
            </div>
        </div>` : '';
    document.getElementById('modal-content').innerHTML = `
        <div onclick="event.stopPropagation()">
        <div class="modal-handle"></div>
        <h3 style="margin-bottom:16px;color:#00E676">🖨️ Imprimir OS ${currentOS.id}</h3>
        ${checksHtml}
        <button onclick="event.stopPropagation();window._executePrint()" style="width:100%;padding:14px;background:linear-gradient(135deg,#00C853,#009624);border:none;border-radius:14px;color:white;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">
            🖨️ Imprimir
        </button>
        </div>`;
    document.getElementById('modal-overlay').classList.add('active');
}

/**
 * Destaca automaticamente termos críticos em textos de garantia.
 * Usa inline styles para funcionar em janelas de impressão.
 *
 * Prioridade Máxima (fundo amarelo + negrito):
 *   MAU USO, NÃO COBRE, 72 HORAS, R$ 80,00
 * Prioridade Secundária (apenas negrito):
 *   QUEDA, QUEDAS, IMPACTO, IMPACTOS,
 *   LÍQUIDOS, OXIDAÇÃO, PRESSÃO,
 *   TRINCA, TRINCAS, QUEBRA, QUEBRAS
 */
function highlightWarrantyTerms(text) {
    if (!text) return text;
    const HL = 'style="background:#FFD700;color:#000;font-weight:700;padding:0 2px;border-radius:2px;"';
    const BOLD = 'style="font-weight:700;"';

    // 1° Prioridade Máxima: fundo amarelo + negrito
    const primary = ['MAU USO', 'NÃO COBRE', '72 HORAS', 'R\\$ 80,00'];
    let result = text.replace(new RegExp(`(${primary.join('|')})`, 'gi'), `<span ${HL}>$1</span>`);

    // 2° Prioridade Secundária: apenas negrito
    const secondary = [
        'QUEDA', 'QUEDAS', 'IMPACTO', 'IMPACTOS',
        'LÍQUIDOS', 'OXIDAÇÃO', 'PRESSÃO',
        'TRINCA', 'TRINCAS', 'QUEBRA', 'QUEBRAS'
    ];
    result = result.replace(new RegExp(`(${secondary.join('|')})`, 'gi'), `<span ${BOLD}>$1</span>`);

    return result;
}

window._executePrint = function() {
    if (!currentOS) return;
    const os = currentOS;
    let cfg = { logo: '', garantias: [] };
    try { const c = localStorage.getItem('cc_config_impressao'); if (c) cfg = JSON.parse(c); } catch {}
    const garantias = Array.isArray(cfg.garantias) ? cfg.garantias : [];
    const selectedIds = [...document.querySelectorAll('.print-gar-chk:checked')].map(c => parseInt(c.dataset.id));
    const selecionadas = garantias.filter(g => selectedIds.includes(g.id));
    closeModal();
    const loja = cfg.loja || {};
    const lojaNome = loja.nome || 'Cell City Informática';
    const lojaEnd  = loja.endereco || '';
    const lojaWa   = loja.whatsapp || '';
    const lojaCnpj = loja.cnpj || '';
    const logoHtml = cfg.logo ? `<div style="text-align:center;margin-bottom:10px"><img src="${cfg.logo}" style="max-height:80px;max-width:220px;object-fit:contain"></div>` : '';
    const cabecalhoHtml = `<h1 style="text-align:center;font-size:16px;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:6px">${lojaNome}</h1>${lojaEnd?`<p style="text-align:center;font-size:10px;margin-bottom:2px">${lojaEnd}</p>`:''}${lojaWa?`<p style="text-align:center;font-size:10px;margin-bottom:2px">WhatsApp: ${lojaWa}</p>`:''}${lojaCnpj?`<p style="text-align:center;font-size:10px;margin-bottom:8px">CNPJ: ${lojaCnpj}</p>`:''}`;
    const garantiasHtml = selecionadas.length ? `<div style="margin-top:14px;border-top:1px dashed #ccc;padding-top:10px"><div style="font-weight:bold;font-size:11px;margin-bottom:8px;text-transform:uppercase">Termos de Garantia</div>${selecionadas.map(g => `<div style="margin-bottom:10px"><b style="font-size:11px">${g.nome}:</b><br><span style="font-size:10px;line-height:1.5">${g.texto}</span></div>`).join('')}</div>` : '';
    const w = window.open('', '_blank');
    const statusHtml = os.status === 'entregue' ? `<div class="row"><span class="label">Status:</span><span style="font-weight:bold">ENTREGUE</span></div>` : `<div class="row"><span class="label">Status:</span><span>${getStatusLabel(os.status)}</span></div>`;
    const garantiasHtmlAjustado = selecionadas.length ? `<div style="margin-top:14px;border-top:1px dashed #ccc;padding-top:10px"><div style="font-weight:bold;font-size:11px;margin-bottom:8px;text-transform:uppercase">Termos de Garantia</div>${selecionadas.map(g => `<div style="margin-bottom:10px"><b style="font-size:11px">${g.nome}:</b><br><span style="font-size:10px;line-height:1.5">${highlightWarrantyTerms(g.texto)}</span></div>`).join('')}</div>` : '';
    w.document.write(`<!DOCTYPE html><html><head><title>${os.id}</title><style>body{font-family:monospace;padding:20px;max-width:400px;margin:0 auto}.row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}.label{font-weight:bold}.section{margin-top:12px;border-top:1px dashed #ccc;padding-top:6px}.footer{text-align:center;margin-top:20px;font-size:10px}@media print{button{display:none}}</style></head><body>${logoHtml}${cabecalhoHtml}<div class="row"><span class="label">O.S.:</span><span>${os.id}</span></div><div class="row"><span class="label">Data:</span><span>${formatDate(os.createdAt)}</span></div><div class="section"><div class="row"><span class="label">Cliente:</span><span>${os.clientName}</span></div><div class="row"><span class="label">Telefone:</span><span>${os.phone}</span></div>${os.cpf?`<div class="row"><span class="label">CPF:</span><span>${os.cpf}</span></div>`:''}${os.cep||os.endereco?`<div class="row"><span class="label">Endereço:</span><span>${[os.endereco, os.numero].filter(Boolean).join(', ')}${os.complemento?` - ${os.complemento}`:''}</span></div><div class="row"><span class="label">Bairro:</span><span>${os.bairro||''}</span></div><div class="row"><span class="label">Cidade/UF:</span><span>${[os.cidade, os.estado].filter(Boolean).join(' - ')}</span></div><div class="row"><span class="label">CEP:</span><span>${os.cep||''}</span></div>`:''}<div class="row"><span class="label">Aparelho:</span><span>${[os.brand, os.model].filter(Boolean).join(' ')}</span></div>${os.imei?`<div class="row"><span class="label">IMEI:</span><span>${os.imei}</span></div>`:''}<div class="row"><span class="label">Defeito:</span><span>${os.defect||''}</span></div>${os.valor?`<div class="row"><span class="label">Valor:</span><span>R$ ${Number(os.valor).toFixed(2)}</span></div>`:''}${os.patternSequence&&os.patternSequence.length?`<div class="row"><span class="label">Padrão:</span><span>${os.patternSequence.map(i=>i+1).join('→')}</span></div>`:''}${os.observations?`<div class="row"><span class="label">Obs:</span><span>${os.observations}</span></div>`:''}</div><div class="section">${statusHtml}</div>${garantiasHtmlAjustado}<div class="footer" style="margin-top:30px"><div style="text-align:center;margin-bottom:20px"><p style="margin:0;font-size:10px">Declaro ter recebido o aparelho e estar ciente dos termos de garantia.</p><p style="margin:30px 0 10px 0;border-top:1px solid #000;padding-top:10px;min-height:40px;font-size:11px;font-weight:bold">Assinatura do Cliente</p><p style="margin-top:15px;font-size:10px">Data da entrega: ___/___/____</p></div><div style="text-align:center;margin-top:20px;border-top:1px dashed #ccc;padding-top:10px;font-size:9px"><p style="margin:0;font-style:italic;color:#333">Confira todas as funcionalidades do aparelho antes de deixar a loja.</p></div></div></body></html>`);
    w.document.close();
    w.print();
};

// ===== CLIENTS (MÓDULO COMPLETO) =====
const AVAILABLE_TAGS = ['Igreja', 'Amigo', 'Família', 'Empresa', 'Parceiro', 'VIP', 'Goiânia', 'Região Metropolitana', 'Interior de Goiás', 'Outro Estado', 'Indica Clientes', 'Compra Acessórios', 'Cliente Antigo', 'Cliente Recorrente'];
let isClientFormOpen = false;
let currentEditingClient = null;
let currentClientTags = [];
let currentClientRating = 0;

function renderClients() {
    const clients = DB.getClients(); const s = (document.getElementById('client-search')?.value || '').toLowerCase();
    const f = s ? clients.filter(c => (c.name||'').toLowerCase().includes(s) || (c.phone||'').includes(s)) : clients;
    const c = document.getElementById('client-list'); if (!c) return;
    if (f.length === 0) { c.innerHTML = `<div class="empty-state"><div class="icon">👥</div><p>${s ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</p></div>`; return; }
    c.innerHTML = f.map(cl => `<div class="client-card" onclick="showClientDetail('${cl.phone}')"><div class="client-card-name">${cl.name||''}</div><div class="client-card-phone">📞 ${cl.phone||''}</div><div class="client-card-count">${(cl.history||[]).length} O.S.</div><div style="display:flex; gap:8px; margin-top:8px;"><button onclick="event.stopPropagation(); editClient('${cl.phone}')" style="background:none;border:none;cursor:pointer;font-size:16px;opacity:0.7;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">✏️</button><button onclick="event.stopPropagation(); deleteClient('${cl.phone}')" style="background:none;border:none;cursor:pointer;font-size:16px;opacity:0.7;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">🗑️</button></div></div>`).join('');
}

function searchClients() { renderClients(); }

function showClientDetail(phone) {
    guardNavigation(() => {
        const client = DB.getClients().find(c => c.phone === phone); 
        if (!client) return; 
        currentClientPhone = phone;
        
        const orders = DB.getOS(); 
        const clientOrders = orders.filter(o => o.phone === phone).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        const c = document.getElementById('client-detail-content');
        
        const totalOS = clientOrders.length;
        const totalSpent = clientOrders.reduce((sum, o) => sum + (parseFloat(o.valor ?? o.totalValue) || 0), 0);
        const lastAttendance = clientOrders.length > 0 ? formatDateShort(clientOrders[0].createdAt) : 'Nunca';
        const activeWarranties = clientOrders.filter(o => {
            if (o.status === 'entregue' && o.updatedAt) {
                const diff = (new Date() - new Date(o.updatedAt)) / (1000 * 60 * 60 * 24);
                return diff <= 90;
            }
            return false;
        }).length;

        const devices = [...new Set(clientOrders.map(o => o.model).filter(Boolean))];
        
        let html = `<div class="detail-header" style="position:relative;">
            <button onclick="editClientFromDetail('${phone}')" style="position:absolute;top:8px;right:8px;background:var(--surface3);border:1px solid var(--border);padding:6px 10px;border-radius:var(--radius-sm);cursor:pointer;font-size:12px;">✏️ Editar Ficha</button>
            <div class="detail-header-top" style="flex-direction:column; align-items:flex-start; gap:8px;">
                <div class="detail-client" style="font-size:18px;">${client.name || ''}</div>
                <div class="client-rating-display">${renderStarsHTML(client.rating || 0)}</div>
            </div>
            <div style="font-size:13px;color:var(--text2);margin-top:8px;">📞 ${client.phone || ''} ${client.phone2 ? `<span style="margin-left:10px;">📱 ${client.phone2}</span>` : ''}</div>
            ${client.email ? `<div style="font-size:13px;color:var(--text2);margin-top:4px;">📧 ${client.email}</div>` : ''}
            ${client.cpf ? `<div style="font-size:13px;color:var(--text2);margin-top:4px;">🆔 CPF: ${client.cpf}</div>` : ''}
            ${client.birthDate ? `<div style="font-size:13px;color:var(--text2);margin-top:4px;">🎂 ${client.birthDate}</div>` : ''}
        </div>`;

        if (client.tags && client.tags.length > 0) {
            html += `<div class="client-tags-container" style="margin-bottom:16px;">${client.tags.map(t => `<span class="client-tag">🏷️ ${t}</span>`).join('')}</div>`;
        }

        html += `<div class="client-stats-grid">
            <div class="client-stat-card"><div class="stat-num">${totalOS}</div><div class="stat-lbl">Total OS</div></div>
            <div class="client-stat-card"><div class="stat-num">R$ ${totalSpent.toFixed(2)}</div><div class="stat-lbl">Total Gasto</div></div>
            <div class="client-stat-card"><div class="stat-num">${lastAttendance}</div><div class="stat-lbl">Último Atendimento</div></div>
            <div class="client-stat-card"><div class="stat-num">${activeWarranties}</div><div class="stat-lbl">Garantias Ativas</div></div>
        </div>`;

        if (devices.length > 0) {
            html += `<div class="form-section"><div class="form-section-title">📱 Aparelhos Vinculados</div><div class="client-devices-list">${devices.map(d => `<span class="device-chip">${d}</span>`).join('')}</div></div>`;
        }

        if (client.google1 || client.appleId || client.google2) {
            html += `<div class="form-section"><div class="form-section-title">🔐 Credenciais</div><div class="credentials-box">`;
            if (client.google1) html += `<div class="cred-row"><span>Google 1: ${client.google1}</span> <button class="icon-btn" style="width:28px;height:28px;font-size:12px;" onclick="toggleClientPassword('cred-g1', this)">👁️</button></div><div class="cred-pass" id="cred-g1" style="display:none;">${client.google1Pass || '***'}</div>`;
            if (client.google2) html += `<div class="cred-row"><span>Google 2: ${client.google2}</span> <button class="icon-btn" style="width:28px;height:28px;font-size:12px;" onclick="toggleClientPassword('cred-g2', this)">👁️</button></div><div class="cred-pass" id="cred-g2" style="display:none;">${client.google2Pass || '***'}</div>`;
            if (client.appleId) html += `<div class="cred-row"><span>Apple ID: ${client.appleId}</span> <button class="icon-btn" style="width:28px;height:28px;font-size:12px;" onclick="toggleClientPassword('cred-apple', this)">👁️</button></div><div class="cred-pass" id="cred-apple" style="display:none;">${client.appleIdPass || '***'}</div>`;
            html += `</div></div>`;
        }

        if (client.cep || client.city || client.street) {
            html += `<div class="form-section"><div class="form-section-title">📍 Endereço</div><div style="font-size:13px;color:var(--text2);">${client.street || ''} ${client.number || ''} ${client.complement || ''}<br>${client.neighborhood || ''} - ${client.city || ''}/${client.state || ''}<br>CEP: ${client.cep || ''}</div></div>`;
        }

        if (client.freeObservations) {
            html += `<div class="form-section"><div class="form-section-title">📝 Observações</div><div style="font-size:13px;color:var(--text2);white-space:pre-wrap;">${client.freeObservations}</div></div>`;
        }

        html += `<div style="font-size:11px;color:var(--text3);text-align:center;margin-top:20px;">Cliente desde: ${client.createdAt ? formatDateShort(client.createdAt) : 'Data não registrada'}</div>`;

        html += `<div class="premium-list" style="margin-top:16px;">${clientOrders.map(os => `<div class="os-card" onclick="openDetail('${os.id}')"><div class="os-card-header"><span class="os-card-id">${os.id}</span><span class="os-card-status status-${(os.status||'').replace(/ /g, '_')}">${getStatusLabel(os.status||'')}</span></div><div class="os-card-name">${os.model||''}</div><div class="os-card-info">${(os.defect||'').substring(0, 50)}${(os.defect||'').length >50?'...':''}</div><div class="os-card-footer"><span class="os-card-date">${formatDate(os.createdAt)}</span><span class="os-card-category">${getCategoryIcon(os.category)}</span></div></div>`).join('')}</div>`;

        html += `<div style="margin-top:16px;"><button class="btn btn-success premium-btn" onclick="startOSForClient('${client.phone||''}','${client.name||''}')">➕ Nova O.S. para este cliente</button></div>`;
        
        c.innerHTML = html; 
        showScreen('client-detail');
    });
}

function startOSForClient(phone, name) { startOS(DB.getOS().filter(o => o.phone===phone)[0]?.category||'celular'); document.getElementById('f-nome').value=name||''; document.getElementById('f-telefone').value=phone||''; }

function editClientFromDetail(phone) {
    showScreen('clientes');
    setTimeout(() => {
        const area = document.getElementById('client-management-area');
        if (area) {
            area.style.display = 'block';
            isClientFormOpen = true;
            const client = DB.getClients().find(c => c.phone === phone);
            renderClientForm(client);
            area.scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
}

function editClient(phone) { editClientFromDetail(phone); }

async function saveClientEdit(oldPhone) { const n = document.getElementById('edit-name').value.trim(); const p = document.getElementById('edit-phone').value.trim(); if (!n || !p) return alert("Preencha os campos."); try { await updateDoc(doc(db, "clientes", oldPhone), { name: n, phone: p }); showToast("✅ Cliente atualizado."); window.markSaved(); showClientDetail(p); } catch(e) { console.error(e); alert("Erro ao atualizar."); } }

async function deleteClient(phone) {
    const confirmCode = prompt("Digite 77 para confirmar a exclusão do cliente");
    if (confirmCode !== "77") { alert("Exclusão cancelada."); return; }
    const docId = phone.trim();
    if (!docId) { alert("ID do cliente inválido."); return; }
    try {
        await deleteDoc(doc(db, "clientes", docId));
        localClients = localClients.filter(c => c.phone !== docId);
        renderClients();
        showToast("🗑️ Cliente excluído com sucesso.");
    } catch (e) {
        console.error("❌ Erro ao excluir do Firestore:", e);
        if (e.code === 'not-found') { alert("Cliente não encontrado no banco."); } else { alert("Erro ao excluir do Firestore."); }
    }
}

function toggleClientManagement() {
    const area = document.getElementById('client-management-area');
    if (!area) return;
    if (isClientFormOpen) {
        area.style.display = 'none';
        isClientFormOpen = false;
        currentEditingClient = null;
    } else {
        area.style.display = 'block';
        isClientFormOpen = true;
        renderClientForm(null);
    }
}

function renderClientForm(client) {
    currentEditingClient = client;
    currentClientTags = client ? [...(client.tags || [])] : [];
    currentClientRating = client ? (client.rating || 0) : 0;
    
    const area = document.getElementById('client-management-area');
    if (!area) return;

    const c = client || {};
    
    let html = `<div class="client-form-container">
        <div class="form-section-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>${client ? '✏️ Editando Ficha Completa' : '➕ Novo Cadastro Completo'}</span>
            <button onclick="toggleClientManagement()" style="background:var(--surface3);border:1px solid var(--border);padding:4px 8px;border-radius:var(--radius-sm);cursor:pointer;font-size:11px;color:var(--text2);">✕ Fechar</button>
        </div>

        <div class="client-form-header">
            <div class="form-group" style="flex:1;">
                <label>Nome Completo *</label>
                <input type="text" id="cf-name" value="${c.name || ''}" placeholder="Nome do cliente">
            </div>
            <div class="client-rating-selector" id="cf-rating">
                ${[1,2,3,4,5].map(i => `<span class="star-btn ${i <= currentClientRating ? 'active' : ''}" onclick="setClientRating(${i})">⭐</span>`).join('')}
            </div>
        </div>

        <div class="form-section-title">👤 Dados Pessoais</div>
        <div class="form-row">
            <div class="form-group"><label>Data de Nascimento</label><input type="date" id="cf-birth" value="${c.birthDate || ''}"></div>
            <div class="form-group"><label>CPF</label><input type="text" id="cf-cpf" value="${c.cpf || ''}" placeholder="000.000.000-00"></div>
        </div>

        <div class="form-section-title">📞 Contatos</div>
        <div class="form-row">
            <div class="form-group">
                <label>Telefone Principal *</label>
                <div style="display:flex;gap:6px;">
                    <input type="tel" id="cf-phone1" value="${c.phone || ''}" placeholder="(00) 00000-0000" style="flex:1;" ${client ? 'readonly' : ''}>
                    <button type="button" class="icon-btn" onclick="openWhatsApp(document.getElementById('cf-phone1').value)">💬</button>
                </div>
            </div>
            <div class="form-group">
                <label>Telefone Secundário</label>
                <div style="display:flex;gap:6px;">
                    <input type="tel" id="cf-phone2" value="${c.phone2 || ''}" placeholder="(00) 00000-0000" style="flex:1;">
                    <button type="button" class="icon-btn" onclick="openWhatsApp(document.getElementById('cf-phone2').value)">💬</button>
                </div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>E-mail Principal</label><input type="email" id="cf-email1" value="${c.email || ''}" placeholder="email@exemplo.com"></div>
            <div class="form-group"><label>E-mail Secundário</label><input type="email" id="cf-email2" value="${c.email2 || ''}" placeholder="email2@exemplo.com"></div>
        </div>

        <div class="form-section-title">📍 Endereço</div>
        <div class="form-row">
            <div class="form-group" style="max-width:120px;">
                <label>CEP</label>
                <div style="display:flex;gap:6px;">
                    <input type="text" id="cf-cep" value="${c.cep || ''}" placeholder="00000-000" style="flex:1;">
                    <button type="button" class="icon-btn" onclick="fetchCEP()">🔍</button>
                </div>
            </div>
            <div class="form-group"><label>Rua</label><input type="text" id="cf-street" value="${c.street || ''}"></div>
            <div class="form-group" style="max-width:80px;"><label>Número</label><input type="text" id="cf-number" value="${c.number || ''}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Complemento</label><input type="text" id="cf-complement" value="${c.complement || ''}"></div>
            <div class="form-group"><label>Bairro</label><input type="text" id="cf-neighborhood" value="${c.neighborhood || ''}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Cidade</label><input type="text" id="cf-city" value="${c.city || ''}"></div>
            <div class="form-group" style="max-width:80px;"><label>Estado</label><input type="text" id="cf-state" value="${c.state || ''}"></div>
        </div>

        <div class="form-section-title">🏷️ Etiquetas</div>
        <div class="client-tags-container" id="cf-tags-display">
            ${currentClientTags.map(t => `<span class="client-tag">${t} <span onclick="removeClientTag('${t}')" style="cursor:pointer;margin-left:4px;">✕</span></span>`).join('')}
        </div>
        <select id="cf-tag-select" onchange="addClientTag(this.value)" style="margin-top:8px;">
            <option value="">+ Adicionar Etiqueta</option>
            ${AVAILABLE_TAGS.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>

        <div class="form-section-title">🔐 Credenciais</div>
        <div class="form-row">
            <div class="form-group"><label>Conta Google 1</label><input type="text" id="cf-google1" value="${c.google1 || ''}"></div>
            <!-- ✅ AJUSTE FINAL 2: BOTÕES MOSTRAR/OCULTAR E COPIAR -->
            <div class="form-group"><label>Senha Google 1</label>
                <div style="display:flex;gap:6px;">
                    <input type="password" id="cf-google1Pass" value="${c.google1Pass || ''}" style="flex:1;">
                    <button type="button" class="icon-btn" onclick="togglePasswordVisibility('cf-google1Pass', this)">👁</button>
                    <button type="button" class="icon-btn" onclick="copyPasswordToClipboard('cf-google1Pass')">📋</button>
                </div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Conta Google 2</label><input type="text" id="cf-google2" value="${c.google2 || ''}"></div>
            <div class="form-group"><label>Senha Google 2</label>
                <div style="display:flex;gap:6px;">
                    <input type="password" id="cf-google2Pass" value="${c.google2Pass || ''}" style="flex:1;">
                    <button type="button" class="icon-btn" onclick="togglePasswordVisibility('cf-google2Pass', this)">👁</button>
                    <button type="button" class="icon-btn" onclick="copyPasswordToClipboard('cf-google2Pass')">📋</button>
                </div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Apple ID</label><input type="text" id="cf-appleId" value="${c.appleId || ''}"></div>
            <div class="form-group"><label>Senha Apple ID</label>
                <div style="display:flex;gap:6px;">
                    <input type="password" id="cf-appleIdPass" value="${c.appleIdPass || ''}" style="flex:1;">
                    <button type="button" class="icon-btn" onclick="togglePasswordVisibility('cf-appleIdPass', this)">👁</button>
                    <button type="button" class="icon-btn" onclick="copyPasswordToClipboard('cf-appleIdPass')">📋</button>
                </div>
            </div>
        </div>

        <div class="form-section-title">📝 Observações Livres</div>
        <div class="form-group">
            <textarea id="cf-observations" rows="4" placeholder="Prefere contato por WhatsApp. Filho busca os aparelhos...">${c.freeObservations || ''}</textarea>
        </div>

        <button class="premium-btn" style="width:100%; margin-top:16px;" onclick="saveFullClient()">💾 Salvar Ficha Completa</button>
    </div>`;

    area.innerHTML = html;
}

function setClientRating(r) {
    currentClientRating = (currentClientRating === r) ? 0 : r;
    document.querySelectorAll('#cf-rating .star-btn').forEach((el, i) => {
        el.classList.toggle('active', i < currentClientRating);
    });
}

function addClientTag(tag) {
    if (!tag) return;
    if (!currentClientTags.includes(tag)) {
        currentClientTags.push(tag);
        updateTagsDisplay();
    }
    document.getElementById('cf-tag-select').value = '';
}

function removeClientTag(tag) {
    currentClientTags = currentClientTags.filter(t => t !== tag);
    updateTagsDisplay();
}

function updateTagsDisplay() {
    const container = document.getElementById('cf-tags-display');
    if (container) {
        container.innerHTML = currentClientTags.map(t => `<span class="client-tag">${t} <span onclick="removeClientTag('${t}')" style="cursor:pointer;margin-left:4px;">✕</span></span>`).join('');
    }
}

function toggleClientPassword(id, btn) {
    const el = document.getElementById(id);
    if (el) {
        if (el.style.display === 'none') {
            el.style.display = 'block';
            btn.textContent = '🙈';
        } else {
            el.style.display = 'none';
            btn.textContent = '👁️';
        }
    }
}

// ✅ NOVAS FUNÇÕES PARA SENHAS DO CLIENTE
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁';
    }
}

function copyPasswordToClipboard(inputId) {
    const input = document.getElementById(inputId);
    if (!input || !input.value) return showToast('⚠️ Senha vazia');
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value).then(() => {
            showToast('🔐 Senha copiada!');
        }).catch(() => {
            fallbackCopy(input);
        });
    } else {
        fallbackCopy(input);
    }
}

function fallbackCopy(input) {
    input.type = 'text';
    input.select();
    document.execCommand('copy');
    input.type = 'password';
    showToast('🔐 Senha copiada!');
}

async function fetchCEP() {
    const cep = document.getElementById('cf-cep').value.replace(/\D/g, '');
    if (cep.length !== 8) return showToast('⚠️ CEP inválido');
    try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (data.erro) return showToast('⚠️ CEP não encontrado');
        document.getElementById('cf-street').value = data.logradouro || '';
        document.getElementById('cf-neighborhood').value = data.bairro || '';
        document.getElementById('cf-city').value = data.localidade || '';
        document.getElementById('cf-state').value = data.uf || '';
        showToast('✅ Endereço preenchido');
    } catch (e) {
        showToast('❌ Erro ao buscar CEP');
    }
}

function openWhatsApp(phone) {
    if (!phone) return;
    const clean = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${clean}`, '_blank');
}

async function saveFullClient() {
    const phone1 = document.getElementById('cf-phone1').value.trim();
    const name = document.getElementById('cf-name').value.trim();
    if (!phone1 || !name) return showToast('⚠️ Nome e Telefone Principal são obrigatórios');

    const clientData = {
        phone: phone1,
        name: name,
        birthDate: document.getElementById('cf-birth').value,
        cpf: document.getElementById('cf-cpf').value,
        phone2: document.getElementById('cf-phone2').value,
        email: document.getElementById('cf-email1').value,
        email2: document.getElementById('cf-email2').value,
        cep: document.getElementById('cf-cep').value,
        street: document.getElementById('cf-street').value,
        number: document.getElementById('cf-number').value,
        complement: document.getElementById('cf-complement').value,
        neighborhood: document.getElementById('cf-neighborhood').value,
        city: document.getElementById('cf-city').value,
        state: document.getElementById('cf-state').value,
        tags: currentClientTags,
        rating: currentClientRating,
        google1: document.getElementById('cf-google1').value,
        google1Pass: document.getElementById('cf-google1Pass').value,
        google2: document.getElementById('cf-google2').value,
        google2Pass: document.getElementById('cf-google2Pass').value,
        appleId: document.getElementById('cf-appleId').value,
        appleIdPass: document.getElementById('cf-appleIdPass').value,
        freeObservations: document.getElementById('cf-observations').value,
        history: currentEditingClient ? (currentEditingClient.history || []) : [],
        createdAt: currentEditingClient ? (currentEditingClient.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        await DB.saveClient(clientData);
        showToast('✅ Ficha do cliente salva!');
        toggleClientManagement();
        renderClients();
        window.markSaved();
    } catch (e) {
        console.error(e);
        showToast('❌ Erro ao salvar');
    }
}

function renderStarsHTML(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += `<span style="color:${i <= rating ? '#F59E0B' : 'var(--text3)'};font-size:16px;">⭐</span>`;
    }
    return stars;
}

// ===== GLOBAL SEARCH =====
function globalSearch() { const t = (document.getElementById('global-search')?.value || '').trim().toLowerCase(); const c = document.getElementById('search-results'); if (!c) return; if (t.length < 2) { c.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><p>Digite pelo menos 2 caracteres</p></div>`; return; } const orders = DB.getOS().filter(o => (o.clientName||'').toLowerCase().includes(t) || (o.phone||'').includes(t) || (o.id||'').toLowerCase().includes(t) || (o.model||'').toLowerCase().includes(t)); const clients = DB.getClients().filter(cl => (cl.name||'').toLowerCase().includes(t) || (cl.phone||'').includes(t)); let h = ''; if (clients.length > 0) h += `<div class="form-section"><div class="form-section-title">Clientes</div>${clients.map(cl => `<div class="client-card" onclick="showClientDetail('${cl.phone}')"><div class="client-card-name">${cl.name||''}</div><div class="client-card-phone">📞 ${cl.phone||''}</div></div>`).join('')}</div>`;
    if (orders.length > 0) {
        const orderCards = orders.map(os => {
            const entregaInfo = os.status === 'entregue' ? `<div style="font-size:11px;color:#22c55e;margin-top:4px;font-weight:600;">📅 Entregue em: ${formatDate(os.updatedAt)}</div>` : '';
            return `<div class="os-card" onclick="openDetail('${os.id}')"><div class="os-card-header"><span class="os-card-id">${os.id}</span><span class="os-card-status status-${(os.status||'').replace(/ /g, '_')}">${getStatusLabel(os.status||'')}</span></div><div class="os-card-name">${os.clientName||''}</div><div class="os-card-info">${os.model||''}</div>${entregaInfo}</div>`;
        }).join('');
        h += `<div class="form-section"><div class="form-section-title">Ordens</div><div class="premium-list">${orderCards}</div></div>`;
    }
    c.innerHTML = h || `<div class="empty-state"><div class="icon">🔍</div><p>Nenhum resultado</p></div>`; 
}

// ===== MODAL & TOAST =====
function openModal(content) { document.getElementById('modal-content').innerHTML = content; document.getElementById('modal-overlay').classList.add('active'); }
function closeModal(event) { if (event && event.target === document.getElementById('modal-overlay')) document.getElementById('modal-overlay').classList.remove('active'); else document.getElementById('modal-overlay').classList.remove('active'); }
function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }
function openGlobalSearch() { showScreen('pesquisar'); setTimeout(() => document.getElementById('global-search')?.focus(), 150); }

// ===== CONVERSÃO DE PRÉ-OS (vindo do Autoatendimento) =====
let preOSPendente = null;
function verificarConversaoPreOS() {
    try {
        const raw = sessionStorage.getItem('cc_dados_preos');
        if (!raw) return;
        sessionStorage.removeItem('cc_dados_preos');
        const d = JSON.parse(raw);
        console.log('🔄 [Conversão] Dados da Pré-OS recebidos:', d);
        startOS('celular'); // abre o formulário de Nova OS na categoria padrão
        const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
        set('f-nome', d.clienteNome);
        set('f-telefone', formatPhone(d.clienteWhatsapp || ''));
        set('f-marca', d.aparelhoMarca);
        set('f-modelo', d.aparelhoModelo || [d.aparelhoMarca, d.aparelhoModelo].filter(Boolean).join(' ').trim());
        set('f-defeito', d.defeito);
        set('f-obs', d.observacoes);
        if (d.senha) set('f-senha', d.senha);
        // Transfere o padrão Android (desbloqueio) desenhado no Autoatendimento
        if (d.lockType === 'Padrao' && Array.isArray(d.patternSequence) && d.patternSequence.length >= 4) {
            const lockSel = document.getElementById('lock-type');
            if (lockSel) lockSel.value = 'Padrao';
            if (typeof toggleLockType === 'function') toggleLockType();
            window.tempPatternSequence = [...d.patternSequence];
            const s = document.getElementById('pattern-summary'); if (s) s.style.display = 'block';
            console.log('🔄 [Conversão] Padrão Android transferido:', d.patternSequence);
        }
        preOSPendente = d.preOSId || null;
        console.log('🔄 [Conversão] Formulário de OS pré-preenchido. Pré-OS pendente:', preOSPendente);
        showToast('📥 Dados da Pré-OS carregados. Revise e clique em Salvar para gerar a OS.');
    } catch (e) {
        console.error('❌ [Conversão] Erro ao carregar dados da Pré-OS:', e);
    }
}

// ===== CONVERSÃO DE SOLICITAÇÃO DO PORTAL (ETAPA 4) =====
let portalOSPendente = null;
function verificarConversaoPortalOS() {
    try {
        const raw = sessionStorage.getItem('cc_dados_portal_os');
        if (!raw) return;
        sessionStorage.removeItem('cc_dados_portal_os');
        const d = JSON.parse(raw);
        console.log('🔄 [Portal] Dados da solicitação recebidos:', d);

        const cat = d.tipoEquipamento || 'celular';
        startOS(cat);

        const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
        set('f-nome', d.clienteNome);
        set('f-telefone', formatPhone(d.clienteWhatsapp || ''));
        set('f-marca', d.aparelhoMarca);
        set('f-modelo', d.aparelhoModelo || '');
        set('f-defeito', d.defeito);
        set('f-obs', 'Solicitação via Portal do Cliente');

        portalOSPendente = d.solicitacaoId || null;
        console.log('🔄 [Portal] Formulário pré-preenchido. Solicitação pendente:', portalOSPendente);
        showToast('📥 Dados do Portal carregados. Revise e clique em Salvar para gerar a OS.');
    } catch (e) {
        console.error('❌ [Portal] Erro ao carregar dados da solicitação:', e);
    }
}

// ===== INIT =====
async function init() {
    if (appInitialized) return; appInitialized = true;
    const headers = document.querySelectorAll('.header'); if (headers.length > 1) { for (let i = 1; i < headers.length; i++) headers[i].remove(); }
    ensureMenuTitle();
    const phoneInput = document.getElementById('f-telefone'); if (phoneInput) phoneInput.addEventListener('input', e => e.target.value = formatPhone(e.target.value));
    const logoEl = document.querySelector('.header-logo');
    if (logoEl && !logoEl.dataset.logoHandler) {
        logoEl.addEventListener('click', () => showScreen('home'));
        logoEl.dataset.logoHandler = 'true';
    }
    await DB.loadFromFirestore(); updateStats(); updateFavStars();
    // Garante que as configurações de garantia estejam carregadas do Firestore
    // (fallback caso localStorage não tenha sido populado por clientes.js)
    await _fetchWarrantyConfigFromFirestore();
    // Popula o seletor de modelos de garantia com os configurados no sistema
    _populateWarrantySelect('f-garantia-modelo');
    // Prioridade: #os-<id> > #fav-<...> > favorito padrão (estrela) > home.
    // OBS: showScreen('home') recarrega e ZERA localOS de forma síncrona; por isso só é
    // chamado quando NÃO há destino, evitando a corrida que esvaziava DB.getOS() antes
    // da checagem do hash (causa-raiz da falha do deep-link).
    const hashView = getHashView();
    const hashOS = getHashOS();
    if (hashOS && DB.getOS().some(o => o.id === hashOS)) openDetail(hashOS);
    else if (hashView) openFav(hashView);
    else { const fav = getFav(); if (fav) openFav(fav); else showScreen('home'); }
    console.log('✅ Cell City OS inicializado. Conectado ao Firestore.');
    verificarConversaoPreOS();
    verificarConversaoPortalOS();
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }

// Deep-link quando já estamos na página de OS (hash muda sem recarregar)
window.addEventListener('hashchange', () => {
    const osId = getHashOS();
    if (osId && DB.getOS().some(o => o.id === osId)) { openDetail(osId); return; }
    const v = getHashView(); if (v) openFav(v);
});
