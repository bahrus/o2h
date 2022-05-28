import { replMIB } from './o2h.js';
export async function do_number_prop({ self, contextualConfig }, srcObj, prop) {
    const val = srcObj[prop];
    const { numberPropClose, numberPropOpen, numberPropValue, numberPropBeProps } = contextualConfig;
    self.encodeAndWrite(replMIB(numberPropOpen, numberPropBeProps).replaceAll('$0', self.propString(prop)));
    self.encodeAndWrite(numberPropValue.replaceAll('$0', val));
    self.encodeAndWrite(numberPropClose);
}
