# Pipes Serialization Explanation

## Bruce's Ask

I was going through and updating the documentation of o2h, o2h-edge, navigate-gingerly a bit.

One point of confusion, that I still have is how far we've been able to go with making both the store and the bls demos, that the app.json has carried us so far without the need to embed JS.  This is a good thing, I'm not complaining, quite the opposite.  In particular, the app.json contains pipe data.  

I followed the way pipes uses:

```JS
const pipes = dataPipes({
    longUtc: { intl: 'DateTimeFormat', locale: 'en-US', options: { dateStyle: 'long', timeZone: 'UTC' } },
    kg:      { intl: 'NumberFormat', locale: 'en-US', options: { style: 'unit', unit: 'kilogram' } },
    phase:   { map: { hold: 'On hold', go: 'Go for launch' }, default: 'Unknown' },
    price:   { use: 'toFixed', args: [2] },
    when:    { chain: ['parseDate', 'longUtc'] },
    items:   { sum: '?.quantity' },
    clock:   s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,   // functions pass through
});
```

What is unclear in my mind is how the dataPipes function, which isn't serializable, isn't blocking the ability to define pipes as pure JSON in app.json. I image something is applying dataPipes to it somewhere, but that's what isn't unclear in my mind -- what layer is doing that?

Can you add the explanation for this in the appropriate README.md and/or docs/*.md to explain this?
## Claude's Response

**The short answer:** `dataPipes` was never in app.json, so it can't block anything. What's in app.json is only the object you'd pass to it: the descriptors. o2h applies `dataPipes` to them when the pipes are about to run, in two places.

The example in your ask has two parts, and only one is serializable:

```JS
const pipes = dataPipes({                                  // a function call: never stored
    usd: { intl: 'NumberFormat', locale: 'en-US', … },     // a descriptor: plain data, this is what app.json holds
});
```

### Which layer does it

**o2h does it,** not navigate-gingerly or o2h-edge. `dataPipes` is called in these places:

| Where | When | Layer |
|---|---|---|
| `reviveO2HTransform`, [worker/core.ts:100](../../worker/core.ts#L100) | The worker is about to render a stored transform | o2h, running inside o2h-edge's worker |
| `pipesOf`, [worker/edge.ts:150](../../worker/edge.ts#L150), used by `hydrateO2H` and `renderO2HOnPage` | The page hydrates the worker's HTML, or renders the VM itself | o2h, on the page (through `o2hRenderer()`) |
| [o2h-edge/demo/store/cart.js:47](../../../o2h-edge/demo/store/cart.js#L47) | The cart renders itself with `builtIns.tree`, outside o2h's steps | the demo's own code |

Everything before those points only copies the descriptors as data:
- **app.mjs / app.json:** neither calls `dataPipes`.
- **navigate-gingerly (`mirror`, `resolveModules`, `prepareApp`):** passes `options` along. It never mentions `dataPipes`. `resolveModules` touches only `{ import, export }` references.
- **`prepareO2HTransform`:** copies plain objects as they are. Its `PIPE_DESCRIPTOR` check is for the other case: a page that called `dataPipes` itself and hands over functions.

So the worker and the page each make their own functions from the same data. The functions never travel.

### Checked

I ran the store's real app.json through the two o2h steps, in Node:

| Step | `usd` is | |
|---|---|---|
| Parsed from app.json | an object | |
| After `prepareO2HTransform` | an object | 0 lost |
| After a JSON round trip, then `reviveO2HTransform` | a function | `usd(22.3)` → `$22.30`, and `total` of 2 × $22.30 → `$44.60` |

### Documented

- **[o2h/README.md](../../README.md), "Data pipes survive":** the full account, with a table following `usd` from app.json to rendering. It also covers pages that write their pipes in JavaScript, function pipes, and page code that renders on its own. I added aggregates to that section's list of kinds of data pipe. o2h is the right home, since it does the work.
- **[navigate-gingerly/README.md](../../../navigate-gingerly/README.md):** a bullet saying data pipes aren't code, so they need no module reference, with a link to o2h.
- **[assign-gingerly/docs/pipes.md](../../../assign-gingerly/docs/pipes.md):** a bullet saying the descriptors are what's serializable, and that with JSON you may never call `dataPipes` yourself.

o2h-edge's README already says data pipes run in the worker, and links to pipes.md, so I left it alone.

Nothing is committed.

## Bruce's Response I

Thanks for the explanation.

What is going through my mind now is this:

The ability to extend an extra mile of JSON serializable configuration isn't limited to o2h.  assign-gingerly's assignFrom third argument (options), while it is understood it can certainly have JS functions in it, would still benefit in some cases to support covering more use cases if the third argument can be JSON serializable in more cases.

Would it make sense to support another option, 'dataPipes" that does the same kind of translation (applying the dataPipes function to it)?

Granted, this could cause a bit of confusion to support both "pipes" and "dataPipes", perhaps you have some thoughts on that.

This might also make the dataflow a little easier to understand, if o2h simply piggybacks on dataPipes?

What are your thoughts?


## Claude's Response I

**Yes to the goal, and yes, o2h can piggyback on it. But I'd keep one option, `pipes`, and let it hold descriptors, rather than add a `dataPipes` option.** Nothing here is implemented yet.

### Why not a second option

- **The confusion you mention is real.** There'd be two maps to look in, with questions neither answers cleanly: which wins when both name `usd`? Can a chain in one reach a pipe in the other?
- **The data already says `pipes`.** app.json, stored transforms and `O2HAppOptions` all hold descriptors under `pipes`. A `dataPipes` key would mean renaming those, or translating between them.
- **`dataPipes()` already takes a mix** of functions and descriptors, so a chain can name either. Splitting them undoes that.
- **It doesn't avoid the real question,** which is how the core gets at the `dataPipes` module (below).
- **assign-gingerly already has this pattern.** An entry in `options.handlers` is a class or a string, in one option. A `pipes` entry would be a function or a descriptor.

### How it could work

The first version that comes to mind, calling `dataPipes` where `assignFrom` starts, has two problems:
- **Cost:** `assignFrom` is called for every item in a list, and each call would build a new map or scan for descriptors.
- **Size:** a static import puts `dataPipes` in the core. Measured with esbuild, minified and gzipped, it's about 1.4 KB beside `assignFrom`'s 24 KB: about 6%, for pages that may not use it. And the docs promise those pages pay nothing.

Instead, there's one place every pipe already goes through: `navigatePath` in [resolve/getValues.ts](../../../assign-gingerly/resolve/getValues.ts#L238).

```ts
const pipe = pipes![rawPart];
current = (typeof pipe === 'function' ? pipe : makePipe(pipes!, rawPart))(current);
```

- **One extra `typeof`,** and only when a pipe is actually used. Pages with function pipes pay nothing else.
- **`makePipe`** runs `dataPipes` on the whole `pipes` object once, and keeps the result in a `WeakMap` keyed by that object. Doing the whole object means chains still reach sibling pipes, and a bad descriptor fails when the first descriptor is used.
- **Every entry point benefits at once:** `getValue`, `assignFrom`, `builtIns.tree`, the handlers, and o2h, which resolves pipes through the same `getValue` ([o2h.ts:18](../../o2h.ts#L18)).
- **The core stays free of the module:** dataPipes.ts registers itself with getValues.ts when it's imported, so the core holds only a slot for it.
- **Loading it:**
  - `assignFromAsync` scans a `pipes` object once (remembered per object) and, if it finds a descriptor, imports the module itself, as built-in handlers are loaded on first use. So a JSON-only caller there needs no import at all.
  - Sync `assignFrom` and `getValue` can't wait for an import. If the module isn't loaded, they throw an error saying to import `assign-gingerly/pipes/dataPipes.js` or use `assignFromAsync`.

### What it does for o2h's data flow

| Today | With this |
|---|---|
| `reviveO2HTransform` calls `dataPipes` | Only replaces lost pipes with stubs. The stubs are functions, so they sit beside the descriptors. |
| `pipesOf` in edge.ts calls `dataPipes` | Removed: hydrating goes through `assignFromAsync` |
| The store's cart calls `dataPipes` | Removed: it passes `app.options.pipes` as it is |

The rule becomes one sentence: **`pipes` may hold functions or descriptors, everywhere.** The table I just added to o2h's README would shrink to almost nothing.

Two things stay:
- `prepareO2HTransform`'s check for a function's descriptor, for pages that call `dataPipes` themselves.
- The worker has to import dataPipes.js itself, since `o2h()` is sync. It already bundles the module.

### Costs

- **Later errors.** Today a bad descriptor throws when you call `dataPipes()`. With this, it throws at first use. Calling `dataPipes()` yourself stays available, as the strict way.
- **Types widen.** `Pipes` becomes `Record<string, fn | PipeDescriptor>`, in the types submodule's three checkouts. Code that reads `options.pipes.x` and calls it directly would need care. In assign-gingerly, `navigatePath` is the only place I found that calls one.
- **A sync call can fail where an async one wouldn't,** until the module is imported. The error message has to carry that.

### Beyond pipes

`pipes` is one gap in making the third argument JSON. `aka`, `snippets` and `withMethods` are data already, and `handlers` takes strings. `protocols` is the main one left, and handler code needs real functions, so I'd stop at pipes and see what a real use case asks for next.

**One correction, unrelated:** docs/pipes.md says `dataPipes` is "about 0.6 KB gzipped". I measured about 1.4 KB now, so it needs updating, partly because of `sum`, `min` and `max`. I haven't changed it.

### Your call

Shall I go ahead with `pipes` holding descriptors, in assign-gingerly first, then simplifying o2h and the cart?

## Bruce's Response II

Ah yes, the reason for the dataPipes function was to prevent forcing importing the now 1.4 KB even if not used.

I think your recommended adjustments are quite reasonable.  I would add one addendum.  Maybe assignFrom-extension should include the dataPipes function import.

Please proceed, and do update the docs/pipes.md to update the measured size and explain how to incur the cost via the import.

## Claude's Implementation Notes II: `pipes` holds descriptors

**Done, with your addendum.** A `pipes` option now takes functions, descriptors, or both, everywhere.

### Before you publish: order matters

o2h now relies on this assign-gingerly, and resolves a real copy of the published 0.0.107. So:

1. **Publish assign-gingerly** (it has the new behavior; your watcher has built its `.js`).
2. **Install it in o2h,** and bump `"assign-gingerly": "0.0.107"` in o2h's package.json.
3. **Run `npm run build:worker` in o2h.** I did not rebuild `o2h-sw.js`: built now, it would bundle 0.0.107, and data pipes would break there. The current bundle is self-contained, so it keeps working until then.
4. **Then publish o2h.**

**Until step 2, two of o2h's own tests fail** with `pipe is not a function`: "data pipes survive prepareO2HTransform…" and "a total (the sum data pipe)…". That's the pending install. Both pass against the new assign-gingerly in my mirror. I chose to make the o2h change now, since you said to proceed, rather than leave it for later. o2h-edge isn't affected: it links the sibling repo.

### assign-gingerly

- **[resolve/getValues.ts](../../../assign-gingerly/resolve/getValues.ts):** `navigatePath` calls a pipe directly if it's a function. Otherwise, `makePipe` applies `dataPipes` to the whole `pipes` object, once, kept in a `WeakMap`. `registerPipeMaker` is the slot `dataPipes` fills, so the core doesn't import it.
- **[pipes/dataPipes.ts](../../../assign-gingerly/pipes/dataPipes.ts):** registers itself when it's loaded.
- **[assignFromAsync.ts](../../../assign-gingerly/assignFromAsync.ts):** looks at a `pipes` object once and, if it holds a descriptor, loads the module with a dynamic `import()`. Concurrent calls wait for the same load. There's no extra `await` when no load is needed.
- **[assignFrom-extension.ts](../../../assign-gingerly/assignFrom-extension.ts), your addendum:** imports dataPipes, so `obj.assignFrom()` takes descriptors. `assignFromAsync-extension` doesn't need it, since it goes through `assignFromAsync`.
- **Types:** `PipeEntries` (functions, descriptors or both) for the `pipes` options, in the types submodule's three checkouts. `Pipes` stays functions only, and is what `dataPipes()` returns.

**One thing I hadn't expected: [tsconfig.json](../../../assign-gingerly/tsconfig.json) didn't include `assignFrom-extension.ts`.** Nothing was compiling it, and its `.js` was maintained separately, last touched at 0.0.59. So my import never reached the `.js`, which my test caught. I added it to `include`; the bodies matched, so only the import and the comments changed. `assignFromAsync-extension.ts` and `object-extension.ts` aren't in `include` either. I left those alone, so their `.js` can still drift.

### o2h and the store

- **[worker/core.ts](../../worker/core.ts):** `reviveO2HTransform` now only replaces lost pipes with stubs. The file imports `dataPipes.js` for its side effect, since `o2h()` is synchronous.
- **[worker/edge.ts](../../worker/edge.ts):** `pipesOf` and the `dataPipes` import are gone. `assignFromAsync` takes care of it.
- **[o2h-edge/demo/store/cart.js](../../../o2h-edge/demo/store/cart.js):** passes `pipes` as it is.

### Size

Measured with esbuild, minified and gzipped:

| | Before | After |
|---|---|---|
| `dataPipes` | | about 1.4 KB |
| `assignFrom.js`, bundled | 23,608 bytes | 23,728 bytes (about 120 bytes for the slot and `makePipe`) |
| `assignFromAsync.js`, with code splitting | | `dataPipes` is its own chunk, 1,436 bytes |

Pages with function pipes pay those 120 bytes and nothing else. A bundler that doesn't split code will inline `dataPipes` into anything using `assignFromAsync`, because of the `import()`.

### Docs

- **[docs/pipes.md](../../../assign-gingerly/docs/pipes.md):** the size corrected to 1.4 KB, and how to incur the cost: a table of `assignFromAsync` (loaded for you), `assignFrom-extension.js` (always included), and `assignFrom` / `getValue` (`import 'assign-gingerly/pipes/dataPipes.js'`, or an error saying so).
- **[o2h/README.md](../../README.md):** the "Data pipes survive" table now shows the one rule, instead of two `dataPipes` calls. Your earlier reading of the data flow there is simpler now.
- **[navigate-gingerly/README.md](../../../navigate-gingerly/README.md):** the note trimmed to match.

### Checked

- **assign-gingerly:** 66 of 66 in Chromium, in a mirror of the workspace, built there. Its extension page passes 11 of 11. The new test runs each case in a fresh Node process, since whether the module is loaded is the point:
  - not loaded: function pipes work, and a descriptor throws the error, from both `getValue` and `assignFrom`;
  - imported: sync calls work, from JSON too, and a chain reaches a function beside descriptors;
  - `assignFromAsync` loads it, for concurrent calls too, and then sync calls work as well;
  - `assignFromAsync` doesn't load it for function pipes;
  - `assignFrom-extension.js` works with no other import;
  - a bad descriptor throws at first use, naming it.

  The new test also passes in the real repo, on your watcher's build.
- **o2h:** all pass in the mirror (24 passed; the 24 skipped are its Node tests, which run once rather than per browser). In the real repo, the two failures above.
- **o2h-edge, in the mirror:** `npm test` 22 of 22.
- **The store, in Chromium, Firefox and WebKit:** the worker renders, hydration binds the Add button, and the cart totals $100.59, then $78.29, then $0.00 when emptied, all with no `dataPipes` call in o2h's page code or the cart.
- **The BLS chart, in all three browsers:** rendered by the worker from `min` / `max`, with the same results as before.

No BLS calls: those ran against the saved responses.

**Changed:**
- **assign-gingerly:** the files above, `tests/pure-modules.spec.ts`, `docs/pipes.md`, `tsconfig.json`, and the types.
- **o2h:** `worker/core.ts`, `worker/edge.ts` and their `.js`, the types, and the README.
- **navigate-gingerly:** the types and the README.
- **o2h-edge:** `demo/store/cart.js`.

Nothing is committed.

## Bruce's Response III

I do see some changes made to [pipes.md](../../../assign-gingerly/docs/pipes.md), but I still only see examples with the function dataPipes, with no explanations for how to use JSON serializable third arguments, where the dataPipes gets applied assuming the the import is made.  Is it possible to add a clear example of this?

## Claude's Response III

**You were right, and it's fixed.** The section led with `dataPipes()`, and the JSON route was one short `assignFromAsync` example plus a table cell. [docs/pipes.md](../../../assign-gingerly/docs/pipes.md#data-pipes-opt-in-pipes-described-as-data) now leads with the JSON form.

The section's new order:

1. **The third argument as JSON:** a complete `options.json`, holding both `from` and `pipes`, then this:

   ```js
   import { assignFrom } from 'assign-gingerly/assignFrom.js';
   import 'assign-gingerly/pipes/dataPipes.js';          // imported, never called
   import options from './options.json' with { type: 'json' };

   const summary = {};
   assignFrom(summary, { '?.count': '?.lines?.items', '?.amount': '?.lines?.total' }, options);

   // summary: { count: 3, amount: '$242.20' }
   ```

   After that come how the descriptors become pipes (the first path that reaches one converts the whole object), and the same example with `assignFromAsync` and with the extension, neither of which needs the import.
2. **What it costs:** the 1.4 KB table, with the import case first.
3. **Calling `dataPipes()` yourself:** the former opening example, now marked optional, with why you'd want it.
4. **The descriptors:** the table of kinds.

Smaller changes:
- **Totals:** the code example called `dataPipes()` and repeated the same data, so it's now a sentence pointing at the JSON above.
- **Chart scale:** it's now a plain object.
- **"Errors come early":** this only held for `dataPipes()`, so that point moved into its section.
- **"The descriptors are what's serializable":** this bullet is gone, since the JSON section now says it, including the link to o2h.

**Checked:** I ran all three examples from a separate project, importing by package name and reading a real `options.json`, against your watcher's build. Each gave `{ count: 3, amount: '$242.20' }`. `dataPipes()` now appears in the page only in its own section. Only `docs/pipes.md` changed for this. Nothing is committed.
