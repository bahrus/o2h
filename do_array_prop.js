import { titleCase } from './o2h.js';
import { o2a } from './o2a.js';
export async function do_array_prop({ self, contextualConfig, encodeAndWrite }, srcObj, prop) {
    const { arrayProp } = contextualConfig;
    const val = srcObj[prop];
    let label = self.propString(prop, val);
    label = titleCase(label);
    let isStatic = true;
    for (const part of arrayProp) {
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
                        for (let i = 0, len = val.length; i < len; i++) {
                            await self.do_prop(self, val, i);
                        }
                        break;
                    case 'label':
                        encodeAndWrite(label);
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
