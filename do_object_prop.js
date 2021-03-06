import { titleCase } from './o2h.js';
import { o2a } from './o2a.js';
export async function do_object_prop({ self, contextualConfig, encodeAndWrite, stack }, srcObj, prop) {
    const { objectProp, makeObjectPropLabelTitleCase } = contextualConfig;
    const val = srcObj[prop];
    let label = self.propString(prop, val);
    if (makeObjectPropLabelTitleCase)
        label = titleCase(label);
    const dashedPath = self.toWebComponentName();
    let isStatic = true;
    for (const part of objectProp) {
        if (isStatic) {
            encodeAndWrite(part);
            isStatic = !isStatic;
            continue;
        }
        isStatic = !isStatic;
        switch (typeof part) {
            case 'string':
                switch (part) {
                    case 'children':
                        await self.do_object(self, val);
                        break;
                    case 'label':
                        encodeAndWrite(label);
                        break;
                    case 'dashed-path':
                        encodeAndWrite(dashedPath);
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
