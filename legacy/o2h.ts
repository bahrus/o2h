import {O2HConfig} from './types';
import {camelToLisp} from 'may-it-be/camelToLisp.js';


export const mib = '${mib}';

export function o2h(srcObj: any, encodeAndWrite: (s: string) => void, config?: O2HConfig){
    const o2hInstance = new O2H(srcObj, config!, encodeAndWrite);
    return o2hInstance;
}

export class O2H extends EventTarget{
    self = this;
    stack: (string | number)[] = [];
    contextualConfig!: O2HConfig;
    done = false;

    constructor(public srcObj: any, public config: O2HConfig, public encodeAndWrite: (s: string) => void) {
        super();
        this.do_root(this, srcObj).then(() => {
            this.done = true;
            this.dispatchEvent(new Event('done'));
        });
    }

    async do_root({config, encodeAndWrite, self}: this, srcObj: any){
        if(config === undefined){
            const configJSON = await import('./config.json', {assert: {type: 'json'}});
            config = configJSON.default;
            self.config = config;
        }
        console.log('get do_root.js');
        const {do_root} = await import('./do_root.js');
        console.log('call do_root');
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

    toWebComponentName(){
        const {propsWithKeyPatterns} = this.contextualConfig;
        // const filteredStack = this.stack.filter(x => typeof x === 'string');
        // if(filteredStack.length === 0) return undefined;
        // const lastKey = filteredStack.pop();
        // const prevKey = filteredStack.pop();
        // if(prevKey === undefined) return lastKey;
        // const replaceString = propsWithKeyPatterns[prevKey];
        // if(replaceString === undefined) return prevKey + '-' + lastKey;
        // return prevKey + '-' + replaceString;
        const filteredStack = this.stack.filter(x => typeof x === 'string') as string[];
        if(filteredStack.length === 0) return undefined;
        const adjustedStack = filteredStack.map((x, idx) => {
            if(idx === 0) return x;
            const prevKey = filteredStack[idx - 1];
            const replaceString = propsWithKeyPatterns[prevKey];
            if(replaceString !== undefined) return replaceString;
            return x;
        });
        const lastKey = adjustedStack.pop();
        const prevKey = adjustedStack.pop();
        if(prevKey === undefined) return lastKey;
        return prevKey + '-' + lastKey;
    }

}

const title_case_re1 = /^[-_]*(.)/;
const title_case_re2 = /[-_]+(.)/g;
//https://stackoverflow.com/questions/64489395/converting-snake-case-string-to-title-case
export const titleCase = (s: string) =>
  s.replace (title_case_re1, (_, c) => c.toUpperCase())       // Initial char (after -/_)
   .replace (title_case_re2, (_, c) => ' ' + c.toUpperCase()) // First char after each -/_


