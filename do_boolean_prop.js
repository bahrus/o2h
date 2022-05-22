export async function do_boolean_prop({ self, config }, srcObj, prop) {
    const val = srcObj[prop];
    const { booleanPropClose, booleanPropOpen, booleanPropValue } = config;
    self.encodeAndWrite(booleanPropOpen.replaceAll('$0', self.propString(prop)));
    self.encodeAndWrite(booleanPropValue.replaceAll('$0', val ? 'checked' : ''));
    self.encodeAndWrite(booleanPropClose);
}
