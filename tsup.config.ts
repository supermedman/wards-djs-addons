import type { Options } from "tsup";
import { defineConfig } from "tsup";

function createTsupConfig({
    entry = ['./src/index.ts'],
    external = [],
    noExternal = [],
    platform = 'node',
    format = ['esm', 'cjs'],
    target = 'es2022',
    skipNodeModulesBundle = true,
    clean = true,
    shims = format.includes('cjs'),
    cjsInterop = format.includes('cjs'),
    minify = false,
    terserOptions = {
        mangle: false,
        keep_classnames: true,
        keep_fnames: true,
    },
    splitting = false,
    keepNames = true,
    dts = true,
    sourcemap = true,
    esbuildPlugins = [],
    treeshake = false,
    outDir = 'dist',
}: Options = {}) {
    return defineConfig({
        entry,
        external,
        noExternal,
        platform,
        format,
        target,
        skipNodeModulesBundle,
        clean,
        shims,
        cjsInterop,
        minify,
        terserOptions,
        splitting,
        keepNames,
        dts,
        sourcemap,
        esbuildPlugins,
        treeshake,
        outDir,
    });
}

export default createTsupConfig();