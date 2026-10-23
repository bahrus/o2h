/**
 * The IndexedDB store of o2h records, shared by the page (which writes them) and the service worker
 * (which only reads them). A record holds o2h's first and third arguments, keyed by the value of the
 * request's `X-O2H-Config` header (e.g. a GUID). The API's JSON is the second.
 *
 * Records must be structured-cloneable: JSON-like configs and options, no functions or classes
 * (so no pipes, protocols or manager classes, for now).
 */

import type { O2HConfig, O2HOptions } from '../types/o2h/types.js';

/** What an `X-O2H-Config` key names: the tree config, and o2h's options. */
export interface O2HRecord {
    config: O2HConfig;
    options?: O2HOptions;
}

const DB = 'o2h';
const STORE = 'records';

function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
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

/** Store (or replace) the record an `X-O2H-Config` key names. */
export function storeO2HRecord(key: string, record: O2HRecord): Promise<void> {
    return run('readwrite', store => store.put(record, key)).then(() => undefined);
}

/** The record an `X-O2H-Config` key names, if any. */
export function getO2HRecord(key: string): Promise<O2HRecord | undefined> {
    return run('readonly', store => store.get(key));
}

/** Remove a record. */
export function deleteO2HRecord(key: string): Promise<void> {
    return run('readwrite', store => store.delete(key)).then(() => undefined);
}
