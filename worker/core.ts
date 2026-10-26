/**
 * The shared core of o2h's workers: turns a JSON API response into HTML (plus the JSON, embedded), for
 * requests marked with an `X-O2H-Transform` header. Only the Fetch API and o2h, so the same code can serve
 * a service worker (worker/serviceWorker.ts) and, later, a Cloudflare Worker; each supplies its own lookup.
 *
 * - Not marked: not handled (callers check isO2HRequest first).
 * - Marked: the request is forwarded without the header (so a cross-origin API never sees it, and no
 *   CORS preflight is caused by it).
 * - The upstream response isn't OK, or isn't JSON: returned as is.
 * - No transform for the key, or rendering fails: the original JSON, with an `X-O2H-Error` header saying why,
 *   so the page can fall back to rendering it itself.
 * - Otherwise: o2h(config, json, { ...options, embed }) as text/html, with `Vary: X-O2H-Transform`.
 */

import { isLost, LostReference, o2h } from '../o2h.js';
import { dataPipes } from 'assign-gingerly/pipes/dataPipes.js';
import type { O2HConfig, O2HOptions } from '../types/o2h/types.js';
import { CODE_MAPS } from './transform.js';
import type { O2HTransform } from './store.js';

/** The request header naming the transform (config and options) to render a JSON response with. */
export const O2H_HEADER = 'X-O2H-Transform';

/** The response header explaining why a marked request came back as JSON. */
export const O2H_ERROR_HEADER = 'X-O2H-Error';

/** Finds the transform a key names (IndexedDB in a service worker; KV or bundled configs elsewhere). */
export type O2HLookup = (key: string) => Promise<O2HTransform | undefined> | O2HTransform | undefined;

/** Whether a request asks for o2h rendering. */
export function isO2HRequest(request: Request): boolean {
    return request.headers.has(O2H_HEADER);
}

/** Handle a marked request: forward it, and render its JSON response as HTML (see the module comment). */
export async function handleO2HRequest(request: Request, lookup: O2HLookup, fetchUpstream: typeof fetch = fetch): Promise<Response> {
    const key = request.headers.get(O2H_HEADER)!;
    const headers = new Headers(request.headers);
    headers.delete(O2H_HEADER);
    const upstream = await fetchUpstream(new Request(request, { headers }));
    if (!upstream.ok || !isJson(upstream.headers.get('Content-Type'))) return upstream;

    let transform: O2HTransform | undefined;
    try {
        transform = await lookup(key);
    } catch (e) {
        return withError(upstream, `the transform "${key}" couldn't be read (${(e as Error).message})`);
    }
    if (!transform?.config) return withError(upstream, `no transform for "${key}"`);

    let html: string;
    try {
        const data = await upstream.clone().json();
        const { config, options } = reviveO2HTransform(transform);
        html = o2h(config, data, { ...options, embed: options.embed || true }).html;
    } catch (e) {
        return withError(upstream, `rendering failed (${(e as Error).message})`);
    }
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('Content-Length');
    responseHeaders.delete('Content-Encoding');
    responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
    responseHeaders.append('Vary', O2H_HEADER);
    return new Response(html, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}

/** application/json, or any +json type. */
function isJson(contentType: string | null): boolean {
    const type = contentType?.split(';')[0].trim().toLowerCase() ?? '';
    return type === 'application/json' || type.endsWith('+json');
}

/** The upstream response, unchanged but for an X-O2H-Error header (fetch's own headers are immutable, hence the copy). */
function withError(upstream: Response, message: string): Response {
    const headers = new Headers(upstream.headers);
    headers.append('Vary', O2H_HEADER);
    // Header values must be Latin-1, and short
    headers.set(O2H_ERROR_HEADER, message.replace(/[^\x20-\x7e]/g, '?').slice(0, 300));
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

/**
 * The config and options to render a transform with, in a worker: stand-in pipes and protocols become stubs
 * that throw LostReference (so o2h leaves what uses them to the client); stand-in managers are left out (o2h
 * then renders their subtree from the raw value, marked pending). Stored data pipes (descriptors, from
 * assign-gingerly's dataPipes) become pipes again, so they run here; a chain reaching a lost pipe throws
 * through its stub. Stand-ins elsewhere stay, and o2h treats them as lost too.
 */
export function reviveO2HTransform(transform: O2HTransform): { config: O2HConfig; options: O2HOptions } {
    const options: any = { ...transform.options };
    for (const [key, kind] of Object.entries(CODE_MAPS)) {
        const map = options[key];
        if (!map || typeof map !== 'object') continue;
        const revived: Record<string, any> = {};
        for (const [name, entry] of Object.entries(map)) {
            if (!isLost(entry)) revived[name] = entry;
            else if (kind !== 'manager') revived[name] = () => { throw new LostReference(`the ${kind} "${name}"`); };
        }
        // Pipes: descriptors become functions again (functions, i.e. the stubs, pass through)
        options[key] = key === 'pipes' ? dataPipes(revived) : revived;
    }
    return { config: transform.config, options };
}
