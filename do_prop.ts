import {O2H} from './o2h.js';
export async function do_prop({self, config}: O2H, srcObj: any, prop: string | number){
    const val = srcObj[prop];
    const typ = typeof val;
    switch(typ){
        case 'object':
            if(Array.isArray(val)){
                await self.do_array_prop(self, srcObj, prop);
            }else{
                await self.do_object_prop(self, srcObj, prop);
            }
            break;
        default:
            try{
                await (<any>self)['do_' + typ + '_prop'](self, srcObj, prop);
            }catch(e){
                console.error('do_' + typ + '_prop not found');
                throw e;
            }
            
    }
}