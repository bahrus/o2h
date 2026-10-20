# o2h

Converts a JavaScript object (typically a JSON API response) into HTML, as described by a [builtIns.tree](https://github.com/bahrus/assign-gingerly/blob/baseline/docs/tree.md) configuration: the same JSON the client-side handler takes.

o2h will typically run on the server (e.g. in a Cloudflare Worker) or in a service worker, to generate HTML from an API in a form the browser can digest directly. It uses only assign-gingerly's pure (DOM-free) exports, and the same structural decisions builtIns.tree makes, so the server renders what Tree would render on the client.

```js
import { o2h } from 'o2h';

const { html, residue, unrendered } = o2h(config, apiResponse, { pipes, managers });
```

- **`html`** has the elements, attributes and text, plus Tree's `<!--?start-->` / `<!--?end-->` markers.
- **`residue`** is what HTML can't carry: properties without an attribute, event bindings, and itemscope managers' values. The client applies it with one call:

  ```js
  assignFrom(container, residue.pattern, { at: residue.at, from: host });
  ```

- **`unrendered`** lists keys o2h could neither render nor hand over, rather than guessing.

## Options

| Option | |
|---|---|
| `pipes` | Named unary functions usable as path segments (`'?.date_utc?.parseDate?.longUtc'`) |
| `aka` | Aliases, under the config's own `aka` |
| `protocols` | Synchronous protocol handlers (`name://key` values) |
| `managers` | Itemscope manager classes by registered name. With one, a `{ tag, ish: 'name' }` element's subtree renders from the manager's getters. Either way, the element gets `itemscope="name"`, so the client can attach the manager. |
| `elementOffset` | Element children the container has before the tree (they shift the residue's paths) |

Types: [`types/o2h/types.d.ts`](types/o2h/types.d.ts).

## Demo

[`demo/index.html`](demo/index.html) renders [`demo/treeDefinition.js`](demo/treeDefinition.js), a copy of assign-gingerly's tree-demo definition, against [`demo/data/launch.json`](demo/data/launch.json). It shows o2h's HTML next to what builtIns.tree builds in the browser from the same definition, checks that the two are the same DOM, and applies the residue.

## Viewing Locally

1. Install git and node.js.
2. Fork/clone this repo, and open a command window in its folder.
3. `git submodule update --init --recursive`
4. `npm install`
5. `npm run serve`
6. Open http://localhost:8000/demo/ in a modern browser.

## Building and testing

- **Build:** `npm run build` (`tsc`), or `npm run watch`. In VS Code, Ctrl+Shift+B offers *tsc: watch - tsconfig.json*.
- **Test:** `npm test` (Playwright).
  - **Unit tests** run o2h in Node, with no DOM, as on a server.
  - **The equivalence test** checks, in Chromium, Firefox and WebKit, that o2h's HTML matches what builtIns.tree builds from the demo definition.

The previous implementation is kept in [`legacy/`](legacy/) for reference.
