import { replMIB } from './o2h.js';
export async function do_string_prop({ self, contextualConfig, stack }, srcObj, prop) {
    const val = srcObj[prop];
    const { stringProp, stringPropValue, stringPropBeProps } = contextualConfig;
    const fullyQualifiedPath = stack.join('.');
    self.encodeAndWrite(replMIB(stringProp, stringPropBeProps)
        .replaceAll('${label}', self.propString(prop, val))
        .replaceAll('${value}', val)
        .replaceAll('${path}', fullyQualifiedPath));
}
