/**
 * Transforms for o2h's workers, from the configs and options a page uses on the client.
 *
 * The page's objects can hold code (pipes, protocols, manager classes, a registry), which can't be stored
 * in IndexedDB or sent to a worker. prepareO2HTransform copies them, replacing each piece of code with a
 * stand-in (`{ $o2hLost: kind, name }`), lists what was lost, and keys the transform by a hash of its content.
 * In the worker, reviveO2HTransform (core.ts) turns the stand-ins into stubs that throw LostReference, so o2h knows
 * exactly what it can't render and leaves those parts to the client (marked data-pending, or as
 * pending-structure placeholders that builtIns.tree's adopt renders fresh).
 */
/** Where assign-gingerly's dataPipes keeps a pipe's descriptor (a registered symbol, so no import is needed). */
const PIPE_DESCRIPTOR = Symbol.for('assign-gingerly.pipeDescriptor');
/** Option keys whose values are code, by kind. */
export const CODE_MAPS = { pipes: 'pipe', protocols: 'protocol', managers: 'manager' };
/**
 * Copy a client-side config and options into a storable transform. Code becomes stand-ins (listed in `lost`),
 * and the key is a hash of the transform's content: the same config gets the same key, a changed one a new key.
 */
export async function prepareO2HTransform(config, options = {}) {
    const lost = [];
    const transform = {
        config: copy(config, 'config', lost, new WeakSet()),
        options: copy(options, 'options', lost, new WeakSet()),
    };
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(transform)));
    const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    return { key: `o2h-${hex.slice(0, 32)}`, transform, lost };
}
/** A storable copy of a value: plain data as is, code as stand-ins. */
function copy(value, path, lost, seen, kindHere) {
    const type = typeof value;
    if (value === null || (type !== 'object' && type !== 'function' && type !== 'symbol'))
        return value;
    if (type === 'symbol')
        return standIn('symbol', value.description, path, lost);
    if (type === 'function') {
        // A data pipe (assign-gingerly's dataPipes) carries its descriptor: that's storable, so nothing is lost
        const descriptor = value[PIPE_DESCRIPTOR];
        if (descriptor && typeof descriptor === 'object')
            return copy(descriptor, path, lost, seen);
        const isClass = /^class[\s{]/.test(Function.prototype.toString.call(value));
        const kind = kindHere ?? (isClass ? 'class' : 'function');
        // A manager class is named by its static `is`, when it has one (the name builtIns.tree registers it under)
        const name = (typeof value.is === 'string' && value.is) || value.name || undefined;
        return standIn(kind, name, path, lost);
    }
    if (seen.has(value))
        return standIn('cycle', undefined, path, lost);
    if (value instanceof Date || value instanceof RegExp)
        return value; // structured-cloneable as is
    const proto = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) {
        // A registry, a Map of classes, a class instance …: its prototype (and any code in it) can't be stored
        return standIn('object', proto?.constructor?.name, path, lost);
    }
    seen.add(value);
    let result;
    if (Array.isArray(value)) {
        result = value.map((item, i) => copy(item, `${path}.${i}`, lost, seen));
    }
    else {
        result = {};
        for (const key of Object.keys(value)) {
            // pipes / protocols / managers directly under options: their entries are code of that kind
            const codeKind = path === 'options' ? CODE_MAPS[key] : undefined;
            result[key] = codeKind && value[key] && typeof value[key] === 'object' && Object.getPrototypeOf(value[key]) === Object.prototype
                ? Object.fromEntries(Object.entries(value[key]).map(([name, entry]) => [name, copy(entry, `${path}.${key}.${name}`, lost, seen, typeof entry === 'function' ? codeKind : undefined)]))
                : copy(value[key], `${path}.${key}`, lost, seen);
        }
    }
    seen.delete(value);
    return result;
}
function standIn(kind, name, path, lost) {
    lost.push(name ? { path, kind, name } : { path, kind });
    return name ? { $o2hLost: kind, name } : { $o2hLost: kind };
}
