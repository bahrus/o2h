# Option To Embed Data

## Bruce's Ask

Is there an advantage of providing an option to include the from / vm as a serialized JSON string in a script type=application/json tag, other than the minor convenience of creating that tag?  I.e. if a convention were followed, that assign-gingerly could assume when hydrating, could it reduce boilerplate significantly?

Please provide your thoughts below.


## Claude's Thoughts

**Short version:** the boilerplate saved on the client is small (a line or two). The real advantages are elsewhere: **getting the embedding right** (escaping, and data that survives JSON) and **guaranteeing that the data is the snapshot the HTML was rendered from**. Those are worth an option. A significant reduction in boilerplate only comes if the convention goes further, to markup that hydrates itself.

### What the client writes today

```js
const data = JSON.parse(document.getElementById('launch-data').textContent);
await assignFromAsync(container, { '?. =>': { do: 'builtIns.tree', adopt: true, ...config } }, { from: data, pipes, registry });
```

**With a convention** (say, a helper that finds the data next to the tree's markers):

```js
await hydrate(container, config, { pipes, registry });
```

So it removes one line, and the id that the server and the client have to agree on. That's convenient, but not significant on its own.

### Where o2h embedding the data does pay

1. **Safe escaping.** JSON inside a `<script>` can't simply be `JSON.stringify`'d:
   - **Closing the script:** a string containing `</script>` closes the element early. With API data that's an injection hole: `"</script><script>…"`.
   - **Other sequences:** `<!--` and U+2028 / U+2029 need care too.

   The safe form escapes `<` as `<` (and the two separators). It's easy to forget, and an option makes it impossible to get wrong.
2. **The same snapshot.** Hydration expects the data the HTML was rendered from. If the page embeds the data separately, it can drift: the API response instead of the `initialVm(response)` view model, a second fetch, or a later version. Then the walk mismatches and Tree rebuilds the page, quietly losing the benefit. Worse, with `adopt: 'pending'`, unbound parts stay stale. If o2h embeds exactly the `from` it rendered, that can't happen.
3. **Checking that the data survives JSON.** A view model can hold things JSON changes or drops:
   - **Changed:** a `Date` becomes a string, so `?.date?.parseDate` behaves differently on the client.
   - **Dropped:** `undefined`, `Map` / `Set` contents, class instances' prototypes, and functions.

   o2h is the one place that has the value in hand. It could report such values (as it reports `unrendered` keys) rather than let the client render something different.
4. **Pairing on a page with several trees.** Each tree has its own `markerName`. If o2h places the data right after the tree's end marker, tagged with that name, the client finds it without ids:

   ```html
   <!--?start name="tree"-->…<!--?end--><script type="application/json" data-tree="tree">{…}</script>
   ```

   It sits outside the region between the markers, so Tree's walk and later runs never touch it. And `application/json` scripts never execute, even when inserted with `innerHTML`.

### What it costs

**The data travels twice,** once as text in the HTML and once as JSON. Gzip/Brotli compress the repetition well, but it's still more to parse. The [JSON-vs-microdata benchmark](../../assign-gingerly/demos/hydration-benchmark/compare.html) put `JSON.parse` well under a millisecond for hundreds of KB, so the cost is bytes, not time.

**Trimming the JSON to what the tree reads** is tempting, but not safe in general: managers get a copy of the whole value, and pipes can read anything. I wouldn't do it.

### Where it would reduce boilerplate significantly

**If the markup can hydrate itself.** Suppose the start marker (or the script) also names where the config lives, e.g. a module URL that exports `config`, `pipes` and `managers`. Then an enhancement, or a single page-level call, could hydrate every tree on the page with no per-page code:

```html
<!--?start name="tree"-->…<!--?end--><script type="application/json" data-tree="tree" data-config="/defs/launch.js">{…}</script>
```

That's a larger design (module resolution, registries, when it runs), and it should be a separate document. But the embedding convention is the first step toward it, and nothing in it would need to change later.

### Proposal

- **o2h:** an `embed` option (e.g. `embed: true`) that appends the view model it rendered from, right after the end marker, as `<script type="application/json" data-tree="<markerName>">`:
  - escaped safely;
  - with values that don't survive JSON reported (in a new `notSerializable` list, or within `unrendered`).
- **assign-gingerly:** a small export that reads that script, or that script plus hydration in one call:
  - `embeddedData(container, markerName = 'tree')`, which finds and parses the script;
  - and/or `hydrate(container, config, options)`, which runs builtIns.tree with `adopt` and `from` set to the embedded data.

  I'd rather do this than make Tree read the data implicitly when `from` is missing. Tree's `from` semantics stay unchanged, and it's obvious where the data comes from.
- **The demo and the tests** would hydrate from the embedded data.

### Questions

1. **Add the `embed` option to o2h,** as proposed?
2. **On the client:** `embeddedData()` only, `hydrate()` too, or Tree reading it implicitly?
3. **Values that don't survive JSON:** report them (in a separate list), or throw?
4. **Self-hydrating markup:** worth its own document later?
