export const obj_guid = 'Gj+7fXxgsU+6wZhAAv2pSQ==';
export async function o2h(srcObj, encodeAndWrite, config) {
    if (config === undefined) {
        const configJSON = await import('./config.json', { assert: { type: 'json' } });
        config = configJSON.default;
    }
    config.rootConfig = config;
    const o2hInstance = new O2H(srcObj, config, encodeAndWrite);
}
export class O2H {
    srcObj;
    config;
    encodeAndWrite;
    constructor(srcObj, config, encodeAndWrite) {
        this.srcObj = srcObj;
        this.config = config;
        this.encodeAndWrite = encodeAndWrite;
        this.do_root(srcObj, this);
    }
    async do_root(srcObj, { config, encodeAndWrite }) {
        const { do_root } = await import('./do_root.js');
        do_root(this, srcObj, config, encodeAndWrite);
    }
    do_prop(obj, prop) {
    }
    do_array_item(obj, idx) {
    }
}
