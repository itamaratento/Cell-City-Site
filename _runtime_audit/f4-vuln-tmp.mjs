// Teste ISOLADO: um único write. Usuário comum eleva o PRÓPRIO perfil?
const API_KEY = 'AIzaSyBq7Qq34lXXfFjvWUE8xFWBCboTHc2HAlQ';
const login = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ email: 'cellcityestoque@gmail.com', password: 'CellCity#Dev2026', returnSecureToken: true })
}).then(r => r.json());
const { idToken, localId } = login;

const antes = await fetch(`https://firestore.googleapis.com/v1/projects/cellcity-crm-dev/databases/(default)/documents/usuarios/${localId}`, { headers: { 'Authorization': `Bearer ${idToken}` }}).then(r=>r.json());
console.log('perfil ANTES:', antes.fields.perfil.stringValue);

const r = await fetch(`https://firestore.googleapis.com/v1/projects/cellcity-crm-dev/databases/(default)/documents/usuarios/${localId}?updateMask.fieldPaths=perfil`, {
  method: 'PATCH', headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: { perfil: { stringValue: 'master_admin' } } })
});
console.log('Write do próprio perfil -> master_admin:', r.status, r.status === 200 ? '❌ PERMITIDO (vulnerabilidade)' : '✅ bloqueado');

const depois = await fetch(`https://firestore.googleapis.com/v1/projects/cellcity-crm-dev/databases/(default)/documents/usuarios/${localId}`, { headers: { 'Authorization': `Bearer ${idToken}` }}).then(r=>r.json());
console.log('perfil DEPOIS:', depois.fields.perfil.stringValue);
