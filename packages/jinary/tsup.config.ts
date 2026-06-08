import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/react/index.ts'],
    format: ['esm', 'cjs'],
    dts: {
        compilerOptions: {
            ignoreDeprecations: '6.0',
        },
    },
    clean: true,
    sourcemap: true,
    treeshake: true,
    splitting: false,
    target: 'es2022',
});
