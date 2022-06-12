import { o2a } from './o2a.js';
export async function do_root({ config, encodeAndWrite, self }, srcObj) {
    let isStatic = true;
    for (const part of config.wrapper) {
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
                        for (const key in srcObj) {
                            await self.do_prop(self, srcObj, key);
                        }
                        break;
                    default:
                        throw 'NI'; //not implemented
                }
            case 'object':
                o2a(part, encodeAndWrite);
                break;
        }
    }
}
