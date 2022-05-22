export async function do_array_prop({ self, config }, srcObj, prop) {
    console.log('do_array_prop');
    const val = srcObj[prop];
    const { arrayPropClose, arrayPropOpen } = config;
    self.encodeAndWrite(arrayPropOpen.replaceAll('$0', self.propString(prop)));
    await self.do_object(self, val);
    self.encodeAndWrite(arrayPropClose);
}
