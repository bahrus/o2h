// Shared measurement for the JSON loading benchmark. A classic script, loaded first (in <head>), so it
// watches the whole page load: the gaps between animation frames (jank, in every browser) and long tasks
// (Chromium). A page calls benchmarkDone({ step }) once its data is ready; the result lands on
// window.benchmarkResult (for run.mjs) and in #result (for people).
(() => {
    const gaps = [];
    let last = performance.now();
    let running = true;
    const frame = now => {
        gaps.push(now - last);
        last = now;
        if (running) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    const longTasks = [];
    try {
        new PerformanceObserver(list => {
            for (const entry of list.getEntries()) longTasks.push(entry.duration);
        }).observe({ type: 'longtask', buffered: true });
    } catch {
        // No Long Tasks API (Firefox, WebKit): frame gaps only
    }

    // First contentful paint, observed from the start (it may be reported after the data is ready)
    let firstPaint = null;
    let paintSeen;
    const painted = new Promise(resolve => { paintSeen = resolve; });
    try {
        new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
                if (entry.name === 'first-contentful-paint') { firstPaint = entry.startTime; paintSeen(); }
            }
        }).observe({ type: 'paint', buffered: true });
    } catch {
        paintSeen();   // no Paint Timing API
    }

    const ms = x => x == null ? 'n/a' : `${x.toFixed(1)} ms`;

    /** Call once the data is ready (parsed, on the main thread). `step`: the main thread's own part, in ms. */
    window.benchmarkDone = async (detail = {}) => {
        const ready = performance.now();
        // Two more frames, so a task that blocked the main thread shows up as a frame gap
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        // …and the first paint's report, if it hasn't come yet (at most 10 s)
        await Promise.race([painted, new Promise(resolve => setTimeout(resolve, 10000))]);
        running = false;
        const result = {
            ready,                                                    // ms since navigation start
            maxFrameGap: gaps.length ? Math.max(...gaps) : null,      // the longest the page couldn't paint
            longestTask: longTasks.length ? Math.max(...longTasks) : (window.PerformanceObserver?.supportedEntryTypes?.includes('longtask') ? 0 : null),
            totalBlocking: longTasks.reduce((sum, d) => sum + Math.max(0, d - 50), 0),
            // When the page first showed content (ms since navigation start)
            firstPaint,
            ...detail,
        };
        window.benchmarkResult = result;
        const out = document.getElementById('result');
        if (out) {
            out.textContent = `Data ready after ${ms(result.ready)} (since navigation start)\n`
                + `Main thread's own step: ${ms(result.step)}\n`
                + `Longest gap between frames: ${ms(result.maxFrameGap)}\n`
                + `Longest task: ${ms(result.longestTask)}${result.longestTask == null ? ' (no Long Tasks API in this browser)' : ''}\n`
                + `Total blocking time: ${ms(result.totalBlocking)}\n`
                + `First contentful paint: ${ms(result.firstPaint)}`
                + (detail.note ? `\n${detail.note}` : '');
        }
    };
})();
