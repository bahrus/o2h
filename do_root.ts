import {O2HConfig} from './types';
import {O2H} from './o2h.js';
export function do_root(o2h: O2H, srcObj: any, config: O2HConfig, encodeAndWrite: (s: string) => void){
    encodeAndWrite(config.wrapperOpen);
    if(Array.isArray(srcObj)){
        for(let i = 0, len = srcObj.length; i < len; i++){
            o2h.do_array_item(srcObj[i], i);
        }
    }else{
        for(const key in srcObj){
            o2h.do_prop(srcObj[key], key);
        }
    }
    encodeAndWrite(config.wrapperClosed);
}