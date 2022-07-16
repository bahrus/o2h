import { titleCase } from './o2h.js';
import { o2a } from './o2a.js';
export async function do_string_prop({ self, contextualConfig, stack, encodeAndWrite }, srcObj, prop) {
    const { stringProp, makeStringPropLabelTitleCase } = contextualConfig;
    const val = srcObj[prop];
    let label = self.propString(prop, val);
    if (makeStringPropLabelTitleCase) {
        label = titleCase(label);
    }
    const fullyQualifiedPath = stack.join('.');
    const dashedPath = self.toDashPath();
    let isStatic = true;
    for (const part of stringProp) {
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
                        encodeAndWrite(dashedPath);
                        break;
                    case 'value':
                        encodeAndWrite(val);
                        break;
                    default:
                        throw part + ' not supported';
                }
                break;
            case 'object':
                o2a(part, encodeAndWrite);
                break;
        }
    }
}
