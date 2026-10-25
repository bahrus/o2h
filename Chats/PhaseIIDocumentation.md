# Phase II documentation

## Bruce's Ask

I noticed that the readme for o2h mentions the phase I solution, but not phase II.  If I'm not mistaken, can you please add that.  Also, I think we should give them more descriptive names (main thread exclusively vs service worker first paint, or something like that.)


## Claude's Notes

**You're half right.** Phase II *was* in the README, but it was buried: one long bullet ("Code the worker can't have") under a heading that still said "Service worker (Phase I)". The README is now restructured, with descriptive names.

### The names

| Was | Now |
|---|---|
| (the whole approach) | **Service worker first paint**, next to **Main thread only** and **Server first paint** |
| Phase I | **Data-only configs**: the worker renders everything |
| Phase II | **Configs with code: stand-ins and pending parts**: the worker renders what it can, and the page finishes the rest with its own code |

Your "main thread exclusively vs service worker first paint" was about *where the first paint comes from*. That's the right top-level axis, so it became the overview. Phase I vs Phase II are both service worker first paint, and differ in *how much* the worker can render, so they became its two subsections.

### The README now

1. **"Where the first paint comes from":** a new overview table at the top, with the three approaches, who renders the first paint in each, what the main thread does, and where each is documented.
2. **"Finishing on the client: hydration":** unchanged (it serves both server and service worker first paint).
3. **"Service worker first paint":** the example, plus a two-line summary of the two levels. Then:
   - **"Data-only configs":** the worker's behavior (marked requests, records, the response, fallbacks, the bundle, the shared core). It also says which configs are data-only: tree notation, `aka`, `markerName`, `snippets`, `style`, and data pipes.
   - **"Configs with code: stand-ins and pending parts":** `prepareO2HRecord` (stand-ins, `lost`, the content key), what o2h leaves pending and how, and hydration with `adopt: 'pending'`.
   - **"Data pipes survive":** why data pipes keep more of the page rendered in the worker.

**Links:** assign-gingerly's `docs/pipes.md` linked to the old heading's anchor; it now points to `#service-worker-first-paint`. No other docs linked to it.
