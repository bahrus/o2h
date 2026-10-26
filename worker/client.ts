/**
 * The page's side of o2h's service worker: register it and wait until it controls the page (so the
 * fetches that follow go through it), and store the transforms its `X-O2H-Transform` keys name.
 *
 * @example
 * await whenO2HWorkerReady('/o2h-sw.js');
 * await storeO2HTransform('launch-card', { config, options: { markerName: 'card' } });
 * const response = await fetch('/api/launch', { headers: { 'X-O2H-Transform': 'launch-card' } });
 * container.innerHTML = await response.text();   // HTML, with the JSON embedded after it
 */

export { storeO2HTransform, getO2HTransform, deleteO2HTransform } from './store.js';
export type { O2HTransform } from './store.js';

/** The request header naming a transform (see core.ts; repeated here so pages don't load the core). */
export const O2H_HEADER = 'X-O2H-Transform';

const ready = new Map<string, Promise<ServiceWorkerRegistration>>();

/**
 * Register o2h's service worker (as a module) and resolve once it controls this page. On a first visit
 * that's right after it activates (it claims open pages). Rejects where service workers aren't available
 * (e.g. an insecure origin).
 */
export function whenO2HWorkerReady(url: string | URL, options: { scope?: string } = {}): Promise<ServiceWorkerRegistration> {
    const key = `${new URL(url, location.href)}|${options.scope ?? ''}`;
    let promise = ready.get(key);
    if (!promise) {
        promise = (async () => {
            if (!('serviceWorker' in navigator)) throw new Error('o2h: service workers are not available here');
            const registration = await navigator.serviceWorker.register(url, { type: 'module', scope: options.scope });
            await navigator.serviceWorker.ready;
            if (!navigator.serviceWorker.controller) {
                await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
            }
            return registration;
        })();
        ready.set(key, promise);
    }
    return promise;
}

export { prepareO2HTransform } from './transform.js';
export type { O2HLost, PreparedO2HTransform } from './transform.js';
