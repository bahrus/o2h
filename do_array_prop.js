export async function do_array_prop({ self, contextualConfig }, srcObj, prop) {
    console.log('do_array_prop');
    const val = srcObj[prop];
    const { arrayProp } = contextualConfig;
    self.encodeAndWrite(arrayProp[0].replaceAll('${label}', self.propString(prop, val)));
    for (let i = 0, len = val.length; i < len; i++) {
        await self.do_prop(self, val, i);
    }
    //await self.do_object(self, val);
    self.encodeAndWrite(arrayProp[1]);
}
