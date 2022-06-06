import {O2H, replMIB} from './o2h.js';
export async function do_string_prop({self, contextualConfig, stack}: O2H, srcObj: any, prop: string | number){
    const val = srcObj[prop];
    const {stringProp, stringPropValue} = contextualConfig;
    const fullyQualifiedPath= stack.join('.');
    self.encodeAndWrite(
        stringProp
        .replaceAll('${label}', self.propString(prop, val))
        .replaceAll('${value}', val)
        .replaceAll('${path}', fullyQualifiedPath)
    );
}