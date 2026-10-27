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
