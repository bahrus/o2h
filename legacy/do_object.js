export async function do_object({ config, encodeAndWrite, self }, srcObj) {
    for (const key in srcObj) {
        await self.do_prop(self, srcObj, key);
    }
}
