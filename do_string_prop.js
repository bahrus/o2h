export async function do_string_prop({ self, config }, srcObj, prop) {
    const val = srcObj[prop];
    const { stringPropClose, stringPropOpen, stringPropValue } = config;
    self.encodeAndWrite(stringPropOpen.replaceAll('$0', self.propString(prop)));
    self.encodeAndWrite(stringPropValue.replaceAll('$0', val));
    self.encodeAndWrite(stringPropClose);
}
