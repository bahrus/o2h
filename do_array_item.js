export async function do_array_item({ self, config }, srcObj, idx) {
    const val = srcObj[idx];
    const { arrayItemClose, arrayItemOpen } = config;
    self.encodeAndWrite(arrayItemOpen.replaceAll('$0', idx.toString()));
    await self.do_object(self, val);
    self.encodeAndWrite(arrayItemClose);
}
