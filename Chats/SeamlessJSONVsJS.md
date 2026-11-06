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

## Bruce's Response I

> 2. **Shall I keep the benchmark?**

Yes, please move to o2h/demo/benchmark/

> 1. **Shall I make the manager fix** 

Yes, please do.

Can you also document how to manage this transition if it isn't already?

## Claude's Implementation Notes I

**All three are done:** a manager named in JSON now hydrates with no code on the page beyond its own file, the store has one as a real example, the transition is documented, and the benchmark is in `o2h/demo/benchmark/`.

### The fix

[worker/edge.ts](../worker/edge.ts): `hydrateO2H` and `renderO2HOnPage` now both make the itemscope registry from `options.managers`, once per `managers` object. A `registry` you pass still wins. So `renderViaEdge` and `o2hRenderer()` get this too.

[tests/managers.html](../tests/managers.html) is the new test, run in all three browsers: the worker's HTML from a stored transform, hydrated with nothing but the options, live after a click, the JSON passed back and rendered on the page, a second hydration, and a given registry winning.

### The real example

The store's product page has a quantity stepper, in [productView.js](../../o2h-edge/demo/store/productView.js). How many to add is per-view state, so it really does need code. The app stays JSON: the config has `ish="product-view"`, and `options.managers` has the reference.

- **This replaces the data-only Add to cart binding.** It had to, since the amount now comes from the manager. The cart's −/+ buttons still use data bindings, so the store shows both ways.
- **[cart.js](../../o2h-edge/demo/store/cart.js):** `cart-add` now takes a `quantity`, defaulting to 1.
- **The worker now leaves part of the page pending.** It renders the product, and the stepper and button appear on hydration. `.buy` has a minimum height, so the page doesn't shift.

### The docs

- **[navigate-gingerly/README.md](../../navigate-gingerly/README.md), new "Adding code to a JSON app":** the main walkthrough. It has the three steps, what happens to the code at each stage, what visitors see, when you don't need code at all, the rules, and how to merge code by hand for bundlers (your "separately merge" idea, which needs no new API).
- **[o2h/README.md](../README.md), new "Keeping the config JSON":** the same for `renderViaEdge`, without an app. I also updated the `managers` row, and what hydration does.
- **[o2h-edge/README.md](../../o2h-edge/README.md):** the store's new manager.

### The benchmark

It's in [demo/benchmark/config-formats/](../demo/benchmark/config-formats/), with a copy of the store's `app.json`:

- **`npm run bench:config`** runs everything, in about 10 minutes. `-- --only=parse,memory` runs less, and `--config=path.json` tries another app.
- **`npm run bench:config -- --serve`** is for a real phone, on your local network until you stop it. It prints an address for [phone.html](../demo/benchmark/config-formats/phone.html). Run it twice, since the second run shows repeat visits. It runs in all three browsers and fits a 375 px screen, but I haven't tried it on a real phone.

The README has a short summary of the findings.

### A correction to my response

I wrote that reading from IndexedDB was 2 to 3 times faster than a local fetch in Firefox. **That doesn't hold up.** In the phone page, which keeps one page running, Firefox's IndexedDB read was slower than fetch (about 7 to 11 ms against 3). My first figures came from fresh navigations, where a page's first fetch carries extra cost in Firefox. So treat IndexedDB against fetch as undecided: it depends on the browser and on how you measure.

Also, the store's config grew with the stepper, so running the benchmark now gives somewhat higher figures than my tables (the memory at 100×, for one). The ratios look the same.

### Something I found, and didn't change

**A `data-pending` mark can come off before the element's listener is attached.** `bindEvent` in [assignGingerly.ts](../../assign-gingerly/assignGingerly.ts) runs a dynamic `import()` for every binding, so a listener is always at least a task late, and the first time it also has to wait for the module to download.

My test caught this with a click right after `hydrate` resolved: the click was lost, the button was already visible, and the listener arrived about 8 to 11 ms later, here on localhost. It isn't new, and it isn't specific to managers. **On a slow phone's first visit, it could last as long as fetching that module.** That's rare, but a lost tap on a button that looks ready is the kind of thing your target users would hit.

The test now waits with `whenEventsBound`, which exists for this. A real fix would be in assign-gingerly: cache the module, as `loadHandlerCommands` does, and keep the mark until the listener is on. I can do that if you'd like.

### Checked

These ran in a mirror of the workspace, with assign-gingerly's Playwright, since o2h's 1.65 has no browsers here (`npx playwright install` fixes that).

- **o2h:** all pass, 27 across the three browsers (24 Node tests skipped by design, as they run once).
- **o2h-edge:** `npm test` 22 of 22, and `tsc` is clean.
- **The store, in Chromium, Firefox and WebKit, through the real worker:**
  - The stepper goes up and down, and stops at 1. The price follows ($22.30, $66.90, $44.60).
  - Adding 3 puts 3 in the cart, and the stepper goes back to 1.
  - It works after in-app navigation too.
  - The cart's checks are unchanged: $100.59, $78.29, $0.00.
  - No page errors, and no sideways scrolling at 375 px (Chromium).

**Mistakes of mine that testing caught:** I first named the stepper `.quantity`, which the cart already uses, so the CSS leaked into the cart. It's `.stepper` now.

**Changed:**
- **o2h:** `worker/edge.ts` and `.js`, `tests/managers.html`, `tests/o2h.spec.ts`, `package.json` (`bench:config`), `demo/benchmark/config-formats/`, and the README.
- **o2h-edge:** `demo/store/` (`productView.js`, `app.mjs`, `app.json`, `cart.js`, `index.html`) and the README.
- **navigate-gingerly:** the README.

**To publish:** o2h first, because o2h-edge's store needs this `edge.js`. Locally, o2h-edge uses the sibling repo, so it works now. Nothing is committed.
