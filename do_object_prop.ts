import {o2h, O2H} from './o2h.js';
export async function do_object_prop({self, config}: O2H, srcObj: any, prop: string){
    const val = srcObj[prop];
    const {objectPropClose, objectPropOpen} = config;
    self.encodeAndWrite(objectPropOpen.replaceAll('$0', prop));
    await self.do_root(self, val);
    self.encodeAndWrite(objectPropClose);

}