import {O2HConfig} from './types';

export const obj_guid = 'Gj+7fXxgsU+6wZhAAv2pSQ==';

export async function o2h(srcObj: any, encodeAndWrite: (s: string) => void, config?: O2HConfig){
    if(config === undefined){
        const configJSON = await import('./config.json', {assert: {type: 'json'}});
        config = configJSON.default;
    }
    config!.rootConfig = config;
    const o2hInstance = new O2H(srcObj, config!, encodeAndWrite);
}

export class O2H {
    self = this;
    constructor(public srcObj: any, public config: O2HConfig, public encodeAndWrite: (s: string) => void) {
        this.do_root(this, srcObj);
    }

    async do_root({config, encodeAndWrite}: this, srcObj: any){
        const {do_root} = await import('./do_root.js');
        do_root(this, srcObj);
    }

    async do_string_prop({}: this, obj: any, prop: string){
    }

    async do_prop({}: this, obj: any, prop: string){
        const {do_prop} = await import('./do_prop.js');
        do_prop(this, obj, prop);
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