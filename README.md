# o2h

Converts a JavaScript object (typically a JSON API response) into HTML, as described by a [builtIns.tree](https://github.com/bahrus/assign-gingerly/blob/baseline/docs/tree.md) configuration: the same JSON the client-side handler takes.

o2h will typically run on the server (e.g. in a Cloudflare Worker) or in a service worker, to generate HTML from an API in a form the browser can digest directly. It uses only assign-gingerly's pure (DOM-free) exports, and the same structural decisions builtIns.tree makes, so the server renders what Tree would render on the client.

```js
import { o2h } from 'o2h';

const { html, unrendered } = o2h(config, apiResponse, { pipes, managers });
```

- **`html`** has the elements, attributes and text, plus Tree's `<!--?start-->` / `<!--?end-->` markers.
- **Pending marks:** each element that lost something HTML can't carry (properties without an attribute, event bindings, itemscope managers) is marked `data-pending`: "hide this until the client restores it" (see `style` below).
- **`unrendered`** lists keys o2h couldn't render, rather than guessing.

## Where the first paint comes from

o2h is for the second and third rows; builtIns.tree hydrates in both, and is all you need for the first.

| Approach | Who renders the first paint | What the main thread does | Section |
|---|---|---|---|
| **Main thread only** | builtIns.tree, in the page | Everything: fetch, parse the JSON, render | [builtIns.tree](https://github.com/bahrus/assign-gingerly/blob/baseline/docs/tree.md) |
| **Server first paint** | o2h on a server or edge worker, in the page's HTML | Hydrate (`adopt`) | [Finishing on the client: hydration](#finishing-on-the-client-hydration) |
| **Service worker first paint** | o2h in a service worker, for the page's own fetches | Assign the HTML, then hydrate | [below](#service-worker-first-paint) |

## Finishing on the client: hydration

builtIns.tree, with `adopt: true` and the same config and data, takes the server's elements over instead of rebuilding them:

```js
await assignFromAsync(container, { '?. =>': { do: 'builtIns.tree', adopt: true, ...config } }, { from: data, pipes, registry });
```

It needs the config and the data on the client, e.g. embedded by o2h's `embed` option:

```js
const data = JSON.parse(container.querySelector('script[type="application/json"][data-tree="tree"]').textContent);
```

Afterwards everything is live: events and properties are bound, managers are attached and re-render on `ctx.rebind()`, and the `data-pending` marks are removed. If the markup doesn't match the config, Tree rebuilds it instead.

**How it works:**
1. **The walk:** Tree walks the config and the existing elements together, level by level. It pairs each level's *slots* (its elements, and the `<!--?switch-->` placeholders of switches rendering nothing) with the specs in order. The pairing uses the same functions o2h used to decide what to render: which map keys, which repeat items (by key), and which switch case. Text and whitespace are skipped.
2. **The bind:** the ordinary bind then runs on the adopted elements. Text that's already right isn't rewritten.
3. **The fallback:** any mismatch (another tag, another number of children or items) rebuilds the whole tree instead.

Details: [assign-gingerly's tree.md, "How the walk pairs spec and markup"](https://github.com/bahrus/assign-gingerly/blob/baseline/docs/tree.md#how-the-walk-pairs-spec-and-markup).

**`adopt: 'pending'` (experimental)** adopts the same way. On the first run, it binds only the elements marked `data-pending` (with their contents and ancestors, and nested trees' hosts), and trusts the rest of o2h's HTML as is. That halves hydration time or better on mostly static pages (see the benchmark below). The trade-off: anything the client would render differently from the server (newer data, another locale) is only corrected on a later run. See [tree.md, "adopt: 'pending'"](https://github.com/bahrus/assign-gingerly/blob/baseline/docs/tree.md#adopt-pending-experimental-bind-only-whats-pending).

## Service worker first paint

A service worker renders a page's JSON fetches with o2h, off the main thread. The page gets HTML (with the JSON embedded after it), assigns it, and hydrates.

```js
import { whenO2HWorkerReady, prepareO2HTransform, storeO2HTransform, O2H_HEADER } from 'o2h/worker/client.js';

await whenO2HWorkerReady('/o2h-sw.js');                          // registered as a module; resolves once it controls the page
const { key, transform, lost } = await prepareO2HTransform(config, { pipes, managers });   // the client-side config and options
await storeO2HTransform(key, transform);                               // key: a hash of the content

const response = await fetch('/api/launch', { headers: { [O2H_HEADER]: key } });
container.innerHTML = await response.text();                     // HTML, then <script type="application/json" data-tree="tree">
const data = JSON.parse(container.querySelector('script[data-tree="tree"]').textContent);
await assignFromAsync(container, { '?. =>': { do: 'builtIns.tree', adopt: 'pending', ...config } }, { from: data, pipes, registry });
```

**How much the worker renders depends on the config:**
- **[Data-only configs](#data-only-configs):** the worker renders everything, and the page only binds what HTML can't carry (events, managers).
- **[Configs with code](#configs-with-code-stand-ins-and-pending-parts):** the worker renders all it can, and leaves exactly the parts needing the page's code (pipes, managers) for the page to finish.

### Data-only configs

The worker itself:
- **Marked requests only:** the worker handles fetches with an `X-O2H-Transform` header, and lets everything else through. It forwards the request **without** that header, so a cross-origin API never sees it, and it causes no CORS preflight.
- **The transform** (`{ config, options }`, in IndexedDB) is keyed by the header's value, so one worker serves very different API calls. The page writes transforms; the worker only reads them.
- **The response:** `o2h(config, json, { ...options, embed: true })` as `text/html; charset=utf-8`, with `Vary: X-O2H-Transform`.
- **Falling back:** when the API's response isn't OK, or isn't JSON, it's returned as is. When the transform is missing or rendering fails, the original JSON is returned, with an `X-O2H-Error` header saying why.
- **The worker file:** workers can't use import maps, so `o2h-sw.js` is a bundle, built from `worker/serviceWorker.ts` with `npm run build:worker` (esbuild). Serve it from a path whose scope covers your pages, e.g. the site root.
- **Shared with other workers:** `worker/core.js` (`handleO2HRequest(request, lookup)`) uses only the Fetch API and o2h, so a Cloudflare Worker can use it with its own lookup (planned).

A config and options with no functions or classes (tree notation, `aka`, `markerName`, `snippets`, `style`, and [data pipes](#data-pipes-survive)) are stored as they are, and the worker renders all of it.

### Configs with code: stand-ins and pending parts

Transforms live in IndexedDB, which can't hold functions or classes. `prepareO2HTransform(config, options)` copies the client-side config and options:
- **Stand-ins:** each pipe, protocol, manager class or other piece of code becomes a **stand-in** (`{ $o2hLost, name }`).
- **What was lost** comes back as `lost`, with paths.
- **The key** is derived from the content: the same config gets the same key, and a changed one gets a new key.

In the worker, stand-in pipes and protocols throw a `LostReference` when used, so o2h leaves exactly what needs them to the page:
- **A pattern key** that needs one isn't rendered, and its element is marked `data-pending`.
- **A switch** whose case needs one becomes `<!--?switch pending-->`.
- **A repeat** whose items need one is left empty, with its container marked `data-pending`.
- **A manager** whose class is lost renders from the raw value, marked `data-pending`.

The page then hydrates with the real code, with `adopt: 'pending'` (or `true`). builtIns.tree adopts everything else, binds the pending parts, and renders the pending switches and repeats fresh. The result is the same DOM as a main-thread-only render; more of it is just finished by the page.

#### Data pipes survive

**Data pipes** (assign-gingerly's [`dataPipes`](https://github.com/bahrus/assign-gingerly/blob/baseline/docs/pipes.md#data-pipes-opt-in-pipes-described-as-data): `Intl` formatters, lookups, built-ins and chains, described as data) aren't lost. Their descriptors are stored, and the worker runs them. So the more of a config's pipes are data pipes, the more of the page the worker renders.

## Options

| Option | |
|---|---|
| `pipes` | Named unary functions usable as path segments (`'?.date_utc?.parseDate?.longUtc'`) |
| `aka` | Aliases, under the config's own `aka` |
| `protocols` | Synchronous protocol handlers (`name://key` values) |
| `snippets` | Static HTML for `{ snippet: 'name' }` specifications, by name: written as is (trimmed), with the `data-hole` elements the spec's `holes` name rendered like elements (needs well-formed hole markup). The same option builtIns.tree takes, which also checks it on the client (see [tree.md, Snippets](https://github.com/bahrus/assign-gingerly/blob/baseline/docs/tree.md#snippets-static-html)). |
| `managers` | Itemscope manager classes by registered name. With one, a `{ tag, ish: 'name' }` element's subtree renders from the manager's getters. Either way, the element gets `itemscope="name"`, so the client can attach the manager. |
| `style` | Prepend the default style, which hides pending parts, only when scripts run (so crawlers and no-JS readers see everything): `<style>@media (scripting: enabled) { [data-pending] { visibility: hidden; } }</style>`. Also exported as `PENDING_STYLE`. |
| `embed` | Append the data the HTML was rendered from, as JSON, right after the tree: `<script type="application/json" data-tree="<markerName>">`, with `<` escaped so the data can't end the element. The client hydrates from it, so the data is always the snapshot the HTML came from. By default, values JSON drops or changes (functions, Dates, Maps and Sets, class instances, NaN, BigInts) are listed in the result's `notSerializable`, with their paths; `embed: { check: false }` skips that check, which costs about 3× a plain `JSON.stringify`. The data goes *after* the content, so it doesn't delay the first paint of what comes before it when the page streams. |

Types: [`types/o2h/types.d.ts`](types/o2h/types.d.ts).

## Demo

[`demo/index.html`](demo/index.html) renders [`demo/treeDefinition.js`](demo/treeDefinition.js), a copy of assign-gingerly's tree-demo definition, against [`demo/data/launch.json`](demo/data/launch.json). It shows o2h's HTML next to what builtIns.tree builds in the browser from the same definition, checks that the two are the same DOM, and finishes the server HTML with **Hydrate** (builtIns.tree adopts the server's elements; then the rocket card's "Increase by one" re-renders it). With `style: true`, the pending parts (the links bar, the rocket card) stay hidden until then.

[`demo/benchmark/adopt.html`](demo/benchmark/adopt.html) times hydration with `adopt: true` against the experimental `adopt: 'pending'` (bind only what's marked), on the rocket definition, a mostly static company profile ([`companyDefinition.js`](demo/benchmark/companyDefinition.js)), and a directory of 100 profiles. It also checks that both give the same DOM and that the managers stay live.

## Viewing Locally

1. Install git and node.js.
2. Fork/clone this repo, and open a command window in its folder.
3. `git submodule update --init --recursive`
4. `npm install`
5. `npm run serve`
6. Open http://localhost:8000/demo/ in a modern browser.

### Within the beGingerly workspace

When this repo sits in a folder next to assign-gingerly (as in `beGingerly/`), the workspace folder can serve both, so the demo and tests use assign-gingerly's **current source** instead of the published package:

1. In the workspace folder: `npm install`, then `npm run serve` (port 8000; or set `PORT`).
2. Open http://localhost:8000/o2h/demo/

Pages get their import map from `<!-- #include virtual="/imports.html" -->` (spa-ssi). Served from this repo, that's [`imports.html`](imports.html) (published packages). Served from the workspace, it's the workspace's `imports.html` (sibling repos).

## Building and testing

- **Build:** `npm run build` (`tsc`), or `npm run watch`. The service worker bundle: `npm run build:worker`. In VS Code, Ctrl+Shift+B offers *tsc: watch - tsconfig.json*.
- **Test:** `npm test` (Playwright).
  - **Unit tests** run o2h in Node, with no DOM, as on a server.
  - **The equivalence test** checks, in Chromium, Firefox and WebKit, that o2h's HTML matches what builtIns.tree builds from the demo definition (apart from the `data-pending` marks and the managers' `itemscope`).
  - **The hydration test** checks that builtIns.tree (`adopt: true`) adopts o2h's HTML: every element reused, the same DOM as Tree's own, and the rocket card re-rendering on "Increase by one".
  - **Inside the workspace,** the browser tests are served from the workspace folder (port 8090), so they run against the sibling assign-gingerly. Otherwise they use the published package.

The previous implementation is kept in [`legacy/`](legacy/) for reference.
