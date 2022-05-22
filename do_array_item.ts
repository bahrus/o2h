import {o2h, O2H} from './o2h.js';
export async function do_array_item({self, config}: O2H, srcObj: any, idx: number){
    const val = srcObj[idx];
    const {arrayItemClose, arrayItemOpen} = config;
    self.encodeAndWrite(arrayItemOpen.replaceAll('$0', idx.toString()));
    await self.do_object(self, val);
    self.encodeAndWrite(arrayItemClose);
}