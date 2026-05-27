import { db, collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "../../scripts/firebase.js";

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
window.filterList = filterList;
window.openDetail = openDetail;
window.changeStatus = changeStatus;
window.addObservation = addObservation;
window.addPhotoToOS = addPhotoToOS;
window.markDelivered = markDelivered;
window.openClientFromOS = openClientFromOS;
window.deleteOS = deleteOS;
window.editClient = editClient;
window.saveClientEdit = saveClientEdit;
window.saveObservation = saveObservation;
window.shareWhatsApp = shareWhatsApp;
window.printOS = printOS;
window.searchClients = searchClients;
window.showClientDetail = showClientDetail;
window.startOSForClient = startOSForClient;
window.globalSearch = globalSearch;
window.closeModal = closeModal;
window.openGlobalSearch = openGlobalSearch;
window.toggleOSEdit = toggleOSEdit; // ✅ NOVA
window.saveOSEdit = saveOSEdit;     // ✅ NOVA

// ===== STATE & AUTO-SAVE FLAG =====
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
    localOS = []; localClients = []; localCounter = 0;
    try {
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
    const backBtn = document.getElementById('backBtn'); const mainHeader = document.getElementById('mainHeader');
    if (id === 'home') { screenHistory = []; backBtn.classList.remove('visible'); if (mainHeader) mainHeader.style.display = 'none'; await DB.loadFromFirestore(); updateStats(); }
    else { if (!screenHistory.includes(id)) screenHistory.push(id); backBtn.classList.add('visible'); if (mainHeader) mainHeader.style.display = 'flex'; }
    const titleEl = document.getElementById('headerTitle');
    const titles = { category: 'Nova O.S.', form: 'Criar O.S.', clientes: 'Clientes', pesquisar: 'Pesquisar', 'client-detail': 'Detalhes do Cliente' };
    if (titleEl) { titleEl.textContent = titles[id] || ''; if (id === 'clientes') renderClients(); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
function goBack() { guardNavigation(() => { screenHistory.pop(); showScreen(screenHistory.length > 0 ? screenHistory[screenHistory.length - 1] : 'home'); }); }

// ===== UTILS =====
function formatPhone(v) { v = v.replace(/\D/g, ''); if (v.length > 11) v = v.slice(0, 11); return v.length > 6 ? `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}` : v.length > 2 ? `(${v.slice(0,2)}) ${v.slice(2)}` : v.length > 0 ? `(${v}` : v; }
function getCategoryLabel(cat) { return { celular: '📱 Celular', notebook: '💻 Notebook', impressora: '🖨️ Impressora' }[cat] || cat; }
function getCategoryIcon(cat) { return { celular: '📱', notebook: '💻', impressora: '🖨️' }[cat] || ''; }
function getStatusLabel(status) { return { 'em_analise': 'Em análise', 'aguardando_peca': 'Aguardando peça', 'em_reparo': 'Em reparo', 'pronto': 'Pronto', 'entregue': 'Entregue' }[status] || status; }
function formatDate(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''; }
function formatDateShort(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) : ''; }

// ===== STATS =====
function updateStats() {
  const orders = DB.getOS(); const andamento = orders.filter(o => !['pronto','entregue'].includes(o.status)).length; const finalizados = orders.filter(o => ['pronto','entregue'].includes(o.status)).length;
  const bar = document.getElementById('statsBar'); if (bar) bar.innerHTML = `<div class="stat-chip"><span class="num">${orders.length}</span><span class="stat-label">Total</span></div> <div class="stat-chip"><span class="num">${andamento}</span><span class="stat-label">Em andamento</span></div> <div class="stat-chip"><span class="num">${finalizados}</span><span class="stat-label">Finalizados</span></div>`;
  ['andamento', 'finalizados'].forEach(type => { const el = document.getElementById(`badge-${type}`); if (!el) return; el.style.display = (type === 'andamento' ? andamento : finalizados) > 0 ? 'flex' : 'none'; el.textContent = type === 'andamento' ? andamento : finalizados; });
}

// ===== CHECKLIST & PHOTOS =====
function getChecklistTemplate(cat) { const b = ['Tela / Display','Câmera frontal','Câmera traseira','Botões / Teclado','Carregador / Bateria','Wi-Fi / Bluetooth','Alto-falante','Microfone']; return cat === 'celular' ? [...b, 'Slot SIM/SD', 'Sensor de proximidade', 'Leitor digital'] : cat === 'notebook' ? [...b, 'Trackpad', 'Portas USB', 'Leitor de cartão', 'Webcam'] : cat === 'impressora' ? ['Cabeçote de impressão','Cartuchos / Toner','Bandeja de papel','Conexão USB/Wi-Fi','Display/Painel','Rolos de alimentação'] : b; }
function renderChecklist(cid, items, key, checked = []) { const c = document.getElementById(cid); if (!c) return; c.innerHTML = items.map((i, x) => `<div class="checklist-item"><input type="checkbox" id="${key}-${x}" ${checked.includes(x) ? 'checked' : ''} onchange="updateChecklistItem('${key}', ${x}, this.checked)"><label for="${key}-${x}" style="cursor:pointer;flex:1">${i}</label></div>`).join(''); }
async function updateChecklistItem(type, index, value) { if (!currentOS) return; const key = type === 'entry' ? 'entryChecklist' : 'exitChecklist'; if (!currentOS[key]) currentOS[key] = []; value ? !currentOS[key].includes(index) && currentOS[key].push(index) : currentOS[key] = currentOS[key].filter(i => i !== index); await saveCurrentOS(); }
function handlePhotos(e) { const f = e.target.files; if (!f) return; for (let file of f) { const r = new FileReader(); r.onload = function(ev) { const img = new Image(); img.onload = function() { const c = document.createElement('canvas'); const max = 800; let w = img.width, h = img.height; if (w > max || h > max) w > h ? (h = h * max / w, w = max) : (w = w * max / h, h = max); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); tempPhotos.push(c.toDataURL('image/jpeg', 0.7)); renderPhotoPreview(); }; img.src = ev.target.result; }; r.readAsDataURL(file); } e.target.value = ''; }
function renderPhotoPreview() { const c = document.getElementById('photo-preview'); if (!c) return; c.innerHTML = tempPhotos.map((p, i) => `<div class="photo-thumb-wrap"><img class="photo-thumb" src="${p}" onclick="viewPhoto('${p}')"><button class="photo-remove" onclick="removePhoto(${i})">✕</button></div>`).join(''); }
function removePhoto(i) { tempPhotos.splice(i, 1); renderPhotoPreview(); }
function viewPhoto(src) { openModal(`<div class="modal-handle"></div><img src="${src}" style="width:100%;border-radius:8px;">`); }

// ===== CREATE OS =====
function startOS(cat) { currentCategory = cat; tempPhotos = []; currentLockPhoto = null; ['f-nome','f-telefone','f-modelo','f-defeito','f-senha','f-obs'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); const lock = document.getElementById('lock-type'); if(lock) lock.value = 'Numerica'; ['lock-photo','lock-photo-camera'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); const prev = document.getElementById('lock-photo-preview'); if(prev) prev.innerHTML = ''; const pprev = document.getElementById('photo-preview'); if(pprev) pprev.innerHTML = ''; renderChecklist('entry-checklist', getChecklistTemplate(cat), 'entry', []); showScreen('form'); }
async function saveOS() {
  const getVal = id => document.getElementById(id)?.value.trim() || '';
  const [nome, telefone, modelo, defeito, senha, obs, lockType] = ['f-nome','f-telefone','f-modelo','f-defeito','f-senha','f-obs','lock-type'].map(getVal);
  if (!nome || !telefone || !modelo || !defeito) return showToast('⚠️ Preencha todos os campos obrigatórios');
  const entryChecked = getChecklistTemplate(currentCategory).map((_, i) => document.getElementById(`entry-${i}`)?.checked ? i : -1).filter(i => i !== -1);
  const num = await DB.incCounter(); const osId = `OS-${String(num).padStart(4, '0')}`;
  const os = { id: osId, category: currentCategory, clientName: nome, phone: telefone, model: modelo, defect: defeito, observations: obs, technicalObservation: "", password: senha, lockType, lockPhoto: currentLockPhoto, photos: tempPhotos, entryChecklist: entryChecked, exitChecklist: [], status: 'em_analise', timeline: [{ date: new Date().toISOString(), text: `O.S. criada — ${getCategoryLabel(currentCategory)}` }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await DB.addOS(os); await updateClientHistory(telefone, nome, osId); showToast(`✅ ${osId} criada com sucesso!`); window.markSaved(); showScreen('home');
}
async function updateClientHistory(phone, name, osId) { let c = DB.getClients().find(cl => cl.phone === phone); if (c) { !c.history.includes(osId) && c.history.push(osId); c.name = name; } else { c = { name, phone, history: [osId] }; } await DB.saveClient(c); }

// ===== LISTS =====
function showList(filter) { currentListFilter = filter; renderList(); showScreen('list'); }
function renderList() {
  const orders = DB.getOS(); const s = (document.getElementById('list-search')?.value || '').toLowerCase();
  const isFinal = currentListFilter === 'finalizados';
  let filtered = isFinal ? orders.filter(o => ['pronto','entregue'].includes(o.status)) : orders.filter(o => !['pronto','entregue'].includes(o.status));
  if (s) filtered = filtered.filter(o => (o.clientName||'').toLowerCase().includes(s) || (o.phone||'').includes(s) || (o.id||'').toLowerCase().includes(s) || (o.model||'').toLowerCase().includes(s));
  const c = document.getElementById('os-list'); if (!c) return;
  if (filtered.length === 0) { c.innerHTML = `<div class="empty-state"><div class="icon">${isFinal ? '✅' : '🔧'}</div><p>${s ? 'Nenhum resultado encontrado' : 'Nenhuma O.S. nesta categoria'}</p></div>`; return; }
  c.innerHTML = filtered.map(os => { const d = os.defect || ''; return `<div class="os-card" onclick="openDetail('${os.id||''}')"><div class="os-card-header"><span class="os-card-id">${os.id||''}</span><span class="os-card-status status-${(os.status||'').replace(/ /g, '_')}">${getStatusLabel(os.status)}</span></div><div class="os-card-name">${os.clientName||''}</div><div class="os-card-info">${os.model||''} — ${d.substring(0, 45)}${d.length > 45 ? '...' : ''}</div><div class="os-card-footer"><span class="os-card-date">${formatDate(os.createdAt)}</span><span class="os-card-category">${getCategoryIcon(os.category)} ${(getCategoryLabel(os.category) || '').replace(/^.+\s/, '')}</span><button onclick="event.stopPropagation(); deleteOS('${os.id}')" style="background:none;border:none;cursor:pointer;font-size:16px;margin-left:6px;opacity:0.7;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">🗑️</button></div></div>`; }).join('');
}
function filterList() { renderList(); }

// ===== DETAIL =====
function openDetail(osId) { currentOS = DB.getOS().find(o => o.id === osId); if (currentOS) { renderDetail(); showScreen('detail'); } }
function renderDetail() {
  const os = currentOS; const c = document.getElementById('detail-content'); if (!os) return;
  hasUnsavedChanges = false;
  const statuses = [{ key: 'em_analise', label: 'Em análise', color: 'var(--blue)' }, { key: 'aguardando_peca', label: 'Aguardando peça', color: 'var(--yellow)' }, { key: 'em_reparo', label: 'Em reparo', color: 'var(--orange)' }, { key: 'pronto', label: 'Pronto', color: 'var(--green)' }, { key: 'entregue', label: 'Entregue', color: 'var(--text3)' }];
  const clients = DB.getClients(); const client = clients.find(cl => cl.phone === os.phone);
  
  let html = `<div id="save-status" style="margin:8px 0 12px;"></div>`;
  // ✅ CABEÇALHO COM BOTÃO EDITAR
  html += `<div class="detail-header" style="position:relative;">
    <button onclick="toggleOSEdit()" style="position:absolute;top:8px;right:8px;background:var(--surface3);border:1px solid var(--border);padding:6px 10px;border-radius:var(--radius-sm);cursor:pointer;font-size:12px;">✏️ Editar O.S.</button>
    <div class="detail-header-top"><div class="detail-os-id">${os.id}</div><span class="os-card-status status-${(os.status||'').replace(/ /g, '_')}">${getStatusLabel(os.status)}</span></div>
    <div class="detail-client">${os.clientName} ${os.password ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#fbbf24;background:rgba(251,191,36,0.1);padding:2px 8px;border-radius:100px;">🔒 ${os.password}</span>` : ''}</div>
    <div style="font-size:13px;color:var(--text2);margin-top:4px;">📞 ${os.phone}</div>
    <div style="font-size:13px;color:var(--text2);margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">📦 ${getCategoryIcon(os.category)} ${os.model}</div>
    <div style="font-size:13px;color:var(--text2);margin-top:4px;">${os.defect || ''}</div>
  </div>`;

  html += `<div class="form-section"><div class="form-section-title">Alterar Status</div><div class="status-selector">${statuses.map(s => `<div class="status-option ${os.status === s.key ? 'selected' : ''}" onclick="changeStatus('${s.key}')"><span class="dot" style="background:${s.color}"></span>${s.label}</div>`).join('')}</div></div>`;
  html += `<div class="checklist-section"><div class="checklist-title">📋 Checklist de Entrada</div>${renderChecklistHTML('entry', getChecklistTemplate(os.category), os.entryChecklist||[], true)}</div><div class="checklist-section"><div class="checklist-title">✅ Checklist de Saída</div>${renderChecklistHTML('exit', getChecklistTemplate(os.category), os.exitChecklist||[], false)}</div>`;
  if (os.lockPhoto) html += `<div class="form-section"><div class="form-section-title">🔒 Senha/Padrão</div><div style="margin-top:8px;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);"><span style="font-size:12px;color:var(--text2)">Tipo: <strong style="color:var(--text)">${os.lockType}</strong></span> ${os.password ? `<span style="font-size:12px;color:var(--text2);margin-left:10px;">Senha: <strong style="color:var(--yellow)">${os.password}</strong></span>` : ''}<br><img src="${os.lockPhoto}" style="width:100%;max-width:280px;height:auto;border-radius:8px;border:1px solid var(--border);cursor:pointer;margin-top:8px;" onclick="viewPhoto('${os.lockPhoto}')"><p style="font-size:10px;color:var(--text3);margin-top:6px;">Toque para ampliar</p></div></div>`;
  if (os.photos?.length > 0) html += `<div class="form-section"><div class="form-section-title">📷 Fotos (${os.photos.length})</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">${os.photos.map(p => `<img src="${p}" style="width:90px;height:90px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer;" onclick="viewPhoto('${p}')">`).join('')}</div><div class="premium-upload" onclick="addPhotoToOS()" style="margin-top:8px"><div class="icon">➕</div><p>Adicionar mais fotos</p></div></div>`;
  
  html += `<div class="form-section"><div class="form-section-title">📝 Observações</div><textarea id="os-observations" rows="4" oninput="window.markUnsaved()" style="width:100%;padding:12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:inherit;font-size:14px;resize:vertical;box-shadow:none;outline:none;" onfocus="this.style.borderColor='var(--green-primary)'" onblur="this.style.borderColor='var(--border)'">${os.observations || ''}</textarea><div style="display:flex;gap:8px;margin-top:8px;"><button onclick="saveObservation()" style="flex:1;padding:10px;background:var(--green-primary);color:#000;border:none;border-radius:var(--radius-sm);font-weight:800;cursor:pointer;">💾 Salvar Observações</button></div></div>`;
  html += `<div class="form-section"><div class="form-section-title">🛠️ Observação Técnica</div><textarea id="os-tech-obs" rows="3" oninput="window.markUnsaved()" style="width:100%;padding:12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:inherit;font-size:14px;resize:vertical;box-shadow:none;outline:none;" onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--border)'">${os.technicalObservation || ''}</textarea><div style="display:flex;gap:8px;margin-top:8px;"><button onclick="saveTechObservation()" style="flex:1;padding:10px;background:var(--blue);color:#fff;border:none;border-radius:var(--radius-sm);font-weight:800;cursor:pointer;">💾 Salvar Nota Técnica</button></div></div>`;
  html += `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:20px;"><div class="form-section-title" style="margin-bottom:8px;">📜 Histórico</div>${(os.timeline||[]).map(t => `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--text2);"><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">${formatDate(t.date)}</div><div>${t.text || ''}</div></div>`).join('')}</div>`;
  if (client?.history.length > 1) {
    const otherOS = client.history.filter(h => h !== os.id);
    html += `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:20px;"><div class="form-section-title" style="margin-bottom:8px;">📂 Outras OS (${client.history.length})</div>${otherOS.map(hId => { const h = DB.getOS().find(o => o.id === hId); return h ? `<div onclick="openDetail('${h.id}')" style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;cursor:pointer;"><div><div style="font-size:12px;font-weight:800;color:var(--green-light);">${h.id}</div><div style="font-size:11px;color:var(--text3);">${h.model} — ${formatDateShort(h.createdAt)}</div></div><span class="os-card-status status-${(h.status||'').replace(/ /g, '_')}">${getStatusLabel(h.status)}</span></div>` : ''; }).join('')}</div>`;
  }
  html += `<div class="detail-actions">${os.status !== 'entregue' ? `<button class="btn btn-success" onclick="markDelivered()">📦 Entregue</button>` : ''}<button class="btn btn-secondary" onclick="openClientFromOS()">Ver Cliente</button></div><button class="btn btn-ghost" onclick="printOS()" style="color:var(--text2)">🖨️ Imprimir</button><button class="btn btn-ghost" onclick="shareWhatsApp()" style="color:var(--green)">💬 WhatsApp</button><button class="btn btn-ghost" onclick="deleteOS('${os.id}')" style="color:var(--red)">🗑️ Excluir</button>`;
  c.innerHTML = html;
  updateSaveUI();
}

// ✅ NOVA FUNÇÃO: ATIVAR MODO DE EDIÇÃO NA OS
function toggleOSEdit() {
  if (!currentOS) return;
  const os = currentOS;
  const c = document.getElementById('detail-content');
  // Substitui o header pelos inputs editáveis
  c.querySelector('.detail-header').innerHTML = `
    <button onclick="toggleOSEdit()" style="margin-bottom:12px;background:var(--surface3);border:1px solid var(--border);padding:6px 10px;border-radius:var(--radius-sm);cursor:pointer;font-size:12px;">↩️ Cancelar Edição</button>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <label style="font-size:12px;color:var(--text2);margin-top:4px;">Nome do Cliente</label>
      <input id="edit-os-name" value="${os.clientName||''}" style="padding:12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">
      <label style="font-size:12px;color:var(--text2);">Telefone</label>
      <input id="edit-os-phone" value="${os.phone||''}" style="padding:12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">
      <label style="font-size:12px;color:var(--text2);">Modelo do Aparelho</label>
      <input id="edit-os-model" value="${os.model||''}" style="padding:12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);" oninput="window.markUnsaved()">
    </div>
    <button onclick="saveOSEdit()" style="margin-top:14px;width:100%;padding:12px;background:var(--green-primary);color:#000;border:none;border-radius:var(--radius-sm);font-weight:800;cursor:pointer;">💾 Salvar Alterações</button>
  `;
  window.markUnsaved();
}

// ✅ NOVA FUNÇÃO: SALVAR EDIÇÃO DA OS
async function saveOSEdit() {
  const newName = document.getElementById('edit-os-name').value.trim();
  const newPhone = document.getElementById('edit-os-phone').value.trim();
  const newModel = document.getElementById('edit-os-model').value.trim();
  if (!newName || !newPhone || !newModel) return showToast('⚠️ Preencha todos os campos');

  try {
    await updateDoc(doc(db, "os", currentOS.id), {
      clientName: newName, phone: newPhone, model: newModel, updatedAt: new Date().toISOString()
    });
    // Atualiza estado local para refletir instantaneamente
    currentOS.clientName = newName; currentOS.phone = newPhone; currentOS.model = newModel;
    const idx = localOS.findIndex(o => o.id === currentOS.id);
    if (idx >= 0) localOS[idx] = { ...currentOS };
    showToast('✅ O.S. atualizada!');
    window.markSaved();
    renderDetail(); // Volta para modo visualização
  } catch (e) { console.error("Erro ao salvar OS:", e); showToast('❌ Erro ao salvar'); }
}

function renderChecklistHTML(key, items, checked, readonly) { return items.map((item, i) => `<div class="checklist-item"><input type="checkbox" ${checked.includes(i) ? 'checked' : ''} ${readonly ? 'disabled' : `onchange="updateChecklistItem('${key}', ${i}, this.checked)"`}><label style="cursor:${readonly ? 'default' : 'pointer'};flex:1">${item}</label></div>`).join(''); }
async function changeStatus(newStatus) { if (!currentOS) return; window.markUnsaved(); const old = currentOS.status; currentOS.status = newStatus; currentOS.updatedAt = new Date().toISOString(); currentOS.timeline.push({ date: new Date().toISOString(), text: `Status: ${getStatusLabel(old)} → ${getStatusLabel(newStatus)}` }); await saveCurrentOS(); renderDetail(); showToast(`✅ ${getStatusLabel(newStatus)}`); window.markSaved(); }
async function addObservation() { const i = document.getElementById('obs-input'); const t = i?.value.trim(); if (!t || !currentOS) return; currentOS.timeline.push({ date: new Date().toISOString(), text: `Nota: ${t}` }); currentOS.updatedAt = new Date().toISOString(); await saveCurrentOS(); renderDetail(); showToast('📝 Adicionada'); i.value = ''; window.markSaved(); }
function addPhotoToOS() { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/'; i.multiple = true; i.onchange = function(e) { for (let f of e.target.files) { const r = new FileReader(); r.onload = function(ev) { const img = new Image(); img.onload = async function() { const c = document.createElement('canvas'); const max = 800; let w = img.width, h = img.height; if(w>max||h>max) w>h?(h=h*max/w,w=max):(w=w*max/h,h=max); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h); currentOS.photos.push(c.toDataURL('image/jpeg',0.7)); await saveCurrentOS(); renderDetail(); showToast('📷 Adicionada'); window.markSaved(); }; img.src = ev.target.result; }; r.readAsDataURL(f); } }; i.click(); }
async function markDelivered() { if(!currentOS) return; window.markUnsaved(); currentOS.status='entregue'; currentOS.updatedAt=new Date().toISOString(); currentOS.timeline.push({date:new Date().toISOString(),text:'Entregue ao cliente'}); await saveCurrentOS(); renderDetail(); showToast('✅ Entregue'); window.markSaved(); }
function openClientFromOS() { if(currentOS) { currentClientPhone=currentOS.phone; showClientDetail(currentOS.phone); } }
async function saveCurrentOS() { if (!currentOS) return; await DB.updateOS(currentOS); }
function shareWhatsApp() { if(!currentOS) return; const os=currentOS; const text=`*Cell City - O.S.*\n📋 ${os.id}\n👤 ${os.clientName}\n📱 ${os.model}\n🔧 ${os.defect}\nStatus: ${getStatusLabel(os.status)}\n📅 ${formatDate(os.createdAt)}`; window.open(`https://wa.me/${(os.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(text)}`, '_blank'); }
function printOS() { if(!currentOS) return; const os=currentOS; const w=window.open('','_blank'); w.document.write(`<!DOCTYPE html><html><head><title>${os.id}</title><style>body{font-family:monospace;padding:20px;max-width:400px;margin:0 auto}h1{text-align:center;font-size:16px;border-bottom:2px solid #000;padding-bottom:8px}.row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}.label{font-weight:bold}.section{margin-top:12px;border-top:1px dashed #ccc;padding-top:6px}.footer{text-align:center;margin-top:20px;font-size:10px}</style></head><body><h1>Cell City Informática</h1><div class="row"><span class="label">O.S.:</span><span>${os.id}</span></div><div class="row"><span class="label">Data:</span><span>${formatDate(os.createdAt)}</span></div><div class="section"><div class="row"><span class="label">Cliente:</span><span>${os.clientName}</span></div><div class="row"><span class="label">Telefone:</span><span>${os.phone}</span></div><div class="row"><span class="label">Aparelho:</span><span>${os.model}</span></div><div class="row"><span class="label">Defeito:</span><span>${os.defect||''}</span></div>${os.lockType?`<div class="row"><span class="label">Bloqueio:</span><span>${os.lockType}</span></div>`:''}${os.password?`<div class="row"><span class="label">Senha:</span><span>${os.password}</span></div>`:''}${os.observations?`<div class="row"><span class="label">Obs: </span><span>${os.observations}</span></div>`:''}</div><div class="section"><div class="row"><span class="label">Status:</span><span>${getStatusLabel(os.status)}</span></div></div><div class="footer"><p>Cell City Informática</p><p>__________________________</p><p>Assinatura</p></div></body></html>`); w.document.close(); w.print(); }

async function deleteOS(id) { const c = prompt("Digite 77 para confirmar a exclusão"); if (c !== "77") { alert("Exclusão cancelada."); return; } try { await deleteDoc(doc(db, "os", id)); localOS = localOS.filter(o => o.id !== id); updateStats(); renderList(); showToast("🗑️ OS excluída."); window.markSaved(); } catch(e) { console.error(e); alert("Erro ao excluir."); } }
async function saveObservation() { const t = document.getElementById('os-observations').value; if (!currentOS) return; currentOS.observations = t; await updateDoc(doc(db, "os", currentOS.id), { observations: t, updatedAt: new Date().toISOString() }); showToast("✅ Observações salvas."); window.markSaved(); }
async function saveTechObservation() { const t = document.getElementById('os-tech-obs').value; if (!currentOS) return; currentOS.technicalObservation = t; await updateDoc(doc(db, "os", currentOS.id), { technicalObservation: t, updatedAt: new Date().toISOString() }); showToast("🛠️ Nota técnica salva."); window.markSaved(); }

// ===== CLIENTS =====
function renderClients() {
  const clients = DB.getClients(); const s = (document.getElementById('client-search')?.value || '').toLowerCase();
  const f = s ? clients.filter(c => (c.name||'').toLowerCase().includes(s) || (c.phone||'').includes(s)) : clients;
  const c = document.getElementById('client-list'); if (!c) return;
  if (f.length === 0) { c.innerHTML = `<div class="empty-state"><div class="icon">👥</div><p>${s ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</p></div>`; return; }
  c.innerHTML = f.map(cl => `<div class="client-card" onclick="showClientDetail('${cl.phone}')"><div class="client-card-name">${cl.name||''}</div><div class="client-card-phone">📞 ${cl.phone||''}</div><div class="client-card-count">${(cl.history||[]).length} O.S.</div><button onclick="event.stopPropagation(); editClient('${cl.phone}')" style="background:none;border:none;cursor:pointer;font-size:16px;margin-left:6px;opacity:0.7;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">✏️</button></div>`).join('');
}
function searchClients() { renderClients(); }
function showClientDetail(phone) {
  guardNavigation(() => {
    const client = DB.getClients().find(c => c.phone === phone); if (!client) return; currentClientPhone = phone;
    const orders = DB.getOS(); const c = document.getElementById('client-detail-content');
    const clientOrders = (client.history||[]).map(id => orders.find(o => o.id === id)).filter(Boolean).reverse();
    let html = `<div class="detail-header"><div class="detail-client" style="font-size:18px;">${client.name||''}</div><div style="font-size:13px;color:var(--text2);margin-top:4px;">📞 ${client.phone||''}</div><div style="margin-top:6px;font-size:12px;color:var(--accent2);">${(client.history||[]).length} O.S.</div><div style="margin-top:12px;"><button onclick="editClient('${client.phone}')" style="padding:8px 12px;background:var(--surface3);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:13px;color:var(--text);">✏️ Editar Cliente</button></div></div>`;
    html += `<div class="premium-list" style="margin-top:16px;">${clientOrders.map(os => `<div class="os-card" onclick="openDetail('${os.id}')"><div class="os-card-header"><span class="os-card-id">${os.id}</span><span class="os-card-status status-${(os.status||'').replace(/ /g, '_')}">${getStatusLabel(os.status||'')}</span></div><div class="os-card-name">${os.model||''}</div><div class="os-card-info">${(os.defect||'').substring(0, 50)}${(os.defect||'').length >50?'...':''}</div><div class="os-card-footer"><span class="os-card-date">${formatDate(os.createdAt)}</span><span class="os-card-category">${getCategoryIcon(os.category)}</span></div></div>`).join('')}</div>`;
    html += `<div style="margin-top:16px;"><button class="btn btn-success premium-btn" onclick="startOSForClient('${client.phone||''}','${client.name||''}')">➕ Nova O.S. para este cliente</button></div>`;
    c.innerHTML = html; showScreen('client-detail');
  });
}
function startOSForClient(phone, name) { startOS(DB.getOS().filter(o => o.phone===phone)[0]?.category||'celular'); document.getElementById('f-nome').value=name||''; document.getElementById('f-telefone').value=phone||''; }

function editClient(phone) { 
  guardNavigation(() => {
    const client = DB.getClients().find(c => c.phone === phone); if (!client) return; 
    document.getElementById('client-detail-content').innerHTML = `<div class="form-section"><div class="form-section-title">✏️ Editar Cliente</div><label style="font-size:12px;color:var(--text2);margin:8px 0 4px;display:block;">Nome</label><input id="edit-name" oninput="window.markUnsaved()" value="${client.name||''}" style="width:100%;padding:12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);"><label style="font-size:12px;color:var(--text2);margin:8px 0 4px;display:block;">Telefone</label><input id="edit-phone" oninput="window.markUnsaved()" value="${client.phone||''}" style="width:100%;padding:12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);"><div style="display:flex;gap:10px;margin-top:14px;"><button onclick="saveClientEdit('${phone}')" style="flex:1;padding:12px;background:var(--green-primary);color:#000;border:none;border-radius:var(--radius-sm);font-weight:800;cursor:pointer;">💾 Salvar</button><button onclick="showClientDetail('${phone}')" style="padding:12px;background:var(--surface3);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;">Cancelar</button></div></div>`;
    window.markSaved();
  });
}
async function saveClientEdit(oldPhone) { const n = document.getElementById('edit-name').value.trim(); const p = document.getElementById('edit-phone').value.trim(); if (!n || !p) return alert("Preencha os campos."); try { await updateDoc(doc(db, "clientes", oldPhone), { name: n, phone: p }); showToast("✅ Cliente atualizado."); window.markSaved(); showClientDetail(p); } catch(e) { console.error(e); alert("Erro ao atualizar."); } }

// ===== GLOBAL SEARCH =====
function globalSearch() { const t = (document.getElementById('global-search')?.value || '').trim().toLowerCase(); const c = document.getElementById('search-results'); if (!c) return; if (t.length < 2) { c.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><p>Digite pelo menos 2 caracteres</p></div>`; return; } const orders = DB.getOS().filter(o => (o.clientName||'').toLowerCase().includes(t) || (o.phone||'').includes(t) || (o.id||'').toLowerCase().includes(t) || (o.model||'').toLowerCase().includes(t)); const clients = DB.getClients().filter(cl => (cl.name||'').toLowerCase().includes(t) || (cl.phone||'').includes(t)); let h = ''; if (clients.length > 0) h += `<div class="form-section"><div class="form-section-title">Clientes</div>${clients.map(cl => `<div class="client-card" onclick="showClientDetail('${cl.phone}')"><div class="client-card-name">${cl.name||''}</div><div class="client-card-phone">📞 ${cl.phone||''}</div></div>`).join('')}</div>`; if (orders.length > 0) h += `<div class="form-section"><div class="form-section-title">Ordens</div><div class="premium-list">${orders.map(os => `<div class="os-card" onclick="openDetail('${os.id}')"><div class="os-card-header"><span class="os-card-id">${os.id}</span><span class="os-card-status status-${(os.status||'').replace(/ /g, '_')}">${getStatusLabel(os.status||'')}</span></div><div class="os-card-name">${os.clientName||''}</div><div class="os-card-info">${os.model||''}</div></div>`).join('')}</div></div>`; c.innerHTML = h || `<div class="empty-state"><div class="icon">🔍</div><p>Nenhum resultado</p></div>`; }

// ===== MODAL & TOAST =====
function openModal(content) { document.getElementById('modal-content').innerHTML = content; document.getElementById('modal-overlay').classList.add('active'); }
function closeModal(event) { if (event.target === document.getElementById('modal-overlay')) document.getElementById('modal-overlay').classList.remove('active'); }
function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }
function openGlobalSearch() { showScreen('pesquisar'); setTimeout(() => document.getElementById('global-search')?.focus(), 150); }

// ===== INIT =====
async function init() {
  if (appInitialized) return; appInitialized = true;
  const headers = document.querySelectorAll('.header'); if (headers.length > 1) { for (let i = 1; i < headers.length; i++) headers[i].remove(); }
  const phoneInput = document.getElementById('f-telefone'); if (phoneInput) phoneInput.addEventListener('input', e => e.target.value = formatPhone(e.target.value));
  await DB.loadFromFirestore(); updateStats(); showScreen('home'); console.log('✅ Cell City OS inicializado. Conectado ao Firestore.');
}
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }