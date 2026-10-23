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
