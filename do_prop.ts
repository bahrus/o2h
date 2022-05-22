import {O2H, obj_guid} from './o2h.js';
export async function do_prop({self, config}: O2H, srcObj: any, prop: string | number){
    const val = srcObj[prop];
    const typ = typeof val;
    switch(typ){
        case 'object':
            if(val[obj_guid]){
                await (<any>self)[val[obj_guid]](self, srcObj, prop);
            }else{
                if(Array.isArray(val)){
                    await self.do_array_prop(self, srcObj, prop);
                }else{
                    await self.do_object_prop(self, srcObj, prop);
                }
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