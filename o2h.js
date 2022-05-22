export const obj_guid = 'Gj+7fXxgsU+6wZhAAv2pSQ==';
export function o2h(srcObj, encodeAndWrite, config) {
    const o2hInstance = new O2H(srcObj, config, encodeAndWrite);
    return o2hInstance;
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
        this.do_root(this, srcObj).then(() => {
            this.dispatchEvent(new Event('done'));
        });
    }
    async do_root({ config, encodeAndWrite, self }, srcObj) {
        if (config === undefined) {
            const configJSON = await import('./config.json', { assert: { type: 'json' } });
            config = configJSON.default;
            self.config = config;
        }
        config.rootConfig = config;
        const { do_root } = await import('./do_root.js');
        await do_root(this, srcObj);
    }
    async do_object({}, obj) {
        const { do_object } = await import('./do_object.js');
        await do_object(this, obj);
    }
    async do_prop({}, obj, prop) {
        const { do_prop } = await import('./do_prop.js');
        await do_prop(this, obj, prop);
    }
    async do_string_prop({}, obj, prop) {
        const { do_string_prop } = await import('./do_string_prop.js');
        await do_string_prop(this, obj, prop);
    }
    async do_boolean_prop({}, obj, prop) {
        const { do_boolean_prop } = await import('./do_boolean_prop.js');
        await do_boolean_prop(this, obj, prop);
    }
    async do_number_prop({}, obj, prop) {
        const { do_number_prop } = await import('./do_number_prop.js');
        await do_number_prop(this, obj, prop);
    }
    async do_object_prop({}, obj, prop) {
        const { do_object_prop } = await import('./do_object_prop.js');
        await do_object_prop(this, obj, prop);
    }
    async do_array_prop({}, obj, prop) {
        const { do_array_prop } = await import('./do_array_prop.js');
        await do_array_prop(this, obj, prop);
    }
    do_array_item(obj, idx) {
    }
}
