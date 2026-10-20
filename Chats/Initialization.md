# Initialization

## Bruce's Ask

Perhaps this shouldn't be called an initialization, but rather a re-implementation, except that so much has changed that it is really a complete "do-over", with the same end goal.

I would like this to be a typescript project with a tsconfig.json file, so that it can use vscode's control-shift-build to be prompted for automatic background compiling.

Types should go in types/o2h/types.d.ts

This package should have the primary module, o2h.js have an export function o2h that does what [](../../assign-gingerly/Chats/AssignFrom/Handlers/Tree/Compile/TODO/Stringify.md#the-sample) stringifyTree does.

Please port that function over, add a unit test or two.  As for demo, I would like to reuse a copy of the same [data](../../assign-gingerly/demos/data/launch.json), and the same tree definition used for the tree-demo.html, that I expect that tree definition to need to drift as we work through issues.

## Claude's Implementation Notes

Done. Nothing is committed.

**Results:**
- **`npm test`:** 6 passed, 6 skipped.
  - The **3 Node unit tests** run once (under the Chromium project; skipped in Firefox and WebKit).
  - The **equivalence test** runs in Chromium, Firefox and WebKit.
- **`tsc`:** clean.
- **The demo**, run in Chromium: o2h's HTML and builtIns.tree's DOM are the same, with no unrendered keys.

### The project

| | |
|---|---|
| **`tsconfig.json`** | ESNext, `strict`, `moduleResolution: "bundler"` (it resolves assign-gingerly's `exports`, and TypeScript 7, your global `tsc`, no longer accepts `"node"`). Includes `o2h.ts` and `types/o2h/types.d.ts`; excludes `legacy/`, which keeps its own tsconfig. In VS Code, **Ctrl+Shift+B** offers *tsc: watch - tsconfig.json*. |
| **`o2h.ts` → `o2h.js`** | `export function o2h(config, from, options)`: the ported `stringifyTree`. |
| **`types/o2h/types.d.ts`** | `O2HConfig`, `O2HOptions`, `O2HManager`, `O2HResult`, `O2HResidue`, `O2HUnrendered`, and `o2h`. **`types` is a submodule**, so this needs its own commit there. |
| **`package.json`** | `assign-gingerly` **0.0.101 → 0.0.102**, the first published version with the pure exports (`mapEntries`, `classifyPatternKey`, …) and with `treeTypes.d.ts`. `exports` / `types` point at the new files; `files` lists them; `build` and `watch` scripts added; the old `doc` script (it analyzed `trans-render.js`) removed. |
| **`playwright.config.ts`** | Chromium, Firefox and WebKit, with `npm run serve` as the web server (as in assign-gingerly). |
| **`.gitignore`** | Adds `playwright-report` and `test-results`. |
| **README** | Rewritten for the new o2h: usage, the residue, options, the demo, build and test. `legacy/` is mentioned as the previous implementation. |

### Changes from the sample in Stringify.md

- **Typed,** with the types in `types/o2h/types.d.ts`.
- **Managers are constructed as `ish` constructs them.** With a static `onAssigned`, the manager is constructed with no initVals, and `onAssigned(instance, value)` is called. Its synchronous part counts, and its promise is dropped. That's what makes `LinksManager` (an async `onAssigned`) render its links on the server. A manager that throws is reported in `unrendered`, and its subtree renders from the raw value.

### Tests (`tests/o2h.spec.ts`)

1. **Node, no DOM:** text, attributes, escaping (attributes vs text), a keyed repeat and its `empty`, a switch with and without a match, a `$parent` ternary, and a skipped nullish key. All compared as the exact expected string.
2. **Node:** the residue. A property without an attribute (`valueAsNumber`) and an event binding, with element paths, including `elementOffset`. `.checked` becomes the `checked` attribute.
3. **Node:** the demo definition, with managers, renders their getters (`Rocket: Falcon 9`, `549,054 kg`), the links from `LinksManager`'s `onAssigned`, and `itemscope="<name>"`.
4. **Browser** (`tests/equivalence.html`): the demo definition rendered by o2h, then parsed, compared **node by node** with what builtIns.tree builds. It then applies the residue and checks that the rocket manager is attached on the client.

### The demo (`demo/`)

- **`demo/data/`:** copies of `launch.json` and `mission-patch.svg` (the data refers to the image).
- **`demo/treeDefinition.js`:** a copy of tree-demo.html's definition (pipes, `RocketManager`, `LinksManager`, the `spec` helper, the whole map), as a module usable in the browser and in Node. **It has already drifted in three small ways:**
  1. **`initialVm(response)`** overlays tree-demo's *initial* UI state (`mission` in its first phase, the first two `timeline` events), so those cards render. The phase stepping and ticks aren't copied.
  2. **The number and date formats are pinned to `'en-US'`,** instead of the runtime's default locale. A server and its clients can differ in locale, so o2h output should be deterministic.
  3. **`log` is pluggable** (`setLog`), and managers are exported (`managers`) rather than registered globally.
- **`demo/index.html`:** o2h's HTML (`innerHTML`) next to builtIns.tree's rendering of the same config and data, a "Same DOM" check, the residue, the unrendered list and o2h's HTML source. Buttons apply the residue and toggle the client card's units.

### Things to know

- **The one intended DOM difference: `itemscope="<name>"`** on managed elements. o2h adds it so the client knows which manager to attach (the residue's `ish` needs it). builtIns.tree attaches managers without the attribute. The equivalence checks ignore exactly that.
- **Residue events call the residue's host** (the `from` of the client's `assignFrom` call), not a manager. Rebinding a manager's subtree on the client is `builtIns.scope`'s job. Wiring o2h's output to `builtIns.scope`, so the rocket card's button reaches its manager, seems like a natural next step.
- **Attribute order:** `itemscope` comes first on managed elements, then the pattern's attributes in pattern order. That's irrelevant to the DOM, but visible in the string.

**To do on your side:**
1. **Commit `types/o2h/types.d.ts`** in the `types` submodule.
2. **`git add`** `o2h.ts`, `o2h.js`, `tsconfig.json`, `playwright.config.ts`, `demo/` and `tests/`.
