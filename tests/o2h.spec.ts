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
    const { html, unrendered } = o2h(config, vm);
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
    expect(unrendered).toEqual([]);
    expect(o2h(config, { ...vm, crew: [] }).html).toContain('<ul><li>None</li></ul>');
  });

  test('marks each element that lost something HTML can\'t carry data-pending', async () => {
    const { o2h, PENDING_STYLE } = await import(url('o2h.js'));
    const { tree } = await import(url('node_modules/assign-gingerly/DX/tree.js'));
    const config = {
      map: {
        intro: tree`<p>Intro</p>`,
        form: tree`<form><input type="number" .valueAsNumber=${'?.qty'} .checked=${'?.agree'}><button @click=${'save'}>Save</button></form>`,
      },
    };
    const vm = { intro: 1, form: { qty: 3, agree: true } };
    const { html } = o2h(config, vm);
    // checked has an attribute (its default); valueAsNumber doesn't, so the client sets it
    expect(html).toContain('<input type="number" checked data-pending>');
    expect(html).toContain('<button data-pending>Save</button>');   // the event binding
    expect(html).toContain('<p>Intro</p>');   // nothing pending: no mark
    expect(html).toContain('<form>');
    // The default style is opt-in, and hides pending parts only when scripts run
    expect(html.startsWith('<style>')).toBe(false);
    expect(o2h(config, vm, { style: true }).html.startsWith(PENDING_STYLE)).toBe(true);
    expect(PENDING_STYLE).toBe('<style>@media (scripting: enabled) { [data-pending] { visibility: hidden; } }</style>');
  });

  test('writes snippets as is (trimmed), and refuses a name it isn\'t given', async () => {
    const { o2h } = await import(url('o2h.js'));
    const { tree, snippet } = await import(url('node_modules/assign-gingerly/DX/tree.js'));
    const snippets = { logo: '\n  <svg viewBox="0 0 2 2"><path d="M0 0"/></svg> <b>Two roots</b>\n' };
    const config = {
      map: {
        banner: snippet('logo'),
        card: tree`<article>${snippet('logo')}<h3>${'?.title'}</h3></article>`,
      },
    };
    const { html } = o2h(config, { banner: 1, card: { title: 'T' } }, { snippets });
    expect(html).toBe('<!--?start name="tree"-->'
      + '<svg viewBox="0 0 2 2"><path d="M0 0"/></svg> <b>Two roots</b>'
      + '<article><svg viewBox="0 0 2 2"><path d="M0 0"/></svg> <b>Two roots</b><h3>T</h3></article>'
      + '<!--?end-->');
    expect(() => o2h(config, { banner: 1 })).toThrow(/snippet "logo"/);
  });

  test('a map key with a trailing comment renders its VM key again', async () => {
    const { o2h } = await import(url('o2h.js'));
    const config = { map: { rocket: ['h3', '?.name'], success: 'span', 'rocket /* summary */': ['p', '?.type'], '*': 'i' } };
    const { html } = o2h(config, { rocket: { name: 'F9', type: 'rocket' }, success: true, extra: 'x' });
    expect(html).toBe('<!--?start name="tree"--><h3>F9</h3><span></span><p>rocket</p><i>x</i><!--?end-->');
  });

  test('embed: the data it rendered from, after the tree, escaped and checked', async () => {
    const { o2h } = await import(url('o2h.js'));
    const config = { markerName: 'card', map: { title: ['h2', '?.'] } };
    const vm = { title: 'Hi </script><!-- <b>', n: 2 };
    const { html, notSerializable } = o2h(config, vm, { embed: true });
    expect(html.startsWith('<!--?start name="card"--><h2>Hi &lt;/script&gt;&lt;!-- &lt;b&gt;</h2><!--?end-->')).toBe(true);
    const script = html.slice(html.indexOf('<!--?end-->') + '<!--?end-->'.length);
    expect(script).toBe('<script type="application/json" data-tree="card">{"title":"Hi \\u003c/script>\\u003c!-- \\u003cb>","n":2}</script>');
    expect(JSON.parse(script.slice(script.indexOf('>') + 1, -'</script>'.length))).toEqual(vm);
    expect(notSerializable).toEqual([]);
    expect(o2h(config, vm).html.includes('<script')).toBe(false);   // opt-in

    // The check: what JSON drops or changes, by path
    class Point { constructor(public x = 1) {} get len() { return this.x; } }
    const odd = {
      title: 'T', when: new Date(0), tags: new Set(['a']), fn: () => 1, nested: { big: 10n, list: [1, NaN, new Point()] },
    };
    const checked = o2h(config, odd, { embed: true }).notSerializable;
    expect(checked).toEqual([
      { path: '?.when', kind: 'a Date (becomes an ISO string)' },
      { path: '?.tags', kind: 'a Set (becomes {})' },
      { path: '?.fn', kind: 'a function (dropped)' },
      { path: '?.nested?.big', kind: 'a bigint (dropped)' },
      { path: '?.nested?.list?.1', kind: 'NaN (becomes null)' },
      { path: '?.nested?.list?.2', kind: 'a Point instance (its prototype and getters are lost)' },
    ]);
    // Without the check: no report, and a BigInt fails with an explanation
    const { title: _t, nested: _n, ...noBigInt } = odd;
    expect(o2h(config, { title: 'T', ...noBigInt }, { embed: { check: false } }).notSerializable).toBeUndefined();
    expect(() => o2h(config, odd, { embed: { check: false } })).toThrow(/o2h embed: .*embed: true/);
  });

  test('prepareO2HTransform: a storable transform, stand-ins for code, what was lost, a content key', async () => {
    const { prepareO2HTransform } = await import(url('worker/transform.js'));
    class RocketManager { static is = 'rocket-manager'; }
    class Helper {}
    const config = {
      map: {
        name: ['h2', '?.upper'],
        rocket: [{ tag: 'section', ish: RocketManager }, { onTouch: () => 1 }],
      },
    };
    const options = {
      pipes: { upper: (s: string) => s.toUpperCase() },
      managers: { 'rocket-manager': RocketManager },
      protocols: { env: (k: string) => k },
      snippets: { logo: '<b>L</b>' },
      aka: { _: 'textContent' },
      registry: new Helper(),
    };
    const { key, transform, lost } = await prepareO2HTransform(config, options);
    expect(() => structuredClone(transform)).not.toThrow();
    expect(transform.config.map.name).toEqual(['h2', '?.upper']);
    expect(transform.config.map.rocket[0].ish).toEqual({ $o2hLost: 'class', name: 'rocket-manager' });
    expect(transform.options.pipes).toEqual({ upper: { $o2hLost: 'pipe', name: 'upper' } });
    expect(transform.options.managers).toEqual({ 'rocket-manager': { $o2hLost: 'manager', name: 'rocket-manager' } });
    expect(transform.options.snippets).toEqual({ logo: '<b>L</b>' });
    expect(transform.options.registry).toEqual({ $o2hLost: 'object', name: 'Helper' });
    expect(lost.map((l: any) => `${l.path}:${l.kind}`)).toEqual([
      'config.map.rocket.0.ish:class', 'config.map.rocket.1.onTouch:function',
      'options.pipes.upper:pipe', 'options.managers.rocket-manager:manager', 'options.protocols.env:protocol', 'options.registry:object',
    ]);
    // The key follows the content
    expect(key).toMatch(/^o2h-[0-9a-f]{32}$/);
    expect((await prepareO2HTransform(config, options)).key).toBe(key);
    expect((await prepareO2HTransform({ map: { name: ['h3', '?.upper'] } }, options)).key).not.toBe(key);
    // Cycles become stand-ins too
    const cyclic: any = { map: {} };
    cyclic.map.self = cyclic;
    expect((await prepareO2HTransform(cyclic)).lost).toEqual([{ path: 'config.map.self', kind: 'cycle' }]);
  });

  test('a revived transform: what needs lost code is left to the client (pending, pending structure)', async () => {
    const { o2h } = await import(url('o2h.js'));
    const { prepareO2HTransform } = await import(url('worker/transform.js'));
    const { reviveO2HTransform } = await import(url('worker/core.js'));
    const config = {
      map: {
        name: ['h2', '?.upper'],
        'crew /* size */': { switch: '?.kind', cases: { many: ['p', 'Many'], one: ['p', 'One'] } },
        'crew /* list */': ['ul', {}, { each: ['li', '?.name'], of: '?.active', key: '?.id' }],
        rocket: [{ tag: 'section', ish: 'rocket-manager' }, {}, [['b', '?.label']]],
        note: ['p', '?.'],
      },
    };
    const options = {
      pipes: { upper: (s: string) => s.toUpperCase(), kind: (c: any[]) => (c.length > 1 ? 'many' : 'one'), active: (c: any[]) => c },
      managers: { 'rocket-manager': class { get label() { return 'L'; } } },
    };
    const { transform } = await prepareO2HTransform(config, options);
    const revived = reviveO2HTransform(structuredClone(transform));
    const vm = { name: 'Demo', crew: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], rocket: { name: 'F9' }, note: 'N' };
    const { html } = o2h(revived.config, vm, revived.options);
    expect(html).toBe('<!--?start name="tree"-->'
      + '<h2 data-pending></h2>'                                  // a lost pipe: no text, marked
      + '<!--?switch pending-->'                                   // a lost pipe decides the case
      + '<ul data-pending></ul>'                                   // … or the items
      + '<section itemscope="rocket-manager" data-pending><b></b></section>'   // a lost manager: raw value, marked
      + '<p>N</p>'                                                 // the rest renders as usual
      + '<!--?end-->');
  });

  test('data pipes survive prepareO2HTransform, and run in the revived transform', async () => {
    const { o2h } = await import(url('o2h.js'));
    const { prepareO2HTransform } = await import(url('worker/transform.js'));
    const { reviveO2HTransform } = await import(url('worker/core.js'));
    const { dataPipes } = await import(url('node_modules/assign-gingerly/pipes/dataPipes.js'));
    const pipes = dataPipes({
      shout: { use: 'upper' },
      phase: { map: { hold: 'On hold' }, default: 'Unknown' },
      size: (crew: any[]) => crew.length,            // a plain function: lost in a worker
      label: { chain: ['size', 'string'] },          // a chain through it: left to the client too
    });
    const config = { map: { name: ['h2', '?.shout'], status: ['p', '?.phase'], crew: ['b', '?.label'] } };
    const { transform, lost } = await prepareO2HTransform(config, { pipes });
    expect(lost.map((l: any) => l.path)).toEqual(['options.pipes.size']);
    expect(transform.options.pipes.shout).toEqual({ use: 'upper' });
    const revived = reviveO2HTransform(structuredClone(transform));
    const { html } = o2h(revived.config, { name: 'Demo', status: 'hold', crew: [1, 2] }, revived.options);
    expect(html).toBe('<!--?start name="tree"--><h2>DEMO</h2><p>On hold</p><b data-pending></b><!--?end-->');
  });

  test('renders the demo definition, managers included', async () => {
    const { o2h } = await import(url('o2h.js'));
    const { config, pipes, managers, snippets, initialVm } = await import(url('demo/treeDefinition.js'));
    const fs = await import('node:fs');
    const response = JSON.parse(fs.readFileSync(new URL('../demo/data/launch.json', import.meta.url), 'utf8'));
    const { html, unrendered } = o2h(config, initialVm(response), { pipes, managers, snippets });
    expect(unrendered).toEqual([]);
    // Manager getters rendered on the server; the managers are named for the client
    expect(html).toMatch(/<section itemscope="rocket-manager" class="card rocket" data-pending><h3>Rocket: Falcon 9<\/h3>/);
    expect(html).toContain('<span>549,054 kg</span>');
    expect(html).toContain('<h3>Rocket: Falcon 9</h3><svg class="icon"');   // the snippet, as is
    expect(html).toMatch(/<nav itemscope="links-manager" class="links verifying" aria-label="Launch links" data-pending>/);
    expect(html).toContain('<li><a href="https://example.com/webcast/demo-mission-7" target="_blank" rel="noopener">webcast</a></li>');
    expect(html.match(/ data-pending\b/g)).toHaveLength(3);
  });
});

test.describe('o2h + builtIns.tree adopt (hydration)', () => {
  test('builtIns.tree adopts o2h\'s markup: same elements, same DOM, live managers', async ({ page }) => {
    page.on('pageerror', err => console.error('Browser error:', err));
    await page.goto('tests/hydration.html');   // relative to baseURL (o2h's folder)
    await page.waitForSelector('#test-complete[data-status]:not([data-status=""])', { timeout: 15000, state: 'attached' });
    expect(await page.textContent('#differences')).toBe('');
    expect(await page.getAttribute('#test-complete', 'data-status')).toBe('success');
  });
});

test.describe('o2h vs builtIns.tree', () => {
  test('the demo definition renders the same DOM as builtIns.tree', async ({ page }) => {
    page.on('pageerror', err => console.error('Browser error:', err));
    await page.goto('tests/equivalence.html');   // relative to baseURL (o2h's folder)
    await page.waitForSelector('#test-complete[data-status]:not([data-status=""])', { timeout: 15000, state: 'attached' });
    const differences = await page.textContent('#differences');
    expect(differences).toBe('');
    expect(await page.getAttribute('#test-complete', 'data-status')).toBe('success');
  });

  test('the service worker renders marked JSON fetches as HTML, which builtIns.tree adopts', async ({ page }) => {
    page.on('pageerror', err => console.error('Browser error:', err));
    await page.goto('tests/service-worker.html');
    await page.waitForSelector('#test-complete[data-status]:not([data-status=""])', { timeout: 20000, state: 'attached' });
    expect(await page.textContent('#differences')).toBe('');
    expect(await page.getAttribute('#test-complete', 'data-status')).toBe('success');
  });

  test('snippet holes render the same DOM as builtIns.tree, which adopts it', async ({ page }) => {
    page.on('pageerror', err => console.error('Browser error:', err));
    await page.goto('tests/snippet-holes.html');
    await page.waitForSelector('#test-complete[data-status]:not([data-status=""])', { timeout: 15000, state: 'attached' });
    expect(await page.textContent('#differences')).toBe('');
    expect(await page.getAttribute('#test-complete', 'data-status')).toBe('success');
  });
});
