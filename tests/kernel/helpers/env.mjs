// Ambiente mínimo de "browser" para rodar kernel.js em Node puro (sem
// jsdom — kernel.js só toca `location`, `localStorage`, `window` e
// `CustomEvent`, nunca o DOM em si). Cada teste chama `setupGlobals()` no
// início do cenário para começar com um estado limpo e previsível.
export function setupGlobals({ pathname = '/CRM/pages/dashboard/index.html' } = {}) {
  const storageMap = new Map();
  const sessionMap = new Map();
  const makeStorage = (map) => ({
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  });
  const localStorage = makeStorage(storageMap);
  const sessionStorage = makeStorage(sessionMap);

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
  global.sessionStorage = sessionStorage;
  global.location = location;
  global.window = window_;
  global.CustomEvent = CustomEventPolyfill;

  return {
    localStorage,
    sessionStorage,
    location,
    window: window_,
    getDispatchedEvents: () => dispatched,
  };
}
