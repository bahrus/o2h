export async function do_array_item({ self, config }, srcObj, idx) {
    const val = srcObj[idx];
    const { objectPropClose, objectPropOpen } = config;
    self.encodeAndWrite(objectPropOpen.replaceAll('$0', idx));
    await self.do_object(self, val);
    self.encodeAndWrite(objectPropClose);
}
