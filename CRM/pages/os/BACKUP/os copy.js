import { db, collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "../../../scripts/firebase.js";

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
window.showList = showList;
window.filterList = filterList;
window.openDetail = openDetail;
window.changeStatus = changeStatus;
window.addObservation = addObservation;
window.addPhotoToOS = addPhotoToOS;
window.markDelivered = markDelivered;
window.openClientFromOS = openClientFromOS;
window.deleteOS = deleteOS;
window.shareWhatsApp = shareWhatsApp;
window.printOS = printOS;
window.searchClients = searchClients;
window.showClientDetail = showClientDetail;
window.startOSForClient = startOSForClient;
window.globalSearch = globalSearch;
window.closeModal = closeModal;
window.openGlobalSearch = openGlobalSearch;

// ===== DATA LAYER =====
let localOS = [];
let localClients = [];
let localCounter = 0;
const DB = {
  getOS() { return localOS; },
  async addOS(osData) {
    localOS.unshift(osData);
    await setDoc(doc(db, "os", osData.id), osData);
  },
  async updateOS(osData) {
    const idx = localOS.findIndex(o => o.id === osData.id);
    if (idx >= 0) localOS[idx] = osData;
    await updateDoc(doc(db, "os", osData.id), osData);
  },
  async deleteOS(id) {
    localOS = localOS.filter(o => o.id !== id);
    await deleteDoc(doc(db, "os", id));
  },
  getClients() { return localClients; },
  async saveClient(clientData) {
    const idx = localClients.findIndex(c => c.phone === clientData.phone);
    if (idx >= 0) localClients[idx] = clientData;
    else localClients.push(clientData);
    await setDoc(doc(db, "clientes", clientData.phone), clientData);
  },
  getCounter() { return localCounter; },
  async incCounter() {
    localCounter++;
    await setDoc(doc(db, "metadata", "counter"), { value: localCounter });
    return localCounter;
  },
  async loadFromFirestore() {
    try {
      const osSnap = await getDocs(collection(db, "os"));
      localOS = osSnap.docs.map(d => d.data()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const clientSnap = await getDocs(collection(db, "clientes"));
      localClients = clientSnap.docs.map(d => d.data());
      const counterSnap = await getDocs(collection(db, "metadata"));
      counterSnap.forEach(d => { if (d.id === "counter") localCounter = d.data().value || 0; });
    } catch (e) {
      console.error("Erro ao carregar do Firestore:", e);
    }
  }
};

// ===== STATE =====
let currentOS = null;
let currentCategory = '';
let tempPhotos = [];
let currentLockPhoto = null;
let screenHistory = [];
let currentListFilter = '';
let currentClientPhone = '';
let appInitialized = false;

// ===== LOCK PHOTO =====
function handleLockPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (ev) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const max = 450;
      let w = img.width, h = img.height;
      if (w > max || h > max) { w > h ? (h = h * max / w, w = max) : (w = w * max / h, h = max); }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      currentLockPhoto = canvas.toDataURL('image/jpeg', 0.75);
      const preview = document.getElementById('lock-photo-preview');
      if (preview) preview.innerHTML = `<div style="position:relative;display:inline-block;animation:fadeIn 0.2s ease;"><img src="${currentLockPhoto}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--green-primary);cursor:pointer;" onclick="viewPhoto('${currentLockPhoto}')"><button onclick="removeLockPhoto()" style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;background:var(--red);color:white;border:none;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button></div>`;
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}
function removeLockPhoto() {
  currentLockPhoto = null;
  ['lock-photo', 'lock-photo-camera'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  const preview = document.getElementById('lock-photo-preview');
  if (preview) preview.innerHTML = '';
}

// ===== NAVIGATION =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + id);
  if (!target) return console.warn(`Tela ${id} não encontrada`);
  target.classList.add('active');
  const backBtn = document.getElementById('backBtn');
  const mainHeader = document.getElementById('mainHeader');
  if (id === 'home') {
    screenHistory = [];
    backBtn.classList.remove('visible');
    if (mainHeader) mainHeader.style.display = 'none';
    updateStats();
  } else {
    if (!screenHistory.includes(id)) screenHistory.push(id);
    backBtn.classList.add('visible');
    if (mainHeader) mainHeader.style.display = 'flex';
  }
  const titleEl = document.getElementById('headerTitle');
  const titles = { category: 'Nova O.S.', form: 'Criar O.S.', clientes: 'Clientes', pesquisar: 'Pesquisar', 'client-detail': 'Detalhes do Cliente' };
  if (titleEl) { titleEl.textContent = titles[id] || ''; if (id === 'clientes') renderClients(); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function goBack() {
  screenHistory.pop();
  const prev = screenHistory.length > 0 ? screenHistory[screenHistory.length - 1] : 'home';
  showScreen(prev);
}

// ===== PHONE FORMAT =====
function formatPhone(v) {
  v = v.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 6) return `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
  if (v.length > 2) return `(${v.slice(0,2)}) ${v.slice(2)}`;
  return v.length > 0 ? `(${v}` : v;
}

// ===== STATS =====
function updateStats() {
  const orders = DB.getOS();
  const andamento = orders.filter(o => !['pronto','entregue'].includes(o.status)).length;
  const finalizados = orders.filter(o => ['pronto','entregue'].includes(o.status)).length;
  const bar = document.getElementById('statsBar');
  if (bar) {
    bar.innerHTML = `<div class="stat-chip"><span class="num">${orders.length}</span><span class="stat-label">Total</span></div> <div class="stat-chip"><span class="num">${andamento}</span><span class="stat-label">Em andamento</span></div> <div class="stat-chip"><span class="num">${finalizados}</span><span class="stat-label">Finalizados</span></div>`;
  }
  ['andamento', 'finalizados'].forEach(type => {
    const el = document.getElementById(`badge-${type}`);
    if (!el) return;
    const count = type === 'andamento' ? andamento : finalizados;
    el.style.display = count > 0 ? 'flex' : 'none';
    el.textContent = count;
  });
}

// ===== CHECKLIST =====
function getChecklistTemplate(category) {
  const base = ['Tela / Display','Câmera frontal','Câmera traseira','Botões / Teclado','Carregador / Bateria','Wi-Fi / Bluetooth','Alto-falante','Microfone'];
  if (category === 'celular') return [...base, 'Slot SIM/SD', 'Sensor de proximidade', 'Leitor digital'];
  if (category === 'notebook') return [...base, 'Trackpad', 'Portas USB', 'Leitor de cartão', 'Webcam'];
  if (category === 'impressora') return ['Cabeçote de impressão','Cartuchos / Toner','Bandeja de papel','Conexão USB/Wi-Fi','Display/Painel','Rolos de alimentação'];
  return base;
}
function renderChecklist(containerId, items, key, checked = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = items.map((item, i) => `<div class="checklist-item"><input type="checkbox" id="${key}-${i}" ${checked.includes(i) ? 'checked' : ''} onchange="updateChecklistItem('${key}', ${i}, this.checked)"><label for="${key}-${i}" style="cursor:pointer;flex:1">${item}</label></div>`).join('');
}
async function updateChecklistItem(type, index, value) {
  if (!currentOS) return;
  const key = type === 'entry' ? 'entryChecklist' : 'exitChecklist';
  if (!currentOS[key]) currentOS[key] = [];
  if (value) { if (!currentOS[key].includes(index)) currentOS[key].push(index); }
  else { currentOS[key] = currentOS[key].filter(i => i !== index); }
  await saveCurrentOS();
}

// ===== PHOTOS =====
function handlePhotos(event) {
  const files = event.target.files;
  if (!files) return;
  for (let f of files) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const max = 800; let w = img.width, h = img.height;
        if (w > max || h > max) { w > h ? (h = h * max / w, w = max) : (w = w * max / h, h = max); }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        tempPhotos.push(canvas.toDataURL('image/jpeg', 0.7));
        renderPhotoPreview();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(f);
  }
  event.target.value = '';
}
function renderPhotoPreview() {
  const container = document.getElementById('photo-preview');
  if (!container) return;
  container.innerHTML = tempPhotos.map((p, i) => `<div class="photo-thumb-wrap"><img class="photo-thumb" src="${p}" onclick="viewPhoto('${p}')"><button class="photo-remove" onclick="removePhoto(${i})">✕</button></div>`).join('');
}
function removePhoto(index) { tempPhotos.splice(index, 1); renderPhotoPreview(); }
function viewPhoto(src) { openModal(`<div class="modal-handle"></div><img src="${src}" style="width:100%;border-radius:8px;">`); }

// ===== CREATE OS =====
function startOS(category) {
  currentCategory = category;
  tempPhotos = []; currentLockPhoto = null;
  ['f-nome','f-telefone','f-modelo','f-defeito','f-senha','f-obs'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  const lock = document.getElementById('lock-type'); if(lock) lock.value = 'Numerica';
  ['lock-photo','lock-photo-camera'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  const preview = document.getElementById('lock-photo-preview'); if(preview) preview.innerHTML = '';
  const photoPrev = document.getElementById('photo-preview'); if(photoPrev) photoPrev.innerHTML = '';
  renderChecklist('entry-checklist', getChecklistTemplate(category), 'entry', []);
  showScreen('form');
}
function getCategoryLabel(cat) { return { celular: '📱 Celular', notebook: '💻 Notebook', impressora: '🖨️ Impressora' }[cat] || cat; }
function getCategoryIcon(cat) { return { celular: '📱', notebook: '💻', impressora: '🖨️' }[cat] || ''; }
async function saveOS() {
  const getVal = id => document.getElementById(id)?.value.trim() || '';
  const [nome, telefone, modelo, defeito, senha, obs, lockType] = ['f-nome','f-telefone','f-modelo','f-defeito','f-senha','f-obs','lock-type'].map(getVal);
  if (!nome || !telefone || !modelo || !defeito) return showToast('⚠️ Preencha todos os campos obrigatórios');
  const entryItems = getChecklistTemplate(currentCategory);
  const entryChecked = entryItems.map((_, i) => document.getElementById(`entry-${i}`)?.checked ? i : -1).filter(i => i !== -1);
  const num = await DB.incCounter();
  const osId = `OS-${String(num).padStart(4, '0')}`;
  const os = { id: osId, category: currentCategory, clientName: nome, phone: telefone, model: modelo, defect: defeito, observations: obs, password: senha, lockType, lockPhoto: currentLockPhoto, photos: tempPhotos, entryChecklist: entryChecked, exitChecklist: [], status: 'em_analise', timeline: [{ date: new Date().toISOString(), text: `O.S. criada — ${getCategoryLabel(currentCategory)}` }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await DB.addOS(os);
  await updateClientHistory(telefone, nome, osId);
  showToast(`✅ ${osId} criada com sucesso!`);
  showScreen('home');
}
async function updateClientHistory(phone, name, osId) {
  let clients = DB.getClients();
  let client = clients.find(c => c.phone === phone);
  if (client) {
    if (!client.history.includes(osId)) client.history.push(osId);
    client.name = name;
  } else {
    client = { name, phone, history: [osId] };
  }
  await DB.saveClient(client);
}

// ===== LISTS =====
function showList(filter) { 
  currentListFilter = (filter === 'andamento' || filter === 'pendente') ? 'em_andamento' : filter; 
  renderList(); 
  showScreen('list'); 
}
function renderList() {
  const orders = DB.getOS();
  const searchTerm = (document.getElementById('list-search')?.value || '').toLowerCase();
  const finishedStatuses = ['pronto', 'entregue'];
  const isFinishedList = ['finalizados', 'finalizado', 'prontos', 'entregues'].includes(currentListFilter?.toLowerCase());
  
  let filtered = isFinishedList
    ? orders.filter(o => finishedStatuses.includes(o?.status))
    : orders.filter(o => !finishedStatuses.includes(o?.status));

  if (searchTerm) filtered = filtered.filter(o => (o.clientName||'').toLowerCase().includes(searchTerm) || (o.phone||'').includes(searchTerm) || (o.id||'').toLowerCase().includes(searchTerm) || (o.model||'').toLowerCase().includes(searchTerm));

  const container = document.getElementById('os-list'); if (!container) return;
  if (filtered.length === 0) { container.innerHTML = `<div class="empty-state"><div class="icon">${isFinishedList ? '✅' : '🔧'}</div><p>${searchTerm ? 'Nenhum resultado encontrado' : 'Nenhuma O.S. nesta categoria'}</p></div>`; return; }
  
  container.innerHTML = filtered.map(os => {
    const defect = os.defect || '';
    const statusSafe = os.status || '';
    return `<div class="os-card" onclick="openDetail('${os.id || ''}')">
      <div class="os-card-header"><span class="os-card-id">${os.id || ''}</span><span class="os-card-status status-${statusSafe.replace(/ /g, '_')}">${getStatusLabel(statusSafe)}</span></div>
      <div class="os-card-name">${os.clientName || ''}</div>
      <div class="os-card-info">${os.model || ''} — ${defect.substring(0, 45)}${defect.length > 45 ? '...' : ''}</div>
      <div class="os-card-footer"><span class="os-card-date">${formatDate(os.createdAt)}</span><span class="os-card-category">${getCategoryIcon(os.category)} ${(getCategoryLabel(os.category) || '').replace(/^.+\s/, '')}</span></div>
    </div>`;
  }).join('');
}
function filterList() { renderList(); }
function getStatusLabel(status) { return { 'em_analise': 'Em análise', 'aguardando_peca': 'Aguardando peça', 'em_reparo': 'Em reparo', 'pronto': 'Pronto', 'entregue': 'Entregue' }[status] || status; }
function formatDate(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month: '2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''; }
function formatDateShort(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) : ''; }

// ===== DETAIL =====
function openDetail(osId) { currentOS = DB.getOS().find(o => o.id === osId); if (currentOS) { renderDetail(); showScreen('detail'); } }
function renderDetail() {
  const os = currentOS; const container = document.getElementById('detail-content');
  if (!os) return;
  const statuses = [{ key: 'em_analise', label: 'Em análise', color: 'var(--blue)' }, { key: 'aguardando_peca', label: 'Aguardando peça', color: 'var(--yellow)' }, { key: 'em_reparo', label: 'Em reparo', color: 'var(--orange)' }, { key: 'pronto', label: 'Pronto', color: 'var(--green)' }, { key: 'entregue', label: 'Entregue', color: 'var(--text3)' }];
  const clients = DB.getClients(); const client = clients.find(c => c.phone === os.phone);
  let html = `<div class="detail-header"><div class="detail-header-top"><div class="detail-os-id">${os.id}</div><span class="os-card-status status-${(os.status||'').replace(/ /g, '_')}">${getStatusLabel(os.status)}</span></div><div class="detail-client">${os.clientName} ${os.password ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#fbbf24;background:rgba(251,191,36,0.1);padding:2px 8px;border-radius:100px;">🔒 ${os.password}</span>` : ''}</div><div style="font-size:13px;color:var(--text2);margin-top:4px;">📞 ${os.phone}</div><div style="font-size:13px;color:var(--text2);margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">📦 ${getCategoryIcon(os.category)} ${os.model}</div><div style="font-size:13px;color:var(--text2);margin-top:4px;">${os.defect || ''}</div>${os.observations ? `<div style="font-size:13px;color:var(--text3);margin-top:4px;">📝 ${os.observations}</div>` : ''}</div>`;
  html += `<div class="form-section"><div class="form-section-title">Alterar Status</div><div class="status-selector">${statuses.map(s => `<div class="status-option ${os.status === s.key ? 'selected' : ''}" onclick="changeStatus('${s.key}')"><span class="dot" style="background:${s.color}"></span>${s.label}</div>`).join('')}</div></div>`;
  html += `<div class="checklist-section"><div class="checklist-title">📋 Checklist de Entrada</div>${renderChecklistHTML('entry', getChecklistTemplate(os.category), os.entryChecklist || [], true)}</div><div class="checklist-section"><div class="checklist-title">✅ Checklist de Saída</div>${renderChecklistHTML('exit', getChecklistTemplate(os.category), os.exitChecklist || [], false)}</div>`;
  if (os.lockPhoto) html += `<div class="form-section"><div class="form-section-title">🔒 Senha/Padrão</div><div style="margin-top:8px;box-shadow:none;border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.03);border-radius:var(--radius);padding:12px;"><span style="font-size:12px;color:var(--text2)">Tipo: <strong style="color:var(--text)">${os.lockType}</strong></span> ${os.password ? `<span style="font-size:12px;color:var(--text2);margin-left:10px;">Senha: <strong style="color:var(--yellow)">${os.password}</strong></span>` : ''}<br><img src="${os.lockPhoto}" style="width:100%;max-width:280px;height:auto;border-radius:8px;border:1px solid var(--border);cursor:pointer;margin-top:8px;" onclick="viewPhoto('${os.lockPhoto}')"><p style="font-size:10px;color:var(--text3);margin-top:6px;">Toque para ampliar</p></div></div>`;
  if (os.photos?.length > 0) html += `<div class="form-section"><div class="form-section-title">📷 Fotos (${os.photos.length})</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">${os.photos.map(p => `<img src="${p}" style="width:90px;height:90px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer;" onclick="viewPhoto('${p}')">`).join('')}</div><div class="premium-upload" onclick="addPhotoToOS()" style="margin-top:8px"><div class="icon">➕</div><p>Adicionar mais fotos</p></div></div>`;
  html += `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:20px;"><div class="form-section-title" style="margin-bottom:8px;">📝 Observações</div>${(os.timeline||[]).map(t => `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--text2);"><div style="font-size:10px;color:var(--text3);margin-bottom:3px;">${formatDate(t.date)}</div><div>${t.text || ''}</div></div>`).join('')}<div style="display:flex;gap:8px;margin-top:10px;"><input type="text" id="obs-input" placeholder="Adicionar nota..." style="flex:1;background:var(--surface3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;color:var(--text);font-size:13px;outline:none;"><button onclick="addObservation()" style="background:var(--green-primary);color:#000;border:none;border-radius:var(--radius-sm);padding:10px 14px;font-weight:800;cursor:pointer;">+</button></div></div>`;
  if (client?.history.length > 1) {
    const otherOS = client.history.filter(h => h !== os.id);
    html += `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:20px;"><div class="form-section-title" style="margin-bottom:8px;">📂 Histórico (${client.history.length})</div>${otherOS.map(hId => { const h = DB.getOS().find(o => o.id === hId); return h ? `<div onclick="openDetail('${h.id}')" style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;cursor:pointer;"><div><div style="font-size:12px;font-weight:800;color:var(--green-light);">${h.id}</div><div style="font-size:11px;color:var(--text3);">${h.model} — ${formatDateShort(h.createdAt)}</div></div><span class="os-card-status status-${(h.status||'').replace(/ /g, '_')}">${getStatusLabel(h.status)}</span></div>` : ''; }).join('')}</div>`;
  }
  html += `<div class="detail-actions">${os.status !== 'entregue' ? `<button class="btn btn-success" onclick="markDelivered()">📦 Entregue</button>` : ''}<button class="btn btn-secondary" onclick="openClientFromOS()">Ver Cliente</button></div><button class="btn btn-ghost" onclick="printOS()" style="color:var(--text2)">🖨️ Imprimir</button><button class="btn btn-ghost" onclick="shareWhatsApp()" style="color:var(--green)">💬 WhatsApp</button><button class="btn btn-ghost" onclick="deleteOS()" style="color:var(--red)">🗑️ Excluir</button>`;
  container.innerHTML = html;
}
function renderChecklistHTML(key, items, checked, readonly) { return items.map((item, i) => `<div class="checklist-item"><input type="checkbox" ${checked.includes(i) ? 'checked' : ''} ${readonly ? 'disabled' : `onchange="updateChecklistItem('${key}', ${i}, this.checked)"`}><label style="cursor:${readonly ? 'default' : 'pointer'};flex:1">${item}</label></div>`).join(''); }
async function changeStatus(newStatus) {
  if (!currentOS) return;
  const old = currentOS.status; currentOS.status = newStatus; currentOS.updatedAt = new Date().toISOString();
  currentOS.timeline.push({ date: new Date().toISOString(), text: `Status: ${getStatusLabel(old)} → ${getStatusLabel(newStatus)}` });
  await saveCurrentOS(); renderDetail(); showToast(`✅ ${getStatusLabel(newStatus)}`);
}
async function addObservation() {
  const input = document.getElementById('obs-input'); const text = input?.value.trim();
  if (!text || !currentOS) return;
  currentOS.timeline.push({ date: new Date().toISOString(), text: `Nota: ${text}` }); currentOS.updatedAt = new Date().toISOString();
  await saveCurrentOS(); renderDetail(); showToast('📝 Adicionada'); input.value = '';
}
function addPhotoToOS() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/'; input.multiple = true;
  input.onchange = function(e) {
    for (let f of e.target.files) {
      const reader = new FileReader();
      reader.onload = function(ev) {
        const img = new Image();
        img.onload = async function() {
          const c = document.createElement('canvas'); const max = 800; let w = img.width, h = img.height;
          if(w>max||h>max){w>h?(h=h*max/w,w=max):(w=w*max/h,h=max);}
          c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
          currentOS.photos.push(c.toDataURL('image/jpeg',0.7));
          await saveCurrentOS(); renderDetail(); showToast('📷 Adicionada');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(f);
    }
  };
  input.click();
}
async function markDelivered() {
  if(!currentOS) return;
  currentOS.status='entregue'; currentOS.updatedAt=new Date().toISOString();
  currentOS.timeline.push({date:new Date().toISOString(),text:'Entregue ao cliente'});
  await saveCurrentOS(); renderDetail(); showToast('✅ Entregue');
}
function openClientFromOS() { if(currentOS) { currentClientPhone=currentOS.phone; showClientDetail(currentOS.phone); } }
async function saveCurrentOS() { if (!currentOS) return; await DB.updateOS(currentOS); }
async function deleteOS() {
  if(!currentOS||!confirm('Excluir esta O.S.?')) return;
  await DB.deleteOS(currentOS.id);
  let client = DB.getClients().find(c => c.history.includes(currentOS.id));
  if (client) { client.history = client.history.filter(h => h !== currentOS.id); await DB.saveClient(client); }
  showToast('🗑️ Excluída'); showScreen('home');
}
function shareWhatsApp() { if(!currentOS) return; const os=currentOS; const text=`*Cell City - O.S.*\n📋 ${os.id}\n👤 ${os.clientName}\n📱 ${os.model}\n🔧 ${os.defect}\nStatus: ${getStatusLabel(os.status)}\n📅 ${formatDate(os.createdAt)}`; window.open(`https://wa.me/${(os.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(text)}`, '_blank'); }
function printOS() { if(!currentOS) return; const os=currentOS; const w=window.open('','_blank'); w.document.write(`<!DOCTYPE html><html><head><title>${os.id}</title><style>body{font-family:monospace;padding:20px;max-width:400px;margin:0 auto}h1{text-align:center;font-size:16px;border-bottom:2px solid #000;padding-bottom:8px}.row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}.label{font-weight:bold}.section{margin-top:12px;border-top:1px dashed #ccc;padding-top:6px}.footer{text-align:center;margin-top:20px;font-size:10px}</style></head><body><h1>Cell City Informática</h1><div class="row"><span class="label">O.S.:</span><span>${os.id}</span></div><div class="row"><span class="label">Data:</span><span>${formatDate(os.createdAt)}</span></div><div class="section"><div class="row"><span class="label">Cliente:</span><span>${os.clientName}</span></div><div class="row"><span class="label">Telefone:</span><span>${os.phone}</span></div><div class="row"><span class="label">Aparelho:</span><span>${os.model}</span></div><div class="row"><span class="label">Defeito:</span><span>${os.defect||''}</span></div>${os.lockType?`<div class="row"><span class="label">Bloqueio:</span><span>${os.lockType}</span></div>`:''}${os.password?`<div class="row"><span class="label">Senha:</span><span>${os.password}</span></div>`:''}${os.observations?`<div class="row"><span class="label">Obs:</span><span>${os.observations}</span></div>`:''}</div><div class="section"><div class="row"><span class="label">Status:</span><span>${getStatusLabel(os.status)}</span></div></div><div class="footer"><p>Cell City Informática</p><p>__________________________</p><p>Assinatura</p></div></body></html>`); w.document.close(); w.print(); }

// ===== CLIENTS =====
function renderClients() {
  const clients = DB.getClients(); const searchTerm = (document.getElementById('client-search')?.value || '').toLowerCase();
  const filtered = searchTerm ? clients.filter(c => (c.name||'').toLowerCase().includes(searchTerm) || (c.phone||'').includes(searchTerm)) : clients;
  const container = document.getElementById('client-list'); if (!container) return;
  if (filtered.length === 0) { container.innerHTML = `<div class="empty-state"><div class="icon">👥</div><p>${searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</p></div>`; return; }
  container.innerHTML = filtered.map(c => `<div class="client-card" onclick="showClientDetail('${c.phone}')"><div class="client-card-name">${c.name||''}</div><div class="client-card-phone">📞 ${c.phone||''}</div><div class="client-card-count">${(c.history||[]).length} O.S.</div></div>`).join('');
}
function searchClients() { renderClients(); }
function showClientDetail(phone) {
  const client = DB.getClients().find(c => c.phone === phone); if (!client) return;
  currentClientPhone = phone; const orders = DB.getOS(); const container = document.getElementById('client-detail-content');
  const clientOrders = (client.history||[]).map(id => orders.find(o => o.id === id)).filter(Boolean).reverse();
  let html = `<div class="detail-header"><div class="detail-client" style="font-size:18px;">${client.name||''}</div><div style="font-size:13px;color:var(--text2);margin-top:4px;">📞 ${client.phone||''}</div><div style="margin-top:6px;font-size:12px;color:var(--accent2);">${(client.history||[]).length} O.S.</div></div>`;
  html += `<div class="premium-list" style="margin-top:16px;">${clientOrders.map(os => `<div class="os-card" onclick="openDetail('${os.id}')"><div class="os-card-header"><span class="os-card-id">${os.id}</span><span class="os-card-status status-${(os.status||'').replace(/ /g, '_')}">${getStatusLabel(os.status||'')}</span></div><div class="os-card-name">${os.model||''}</div><div class="os-card-info">${(os.defect||'').substring(0, 50)}${(os.defect||'').length >50?'...':''}</div><div class="os-card-footer"><span class="os-card-date">${formatDate(os.createdAt)}</span><span class="os-card-category">${getCategoryIcon(os.category)}</span></div></div>`).join('')}</div>`;
  html += `<div style="margin-top:16px;"><button class="btn btn-success premium-btn" onclick="startOSForClient('${client.phone||''}','${client.name||''}')">➕ Nova O.S. para este cliente</button></div>`;
  container.innerHTML = html; showScreen('client-detail');
}
function startOSForClient(phone, name) { startOS(DB.getOS().filter(o => o.phone===phone)[0]?.category||'celular'); document.getElementById('f-nome').value=name||''; document.getElementById('f-telefone').value=phone||''; }

// ===== GLOBAL SEARCH =====
function globalSearch() {
  const term = (document.getElementById('global-search')?.value || '').trim().toLowerCase(); const container = document.getElementById('search-results'); if (!container) return;
  if (term.length < 2) { container.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><p>Digite pelo menos 2 caracteres</p></div>`; return; }
  const orders = DB.getOS().filter(o => (o.clientName||'').toLowerCase().includes(term) || (o.phone||'').includes(term) || (o.id||'').toLowerCase().includes(term) || (o.model||'').toLowerCase().includes(term));
  const clients = DB.getClients().filter(c => (c.name||'').toLowerCase().includes(term) || (c.phone||'').includes(term));
  let html = '';
  if (clients.length > 0) html += `<div class="form-section"><div class="form-section-title">Clientes</div>${clients.map(c => `<div class="client-card" onclick="showClientDetail('${c.phone}')"><div class="client-card-name">${c.name||''}</div><div class="client-card-phone">📞 ${c.phone||''}</div></div>`).join('')}</div>`;
  if (orders.length > 0) html += `<div class="form-section"><div class="form-section-title">Ordens</div><div class="premium-list">${orders.map(os => `<div class="os-card" onclick="openDetail('${os.id}')"><div class="os-card-header"><span class="os-card-id">${os.id}</span><span class="os-card-status status-${(os.status||'').replace(/ /g, '_')}">${getStatusLabel(os.status||'')}</span></div><div class="os-card-name">${os.clientName||''}</div><div class="os-card-info">${os.model||''}</div></div>`).join('')}</div></div>`;
  container.innerHTML = html || `<div class="empty-state"><div class="icon">🔍</div><p>Nenhum resultado</p></div>`;
}

// ===== MODAL & TOAST =====
function openModal(content) { document.getElementById('modal-content').innerHTML = content; document.getElementById('modal-overlay').classList.add('active'); }
function closeModal(event) { if (event.target === document.getElementById('modal-overlay')) document.getElementById('modal-overlay').classList.remove('active'); }
function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }
function openGlobalSearch() { showScreen('pesquisar'); setTimeout(() => document.getElementById('global-search')?.focus(), 150); }

// ===== INITIALIZATION =====
async function init() {
  if (appInitialized) return;
  appInitialized = true;
  const headers = document.querySelectorAll('.header');
  if (headers.length > 1) { for (let i = 1; i < headers.length; i++) headers[i].remove(); }
  const phoneInput = document.getElementById('f-telefone');
  if (phoneInput) phoneInput.addEventListener('input', e => e.target.value = formatPhone(e.target.value));
  await DB.loadFromFirestore();
  updateStats();
  showScreen('home');
  console.log('✅ Cell City OS inicializado. Conectado ao Firestore.');
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}