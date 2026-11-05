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
