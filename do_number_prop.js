import { replMIB } from './o2h.js';
export async function do_number_prop({ self, contextualConfig }, srcObj, prop) {
    const val = srcObj[prop];
    const { numberPropClose, numberPropOpen, numberPropValue, numberPropBeProps } = contextualConfig;
    self.encodeAndWrite(replMIB(numberPropOpen, numberPropBeProps).replaceAll('${label}', self.propString(prop, val)));
    self.encodeAndWrite(numberPropValue.replaceAll('${value}', val));
    self.encodeAndWrite(numberPropClose);
}
