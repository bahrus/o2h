// A company profile for the adopt benchmark: mostly static (mission, address, CEO, offices,
// products, leadership), plus one live part, the stock quote (a manager with a Refresh button).
// So only the quote is marked data-pending; everything else is what adopt: 'pending' can skip.

import { tree, each } from 'assign-gingerly/DX/tree.js';

/** The stock quote's view model: the raw quote merged in; Refresh moves the price and calls ctx.rebind(). */
export class StockManager {
    static is = 'stock-manager';
    #rebind;
    constructor(element, initVals, { rebind }) {
        Object.assign(this, initVals);
        this.#rebind = rebind;
    }
    /** Called by the Refresh button: { on: 'click', call: 'refresh' } */
    refresh() {
        this.price = Math.round((this.price + 1.25) * 100) / 100;
        this.#rebind();
    }
    get priceLabel() { return `${this.price.toFixed(2)} ${this.currency}`; }
    get changeLabel() { return `${this.price >= this.open ? '+' : ''}${(this.price - this.open).toFixed(2)} since open`; }
    get className() { return `quote ${this.price >= this.open ? 'up' : 'down'}`; }
}

export const managers = { [StockManager.is]: StockManager };

/** One company's markup: everything static but the quote. */
export const companyCard = tree`
    <article class="company">
        <header>
            <h2>${'?.name'}</h2>
            <p class="tagline">${'?.tagline'}</p>
        </header>
        <section class="mission">
            <h3>Mission</h3>
            <p>${'?.mission'}</p>
        </section>
        <section class="facts">
            <h3>At a glance</h3>
            <dl>
                <dt>Founded</dt><dd>${'?.founded'}</dd>
                <dt>Industry</dt><dd>${'?.industry'}</dd>
                <dt>Employees</dt><dd>${'?.employees'}</dd>
                <dt>Website</dt><dd><a href=${'?.website'}>${'?.website'}</a></dd>
            </dl>
        </section>
        <address>
            <span class="street">${'?.address?.street'}</span>
            <span class="city">${'?.address?.city'}</span>
            <span class="postal">${'?.address?.postal'}</span>
            <span class="country">${'?.address?.country'}</span>
        </address>
        <section class="ceo">
            <h3>Chief executive</h3>
            <p><strong>${'?.ceo?.name'}</strong> <span>since ${'?.ceo?.since'}</span></p>
            <blockquote>${'?.ceo?.quote'}</blockquote>
        </section>
        <section ish="stock-manager" class=${'?.className'}>
            <h3>${'?.ticker'}</h3>
            <p class="price">${'?.priceLabel'}</p>
            <p class="change">${'?.changeLabel'}</p>
            <button type="button" @click=${{ call: 'refresh' }}>Refresh</button>
        </section>
        <section class="leadership">
            <h3>Leadership</h3>
            <ul ${each('?.leaders', { key: '?.name' })}>
                <li><strong>${'?.name'}</strong> <span>${'?.title'}</span></li>
            </ul>
        </section>
        <section class="offices">
            <h3>Offices</h3>
            <ul ${each('?.offices', { key: '?.city' })}>
                <li>
                    <strong>${'?.city'}</strong>
                    <span>${'?.street'}</span>
                    <span>${'?.phone'}</span>
                    <span>${'?.headcount'} people</span>
                </li>
            </ul>
        </section>
        <section class="products">
            <h3>Products</h3>
            <ul ${each('?.products', { key: '?.name' })}>
                <li><strong>${'?.name'}</strong> <span>${'?.description'}</span></li>
            </ul>
        </section>
    </article>`;

/** One company page: the profile is the whole tree. */
export const profileConfig = { map: { company: companyCard } };

/** A directory: many profiles in one repeat. */
export const directoryConfig = {
    map: { companies: tree`<div class="directory" ${each('?.', { key: '?.ticker' })}>${companyCard}</div>` },
};

const cities = ['Lisbon', 'Osaka', 'Toronto', 'Nairobi', 'Oslo', 'Lima', 'Pune', 'Perth'];
const words = ['reliable', 'open', 'secure', 'fast', 'gentle', 'portable', 'quiet', 'clear'];

/** A deterministic company (no randomness, so server and client data match). */
export function company(i) {
    const name = `Company ${i}`;
    const ticker = `C${String(i).padStart(4, '0')}`;
    return {
        name, ticker,
        tagline: `Making ${words[i % 8]} things since ${1950 + (i % 70)}`,
        mission: `${name} exists to build ${words[i % 8]}, ${words[(i + 3) % 8]} tools for people who need them, and to keep them working for decades. `
            + 'We measure ourselves by how rarely our customers have to think about us.',
        founded: 1950 + (i % 70),
        industry: ['Manufacturing', 'Software', 'Logistics', 'Energy'][i % 4],
        employees: 1000 + i * 37,
        website: `https://example.com/${ticker.toLowerCase()}`,
        address: { street: `${100 + i} Main Street`, city: cities[i % 8], postal: `${10000 + i}`, country: 'Exampleland' },
        ceo: { name: `Avery Example ${i}`, since: 2000 + (i % 25), quote: 'Steady beats flashy, every quarter.' },
        price: 100 + (i % 50), open: 100 + (i % 50), currency: 'USD',
        leaders: Array.from({ length: 6 }, (_, j) => ({ name: `Leader ${i}.${j}`, title: ['CFO', 'CTO', 'COO', 'CMO', 'CHRO', 'GC'][j] })),
        offices: cities.map((city, j) => ({ city, street: `${j + 1} Harbor Road`, phone: `+1 555 01${String(j).padStart(2, '0')}`, headcount: 50 + j * 10 })),
        products: Array.from({ length: 6 }, (_, j) => ({ name: `Product ${i}.${j}`, description: `A ${words[(i + j) % 8]} product for ${words[(i + j + 1) % 8]} work.` })),
    };
}
