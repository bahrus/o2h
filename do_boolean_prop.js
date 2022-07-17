import { titleCase } from './o2h.js';
import { o2a } from './o2a.js';
export async function do_boolean_prop({ self, contextualConfig, stack, encodeAndWrite }, srcObj, prop) {
    const { booleanProp, makeBooleanPropLabelTitleCase } = contextualConfig;
    const val = srcObj[prop];
    let label = self.propString(prop, val);
    if (makeBooleanPropLabelTitleCase)
        label = titleCase(label);
    const fullyQualifiedPath = stack.join('.');
    const dashedPath = self.toWebComponentName();
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
                    case 'dashed-path':
                        if (dashedPath !== undefined)
                            encodeAndWrite(dashedPath);
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
