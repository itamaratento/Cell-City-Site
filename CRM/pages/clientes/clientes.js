/**
 * Clientes — lista com busca por nome/telefone; abre ficha unificada na OS.
 */
import { initModulo } from '../../scripts/kernel.js';
import { carregarPermissoes, podeVisualizar } from '../../shared/permissoes.js';
import { ClientesRepository } from '../../repositories/clientes.repository.js';
import { escHtml as esc } from '../../shared/sanitize.js';
import { normalizePhoneDigits } from '../../shared/phone-utils.js';
import {
  filtrarClientesPorBusca,
  ordenarClientesPorNome,
  urlFichaCliente,
} from './clientes-lista.js';

let clientes = [];

function toast(msg) {
  const el = document.getElementById('cli-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

function render() {
  const termo = document.getElementById('cli-search')?.value || '';
  const lista = ordenarClientesPorNome(
    filtrarClientesPorBusca(clientes, termo, normalizePhoneDigits)
  );
  const box = document.getElementById('cli-lista');
  const empty = document.getElementById('cli-empty');
  const loading = document.getElementById('cli-loading');
  if (loading) loading.style.display = 'none';
  if (!box) return;

  if (!lista.length) {
    box.innerHTML = '';
    if (empty) {
      empty.style.display = 'block';
      const sub = empty.querySelector('.cli-empty-sub');
      if (sub) {
        sub.textContent = termo
          ? 'Nenhum cliente com esse nome ou telefone.'
          : 'Clientes são criados/atualizados automaticamente pela OS (sem duplicar telefone).';
      }
    }
    return;
  }
  if (empty) empty.style.display = 'none';

  box.innerHTML = lista.map(c => {
    const nome = esc(c.name || c.nome || 'Sem nome');
    const phone = esc(c.phone || '');
    const digits = c.phoneDigits || normalizePhoneDigits(c.phone || '');
    const qtd = Array.isArray(c.history) ? c.history.length : 0;
    const href = esc(urlFichaCliente(digits || c.phone, normalizePhoneDigits));
    return `<a class="cli-card" href="${href}">
      <div class="cli-card-name">${nome}</div>
      <div class="cli-card-phone">📞 ${phone || '—'}</div>
      <div class="cli-card-meta">${qtd} O.S. · abrir ficha</div>
    </a>`;
  }).join('');
}

async function carregar() {
  try {
    const lista = await ClientesRepository.list();
    clientes = Array.isArray(lista) ? lista : [];
  } catch (e) {
    console.warn('[Clientes] falha ao listar:', e);
    clientes = [];
    toast('Não foi possível carregar clientes.');
  }
  render();
}

async function init() {
  const ctx = await initModulo();
  if (!ctx) return;
  await carregarPermissoes(ctx);
  // Mesma barreira da ficha (módulo OS); sem permissão → dashboard.
  if (!podeVisualizar('os')) {
    const prefix = (location.pathname === '/dev' || location.pathname.startsWith('/dev/')) ? '/dev' : '';
    window.location.href = prefix + '/CRM/pages/dashboard/index.html';
    return;
  }
  document.getElementById('cli-search')?.addEventListener('input', render);
  await carregar();
}

init();
