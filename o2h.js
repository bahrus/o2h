export const obj_guid = 'Gj+7fXxgsU+6wZhAAv2pSQ==';
export async function o2h(srcObj, encodeAndWrite, config) {
    if (config === undefined) {
        const configJSON = await import('./config.json', { assert: { type: 'json' } });
        config = configJSON.default;
    }
    config.rootConfig = config;
    const o2hInstance = new O2H(srcObj, config, encodeAndWrite);
}
export class O2H extends EventTarget {
    srcObj;
    config;
    encodeAndWrite;
    self = this;
    constructor(srcObj, config, encodeAndWrite) {
        super();
        this.srcObj = srcObj;
        this.config = config;
        this.encodeAndWrite = encodeAndWrite;
        this.do_root(this, srcObj);
    }
    async do_root({ config, encodeAndWrite }, srcObj) {
        const { do_root } = await import('./do_root.js');
        await do_root(this, srcObj);
    }
    async do_string_prop({}, obj, prop) {
        const { do_string_prop } = await import('./do_string_prop.js');
        await do_string_prop(this, obj, prop);
    }
    async do_number_prop({}, obj, prop) {
        const { do_number_prop } = await import('./do_number_prop.js');
        await do_number_prop(this, obj, prop);
    }
    async do_prop({}, obj, prop) {
        const { do_prop } = await import('./do_prop.js');
        await do_prop(this, obj, prop);
    }
    do_array_item(obj, idx) {
    }
}
