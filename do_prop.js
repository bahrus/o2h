export async function do_prop({ self, config }, srcObj, prop) {
    const val = srcObj[prop];
    const typ = typeof val;
    switch (typ) {
        case 'object':
            // if(val[obj_guid]){
            //     await (<any>self)[val[obj_guid]](self, srcObj, prop);
            // }else{
            if (Array.isArray(val)) {
                await self.do_array_prop(self, srcObj, prop);
            }
            else {
                await self.do_object_prop(self, srcObj, prop);
            }
            //}
            break;
        default:
            try {
                await self['do_' + typ + '_prop'](self, srcObj, prop);
            }
            catch (e) {
                console.error('do_' + typ + '_prop not found');
                throw e;
            }
    }
}
