import {O2H, replMIB} from './o2h.js';
export async function do_string_prop({self, config}: O2H, srcObj: any, prop: string | number){
    const val = srcObj[prop];
    const {stringPropClose, stringPropOpen, stringPropValue, stringPropBeProps} = config;
    self.encodeAndWrite(replMIB(stringPropOpen, stringPropBeProps).replaceAll('$0', self.propString(prop)));
    self.encodeAndWrite(stringPropValue.replaceAll('$0', val));
    self.encodeAndWrite(stringPropClose);

}