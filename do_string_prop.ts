import {O2H, replMIB} from './o2h.js';
export async function do_string_prop({self, contextualConfig, stack}: O2H, srcObj: any, prop: string | number){
    //console.log(stack.join('.'));
    const val = srcObj[prop];
    const {stringPropClose, stringPropOpen, stringPropValue, stringPropBeProps} = contextualConfig;
    const fullyQualifiedPath= stack.join('.');
    self.encodeAndWrite(replMIB(stringPropOpen, stringPropBeProps).replaceAll('${label}', self.propString(prop, val)));
    self.encodeAndWrite(stringPropValue.replaceAll('${value}', val).replaceAll('${path}', fullyQualifiedPath));
    self.encodeAndWrite(stringPropClose);

}