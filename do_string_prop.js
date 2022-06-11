export async function do_string_prop({ self, contextualConfig, stack }, srcObj, prop) {
    const val = srcObj[prop];
    const { stringProp } = contextualConfig;
    const fullyQualifiedPath = stack.join('.');
    self.encodeAndWrite(stringProp
        .replaceAll('${label}', self.propString(prop, val))
        .replaceAll('${value}', val)
        .replaceAll('${path}', fullyQualifiedPath));
}
