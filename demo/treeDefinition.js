// The tree definition for the demo: a copy of assign-gingerly's demos/tree-demo.html definition
// (pipes, itemscope managers, the tree`…` map), expected to drift from it as o2h issues are worked through.
// Importable both in a browser (with an import map for 'assign-gingerly/') and on a server.

import { tree, each, choose } from 'assign-gingerly/DX/tree.js';

/** Where the managers report (the demo page sets it). */
let log = () => {};
export function setLog(fn) { log = fn; }

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Flight events; the initial status shows the first two (as tree-demo.html's first phase does). */
const events = [
    { t: -3600, kind: 'note', label: 'Propellant load started' },
    { t: -600, kind: 'milestone', label: 'Terminal count' },
];

/**
 * The UI state tree-demo.html overlays on the API response, in its initial phase, so the
 * mission card and the timeline render too.
 */
export function initialVm(response) {
    return {
        ...response,
        mission: { phase: 'scheduled', window: response.date_utc, countdown: 600 },
        timeline: events,
    };
}

/** Stateless formatters, usable as path segments: '?.date_utc?.parseDate?.longUtc' */
export const pipes = {
    parseDate: Date.parse,
    longUtc: new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }).format,
    /** Seconds → m:ss */
    clock: s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
    /** Seconds from liftoff → T−m:ss / T+m:ss */
    tPlus: t => `T${t < 0 ? '−' : '+'}${pipes.clock(Math.abs(t))}`,
    km: n => `${n} km`,
    kmh: n => `${n.toLocaleString('en-US')} km/h`,
    coreSummary: ({ serial, flight, reused, landing_success, landing_type }) =>
        `${serial}, flight ${flight}${reused ? ' (reused)' : ''}; landing: ${landing_success ? 'success' : 'not successful'} (${landing_type})`,
};

/**
 * View model for the rocket card: the raw rocket object is merged in, and the card's
 * patterns read these getters. `metric` is per-card state; setting it calls ctx.rebind().
 */
export class RocketManager {
    static is = 'rocket-manager';
    #metric = true;
    #extraMeters = 0;
    #rebind;
    constructor(element, initVals, { rebind }) {
        Object.assign(this, initVals);
        this.#rebind = rebind;
    }
    get metric() { return this.#metric; }
    set metric(value) {
        this.#metric = value;
        this.#rebind();
    }
    /** Called by the "Increase by one" button: { on: 'click', call: 'increaseHeightByOne' } */
    increaseHeightByOne() {
        this.#extraMeters++;
        log('RocketManager.increaseHeightByOne', `+${this.#extraMeters} m → ctx.rebind()`);
        this.#rebind();
    }
    get title() { return `Rocket: ${this.name}`; }
    get heightLabel() {
        const { meters, feet } = this.height;
        const extra = this.#extraMeters;
        return this.#metric ? `${meters + extra} m` : `${+(feet + extra * 3.28084).toFixed(1)} ft`;
    }
    get massLabel() {
        return this.#metric ? `${this.mass.kg.toLocaleString('en-US')} kg` : `${this.mass.lb.toLocaleString('en-US')} lb`;
    }
    get enginesLabel() {
        const { number, type, version, propellant_1, propellant_2 } = this.engines;
        return `${number} × ${type} ${version} (${propellant_1} / ${propellant_2})`;
    }
}

/** View model for the links bar, with an async onAssigned ("verifying…", then "✓ verified"). */
export class LinksManager {
    static is = 'links-manager';
    linkList = [];
    state = 'verifying';
    static async onAssigned(instance, links) {
        instance.linkList = Object.entries(links)
            .filter(([, href]) => typeof href === 'string') // wikipedia: null → skipped
            .map(([name, href]) => ({ name, href }));
        instance.state = 'verifying';
        const label = links.webcast?.split('/').pop();
        log('LinksManager.onAssigned', `verifying ${label}…`);
        await delay(600); // simulated link check
        instance.state = 'verified';
        log('LinksManager.onAssigned', `${label} verified`);
    }
    get className() { return `links ${this.state}`; }
}

/** The managers, by the names the tree uses. */
export const managers = { [RocketManager.is]: RocketManager, [LinksManager.is]: LinksManager };

/** A label/value row; `action` is an optional element placed right after the label (null → nothing). */
const spec = (label, value, action = null) => tree`
    <div class="spec">
        <span class="label">${label}</span>
        ${action}
        <span>${value}</span>
    </div>`;

/** The tree config: what builtIns.tree takes (minus `do`), and what o2h renders. */
export const config = {
    // details may be null: keep its <p> and show a placeholder instead
    keepNullish: true,
    // _ covers textContent inside the pattern objects spread below
    aka: { _: 'textContent' },
    map: {
        patch: tree`<img class="patch" src=${'?.small'} alt=${'?.alt'} width="112" height="112">`,
        name: tree`<h2 class="name">${'?.'}</h2>`,
        // Hangs off `success`, and reads its sibling `upcoming` from the VM via $parent
        success: tree`<span ${{
            '_ ?=': ['$parent?.upcoming', 'Upcoming', ['?.', 'Success', 'Failure']],
            'className ?=': ['$parent?.upcoming', 'badge pending', ['?.', 'badge ok', 'badge bad']],
        }}></span>`,
        // Text mixed with ${…} becomes a microJoin: the formatted date in its own element, then " UTC"
        date_utc: tree`<time class="date" .dateTime=${'?.'}>${'?.parseDate?.longUtc'} UTC</time>`,
        details: tree`<p ${{
            '_ ?=': ['?.', '??', 'No details provided.'],
            'className ?=': ['?.', 'details', 'details empty'],
        }}></p>`,
        // A switch: one card per phase
        mission: choose('?.phase', {
            scheduled: tree`
                <section class="card mission scheduled">
                    <h3>Scheduled</h3>
                    <p>Window opens ${'?.window?.parseDate?.longUtc'} UTC</p>
                    <p class="big">T−${'?.countdown?.clock'}</p>
                </section>`,
            hold: tree`
                <section class="card mission hold">
                    <h3>Hold</h3>
                    <p>${'?.reason'}</p>
                    <p class="big">Resuming in ${'?.resumeIn'} min</p>
                </section>`,
            inFlight: tree`
                <section class="card mission in-flight">
                    <h3>In flight: ${'?.stage'}</h3>
                    ${spec('Altitude', '?.altitude?.km')}
                    ${spec('Speed', '?.speed?.kmh')}
                </section>`,
            success: tree`
                <section class="card mission success">
                    <h3>Mission success</h3>
                    ${spec('Orbit', '?.orbit')}
                    ${spec('Booster', '?.landing')}
                </section>`,
            scrubbed: tree`
                <section class="card mission scrubbed">
                    <h3>Scrubbed</h3>
                    <p>${'?.reason'}</p>
                    <p>Next attempt: ${'?.newDate?.parseDate?.longUtc'} UTC</p>
                </section>`,
            failure: tree`
                <section class="card mission failure">
                    <h3>Mission failure</h3>
                    <ul ${each('?.reasons', { key: '?.time' })}><li>T+${'?.time'}s: ${'?.reason'}</li></ul>
                </section>`,
        }, tree`
            <section class="card mission unknown">
                <h3>Status unknown</h3>
                <p class="muted">No case for this status, so the fallback is shown.</p>
            </section>`),
        // The links bar's patterns read the LinksManager instance (className, linkList)
        links: tree`
            <nav ish="links-manager" class=${'?.className'} aria-label="Launch links">
                <ul ${each('?.linkList', { key: '?.name' })}>
                    <li><a href=${'?.href'} target="_blank" rel="noopener">${'?.name'}</a></li>
                </ul>
            </nav>`,
        // The rocket card's patterns read RocketManager getters; the button calls the manager
        rocket: tree`
            <section ish=${RocketManager.is} class="card rocket">
                <h3>${'?.title'}</h3>
                ${spec('Height', '?.heightLabel', tree`
                    <button type="button" class="inc" @click=${{ call: 'increaseHeightByOne' }}>Increase by one</button>`)}
                ${spec('Mass', '?.massLabel')}
                ${spec('Engines', '?.enginesLabel')}
            </section>`,
        crew: tree`
            <section class="card crew">
                <h3>Crew</h3>
                <ul ${each('?.', { key: '?.name' })}>
                    <li>
                        <strong>${'?.name'}</strong>
                        <span> — ${'?.role'}</span>
                        <small>${'?.agency'}</small>
                    </li>
                </ul>
            </section>`,
        cores: tree`
            <section class="card cores">
                <h3>First-stage cores</h3>
                <ul ${each('?.', { key: '?.serial' })}><li>${'?.coreSummary'}</li></ul>
            </section>`,
        failures: tree`
            <section class="card failures">
                <h3>Failures</h3>
                <ul ${each('?.', {
                    key: '?.time',
                    empty: tree`<li class="muted">No failures recorded.</li>`,
                })}>
                    <li>T+${'?.time'}s: ${'?.reason'}</li>
                </ul>
            </section>`,
        // A switch as each()'s item: every event kind gets its own markup
        timeline: tree`
            <section class="card timeline">
                <h3>Flight timeline</h3>
                <ol ${each('?.', { key: '?.t' })}>
                    ${choose('?.kind', {
                        milestone: tree`<li class="milestone"><span class="t">${'?.t?.tPlus'}</span><strong>${'?.label'}</strong></li>`,
                        anomaly: tree`
                            <li class="anomaly">
                                <span class="t">${'?.t?.tPlus'}</span>
                                <strong>${'?.label'}</strong>
                                <em>${'?.detail'}</em>
                            </li>`,
                    }, tree`<li class="note"><span class="t">${'?.t?.tPlus'}</span><span>${'?.label'}</span></li>`)}
                </ol>
            </section>`,
    },
};
