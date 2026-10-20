import {o2h, O2H, titleCase} from './o2h.js';
import {o2a} from './o2a.js';
export async function do_array_prop({self, contextualConfig, encodeAndWrite}: O2H, srcObj: any, prop: string | number){
    const {arrayProp, makeArrayPropLabelTitleCase} = contextualConfig;
    const val = srcObj[prop] as any[];
    let label = self.propString(prop, val);
    if(makeArrayPropLabelTitleCase){
        label = titleCase(label);
    }
    
    let isStatic = true;
    for(const part of arrayProp){
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
                        for(let i = 0, len = val.length; i < len; i++){
                            await self.do_prop(self, val, i);
                        }
                        break;

                    case 'label':
                        encodeAndWrite(label);
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