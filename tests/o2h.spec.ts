import { test, expect } from '@playwright/test';

// The compiled module and the demo's tree definition, imported straight into Node (no DOM), as on a server
const url = (path: string) => new URL(`../${path}`, import.meta.url).href;

test.describe('o2h in Node (no DOM)', () => {
  // Node-side: once is enough
  test.skip(({ browserName }) => browserName !== 'chromium', 'Node-side tests run once');

  test('renders text, attributes, repeats, switches and ternaries, escaped', async () => {
    expect(typeof (globalThis as any).document).toBe('undefined');
    const { o2h } = await import(url('o2h.js'));
    const { tree, each, choose } = await import(url('node_modules/assign-gingerly/DX/tree.js'));
    const config = {
      aka: { _: 'textContent' },
      map: {
        name: tree`<h2 class="name" title=${'?.'}>${'?.'}</h2>`,
        crew: tree`<ul ${each('?.', { key: '?.name', empty: tree`<li>None</li>` })}><li>${'?.name'} (${'?.role'})</li></ul>`,
        status: choose('?.phase', { hold: tree`<p class="hold">${'?.reason'}</p>` }),
        quiet: choose('?.phase', { hold: tree`<p>Hold</p>` }),
        success: tree`<span ${{ '_ ?=': ['$parent?.upcoming', 'Upcoming', ['?.', 'Success', 'Failure']] }}></span>`,
        nothing: tree`<p>Never</p>`,
      },
    };
    const vm = {
      name: 'Demo <7> & "co"',
      crew: [{ name: 'Avery', role: 'Commander' }],
      status: { phase: 'hold', reason: 'Winds' },
      quiet: { phase: 'go' },
      upcoming: false,
      success: true,
      nothing: null,
    };
    const { html, residue, unrendered } = o2h(config, vm);
    expect(html).toBe(
      '<!--?start name="tree"-->'
      // in attributes, & and " are escaped (< and > needn't be); in text, &, < and >
      + '<h2 class="name" title="Demo <7> &amp; &quot;co&quot;">Demo &lt;7&gt; &amp; "co"</h2>'
      + '<ul><li><span>Avery</span> (<span>Commander</span>)</li></ul>'
      + '<p class="hold">Winds</p>'
      + '<!--?switch-->'
      + '<span>Success</span>'
      + '<!--?end-->'
    );
    expect(residue).toBeNull();
    expect(unrendered).toEqual([]);
    expect(o2h(config, { ...vm, crew: [] }).html).toContain('<ul><li>None</li></ul>');
  });

  test('hands what HTML can\'t carry to the residue, addressed by element paths', async () => {
    const { o2h } = await import(url('o2h.js'));
    const { tree } = await import(url('node_modules/assign-gingerly/DX/tree.js'));
    const config = {
      map: {
        intro: tree`<p>Intro</p>`,
        form: tree`<form><input type="number" .valueAsNumber=${'?.qty'} .checked=${'?.agree'}><button @click=${'save'}>Save</button></form>`,
      },
    };
    const { html, residue } = o2h(config, { intro: 1, form: { qty: 3, agree: true } }, { elementOffset: 1 });
    // checked has an attribute (its default); valueAsNumber doesn't, so it goes to the residue
    expect(html).toContain('<input type="number" checked>');
    expect(residue).toEqual({
      pattern: { '#[e1]': { valueAsNumber: 3 }, '#[e2]': { ' +=': { on: 'click', call: 'save' } } },
      // elementOffset 1: the container already has one element before the tree
      at: { e1: [2, 0], e2: [2, 1] },
    });
  });

  test('renders the demo definition, managers included', async () => {
    const { o2h } = await import(url('o2h.js'));
    const { config, pipes, managers, initialVm } = await import(url('demo/treeDefinition.js'));
    const fs = await import('node:fs');
    const response = JSON.parse(fs.readFileSync(new URL('../demo/data/launch.json', import.meta.url), 'utf8'));
    const { html, residue, unrendered } = o2h(config, initialVm(response), { pipes, managers });
    expect(unrendered).toEqual([]);
    // Manager getters rendered on the server; the managers are named for the client
    expect(html).toContain('<section itemscope="rocket-manager" class="card rocket"><h3>Rocket: Falcon 9</h3>');
    expect(html).toContain('<span>549,054 kg</span>');
    expect(html).toContain('<nav itemscope="links-manager" class="links verifying" aria-label="Launch links">');
    expect(html).toContain('<li><a href="https://example.com/webcast/demo-mission-7" target="_blank" rel="noopener">webcast</a></li>');
    expect(Object.keys(residue.pattern)).toHaveLength(3);
  });
});

test.describe('o2h vs builtIns.tree', () => {
  test('the demo definition renders the same DOM as builtIns.tree', async ({ page }) => {
    page.on('pageerror', err => console.error('Browser error:', err));
    await page.goto('/tests/equivalence.html');
    await page.waitForSelector('#test-complete[data-status]:not([data-status=""])', { timeout: 15000, state: 'attached' });
    const differences = await page.textContent('#differences');
    expect(differences).toBe('');
    expect(await page.getAttribute('#test-complete', 'data-status')).toBe('success');
  });
});
