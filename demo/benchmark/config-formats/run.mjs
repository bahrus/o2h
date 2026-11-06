// Is a config cheaper as JSON or as JS? Load time (first visit and repeat), parsing alone, and retained memory, in
// Chromium, Firefox and WebKit, for a real app's JSON and scaled copies of it. See the README's Benchmarks section.
//
//     node demo/benchmark/config-formats/run.mjs                       everything: about 10 minutes
//     node demo/benchmark/config-formats/run.mjs --only=parse,memory   parse, memory, chromium, chromium6x, firefox, webkit
//     node demo/benchmark/config-formats/run.mjs --samples=5           fewer runs of each (default 15)
//     node demo/benchmark/config-formats/run.mjs --config=path.json    another app (default: a copy of o2h-edge's store)
//     node demo/benchmark/config-formats/run.mjs --serve               no browsers: serves phone.html, for a real phone
//
// --serve listens on your local network, serving only these generated files, until you stop it.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
    const [key, value = true] = arg.replace(/^--/, '').split('=');
    return [key, value];
}));
const PORT = Number(args.port ?? 8041);
const SAMPLES = Number(args.samples ?? 15);
const only = args.only?.split(',');
const configPath = args.config ?? path.join(here, 'app.json');

// The payloads: the file as it is, then minified, 10× and 100× (more routes, each a copy)
const original = fs.readFileSync(configPath, 'utf8');
const app = JSON.parse(original);
const scaled = n => ({ ...app, routes: Array.from({ length: n }, (_, i) => app.routes.map(r => ({ ...r, pattern: `/${i}${r.pattern}` }))).flat() });
const payloads = { disk: original, x1: JSON.stringify(app), x10: JSON.stringify(scaled(10)), x100: JSON.stringify(scaled(100)) };
const SIZES = Object.keys(payloads);

const files = {};
for (const [name, text] of Object.entries(payloads)) {
    files[`/p/${name}.json`] = [text, 'application/json'];
    files[`/p/${name}.js`] = [`export default ${text};\n`, 'text/javascript'];
}
for (const page of ['bench.html', 'phone.html']) files[`/${page}`] = [fs.readFileSync(path.join(here, page), 'utf8'), 'text/html'];

const server = http.createServer((req, res) => {
    const file = files[new URL(req.url, 'http://x').pathname];
    if (!file) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {
        // Cacheable, so repeat visits are real ones. Isolated, for Chrome's memory API.
        'Content-Type': file[1], 'Cache-Control': 'public, max-age=3600', 'Last-Modified': 'Wed, 04 Nov 2026 00:00:00 GMT',
        'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp',
    });
    res.end(file[0]);
});

if (args.serve) {
    await new Promise(resolve => server.listen(PORT, args.host ?? '0.0.0.0', resolve));
    const addresses = Object.values(os.networkInterfaces()).flat().filter(a => a.family === 'IPv4' && !a.internal).map(a => a.address);
    console.log('Open one of these on the phone, on the same network (Ctrl+C to stop):');
    for (const address of addresses) console.log(`  http://${address}:${PORT}/phone.html`);
} else {
    await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
    await benchmark();
    server.close();
}

async function benchmark() {
    const { chromium, firefox, webkit } = await import('@playwright/test');
    const VARIANTS = ['fetchText', 'fetchParse', 'jsonModule', 'jsModule', 'idbObject', 'idbString'];
    const LABELS = { fetchText: 'fetch', fetchParse: 'fetch+parse', jsonModule: 'JSON module', jsModule: 'JS module', idbObject: 'IDB object', idbString: 'IDB string' };
    const MEMORY = ['none', 'jsonModule', 'jsModule', 'fetchKept', 'fetchDropped', 'idbDropped'];
    const url = query => `http://127.0.0.1:${PORT}/bench.html?${new URLSearchParams(query)}`;
    const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const shuffled = values => values.map(value => [Math.random(), value]).sort((a, b) => a[0] - b[0]).map(pair => pair[1]);
    const visit = async (page, query) => { await page.goto(url(query)); return page.evaluate(() => window.done); };
    const throttle = async (context, page, rate) => {
        if (rate > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate });
    };

    /** One browser's load times: a new context per first visit; one profile on disk, visited 4 times, for repeats. */
    async function loads(label, type, rate = 1) {
        const times = {};
        const add = (kind, size, variant, ms) => ((times[`${kind} ${size}`] ??= {})[variant] ??= []).push(ms);
        const browser = await type.launch();
        for (let i = 0; i < SAMPLES; i++) for (const size of SIZES) for (const variant of shuffled(VARIANTS)) {
            const context = await browser.newContext();
            const page = await context.newPage();
            await throttle(context, page, rate);
            if (variant.startsWith('idb')) await visit(page, { setup: 1, size });
            add('first', size, variant, (await visit(page, { variant, size })).ms);
            await context.close();
        }
        await browser.close();

        const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'config-formats-'));
        const context = await type.launchPersistentContext(profile);
        const page = await context.newPage();
        await throttle(context, page, rate);
        for (const size of SIZES) {
            await visit(page, { setup: 1, size });
            for (const variant of VARIANTS) for (let i = 0; i < 4; i++) await visit(page, { variant, size });
            for (let i = 0; i < SAMPLES; i++) for (const variant of shuffled(VARIANTS)) add('repeat', size, variant, (await visit(page, { variant, size })).ms);
        }
        await context.close();
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });

        console.log(`\n${label}: load, median ms`);
        console.table(Object.fromEntries(Object.entries(times).map(([key, row]) => [key,
            Object.fromEntries(VARIANTS.map(variant => [LABELS[variant], +median(row[variant]).toFixed(2)]))])));
    }

    /** Parsing alone, with no network or module system. */
    async function parsing() {
        const rows = {};
        for (const [name, type] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
            const browser = await type.launch();
            const page = await browser.newPage();
            for (const size of SIZES) rows[`${name} ${size}`] = await visit(page, { micro: 1, size });
            await browser.close();
        }
        console.log('\nParsing alone, median ms');
        console.table(rows);
    }

    /** What stays after a forced GC, beyond an empty page, by Chrome's own measure. The full browser has that API; the headless shell doesn't. */
    async function memory() {
        const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-blink-features=ForceEagerMeasureMemory'] });
        const bytes = {};
        for (const size of ['x1', 'x10', 'x100']) for (let i = 0; i < 9; i++) for (const variant of shuffled(MEMORY)) {
            const context = await browser.newContext();
            const page = await context.newPage();
            const session = await context.newCDPSession(page);
            await visit(page, { setup: 1, size });
            await visit(page, { mem: variant, size });
            for (let gc = 0; gc < 3; gc++) await session.send('HeapProfiler.collectGarbage');
            ((bytes[size] ??= {})[variant] ??= []).push(await page.evaluate(async () => (await performance.measureUserAgentSpecificMemory()).bytes));
            await context.close();
        }
        await browser.close();
        console.log('\nRetained beyond an empty page, KB (Chromium)');
        console.table(Object.fromEntries(Object.entries(bytes).map(([size, row]) => [size,
            Object.fromEntries(MEMORY.slice(1).map(variant => [variant, +((median(row[variant]) - median(row.none)) / 1024).toFixed(1)]))])));
    }

    console.log(`The config: ${original.length} bytes as it is, ${payloads.x1.length} minified, ${zlib.gzipSync(payloads.x1).length} minified and gzipped.`);
    const tasks = {
        parse: parsing,
        memory,
        chromium: () => loads('Chromium', chromium),
        chromium6x: () => loads('Chromium, CPU slowed 6×', chromium, 6),
        firefox: () => loads('Firefox', firefox),
        webkit: () => loads('WebKit', webkit),
    };
    for (const [name, task] of Object.entries(tasks)) if (!only || only.includes(name)) await task();
}
