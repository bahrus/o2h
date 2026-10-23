// Runs each approach page in Chromium, Firefox and WebKit, each run in a fresh browser context (empty cache and
// IndexedDB, top-level navigation, not an iframe), and prints medians.
// Run from o2h's folder, with the workspace (or o2h) served:
//   node demo/benchmark/json/run.mjs [baseURL] [runs] [data]
//   default baseURL: http://localhost:8000/o2h/demo/benchmark/json/   default runs: 15
//   data: shoelace (default, ~650 KB) or shoelace-x10 (~6.3 MB)
import { chromium, firefox, webkit } from 'playwright';
import { execFileSync } from 'node:child_process';

const base = process.argv[2] ?? 'http://localhost:8000/o2h/demo/benchmark/json/';
const runs = Number(process.argv[3] ?? 15);
const data = process.argv[4] ?? 'shoelace';
const x10 = data === 'shoelace-x10';
const q = x10 ? `?data=${data}` : '';
// Optional: throttle Chromium's CPU (e.g. 4: roughly a mid-range phone); other browsers can't be throttled
const throttle = Number(process.argv[5] ?? 1);
execFileSync(process.execPath, [new URL('./embed.mjs', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], { stdio: 'inherit' });

const approaches = [
    { name: '0  baseline (no data)', pages: ['baseline.html'] },
    { name: '1  fetch + json()', pages: [`fetch-json.html${q}`] },
    { name: '1b fetch + text() + JSON.parse', pages: [`fetch-text.html${q}`] },
    { name: '2  embedded + JSON.parse', pages: [x10 ? 'embedded-x10.html' : 'embedded.html'] },
    { name: '3a worker, posted back', pages: [`worker-clone.html${q}`] },
    { name: '3b worker → IndexedDB (cold)', pages: [`worker-idb.html${q}`] },
    { name: '3b IndexedDB read (warm)', pages: [`worker-idb.html${q}`, `worker-idb.html${q ? `${q}&` : '?'}warm`] },   // the last page is the one measured
];
const median = xs => {
    const sorted = xs.filter(x => x != null).sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
};
const ms = x => x == null ? '   n/a' : x.toFixed(1).padStart(6);

for (const type of throttle > 1 ? [chromium] : [chromium, firefox, webkit]) {
    const browser = await type.launch();
    console.log(`\n${type.name()} ${data}${throttle > 1 ? `, CPU ${throttle}× slower` : ''} (medians of ${runs} runs; ms)`);
    console.log(`  ${'approach'.padEnd(32)} ${'ready'.padStart(6)} ${'step'.padStart(6)} ${'frame gap'.padStart(9)} ${'longest task'.padStart(12)} ${'blocking'.padStart(8)} ${'first paint'.padStart(11)}`);
    for (const { name, pages } of approaches) {
        const results = [];
        for (let i = 0; i < runs; i++) {
            const context = await browser.newContext();
            const page = await context.newPage();
            if (throttle > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
            let result;
            for (const path of pages) {
                await page.goto(base + path);
                result = await page.waitForFunction(() => window.benchmarkResult, null, { timeout: 60000 }).then(h => h.jsonValue());
            }
            results.push(result);
            await context.close();
        }
        const m = key => median(results.map(r => r[key]));
        console.log(`  ${name.padEnd(32)} ${ms(m('ready'))} ${ms(m('step'))} ${ms(m('maxFrameGap')).padStart(9)} ${ms(m('longestTask')).padStart(12)} ${ms(m('totalBlocking')).padStart(8)} ${ms(m('firstPaint')).padStart(11)}`);
    }
    await browser.close();
}
