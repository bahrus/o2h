import {O2H, replMIB} from './o2h.js';
export async function do_string_prop({self, contextualConfig, stack}: O2H, srcObj: any, prop: string | number){
    console.log(stack.join('.'));
    const val = srcObj[prop];
    const {stringPropClose, stringPropOpen, stringPropValue, stringPropBeProps} = contextualConfig;
    self.encodeAndWrite(replMIB(stringPropOpen, stringPropBeProps).replaceAll('$0', self.propString(prop)));
    self.encodeAndWrite(stringPropValue.replaceAll('$0', val));
    self.encodeAndWrite(stringPropClose);

}