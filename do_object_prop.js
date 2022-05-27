import { replMIB } from './o2h.js';
export async function do_object_prop({ self, config }, srcObj, prop) {
    const val = srcObj[prop];
    const { objectPropClose, objectPropOpen, objectPropBeProps } = config;
    self.encodeAndWrite(replMIB(objectPropOpen, objectPropBeProps).replaceAll('$0', self.propString(prop)));
    await self.do_object(self, val);
    self.encodeAndWrite(objectPropClose);
}
