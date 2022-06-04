export async function do_root({ config, encodeAndWrite, self }, srcObj) {
    encodeAndWrite(config.wrapper[0]);
    for (const key in srcObj) {
        await self.do_prop(self, srcObj, key);
    }
    encodeAndWrite(config.wrapper[1]);
}
