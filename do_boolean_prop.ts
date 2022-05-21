import {O2H} from './o2h.js';
export async function do_boolean_prop({self, config}: O2H, srcObj: any, prop: string){
    const val = srcObj[prop];
    const {booleanPropClose, booleanPropOpen, booleanPropValue} = config;
    self.encodeAndWrite(booleanPropOpen.replaceAll('$0', prop));
    self.encodeAndWrite(booleanPropValue.replaceAll('$0', val ? 'checked' : ''));
    self.encodeAndWrite(booleanPropClose);

}