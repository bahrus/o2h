import { replMIB } from './o2h.js';
export async function do_number_prop({ self, contextualConfig, stack }, srcObj, prop) {
    const val = srcObj[prop];
    const { numberProp, numberPropBeProps } = contextualConfig;
    const fullyQualifiedPath = stack.join('.');
    self.encodeAndWrite(replMIB(numberProp, numberPropBeProps)
        .replaceAll('${label}', self.propString(prop, val))
        .replaceAll('${value}', val)
        .replaceAll('${path}', fullyQualifiedPath));
}
