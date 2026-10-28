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


