/**
 * o2h: a builtIns.tree config + data → HTML.
 *
 * Uses only assign-gingerly's pure (DOM-free) exports, so it runs in Node, Deno, Bun, a
 * Cloudflare Worker or a service worker. Structural decisions (which keys render, which case a
 * switch picks, which items a repeat stamps) come from the same functions builtIns.tree uses,
 * so the server renders what Tree would on the client.
 *
 * Elements that lost something HTML can't carry (properties without an attribute, event
 * bindings, an itemscope manager) are marked data-pending: "hide this until the client restores
 * it". The client restores them by hydrating, with builtIns.tree's `adopt: true` and the same
 * config and data, which removes the marks.
 */

import { chooseCase, isSwitch, mapEntries, normalize, repeatItems } from 'assign-gingerly/handlers/treeSpec.js';
import { attributeText, classifyPatternKey } from 'assign-gingerly/handlers/compileTree.js';
import { getValue, getValues } from 'assign-gingerly/resolve/getValues.js';
import { planMicroJoin } from 'assign-gingerly/syncOps/microJoin.js';
import { assignFrom } from 'assign-gingerly/assignFrom.js';
import type { ElementSpecification } from 'assign-gingerly/types/treeTypes.js';
import type { O2HConfig, O2HManager, O2HOptions, O2HResult, O2HUnrendered } from './types/o2h/types.js';

export type { O2HConfig, O2HManager, O2HOptions, O2HResult, O2HUnrendered } from './types/o2h/types.js';

/** Marks an element that lost something HTML can't carry: assign-gingerly's PENDING_ATTRIBUTE. */
export const PENDING_ATTRIBUTE = 'data-pending' as const;

/** The opt-in default style (options.style): pending parts hidden, only when scripts run. */
export const PENDING_STYLE = `<style>@media (scripting: enabled) { [${PENDING_ATTRIBUTE}] { visibility: hidden; } }</style>`;

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/** Properties that have an HTML attribute (the rest mark the element pending). `true`: a boolean attribute of the same name, lowercased. */
const REFLECTED: Record<string, string | true> = {
    className: 'class', id: 'id', title: 'title', lang: 'lang', dir: 'dir', slot: 'slot', role: 'role',
    href: 'href', src: 'src', alt: 'alt', name: 'name', type: 'type', placeholder: 'placeholder',
    htmlFor: 'for', tabIndex: 'tabindex', dateTime: 'datetime', value: 'value',
    hidden: true, checked: true, disabled: true, required: true, selected: true,
};
/** Boolean properties whose attribute isn't just the name lowercased. */
const BOOLEAN_ATTRS: Record<string, string> = { readOnly: 'readonly' };

const escapeText = (text: unknown) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (text: unknown) => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** Per-call state. */
interface Context {
    aka: Record<string, string>;
    pipes?: O2HOptions['pipes'];
    protocols?: O2HOptions['protocols'];
    managers: Record<string, O2HManager>;
    unrendered: O2HUnrendered[];
}

/** One rendered specification: its HTML, and how many elements it put at its level (for paths). */
interface Rendered {
    html: string;
    elements: number;
}

/** Path-resolution options for a scope, as builtIns.tree resolves them: the enclosing values are $parent / $root. */
type ResolveOptions = { pipes?: O2HOptions['pipes']; aka: Record<string, string>; protocols?: O2HOptions['protocols']; fromStack: any[] };

/**
 * Render a builtIns.tree config against data.
 *
 * @param config  `{ map, keepNullish?, aka?, markerName? }`: the same JSON builtIns.tree takes
 * @param from    The data (e.g. an API response)
 * @param options Pipes, aka, sync protocols, server-side managers, and the opt-in default style
 * @returns `{ html, unrendered }`
 */
export function o2h(config: O2HConfig, from: any, options: O2HOptions = {}): O2HResult {
    const { map, keepNullish = false, aka: treeAka, markerName = 'tree' } = config;
    const ctx: Context = {
        aka: { ...options.aka, ...treeAka },
        pipes: options.pipes,
        protocols: options.protocols,
        managers: options.managers ?? {},
        unrendered: [],
    };
    let html = options.style ? PENDING_STYLE : '';
    html += `<!--?start name="${escapeAttr(markerName)}"-->`;
    let index = 0;
    for (const { spec, value } of mapEntries(map, from, keepNullish)) {
        const rendered = renderSpec(spec, value, [from], [index], ctx);
        html += rendered.html;
        index += rendered.elements;
    }
    html += '<!--?end-->';
    return { html, unrendered: ctx.unrendered };
}

function resolveOptions(stack: any[], ctx: Context): ResolveOptions {
    return { pipes: ctx.pipes, aka: ctx.aka, protocols: ctx.protocols, fromStack: stack };
}

/** Render one specification (an element, or a switch) at `path`. */
function renderSpec(spec: ElementSpecification, value: any, stack: any[], path: number[], ctx: Context): Rendered {
    const options = resolveOptions(stack, ctx);
    if (isSwitch(spec)) {
        const { spec: chosen } = chooseCase(spec, value, (p, v) => getValue(p, v, options as any));
        // builtIns.tree keeps the slot with a placeholder comment
        if (chosen == null) return { html: '<!--?switch-->', elements: 0 };
        return renderSpec(chosen, value, stack, path, ctx);
    }
    const [, tag, ish, pattern = {}, children, repeat, nested] = normalize(spec);
    const attrs = new Map<string, string>();
    let pending = false;   // something HTML can't carry: the client restores it
    let content: string | undefined;   // the element's own text / microJoin, as HTML

    // A manager: itemscope names it, so the client attaches it.
    // On the server, it renders the subtree from its getters if its class is provided.
    let scope = value;
    if (ish !== undefined) {
        if (typeof ish !== 'string') {
            ctx.unrendered.push({ path, key: 'ish (a class can\'t be named in HTML: register it by name)' });
        } else {
            attrs.set('itemscope', ish);
            pending = true;
            const Manager = ctx.managers[ish];
            if (Manager) scope = constructManager(Manager, value, path, ctx);
        }
    }

    const setProperty = (name: string, propValue: any) => {
        if (name === 'textContent') {
            content = propValue == null ? '' : escapeText(propValue);
            return;
        }
        const reflected = REFLECTED[name];
        const booleanAttr = reflected === true ? name.toLowerCase() : BOOLEAN_ATTRS[name];
        if (booleanAttr) {
            if (propValue) attrs.set(booleanAttr, ''); else attrs.delete(booleanAttr);
        } else if (typeof reflected === 'string') {
            if (propValue == null) attrs.delete(reflected); else attrs.set(reflected, String(propValue));
        } else {
            pending = true;   // no HTML for it: the client sets it
        }
    };

    for (const key of Object.keys(pattern)) {
        const raw = pattern[key];
        const classified = classifyPatternKey(key, raw, ctx.aka);
        switch (classified.kind) {
            case 'text':
                setProperty('textContent', resolveRHS(raw, scope, options));
                break;
            case 'attribute': {
                const name = classified.name.toLowerCase();
                const text = attributeText(resolveRHS(raw, scope, options));
                if (text == null) attrs.delete(name); else attrs.set(name, text);
                break;
            }
            case 'property':
                setProperty(classified.name, resolveRHS(raw, scope, options));
                break;
            case 'syncOp':
                if (raw && typeof raw === 'object' && 'microJoin' in raw) {
                    content = renderMicroJoin(raw, scope, options, attrs);
                } else {
                    evaluateOther(key, raw, scope, options, setProperty, path, ctx);   // join, …
                }
                break;
            case 'event':
                pending = true;   // the client binds it
                break;
            case 'ish':
                pending = true;
                break;
            default:
                evaluateOther(key, raw, scope, options, setProperty, path, ctx);
        }
    }

    // Children: a repeat, a nested tree, or static children
    let inner = '';
    let childIndex = 0;
    const renderChild = (childSpec: ElementSpecification, childValue: any, childStack: any[]) => {
        const rendered = renderSpec(childSpec, childValue, childStack, [...path, childIndex], ctx);
        inner += rendered.html;
        childIndex += rendered.elements;
    };
    if (repeat) {
        const holderStack = [...stack, scope];
        const itemOptions = resolveOptions(holderStack, ctx);
        const stamp = repeatItems(repeat, scope, (p, v, forItem) =>
            getValue(p, v, (forItem && repeat.of !== undefined && repeat.of !== '?.' ? itemOptions : options) as any));
        const itemStack = stamp.pushesHolder ? holderStack : stack;
        for (const item of stamp.items) renderChild(repeat.each, item, itemStack);
        if (stamp.empty !== undefined) renderChild(stamp.empty, scope, stack);
    } else if (nested) {
        inner += `<!--?start name="${escapeAttr(nested.markerName ?? 'tree')}"-->`;
        for (const entry of mapEntries(nested.map, scope, nested.keepNullish)) {
            renderChild(entry.spec, entry.value, [...stack, scope]);
        }
        inner += '<!--?end-->';
    } else {
        for (const childSpec of children) renderChild(childSpec, scope, stack);
    }

    if (pending) attrs.set(PENDING_ATTRIBUTE, '');

    let html = `<${tag}`;
    for (const [name, text] of attrs) html += text === '' ? ` ${name}` : ` ${name}="${escapeAttr(text)}"`;
    html += '>';
    if (VOID_TAGS.has(tag)) return { html, elements: 1 };
    // As in builtIns.tree, an element's own text comes first, then its children
    return { html: html + (content ?? '') + inner + `</${tag}>`, elements: 1 };
}

/**
 * Construct a manager as the client would (see assign-gingerly's ish): with a static onAssigned,
 * no initVals and onAssigned(instance, value); otherwise initVals = a copy of the value. Only the
 * synchronous part of an async onAssigned counts on the server; its promise is dropped.
 */
function constructManager(Manager: O2HManager, value: any, path: number[], ctx: Context): any {
    const managerCtx = { rebind() {} };
    try {
        if (typeof Manager.onAssigned !== 'function') return new Manager(null, Object.assign({}, value), managerCtx);
        const instance = new Manager(null, undefined, managerCtx);
        const result = Manager.onAssigned(instance, value, { element: null, initial: true, ...managerCtx });
        if (result && typeof result.then === 'function') result.then(undefined, () => {});
        return instance;
    } catch {
        ctx.unrendered.push({ path, key: 'ish (the manager threw on the server; its subtree renders from the raw value)' });
        return value;
    }
}

/** Resolve an RHS value: a `?.` path, a $parent / $root reference, a sync protocol … or a literal. */
function resolveRHS(raw: any, scope: any, options: ResolveOptions): any {
    return getValues({ value: raw }, scope, options as any).value;
}

/**
 * Keys with no direct HTML form (ternaries, join …): assignFrom applies them to a plain object,
 * and what it set is rendered. Anything it can't do is reported, not guessed.
 */
function evaluateOther(
    key: string, raw: any, scope: any, options: ResolveOptions,
    setProperty: (name: string, value: any) => void, path: number[], ctx: Context
): void {
    const scratch: Record<string, any> = {};
    try {
        assignFrom(scratch, { [key]: raw }, { ...options, from: scope } as any);
    } catch {
        ctx.unrendered.push({ path, key });
        return;
    }
    const names = Object.keys(scratch);
    if (names.length === 0) ctx.unrendered.push({ path, key });
    for (const name of names) setProperty(name, scratch[name]);
}

/** microJoin's content, as the op renders it: text, and <span> / <data value> / <time datetime> per value. */
function renderMicroJoin(config: any, scope: any, options: ResolveOptions, attrs: Map<string, string>): string {
    const { microJoin: args } = getValues(config, scope, options as any);
    const { items, shapes } = planMicroJoin(args, config.microJoin, options.protocols);
    if (!attrs.has('itemscope') && items.some(item => typeof item !== 'string' && item.prop !== undefined)) attrs.set('itemscope', '');
    let html = '';
    items.forEach((item, i) => {
        if (typeof item === 'string') {
            html += escapeText(item);
            return;
        }
        const { tag, attr, attrValue, text } = shapes[i]!;
        html += `<${tag}`;
        if (item.prop !== undefined) html += ` itemprop="${escapeAttr(item.prop)}"`;
        if (attr) html += ` ${attr}="${escapeAttr(attrValue)}"`;
        html += `>${text ? escapeText(text) : ''}</${tag}>`;
    });
    return html;
}
