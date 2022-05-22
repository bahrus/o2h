export async function do_array_prop({ self, config }, srcObj, prop) {
    const val = srcObj[prop];
    const { arrayPropClose, arrayPropOpen } = config;
    self.encodeAndWrite(arrayPropOpen.replaceAll('$0', prop));
    await self.do_root(self, val);
    self.encodeAndWrite(arrayPropClose);
}
