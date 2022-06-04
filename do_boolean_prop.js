import { replMIB } from './o2h.js';
export async function do_boolean_prop({ self, contextualConfig, stack }, srcObj, prop) {
    const val = srcObj[prop];
    const { booleanProp, booleanPropBeProps } = contextualConfig;
    const fullyQualifiedPath = stack.join('.');
    self.encodeAndWrite(replMIB(booleanProp, booleanPropBeProps)
        .replaceAll('${label}', self.propString(prop, val))
        .replaceAll('${checked}', val ? 'checked' : '')
        .replaceAll('${path}', fullyQualifiedPath));
}
