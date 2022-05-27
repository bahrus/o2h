import {o2h, O2H, replMIB} from './o2h.js';
export async function do_array_prop({self, config}: O2H, srcObj: any, prop: string | number){
    console.log('do_array_prop');
    const val = srcObj[prop] as any[];
    const {arrayPropClose, arrayPropOpen, arrayPropBeProps} = config;
    self.encodeAndWrite(replMIB(arrayPropOpen, arrayPropBeProps).replaceAll('$0', self.propString(prop)));
    for(let i = 0, len = val.length; i < len; i++){
        await self.do_prop(self, val, i);
    }
    //await self.do_object(self, val);
    self.encodeAndWrite(arrayPropClose);
}