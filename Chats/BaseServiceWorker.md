# Base Service Worker

## Bruce's Ask

Ideally, the code written for this ask, as much as possible of it would be shareable with a cloudfare worker.

The request is to create a service worker that watches for any fetch requests made in the browser, where the headers indicate that the expected response is a JSON stream.

The worker looks to see if the request has up to three headers specified.  The names of those headers is TBD, but they each point to a location in indexedDB from which objects can be pulled.

The fetch request sent from the browser goes through to the end point, but the service worker, instead of returning JSON, it sets the second object from indexedDB, if provided, to the {from} key. 

The three objects are passed to o2h, with embedded: true, and turned into HTML + JSON inside a strict tag, and the response header content type turned to text/html.

Obvious, this has some big limitations, like the ability to specify JavaScript functions like pipes, protocols, or Itemscope Managers, in the tree conversion 

Is this doable?

Please consider, and discuss what needs clarifying below.


## Claude's Thoughts

**Yes, it's doable, and it's a good fit for what the JSON benchmark found.** A service worker is a separate thread. If it turns the JSON into HTML (plus the embedded JSON), the page never parses JSON-sized data for the first render. It assigns an HTML string and hydrates. That's the "keep the data off the main thread" recommendation, built into the network layer.

**Most of it can be shared with a Cloudflare Worker.** Both use the Fetch API (`Request`, `Response`, `fetch`), and o2h is DOM-free. The parts that differ are how a request reaches the code, and where the stored objects come from: Cloudflare Workers have no IndexedDB.

### A sketch

```
page ──fetch(url, { headers: { 'X-O2H-Config': 'launch-card', … } })──▶ service worker
service worker:
  1. Not marked for o2h? → let it through untouched
  2. Look up the objects the headers name (IndexedDB here; KV / bundled modules on Cloudflare)
  3. Forward the request to the endpoint, without the o2h headers
  4. Upstream not OK, or not JSON? → return it untouched
  5. data = await response.json()
  6. { html } = o2h(config, from, { ...options, embed: true })
  7. return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', … } })
```

**Code layout:**

| Layer | Shared? | What |
|---|---|---|
| **The core:** `renderJsonResponse(upstream, { config, vm, options })` → `Response` | ✅ | Steps 4–7. Pure Fetch API plus o2h. |
| **Request handling:** is it marked, which keys, strip the headers, forward | ✅ | Steps 1 and 3, given a lookup function |
| **The lookup** | ❌ | Service worker: IndexedDB. Cloudflare: KV, or configs bundled as modules. |
| **The entry point** | ❌ | Service worker: `self.addEventListener('fetch', e => e.respondWith(…))`. Cloudflare: `export default { fetch(request, env) { … } }`. |

### The functions limitation has a good answer

You're right that pipes, protocols and managers can't live in IndexedDB: functions and classes aren't storable (structured clone refuses them). But they don't need to be there, because **the worker's own code can supply them by name**:
- **IndexedDB holds only data:** the tree config, which already refers to pipes and managers by name, plus snippets, which are strings.
- **The worker script imports a registry module** with the functions, e.g. `import { pipes, managers, protocols } from './o2h-registry.js'`.
- **On Cloudflare,** the same registry module is bundled in.

This is the same split assign-gingerly already uses (JSON configs, code registered by name). The one constraint: a manager or pipe the server-side render needs must be in that registry. Things that only matter on the client (event handlers, for instance) don't need to be.

### What needs clarifying

1. **The three objects.** My reading: a **tree config**, an **o2h options** object (`aka`, `markerName`, `snippets`, `style`), and a **view-model wrapper** that the response is placed into ("sets the second object … to the `{from}` key").
   - Is the wrapper meant to work like the demo's `initialVm(response)`: a VM shell with the response at a named key, e.g. `{ ...wrapper, [key]: response }`?
   - Or does the second object *replace* the response as `from`?
   - Which header names which object, and which are optional?
2. **How a request is marked.** A custom header (`X-O2H-Config: …`) is clearest.
   - **Cross-origin catch:** custom headers trigger a CORS preflight, and the API may refuse unknown headers. So the worker should **strip them before forwarding**: the request it sends upstream is the original, minus o2h's headers.
   - **Same-origin APIs** don't have this issue.
   - Alternatively, a URL convention (a path prefix or query parameter) avoids headers altogether. Which do you prefer?
3. **When the service worker isn't running yet** (first visit, hard reload, not installed, or a browser without one), the request goes straight to the API with the o2h headers, and the page gets **JSON**, not HTML. Should the page:
   - handle both (check `Content-Type`, and render JSON with builtIns.tree itself)? This is the robust option, and Tree and o2h give the same DOM, so it's cheap.
   - or only send o2h requests once a worker controls the page?
4. **Script fetches or navigations?**
   - **`fetch()` from page script:** the page gets HTML + embedded JSON, puts it into a container and hydrates. That's what I sketched.
   - **Navigations** (opening an API URL in the address bar renders a page): those would need a full HTML document, with `<head>`, styles, and the scripts that hydrate. That's possible too, but it's a bigger design.
5. **"JSON stream":** a plain JSON body, or newline-delimited JSON (NDJSON) arriving over time? o2h needs the whole object, so the worker reads the full body either way. Rendering NDJSON incrementally (streaming HTML out as items arrive) would be a separate, larger feature.
6. **Errors:**
   - When the API fails or returns non-JSON, I'd pass its response through untouched.
   - When rendering fails (a missing pipe, say), the choices are returning the **original JSON** (with a header saying why) or an error response. I'd return the JSON, so the page can fall back to rendering it itself (see 3). OK?
7. **Response headers:**
   - **Keep:** status, `Cache-Control`, and the CORS headers the page needs.
   - **Drop:** `Content-Length` and `Content-Encoding`, since the body changed.
   - **Set:** `Content-Type: text/html; charset=utf-8`, and add `Vary` on the o2h headers (or the URL convention), so caches don't mix up JSON and HTML responses.

   Anything else you rely on?
8. **Who writes the IndexedDB entries, and when?** Presumably the page stores the config before its first o2h fetch. Should configs be versioned, so a newer page and an older stored config can't mismatch? Or should the worker fetch configs from URLs and cache them, instead of IndexedDB?
9. **Trust:** anything stored in IndexedDB can be written by any script on the origin. Snippets in a stored config are HTML that o2h writes verbatim, so an XSS bug could plant persistent markup. That's the same trust level as the page's own code, but worth stating. Alternatively, snippets could come from the registry module, keeping only the tree config in IndexedDB.
10. **Where it lives:** in o2h (e.g. `o2h/worker/core.js`, `o2h/worker/service-worker.js`, `o2h/worker/cloudflare.js`), or in a separate package that depends on o2h?
11. **Module service workers** (`register(url, { type: 'module' })`) let the worker `import` o2h and assign-gingerly directly. Chromium and Safari support them; I'm not certain of Firefox's status. If Firefox matters, the worker script would need bundling. Is a bundle step acceptable, or should it stay buildless?

### Suggested first step

**Build the shared core and the service worker entry, for same-origin `fetch()` from page script:**
- one marker header, with the o2h headers stripped before forwarding;
- config and options from IndexedDB, and functions from a registry module;
- `embed: true`;
- pass-through on any failure, with the page falling back to rendering the JSON itself.

**Then the Cloudflare entry,** with KV or bundled configs. **Navigations and NDJSON** later, if wanted.

## Bruce's Response I

> - **The worker script imports a registry module** with the functions, e.g. `import { pipes, managers, protocols } from './o2h-registry.js'`.

I would much rather we don't go there yet, that is a separate discussion.  What I'm struggling with is wanting to use the same worker for wildly different api calls.  The things stored in indexedDB would be keyed from, potentially guid's, because different API calls would want to use very different settings.  The same conundrum needs a solution for pipes, and especially managers, so the solution proposed doesn't look at all what I'm looking for.

>  1. **The three objects.**

I was thinking in a muddy fashion, and was thinking the third parameter would be the assignPermissions object, but then remembered that doesn't make sense on the server.

I looked at the arguments for o2h.  There are only three, one of which is the JSON returned from the API.  So we only need two object in IndexedDB, corresponding to the other two arguments (minus any JS functions, classes).

> 2. **How a request is marked.** 

`X-O2H-Config: …` sounds good.  Good idea to strip before forwarding.

> 3.  **When the service worker isn't running yet**

Can we start by somehow through post message and/or some common storage, provide a promise for when the service worker is ready, and only then do the fetch calls?  Trying to fallback on an out of worker w2h sounds promising, but maybe a Phase II enhancement.

> 4. **Script fetches or navigations?**

Let's start with just fetches

> 5. **"JSON stream":**

Future phase if ever.

> 6. **Errors:** and 7. **Response headers:** and 10. **Where it lives:**

Your recommendations sound good.

> Presumably the page stores the config before its first o2h fetch.

Correct.  Let's not involve the worker in that for now.

> 9. **Trust:**

Noted.

> 11. **Module service workers**

Yes, module based.  


## Claude's Response II

**Understood: no registry module.** Phase I supports configs and options **without functions**: JSON-only `aka`, `markerName`, `keepNullish`, `snippets`, `style`. How pipes and managers get to a worker that serves wildly different API calls is the separate discussion you want to have.

Meanwhile, what o2h does when a config names something it wasn't given:
- **A manager** whose class wasn't supplied: o2h renders the subtree from the raw value, and the client's hydration attaches the manager. That already works today.
- **A pipe** that isn't there: the path segment resolves to nothing, so the text comes out empty, and hydration then fills it in on the client. So Phase I degrades gracefully, but pages that rely on pipes or managers render less on the "server".

### The plan, from your answers

**One header, `X-O2H-Config: <key>`** (e.g. a GUID), naming one IndexedDB record:

```js
{ config, options }   // o2h's first and third arguments; the API's JSON is the second
```

I'd keep both in one record, so they're written together and can't drift apart. If you'd rather have two independent records (e.g. one options object shared by many configs), a second header `X-O2H-Options: <key>` is easy to add. Which do you prefer?

**The parts:**

| Module | Runs in | What |
|---|---|---|
| **`worker/core.ts`** (shared with a future Cloudflare entry) | service worker, Cloudflare | `handleO2HRequest(request, lookup)` → `Response`:<br>• no `X-O2H-Config` → untouched<br>• look up `{ config, options }`<br>• forward the request without the header<br>• not OK or not JSON → passed through<br>• `o2h(config, json, { ...options, embed: true })` → `text/html`<br>• `Vary: X-O2H-Config`, minus `Content-Length` / `Content-Encoding`<br>• a render error, or a missing key → the original JSON, with an `X-O2H-Error` header |
| **`worker/store.ts`** | page and service worker | The IndexedDB record store. The page writes (`storeO2HConfig(key, { config, options })`); the worker only reads, as you asked. |
| **`worker/serviceWorker.ts`** | service worker | The entry: a `fetch` listener calling the core with the IndexedDB lookup; `skipWaiting()` on install and `clients.claim()` on activate, so a first visit is controlled without a reload |
| **`worker/client.ts`** | page | `whenO2HWorkerReady(url)`: registers the worker (`type: 'module'`) and resolves once it **controls the page**, so fetches made after it are guaranteed to go through it. That's the promise you asked for, from `navigator.serviceWorker.ready` plus the `controllerchange` event. No `postMessage` or shared storage is needed. |

### One blocker: workers can't resolve o2h's imports

**o2h imports assign-gingerly with bare specifiers** (`assign-gingerly/handlers/treeSpec.js`). Pages resolve those through an import map, but **import maps don't apply to workers**. I checked with a small module service worker that imports a bare specifier, with an import map on the page:

| | Page import | Module service worker |
|---|---|---|
| Chromium | ✅ | ❌ "ServiceWorker script evaluation failed" |
| Firefox | ✅ | ❌ "threw an exception during script evaluation" (it does support module service workers) |
| WebKit | ✅ | ❌ "Module name 'lib/hello.js' does not resolve to a valid URL" |

So the service worker can't load o2h as it stands. The options:

1. **Bundle the worker** (my recommendation). A dev dependency on **esbuild** and an `npm run build:worker` script produce one ES module file: the worker entry, o2h, and the few assign-gingerly modules o2h uses, all DOM-free.
   - It's still a module, and it's still the same source.
   - The page registers the built file.
   - The core is also what a Cloudflare Worker would bundle; Wrangler bundles with esbuild itself.
   - The cost: one build step for the worker, and a new dev dependency.
2. **Relative imports in o2h** (`../assign-gingerly/…`). These work in the workspace, but break for anyone installing o2h from npm. Not viable.
3. **A small script of our own** that copies the needed assign-gingerly modules next to the worker and rewrites their imports to relative paths. It's buildless at runtime and has no new dependency, but it's a home-made bundler to maintain. I wouldn't.
4. **Wait for import maps in workers.** There's a proposal, but no browser supports it today, per the test above.

### Questions

1. **Bundling:** OK to add **esbuild** as an o2h dev dependency, with a `build:worker` script (option 1)? Or one of the others?
2. **One IndexedDB record** `{ config, options }` per `X-O2H-Config` key, or two headers and two records?

With those two answers, I'll implement Phase I as described, with Playwright tests for:
- a page that stores a config, waits for the worker, and fetches an API URL with `X-O2H-Config`, getting back HTML with the embedded JSON;
- that page hydrating from it;
- pass-through for unmarked requests;
- the `X-O2H-Error` fallback.

## Bruce's Response II

> 1. **Bundling:** OK to add **esbuild** as an o2h dev dependency, with a `build:worker` script (option 1)?

Good catch.  Looks like that is the least painful approach, so let's do that.

> 2. **One IndexedDB record** `{ config, options }` per `X-O2H-Config` key, or two headers and two records?

Sure, one record is fine.


## Claude's Implementation Notes

Phase I is in. It covers script fetches only: one `X-O2H-Config` header, one IndexedDB record `{ config, options }` per key, JSON-only records, and a module service worker bundled with esbuild.

### The modules (`o2h/worker/`)

| File | Runs in | What |
|---|---|---|
| **`core.ts`** | any worker with the Fetch API | `isO2HRequest`, `handleO2HRequest(request, lookup)`, `O2H_HEADER`, `O2H_ERROR_HEADER`. Only the Fetch API and o2h, so a Cloudflare Worker can use it later with its own lookup. |
| **`store.ts`** | page and service worker | IndexedDB database `o2h`, store `records`: `storeO2HRecord`, `getO2HRecord`, `deleteO2HRecord` |
| **`serviceWorker.ts`** | service worker | The entry. `skipWaiting()` on install and `clients.claim()` on activate, so a first visit is controlled without a reload. The `fetch` listener only responds to marked requests. |
| **`client.ts`** | page | `whenO2HWorkerReady(url)`: registers the worker as a module, and resolves once it **controls the page**, so every fetch after it goes through the worker. Also re-exports the store functions and `O2H_HEADER`. |
| **`build.mjs`** | Node | Bundles `serviceWorker.ts` into **`o2h-sw.js`** (at o2h's root) with esbuild, as an ES module. In the workspace, it takes assign-gingerly from the sibling repo, as the workspace's import map does for pages; otherwise from `node_modules`. |

**What `handleO2HRequest` does**, as agreed:
- **Forwarding:** the request goes upstream without `X-O2H-Config`.
- **Not OK, or not JSON** (`application/json` or `+json`): the response is returned as is.
- **Missing record, or a render error:** the original JSON, with `X-O2H-Error` (Latin-1, and at most 300 characters).
- **Success:** `o2h(config, json, { ...options, embed })`. `embed` keeps the record's `{ check: false }` if it has one, and is otherwise `true`. The response is `text/html; charset=utf-8`, minus `Content-Length` / `Content-Encoding`, with `Vary: X-O2H-Config`, and the upstream status.

### Packaging and build

- **`package.json`:**
  - `esbuild` is a dev dependency;
  - `npm run build:worker` builds the bundle;
  - `files` gains `o2h-sw.js` and `worker/*.js|ts`;
  - `exports` gains `./worker/client.js`, `./worker/core.js` and `./o2h-sw.js`.
- **`tsconfig.json`:** includes `worker/*.ts`, so `tsc` emits `client.js` and `store.js` for pages.
- **npm's install script for esbuild didn't run.** Newer npm asks before running install scripts. esbuild works without it, since its platform binary came as an optional dependency (`@esbuild/win32-x64`). `npm install-scripts approve esbuild` would let the script run, if you want that.
- **The bundle is 207 KB,** unminified. Most of it is assign-gingerly code reached through o2h's import of `assignFrom.js`. Trimming that (o2h needs only part of it) would be a follow-up, if size matters.
- **`o2h-sw.js` is build output,** like `o2h.js`, so it's committed and published.

### Tests

**`tests/service-worker.html`** (with the fixture `tests/data/mission.json`), as a new browser test in `tests/o2h.spec.ts`. It runs through the real service worker, in **Chromium, Firefox and WebKit**, and checks:
- **The ready promise:** `whenO2HWorkerReady` resolves with the page controlled.
- **A marked fetch:**
  - the response is `text/html; charset=utf-8` with `Vary`;
  - the exact rendered HTML, including a repeat and escaped text;
  - the JSON embedded after the tree;
  - the data round-trips, `</script>` included.
- **Hydration:** `builtIns.tree` with `adopt`, from the embedded data, reuses every element.
- **Unmarked fetches:** untouched JSON.
- **A missing key:** the original JSON, with `X-O2H-Error: no record for "…"`.
- **A render failure** (a snippet the options don't have): the original JSON, with `X-O2H-Error: rendering failed (…)`.
- **Marked, but not JSON:** untouched.

**o2h's browser tests:** 12 passed (the new one in three browsers). The Node tests are unaffected, since `o2h.ts` didn't change.

### For you

- **New files:**
  - `worker/` (the `.ts` sources, their `.js` output, and `build.mjs`);
  - `o2h-sw.js`;
  - `tests/service-worker.html`, `tests/data/mission.json`.
- **Changed:** `package.json` (with `package-lock.json`), `tsconfig.json`, the README ("Service worker (Phase I)" section), and `tests/o2h.spec.ts`.

### Later phases (from this discussion)

- **A Cloudflare entry,** using `worker/core.js` with a KV or bundled lookup.
- **Pipes, protocols and managers** for per-key records: the separate discussion.
- **A fallback** where the page renders the JSON itself when no worker is active (Phase II).
- **Navigations,** and NDJSON / streaming.

## Bruce's Response III

I've been thinking about how to move forward with JS references for pipes, managers, etc.

I may come back to this in a few years when import maps are supported in workers (hopefully).  For now, what I'm thinking would be the most realistic path to what I want to accomplish is this:

In the main thread, the user defines the client side config / options objects needed to hydrate (I don't have them memorized).  These include the optional registry, pipes, etc.

1.  The o2o package defines some sort of package / function that takes the objects above, and finds a way to clone them into the X-O2H-Config object without throwing an error.  Of course, that means the functions will be gone.
2.  If needed, during that clone process in step 1, a list is maintained of what functionality was lost in the course of the cloning.
3.  Currently, when running in the main thread, o2h marks sections of the html with attribute "data-pending", which requires attention in the hydration process.  I'm thinking that due to step 1 stripping some functionality, the sections of HTML that need client side adjustments to compensate may become larger, and that's perfectly okay.  More work on the client to get fidelity to the intended result, but it's the best we can do.

This is a little vague, but does it make sense?  Can you attach a little more detail to the idea, and see if it is doable?


## Claude's Response III

**Yes, it makes sense, and it's doable.** It fits what's already there: `data-pending` exists for "the server couldn't finish this; the client must". Your idea extends it from "HTML can't carry this" to "the worker didn't have the code for this". Below: the three steps in more detail, one gap I found, and what it would take.

### Step 1: a cloneable record, with stand-ins for what can't be cloned

A page-side function, e.g. `prepareO2HRecord(config, options)`, walks both objects and returns `{ record, lost }`:
- **Plain data is copied** as is: objects, arrays, strings, numbers, booleans and `null`. That covers the tree config itself (including `` tree`…` `` output), `aka`, `markerName`, `snippets` and `style`.
- **Each function or class is replaced by a small stand-in object,** not just dropped, e.g. `{ $o2hLost: 'function', name: 'longUtc' }`.
  - **Why a stand-in:** the record keeps its shape. `options.pipes` still has a `longUtc` key, and `options.managers` still has `rocket-manager`. So the worker still knows these things *exist*, even though it can't run them. That's what makes step 3 precise.
- **Other non-cloneable things** (an `ItemscopeRegistry` instance, a class in an `ish` header) get stand-ins too, with their kind, plus a usable name where there is one (a manager class's static `is`).

It also helps the page: the same function can derive the **key** from a hash of the config, so pages don't have to invent and track GUIDs. The same config always gets the same key, and a changed config gets a new one, so a stale record can't be used by mistake.

### Step 2: the list of what was lost

`lost` would be entries like `{ path: 'options.pipes.longUtc', kind: 'pipe' }` or `{ path: 'options.managers.rocket-manager', kind: 'manager' }`. Uses:
- **Development:** a console note, e.g. "this config renders less in the worker: pipes `longUtc`, `kmh`; managers `rocket-manager`".
- **The worker** doesn't need the list, since the stand-ins carry the same information in place.

### Step 3: the worker marks what depends on lost code as pending

This is where the gap is. **Today, a pipe o2h wasn't given is silently treated as an ordinary property name.** `'?.date?.parseDate?.longUtc'` resolves to `undefined`, so the text comes out *empty*, and **the element isn't marked `data-pending`.**
- With `adopt: true`, the client fixes the text anyway, since it rebinds everything.
- With `adopt: 'pending'`, it would **stay empty**, since unmarked elements aren't bound.

So step 3 needs o2h to *know* that something depended on lost code:
- **In the worker, the stand-ins become stubs that throw** a recognizable `LostReference` error: a stand-in pipe or protocol becomes `() => { throw new LostReference('pipe longUtc') }`.
- **o2h catches it per pattern key,** and treats that key as "not renderable here": it writes nothing for it (no text, no attribute) and marks the element `data-pending`. The rest of the element, and the rest of the page, render normally.
- **Managers** already work this way: an element with a manager that has no class is marked pending, and its subtree renders from the raw value. In `'pending'` mode, everything inside a mark is rebound, so the manager's getters fill it in on the client.

**The regions do get larger,** as you expected: every element whose pattern uses a lost pipe or protocol becomes pending. They don't get larger than that, though, because it's per element, not per section.

### The harder case: structure that depends on lost code

Sometimes a lost pipe decides **structure**, not just text:
- a **switch** whose discriminant uses a pipe (`choose('?.status?.normalize', …)`);
- a **repeat** whose `of` or `key` does.

The worker can't know which case to render or which items to stamp. If it renders nothing, or guesses, the client's `adopt` walk finds a structural mismatch and **rebuilds the whole tree**. That's correct, but it throws away the server rendering for the entire page.

The fix needs a small addition on **both** sides:
- **o2h** emits a "pending structure" placeholder in that slot: `<!--?switch pending-->` for a switch, or the repeat's container element marked `data-pending` and left empty.
- **Tree's `adopt`** accepts those placeholders: it renders that one slot fresh on the client, instead of giving up on the whole tree. Everything around it is still adopted.

Without this, Phase II works for text and attributes, but any switch or repeat driven by a lost pipe costs a full client render.

### Is it doable? Yes. The pieces

| Piece | Where | Size |
|---|---|---|
| `prepareO2HRecord(config, options)` → `{ key, record, lost }`, stand-ins, cycle-safe walk | o2h `worker/client.ts` | small |
| Turn stand-ins back into throwing stubs (pipes, protocols); drop lost managers | o2h `worker/core.ts` | small |
| Per-key catch of `LostReference`: skip the key, mark the element pending | `o2h.ts` (`renderSpec`) | small to medium |
| "Pending structure" placeholders for switches and repeats | `o2h.ts`, plus Tree's `adopt` in assign-gingerly | medium |
| Tests: a config with pipes and managers through the worker, hydrated with `adopt: 'pending'`, matching a client-only render | both | medium |

### A complement worth considering: pipes as data

Many pipes are formatting (dates, numbers, units), which is exactly what `Intl` does. A pipe **described as data**, e.g. `{ intl: 'DateTimeFormat', options: { dateStyle: 'long' } }` instead of a function, **survives the clone** and runs in the worker. That's the be-intl idea, on the server side. It wouldn't replace your plan; it would shrink what gets lost in it.

### Questions

1. **Stand-ins rather than dropping** (so the worker knows what existed)?
2. **A key derived from the config's hash**, or keep the page's own keys (GUIDs)?
3. **The structural case:** include the "pending structure" placeholders (and the Tree `adopt` change) in Phase II, or accept full client renders for those cases at first?
4. **Pipes as data:** worth a separate document?
