import { defineConfig, type Options } from 'tsup'

const common: Options = {
  dts: true,
  external: ['react', 'react/jsx-runtime', 'next/script'],
  format: ['esm'],
  minify: false,
  shims: false,
  sourcemap: true,
  splitting: false,
  target: 'node20',
  treeshake: true
}

export default defineConfig([
  {
    ...common,
    entry: {
      index: 'src/index.ts',
      node: 'src/node.ts',
      cli: 'src/cli.ts'
    },
    clean: true
  },
  {
    ...common,
    entry: {
      react: 'src/react.tsx'
    },
    clean: false
  },
  {
    ...common,
    entry: {
      next: 'src/next.tsx'
    },
    clean: false
  }
])
