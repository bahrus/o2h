import {O2H} from './o2h.js';
export async function do_prop({self, config}: O2H, srcObj: any, prop: string){
    const val = srcObj[prop];
    const typ = typeof val;
    switch(typ){
        default:
            await (<any>self)['do_' + typ + '_prop'](self, srcObj, prop);
    }
}