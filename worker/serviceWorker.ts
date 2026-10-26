/**
 * o2h's service worker: renders JSON API responses as HTML (plus the JSON, embedded) for fetches that
 * carry an `X-O2H-Transform` header, using the transform that key names in IndexedDB (see store.ts). Everything
 * else passes through untouched.
 *
 * Built (bundled, since workers can't use import maps) to o2h-sw.js by `npm run build:worker`. Serve that
 * file from a path whose scope covers the pages using it (e.g. the site root), and register it with
 * whenO2HWorkerReady (client.ts), as a module.
 */

import { handleO2HRequest, isO2HRequest } from './core.js';
import { getO2HTransform } from './store.js';

/** The service worker global scope, typed just enough (the DOM lib types `self` as a Window). */
interface FetchEventLike extends Event {
    request: Request;
    respondWith(response: Promise<Response>): void;
}
interface ExtendableEventLike extends Event {
    waitUntil(promise: Promise<unknown>): void;
}
const sw = self as unknown as {
    addEventListener(type: 'fetch', listener: (event: FetchEventLike) => void): void;
    addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEventLike) => void): void;
    skipWaiting(): Promise<void>;
    clients: { claim(): Promise<void> };
};

// Take over at once, so a first visit's page is controlled without a reload (whenO2HWorkerReady waits for that)
sw.addEventListener('install', event => event.waitUntil(sw.skipWaiting()));
sw.addEventListener('activate', event => event.waitUntil(sw.clients.claim()));

sw.addEventListener('fetch', event => {
    if (isO2HRequest(event.request)) event.respondWith(handleO2HRequest(event.request, getO2HTransform));
});
