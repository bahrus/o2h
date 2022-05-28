import {O2H, replMIB} from './o2h.js';
export async function do_boolean_prop({self, contextualConfig}: O2H, srcObj: any, prop: string | number){
    const val = srcObj[prop];
    const {booleanPropClose, booleanPropOpen, booleanPropValue, booleanPropBeProps} = contextualConfig;
    self.encodeAndWrite(replMIB(booleanPropOpen, booleanPropBeProps).replaceAll('$0', self.propString(prop)));
    self.encodeAndWrite(booleanPropValue.replaceAll('$0', val ? 'checked' : ''));
    self.encodeAndWrite(booleanPropClose);

}