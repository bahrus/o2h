export async function do_number_prop({ self, config }, srcObj, prop) {
    const val = srcObj[prop];
    const { numberPropClose, numberPropOpen, numberPropValue } = config;
    self.encodeAndWrite(numberPropOpen.replaceAll('$0', self.propString(prop)));
    self.encodeAndWrite(numberPropValue.replaceAll('$0', val));
    self.encodeAndWrite(numberPropClose);
}
