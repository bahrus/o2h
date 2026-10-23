// Fetches and parses the JSON off the main thread, then either posts the object back (structured clone)
// or stores it in IndexedDB and says so.
import { put } from './idb.js';

self.onmessage = async ({ data: { mode, data: name = 'shoelace' } }) => {
    const t0 = performance.now();
    const response = await fetch(new URL(`../../data/${name}.json`, import.meta.url), { cache: 'no-store' });
    const data = await response.json();
    const parsed = performance.now() - t0;
    if (mode === 'clone') {
        self.postMessage({ data, parsed });
    } else {
        await put('shoelace', data);
        self.postMessage({ stored: true, parsed, total: performance.now() - t0 });
    }
};
