import { o2a } from './o2a.js';
export async function do_boolean_prop({ self, contextualConfig, stack, encodeAndWrite }, srcObj, prop) {
    const val = srcObj[prop];
    console.log(val);
    const label = self.propString(prop, val);
    const { booleanProp } = contextualConfig;
    const fullyQualifiedPath = stack.join('.');
    let isStatic = true;
    for (const part of booleanProp) {
        if (isStatic) {
            encodeAndWrite(part);
            isStatic = !isStatic;
            continue;
        }
        isStatic = !isStatic;
        switch (typeof part) {
            case 'string':
                switch (part) {
                    case 'label':
                        encodeAndWrite(label);
                        break;
                    case 'path':
                        encodeAndWrite(fullyQualifiedPath);
                        break;
                    case 'checked':
                        if (val)
                            encodeAndWrite('checked');
                        break;
                    default:
                        throw 'NI'; //not implemented
                }
                break;
            case 'object':
                o2a(part, encodeAndWrite);
                break;
        }
    }
}
