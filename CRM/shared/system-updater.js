/**
 * SystemUpdater — Cell City CRM
 * Atualização inteligente: verificação de versão, auto-update seguro,
 * indicadores de conexão, sincronização e histórico de alterações.
 */

const LS_PREFS_KEY  = 'cc_updater_prefs';
const LS_LOCK_KEY   = 'cc_updater_lock';   // flag de atualização em andamento
const LOCK_TIMEOUT  = 30_000;              // 30s: tempo máximo para atualizar

const DEFAULT_PREFS = {
  autoCheck:    true,
  autoUpdate:   false,
  intervalMin:  15   // 15 | 30 | 60
};

function _getPrefs() {
  try {
    return Object.assign({}, DEFAULT_PREFS,
      JSON.parse(localStorage.getItem(LS_PREFS_KEY) || 'null'));
  } catch { return { ...DEFAULT_PREFS }; }
}

function _savePrefs(p) {
  try { localStorage.setItem(LS_PREFS_KEY, JSON.stringify(p)); } catch {}
}

function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────────────────────────────────────
export class SystemUpdater {

  constructor(callbacks = {}) {
    this.onVersionLoaded   = callbacks.onVersionLoaded   || null;
    this.onUpdateAvailable = callbacks.onUpdateAvailable || null;
    this.onOnlineStatus    = callbacks.onOnlineStatus    || null;
    this.onSyncUpdate      = callbacks.onSyncUpdate      || null;

    this._currentVersion = null;
    this._checkTimer     = null;
    this._isUpdating     = false;
    this._lastSync       = null;
  }

  // ── Inicialização ──────────────────────────────────────────────────────────
  async init() {
    // Proteção contra tela travada de sessão anterior
    SystemUpdater.clearStaleLock();

    this._currentVersion = await this._fetchVersion();
    if (this.onVersionLoaded) this.onVersionLoaded(this._currentVersion);
    this._startAutoCheck();
    this._setupOnlineOffline();
  }

  // ── Proteção contra travamento ────────────────────────────────────────────
  // Grava timestamp ao iniciar fullReload e limpa ao terminar.
  // Se na próxima inicialização o lock existir com mais de 30s → estava travado.
  static _setLock() {
    try { localStorage.setItem(LS_LOCK_KEY, String(Date.now())); } catch {}
  }
  static _clearLock() {
    try { localStorage.removeItem(LS_LOCK_KEY); } catch {}
  }
  static clearStaleLock() {
    try {
      const ts = parseInt(localStorage.getItem(LS_LOCK_KEY) || '0', 10);
      if (ts && (Date.now() - ts) > LOCK_TIMEOUT) {
        localStorage.removeItem(LS_LOCK_KEY);
        console.warn('[SystemUpdater] Lock de atualização travado detectado e limpo.');
        return true; // indica que havia um lock travado
      }
    } catch {}
    return false;
  }
  static hasStaleLock() {
    try {
      const ts = parseInt(localStorage.getItem(LS_LOCK_KEY) || '0', 10);
      return ts > 0 && (Date.now() - ts) > LOCK_TIMEOUT;
    } catch { return false; }
  }

  // ── Preferências ──────────────────────────────────────────────────────────
  getPrefs() { return _getPrefs(); }
  savePrefs(partial) {
    _savePrefs(Object.assign(_getPrefs(), partial));
    this._restartAutoCheck();
  }

  // ── Detecção de versão via sw.js ──────────────────────────────────────────
  async _fetchVersion() {
    try {
      const res = await fetch('/CRM/sw.js?_=' + Date.now(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      if (!res.ok) return null;
      const text = await res.text();
      const m = text.match(/const\s+CACHE\s*=\s*['"]([^'"]+)['"]/);
      return m ? m[1] : null;
    } catch { return null; }
  }

  formatVersion(raw) {
    if (!raw) return '–';
    // 'cellcity-crm-v13' → 'v13'
    return raw.replace(/^cellcity-crm-/, 'v');
  }

  getVersion()        { return this._currentVersion; }
  getVersionDisplay() { return this.formatVersion(this._currentVersion); }

  // ── Verificação automática ────────────────────────────────────────────────
  _startAutoCheck() {
    const prefs = _getPrefs();
    if (!prefs.autoCheck) return;
    const ms = (prefs.intervalMin || 15) * 60 * 1000;
    this._checkTimer = setInterval(() => this._doAutoCheck(), ms);
  }

  _restartAutoCheck() {
    if (this._checkTimer) { clearInterval(this._checkTimer); this._checkTimer = null; }
    this._startAutoCheck();
  }

  async _doAutoCheck() {
    const newVer = await this._fetchVersion();
    if (newVer && this._currentVersion && newVer !== this._currentVersion) {
      if (this.onUpdateAvailable) this.onUpdateAvailable(this._currentVersion, newVer);
      const prefs = _getPrefs();
      if (prefs.autoUpdate && this.isSafeToUpdate()) {
        await this.fullReload();
      }
    }
  }

  // ── Online / Offline ───────────────────────────────────────────────────────
  _setupOnlineOffline() {
    const notify = () => {
      if (this.onOnlineStatus) this.onOnlineStatus(navigator.onLine);
    };
    window.addEventListener('online',  notify);
    window.addEventListener('offline', notify);
    // Estado inicial
    notify();
  }

  // ── Sincronização ──────────────────────────────────────────────────────────
  recordSync() {
    this._lastSync = Date.now();
    if (this.onSyncUpdate) this.onSyncUpdate(this._lastSync);
  }
  getLastSync() { return this._lastSync; }

  // ── Segurança antes de atualizar ──────────────────────────────────────────
  isSafeToUpdate() {
    if (document.querySelector('[role="dialog"]:not([hidden])')) return false;
    if (document.querySelector('.modal-overlay:not([hidden]), .modal.open')) return false;
    if (document.querySelector('form.dirty, [data-dirty="true"], .unsaved-changes')) return false;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
        && active.value.length > 0
        && !['sys-update-overlay','sys-update-banner'].some(id => document.getElementById(id)?.contains(active))) {
      return false;
    }
    return true;
  }

  // ── Sincronização em segundo plano (NÃO BLOQUEANTE) ──────────────────────
  // Clique simples no botão 🔄 — sem overlay, sem reload de página.
  // Dispara eventos para módulos se atualizarem silenciosamente.
  async backgroundSync(callbacks = {}) {
    if (this._isSyncing) return;
    this._isSyncing = true;

    const { onStep, onDone, onError } = callbacks;

    const steps = [
      { id: 'cache',   label: 'Atualizando cache',     fn: () => this._clearCaches() },
      { id: 'modules', label: 'Recarregando módulos',  fn: () => this._reloadModules() },
      { id: 'sync',    label: 'Sincronizando dados',   fn: () => this._syncData() },
      { id: 'ui',      label: 'Atualizando interface', fn: () => this._updateUI() },
    ];

    try {
      for (const step of steps) {
        onStep && onStep(step.id, 'loading', step.label);
        await step.fn();
        await _delay(260);
        onStep && onStep(step.id, 'done', step.label);
        await _delay(80);
      }
      this.recordSync();
      onDone && onDone();
    } catch (err) {
      onError && onError(err);
    } finally {
      this._isSyncing = false;
    }
  }

  // ── Atualização completa com reload (SOMENTE quando versão mudou) ─────────
  // Chamado apenas pelo "Atualizar Agora" do banner ou Ctrl+clique.
  // Timeout de 30s: se travar, libera a interface automaticamente.
  async fullReload(callbacks = {}) {
    if (this._isUpdating) return;
    this._isUpdating = true;
    SystemUpdater._setLock();

    const { onStep, onDone, onError } = callbacks;

    // Timer de segurança: libera tudo se ultrapassar LOCK_TIMEOUT
    let timedOut = false;
    const safetyTimer = setTimeout(() => {
      timedOut = true;
      this._isUpdating = false;
      SystemUpdater._clearLock();
      console.error('[SystemUpdater] Timeout de atualização (30s). Interface liberada.');
      onError && onError(new Error('timeout'));
    }, LOCK_TIMEOUT);

    const steps = [
      { id: 'cache',   label: 'Limpando cache',        fn: () => this._clearCaches() },
      { id: 'modules', label: 'Recarregando módulos',  fn: () => this._reloadModules() },
      { id: 'sync',    label: 'Sincronizando dados',   fn: () => this._syncData() },
      { id: 'ui',      label: 'Atualizando interface', fn: () => this._updateUI() },
    ];

    try {
      for (const step of steps) {
        if (timedOut) return;
        onStep && onStep(step.id, 'loading', step.label);
        await step.fn();
        await _delay(340);
        if (timedOut) return;
        onStep && onStep(step.id, 'done', step.label);
        await _delay(130);
      }
      if (timedOut) return;
      const newVer = await this._fetchVersion();
      clearTimeout(safetyTimer);
      SystemUpdater._clearLock();
      onDone && onDone(newVer);
      await _delay(900);
      location.reload();
    } catch (err) {
      clearTimeout(safetyTimer);
      SystemUpdater._clearLock();
      this._isUpdating = false;
      onError && onError(err);
    }
  }

  // ── Passos internos ───────────────────────────────────────────────────────
  async _clearCaches() {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/CRM/');
      if (reg) await reg.update();
    } catch {}
    // Caches app-level
    ['cc_modulos_cache','cc_topbar_cache','cc_favoritos_cache',
     'cc_central_cache','cc_sidebar_cache'].forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
  }

  async _reloadModules() {
    window.dispatchEvent(new CustomEvent('cc-system-reload', {
      detail: { reason: 'manual-update', ts: Date.now() }
    }));
    await _delay(120);
  }

  async _syncData() {
    window.dispatchEvent(new CustomEvent('cc-sync-data', {
      detail: { force: true, ts: Date.now() }
    }));
    await _delay(120);
  }

  async _updateUI() {
    window.dispatchEvent(new CustomEvent('cc-update-ui', {
      detail: { force: true, ts: Date.now() }
    }));
    await _delay(120);
  }

  // ── Changelog ─────────────────────────────────────────────────────────────
  async fetchChangelog() {
    try {
      const res = await fetch('/CRM/changelog.json?_=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.changelog) ? data.changelog : [];
    } catch { return []; }
  }
}
