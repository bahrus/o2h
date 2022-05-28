import { replMIB } from './o2h.js';
export async function do_array_prop({ self, contextualConfig }, srcObj, prop) {
    console.log('do_array_prop');
    const val = srcObj[prop];
    const { arrayPropClose, arrayPropOpen, arrayPropBeProps } = contextualConfig;
    self.encodeAndWrite(replMIB(arrayPropOpen, arrayPropBeProps).replaceAll('$0', self.propString(prop, val)));
    for (let i = 0, len = val.length; i < len; i++) {
        await self.do_prop(self, val, i);
    }
    //await self.do_object(self, val);
    self.encodeAndWrite(arrayPropClose);
}
