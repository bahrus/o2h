import {O2HConfig} from './types';
import {O2H} from './o2h.js';
export async function do_root({config, encodeAndWrite, self}: O2H, srcObj: any){
    encodeAndWrite(config.wrapperOpen);
    if(Array.isArray(srcObj)){
        for(let i = 0, len = srcObj.length; i < len; i++){
            await self.do_array_item(srcObj[i], i);
        }
    }else{
        for(const key in srcObj){
            await self.do_prop(self, srcObj, key);
        }
    }
    encodeAndWrite(config.wrapperClose);
}