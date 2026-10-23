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
