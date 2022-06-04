import {O2H, replMIB} from './o2h.js';
export async function do_number_prop({self, contextualConfig}: O2H, srcObj: any, prop: string | number){
    const val = srcObj[prop];
    const {numberProp, numberPropBeProps} = contextualConfig;
    self.encodeAndWrite(
        replMIB(numberProp, numberPropBeProps)
        .replaceAll('${label}', self.propString(prop, val))
        .replaceAll('${value}', val)
    );

}