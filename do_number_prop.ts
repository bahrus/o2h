import {O2H} from './o2h.js';
export async function do_number_prop({self, config}: O2H, srcObj: any, prop: string | number){
    const val = srcObj[prop];
    const {numberPropClose, numberPropOpen, numberPropValue} = config;
    self.encodeAndWrite(numberPropOpen.replaceAll('$0', self.propString(prop)));
    self.encodeAndWrite(numberPropValue.replaceAll('$0', val));
    self.encodeAndWrite(numberPropClose);

}