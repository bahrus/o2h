import {O2HConfig} from './types';

export const obj_guid = 'Gj+7fXxgsU+6wZhAAv2pSQ==';

export function o2h(srcObj: any, encodeAndWrite: (s: string) => void, config?: O2HConfig){
    const o2hInstance = new O2H(srcObj, config!, encodeAndWrite);
    return o2hInstance;
}

export class O2H extends EventTarget{
    self = this;
    constructor(public srcObj: any, public config: O2HConfig, public encodeAndWrite: (s: string) => void) {
        super();
        this.do_root(this, srcObj).then(() => {
            this.dispatchEvent(new Event('done'));
        });
    }

    async do_root({config, encodeAndWrite, self}: this, srcObj: any){
        if(config === undefined){
            const configJSON = await import('./config.json', {assert: {type: 'json'}});
            config = configJSON.default;
            self.config = config;
        }
        config!.rootConfig = config;
        const {do_root} = await import('./do_root.js');
        await do_root(this, srcObj);
    }

    async do_object({}: this, obj: any){
        const {do_object} = await import('./do_object.js');
        await do_object(this, obj);
    }

    async do_prop({}: this, obj: any, prop: string){
        const {do_prop} = await import('./do_prop.js');
        await do_prop(this, obj, prop);
    }

    async do_string_prop({}: this, obj: any, prop: string){
        const {do_string_prop} = await import('./do_string_prop.js');
        await do_string_prop(this, obj, prop);
    }

    async do_boolean_prop({}: this, obj: any, prop: string){
        const {do_boolean_prop} = await import('./do_boolean_prop.js');
        await do_boolean_prop(this, obj, prop);
    }

    async do_number_prop({}: this, obj: any, prop: string){
        const {do_number_prop} = await import('./do_number_prop.js');
        await do_number_prop(this, obj, prop);
    }

    async do_object_prop({}: this, obj: any, prop: string){
        const {do_object_prop} = await import('./do_object_prop.js');
        await do_object_prop(this, obj, prop);
    }

    async do_array_prop({}: this, obj: any, prop: string){
        const {do_array_prop} = await import('./do_array_prop.js');
        await do_array_prop(this, obj, prop);
    }



    do_array_item(obj: any, idx: number){
    }

    // do_obj(obj: any){
    //     const verb = Array.isArray(obj) ? 'do_array' : 'do_obj';
    //     this.encodeAndWrite(html`<details><summary></summary></details>

    //     if(Array.isArray(obj)){
    //         return this.do_array(obj);
    //     }else{
    //         return this.do_non_array(obj);
    //     }
    // }

    // do_array(arr: any[]){

    // }

    // do_non_array(obj: any){

    // }
}