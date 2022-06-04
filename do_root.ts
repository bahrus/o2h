import {O2HConfig} from './types';
import {O2H} from './o2h.js';
export async function do_root({config, encodeAndWrite, self}: O2H, srcObj: any){
    encodeAndWrite(config.wrapper[0]);
    for(const key in srcObj){
        await self.do_prop(self, srcObj, key);
    }
    encodeAndWrite(config.wrapper[1]);
}