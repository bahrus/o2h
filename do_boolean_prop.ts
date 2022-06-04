import {O2H, replMIB} from './o2h.js';
export async function do_boolean_prop({self, contextualConfig, stack}: O2H, srcObj: any, prop: string | number){
    const val = srcObj[prop];
    const {booleanProp, booleanPropBeProps} = contextualConfig;
    const fullyQualifiedPath= stack.join('.');
    self.encodeAndWrite(
        replMIB(booleanProp, booleanPropBeProps)
        .replaceAll('${label}', self.propString(prop, val))
        .replaceAll('${checked}', val ? 'checked' : '')
        .replaceAll('${path}', fullyQualifiedPath)
    );

}