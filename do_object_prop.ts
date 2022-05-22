import {o2h, O2H} from './o2h.js';
export async function do_object_prop({self, config}: O2H, srcObj: any, prop: string | number){
    const val = srcObj[prop];
    const {objectPropClose, objectPropOpen} = config;
    self.encodeAndWrite(objectPropOpen.replaceAll('$0', self.propString(prop)));
    await self.do_object(self, val);
    self.encodeAndWrite(objectPropClose);
}