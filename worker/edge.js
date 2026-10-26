/**
 * The page's side of o2h-edge (o2h's renderer as a Cloudflare Worker): render an API through the worker into a
 * container, and hydrate it.
 *
 * renderViaEdge stores the transform with the worker (once per worker), asks it to call the API and render its
 * JSON, puts the HTML in the container, and hydrates it with builtIns.tree (`adopt: 'pending'`, with the page's
 * real pipes and managers), which finishes what the worker left pending. If the worker passes the JSON back
 * instead (it has no such transform, or rendering failed), the page renders it itself.
 *
 * @example
 * import { renderViaEdge } from 'o2h/worker/edge.js';
 * const { by, data } = await renderViaEdge(container, {
 *     worker: 'https://o2h-edge.example.workers.dev',
 *     api: 'https://fakestoreapi.com/products',
 *     config: { map: { '*': card } },
 *     options: { pipes, style: true },
 * });
 */
import { assignFromAsync } from 'assign-gingerly/assignFromAsync.js';
import { prepareO2HTransform } from './transform.js';
/** Transforms, prepared once per config and options object. */
const prepared = new WeakMap();
const NO_OPTIONS = {};
/** `<worker> <key>`: the transforms each worker is known to hold. */
const stored = new Set();
function prepare(config, options) {
    let byOptions = prepared.get(config);
    if (!byOptions)
        prepared.set(config, (byOptions = new WeakMap()));
    const optionsKey = options ?? NO_OPTIONS;
    let promise = byOptions.get(optionsKey);
    if (!promise)
        byOptions.set(optionsKey, (promise = prepareO2HTransform(config, options)));
    return promise;
}
async function store(worker, { key, transform }) {
    const response = await fetch(`${worker}/transforms/${key}`, { method: 'PUT', body: JSON.stringify(transform) });
    if (!response.ok)
        throw new Error(`o2h-edge: storing the transform: ${await errorOf(response)}`);
    stored.add(`${worker} ${key}`);
}
async function errorOf(response) {
    const { error } = await response.json().catch(() => ({ error: response.statusText }));
    return `${response.status} ${error ?? ''}`.trim();
}
/**
 * Render an API's JSON through o2h-edge into a container, and hydrate it (see the module comment).
 * Throws when the worker can't be reached, refuses the request (guards, rate limit), or the API fails.
 */
export async function renderViaEdge(container, request) {
    const { config, options, hydrate } = request;
    const worker = request.worker.replace(/\/+$/, '');
    const transform = await prepare(config, options);
    const pipes = options?.pipes;
    const markerName = config.markerName ?? 'tree';
    let started = 0;
    const render = async () => {
        if (!stored.has(`${worker} ${transform.key}`))
            await store(worker, transform);
        started = performance.now();
        return fetch(`${worker}/render?api=${encodeURIComponent(request.api)}&transform=${transform.key}`);
    };
    let response = await render();
    // The worker lost the transform (e.g. a restarted `wrangler dev`): store it again, once
    if (response.headers.get('X-O2H-Error')?.startsWith('no transform')) {
        stored.delete(`${worker} ${transform.key}`);
        response = await render();
    }
    const elapsed = Math.round(performance.now() - started);
    if ((response.headers.get('Content-Type') ?? '').startsWith('text/html')) {
        container.innerHTML = await response.text();
        const script = container.querySelector(`script[type="application/json"][data-tree="${CSS.escape(markerName)}"]`);
        const data = JSON.parse(script?.textContent ?? 'null');
        const pending = container.querySelectorAll('[data-pending]').length;
        await assignFromAsync(container, { '?. =>': { do: 'builtIns.tree', adopt: 'pending', ...config } }, { ...hydrate, from: data, pipes });
        return { by: 'worker', data, elapsed, pending, lost: transform.lost };
    }
    if (!response.ok)
        throw new Error(`o2h-edge: ${await errorOf(response)}`);
    // The JSON, passed back: render it here
    const data = await response.json();
    container.replaceChildren();
    await assignFromAsync(container, { '?. =>': { do: 'builtIns.tree', ...config } }, { ...hydrate, from: data, pipes });
    return { by: 'page', data, elapsed, pending: 0, lost: transform.lost, error: response.headers.get('X-O2H-Error') ?? undefined };
}
