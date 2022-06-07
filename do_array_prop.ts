import {o2h, O2H} from './o2h.js';
export async function do_array_prop({self, contextualConfig}: O2H, srcObj: any, prop: string | number){
    console.log('do_array_prop');
    const val = srcObj[prop] as any[];
    const {arrayProp} = contextualConfig;
    self.encodeAndWrite(arrayProp[0].replaceAll('${label}', self.propString(prop, val)));
    for(let i = 0, len = val.length; i < len; i++){
        await self.do_prop(self, val, i);
    }
    //await self.do_object(self, val);
    self.encodeAndWrite(arrayProp[1]);
}