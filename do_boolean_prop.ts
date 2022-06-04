import {O2H, replMIB} from './o2h.js';
export async function do_boolean_prop({self, contextualConfig}: O2H, srcObj: any, prop: string | number){
    const val = srcObj[prop];
    const {booleanProp, booleanPropBeProps} = contextualConfig;
    self.encodeAndWrite(
        replMIB(booleanProp, booleanPropBeProps)
        .replaceAll('${label}', self.propString(prop, val))
        .replaceAll('${checked}', val ? 'checked' : '')
    );

}