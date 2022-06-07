import {O2HConfig} from './types';
import {camelToLisp} from 'may-it-be/camelToLisp.js';
import { MayItBe } from 'may-it-be';

export const mib = '${mib}';

export function o2h(srcObj: any, encodeAndWrite: (s: string) => void, config?: O2HConfig){
    const o2hInstance = new O2H(srcObj, config!, encodeAndWrite);
    return o2hInstance;
}

export class O2H extends EventTarget{
    self = this;
    stack: (string | number)[] = [];
    contextualConfig!: O2HConfig;
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

    async do_prop({stack, config}: this, obj: any, prop: string | number){
        const {do_prop} = await import('./do_prop.js');
        stack.push(prop);
        this.contextualConfig = config.pathOverrides?.[stack.join('.')] ?? config;
        await do_prop(this, obj, prop);
        stack.pop();
    }

    async do_string_prop({stack}: this, obj: any, prop: string | number){
        const {do_string_prop} = await import('./do_string_prop.js');
        await do_string_prop(this, obj, prop);
    }

    async do_boolean_prop({stack}: this, obj: any, prop: string | number){
        const {do_boolean_prop} = await import('./do_boolean_prop.js');
        await do_boolean_prop(this, obj, prop);
    }

    async do_number_prop({stack}: this, obj: any, prop: string | number){
        const {do_number_prop} = await import('./do_number_prop.js');
        await do_number_prop(this, obj, prop);
    }

    async do_object_prop({stack}: this, obj: any, prop: string | number){
        const {do_object_prop} = await import('./do_object_prop.js');
        await do_object_prop(this, obj, prop);
    }

    async do_array_prop({stack}: this, obj: any, prop: string | number){
        const {do_array_prop} = await import('./do_array_prop.js');
        await do_array_prop(this, obj, prop);
    }



    // async do_array_item(obj: any, idx: number){
    //     const {do_array_item} = await import('./do_array_item.js');
    //     await do_array_item(this, obj, idx);
    // }

    propString(prop: string | number, src: any){
        if(typeof prop === 'string') return prop;
        const asp = (this.contextualConfig || this.config).arraySummaryPath;
        let summary = '';
        if(asp !== undefined){
            const val = src[asp];
            if(val !== undefined){
                summary = ` - ${val}`;
            }
        }

        return typeof prop === 'string' ? prop : `[${prop}]${summary}`;
    }

}

