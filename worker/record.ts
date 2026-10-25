/**
 * Records for o2h's workers, from the configs and options a page uses on the client.
 *
 * The page's objects can hold code (pipes, protocols, manager classes, a registry), which can't be stored
 * in IndexedDB or sent to a worker. prepareO2HRecord copies them, replacing each piece of code with a
 * stand-in (`{ $o2hLost: kind, name }`), lists what was lost, and keys the record by a hash of its content.
 * In the worker, reviveO2HRecord (core.ts) turns the stand-ins into stubs that throw LostReference, so o2h knows
 * exactly what it can't render and leaves those parts to the client (marked data-pending, or as
 * pending-structure placeholders that builtIns.tree's adopt renders fresh).
 */

import type { LostStandIn } from '../o2h.js';
import type { O2HConfig, O2HOptions } from '../types/o2h/types.js';
import type { O2HRecord } from './store.js';

/** Something prepareO2HRecord couldn't store, and replaced with a stand-in. */
export interface O2HLost {
    /** Where it was, e.g. `options.pipes.longUtc` or `config.map.rocket.0.ish` */
    path: string;
    kind: LostStandIn['$o2hLost'];
    name?: string;
}

/** A record, its content-derived key, and what couldn't be stored. */
export interface PreparedO2HRecord {
    key: string;
    record: O2HRecord;
    lost: O2HLost[];
}

/** Where assign-gingerly's dataPipes keeps a pipe's descriptor (a registered symbol, so no import is needed). */
const PIPE_DESCRIPTOR = Symbol.for('assign-gingerly.pipeDescriptor');

/** Option keys whose values are code, by kind. */
export const CODE_MAPS = { pipes: 'pipe', protocols: 'protocol', managers: 'manager' } as const;

/**
 * Copy a client-side config and options into a storable record. Code becomes stand-ins (listed in `lost`),
 * and the key is a hash of the record's content: the same config gets the same key, a changed one a new key.
 */
export async function prepareO2HRecord(config: O2HConfig, options: O2HOptions = {}): Promise<PreparedO2HRecord> {
    const lost: O2HLost[] = [];
    const record: O2HRecord = {
        config: copy(config, 'config', lost, new WeakSet()),
        options: copy(options, 'options', lost, new WeakSet()),
    };
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(record)));
    const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    return { key: `o2h-${hex.slice(0, 32)}`, record, lost };
}

/** A storable copy of a value: plain data as is, code as stand-ins. */
function copy(value: any, path: string, lost: O2HLost[], seen: WeakSet<object>, kindHere?: LostStandIn['$o2hLost']): any {
    const type = typeof value;
    if (value === null || (type !== 'object' && type !== 'function' && type !== 'symbol')) return value;
    if (type === 'symbol') return standIn('symbol', value.description, path, lost);
    if (type === 'function') {
        // A data pipe (assign-gingerly's dataPipes) carries its descriptor: that's storable, so nothing is lost
        const descriptor = value[PIPE_DESCRIPTOR];
        if (descriptor && typeof descriptor === 'object') return copy(descriptor, path, lost, seen);
        const isClass = /^class[\s{]/.test(Function.prototype.toString.call(value));
        const kind = kindHere ?? (isClass ? 'class' : 'function');
        // A manager class is named by its static `is`, when it has one (the name builtIns.tree registers it under)
        const name = (typeof value.is === 'string' && value.is) || value.name || undefined;
        return standIn(kind, name, path, lost);
    }
    if (seen.has(value)) return standIn('cycle', undefined, path, lost);
    if (value instanceof Date || value instanceof RegExp) return value;   // structured-cloneable as is
    const proto = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) {
        // A registry, a Map of classes, a class instance …: its prototype (and any code in it) can't be stored
        return standIn('object', proto?.constructor?.name, path, lost);
    }
    seen.add(value);
    let result: any;
    if (Array.isArray(value)) {
        result = value.map((item, i) => copy(item, `${path}.${i}`, lost, seen));
    } else {
        result = {};
        for (const key of Object.keys(value)) {
            // pipes / protocols / managers directly under options: their entries are code of that kind
            const codeKind = path === 'options' ? CODE_MAPS[key as keyof typeof CODE_MAPS] : undefined;
            result[key] = codeKind && value[key] && typeof value[key] === 'object' && Object.getPrototypeOf(value[key]) === Object.prototype
                ? Object.fromEntries(Object.entries(value[key]).map(([name, entry]) =>
                    [name, copy(entry, `${path}.${key}.${name}`, lost, seen, typeof entry === 'function' ? codeKind : undefined)]))
                : copy(value[key], `${path}.${key}`, lost, seen);
        }
    }
    seen.delete(value);
    return result;
}

function standIn(kind: LostStandIn['$o2hLost'], name: string | undefined, path: string, lost: O2HLost[]): LostStandIn {
    lost.push(name ? { path, kind, name } : { path, kind });
    return name ? { $o2hLost: kind, name } : { $o2hLost: kind };
}
