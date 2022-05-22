export async function do_array_prop({ self, config }, srcObj, prop) {
    console.log('do_array_prop');
    const val = srcObj[prop];
    const { arrayPropClose, arrayPropOpen } = config;
    self.encodeAndWrite(arrayPropOpen.replaceAll('$0', self.propString(prop)));
    for (let i = 0, len = val.length; i < len; i++) {
        await self.do_prop(self, val, i);
    }
    //await self.do_object(self, val);
    self.encodeAndWrite(arrayPropClose);
}
