import { replMIB } from './o2h.js';
export async function do_string_prop({ self, contextualConfig, stack }, srcObj, prop) {
    //console.log(stack.join('.'));
    const val = srcObj[prop];
    const { stringPropClose, stringPropOpen, stringPropValue, stringPropBeProps } = contextualConfig;
    const fullyQualifiedPath = stack.join('.');
    self.encodeAndWrite(replMIB(stringPropOpen, stringPropBeProps).replaceAll('${label}', self.propString(prop, val)));
    self.encodeAndWrite(stringPropValue.replaceAll('${value}', val).replaceAll('${path}', fullyQualifiedPath));
    self.encodeAndWrite(stringPropClose);
}
