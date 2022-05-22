import {O2HConfig} from './types';
import {O2H} from './o2h.js';
export async function do_object({config, encodeAndWrite, self}: O2H, srcObj: any){

    for(const key in srcObj){
        await self.do_prop(self, srcObj, key);
    }
}