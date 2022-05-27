import { replMIB } from './o2h.js';
export async function do_boolean_prop({ self, config }, srcObj, prop) {
    const val = srcObj[prop];
    const { booleanPropClose, booleanPropOpen, booleanPropValue, booleanPropBeProps } = config;
    self.encodeAndWrite(replMIB(booleanPropOpen, booleanPropBeProps).replaceAll('$0', self.propString(prop)));
    self.encodeAndWrite(booleanPropValue.replaceAll('$0', val ? 'checked' : ''));
    self.encodeAndWrite(booleanPropClose);
}
