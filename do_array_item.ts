import {o2h, O2H} from './o2h.js';
export async function do_array_item({self, config}: O2H, srcObj: any, idx: number){
    const val = srcObj[idx];
    const {objectPropClose, objectPropOpen} = config;
    self.encodeAndWrite(objectPropOpen.replaceAll('$0', idx));
    await self.do_object(self, val);
    self.encodeAndWrite(objectPropClose);
}