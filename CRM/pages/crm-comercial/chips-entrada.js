import {
  db, collection, addDoc, serverTimestamp
} from '../../scripts/firebase.js';

// ── Operadoras ────────────────────────────────────────────────
const OPERADORAS = [
  { key: 'TIM',    icon: '🔵', color: '#60a5fa', rgb: '96,165,250'   },
  { key: 'Vivo',   icon: '🟣', color: '#c4b5fd', rgb: '196,181,253'  },
  { key: 'Claro',  icon: '🔴', color: '#fca5a5', rgb: '252,165,165'  },
  { key: 'Oi',     icon: '🟡', color: '#fcd34d', rgb: '252,211,77'   },
  { key: 'Nextel', icon: '🟢', color: '#5eead4', rgb: '94,234,212'   },
  { key: 'Outra',  icon: '⚪', color: '#9ca3af', rgb: '156,163,175'  }
];

// ── Status ────────────────────────────────────────────────────
const CHIP_STATUS = [
  { key: 'novo_cadastro',        label: 'Novo Cadastro',        icon: '🆕', color: '#60a5fa', rgb: '96,165,250'  },
  { key: 'dados_coletados',      label: 'Dados Coletados',      icon: '📋', color: '#c4b5fd', rgb: '196,181,253' },
  { key: 'aguardando_ativacao',  label: 'Aguardando Ativação',  icon: '⏳', color: '#fbbf24', rgb: '251,191,36'  },
  { key: 'ativado',              label: 'Ativado',              icon: '✅', color: '#00c853', rgb: '0,200,83'    },
  { key: 'erro_cadastro',        label: 'Erro no Cadastro',     icon: '❌', color: '#f87171', rgb: '248,113,113' },
  { key: 'cliente_nao_retornou', label: 'Não retornou',         icon: '🔕', color: '#fb923c', rgb: '251,146,60'  },
  { key: 'finalizado',           label: 'Finalizado',           icon: '🏁', color: '#9ca3af', rgb: '156,163,175' }
];

// ── Estado ────────────────────────────────────────────────────
let operadoraSelecionada = '';
let statusSelecionado    = 'novo_cadastro';

// ── Render chips de operadora ─────────────────────────────────
function renderOperadoras() {
  const grid = document.getElementById('oper-grid');
  if (!grid) return;
  grid.innerHTML = OPERADORAS.map(op => `
    <div class="ent-chip ${operadoraSelecionada === op.key ? 'selected' : ''}"
         style="--chip-color:${op.color};--chip-rgb:${op.rgb}"
         onclick="selecionarOper('${op.key}')">
      <span class="ent-chip-icon">${op.icon}</span>
      ${op.key}
    </div>`).join('');
}

window.selecionarOper = function(key) {
  operadoraSelecionada = key;
  renderOperadoras();
};

// ── Render chips de status ────────────────────────────────────
function renderStatus() {
  const grid = document.getElementById('status-grid');
  if (!grid) return;
  grid.innerHTML = CHIP_STATUS.map(s => `
    <div class="ent-chip ${statusSelecionado === s.key ? 'selected' : ''}"
         style="--chip-color:${s.color};--chip-rgb:${s.rgb}"
         onclick="selecionarStatus('${s.key}')">
      <span class="ent-chip-icon">${s.icon}</span>
      ${s.label}
    </div>`).join('');
}

window.selecionarStatus = function(key) {
  statusSelecionado = key;
  renderStatus();
};

// ── Formatação CPF ────────────────────────────────────────────
window.formatarCPF = function(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 11);
  if (v.length > 9)      v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  input.value = v;

  const fb = document.getElementById('cpf-feedback');
  if (!fb) return;
  const d = v.replace(/\D/g, '');
  if (d.length === 11) {
    const ok = validarCPF(d);
    fb.textContent = ok ? '✅ CPF válido' : '❌ CPF inválido';
    fb.className   = 'cpf-feedback ' + (ok ? 'cpf-ok' : 'cpf-erro');
  } else {
    fb.textContent = ''; fb.className = 'cpf-feedback';
  }
};

function validarCPF(d) {
  if (/^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let r = (s * 10) % 11; if (r >= 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  r = (s * 10) % 11; if (r >= 10) r = 0;
  return r === parseInt(d[10]);
}

// ── Formatação data DD/MM/AAAA ────────────────────────────────
window.formatarData = function(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 8);
  if (v.length > 4)      v = v.replace(/(\d{2})(\d{2})(\d{1,4})/, '$1/$2/$3');
  else if (v.length > 2) v = v.replace(/(\d{2})(\d{1,2})/, '$1/$2');
  input.value = v;
};

// ── Mais informações ──────────────────────────────────────────
window.toggleMais = function() {
  const content = document.getElementById('mais-content');
  const btn     = document.getElementById('mais-btn');
  if (!content || !btn) return;
  const open = content.style.display !== 'none';
  content.style.display = open ? 'none' : 'block';
  btn.textContent       = open ? '＋ Observações' : '－ Observações';
  btn.classList.toggle('open', !open);
};

// ── Toast ─────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('ent-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Salvar chip ───────────────────────────────────────────────
window.salvarChip = async function(e) {
  e.preventDefault();

  if (!operadoraSelecionada) {
    showToast('⚠️ Selecione a operadora');
    document.getElementById('oper-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const nome = (document.getElementById('f-nome')?.value || '').trim();
  if (!nome) { showToast('⚠️ Nome é obrigatório'); document.getElementById('f-nome')?.focus(); return; }

  const cpfInput = document.getElementById('f-cpf');
  const cpfRaw   = (cpfInput?.value || '').replace(/\D/g, '');
  if (cpfRaw && cpfRaw.length === 11 && !validarCPF(cpfRaw)) {
    showToast('❌ CPF inválido');
    cpfInput?.focus();
    return;
  }

  const nasc = (document.getElementById('f-nascimento')?.value || '').trim();
  if (!nasc) { showToast('⚠️ Data de nascimento é obrigatória'); document.getElementById('f-nascimento')?.focus(); return; }

  const btn = document.getElementById('btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }

  try {
    await addDoc(collection(db, 'chips_cadastros'), {
      operadora:      operadoraSelecionada,
      nome,
      cpf:            cpfInput?.value || '',
      estadoCpf:      document.getElementById('f-estado')?.value   || '',
      dataNascimento: nasc,
      telefone:       (document.getElementById('f-telefone')?.value || '').trim(),
      numeroGerado:   (document.getElementById('f-numero')?.value   || '').trim(),
      obs:            (document.getElementById('f-obs')?.value      || '').trim(),
      status:         statusSelecionado,
      historico:      [{ acao: 'Criado', data: new Date().toISOString() }],
      criadoEm:       serverTimestamp(),
      atualizadoEm:   serverTimestamp()
    });

    sessionStorage.setItem('chips_msg', '✅ Chip cadastrado com sucesso');
    window.location.href = 'chips.html';
  } catch(err) {
    console.error(err);
    showToast('❌ Erro ao salvar — tente novamente');
    if (btn) { btn.disabled = false; btn.textContent = 'Cadastrar Chip'; }
  }
};

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderOperadoras();
  renderStatus();
});
