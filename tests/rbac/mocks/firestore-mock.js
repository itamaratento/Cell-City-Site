// Fake Firestore em memória — só a borda do SDK é mockada; toda a lógica
// real dos módulos de página e das Repositories roda sem alteração.
// Compartilhado entre todos os testes de tests/rbac/ (cada teste chama
// __reset() no início do próprio cenário, então o estado nunca vaza
// entre testes mesmo rodando no mesmo processo `node --test`).
const store = new Map();

function col(name) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name);
}

export function collection(_db, name) { return { __col: name }; }
// Suporta as duas formas do SDK real: doc(db, name, id) e doc(collectionRef) (auto-id, sem escrever).
export function doc(a, b, c) {
    if (b === undefined) return { __col: a.__col, __id: 'auto_' + Math.random().toString(36).slice(2, 10) };
    return { __col: b, __id: c };
}
export function query(ref, ...clauses) { return { __col: ref.__col, __clauses: clauses }; }
export function where(field, op, value) { return { type: 'where', field, op, value }; }
export function orderBy(field, dir) { return { type: 'orderBy', field, dir }; }
export function limit(n) { return { type: 'limit', n }; }
export function serverTimestamp() { return new Date().toISOString(); }

function applyClauses(entries, clauses = []) {
    let result = entries;
    for (const c of clauses) {
        if (c.type === 'where') {
            result = result.filter(([, data]) => {
                const v = data[c.field];
                if (c.op === '==') return v === c.value;
                if (c.op === '>=') return v >= c.value;
                if (c.op === '<=') return v <= c.value;
                return true;
            });
        }
    }
    const ord = clauses.find(c => c.type === 'orderBy');
    if (ord) {
        result = [...result].sort((a, b) => {
            const av = a[1][ord.field], bv = b[1][ord.field];
            const cmp = av > bv ? 1 : av < bv ? -1 : 0;
            return ord.dir === 'desc' ? -cmp : cmp;
        });
    }
    const lim = clauses.find(c => c.type === 'limit');
    if (lim) result = result.slice(0, lim.n);
    return result;
}

function snapFromEntries(entries) {
    const docs = entries.map(([id, data]) => ({ id, data: () => ({ ...data }), exists: () => true }));
    return { docs, forEach: fn => docs.forEach(fn) };
}

export async function getDocs(ref) {
    const entries = applyClauses([...col(ref.__col).entries()], ref.__clauses);
    return snapFromEntries(entries);
}

export async function getDoc(ref) {
    const data = col(ref.__col).get(ref.__id);
    return { exists: () => data !== undefined, data: () => (data ? { ...data } : undefined), id: ref.__id };
}

export async function addDoc(ref, data) {
    const id = 'auto_' + Math.random().toString(36).slice(2, 10);
    col(ref.__col).set(id, { ...data });
    return { id };
}

export async function setDoc(ref, data, opts) {
    const c = col(ref.__col);
    c.set(ref.__id, opts?.merge ? { ...(c.get(ref.__id) || {}), ...data } : { ...data });
}

export async function updateDoc(ref, data) {
    const c = col(ref.__col);
    c.set(ref.__id, { ...(c.get(ref.__id) || {}), ...data });
}

export async function deleteDoc(ref) {
    col(ref.__col).delete(ref.__id);
}

export function onSnapshot(ref, cb, errCb) {
    getDocs(ref).then(cb).catch(errCb || (() => {}));
    return () => {};
}

export async function runTransaction(_db, updateFn) {
    const tx = {
        async get(ref) { return getDoc(ref); },
        set(ref, data, opts) {
            const c = col(ref.__col);
            c.set(ref.__id, opts?.merge ? { ...(c.get(ref.__id) || {}), ...data } : { ...data });
        },
        update(ref, data) {
            const c = col(ref.__col);
            c.set(ref.__id, { ...(c.get(ref.__id) || {}), ...data });
        },
        delete(ref) { col(ref.__col).delete(ref.__id); }
    };
    return updateFn(tx);
}

// ── controles de teste (não fazem parte do SDK real) ────────────────
export function __reset() { store.clear(); }
export function __seed(name, id, data) { col(name).set(id, { ...data }); }
export function __raw(name, id) { return col(name).get(id); }
export function __all(name) { return [...col(name).entries()].map(([id, data]) => ({ id, ...data })); }
