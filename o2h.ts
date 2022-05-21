import {html} from 'may-it-be/index.js';
import {O2HConfig} from './types';

export async function o2h(srcObj: any, encodeAndWrite: (s: string) => void, config?: O2HConfig){
    if(config === undefined){
        const {configJSON} = await import('./config.json', {assert: {type: 'json'}});
        config = configJSON.default;
    }
    config!.rootConfig = config;
    const o2hInstance = new O2H(srcObj, config!, encodeAndWrite);
}
export class O2H {
    async constructor(public srcObj: any, public config: O2HConfig, public encodeAndWrite: (s: string) => void) {
        await this.do_root(srcObj, this);
    }

    async do_root(srcObj: any, {config, encodeAndWrite}: this){
        const {do_root} = await import('./do_root.js');
        do_root(this, srcObj, config, encodeAndWrite);
    }

    do_prop(obj: any, prop: string){

    }

    do_array_item(obj: any, idx: number){
    }

    do_obj(obj: any){
        const verb = Array.isArray(obj) ? 'do_array' : 'do_obj';
        this.encodeAndWrite(html`<details><summary></summary></details>

        if(Array.isArray(obj)){
            return this.do_array(obj);
        }else{
            return this.do_non_array(obj);
        }
    }

    do_array(arr: any[]){

    }

    do_non_array(obj: any){

    }
}