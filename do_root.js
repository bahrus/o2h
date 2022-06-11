import { o2a } from './o2a.js';
export async function do_root({ config, encodeAndWrite, self }, srcObj) {
    for (const part of config.wrapper) {
        switch (typeof part) {
            case 'string':
                if (part === '|') {
                    for (const key in srcObj) {
                        await self.do_prop(self, srcObj, key);
                    }
                }
                else {
                    encodeAndWrite(part);
                }
                break;
            case 'object':
                o2a(part, encodeAndWrite);
                break;
        }
    }
}
