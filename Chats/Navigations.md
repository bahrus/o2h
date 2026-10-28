# Navigations

## Bruce's Ask

We agreed to [first tackle fetch](./BaseServiceWorker.md#what-needs-clarifying) based service workers.

But the [store demo](../../o2h-edge/Chats/SampleStoreApp.md) would benefit from navigations as well.

Can you please describe how you propose to do this, and any clarifications needed before proceeding?



## Claude's Thoughts

### Why navigations need more than fetches

Today a request is marked "render me" by the `X-O2H-Transform` **header**. A navigation (a link click, the address bar, a crawler, a bookmark) **can't carry a custom header**, and it expects a **whole document** back, not a fragment. So navigations need three things fetches don't:
1. **Routes:** which URL means which API call(s) and which transform, without a header.
2. **A page shell:** the document around the rendered part (`<head>`, styles, the import map, the script that hydrates).
3. **A way for the page to find its code:** with fetches, the page that asks *is* the code. With navigations, the worker serves the page, so the shell has to name the module that hydrates it.

### The proposal

**1. A site definition:** routes plus a shell, prepared on the client like transforms.

```js
// demo/store/site.js: used both to publish the site and, in the page, to hydrate it
export const site = {
    shell: '<!doctype html><html><head>…<!-- o2h:head --></head><body><nav>…</nav><main><!-- o2h:main --></main></body></html>',
    routes: [
        {
            pattern: '/store/',                               // URLPattern pathname syntax
            sources: {                                        // fetched in parallel, through the guards
                categories: 'https://fakestoreapi.com/products/categories',
                products: 'https://fakestoreapi.com/products',
            },
            config: { map: { categories: …, products: … } },
            title: 'Fake Store',
        },
        {
            pattern: '/store/category/:name',
            sources: { categories: '…/products/categories', products: '…/products/category/{name}' },
            config: { map: { categories: …, products: … } },
        },
        {
            pattern: '/store/product/:id',
            sources: { product: 'https://fakestoreapi.com/products/{id}' },
            config: { map: { '?.product': tree`<article>…</article>` } },
            title: '?.product?.title',                        // a path into the VM
        },
    ],
    options: { pipes, style: true },
};
```

- **The VM a route renders is `{ route, ...sources }`:** `route` holds the URL's parameters (`{ id: '3' }`), and each source holds its JSON. That one shape covers several things at once:
  - **several APIs per page**, which the store's category nav plus grid needs;
  - **the route parameters the earlier chat asked for**, so the current category is `'$root?.route?.name'`;
  - **one JSON embed:** the VM is what gets embedded, so hydration sees exactly what the worker rendered.
- **`{name}` in a source URL** is filled from the route parameters, URI-encoded. A source URL is otherwise fixed by the author, so a visitor can't point the worker at another API. That's tighter than `/render?api=`.
- **`prepareO2HSite(site)`** (next to `prepareO2HTransform`) turns each route's config and options into a transform, with stand-ins and a hash key, and the whole site into one storable object.

**2. Rendering a navigation:** `renderO2HPage(site, url, fetchUpstream)` in `worker/core.ts`, shared by the service worker and the edge.
1. Match the URL against the routes. No match → pass through (service worker) or 404 (edge).
2. Fetch the sources in parallel, through the same guards as now.
3. Render the route's tree with o2h.
4. Put the result into the shell: `<!-- o2h:main -->` gets the tree, with the VM embedded after it. `<!-- o2h:head -->` gets the `<title>` and a small `<script type="application/json" data-o2h-route>` (the route's index and parameters).
5. Respond `text/html`, streamed if we want later.
- **When a source fails:** a 502 page from the shell, with a message in `main`. The status could also come from the source.

**3. Hydrating:** the shell's module script.

```html
<script type="module">
    import { site } from '/demo/store/site.js';
    import { hydrateO2HPage } from 'o2h/worker/page.js';
    hydrateO2HPage(site);   // reads data-o2h-route and the embedded VM, then adopt: 'pending' with the real pipes
</script>
```

The same `site.js` gives the worker its data (through `prepareO2HSite`) and the page its code, so they can't drift apart. If a navigation wasn't rendered by a worker (see 4), the same call renders on the page.

**4. The two runtimes:**
- **The service worker** (same origin): the page stores the prepared site in IndexedDB, as transforms are now. The worker answers `request.mode === 'navigate'` requests that match a route.
  - **The first visit** can't be served by the worker, since it isn't installed yet. So the route URLs need the server's SPA fallback (spa-ssi has one). The page that comes back renders on the page (step 3) and registers the worker. After that, navigations are rendered by the worker.
- **o2h-edge:** the site lives in KV, and the worker answers navigations to its routes. Two things are new there:
  - **How a site is addressed** (question 2 below).
  - **Static files:** the page is now served from the worker's origin, so its CSS, its modules (`site.js`, assign-gingerly, o2h) and its import map targets must be reachable from there (question 3 below).

**5. Navigating once there:** plain links, a real multi-page app. Each click is a navigation the worker renders. Cross-document **view transitions** (`@view-transition { navigation: auto; }`, in Chromium and Safari) make that feel like an SPA, with no JavaScript. Later, the Navigation API could intercept clicks and fetch just the main fragment with `renderViaEdge`, but I'd start without.

### Suggested order
1. **The core:** `prepareO2HSite`, `renderO2HPage`, `hydrateO2HPage`, with Node tests in o2h, like the existing ones.
2. **One runtime**, with the store as a multi-page app (question 1).
3. **The other runtime.**
4. **Later:** streaming the shell's head before the sources arrive, caching catalog sources, and Navigation API interception.

### Clarifications needed

1. **Which runtime first?** The store is an o2h-edge demo, so I'd lean toward the **edge** first. The service worker needs less new infrastructure, though (no asset hosting, no site addressing). If 2 and 3 below look heavy, the service worker first is the quicker proof.
2. **How the edge finds the site for a URL.** Navigation URLs should be readable (`/store/product/3`), so the content hash can't be in them. The options:
   - **(a) Named sites** (my recommendation): `PUT /sites/<name>` with the admin token, since a name can be overwritten. A site's routes then live under `/<name>/…`, and the `PUT` is a publish step (a small Node script, or a page with the token, like the transforms page).
   - **(b) Per host:** a var maps a custom domain to a site key, like `DOMAIN_ALLOWLIST`. It's clean for production, but needs a domain per site.
   - **(c) Bundled at deploy:** the site is part of the worker bundle. It's the simplest to serve, but every edit needs a deploy.
3. **Static files on the edge.** Either:
   - **Workers Static Assets** (my recommendation): `assets` in `wrangler.jsonc`, a directory the worker also serves. That needs a small copy step to gather `demo/store/`, plus the built assign-gingerly and o2h modules it imports.
   - **Or** the shell points at an external host or CDN with absolute URLs. That works once the packages are published (jsDelivr). In development, it would need the local server to send CORS headers for module scripts, which spa-ssi doesn't.
4. **The VM shape `{ route, ...sources }`** for routed pages. The store's configs would change from a bare array (`'*'`) to named parts (`products`, `categories`, `'?.product'`). I think that's clearer, and it's what makes several sources and route parameters work. Agreed?
5. **The shell format:** static HTML with two slots (`<!-- o2h:head -->`, `<!-- o2h:main -->`), plus a per-route `title` path, as above? Or should the shell itself be a tree, so the nav and the title come from data too? I'd start static, and let the nav be a source in the tree, as the categories are here.
6. **Comparisons:** even with `route` in the VM, marking the current category needs an equality check, which data pipes don't do yet. That's a small descriptor (`{ eq: … }`) for assign-gingerly. Do it with this, or leave that one line to the page for now?

## Bruce's Response

> A navigation (a link click, the address bar, a crawler, a bookmark) **can't carry a custom header**, and it expects a **whole document** back, not a fragment.

This is an enlightening statement.  Somehow, I haD a vague picture that the navigation vs fetch support was focused around providing better mechanics for, I guess, (reverse?) proxying data requests tied to links from the page to the (third party) api, but which still, fundamentally, relied on fetch.  But you are really talking creating a multi-page application, where routes of the multi-page application map to the back end (third party) api's.  Interesting and definitely useful.

It's a little easier for me to mentally visualize this scenario by thinking about the o2h-edge scenario, where we have two web servers running -- a highly reusable edge worker that just "obeys commands" according to what it's given, and  acts as a "dumb" transformer.  And (in this case) a fairly traditional web app running via the spa-ssi server (almost any would do), running in the client browser, that has an intimate concept of how the API should be transformed into a multi page application, so hardcoding things like routes and how they map to the third party api's is "par the course".

Do I have the right mental model?  That distinction becomes a bit more murky when we scrunch the two together with a single web server (main thread vs service worker thread).

I guess this could work.  Being that I like to "package" things so they can be imported easily, and I have a bias towards declarative, side-effect free configuration, the next thing I might be exploring is seeing if it is possible to turn the site const into a JSON import, allowing for strings where functions would go, where those strings point to JS Module imports.

I also wonder how much of the code to support the site really "belongs" in o2h, if we limit it to its currently stated mission.  If you were to name a package where the navigation code should go, that o2h could import (devDependencies or dependencies, TBD), what would you call it?

I would like this implementation to be quite forward looking, resting on the new navigation API, rather than on history.state.  Do you see any [issues with this](https://caniuse.com/mdn-api_navigation)? 

## Claude's Thoughts II

### The mental model: two models, actually

Your picture is right, with one correction, and the correction splits it into **two models**. They differ in **who serves the documents.**

**Model A: the edge serves the pages** (what my proposal described).
- **The browser navigates to the edge's own URLs** (`https://o2h-edge…/store/product/3`). The edge answers each with a whole document: shell plus rendered tree.
- **spa-ssi** (or a publish script) is only where the site is **authored and published**. At runtime, the browser never talks to it.
- **What it gives:** true server rendering. The first byte is the finished page, links work without JavaScript, and crawlers see content.
- **What it costs:** the edge has to serve the page's static files too, and sites need addresses on the edge. Those were questions 2 and 3. The edge also stops being purely "dumb": it holds the site's routes.

**Model B: the app serves the pages, and the edge stays a dumb transformer** (your picture).
- **The browser stays on the app's origin** (spa-ssi, or any server): `http://localhost:8010/store/product/3`.
- **The app's own JavaScript** maps routes to APIs and transforms, intercepts link clicks with the **Navigation API**, and asks the edge for just the fragment (`renderViaEdge`), which it then hydrates. The edge only ever sees "render this API with this transform", as today.
- **A deep link or a reload:** the app server returns its shell (spa-ssi's SPA fallback), and the same route code renders that URL through the edge.
- **What it gives:**
  - nothing new on the edge: no static hosting, no site addressing;
  - real URLs, Back and Forward, and smooth transitions;
  - it rests on the Navigation API, as you want.
- **What it costs:** the first paint of a deep link waits for the page's JavaScript and one edge round trip, rather than arriving finished. Crawlers see the shell, unless the app server renders too.

**With the service worker,** the two collapse into one origin, which is why it gets murky. The service worker can answer navigations itself (Model A, inside the browser), or the page can intercept with the Navigation API and `fetch` fragments through the worker (Model B, as now).

**My recommendation: Model B first.**
- It matches your mental model and your Navigation API preference.
- It keeps o2h-edge a reusable "obeys commands" transformer.
- It needs almost nothing new on the edge.

The site definition (routes → sources, config, title) is the same either way. Model A can come later, reusing it, for server-rendered first loads and crawlers.

### A JSON site definition

Yes, that fits well. Nearly everything is already data:
- routes, URL patterns, source URLs, titles;
- tree configs in notation;
- data pipes, which are descriptors.

**What isn't data** is function pipes and manager classes. Those can be module references:

```json
{
    "routes": [
        {
            "pattern": "/store/product/:id",
            "sources": { "product": "https://fakestoreapi.com/products/{id}" },
            "config": { "map": { "?.product": ["article", {}, []] } },
            "title": "?.product?.title"
        }
    ],
    "options": {
        "pipes": {
            "usd": { "intl": "NumberFormat", "locale": "en-US", "options": { "style": "currency", "currency": "USD" } },
            "plainText": { "import": "./pipes.js", "export": "plainText" }
        },
        "managers": { "cart-manager": { "import": "./cart.js", "export": "CartManager" } }
    }
}
```

- **On the page,** a loader resolves each `{ import, export }` with dynamic `import()`, relative to the JSON's URL, before hydrating. `import site from './site.json' with { type: 'json' }` works in current browsers.
- **In a worker,** a module reference is exactly what o2h's stand-ins are already: code it can't run, left pending. So the JSON can go to the worker almost as is, with module references read as stand-ins.
- **One catch:** `` tree`…` `` is code that *produces* notation. In a JSON file, configs are written in notation directly, or generated from `` tree`…` `` by a build step. (assign-gingerly's docs already suggest the DX layer is best used at build time.)

### Where the navigation code belongs

**I agree it doesn't belong in o2h.** o2h's mission is "object to HTML". Routes, sources, shells and the Navigation API are about **sites**.

**The dependency direction matters:**
- **The new package should not need o2h itself.** It takes a "render this VM with this transform" function, and the site's routes.
- **The runtimes compose the two:** the app's page (with `renderViaEdge`), and later the service worker and the edge (Model A).
- **o2h wouldn't import the new package at all.** It stays the renderer, plus the worker core for fetches.

**What it would hold:**
- matching URLs to routes (`URLPattern`);
- filling source URLs from route parameters;
- composing the VM `{ route, ...sources }`;
- the Navigation API client (intercept, then fetch, insert and hydrate);
- resolving module references from a JSON site;
- later, for Model A, assembling the shell.

**Names**, in the family's style:
- **`navigate-gingerly`** (my pick): it says what it does, rests on the Navigation API by name, and sits with assign-gingerly.
- **`route-gingerly`**: if routing, rather than navigating, is the emphasis.
- **`o2h-site`**: plainer, but it ties the name to o2h, which the package wouldn't depend on.

### The Navigation API: any issues?

**Support is no longer the blocker it was.** Chromium has had it since 102, and I believe Firefox and Safari shipped it around the turn of 2025–26, which made it Baseline. Please confirm the exact versions on the caniuse page you linked; my information there may be behind. The remaining points are about using it well:
1. **Older browsers:** without `navigation`, links are ordinary navigations. With Model B, the app server's SPA fallback returns the shell, and the route code renders the URL. So the fallback is a full page load, not a broken page: progressive enhancement for free, and no `history.state` code at all.
2. **Interception is same-origin only.** `event.intercept()` works for same-document navigations on the page's own origin. That's fine for Model B, since the URLs are the app's, and only the data comes from the edge. Cross-origin links (to the API's site, say) just navigate.
3. **What to opt into:**
   - `intercept({ handler, scroll: 'after-transition', focusReset: 'after-transition' })` handles scroll restoration and focus for us. Those are the parts hand-rolled history code usually gets wrong.
   - `navigation.transition` gives a promise for the current navigation, which is handy for a loading state.
   - Same-document view transitions (`document.startViewTransition`) inside the handler animate between pages.
4. **What to avoid for now:** the newest additions, such as precommit handlers and deferred commit. They're less widely shipped. The core (`navigate` event, `intercept`, `entries`, `currentEntry`, `transition`) is what we'd use.
5. **Things to handle:**
   - downloads, `target=_blank`, modifier-key clicks, form posts and non-route URLs aren't intercepted;
   - `event.canIntercept` and `event.hashChange` tell us which navigations are which;
   - an aborted navigation (a second click mid-fetch) cancels the first fetch through `event.signal`.
6. **Per-entry state:** `navigation.currentEntry.getState()` and `updateCurrentEntry()` replace `history.state`. We may not need state at all: the URL plus the route is enough, which keeps things declarative.

### Questions

1. **Model B first** (the app serves pages and intercepts with the Navigation API; the edge stays a dumb transformer), with Model A later for server-rendered first loads? Or do you want Model A from the start?
2. **The package:** create `navigate-gingerly` as a new sibling repo in the workspace? Or start it inside o2h-edge's demo folder until its shape settles?
3. **The JSON site:** go JSON-first now (configs in notation, with `{ import, export }` references), or start with a JS module and move to JSON once the shape settles? I'd lean JSON-first, since it forces the declarative shape early, and the store's configs are small enough to write in notation.

## Bruce's Response II

> 1. **Model B first**

Actually, I'd like to dive into Model A first, at least conceptually, then decide which would make more sense to implement first.

I think the only "red flag" with Model A, that goes against the grain of what I'd like to accomplish, has to do with "hardcoding without namespacing" JavaScript into what is supposed to be a totally open, extendable on the fly service.

So for me to get excited about Model A, I would want there to be an "installApp" endpoint, where we could pass the mostly JSON object (which the installApp would carefully replace with stand-ins as needed), calculates a hash, and then instead of opening:

https://o2h-edge…/store/product/3

we would open:

https://o2h-edge…/o2h-app/:hash/store/product/3

Can that work?

## Claude's Thoughts III: Model A, with installed apps

**Yes, it works,** and it fixes the red flag: the edge holds no site of its own. It holds **apps anyone installed**, each addressed by the hash of its content, exactly like transforms. Nobody can change an installed app, only install a new one. And `/o2h-app/<hash>/…` namespaces every app's routes.

### The flow

1. **`PUT /o2h-app/<hash>`** (installApp). The body is the app: mostly JSON, plus `{ import, export }` module references. As with transforms:
   - the client prepares it (stand-ins for code, then the hash) and the edge checks that the hash matches the content;
   - it's size-capped (`MAX_APP_BYTES`) and stored in KV.
   - The edge never runs app code: module references are stand-ins to it.
2. **`GET /o2h-app/<hash>/store/product/3`:**
   1. Load the app from KV, cached in memory per isolate, since an app never changes.
   2. Match `/store/product/3` against its routes.
   3. Fetch the route's sources in parallel, through the guards.
   4. Render the tree into the shell.
   5. Embed the VM and the route, and respond with the whole document.
3. **In the browser,** the shell's hydration script loads the module references and hydrates (`adopt: 'pending'`). From then on, the Navigation API can intercept links and fetch just the next page's fragment from the same app, so later navigations don't reload the document.

### Things that make it work

- **Links inside an app:** the edge injects `<base href="/o2h-app/<hash>/">` into the shell. Authors write **relative** links (`href="store/product/${'?.id'}"`), and they resolve within the app. A root-relative link (`/store/…`) would escape the app, so the docs (and maybe a check at install) should say so.
- **Where the JavaScript comes from.** The page is now on the edge's origin. Two kinds of code:
  - **The hydration runtime** (assign-gingerly, o2h's client code, the navigation package) is **the service's own code**, versioned with the worker. The edge can serve it from Workers Static Assets (`/o2h-runtime/…`), plus an import map in the shell that points there. That's not app code being hardcoded into the service, so it keeps the service open.
  - **The app's own code** (function pipes, managers): its module references are **absolute URLs** to wherever the app lives: a CDN, or the author's server. Cross-origin module scripts need CORS headers. CDNs send them; spa-ssi doesn't yet, so local development would need that small change.
- **Versions:** a new hash per change means old links keep working against the old app, an immutable deploy. A shared link never picks up fixes, though. If that matters, a **named alias** (`/o2h-app/@store/…` → the current hash, which only the admin token can change) can come later, without changing the core.
- **The service worker** can do the same within its scope: install into IndexedDB, then answer navigations to `/o2h-app/<hash>/…`. The core (matching, sources, the shell) is shared.

### The one real concern: every app shares the edge's origin

With Model A, **the edge serves author-supplied HTML and scripts on its own origin.** With open installation, that means:
- **Apps can read each other's storage.** Every app lives at `https://o2h-edge…`, so app A's script can read app B's `localStorage`, `IndexedDB`, service worker registrations and cookies. Path prefixes don't separate origins.
- **Anyone can host a page on your domain.** An open `installApp` lets anyone publish arbitrary pages under your workers.dev name: phishing, spam, or scripts you didn't vet.

Transforms didn't raise this: they're data, and the page that used them lived on its own origin. Ways to contain it, from strongest:
1. **An origin per app:** `https://<hash>.apps.example.com/…`, through a custom domain with a wildcard route. That's real isolation, the way sandboxed-content domains (`*.githubusercontent.com`, `*.usercontent.goog`) do it. workers.dev has no wildcard subdomains, so this needs a custom domain.
2. **A restrictive Content-Security-Policy** on app pages:
   - scripts only from the runtime and from origins the app **declares** (and an allowlist may cap that);
   - no inline scripts except the edge's own, by nonce or hash;
   - `sandbox` without `allow-same-origin`, which gives each page an opaque origin. That isolates storage, but also takes storage away from apps entirely.
3. **Who may install:**
   - open in the sandbox, as transforms are, but labelled as such;
   - admin token only on custom domains, or everywhere;
   - or installs open, but apps served only on hosts that allow them (like `DOMAIN_ALLOWLIST`).

**My recommendation:** a CSP that limits scripts to the runtime plus the app's declared origins, from the start. Admin-only installs outside the sandbox. And per-app origins as the production answer, once there's a custom domain. Then the sandbox can stay open for experimenting.

### So, which first?

With apps installed this way, Model A is attractive, and much of the work is shared with Model B:
- **Shared:** the app format, `prepareO2HApp` with module references and stand-ins, route matching, sources and VM composition, and the Navigation API client.
- **Model A only:** shell assembly, installApp on the edge, the runtime served as static assets, `<base>`, and CSP.

So either order works. I'd build the shared core first, then Model A on the edge for the store, since it shows the most new value: finished pages from a deep link, readable by crawlers. Model B then comes almost free, as the client half.

### Questions

1. **Isolation:** is the combination above right (CSP now, admin-only installs off the sandbox, per-app origins later)? Or should installs be admin-only everywhere until per-app origins exist?
2. **Versions:** are immutable app URLs fine for now, with named aliases later?
3. **The runtime as static assets on the edge:** OK? It's the one thing the edge "hardcodes", but it's its own code, like the worker itself.
4. **App code during development:** add CORS headers to spa-ssi, so modules on `localhost:8010` can be imported by pages on the edge's origin (`localhost:8787`)?


