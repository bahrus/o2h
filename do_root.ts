import {O2HConfig} from './types';
import {} from 'may-it-be/types';
import {O2H} from './o2h.js';
import { o2a } from './o2a.js';
export async function do_root({config, encodeAndWrite, self}: O2H, srcObj: any){
    let isStatic = true;
    for(const part of config.wrapper){
        if(isStatic){
            encodeAndWrite(part as string);
            isStatic = !isStatic;
            continue;
        }
        isStatic = !isStatic;
        switch(typeof part){
            case 'string':
                switch(part){
                    case 'children':
                        for(const key in srcObj){
                            await self.do_prop(self, srcObj, key);
                        }
                        break;
                    default:
                        throw 'NI'; //not implemented
                }
                break;
            case 'object':
                o2a(part, encodeAndWrite);
                break;

        }
    }

    
}