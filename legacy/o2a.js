import { camelToLisp } from 'may-it-be/camelToLisp.js';
export function o2a(srcObj, encodeAndWrite) {
    for (const key in srcObj) {
        encodeAndWrite(`${camelToLisp(key)} = ${JSON.stringify(srcObj[key])}`);
    }
}
