# Claude Code Generator

## Bruce's Ask

Maybe three years ago, I developed [this page](https://unpkg.com/o2h-cw@0.0.8/demo/o2h-view.html)  so anyone could specify a url for an API, build a form with input parameters for the API, specify a path to a config.json that is used to configure how to convert the JSON into html (radically different from the tree approach).  The weakest point was definitely the JSON, that required a lot of finagling and wasn't very powerful.

Now, with the capabilities of AI, I'm thinking Claude could create a Claude hosted page that allows the user to specify a url to information about an API.  Take this one for example:

https://api.nasa.gov/assets/files/apod/APOD-APIs-and-RSS-info.pdf

Ideally, a swagger json link would be provided, but that is certainly not available for many public api's I come across.

The page would have also have a place where one could drag an image and/or point to a Claude design screen.

What the Claude hosted page would do is:

Provide a working html page, that could be tested right there or downloaded that:

1.  Has a form where users could specify the parameters for the api (like swagger does).
2.  Has the JSON config and JS manager classes, pipes, etc
3.  On submitting the page to the cloudflare worker, draws the HTML using the streaming api's, which should look as close to the Claude Design as possible.

We don't yet have the cloudflare worker rewritten -- I'm debating throwing away all the code in the o2h-cw cloudflare worker that the the first link above posts to.  Versus just writing a new cloudflare worker from scratch.  What name would you give that worker?

I wanted to get your thoughts on this roadmap for the end goal before embarking on the cloudflare worker (modeled after the o2h service worker).

Could something like that work?

Please add your thoughts below.


## Claude's Thoughts

**Yes, I think it can work.** The pieces built over the last weeks fit this roadmap unusually well. The step that changes most from the old o2h-cw is the one you called its weakest: the config. With Claude writing it, it no longer has to be easy to write by hand.

### The three parts

| Part | What it is | Status |
|---|---|---|
| **1. The generator page** | A Claude-hosted page: give it an API's documentation (Swagger/OpenAPI if there is one, else a PDF or web page), and optionally a design (an image, or a Claude Design). It produces the page in part 3. | New |
| **2. The edge worker** | A Cloudflare Worker: it takes the API call's parameters, calls the API, renders the JSON with o2h, and returns HTML | New entry point; the core exists (`o2h/worker/core.ts`) |
| **3. The generated page** | One HTML file: a form for the API's parameters, the tree config, data pipes, manager classes and CSS. On submit, the worker renders the result, and the page hydrates it. | Generated |

### Part 1: why this is now realistic

- **Claude can read API documentation** that isn't machine-readable (the NASA APOD PDF is a typical case) and produce what Swagger would have given you: endpoints, parameters, types, required/optional, example responses. A test call against the real API then confirms the response shape, instead of trusting the documentation.
- **From a design image,** Claude can produce the CSS and the tree structure that match it. The tree notation, `` tree`…` ``, snippets and holes make that output compact and checkable.
- **The page itself:** Claude-hosted pages (artifacts) can ask Claude questions at runtime, so the generator can run as a page, with the person's own account doing the generation.

### Part 2: the worker, and the main design constraint

**Cloudflare Workers can't run code they receive.** `eval` and `new Function` are disabled there. So the managers and function pipes Claude generates **run only in the browser**, and that's exactly the situation the service worker's Phase II was built for:
- the worker renders with **stand-ins** for that code;
- what needs it is marked **`data-pending`**, or left as a **pending structure**;
- the page **hydrates** with the real code (`adopt: 'pending'`).

**So the generator should prefer data over code:** **data pipes** for formatting, lookups and built-ins (these *do* run in the worker), plain tree configs, snippets for static markup, and managers only where real behavior is needed. The more the generated page is data, the more the worker renders and the less the client finishes. This gives "pipes as data" a second reason to exist.

**Where the worker gets the config:** like the service worker's IndexedDB record, a **record keyed by a content hash**. On Cloudflare, that would be KV. The generator stores the record when it creates the page, and the page sends only the key. This keeps requests small and cacheable. The config can't be tampered with per request either, which matters because a public worker renders whatever it's given.

**"Streaming":** o2h renders the whole result at once, from the whole JSON, so the data part isn't streamed. But the worker can still **stream the page**: send the `<head>`, the CSS and the page shell immediately, while it waits for the API, then the rendered HTML. On a slow API or a slow phone, the shell is visible right away. That's the streaming win that's available now. Streaming the rendering itself (NDJSON, long lists) would be a later phase.

### Part 3: the generated page

**There are two ways to "submit to the worker"**, and they're worth choosing between deliberately:
- **A fetch** (like the service worker today): the page stays, the form's values go to the worker, and the HTML comes back into a container, then hydrates. This works today, apart from the worker itself.
- **A navigation** (a classic form submit): the worker returns a **whole page**. This needs the "navigations" phase we deferred, a full document template around the tree, but it works without JavaScript, and links can be shared.

I'd start with **fetch**, and add navigations once the worker exists.

### Things to settle before building

1. **Security of a public worker.** A worker that fetches any URL it's given is an **open proxy**. It can be abused, and it can reach things it shouldn't (SSRF). It needs:
   - an allowlist of API origins, per record or per account;
   - no private or loopback addresses;
   - rate limits;
   - a size limit on API responses.
2. **API keys.** Many APIs need one (NASA's `DEMO_KEY` is rate-limited). Keys shouldn't be in the generated page. The worker can hold them as Cloudflare secrets, per record, and add them to the upstream call.
3. **CORS for the documentation.** The generator page, running in a browser, often can't fetch a PDF or docs page from another site. The worker can fetch it on the generator's behalf, with the same allowlist and limits.
4. **Who pays for generation.** With the artifact asking Claude at runtime, the person using the generator spends their own usage. That's probably right, but it should be clear in the page.
5. **Checking what Claude produces:**
   - the test call that confirms the response shape;
   - o2h's own reports (`unrendered`, `notSerializable`);
   - a render of the test response shown before download.

   Generated configs should be verified, not trusted.

### The old worker: rewrite or reuse?

**I'd write a new one,** and leave o2h-cw as it is (published, with its demo still working):
- **The old one's config approach is gone:** you describe it as radically different from the tree approach.
- **The new worker is mostly done already:** `worker/core.ts` has the shared core (forward the request, render, set the headers, fall back on errors). The Cloudflare part is a thin entry point: KV lookup, secrets for API keys, the allowlist, the parameter handling, and the streamed page shell. That's maybe a few hundred lines, not a rewrite of the old project.

I haven't looked at o2h-cw's code, so there may be pieces worth porting, such as parameter handling, but I wouldn't start from it.

### A name

**`o2h-edge`** is my suggestion: it says what it is (o2h, running at the edge), it sits next to o2h without being confused with the service worker (`o2h-sw.js`), and it isn't tied to Cloudflare if another edge runtime comes along. Alternatives: `o2h-cf` (clear, but tied to one vendor), or something product-like for the end-to-end idea, such as `api2html`, if the generator becomes a thing of its own.

### A possible order

1. **`o2h-edge` Phase I:** the Cloudflare entry point for `worker/core.ts`, KV records keyed by hash, the allowlist, secrets, fetch mode, and the streamed shell.
2. **The generated-page template:** form, config, data pipes, managers and hydration, written by hand once for the NASA APOD API. This proves the target before automating it.
3. **The generator page:** documentation in, that page out, with the test call and the preview.
4. **Later:** navigations, and design images to CSS.

### Questions

1. **The name:** `o2h-edge`, or another?
2. **Fetch first, navigations later,** for "submit to the worker"?
3. **Security and keys:** an allowlist per record, and API keys held as worker secrets. Agreed in principle?
4. **Start with step 2 by hand** (a hand-written APOD page) before automating it?
