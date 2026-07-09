/* ============================================
CELL CITY CRM — DASHBOARD — BUSCA GLOBAL
Etapa 8 da refatoração modular: índice de busca (OS, clientes, produtos) e
renderização dos resultados.
Mixin aplicado em Dashboard.prototype (ver dashboard.js) — mesmo `this` de sempre.
============================================ */
import { db, collection, getDocs } from "../../scripts/firebase.js";

export const dashboardBuscaMixin = {
  setupGlobalSearch() {
    const input = document.getElementById('global-search-input');
    const resultsBox = document.getElementById('search-results');
    if (!input || !resultsBox) return;
    let timeout;

    this._searchIndex = null;       // cache de OS/clientes/produtos (Firestore)
    this._searchLoadedAt = 0;
    this._searchLoading = null;
    this._searchActiveIdx = -1;     // item destacado p/ navegação por teclado

    const run = () => {
      const term = input.value.trim().toLowerCase();
      if (term.length < 2) { resultsBox.classList.remove('visible'); return; }
      this.performSearch(term, resultsBox);
    };

    input.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(run, 200);
    });

    input.addEventListener('focus', () => {
      this._loadSearchIndex();                       // carrega/atualiza índice em background
      if (input.value.trim().length >= 2) run();
    });

    // Navegação por teclado nos resultados (↑ ↓ Enter). Esc já é tratado em setupKeyboardShortcuts.
    input.addEventListener('keydown', (e) => {
      const items = Array.from(resultsBox.querySelectorAll('.search-item'));
      if (!resultsBox.classList.contains('visible') || items.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._searchActiveIdx = Math.min(this._searchActiveIdx + 1, items.length - 1);
        this._highlightSearch(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._searchActiveIdx = Math.max(this._searchActiveIdx - 1, 0);
        this._highlightSearch(items);
      } else if (e.key === 'Enter') {
        const el = items[this._searchActiveIdx] || items[0];
        if (el) { e.preventDefault(); el.click(); }
      }
    });
  },

  _highlightSearch(items) {
    items.forEach((el, i) => {
      el.style.background = (i === this._searchActiveIdx) ? 'rgba(0,200,83,0.12)' : '';
    });
    const active = items[this._searchActiveIdx];
    if (active) active.scrollIntoView({ block: 'nearest' });
  },

  // Carrega (e cacheia por 60s) os dados reais do Firestore para a busca global.
  async _loadSearchIndex(force = false) {
    if (!force && this._searchIndex && (Date.now() - this._searchLoadedAt) < 60000) return this._searchIndex;
    if (this._searchLoading) return this._searchLoading;

    this._searchLoading = (async () => {
      const idx = { os: [], clientes: [], produtos: [] };

      // ----- OS (abre a OS exata via deep-link #os-<id>) -----
      try {
        const snap = await getDocs(collection(db, 'os'));
        snap.forEach(d => {
          const o = { ...d.data() };
          const id = o.id || d.id;
          const aparelho = [o.brand, o.model].filter(Boolean).join(' ') || 'Aparelho';
          idx.os.push({
            id: String(id),
            title: `${o.clientName || 'Cliente'} — ${aparelho}`,
            sub: `#${id}${o.defect ? ' · ' + o.defect : ''}`,
            search: `${id} ${o.clientName || ''} ${o.phone || ''} ${o.brand || ''} ${o.model || ''} ${o.defect || ''} ${o.imei || ''} ${o.imei1 || ''} ${o.imei2 || ''}`.toLowerCase(),
            url: `../../pages/os/index.html#os-${encodeURIComponent(id)}`
          });
        });
      } catch (e) { console.warn('[Busca] OS:', e); }

      // ----- Clientes (abre a tela de Clientes do módulo OS) -----
      try {
        const snap = await getDocs(collection(db, 'clientes'));
        snap.forEach(d => {
          const c = { ...d.data() };
          const phone = c.phone || d.id;
          const nOS = Array.isArray(c.history) ? ` · ${c.history.length} OS` : '';
          idx.clientes.push({
            id: String(phone),
            title: c.name || c.nome || 'Cliente',
            sub: `📞 ${phone}${nOS}`,
            search: `${c.name || c.nome || ''} ${phone}`.toLowerCase(),
            url: `../../pages/os/index.html#fav-clientes`
          });
        });
      } catch (e) { console.warn('[Busca] Clientes:', e); }

      // ----- Produtos (coleção dedicada + fallback) -----
      try {
        let snap = await getDocs(collection(db, 'estoque_produtos'));
        if (snap.empty) snap = await getDocs(collection(db, 'produtos'));
        snap.forEach(d => {
          const p = { ...d.data() };
          const nome = p.nome || p.description || '—';
          const qtd = (p.quantidade != null) ? ` · ${p.quantidade} un` : '';
          const preco = p.venda ? ` · R$ ${Number(p.venda).toFixed(2)}` : '';
          idx.produtos.push({
            id: String(d.id),
            title: nome,
            sub: `${p.categoria || 'Produto'}${qtd}${preco}`,
            search: `${nome} ${p.categoria || ''}`.toLowerCase(),
            url: `../../pages/estoque/index.html`
          });
        });
      } catch (e) { console.warn('[Busca] Produtos:', e); }

      this._searchIndex = idx;
      this._searchLoadedAt = Date.now();
      this._searchLoading = null;

      // Se o usuário já digitou algo, re-renderiza com os dados frescos
      const input = document.getElementById('global-search-input');
      const rb = document.getElementById('search-results');
      if (input && rb && input.value.trim().length >= 2) {
        this.performSearch(input.value.trim().toLowerCase(), rb);
      }
      return idx;
    })();

    return this._searchLoading;
  },

  performSearch(term, resultsBox) {
    const idx = this._searchIndex;
    const filt = (arr) => (arr || []).filter(it => it.search.includes(term)).slice(0, 6);

    // Índice ainda não carregado — dispara carga e mostra feedback
    if (!idx) {
      this._loadSearchIndex();
      resultsBox.innerHTML = `<div class="search-empty">Carregando dados…</div>`;
      resultsBox.classList.add('visible');
      return;
    }

    const groups = [];
    const osR = filt(idx.os);       if (osR.length) groups.push({ title: 'Ordens de Serviço', icon: '📦', items: osR });
    const clR = filt(idx.clientes); if (clR.length) groups.push({ title: 'Clientes', icon: '👥', items: clR });
    const prR = filt(idx.produtos); if (prR.length) groups.push({ title: 'Produtos / Estoque', icon: '📦', items: prR });

    // Módulos (lista estática já existente em state.searchData.modulos)
    const modR = (this.state.searchData.modulos || [])
      .filter(m => m.title.toLowerCase().includes(term) || m.id.toLowerCase().includes(term))
      .slice(0, 5)
      .map(m => ({ id: m.id, title: m.title, sub: 'Módulo', module: m.id }));
    if (modR.length) groups.push({ title: 'Módulos', icon: '🧩', items: modR });

    this._searchActiveIdx = -1;

    if (groups.length === 0) {
      resultsBox.innerHTML = `<div class="search-empty">Nenhum resultado para "<strong>${this.escapeHtml(term)}</strong>"</div>`;
    } else {
      resultsBox.innerHTML = groups.map(group => `
        <div class="search-group">
          <div class="search-group-title">${group.icon} ${group.title}</div>
          ${group.items.map(item => `
            <div class="search-item" ${item.url ? `data-url="${this.escapeHtml(item.url)}"` : `data-module="${this.escapeHtml(item.module || '')}"`}>
              <div class="search-item-text">
                <div class="search-item-title">${this.escapeHtml(item.title)}</div>
                <div class="search-item-sub">${this.escapeHtml(item.sub || '')}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('');

      resultsBox.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', () => {
          const url = item.getAttribute('data-url');
          const module = item.getAttribute('data-module');
          document.getElementById('global-search-input').value = '';
          resultsBox.classList.remove('visible');
          if (url) window.location.href = url;
          else if (module) this.navigateTo(module);
        });
      });
    }
    resultsBox.classList.add('visible');
  }
};
