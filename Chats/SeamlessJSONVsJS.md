# Seamless JSON vs JS Transition

## Bruce's Ask

Part (but not all) of my preference for JSON over JS is that I think it is faster to parse.  Holding it in indexedDB may also be a better use of limited RAM.

Can you do any performance benchmark tests to measure these differences to see if they are significant?

The issue is that the moment we have, say, a single itemscopeManager, we have to totally switch gears, switch the whole config from JSON to JS.  And then we strip out the JS before passing it to o2o-edge.  I wonder if you can think of an easy to understand alternative where we still import JSON, insert placeholders before passing to o2o-edge, and separately merge in the JS as needed?

Please add your thoughts below.

## Claude's Response

**Short answers:**
- **Is JSON faster to parse?** Yes, 3 to 12 times faster than a JS literal. But your real configs are so small that it doesn't matter, and on repeat visits in Chromium the JS version actually loaded faster.
- **Does IndexedDB save RAM?** Only if the page doesn't also keep a copy, and fetching and dropping saves as much. The amounts are a few KB.
- **Do you have to switch the config to JS for one manager?** No. The placeholders you describe already exist, as `{ import, export }` references. One small gap stops them working for managers, and it's a small fix.

So I'd keep JSON, for its other benefits (below), not for performance.

### What I measured

The config is the store's real `app.json`, plus copies scaled to 10× and 100× its routes. Each load number is the median of 15 runs, in headless browsers on this desktop. "Repeat" means a profile on disk that had already visited 4 times.

| Size of the config | On disk | Minified | Gzipped |
|---|---|---|---|
| The store, as built | 27 KB | 4 KB | 1.4 KB (0.7 KB minified) |
| 100× the store | | 377 KB | 4 KB |

**Pure parsing, in ms** (no network or module system):

| | Store: `JSON.parse` | JS literal | structured clone | 100×: `JSON.parse` | JS literal | structured clone |
|---|---|---|---|---|---|---|
| Chromium | 0.02 | 0.05 | 0.03 | 0.9 | 5.3 | 2.8 |
| Firefox | 0.02 | 0.18 | 0.06 | 1.0 | 6.6 | 3.6 |
| WebKit | 0.02 | 0.10 | 0.04 | 0.5 | 6.8 | 5.2 |

So you're right about the ratio. But the real config costs about a tenth of a millisecond either way.

**Whole load, in ms:** `import` of a JSON module against a JS module (JSON / JS):

| | Store, first visit | Store, repeat | 100×, first visit | 100×, repeat |
|---|---|---|---|---|
| Chromium | 2.7 / 4.8 | 1.3 / **0.6** | 5.0 / 12.7 | 7.1 / **2.5** |
| Chromium, CPU slowed 6× | 26 / 30 | 15 / **9** | 39 / 36 | 51 / **19** |
| Firefox | 24 / 23 | 20 / 18 | 31 / 39 | 21 / 25 |
| WebKit | 15 / 15 | 15 / 10 | 16 / 24 | 10 / 19 |

- **The surprise, in bold:** in Chromium, JS won on repeat visits at every size. V8 keeps compiled code for scripts, and JSON has no equivalent. The returning visitor is the common case, so "JSON is faster" isn't a safe rule here.
- **Firefox and WebKit:** at the store's size, the differences are within what I can resolve, since most of those numbers are the browser's own overhead (fetching the same text alone took 28 ms in Firefox and 15 ms in WebKit). JSON only wins clearly at 100×, in WebKit.
- **A slow phone:** even at 6× slower, the difference at the store's size is about 4 to 6 ms, in either direction.

**Memory, in Chromium:** what's retained after a forced garbage collection, by Chrome's own per-page memory API. An empty page measures about 477 KB.

| Retained beyond an empty page | Store (4 KB) | 10× | 100× |
|---|---|---|---|
| JS module | 22 KB | 143 KB | 1,343 KB |
| JSON module | 13 KB | 66 KB | 592 KB |
| `fetch` + parse, kept | 14 KB | 67 KB | 593 KB |
| `fetch` + parse, dropped | 2 KB | 2 KB | 2 KB |
| Read from IndexedDB, dropped | 8 KB | 8 KB | 8 KB |

- **JSON does use less than JS,** by about 1.7 to 2.3 times. For the store, that's 9 KB.
- **`import` never lets go.** A JSON module with no variable holding it costs the same as keeping it, because the browser's module map holds it for the life of the page. That's what makes your RAM point harder to realize.
- **IndexedDB's saving comes from dropping the object,** not from IndexedDB. Fetching and dropping leaves even less behind. A page that keeps what it read saves nothing, and `mirror` keeps `app`, for hydration.
- **Reading from IndexedDB** was about 2 to 3 times faster than a local fetch in Chromium and Firefox, and about twice as slow in WebKit. A real network would change the fetch side a lot, and I had none here. Storing an object or a string to parse made no consistent difference at real sizes.

**Limits of these numbers:**
- It's one desktop and localhost, with no real network.
- The 6× slowdown is simulated, and only in Chromium. It isn't a real phone.
- Memory was measured right after loading. V8 can discard unused compiled code later, so JS's figure may fall over time.
- The scaled copies are repetitive, so a truly large app could differ.

**A side finding:** app.json is 85% whitespace. gzip removes most of that, leaving a difference of about 700 bytes. Minifying would be a cheap gain, if you don't mind less readable output.

### Why JSON is still right

These reasons outweigh the milliseconds, and none depend on speed:
- **It can travel:** a worker and IndexedDB can take it, and they can't take code.
- **It's safe to accept:** the worker takes installed apps from anyone because they're data. It never runs them.
- **The key comes from the content,** so the same config gets the same key.

### The placeholders already exist

Most of your design is already there:

```json
{
    "routes": [{ "pattern": "/", "config": { "map": { "data": [{ "tag": "section", "ish": "greeter-view" }, "…"] } } }],
    "options": {
        "pipes": {
            "usd": { "intl": "NumberFormat", "locale": "en-US", "options": { "style": "currency", "currency": "USD" } },
            "shout": { "import": "./greeter.js", "export": "shout" }
        },
        "managers": { "greeter-view": { "import": "./greeter.js", "export": "GreeterView" } }
    }
}
```

The config itself stays pure data, and the manager is just a name (`ish="greeter-view"` in tree notation). What happens next is automatic:

1. `resolveModules` loads the code into `options`, on the page.
2. `prepareApp` replaces it with stand-ins (`{ "$o2hLost": "manager", "name": "greeter-view" }`) before anything reaches o2h-edge.
3. The worker renders everything else, and marks the rest `data-pending`.
4. The page hydrates with the real code.

Nobody strips anything by hand. The one thing that does force code into the config is passing a class directly (`ish=${RocketManager}`), and the name form avoids that.

### The gap

**I tested exactly this, from a real JSON file, and managers fail on the last step.** `hydrateO2H` passes only `options.pipes` to the page, so the loaded manager is dropped, and hydration looks for a `registry` nobody gave it:

| | Today | With a registry made from `options.managers` |
|---|---|---|
| Hydration | Throws `builtIns.tree: no itemscope registry is available` | Works |
| The manager's `<h2>` | Empty | `Ada: 0`, then `Ada: 1` after a click |
| The function pipe | Empty | `Ada!` |
| Still pending | 3 | 0 |

The data pipe (`$22.30`) rendered in the worker in both. I passed the registry by hand for the right-hand column, which is what the fix would do.

**I suspect this gap is why it feels as if you must switch to JS.** Today you have to write `o2hRenderer({ registry: { itemscopeRegistry: new ItemscopeRegistry(managers) } })` yourself, in code.

**The fix:** `hydrateO2H` and `renderO2HOnPage` make that registry from `options.managers` themselves, when none is given, once per `managers` object. Then a JSON app with a manager needs no code on the page beyond the manager's own file.

### Alternatives I'd skip for now

**A separate code object,** passed in beside the JSON:

```js
mirror({ app, code: { managers: { 'greeter-view': GreeterView }, pipes: { shout } }, … });
```

This is closest to what you describe, and it has one real advantage: bundlers can see those imports, and they can't see `{ import }` strings. But the JSON would no longer say what the app needs, and a missing name fails silently. I tested that: with no entry for `shout`, the worker rendered `<p class="loud"></p>`, with no pending mark, and reported nothing. A reference at least says "code goes here", and a missing export throws, naming the path.

I'd add this only when a bundled app needs it. It would merge into `options` before `prepareApp`, so everything after that stays the same.

**Loading code per route:** `resolveModules` loads every reference when the app starts, even for routes that don't use it. That's worth revisiting if an app has heavy managers on a few routes, but I haven't measured it.

### Your call

1. **Shall I make the manager fix** in o2h's `worker/edge.ts`, with a test, and add a manager to a demo as a real example?
2. **Shall I keep the benchmark?** It's in my scratchpad, and could move to `o2h/demo/benchmark/`, so you can rerun it, including on a real phone.

The only repo file I changed is this document.
