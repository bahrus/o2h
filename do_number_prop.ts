import {O2H} from './o2h.js';
import {o2a} from './o2a.js';
export async function do_number_prop({self, contextualConfig, stack, encodeAndWrite}: O2H, srcObj: any, prop: string | number){
    const val = srcObj[prop];
    const label = self.propString(prop, val);
    const {numberProp} = contextualConfig;
    const fullyQualifiedPath= stack.join('.');
    let isStatic = true;
    for(const part of numberProp){
        if(isStatic){
            encodeAndWrite(part as string);
            isStatic = !isStatic;
            continue;
        }
        isStatic = !isStatic;
        switch(typeof part){
            case 'string':
                switch(part){
                    case 'label':
                        encodeAndWrite(label);
                        break;
                    case 'path':
                        encodeAndWrite(fullyQualifiedPath);
                        break;
                    case 'value':
                        encodeAndWrite(val);
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