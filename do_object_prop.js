import { replMIB } from './o2h.js';
export async function do_object_prop({ self, contextualConfig }, srcObj, prop) {
    const val = srcObj[prop];
    const { objectPropClose, objectPropOpen, objectPropBeProps } = contextualConfig;
    self.encodeAndWrite(replMIB(objectPropOpen, objectPropBeProps).replaceAll('${label}', self.propString(prop, val)));
    await self.do_object(self, val);
    self.encodeAndWrite(objectPropClose);
}
