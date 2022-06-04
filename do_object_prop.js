import { replMIB } from './o2h.js';
export async function do_object_prop({ self, contextualConfig }, srcObj, prop) {
    const val = srcObj[prop];
    const { objectProp, objectPropBeProps } = contextualConfig;
    self.encodeAndWrite(replMIB(objectProp[0], objectPropBeProps).replaceAll('${label}', self.propString(prop, val)));
    await self.do_object(self, val);
    self.encodeAndWrite(objectProp[1]);
}
