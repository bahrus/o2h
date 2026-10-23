// A minimal IndexedDB key-value store for the benchmark (shared by the worker and the page).
const DB = 'o2h-json-benchmark';
const STORE = 'data';

function open() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function run(mode, use) {
    return open().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = use(tx.objectStore(STORE));
        tx.oncomplete = () => { db.close(); resolve(request.result); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    }));
}

export const put = (key, value) => run('readwrite', store => store.put(value, key));
export const get = key => run('readonly', store => store.get(key));
export const clear = () => run('readwrite', store => store.clear());
