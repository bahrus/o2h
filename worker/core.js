/**
 * The shared core of o2h's workers: turns a JSON API response into HTML (plus the JSON, embedded), for
 * requests marked with an `X-O2H-Config` header. Only the Fetch API and o2h, so the same code can serve
 * a service worker (worker/serviceWorker.ts) and, later, a Cloudflare Worker; each supplies its own lookup.
 *
 * - Not marked: not handled (callers check isO2HRequest first).
 * - Marked: the request is forwarded without the header (so a cross-origin API never sees it, and no
 *   CORS preflight is caused by it).
 * - The upstream response isn't OK, or isn't JSON: returned as is.
 * - No record for the key, or rendering fails: the original JSON, with an `X-O2H-Error` header saying why,
 *   so the page can fall back to rendering it itself.
 * - Otherwise: o2h(config, json, { ...options, embed }) as text/html, with `Vary: X-O2H-Config`.
 */
import { isLost, LostReference, o2h } from '../o2h.js';
import { dataPipes } from 'assign-gingerly/pipes/dataPipes.js';
import { CODE_MAPS } from './record.js';
/** The request header naming the record (config and options) to render a JSON response with. */
export const O2H_HEADER = 'X-O2H-Config';
/** The response header explaining why a marked request came back as JSON. */
export const O2H_ERROR_HEADER = 'X-O2H-Error';
/** Whether a request asks for o2h rendering. */
export function isO2HRequest(request) {
    return request.headers.has(O2H_HEADER);
}
/** Handle a marked request: forward it, and render its JSON response as HTML (see the module comment). */
export async function handleO2HRequest(request, lookup, fetchUpstream = fetch) {
    const key = request.headers.get(O2H_HEADER);
    const headers = new Headers(request.headers);
    headers.delete(O2H_HEADER);
    const upstream = await fetchUpstream(new Request(request, { headers }));
    if (!upstream.ok || !isJson(upstream.headers.get('Content-Type')))
        return upstream;
    let record;
    try {
        record = await lookup(key);
    }
    catch (e) {
        return withError(upstream, `the record "${key}" couldn't be read (${e.message})`);
    }
    if (!record?.config)
        return withError(upstream, `no record for "${key}"`);
    let html;
    try {
        const data = await upstream.clone().json();
        const { config, options } = reviveO2HRecord(record);
        html = o2h(config, data, { ...options, embed: options.embed || true }).html;
    }
    catch (e) {
        return withError(upstream, `rendering failed (${e.message})`);
    }
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('Content-Length');
    responseHeaders.delete('Content-Encoding');
    responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
    responseHeaders.append('Vary', O2H_HEADER);
    return new Response(html, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}
/** application/json, or any +json type. */
function isJson(contentType) {
    const type = contentType?.split(';')[0].trim().toLowerCase() ?? '';
    return type === 'application/json' || type.endsWith('+json');
}
/** The upstream response, unchanged but for an X-O2H-Error header (fetch's own headers are immutable, hence the copy). */
function withError(upstream, message) {
    const headers = new Headers(upstream.headers);
    headers.append('Vary', O2H_HEADER);
    // Header values must be Latin-1, and short
    headers.set(O2H_ERROR_HEADER, message.replace(/[^\x20-\x7e]/g, '?').slice(0, 300));
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}
/**
 * The config and options to render a record with, in a worker: stand-in pipes and protocols become stubs
 * that throw LostReference (so o2h leaves what uses them to the client); stand-in managers are left out (o2h
 * then renders their subtree from the raw value, marked pending). Stored data pipes (descriptors, from
 * assign-gingerly's dataPipes) become pipes again, so they run here; a chain reaching a lost pipe throws
 * through its stub. Stand-ins elsewhere stay, and o2h treats them as lost too.
 */
export function reviveO2HRecord(record) {
    const options = { ...record.options };
    for (const [key, kind] of Object.entries(CODE_MAPS)) {
        const map = options[key];
        if (!map || typeof map !== 'object')
            continue;
        const revived = {};
        for (const [name, entry] of Object.entries(map)) {
            if (!isLost(entry))
                revived[name] = entry;
            else if (kind !== 'manager')
                revived[name] = () => { throw new LostReference(`the ${kind} "${name}"`); };
        }
        // Pipes: descriptors become functions again (functions, i.e. the stubs, pass through)
        options[key] = key === 'pipes' ? dataPipes(revived) : revived;
    }
    return { config: record.config, options };
}
