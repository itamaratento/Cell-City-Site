// Ambiente mínimo de "browser" para rodar kernel.js em Node puro (sem
// jsdom — kernel.js só toca `location`, `localStorage`, `window` e
// `CustomEvent`, nunca o DOM em si). Cada teste chama `setupGlobals()` no
// início do cenário para começar com um estado limpo e previsível.
export function setupGlobals({ pathname = '/CRM/pages/dashboard/index.html' } = {}) {
  const storageMap = new Map();
  const localStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear(),
  };

  const location = { pathname, href: `http://localhost${pathname}` };

  const dispatched = [];
  const window_ = {
    dispatchEvent: (evt) => { dispatched.push(evt); return true; },
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  class CustomEventPolyfill {
    constructor(type, opts = {}) {
      this.type = type;
      this.detail = opts.detail;
    }
  }

  global.localStorage = localStorage;
  global.location = location;
  global.window = window_;
  global.CustomEvent = CustomEventPolyfill;

  return {
    localStorage,
    location,
    window: window_,
    getDispatchedEvents: () => dispatched,
  };
}
