import {o2h, O2H, replMIB} from './o2h.js';
export async function do_object_prop({self, contextualConfig}: O2H, srcObj: any, prop: string | number){
    const val = srcObj[prop];
    const {objectProp} = contextualConfig;
    self.encodeAndWrite(objectProp[0].replaceAll('${label}', self.propString(prop, val)));
    await self.do_object(self, val);
    self.encodeAndWrite(objectProp[1]);
}