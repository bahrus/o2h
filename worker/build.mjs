// Bundles worker/serviceWorker.ts (with o2h and the assign-gingerly modules it uses) into o2h-sw.js, one ES
// module: workers can't use import maps, so bare specifiers must be resolved at build time.
// Inside the beGingerly workspace (a sibling assign-gingerly), assign-gingerly comes from the sibling's
// current build, as the workspace's import map does for pages; otherwise from node_modules.
// Run: npm run build:worker
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sibling = path.join(root, '..', 'assign-gingerly');
const workspace = fs.existsSync(path.join(sibling, 'package.json'));

/** In the workspace: assign-gingerly/<file> → the sibling's <file>. */
const siblingAssignGingerly = {
    name: 'sibling-assign-gingerly',
    setup(b) {
        b.onResolve({ filter: /^assign-gingerly\// }, args => ({ path: path.join(sibling, args.path.slice('assign-gingerly/'.length)) }));
    },
};

await build({
    entryPoints: [path.join(root, 'worker', 'serviceWorker.ts')],
    outfile: path.join(root, 'o2h-sw.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    plugins: workspace ? [siblingAssignGingerly] : [],
    banner: { js: '// o2h service worker: built by worker/build.mjs from worker/serviceWorker.ts. Do not edit.' },
    logLevel: 'info',
});
console.log(`o2h-sw.js built${workspace ? ' (assign-gingerly from the sibling repo)' : ''}`);
