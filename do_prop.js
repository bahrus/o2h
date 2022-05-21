export async function do_prop({ self, config }, srcObj, prop) {
    const val = srcObj[prop];
    const typ = typeof val;
    switch (typ) {
        default:
            console.log({ typ });
            self['do_' + typ + '_prop'](self, srcObj, prop);
    }
}
