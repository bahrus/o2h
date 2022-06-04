import { replMIB } from './o2h.js';
export async function do_boolean_prop({ self, contextualConfig }, srcObj, prop) {
    const val = srcObj[prop];
    const { booleanProp, booleanPropBeProps } = contextualConfig;
    self.encodeAndWrite(replMIB(booleanProp, booleanPropBeProps)
        .replaceAll('${label}', self.propString(prop, val))
        .replaceAll('${checked}', val ? 'checked' : ''));
}
