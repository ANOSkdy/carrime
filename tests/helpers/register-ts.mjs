import { registerHooks } from 'node:module';

// Match Next's local .ts resolution for native Node tests, without adding a
// test framework or changing application compilation/module settings.
const root = new URL('../../', import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    const local = specifier.startsWith('@/') ? new URL(specifier.slice(2), root).href : specifier;
    if (local.startsWith('.') || local.startsWith('file:')) {
      try { return next(local, context); }
      catch (error) {
        if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
        return next(`${local}.ts`, context);
      }
    }
    return next(specifier, context);
  },
});
