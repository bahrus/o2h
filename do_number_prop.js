export async function do_number_prop({ self, contextualConfig, stack }, srcObj, prop) {
    const val = srcObj[prop];
    const { numberProp } = contextualConfig;
    const fullyQualifiedPath = stack.join('.');
    self.encodeAndWrite(numberProp
        .replaceAll('${label}', self.propString(prop, val))
        .replaceAll('${value}', val)
        .replaceAll('${path}', fullyQualifiedPath));
}
