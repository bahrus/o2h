import {O2HConfig} from './types';
import {} from 'may-it-be/types';
import {O2H} from './o2h.js';
import { o2a } from './o2a.js';
export async function do_root({config, encodeAndWrite, self}: O2H, srcObj: any){
    for(const part of config.wrapper){
        switch(typeof part){
            case 'string':
                if(part === '|'){
                    for(const key in srcObj){
                        await self.do_prop(self, srcObj, key);
                    }
                }else{
                    encodeAndWrite(part);
                }
                break;
            case 'object':
                o2a(part, encodeAndWrite);
                break;

        }
    }

    
}