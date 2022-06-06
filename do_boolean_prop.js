export async function do_boolean_prop({ self, contextualConfig, stack }, srcObj, prop) {
    const val = srcObj[prop];
    const { booleanProp } = contextualConfig;
    const fullyQualifiedPath = stack.join('.');
    self.encodeAndWrite(booleanProp
        .replaceAll('${label}', self.propString(prop, val))
        .replaceAll('${checked}', val ? 'checked' : '')
        .replaceAll('${path}', fullyQualifiedPath));
}
