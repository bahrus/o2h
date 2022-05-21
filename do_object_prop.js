export async function do_object_prop({ self, config }, srcObj, prop) {
    const val = srcObj[prop];
    const { objectPropClose, objectPropOpen } = config;
    self.encodeAndWrite(objectPropOpen.replaceAll('$0', prop));
    await self.do_root(self, val);
    self.encodeAndWrite(objectPropClose);
}
