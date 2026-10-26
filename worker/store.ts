/**
 * The IndexedDB store of o2h transforms, shared by the page (which writes them) and the service worker
 * (which only reads them). A transform holds o2h's first and third arguments, keyed by the value of the
 * request's `X-O2H-Transform` header (e.g. a GUID). The API's JSON is the second.
 *
 * Transforms must be structured-cloneable: JSON-like configs and options, no functions or classes
 * (so no pipes, protocols or manager classes, for now).
 */

import type { O2HConfig, O2HOptions } from '../types/o2h/types.js';

/** What an `X-O2H-Transform` key names: the tree config, and o2h's options. */
export interface O2HTransform {
    config: O2HConfig;
    options?: O2HOptions;
}

const DB = 'o2h';
const STORE = 'transforms';

function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        // Version 2: the store was called 'records' before
        const request = indexedDB.open(DB, 2);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (db.objectStoreNames.contains('records')) db.deleteObjectStore('records');
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function run<T>(mode: IDBTransactionMode, use: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = use(tx.objectStore(STORE));
        tx.oncomplete = () => { db.close(); resolve(request.result); };
        tx.onerror = () => { db.close(); reject(tx.error); };
        tx.onabort = () => { db.close(); reject(tx.error); };
    });
}

/** Store (or replace) the transform an `X-O2H-Transform` key names. */
export function storeO2HTransform(key: string, transform: O2HTransform): Promise<void> {
    return run('readwrite', store => store.put(transform, key)).then(() => undefined);
}

/** The transform an `X-O2H-Transform` key names, if any. */
export function getO2HTransform(key: string): Promise<O2HTransform | undefined> {
    return run('readonly', store => store.get(key));
}

/** Remove a transform. */
export function deleteO2HTransform(key: string): Promise<void> {
    return run('readwrite', store => store.delete(key)).then(() => undefined);
}
