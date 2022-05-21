export function do_root(o2h, srcObj, config, encodeAndWrite) {
    encodeAndWrite(config.wrapperOpen);
    if (Array.isArray(srcObj)) {
        for (let i = 0, len = srcObj.length; i < len; i++) {
            o2h.do_array_item(srcObj[i], i);
        }
    }
    else {
        for (const key in srcObj) {
            o2h.do_prop(srcObj[key], key);
        }
    }
    encodeAndWrite(config.wrapperClosed);
}
